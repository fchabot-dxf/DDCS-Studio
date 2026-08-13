/**
 * blocks/dataOps/tapData.js — the TAPPING wizard as a pure DATA twin (the user-facing wizard around the t776 emit core).
 *
 * tapStack flattens to [progstart, wcs, placeonstock{ tap }, progend] — a static tree whose every knob is a scalar in a
 * fixed socket, so a { template, bindings } def + instantiate() cover it. The pitch-locked feed is DERIVED in the tap atom
 * (never a socket), so it can't drift; the form shows it read-only via statusHint. `clearance` fans out (progstart + the
 * tap leaf) so it is held at its default (the drill frontier-#3 pattern). The tap inherits the shared tool picker
 * (toolBindingsFor) — pick a tap tool + the tool-change tie-in for free — and the entry marker.
 */
import { tapStack } from '../../wizards/stacks/tapWizard.js';
import { userOpFromStack } from '../userOps.js';
import { appendEntry, ENTRY_POINT } from '../../wizards/ops/entry.js';
import { appendToolSel } from '../../wizards/ops/toolsel.js';
import { entryBindingsFor, toolBindingsFor } from './deriveBindings.js';
import { WCS_OPTIONS, XY_DATUM_OPTIONS, STOCK_DATUM_OPTIONS } from './wizardOptions.js';
import { tapFeed } from '../../wizards/threads.js';

/** Author defaults — match tapStack's num() fallbacks. optIn:true (tap is absolute placement). */
export const TAP_DEFAULTS = {
    optIn: true,
    x: 0, y: 0, depth: 10, rpm: 400, pitch: 1.0, dwell: 0.3, clearance: 5, rigid: false, wcs: 'active',
    stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, originX: 0, originY: 0, offZ: 0,
};

