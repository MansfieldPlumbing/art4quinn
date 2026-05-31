import { ToolDef } from '../ToolRegistry';
import * as ort from 'onnxruntime-web';
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.25.1/dist/';

let pathPts: { x: number, y: number }[] = [];
let drawing = false;
let savedImageData: ImageData | null = null;

const sparklesSvg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6a4bff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`);
const magicCursor = `url("data:image/svg+xml,${sparklesSvg}") 12 12, crosshair`;

export const MagicEraserTool: ToolDef = {
  id: 'magic_eraser',
  name: 'Magic Eraser (TFLite)',
  type: 'retouch',
  cursor: magicCursor,
  onPointerDown: (pt, ctx) => {
    ctx.pushUndoState();
    drawing = true;
    pathPts = [{ x: pt.x, y: pt.y }];
    
    // Save state to easily wipe out the preview stroke later
    savedImageData = ctx.ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Draw glowing preview line
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pt.x, pt.y);
    ctx.ctx.lineTo(pt.x, pt.y);
    ctx.ctx.strokeStyle = '#6a4bff';
    ctx.ctx.lineCap = 'round';
    ctx.ctx.lineJoin = 'round';
    ctx.ctx.lineWidth = ctx.size;
    ctx.ctx.shadowColor = '#39ff14';
    ctx.ctx.shadowBlur = 10;
    ctx.ctx.stroke();
  },
  onPointerMove: (pt, ctx) => {
    if (!drawing) return;
    const lastPoint = pathPts[pathPts.length - 1];
    pathPts.push({ x: pt.x, y: pt.y });
    
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.ctx.lineTo(pt.x, pt.y);
    ctx.ctx.stroke();
  },
  onPointerUp: async (pt, ctx) => {
    if (!drawing) return;
    drawing = false;
    ctx.ctx.shadowBlur = 0; // Reset
    
    // Completely clear the glowing purple preview stroke by restoring canvas state
    if (savedImageData) {
      ctx.ctx.putImageData(savedImageData, 0, 0);
      savedImageData = null;
    }
    
    // Calculate bounding box of erased path
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pathPts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pad = ctx.size;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(ctx.canvas.width, maxX + pad);
    maxY = Math.min(ctx.canvas.height, maxY + pad);
    
    const w = maxX - minX;
    const h = maxY - minY;
    
    if (w <= 0 || h <= 0) return;

    let useFallback = false;

    try {
      // 1. Initialize ONNX Session for LaMA
      // Automatically download from HuggingFace and cache to device
      let modelData: ArrayBuffer | string = '/models/lama.onnx';
      try {
        const MODEL_URL = 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama.onnx';
        const cache = await caches.open('flickpaint-models');
        let res = await cache.match(MODEL_URL);
        if (!res) {
           console.log("Downloading LaMA ONNX model from HuggingFace to local cache...");
           res = await fetch(MODEL_URL);
           if (res.ok) {
             await cache.put(MODEL_URL, res.clone());
           }
        }
        if (res && res.ok) {
           modelData = await res.arrayBuffer();
        }
      } catch (cacheErr) {
        console.warn("Cache/Download failed, falling back to local path.", cacheErr);
      }

      const session = typeof modelData === 'string'
        ? await ort.InferenceSession.create(modelData, { executionProviders: ['webgl', 'wasm'] })
        : await ort.InferenceSession.create(new Uint8Array(modelData), { executionProviders: ['webgl', 'wasm'] });
      
      // 2. Preprocess: Get Image and Mask as Float32 Tensors (512x512)
      const bgCanvas = document.getElementById('layer-2') as HTMLCanvasElement;
      const sourceCanvas = bgCanvas || ctx.canvas;
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 512; tempCanvas.height = 512;
      const tCtx = tempCanvas.getContext('2d')!;
      tCtx.drawImage(sourceCanvas, minX, minY, w, h, 0, 0, 512, 512);
      const imgData = tCtx.getImageData(0, 0, 512, 512).data;
      
      const imageFloat32 = new Float32Array(3 * 512 * 512);
      for (let i = 0; i < 512 * 512; i++) {
         imageFloat32[i] = (imgData[i * 4] / 255.0); // R
         imageFloat32[512 * 512 + i] = (imgData[i * 4 + 1] / 255.0); // G
         imageFloat32[2 * 512 * 512 + i] = (imgData[i * 4 + 2] / 255.0); // B
      }
      const imageTensor = new ort.Tensor('float32', imageFloat32, [1, 3, 512, 512]);

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = 512; maskCanvas.height = 512;
      const mCtx = maskCanvas.getContext('2d')!;
      mCtx.fillStyle = 'black';
      mCtx.fillRect(0, 0, 512, 512);
      mCtx.strokeStyle = 'white';
      mCtx.lineWidth = (ctx.size / w) * 512;
      mCtx.lineCap = 'round';
      mCtx.lineJoin = 'round';
      mCtx.beginPath();
      mCtx.moveTo((pathPts[0].x - minX)/w*512, (pathPts[0].y - minY)/h*512);
      for(let i=1; i<pathPts.length; i++) mCtx.lineTo((pathPts[i].x - minX)/w*512, (pathPts[i].y - minY)/h*512);
      mCtx.stroke();
      
      const maskData = mCtx.getImageData(0, 0, 512, 512).data;
      const maskFloat32 = new Float32Array(1 * 512 * 512);
      for (let i = 0; i < 512 * 512; i++) {
         maskFloat32[i] = maskData[i * 4] > 128 ? 1.0 : 0.0;
      }
      const maskTensor = new ort.Tensor('float32', maskFloat32, [1, 1, 512, 512]);
      
      // 3. Run Inference
      console.log("Running LaMA ONNX inference...");
      const feeds: Record<string, ort.Tensor> = { 'image': imageTensor, 'mask': maskTensor };
      const results = await session.run(feeds);
      const outputTensor = results[session.outputNames[0]];
      
      // 4. Post-process: De-normalize and putImageData back
      console.log("LaMA inference complete");
      const outData = outputTensor.data as Float32Array;
      const outImgData = new ImageData(512, 512);
      for (let i = 0; i < 512 * 512; i++) {
         outImgData.data[i * 4] = Math.max(0, Math.min(255, Math.round(outData[i] * 255)));
         outImgData.data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(outData[512*512 + i] * 255)));
         outImgData.data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(outData[2*512*512 + i] * 255)));
         outImgData.data[i * 4 + 3] = 255;
      }
      tCtx.putImageData(outImgData, 0, 0);
      
      ctx.ctx.save();
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(pathPts[0].x, pathPts[0].y);
      for(let i=1; i<pathPts.length; i++) ctx.ctx.lineTo(pathPts[i].x, pathPts[i].y);
      ctx.ctx.lineWidth = ctx.size + 4; // slight pad
      ctx.ctx.lineCap = 'round';
      ctx.ctx.lineJoin = 'round';
      ctx.ctx.clip();
      ctx.ctx.drawImage(tempCanvas, 0, 0, 512, 512, minX, minY, w, h);
      ctx.ctx.restore();
      
    } catch(e) {
      console.warn("ONNX LaMA model not found or failed. Ensure /models/lama.onnx exists. Using fallback content-aware blur.", e);
      useFallback = true;
    }

    // Fallback: simple heavy blur over the masked area to mock content-aware fill
    if (useFallback) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w; tempCanvas.height = h;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
         // Grab pixels from the background layer (id: 2) or active canvas
         const bgCanvas = document.getElementById('layer-2') as HTMLCanvasElement;
         const sourceCanvas = bgCanvas || ctx.canvas;
         
         tCtx.filter = 'blur(15px)';
         tCtx.drawImage(sourceCanvas, minX, minY, w, h, 0, 0, w, h);
         
         // Create clipping mask to only apply blur to drawn path on the active layer
         ctx.ctx.save();
         ctx.ctx.beginPath();
         ctx.ctx.moveTo(pathPts[0].x, pathPts[0].y);
         for(let i=1; i<pathPts.length; i++) ctx.ctx.lineTo(pathPts[i].x, pathPts[i].y);
         ctx.ctx.lineWidth = ctx.size;
         ctx.ctx.lineCap = 'round';
         ctx.ctx.lineJoin = 'round';
         ctx.ctx.clip();
         
         // Draw blurred "inpainted" pixels to cover the background
         ctx.ctx.drawImage(tempCanvas, minX, minY);
         ctx.ctx.restore();
      }
    }
  }
};
