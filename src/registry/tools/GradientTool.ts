import { ToolDef } from '../ToolRegistry';

let startPt = { x: 0, y: 0 };
let savedImageData: ImageData | null = null;

export const GradientTool: ToolDef = {
  id: 'gradient',
  name: 'Gradient',
  type: 'paint',
  cursor: 'crosshair',
  onPointerDown: (pt, ctx) => {
    ctx.pushUndoState();
    startPt = { x: pt.x, y: pt.y };
    savedImageData = ctx.ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  },
  onPointerMove: (pt, ctx) => {
    if (!savedImageData) return;
    ctx.ctx.putImageData(savedImageData, 0, 0);
    
    const grad = ctx.ctx.createLinearGradient(startPt.x, startPt.y, pt.x, pt.y);
    grad.addColorStop(0, ctx.color);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.ctx.fillStyle = grad;
    ctx.ctx.globalAlpha = ctx.opacity / 100;
    ctx.ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  },
  onPointerUp: (pt, ctx) => {
    savedImageData = null;
  }
};
