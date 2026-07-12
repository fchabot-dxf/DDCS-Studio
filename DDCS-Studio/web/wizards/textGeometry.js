/**
 * wizards/textGeometry.js — pure text-engraving geometry (no G-code, no block model).
 *
 * Lays a string out from the single-stroke font (strokeFont.js) and INFLATES each centreline stroke into a
 * filled ribbon (quads + round caps). Extracted from textWizard so BOTH the wizard and the `fillText` fill-atom
 * (ops/fillText.js) can share it without a module cycle. Counters (O/A/B/8 holes) fall out for free (a thin
 * ribbon never covers the glyph centre) and overlapping pieces fill solid under the non-zero-winding scanline.
 */
import { getFont, FONT_CAP_HEIGHT } from './strokeFont.js';
import { digitPitch } from './serialEngrave.js';   // t764 — {SN} reserves monospace digit slots (same pitch the emit engraves at)

export { FONT_CAP_HEIGHT };

function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }

// t764 — resolve the {DATE} token to its declared insert-time STATIC stamp (no macro-readable clock on the controllers,
// t758): a stored p.dateStamp (frozen at insert), else today (the wizard freezes + shows the honest note). Uppercased —
// the single-stroke font is caps-only. {SN} stays a token (handled per-segment below) — it engraves dynamically.
function resolveDate(text, params) {
    if (text.indexOf('{DATE}') < 0) return text;
    const s = (params.dateStamp && String(params.dateStamp)) || _todayStamp();
    return text.replace(/\{DATE\}/g, s.toUpperCase());
}
function _todayStamp() { try { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; } catch (_) { return ''; } }
// Split a line into [{static text} | {kind:'sn'}] segments on the {SN} token (case-insensitive).
function segmentsOf(line) { return line.split(/(\{SN\})/i).filter((s) => s !== '').map((s) => /^\{SN\}$/i.test(s) ? { sn: true } : { text: s }); }

/** Lay the string out → placed centreline polylines (work coords) + the text bounding box. */
export function layoutText(params) {
    const font = getFont(params.font);            // FONT SEAM: select by name (default = built-in single-stroke)
    const glyph = font.glyph;
    const text = resolveDate((params.text == null ? 'TEXT' : String(params.text)), params);   // t764 — {DATE} → insert-stamp
    const H = Math.max(1, num(params.height, 12));
    const scale = H / font.capHeight;
    const width = Math.max(0.1, num(params.width, 1));               // horizontal scale: <1 condensed, >1 extended
    const tanSlant = Math.tan(num(params.slant, 0) * Math.PI / 180);  // oblique/italic skew (deg, about the baseline)
    const tracking = num(params.spacing, 1.2);   // extra mm between glyphs
    const align = params.align || 'left';
    const ox = num(params.x, 0), oy = num(params.y, 0);
    const lines = text.split('\n');
    const linePitch = H * num(params.lineSpacing, 1.6);   // line pitch = height × lineSpacing (default 1.6 → byte-identical)
    // ROTATION (deg, about the anchor x,y) — applied to the PLACED points, so it lives in the ONE source (layoutText)
    // that feeds BOTH the emit (via textContours) AND every preview: emit + 2D + 3D + carve + footprint rotate together.
    // rotation=0 → the rotate() is the identity → byte-identical to the pre-rotation layout (goldens stay zero-diff).
    const rot = num(params.rotation, 0) * Math.PI / 180;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    const rotate = rot ? ([px, py]) => { const dx = px - ox, dy = py - oy; return [ox + dx * cosR - dy * sinR, oy + dx * sinR + dy * cosR]; } : (pt) => pt;

    // t764 — {SN} reserves `snWidth` MONOSPACE digit slots (the same pitch the emit engraves at), records a placement
    // for the emit macro, and lays PLACEHOLDER '0's for the preview. No {SN} → segmentsOf returns one static segment →
    // the char loop is IDENTICAL to before (existing text goldens stay byte-zero-diff).
    const snWidth = Math.max(1, Math.round(num(params.snWidth, 6)));
    const snPitch = digitPitch(H, width, params.font);
    const strokes = [], serials = [], serialPreview = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, maxLw = 0;
    const acc = (px, py) => { if (px < x0) x0 = px; if (py < y0) y0 = py; if (px > x1) x1 = px; if (py > y1) y1 = py; };

    lines.forEach((ln, li) => {
        const segs = segmentsOf(ln);
        let lw = 0, cells = 0;
        for (const seg of segs) {
            if (seg.sn) { lw += snWidth * snPitch + tracking; cells++; }
            else for (const ch of seg.text) { lw += glyph(ch).w * width * scale + tracking; cells++; }
        }
        if (cells) lw -= tracking;
        if (lw > maxLw) maxLw = lw;   // widest line's advance (baseline span) — the width/slant handle anchors
        const baseY = oy - li * linePitch;
        let cx = align === 'center' ? ox - lw / 2 : align === 'right' ? ox - lw : ox;
        for (const seg of segs) {
            if (seg.sn) {
                const [sx, sy] = rotate([cx, baseY]);
                serials.push({ x: sx, y: sy, count: snWidth, height: H, width, pitch: snPitch });
                let px = cx;   // preview placeholders: '0' × count at the monospace pitch (shows the serial's width/place)
                for (let d = 0; d < snWidth; d++) {
                    for (const stroke of glyph('0').s) { const placed = stroke.map(([x, y]) => rotate([px + x * width * scale, baseY + y * scale])); serialPreview.push(placed); for (const [ppx, ppy] of placed) acc(ppx, ppy); }
                    px += snPitch;
                }
                cx += snWidth * snPitch + tracking;
            } else {
                for (const ch of seg.text) {
                    const g = glyph(ch);
                    for (const stroke of g.s) {
                        // width-stretch x, then slant-skew x by glyph height (about the baseline), scale, then rotate about the anchor.
                        const placed = stroke.map(([x, y]) => rotate([cx + (x * width + y * tanSlant) * scale, baseY + y * scale]));
                        strokes.push(placed);
                        for (const [px, py] of placed) acc(px, py);
                    }
                    cx += g.w * width * scale + tracking;
                }
            }
        }
    });

    if (!isFinite(x0)) { x0 = x1 = ox; y0 = y1 = oy; }
    return { strokes, bbox: { x0, y0, x1, y1 }, scale, height: H, lineW: maxLw, serials, serialPreview };
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
