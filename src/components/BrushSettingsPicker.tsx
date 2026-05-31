import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { Paintbrush } from 'lucide-react';

export default function BrushSettingsPicker() {
  const brushSize = useAppStore(state => state.brushSize);
  const setBrushSize = useAppStore(state => state.setBrushSize);
  const opacity = useAppStore(state => state.opacity);
  const setOpacity = useAppStore(state => state.setOpacity);
  
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleGlobalUp = () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      document.body.style.userSelect = '';
    };
    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${isOpen ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
        title="Brush Settings"
      >
        <Paintbrush className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e24] p-4 rounded-3xl border border-white/10 shadow-2xl flex flex-col gap-4 text-xs font-sans text-white/80"
              style={{ width: '220px' }}
            >
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                  <span className="font-medium">Size</span>
                  <span className="text-white/40">{brushSize}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="200"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none accent-indigo-500 cursor-ew-resize"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                  <span className="font-medium">Opacity</span>
                  <span className="text-white/40">{opacity}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={opacity}
                  onChange={(e) => setOpacity(parseInt(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none accent-indigo-500 cursor-ew-resize"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
