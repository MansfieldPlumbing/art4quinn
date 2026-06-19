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
    const dtype = device === 'webgpu' ? 'fp16' : 'q8';
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

// Encode the image once (cached by `key`).
export async function primeSelector(srcCanvas, key, onStatus) {
  if (_cacheKey === key && _emb) return;
  const { T, model, processor } = await ensure(onStatus);
  const { canvas, scale } = scaledCanvas(srcCanvas, MAX_IN);
  onStatus && onStatus('reading the picture…');
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const image = await T.RawImage.read(blob);
  const inputs = await processor(image);
  const emb = await model.get_image_embeddings(inputs);
  _cacheKey = key; _emb = { emb, vision: inputs }; _scale = scale; _embW = canvas.width; _embH = canvas.height;
}

// Tap at (x,y) in srcCanvas pixels -> best object mask (SAM point prompt).
export async function selectAt(srcCanvas, x, y, key, onStatus) {
  if (_busy) throw new Error('wand is busy');
  _busy = true;
  try { return await withWasmFallback(() => _selectInfer(srcCanvas, x, y, key, onStatus), onStatus); }
  finally { _busy = false; }
}

// Rough box {x0,y0,x1,y1} in srcCanvas pixels -> best object mask (SAM box prompt).
// This is the Samsung-style "lasso roughly, snap to the object" path.
export async function selectBox(srcCanvas, box, key, onStatus) {
  if (_busy) throw new Error('wand is busy');
  _busy = true;
  try { return await withWasmFallback(() => _boxInfer(srcCanvas, box, key, onStatus), onStatus); }
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

async function _boxInfer(srcCanvas, box, key, onStatus) {
  const { T, model, processor } = await ensure(onStatus);
  await primeSelector(srcCanvas, key, onStatus);
  onStatus && onStatus('snapping to object…');
  // SAM encodes a box as two points with labels 2 (top-left) and 3 (bottom-right).
  // This reuses the same input_points path the tap prompt uses (more portable than input_boxes).
  const input_points = new T.Tensor('float32', [box.x0 * _scale, box.y0 * _scale, box.x1 * _scale, box.y1 * _scale], [1, 1, 2, 2]);
  const input_labels = new T.Tensor('int64', [2n, 3n], [1, 1, 2]);
  const outputs = await model({ ..._emb.emb, input_points, input_labels });
  return _decode(srcCanvas, await processor.post_process_masks(outputs.pred_masks, _emb.vision.original_sizes, _emb.vision.reshaped_input_sizes), outputs.iou_scores.data);
}

// pick the highest-IoU proposal -> a mask canvas the size of srcCanvas + bounds
function _decode(srcCanvas, masks, scores) {
  let best = 0; for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
  const m = masks[0];                                // Tensor [nMasks, H, W] (bool)
  const H = m.dims[m.dims.length - 2], W = m.dims[m.dims.length - 1];
  const data = m.data, off = best * H * W;
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
