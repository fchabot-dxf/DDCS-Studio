/**
 * DDCS Studio - ATC Tool Length Setter Wizard — touch a tool on the fixed setter, save the length offset
 * into the controller's tool table.
 *
 * REWRITTEN AS A BLOCK STACK: `atcLengthStack(params)` from granular atoms (Comment / Set# / Confirm /
 * Spindle / Coolant / Distance / Probe / Probe Check / Probe Read / Tool Offset / Move / Message / If Goto /
 * Goto / Label / End Program). Native across posts: the probe form, the Z trigger read, the tool-table base
 * (#1430 Expert/DM500, #1560 V4.1), the status-check folding and the confirm gate all come from the dialect.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
import { srcVal, srcNote } from './probeBlocks.js';

export function atcLengthStack(params = {}) {
    const blockHeight = num(params.blockHeight, 50), safeZ = num(params.safeZ, 10), maxDist = num(params.maxDist, 200);
    const retract = num(params.retract, 3), fFast = num(params.f_fast, 300), fSlow = num(params.f_slow, 50);
    const port = num(params.port, 2), level = num(params.level, 0);
    const src = params.sources || {};

    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };
    const A = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; S.push(b); };
    const IF = (l, o, r, g) => { const b = newBlock('ifgoto'); b.params = { lhs: l, op: o, rhs: r, goto: g }; S.push(b); };
    const GO = (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    const DM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; S.push(b); };
    const CF = (msg, cancel) => { const b = newBlock('confirm'); b.params = { msg, cancel }; S.push(b); };
    const SPOFF = () => { const b = newBlock('spindle'); b.params = { rpm: 0 }; S.push(b); };
    const COOLOFF = () => { const b = newBlock('coolant'); b.params = { flow: 'off' }; S.push(b); };
    const PR = (to, feed) => { const b = newBlock('probe'); b.params = { axis: 'Z', to, feed, port: '#5', level }; S.push(b); };
    const CK = (goto) => { const b = newBlock('probecheck'); b.params = { axis: 'Z', goto }; S.push(b); };
    const RD = (v) => { const b = newBlock('proberead'); b.params = { axis: 'Z', var: v }; S.push(b); };
    const TO = (tool, value) => { const b = newBlock('tooloffset'); b.params = { tool, value }; S.push(b); };
    const MV = (axis, v) => { const b = newBlock('move'); b.params = { mode: 'rapid', [axis.toLowerCase()]: v }; S.push(b); };
    const MSG = (text) => { const b = newBlock('message'); b.params = { text }; S.push(b); };
    const END = () => S.push(newBlock('endprogram'));

    C('ATC | Tool Length Setter');
    C(`Block Height: ${blockHeight}mm | Safe Z: ${safeZ}mm`);
    C(`Fast: ${fFast} | Slow: ${fSlow} | Max Plunge: ${maxDist}mm`);
    C('=== CONFIGURATION ===');
    A('#1', maxDist, 'Max search distance');
    A('#2', retract, 'Retract distance');
    A('#3', fFast, 'Fast approach feedrate');
    A('#4', fSlow, 'Slow precision touch feedrate');
    A('#5', srcVal(src.setterPort, port), srcNote(src.setterPort, 'Probe port'));
    A('#6', srcVal(src.blockHeight, blockHeight), srcNote(src.blockHeight, 'Tool setter block height'));
    A('#19', safeZ, 'Safe Z height');
    C('=== CALCULATED MOTIONS ===');
    A('#7', '[0-#1]', 'Negative plunge'); A('#10', '#2', 'Positive retract');

    C('Confirm Start');
    CF('Hover tool above setter. Press Enter', 2);
    SPOFF(); COOLOFF();                       // spindle & coolant OFF before probing
    DM('inc');
    C('Step 1: Fast Probe Down');
    PR('#7', '#3'); CK(1); MV('Z', '#10');
    C('Step 2: Slow Precision Touch');
    PR('#7', '#4'); CK(1);
    DM('abs');
    C('Calculate and store the tool length offset');
    RD('#101');                               // machine Z trigger (dialect: #1927 / #1502 / #866)
    A('#102', '[#101 - #6]', 'Length = MachineZ - BlockHeight');
    A('#103', '#1300', 'Read current tool number');
    IF('#103', '<', '1', 3);
    TO('#103', '#102');                        // tool table write (dialect base #1430/#1560)
    MV('Z', '#19');                           // retract to safe Z
    MSG('Tool length successfully saved');
    GO(2);

    C('=== ERROR HANDLERS ===');
    LB(1); DM('abs'); A('#1505', '1', 'ERROR: Tool Setter missed'); GO(2);
    LB(3); DM('abs'); A('#1505', '1', 'ERROR: No tool number set - check #1300');
    LB(2); END();
    return S;
}

export class AtcLengthWizard {
    generate(params) {
        recordOp('atc_length', params);
        return emitMapped(atcLengthStack(params)).text;
    }
}
