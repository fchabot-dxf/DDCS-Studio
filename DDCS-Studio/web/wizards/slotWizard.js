/**
 * wizards/slotWizard.js — slot milling generator (Mill group).
 *
 * Mills a straight slot from point A to point B at a given width (≥ tool Ø), stepping down in Z.
 * The tool CENTRE travels A→B, so the cut is `width` wide with semicircular ends a tool-radius beyond
 * A and B. width = tool → a single centreline pass; width > tool → parallel passes along the slot
 * axis, offset perpendicular by the stepover, zig-zagged. Flat G0/G1 in the active WCS — no #vars.
 */
import { headerBlock, footerBlock } from './cuttingBlocks.js';
import { depthLevels } from './clearing.js';
import { slotPath } from './ops/slot.js';

function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }
const r3 = (n) => Math.round(n * 1000) / 1000;

export class SlotWizard {
    generate(params) {
        const tool = Math.max(0.1, num(params.toolDia, 6));
        const width = Math.max(tool, num(params.width, tool));
        const depth = num(params.depth, 4);
        const levels = depthLevels(depth, num(params.stepdown, 1.5));
        const dx = num(params.bx, 60) - num(params.ax, 0), dy = num(params.by, 0) - num(params.ay, 0);
        const len = Math.hypot(dx, dy);

        // Emit through the shared slotPath kernel (the same one the Slot block uses) so wizard == block.
        const L = [
            `( Slot - ${r3(len)} mm long, ${width} mm wide - DDCS Studio )`,
            `( tool Ø${tool} | depth ${depth} in ${levels.length} pass${levels.length > 1 ? 'es' : ''} )`,
            ...headerBlock(params),
            ...slotPath({ ...params, x0: params.ax, y0: params.ay, x1: params.bx, y1: params.by, tool, width }),
        ];
        L.push(...footerBlock(params));
        return L.join('\n');
    }
}
