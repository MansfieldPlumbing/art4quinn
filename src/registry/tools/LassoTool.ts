import { ToolDef, Point } from '../ToolRegistry';

let points: Point[] = [];
let savedImageData: ImageData | null = null;

export const LassoTool: ToolDef = {
  id: 'lasso',
  name: 'Lasso',
  type: 'select',
  cursor: 'crosshair',
  onPointerDown: (pt, ctx) => {
    points = [{ x: pt.x, y: pt.y }];
    savedImageData = ctx.ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  },
  onPointerMove: (pt, ctx) => {
    if (!savedImageData) return;
    
    points.push({ x: pt.x, y: pt.y });
    
    ctx.ctx.putImageData(savedImageData, 0, 0);
    
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.ctx.closePath();
    
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
    points = [];
  }
};
