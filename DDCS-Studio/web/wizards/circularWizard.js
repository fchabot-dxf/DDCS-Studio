/**
 * DDCS Studio - Circular (bore/boss) probe — RETIRED as a standalone wizard 2026-06-23.
 *
 * Superseded by the Middle wizard (circular + probe-both-axes), which finds the centre AND reports the
 * diameter + out-of-round (#58/#59/#60/#61) for a round bore/boss. This thin shim stays ONLY so the
 * Blocks/Blockly layer (opStacks `circular`, the `circular_op` block) keeps resolving and any previously
 * saved circular ops still render — it now DELEGATES to middleStack, so there is no duplicated probe
 * sequence. New work uses the Middle wizard.
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { recordOp } from '../blocks/opRecord.js';
import { middleStack, MiddleWizard } from './middleWizard.js';

// Map the old Circular params onto Middle's circular + both-axes mode (bore→pocket, boss→boss).
function toMiddleParams(params = {}) {
    const boss = params.featureType === 'boss';
    return {
        ...params,
        featureType: boss ? 'boss' : 'pocket',
        circular: true,
        findBoth: true,
        twoAxis: true,
        axis: 'X',
        dir1: 'pos',
        approach: boss ? 'manual' : 'auto',   // Circular's boss always paused between faces (manual-style)
    };
}

export function circularStack(params = {}) {
    return middleStack(toMiddleParams(params));
}

export class CircularWizard {
    generate(params) {
        recordOp('circular', params);
        return emitMapped(circularStack(params)).text;
    }

    inferStart(params, stock) {
        return new MiddleWizard().inferStart(toMiddleParams(params), stock);
    }
}
