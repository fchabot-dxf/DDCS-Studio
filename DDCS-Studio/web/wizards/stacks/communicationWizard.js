/**
 * wizards/stacks/communicationWizard.js — Communication (HMI) block stack.
 * Generates G-code for controller communication and UI interactions.
 */
import { newBlock } from '../../blocks/blockEmitter.js';

// t632 — commStack is now DIALECT-AGNOSTIC (the HMI idioms are dialect-aware atoms that fold at emit time); it no longer
// resolves the active post at build time (that build-time bake was the twin freeze).
// t2030 — EXPORTED: the one declared source for "format an operator message for G-code embedding." commData.js's own
// postInstantiate recompose (a DIFFERENT construction mechanism — sentinel-swap over an already-built superset, not a
// direct build) needs the SAME formatted string for the SAME params.msg field, and used to hand-type its own byte-
// identical copy; the preview-only mock screen (communicationWizard.js's generateScreenPreview) needs the single-line
// half of the same fact too. Collapsed onto this ONE function rather than three that happened to agree.
export const fmtCtrl = (msg) => String(msg || '').replace(/\r\n|\r|\n/g, ' / ').replace(/\s*\/\s*/g, ' / ').trim();
export const fmtLine = (msg) => String(msg || '').replace(/\r\n|\r|\n/g, ' ').replace(/\s+/g, ' ').trim();

// t2051 — EXPORTED, same reasoning as fmtCtrl/fmtLine above: the ONE declared "which statusMode value means
// persistent" fact. commData.js's postInstantiate recompose and the preview-only mock screen
// (communicationWizard.js's generateScreenPreview) each independently tested their own literal `-3000` for the
// same meaning instead of reading it from here.
export const STATUS_PERSISTENT = -3000;

// t2051 — EXPORTED: the ONE declared beep pulse-count formula (feeds the "System Beep - N pulses of Xms"
// comment only — BEEP()'s own arguments are dur/cyc directly, untouched). commData.js's recompose hand-typed
// the same expression a second time to keep that comment string in sync.
export const beepPulseCount = (dur, cyc) => Math.round(dur / (cyc * 2));

/**
 * Communication (HMI) params → its block SNIPPET (Comment / Set# / If Goto / Goto / Label / Raw). A snippet —
 * no Program Start/End — because it's inserted mid-program. The one source of truth for both displays.
 * #1505 popup / #1503 status / #2070 input / #2042-43 beep — the (msg) goes verbatim in the Set# value.
 */
