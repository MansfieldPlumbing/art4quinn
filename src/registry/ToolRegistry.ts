// Registry for tools and their schemas/lifecycle events

export type Point = { x: number; y: number; pressure?: number };

export interface ToolContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  transform: { x: number; y: number; scale: number };
  color: string;
  size: number;
  opacity: number;
  pushUndoState: () => void;
  // Allows the tool to request a redraw or commit
  commit: () => void;
}

export interface ToolDef {
  id: string;
  name: string;
  type: 'paint' | 'select' | 'retouch' | 'vector' | 'system';
  onPointerDown?: (pt: Point, context: ToolContext) => void;
  onPointerMove?: (pt: Point, context: ToolContext) => void;
  onPointerUp?: (pt: Point, context: ToolContext) => void;
  onActivate?: (context: ToolContext) => void;
  onDeactivate?: (context: ToolContext) => void;
  cursor?: string;
}

class Registry {
  private tools: Map<string, ToolDef> = new Map();

  register(tool: ToolDef) {
    this.tools.set(tool.id, tool);
  }

  getTool(id: string): ToolDef | undefined {
    return this.tools.get(id);
  }

  getAllTools(): ToolDef[] {
    return Array.from(this.tools.values());
  }
}

export const ToolRegistry = new Registry();
