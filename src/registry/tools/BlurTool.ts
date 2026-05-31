import { ToolDef, Point, ToolContext } from '../ToolRegistry';

let isDrawing = false;
let lastPoint: Point | null = null;

function applyBlur(pt: Point, context: ToolContext) {
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
        const factor = (1 - Math.sqrt(distSq) / radius) * strength;
        if (factor > 0) {
          let r = 0, g = 0, b = 0, a = 0, count = 0;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const nx = px + ox;
              const ny = py + oy;
              if (nx >= 0 && nx < drawW && ny >= 0 && ny < drawH) {
                const idx = (ny * drawW + nx) * 4;
                r += srcData[idx];
                g += srcData[idx + 1];
                b += srcData[idx + 2];
                a += srcData[idx + 3];
                count++;
              }
            }
          }
          const destIdx = (py * drawW + px) * 4;
          imageData.data[destIdx] = srcData[destIdx] * (1 - factor) + (r / count) * factor;
          imageData.data[destIdx + 1] = srcData[destIdx + 1] * (1 - factor) + (g / count) * factor;
          imageData.data[destIdx + 2] = srcData[destIdx + 2] * (1 - factor) + (b / count) * factor;
          imageData.data[destIdx + 3] = srcData[destIdx + 3] * (1 - factor) + (a / count) * factor;
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

export const BlurTool: ToolDef = {
  id: 'blur',
  name: 'Blur',
  type: 'retouch',
  cursor: 'crosshair',
  onPointerDown: (pt, ctx) => {
    isDrawing = true;
    lastPoint = pt;
    ctx.pushUndoState();
    applyBlur(pt, ctx);
  },
  onPointerMove: (pt, ctx) => {
    if (!isDrawing || !lastPoint) return;
    lastPoint = stampAlongPath(lastPoint, pt, ctx, applyBlur);
  },
  onPointerUp: (pt, ctx) => {
    if (!isDrawing) return;
    isDrawing = false;
    lastPoint = null;
    ctx.commit();
  }
};
