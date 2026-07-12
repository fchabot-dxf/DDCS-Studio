/**
 * wizards/ops/fillText.js — FILL TEXT (kind:'fill'): engrave a string by pocket-filling its inflated glyph
 * ribbons. The text analogue of Fill Zigzag/Concentric — but the region is the text outline (textGeometry),
 * not a Region socket. Lays raster clearing passes at the depth the enclosing Step Down exposes as scope `z`.
 * Pure G0/G1 — dialect-agnostic (engraving needs no probe/WCS/dwell), so it emits identically on every post.
 */
import { num } from './util.js';
import { scanlineFill, fillLevelMoves } from '../clearing.js';
import { textContours, layoutText } from '../textGeometry.js';
import { pointsBBox } from './placement.js';

const r3 = (n) => Math.round(n * 1000) / 1000;
// t764 — a self-describing {SN} marker: fillText marks WHERE (+ the cut params) at each fill level; the blockEmitter
// post-pass (applySerialLibrary) dedups by placement (keeping the deepest z), expands each to the serial macro, and
// emits the bump + the per-height glyph library ONCE at program scope. Carries everything the post-pass needs.
function snMarker(p, s, z) {
    const depth = Math.abs((typeof z === 'number') ? z : num(p.depth, 0.4)) || num(p.depth, 0.4);
    return `( @SN slot=${Math.round(num(p.snSlot, 490))} count=${Math.max(1, Math.round(num(p.snWidth, 6)))} inc=${Math.round(num(p.snIncrement, 1))}`
        + ` x=${r3(s.x)} y=${r3(s.y)} h=${r3(s.height)} w=${r3(s.width)} depth=${r3(depth)}`
        + ` feed=${num(p.feed, 400)} plunge=${num(p.plunge, 120)} clr=${num(p.clearance, 4)} )`;
}

export const fillTextBlock = {
    type: 'filltext', label: 'Fill Text', kind: 'fill', category: 'Transforms',
    defaults: {
        text: 'TEXT', font: 'single-stroke', height: 12, width: 1, slant: 0, rotation: 0, spacing: 1.2, lineSpacing: 1.6, align: 'left', x: 0, y: 0,
        strokeWidth: 2.5, toolDia: 1.5, stepoverPct: 50, z: 'z', feed: 400, plunge: 120, clearance: 4,
        snSlot: 490, snWidth: 6, snIncrement: 1, dateStamp: '',   // t764 — {SN} dynamic serial + {DATE} insert-stamp params (inert unless the text carries the token)
    },
    fields: ['text', 'font', 'height', 'width', 'slant', 'rotation', 'spacing', 'lineSpacing', 'align', 'x', 'y', 'strokeWidth', 'toolDia', 'stepoverPct', 'z', 'feed', 'plunge', 'clearance', 'snSlot', 'snWidth', 'snIncrement', 'dateStamp'],
    lines: (p, z) => {
        const tool = Math.max(0.1, num(p.toolDia, 1.5));
        const so = Math.max(0.15, tool * num(p.stepoverPct, 50) / 100);
        const rows = scanlineFill(textContours(p), so);
        const staticMoves = rows.length ? fillLevelMoves(rows, { z, clr: num(p.clearance, 4), feed: num(p.feed, 400), plunge: num(p.plunge, 120) }) : [];
        // t764 — {SN} serial tokens: one marker per placement per level (the post-pass dedups + expands to the macro).
        const serials = layoutText(p).serials || [];
        const snMarkers = serials.map((s) => snMarker(p, s, z));
        if (!staticMoves.length && !snMarkers.length) return ['( nothing to engrave )'];
        return [...staticMoves, ...snMarkers];
    },
    // Declared footprint = the inflated glyph outline (== textBBox). So the place fold's liveExtent recomputes the
    // placement bbox from LIVE params (one source of truth) — makes stock-attach track the text instead of a frozen
    // snapshot. (textContours is the same geometry the fill scans, so the footprint can never diverge from the toolpath.)
    extent: (p) => {
        const pts = textContours(p).flat();
        if (pts.length) return pointsBBox(pts);                     // static text → the inflated-ribbon bbox (UNCHANGED — goldens hold)
        const b = layoutText(p).bbox;                              // pure-{SN} text → the reserved serial region (else placement has no footprint)
        return (isFinite(b.x0) && b.x1 > b.x0) ? { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 } : null;
    },

    // DECLARED PREVIEW GEOMETRY (the general seam, t708): an atom declares the vector geometry + drag handles its
    // twin's 2D layout should render — declare-not-infer, so the preview never re-derives letters from the toolpath.
    // text is the first consumer; per-feature handles for other ops ride this same hook later. Returns FeatureCanvas
    // `paths` (the real letter centrelines) + canvasWidget handle DECLS keyed by the op's PARAM names (x/y/rotation),
    // so a drag routes through the twin's form field → update → re-render (the writer round-trip).
    previewGeometry: (p) => {
        const lay = layoutText(p);
        const paths = [...lay.strokes, ...(lay.serialPreview || [])].map((poly) => ({ pts: poly.map(([x, y]) => ({ x, y })), cls: 'fc-path' }));   // t764 — show the {SN} placeholder digits in the 2D layout
        const ox = num(p.x, 0), oy = num(p.y, 0), rot = num(p.rotation, 0);
        const r = Math.max(4, lay.lineW || 10);   // the ↻ handle rides the rotated baseline end (grab it to swing the label)
        const handles = [
            { type: 'point', id: 'txt_pos', fx: 'x', fy: 'y', x: ox, y: oy, label: 'pos' },
            { type: 'radial', id: 'txt_rot', fieldA: 'rotation', cx: ox, cy: oy, r, a: rot * Math.PI / 180, label: '↻' },
        ];
        return { paths, handles };
    },
};
