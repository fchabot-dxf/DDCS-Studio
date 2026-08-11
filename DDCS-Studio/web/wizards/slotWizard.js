/**
 * wizards/slotWizard.js — slot milling generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `slotStack(params)` → a single Slot atom,
 * emitted through emitMapped. The Slot atom owns the geometry (slotPath kernel): a widened channel from
 * (ax,ay)→(bx,by) at any angle, width ≥ tool, zig-zag offset passes stepping down. Form and Blocks view are
 * two editors of this one stack.
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
// t1728 (gameplan step 1) — the whole builder cluster (slotBBox/slotPatterned/slotPatternPoints/slotArrayBBox/
// SLOT_PATTERN_GAP/slotLeafParams/slotStackArmGap/slotStackRidesRaster/slotStack) MOVED to stacks/slotWizard.js
// (the twin's own builder dependency — slotStack's own body calls slotPatterned/slotArrayBBox internally, so they
// move together even though opCamMap.js and views/slotView.js also read slotPatterned/slotPatternPoints — both
// keep working unchanged via this re-export). Pure move, no signature change.
import {
    slotBBox, slotPatterned, slotPatternPoints, slotArrayBBox, SLOT_PATTERN_GAP,
    slotLeafParams, slotStackArmGap, slotStackRidesRaster, slotStack,
} from './stacks/slotWizard.js';
export {
    slotBBox, slotPatterned, slotPatternPoints, slotArrayBBox, SLOT_PATTERN_GAP,
    slotLeafParams, slotStackArmGap, slotStackRidesRaster, slotStack,
};

export class SlotWizard {
    generate(params) {
        recordOp('slot', params);   // let the Blocks tab open this op as its stack
        return emitMapped(slotStack(params), activeDialectOpts()).text;
    }
}
