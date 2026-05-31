import { ToolDef } from '../ToolRegistry';

let lastPoint = { x: 0, y: 0 };

export const InkBrushTool: ToolDef = {
  id: 'ink',
  name: 'Ink Pen',
  type: 'paint',
  cursor: 'crosshair',
  onPointerDown: (pt, ctx) => {
    ctx.pushUndoState();
    lastPoint = { x: pt.x, y: pt.y };
    
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pt.x, pt.y);
    ctx.ctx.lineTo(pt.x, pt.y);
    
    ctx.ctx.strokeStyle = ctx.color;
    ctx.ctx.lineCap = 'round';
    ctx.ctx.lineJoin = 'round';
    ctx.ctx.lineWidth = ctx.size * (pt.pressure || 1) * 0.8;
    ctx.ctx.globalAlpha = Math.min(1, (ctx.opacity / 100) * 1.5);
    
    ctx.ctx.stroke();
  },
  onPointerMove: (pt, ctx) => {
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.ctx.lineTo(pt.x, pt.y);
    
    ctx.ctx.lineWidth = ctx.size * (pt.pressure || 1) * 0.8;
    ctx.ctx.stroke();
    lastPoint = { x: pt.x, y: pt.y };
  },
  onPointerUp: (pt, ctx) => { }
};
