/**
 * wizards/ops/hmi.js — operator-facing primitives (pause / on-screen message / numeric input).
 *
 * PROFILE-AWARE via the active dialect's HMI forms (wizards/dialects/*):
 *   Pause       → M00 program stop — universal (DDCS key-3.nc:55, RS274 core, Centroid). Resume on Cycle Start.
 *   Message     → dialect.hmiToast: Expert `#1505=-5000(text)`, Centroid `M225`, RS274 `(MSG,text)`.
 *   Ask Number  → dialect.hmiInput: Expert `#2070=<var>(prompt)` (pauses for entry), Centroid `M224`.
 * Controllers with no scripted message/input (V4.1, DM500) fall back to a plain G-code comment so the intent
 * is never silently dropped. Text is paren-stripped (the host forms wrap it in `(…)`). See [[ddcs-ground-truth-reference]].
 */

import { num } from './util.js';

/** Strip parens from operator text so it can't break the `(…)` the host message/comment forms wrap it in. */
const clean = (s) => String(s == null ? '' : s).replace(/[()]/g, '').trim();

export const hmilineBlock = {
    // A bare controller-message write — the corner/probe family's #1505 note (start prompt / "found" banner / error).
    // PROFILE-AWARE: Expert emits its WIZARD-spaced `#1505=<value> ( <note> )` form (byte-identical to the old `assign`
    // block it replaces); a post with NO scripted HMI (dialect.hmiLine absent → V4.1/DM500/…) degrades to a plain comment
    // so the operator instruction SURVIVES without an unmapped #1505 write. Distinct from `confirm` (which adds an ESC/GOTO
    // gate + uses the no-space hmiPrompt form) — this is a bare note, no branch, matching corner's exact bytes.
    type: 'hmiline', label: 'HMI Line', kind: 'leaf', category: 'Control',
    defaults: { value: '1', note: '', var: '#1505' }, fields: ['value', 'note', 'var'],
    emit: (p, dx, dy, dialect) => {
        const value = (p.value === '' || p.value == null) ? '0' : String(p.value);
        const note = clean(p.note);
        const varName = p.var || '#1505';   // default the HMI message register; alignment's RESULT lines pass #1510/#1511/#1512
        if (dialect && typeof dialect.hmiLine === 'function') return dialect.hmiLine(value, note, varName);
        return note ? [`( ${note} )`] : [];   // honest degrade — the note as a comment (keeps the meaning), no unmapped register write
    },
};

export const hmiConfirmBlock = {
    // A spaced CONFIRM gate (the probe wizards' start / reposition prompt): the operator sets #1505 to continue, ESC sets it
    // to 0 → skip to <cancel>. PROFILE-AWARE: Expert = the spaced `#1505=<v> ( <note> )` (byte-identical to the old assign)
    // PLUS `IF #1505==0 GOTO<cancel>`; a post with NO scripted HMI (dialect.hmiLine absent → V4.1/DM500) folds BOTH lines to
    // a plain comment (the instruction survives) with NO ESC IF — so the macro can't mis-branch on an unset #1505. Distinct
    // from `confirm` (that uses the no-space hmiPrompt form); this matches the probe wizards' exact SPACED bytes incl. the IF.
    type: 'hmiconfirm', label: 'HMI Confirm', kind: 'leaf', category: 'Control',
    defaults: { value: '1', note: '', cancel: 2 }, fields: ['value', 'note', 'cancel'],
    emit: (p, dx, dy, dialect) => {
        const value = (p.value === '' || p.value == null) ? '1' : String(p.value);
        const note = clean(p.note);
        const cancel = Math.max(0, Math.round(num(p.cancel, 2)));
        if (dialect && typeof dialect.hmiLine === 'function') {
            const cv = dialect.hmiCancelVar || '#1505';
            return [...dialect.hmiLine(value, note), ...dialect.ifGoto(cv, '==', '0', cancel)];
        }
        return note ? [`( ${note} )`] : [];   // no scripted HMI → the instruction as a comment, NO ESC (can't mis-branch)
    },
};

export const confirmBlock = {
    type: 'confirm', label: 'Confirm', kind: 'leaf', category: 'Control',
    defaults: { msg: 'Press Enter to continue', cancel: 2, mode: 1, pauseOnDegrade: false }, fields: ['msg', 'cancel', 'mode', 'pauseOnDegrade'],
    // Operator OK/Cancel gate: the controller's blocking prompt (dialect.hmiPrompt → Expert `#1505=<mode>(msg)`, mode 1=OK/Cancel,
    // 3=binary) PLUS an ESC→cancel jump to <cancel>. PROFILE-AWARE: on controllers with no scripted prompt (V4.1/DM500 hmiPrompt →
    // []) the gate degrades. `mode` (default 1) + `pauseOnDegrade` (default false) DEFAULT TO THE PRIOR BEHAVIOUR so every existing
    // caller (alignment/ATC/rotary confirms) is byte-identical; comm's operator popups opt into pauseOnDegrade so a BLOCKING dialog
    // still BLOCKS off-HMI — it folds to `( msg )` + M0 (the operator reads it, presses Cycle Start). One granular block for "confirm or bail".
    emit: (p, dx, dy, dialect) => {
        const prompt = dialect.hmiPrompt(clean(p.msg), num(p.mode, 1));
        if (!prompt.length) return p.pauseOnDegrade ? [`( ${clean(p.msg)} )`, 'M0'] : [];   // no scripted HMI → fold (or block-degrade for operator dialogs)
        if (!dialect.hmiCancelVar) return prompt;            // prompt has no cancel signal (e.g. RS274 M0 pause) → no bail jump
        const lbl = Math.max(0, Math.round(num(p.cancel, 2)));
        return [...prompt, ...dialect.ifGoto(dialect.hmiCancelVar, '==', '0', lbl)];   // ESC sets cancelVar=0 → bail to <cancel>
    },
};

