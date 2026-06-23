/**
 * DDCS Studio - ATC Spindle Warm-up Wizard — staged spindle warmup.
 *
 * REWRITTEN AS A BLOCK STACK: `atcWarmupStack(params)` builds from granular atoms (Comment / Confirm /
 * Spindle / Coolant / Dwell / Message / Label / End Program). Native across posts for free: the Dwell units
 * (ms on Expert/V4.1, seconds on DM500) and the Confirm gate (folds where there's no scripted HMI) come from
 * the active dialect. Form and Blocks view are two editors of this one stack.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';

export function atcWarmupStack(params = {}) {
    const rpm1 = num(params.rpm1, 6000), time1 = num(params.time1, 30);
    const rpm2 = num(params.rpm2, 12000), time2 = num(params.time2, 30);

    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };
    const CF = (msg, cancel) => { const b = newBlock('confirm'); b.params = { msg, cancel }; S.push(b); };
    const SP = (rpm) => { const b = newBlock('spindle'); b.params = { rpm, dir: 'cw' }; S.push(b); };
    const SPOFF = () => { const b = newBlock('spindle'); b.params = { rpm: 0 }; S.push(b); };
    const COOLOFF = () => { const b = newBlock('coolant'); b.params = { flow: 'off' }; S.push(b); };
    const DW = (sec) => { const b = newBlock('dwell'); b.params = { sec }; S.push(b); };
    const MSG = (text) => { const b = newBlock('message'); b.params = { text }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    const END = () => S.push(newBlock('endprogram'));

    C('Spindle Warm-up');
    C(`Stage 1: ${rpm1} RPM for ${time1}s`);
    C(`Stage 2: ${rpm2} RPM for ${time2}s`);
    CF('Warm up spindle? Press Enter', 999);
    SPOFF(); COOLOFF();                       // stop spindle & coolant first
    C('Stage 1');
    MSG(`Starting at ${rpm1} RPM`);
    SP(rpm1); DW(time1);
    C('Stage 2');
    MSG(`Ramping to ${rpm2} RPM`);
    SP(rpm2); DW(time2);
    SPOFF();
    MSG('Warmup complete - spindle ready');
    LB(999); END();
    return S;
}

export class AtcWarmupWizard {
    generate(params) {
        recordOp('atc_warmup', params);
        return emitMapped(atcWarmupStack(params)).text;
    }
}
