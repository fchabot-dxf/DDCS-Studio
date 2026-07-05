// viz/pathStyle.js — THE ONE declared source of the path-visual palette (t317 unification).
// TYPE (color · dash · widthScale · shape) is ORTHOGONAL to STATE (alpha · width): a renderer COMPOSES them —
//   color = TYPE.color · dash = TYPE.dash · width = STATE.width × TYPE.widthScale · alpha = STATE.alpha · shape = TYPE.shape.
// Both path renderers (viz/toolpath2d 2D, viz/gcodeViz3d 3D) AND the legend (createPreviewPanel) read this, collapsing
// the four hand-maintained palette copies to one — so a value edit (the human's coming mods, t312d) lands ONCE and hits
// both previews. Built at the CURRENT values = byte-neutral, plus the 2 agreed micro-fixes: (1) jog is ONE amber #ff9a0d
// (the 2D had borrowed the start-marker #ffb300); (2) the legend Cut chip is the real gradient-high #35ffd0 (was a
// transposed #35d0ff). NOTE: colours are hex INTEGERS (canonical) — the 3D uses them as THREE.Color(int), the 2D + legend
// via hexCss(). The start-marker amber/cyan (#ffb300 / #22d3ee) is a SEPARATE glyph layer, not a path TYPE — not here.

// Feed depth-gradient endpoints (shared 2D + 3D): the colour at the DEEPEST Z → the TOP Z.
export const FEED_LOW = 0x0a4fd0, FEED_HIGH = 0x35ffd0;

/** hex int → a lowercase '#rrggbb' CSS string (byte-identical to the old inline literals). */
export const hexCss = (n) => '#' + (((n >>> 0) & 0xffffff)).toString(16).padStart(6, '0');

/** The per-TYPE style. `color` = a hex int (feed's flat/legend colour = the gradient TOP). `dash` = a canvas
 *  setLineDash array ([] = solid). `widthScale` multiplies the STATE width (rapid/jog draw thinner). `shape` =
 *  'line' | 'arc' (a manual jog bows). `gradient` (feed only) = the depth endpoints. */
export const PATH_TYPES = {
    rapid:     { color: 0xffcc00, dash: [5, 4], widthScale: 0.6, shape: 'line', label: 'Rapid' },
    feed:      { color: FEED_HIGH, dash: [],    widthScale: 1,   shape: 'line', label: 'Cut', gradient: [FEED_LOW, FEED_HIGH] },
    probeFast: { color: 0x3b82f6, dash: [2, 3], widthScale: 1,   shape: 'line', label: 'Probe' },
    probeSlow: { color: 0xffffff, dash: [2, 3], widthScale: 1,   shape: 'line', label: 'Probe slow' },   // t319 — WHITE (was #93c5fd); drawn ON TOP of the fast blue at the collinear re-probe overlap

    retract:   { color: 0x33cc55, dash: [],     widthScale: 1,   shape: 'line', label: 'Retract' },
    jog:       { color: 0xff9a0d, dash: [5, 4], widthScale: 0.6, shape: 'arc',  label: 'Jog' },   // #ff9a0d = the ONE amber (micro-fix; the 2D had borrowed the #ffb300 start-marker amber)
};

/** STATE (progress) tokens — orthogonal to TYPE. A renderer picks static / future(untraveled) / traveled.
 *  `future.alpha` is shared by the 2D untraveled path AND the 3D _dimRoute guide; the widths are the 2D stroke widths. */
export const PATH_STATE = {
    static:   { alpha: 1,   width: 2 },
    future:   { alpha: 0.8, width: 1.5 },
    traveled: { alpha: 1,   width: 3.12 },
};

/** The live red probe-head dot (the moving tool tip). */
export const HEAD = { color: 0xff2a44, r: 4 };

