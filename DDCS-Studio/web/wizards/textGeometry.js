/**
 * wizards/textGeometry.js — pure text-engraving geometry (no G-code, no block model).
 *
 * Lays a string out from the single-stroke font (strokeFont.js) and INFLATES each centreline stroke into a
 * filled ribbon (quads + round caps). Extracted from textWizard so BOTH the wizard and the `fillText` fill-atom
 * (ops/fillText.js) can share it without a module cycle. Counters (O/A/B/8 holes) fall out for free (a thin
 * ribbon never covers the glyph centre) and overlapping pieces fill solid under the non-zero-winding scanline.
 */
import { getFont, FONT_CAP_HEIGHT } from './strokeFont.js';

export { FONT_CAP_HEIGHT };

function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }

/** Lay the string out → placed centreline polylines (work coords) + the text bounding box. */
export function layoutText(params) {
    const font = getFont(params.font);            // FONT SEAM: select by name (default = built-in single-stroke)
    const glyph = font.glyph;
    const text = (params.text == null ? 'TEXT' : String(params.text));
    const H = Math.max(1, num(params.height, 12));
    const scale = H / font.capHeight;
    const width = Math.max(0.1, num(params.width, 1));               // horizontal scale: <1 condensed, >1 extended
    const tanSlant = Math.tan(num(params.slant, 0) * Math.PI / 180);  // oblique/italic skew (deg, about the baseline)
    const tracking = num(params.spacing, 1.2);   // extra mm between glyphs
    const align = params.align || 'left';
    const ox = num(params.x, 0), oy = num(params.y, 0);
    const lines = text.split('\n');
    const linePitch = H * 1.6;

    const strokes = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, maxLw = 0;
    const acc = (px, py) => { if (px < x0) x0 = px; if (py < y0) y0 = py; if (px > x1) x1 = px; if (py > y1) y1 = py; };

    lines.forEach((ln, li) => {
        let lw = 0;
        for (const ch of ln) lw += glyph(ch).w * width * scale + tracking;
        if (ln.length) lw -= tracking;
        if (lw > maxLw) maxLw = lw;   // widest line's advance (baseline span) — the width/slant handle anchors
        const baseY = oy - li * linePitch;
        let cx = align === 'center' ? ox - lw / 2 : align === 'right' ? ox - lw : ox;
        for (const ch of ln) {
            const g = glyph(ch);
            for (const stroke of g.s) {
                // width-stretch x, then slant-skew x by glyph height (about the baseline) — both in glyph units, then scale
                const placed = stroke.map(([x, y]) => [cx + (x * width + y * tanSlant) * scale, baseY + y * scale]);
                strokes.push(placed);
                for (const [px, py] of placed) acc(px, py);
            }
            cx += g.w * width * scale + tracking;
        }
    });

    if (!isFinite(x0)) { x0 = x1 = ox; y0 = y1 = oy; }
    return { strokes, bbox: { x0, y0, x1, y1 }, scale, height: H, lineW: maxLw };
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