// Pre-order flatten of tapStack's [progstart, wcs, placeonstock{ tap }, progend]:
//   0 progstart · 1 wcs · 2 placeonstock · 3 tap · 4 progend
// t1758 — MACHINE VARIABLES ROLL OUT, mill family. wcs/stockAttach/pathDatum/stockDatum ride the same shared
// atoms surfacing already declares eligible; stockW/H/stockZ/originX/originY/offZ ride the same placementShift
// text-bake, deferrable. The tap leaf's own x/y/pitch/depth/rpm/dwell are all plain num()-coerced magnitudes
// (tap.js:16-18) with no branch on their value — deferrable.
const TAP_EXEC_BINDINGS = [
    { param: 'wcs', tokenEligible: true, blockIndex: 1, key: 'wcs', type: 'enum', default: TAP_DEFAULTS.wcs, widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS } },
    // placement scalars (block 2, placeonstock)
    { param: 'stockAttach', tokenEligible: true, blockIndex: 2, key: 'stockAttach', type: 'enum', default: TAP_DEFAULTS.stockAttach, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS } },
    { param: 'pathDatum', tokenEligible: true, blockIndex: 2, key: 'pathDatum', type: 'enum', default: TAP_DEFAULTS.pathDatum, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS } },
    // t800 P1-residue — the stock block resolves from the GLOBAL stock (the stock modal), not per-op fields; formHidden like bore/contour/drill (the P5 sweep found tap still spilling them onto the form). Stays in the stack + Blocks + round-trip.
    { param: 'stockDatum', tokenEligible: true, formHidden: true, blockIndex: 2, key: 'stockDatum', type: 'enum', default: TAP_DEFAULTS.stockDatum, widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS } },
    { param: 'stockW', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, blockIndex: 2, key: 'stockW', type: 'number', default: TAP_DEFAULTS.stockW },
    { param: 'stockH', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, blockIndex: 2, key: 'stockH', type: 'number', default: TAP_DEFAULTS.stockH },
    { param: 'stockZ', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, blockIndex: 2, key: 'stockZ', type: 'number', default: TAP_DEFAULTS.stockZ },
    { param: 'originX', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 2, key: 'offX', type: 'number', default: TAP_DEFAULTS.originX },
    { param: 'originY', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 2, key: 'offY', type: 'number', default: TAP_DEFAULTS.originY },
    { param: 'offZ', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 2, key: 'offZ', type: 'number', default: TAP_DEFAULTS.offZ },
    // tap params (block 3, the tap leaf) — plain num()-coerced magnitudes (tap.js:16-18), no branch on their value.
    { param: 'x', tokenRefusal: 'This position is re-resolved by the tap atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 3, key: 'x', type: 'number', default: TAP_DEFAULTS.x },
    { param: 'y', tokenRefusal: 'This position is re-resolved by the tap atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 3, key: 'y', type: 'number', default: TAP_DEFAULTS.y },
    {
        param: 'pitch', tokenRefusal: 'This value is re-resolved by the tap atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 3, key: 'pitch', type: 'number', default: TAP_DEFAULTS.pitch, widget: 'threadpick',
        label: 'Thread', help: 'Pick a standard thread (metric coarse/fine, imperial UNC/UNF) or Custom to type the pitch. Sets the mm lead that locks the feed.',
    },
    { param: 'depth', tokenRefusal: 'This value is re-resolved by the tap atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 3, key: 'depth', type: 'number', default: TAP_DEFAULTS.depth, label: 'Depth (mm)', help: 'Thread depth from engagement — roughly 1–1.5× the major Ø for a blind hole (leave room at the bottom for the tap chamfer + chips).' },
    { param: 'rpm', tokenRefusal: 'This value is re-resolved by the tap atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 3, key: 'rpm', type: 'number', default: TAP_DEFAULTS.rpm, label: 'RPM', help: 'Low — 300–500 rpm. The pitch-locked feed is derived from this.' },
    { param: 'dwell', tokenRefusal: 'This value is re-resolved by the tap atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 3, key: 'dwell', type: 'number', default: TAP_DEFAULTS.dwell, label: 'Stabilize dwell (s)', help: 'A brief pause after the spindle starts, before feeding in.' },
    // rigid: picks between two structurally different cycles (a 7-line G84 canned cycle vs. a 9-line floating-holder
    // M3/M4 sequence, tap.js:21-43) — different line count/content, hardware-safety-gated. Categorical, not deferrable.
    {
        param: 'rigid', tokenRefusal: 'Picks between two structurally different tapping cycles (a canned G84 cycle vs. a floating-holder M3/M4 sequence) — a categorical choice gated on declared spindle hardware, not a value inside one.', blockIndex: 3, key: 'rigid', type: 'bool', default: TAP_DEFAULTS.rigid, widget: 'toggle', label: 'Rigid tap (G84)',
        gate: { param: '_rigidOk', is: false, tip: 'Rigid tapping needs a DECLARED encoder/servo spindle (Settings → Machine → Spindle: "rigid-tap capable") AND the Expert post — the only firmware with dump evidence. Otherwise the floating-holder cycle runs.' },
    },
];

const WRAP_PREFIX_COUNT = 4;   // user_root + panel + sim + param_group
export const TAP_BINDINGS = TAP_EXEC_BINDINGS.map((b) => ({ ...b, blockIndex: b.blockIndex + WRAP_PREFIX_COUNT }));

export const TAP_DATA_OPTYPE = 'user_tap_data';

const _n = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);

import { handleScale } from '../../wizards/ops/placement.js';

/** t778 — DECLARED preview geometry: the tapped hole as a thread-O ring at (x,y) + a pos handle. Placement-parity: the tap
 *  emit's hole rides the placement offset (offX/offY), 0-relative like drill, so the drawn bbox is the hole point. */
export function tapPreviewGeometry(p) {
    const ox = _n(p.originX, 0), oy = _n(p.originY, 0);
    const r = Math.max(1.5, _n(p.pitch, 1) * 3);   // a display ring scaled off the pitch (a visible thread-O, not to scale)
    const ring = []; for (let i = 0; i <= 16; i++) { const a = 2 * Math.PI * i / 16; ring.push({ x: ox + r * Math.cos(a), y: oy + r * Math.sin(a) }); }
    const hs = handleScale(p, '', ox, oy, 0, 0);
    return {
        paths: [{ pts: ring, cls: 'fc-guide' }],
        handles: [{ type: 'point', id: 'tap_pos', fx: 'originX', fy: 'originY', x: ox, y: oy, label: 'pos', ...hs.pos }],
        bbox: { minX: ox, maxX: ox, minY: oy, maxY: oy },
    };
}

/** Build the tap-as-data def: { opType, label, template, bindings } ready for registerUserOp. */
export function tapDataDef() {
    const exec = tapStack(TAP_DEFAULTS);
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            { type: 'param_group', params: { group: 'Tap' }, children: [] },
        ],
        children: appendToolSel(appendEntry(exec)),
    }];
    const def = userOpFromStack('tap_data', 'Tap (data)', stack, [...toolBindingsFor(stack), ...TAP_BINDINGS, ...entryBindingsFor(stack)], 'form3d+2d', null, 'mill_datawiz');
    def.previewGeometry = tapPreviewGeometry;
    def.entryPoint = ENTRY_POINT;
    // The DERIVED pitch-locked feed shown read-only + the reversible/rigid honesty (live per params + the declared spindle).
    def.statusHint = (p) => {
        const rpm = _n(p.rpm, 400), pitch = _n(p.pitch, 1);
        let s = ` · feed ${tapFeed(rpm, pitch)} mm/min (pitch-locked to ${rpm} rpm)`;
        const sp = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {};
        if (!p.rigid && sp.reversible === false) s += ' · ⚠ your spindle is declared NON-reversible — floating-holder tapping needs M4 to back out; declare it reversible in Settings → Machine → Spindle';
        return s;
    };
    return def;
}
