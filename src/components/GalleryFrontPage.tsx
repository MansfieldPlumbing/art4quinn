import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { Palette, Play, Image as ImageIcon } from 'lucide-react';

interface Asset {
  name: string;
  url: string;
  type: 'image' | 'video';
}

export default function GalleryFrontPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const setAppMode = useAppStore((state) => state.setAppMode);
  const setActiveAssetUrl = useAppStore((state) => state.setActiveAssetUrl);
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null);

  useEffect(() => {
    async function loadAssets() {
      try {
        const res = await fetch('./gallery/lot.csv?t=' + Date.now());
        const text = await res.text();
        const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        
        if (lines[0].toLowerCase() === 'filename') {
          lines.shift();
        }

        const validExtensions = ['.png', '.jpg', '.jpeg', '.mp4', '.webm', '.gif'];
        const valid = lines.filter((file) => validExtensions.some((ext) => file.toLowerCase().endsWith(ext)));
        valid.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));

        const assetList: Asset[] = valid.map((filename) => ({
          name: filename,
          url: `./gallery/${filename}`,
          type: filename.match(/\.(mp4|webm)$/i) ? 'video' : 'image'
        }));

        setAssets(assetList);
      } catch (e) {
        console.error("Failed to load assets", e);
      } finally {
        setLoading(false);
      }
    }
    loadAssets();
  }, []);

  const handleSelectAsset = (url: string) => {
    setActiveAssetUrl(url);
    setAppMode('paint');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', damping: 20, stiffness: 100 } }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-sans overflow-y-auto overflow-x-hidden select-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#39ff1415,transparent_50%)] pointer-events-none" />
      
      <header className="sticky top-0 z-50 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#39ff14] to-[#6a4bff] flex items-center justify-center shadow-[0_0_20px_rgba(57,255,20,0.3)]">
            <Palette className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">FlickPaint <span className="text-[#39ff14] font-light">Q Gallery</span></h1>
            <p className="text-xs text-white/50 font-medium tracking-widest uppercase">Select an asset to paint</p>
          </div>
        </div>
        
        <button 
          onClick={() => handleSelectAsset('./gallery/Q000001.png')} 
          className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium transition-all hover:scale-105 active:scale-95"
        >
          Blank Canvas
        </button>
      </header>

      <main className="max-w-[2000px] mx-auto p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="w-12 h-12 border-4 border-[#39ff14]/20 border-t-[#39ff14] rounded-full animate-spin" />
            <p className="text-[#39ff14] animate-pulse tracking-widest font-mono text-sm">LOADING ASSETS...</p>
          </div>
        ) : (
          <motion.div 
            variants={containerVariants} 
            initial="hidden" 
            animate="show"
            className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-4 sm:gap-6 space-y-4 sm:space-y-6"
          >
            {assets.map((asset) => (
              <motion.div 
                key={asset.name}
                variants={itemVariants}
                className="break-inside-avoid relative group cursor-pointer rounded-2xl overflow-hidden bg-white/5 border border-white/5 shadow-xl transition-all duration-300 hover:shadow-[0_0_40px_rgba(106,75,255,0.2)] hover:-translate-y-1"
                onMouseEnter={() => setHoveredAsset(asset.name)}
                onMouseLeave={() => setHoveredAsset(null)}
                onClick={() => handleSelectAsset(asset.url)}
              >
                <div className="relative w-full overflow-hidden bg-black/50 aspect-auto min-h-[100px]">
                  {asset.type === 'video' ? (
                    <>
                      <video 
                        src={asset.url} 
                        muted 
                        loop 
                        playsInline
                        className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500 group-hover:scale-105"
                        ref={(el) => {
                          if (el) {
                            if (hoveredAsset === asset.name) {
                              el.play().catch(() => {});
                            } else {
                              el.pause();
                            }
                          }
                        }}
                      />
                      <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
                      </div>
                    </>
                  ) : (
                    <>
                      <img 
                        src={asset.url} 
                        alt={asset.name} 
                        loading="lazy"
                        className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-all duration-700 group-hover:scale-105"
                      />
                      <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ImageIcon className="w-4 h-4 text-white/70" />
                      </div>
                    </>
                  )}
                  
                  {/* Paint Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5">
                    <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                      <p className="text-white font-medium truncate mb-2 drop-shadow-md">{asset.name}</p>
                      <div className="flex items-center gap-2">
                        <button className="flex-1 py-2 bg-[#6a4bff] hover:bg-[#7b5cff] text-white rounded-lg text-xs font-bold tracking-wide transition-colors shadow-lg">
                          PAINT
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

