import { ToolDef } from '../ToolRegistry';

let startPt = { x: 0, y: 0 };
let savedImageData: ImageData | null = null;

export const SelectTool: ToolDef = {
  id: 'select',
  name: 'Select',
  type: 'select',
  cursor: 'crosshair',
  onPointerDown: (pt, ctx) => {
    startPt = { x: pt.x, y: pt.y };
    savedImageData = ctx.ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  },
  onPointerMove: (pt, ctx) => {
    if (!savedImageData) return;
    
    ctx.ctx.putImageData(savedImageData, 0, 0);
    
    const x = Math.min(startPt.x, pt.x);
    const y = Math.min(startPt.y, pt.y);
    const w = Math.abs(pt.x - startPt.x);
    const h = Math.abs(pt.y - startPt.y);
    
    ctx.ctx.beginPath();
    ctx.ctx.rect(x, y, w, h);
    
    ctx.ctx.strokeStyle = '#000000';
    ctx.ctx.lineWidth = 1;
    ctx.ctx.setLineDash([5, 5]);
    ctx.ctx.stroke();
    
    ctx.ctx.strokeStyle = '#ffffff';
    ctx.ctx.lineDashOffset = 5;
    ctx.ctx.stroke();
    
    ctx.ctx.setLineDash([]);
    ctx.ctx.lineDashOffset = 0;
  },
  onPointerUp: (pt, ctx) => {
    savedImageData = null;
  }
};
