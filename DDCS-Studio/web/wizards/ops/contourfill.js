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
    defaults: { shape: 'rect', x: 0, y: 0, w: 80, h: 60, dia: 50, sides: 6, side: 'outside', tool: 6, z: 'z', feed: 400, plunge: 200, clearance: 5 },
    fields: ['shape', 'x', 'y', 'w', 'h', 'dia', 'sides', 'side', 'tool', 'z', 'feed', 'plunge', 'clearance'],
    extent: (p) => contourExtent(p),   // live extent → PlaceOnStock tracks shape/size (byte-identical: == contourBBox)
    emit: (p) => {
        const rg = contourRegion({ region: regionDesc(regionFromFlat(p)), side: p.side || 'outside', tool: num(p.tool, 6) });
        const z = num(p.z, 0), clr = num(p.clearance, 5), feed = num(p.feed, 400), plunge = num(p.plunge, 200);
        return rg.kind === 'circle'
            ? circleTrace(rg, z, clr, feed, plunge)
            : contourLevel(rg.contour, { z, clr, feed, plunge });
    },
};
