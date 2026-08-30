/**
 * wizards/ops/distmode.js — DISTANCE MODE (Machine): G90 absolute / G91 incremental.
 *
 * A modal state primitive, not a Move input — set it once and every motion below inherits it (the same reason
 * WCS / Spindle / Feed are their own blocks instead of per-Move fields). Keeps Move minimal and reusable.
 */
export const distModeBlock = {
    type: 'distmode', label: 'Distance', kind: 'leaf', category: 'Coordinates',
    help: "Sets whether every move below is measured from the part-zero (absolute, G90) or from wherever the tool currently is (incremental, G91). Switch back to absolute when you're done with a relative stretch — an incremental move left on is an easy way to cut in the wrong place.",
    defaults: { dist: 'abs' },
    fields: ['dist'],          // select: abs (G90) / inc (G91)
    emit: (p) => [`${p.dist === 'inc' ? 'G91' : 'G90'}   ( ${p.dist === 'inc' ? 'incremental' : 'absolute'} )`],
};
