import { ToolDef } from '../ToolRegistry';

let lastPoint = { x: 0, y: 0 };

export const MarkerTool: ToolDef = {
  id: 'marker',
  name: 'Marker',
  type: 'paint',
  cursor: 'crosshair',
  onPointerDown: (pt, ctx) => {
    ctx.pushUndoState();
    lastPoint = { x: pt.x, y: pt.y };
    
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pt.x, pt.y);
    ctx.ctx.lineTo(pt.x, pt.y);
    
    ctx.ctx.strokeStyle = ctx.color;
    ctx.ctx.lineCap = 'square';
    ctx.ctx.lineJoin = 'miter';
    ctx.ctx.lineWidth = ctx.size * 1.5;
    ctx.ctx.globalAlpha = (ctx.opacity / 100) * 0.5;
    ctx.ctx.globalCompositeOperation = 'multiply';
    
    ctx.ctx.stroke();
  },
  onPointerMove: (pt, ctx) => {
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.ctx.lineTo(pt.x, pt.y);
    
    ctx.ctx.lineWidth = ctx.size * 1.5;
    ctx.ctx.stroke();
    lastPoint = { x: pt.x, y: pt.y };
  },
  onPointerUp: (pt, ctx) => {
    ctx.ctx.globalCompositeOperation = 'source-over';
  }
};
