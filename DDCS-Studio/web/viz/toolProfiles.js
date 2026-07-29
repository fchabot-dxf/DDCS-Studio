/**
 * viz/toolProfiles.js — THE AUTHORED CUTTING SILHOUETTE (t1325).
 *
 * A lathe tool's shape is not a type name. Two 93° holders grind differently, a parting blade gets re-sharpened
 * narrower, and a worn insert is a different tool from the one in the catalogue. So the silhouette is AUTHORED: a
 * plain polyline in the XZ plane that the user drags into the shape of the tool actually clamped in their post.
 *
 * ── THE FRAME ────────────────────────────────────────────────────────────────────────────────────────────────────
 * Points are [z, x] in the LATHE frame the rest of the app already declares (data/lathe.js): Z runs along the bar,
 * X is a RADIUS off the centreline, and the cut runs −Z toward the chuck. The profile is stored TIP-RELATIVE — the
 * tip is (0,0) — so a tool's shape is independent of where it is positioned, which is what lets the same points be
 * drawn in the 3D at the declared toolPost side and in the 2D at the cut.
 *
 * ── STARTER, NOT TEMPLATE ────────────────────────────────────────────────────────────────────────────────────────
 * Each kind's profile below is a STARTER: prefilled on a new tool of that kind and then dragged. Once dragged it is
 * the user's, stored as plain points on the tool record and travelling in the .ddcs like every other machine fact.
 * Nothing re-derives it from the kind afterwards — that would be inferring the shape back out of the type name,
 * which is exactly the thing being replaced.
 *
 * ── WHAT THE PROFILE IS USED FOR — v1 HONESTY ────────────────────────────────────────────────────────────────────
 * The profile is DRAWN (3D + 2D) and it is what the operator checks their grind against. THE CARVE STAYS
 * POINT-INSERT: the sim removes material at the tool's TIP POINT, not by sweeping this silhouette through the stock.
 * So a wide parting blade's kerf is not yet cut to width in the preview, and a nose radius does not yet round the
 * corner the sim shows. Stated here, and again at each consumer, in the same spirit as the round-blank carve: the
 * picture is honest about being a picture.
 */

const P = (z, x) => [z, x];

/**
 * THE STARTERS, tip at (0,0). Shapes are drawn walking the cutting edge from the front clearance round to the shank,
 * so a drag point always sits on an edge the turner recognises.
 */
export const STARTER_PROFILES = {
    // A 93° OD/facing insert: the lead edge rakes back off the tip, the trailing edge clears the shoulder.
    turning: [P(0, 0), P(-0.6, 1.6), P(-1.2, 5.2), P(4.4, 8.2), P(7.2, 8.2), P(7.2, 1.0), P(2.0, 0.2)],
    // A blade: two parallel flanks and a flat tip — the width between the flanks IS the kerf.
    parting: [P(0, 0), P(0, 6.5), P(3.0, 6.5), P(3.0, 0)],
    // A centre drill: the short stiff pilot with its 60° point.
    centredrill: [P(0, 0), P(1.3, 1.5), P(4.0, 1.5), P(4.6, 3.2), P(12, 3.2), P(12, 0)],
    // A twist drill: the 118° point then a parallel body.
    drill: [P(0, 0), P(1.8, 3.0), P(26, 3.0), P(26, 0)],
};

/** The starter for a kind (a copy — a caller edits its own points, never the declaration). */
export function starterProfile(kind) {
    const p = STARTER_PROFILES[kind] || STARTER_PROFILES.turning;
    return p.map(([z, x]) => [z, x]);
}

/** A tool's profile: the AUTHORED points when it has them, else the kind's starter. `authored` says which, so a
 *  surface can tell the user whether they are looking at their grind or at a starting point. */
export function profileOf(tool, kind) {
    const pts = tool && Array.isArray(tool.profile) ? tool.profile.filter((p) => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isFinite(Number(n)))) : [];
    return pts.length >= 2 ? { points: pts.map(([z, x]) => [Number(z), Number(x)]), authored: true }
        : { points: starterProfile(kind || (tool && tool.kind) || 'turning'), authored: false };
}

/** The profile's bounding box in tool coords — the framing every renderer needs. */
export function profileBounds(points) {
    const zs = points.map((p) => p[0]), xs = points.map((p) => p[1]);
    return { z0: Math.min(...zs), z1: Math.max(...zs), x0: Math.min(...xs), x1: Math.max(...xs) };
}

