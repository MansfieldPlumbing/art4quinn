// assets/ml/inpaint.js
// ---------------------------------------------------------------------------
// Magic Eraser — content-aware fill (object removal). Brush/select a region,
// and LaMa repaints it from the surroundings (true inpainting, not just a
// transparent cut-out).
//
// LaMa (big-lama) converted to ONNX (Carve/LaMa-ONNX), run with onnxruntime-web
// (WebGPU, WASM fallback). The model is ~200MB and runs at a fixed 512x512, so
// we inpaint only a PADDED CROP around the hole: tiny tensors, full-res
// preserved everywhere outside the hole, and the masked pixels composited back.
//
// ⚠ NEEDS ON-DEVICE VERIFICATION: the exact ONNX input/output names and value
// range aren't contractually fixed across exports. This module maps I/O by name
// (falling back to order) and auto-detects whether the output is [0,1] or
// [0,255]. If a future model differs, those two spots are where to look.
//
// API:  const patched = await inpaint(imageCanvas, maskCanvas, onStatus)
//        imageCanvas = the picture; maskCanvas = white/opaque where to erase.
//        returns a NEW canvas (same size as imageCanvas) with the hole filled.
// ---------------------------------------------------------------------------

const ORT_VER = '1.20.1';
const ORT = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/ort.webgpu.bundle.min.mjs`;
const MODEL_URL = 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx';
const SIZE = 512;     // LaMa fixed working size
const PAD = 0.35;     // context padding around the hole bbox

let _ready = null, _busy = false;
let _forceWasm = (() => { try { return localStorage.getItem('a4q-ml-wasm') === '1'; } catch (_) { return false; } })();

export function inpaintBusy() { return _busy; }

function isGpuError(e) { return /webgpu|gpu|ortrun|bind ?group|validation|createbindgroup|shader|device lost/i.test(String((e && e.message) || e)); }
async function withWasmFallback(run, onStatus) {
  try { return await run(); }
  catch (e) {
    if (_forceWasm || !isGpuError(e)) throw e;
    onStatus && onStatus('GPU not supported here — switching to compatibility mode…');
    _forceWasm = true; try { localStorage.setItem('a4q-ml-wasm', '1'); } catch (_) {} await disposeInpainter();   // rebuild the ORT session on WASM
    return await run();
  }
}

async function fetchWithProgress(url, onStatus) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('model ' + res.status);
  const total = +res.headers.get('content-length') || 0;
  if (!res.body || !total) return await res.arrayBuffer();
  const reader = res.body.getReader(); const chunks = []; let got = 0, last = -1;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    chunks.push(value); got += value.length;
    const pct = Math.round(got / total * 100);
    if (onStatus && pct !== last) { last = pct; onStatus(`downloading eraser ${pct}%`); }
  }
  const buf = new Uint8Array(got); let p = 0; for (const c of chunks) { buf.set(c, p); p += c.length; }
  return buf.buffer;
}

async function ensure(onStatus) {
  if (_ready) return _ready;
  _ready = (async () => {
    onStatus && onStatus('loading magic eraser…');
    const ort = await import(/* @vite-ignore */ ORT);
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/`;
    ort.env.wasm.simd = true;
    const providers = (!_forceWasm && typeof navigator !== 'undefined' && navigator.gpu) ? ['webgpu', 'wasm'] : ['wasm'];
    const buf = await fetchWithProgress(MODEL_URL, onStatus);   // cached by the browser HTTP cache
    onStatus && onStatus('warming up eraser…');
    const opts = { executionProviders: providers };
    let session;
    try {
      ort.env.wasm.proxy = true;                                // run inference in a Worker -> no UI hang
      session = await ort.InferenceSession.create(buf, opts);
    } catch (e) {                                               // some builds can't proxy -> fall back to main thread
      ort.env.wasm.proxy = false;
      const buf2 = await fetchWithProgress(MODEL_URL);          // served from cache, fast
      session = await ort.InferenceSession.create(buf2, opts);
    }
    return { ort, session };
  })().catch((e) => { _ready = null; throw e; });
  return _ready;
}

export async function disposeInpainter() {
  if (!_ready) return;
  try { const r = await _ready; await r.session?.release?.(); } catch (_) {}
  _ready = null;
}

// Grow the mask by ~r px (blur + threshold). Erasers must over-cover: a tight
// mask leaves the object's halo/shadow behind, so we pad before inpainting.
function dilateMask(mask, r) {
  if (r <= 0) return mask;
  const c = document.createElement('canvas'); c.width = mask.width; c.height = mask.height;
  const g = c.getContext('2d');
  g.filter = `blur(${r}px)`; g.drawImage(mask, 0, 0); g.filter = 'none';
  const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 8 ? 255 : 0;   // threshold the feather back to solid
  g.putImageData(id, 0, 0); return c;
}

