/**
 * wizards/ops/contourfill.js — CONTOUR FILL: the FLAT, data-portable profile/contour primitive (kind:'leaf').
 *
 * The contour wizard's dedicated flat atom (the region-pill→flat REFRAME, mirroring surfaceFill): geometry is FLAT
 * (shape/x/y/w/h/dia/sides) directly on the block — NO Region reporter SOCKET — so every param is a clean
 * (blockIndex,key) data-def binding for the `user_contour_data` twin (the coarse cutting atoms carry no #var, so the
 * twin binds POSITIONALLY, not by identity). Emit is BYTE-IDENTICAL to the region-socket `contour` atom: it rebuilds
 * the same region descriptor internally (regionDesc) and reuses the SAME kernels (contourRegion + circleTrace/
 * contourLevel). The shared `contour` atom is UNTOUCHED — pocket's wall finish still plugs a Region socket into it.
 */
import { num } from './util.js';
import { contourRegion, circleTrace } from './contour.js';
import { contourLevel } from '../clearing.js';
import { regionDesc } from './region.js';

/** The FLAT block geometry → a region descriptor INPUT (rect/ellipse use w×h, circle/polygon use dia+sides) — the exact
 *  shape→dims mapping the region-socket path used (regionParams in contourWizard), so regionDesc(this) is identical. */
export function regionFromFlat(p) {
    const x = num(p.x, 0), y = num(p.y, 0), shape = p.shape || 'rect';
    if (shape === 'circle') return { shape: 'circle', x, y, w: num(p.dia, 50) };
    if (shape === 'polygon') return { shape: 'polygon', x, y, w: num(p.dia, 50), sides: num(p.sides, 6) };
    if (shape === 'ellipse') return { shape: 'ellipse', x, y, w: num(p.w, 80), h: num(p.h, 60) };
    return { shape: 'rect', x, y, w: num(p.w, 80), h: num(p.h, 60) };
}

/** The OFFSET toolpath bounds from the flat params (mirrors contourBBox) — the LIVE declared extent so PlaceOnStock
 *  re-derives the placement from the CURRENT geometry (not a stale bbox snapshot) when the twin changes shape/size. */
function contourExtent(p) {
    const rg = contourRegion({ region: regionDesc(regionFromFlat(p)), side: p.side || 'outside', tool: num(p.tool, 6) });
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const ring of (rg.contour || [])) for (const pt of ring) {
        if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y;
    }
    return Number.isFinite(minX) ? { minX, maxX, minY, maxY } : null;
}

export const contourFillBlock = {
    type: 'contourfill', label: 'Contour', kind: 'leaf', category: 'Toolpaths',
    defaults: { shape: 'rect', x: 0, y: 0, w: 80, h: 60, dia: 50, sides: 6, side: 'outside', tool: 6, entry: 'plunge', rampAngle: 3, by: 'by', z: 'z', feed: 2000, plunge: 200, clearance: 5 },
    fields: ['shape', 'x', 'y', 'w', 'h', 'dia', 'sides', 'side', 'tool', 'entry', 'rampAngle', 'by', 'z', 'feed', 'plunge', 'clearance'],
    // t2401 (BACKLOG #48 item 5) — the PHANTOM HELIX OFFER: `entry` is a bare field name, and bridge.js's global
    // domain table offers plunge/ramp/HELIX for any block with a field of that name (pocketfill/slot/surfaceFill
    // genuinely support helix, via their own helixDia/helixPitch fields). contourfill declares neither field and
    // its own emit (below) coerces anything but 'ramp' to 'plunge' — a contour has no interior to helix down into
    // without gouging the profile — so the dropdown offered a choice that silently did nothing. `selects` is the
    // established per-atom override (t1520's own "the atom's own vocabulary wins" rule, bridge.js:189) — narrows
    // this ONE block's own dropdown without touching the shared 'entry' domain every other consumer still uses.
    selects: { entry: ['plunge', 'ramp'] },
    extent: (p) => contourExtent(p),   // live extent → PlaceOnStock tracks shape/size (byte-identical: == contourBBox)
    emit: (p) => {
        const rg = contourRegion({ region: regionDesc(regionFromFlat(p)), side: p.side || 'outside', tool: num(p.tool, 6) });
        const z = num(p.z, 0), clr = num(p.clearance, 5), feed = num(p.feed, 2000), plunge = num(p.plunge, 200);
        // t842 — depth entry: ramp along the first segment (polyline) / a helical lead-in (circle). Plunge default = byte-
        // identical. A contour has NO helix (it would gouge the profile interior) — coerce anything but ramp to plunge, so a
        // stray helix from the global Blockly dropdown can't reach the fill-only helix path (no cx/cy in a contour ctx).
        // t1524 — `prevZ` is THE DECLARED FLOOR from the enclosing StepDown scope, with the nominal `z + by` kept as the
        // standalone fallback (same contract as stepover.js): per level this kernel knows the bite but not the total
        // depth, so it cannot recognise a CLAMPED final level, and the nominal floor sits above the real one there.
        const entry = p.entry === 'ramp' ? 'ramp' : 'plunge', rampAngle = num(p.rampAngle, 3);
        const prevZ = p.prevZ != null ? num(p.prevZ, z) : z + num(p.by, Math.abs(z));
        return rg.kind === 'circle'
            ? circleTrace(rg, z, clr, feed, plunge, entry, prevZ, rampAngle)
            : contourLevel(rg.contour, { z, clr, feed, plunge, entry, prevZ, rampAngle });
    },
};
