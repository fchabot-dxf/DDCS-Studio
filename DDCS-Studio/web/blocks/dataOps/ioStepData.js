/**
 * blocks/dataOps/ioStepData.js — the grouped I/O-step wizard as a DATA op (Setup/IO increment 2, E2).
 *
 * ONE wizard, a MODE picker (output / input / dwell). Built on the E0/E1 superset (ioStepStack): `deriveGuards` injects
 * `_mode` / `_outDeclared` / `_inDeclared` so pruneGuards collapses the superset to the concrete mode + declared/raw
 * shape; `postInstantiate` (applyIoRecompose) fills the pruned leaf params from the instance — including the DECLARED-I/O
 * values RE-RESOLVED from settings.outputs/inputs (the selected name → its on/off M-code / poll pin), so a relabel/recode
 * flows on re-edit (one-source, the ATC pin-picker's relabel-proof join). The declared row values ride SENTINELS in the
 * superset (IO_SENT) that the recompose swaps — the Comm-twin message-recompose pattern.
 *
 * Emit BYTE-IDENTICAL to ioStepStackResolved (the quick-insert path) across the mode × declared/raw sweep.
 */
import { userOpFromStack, flattenBlocks } from '../userOps.js';
import { ioStepStack, resolveIoParams, IO_SENT } from '../../wizards/ioStepWizard.js';

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/** Author defaults — mirror the FORM field defaults (the twin-default rule), NOT any builder fallback. */
export const IO_STEP_DEFAULTS = {
    mode: 'output', outputRef: 'raw', state: 'on', pin: 0, sync: true,
    inputRef: 'raw', mode2: 'rise', timeout: 0, var: '#5399', waitPin: 0, sec: 1,
};

// The SUPERSET bakes SENTINEL declared-I/O row values + outDeclared/inDeclared TRUE so the template carries the declared
// arms; the recompose resolves the instance's real row. The raw arms' leaf params are filled from the instance too.
const SUPERSET_PARAMS = {
    mode: 'output', state: 'on', pin: 0, sync: true, mode2: 'rise', timeout: 0, var: '#5399', waitPin: 0, sec: 1,
    outDeclared: true, outOn: IO_SENT.outOn, outOff: IO_SENT.outOff, outLabel: IO_SENT.outLabel,
    inDeclared: true, inPin: IO_SENT.inPin, inLabel: IO_SENT.inLabel,
};

export const IO_STEP_OPTYPE = 'user_io_step';

/** The wrapped user_root template — the superset (all mode arms + declared/raw forks), byte-transparent wrap. */
export function ioStepDataStack(params = SUPERSET_PARAMS) {
    const exec = ioStepStack(params, { superset: true });
    return [{
        type: 'user_root', params: {},
        uiChildren: [{ type: 'param_group', params: { group: 'I/O Step' }, children: [] }],
        children: exec,
    }];
}

/** deriveGuards — the mode + declared/raw guard keys (the superset collapses to the concrete shape). */
export function ioStepDeriveGuards(p) {
    const rp = resolveIoParams(p);
    return { _mode: p.mode || 'output', _outDeclared: !!rp.outDeclared, _inDeclared: !!rp.inDeclared };
}

/** postInstantiate — fill the pruned leaf params from the instance; the DECLARED-I/O values re-resolved from settings. */
function applyIoRecompose(stack, resolved) {
    const p = resolved || {};
    const rp = resolveIoParams(p);
    const on = p.state !== 'off';
    for (const b of flattenBlocks(stack)) {
        if (!b || !b.params) continue;
        if (b.type === 'outpin') b.params = { pin: num(p.pin, 0), state: on ? 'on' : 'off', sync: p.sync !== false };
        else if (b.type === 'waitinput') b.params = { pin: rp.inDeclared ? rp.inPin : num(p.waitPin != null ? p.waitPin : p.pin, 0), mode: p.mode2 || 'rise', timeout: num(p.timeout, 0), var: p.var || '#5399' };
        else if (b.type === 'dwell') b.params = { sec: num(p.sec, 1) };
        else if (b.type === 'raw' && (b.params.text === IO_SENT.outOn || b.params.text === IO_SENT.outOff)) b.params.text = (on ? rp.outOn : rp.outOff) || '';
        else if (b.type === 'comment' && b.params.text && b.params.text.includes(IO_SENT.outLabel)) b.params.text = `${rp.outLabel} — ${on ? 'on' : 'off'}`;
        else if (b.type === 'comment' && b.params.text && b.params.text.includes(IO_SENT.inLabel)) b.params.text = `Wait: ${rp.inLabel}`;
    }
    return stack;
}

