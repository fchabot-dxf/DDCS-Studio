/**
 * engine/workpiece.js — the WORKPIECE projection SEAM (P0 of the stock→workpiece pivot).
 *
 * "stock" stays a FLAT object in settings (settingsPanel.js SETTINGS_DEFAULTS.stock) so every existing
 * reader keeps working byte-identically — nothing is migrated here. getWorkpiece() PROJECTS that flat
 * stock into a richer { outer, features[] } VIEW, exactly mirroring the derived views
 * stockForViz/wcsForViz/machineForViz (createPreviewPanel.js:54-67): a declare-once-read-everywhere
 * projection, not a storage rewrite. The workpiece is what the helper PRESENTS, not what is stored.
 *
 * The two orthogonal axes are DECLARED (F1): a feature's SHAPE (rect|round) and SIDE (inside|outside);
 * `featureType` is DERIVED from them, never stored. INSIDE (pocket/bore) = a cavity that carries its own
 * size; OUTSIDE (boss/round-boss) = the feature IS the stock outline → featureSize() falls back to the
 * outer block (F3 — the side toggle IS the shared-vs-per-op resolver). Back-compat lives entirely inside
 * this file: a legacy `pocket` stock (no declared features) synthesizes the EXACT 25% cavity the current
 * 3D/2D hardcode draws (gcodeViz3d.js:1098 / middleView.js:48), so legacy renders byte-identical.
 */

// featureType DERIVED from {shape, side} — the taxonomy is shape × side; the name is never stored (F1).
const TYPE_BY_SHAPE_SIDE = {
    rect:  { outside: 'boss',       inside: 'pocket' },
    round: { outside: 'round-boss', inside: 'bore'   },
};

/** The DERIVED feature label from its two declared axes (shape × side). null for an unknown combo. */
export function featureType(f) {
    const bySide = f && TYPE_BY_SHAPE_SIDE[f.shape];
    return (bySide && bySide[f.side]) || null;
}

/**
 * The side toggle IS the shared-vs-per-op resolver (F3): an INSIDE cavity carries its own size; an
 * OUTSIDE feature (boss/round-boss) has none — it inherits the outer block (the feature IS the outline).
 */
export function featureSize(wp, f) {
    if (f && f.side === 'inside') return f.size || null;
    const o = wp && wp.outer;
    return o ? { x: o.x, y: o.y, d: o.d } : null;
}

/** The legacy pocket wall thickness (cavity inset) — reproduces gcodeViz3d.js:1098 / middleView.js:48 EXACTLY. */
export function legacyPocketInset(x, y) {
    return Math.max(8, Math.min(x, y) * 0.25);
}

/**
 * Synthesize the features[] a LEGACY flat stock implies. Only `shape:'pocket'` implies an interior
 * feature — a centred rectangular cavity inset by the 25% wall, full-depth — matching exactly what the
 * 3D/2D currently draw. boss/box/cylinder imply NO stored feature (they probe the outer outline, so
 * featureSize() resolves to outer). Returns a FRESH array so the caller never shares mutable state.
 */
export function deriveLegacyFeatures(stock) {
    if (!stock || stock.shape !== 'pocket') return [];
    const x = +stock.x, y = +stock.y, z = +stock.z;
    const w = legacyPocketInset(x, y);
    return [{
        id: 'legacy',
        shape: 'rect',
        side: 'inside',
        pos:  { x: x / 2, y: y / 2 },            // centred; outer-local (0,0 = outer min corner — SAME frame as setStock)
        size: { x: x - 2 * w, y: y - 2 * w },    // the cavity span [w, x-w] × [w, y-w]
        depth: z,                                // full-through (the extrude depth, gcodeViz3d.js:1108)
    }];
}

/**
 * PROJECT a flat settings.stock → the workpiece VIEW { outer, features[] }. Pure + side-effect-free, so
 * it's testable as plain data. Back-compat: boss|box|pocket → outer.shape 'rect'; cylinder → 'round';
 * diameter → outer.d; datum/pin/show ride verbatim. Declared features[] win; else legacy is synthesized.
 */
export function projectWorkpiece(stock) {
    const s = stock || {};
    const outer = {
        shape: s.shape === 'cylinder' ? 'round' : 'rect',   // boss|box|pocket → rect; cylinder → round
        x: s.x, y: s.y, z: s.z,
        d: s.diameter,                                       // undefined unless a cylinder OD was declared
        datum: s.datum, pin: s.pin, show: s.show,
    };
    const features = (Array.isArray(s.features) && s.features.length) ? s.features : deriveLegacyFeatures(s);
    return { outer, features };
}

/** The LIVE reader — mirrors stockForViz (createPreviewPanel.js:54): project whatever settings.stock is now. */
export function getWorkpiece() {
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
    return projectWorkpiece(s);
}
