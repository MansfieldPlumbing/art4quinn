import { useAppStore } from '../store';

export class HistoryManager {
  private undoStack: Array<{ layerId: number; data: ImageData }>[] = [];
  private redoStack: Array<{ layerId: number; data: ImageData }>[] = [];
  private maxSteps = 50;

  private syncStore() {
    useAppStore.getState().setUndoRedoStatus(this.canUndo(), this.canRedo());
  }

  pushState(layers: { id: number; canvas: HTMLCanvasElement }[]) {
    // Save state of all layers
    const state = layers.map(l => {
      const ctx = l.canvas.getContext('2d', { willReadFrequently: true });
      return {
        layerId: l.id,
        data: ctx!.getImageData(0, 0, l.canvas.width, l.canvas.height)
      };
    });
    this.undoStack.push(state);
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.syncStore();
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }
  
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.syncStore();
  }

  undo(layers: { id: number; canvas: HTMLCanvasElement }[]) {
    if (this.undoStack.length === 0) return;
    
    // Save current to redo
    const currentState = layers.map(l => {
      const ctx = l.canvas.getContext('2d', { willReadFrequently: true });
      return {
        layerId: l.id,
        data: ctx!.getImageData(0, 0, l.canvas.width, l.canvas.height)
      };
    });
    this.redoStack.push(currentState);
    
    // Apply last undo
    const state = this.undoStack.pop()!;
    this.applyState(state, layers);
    this.syncStore();
  }

  redo(layers: { id: number; canvas: HTMLCanvasElement }[]) {
    if (this.redoStack.length === 0) return;
    
    // Save current to undo
    const currentState = layers.map(l => {
      const ctx = l.canvas.getContext('2d', { willReadFrequently: true });
      return {
        layerId: l.id,
        data: ctx!.getImageData(0, 0, l.canvas.width, l.canvas.height)
      };
    });
    this.undoStack.push(currentState);
    
    // Apply next redo
    const state = this.redoStack.pop()!;
    this.applyState(state, layers);
    this.syncStore();
  }

  private applyState(state: Array<{layerId: number, data: ImageData}>, layers: { id: number; canvas: HTMLCanvasElement }[]) {
    state.forEach(s => {
      const l = layers.find(layer => layer.id === s.layerId);
      if (l) {
        const ctx = l.canvas.getContext('2d');
        ctx?.putImageData(s.data, 0, 0);
      }
    });
  }
}

export const appHistory = new HistoryManager();
