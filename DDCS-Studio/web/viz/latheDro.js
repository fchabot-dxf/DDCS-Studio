/**
 * viz/latheDro.js — THE READOUT SPEAKS DIAMETER on a lathe (t1283).
 *
 * A turner reads diameters. The machine moves in radius, the emit writes radius, and `radiusOf()` in data/lathe.js
 * remains the ONE conversion in the other direction — this is a DISPLAY, not a second frame. Nothing here is fed
 * back into geometry, an emit, or a carve; it changes what the number on the screen SAYS, and marks it so the
 * operator can see which convention they are being shown.
 *
 * WHY IT IS MARKED AND NOT JUST DOUBLED: an unmarked doubled number is indistinguishable from a bug. The row says Ø.
 */
import { isLathe } from '../data/workspaceMachine.js';

/** The label a DRO row carries. Only X changes, and only on a lathe — Z was never a radius. */
export function droAxisLabel(axis, lathe = isLathe()) {
    const a = String(axis || '').toUpperCase();
    return (lathe && a === 'X') ? 'Ø' + a : a;
}

/** The number a DRO row shows. X on a lathe is shown as a DIAMETER; everything else passes through untouched. */
export function droValue(axis, value, lathe = isLathe()) {
    const v = Number(value);
    if (!Number.isFinite(v)) return value;
    return (lathe && String(axis).toLowerCase() === 'x') ? v * 2 : v;
}

/** Both at once, for a consumer filling a row. */
export const droRow = (axis, work, mach, lathe = isLathe()) => ({
    label: droAxisLabel(axis, lathe),
    work: droValue(axis, work, lathe),
    mach: droValue(axis, mach, lathe),
});

/**
 * t1301 — WHERE THE LATHE'S WORK ZERO IS, for a readout quoting a start-anchored probe.
 *
 * A start-anchored op reports its position relative to the operator START, and the sim expresses those starts in the
 * STOCK frame — whose origin is the box's min corner. On a mill that IS the part frame, so the readout has always
 * been right. A lathe bar's datum is its CENTRELINE (declared 'ccp'), which sits half a diameter away — so quoting the
 * stock number unchanged told a turner their stylus was a whole radius further out than it was.
 *
 * This is the SHIFT to take off before displaying, and nothing else reads it: geometry and emit are untouched.
 * @returns {{x:number, y:number}} zero for anything that is not a lathe bar
 */
export function droWorkShift(stock, lathe = isLathe()) {
    const s = stock || {};
    const isBar = lathe && s.shape === 'cylinder' && s.axis === 'z' && String(s.datum || '').slice(0, 2) === 'cc';
    if (!isBar) return { x: 0, y: 0 };
    return { x: (Number(s.x) || 0) / 2, y: (Number(s.y) || 0) / 2 };
}
