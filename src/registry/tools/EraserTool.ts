import { ToolDef } from '../ToolRegistry';

// Track the previous point here so we can draw lines instead of just dots
let lastPoint = { x: 0, y: 0 };

const eraserSvg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(1px 1px 1px black);"><path d="m7 21h10"/><path d="M22 6.5l-4-4-9 9"/><path d="M5.5 10.5l4 4-8.5 8.5H1v-8.5l8.5-8.5z"/></svg>`);
const eraserCursor = `url("data:image/svg+xml,${eraserSvg}") 2 20, crosshair`;

export const EraserTool: ToolDef = {
  id: 'eraser',
  name: 'Eraser',
  type: 'paint',
  cursor: eraserCursor,
  onPointerDown: (pt, ctx) => {
    ctx.pushUndoState();
    lastPoint = { x: pt.x, y: pt.y };
    
    // Using destination-out blend mode to mock erasing
    ctx.ctx.globalCompositeOperation = 'destination-out';
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(pt.x, pt.y);
    ctx.ctx.lineTo(pt.x, pt.y);
    
    ctx.ctx.lineCap = 'round';
    ctx.ctx.lineJoin = 'round';
    ctx.ctx.lineWidth = ctx.size * (pt.pressure || 1);
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
    ctx.ctx.globalCompositeOperation = 'source-over';
  }
};
