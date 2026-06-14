/**
 * wizards/slotWizard.js — slot milling generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `slotStack(params)` → a single Slot atom,
 * emitted through emitMapped. The Slot atom owns the geometry (slotPath kernel): a widened channel from
 * (ax,ay)→(bx,by) at any angle, width ≥ tool, zig-zag offset passes stepping down. Form and Blocks view are
 * two editors of this one stack.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { num } from './ops/util.js';

const r3 = (n) => Math.round(n * 1000) / 1000;

/** Slot params → [ Slot ]. The one source of truth for both displays. */
export function slotStack(params = {}) {
    const slot = newBlock('slot');
    slot.params = {
        x0: num(params.ax, 0), y0: num(params.ay, 0), x1: num(params.bx, 60), y1: num(params.by, 0),
        width: num(params.width, num(params.toolDia, 6)), tool: num(params.toolDia, 6),
        stepoverPct: num(params.stepoverPct, 40), depth: num(params.depth, 4), stepdown: num(params.stepdown, 1.5),
        feed: num(params.feed, 600), plunge: num(params.plunge, 150), clearance: num(params.clearance, 5),
    };
    return [slot];
}

export class SlotWizard {
    generate(params) {
        const dx = num(params.bx, 60) - num(params.ax, 0), dy = num(params.by, 0) - num(params.ay, 0);
        const len = Math.hypot(dx, dy);
        const tool = Math.max(0.1, num(params.toolDia, 6)), width = Math.max(tool, num(params.width, tool));
        const title = `( Slot - ${r3(len)} mm long, ${width} mm wide - DDCS Studio )`;
        return emitMapped(slotStack(params), { ...params, title }).text;
    }
}
