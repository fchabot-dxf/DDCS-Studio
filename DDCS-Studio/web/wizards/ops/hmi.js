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

/** Strip parens from operator text so it can't break the `(…)` the host message/comment forms wrap it in. */
const clean = (s) => String(s == null ? '' : s).replace(/[()]/g, '').trim();

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
