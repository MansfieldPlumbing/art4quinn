import { ToolDef } from '../ToolRegistry';

let startPt = { x: 0, y: 0 };
let savedImageData: ImageData | null = null;

export const EllipseTool: ToolDef = {
  id: 'ellipse',
  name: 'Ellipse',
  type: 'vector',
  cursor: 'crosshair',
  onPointerDown: (pt, ctx) => {
    ctx.pushUndoState();
    startPt = { x: pt.x, y: pt.y };
    savedImageData = ctx.ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  },
  onPointerMove: (pt, ctx) => {
    if (!savedImageData) return;
    
    ctx.ctx.putImageData(savedImageData, 0, 0);
    
    ctx.ctx.beginPath();
    const centerX = (startPt.x + pt.x) / 2;
    const centerY = (startPt.y + pt.y) / 2;
    const radiusX = Math.abs(pt.x - startPt.x) / 2;
    const radiusY = Math.abs(pt.y - startPt.y) / 2;
    ctx.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    
    ctx.ctx.strokeStyle = ctx.color;
    ctx.ctx.lineWidth = ctx.size;
    ctx.ctx.globalAlpha = ctx.opacity / 100;
    ctx.ctx.stroke();
  },
  onPointerUp: (pt, ctx) => {
    savedImageData = null;
  }
};
