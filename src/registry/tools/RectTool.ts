import { ToolDef } from '../ToolRegistry';

let startPt = { x: 0, y: 0 };
let savedImageData: ImageData | null = null;

export const RectTool: ToolDef = {
  id: 'rect',
  name: 'Rectangle',
  type: 'vector',
  cursor: 'crosshair',
  onPointerDown: (pt, ctx) => {
    ctx.pushUndoState();
    startPt = { x: pt.x, y: pt.y };
    savedImageData = ctx.ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  },
  onPointerMove: (pt, ctx) => {
    if (!savedImageData) return;
    
    // Restore previous state
    ctx.ctx.putImageData(savedImageData, 0, 0);
    
    // Draw new rectangle
    ctx.ctx.beginPath();
    ctx.ctx.rect(startPt.x, startPt.y, pt.x - startPt.x, pt.y - startPt.y);
    
    ctx.ctx.strokeStyle = ctx.color;
    ctx.ctx.lineWidth = ctx.size;
    ctx.ctx.globalAlpha = ctx.opacity / 100;
    ctx.ctx.stroke();
  },
  onPointerUp: (pt, ctx) => {
    savedImageData = null;
  }
};
