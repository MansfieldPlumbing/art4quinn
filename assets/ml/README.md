# assets/ml — on-device ML harness

Shared, build-free ML for art4quinn. One module (`segment.js`) powers the
**background-erase / cut-out** across all three apps (paint, three, gallery).

## How it works
- Lazy-loads [Transformers.js](https://huggingface.co/docs/transformers.js) from the
  jsDelivr CDN **on first use** (nothing ships in the page payload).
- Runs **RMBG-1.4** (`briaai/RMBG-1.4`) for foreground matting.
- **WebGPU first** (Chrome 121+, incl. Android/Pixel), automatic **WASM fallback**;
  quantized (`q8`) weights on the WASM path to stay light on phones.
- Model weights are cached by the browser (Cache Storage) → downloaded once per device.

## API
```js
import { removeBackground, foregroundMask, mlDevice } from '../assets/ml/segment.js';

// src = URL string | <img> | <canvas>.  onStatus(text) is optional (for a HUD).
const cutout = await removeBackground(src, msg => console.log(msg)); // -> <canvas>, transparent bg
const { width, height, data } = await foregroundMask(src);          // data[i] = subject alpha 0..255
```

## Where it's wired
- **paint/** — "Erase Background" (top blind) mattes the active layer in place (undoable).
- **three/** — "AI cut-out" toggle (Scene panel) uses the matte for a clean silhouette/extrude
  from any background (replaces the corner flood-fill key).
- **gallery.html** — per-image ✂︎ button downloads a transparent PNG.

## Notes
- To bump the library, edit `CDN` in `segment.js` (the RMBG/RawImage/AutoModel API is
  stable across v3/v4).
- RMBG-1.4 is a BRIA model under a research/non-commercial license — fine for Quinn's
  personal studio; swap the `MODEL` constant if a different license is needed.
- First run downloads the model (~tens of MB); subsequent runs are instant from cache.
