import { ToolDef, Point, ToolContext } from '../ToolRegistry';

let isDrawing = false;
let lastPoint: Point | null = null;
let smudgeBuffer: Uint8ClampedArray | null = null;

function getSmudgeBuffer(pt: Point, context: ToolContext) {
  const size = context.size;
  const radius = Math.floor(size / 2);
  const startX = Math.floor(pt.x) - radius;
  const startY = Math.floor(pt.y) - radius;
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = size;
  tempCanvas.height = size;
  const tCtx = tempCanvas.getContext('2d')!;
  tCtx.drawImage(context.canvas, startX, startY, size, size, 0, 0, size, size);
  return tCtx.getImageData(0, 0, size, size).data;
}

function applySmudge(pt: Point, context: ToolContext) {
  if (!smudgeBuffer) return;
  const size = context.size;
  const radius = Math.floor(size / 2);
  const startX = Math.floor(pt.x) - radius;
  const startY = Math.floor(pt.y) - radius;
  
  const imageData = context.ctx.getImageData(startX, startY, size, size);
  const drawW = imageData.width;
  const drawH = imageData.height;
  const currentData = imageData.data;
  const strength = context.opacity;

  for (let py = 0; py < drawH; py++) {
    for (let px = 0; px < drawW; px++) {
      const dx = px - radius;
      const dy = py - radius;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radius * radius) {
        const factor = (1 - Math.sqrt(distSq) / radius) * strength * 0.5;
        if (factor > 0) {
          const idx = (py * drawW + px) * 4;
          
          currentData[idx] = currentData[idx] * (1 - factor) + smudgeBuffer[idx] * factor;
          currentData[idx + 1] = currentData[idx + 1] * (1 - factor) + smudgeBuffer[idx + 1] * factor;
          currentData[idx + 2] = currentData[idx + 2] * (1 - factor) + smudgeBuffer[idx + 2] * factor;
          currentData[idx + 3] = currentData[idx + 3] * (1 - factor) + smudgeBuffer[idx + 3] * factor;
          
          smudgeBuffer[idx] = smudgeBuffer[idx] * 0.9 + currentData[idx] * 0.1;
          smudgeBuffer[idx + 1] = smudgeBuffer[idx + 1] * 0.9 + currentData[idx + 1] * 0.1;
          smudgeBuffer[idx + 2] = smudgeBuffer[idx + 2] * 0.9 + currentData[idx + 2] * 0.1;
          smudgeBuffer[idx + 3] = smudgeBuffer[idx + 3] * 0.9 + currentData[idx + 3] * 0.1;
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

export const SmudgeTool: ToolDef = {
  id: 'smudge',
  name: 'Smudge Blender',
  type: 'retouch',
  cursor: 'crosshair',
  onPointerDown: (pt, ctx) => {
    isDrawing = true;
    lastPoint = pt;
    ctx.pushUndoState();
    smudgeBuffer = getSmudgeBuffer(pt, ctx);
  },
  onPointerMove: (pt, ctx) => {
    if (!isDrawing || !lastPoint) return;
    lastPoint = stampAlongPath(lastPoint, pt, ctx, applySmudge);
  },
  onPointerUp: (pt, ctx) => {
    if (!isDrawing) return;
    isDrawing = false;
    lastPoint = null;
    smudgeBuffer = null;
    ctx.commit();
  }
};
