// assets/ml/segment.js
// ---------------------------------------------------------------------------
// Shared, on-device ML harness for art4quinn — "background erase" / cut-out.
//
// One module, used by all three apps (paint / three / gallery). It lazy-loads
// Transformers.js from the CDN on first use, runs the RMBG-1.4 matting model,
// and returns either the foreground alpha mask or a ready-made transparent
// cut-out canvas. Nothing is downloaded until a feature actually asks for it,
// and the model weights are cached by the browser (Cache Storage) so a phone
// only fetches them once.
//
// Runtime policy (June 2026 best practice):
//   * WebGPU first  — default on Chrome 121+ (incl. Android / Pixel), 3–10x WASM.
//   * WASM fallback — automatic when navigator.gpu is missing.
//   * Quantized (q8) weights on the WASM path to stay light on mobile data/RAM.
//
// To bump the library, change CDN below. The RMBG / RawImage / AutoModel API
// used here is stable across Transformers.js v3 and v4.
// ---------------------------------------------------------------------------

const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4';
const MODEL = 'briaai/RMBG-1.4';

let _ready = null;   // memoised { T, model, processor, device }

export function mlDevice() { return (typeof navigator !== 'undefined' && navigator.gpu) ? 'webgpu' : 'wasm'; }

// Load (once) the library + model. onStatus(text) is called with progress lines.
async function ensureModel(onStatus) {
  if (_ready) return _ready;
  _ready = (async () => {
    const device = mlDevice();
    onStatus && onStatus('loading AI…');
    const T = await import(/* @vite-ignore */ CDN);
    T.env.allowLocalModels = false;             // always pull from the Hub/CDN
    const dtype = device === 'webgpu' ? 'fp32' : 'q8';   // light weights on mobile WASM
    let lastPct = -1;
    const progress_callback = (p) => {
      if (!onStatus) return;
      if (p.status === 'progress' && typeof p.progress === 'number') {
        const pct = Math.round(p.progress);
        if (pct !== lastPct) { lastPct = pct; onStatus(`downloading AI model ${pct}%`); }
      } else if (p.status === 'ready' || p.status === 'done') {
        onStatus('AI ready');
      }
    };
    const model = await T.AutoModel.from_pretrained(MODEL, { device, dtype, progress_callback });
    const processor = await T.AutoProcessor.from_pretrained(MODEL);
    return { T, model, processor, device };
  })().catch((e) => { _ready = null; throw e; });   // allow retry after a failure
  return _ready;
}

// Accept a URL string, <img>, <canvas> (or anything drawable) -> RawImage.
async function toRawImage(T, src) {
  if (typeof src === 'string') return await T.RawImage.read(src);
  let canvas = src;
  if (!(src instanceof HTMLCanvasElement)) {
    canvas = document.createElement('canvas');
    canvas.width = src.naturalWidth || src.width;
    canvas.height = src.naturalHeight || src.height;
    canvas.getContext('2d').drawImage(src, 0, 0);
  }
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  return await T.RawImage.read(blob);
}

// Foreground matte. Returns { width, height, data:Uint8Array(w*h) } where
// data[i] is the subject alpha (0 = background, 255 = subject), plus the
// source RawImage so callers can re-composite without reloading.
export async function foregroundMask(src, onStatus) {
  const { T, model, processor } = await ensureModel(onStatus);
  onStatus && onStatus('finding the subject…');
  const image = await toRawImage(T, src);
  const { pixel_values } = await processor(image);
  const { output } = await model({ input: pixel_values });
  const mask = await T.RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height);
  return { width: image.width, height: image.height, data: mask.data, source: image };
}

// Background erase: returns a NEW canvas (subject kept, background transparent).
export async function removeBackground(src, onStatus) {
  const m = await foregroundMask(src, onStatus);
  const canvas = document.createElement('canvas');
  canvas.width = m.width; canvas.height = m.height;
  const g = canvas.getContext('2d');
  g.drawImage(m.source.toCanvas(), 0, 0, m.width, m.height);
  const id = g.getImageData(0, 0, m.width, m.height);
  const d = id.data, mask = m.data;
  for (let i = 0; i < mask.length; i++) d[i * 4 + 3] = mask[i];
  g.putImageData(id, 0, 0);
  onStatus && onStatus('background erased');
  return canvas;
}
