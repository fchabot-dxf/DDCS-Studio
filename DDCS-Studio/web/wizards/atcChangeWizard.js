/**
 * DDCS Studio - Tool Change Wizard.
 *
 * REWRITTEN AS A BLOCK STACK: `atcChangeStack(params)` from granular atoms (Comment / Set# / Spindle /
 * Coolant / Machine Move / M-Code / Confirm / Pause / Message / If Goto / Goto / Label / End Program / Raw).
 * The G53 machine moves render per post (Expert/DM500 `G53 …`, V4.1 `G0 G53 …`) and the operator prompts fold
 * on controllers with no scripted HMI — so the same stack is native across posts.
 *
 * CHANGE METHOD (params.method — see backward-compat map in atcChangeStack):
 *   m6       — RECOMMENDED for automatic: park (safe G53 Z, then G53 X/Y to the change position) then emit a
 *              bare M6 and let the controller run its own working tool-change handler. Minimal + safe.
 *   firmware — the O10102-accurate FIXED-STATION PUSH sequence (slib-m.nc O10102): #1306 highest-Z, push
 *              start #1320/#1321 → dwell #1322 → push end #1323/#1324 (F#1327) → retreat #1325/#1326, with the
 *              real pneumatic M-code order (M159 vacuum-off, M157 pin-close, M160 pusher-open, M163 dust-off,
 *              M156 pin-open, M161 pusher-close) and an M19 spindle orient before unclamp.
 *   manual   — stop spindle, park the head (G53), M00 pause for a hand swap.
 *   generic  — ASSUMED magazine pick & place (NOT proven on real DDCS firmware — verify on your machine).
 *   disk     — ASSUMED disk/carousel TEMPLATE (rotate-to-pocket indexing is firmware-specific — verify).
 *
 * GROUND TRUTH: the real M350 O10102 is a pneumatic FIXED-STATION PUSH/EJECT station (vacuum pump + locating
 * cylinder + pusher cylinder + dust collector), NOT a pull-stud spindle changer. The drawbar/grab pick&place
 * model below (generic/disk) is an ASSUMPTION carried from earlier guesses — kept only for backward-compat.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
import { resolveActivePost } from './dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';

const getDialect = () => { try { return resolveActivePost(getActiveProfile().id); } catch (_) { return null; } };

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
        RAW: (text) => { const b = newBlock('raw'); b.params = { text }; S.push(b); },
        CF: (msg, cancel) => { const b = newBlock('confirm'); b.params = { msg, cancel }; S.push(b); },
        PAUSE: () => S.push(newBlock('pause')),
        MSG: (text) => { const b = newBlock('message'); b.params = { text }; S.push(b); },
        END: () => S.push(newBlock('endprogram')),
    };
}

function manualStack(params) {
    const x = num(params.x, 100), y = num(params.y, 100), z = num(params.z, 0);
    const d = getDialect(); const dro = (d && d.vars && d.vars.dro) || 880;   // machine-DRO base (Expert #880, V4.1 #1500, DM500 #864)
    const S = []; const { C, A, SPOFF, COOLOFF, MM, PAUSE, MSG, END } = H(S);
    C('ATC | Manual Tool Change');
    C(`Park: X${x} Y${y} Z${z} - operator swaps the tool by hand`);
    C('=== CONFIGURATION ===');
    A('#1', x, 'Park X'); A('#2', y, 'Park Y'); A('#3', z, 'Park Z');
    C('Stop spindle and coolant');
    SPOFF(); COOLOFF();
    A('#1155', `#${dro} + 0`, 'Save Tool Change X - washed for DDCS priming');
    A('#1156', `#${dro + 1} + 0`, 'Save Tool Change Y - washed for DDCS priming');
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
    const d = getDialect();
    const S = []; const { C, A, IF, GO, LB, SPOFF, COOLOFF, MM, MC, CF, MSG, END } = H(S);

    // ASSUMED pick & place model (NOT proven on real DDCS firmware). The real O10102 is a pneumatic push
    // station, not a drawbar changer — this drawbar/grab model is a guess carried for backward-compat.
    const atc = d && d.vars && d.vars.atc;
    if (!atc) {
        C('ATC | Tool Change (Generic — ASSUMED)');
        C(`No ASSUMED magazine model for ${d ? d.name : 'this controller'}.`);
        C('Use the M6 or Manual method, or select the DDCS Expert post.');
        END();
        return S;
    }

    const zClear = num(params.zClear, 0), fixedT = num(params.fixedT, 0);
    const useM300 = params.waitSpindle !== false, useCover = params.dustCover === true, confirm = params.confirm === true;
    // Pockets + park XYZ come from the Settings → Tool table magazine (literal coords, dispatched by tool number).
    const mag = (Array.isArray(params.magazine) ? params.magazine : []).filter((p) => p && p.tool !== '' && p.tool != null);
    const cur = '#' + atc.currentTool;                                   // tool in spindle (#1300)
    const tgt = fixedT > 0 ? String(fixedT) : '#' + atc.targetTool;      // requested tool (#1504 from M6 Txx)

    C('ATC | Tool Change — magazine pick & place (Generic — ASSUMED, verify on your machine)');
    C('ASSUMED model — the real M350 O10102 is a pneumatic push station, not this drawbar changer.');
    C('Pockets + park XYZ come from Settings → Tool table magazine');
    C(fixedT > 0 ? `TEST MODE: fixed target tool T${fixedT}` : `Target tool from ${tgt} — set by M6 Txx; save as T.nc`);
    C('VERIFY FIRST RUN with no tool in spindle + hand on e-stop');
    if (!mag.length) {
        C('!! Magazine is EMPTY — add pockets in Settings → Tool table (or Import from controller).');
        END();
        return S;
    }

    C('=== CONFIGURATION ===');
    A('#100', tgt, 'Target tool');
    A('#101', cur, 'Current tool in spindle, 0 = empty');
    A('#102', String(zClear), 'Z change height - MACHINE coords');
    C('=== VALIDATE ===');
    IF('#100', '==', '#101', 900);            // requested tool already loaded
    if (confirm) { A('#1510', '#100', 'Show target tool'); CF('Change to this tool? Press Enter', 999); }

    C('=== SPINDLE OFF + RETRACT ===');
    SPOFF(); COOLOFF();
    if (useM300) MC(300, 'Wait: spindle-stopped sensor');
    if (useCover) MC(162, 'Dust cover OPEN');
    MM('Z', '#102');                          // retract to change height

    C('=== PUT AWAY CURRENT TOOL — skipped if spindle empty or tool not in magazine ===');
    IF('#101', '<', '1', 20);
    mag.forEach((p, i) => IF('#101', '==', String(num(p.tool, 0)), 100 + i));
    GO(20);                                   // current tool not in the magazine — skip the return
    mag.forEach((p, i) => {
        LB(100 + i); C(`Return T${num(p.tool, 0)} to pocket ${i + 1}`);
        A('#110', String(num(p.x, 0)), 'Pocket X'); A('#111', String(num(p.y, 0)), 'Pocket Y'); A('#112', String(num(p.z, 0)), 'Pocket Z');
        MM('X', '#110'); MM('Y', '#111');     // over the pocket
        MM('Z', '#112');                      // down: seat tool in pocket
        MC(154, 'Drawbar RELEASE'); MC(301, 'Wait: drawbar-released sensor');
        MM('Z', '#102');                      // retract clear of the pocket
        A(cur, '0', 'Spindle now empty'); GO(20);
    });

    LB(20); C('=== PICK UP TARGET TOOL ===');
    mag.forEach((p, i) => IF('#100', '==', String(num(p.tool, 0)), 200 + i));
    A('#1505', '1', 'ERROR: target tool has no pocket in the magazine'); GO(999);   // Expert dialog flag
    mag.forEach((p, i) => {
        LB(200 + i); C(`Fetch T${num(p.tool, 0)} from pocket ${i + 1}`);
        A('#110', String(num(p.x, 0)), 'Pocket X'); A('#111', String(num(p.y, 0)), 'Pocket Y'); A('#112', String(num(p.z, 0)), 'Pocket Z');
        MM('X', '#110'); MM('Y', '#111');     // over the pocket
        MC(154, 'Collet OPEN before descending'); MC(301, 'Wait: drawbar-released sensor');
        MM('Z', '#112');                      // down over the tool shank
        MC(155, 'Drawbar LOCK'); MC(302, 'Wait: tool-locked sensor');
        MM('Z', '#102');                      // retract with the new tool
        if (useCover) MC(163, 'Dust cover CLOSE');
        A(cur, '#100', 'Current tool = target'); MSG('Tool change complete'); GO(999);
    });

    C('=== HANDLERS ===');
    LB(900); MSG('Tool already in spindle - nothing to do'); GO(999);
    LB(999); END();
    return S;
}

// DISK / CAROUSEL auto change (ASSUMED TEMPLATE — NOT proven on real DDCS firmware): all pockets share one
// fixed PICKUP; the carousel rotates the target pocket to it. The rotation primitive is firmware-specific
// (rotate output + index sensor), so the "rotate carousel to pocket N" step is left explicit to wire + VERIFY.
function diskAutoStack(params) {
    const d = getDialect();
    const S = []; const { C, A, IF, GO, LB, SPOFF, COOLOFF, MM, MC, CF, MSG, END } = H(S);
    const atc = d && d.vars && d.vars.atc;
    if (!atc) { C('ATC | Tool Change (Disk — ASSUMED template)'); C(`No ASSUMED disk model for ${d ? d.name : 'this controller'}.`); END(); return S; }
    const pk = params.pickup || {};
    const zClear = num(params.zClear, 0), fixedT = num(params.fixedT, 0);
    const useM300 = params.waitSpindle !== false, useCover = params.dustCover === true, confirm = params.confirm === true;
    const mag = (Array.isArray(params.magazine) ? params.magazine : []).filter((p) => p && p.tool !== '' && p.tool != null);
    const cur = '#' + atc.currentTool, tgt = fixedT > 0 ? String(fixedT) : '#' + atc.targetTool;

    C('ATC | Tool Change — DISK / CAROUSEL (ASSUMED template — rotate pocket to a fixed pickup)');
    C('ASSUMED — carousel indexing is firmware-specific; VERIFY the rotation on the machine before trusting this.');
    C(fixedT > 0 ? `TEST MODE: fixed target tool T${fixedT}` : `Target tool from ${tgt} — set by M6 Txx; save as T.nc`);
    if (!mag.length) { C('!! Magazine EMPTY — build it in Settings → Tool table.'); END(); return S; }

    C('=== CONFIGURATION ===');
    A('#100', tgt, 'Target tool'); A('#101', cur, 'Current tool, 0 = empty'); A('#102', String(zClear), 'Z change height (machine)');
    A('#103', String(num(pk.x, 0)), 'Pickup X'); A('#104', String(num(pk.y, 0)), 'Pickup Y'); A('#105', String(num(pk.z, 0)), 'Pickup Z');
    IF('#100', '==', '#101', 900);
    if (confirm) { A('#1510', '#100', 'Show target tool'); CF('Change to this tool? Press Enter', 999); }

    C('=== SPINDLE OFF + RETRACT ===');
    SPOFF(); COOLOFF(); if (useM300) MC(300, 'Wait: spindle-stopped'); if (useCover) MC(162, 'Dust cover OPEN');
    MM('Z', '#102');

    C('=== PUT AWAY CURRENT TOOL (rotate its pocket to the pickup, release) ===');
    IF('#101', '<', '1', 20);
    mag.forEach((p, i) => IF('#101', '==', String(num(p.tool, 0)), 100 + i));
    GO(20);
    mag.forEach((p, i) => {
        LB(100 + i); C(`Return T${num(p.tool, 0)} → rotate carousel to pocket ${num(p.pocket, i + 1)}, then swap at pickup`);
        A('#106', String(num(p.pocket, i + 1)), 'Target pocket index');
        C('>> Rotate carousel to pocket #106 here (rotate output + M303/M304 index sensor). VERIFY on the machine.');
        MM('X', '#103'); MM('Y', '#104'); MM('Z', '#105');   // to the fixed pickup
        MC(154, 'Drawbar RELEASE'); MC(301, 'Wait: drawbar-released');
        MM('Z', '#102'); A(cur, '0', 'Spindle empty'); GO(20);
    });

    LB(20); C('=== PICK UP TARGET TOOL (rotate its pocket to the pickup, lock) ===');
    mag.forEach((p, i) => IF('#100', '==', String(num(p.tool, 0)), 200 + i));
    A('#1505', '1', 'ERROR: target tool not in the magazine'); GO(999);
    mag.forEach((p, i) => {
        LB(200 + i); C(`Fetch T${num(p.tool, 0)} → rotate carousel to pocket ${num(p.pocket, i + 1)}, then pick at pickup`);
        A('#106', String(num(p.pocket, i + 1)), 'Target pocket index');
        C('>> Rotate carousel to pocket #106 here. VERIFY on the machine.');
        MM('X', '#103'); MM('Y', '#104');
        MC(154, 'Collet OPEN'); MC(301, 'Wait: released');
        MM('Z', '#105'); MC(155, 'Drawbar LOCK'); MC(302, 'Wait: locked');
        MM('Z', '#102'); if (useCover) MC(163, 'Dust cover CLOSE');
        A(cur, '#100', 'Current = target'); MSG('Tool change complete'); GO(999);
    });
    C('=== HANDLERS ==='); LB(900); MSG('Tool already in spindle'); GO(999); LB(999); END();
    return S;
}

// M6 (RECOMMENDED for automatic): park safely (G53 Z to the change height, then G53 X/Y to the change
// position) and delegate the actual swap to the controller's own M6 handler. Minimal + safe + post-portable.
function m6Stack(params) {
    const x = num(params.x, 100), y = num(params.y, 100);
    const zClear = num(params.zClear, 0), fixedT = num(params.fixedT, 0);
    const S = []; const { C, A, SPOFF, COOLOFF, MM, MC, MSG, END } = H(S);
    C('ATC | Tool Change — delegate to the controller (M6)');
    C('Park clear (safe Z, then XY) then call M6 — the controller runs its own working change handler.');
    C(fixedT > 0 ? `Change to T${fixedT}` : 'Target tool from the program (M6 Txx)');
    C('=== CONFIGURATION ===');
    A('#102', String(zClear), 'Z change height - MACHINE coords');
    A('#103', String(x), 'Change-position X (machine)');
    A('#104', String(y), 'Change-position Y (machine)');
    C('Stop spindle + coolant, retract to the change height, move to the change position');
    SPOFF(); COOLOFF();
    MM('Z', '#102');                          // safe Z first
    MM('X', '#103'); MM('Y', '#104');         // then XY to the change position
    if (fixedT > 0) MC(6, `M6 T${fixedT} — controller tool change`);
    else MC(6, 'M6 — controller tool change (tool from program)');
    MSG('Tool change complete');
    END();
    return S;
}

// FIRMWARE: the O10102-accurate FIXED-STATION PUSH sequence (slib-m.nc O10102, decoded). This is the REAL
// M350 change body — a pneumatic push/eject station, not a pull-stud changer. Emitted verbatim (raw lines) so
// the G53 combined-axis moves + feeds (#563/#1327) + dwell (#1322) match the controller byte-for-byte. An M19
// spindle orient is added before the unclamp (a rigid spindle should be oriented before it is released).
function firmwareStack(params) {
    const orient = params.orient !== false;   // M19 orient default ON for the firmware path
    const S = []; const { C, MC, RAW, END } = H(S);
    C('ATC | Tool Change — firmware-accurate fixed-station PUSH (O10102)');
    C('Source: SYSDISK/slib-m.nc O10102 — pneumatic push/eject (vacuum + locating pin + pusher + dust cover).');
    C('Driven by #1306 (highest Z) + #1320-1326 (push start/end/retreat), feeds #563/#1327, dwell #1322.');
    C('VERIFY on the machine: these G53 stations + #1306/#1320-1326 must be taught in the controller first.');
    if (orient) MC(19, 'Spindle orient (M19) before unclamp');
    RAW('M159  ( vacuum pump OFF )');
    RAW('M157  ( locating cylinder CLOSE )');
    RAW('G53 Z#1306 F#563  ( highest Z when changing )');
    RAW('G53 X#1320 Y#1321 F#563  ( move to push start )');
    RAW('M160  ( pusher OPEN )');
    RAW('G04 P#1322  ( pusher dwell )');
    RAW('G53 X#1323 Y#1324 F#1327  ( move to push end )');
    RAW('M163  ( dust collector OFF )');
    RAW('G53 X#1325 Y#1326 F#563  ( retreat position after push )');
    RAW('M156  ( locating cylinder OPEN )');
    RAW('M161  ( pusher CLOSE )');
    END();
    return S;
}

// Map a saved op onto a change METHOD. New ops carry params.method directly; OLD saved ops (params.mode /
// params.magType, no method) map on so existing blocks/files keep emitting the same stack.
function resolveMethod(params) {
    if (params.method) return params.method;
    if (params.mode === 'auto') return (params.magType === 'disk') ? 'disk' : 'generic';
    return 'manual';   // legacy default (mode unset or 'manual')
}

export function atcChangeStack(params = {}) {
    switch (resolveMethod(params)) {
        case 'm6': return m6Stack(params);
        case 'firmware': return firmwareStack(params);
        case 'disk': return diskAutoStack(params);
        case 'generic': return autoStack(params);
        default: return manualStack(params);
    }
}

export class AtcChangeWizard {
    generate(params) {
        recordOp('atc_change', params);
        return emitMapped(atcChangeStack(params)).text;
    }
}
