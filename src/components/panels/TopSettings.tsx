import React from 'react';
import { useAppStore } from '../../store';
import { 
  Download, Upload, Trash2, FileBox, 
  Image as ImageIcon, Gamepad2, Move, FilePlus, Redo2, Undo2
} from 'lucide-react';
import { appHistory } from '../../registry/HistoryManager';

export default function TopSettings() {
  const clearCanvas = useAppStore(state => state.clearCanvas);
  const resetView = useAppStore(state => state.resetView);
  const setView = useAppStore(state => state.setView);
  const thumbstickEnabled = useAppStore(state => state.thumbstickEnabled);
  const setThumbstickEnabled = useAppStore(state => state.setThumbstickEnabled);
  const activeLayer = useAppStore(state => state.activeLayer);
  const canUndo = useAppStore(state => state.canUndo);
  const canRedo = useAppStore(state => state.canRedo);

  const exportPNG = () => {
    const layers = useAppStore.getState().layers;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = 1080;
    finalCanvas.height = 1080;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;
    
    const sortedLayers = [...layers].reverse(); 
    sortedLayers.forEach(layer => {
       if (!layer.visible) return;
       const cvs = document.getElementById(`layer-${layer.id}`) as HTMLCanvasElement;
       if (cvs) {
           ctx.globalAlpha = layer.opacity / 100;
           let blend = 'source-over';
           if (layer.blendMode === 'Screen') blend = 'screen';
           else if (layer.blendMode === 'Multiply') blend = 'multiply';
           ctx.globalCompositeOperation = blend as GlobalCompositeOperation;
           ctx.drawImage(cvs, 0, 0);
       }
    });

    const url = finalCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flickpaint-export.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setView('center');
  };

  const importImageRef = React.useRef<HTMLInputElement>(null);

  const handleImportImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const layers = useAppStore.getState().layers;
        const allCanvases = layers.map(l => ({
          id: l.id,
          canvas: document.getElementById(`layer-${l.id}`) as HTMLCanvasElement
        })).filter(l => l.canvas);
        appHistory.pushState(allCanvases);

        const cvs = document.getElementById(`layer-${activeLayer}`) as HTMLCanvasElement;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;
        
        const scaleRatio = Math.min(cvs.width / img.width, cvs.height / img.height);
        const w = img.width * scaleRatio;
        const h = img.height * scaleRatio;
        ctx.drawImage(img, (cvs.width - w) / 2, (cvs.height - h) / 2, w, h);
        setView('center');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    
    // reset input
    e.target.value = '';
  };

  const importImage = () => {
    importImageRef.current?.click();
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full overflow-hidden text-xs">
      <input type="file" ref={importImageRef} onChange={handleImportImageChange} accept="image/*" className="hidden" />
      <h2 className="text-sm font-bold text-white/70 tracking-widest uppercase mb-4 mt-2">File & Edit</h2>
      
      <div className="grid grid-cols-2 gap-6 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
        {/* Left Column: File Actions */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-wider pl-1">Document</h3>
          <div className="space-y-2">
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const layers = useAppStore.getState().layers;
                  const allCanvases = layers.map(l => ({
                    id: l.id,
                    canvas: document.getElementById(`layer-${l.id}`) as HTMLCanvasElement
                  })).filter(l => l.canvas);
                  appHistory.undo(allCanvases);
                }}
                disabled={!canUndo}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-white/80 transition-colors ${canUndo ? 'bg-white/5 hover:bg-white/10' : 'bg-white/5 opacity-50 cursor-not-allowed'}`}
                title="Undo"
              >
                <Undo2 className="w-5 h-5 text-white/50" />
              </button>
              <button 
                onClick={() => {
                  const layers = useAppStore.getState().layers;
                  const allCanvases = layers.map(l => ({
                    id: l.id,
                    canvas: document.getElementById(`layer-${l.id}`) as HTMLCanvasElement
                  })).filter(l => l.canvas);
                  appHistory.redo(allCanvases);
                }}
                disabled={!canRedo}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-white/80 transition-colors ${canRedo ? 'bg-white/5 hover:bg-white/10' : 'bg-white/5 opacity-50 cursor-not-allowed'}`}
                title="Redo"
              >
                <Redo2 className="w-5 h-5 text-white/50" />
              </button>
            </div>
            
            <button 
              onClick={() => {
                if (confirm('Create a new project? All unsaved progress will be lost.')) {
                  useAppStore.getState().setLayers([
                    { id: 1, name: 'Painting Layer', visible: true, locked: false, alphaLocked: false, blendMode: 'Normal', opacity: 100 },
                    { id: 2, name: 'Background Image', visible: true, locked: true, alphaLocked: false, blendMode: 'Normal', opacity: 100 },
                  ]);
                  useAppStore.getState().setActiveLayer(1);
                  clearCanvas();
                  resetView();
                  setView('center');
                  
                  // Clear appHistory
                  appHistory.clear();
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-white/80 transition-colors"
            >
              <FilePlus className="w-5 h-5 text-white/50" />
              <div className="text-left leading-tight">
                <span className="block font-bold">New Project</span>
                <span className="block text-[10px] text-white/40">Create a blank canvas</span>
              </div>
            </button>
            
            <button 
              onClick={() => useAppStore.getState().setAppMode('gallery')}
              className="w-full flex items-center gap-3 px-3 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-lg transition-colors mb-2"
            >
              <FileBox className="w-5 h-5" />
              <div className="text-left leading-tight">
                <span className="block font-bold">Back to Gallery</span>
                <span className="block text-[10px] opacity-70">Exit to main menu</span>
              </div>
            </button>
            <button 
              onClick={exportPNG}
              className="w-full flex items-center gap-3 px-3 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-white/80 transition-colors"
            >
              <Download className="w-5 h-5 text-white/50" />
              <div className="text-left leading-tight">
                <span className="block font-bold">Export PNG</span>
                <span className="block text-[10px] text-white/40">Save to your device</span>
              </div>
            </button>
            <button 
              onClick={() => {
                if (confirm('Are you sure you want to clear all layers?')) {
                  clearCanvas();
                  setView('center');
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              <div className="text-left leading-tight">
                <span className="block font-bold">Clear Canvas</span>
                <span className="block text-[10px] opacity-70">Delete all drawing data</span>
              </div>
            </button>
          </div>

          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-wider pl-1 mt-4">View Context</h3>
          <div className="space-y-2">
            <button 
              onClick={() => {
                resetView();
                setView('center');
              }}
              className="w-full flex items-center gap-3 px-3 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-white/80 transition-colors"
            >
              <Move className="w-5 h-5 text-white/50" />
              <div className="text-left leading-tight">
                <span className="block font-bold">Reset View</span>
                <span className="block text-[10px] text-white/40">Center and reset zoom</span>
              </div>
            </button>
            <button 
              onClick={() => setThumbstickEnabled(!thumbstickEnabled)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${thumbstickEnabled ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-white/80 hover:bg-white/10'}`}
            >
              <Gamepad2 className="w-5 h-5 opacity-70" />
              <div className="text-left leading-tight">
                <span className="block font-bold">Thumbstick {thumbstickEnabled ? 'On' : 'Off'}</span>
                <span className="block text-[10px] opacity-70">Virtual joystick control</span>
              </div>
            </button>
          </div>
        </div>

        {/* Right Column: Assets */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-wider pl-1 flex items-center justify-between">
            <span>Import & Assets</span>
          </h3>
          <div className="space-y-2">
            <button 
              onClick={importImage}
              className="w-full flex flex-col items-center justify-center gap-2 px-3 py-6 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-lg text-white/80 transition-colors"
            >
              <Upload className="w-6 h-6 text-white/50" />
              <span className="font-bold">Import Image</span>
              <span className="text-[10px] text-white/40 text-center">Select file from device</span>
            </button>
            
            <div className="bg-black/30 rounded-lg p-3 border border-white/5 mt-4 min-h-[160px] flex flex-col">
              <h4 className="text-[10px] font-bold text-white/50 tracking-widest uppercase mb-2">Assets Staging</h4>
              <div className="flex-1 flex flex-col items-center justify-center text-white/30 text-center gap-2">
                <FileBox className="w-8 h-8 opacity-50" />
                <span>No assets imported yet.<br/>Imported files will appear here before adding to canvas.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

