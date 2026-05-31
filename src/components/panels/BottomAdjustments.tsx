import React, { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../../store';
import { 
  Sun, Contrast, SlidersHorizontal, 
  Wand2, Zap, Palette, Droplets, ScanLine, 
  ChevronLeft, Check, X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { appHistory } from '../../registry/HistoryManager';

export default function BottomAdjustments() {
  const activeLayer = useAppStore(state => state.activeLayer);
  const setView = useAppStore(state => state.setView);
  
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const originalImageRef = useRef<ImageData | null>(null);

  // Filter States
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [blur, setBlur] = useState(0);

  // New Filter States
  const [cbRed, setCbRed] = useState(0);
  const [cbGreen, setCbGreen] = useState(0);
  const [cbBlue, setCbBlue] = useState(0);
  
  const [levelsBlack, setLevelsBlack] = useState(0);
  const [levelsWhite, setLevelsWhite] = useState(255);
  const [levelsGamma, setLevelsGamma] = useState(1.0);

  const [noiseAmount, setNoiseAmount] = useState(0);
  
  const [motionBlurAngle, setMotionBlurAngle] = useState(0);
  const [motionBlurDistance, setMotionBlurDistance] = useState(0);
  
  const [liquifyAmount, setLiquifyAmount] = useState(0);

  const adjustmentMenus = [
    { title: "Brightness / Contrast", icon: Sun },
    { title: "Hue / Saturation", icon: Palette },
    { title: "Color Balance", icon: SlidersHorizontal },
    { title: "Levels", icon: Contrast },
  ];

  const filterMenus = [
    { title: "Gaussian Blur", icon: Droplets },
    { title: "Motion Blur", icon: ScanLine },
    { title: "Liquify", icon: Wand2 },
    { title: "Noise", icon: Zap },
  ];

  // Preview / Apply filters
  const updatePreviewFilter = (filterString: string) => {
    const cvs = document.getElementById(`layer-${activeLayer}`) as HTMLCanvasElement;
    if (cvs) {
      cvs.style.filter = filterString;
    }
  };

  const applyPixelEffectToData = useCallback((sourceData: ImageData) => {
    const w = sourceData.width;
    const h = sourceData.height;
    const data = new Uint8ClampedArray(sourceData.data);
    
    if (activeMenu === 'Color Balance') {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.max(0, Math.min(255, data[i] + cbRed));     // R
        data[i+1] = Math.max(0, Math.min(255, data[i+1] + cbGreen)); // G
        data[i+2] = Math.max(0, Math.min(255, data[i+2] + cbBlue));  // B
      }
    } else if (activeMenu === 'Levels') {
      const range = levelsWhite - levelsBlack;
      const safeRange = range === 0 ? 1 : range;
      for (let i = 0; i < data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          let val = data[i+c];
          let norm = (val - levelsBlack) / safeRange;
          norm = Math.max(0, Math.min(1, norm));
          if (levelsGamma !== 1.0) {
            norm = Math.pow(norm, 1.0 / levelsGamma);
          }
          data[i+c] = norm * 255;
        }
      }
    } else if (activeMenu === 'Noise') {
      for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] > 0) {
          const noise = (Math.random() - 0.5) * 2 * noiseAmount;
          data[i] = Math.min(255, Math.max(0, data[i] + noise));
          data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
          data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
        }
      }
    } else if (activeMenu === 'Motion Blur') {
      const angleRad = (motionBlurAngle * Math.PI) / 180;
      const dx = Math.cos(angleRad);
      const dy = Math.sin(angleRad);
      const dist = motionBlurDistance;
      const out = new Uint8ClampedArray(data.length);
      const samples = Math.max(1, Math.floor(dist / 2)); 
      
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          let r = 0, g = 0, b = 0, a = 0;
          let weight = 0;
          for (let s = -samples; s <= samples; s++) {
            const sx = Math.floor(x + dx * s * 2);
            const sy = Math.floor(y + dy * s * 2);
            if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
              const sIdx = (sy * w + sx) * 4;
              r += data[sIdx];
              g += data[sIdx+1];
              b += data[sIdx+2];
              a += data[sIdx+3];
              weight++;
            }
          }
          if (weight > 0) {
            out[idx] = r / weight;
            out[idx+1] = g / weight;
            out[idx+2] = b / weight;
            out[idx+3] = a / weight;
          }
        }
      }
      return new ImageData(out, w, h);
    } else if (activeMenu === 'Liquify') {
      const out = new Uint8ClampedArray(data.length);
      const cx = w / 2;
      const cy = h / 2;
      const maxRadius = Math.min(w, h) * 0.5;
      const amount = liquifyAmount / 100; // -1 to 1
      const twirlAngle = amount * Math.PI * 2;
      
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          let sx = x;
          let sy = y;
          
          if (dist < maxRadius) {
            const percent = (maxRadius - dist) / maxRadius;
            const theta = percent * percent * twirlAngle;
            const sin = Math.sin(theta);
            const cos = Math.cos(theta);
            sx = cx + dx * cos - dy * sin;
            sy = cy + dx * sin + dy * cos;
          }
          
          sx = Math.min(w - 1, Math.max(0, Math.floor(sx)));
          sy = Math.min(h - 1, Math.max(0, Math.floor(sy)));
          
          const srcIdx = (sy * w + sx) * 4;
          const dstIdx = (y * w + x) * 4;
          
          out[dstIdx] = data[srcIdx];
          out[dstIdx+1] = data[srcIdx+1];
          out[dstIdx+2] = data[srcIdx+2];
          out[dstIdx+3] = data[srcIdx+3];
        }
      }
      return new ImageData(out, w, h);
    }

    return new ImageData(data, w, h);
  }, [activeMenu, cbRed, cbGreen, cbBlue, levelsBlack, levelsWhite, levelsGamma, noiseAmount, motionBlurAngle, motionBlurDistance, liquifyAmount]);

  React.useEffect(() => {
    if (activeMenu === 'Brightness / Contrast') {
      updatePreviewFilter(`brightness(${brightness}%) contrast(${contrast}%)`);
    } else if (activeMenu === 'Hue / Saturation') {
      updatePreviewFilter(`hue-rotate(${hue}deg) saturate(${saturation}%)`);
    } else if (activeMenu === 'Gaussian Blur') {
      updatePreviewFilter(`blur(${blur}px)`);
    } else {
      updatePreviewFilter('none');
    }
  }, [brightness, contrast, hue, saturation, blur, activeMenu]);

  React.useEffect(() => {
    const isPixelFilter = ['Color Balance', 'Levels', 'Noise', 'Motion Blur', 'Liquify'].includes(activeMenu || '');
    if (!isPixelFilter) return;

    const cvs = document.getElementById(`layer-${activeLayer}`) as HTMLCanvasElement;
    if (!cvs || !originalImageRef.current) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const finalImgData = applyPixelEffectToData(originalImageRef.current);
    ctx.putImageData(finalImgData, 0, 0);
  }, [activeMenu, activeLayer, applyPixelEffectToData]);

  const applyEffect = () => {
    const cvs = document.getElementById(`layer-${activeLayer}`) as HTMLCanvasElement;
    if (cvs) {
      const ctx = cvs.getContext('2d');
      if (ctx) {
        const isPixelFilter = ['Color Balance', 'Levels', 'Noise', 'Motion Blur', 'Liquify'].includes(activeMenu || '');
        
        if (isPixelFilter && originalImageRef.current) {
          ctx.putImageData(originalImageRef.current, 0, 0);
        }

        const layersList = useAppStore.getState().layers;
        const allCanvases = layersList.map(l => ({
          id: l.id,
          canvas: document.getElementById(`layer-${l.id}`) as HTMLCanvasElement
        })).filter(l => l.canvas);
        appHistory.pushState(allCanvases);

        if (isPixelFilter && originalImageRef.current) {
          const finalImgData = applyPixelEffectToData(originalImageRef.current);
          ctx.putImageData(finalImgData, 0, 0);
        } else {
          const tempCvs = document.createElement('canvas');
          tempCvs.width = cvs.width;
          tempCvs.height = cvs.height;
          const tempCtx = tempCvs.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(cvs, 0, 0);
            ctx.clearRect(0, 0, cvs.width, cvs.height);
            let filterStr = 'none';
            if (activeMenu === 'Brightness / Contrast') {
              filterStr = `brightness(${brightness}%) contrast(${contrast}%)`;
            } else if (activeMenu === 'Hue / Saturation') {
              filterStr = `hue-rotate(${hue}deg) saturate(${saturation}%)`;
            } else if (activeMenu === 'Gaussian Blur') {
              filterStr = `blur(${blur}px)`;
            }
            ctx.filter = filterStr;
            ctx.drawImage(tempCvs, 0, 0);
            ctx.filter = 'none';
          }
        }
      }
      cvs.style.filter = 'none';
    }
    
    setActiveMenu(null);
    originalImageRef.current = null;
    setView('center');
    
    setBrightness(100); setContrast(100); setHue(0); setSaturation(100); setBlur(0);
    setCbRed(0); setCbGreen(0); setCbBlue(0);
    setLevelsBlack(0); setLevelsWhite(255); setLevelsGamma(1.0);
    setNoiseAmount(0);
    setMotionBlurAngle(0); setMotionBlurDistance(0);
    setLiquifyAmount(0);
  };

  const cancelEffect = () => {
    updatePreviewFilter('none');
    
    const cvs = document.getElementById(`layer-${activeLayer}`) as HTMLCanvasElement;
    if (cvs && originalImageRef.current) {
      const ctx = cvs.getContext('2d');
      if (ctx) ctx.putImageData(originalImageRef.current, 0, 0);
    }
    
    setActiveMenu(null);
    originalImageRef.current = null;
    
    setBrightness(100); setContrast(100); setHue(0); setSaturation(100); setBlur(0);
    setCbRed(0); setCbGreen(0); setCbBlue(0);
    setLevelsBlack(0); setLevelsWhite(255); setLevelsGamma(1.0);
    setNoiseAmount(0);
    setMotionBlurAngle(0); setMotionBlurDistance(0);
    setLiquifyAmount(0);
  };

  const openPanel = (title: string) => { 
    const cvs = document.getElementById(`layer-${activeLayer}`) as HTMLCanvasElement;
    if (cvs) {
      const ctx = cvs.getContext('2d');
      if (ctx) originalImageRef.current = ctx.getImageData(0, 0, cvs.width, cvs.height);
    }
    setActiveMenu(title); 
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full overflow-hidden text-xs relative">
      <AnimatePresence>
        {!activeMenu ? (
          <motion.div 
            initial={{ x: -20, opacity: 0 }} 
            animate={{ x: 0, opacity: 1 }} 
            exit={{ x: -20, opacity: 0 }}
            className="flex-1 flex flex-col h-full overflow-hidden absolute inset-0 pb-6"
          >
            <h2 className="text-sm font-bold text-white/70 tracking-widest uppercase mb-4 mt-2">Filters</h2>
            
            <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
              <div className="flex flex-col gap-2">
                <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-wider pl-1">Adjust</h3>
                <div className="space-y-1">
                  {adjustmentMenus.map((adj, i) => (
                    <button onClick={() => openPanel(adj.title)} key={i} className="w-full flex items-center gap-3 px-3 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/80 transition-colors">
                      <adj.icon className="w-4 h-4 text-white/50" />
                      <span>{adj.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-wider pl-1">Filters</h3>
                <div className="space-y-1">
                   {filterMenus.map((flt, i) => (
                    <button onClick={() => openPanel(flt.title)} key={i} className="w-full flex items-center gap-3 px-3 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/80 transition-colors">
                      <flt.icon className="w-4 h-4 text-white/50" />
                      <span>{flt.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ x: 20, opacity: 0 }} 
            animate={{ x: 0, opacity: 1 }} 
            exit={{ x: 20, opacity: 0 }}
            className="flex-1 flex flex-col h-full absolute inset-0 pb-6"
          >
            <div className="flex items-center gap-3 mb-6 mt-2">
              <button onClick={cancelEffect} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-bold text-white tracking-widest uppercase">{activeMenu}</h2>
            </div>

            <div className="flex-1 space-y-6 px-2 overflow-y-auto custom-scrollbar">
              {activeMenu === 'Brightness / Contrast' && (
                <>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-white/70 font-medium">Brightness</span>
                      <span className="text-indigo-400 font-mono">{brightness}%</span>
                    </div>
                    <input type="range" min="0" max="200" value={brightness} onChange={e => setBrightness(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-white/70 font-medium">Contrast</span>
                      <span className="text-indigo-400 font-mono">{contrast}%</span>
                    </div>
                    <input type="range" min="0" max="200" value={contrast} onChange={e => setContrast(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                </>
              )}

              {activeMenu === 'Hue / Saturation' && (
                <>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-white/70 font-medium">Hue</span>
                      <span className="text-indigo-400 font-mono">{hue}°</span>
                    </div>
                    <input type="range" min="-180" max="180" value={hue} onChange={e => setHue(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-white/70 font-medium">Saturation</span>
                      <span className="text-indigo-400 font-mono">{saturation}%</span>
                    </div>
                    <input type="range" min="0" max="200" value={saturation} onChange={e => setSaturation(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                </>
              )}

              {activeMenu === 'Gaussian Blur' && (
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-white/70 font-medium">Radius</span>
                    <span className="text-indigo-400 font-mono">{blur}px</span>
                  </div>
                  <input type="range" min="0" max="50" value={blur} onChange={e => setBlur(Number(e.target.value))} className="w-full accent-indigo-500" />
                </div>
              )}

              {activeMenu === 'Color Balance' && (
                <>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-white/70 font-medium">Red</span>
                      <span className="text-indigo-400 font-mono">{cbRed}</span>
                    </div>
                    <input type="range" min="-100" max="100" value={cbRed} onChange={e => setCbRed(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-white/70 font-medium">Green</span>
                      <span className="text-indigo-400 font-mono">{cbGreen}</span>
                    </div>
                    <input type="range" min="-100" max="100" value={cbGreen} onChange={e => setCbGreen(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-white/70 font-medium">Blue</span>
                      <span className="text-indigo-400 font-mono">{cbBlue}</span>
                    </div>
                    <input type="range" min="-100" max="100" value={cbBlue} onChange={e => setCbBlue(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                </>
              )}

              {activeMenu === 'Levels' && (
                <>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-white/70 font-medium">Black Point</span>
                      <span className="text-indigo-400 font-mono">{levelsBlack}</span>
                    </div>
                    <input type="range" min="0" max="255" value={levelsBlack} onChange={e => setLevelsBlack(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-white/70 font-medium">White Point</span>
                      <span className="text-indigo-400 font-mono">{levelsWhite}</span>
                    </div>
                    <input type="range" min="0" max="255" value={levelsWhite} onChange={e => setLevelsWhite(Math.max(levelsBlack + 1, Number(e.target.value)))} className="w-full accent-indigo-500" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-white/70 font-medium">Gamma</span>
                      <span className="text-indigo-400 font-mono">{levelsGamma.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0.1" max="3.0" step="0.1" value={levelsGamma} onChange={e => setLevelsGamma(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                </>
              )}

              {activeMenu === 'Noise' && (
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-white/70 font-medium">Amount</span>
                    <span className="text-indigo-400 font-mono">{noiseAmount}</span>
                  </div>
                  <input type="range" min="0" max="255" value={noiseAmount} onChange={e => setNoiseAmount(Number(e.target.value))} className="w-full accent-indigo-500" />
                </div>
              )}

              {activeMenu === 'Motion Blur' && (
                <>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-white/70 font-medium">Angle</span>
                      <span className="text-indigo-400 font-mono">{motionBlurAngle}°</span>
                    </div>
                    <input type="range" min="0" max="360" value={motionBlurAngle} onChange={e => setMotionBlurAngle(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-white/70 font-medium">Distance</span>
                      <span className="text-indigo-400 font-mono">{motionBlurDistance}px</span>
                    </div>
                    <input type="range" min="0" max="100" value={motionBlurDistance} onChange={e => setMotionBlurDistance(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                </>
              )}

              {activeMenu === 'Liquify' && (
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-white/70 font-medium">Twirl Amount</span>
                    <span className="text-indigo-400 font-mono">{liquifyAmount}</span>
                  </div>
                  <input type="range" min="-100" max="100" value={liquifyAmount} onChange={e => setLiquifyAmount(Number(e.target.value))} className="w-full accent-indigo-500" />
                </div>
              )}

            </div>

            <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
              <button onClick={cancelEffect} className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={applyEffect} className="flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20">
                <Check className="w-4 h-4" /> Apply
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

