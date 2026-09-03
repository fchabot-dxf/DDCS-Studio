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
import { rigidAttested } from '../../wizards/ops/tap.js';   // t2123 — the SAME predicate tapCycle's own rigidOk uses
import { resolveActivePost } from '../../wizards/dialects/index.js';
import { getActiveProfile } from '../../shared/js/profiles/controllerProfiles.js';

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
// t2401 (CLOSE THE REGISTRY) — sectioned by OWN structure (no live shell — the advisor's own t2381 count):
// placement/position fields (WHERE it cuts) → GEOMETRY; the tapping mechanics + tool (HOW it cuts) → TOOL &
// CUT — the same identity/geometry/tool-cut reading formWidgets.js's own SECTION_RANK comment gives. No
// IDENTITY fields: tap has no "which variant" selector the way corner's `corner`/`probeSeq` do — every field
// here is either a coordinate or a cutting parameter.
const TAP_EXEC_BINDINGS = [
    { param: 'wcs', tokenEligible: true, blockIndex: 1, key: 'wcs', type: 'enum', default: TAP_DEFAULTS.wcs, widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS }, section: 'GEOMETRY' },
    // placement scalars (block 2, placeonstock)
    { param: 'stockAttach', tokenEligible: true, blockIndex: 2, key: 'stockAttach', type: 'enum', default: TAP_DEFAULTS.stockAttach, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, section: 'GEOMETRY' },
    { param: 'pathDatum', tokenEligible: true, blockIndex: 2, key: 'pathDatum', type: 'enum', default: TAP_DEFAULTS.pathDatum, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, section: 'GEOMETRY' },
    // t800 P1-residue — the stock block resolves from the GLOBAL stock (the stock modal), not per-op fields; formHidden like bore/contour/drill (the P5 sweep found tap still spilling them onto the form). Stays in the stack + Blocks + round-trip.
    { param: 'stockDatum', tokenEligible: true, formHidden: true, blockIndex: 2, key: 'stockDatum', type: 'enum', default: TAP_DEFAULTS.stockDatum, widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS }, section: 'GEOMETRY' },
    { param: 'stockW', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, blockIndex: 2, key: 'stockW', type: 'number', default: TAP_DEFAULTS.stockW, section: 'GEOMETRY' },
    { param: 'stockH', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, blockIndex: 2, key: 'stockH', type: 'number', default: TAP_DEFAULTS.stockH, section: 'GEOMETRY' },
    { param: 'stockZ', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, blockIndex: 2, key: 'stockZ', type: 'number', default: TAP_DEFAULTS.stockZ, section: 'GEOMETRY' },
    { param: 'originX', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 2, key: 'offX', type: 'number', default: TAP_DEFAULTS.originX, section: 'GEOMETRY' },
    { param: 'originY', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 2, key: 'offY', type: 'number', default: TAP_DEFAULTS.originY, section: 'GEOMETRY' },
    { param: 'offZ', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 2, key: 'offZ', type: 'number', default: TAP_DEFAULTS.offZ, section: 'GEOMETRY' },
    // tap params (block 3, the tap leaf) — plain num()-coerced magnitudes (tap.js:16-18), no branch on their value.
    { param: 'x', tokenRefusal: 'This position is re-resolved by the tap atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 3, key: 'x', type: 'number', default: TAP_DEFAULTS.x, section: 'GEOMETRY' },
    { param: 'y', tokenRefusal: 'This position is re-resolved by the tap atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 3, key: 'y', type: 'number', default: TAP_DEFAULTS.y, section: 'GEOMETRY' },
    {
        param: 'pitch', tokenRefusal: 'This value is re-resolved by the tap atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 3, key: 'pitch', type: 'number', default: TAP_DEFAULTS.pitch, widget: 'threadpick', section: 'TOOL & CUT',
        label: 'Thread', help: 'Pick a standard thread (metric coarse/fine, imperial UNC/UNF) or Custom to type the pitch. Sets the mm lead that locks the feed.',
    },
    { param: 'depth', tokenRefusal: 'This value is re-resolved by the tap atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 3, key: 'depth', type: 'number', default: TAP_DEFAULTS.depth, label: 'Depth (mm)', help: 'Thread depth from engagement — roughly 1–1.5× the major Ø for a blind hole (leave room at the bottom for the tap chamfer + chips).', section: 'TOOL & CUT' },
    { param: 'rpm', tokenRefusal: 'This value is re-resolved by the tap atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 3, key: 'rpm', type: 'number', default: TAP_DEFAULTS.rpm, label: 'RPM', help: 'Low — 300–500 rpm. The pitch-locked feed is derived from this.', section: 'TOOL & CUT' },
    // t2401 (BACKLOG #48 item 5, "tap.rigid → dwell") — `dwell` is read ONLY in tap.js's own floating-holder
    // branch (tapCycle: `...dwellLines` at its own line 119) — the rigid G84 branch (`if (rigidOk)`) never
    // reads it at all; M29 synchronizes the spindle to Z directly, no separate stabilize pause. A dead field
    // once the cycle actually runs rigid. Greyed (not hidden — `gate`, not `when`, matching `rigid`'s own
    // established mechanism) on the COMPOUND condition that mirrors emit's own `rigidOk = !!p.rigid &&
    // rigidAttested(dialect)`: the checkbox ticked AND the machine capability holds (`_rigidOk`, the SAME
    // derived param `rigid`'s own gate already reads) — ticking `rigid` alone on an incapable machine still
    // degrades to the floating-holder cycle, where dwell stays live.
    { param: 'dwell', tokenRefusal: 'This value is re-resolved by the tap atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 3, key: 'dwell', type: 'number', default: TAP_DEFAULTS.dwell, label: 'Stabilize dwell (s)', help: 'A brief pause after the spindle starts, before feeding in.', section: 'TOOL & CUT', gate: { all: [{ param: 'rigid', is: true }, { param: '_rigidOk', is: true }], tip: 'Unused when the rigid (G84) cycle actually runs — M29 synchronizes the spindle to Z directly, no separate stabilize pause.' } },
    // rigid: picks between two structurally different cycles (a 7-line G84 canned cycle vs. a 9-line floating-holder
    // M3/M4 sequence, tap.js:21-43) — different line count/content, hardware-safety-gated. Categorical, not deferrable.
    {
        param: 'rigid', tokenRefusal: 'Picks between two structurally different tapping cycles (a canned G84 cycle vs. a floating-holder M3/M4 sequence) — a categorical choice gated on declared spindle hardware, not a value inside one.', blockIndex: 3, key: 'rigid', type: 'bool', default: TAP_DEFAULTS.rigid, widget: 'toggle', label: 'Rigid tap (G84)', section: 'TOOL & CUT',
        // t2121 — `clearWhenOff` is the ONLY field in the whole app that opts into userOpView.js's checkbox
        // auto-clear (declared per-field on purpose — see that file's own comment on why it must not be generic).
        // ⚠ the tip now names BOTH vendor steps, not just the spindle: O10180 (slib-m.nc:1775-1781) is
        // `IF #2==0 GOTO30` on `#1296` (the port-enable var), and that GOTO skips BOTH the output-port write AND
        // `#579=1` — so with no port assigned, M180 silently no-ops, the spindle stays analog, and G84 still
        // feeds to depth. A truthful user who genuinely has a servo spindle but never did step 2 would still hit
        // the original hazard on a good-faith tick — the checkbox must say so, not just attest the hardware.
        gate: { param: '_rigidOk', is: false, clearWhenOff: true, tip: 'Rigid tapping needs TWO things: a DECLARED encoder/servo spindle (Settings → Machine → Spindle: "rigid-tap capable") AND an assigned I/O output port for the M180/M181 mode switch (vendor setup, step 2) — plus the Expert post, the only firmware with dump evidence. Missing either, M180 silently no-ops and the spindle stays analog; the floating-holder cycle is the safe default until both are done.' },
    },
];

// t2301 (BACKLOG 20) — dropped from 4 to 3: 'panel' removed from uiChildren below (id-collided with sim's own
// layout2d pane, see that node's own comment). Exactly the hazard t2257 caught on atcWarmupData.js — a stale
// hardcoded wrap left after panel's removal breaks every binding — caught here before committing, not after.
const WRAP_PREFIX_COUNT = 3;   // user_root + sim + param_group
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
    // t2569 (BACKLOG #61 L6) — `emits: true`: the only handle tap has, and it writes originX/originY, the real
    // placeonstock shift for the tap cycle — no sim-only competitor on this op.
    return {
        paths: [{ pts: ring, cls: 'fc-guide' }],
        handles: [{ type: 'point', id: 'tap_pos', fx: 'originX', fy: 'originY', x: ox, y: oy, label: 'pos', emits: true, ...hs.pos }],
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
            // t2301 (BACKLOG 20) — 'panel' removed: inert + id-collided with sim's own layout2d pane (see
            // drillData.js's own t2301 comment for the full mechanism, first fixed for ATC at t2257).
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            { type: 'param_group', params: { group: 'Tap' }, children: [] },
        ],
        children: appendToolSel(appendEntry(exec)),
    }];
    // t2401 — toolNum (toolBindingsFor) carries no `section:` at all in its own shared spec (deriveBindings.js;
    // TOOL_BINDING_SPECS is registry-wide, deliberately unsectioned there) — every consumer sections it locally,
    // same as contourData.js's own precedent. tap's own tool belongs alongside its other cutting parameters.
    const toolNum = toolBindingsFor(stack).map((b) => ({ ...b, section: 'TOOL & CUT' }));
    const def = userOpFromStack('tap_data', 'Tap (data)', stack, [...toolNum, ...TAP_BINDINGS, ...entryBindingsFor(stack)], 'form3d+2d', null, 'mill_datawiz');
    def.previewGeometry = tapPreviewGeometry;
    def.entryPoint = ENTRY_POINT;
    def.zRuler = { depthParam: 'depth', depthOnly: true };   // t2044 — the depth-only ruler (tap has no stepdown — a single threading pass): axis + total-depth grip, no pass ticks
    // The DERIVED pitch-locked feed shown read-only + the reversible/rigid honesty (live per params + the declared spindle).
    def.statusHint = (p) => {
        const rpm = _n(p.rpm, 400), pitch = _n(p.pitch, 1);
        let s = ` · feed ${tapFeed(rpm, pitch)} mm/min (pitch-locked to ${rpm} rpm)`;
        const sp = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {};
        // t2123 — the REAL predicate for "will the floating-holder cycle actually run" (the one that emits M4),
        // not just `!p.rigid`: a rigid REQUEST the emit path refuses (unattested spindle, non-Expert post) also
        // falls to the floating-holder cycle — this warning used to stay silent in exactly that fold case, the
        // one time it matters most (the user thinks they are getting the rigid cycle and are not).
        let dialect = null;
        try { dialect = resolveActivePost(getActiveProfile().id); } catch (_) { /* headless — no dialect to resolve */ }
        const floatingHolderRuns = !p.rigid || !rigidAttested(dialect);
        if (floatingHolderRuns && sp.reversible === false) s += ' · ⚠ your spindle is declared NON-reversible — floating-holder tapping needs M4 to back out; declare it reversible in Settings → Machine → Spindle';
        return s;
    };
    return def;
}
