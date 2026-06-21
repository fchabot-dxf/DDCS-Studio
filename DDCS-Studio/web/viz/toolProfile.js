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
            const pts = []; const segs = 18;
            for (let i = 0; i <= segs; i++) { const a = (Math.PI / 2) * (i / segs); pts.push([r * Math.sin(a), r - r * Math.cos(a)]); }
            pts.push([r, Math.max(len, r * 2)]);
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
        case 'probe': {                             // 3D touch probe: ruby ball ▸ thin stylus ▸ wide body ▸ shank (dia = shank Ø)
            const rball = Math.max(1, r * 0.5);     // ruby ball
            const rsty = Math.max(0.5, r * 0.22);   // stylus shaft
            const styL = Math.max(len, r * 7);      // stylus length (20–50 mm range)
            const rbody = 15;                       // electronics body disc (~Ø30)
            const bodyL = Math.max(r * 6, 28);
            const shankL = Math.max(r * 3, 16);
            const pts = []; const segs = 12;
            for (let i = 0; i <= segs; i++) { const a = (Math.PI / 2) * (i / segs); pts.push([rball * Math.sin(a), rball - rball * Math.cos(a)]); }  // ruby ball tip
            pts.push([rsty, rball]);                // narrow to the stylus
            const styTop = rball + styL; pts.push([rsty, styTop]);
            pts.push([rbody, styTop]);              // step out to the body
            const bodyTop = styTop + bodyL; pts.push([rbody, bodyTop]);
            pts.push([r, bodyTop]);                 // step in to the shank
            pts.push([r, bodyTop + shankL]);
            return pts;
        }
        case 'tap': case 'reamer':
        case 'endmill': default:                    // straight flat-bottom cylinder
            return [[r, 0], [r, len]];
    }
}

/** SVG string of the tool (mirrored half-profile) fit into w×h px, tip at the bottom.
 *  Scaling is UNIFORM (same px/mm on both axes) so the geometry is true — a ballnose reads as a real hemisphere
 *  and a V-bit keeps its real included angle. A long shank is truncated to `maxAspect`× the tool width so the
 *  cutter doesn't shrink to a sliver (shank length isn't cutting geometry; the tip is what must be accurate). */
export function toolProfileSvg(tool, { w = 40, h = 60, color = 'var(--accent, #6cc)', stroke = '#888', bg = 'transparent', maxAspect = 2.6 } = {}) {
    const half = toolHalfProfile(tool);
    const maxR = Math.max(0.1, ...half.map((p) => p[0]));
    const fullZ = Math.max(0.1, ...half.map((p) => p[1]));
    const drawnZ = Math.min(fullZ, 2 * maxR * maxAspect);             // cap the drawn length for the icon
    const clipped = half.map((p) => [p[0], Math.min(p[1], drawnZ)]);  // clamp the shank top to the cap
    const pad = 3;
    const s = Math.min((w / 2 - pad) / maxR, (h - 2 * pad) / drawnZ); // UNIFORM scale, fit within the box
    const cx = w / 2;
    const baseY = (h + drawnZ * s) / 2;                              // vertically centred; tip at the bottom
    const toXY = (p, sign) => [(cx + sign * p[0] * s).toFixed(1), (baseY - p[1] * s).toFixed(1)];
    const right = clipped.map((p) => toXY(p, 1));
    const left = clipped.slice().reverse().map((p) => toXY(p, -1));
    const poly = right.concat(left).map((q) => q[0] + ',' + q[1]).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="tool-profile" aria-hidden="true">`
        + (bg !== 'transparent' ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : '')
        + `<polygon points="${poly}" fill="${color}" stroke="${stroke}" stroke-width="0.6" stroke-linejoin="round"/></svg>`;
}
