import { ToolDef, Point, ToolContext } from '../ToolRegistry';

let isDrawing = false;
let lastPoint: Point | null = null;

function applySharpen(pt: Point, context: ToolContext) {
  const size = context.size;
  const radius = Math.floor(size / 2);
  const startX = Math.floor(pt.x) - radius;
  const startY = Math.floor(pt.y) - radius;
  
  if (startX >= context.canvas.width || startY >= context.canvas.height || startX + size <= 0 || startY + size <= 0) return;

  const imageData = context.ctx.getImageData(startX, startY, size, size);
  const srcData = new Uint8ClampedArray(imageData.data);
  const drawW = imageData.width;
  const drawH = imageData.height;
  const strength = context.opacity;

  for (let py = 0; py < drawH; py++) {
    for (let px = 0; px < drawW; px++) {
      const dx = px - radius;
      const dy = py - radius;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radius * radius) {
        const factor = (1 - Math.sqrt(distSq) / radius) * strength * 0.5;
        if (factor > 0) {
          let r = 0, g = 0, b = 0;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const nx = px + ox;
              const ny = py + oy;
              let weight = 0;
              if (ox === 0 && oy === 0) weight = 5;
              else if (Math.abs(ox) !== Math.abs(oy)) weight = -1;
              
              if (weight !== 0) {
                const sx = Math.max(0, Math.min(drawW - 1, nx));
                const sy = Math.max(0, Math.min(drawH - 1, ny));
                const idx = (sy * drawW + sx) * 4;
                r += srcData[idx] * weight;
                g += srcData[idx + 1] * weight;
                b += srcData[idx + 2] * weight;
              }
            }
          }
          const destIdx = (py * drawW + px) * 4;
          imageData.data[destIdx] = Math.max(0, Math.min(255, srcData[destIdx] * (1 - factor) + r * factor));
          imageData.data[destIdx + 1] = Math.max(0, Math.min(255, srcData[destIdx + 1] * (1 - factor) + g * factor));
          imageData.data[destIdx + 2] = Math.max(0, Math.min(255, srcData[destIdx + 2] * (1 - factor) + b * factor));
        }
      }
    }
  }
  context.ctx.putImageData(imageData, startX, startY);
}

function stampAlongPath(start: Point, end: Point, context: ToolContext, applyFn: (pt: Point, ctx: ToolContext) => void) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = Math.max(1, context.size / 4);

  if (dist >= step) {
    const steps = Math.floor(dist / step);
    for (let i = 1; i <= steps; i++) {
      const x = start.x + (dx * i) / steps;
      const y = start.y + (dy * i) / steps;
      applyFn({ x, y }, context);
    }
    return end;
  }
  return start;
}

export const SharpenTool: ToolDef = {
  id: 'sharpen',
  name: 'Sharpen',
  type: 'retouch',
  cursor: 'crosshair',
  onPointerDown: (pt, ctx) => {
    isDrawing = true;
    lastPoint = pt;
    ctx.pushUndoState();
    applySharpen(pt, ctx);
  },
  onPointerMove: (pt, ctx) => {
    if (!isDrawing || !lastPoint) return;
    lastPoint = stampAlongPath(lastPoint, pt, ctx, applySharpen);
  },
  onPointerUp: (pt, ctx) => {
    if (!isDrawing) return;
    isDrawing = false;
    lastPoint = null;
    ctx.commit();
  }
};
