import { ToolDef } from '../ToolRegistry';

let lastPoint = { x: 0, y: 0 };

export const PenTool: ToolDef = {
  id: 'pen',
  name: 'Pen',
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
    // Very pressure sensitive
    const pressure = pt.pressure !== undefined ? pt.pressure : 1;
    ctx.ctx.lineWidth = ctx.size * pressure * pressure; 
    ctx.ctx.globalAlpha = ctx.opacity / 100;
    
    ctx.ctx.stroke();
  },
  onPointerMove: (pt, ctx) => {
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.ctx.lineTo(pt.x, pt.y);
    
    const pressure = pt.pressure !== undefined ? pt.pressure : 1;
    ctx.ctx.lineWidth = ctx.size * pressure * pressure; 
    ctx.ctx.stroke();
    lastPoint = { x: pt.x, y: pt.y };
  },
  onPointerUp: (pt, ctx) => { }
};
