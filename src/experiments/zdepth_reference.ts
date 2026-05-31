// Core 2.5D Volumetric "God Hand" Z-Depth Mechanics
// Extracted from parallel project reference

export class WindowElement {
    id: number;
    x: number;
    y: number;
    w: number;
    h: number;
    rotation: number;
    
    // Z-Depth Volumetrics
    zIndex: number;      // Standard sorting tiebreaker
    zPush: number;       // 0.0 = Floating foreground, 1.0 = Submerged background
    targetZSlot: number; // For collision evasion
    baseZSlot: number;   // Resting depth
}

// Projection Logic (Carmack 2.5D trick)
// zScale = 1.0 + (zPush * 2.0)
// As zPush goes to 1.0+, the object shrinks and moves slower relative to screen space

/*
Shader Logic representation:
let zScale = 1.0 + (zPush * 2.0);
let screen_center = vp + (world_center - vp) / zScale;
let pixel_offset = uv - screen_center;
pixel_offset *= zScale; // Shrink
*/

/*
Kinetic Shadows:
let height = clamp(1.0 - zPush, 0.0, 1.0);
let shadow_blur_radius = max(0.015, height * 0.05);

Higher elements (zPush -> 0.0) cast softer, wider shadows.
Submerged elements (zPush -> 1.0) cast almost no shadow.
*/
