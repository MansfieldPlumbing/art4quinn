import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Eye, EyeOff, Copy, Blend, Lock, LockKeyhole, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../store';
import { appHistory } from '../../registry/HistoryManager';

const blendModes = [
  { value: 'Normal', name: 'Normal', description: 'Standard drawing with standard opacity over layers' },
  { value: 'Multiply', name: 'Multiply', description: 'Darkens underlying colors, perfect for shadow blocks' },
  { value: 'Screen', name: 'Screen', description: 'Lightens underlying colors, perfect for neon & bloom' },
  { value: 'Overlay', name: 'Overlay', description: 'Combines shadow multiplication & soft highlight screening' },
  { value: 'Dodge', name: 'Color Dodge', description: 'Vivid, highly intense highlight saturation boosts' },
  { value: 'Burn', name: 'Color Burn', description: 'Inverted highlights for rich, burned, high-contrast shadows' },
];

function LayerThumbnail({ layerId }: { layerId: number }) {
  const thumbnailCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    let lastUpdated = 0;

    const updateThumbnail = () => {
      const sourceCanvas = document.getElementById(`layer-${layerId}`) as HTMLCanvasElement | null;
      const thumbCanvas = thumbnailCanvasRef.current;
      if (sourceCanvas && thumbCanvas) {
        const thumbCtx = thumbCanvas.getContext('2d');
        if (thumbCtx) {
          thumbCtx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);
          thumbCtx.drawImage(
            sourceCanvas,
            0,
            0,
            sourceCanvas.width,
            sourceCanvas.height,
            0,
            0,
            thumbCanvas.width,
            thumbCanvas.height
          );
        }
      }
    };

    const loop = (timestamp: number) => {
      if (timestamp - lastUpdated > 150) {
        updateThumbnail();
        lastUpdated = timestamp;
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [layerId]);

  return (
    <div className="w-8 h-8 rounded shrink-0 relative overflow-hidden bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzhhYWGMYAEYB8RmROaABADeOQ8CXl/xfgAAAABJRU5ErkJggg==')] bg-repeat">
      <canvas
        ref={thumbnailCanvasRef}
        width={48}
        height={48}
        className="w-full h-full object-cover relative z-10"
      />
      <div className="absolute inset-0 bg-white/5 z-0" />
    </div>
  );
}

interface DragState {
  type: 'none' | 'opacity' | 'reorder';
  layerId: number | null;
  startX: number;
  startY: number;
  startOpacity: number;
}

