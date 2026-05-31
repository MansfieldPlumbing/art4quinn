import { ToolDef } from '../ToolRegistry';

let startPt = { x: 0, y: 0 };
let savedImageData: ImageData | null = null;

export const PolyTool: ToolDef = {
  id: 'poly',
  name: 'Polygon',
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
    const radius = Math.hypot(pt.x - startPt.x, pt.y - startPt.y);
    const sides = 5;
    for (let i = 0; i <= sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      const x = startPt.x + radius * Math.cos(angle);
      const y = startPt.y + radius * Math.sin(angle);
      if (i === 0) ctx.ctx.moveTo(x, y);
      else ctx.ctx.lineTo(x, y);
    }
    ctx.ctx.closePath();
    
    ctx.ctx.strokeStyle = ctx.color;
    ctx.ctx.lineWidth = ctx.size;
    ctx.ctx.globalAlpha = ctx.opacity / 100;
    ctx.ctx.stroke();
  },
  onPointerUp: (pt, ctx) => {
    savedImageData = null;
  }
};
