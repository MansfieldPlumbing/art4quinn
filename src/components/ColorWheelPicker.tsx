import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { Pipette } from 'lucide-react';

// Convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Convert Hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export default function ColorWheelPicker() {
  const currentHex = useAppStore(state => state.color);
  const setColor = useAppStore(state => state.setColor);
  const currentTool = useAppStore(state => state.tool);
  const setTool = useAppStore(state => state.setTool);
  
  const [isOpen, setIsOpen] = useState(false);
  const [hsl, setHsl] = useState(() => hexToHsl(currentHex));
  
  // Sync state if color changes externally
  useEffect(() => {
    if (!isOpen) {
      setHsl(hexToHsl(currentHex));
    }
  }, [currentHex, isOpen]);

  const wheelRef = useRef<HTMLDivElement>(null);
  const lightnessRef = useRef<HTMLDivElement>(null);

  const handleWheelPointer = (e: React.PointerEvent | PointerEvent) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    
    // Angle determines hue
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    
    // Distance determines saturation
    const radius = rect.width / 2;
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), radius);
    const saturation = (distance / radius) * 100;
    
    const newHsl = { ...hsl, h: Math.round(angle), s: Math.round(saturation) };
    setHsl(newHsl);
    setColor(hslToHex(newHsl.h, newHsl.s, newHsl.l));
  };

  const handleLightnessPointer = (e: React.PointerEvent | PointerEvent) => {
    if (!lightnessRef.current) return;
    const rect = lightnessRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const lightness = Math.round((x / rect.width) * 100);
    
    const newHsl = { ...hsl, l: lightness };
    setHsl(newHsl);
    setColor(hslToHex(newHsl.h, newHsl.s, newHsl.l));
  };

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
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-8 h-8 rounded-full border-2 border-white/20 shadow-inner overflow-hidden transition-transform active:scale-95"
          style={{ backgroundColor: currentHex }}
          title="Pick Color"
        />
        <button
          onClick={() => setTool('picker')}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${currentTool === 'picker' ? 'bg-white text-black scale-110 shadow-lg shadow-white/20' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
          title="Eyedropper"
        >
          <Pipette className="w-4 h-4" />
        </button>
      </div>

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
              className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e24] p-4 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center gap-4"
              style={{ width: '220px' }}
            >
              <div 
                ref={wheelRef}
                className="w-40 h-40 rounded-full relative cursor-crosshair shadow-inner"
                style={{
                  background: `
                    radial-gradient(circle closest-side, #ffffff, transparent),
                    conic-gradient(from 90deg, red, yellow, lime, aqua, blue, magenta, red)
                  `
                }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  handleWheelPointer(e);
                }}
                onPointerMove={(e) => {
                  if (e.buttons > 0) handleWheelPointer(e);
                }}
              >
                {/* Wheel knob */}
                <div 
                  className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none -ml-2 -mt-2 bg-transparent"
                  style={{
                    left: `${50 + (hsl.s / 100) * 50 * Math.cos((hsl.h - 90) * Math.PI / 180)}%`,
                    top: `${50 + (hsl.s / 100) * 50 * Math.sin((hsl.h - 90) * Math.PI / 180)}%`,
                  }}
                />
              </div>

              {/* Lightness Slider */}
              <div 
                ref={lightnessRef}
                className="w-40 h-6 rounded-full relative cursor-ew-resize shadow-inner overflow-hidden"
                style={{
                  background: `linear-gradient(to right, #000000, hsl(${hsl.h}, ${hsl.s}%, 50%), #ffffff)`
                }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  handleLightnessPointer(e);
                }}
                onPointerMove={(e) => {
                  if (e.buttons > 0) handleLightnessPointer(e);
                }}
              >
                <div 
                  className="absolute w-6 h-6 rounded-full border-2 border-white shadow-md pointer-events-none -ml-3 bg-transparent"
                  style={{
                    left: `${hsl.l}%`,
                    top: 0
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
