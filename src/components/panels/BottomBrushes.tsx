import React from 'react';
import { useAppStore } from '../../store';
import { Paintbrush, Eraser, Fingerprint, Waves, Target, PenTool, Sparkles } from 'lucide-react';

export default function BottomBrushes() {
  const { color, setColor, brushSize, setBrushSize, opacity, setOpacity } = useAppStore();

  const colors = [
    '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308', 
    '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#6366f1', 
    '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e'
  ];

  const brushes = [
    { name: 'Basic Round', icon: Paintbrush, id: 'round' },
    { name: 'Soft Edge', icon: Waves, id: 'soft' },
    { name: 'Ink Pen', icon: PenTool, id: 'ink' },
    { name: 'Airbrush', icon: Sparkles, id: 'air' },
    { name: 'Kneaded Eraser', icon: Eraser, id: 'eraser' },
    { name: 'Smudge Blender', icon: Fingerprint, id: 'smudge' },
    { name: 'Target Details', icon: Target, id: 'detail' },
  ];

  return (
    <div className="flex-1 flex flex-col justify-end w-full h-full pb-2 text-xs">
      <h2 className="text-sm font-bold text-white/70 uppercase tracking-widest mb-4">Brush Engine</h2>
      
      <div className="flex flex-col gap-4">
        
        {/* Brush Selector Grid */}
        <div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {brushes.map((b, i) => (
              <button key={b.id} className={`shrink-0 flex flex-col items-center justify-center p-2 rounded-xl border transition-colors ${i === 0 ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-white/5 border-transparent text-white/60 hover:bg-white/10'}`}>
                <b.icon className="w-5 h-5 mb-1" />
                <span className="text-[9px] w-14 truncate text-center block">{b.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dense Parameters */}
        <div className="p-3 bg-black/20 rounded-xl border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          
          <div className="flex items-center gap-3">
            <span className="text-white/50 w-12 font-medium">Size</span>
            <input
              type="range"
              min="1"
              max="200"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none accent-indigo-500"
            />
            <span className="text-white/80 w-8 text-right font-mono text-[10px]">{brushSize}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-white/50 w-12 font-medium">Opacity</span>
            <input
              type="range"
              min="1"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(parseInt(e.target.value))}
              className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none accent-indigo-500"
            />
            <span className="text-white/80 w-8 text-right font-mono text-[10px]">{opacity}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-white/50 w-12 font-medium">Flow</span>
            <input
              type="range"
              min="1"
              max="100"
              defaultValue={100}
              className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none accent-indigo-500"
            />
            <span className="text-white/80 w-8 text-right font-mono text-[10px]">100</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-white/50 w-12 font-medium">Spacing</span>
            <input
              type="range"
              min="1"
              max="200"
              defaultValue={10}
              className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none accent-indigo-500"
            />
            <span className="text-white/80 w-8 text-right font-mono text-[10px]">10</span>
          </div>

        </div>

        {/* Colors Grid */}
        <div className="bg-black/20 p-3 rounded-xl border border-white/5">
          <div className="flex gap-1.5 overflow-x-auto pb-1 items-center">
            {colors.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full shrink-0 border-2 transition-transform ${color === c ? 'border-indigo-400 scale-110 shadow-lg' : 'border-black/50 hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="w-px h-6 bg-white/20 mx-2 shrink-0" />
            <button className="w-7 h-7 rounded-full shrink-0 border-2 border-white/20 flex items-center justify-center bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)] hover:scale-110 transition-transform" />
          </div>
        </div>

      </div>
    </div>
  );
}