/** The ON-TOUCH PULSE (t319/INC-6) — a transient white flash at each G31 contact, in lockstep with the red probe head,
 *  in BOTH previews. colour/alpha/fadeMs are SHARED; SIZE is PER-RENDERER (t331 — the 3D disc is a WORLD-projected radius,
 *  the 2D pulse a CANVAS-px radius; the two scales legitimately differ, so size lives in px3D/px2D — but BOTH read from HERE,
 *  no rogue base). Each is {fast, slow} with SLOW (fine re-probe) BIGGER than FAST. The 2D draws the HONEST TOP-VIEW
 *  PROJECTION (a CIRCLE for a Z/surface touch, a LINE along the wall tangent for an X/Y wall touch); the 3D an oriented
 *  feed-scaled disc that interpolates between px3D.fast (a fast probe) and px3D.slow (a slow re-probe). fadeMs = the
 *  SIM-time fade (speed-scaled), same both. Human-tuned (t331): 3D DOWN (~half), 2D UP (~2×) vs the old 200-base / 7-14. */
export const TOUCH_PULSE = {
    color: 0xffffff, alpha: 0.3, fadeMs: 16000,   // SHARED across both views
    px2D: { fast: 14, slow: 28 },                 // 2D canvas-px radius (t331 — 2× the old 7/14; the Layout pulses were too small)
    px3D: { fast: 60, slow: 180 },                // 3D disc-radius endpoints (t331 — ~half the old 120/360; the discs were too big)
};
/** The 2D pulse canvas-px size for a touch: SLOW (fine re-probe) is BIGGER than FAST. */
export const pulsePx = (slow) => (slow ? TOUCH_PULSE.px2D.slow : TOUCH_PULSE.px2D.fast);

/** Feed depth-gradient lerp for the 2D: FEED_LOW→FEED_HIGH by t∈[0,1] → an 'rgb(r,g,b)' string (byte-identical to
 *  the old lerpHex). The 3D lerps the same endpoints per-vertex via THREE.Color. */
export function feedRgb(t) {
    t = Math.max(0, Math.min(1, t));
    const r1 = (FEED_LOW >> 16) & 255, g1 = (FEED_LOW >> 8) & 255, b1 = FEED_LOW & 255;
    const r2 = (FEED_HIGH >> 16) & 255, g2 = (FEED_HIGH >> 8) & 255, b2 = FEED_HIGH & 255;
    return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

/** The LEGEND rows (order · label · resolved CSS colour), read by createPreviewPanel.renderLegend. Colours resolve
 *  FROM PATH_TYPES so the legend can't drift from the renderers (the #35d0ff Cut typo is fixed by reading feed.color). */
export const LEGEND_ROWS = [
    { key: 'feed',      label: PATH_TYPES.feed.label,      color: hexCss(PATH_TYPES.feed.color) },   // #35ffd0 (was the transposed #35d0ff)
    { key: 'probe',     label: PATH_TYPES.probeFast.label, color: hexCss(PATH_TYPES.probeFast.color) },
    { key: 'probeSlow', label: PATH_TYPES.probeSlow.label, color: hexCss(PATH_TYPES.probeSlow.color) },
    { key: 'retract',   label: PATH_TYPES.retract.label,   color: hexCss(PATH_TYPES.retract.color) },
    { key: 'jog',       label: PATH_TYPES.jog.label,       color: hexCss(PATH_TYPES.jog.color) },
    { key: 'rapid',     label: PATH_TYPES.rapid.label,     color: hexCss(PATH_TYPES.rapid.color) },
];

/** Publish the palette as CSS custom properties so the (legacy) `.viz-legend-line` CSS also reads this ONE source.
 *  The CSS rules consume them via var(--viz-path-*, <current fallback>) → byte-neutral even before/without this call. */
export function applyPathVars(root) {
    const el = root || (typeof document !== 'undefined' ? document.documentElement : null);
    if (!el || !el.style) return;
    el.style.setProperty('--viz-path-rapid', hexCss(PATH_TYPES.rapid.color));
    el.style.setProperty('--viz-path-retract', hexCss(PATH_TYPES.retract.color));
    el.style.setProperty('--viz-path-probe', hexCss(PATH_TYPES.probeFast.color));
    el.style.setProperty('--viz-path-jog', hexCss(PATH_TYPES.jog.color));
    el.style.setProperty('--viz-path-feed-low', hexCss(FEED_LOW));
    el.style.setProperty('--viz-path-feed-high', hexCss(FEED_HIGH));
}
if (typeof document !== 'undefined') applyPathVars();   // one-source the CSS legend on load
