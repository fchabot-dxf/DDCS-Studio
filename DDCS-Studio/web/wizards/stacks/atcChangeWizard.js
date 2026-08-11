/**
 * wizards/stacks/atcChangeWizard.js — Tool Change Wizard.
 *
 * REWRITTEN AS A BLOCK STACK: `atcChangeStack(params)` builds the macro from granular atoms (Comment / Set# / Spindle /
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
import { newBlock } from '../../blocks/blockEmitter.js';
import { num } from '../ops/util.js';
import { resolveActivePost } from '../dialects/index.js';
import { getActiveProfile } from '../../shared/js/profiles/controllerProfiles.js';
import { resolveMethod, tncProgram } from '../atcModel.js';   // I2: method from the model; INC-B2: tncProgram = the shared inline body

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
        MC: (code, note, cap) => { const b = newBlock('mcode'); b.params = { code, note, ...(cap ? { cap } : {}) }; S.push(b); },
        RAW: (text, cap) => { const b = newBlock('raw'); b.params = { text, ...(cap ? { cap } : {}) }; S.push(b); },   // t640 — cap:'atc' folds the pneumatic codes on a non-ATC post
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
    // t640 — the firmware push dance is ALL ATC pneumatics (M19 orient + M15x/M16x cylinders/vacuum/dust + G53 moves on the
    // ATC push registers #1306/#1320-1326): DECLARE cap:'atc' so every line folds to a comment on a non-ATC post (V4.1/DM500).
    if (orient) MC(19, 'Spindle orient (M19) before unclamp', 'atc');
    RAW('M159  ( vacuum pump OFF )', 'atc');
    RAW('M157  ( locating cylinder CLOSE )', 'atc');
    RAW('G53 Z#1306 F#563  ( highest Z when changing )', 'atc');
    RAW('G53 X#1320 Y#1321 F#563  ( move to push start )', 'atc');
    RAW('M160  ( pusher OPEN )', 'atc');
    RAW('G04 P#1322  ( pusher dwell )', 'atc');
    RAW('G53 X#1323 Y#1324 F#1327  ( move to push end )', 'atc');
    RAW('M163  ( dust collector OFF )', 'atc');
    RAW('G53 X#1325 Y#1326 F#563  ( retreat position after push )', 'atc');
    RAW('M156  ( locating cylinder OPEN )', 'atc');
    RAW('M161  ( pusher CLOSE )', 'atc');
    END();
    return S;
}

// INC-B: the AUTOMATIC change as a CALL to the installed T.nc macro (NOT the inline dance) — the change routine lives in
// the controller's installed T.nc, and the program just CALLS it: `T<n> M6` (fixedT>0 sets #1504 + fires the change) or a
// bare `M6` (fixedT=0 = the tool from a preceding program Txx). A LOUD note flags the install-dependency (a bare T# M6
// silently no-ops if the T.nc is not installed). The SIM still animates the real motion (INC-A interpreter, decoupled).
function macroCallStack(params) {
    const fixedT = num(params.fixedT, 0);
    const S = []; const { C, RAW, MSG, END } = H(S);
    C('ATC | Tool Change — call the installed T.nc macro');
    C('T# M6 - runs YOUR installed T.nc; generate + install it via Settings -> ATC -> Generate T.nc — a bare T# M6 does NOTHING if it is not installed');
    if (fixedT > 0) {
        C(`Change to T${fixedT} — the controller runs its installed T.nc`);
        RAW(`T${fixedT} M6`);                     // T-word sets #1504 (requested tool) + M6 fires the installed macro
    } else {
        C('Tool from the program (a preceding M6 Txx) — bare M6 calls the installed T.nc');
        RAW('M6');
    }
    MSG('Tool change complete');
    END();
    return S;
}

// INC-B2: the callMacro=false INLINE fallback for the automatic generic/disk methods. Instead of a hand-rolled
// ASSUMED drawbar dance (the removed autoStack/diskAutoStack), it emits the SAME executable body as ⚙ Generate T.nc
// (tncProgram, {body:true} = no O-header/M99 wrapper) so the drawbar/sensor codes are ONE-SOURCE from the user's
// Settings → ATC I/O — never a second hand-roll of the codes. Injected as RAW lines: the generator emits a flat
// Expert-dialect program; re-atomizing to dialect-aware blocks waits for the I5b-2b/c convergence.
// INC-B2b (4b): the changer config + I/O CODES are read LIVE from settings (the ddcsGetSettings accessor), NOT
// threaded through the op params. This keeps them OUT of the exported marker (no settings snapshot / no bloat) and
// makes a reloaded file re-emit the user's CURRENT codes (always fresh). test-safe: the app + specs both set the
// same window global; a pure-Node context (no window) degrades to an empty config.
function inlineTncStack() {
    const S = []; const { C, RAW } = H(S);
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings()) || {};
    const atc = s.atc || {};
    const io = { outputs: s.outputs || [], inputs: s.inputs || [] };
    C('ATC | Tool Change — INLINED change sequence (sources your configured changer + Settings -> ATC I/O codes)');
    C('Prefer the DEFAULT T# M6 call (install the T.nc via Settings -> ATC -> Generate T.nc) — inline is the offline fallback.');
    // t640 — the inlined body is the user's drawbar/sensor pneumatic dance → cap:'atc' folds it on a non-ATC post.
    (tncProgram(atc, io, { body: true }) || '').split('\n').forEach((ln) => RAW(ln, 'atc'));
    return S;
}

// The EFFECTIVE arm — the ONE routing (method × callMacro → the 5 distinct builders), shared by the concrete build, the E0
// superset prune, and the E1 twin's deriveGuards. INC-B: the AUTOMATIC methods (firmware/generic/disk) DEFAULT to a T# M6
// CALL to the installed T.nc (callMacro !== false); callMacro === false is the INLINE fallback (firmware → the O10102 push;
// generic/disk → the live-settings tncProgram body). m6/manual are method-only (m6 delegates; manual is a hand-swap).
export function atcChangeEffectiveArm(params = {}) {
    const method = resolveMethod(params);
    if ((method === 'firmware' || method === 'generic' || method === 'disk') && params.callMacro !== false) return 'macroCall';
    switch (method) {
        case 'm6': return 'm6';
        case 'firmware': return 'firmware';                            // the O10102 push station — NOT the assumed drawbar dance
        case 'disk': case 'generic': return 'inlineTnc';              // INC-B2: one-source inline body via tncProgram; reads settings LIVE (4b)
        default: return 'manual';
    }
}

const ARM_BUILDERS = { m6: m6Stack, manual: manualStack, macroCall: macroCallStack, firmware: firmwareStack, inlineTnc: inlineTncStack };

export function atcChangeStack(params = {}, opts = {}) {
    // t562 E0 — the data-op twin seam. superset:true carries EVERY method arm GUARDED by the DERIVED `_arm` key (the effective
    // routing), so pruneGuards collapses to the chosen arm → byte-identical to the concrete build. Each arm builds from the
    // current params/settings (the inlineTnc arm reads Settings → ATC I/O LIVE); the twin (E1) injects `_arm` via deriveGuards.
    if (opts.superset) {
        const GUARD = (when, kids) => { const g = newBlock('guard'); g.params = { when }; g.children = kids; return g; };
        return Object.keys(ARM_BUILDERS).map((arm) => GUARD({ param: '_arm', is: arm }, ARM_BUILDERS[arm](params)));
    }
    return ARM_BUILDERS[atcChangeEffectiveArm(params)](params);
}
