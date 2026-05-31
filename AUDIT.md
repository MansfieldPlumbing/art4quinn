# Project Audit Document

## 1. Single-File Minification Readiness
The application uses standard Vite + React setup with modularized components. For a single-file minification or a 1-folder deployment (like a static export):
- **Readiness:** Excellent. Vite automatically bundles all assets into a single static `dist` folder. All dependencies (like `flexlayout-react`, `lucide-react`, `zustand`, `motion`) can be compiled cleanly into static JS and CSS chunks. 
- **Recommendation:** No major restructuring to single-file is needed, as standard build tools (Vite) successfully minify and package everything for static generic deployment. The UI runs entirely client-side without a backend, making it inherently ready for a CDN or simple static hosting environment.

## 2. Tools Audit (from `LeftTools.tsx`)
The UI presents a large suite of tools, but only a subset are fully backed by canvas engine logic in the `ToolRegistry` (`src/registry/basicTools.ts`).

### Fully Functional Tools:
* **Brush (`brush`)** - Default smooth brush.
* **Eraser (`eraser`)** - Eraser functionality using `destination-out`.
* **Pencil (`pencil`)** - Sharp, thin lines.
* **Soft Edge Brush (`soft`)** - Diffused stroke using shadow casting.
* **Marker (`marker`)** - Thick, translucent, semi-multiplied strokes.
* **Pen (`pen`)** - Highly pressure-sensitive tapering lines.
* **Airbrush (`air`)** - Very soft, high-spread particulate approximation.
* **Target Details (`detail`)** - Fine, static-scale detailing brush.
* **Ink Pen (`ink`)** - Dynamic, distinct solid pressure flow.
* **Color Picker (`picker`)** - Inspects canvas context pixels and sets active global color.
* **Fill Layer (`fill`)** - Pours a solid global block of color across the active layer.

### Stub Tools (UI Present, Logic Missing):
* **Select Category:** Move, Select, Lasso, Magic Wand, Crop
* **Paint Category:** Gradient
* **Retouch Category:** Blur, Smudge, Sharpen, Dodge, Burn, Contrast
* **Vector Category:** Text, Rectangle, Ellipse, Polygon

## 3. Filters / Adjustments Audit (from `BottomAdjustments.tsx`)
The application features a non-destructive CSS-based filter preview that bakes into the canvas pixel data upon clicking "Apply".

### Fully Functional Adjustments/Filters:
* **Brightness / Contrast** - Real-time preview and canvas bake using CSS brightness and contrast.
* **Hue / Saturation** - Real-time preview and canvas bake using CSS hue-rotate and saturate.
* **Gaussian Blur** - Real-time preview and canvas bake using CSS blur.

### Stub Adjustments/Filters (UI Present, Mock/Stub State):
* **Color Balance**
* **Levels**
* **Motion Blur**
* **Liquify**
* **Noise**

*Note: For the stub filters, the UI displays a message: "This filter is mock-only in this demo."*
