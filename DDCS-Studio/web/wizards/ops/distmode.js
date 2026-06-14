/**
 * wizards/ops/distmode.js — DISTANCE MODE (Machine): G90 absolute / G91 incremental.
 *
 * A modal state primitive, not a Move input — set it once and every motion below inherits it (the same reason
 * WCS / Spindle / Feed are their own blocks instead of per-Move fields). Keeps Move minimal and reusable.
 */
export const distModeBlock = {
    type: 'distmode', label: 'Distance', kind: 'leaf', category: 'Machine',
    defaults: { dist: 'abs' },
    fields: ['dist'],          // select: abs (G90) / inc (G91)
    emit: (p) => [`${p.dist === 'inc' ? 'G91' : 'G90'}   ( ${p.dist === 'inc' ? 'incremental' : 'absolute'} )`],
};