// padded, clamped integer crop rect around the mask's opaque bbox
function maskBounds(maskCanvas) {
  const W = maskCanvas.width, H = maskCanvas.height;
  const d = maskCanvas.getContext('2d').getImageData(0, 0, W, H).data;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 16) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) return null;
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const px = bw * PAD, py = bh * PAD;
  const x0 = Math.max(0, Math.floor(minX - px)), y0 = Math.max(0, Math.floor(minY - py));
  const x1 = Math.min(W, Math.ceil(maxX + 1 + px)), y1 = Math.min(H, Math.ceil(maxY + 1 + py));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export async function inpaint(imageCanvas, maskCanvas, onStatus) {
  if (_busy) throw new Error('eraser is busy');
  _busy = true;
  try { return await withWasmFallback(() => _inpaintInfer(imageCanvas, maskCanvas, onStatus), onStatus); }
  finally { _busy = false; }
}

async function _inpaintInfer(imageCanvas, maskCanvas, onStatus) {
  {
    const { ort, session } = await ensure(onStatus);
    const pad = Math.max(3, Math.min(28, Math.round(Math.max(imageCanvas.width, imageCanvas.height) * 0.012)));
    maskCanvas = dilateMask(maskCanvas, pad);                   // pad so we catch the object's edges/halo
    const crop = maskBounds(maskCanvas);
    if (!crop) throw new Error('nothing marked to erase');
    onStatus && onStatus('erasing…');

    // 512x512 crops of the image + mask
    const ic = document.createElement('canvas'); ic.width = SIZE; ic.height = SIZE;
    ic.getContext('2d').drawImage(imageCanvas, crop.x, crop.y, crop.w, crop.h, 0, 0, SIZE, SIZE);
    const mc = document.createElement('canvas'); mc.width = SIZE; mc.height = SIZE;
    mc.getContext('2d').drawImage(maskCanvas, crop.x, crop.y, crop.w, crop.h, 0, 0, SIZE, SIZE);

    const img = ic.getContext('2d').getImageData(0, 0, SIZE, SIZE).data;
    const msk = mc.getContext('2d').getImageData(0, 0, SIZE, SIZE).data;
    const HW = SIZE * SIZE;
    const imgT = new Float32Array(3 * HW), mskT = new Float32Array(HW);
    for (let i = 0; i < HW; i++) {
      imgT[i] = img[i * 4] / 255;             // CHW, channel-major
      imgT[HW + i] = img[i * 4 + 1] / 255;
      imgT[2 * HW + i] = img[i * 4 + 2] / 255;
      mskT[i] = msk[i * 4 + 3] > 16 ? 1 : 0;  // 1 = hole
    }

    const names = session.inputNames;
    const imageName = names.find((n) => /image|input/i.test(n)) || names[0];
    const maskName = names.find((n) => /mask/i.test(n)) || names[1];
    const feeds = {};
    feeds[imageName] = new ort.Tensor('float32', imgT, [1, 3, SIZE, SIZE]);
    feeds[maskName] = new ort.Tensor('float32', mskT, [1, 1, SIZE, SIZE]);
    const result = await session.run(feeds);
    const out = result[session.outputNames[0]].data;

    // auto-detect range: [0,1] vs [0,255]
    let mx = 0; for (let i = 0; i < out.length; i += 997) if (out[i] > mx) mx = out[i];
    const scale = mx <= 1.5 ? 255 : 1;

    const oc = document.createElement('canvas'); oc.width = SIZE; oc.height = SIZE;
    const octx = oc.getContext('2d'); const oid = octx.createImageData(SIZE, SIZE);
    for (let i = 0; i < HW; i++) {
      oid.data[i * 4] = Math.max(0, Math.min(255, out[i] * scale));
      oid.data[i * 4 + 1] = Math.max(0, Math.min(255, out[HW + i] * scale));
      oid.data[i * 4 + 2] = Math.max(0, Math.min(255, out[2 * HW + i] * scale));
      oid.data[i * 4 + 3] = 255;
    }
    octx.putImageData(oid, 0, 0);

    // patch = inpainted crop, masked so ONLY the hole is replaced (soft edge)
    const patch = document.createElement('canvas'); patch.width = crop.w; patch.height = crop.h;
    const pctx = patch.getContext('2d'); pctx.imageSmoothingQuality = 'high';
    pctx.drawImage(oc, 0, 0, crop.w, crop.h);
    pctx.globalCompositeOperation = 'destination-in';
    pctx.drawImage(maskCanvas, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);

    const result2 = document.createElement('canvas'); result2.width = imageCanvas.width; result2.height = imageCanvas.height;
    const rctx = result2.getContext('2d');
    rctx.drawImage(imageCanvas, 0, 0);
    rctx.drawImage(patch, crop.x, crop.y);
    onStatus && onStatus('erased ✨');
    return result2;
  }
}
