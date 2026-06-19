/**
 * viz/toolProfile.js — tool-profile silhouettes (side view) by type, for previews.
 *
 * ONE source of tool geometry for the UI: the tool-library icons, the ATC rack preview, and (later) the
 * sim/mill tool. Pure SVG, no deps. Profile comes from { type, dia, length, angle? }; where the library has
 * no explicit angle we use sensible cutter defaults. The cutting end is drawn at the BOTTOM (tip down).
 *
 * Diameter is used here even though the controller can't store it (it only keeps tool LENGTH) — geometry
 * still drives every preview. See [[controller-import-remote-sim]].
 */

// Included-angle defaults (deg) for conical tools when the library record has no explicit angle.
const DEFAULT_ANGLE = { vbit: 90, chamfer: 90, engraver: 30, spotdrill: 90, drill: 118 };

const numOr = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

/**
 * Half-profile (one side of the revolved silhouette) as [radius, height] points, tip at height 0.
 * `radius` = distance from the tool axis (mm); `height` = up from the tip (mm). Caller mirrors + scales.
 */
export function toolHalfProfile(tool) {
    const type = (tool && tool.type) || 'endmill';
    const dia = numOr(tool && tool.dia, 6);
    const r = dia / 2;
    const len = numOr(tool && tool.length, dia * 4);
    const ang = numOr(tool && tool.angle, DEFAULT_ANGLE[type] || 0);

    switch (type) {
        case 'ballnose': {                          // hemispherical tip of radius r, then straight shank
            const pts = []; const segs = 10;
            for (let i = 0; i <= segs; i++) { const a = (Math.PI / 2) * (i / segs); pts.push([r * Math.sin(a), r - r * Math.cos(a)]); }
            pts.push([r, Math.max(len, r)]);
            return pts;
        }
        case 'vbit': case 'chamfer': case 'engraver': case 'spotdrill': {   // cone to full Ø, then shank
            const coneH = r / Math.tan((ang || 90) / 2 * Math.PI / 180);
            return [[0, 0], [r, coneH], [r, Math.max(len, coneH)]];
        }
        case 'drill': {                             // pointed tip (point angle), then flutes
            const tipH = r / Math.tan((ang || 118) / 2 * Math.PI / 180);
            return [[0, 0], [r, tipH], [r, Math.max(len, tipH)]];
        }
        case 'tapered': {                           // small flat tip widening to Ø over the flute
            const tip = r * 0.3;
            return [[tip, 0], [r, len * 0.6], [r, len]];
        }
        case 'face': case 'surfacing':              // wide, short body (face/fly cutter)
            return [[r, 0], [r, Math.max(len * 0.35, r * 0.6)]];
        case 'tap': case 'reamer':
        case 'endmill': default:                    // straight flat-bottom cylinder
            return [[r, 0], [r, len]];
    }
}

/** SVG string of the tool (mirrored half-profile) fit into w×h px. Tip at the bottom. */
export function toolProfileSvg(tool, { w = 40, h = 60, color = 'var(--accent, #6cc)', stroke = '#888', bg = 'transparent' } = {}) {
    const half = toolHalfProfile(tool);
    const maxR = Math.max(0.1, ...half.map((p) => p[0]));
    const maxZ = Math.max(0.1, ...half.map((p) => p[1]));
    const pad = 3;
    const sx = (w / 2 - pad) / maxR;            // px per mm radius (fit width)
    const sz = (h - 2 * pad) / maxZ;            // px per mm length (fit height) — non-uniform so it always fits
    const cx = w / 2;
    const toXY = (p, sign) => [(cx + sign * p[0] * sx).toFixed(1), ((h - pad) - p[1] * sz).toFixed(1)];
    const right = half.map((p) => toXY(p, 1));
    const left = half.slice().reverse().map((p) => toXY(p, -1));
    const poly = right.concat(left).map((q) => q[0] + ',' + q[1]).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="tool-profile" aria-hidden="true">`
        + (bg !== 'transparent' ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : '')
        + `<polygon points="${poly}" fill="${color}" stroke="${stroke}" stroke-width="0.6" stroke-linejoin="round"/></svg>`;
}
