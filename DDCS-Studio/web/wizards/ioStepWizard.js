/**
 * wizards/ioStepWizard.js — the GROUPED I/O-step wizard (Setup/IO increment 2): ONE wizard, a MODE picker
 * (output / input / dwell), replacing the three quick-insert atoms (outPinBlock / waitInputBlock / dwellBlock).
 *
 * WHY grouped: Set Output, Wait Input and Dwell are one family of "machine-step" ops. A single wizard with a mode
 * picker is friendlier than three near-identical entries, and lets Output/Input reference the user's DECLARED I/O
 * BY NAME (settings.outputs / settings.inputs) — pick "Coolant" and emit its declared on/off M-code; pick a declared
 * input and poll its pin — instead of a bare pin number. A RAW-PIN fallback stays for pins not yet declared.
 *
 * The emit reuses the SAME leaf atoms (outpin/waitinput/dwell) so the Blocks palette + the round-trip are unchanged;
 * a DECLARED output emits its configured code as a RAW line (dialect-independent — the user's M-code IS the truth).
 *
 * SEPARATION: `resolveIoParams` reads settings (getOutputs/getInputs) and folds the DECLARED row's values into the
 * params (outDeclared/outOn/outOff/outLabel · inDeclared/inPin/inLabel). `ioStepStack` is then PURE over those params
 * (no settings read) — so the E0 superset gate is a clean prune==concrete, and the twin's postInstantiate swaps the
 * SENTINEL row values (mirrors the Comm twin's message recompose). The concrete emit = ioStepStack(resolveIoParams(p)).
 */
import { newBlock } from '../blocks/blockEmitter.js';
import { resolveActivePost, getCaps } from './dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
import { getOutputs, getInputs } from '../ui/settingsPanel.js';

const getDialect = () => { try { return resolveActivePost(getActiveProfile().id); } catch (_) { return null; } };
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

// SENTINELS — the twin's SUPERSET_PARAMS bakes these for the DECLARED-I/O row values (a RAW M-code line / a poll pin);
// the twin's postInstantiate swaps them for the resolved getOutputs/getInputs row. Distinctive, transform-proof tokens.
export const IO_SENT = { outOn: 'IOONCODE', outOff: 'IOOFFCODE', outLabel: 'IOOUTLABEL', inPin: 987654, inLabel: 'IOINLABEL' };

/** Resolve a declared OUTPUT row by id (settings.outputs) → { onCode, offCode, label } | null (id 'raw'/'' → null). */
export function resolveOutput(ref) {
    if (!ref || ref === 'raw') return null;
    const row = (getOutputs() || []).find((r) => r && String(r.id) === String(ref));
    return row ? { onCode: row.onCode || '', offCode: row.offCode || '', label: row.label || '' } : null;
}
/** Resolve a declared INPUT row by id (settings.inputs) → { pin, label } | null (id 'raw'/'' → null). */
export function resolveInput(ref) {
    if (!ref || ref === 'raw') return null;
    const row = (getInputs() || []).find((r) => r && String(r.id) === String(ref));
    return row ? { pin: (row.pin === '' || row.pin == null) ? 0 : Number(row.pin), label: row.label || '' } : null;
}

/** Fold the DECLARED-I/O row values (settings) into the raw params so ioStepStack stays PURE over its params. */
export function resolveIoParams(p = {}) {
    const o = resolveOutput(p.outputRef), i = resolveInput(p.inputRef);
    return {
        ...p,
        outDeclared: !!o, outOn: o ? o.onCode : '', outOff: o ? o.offCode : '', outLabel: o ? o.label : '',
        inDeclared: !!i, inPin: i ? i.pin : num(p.pin, 0), inLabel: i ? i.label : '',
    };
}

/** RESOLVED io-step params → its block stack (Comment / Output / Wait / Dwell). A snippet — inserted mid-program.
 *  PURE over params: the declared row values arrive pre-resolved (resolveIoParams) or as sentinels (the twin). */
export function ioStepStack(params = {}, opts = {}) {
    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };
    const RAW = (t) => { const b = newBlock('raw'); b.params = { text: t }; S.push(b); };
    const OUTPIN = (p) => { const b = newBlock('outpin'); b.params = { pin: p.pin, state: p.state, sync: p.sync }; S.push(b); };
    const WAITIN = (p) => { const b = newBlock('waitinput'); b.params = { pin: p.pin, mode: p.mode, timeout: p.timeout, var: p.var }; S.push(b); };
    const DWELL = (sec) => { const b = newBlock('dwell'); b.params = { sec }; S.push(b); };
    const GUARD = (when, kids) => { const b = newBlock('guard'); b.params = { when }; b.children = kids; return b; };
    const cap = (fn) => { const n = S.length; fn(); return S.splice(n); };
    const superset = !!opts.superset;

    const mode = params.mode || 'output';
    const on = params.state !== 'off';

    // ── OUTPUT arm: a DECLARED output emits its configured on/off M-code (dialect-independent); RAW pin → the outpin atom ──
    const outDeclared = () => { C(`${params.outLabel} — ${on ? 'on' : 'off'}`); RAW((on ? params.outOn : params.outOff) || ''); };
    const outRaw = () => OUTPIN({ pin: num(params.pin, 0), state: on ? 'on' : 'off', sync: params.sync !== false });
    const outputArm = () => {
        if (superset) S.push(GUARD({ param: '_outDeclared', is: true }, cap(outDeclared)), GUARD({ param: '_outDeclared', is: false }, cap(outRaw)));
        else if (params.outDeclared) outDeclared(); else outRaw();
    };

    // ── INPUT arm: a DECLARED input polls its configured pin (label as a comment); RAW → the pin directly. The atom's
    //    per-dialect emit handles the WHILE-poll (Expert) / M66 (RS274) / hint (V4.1/DM500). ──
    const inDeclared = () => { C(`Wait: ${params.inLabel}`); WAITIN({ pin: params.inPin, mode: params.mode2 || 'rise', timeout: num(params.timeout, 0), var: params.var || '#5399' }); };
    const inRaw = () => WAITIN({ pin: num(params.waitPin != null ? params.waitPin : params.pin, 0), mode: params.mode2 || 'rise', timeout: num(params.timeout, 0), var: params.var || '#5399' });
    const inputArm = () => {
        if (superset) S.push(GUARD({ param: '_inDeclared', is: true }, cap(inDeclared)), GUARD({ param: '_inDeclared', is: false }, cap(inRaw)));
        else if (params.inDeclared) inDeclared(); else inRaw();
    };

    const dwellArm = () => DWELL(num(params.sec, 1));

    if (superset) {
        S.push(GUARD({ param: '_mode', is: 'output' }, cap(outputArm)), GUARD({ param: '_mode', is: 'input' }, cap(inputArm)), GUARD({ param: '_mode', is: 'dwell' }, cap(dwellArm)));
    } else if (mode === 'output') outputArm();
    else if (mode === 'input') inputArm();
    else if (mode === 'dwell') dwellArm();

    return S;
}

/** The concrete emit for the quick-insert / preview: resolve the declared I/O, then build. */
export function ioStepStackResolved(params = {}, opts = {}) { return ioStepStack(resolveIoParams(params), opts); }

/** Is Wait-Input available on the active post? (Expert generic poll or an RS274/oword M66 post.) UI uses this to grey. */
export function ioInputSupported() {
    const d = getDialect(); if (!d) return false;
    const caps = getCaps(d.id) || {};
    return !!(caps.flow === 'oword' || caps.inputRead);   // RS274/grblHAL M66, or DDCS Expert generic poll (matches the waitinput atom gate)
}
