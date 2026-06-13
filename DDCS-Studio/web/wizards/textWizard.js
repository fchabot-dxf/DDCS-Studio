/**
 * wizards/textWizard.js — text / label engraving generator (Mill group).
 *
 * Lays out a string from the single-stroke font (strokeFont.js), INFLATES each centreline stroke into
 * a filled ribbon (quads + round caps), and pocket-fills the union with the shared raster engine. The
 * ribbon model means counters (O/A/B/8 holes) fall out for free — a thin ribbon never covers the glyph
 * centre — and overlapping ribbon pieces fill solid under the non-zero-winding scanline. Flat G0/G1 in
 * the active WCS, stepping down to `depth`. No #vars.
 */
import { glyph, FONT_CAP_HEIGHT } from './strokeFont.js';
import { headerBlock, footerBlock } from './cuttingBlocks.js';
import { scanlineFill, fillLevelMoves, depthLevels } from './clearing.js';

function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Lay the string out → placed centreline polylines (work coords) + the text bounding box. */
export function layoutText(params) {
    const text = (params.text == null ? 'TEXT' : String(params.text));
    const H = Math.max(1, num(params.height, 12));
    const scale = H / FONT_CAP_HEIGHT;
    const tracking = num(params.spacing, 1.2);   // extra mm between glyphs
    const align = params.align || 'left';
    const ox = num(params.x, 0), oy = num(params.y, 0);
    const lines = text.split('\n');
    const linePitch = H * 1.6;

    const strokes = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const acc = (px, py) => { if (px < x0) x0 = px; if (py < y0) y0 = py; if (px > x1) x1 = px; if (py > y1) y1 = py; };

    lines.forEach((ln, li) => {
        let lw = 0;
        for (const ch of ln) lw += glyph(ch).w * scale + tracking;
        if (ln.length) lw -= tracking;
        const baseY = oy - li * linePitch;
        let cx = align === 'center' ? ox - lw / 2 : align === 'right' ? ox - lw : ox;
        for (const ch of ln) {
            const g = glyph(ch);
            for (const stroke of g.s) {
                const placed = stroke.map(([x, y]) => [cx + x * scale, baseY + y * scale]);
                strokes.push(placed);
                for (const [px, py] of placed) acc(px, py);
            }
            cx += g.w * scale + tracking;
        }
    });

    if (!isFinite(x0)) { x0 = x1 = ox; y0 = y1 = oy; }
    return { strokes, bbox: { x0, y0, x1, y1 }, scale, height: H };
}

const ccw = (pts) => {
    let a = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
    return a < 0 ? pts.slice().reverse() : pts;
};
function disc(cx, cy, r, seg = 8) {
    const c = [];
    for (let i = 0; i < seg; i++) { const a = (2 * Math.PI * i) / seg + 0.3927; c.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
    return c;   // generated CCW
}
/** One centreline polyline → ribbon contours (a quad per segment + a round cap at each vertex). */
function strokeContours(poly, hw) {
    const out = [];
    for (let i = 0; i + 1 < poly.length; i++) {
        const [ax, ay] = poly[i], [bx, by] = poly[i + 1];
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
        if (len < 1e-9) continue;
        const nx = (-dy / len) * hw, ny = (dx / len) * hw;
        out.push(ccw([{ x: ax + nx, y: ay + ny }, { x: bx + nx, y: by + ny }, { x: bx - nx, y: by - ny }, { x: ax - nx, y: ay - ny }]));
    }
    for (const [x, y] of poly) out.push(disc(x, y, hw));
    return out;
}

/** All ribbon contours for the laid-out text (tool-centre fill region). */
export function textContours(params) {
    const { strokes } = layoutText(params);
    const hw = Math.max(0.1, num(params.strokeWidth, 2.5) / 2);
    const contours = [];
    for (const poly of strokes) for (const c of strokeContours(poly, hw)) contours.push(c);
    return contours;
}

export class TextWizard {
    generate(params) {
        const tool = Math.max(0.1, num(params.toolDia, 1.5));
        const so = Math.max(0.15, tool * num(params.stepoverPct, 50) / 100);
        const depth = num(params.depth, 0.4);
        const clr = num(params.clearance, 4), feed = num(params.feed, 400), plunge = num(params.plunge, 120);
        const levels = depthLevels(depth, num(params.stepdown, depth));   // engraving is usually one pass
        const safeText = String(params.text == null ? '' : params.text).replace(/[()\n]/g, ' ');

        const contours = textContours(params);
        const rows = scanlineFill(contours, so);
        const L = [
            `( Text "${safeText}" - DDCS Studio )`,
            `( engrave fill | tool Ø${tool} | stroke ${num(params.strokeWidth, 2.5)} | depth ${depth} )`,
            ...headerBlock(params),
            `G0 Z${clr}   ( clearance )`,
        ];
        if (!rows.length) { L.push('( nothing to engrave )', ...footerBlock(params)); return L.join('\n'); }

        for (const d of levels) {
            const ctx = { z: -d, clr, feed, plunge };
            L.push(`( level Z${r3(-d)} )`);
            L.push(...fillLevelMoves(rows, ctx));
            L.push(`G0 Z${clr}`);
        }
        L.push(...footerBlock(params));
        return L.join('\n');
    }
}
