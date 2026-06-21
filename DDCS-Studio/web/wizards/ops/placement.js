/**
 * wizards/ops/placement.js — shared toolpath-on-stock placement (used by every mill wizard + its 2D layout).
 *
 * The path has its OWN datum (which corner of its bounding box anchors, measured on the toolpath CENTRES/centreline
 * so the cut width never moves it). That corner attaches to a chosen STOCK corner + a signed X/Y/Z offset. Both
 * datums default to the stock's part-zero datum, so by default the path follows the stock onto it with zero config.
 *
 * `placeProgram` shifts the G-code (the 3D + the inserted code); `placementShift` returns the same (x,y,z) so the
 * 2D layout can draw the pattern at the SAME placed spot; `stockDatumOffset` positions the stock in the 2D so its
 * datum corner sits at part-zero (the origin). One source of truth → 2D and 3D always agree.
 */
import { translateProgram } from '../../data/rotateProgram.js';

const code2 = (c) => (String(c || '').replace(/[^ncp]/g, '') + 'nn').slice(0, 2);
const FRAC = { n: 0, c: 0.5, p: 1 };
const numv = (v, d = 0) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);

/** Bounding box {minX,maxX,minY,maxY} of toolpath geometry points (centres/centreline), or null if empty. */
export function pointsBBox(points) {
    if (!points || !points.length) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
        const x = Number(p.x), y = Number(p.y);
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return Number.isFinite(minX) ? { minX, maxX, minY, maxY } : null;
}

/**
 * The (x,y,z) that places a toolpath on the stock: its path-datum corner lands on (the chosen stock corner + offset).
 * @param {{minX,maxX,minY,maxY}|null} bbox  toolpath bounding box (centres) in the program frame
 * @param {object} params  { pathDatum, stockAttach, stockDatum, stockW, stockH, originX, originY, offZ }
 */
export function placementShift(bbox, params = {}) {
    if (!bbox) return { x: 0, y: 0, z: 0 };
    const at = { n: (a) => a, c: (a, b) => (a + b) / 2, p: (a, b) => b };
    // Path datum follows the stock-attach corner (which follows the stock datum) unless explicitly set.
    const pc = code2(params.pathDatum || params.stockAttach || params.stockDatum || 'nn');
    const cornerX = at[pc[0]](bbox.minX, bbox.maxX), cornerY = at[pc[1]](bbox.minY, bbox.maxY);
    const sd = code2(params.stockDatum || 'nn'), sa = code2(params.stockAttach || params.stockDatum || 'nn');
    const w = numv(params.stockW), h = numv(params.stockH);
    const attachX = (FRAC[sa[0]] - FRAC[sd[0]]) * w, attachY = (FRAC[sa[1]] - FRAC[sd[1]]) * h;
    return {
        x: attachX + numv(params.originX) - cornerX,
        y: attachY + numv(params.originY) - cornerY,
        z: numv(params.offZ),
    };
}

/** Apply placement to a program. `points` = toolpath geometry for the bbox (centres/centreline). Pure; simulate after. */
export function placeProgram(text, params, points) {
    const s = placementShift(pointsBBox(points), params);
    if (!s.x && !s.y && !s.z) return text;
    return translateProgram(text, s.x, s.y, s.z).text;
}

/** Stock min-corner offset so the stock's datum corner sits at part-zero (origin) in the 2D layout. */
export function stockDatumOffset(params = {}) {
    const sd = code2(params.stockDatum || 'nn');
    return { x: -FRAC[sd[0]] * numv(params.stockW), y: -FRAC[sd[1]] * numv(params.stockH) };
}
