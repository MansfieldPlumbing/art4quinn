import React, { useRef, useEffect, useState } from 'react';
import { motion, useMotionValue } from 'motion/react';
import { useGesture } from '@use-gesture/react';
import { useAppStore } from '../store';
import { ToolRegistry } from '../registry/ToolRegistry';
import '../registry/tools/index';
import { appHistory } from '../registry/HistoryManager';

export default function DrawingBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const store = useAppStore();
  const { tool, color, brushSize, opacity, triggerClearCounter, triggerResetViewCounter, layers, activeLayer, activeAssetUrl } = store;

  const getActiveCanvas = () => {
    return document.getElementById(`layer-${activeLayer}`) as HTMLCanvasElement | null;
  };

  // Transform states
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useMotionValue(0);

  // Drawing state
  const isDrawing = useRef(false);

  useEffect(() => {
    if (triggerResetViewCounter > 0) {
      const initScale = Math.min((window.innerWidth * 0.9) / 1080, (window.innerHeight * 0.8) / 1080);
      scale.set(initScale);
      rotate.set(0);
      x.set((window.innerWidth - 1080 * initScale) / 2);
      y.set((window.innerHeight - 1080 * initScale) / 2);
    }
  }, [triggerResetViewCounter]);

  useEffect(() => {
    let isMounted = true;
    
    // Load a sample mockup image to paint over into background layer
    const bgCanvas = document.getElementById('layer-2') as HTMLCanvasElement;
    if (bgCanvas) {
      const ctx = bgCanvas.getContext('2d');
      if (ctx) {
        const srcUrl = activeAssetUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1080&h=1080&auto=format&fit=crop';
        
        if (srcUrl.match(/\.(mp4|webm)$/i)) {
          // It's a video, let's draw the first frame or keep it playing
          const video = document.createElement('video');
          video.src = srcUrl;
          video.muted = true;
          video.autoplay = true;
          video.loop = true;
          video.playsInline = true;
          video.crossOrigin = 'anonymous';
          
          video.onloadeddata = () => {
             if (!isMounted) return;
             // Draw first frame
             ctx.drawImage(video, 0, 0, bgCanvas.width, bgCanvas.height);
             
             // Keep drawing video on raf if we want a live background (optional, but cool)
             const drawFrame = () => {
                if (!isMounted) return;
                ctx.drawImage(video, 0, 0, bgCanvas.width, bgCanvas.height);
                requestAnimationFrame(drawFrame);
             };
             drawFrame();

             const allCanvases = store.layers.map(l => ({
               id: l.id,
               canvas: document.getElementById(`layer-${l.id}`) as HTMLCanvasElement
             })).filter(l => l.canvas);
             appHistory.pushState(allCanvases);
          };
        } else {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = srcUrl;
          img.onload = () => {
          if (!isMounted) return;
          ctx.drawImage(img, 0, 0, bgCanvas.width, bgCanvas.height);
          
          const allCanvases = store.layers.map(l => ({
            id: l.id,
            canvas: document.getElementById(`layer-${l.id}`) as HTMLCanvasElement
          })).filter(l => l.canvas);
          appHistory.pushState(allCanvases);
        };
        }
      }
    }

    // center the canvas initially
    const initScale = Math.min((window.innerWidth * 0.9) / 1080, (window.innerHeight * 0.8) / 1080);
    scale.set(initScale);
    x.set((window.innerWidth - 1080 * initScale) / 2);
    y.set((window.innerHeight - 1080 * initScale) / 2);
    
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (triggerClearCounter > 0) {
       layers.forEach(layer => {
         const cvs = document.getElementById(`layer-${layer.id}`) as HTMLCanvasElement;
         if (cvs) {
           const ctx = cvs.getContext('2d');
           if (ctx) ctx.clearRect(0, 0, cvs.width, cvs.height);
         }
       });
       
       const allCanvases = layers.map(l => ({
         id: l.id,
         canvas: document.getElementById(`layer-${l.id}`) as HTMLCanvasElement
       })).filter(l => l.canvas);
       appHistory.pushState(allCanvases);
    }
  }, [triggerClearCounter]);

  const getCanvasPoint = (e: any) => {
    let clientX = 0;
    let clientY = 0;
    let pressure = e.pressure || 1;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
      pressure = e.touches[0].force || 1;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
      pressure = e.changedTouches[0].force || 1;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    
    const dx_s = (clientX - rect.left) - x.get();
    const dy_s = (clientY - rect.top) - y.get();

    const r = rotate.get() * (Math.PI / 180);
    const s = scale.get();

    return {
      x: (dx_s * Math.cos(r) + dy_s * Math.sin(r)) / s,
      y: (-dx_s * Math.sin(r) + dy_s * Math.cos(r)) / s,
      pressure
    };
  };

  const getToolContext = () => {
    const layerDef = layers.find(l => l.id === activeLayer);
    const canvas = getActiveCanvas();
    if (!layerDef || layerDef.locked || !layerDef.visible || !canvas) return null;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    return {
      canvas,
      ctx,
      transform: { x: x.get(), y: y.get(), scale: scale.get() },
      color,
      size: brushSize,
      opacity,
      pushUndoState: () => {
        const allCanvases = layers.map(l => ({
          id: l.id,
          canvas: document.getElementById(`layer-${l.id}`) as HTMLCanvasElement
        })).filter(l => l.canvas);
        appHistory.pushState(allCanvases);
      },
      commit: () => {}
    };
  };

  const pointersRef = useRef<Map<number, any>>(new Map());
  const initialPinchDist = useRef<number | null>(null);
  const initialScale = useRef(1);
  const initialPan = useRef({ x: 0, y: 0 });
  const initialPinchCenter = useRef({ x: 0, y: 0 });
  
  const initialRotate = useRef(0);
  const initialAngle = useRef(0);

  // Setup pointers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // If starting on the edge, ignore for drawing to let swipe take over
    const edge = 40;
    if (pointersRef.current.size === 0 && (e.clientX < edge || e.clientX > window.innerWidth - edge ||
        e.clientY < edge || e.clientY > window.innerHeight - edge)) {
       return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, e.nativeEvent);

    if (pointersRef.current.size === 1) {
      isDrawing.current = true;
      const pt = getCanvasPoint(e.nativeEvent);
      
      const tCtx = getToolContext();
      if (tCtx) {
        const activeTool = ToolRegistry.getTool(tool);
        if (activeTool?.onPointerDown) activeTool.onPointerDown(pt, tCtx);
      }
    } else if (pointersRef.current.size === 2) {
      isDrawing.current = false;
      const pts = Array.from(pointersRef.current.values()) as any[];
      
      const dx = pts[1].clientX - pts[0].clientX;
      const dy = pts[1].clientY - pts[0].clientY;
      const dist = Math.hypot(dx, dy);
      
      initialPinchDist.current = dist;
      initialScale.current = scale.get();
      initialPan.current = { x: x.get(), y: y.get() };
      initialRotate.current = rotate.get();
      initialAngle.current = Math.atan2(dy, dx);

      initialPinchCenter.current = {
        x: (pts[0].clientX + pts[1].clientX) / 2,
        y: (pts[0].clientY + pts[1].clientY) / 2
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    
    // Update pointer maps
    pointersRef.current.set(e.pointerId, e.nativeEvent);

    if (pointersRef.current.size === 1 && isDrawing.current) {
      const pt = getCanvasPoint(e.nativeEvent);
      const tCtx = getToolContext();
      if (tCtx) {
        const activeTool = ToolRegistry.getTool(tool);
        if (activeTool?.onPointerMove) activeTool.onPointerMove(pt, tCtx);
      }
    } else if (pointersRef.current.size === 2 && initialPinchDist.current !== null) {
      // Pan, Zoom & Rotate
      const pts = Array.from(pointersRef.current.values()) as any[];
      const dx = pts[1].clientX - pts[0].clientX;
      const dy = pts[1].clientY - pts[0].clientY;
      const dist = Math.hypot(dx, dy);
      
      const deltaScale = dist / initialPinchDist.current;
      const newScale = Math.max(0.05, Math.min(10, initialScale.current * deltaScale));
      scale.set(newScale);

      const angle = Math.atan2(dy, dx);
      const deltaAngle = angle - initialAngle.current;
      const newRotateRads = initialRotate.current * (Math.PI / 180) + deltaAngle;
      rotate.set(newRotateRads * (180 / Math.PI));

      const currentCenter = {
        x: (pts[0].clientX + pts[1].clientX) / 2,
        y: (pts[0].clientY + pts[1].clientY) / 2
      };

      // Math for pan with origin 0,0 and arbitrary rotation/scale
      const r0 = initialRotate.current * (Math.PI / 180);
      const s0 = initialScale.current;
      const sx0 = initialPinchCenter.current.x;
      const sy0 = initialPinchCenter.current.y;
      const x0 = initialPan.current.x;
      const y0 = initialPan.current.y;
      
      const rx0 = (sx0 - x0) / s0;
      const ry0 = (sy0 - y0) / s0;
      
      const cx = rx0 * Math.cos(r0) + ry0 * Math.sin(r0);
      const cy = -rx0 * Math.sin(r0) + ry0 * Math.cos(r0);

      const rm = newRotateRads;
      const sm = newScale;
      
      const newX = currentCenter.x - sm * (cx * Math.cos(rm) - cy * Math.sin(rm));
      const newY = currentCenter.y - sm * (cx * Math.sin(rm) + cy * Math.cos(rm));

      x.set(newX);
      y.set(newY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    pointersRef.current.delete(e.pointerId);

    if (pointersRef.current.size === 0 && isDrawing.current) {
      isDrawing.current = false;
      initialPinchDist.current = null;
      
      const pt = getCanvasPoint(e.nativeEvent);
      const tCtx = getToolContext();
      if (tCtx) {
        const activeTool = ToolRegistry.getTool(tool);
        if (activeTool?.onPointerUp) activeTool.onPointerUp(pt, tCtx);
      }
    } else if (pointersRef.current.size === 1) {
      // back to 1 finger - can continue drawing? Better to wait for next down.
      isDrawing.current = false; 
    }
  };

  const activeCursor = ToolRegistry.getTool(tool)?.cursor || 'crosshair';

  return (
    <div 
      className="absolute inset-0 overflow-hidden bg-transparent touch-none select-none" 
      style={{ cursor: activeCursor }}
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <motion.div
        style={{ 
          x, 
          y, 
          scale, 
          rotate,
          transformOrigin: '0 0',
          transformStyle: 'preserve-3d'
        }}
        className="absolute top-0 left-0 touch-none w-0 h-0"
      >
        {/* Infinite Pasteboard - Pushed back in Z-Space for Parallax */}
        <div 
          className="absolute pointer-events-none"
          style={{
             top: -25000, 
             left: -25000, 
             width: 50000, 
             height: 50000,
             transform: 'translateZ(-400px)',
             backgroundImage: 'linear-gradient(45deg, #18181b 25%, transparent 25%, transparent 75%, #18181b 75%, #18181b), linear-gradient(45deg, #18181b 25%, transparent 25%, transparent 75%, #18181b 75%, #18181b)',
             backgroundSize: '40px 40px',
             backgroundPosition: '0 0, 20px 20px'
          }}
        />

        {/* Artboard Container - Z=0 plane */}
        <div 
          className="absolute top-0 left-0 shadow-[0_0_100px_rgba(0,0,0,0.5),_0_0_40px_rgba(0,0,0,0.3)] touch-none ring-1 ring-white/20"
          style={{
            width: 1080,
            height: 1080,
            transform: 'translateZ(0px)',
            backgroundColor: '#ffffff',
            backgroundImage: 'linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 75%, #e5e5e5 75%, #e5e5e5), linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 75%, #e5e5e5 75%, #e5e5e5)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 10px 10px'
          }}
        >
          {[...layers].reverse().map(layer => (
            <canvas
              key={layer.id}
              id={`layer-${layer.id}`}
              width={1080}
              height={1080}
              className="absolute inset-0 pointer-events-none"
              style={{
                display: layer.visible ? 'block' : 'none',
                opacity: layer.opacity / 100,
                mixBlendMode: layer.blendMode === 'Normal' ? 'normal' : 
                               layer.blendMode === 'Multiply' ? 'multiply' : 
                               layer.blendMode === 'Screen' ? 'screen' : 
                               layer.blendMode === 'Overlay' ? 'overlay' : 
                               layer.blendMode === 'Dodge' ? 'color-dodge' : 
                               layer.blendMode === 'Burn' ? 'color-burn' : 'normal',
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
