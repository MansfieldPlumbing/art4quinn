import { ToolDef } from '../ToolRegistry';

let lastPoint = { x: 0, y: 0 };

export const PencilTool: ToolDef = {
  id: 'pencil',
  name: 'Pencil',
  type: 'paint',
  cursor: 'crosshair',
  onPointerDown: (pt, ctx) => {
    ctx.pushUndoState();
    lastPoint = { x: pt.x, y: pt.y };
    
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pt.x, pt.y);
    ctx.ctx.lineTo(pt.x, pt.y);
    
    ctx.ctx.strokeStyle = ctx.color;
    ctx.ctx.lineCap = 'butt'; // Sharp edges
    ctx.ctx.lineJoin = 'miter';
    ctx.ctx.lineWidth = Math.max(1, ctx.size * 0.2); // Tends to be thin
    ctx.ctx.globalAlpha = ctx.opacity / 100;
    
    ctx.ctx.stroke();
  },
  onPointerMove: (pt, ctx) => {
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.ctx.lineTo(pt.x, pt.y);
    
    ctx.ctx.lineWidth = Math.max(1, ctx.size * 0.2);
    ctx.ctx.stroke();
    lastPoint = { x: pt.x, y: pt.y };
  },
  onPointerUp: (pt, ctx) => { }
};
