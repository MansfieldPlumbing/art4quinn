# Agent Directives & Roadmap

## Current Project Focus
1. **Physics & UI Z-Depth System**: Implement the definitive Z-depth and parallax rendering mechanics on the Drawing Board. 
    - The infinite Pasteboard should represent the absolute deep background (`zPush = 1.0`).
    - Artboard and Layer canvases exist in the midground (`zPush = ~0.5`).
    - Control panes, thumbsticks, and overlays exist as top-level floating elements (`zPush = 0.0`).
    - Introduce efficient device/pointer parallax to fully realize these physical interactions.

## Next Project Focus
2. **Tooling Registry**: Once the UI and physical mechanics are perfectly modeled, implement the core Tool Registry system. Standardize tool behaviors, parameters, schemas, and lifecycle events into a structured logic store, mapping actions clearly to prevent the project from collapsing under the weight of decoupled React state.

## Lessons on Complexity Mitigation
- **What to Learn from FlickPaint (This Project) for Microkernel**:
  - Keep the foundational rendering (drawing) functionally raw and decoupled from high-frequency UI updates. FlickPaint is fast because it bypasses React context for actual stroke processing. Ensure the native rendering engine in Microkernel operates effortlessly beneath the complex window management system. Keep state trees lean.
- **What FlickPaint can learn from Microkernel (Your Parallel Project)**:
  - Strict UI boundaries. The "collapse" of web projects often occurs when data binds tightly to standard DOM layouts. Emulate the strict Z-Index/Z-Push isolation and Mailbox IPC message-passing seen in the WebGPU microkernel: separate the drawing "plane" securely from the React DOM UI overlay plane. Use direct DOM manipulations (`style.transform` via `requestAnimationFrame` or `framer-motion`) for raw 60fps parallax to sidestep the React reconciler entirely.
