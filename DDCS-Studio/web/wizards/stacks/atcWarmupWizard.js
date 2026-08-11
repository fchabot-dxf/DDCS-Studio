/**
 * wizards/stacks/atcWarmupWizard.js — ATC Spindle Warm-up — staged spindle warmup.
 *
 * REWRITTEN AS A BLOCK STACK: `atcWarmupStack(params)` builds from granular atoms (Comment / Confirm /
 * Spindle / Coolant / Dwell / Message / Label / End Program). Native across posts for free: the Dwell units
 * (ms on Expert/V4.1, seconds on DM500) and the Confirm gate (folds where there's no scripted HMI) come from
 * the active dialect. Form and Blocks view are two editors of this one stack.
 */
import { newBlock } from '../../blocks/blockEmitter.js';
import { num } from '../ops/util.js';

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

    // Annotation text is STATIC (no param interpolation): the rpm/time are the single source of truth in the
    // executable Spindle (M3 S<rpm>) + Dwell (G04 P<ms>) atoms below. Duplicating them into prose would let a
    // forked/data-def warmup (rpm bound to a new value) emit a STALE operator message — a lie at the machine.
    // Keeping them static makes the wizards-as-data port byte-identical with a dumb data-def (no text templating).
    C('Spindle Warm-up');
    C('Stage 1: spin up + dwell');
    C('Stage 2: spin up + dwell');
    CF('Warm up spindle? Press Enter', 999);
    SPOFF(); COOLOFF();                       // stop spindle & coolant first
    C('Stage 1');
    MSG('Starting stage 1');
    SP(rpm1); DW(time1);
    C('Stage 2');
    MSG('Ramping to stage 2');
    SP(rpm2); DW(time2);
    SPOFF();
    MSG('Warmup complete - spindle ready');
    LB(999); END();
    return S;
}
