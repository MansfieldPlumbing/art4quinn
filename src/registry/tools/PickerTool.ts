import { ToolDef } from '../ToolRegistry';
import { useAppStore } from '../../store';

export const PickerTool: ToolDef = {
  id: 'picker',
  name: 'Color Picker',
  type: 'system',
  cursor: 'crosshair',
  onPointerDown: (pt, ctx) => {
    pickColor(pt, ctx);
  },
  onPointerMove: (pt, ctx) => {
    // Drag to pick
    if (pt.pressure !== undefined && pt.pressure === 0) return; // Not dragging
    pickColor(pt, ctx);
  },
  onPointerUp: (pt, ctx) => { }
};

function pickColor(pt: {x: number, y: number}, ctx: any) {
  // Rather than just picking from the current layer, let's pick from a fresh composite of visible layers
  const layers = useAppStore.getState().layers;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = ctx.canvas.width;
  tempCanvas.height = ctx.canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;

  const sortedLayers = [...layers].reverse();
  sortedLayers.forEach(layer => {
    if (!layer.visible) return;
    const cvs = document.getElementById(`layer-${layer.id}`) as HTMLCanvasElement;
    if (cvs) {
      tempCtx.globalAlpha = layer.opacity / 100;
      let blend = 'source-over';
      if (layer.blendMode === 'Screen') blend = 'screen';
      else if (layer.blendMode === 'Multiply') blend = 'multiply';
      else if (layer.blendMode === 'Overlay') blend = 'overlay';
      tempCtx.globalCompositeOperation = blend as GlobalCompositeOperation;
      tempCtx.drawImage(cvs, 0, 0);
    }
  });

  const pixel = tempCtx.getImageData(pt.x, pt.y, 1, 1).data;
  if (pixel[3] > 0) {
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    useAppStore.getState().setColor(hex);
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