export default function RightLayers() {
  const { layers, setLayers, activeLayer, setActiveLayer } = useAppStore();

  const activeLayerData = layers.find(l => l.id === activeLayer);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [blendMenuOpen, setBlendMenuOpen] = useState(false);

  // Dragging and Gestural states
  const [reorderingLayerId, setReorderingLayerId] = useState<number | null>(null);
  const [swipingOpacityId, setSwipingOpacityId] = useState<number | null>(null);

  const dragState = useRef<DragState>({
    type: 'none',
    layerId: null,
    startX: 0,
    startY: 0,
    startOpacity: 100
  });

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const updateActiveLayer = (updates: Partial<typeof layers[0]>) => {
    setLayers(l => l.map(x => x.id === activeLayer ? { ...x, ...updates } : x));
  };

  const addLayer = () => {
    const newId = Date.now();
    setLayers([{ id: newId, name: `Layer ${layers.length + 1}`, visible: true, locked: false, alphaLocked: false, blendMode: 'Normal', opacity: 100 }, ...layers]);
    setActiveLayer(newId);
  };

  const deleteLayer = () => {
    if (layers.length <= 1) return; // don't delete last layer
    const newLayers = layers.filter(l => l.id !== activeLayer);
    setLayers(newLayers);
    setActiveLayer(newLayers[0].id);
  };

  const startRename = (id: number, currentName: string) => {
    setEditingId(id);
    setEditingText(currentName);
  };

  const saveRename = (id: number) => {
    if (editingText.trim()) {
      setLayers(prev => prev.map(l => l.id === id ? { ...l, name: editingText.trim() } : l));
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === 'Enter') {
      saveRename(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const duplicateLayer = () => {
    if (!activeLayerData) return;
    const newId = Date.now();
    const activeCvs = document.getElementById(`layer-${activeLayer}`) as HTMLCanvasElement;
    
    // Save state for undo/redo before duplicating
    const allCanvases = layers.map(l => ({
      id: l.id,
      canvas: document.getElementById(`layer-${l.id}`) as HTMLCanvasElement
    })).filter(l => l.canvas);
    appHistory.pushState(allCanvases);

    setLayers(prev => {
      const activeIndex = prev.findIndex(l => l.id === activeLayer);
      const newLayer = {
        ...activeLayerData,
        id: newId,
        name: `${activeLayerData.name} Copy`,
        locked: false,
        alphaLocked: false
      };
      const result = [...prev];
      result.splice(activeIndex, 0, newLayer);
      return result;
    });
    
    setActiveLayer(newId);
    
    // Render copy in next microtask
    setTimeout(() => {
      const newCvs = document.getElementById(`layer-${newId}`) as HTMLCanvasElement;
      if (activeCvs && newCvs) {
        const newCtx = newCvs.getContext('2d');
        if (newCtx) {
          newCtx.drawImage(activeCvs, 0, 0);
        }
      }
    }, 50);
  };

  const moveLayerUp = () => {
    const idx = layers.findIndex(l => l.id === activeLayer);
    if (idx <= 0) return; // Already at top visually
    setLayers(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx - 1];
      next[idx - 1] = temp;
      return next;
    });
  };

  const moveLayerDown = () => {
    const idx = layers.findIndex(l => l.id === activeLayer);
    if (idx === -1 || idx >= layers.length - 1) return; // Already at bottom visually
    setLayers(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx + 1];
      next[idx + 1] = temp;
      return next;
    });
  };

  // Pointer event handlers for our modern gestures (Swipe horizontal to adjust Opacity, Long-press vertical drag to Reorder)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, layer: typeof layers[0]) => {
    if (e.button !== 0) return; // Left clicks / primary touch only
    
    const target = e.target as HTMLElement;
    // Don't trigger gesture if interacting with interactive controls or currently typing name
    if (target.closest('button') || target.closest('input') || editingId === layer.id) {
      return;
    }

    setActiveLayer(layer.id);

    const startX = e.clientX;
    const startY = e.clientY;

    dragState.current = {
      type: 'none',
      layerId: layer.id,
      startX,
      startY,
      startOpacity: layer.opacity
    };

    e.currentTarget.setPointerCapture(e.pointerId);

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      const currentDrag = dragState.current;
      if (currentDrag.layerId === layer.id && currentDrag.type === 'none') {
        currentDrag.type = 'reorder';
        setReorderingLayerId(layer.id);
        if (navigator.vibrate) {
          try {
            navigator.vibrate(40);
          } catch (err) {
            // Safe fallback
          }
        }
      }
    }, 350); // 350ms activation for reordering mode
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const currentDrag = dragState.current;
    if (currentDrag.layerId === null) return;

    const dx = e.clientX - currentDrag.startX;
    const dy = e.clientY - currentDrag.startY;

    if (currentDrag.type === 'none') {
      // If pointer moved horizontally significantly, shift into opacity mode immediately and cancel reorder press
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        currentDrag.type = 'opacity';
        setSwipingOpacityId(currentDrag.layerId);
      } else if (Math.abs(dy) > 10) {
        // If pointer moved vertically early, cancel long press reorder to permit native scrolling
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
    }

    if (currentDrag.type === 'opacity') {
      // swipe right increases, swipe left decreases. Map 150px of movement to 100% opacity range
      const deltaOpacity = Math.round(dx / 1.5);
      const targetOpacity = Math.max(0, Math.min(100, currentDrag.startOpacity + deltaOpacity));
      setLayers(prev => prev.map(l => l.id === currentDrag.layerId ? { ...l, opacity: targetOpacity } : l));
    } else if (currentDrag.type === 'reorder') {
      // Find element children to perform live swapping feedback
      const container = listContainerRef.current;
      if (!container) return;

      const children = Array.from(container.children) as HTMLElement[];
      const pointerY = e.clientY;
      let targetIndex = -1;

      for (let i = 0; i < children.length; i++) {
        const rect = children[i].getBoundingClientRect();
        if (pointerY >= rect.top && pointerY <= rect.bottom) {
          targetIndex = i;
          break;
        }
      }

      const currentIndex = layers.findIndex(l => l.id === currentDrag.layerId);
      if (targetIndex !== -1 && currentIndex !== -1 && currentIndex !== targetIndex) {
        setLayers(prev => {
          const next = [...prev];
          const movedItem = next[currentIndex];
          next.splice(currentIndex, 1);
          next.splice(targetIndex, 0, movedItem);
          return next;
        });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Handle securely
    }

    dragState.current = {
      type: 'none',
      layerId: null,
      startX: 0,
      startY: 0,
      startOpacity: 100
    };

    setReorderingLayerId(null);
    setSwipingOpacityId(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden text-xs">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-white/70 uppercase tracking-widest">Layers</h2>
        <div className="flex gap-1">
          <button onClick={addLayer} className="p-1.5 bg-white/10 rounded-md text-white/70 hover:bg-white/20 hover:text-white" title="Add Layer">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modernized Blend mode layout as a beautiful custom dropdown */}
      <div className="relative mb-2">
        <button
          onClick={() => setBlendMenuOpen(!blendMenuOpen)}
          className="w-full flex gap-2 p-2 bg-white/5 hover:bg-white/10 rounded-lg items-center justify-between transition-colors border border-white/5 hover:border-white/10 text-white/80"
          title="Select Blend Mode"
        >
          <div className="flex items-center gap-2">
            <Blend className="w-4 h-4 text-indigo-400 shrink-0" />
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[9px] text-white/30 uppercase tracking-wider font-bold">Blend Mode</span>
              <span className="text-xs font-semibold">{activeLayerData?.blendMode || 'Normal'}</span>
            </div>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${blendMenuOpen ? 'rotate-180 text-indigo-400' : ''}`} />
        </button>

        {/* Custom Blend Mode Dropdown Menu */}
        <AnimatePresence>
          {blendMenuOpen && (
            <>
              {/* Overlay backdrop to dismiss dropdown */}
              <div 
                className="fixed inset-0 z-40 bg-transparent cursor-default" 
                onClick={() => setBlendMenuOpen(false)} 
              />
              
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                className="absolute left-0 right-0 mt-1 bg-[#121214] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-white/5 max-h-64 overflow-y-auto custom-scrollbar"
              >
                {blendModes.map((mode) => {
                  const isSelected = (activeLayerData?.blendMode || 'Normal') === mode.value;
                  return (
                    <button
                      key={mode.value}
                      onClick={() => {
                        updateActiveLayer({ blendMode: mode.value as any });
                        setBlendMenuOpen(false);
                      }}
                      className={`w-full text-left p-2.5 flex items-start gap-2.5 transition-colors ${
                        isSelected ? 'bg-indigo-500/15 text-indigo-300' : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="shrink-0 mt-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'bg-transparent'}`} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-xs">{mode.name}</span>
                        <span className="text-[10px] text-white/40 leading-normal">{mode.description}</span>
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Sleek inline instruction guide for modernized swipe and reorder gestures */}
      <div className="text-[10px] text-white/30 text-center mb-3 flex items-center justify-center gap-1.5 py-1 bg-white/[0.02] rounded-md border border-white/[0.03]">
        <span className="font-mono">Swipe ↔</span> for Opacity
        <span className="text-white/10">•</span>
        <span className="font-mono">Hold ↕</span> to Reorder
      </div>
      
      <div className="flex gap-1 mb-2">
        <button 
          onClick={() => updateActiveLayer({ locked: !activeLayerData?.locked })}
          className={`flex-1 py-1.5 rounded flex items-center justify-center transition-colors ${activeLayerData?.locked ? 'bg-indigo-500/20 text-indigo-300 font-medium' : 'bg-white/5 hover:bg-white/10 text-white/50'}`} title="Lock Layer">
          <Lock className="w-3.5 h-3.5 mr-1" /> Lock
        </button>
        <button 
          onClick={() => updateActiveLayer({ alphaLocked: !activeLayerData?.alphaLocked })}
          className={`flex-1 py-1.5 rounded flex items-center justify-center transition-colors ${activeLayerData?.alphaLocked ? 'bg-indigo-500/20 text-indigo-300 font-medium' : 'bg-white/5 hover:bg-white/10 text-white/50'}`} title="Alpha Lock">
          <LockKeyhole className="w-3.5 h-3.5 mr-1" /> Alpha Lock
        </button>
      </div>

      {/* Main Layers list */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto space-y-1 pb-10 custom-scrollbar">
        {layers.map((layer) => {
          const isActive = activeLayer === layer.id;
          const isEditing = editingId === layer.id;
          const isReordering = reorderingLayerId === layer.id;
          const isSwiping = swipingOpacityId === layer.id;

          return (
            <div 
              key={layer.id} 
              data-layer-id={layer.id}
              onPointerDown={(e) => handlePointerDown(e, layer)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onDoubleClick={() => !isEditing && startRename(layer.id, layer.name)}
              className={`p-2 rounded-lg flex items-center justify-between border cursor-pointer select-none group relative overflow-hidden transition-all duration-150 touch-none ${
                isReordering 
                  ? 'bg-indigo-500/30 border-indigo-500 scale-[1.02] shadow-lg shadow-indigo-500/20 z-50' 
                  : isActive 
                    ? 'bg-indigo-500/15 border-indigo-500/40 shadow-inner' 
                    : 'bg-white/5 border-transparent hover:bg-white/10'
              }`}
            >
              {/* Opacity track background filling when selected/swiping */}
              <div 
                className={`absolute inset-y-0 left-0 pointer-events-none transition-all duration-100 ${
                  isSwiping ? 'bg-indigo-600/25' : isActive ? 'bg-white/5' : 'bg-transparent'
                }`}
                style={{ width: `${layer.opacity}%` }}
              />

              <div className="flex items-center gap-2 w-full pr-2 relative z-10 pointer-events-none">
                <button 
                  className={`text-white/40 hover:text-white shrink-0 pointer-events-auto ${!layer.visible && 'text-white/20'}`}
                  onClick={(e) => { e.stopPropagation(); setLayers(l => l.map(x => x.id === layer.id ? {...x, visible: !x.visible} : x))}}
                  title={layer.visible ? "Hide Layer" : "Show Layer"}
                >
                  {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <LayerThumbnail layerId={layer.id} />
                <div className="flex flex-col flex-1 min-w-0 pr-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingText}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditingText(e.target.value)}
                      onBlur={() => saveRename(layer.id)}
                      onKeyDown={(e) => handleKeyDown(e, layer.id)}
                      className="bg-black/50 text-white border border-indigo-500 rounded px-1 py-0.5 outline-none font-sans text-xs w-full pointer-events-auto"
                      autoFocus
                    />
                  ) : (
                    <span className={`font-medium truncate ${isActive ? 'text-white' : 'text-white/80'}`} title="Double click to rename">
                      {layer.name}
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-white/40 relative z-20">
                    <span className="uppercase font-mono bg-white/5 px-1 py-0.2 rounded border border-white/5">{layer.blendMode}</span>
                    <span className={`font-mono transition-all duration-100 ${isSwiping ? 'text-indigo-300 font-bold scale-110' : ''}`}>
                      {layer.opacity}% Opacity
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity relative z-10 pointer-events-none">
                <GripVertical className="w-3.5 h-3.5 text-white/40" />
                {layer.locked && <Lock className="w-3 h-3 text-white/30" />}
                {layer.alphaLocked && <LockKeyhole className="w-3 h-3 text-indigo-300/50" />}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-white/10 mt-2 gap-1 text-white/30">
        <button 
          onClick={duplicateLayer} 
          className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded flex justify-center hover:text-white" 
          title="Duplicate Layer"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button 
          onClick={moveLayerUp} 
          className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded flex justify-center hover:text-white" 
          title="Move Layer Up"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button 
          onClick={moveLayerDown} 
          className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded flex justify-center hover:text-white" 
          title="Move Layer Down"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button 
          onClick={deleteLayer}
          className="flex-1 py-2 bg-white/5 hover:bg-white/10 hover:bg-red-500/20 hover:text-red-400 rounded flex justify-center transition-colors"
          title="Delete Layer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
