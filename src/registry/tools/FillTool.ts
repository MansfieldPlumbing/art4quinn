import { ToolDef } from '../ToolRegistry';

export const FillTool: ToolDef = {
  id: 'fill',
  name: 'Fill Layer',
  type: 'paint',
  cursor: 'crosshair',
  onPointerDown: (pt, ctx) => {
    ctx.pushUndoState();
    ctx.ctx.globalAlpha = ctx.opacity / 100;
    ctx.ctx.fillStyle = ctx.color;
    
    // Fill the entire canvas for this layer
    ctx.ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  },
  onPointerMove: (pt, ctx) => { },
  onPointerUp: (pt, ctx) => { }
};
