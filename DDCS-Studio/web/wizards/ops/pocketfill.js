/**
 * wizards/ops/pocketfill.js — POCKET FILL + POCKET WALL: the FLAT, data-portable pocket-clearing primitives.
 *
 * Pocket's region-pill → flat REFRAME (mirroring contourfill): the pocket geometry rides FLAT on the block
 * (shape/originX/originY/w/h/dia/sides + wallOffset/toolDia), NO Region SOCKET, so every dim is a clean
 * (blockIndex,key) binding for the user_pocket_data twin. TWO atoms, because the enclosing StepDown emits a
 * `fill` block (leading `( <strategy> fill z= )` tag + trailing retract) DIFFERENTLY from a `leaf`:
 *   · pocketFillBlock (kind:'fill') = the stepover clearing  → byte-identical to stepover{region-socket}.
 *   · pocketWallBlock (kind:'leaf') = the raster wall finish → byte-identical to contour{region, side:'on'}.
 * Both compute the SAME inset region internally (pocketInsetRegion) and reuse the SAME kernels (fillStrategy /
 * fillSegments from stepover; circleTrace / contourLevel from contour). The shared stepover/contour/region atoms
 * are UNTOUCHED — pocket's own region-socket path retires only in the twin's flat template (do NOT mutate a shared atom).
 */
import { num } from './util.js';
import { regionDesc } from './region.js';
import { offsetRegion, circleTrace } from './contour.js';
import { contourLevel } from '../clearing.js';
import { fillStrategy, fillSegments } from './stepover.js';

/** Flat typed geometry → the TRUE region descriptor (before insetting). Mirrors pocketWizard.trueRegionParams, reading
 *  the flat block fields (originX/originY = the shape origin): rect = corner+w×h; circle/polygon = centre+Ø; ellipse = centre+w×h. */
export function trueRegionFromFlat(p) {
    const x = num(p.originX, 0), y = num(p.originY, 0), shape = p.shape || 'rect';
    if (shape === 'circle') return regionDesc({ shape: 'circle', x, y, w: num(p.dia, 50) });
    if (shape === 'polygon') return regionDesc({ shape: 'polygon', x, y, w: num(p.dia, 50), sides: num(p.sides, 6) });
    if (shape === 'ellipse') return regionDesc({ shape: 'ellipse', x, y, w: num(p.w, 80), h: num(p.h, 60) });
    return regionDesc({ shape: 'rect', x, y, w: num(p.w, 80), h: num(p.h, 60) });
}

/** The tool-CENTRE inset region a pocket clears: the true region inset by (toolRadius − wallOffset) — matching
 *  pocketWizard exactly (r = max(0.1,toolDia)/2, inset = r − wallOffset). ONE source for BOTH the clearing (pocketFill)
 *  and the wall (pocketWall) so they trace the identical boundary. Returns a descriptor (with .contour). */
export function pocketInsetRegion(p) {
    const r = Math.max(0.1, num(p.toolDia, 6)) / 2;
    return offsetRegion(trueRegionFromFlat(p), -(r - num(p.wallOffset, 0)));
}

/** The absolute stepover (mm) from the % + tool — matching pocketWizard's `so` (max(0.2, tool·%/100)). Exported (t802) so
 *  the 2D preview draws its concentric rings at the SAME spacing the emit cuts. */
export function stepoverMm(p) { return Math.max(0.2, Math.max(0.1, num(p.toolDia, 6)) * num(p.stepoverPct, 40) / 100); }

export const pocketFillBlock = {
    type: 'pocketfill', label: 'Pocket Fill', kind: 'fill', category: 'Toolpaths',
    defaults: { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, dia: 50, sides: 6, wallOffset: 0, toolDia: 6, stepoverPct: 40, strategy: 'concentric', direction: 'bothways', z: 'z', feed: 600, plunge: 150, clearance: 5 },
    fields: ['shape', 'originX', 'originY', 'w', 'h', 'dia', 'sides', 'wallOffset', 'toolDia', 'stepoverPct', 'strategy', 'direction', 'z', 'feed', 'plunge', 'clearance'],
    // the enclosing StepDown fills scope `z`; fillStrategy reads the inset region + the flat cut params → the stepover passes.
    lines: (p, z) => fillStrategy({ ...p, region: pocketInsetRegion(p), stepover: stepoverMm(p) }, z),
    segments: (p) => fillSegments({ ...p, region: pocketInsetRegion(p), stepover: stepoverMm(p) }),
};

export const pocketWallBlock = {
    type: 'pocketwall', label: 'Pocket Wall', kind: 'leaf', category: 'Toolpaths',
    defaults: { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, dia: 50, sides: 6, wallOffset: 0, toolDia: 6, z: 'z', feed: 600, plunge: 150, clearance: 5 },
    fields: ['shape', 'originX', 'originY', 'w', 'h', 'dia', 'sides', 'wallOffset', 'toolDia', 'z', 'feed', 'plunge', 'clearance'],
    // the raster wall finish = Contour(on) on the inset region: trace it at the scope Z (circle → true G3 arc).
    emit: (p) => {
        const rg = pocketInsetRegion(p);
        const z = num(p.z, 0), clr = num(p.clearance, 5), feed = num(p.feed, 600), plunge = num(p.plunge, 150);
        return rg.kind === 'circle' ? circleTrace(rg, z, clr, feed, plunge) : contourLevel(rg.contour, { z, clr, feed, plunge });
    },
};
