// assets/ml/select.js
// ---------------------------------------------------------------------------
// AI Magic Wand — interactive tap-to-select (like Samsung Gallery / Google Photos).
//
// Uses SlimSAM (a pruned Segment Anything) via Transformers.js. The heavy image
// encoder runs ONCE per image and is cached; each tap only runs the light mask
// decoder, so selection feels instant after the first tap.
//
// Memory safety mirrors segment.js: input is downscaled to MAX_IN before the
// encoder, single-job lock, and a disposeSelector() to free GPU memory.
//
// API:
//   await primeSelector(srcCanvas, key, onStatus)   // optional warm-up (encode)
//   const { mask, bounds } = await selectAt(srcCanvas, x, y, key, onStatus)
//        mask   = <canvas> the size of srcCanvas, white(opaque)=object
//        bounds = { x, y, w, h } in srcCanvas pixels
//   invalidate(key?)        // drop the cached embedding (after the image changes)
//   await disposeSelector()
// ---------------------------------------------------------------------------

const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4';
const MODEL = 'Xenova/slimsam-77-uniform';
const MAX_IN = 1024;

let _ready = null, _busy = false;
let _forceWasm = (() => { try { return localStorage.getItem('a4q-ml-wasm') === '1'; } catch (_) { return false; } })();
let _cacheKey = null, _emb = null, _embW = 0, _embH = 0, _scale = 1;

export function selectorBusy() { return _busy; }

function isGpuError(e) { return /webgpu|gpu|ortrun|bind ?group|validation|createbindgroup|shader|device lost/i.test(String((e && e.message) || e)); }
async function withWasmFallback(run, onStatus) {
  try { return await run(); }
  catch (e) {
    if (_forceWasm || !isGpuError(e)) throw e;
    onStatus && onStatus('GPU not supported here — switching to compatibility mode…');
    _forceWasm = true; try { localStorage.setItem('a4q-ml-wasm', '1'); } catch (_) {} await disposeSelector();
    return await run();
  }
}

async function ensure(onStatus) {
  if (_ready) return _ready;
  _ready = (async () => {
    const device = (!_forceWasm && typeof navigator !== 'undefined' && navigator.gpu) ? 'webgpu' : 'wasm';
    onStatus && onStatus('loading magic wand…');
    const T = await import(/* @vite-ignore */ CDN);
    T.env.allowLocalModels = false;
    const dtype = device === 'webgpu' ? 'fp32' : 'q8';   // SlimSAM has no fp16 export -> fp32 on webgpu
    const progress_callback = (p) => {
      if (onStatus && p.status === 'progress' && typeof p.progress === 'number') onStatus(`downloading wand ${Math.round(p.progress)}%`);
    };
    const model = await T.SamModel.from_pretrained(MODEL, { device, dtype, progress_callback });
    const processor = await T.AutoProcessor.from_pretrained(MODEL);
    return { T, model, processor };
  })().catch((e) => { _ready = null; throw e; });
  return _ready;
}

export async function disposeSelector() {
  invalidate();
  if (!_ready) return;
  try { const r = await _ready; await r.model?.dispose?.(); } catch (_) {}
  _ready = null;
}

export function invalidate(key) {
  if (key === undefined || key === _cacheKey) { _cacheKey = null; _emb = null; }
}

function scaledCanvas(src, maxSide) {
  const w = src.width, h = src.height;
  const s = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * s)), ch = Math.max(1, Math.round(h * s));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, cw, ch);
  return { canvas: c, scale: s };
}

// Encode the image once (cached by `key`). De-dupes concurrent calls so a pre-warm and
// the actual snap share ONE encode instead of racing two.
let _primeP = null, _primeKey = null;
export function primeSelector(srcCanvas, key, onStatus) {
  if (_cacheKey === key && _emb) return Promise.resolve();
  if (_primeP && _primeKey === key) return _primeP;
  _primeKey = key;
  _primeP = (async () => {
    const { T, model, processor } = await ensure(onStatus);
    const { canvas, scale } = scaledCanvas(srcCanvas, MAX_IN);
    onStatus && onStatus('reading the picture…');
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const image = await T.RawImage.read(blob);
    const inputs = await processor(image);
    const emb = await model.get_image_embeddings(inputs);
    _cacheKey = key; _emb = { emb, vision: inputs }; _scale = scale; _embW = canvas.width; _embH = canvas.height;
  })().finally(() => { _primeP = null; });
  return _primeP;
}

// Tap at (x,y) in srcCanvas pixels -> best object mask (SAM point prompt).
export async function selectAt(srcCanvas, x, y, key, onStatus) {
  if (_busy) throw new Error('wand is busy');
  _busy = true;
  try { return await withWasmFallback(() => _selectInfer(srcCanvas, x, y, key, onStatus), onStatus); }
  finally { _busy = false; }
}

