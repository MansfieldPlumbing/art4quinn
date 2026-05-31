import { ToolRegistry } from '../ToolRegistry';
import { BrushTool } from './BrushTool';
import { EraserTool } from './EraserTool';

// Select
import { MoveTool } from './MoveTool';
import { SelectTool } from './SelectTool';
import { LassoTool } from './LassoTool';
import { MagicTool } from './MagicTool';
import { CropTool } from './CropTool';

// Paint
import { PencilTool } from './PencilTool';
import { PenTool } from './PenTool';
import { MarkerTool } from './MarkerTool';
import { FillTool } from './FillTool';
import { GradientTool } from './GradientTool';
import { PickerTool } from './PickerTool';
import { SoftBrushTool } from './SoftBrushTool';
import { InkBrushTool } from './InkBrushTool';
import { AirbrushTool } from './AirbrushTool';
import { DetailBrushTool } from './DetailBrushTool';

// Retouch
import { BlurTool } from './BlurTool';
import { SmudgeTool } from './SmudgeTool';
import { SharpenTool } from './SharpenTool';
import { DodgeTool } from './DodgeTool';
import { BurnTool } from './BurnTool';
import { ContrastTool } from './ContrastTool';

// Vector
import { TextTool } from './TextTool';
import { RectTool } from './RectTool';
import { EllipseTool } from './EllipseTool';
import { PolyTool } from './PolyTool';
import { MagicEraserTool } from './MagicEraserTool';

ToolRegistry.register(MoveTool);
ToolRegistry.register(SelectTool);
ToolRegistry.register(LassoTool);
ToolRegistry.register(MagicTool);
ToolRegistry.register(CropTool);
ToolRegistry.register(BrushTool);
ToolRegistry.register(EraserTool);
ToolRegistry.register(MagicEraserTool);
ToolRegistry.register(PencilTool);
ToolRegistry.register(SoftBrushTool);
ToolRegistry.register(MarkerTool);
ToolRegistry.register(PenTool);
ToolRegistry.register(AirbrushTool);
ToolRegistry.register(DetailBrushTool);
ToolRegistry.register(InkBrushTool);
ToolRegistry.register(FillTool);
ToolRegistry.register(GradientTool);
ToolRegistry.register(PickerTool);
ToolRegistry.register(BlurTool);
ToolRegistry.register(SmudgeTool);
ToolRegistry.register(SharpenTool);
ToolRegistry.register(DodgeTool);
ToolRegistry.register(BurnTool);
ToolRegistry.register(ContrastTool);
ToolRegistry.register(TextTool);
ToolRegistry.register(RectTool);
ToolRegistry.register(EllipseTool);
ToolRegistry.register(PolyTool);
