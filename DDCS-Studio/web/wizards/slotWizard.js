/**
 * wizards/slotWizard.js — slot milling generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `slotStack(params)` → a single Slot atom,
 * emitted through emitMapped. The Slot atom owns the geometry (slotPath kernel): a widened channel from
 * (ax,ay)→(bx,by) at any angle, width ≥ tool, zig-zag offset passes stepping down. Form and Blocks view are
 * two editors of this one stack.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { makeStart, makeEnd } from '../blocks/programFraming.js';
import { num } from './ops/util.js';

/** Slot params → [ Program Start, Slot, Program End ]. The one source of truth for both displays. */
export function slotStack(params = {}) {
    const slot = newBlock('slot');
    slot.params = {
        x0: num(params.ax, 0), y0: num(params.ay, 0), x1: num(params.bx, 60), y1: num(params.by, 0),
        width: num(params.width, num(params.toolDia, 6)), tool: num(params.toolDia, 6),
        stepoverPct: num(params.stepoverPct, 40), depth: num(params.depth, 4), stepdown: num(params.stepdown, 1.5),
        feed: num(params.feed, 600), plunge: num(params.plunge, 150), clearance: num(params.clearance, 5),
    };
    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };   // 'active' emits nothing
    return [makeStart(params), wcs, slot, makeEnd(params)];
}

export class SlotWizard {
    generate(params) {
        recordOp('slot', params);   // let the Blocks tab open this op as its stack
        return emitMapped(slotStack(params)).text;
    }
}
