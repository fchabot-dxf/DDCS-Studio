/**
 * DDCS Studio - Tool Change Wizard (Manual park / Automatic ATC).
 *
 * REWRITTEN AS A BLOCK STACK: `atcChangeStack(params)` from granular atoms (Comment / Set# / Spindle /
 * Coolant / Machine Move / M-Code / Confirm / Pause / Message / If Goto / Goto / Label / End Program). The
 * G53 machine moves render per post (Expert/DM500 `G53 …`, V4.1 `G0 G53 …`) and the operator prompts fold on
 * controllers with no scripted HMI — so the same stack is native across posts.
 *
 * MANUAL mode: stop spindle, park the head (G53), M00 pause for a hand swap.
 * AUTO mode: T.nc-style pick & place using the controller's ATC model — drawbar M154/M155, sensor waits
 * M301/M302, pocket tables #1330/#1350/#1370. VERIFY the first run with no tool + a hand on the e-stop.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';

// Shared atom helpers over a stack array.
function H(S) {
    return {
        C: (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); },
        A: (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; S.push(b); },
        IF: (l, o, r, g) => { const b = newBlock('ifgoto'); b.params = { lhs: l, op: o, rhs: r, goto: g }; S.push(b); },
        GO: (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); },
        LB: (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); },
        SPOFF: () => { const b = newBlock('spindle'); b.params = { rpm: 0 }; S.push(b); },
        COOLOFF: () => { const b = newBlock('coolant'); b.params = { flow: 'off' }; S.push(b); },
        MM: (axis, to) => { const b = newBlock('machinemove'); b.params = { axis, to }; S.push(b); },
        MC: (code, note) => { const b = newBlock('mcode'); b.params = { code, note }; S.push(b); },
        CF: (msg, cancel) => { const b = newBlock('confirm'); b.params = { msg, cancel }; S.push(b); },
        PAUSE: () => S.push(newBlock('pause')),
        MSG: (text) => { const b = newBlock('message'); b.params = { text }; S.push(b); },
        END: () => S.push(newBlock('endprogram')),
    };
}

function manualStack(params) {
    const x = num(params.x, 100), y = num(params.y, 100), z = num(params.z, 0);
    const S = []; const { C, A, SPOFF, COOLOFF, MM, PAUSE, MSG, END } = H(S);
    C('ATC | Manual Tool Change');
    C(`Park: X${x} Y${y} Z${z} - operator swaps the tool by hand`);
    C('=== CONFIGURATION ===');
    A('#1', x, 'Park X'); A('#2', y, 'Park Y'); A('#3', z, 'Park Z');
    C('Stop spindle and coolant');
    SPOFF(); COOLOFF();
    A('#1155', '#880 + 0', 'Save Tool Change X - washed for DDCS priming');
    A('#1156', '#881 + 0', 'Save Tool Change Y - washed for DDCS priming');
    C('Park clear of the work - safe Z first, then XY');
    MM('Z', '#3');                            // retract Z to park
    MM('X', '#1'); MM('Y', '#2');             // move to XY park
    C('Manual swap - operator loosens collet, swaps tool, retightens');
    MSG('Swap tool by hand, then press Cycle Start');
    PAUSE();                                  // M00 universal program stop
    C('Complete');
    MSG('Tool change complete');
    END();
    return S;
}

function autoStack(params) {
    const zClear = num(params.zClear, 0), capacity = num(params.capacity, 8), fixedT = num(params.fixedT, 0);
    const useM300 = params.waitSpindle !== false, useCover = params.dustCover === true, confirm = params.confirm === true;
    const target = fixedT > 0 ? String(fixedT) : '#1504';

    const S = []; const { C, A, IF, GO, LB, SPOFF, COOLOFF, MM, MC, CF, MSG, END } = H(S);
    C('ATC | Automatic Tool Change - T.nc style');
    C('Drawbar M154/M155 + sensor waits M301/M302 - pockets from tables #1330/#1350/#1370');
    C(fixedT > 0 ? `TEST MODE: fixed target tool T${fixedT}` : 'Target tool from #1504 - set by M6 Txx; save as T.nc');
    C('VERIFY FIRST RUN with no tool in spindle + hand on e-stop');
    C('=== CONFIGURATION ===');
    A('#100', target, 'Target tool');
    A('#101', '#1300', 'Current tool in spindle, 0 = empty');
    A('#102', zClear, 'Z change height - MACHINE coords');
    A('#103', capacity, 'Magazine capacity - keep equal to param #1301');
    C('=== VALIDATE ===');
    IF('#100', '<', '1', 910);
    IF('#100', '>', '#103', 910);
    IF('#100', '==', '#101', 900);
    if (confirm) { A('#1510', '#100', 'Show target tool'); CF('Change to this tool? Press Enter', 999); }

    C('=== SPINDLE OFF + RETRACT ===');
    SPOFF(); COOLOFF();
    if (useM300) MC(300, 'Wait: spindle-stopped sensor');
    if (useCover) MC(162, 'Dust cover OPEN');
    MM('Z', '#102');                          // retract to change height

    C('=== PUT AWAY CURRENT TOOL - skipped if spindle is empty ===');
    IF('#101', '<', '1', 20);
    A('#105', '[1330+#101-1]', 'Old pocket X table address');
    A('#106', '[1350+#101-1]', 'Old pocket Y table address');
    A('#107', '[1370+#101-1]', 'Old pocket Z table address');
    A('#110', '#[#105]', 'Old pocket X'); A('#111', '#[#106]', 'Old pocket Y'); A('#112', '#[#107]', 'Old pocket Z');
    MM('X', '#110'); MM('Y', '#111');         // over the old pocket
    MM('Z', '#112');                          // down: seat tool in pocket
    MC(154, 'Drawbar RELEASE'); MC(301, 'Wait: drawbar-released sensor');
    A('#1300', '0', 'Spindle now empty');
    MM('Z', '#102');                          // retract clear of the pocket

    LB(20); C('PICK UP NEW TOOL');
    A('#105', '[1330+#100-1]', 'New pocket X table address');
    A('#106', '[1350+#100-1]', 'New pocket Y table address');
    A('#107', '[1370+#100-1]', 'New pocket Z table address');
    A('#110', '#[#105]', 'New pocket X'); A('#111', '#[#106]', 'New pocket Y'); A('#112', '#[#107]', 'New pocket Z');
    MM('X', '#110'); MM('Y', '#111');         // over the new pocket
    MC(154, 'Collet OPEN before descending'); MC(301, 'Wait: drawbar-released sensor');
    MM('Z', '#112');                          // down over the tool shank
    MC(155, 'Drawbar LOCK'); MC(302, 'Wait: tool-locked sensor');
    MM('Z', '#102');                          // retract with the new tool
    if (useCover) MC(163, 'Dust cover CLOSE');
    A('#1300', '#100', 'Current tool = target');
    MSG('Tool change complete');
    GO(999);

    C('=== HANDLERS ===');
    LB(900); MSG('Tool already in spindle - nothing to do'); GO(999);
    LB(910); A('#1505', '1', 'ERROR: invalid target tool - check M6 T / capacity');
    LB(999); END();
    return S;
}

export function atcChangeStack(params = {}) {
    return (params.mode === 'auto') ? autoStack(params) : manualStack(params);
}

export class AtcChangeWizard {
    generate(params) {
        recordOp('atc_change', params);
        return emitMapped(atcChangeStack(params)).text;
    }
}
