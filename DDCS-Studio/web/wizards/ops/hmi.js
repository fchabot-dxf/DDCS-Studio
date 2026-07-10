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
    defaults: { value: '1', note: '' }, fields: ['value', 'note'],
    emit: (p, dx, dy, dialect) => {
        const value = (p.value === '' || p.value == null) ? '0' : String(p.value);
        const note = clean(p.note);
        if (dialect && typeof dialect.hmiLine === 'function') return dialect.hmiLine(value, note);
        return note ? [`( ${note} )`] : [];   // honest degrade — the instruction as a comment, no unmapped register write
    },
};

export const confirmBlock = {
    type: 'confirm', label: 'Confirm', kind: 'leaf', category: 'Control',
    defaults: { msg: 'Press Enter to continue', cancel: 2 }, fields: ['msg', 'cancel'],
    // Operator OK/Cancel gate: the controller's blocking prompt (dialect.hmiPrompt → Expert `#1505=1(msg)`)
    // PLUS an ESC→cancel jump to <cancel>. PROFILE-AWARE: on controllers with no scripted prompt (V4.1/DM500
    // hmiPrompt → []) the whole gate folds to nothing, so the macro runs straight through (the operator just
    // positions the tool and starts the program). One granular block for "confirm or bail".
    emit: (p, dx, dy, dialect) => {
        const prompt = dialect.hmiPrompt(clean(p.msg));
        if (!prompt.length) return [];                       // no scripted HMI on this controller → fold
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

export const askNumberBlock = {
    type: 'asknumber', label: 'Ask Number', kind: 'leaf', category: 'Control',
    defaults: { var: '#100', prompt: 'enter value' }, fields: ['var', 'prompt'],
    emit: (p, dx, dy, dialect) => {
        const v = (p.var || '#100').trim(), pr = clean(p.prompt);
        const out = dialect.hmiInput(v, pr);
        return out.length ? out : [`( ASK ${v}: ${pr} - controller has no scripted input )`];
    },
};
