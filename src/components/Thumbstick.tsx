import React, { useRef, useState, useEffect, useCallback } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Maximize } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThumbstickProps {
  view: string;
  setView: (v: any) => void;
}

export default function Thumbstick({ view: currentView, setView }: ThumbstickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const nubRef = useRef<HTMLDivElement>(null);
  
  const [pos, setPos] = useState({ x: 24, y: 0 });
  const modeRef = useRef<'idle' | 'move' | 'flick'>('idle');
  const startRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const lastDragPosRef = useRef({ x: 0, y: 0 });

  const [fancyZone, setFancyZone] = useState<'left' | 'right' | null>(null);
  const [nestledState, setNestledState] = useState<'left' | 'right' | null>(null);
  const nestledRef = useRef<'left' | 'right' | null>(null);

  const setNestled = useCallback((val: 'left' | 'right' | null) => {
    nestledRef.current = val;
    setNestledState(val);
  }, []);

  useEffect(() => {
    setPos({ x: window.innerWidth - 160, y: window.innerHeight - 160 });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = baseRef.current;
    if (!el) return;

    if (nestledRef.current) {
      const wasNestled = nestledRef.current;
      setPos(p => ({
        x: wasNestled === 'left' ? 32 : window.innerWidth - 162,
        y: p.y
      }));
      setNestled(null);
    }

    el.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    offsetRef.current = { x: 0, y: 0 };
    lastDragPosRef.current = { x: e.clientX, y: e.clientY };
    
    if (nubRef.current && nubRef.current.contains(e.target as Node)) {
      modeRef.current = 'flick';
      el.style.transitionProperty = 'background, box-shadow';
    } else {
      modeRef.current = 'move';
      el.style.transitionProperty = 'background, transform, box-shadow';
      el.style.transform = 'scale(1.05)';
      el.style.background = 'rgba(30, 30, 35, 0.8)';
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    }
  }, [setNestled]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (nestledRef.current) return;

    if (modeRef.current === 'move') {
      const dx = e.clientX - lastDragPosRef.current.x;
      const dy = e.clientY - lastDragPosRef.current.y;
      lastDragPosRef.current = { x: e.clientX, y: e.clientY };
      
      setPos(p => {
        const nx = p.x + dx;
        const ny = p.y + dy;
        const cx = nx + 130 / 2;
        if (cx < 24) setFancyZone('left');
        else if (cx > window.innerWidth - 24) setFancyZone('right');
        else setFancyZone(null);
        return { x: nx, y: ny };
      });
    } else if (modeRef.current === 'flick') {
      const MAX = 40;
      let nx = e.clientX - startRef.current.x;
      let ny = e.clientY - startRef.current.y;
      const dist = Math.sqrt(nx*nx + ny*ny);
      if (dist > MAX) {
        nx = (nx / dist) * MAX;
        ny = (ny / dist) * MAX;
      }
      offsetRef.current = { x: nx, y: ny };
      if (nubRef.current) {
        nubRef.current.style.transform = `translate(${nx}px, ${ny}px)`;
      }
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    setFancyZone(null);
    if (nestledRef.current) return;

    const el = baseRef.current;
    if (!el) return;
    if (el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
    
    el.style.background = 'rgba(20, 20, 25, 0.6)';
    el.style.transform = 'scale(1)';

    if (modeRef.current === 'move') {
      el.style.transitionProperty = 'all';
      setFancyZone(null);
      setPos(p => {
        const cx = p.x + 130 / 2;
        let targetY = p.y;
        if (targetY < 24) targetY = 24;
        if (targetY > window.innerHeight - 154) targetY = window.innerHeight - 154;

        if (cx < 24) {
          setTimeout(() => setNestled('left'), 0);
          return { x: -65, y: targetY };
        } else if (cx > window.innerWidth - 24) {
          setTimeout(() => setNestled('right'), 0);
          return { x: window.innerWidth - 65, y: targetY };
        }

        let targetX = p.x;
        if (targetX < 10) targetX = 10;
        if (targetX > window.innerWidth - 140) targetX = window.innerWidth - 140;

        return { x: targetX, y: targetY };
      });
    } else if (modeRef.current === 'flick') {
      el.style.transitionProperty = 'all';
      const absX = Math.abs(offsetRef.current.x);
      const absY = Math.abs(offsetRef.current.y);
      
      if (absX > 20 || absY > 20) {
        if (absX > absY) {
          if (offsetRef.current.x < 0) setView(currentView === 'right' ? 'center' : 'left');
          else setView(currentView === 'left' ? 'center' : 'right');
        } else {
          if (offsetRef.current.y < 0) setView(currentView === 'bottom' ? 'center' : 'top');
          else setView(currentView === 'top' ? 'center' : 'bottom');
        }
      } else {
        setView('center');
      }
    } else if (modeRef.current === 'idle') {
       el.style.transitionProperty = 'all';
       setView('center');
    }
    
    if (nubRef.current) {
      nubRef.current.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
      nubRef.current.style.transform = `translate(0px, 0px)`;
      setTimeout(() => { if (nubRef.current) nubRef.current.style.transition = 'none'; }, 300);
    }
    
    modeRef.current = 'idle';
  }, [setView, setNestled, currentView]);

  const isNestled = nestledState !== null;

  const getLabel = (dir: 'top' | 'bottom' | 'left' | 'right') => {
    if (dir === 'top') {
      if (currentView === 'top') return { text: 'Menu', active: false };
      if (currentView === 'bottom') return { text: 'Canvas', active: true };
      return { text: 'Menu', active: true };
    }
    if (dir === 'bottom') {
      if (currentView === 'bottom') return { text: 'Filters', active: false };
      if (currentView === 'top') return { text: 'Canvas', active: true };
      return { text: 'Filters', active: true };
    }
    if (dir === 'left') {
      if (currentView === 'left') return { text: 'Tools', active: false };
      if (currentView === 'right') return { text: 'Canvas', active: true };
      return { text: 'Tools', active: true };
    }
    if (dir === 'right') {
      if (currentView === 'right') return { text: 'Layers', active: false };
      if (currentView === 'left') return { text: 'Canvas', active: true };
      return { text: 'Layers', active: true };
    }
    return { text: '', active: false };
  };

  const topLabel = getLabel('top');
  const bottomLabel = getLabel('bottom');
  const leftLabel = getLabel('left');
  const rightLabel = getLabel('right');

  const stickSize = 130;

  return (
    <>
      <div 
        className={cn("fixed top-0 bottom-0 left-0 w-8 bg-blue-500/20 transition-opacity pointer-events-none z-40 border-r border-blue-500/30", 
          fancyZone === 'left' ? "opacity-100" : "opacity-0")} 
      />
      <div 
        className={cn("fixed top-0 bottom-0 right-0 w-8 bg-blue-500/20 transition-opacity pointer-events-none z-40 border-l border-blue-500/30", 
          fancyZone === 'right' ? "opacity-100" : "opacity-0")} 
      />

      <div 
        ref={baseRef}
        className="fixed z-50 rounded-full flex touch-none transition-all duration-200 ease-out select-none"
        style={{ 
          width: stickSize, 
          height: stickSize, 
          left: pos.x, 
          top: pos.y, 
          background: isNestled ? 'transparent' : 'rgba(20, 20, 25, 0.6)', 
          backdropFilter: isNestled ? 'none' : 'blur(16px)',
          WebkitBackdropFilter: isNestled ? 'none' : 'blur(16px)',
          border: isNestled ? '1px solid transparent' : '1px solid rgba(255, 255, 255, 0.1)', 
          boxShadow: isNestled ? 'none' : '0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          cursor: isNestled ? 'default' : 'grab',
          pointerEvents: isNestled ? 'none' : 'auto'
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {!isNestled && (
          <>
            <div className={`absolute top-2 left-0 right-0 text-center text-[10px] uppercase font-bold tracking-wider transition-colors ${topLabel.active ? 'text-white/70' : 'text-white/20'}`} style={{ fontSize: Math.max(7, stickSize * 0.075) }}>{topLabel.text}</div>
            <div className={`absolute bottom-2 left-0 right-0 text-center text-[10px] uppercase font-bold tracking-wider transition-colors ${bottomLabel.active ? 'text-white/70' : 'text-white/20'}`} style={{ fontSize: Math.max(7, stickSize * 0.075) }}>{bottomLabel.text}</div>
            <div className={`absolute left-3 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold tracking-wider -rotate-90 transition-colors ${leftLabel.active ? 'text-white/70' : 'text-white/20'}`} style={{ transformOrigin: 'center', fontSize: Math.max(7, stickSize * 0.075) }}>{leftLabel.text}</div>
            <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold tracking-wider rotate-90 transition-colors ${rightLabel.active ? 'text-white/70' : 'text-white/20'}`} style={{ transformOrigin: 'center', fontSize: Math.max(7, stickSize * 0.075) }}>{rightLabel.text}</div>
          </>
        )}

        {currentView !== 'center' && !isNestled && (
          <div className="absolute inset-0 flex items-center justify-center text-white/40 pointer-events-none">
            <Maximize className="w-8 h-8 opacity-50" />
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div 
            ref={nubRef}
            className={cn("bg-white/90 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.8)] border border-white/40 flex items-center justify-center text-indigo-500 font-bold pointer-events-auto",
              isNestled ? "cursor-pointer" : "cursor-grab")}
            style={{ 
               width: stickSize * 0.45,
               height: stickSize * 0.45
            }}
          >
            <div className="rounded-full border-2 border-indigo-500/20 flex flex-col items-center justify-center gap-[2px]" style={{ width: stickSize * 0.25, height: stickSize * 0.25 }}>
              <div className="w-[10%] h-[10%] rounded-full bg-indigo-500/40" />
              <div className="flex gap-[2px]">
                <div className="w-[10%] h-[10%] rounded-full bg-indigo-500/40" />
                <div className="w-[10%] h-[10%] rounded-full bg-indigo-500/80" />
                <div className="w-[10%] h-[10%] rounded-full bg-indigo-500/40" />
              </div>
              <div className="w-[10%] h-[10%] rounded-full bg-indigo-500/40" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
