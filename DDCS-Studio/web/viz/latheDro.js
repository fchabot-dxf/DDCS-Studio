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
