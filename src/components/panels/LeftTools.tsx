import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { Layout, Model, TabNode, IJsonModel } from 'flexlayout-react';
import 'flexlayout-react/style/dark.css';
import { 
  MousePointer2, Move, Type, Crop, Wand2, Scissors, 
  PenTool, Eraser as EraserIcon, PaintBucket, Pipette, 
  Brush as BrushIcon, Highlighter, Pencil, Focus, Droplets, Droplet, 
  Flame, Sun, Contrast, Square, Circle, Triangle, Scan,
  Paintbrush, Eraser, Fingerprint, Waves, Target, Sparkles
} from 'lucide-react';

const ToolsGroup = () => {
  const { tool, setTool } = useAppStore();

  const toolCategories = [
    {
      title: 'Select',
      tools: [
        { id: 'move', icon: Move, label: 'Move' },
        { id: 'select', icon: MousePointer2, label: 'Select' },
        { id: 'lasso', icon: Scissors, label: 'Lasso' },
        { id: 'magic', icon: Wand2, label: 'Magic Wand' },
        { id: 'crop', icon: Crop, label: 'Crop' },
      ]
    },
    {
      title: 'Paint',
      tools: [
        { id: 'brush', icon: BrushIcon, label: 'Brush' },
        { id: 'pencil', icon: Pencil, label: 'Pencil' },
        { id: 'pen', icon: PenTool, label: 'Pen' },
        { id: 'marker', icon: Highlighter, label: 'Marker' },
        { id: 'eraser', icon: EraserIcon, label: 'Eraser' },
        { id: 'fill', icon: PaintBucket, label: 'Fill' },
        { id: 'gradient', icon: Scan, label: 'Gradient' },
        { id: 'picker', icon: Pipette, label: 'Picker' },
      ]
    },
    {
      title: 'Retouch',
      tools: [
        { id: 'blur', icon: Droplets, label: 'Blur' },
        { id: 'smudge', icon: Droplet, label: 'Smudge' },
        { id: 'sharpen', icon: Focus, label: 'Sharpen' },
        { id: 'dodge', icon: Sun, label: 'Dodge' },
        { id: 'burn', icon: Flame, label: 'Burn' },
        { id: 'contrast', icon: Contrast, label: 'Contrast' },
      ]
    },
    {
      title: 'Vector',
      tools: [
        { id: 'text', icon: Type, label: 'Text' },
        { id: 'rect', icon: Square, label: 'Rectangle' },
        { id: 'ellipse', icon: Circle, label: 'Ellipse' },
        { id: 'poly', icon: Triangle, label: 'Polygon' },
      ]
    }
  ];

  return (
    <div className="h-full overflow-y-auto p-3 space-y-4 text-xs touch-pan-y overscroll-contain">
      {toolCategories.map((cat, i) => (
        <div key={i} className="space-y-2">
          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-wider pl-1">{cat.title}</h3>
          <div className="grid grid-cols-4 gap-1">
            {cat.tools.map(t => {
              const isActive = tool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id as any)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
                    isActive 
                      ? 'bg-white text-black scale-105 shadow-[0_0_10px_rgba(255,255,255,0.3)] z-10' 
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                  }`}
                  title={t.label}
                >
                  <t.icon className={`w-5 h-5 ${isActive ? 'opacity-100' : 'opacity-70'}`} strokeWidth={isActive ? 2.5 : 2} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const BrushesGroup = () => {
  const { brushSize, setBrushSize, opacity, setOpacity, tool, setTool } = useAppStore();

  const brushes = [
    { name: 'Basic Round', icon: Paintbrush, id: 'brush' },
    { name: 'Soft Edge', icon: Waves, id: 'soft' },
    { name: 'Ink Pen', icon: PenTool, id: 'ink' },
    { name: 'Airbrush', icon: Sparkles, id: 'air' },
    { name: 'Kneaded Eraser', icon: Eraser, id: 'eraser' },
    { name: 'Magic Eraser', icon: Sparkles, id: 'magic_eraser' },
    { name: 'Smudge Blender', icon: Fingerprint, id: 'smudge' },
    { name: 'Target Details', icon: Target, id: 'detail' },
  ];

  return (
    <div className="h-full overflow-y-auto p-3 text-xs w-full flex flex-col gap-4 touch-pan-y overscroll-contain">
      <div className="flex flex-wrap gap-2">
        {brushes.map((b, i) => {
          const isActive = tool === b.id;
          return (
            <button 
              key={b.id} 
              onClick={() => setTool(b.id as any)}
              className={`shrink-0 flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 ${isActive ? 'bg-white text-black scale-105 shadow-[0_0_10px_rgba(255,255,255,0.3)] border-transparent z-10' : 'bg-white/5 border-transparent text-white/60 hover:bg-white/10'}`}>
              <b.icon className="w-5 h-5 mb-1" />
              <span className="text-[9px] w-14 truncate text-center block">{b.name}</span>
            </button>
          );
        })}
      </div>

      <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-4">
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
        </div>
      </div>
    </div>
  );
};

const ColorGroup = () => {
  const { color, setColor } = useAppStore();

  const colors = [
    '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308', 
    '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#6366f1', 
    '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e'
  ];

  return (
    <div className="h-full overflow-y-auto p-3 text-xs w-full touch-pan-y overscroll-contain">
      <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-wrap gap-2">
        {colors.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-7 h-7 rounded-full shrink-0 border-2 transition-transform ${color === c ? 'border-indigo-400 scale-110 shadow-lg z-10' : 'border-black/50 hover:scale-110'}`}
            style={{ backgroundColor: c }}
          />
        ))}
        <button className="w-7 h-7 rounded-full shrink-0 border-2 border-white/20 flex items-center justify-center bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)] hover:scale-110 transition-transform" />
      </div>
    </div>
  );
};

const defaultLayout: IJsonModel = {
  global: {
    tabEnableClose: false,
    tabEnableRename: false,
    enableEdgeDock: true,
    tabSetEnableMaximize: false,
  },
  layout: {
    type: "row",
    weight: 100,
    children: [
      {
        type: "row",
        weight: 100,
        children: [
          {
            type: "tabset",
            weight: 100,
            children: [
              { type: "tab", name: "Tools", component: "tools" },
              { type: "tab", name: "Brush Settings", component: "brushes" },
              { type: "tab", name: "Colors", component: "colors" }
            ]
          }
        ]
      }
    ]
  }
};

const factory = (node: TabNode) => {
  const component = node.getComponent();
  if (component === "tools") return <ToolsGroup />;
  if (component === "brushes") return <BrushesGroup />;
  if (component === "colors") return <ColorGroup />;
  return <div>Unknown Component</div>;
};

let globalLayoutJson: IJsonModel = defaultLayout;

export default function LeftTools() {
  const [flexModel, setFlexModel] = useState(() => Model.fromJson(globalLayoutJson));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden text-xs -mx-4 -mb-6 relative">
      <div className="absolute inset-0 pb-6 pointer-events-auto">
        <Layout 
          model={flexModel} 
          factory={factory} 
          onModelChange={(model) => {
            globalLayoutJson = model.toJson();
            setFlexModel(model);
          }}
        />
      </div>
    </div>
  );
}
