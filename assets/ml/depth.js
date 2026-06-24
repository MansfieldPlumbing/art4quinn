// assets/ml/depth.js
// ---------------------------------------------------------------------------
// On-device monocular depth for art4quinn — "real relief" for the 3D studio.
//
// Mirrors segment.js: lazy-loads Transformers.js from the CDN on first use,
// runs Depth Anything V2 (small) and returns a normalised depth map. The 3D
// studio feeds that map into the extruder as a per-pixel height field, so a
// character bulges with its actual shape (nose/arms forward) instead of a
// uniform balloon. Nothing downloads until the feature is switched on; weights
// are cached by the browser (Cache Storage) so a phone fetches them once.
//
// Memory safety (same rules as segment.js):
//   * Input is downscaled to MAX_IN before inference — never hold a full-res buffer.
//   * Single-job lock so two inferences can't double peak memory.
//
// Runtime policy:
//   * WebGPU first (Chrome 121+, incl. Android), WASM fallback when navigator.gpu
//     is missing or a mobile GPU op fails at run time. Quantised (q8) on WASM.
//
// To swap the model, change MODEL (…-v2-base / -large are heavier but sharper).
// ---------------------------------------------------------------------------

const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4';
const MODEL = 'onnx-community/depth-anything-v2-small';   // 24.8M params, q8 ~25MB
const MAX_IN = 720;   // working resolution for inference (Depth Anything runs ~518 internally)

let _ready = null;      // memoised { T, pipe, device }
let _busy = false;      // single-job lock
let _forceWasm = false; // set true after a WebGPU run failure

export function depthDevice() { return (!_forceWasm && typeof navigator !== 'undefined' && navigator.gpu) ? 'webgpu' : 'wasm'; }
export function depthBusy() { return _busy; }

function isGpuError(e) { return /webgpu|gpu|ortrun|bind ?group|validation|createbindgroup|shader|device lost/i.test(String((e && e.message) || e)); }
async function withWasmFallback(run, onStatus) {
  try { return await run(); }
  catch (e) {
    if (_forceWasm || !isGpuError(e)) throw e;
    onStatus && onStatus('GPU not supported here — switching to compatibility mode…');
    _forceWasm = true; try { localStorage.setItem('a4q-ml-wasm', '1'); } catch (_) {} await disposeDepth();
    return await run();
  }
}

async function ensureModel(onStatus) {
  if (_ready) return _ready;
  _ready = (async () => {
    const device = depthDevice();
    onStatus && onStatus('loading AI…');
    const T = await import(/* @vite-ignore */ CDN);
    T.env.allowLocalModels = false;
    const dtype = device === 'webgpu' ? 'fp32' : 'q8';
    // Funnel the per-file download reports into one aggregated progress bar.
    const _dl = new Map(); let lastPct = -1;
    const progress_callback = (p) => {
      if (!onStatus || !p || !p.file) return;
      if (p.status === 'progress' && typeof p.loaded === 'number' && typeof p.total === 'number' && p.total > 0) _dl.set(p.file, { loaded: p.loaded, total: p.total });
      else if (p.status === 'done' && _dl.has(p.file)) { const e = _dl.get(p.file); _dl.set(p.file, { loaded: e.total, total: e.total }); }
      else if (p.status === 'ready') { onStatus('AI ready'); return; }
      else return;
      let l = 0, t = 0; for (const v of _dl.values()) { l += v.loaded; t += v.total; }
      if (t <= 0) return;
      const pct = Math.min(100, Math.round(l / t * 100));
      if (pct !== lastPct) { lastPct = pct; onStatus(`downloading depth model ${pct}%`); }
    };
    const pipe = await T.pipeline('depth-estimation', MODEL, { device, dtype, progress_callback });
    return { T, pipe, device };
  })().catch((e) => { _ready = null; throw e; });
  return _ready;
}

export async function disposeDepth() {
  if (!_ready) return;
  try { const r = await _ready; await r.pipe?.dispose?.(); } catch (_) {}
  _ready = null;
}

async function loadDrawable(src) {
  if (typeof src === 'string') {
    const img = await new Promise((res, rej) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => res(im); im.onerror = () => rej(new Error('load ' + src)); im.src = src;
    });
    return { img, w: img.naturalWidth, h: img.naturalHeight };
  }
  return { img: src, w: src.naturalWidth || src.width, h: src.naturalHeight || src.height };
}

function scaledCanvas(img, w, h, maxSide) {
  const s = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * s)), ch = Math.max(1, Math.round(h * s));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, cw, ch);
  return c;
}

async function _depthInfer(src, onStatus) {
  const { T, pipe } = await ensureModel(onStatus);
  const { img, w, h } = await loadDrawable(src);
  const inCanvas = scaledCanvas(img, w, h, MAX_IN);
  onStatus && onStatus('reading depth…');
  const blob = await new Promise((r) => inCanvas.toBlob(r, 'image/png'));
  const image = await T.RawImage.read(blob);
  const { depth } = await pipe(image);                 // depth: RawImage, normalised 0..255 (brighter = closer)
  const d = depth.data, len = depth.width * depth.height;
  // Some builds return a single-channel buffer, others RGBA — read the first channel.
  const ch = d.length >= len * 4 ? 4 : (d.length >= len * 3 ? 3 : 1);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = d[i * ch];
  return { width: depth.width, height: depth.height, data: out };
}

// Normalised depth map at the (downscaled) working resolution.
// Returns { width, height, data:Uint8Array(w*h) } where higher = closer to camera.
export async function depthMap(src, onStatus) {
  if (_busy) throw new Error('AI is busy — let the current job finish');
  _busy = true;
  try { return await withWasmFallback(() => _depthInfer(src, onStatus), onStatus); }
  finally { _busy = false; }
}
