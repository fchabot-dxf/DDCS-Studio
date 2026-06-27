/**
 * wizards/ops/fillText.js — FILL TEXT (kind:'fill'): engrave a string by pocket-filling its inflated glyph
 * ribbons. The text analogue of Fill Zigzag/Concentric — but the region is the text outline (textGeometry),
 * not a Region socket. Lays raster clearing passes at the depth the enclosing Step Down exposes as scope `z`.
 * Pure G0/G1 — dialect-agnostic (engraving needs no probe/WCS/dwell), so it emits identically on every post.
 */
import { num } from './util.js';
import { scanlineFill, fillLevelMoves } from '../clearing.js';
import { textContours } from '../textGeometry.js';
import { pointsBBox } from './placement.js';

export const fillTextBlock = {
    type: 'filltext', label: 'Fill Text', kind: 'fill', category: 'Transforms',
    defaults: {
        text: 'TEXT', font: 'single-stroke', height: 12, spacing: 1.2, align: 'left', x: 0, y: 0,
        strokeWidth: 2.5, toolDia: 1.5, stepoverPct: 50, z: 'z', feed: 400, plunge: 120, clearance: 4,
    },
    fields: ['text', 'font', 'height', 'spacing', 'align', 'x', 'y', 'strokeWidth', 'toolDia', 'stepoverPct', 'z', 'feed', 'plunge', 'clearance'],
    lines: (p, z) => {
        const tool = Math.max(0.1, num(p.toolDia, 1.5));
        const so = Math.max(0.15, tool * num(p.stepoverPct, 50) / 100);
        const rows = scanlineFill(textContours(p), so);
        if (!rows.length) return ['( nothing to engrave )'];
        return fillLevelMoves(rows, { z, clr: num(p.clearance, 4), feed: num(p.feed, 400), plunge: num(p.plunge, 120) });
    },
    // Declared footprint = the inflated glyph outline (== textBBox). So the place fold's liveExtent recomputes the
    // placement bbox from LIVE params (one source of truth) — makes stock-attach track the text instead of a frozen
    // snapshot. (textContours is the same geometry the fill scans, so the footprint can never diverge from the toolpath.)
    extent: (p) => { const pts = textContours(p).flat(); return pts.length ? pointsBBox(pts) : null; },
};
