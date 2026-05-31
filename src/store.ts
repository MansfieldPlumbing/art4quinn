import { create } from 'zustand';

export type AppMode = 'gallery' | 'paint';
export type ScreenView = 'center' | 'left' | 'right' | 'top' | 'bottom';
export type ToolType = 'brush' | 'eraser' | 'magic_eraser' | 'move' | 'select' | 'lasso' | 'magic' | 'crop' | 'pencil' | 'pen' | 'marker' | 'fill' | 'gradient' | 'picker' | 'blur' | 'smudge' | 'sharpen' | 'dodge' | 'burn' | 'contrast' | 'text' | 'rect' | 'ellipse' | 'poly';

export interface LayerDef {
  id: number;
  name: string;
  visible: boolean;
  locked: boolean;
  alphaLocked: boolean;
  blendMode: string;
  opacity: number;
}

interface AppState {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  
  activeAssetUrl: string | null;
  setActiveAssetUrl: (url: string | null) => void;

  currentView: ScreenView;
  setView: (view: ScreenView) => void;

  tool: ToolType;
  setTool: (tool: ToolType) => void;

  color: string;
  setColor: (color: string) => void;

  brushSize: number;
  setBrushSize: (size: number) => void;

  opacity: number;
  setOpacity: (opacity: number) => void;
  
  canvasTransform: { x: number; y: number; scale: number };
  setCanvasTransform: (transform: { x: number; y: number; scale: number }) => void;
  
  thumbstickEnabled: boolean;
  setThumbstickEnabled: (enabled: boolean) => void;
  // Flag to trigger clear canvas
  triggerClearCounter: number;
  clearCanvas: () => void;

  triggerResetViewCounter: number;
  resetView: () => void;

  layers: LayerDef[];
  setLayers: (layers: LayerDef[] | ((prev: LayerDef[]) => LayerDef[])) => void;
  activeLayer: number;
  setActiveLayer: (id: number) => void;

  canUndo: boolean;
  canRedo: boolean;
  setUndoRedoStatus: (canUndo: boolean, canRedo: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  appMode: 'gallery',
  setAppMode: (mode) => set({ appMode: mode }),

  activeAssetUrl: null,
  setActiveAssetUrl: (url) => set({ activeAssetUrl: url }),

  currentView: 'center',
  setView: (view) => set({ currentView: view }),

  tool: 'brush',
  setTool: (tool) => set({ tool }),

  color: '#000000',
  setColor: (color) => set({ color }),

  brushSize: 10,
  setBrushSize: (size) => set({ brushSize: size }),

  opacity: 100,
  setOpacity: (opacity) => set({ opacity: opacity }),

  canvasTransform: { x: 0, y: 0, scale: 1 },
  setCanvasTransform: (transform) => set({ canvasTransform: transform }),

  thumbstickEnabled: true,
  setThumbstickEnabled: (enabled) => set({ thumbstickEnabled: enabled }),

  triggerClearCounter: 0,
  clearCanvas: () => set((state) => ({ triggerClearCounter: state.triggerClearCounter + 1 })),

  triggerResetViewCounter: 0,
  resetView: () => set((state) => ({ triggerResetViewCounter: state.triggerResetViewCounter + 1 })),

  layers: [
    { id: 1, name: 'Painting Layer', visible: true, locked: false, alphaLocked: false, blendMode: 'Normal', opacity: 100 },
    { id: 2, name: 'Background Image', visible: true, locked: true, alphaLocked: false, blendMode: 'Normal', opacity: 100 },
  ],
  setLayers: (layers) => set((state) => ({ layers: typeof layers === 'function' ? layers(state.layers) : layers })),
  activeLayer: 1,
  setActiveLayer: (id) => set({ activeLayer: id }),
  canUndo: false,
  canRedo: false,
  setUndoRedoStatus: (canUndo, canRedo) => set({ canUndo, canRedo }),
}));