/**
 * Render a profile as a small SVG, tip marked. `flip` mirrors X for a front toolPost (the tool hangs the other way),
 * which is the same declared side the 3D reads — the picture must not disagree with the machine.
 */
export function profileSvg(points, opts = {}) {
    const w = opts.w || 64, h = opts.h || 44, pad = 4;
    const b = profileBounds(points);
    const sz = Math.max(1e-6, b.z1 - b.z0), sx = Math.max(1e-6, b.x1 - b.x0);
    const k = Math.min((w - pad * 2) / sz, (h - pad * 2) / sx);
    const fx = opts.flip ? -1 : 1;
    // screen: Z runs left→right, X (the radius) runs UP — the half-profile drawing convention the 2D view already uses
    const sxp = (z) => pad + (z - b.z0) * k;
    const syp = (x) => h - pad - (x - b.x0) * k * fx - (opts.flip ? -(sx * k) : 0);
    const d = points.map((p, i) => (i ? 'L' : 'M') + sxp(p[0]).toFixed(2) + ' ' + syp(p[1]).toFixed(2)).join(' ') + ' Z';
    const tip = points[0];
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">'
        + '<path d="' + d + '" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>'
        + '<circle cx="' + sxp(tip[0]).toFixed(2) + '" cy="' + syp(tip[1]).toFixed(2) + '" r="1.9" fill="#ffb020"/>'
        + '</svg>';
}

// ── THE EDITOR (t1325) ───────────────────────────────────────────────────────────────────────────────────────────
/**
 * A FeatureCanvas spec for DRAGGING a profile into shape: one handle per point, on the same machinery every other
 * canvas in the app uses (latheProfileCanvas's tieDiagTravel pattern — a handle is a second way to type a number,
 * never a second source of truth). `onChange(points)` receives the whole updated polyline on every drag, so the
 * caller stores exactly what is drawn and nothing re-derives the shape afterwards.
 *
 * TEAL vs AMBER, the app's declared convention: these handles are AMBER. A profile point drives the PICTURE — the
 * 3D silhouette and the 2D at the cut — and, per this version's honesty, nothing else: the carve is still
 * point-insert, so no emitted number moves when a point moves. The colour says that out loud.
 */
export function toolProfileSpec(points, onChange) {
    const pts = points.map(([z, x]) => [z, x]);
    const b = profileBounds(pts);
    return {
        // the frame is the tool's own bounding box, with the centreline-ward edge at 0 so the tip reads as the origin
        stock: { ox: b.z0, oy: Math.min(0, b.x0), w: Math.max(1e-3, b.z1 - b.z0), h: Math.max(1e-3, b.x1 - Math.min(0, b.x0)) },
        // THE SILHOUETTE AS A CHAIN OF `line` ITEMS, closed. FeatureCanvas draws circle/line/rect/hole and NOTHING
        // else — a `poly` kind was written here first and would have drawn absolutely nothing, which is the very trap
        // latheProfileCanvas already records in its own comment (an invented class matched no rule and the shape was
        // invisible until someone opened the real wizard). Declared kinds only.
        items: [
            ...pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return { kind: 'line', x1: p[0], y1: p[1], x2: q[0], y2: q[1], cls: 'fc-feature-pocket' }; }),
            // the tool's own axis through the tip, so "where the tip is" is never ambiguous while dragging
            { kind: 'line', x1: b.z0, y1: 0, x2: b.z1, y2: 0 },
        ],
        // AMBER-equivalent point handles (the plain `.fc-handle` circle — not a `move` start-marker, not teal): the
        // point drives the PICTURE only, because the carve is still point-insert.
        handles: pts.map(([z, x], i) => ({
            id: 'pt' + i, x: z, y: x, label: i === 0 ? 'tip' : '', value: i,
        })),
        onDrag: (id, world) => {
            const i = parseInt(String(id).replace('pt', ''), 10);
            if (!Number.isFinite(i) || !pts[i] || typeof onChange !== 'function') return;
            pts[i] = [Math.round(world.x * 1000) / 1000, Math.round(world.y * 1000) / 1000];
            onChange(pts.map(([z, x]) => [z, x]));
        },
    };
}
