import { ToolDef } from '../ToolRegistry';

let lastPoint = { x: 0, y: 0 };

export const AirbrushTool: ToolDef = {
  id: 'air',
  name: 'Airbrush',
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
    ctx.ctx.lineWidth = ctx.size * 2;
    ctx.ctx.globalAlpha = (ctx.opacity / 100) * 0.1; // Extremely soft
    ctx.ctx.shadowBlur = ctx.size * 2; 
    ctx.ctx.shadowColor = ctx.color;
    
    ctx.ctx.stroke();
  },
  onPointerMove: (pt, ctx) => {
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.ctx.lineTo(pt.x, pt.y);
    
    ctx.ctx.lineWidth = ctx.size * 2;
    ctx.ctx.stroke();
    lastPoint = { x: pt.x, y: pt.y };
  },
  onPointerUp: (pt, ctx) => {
    ctx.ctx.shadowBlur = 0;
    ctx.ctx.shadowColor = 'transparent';
  }
};
