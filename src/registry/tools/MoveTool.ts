import { ToolDef } from '../ToolRegistry';

let startPt = { x: 0, y: 0 };
let offscreenCanvas: HTMLCanvasElement | null = null;

export const MoveTool: ToolDef = {
  id: 'move',
  name: 'Move',
  type: 'select',
  cursor: 'move',
  onPointerDown: (pt, ctx) => {
    ctx.pushUndoState();
    startPt = { x: pt.x, y: pt.y };
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = ctx.canvas.width;
    offscreenCanvas.height = ctx.canvas.height;
    const offCtx = offscreenCanvas.getContext('2d')!;
    offCtx.drawImage(ctx.canvas, 0, 0);
  },
  onPointerMove: (pt, ctx) => {
    if (!offscreenCanvas) return;
    
    const dx = pt.x - startPt.x;
    const dy = pt.y - startPt.y;
    
    ctx.ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.ctx.drawImage(offscreenCanvas, dx, dy);
  },
  onPointerUp: (pt, ctx) => {
    offscreenCanvas = null;
  }
};