export function commStack(params = {}, opts = {}) {
    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };
    const A = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; S.push(b); };
    const GO = (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    // t632 — the HMI idioms are now DIALECT-AWARE ATOMS (the probe E-series treatment) that fold per-post at EMIT time, NOT
    // RAW baked with the build-time dialect + gated by a build-time _hmi fork (that froze the twin: it emitted the ACTIVE
    // post's Expert bytes on every post → leaks on V4.1/DM500). Each atom self-degrades per the target dialect.caps:
    //   toast  → message   (hmiToast → Expert #1505=-5000(t); off-HMI `( MSG: t )`)
    //   OK/Cancel + binary → confirm (hmiPrompt(msg,mode) → Expert #1505=<mode>(msg) + IF; off-HMI `( msg )` + M0, pauseOnDegrade)
    //   status → hmistatus (Expert #2039/#1503/#2039/G4; off-HMI `( status: line )`)
    //   input  → asknumber (hmiInput → Expert #2070; off-HMI `( prompt )` + M0 + keeps-prior-value note)
    //   beep   → hmibeep   (Expert #2043/#2042; off-HMI [])
    //   dwell  → dwell     (dialect.dwell() → correct P units per post; the old RAW baked Expert's P and leaked wrong units)
    // So commStack no longer reads the active dialect at all — it's dialect-agnostic DATA the emitter maps. R2: the popup
    // prompt honours its MODE (1 OK/Cancel, 3 binary) per appcode/communicationWizard.nc:7,15 (the old hmiPrompt ignored it).
    const MSGB = (t) => { const b = newBlock('message'); b.params = { text: t }; S.push(b); };
    const CONFIRM = (msg, cancel, mode) => { const b = newBlock('confirm'); b.params = { msg, cancel, mode, pauseOnDegrade: true }; S.push(b); };
    const ASK = (varName, prompt) => { const b = newBlock('asknumber'); b.params = { var: varName, prompt }; S.push(b); };
    const STATUS = (mode, line, color, dwell) => { const b = newBlock('hmistatus'); b.params = { mode, line, color, dwell }; S.push(b); };
    const BEEP = (dur, cyc) => { const b = newBlock('hmibeep'); b.params = { dur, cyc }; S.push(b); };
    const DWELL = (sec) => { const b = newBlock('dwell'); b.params = { sec }; S.push(b); };
    // E0 (t516) — the data-op twin port. `opts.superset` carries the STRUCTURAL forks GUARDED so pruneGuards collapses to the
    // concrete shape: type(popup/status/input/beep/dwell) × popupMode × the conditional slots/dest/cyc. The HMI-vs-degrade fork
    // is GONE (R1) — each atom carries it at emit time — so the twin folds per-post like every other wizard (un-freeze). The
    // guard keys use DERIVED params (_popupMode/_popupToast/_hasDest/_hasCyc, injected by the twin's deriveGuards) so a value-
    // typed fork guards cleanly. Concrete (superset:false) is the untouched imperative build — BYTE-IDENTICAL, prune(superset)==concrete.
    const GUARD = (when, kids) => { const b = newBlock('guard'); b.params = { when }; b.children = kids; return b; };
    const cap = (fn) => { const n = S.length; fn(); return S.splice(n); };   // capture the blocks fn pushes (for GUARD children)
    const superset = !!opts.superset;

    const type = params.type;
    // ── data slots (#1510-1513) — each present iff its param is truthy (only popup/status/input set them; beep/dwell never do) ──
    const SLOTS = [['slot1', '#1510'], ['slot2', '#1511'], ['slot3', '#1512'], ['slot4', '#1513']];
    if (superset) { for (const [p, v] of SLOTS) S.push(GUARD({ param: p, is: true }, cap(() => A(v, params[p])))); }
    else if (['popup', 'status', 'input'].includes(type)) { for (const [p, v] of SLOTS) if (params[p]) A(v, params[p]); }

    const msg = fmtCtrl(params.msg);

    // ── POPUP arm (forks on popupMode 1/3/toast; the atom owns the HMI-vs-degrade) ──
    const popupOkCancel = () => { C('Popup - OK/Cancel'); CONFIRM(msg, 9, 1); C('--- action if OK ---'); LB(9); };
    const popupBinary = () => { C('Popup - Binary Choice'); CONFIRM(msg, 8, 3); C('--- ENTER action ---'); GO(9); LB(8); C('--- ESC action ---'); LB(9); };
    const popupToast = () => { C('Popup - Toast'); MSGB(msg); };
    const popupArm = () => {
        // the toast arm is the "else" (mode NOT 1 and NOT 3 — e.g. the form's -5000) → un-guardable by a single value, so it
        // rides the DERIVED boolean `_popupToast` (= mode !== 1 && mode !== 3), injected by deriveGuards / the E0 test.
        if (superset) S.push(GUARD({ param: '_popupMode', is: 1 }, cap(popupOkCancel)), GUARD({ param: '_popupMode', is: 3 }, cap(popupBinary)), GUARD({ param: '_popupToast', is: true }, cap(popupToast)));
        else { const mode = Number(params.popupMode); if (mode === 1) popupOkCancel(); else if (mode === 3) popupBinary(); else popupToast(); }
    };

    // ── STATUS arm (the hmistatus atom owns #2039 colour + #1503 + the visibility dwell, degrading as one unit) ──
    const line = fmtLine(params.msg);
    const statusMode = (params.statusMode != null && params.statusMode !== '') ? Number(params.statusMode) : 1;
    const statusArm = () => {
        C(statusMode === STATUS_PERSISTENT ? 'Persistent Status Bar' : 'Status Bar Update');
        STATUS(statusMode, line, params.statusColor, params.statusDwell);
    };

    // ── INPUT arm ──
    const idNum = Number(String(params.id).replace('#', ''));
    const useId = (Number.isFinite(idNum) && idNum >= 50 && idNum <= 499) ? idNum : 100;
    const inputArm = () => {
        C('Numeric Input - DDCS Safe');
        ASK(`#${useId}`, msg);
        const copyDest = () => A(String(params.dest), `#${useId}`, 'Copy to persistent');
        if (superset) S.push(GUARD({ param: '_hasDest', is: true }, cap(copyDest)));
        else if (params.dest && String(params.dest).trim() !== '') copyDest();
    };

    // ── BEEP arm (cyc fork — the pulsed vs plain COMMENT differs; the hmibeep atom owns the #2042/#2043 register fork) ──
    const beepArm = () => {
        const dur = (params.val != null && params.val !== '') ? params.val : 500;
        const beepCyc = () => { const cyc = Number(params.cycle); C(`System Beep - ${beepPulseCount(dur, cyc)} pulses of ${cyc}ms`); BEEP(dur, cyc); };
        const beepPlain = () => { C('System Beep'); BEEP(dur, 0); };
        if (superset) S.push(GUARD({ param: '_hasCyc', is: true }, cap(beepCyc)), GUARD({ param: '_hasCyc', is: false }, cap(beepPlain)));
        else { const cyc = (params.cycle != null && params.cycle !== '') ? Number(params.cycle) : 0; if (cyc > 0) beepCyc(); else beepPlain(); }
    };

    // ── DWELL arm — the dwell atom folds per-post (Expert P=ms, DM500 P=sec). `val` is MILLISECONDS (commData: "dwell ms");
    //    dialect.dwell()'s contract is SECONDS, so convert (÷1000). The old RAW baked the ACTIVE post's P and leaked wrong units.
    const dwellArm = () => { C('Dwell'); DWELL((Number(params.val) || 0) / 1000); };

    if (superset) {
        S.push(
            GUARD({ param: 'type', is: 'popup' }, cap(popupArm)),
            GUARD({ param: 'type', is: 'status' }, cap(statusArm)),
            GUARD({ param: 'type', is: 'input' }, cap(inputArm)),
            GUARD({ param: 'type', is: 'beep' }, cap(beepArm)),
            GUARD({ param: 'type', is: 'dwell' }, cap(dwellArm)),
        );
    } else if (type === 'popup') popupArm();
    else if (type === 'status') statusArm();
    else if (type === 'input') inputArm();
    else if (type === 'beep') beepArm();
    else if (type === 'dwell') dwellArm();
    else C(`Unknown communication type: ${type}`);
    return S;
}