export const pauseBlock = {
    type: 'pause', label: 'Pause', kind: 'leaf', category: 'Control',
    defaults: {}, fields: [],
    emit: () => ['M00   ( pause - press Cycle Start to resume )'],   // universal program stop
};

export const messageBlock = {
    type: 'message', label: 'Message', kind: 'leaf', category: 'Mark Up',
    defaults: { text: 'check setup' }, fields: ['text'],
    emit: (p, dx, dy, dialect) => {
        const t = clean(p.text);
        const out = dialect.hmiToast(t);
        return out.length ? out : [`( MSG: ${t} )`];   // no scripted message on this controller → a comment
    },
};

// t1031 — PAUSE & CONFIRM (v1 = shape A): show the operator MESSAGE (Expert #1505=-5000 banner via messageBlock/hmiToast;
// else a `( MSG: … )` comment) then M00 (program stop — the machine halts, resume on Cycle Start). A thin WRAP of the
// existing messageBlock + pauseBlock — no new emit logic; the standalone Pause/Confirm op AND the stepdown `confirmEvery`
// injection both emit THIS one atom. SIM NOTE: M0 is a MACHINE stop, not a sim-visible pause (the engine no-ops M0). The
// Expert OK/Cancel BLOCKING confirm (shape B, via dialect.hmiPrompt + ESC-cancel) is the natural upgrade — swap the message
// line for confirmBlock's prompt then. Default msg is a plain shop instruction.
// t1032 REVIEW-FIX — ONE-SOURCE default message: the field default AND the emit fallback read this const, so the
// between-pass INJECTION (which calls emit with empty params → p.msg undefined) carries the same text as the standalone op
// instead of a BLANK banner (#1505=-5000() ) / blank ( MSG: ) comment.
export const PAUSE_DEFAULT_MSG = 'Pause — check the part, then press Cycle Start to continue';
export const pauseConfirmBlock = {
    type: 'pauseconfirm', label: 'Pause / Confirm', kind: 'leaf', category: 'Control',
    defaults: { msg: PAUSE_DEFAULT_MSG }, fields: ['msg'],
    emit: (p, dx, dy, dialect) => [...messageBlock.emit({ text: p.msg || PAUSE_DEFAULT_MSG }, dx, dy, dialect), ...pauseBlock.emit()],
};

export const hmiStatusBlock = {
    // The status-bar idiom (comm's status arm): a colour-wrapped #1503 write + an optional visibility dwell. PROFILE-AWARE via
    // dialect.hmiStatus (Expert = the exact #2039/#1503/#2039/G4 bytes); a post with NO hmiStatus (V4.1/DM500/grbl/rs274/centroid —
    // #1503 is DDCS-specific) degrades to a `( status: <line> )` comment (the status text is OUTPUT — keep the meaning, no unmapped register).
    type: 'hmistatus', label: 'HMI Status', kind: 'leaf', category: 'Control',
    defaults: { mode: 1, line: '', color: -1, dwell: 0 }, fields: ['mode', 'line', 'color', 'dwell'],
    emit: (p, dx, dy, dialect) => {
        const line = clean(p.line);
        const mode = (p.mode == null || p.mode === '') ? 1 : Number(p.mode);
        if (dialect && typeof dialect.hmiStatus === 'function') return dialect.hmiStatus(mode, line, { color: p.color, dwell: p.dwell });
        return line ? [`( status: ${line} )`] : [];   // honest degrade — the status text as a comment, no unmapped #1503/#2039
    },
};

export const hmiBeepBlock = {
    // The system-beep idiom (comm's beep arm): #2043 pulse width (pulsed) + #2042 duration. PROFILE-AWARE via dialect.beep (Expert =
    // the exact bytes); a post with NO beep folds to [] — a beep is HMI FEEDBACK with no off-controller meaning to keep (R4).
    type: 'hmibeep', label: 'HMI Beep', kind: 'leaf', category: 'Control',
    defaults: { dur: 500, cyc: 0 }, fields: ['dur', 'cyc'],
    emit: (p, dx, dy, dialect) => {
        if (dialect && typeof dialect.beep === 'function') return dialect.beep(num(p.dur, 500), num(p.cyc, 0));
        return [];   // no scripted beep → nothing (no meaning to keep)
    },
};

export const askNumberBlock = {
    type: 'asknumber', label: 'Ask Number', kind: 'leaf', category: 'Control',
    defaults: { var: '#100', prompt: 'enter value' }, fields: ['var', 'prompt'],
    scratch: [[100, 100]],   // t1085 — the default var the operator entry lands in
    // Blocking numeric entry (dialect.hmiInput → Expert `#2070=<n>(prompt)`). Off-HMI (hmiInput → []) it's a BLOCKING operator
    // dialog, so it degrades to `( prompt )` + M0 + a note that the target var KEEPS ITS PRIOR VALUE (no guessed input) — the
    // operator edits the var if needed, then Cycle Start. (Contrast the probe-flow hmiconfirm, which folds comment-NO-pause.)
    emit: (p, dx, dy, dialect) => {
        const v = (p.var || '#100').trim(), pr = clean(p.prompt);
        const out = dialect.hmiInput(v, pr);
        return out.length ? out : [`( ${pr} )`, 'M0', `( no scripted input - ${v} keeps its prior value; edit it then Cycle Start )`];
    },
};