/** Build the I/O-step data-op def — deriveGuards + the declared-I/O recompose. Byte-identical to ioStepStackResolved. */
export function ioStepDataDef() {
    // no '*_datawiz' group: the twin is opened IN-PLACE from the built-in I/O Step setup entry (opensAs) and its own menu
    // entry is hidden (wizardLibrary drops opensAs targets), so it never lands in a separate Data Wiz dropdown.
    const def = userOpFromStack('io_step', 'I/O Step', ioStepDataStack(), IO_STEP_BINDINGS, 'form', undefined, undefined);
    def.deriveGuards = ioStepDeriveGuards;
    def.postInstantiate = (stack, resolved) => applyIoRecompose(stack, resolved);
    return def;
}

// ── FORM bindings (the WORK-LOG mockup) — mode picker + per-mode fields (when-gated). The declared-I/O pickers use the
//    `declared-io` widget (lists settings.outputs/inputs BY NAME + a raw-pin fallback). ──
export const IO_STEP_BINDINGS = [
    { param: 'mode', type: 'enum', default: 'output', label: 'Mode', help: 'Set an output / wait on an input / dwell.', section: 'TYPE', widget: 'segmented', widgetConfig: { options: [['Output', 'output'], ['Input', 'input'], ['Dwell', 'dwell']], gateSeg: { value: 'input', pred: 'ioInput', fallback: 'output', tip: 'Wait-Input needs a DDCS Expert (or RS274/grblHAL) post' } } },
    // OUTPUT
    { param: 'outputRef', type: 'string', default: 'raw', label: 'Output', help: 'Pick a declared output (emits its on/off M-code) or a raw pin.', section: 'GEOMETRY', when: { param: 'mode', is: 'output' }, widget: 'declared-io', widgetConfig: { kind: 'output' } },
    { param: 'state', type: 'enum', default: 'on', label: 'State', help: 'Turn the output on or off.', section: 'GEOMETRY', when: { param: 'mode', is: 'output' }, widget: 'segmented', widgetConfig: { options: [['On', 'on'], ['Off', 'off']] } },
    { param: 'pin', type: 'number', default: 0, label: 'Raw pin', help: 'Output pin (0-20) — used when no declared output is picked.', section: 'GEOMETRY', whenAll: [{ param: 'mode', is: 'output' }, { param: 'outputRef', is: 'raw' }] },
    // INPUT
    { param: 'inputRef', type: 'string', default: 'raw', label: 'Input', help: 'Pick a declared input (polls its pin) or a raw pin.', section: 'GEOMETRY', when: { param: 'mode', is: 'input' }, widget: 'declared-io', widgetConfig: { kind: 'input' } },
    { param: 'mode2', type: 'enum', default: 'rise', label: 'Edge', help: 'Wait for rise / fall / high / low.', section: 'GEOMETRY', when: { param: 'mode', is: 'input' }, widget: 'segmented', widgetConfig: { options: [['Rise', 'rise'], ['Fall', 'fall'], ['High', 'high'], ['Low', 'low']] } },
    { param: 'timeout', type: 'number', default: 0, label: 'Timeout (ms)', help: 'RS274 M66 timeout (0 = wait forever).', section: 'GEOMETRY', when: { param: 'mode', is: 'input' } },
    { param: 'var', type: 'string', default: '#5399', label: 'Result var', help: 'RS274 M66 result variable.', section: 'GEOMETRY', when: { param: 'mode', is: 'input' } },
    { param: 'waitPin', type: 'number', default: 0, label: 'Raw pin', help: 'Input pin — used when no declared input is picked.', section: 'GEOMETRY', whenAll: [{ param: 'mode', is: 'input' }, { param: 'inputRef', is: 'raw' }] },
    // DWELL
    { param: 'sec', type: 'number', default: 1, label: 'Seconds', help: 'Pause this many seconds (G04 P).', section: 'GEOMETRY', when: { param: 'mode', is: 'dwell' } },
];
