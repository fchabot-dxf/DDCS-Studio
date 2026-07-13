/**
 * wizards/ops/surfaceFill.js — SURFACE FILL: flat, data-portable area-clearing primitive (kind:'fill').
 * Surfacing's dedicated fill atom: geometry is FLAT (shape/x/y/w/h) on the block — NO Region reporter socket — so
 * every param is a clean (blockIndex,key) data-def binding. Reuses StepOver's clearing kernels via fillRegion.
 */
import { pointsBBox } from './placement.js';
import { fillStrategy, fillSegments, fillRegion } from './stepover.js';

export const surfaceFillBlock = {
    type: 'surfacefill', label: 'Surface Fill', kind: 'fill', category: 'Transforms',
    defaults: { shape: 'rect', x: 0, y: 0, w: 100, h: 80, stepover: 7.2, strategy: 'parallel', direction: 'bothways', entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, by: 'by', toolDia: 6, z: 'z', feed: 800, plunge: 200, clearance: 5 },
    fields: ['shape', 'x', 'y', 'w', 'h', 'stepover', 'strategy', 'direction', 'entry', 'rampAngle', 'helixDia', 'helixPitch', 'by', 'toolDia', 'z', 'feed', 'plunge', 'clearance'],
    lines: (p, z) => fillStrategy(p, z),
    segments: (p) => fillSegments(p),
    extent: (p) => { const c = fillRegion(p).contour; const pts = (c || []).flat(); return pts.length ? pointsBBox(pts) : null; },
};
