import { ToolDef } from '../ToolRegistry';

export const TextTool: ToolDef = {
  id: 'text',
  name: 'Text',
  type: 'vector',
  cursor: 'text',
  onPointerDown: (pt, ctx) => { /* Stub */ },
  onPointerMove: (pt, ctx) => { /* Stub */ },
  onPointerUp: (pt, ctx) => { /* Stub */ }
};
