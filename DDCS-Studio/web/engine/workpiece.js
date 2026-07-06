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
 * Part-zero (the datum) in the outer's MIN-XY frame — the reference a feature's `pos` is measured FROM. The datum
 * code is 3 chars [X][Y][Z] each n(min)/c(centre)/p(max); the XY pair places part-zero on the block. So a feature
 * `pos` is a datum-RELATIVE offset (how a CNC operator reads it: distance from program zero), and its canvas/world
 * position is datumXY + pos. For the default front-left datum ('nnp') datumXY = {0,0}, so pos == the min-XY position.
 */
export function datumXY(outer) {
    const o = outer || {};
    const code = /^[ncp]{3}$/.test(String(o.datum)) ? String(o.datum) : 'nnp';
    const f = { n: 0, c: 0.5, p: 1 };
    return { x: (+o.x || 0) * f[code[0]], y: (+o.y || 0) * f[code[1]] };
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
    const dp = datumXY({ x, y, datum: stock.datum });   // the cavity is CENTRED on the block; its pos is datum-RELATIVE
    return [{
        id: 'legacy',
        shape: 'rect',
        side: 'inside',
        pos:  { x: x / 2 - dp.x, y: y / 2 - dp.y },   // the block centre as an offset from part-zero ('nnp' → {x/2,y/2})
        size: { x: x - 2 * w, y: y - 2 * w },         // the cavity span [w, x-w] × [w, y-w]
        depth: z,                                     // full-through (the extrude depth, gcodeViz3d.js:1108)
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

/**
 * Produce a FeatureCanvas spec { stock:{w,h,ox,oy}, items:[cavity glyphs] } from a workpiece — the ONE
 * SOURCE for the 2D top-down backdrop (P1/P5 migrate the ~13 hand-rolled stock→{w,h,ox,oy} flattens to
 * this; the stock modal is its FIRST consumer). The OUTER block is the fc-stock rect (spec.stock). An
 * INSIDE feature (pocket/bore) draws a filled fc-feature-pocket cavity at its pos+size — the pocket rect
 * MATCHES middleView.buildFeatureItems exactly (so the modal and the wizard preview draw the identical
 * cavity), and a legacy pocket (from deriveLegacyFeatures) therefore shows as its derived cavity. OUTSIDE
 * features (boss/round-boss) ARE the outer outline → shown by fc-stock; how/if they overlay a glyph is a
 * later (P2 middleView-migration) decision, not made here.
 */
export function workpieceBackdrop(wp, opts) {
    const o = wp && wp.outer;
    if (!o || !(o.x > 0) || !(o.y > 0)) return { stock: null, items: [] };
    const ox = (opts && opts.ox) || 0, oy = (opts && opts.oy) || 0;
    const dp = datumXY(o);   // part-zero in the canvas MIN-XY frame; a feature's datum-relative pos → canvas = dp + pos
    const items = [];
    for (const f of (wp.features || [])) {
        if (f.side !== 'inside') continue;   // OUTSIDE = the outer outline (the fc-stock rect); INSIDE = a cavity glyph
        const sz = featureSize(wp, f);
        if (!sz) continue;
        const cx = dp.x + f.pos.x, cy = dp.y + f.pos.y;   // datum-relative offset → canvas position
        if (f.shape === 'round') {
            const r = (sz.d != null ? sz.d : Math.min(sz.x, sz.y)) / 2;
            items.push({ kind: 'circle', cx, cy, r, cls: 'fc-feature-pocket' });   // bore
        } else {
            items.push({ kind: 'rect', x: cx - sz.x / 2, y: cy - sz.y / 2, w: sz.x, h: sz.y, cls: 'fc-feature-pocket' });   // pocket cavity
        }
    }
    // origin = part-zero in the canvas frame → the crosshair sits at the selected datum corner (matches the 3D)
    return { stock: { w: o.x, h: o.y, ox, oy }, items, origin: { x: ox + dp.x, y: oy + dp.y } };
}
