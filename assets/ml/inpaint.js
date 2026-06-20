// assets/ml/inpaint.js
// ---------------------------------------------------------------------------
// Magic Eraser — content-aware fill (object removal), powered by MI-GAN.
//
// LaMa was ~200MB and slow/soft. MI-GAN (Picsart, ICCV-2023) is built for
// mobile: ~29MB, an order of magnitude faster, and it ships as a *pipeline*
// ONNX that takes a raw uint8 image + mask and does the crop-around-mask,
// resize-to-512, normalize, run, and blend-back internally — so we just hand
// it the picture and the mask and get the finished image back.
//
// Runs on WebGPU (Dawn) first for speed, WASM fallback, in a proxy Worker so the
// UI never hangs.
//
//   model input  : "image" uint8 RGB,  "mask" uint8 gray (255 = keep, 0 = erase)
//   model output : uint8 RGB, full image already blended
// Tensor SHAPES aren't documented, so we read the names at runtime and try
// NHWC then NCHW (both in and out are auto-detected from dims).
//
// API:  const patched = await inpaint(imageCanvas, maskCanvas, onStatus)
//        maskCanvas = white/opaque where to erase. Returns a NEW canvas.
// ---------------------------------------------------------------------------

const ORT_VER = '1.20.1';
const ORT = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/ort.webgpu.bundle.min.mjs`;
const MODEL_URL = 'https://huggingface.co/andraniksargsyan/migan/resolve/main/migan_pipeline_v2.onnx';
const MAX_IN = 2048;   // cap the input we hand the pipeline (it resizes internally anyway)
const PAD = 0.012;     // dilate the mask by ~1.2% so we catch the object's edge/halo

let _ready = null, _busy = false;
let _forceWasm = (() => { try { return localStorage.getItem('a4q-ml-wasm') === '1'; } catch (_) { return false; } })();

export function inpaintBusy() { return _busy; }

function isGpuError(e) { return /webgpu|gpu|ortrun|bind ?group|validation|createbindgroup|shader|device lost/i.test(String((e && e.message) || e)); }
async function withWasmFallback(run, onStatus) {
  try { return await run(); }
  catch (e) {
    if (_forceWasm || !isGpuError(e)) throw e;
    onStatus && onStatus('GPU not supported here — switching to compatibility mode…');
    _forceWasm = true; try { localStorage.setItem('a4q-ml-wasm', '1'); } catch (_) {} await disposeInpainter();
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
    const buf = await fetchWithProgress(MODEL_URL, onStatus);
    onStatus && onStatus('warming up eraser…');
    const opts = { executionProviders: providers };
    let session;
    try { ort.env.wasm.proxy = true; session = await ort.InferenceSession.create(buf, opts); }   // off-main-thread
    catch (e) { ort.env.wasm.proxy = false; const b2 = await fetchWithProgress(MODEL_URL); session = await ort.InferenceSession.create(b2, opts); }
    return { ort, session };
  })().catch((e) => { _ready = null; throw e; });
  return _ready;
}

export async function disposeInpainter() {
  if (!_ready) return;
  try { const r = await _ready; await r.session?.release?.(); } catch (_) {}
  _ready = null;
}

// Grow the mask by ~r px so the erase covers the object's edge/halo.
function dilateMask(mask, r) {
  if (r <= 0) return mask;
  const c = document.createElement('canvas'); c.width = mask.width; c.height = mask.height;
  const g = c.getContext('2d');
  g.filter = `blur(${r}px)`; g.drawImage(mask, 0, 0); g.filter = 'none';
  const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 8 ? 255 : 0;
  g.putImageData(id, 0, 0); return c;
}

function imageTensor(ort, rgba, w, h, nchw) {
  const N = w * h;
  if (nchw) { const t = new Uint8Array(3 * N); for (let i = 0; i < N; i++) { t[i] = rgba[i * 4]; t[N + i] = rgba[i * 4 + 1]; t[2 * N + i] = rgba[i * 4 + 2]; } return new ort.Tensor('uint8', t, [1, 3, h, w]); }
  const t = new Uint8Array(N * 3); for (let i = 0; i < N; i++) { t[i * 3] = rgba[i * 4]; t[i * 3 + 1] = rgba[i * 4 + 1]; t[i * 3 + 2] = rgba[i * 4 + 2]; }
  return new ort.Tensor('uint8', t, [1, h, w, 3]);
}
function maskTensor(ort, mrgba, w, h, nchw) {
  const N = w * h, t = new Uint8Array(N);
  for (let i = 0; i < N; i++) t[i] = mrgba[i * 4 + 3] > 16 ? 0 : 255;   // selection(opaque) -> erase -> 0; else keep -> 255
  return new ort.Tensor('uint8', t, nchw ? [1, 1, h, w] : [1, h, w, 1]);
}

export async function inpaint(imageCanvas, maskCanvas, onStatus) {
  if (_busy) throw new Error('eraser is busy');
  _busy = true;
  try { return await withWasmFallback(() => _inpaintInfer(imageCanvas, maskCanvas, onStatus), onStatus); }
  finally { _busy = false; }
}

async function _inpaintInfer(imageCanvas, maskCanvas, onStatus) {
  const { ort, session } = await ensure(onStatus);
  onStatus && onStatus('erasing…');

  const pad = Math.max(3, Math.min(28, Math.round(Math.max(imageCanvas.width, imageCanvas.height) * PAD)));
  const mask = dilateMask(maskCanvas, pad);

  const scale = Math.min(1, MAX_IN / Math.max(imageCanvas.width, imageCanvas.height));
  const w = Math.max(1, Math.round(imageCanvas.width * scale)), h = Math.max(1, Math.round(imageCanvas.height * scale));
  const ic = document.createElement('canvas'); ic.width = w; ic.height = h; ic.getContext('2d').drawImage(imageCanvas, 0, 0, w, h);
  const mc = document.createElement('canvas'); mc.width = w; mc.height = h; mc.getContext('2d').drawImage(mask, 0, 0, w, h);
  const rgba = ic.getContext('2d').getImageData(0, 0, w, h).data;
  const mrgba = mc.getContext('2d').getImageData(0, 0, w, h).data;

  const names = session.inputNames;
  const inImg = names.find((n) => /image|img|input/i.test(n)) || names[0];
  const inMask = names.find((n) => /mask/i.test(n)) || names[1];

  // MI-GAN pipeline expects NCHW uint8: image [1,3,H,W], mask [1,1,H,W] (255 keep, 0 erase).
  const feeds = {};
  feeds[inImg] = imageTensor(ort, rgba, w, h, true);
  feeds[inMask] = maskTensor(ort, mrgba, w, h, true);
  const r = await session.run(feeds); const out = r[session.outputNames[0]];

  // decode output (auto-detect layout from dims)
  const d = out.data, dims = out.dims;
  let ow, oh, nchwOut;
  if (dims.length === 4) { if (dims[3] === 3) { oh = dims[1]; ow = dims[2]; nchwOut = false; } else { oh = dims[2]; ow = dims[3]; nchwOut = true; } }
  else { if (dims[dims.length - 1] === 3) { oh = dims[0]; ow = dims[1]; nchwOut = false; } else { oh = dims[1]; ow = dims[2]; nchwOut = true; } }
  const N = ow * oh;
  const oc = document.createElement('canvas'); oc.width = ow; oc.height = oh;
  const oid = oc.getContext('2d').createImageData(ow, oh);
  const f = d instanceof Float32Array ? 255 : 1;                  // handle the rare float export
  for (let i = 0; i < N; i++) {
    if (nchwOut) { oid.data[i*4] = d[i]*f; oid.data[i*4+1] = d[N+i]*f; oid.data[i*4+2] = d[2*N+i]*f; }
    else { oid.data[i*4] = d[i*3]*f; oid.data[i*4+1] = d[i*3+1]*f; oid.data[i*4+2] = d[i*3+2]*f; }
    oid.data[i*4+3] = 255;
  }
  oc.getContext('2d').putImageData(oid, 0, 0);

  // back to the original size
  const result = document.createElement('canvas'); result.width = imageCanvas.width; result.height = imageCanvas.height;
  const rctx = result.getContext('2d'); rctx.imageSmoothingQuality = 'high'; rctx.drawImage(oc, 0, 0, result.width, result.height);
  onStatus && onStatus('erased ✨');
  return result;
}
