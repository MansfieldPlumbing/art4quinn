import { ToolDef } from '../ToolRegistry';

// Track the previous point here so we can draw lines instead of just dots
let lastPoint = { x: 0, y: 0 };

const paintbrushSvg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(1px 1px 1px black);"><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/></svg>`);
const paintbrushCursor = `url("data:image/svg+xml,${paintbrushSvg}") 4 20, crosshair`;

export const BrushTool: ToolDef = {
  id: 'brush',
  name: 'Brush',
  type: 'paint',
  cursor: paintbrushCursor,
  onPointerDown: (pt, ctx) => {
    ctx.pushUndoState();
    
    lastPoint = { x: pt.x, y: pt.y };
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pt.x, pt.y);
    ctx.ctx.lineTo(pt.x, pt.y);
    
    // Apply Settings
    ctx.ctx.strokeStyle = ctx.color;
    ctx.ctx.lineCap = 'round';
    ctx.ctx.lineJoin = 'round';
    // Base size on pressure if available
    ctx.ctx.lineWidth = ctx.size * (pt.pressure || 1);
    ctx.ctx.globalAlpha = ctx.opacity / 100;
    
    ctx.ctx.stroke();
  },
  onPointerMove: (pt, ctx) => {
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.ctx.lineTo(pt.x, pt.y);
    
    ctx.ctx.lineWidth = ctx.size * (pt.pressure || 1);
    ctx.ctx.stroke();
    
    lastPoint = { x: pt.x, y: pt.y };
  },
  onPointerUp: (pt, ctx) => {
    // End stroke
  }
};
