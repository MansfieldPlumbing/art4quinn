import { ToolDef, Point, ToolContext } from '../ToolRegistry';

let isDrawing = false;
let lastPoint: Point | null = null;

function applyBurn(pt: Point, context: ToolContext) {
  const size = context.size;
  const radius = Math.floor(size / 2);
  const startX = Math.floor(pt.x) - radius;
  const startY = Math.floor(pt.y) - radius;
  
  if (startX >= context.canvas.width || startY >= context.canvas.height || startX + size <= 0 || startY + size <= 0) return;

  const imageData = context.ctx.getImageData(startX, startY, size, size);
  const drawW = imageData.width;
  const drawH = imageData.height;
  const strength = context.opacity;

  for (let py = 0; py < drawH; py++) {
    for (let px = 0; px < drawW; px++) {
      const dx = px - radius;
      const dy = py - radius;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radius * radius) {
        const factor = (1 - Math.sqrt(distSq) / radius) * strength * 0.1;
        if (factor > 0) {
          const destIdx = (py * drawW + px) * 4;
          imageData.data[destIdx] = Math.max(0, imageData.data[destIdx] * (1 - factor));
          imageData.data[destIdx + 1] = Math.max(0, imageData.data[destIdx + 1] * (1 - factor));
          imageData.data[destIdx + 2] = Math.max(0, imageData.data[destIdx + 2] * (1 - factor));
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

export const BurnTool: ToolDef = {
  id: 'burn',
  name: 'Burn',
  type: 'retouch',
  cursor: 'crosshair',
  onPointerDown: (pt, ctx) => {
    isDrawing = true;
    lastPoint = pt;
    ctx.pushUndoState();
    applyBurn(pt, ctx);
  },
  onPointerMove: (pt, ctx) => {
    if (!isDrawing || !lastPoint) return;
    lastPoint = stampAlongPath(lastPoint, pt, ctx, applyBurn);
  },
  onPointerUp: (pt, ctx) => {
    if (!isDrawing) return;
    isDrawing = false;
    lastPoint = null;
    ctx.commit();
  }
};
