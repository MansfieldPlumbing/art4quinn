import { ToolRegistry, Point } from '../registry/ToolRegistry';
import { useAppStore } from '../store';

// A raw engine to manage the canvas and tools outside of React to prevent thrashing
export class CanvasEngine {
  public canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  
  private undoStack: ImageData[] = [];
  private redoStack: ImageData[] = [];
  private maxUndoSteps = 50;
  
  private isPointerDown = false;
  private lastPoint: Point | null = null;

  private currentTransform = { x: 0, y: 0, scale: 1 };
  private canvasWidth = 0;
  private canvasHeight = 0;

  constructor() {
    // Bind methods
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
  }

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Set internal resolution based on CSS size for high DPI
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      this.canvasWidth = rect.width;
      this.canvasHeight = rect.height;
      
      // Assume a 2x pixel ratio for crispness
      canvas.width = this.canvasWidth * 2;
      canvas.height = this.canvasHeight * 2;
      
      if (this.ctx) {
        this.ctx.scale(2, 2);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
      }
    }

    // Save initial state
    this.pushUndoState();

    // Attach native DOM events for minimum latency
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove); // Bind to window so we don't lose pointer
    window.addEventListener('pointerup', this.handlePointerUp);
  }
  
  detach() {
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
      window.removeEventListener('pointermove', this.handlePointerMove);
      window.removeEventListener('pointerup', this.handlePointerUp);
    }
    this.canvas = null;
    this.ctx = null;
  }

  clear() {
    if (!this.ctx || !this.canvas) return;
    this.pushUndoState();
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
  }

  pushUndoState() {
    if (!this.ctx || !this.canvas) return;
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.undoStack.push(imageData);
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift(); // Remove oldest
    }
    this.redoStack = []; // Clear redo on action
  }
  
  undo() {
    if (!this.ctx || !this.canvas || this.undoStack.length <= 1) return;
    
    // Push current to redo
    const current = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.redoStack.push(current);
    
    // Pop last from undo
    const previous = this.undoStack.pop();
    if (previous) {
      this.ctx.putImageData(previous, 0, 0);
    }
  }
  
  redo() {
    if (!this.ctx || !this.canvas || this.redoStack.length === 0) return;
    
    // Push current to undo
    const current = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.undoStack.push(current);
    
    // Pop next from redo
    const next = this.redoStack.pop();
    if (next) {
      this.ctx.putImageData(next, 0, 0);
    }
  }

  // Event translation
  private getCanvasPoint(e: PointerEvent): Point {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    
    // Note: If panning/zooming, the coordinate transformation needs to reverse canvasTransform
    // But since the pointer is visually matching the CSS transform of the canvas, we just get local rect coords
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 1,
    };
  }

  private getContextState() {
    const store = useAppStore.getState();
    return {
      canvas: this.canvas!,
      ctx: this.ctx!,
      transform: store.canvasTransform,
      color: store.color,
      size: store.brushSize,
      opacity: store.opacity,
      pushUndoState: () => this.pushUndoState(),
      commit: () => {},
    };
  }

  private handlePointerDown(e: PointerEvent) {
    this.isPointerDown = true;
    const pt = this.getCanvasPoint(e);
    this.lastPoint = pt;

    const toolId = useAppStore.getState().tool;
    const tool = ToolRegistry.getTool(toolId);
    if (tool && tool.onPointerDown) {
      tool.onPointerDown(pt, this.getContextState());
    }
  }

  private handlePointerMove(e: PointerEvent) {
    if (!this.isPointerDown) return;
    const pt = this.getCanvasPoint(e);
    
    const toolId = useAppStore.getState().tool;
    const tool = ToolRegistry.getTool(toolId);
    if (tool && tool.onPointerMove) {
      tool.onPointerMove(pt, this.getContextState());
    }
    this.lastPoint = pt;
  }

  private handlePointerUp(e: PointerEvent) {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    const pt = this.getCanvasPoint(e);

    const toolId = useAppStore.getState().tool;
    const tool = ToolRegistry.getTool(toolId);
    if (tool && tool.onPointerUp) {
      tool.onPointerUp(pt, this.getContextState());
    }
    this.lastPoint = null;
  }
}

export const engine = new CanvasEngine();
