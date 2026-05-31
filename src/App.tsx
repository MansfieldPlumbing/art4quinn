import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from './store';
import Thumbstick from './components/Thumbstick';
import DrawingBoard from './components/DrawingBoard';
import LeftTools from './components/panels/LeftTools';
import RightLayers from './components/panels/RightLayers';
import TopSettings from './components/panels/TopSettings';
import BottomAdjustments from './components/panels/BottomAdjustments';
import { appHistory } from './registry/HistoryManager';
import { Undo2, Redo2, FilePlus, Download, Upload, Trash2, Move, LayoutGrid, ArrowLeft } from 'lucide-react';
import ColorWheelPicker from './components/ColorWheelPicker';
import BrushSettingsPicker from './components/BrushSettingsPicker';
import GalleryFrontPage from './components/GalleryFrontPage';

export default function App() {
  const appMode = useAppStore((state) => state.appMode);
  const setAppMode = useAppStore((state) => state.setAppMode);
  const currentView = useAppStore((state) => state.currentView);
  const setView = useAppStore((state) => state.setView);
  const thumbstickEnabled = useAppStore((state) => state.thumbstickEnabled);
  const canUndo = useAppStore(state => state.canUndo);
  const canRedo = useAppStore(state => state.canRedo);
  const clearCanvas = useAppStore(state => state.clearCanvas);
  const resetView = useAppStore(state => state.resetView);
  
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getOffset = (dir: 'left' | 'right' | 'top' | 'bottom') => {
    const isMobile = windowSize.width < 640;
    const xBase = isMobile ? windowSize.width * 0.65 : 384;
    const yBase = windowSize.height * 0.65;
    if (dir === 'left') return xBase;
    if (dir === 'right') return -xBase;
    if (dir === 'top') return yBase;
    if (dir === 'bottom') return -yBase;
    return 0;
  }

  // Subtle parallax pan for the canvas when a pane opens
  const pipVariants = {
    center: { x: 0, y: 0, filter: 'brightness(1)' },
    left: { x: getOffset('left') * 0.1, y: 0, filter: 'brightness(0.7)' },
    right: { x: getOffset('right') * 0.1, y: 0, filter: 'brightness(0.7)' },
    top: { x: 0, y: getOffset('top') * 0.1, filter: 'brightness(0.7)' },
    bottom: { x: 0, y: getOffset('bottom') * 0.1, filter: 'brightness(0.7)' }
  };

  const panelVariants = {
    hidden: (direction: string) => ({
      x: direction === 'left' ? '-100%' : direction === 'right' ? '100%' : '0%',
      y: direction === 'top' ? '-100%' : direction === 'bottom' ? '100%' : '0%',
      opacity: 0,
    }),
    visible: {
      x: '0%',
      y: '0%',
      opacity: 1,
      transition: { type: 'spring', damping: 25, stiffness: 200 }
    },
    exit: (direction: string) => ({
      x: direction === 'left' ? '-100%' : direction === 'right' ? '100%' : '0%',
      y: direction === 'top' ? '-100%' : direction === 'bottom' ? '100%' : '0%',
      opacity: 0,
    })
  };

  // Prevent default pull-to-refresh and context menu
  useEffect(() => {
    const touchHandler = (e: TouchEvent) => e.preventDefault();
    const contextHandler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('touchmove', touchHandler, { passive: false });
    document.addEventListener('contextmenu', contextHandler);
    return () => {
      document.removeEventListener('touchmove', touchHandler);
      document.removeEventListener('contextmenu', contextHandler);
    };
  }, []);

  // Gesture handling
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let active = false;

    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary) {
        active = false;
        return;
      }
      // Don't intercept thumbstick interactions or tools if already active
      if (e.target instanceof Element && e.target.closest('[data-thumbstick]')) return;
      
      startX = e.clientX;
      startY = e.clientY;
      startTime = Date.now();
      active = true;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!active || !e.isPrimary) return;
      active = false;
      
      const dt = Date.now() - startTime;
      if (dt > 300) return; // Not a swipe, likely dragging/drawing

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dist = Math.hypot(dx, dy);

      if (dist < 40) return; // swipe threshold

      // If we are in center view, only allow swipes that start strictly at the edges
      const isEdgeStart = currentView === 'center';
      const edgeThreshold = 40;
      
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe
        if (dx > 0) {
          // Swipe Right (finger moves right ->)
          if (currentView === 'right') setView('center'); // Push right panel away
          else if (currentView === 'center' && startX < edgeThreshold) setView('left'); // Pull left panel in
        } else {
          // Swipe Left (finger moves left <-)
          if (currentView === 'left') setView('center'); // Push left panel away
          else if (currentView === 'center' && startX > width - edgeThreshold) setView('right'); // Pull right panel in
        }
      } else {
        // Vertical swipe
        if (dy > 0) {
          // Swipe Down (finger moves down v)
          if (currentView === 'top') { /* do nothing, already pulled down */ }
          else if (currentView === 'bottom') setView('center'); // Push bottom panel away
          else if (currentView === 'center' && startY < edgeThreshold) setView('top'); // Pull top panel in
        } else {
          // Swipe Up (finger moves up ^)
          if (currentView === 'bottom') { /* do nothing, already pulled up */ }
          else if (currentView === 'top') setView('center'); // Push top panel away
          else if (currentView === 'center' && startY > height - edgeThreshold) setView('bottom'); // Pull bottom panel in
        }
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, [currentView, setView]);

  if (appMode === 'gallery') {
    return <GalleryFrontPage />;
  }

  return (
    <div className="fixed inset-0 bg-neutral-950 overflow-hidden touch-none select-none text-white font-sans" style={{ perspective: '1200px' }}>
      
      {/* Background patterns if any */}
      <div className="absolute inset-0 z-0 bg-[#09090b]" />

      {/* Dismiss Overlay */}
      {currentView !== 'center' && (
        <div 
          className="absolute inset-0 z-10 cursor-pointer pointer-events-auto" 
          onPointerDown={() => setView('center')} 
        />
      )}

      {/* Panels array */}
      <AnimatePresence custom={'top'}>
        {currentView === 'top' && (
          <motion.div custom={'top'} variants={panelVariants} initial="hidden" animate="visible" exit="exit" className="absolute inset-x-0 top-0 h-[65%] bg-black/40 backdrop-blur-3xl border-b border-white/10 z-20 flex flex-col pt-6 px-4 safe-top shadow-2xl">
            <TopSettings />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence custom={'bottom'}>
        {currentView === 'bottom' && (
          <motion.div custom={'bottom'} variants={panelVariants} initial="hidden" animate="visible" exit="exit" className="absolute inset-x-0 bottom-0 h-[65%] bg-black/40 backdrop-blur-3xl border-t border-white/10 z-20 flex flex-col pb-6 px-4 safe-bottom shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
            <BottomAdjustments />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence custom={'left'}>
        {currentView === 'left' && (
          <motion.div custom={'left'} variants={panelVariants} initial="hidden" animate="visible" exit="exit" className="absolute inset-y-0 left-0 w-[65%] sm:max-w-sm bg-black/40 backdrop-blur-3xl border-r border-white/10 z-20 flex flex-col py-6 px-4 safe-left shadow-2xl">
            <LeftTools />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence custom={'right'}>
        {currentView === 'right' && (
          <motion.div custom={'right'} variants={panelVariants} initial="hidden" animate="visible" exit="exit" className="absolute inset-y-0 right-0 w-[65%] sm:max-w-sm bg-black/40 backdrop-blur-3xl border-l border-white/10 z-20 flex flex-col py-6 px-4 safe-right shadow-2xl">
            <RightLayers />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Canvas PIP View */}
      <motion.div
        className="absolute inset-0 z-0 origin-center pointer-events-none"
        style={{ transformStyle: 'preserve-3d' }}
        variants={pipVariants}
        animate={currentView}
        transition={{ type: "spring", damping: 30, stiffness: 200 }}
      >
        <div className="w-full h-full pointer-events-auto overflow-hidden relative" style={{ transformStyle: 'preserve-3d' }}>
           {currentView !== 'center' && (
             <div 
               className="absolute inset-0 z-50 cursor-pointer pointer-events-auto"
               style={{ transform: 'translateZ(10px)' }}
               onPointerDown={() => setView('center')}
             />
           )}
           <DrawingBoard />
        </div>
      </motion.div>      
      
      {/* Persistent UI overlays on center view */}
      <AnimatePresence>
        {currentView === 'center' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none z-10"
          >
            <div className="flex items-center gap-1.5 p-1.5 bg-[#121214]/60 backdrop-blur-xl rounded-full border border-white/10 pointer-events-auto shadow-2xl">
              <BrushSettingsPicker />
              <div className="w-px h-5 bg-white/10 mx-1" />

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
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${canUndo ? 'text-white hover:bg-white/10' : 'text-white/20 cursor-not-allowed'}`}
                title="Undo"
              >
                <Undo2 className="w-4 h-4" />
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
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${canRedo ? 'text-white hover:bg-white/10' : 'text-white/20 cursor-not-allowed'}`}
                title="Redo"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              
              <div className="w-px h-5 bg-white/10 mx-1" />
              
              <button 
                onClick={() => {
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
                         else if (layer.blendMode === 'Overlay') blend = 'overlay';
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
                }}
                className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                title="Export PNG"
              >
                <Download className="w-4 h-4" />
              </button>
              
              <div className="w-px h-5 bg-white/10 mx-1" />
              
              <ColorWheelPicker />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shared Floating Thumbstick */}
      {thumbstickEnabled && <Thumbstick view={currentView} setView={setView} />}
    </div>
  );
}
