/**
 * DDCS Studio - ATC Commissioning Test Wizard (drawbar cycle / pocket dry-run).
 *
 * REWRITTEN AS A BLOCK STACK: `atcTestStack(params)` from granular atoms (Comment / Set# / Spindle / Coolant /
 * Machine Move / M-Code / Dwell / Confirm / Message / If Goto / Goto / Label / End Program). G53 moves + dwell
 * units render per post, so the same stack is native across posts.
 *
 * DRAWBAR mode — cycle the drawbar N times (M154/M155) and verify the sensors (M301/M302) every cycle.
 * POCKETS mode — visit every magazine pocket at clearance height (tables #1330/#1350/#1370) for a visual check.
 * Both run in the Studio simulator (Run + Auto sensors) before the first powered test.
 */
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
import { resolveActivePost } from './dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';

const getDialect = () => { try { return resolveActivePost(getActiveProfile().id); } catch (_) { return null; } };

function H(S) {
    return {
        C: (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); },
        A: (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; S.push(b); },
        IF: (l, o, r, g) => { const b = newBlock('ifgoto'); b.params = { lhs: l, op: o, rhs: r, goto: g }; S.push(b); },
        LB: (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); },
        SPOFF: () => { const b = newBlock('spindle'); b.params = { rpm: 0 }; S.push(b); },
        COOLOFF: () => { const b = newBlock('coolant'); b.params = { flow: 'off' }; S.push(b); },
        MM: (axis, to) => { const b = newBlock('machinemove'); b.params = { axis, to }; S.push(b); },
        MC: (code, note) => { const b = newBlock('mcode'); b.params = { code, note }; S.push(b); },
        DW: (sec) => { const b = newBlock('dwell'); b.params = { sec }; S.push(b); },
        CF: (msg, cancel) => { const b = newBlock('confirm'); b.params = { msg, cancel }; S.push(b); },
        MSG: (text) => { const b = newBlock('message'); b.params = { text }; S.push(b); },
        END: () => S.push(newBlock('endprogram')),
    };
}

function drawbarStack(params) {
    const cycles = Math.max(1, num(params.cycles, 10));
    const dwellSec = Math.max(0, num(params.dwellMs, 500)) / 1000;   // dwell atom takes seconds → native units per post
    const S = []; const { C, A, IF, LB, SPOFF, COOLOFF, MC, DW, MSG, END } = H(S);
    C('ATC | Drawbar Cycle Test - commissioning');
    C(`${cycles} release/lock cycles - sensors M301/M302 verified each cycle`);
    C('NO tool in the spindle. A hang on a wait = that sensor/valve needs adjusting');
    C('=== CONFIGURATION ===');
    A('#100', 1, 'Cycle counter'); A('#101', cycles, 'Cycles');
    SPOFF(); COOLOFF();
    MC(300, 'Wait: spindle-stopped sensor');
    LB(10); C('CYCLE START');
    MSG('Cycle #100: RELEASE');
    MC(154, 'Drawbar RELEASE'); MC(301, 'Wait: drawbar-released sensor'); DW(dwellSec);
    MSG('Cycle #100: LOCK');
    MC(155, 'Drawbar LOCK'); MC(302, 'Wait: tool-locked sensor'); DW(dwellSec);
    A('#100', '[#100+1]', 'Next cycle');
    IF('#100', '<=', '#101', 10);
    C('Complete - drawbar left LOCKED');
    MSG('Drawbar test complete');
    END();
    return S;
}

function pocketsStack(params) {
    const d = getDialect();
    const S = []; const { C, A, LB, SPOFF, COOLOFF, MM, CF, MSG, END } = H(S);
    const atc = d && d.vars && d.vars.atc;
    // Pockets come from the Settings → Tool table magazine (literal coords); first/count slice it.
    const mag = (Array.isArray(params.magazine) ? params.magazine : []).filter((p) => p && p.tool !== '' && p.tool != null);
    const first = Math.max(1, num(params.first, 1));
    const count = Math.max(1, num(params.count, mag.length || 1));
    const sel = mag.slice(first - 1, first - 1 + count);
    const zClear = num(params.zClear, 0);
    const descend = params.descend === true;

    C('ATC | Pocket Dry-Run - commissioning');
    C('Visits each taught magazine pocket (Settings → Tool table) at clearance Z');
    C('NO tool in spindle, NO drawbar action - visual alignment check at each stop');
    if (!atc) { C(`Not available on ${d ? d.name : 'this controller'} — select the DDCS Expert post.`); END(); return S; }
    if (!sel.length) { C('!! Magazine is EMPTY — add pockets in Settings → Tool table (or Import from controller).'); END(); return S; }

    C('=== CONFIGURATION ===');
    A('#102', String(zClear), 'Z clearance height - MACHINE coords');
    SPOFF(); COOLOFF();
    MM('Z', '#102');                          // retract to clearance
    sel.forEach((p, i) => {
        C(`Pocket ${first + i} — T${num(p.tool, 0)}`);
        A('#110', String(num(p.x, 0)), 'Pocket X'); A('#111', String(num(p.y, 0)), 'Pocket Y');
        MM('X', '#110'); MM('Y', '#111');     // over the pocket
        if (descend) { A('#112', String(num(p.z, 0)), 'Pocket Z'); MM('Z', '#112'); }   // descend to pocket height
        CF(`Pocket ${first + i} — verify alignment. Enter = next`, 999);
        if (descend) MM('Z', '#102');         // back to clearance
    });
    C('Complete');
    MSG('Pocket dry-run complete');
    LB(999); END();
    return S;
}

export function atcTestStack(params = {}, opts = {}) {
    // t556 E0 — the data-op twin seam. superset:true carries BOTH mode arms GUARDED by `mode` (drawbar | pockets), so
    // pruneGuards collapses to the chosen mode → byte-identical to the concrete build. Each arm is built from the current
    // params (the pockets arm UNROLLS the magazine; the drawbar arm is the counted GOTO loop) — the twin (E1) re-unrolls the
    // pockets from the CURRENT settings.atc.magazine at instantiation. deriveGuards injects the EFFECTIVE mode for the prune.
    if (opts.superset) {
        const GUARD = (when, kids) => { const g = newBlock('guard'); g.params = { when }; g.children = kids; return g; };
        return [
            GUARD({ param: 'mode', is: 'drawbar' }, drawbarStack(params)),
            GUARD({ param: 'mode', is: 'pockets' }, pocketsStack(params)),
        ];
    }
    return (params.mode === 'pockets') ? pocketsStack(params) : drawbarStack(params);
}

/** The EFFECTIVE mode — the ONE source shared by the concrete build + the twin's prune derive: `pockets` iff explicitly
 *  chosen, else `drawbar` (the concrete default). So an unset mode collapses the superset to the drawbar arm, byte-identical. */
export function atcTestEffectiveMode(params) { return (params && params.mode === 'pockets') ? 'pockets' : 'drawbar'; }

export class AtcTestWizard {
    generate(params) {
        recordOp('atc_test', params);
        return emitMapped(atcTestStack(params)).text;
    }
}