// Lasso points (srcCanvas px) -> snap to the object the user roughly outlined.
// Prompts SAM at the lasso centroid, then picks the proposal that best OVERLAPS the
// lasso — so a small outline yields a small object, not a big background region.
export async function selectLasso(srcCanvas, pts, key, onStatus) {
  if (_busy) throw new Error('wand is busy');
  _busy = true;
  try { return await withWasmFallback(() => _lassoInfer(srcCanvas, pts, key, onStatus), onStatus); }
  finally { _busy = false; }
}

async function _selectInfer(srcCanvas, x, y, key, onStatus) {
  const { T, model, processor } = await ensure(onStatus);
  await primeSelector(srcCanvas, key, onStatus);
  onStatus && onStatus('selecting…');
  const input_points = new T.Tensor('float32', [x * _scale, y * _scale], [1, 1, 1, 2]);
  const input_labels = new T.Tensor('int64', [1n], [1, 1, 1]);
  const outputs = await model({ ..._emb.emb, input_points, input_labels });
  return _decode(srcCanvas, await processor.post_process_masks(outputs.pred_masks, _emb.vision.original_sizes, _emb.vision.reshaped_input_sizes), outputs.iou_scores.data);
}

async function _lassoInfer(srcCanvas, pts, key, onStatus) {
  const { T, model, processor } = await ensure(onStatus);
  await primeSelector(srcCanvas, key, onStatus);
  onStatus && onStatus('snapping to object…');
  let cx = 0, cy = 0; for (const p of pts) { cx += p.x; cy += p.y; } cx /= pts.length; cy /= pts.length;
  const input_points = new T.Tensor('float32', [cx * _scale, cy * _scale], [1, 1, 1, 2]);
  const input_labels = new T.Tensor('int64', [1n], [1, 1, 1]);
  const outputs = await model({ ..._emb.emb, input_points, input_labels });
  const masks = await processor.post_process_masks(outputs.pred_masks, _emb.vision.original_sizes, _emb.vision.reshaped_input_sizes);
  return _decodeByLasso(srcCanvas, masks[0], pts);
}

// build a srcCanvas-size output mask + bounds from one proposal plane
function _buildMask(srcCanvas, data, off, W, H) {
  const mc = document.createElement('canvas'); mc.width = W; mc.height = H;
  const mctx = mc.getContext('2d'); const id = mctx.createImageData(W, H);
  let minX = W, minY = H, maxX = 0, maxY = 0, any = false;
  for (let i = 0; i < W * H; i++) {
    if (data[off + i]) {
      id.data[i * 4 + 3] = 255; any = true;
      const cx = i % W, cy = (i / W) | 0;
      if (cx < minX) minX = cx; if (cx > maxX) maxX = cx; if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
    }
  }
  mctx.putImageData(id, 0, 0);
  const out = document.createElement('canvas'); out.width = srcCanvas.width; out.height = srcCanvas.height;
  const octx = out.getContext('2d'); octx.imageSmoothingEnabled = false; octx.drawImage(mc, 0, 0, out.width, out.height);
  const sx = out.width / W, sy = out.height / H;
  const bounds = any ? { x: minX * sx, y: minY * sy, w: Math.max(1, (maxX - minX + 1) * sx), h: Math.max(1, (maxY - minY + 1) * sy) } : null;
  return { mask: out, bounds, any };
}
// tap: highest-confidence proposal
function _decode(srcCanvas, masks, scores) {
  const m = masks[0]; const H = m.dims[m.dims.length - 2], W = m.dims[m.dims.length - 1];
  let best = 0; for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
  return _buildMask(srcCanvas, m.data, best * W * H, W, H);
}
// lasso: proposal with the best IoU against the drawn outline (respects the lasso's size)
function _decodeByLasso(srcCanvas, m, pts) {
  const H = m.dims[m.dims.length - 2], W = m.dims[m.dims.length - 1];
  const data = m.data, K = Math.max(1, Math.round(data.length / (W * H)));
  const lc = document.createElement('canvas'); lc.width = W; lc.height = H; const lg = lc.getContext('2d');
  const sxp = W / srcCanvas.width, syp = H / srcCanvas.height;
  lg.fillStyle = '#fff'; lg.beginPath(); lg.moveTo(pts[0].x * sxp, pts[0].y * syp);
  for (let i = 1; i < pts.length; i++) lg.lineTo(pts[i].x * sxp, pts[i].y * syp);
  lg.closePath(); lg.fill();
  const lass = lg.getImageData(0, 0, W, H).data;
  let best = -1, bestIoU = -1;
  for (let k = 0; k < K; k++) {
    const off = k * W * H; let inter = 0, uni = 0;
    for (let i = 0; i < W * H; i++) { const a = data[off + i] ? 1 : 0, b = lass[i * 4 + 3] > 16 ? 1 : 0; if (a && b) inter++; if (a || b) uni++; }
    const iou = uni ? inter / uni : 0;
    if (iou > bestIoU) { bestIoU = iou; best = k; }
  }
  if (best < 0 || bestIoU < 0.04) return { mask: null, bounds: null, any: false };   // nothing fits -> caller keeps the raw outline
  return _buildMask(srcCanvas, data, best * W * H, W, H);
}
