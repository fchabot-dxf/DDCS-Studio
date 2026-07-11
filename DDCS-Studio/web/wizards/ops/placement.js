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
    // Datum-Z (CODE-affecting): the ops author depths from the TOP (Z0 at top, cuts negative). Re-reference them to
    // the stock datum's Z — bottom datum shifts the whole path UP by the stock height (Z-5 → Z+15), centre by half,
    // top by 0 — so a bottom datum truly references the bottom. Cuts + retracts shift together (rigid), preserving
    // the cut; arc I/J are unaffected. (See the placement Z thread — datum Z is no longer sim-only.)
    const dz = String(params.stockDatum || '').replace(/[^ncp]/g, '')[2];
    const zShift = numv(params.offZ) + (1 - ((dz in FRAC) ? FRAC[dz] : 1)) * numv(params.stockZ);
    // Opt-in ops (slot/text — absolute A↔B / baseline geometry): DON'T follow the stock datum in XY. Stay where drawn +
    // a signed offset; only ATTACH to a stock corner once one is picked (then fall through to the placement below).
    if (params.optIn && !params.stockAttach && !params.pathDatum) {
        return { x: numv(params.originX), y: numv(params.originY), z: zShift };   // Z still re-references the datum
    }
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
        z: zShift,
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

/** Read a wizard's placement params from its form (prefix-scoped) + the settings stock — merge into the wizard
 *  params. Does NOT set originX/originY (the offset): area ops already carry those as their position; opt-in ops
 *  (slot/text) set them from their own offX/offY fields. `optIn` true = absolute-geometry op (stay-put default). */
export function placementParams(prefix, stock, optIn) {
    const v = (id) => { const e = (typeof document !== 'undefined') && document.getElementById(prefix + id); return e ? e.value : undefined; };
    return {
        stockDatum: (stock && stock.datum) || 'nnp',
        pathDatum: v('pathDatum') || '', stockAttach: v('stockAttach') || '', offZ: numv(v('offZ')),
        stockW: (stock && stock.x) || 0, stockH: (stock && stock.y) || 0, stockZ: (stock && stock.z) || 0, optIn: !!optIn,
    };
}

/** The placement fragment for a 2D-layout spec: the SAME shift the G-code is baked with, the stock datum offset
 *  (stockOx/stockOy → spec.stock), and the two corner pickers (path datum + stock attach). One drop-in for every
 *  wizard's buildSpec — spread it into the returned spec. */
export function placementSpec(params, bbox, prefix) {
    const datXY = (c) => String(c || '').replace(/[^ncp]/g, '').slice(0, 2);
    const stockDat = datXY(params.stockDatum) || 'nn';
    const shift = placementShift(bbox, params), sOff = stockDatumOffset(params);
    const setF = (id, code) => { const e = (typeof document !== 'undefined') && document.getElementById(prefix + id); if (e) { e.value = code; e.dispatchEvent(new Event('input', { bubbles: true })); } };
    return {
        placement: { x: shift.x, y: shift.y }, stockOx: sOff.x, stockOy: sOff.y,
        pathDatum: datXY(params.pathDatum) || datXY(params.stockAttach) || stockDat,
        stockDatum: stockDat, stockAttach: datXY(params.stockAttach) || stockDat,
        onPathDatum: (code) => setF('pathDatum', code), onStockAttach: (code) => setF('stockAttach', code),
    };
}

/** t720 P1 (d) — RESOLVE a twin op's placement stock from the SETTINGS stock. The built-in views always inject the stock
 *  dims via placementParams (they have no stock fields); a data-op twin BINDS stockW/stockH/stockZ as params that DEFAULT
 *  0, so with a non-default stockAttach the emit computes attachX = (FRAC-FRAC)*0 = 0 → the feature lands at the ORIGIN
 *  instead of the real stock corner/centre. This returns the fields to MERGE so an UNSET (0) stock dim follows the settings
 *  stock — a TYPED value is respected; only ops that HAVE the field are touched. A no-attach op's shift is stock-independent
 *  (attachX=0 regardless), so the default emit stays byte-identical — only a stock-attaching op now uses the real stock. */
export function resolvePlacementStock(params = {}, stock = null) {
    if (!stock) return {};
    const out = {};
    const fill = (pk, sk) => { if ((pk in params) && !(Number(params[pk]) > 0) && Number(stock[sk]) > 0) out[pk] = Number(stock[sk]); };
    fill('stockW', 'x'); fill('stockH', 'y'); fill('stockZ', 'z');
    return out;
}

/** WCS pin offset for a stock in work coords: how far the stock's datum corner is from the program origin
 *  when the stock is pinned to a WCS (G54–G59) rather than program zero.
 *  Returns {x:0, y:0} when no pin is active, no table row exists, or machine data is absent. */
export function stockPinXY(stock, machine) {
    if (!stock || !stock.pin || stock.pin === 'origin') return { x: 0, y: 0 };
    if (!machine || !machine.wcs || !machine.wcs.table) return { x: 0, y: 0 };
    const gi = parseInt(String(stock.pin).replace(/[^0-9]/g, ''), 10) - 54;
    const t = machine.wcs.table[gi];
    if (!t) return { x: 0, y: 0 };
    const wo = machine.workOrigin || {};
    return { x: (Number(t.x) || 0) - (wo.x || 0), y: (Number(t.y) || 0) - (wo.y || 0) };
}

/** Placement shift for a PlaceOnStock atom, from its FLAT snapshot params (stock + intent) + a bbox. `liveBbox`, when
 *  given, OVERRIDES the frozen bminX.. snapshot — the place fold passes the wrapped geometry's DECLARED extent so the
 *  placement tracks the params (one source of truth) instead of a stale author-time copy. Falls back to the snapshot
 *  (liveBbox null) for ops whose geometry atom doesn't yet declare an extent — so un-migrated ops are unchanged. */
export function placeShiftFromParams(p = {}, liveBbox = null) {
    return placementShift(
        liveBbox || { minX: numv(p.bminX), maxX: numv(p.bmaxX), minY: numv(p.bminY), maxY: numv(p.bmaxY) },
        { pathDatum: p.pathDatum, stockAttach: p.stockAttach, stockDatum: p.stockDatum, stockW: p.stockW, stockH: p.stockH, stockZ: p.stockZ, originX: p.offX, originY: p.offY, offZ: p.offZ, optIn: p.optIn },
    );
}
