/**
 * blocks/dataOps/slotData.js — the SLOT built-in expressed as a pure DATA definition (Stage 5, port #4).
 *
 * Slot is the cleanest fill-family port yet: its leaf (web/wizards/ops/slot.js) was ALREADY flat — a widened channel
 * from (x0,y0)→(x1,y1), all flat scalar sockets, NO Region pill — so NO new atom and NO stepover-math relocation was
 * needed (the width>tool band passes + tool·% stepover are computed INSIDE slotPath over already-flat leaf fields, not
 * in the stack). Slot is also an OPT-IN placement op (placement.js:44): with no stock-attach the placement returns the
 * raw originX/originY, so the absolute A↔B geometry needs no region-local-at-0 move — originX is already its own socket.
 *
 * The ONE source touch: the slot leaf gained an `extent()` (== slotBBox) so the place fold's liveExtent recomputes the
 * placement bbox from LIVE params — REQUIRED, not optional: without it a stock-attach sweep with varied geometry diverges
 * (instantiate freezes the placeOnStock snapshot at the template default; live slotStack recomputes slotBBox). With it,
 * stock-attach tracks the geometry byte-identical (exactly how array.extent solved drill's frozen-bbox frontier).
 *
 * ── t1500 — THE TWIN BECAME A SUPERSET TWIN, AND IT HAD TO BEFORE THE RE-POINT COULD SHIP ─────────────────────────
 *
 * `slotStack` now forks: an eligible slot's clearing IS the parametric `surfaceraster` atom, everything the measured
 * gate refuses keeps the literal leaf. A FROZEN positional template cannot express that fork, and t1498 measured
 * exactly what leaving it frozen would have cost: the template is seeded from `slotStack(SLOT_DEFAULTS)`, whose
 * width 6 == tool 6 is the ZERO BAND, so the seed stays LITERAL — and a twin at width 14 would then emit the LITERAL
 * slot while the form emitted the ATOM. **Two paths cutting differently for one set of parameters**, which is worse
 * than not re-pointing at all. So the template is `slotStack(DEFAULTS, {superset:true})` with both arms GUARDED, and
 * the value sockets bind BY IDENTITY (`bindingSpecs`, re-derived over the PRUNED stack every build) — the pocket's
 * shape, for the pocket's reason.
 *
 * `_para` is GEOMETRY-, ENTRY- AND ENVELOPE-derived, so it cannot be a plain param guard: `def.deriveGuards` reads
 * `slotStackRidesRaster`, the SAME one source the concrete build asks. That shared reading IS the byte-identity claim.
 *
 * FRONTIERS held UNBOUND (asserted as divergence tripwires, like drill/surfacing):
 *   • `pattern` — slotStack wraps the leaf in an `array` only when patterned (a CONDITIONAL STRUCTURE swap instantiate
 *     can't do — drill frontier #1). This def is the SINGLE-slot template; pattern stays 'single'. (Array-slot = a future port.)
 * `clearance` IS NO LONGER A FRONTIER (t1500). It was held unbound because one frozen binding could reach one socket,
 * and it fans out to progstart AND the leaf. Identity specs bind both — and here that is REQUIRED rather than a
 * bonus: on the re-pointed arm the atom carries its own `clearance`, so leaving it frozen would have made the twin
 * and the builder retract to different heights the moment an operator typed a clearance. A frontier that the new
 * mechanism closes has to be closed in the act that introduces the mechanism, or it reads as a fidelity loss.
 *
 * Template SEEDED from slotStack(SLOT_DEFAULTS, {superset:true}) (pattern:'single', optIn:true — the real wizard always
 * sets opt-in); the BINDINGS map is the independent artifact, proven byte-identical across BOTH arms and both sides of
 * every gate by tests/slot-as-data.spec.js + tests/slot-twin-repoint-1500.spec.js.
 */
import { slotStack, slotStackRidesRaster, slotStackArmGap, slotLeafParams } from '../../wizards/slotWizard.js';
import { slotRasterParams } from '../../wizards/ops/slot.js';   // t1500 — the atom's slot-side params are ALL derived; postInstantiate writes them from this one source
import { userOpFromStack, flattenBlocks } from '../userOps.js';
import { spindleHeadPatch } from './spindleHead.js';   // t945 — the framing progstart inherits the live machine Head spindle at build (the form's insert-time semantics), else the data-op cuts DEAD
import { appendEntry, ENTRY_POINT } from '../../wizards/ops/entry.js';   // t726 P2b - the declared mill entry point
import { appendToolSel } from '../../wizards/ops/toolsel.js';   // t768 P1a - the declared tool-selection marker
import { deriveBindingsFor, mergeBindingsByParam, TOOL_BINDING_SPECS } from './deriveBindings.js';   // t726 P2b entry / t768 P1a tool — by identity, re-derived over the PRUNED stack
import { pruneGuards } from '../whenGuard.js';
import { WCS_OPTIONS, XY_DATUM_OPTIONS, STOCK_DATUM_OPTIONS, ENTRY_OPTIONS } from './wizardOptions.js';   // t722 P2a rider — one-source (was a local copy); t842 ENTRY_OPTIONS

/** Author defaults — match slotStack's num() fallbacks. width default == toolDia (a slot is ≥ tool wide). pattern:'single'
 *  (bare leaf, no array) + optIn:true (slot is an opt-in/absolute placement op — the seed must carry it). */
export const SLOT_DEFAULTS = {
    pattern: 'single', optIn: true,
    ax: 0, ay: 0, bx: 60, by: 0, width: 6, toolDia: 6, stepoverPct: 40, depth: 4, stepdown: 1.5,
    entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1,   // t842 — depth entry (plunge default = byte-identical)
    feed: 2000, plunge: 150, clearance: 5, wcs: 'active',
    originX: 0, originY: 0, stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, offZ: 0,
};

/**
 * ── VALUE bindingSpecs — identity-by-type over the PRUNED superset (t1500) ────────────────────────────────────────
 *
 * A guarded template has no stable indices, so every socket is named by the TYPE of block that carries it. Each
 * `{type}` match is unique in every pruned state (each of these block types appears at most once per arm), which is
 * the contract `deriveBindings` enforces — it refuses a spec that matches two blocks, and that refusal is the safety
 * feature the single-place-per-arm shape is built to keep.
 *
 * ⚠ THE `slot` LEAF ROWS ARE **OPTIONAL**, AND THAT ABSENCE IS THE WHOLE POINT. On the re-pointed arm there is no
 * `slot` block at all — one `surfaceraster` carries the geometry, the depth walk and the descent. An optional spec
 * whose type is absent in this state is SKIPPED rather than failing the build, so a form edit reaches the emit in
 * either state without the form knowing which one it is in.
 *
 * ⚠ AND THE ATOM GETS **NO ROWS HERE**, which is a decision and not an omission. Its slot-side params are ALL
 * derived — an `atan2` bearing, a `hypot` length, a placement of `A − R(bearing)(0, width/2)`, an `insetAcross` of
 * tool/2 — so no single param drives most of them. Binding the handful that happen to carry over (toolDia, depth,
 * feed…) and deriving the rest would give the atom TWO sources for one param set. `postInstantiate` writes the whole
 * set from `slotRasterParams` instead, which is the same one source the concrete build reads. (Pocket does exactly
 * this for its `pocketrest` leaf, and for the same stated reason.)
 */
const SLOT_BINDING_SPECS = [
    {
        param: 'wcs', type: 'enum', key: 'wcs', match: { type: 'wcs' }, default: SLOT_DEFAULTS.wcs,
        widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS },
    },
    // placement scalars (the arm's ONE placeonstock) — opt-in: originX/originY are the raw offset; stock-attach uses the live extent
    { param: 'originX', type: 'number', key: 'offX', match: { type: 'placeonstock' }, default: SLOT_DEFAULTS.originX },
    { param: 'originY', type: 'number', key: 'offY', match: { type: 'placeonstock' }, default: SLOT_DEFAULTS.originY },
    {
        param: 'stockAttach', type: 'enum', key: 'stockAttach', match: { type: 'placeonstock' }, default: SLOT_DEFAULTS.stockAttach,
        widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS },
    },
    {
        param: 'pathDatum', type: 'enum', key: 'pathDatum', match: { type: 'placeonstock' }, default: SLOT_DEFAULTS.pathDatum,
        widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS },
    },
    {
        param: 'stockDatum', formHidden: true, type: 'enum', key: 'stockDatum', match: { type: 'placeonstock' }, default: SLOT_DEFAULTS.stockDatum,
        widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS },
    },
    { param: 'stockW', formHidden: true, type: 'number', key: 'stockW', match: { type: 'placeonstock' }, default: SLOT_DEFAULTS.stockW },
    { param: 'stockH', formHidden: true, type: 'number', key: 'stockH', match: { type: 'placeonstock' }, default: SLOT_DEFAULTS.stockH },
    { param: 'stockZ', formHidden: true, type: 'number', key: 'stockZ', match: { type: 'placeonstock' }, default: SLOT_DEFAULTS.stockZ },
    { param: 'offZ', type: 'number', key: 'offZ', match: { type: 'placeonstock' }, default: SLOT_DEFAULTS.offZ },
    // geometry + cut (the LITERAL arm's slot leaf). Wizard names ax/ay/bx/by/toolDia → leaf keys x0/y0/x1/y1/tool —
    // the SAME map `slotLeafParams` declares, which is why the form's labels and the builder's sockets cannot drift.
    { param: 'ax', type: 'number', key: 'x0', match: { type: 'slot' }, optional: true, default: SLOT_DEFAULTS.ax },
    { param: 'ay', type: 'number', key: 'y0', match: { type: 'slot' }, optional: true, default: SLOT_DEFAULTS.ay },
    { param: 'bx', type: 'number', key: 'x1', match: { type: 'slot' }, optional: true, default: SLOT_DEFAULTS.bx },
    { param: 'by', type: 'number', key: 'y1', match: { type: 'slot' }, optional: true, default: SLOT_DEFAULTS.by },
    { param: 'width', help: "Finished slot width (≥ tool Ø). Equal to the tool = a single pass.", type: 'number', key: 'width', match: { type: 'slot' }, optional: true, units: 'mm', default: SLOT_DEFAULTS.width },
    { param: 'toolDia', type: 'number', key: 'tool', match: { type: 'slot' }, optional: true, units: 'mm', default: SLOT_DEFAULTS.toolDia },
    { param: 'stepoverPct', type: 'number', key: 'stepoverPct', match: { type: 'slot' }, optional: true, default: SLOT_DEFAULTS.stepoverPct },
    { param: 'depth', type: 'number', key: 'depth', match: { type: 'slot' }, optional: true, units: 'mm', default: SLOT_DEFAULTS.depth },
    { param: 'stepdown', type: 'number', key: 'stepdown', match: { type: 'slot' }, optional: true, units: 'mm', default: SLOT_DEFAULTS.stepdown },
    // t842 — DEPTH ENTRY cluster: ramp runs along the slot length; a helix needs the slot to be wider than the tool (else degrades).
    { param: 'entry', type: 'enum', key: 'entry', match: { type: 'slot' }, optional: true, default: SLOT_DEFAULTS.entry, widget: 'dropdown', widgetConfig: { options: ENTRY_OPTIONS }, label: 'Depth Entry', help: 'How the tool descends to each depth level. Plunge = straight down. Ramp = a linear descent at ≤ the ramp angle, ALONG the slot length (degrades to plunge on a slot shorter than the ramp needs). Helix = a descending helix (needs a slot wider than the tool; else degrades).' },
    { param: 'rampAngle', type: 'number', key: 'rampAngle', match: { type: 'slot' }, optional: true, default: SLOT_DEFAULTS.rampAngle, label: 'Ramp Angle', units: '°', when: { param: 'entry', is: 'ramp' }, help: 'Max descent angle of the ramp (degrees from horizontal).' },
    { param: 'helixDia', type: 'number', key: 'helixDia', match: { type: 'slot' }, optional: true, default: SLOT_DEFAULTS.helixDia, label: 'Helix Ø', units: 'mm', when: { param: 'entry', is: 'helix' }, help: 'Diameter of the descending helix (mm). 0 = auto (the tool Ø). Clamped to the slot width; a tool-width slot degrades to plunge.' },
    { param: 'helixPitch', type: 'number', key: 'helixPitch', match: { type: 'slot' }, optional: true, default: SLOT_DEFAULTS.helixPitch, label: 'Helix Pitch', units: 'mm/rev', when: { param: 'entry', is: 'helix' }, help: 'How far the helix descends per full revolution (mm/rev).' },
    { param: 'feed', type: 'number', key: 'feed', match: { type: 'slot' }, optional: true, units: 'mm/min', default: SLOT_DEFAULTS.feed },
    { param: 'plunge', type: 'number', key: 'plunge', match: { type: 'slot' }, optional: true, units: 'mm/min', default: SLOT_DEFAULTS.plunge },
    // t1500 — CLEARANCE, the frontier identity specs close: it drives the framing progstart AND the literal leaf. The
    // progstart row carries the form's words (it is the one present in EVERY state); the leaf row is optional.
    { param: 'clearance', type: 'number', key: 'clearance', match: { type: 'progstart' }, units: 'mm', default: SLOT_DEFAULTS.clearance, label: 'Clearance' },
    { param: 'clearance', type: 'number', key: 'clearance', match: { type: 'slot' }, optional: true },
    { param: 'rpm', type: 'number', key: 'rpm', match: { type: 'progstart' }, label: 'Spindle RPM', help: "Spindle speed (RPM). Blank = the machine Head default; picking a tool fills this from the library." },   // t996 — rpm → progstart (no default → socket-held: blank keeps the Head)
    // t726 P2b entry / t768 P1a tool — IN the specs (not the *BindingsFor helpers) so they re-derive over the PRUNED
    // stack each instantiate; the markers sit after a body whose block count now changes with the arm.
    { param: 'entryX', type: 'number', key: 'entryX', match: { type: 'entry' }, default: '', label: 'Entry point X', units: 'mm', section: 'GEOMETRY', help: 'Optional rapid-to point before the first cut (leave blank for none) — a safe lead-in position.' },
    { param: 'entryY', type: 'number', key: 'entryY', match: { type: 'entry' }, default: '', label: 'Entry point Y', units: 'mm', section: 'GEOMETRY', help: 'Optional rapid-to point before the first cut (leave blank for none) — a safe lead-in position.' },
    ...TOOL_BINDING_SPECS,
];

export const SLOT_DATA_OPTYPE = 'user_slot_data';

const _n = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);

/** t712 — DECLARED preview geometry (twin-level, own param names): the slot centreline + both edges as paths, plus the
 *  A/B endpoint POINT handles + a width projLength handle. Mirrors the built-in slotView.buildSlotSpec, but the handles
 *  write the TWIN params (ax/ay/bx/by/width) directly — no atom-key remap. Handles are preview-side → emit unaffected. */
export function slotPreviewGeometry(p) {
    const ax = _n(p.ax, 0), ay = _n(p.ay, 0), bx = _n(p.bx, 60), by = _n(p.by, 0);
    const tool = _n(p.toolDia, 6), W = Math.max(tool, _n(p.width, tool));
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, mx = (ax + bx) / 2, my = (ay + by) / 2, hw = W / 2;
    const line = (x1, y1, x2, y2, cls) => ({ pts: [{ x: x1, y: y1 }, { x: x2, y: y2 }], cls: cls || 'fc-guide' });
    const paths = [
        line(ax, ay, bx, by, 'fc-path'),                                              // centreline (the tool path)
        line(ax + nx * hw, ay + ny * hw, bx + nx * hw, by + ny * hw),                 // +edge
        line(ax - nx * hw, ay - ny * hw, bx - nx * hw, by - ny * hw),                 // −edge
    ];
    const handles = [
        // t716 — the TRANSLATE anchor (the whole slot shifts, length + angle unchanged): moves A+B by the drag delta. Slot
        // has no single position param (A/B are absolute), so this is the anchor the origin-based ops get from their pos handle.
        { type: 'translate', id: 'sl_anchor', cx: mx, cy: my, xs: [['ax', ax], ['bx', bx]], ys: [['ay', ay], ['by', by]], label: '✛' },
        { type: 'point', id: 'sl_a', fx: 'ax', fy: 'ay', x: ax, y: ay, label: 'A' },
        { type: 'point', id: 'sl_b', fx: 'bx', fy: 'by', x: bx, y: by, label: 'B' },
        { type: 'projLength', id: 'sl_w', field: 'width', cx: mx, cy: my, nx, ny, off: hw, scale: 2, min: tool, label: 'width' },
    ];
    return { paths, handles };
}

/** The wrapped SUPERSET template: slotStack(DEFAULTS, {superset:true}) under the user_root/panel/sim/param_group prefix. */
function slotDataStack(defaults) {
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },   // t712 — the 3D engraving trace/carve AND the FeatureCanvas 2D with real slot geometry + A/B/width handles (previewGeometry)
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            {
                type: 'param_group',
                params: { group: 'Slot' },
                children: [],
            },
        ],
        children: appendToolSel(appendEntry(slotStack(defaults, { superset: true }))),   // t726 P2b entry + t768 P1a tool marker appended (both emit nothing; no body-index shift)
    }];
}

/**
 * The FORM bindings are DERIVED over a CANONICAL-pruned stack, then deduped by param (fan-out yields N specs per
 * param; the form wants ONE — merged so a widget/label can never be lost to ordering).
 *
 * ⚠ `_para: false` PINS THE CANONICAL STACK TO THE LITERAL ARM, and that is deliberate rather than incidental. The
 * canonical stack is what the FORM's labels, units, help and defaults derive from, and only the literal arm carries a
 * socket for every param — the re-pointed arm has no `slot` leaf at all. Deriving the form over the parametric arm
 * would silently DROP the whole geometry cluster from the wizard: a feature loss dressed as a binding detail. The
 * parametric arm is reached at instantiate instead, where `bindingSpecs` re-derive over the PRUNED stack per state.
 * (Pocket pins its canonical stack the same way, for the same stated reason.)
 */
const CANONICAL_BIND = { ...SLOT_DEFAULTS, _para: false };
function canonicalPrunedStack() { const c = JSON.parse(JSON.stringify(slotDataStack(SLOT_DEFAULTS))); pruneGuards(c, CANONICAL_BIND); return c; }
export const SLOT_BINDINGS = mergeBindingsByParam(deriveBindingsFor(canonicalPrunedStack(), SLOT_BINDING_SPECS));

/** Build the slot-as-data def: a fresh { opType, label, template, bindings } ready for registerUserOp. */
export function slotDataDef() {
    const def = userOpFromStack('slot_data', 'Slot (data)', slotDataStack(SLOT_DEFAULTS), SLOT_BINDINGS, 'form3d+2d', null, 'mill_datawiz');
    def.bindingSpecs = SLOT_BINDING_SPECS;   // t1500 — re-derive the value sockets BY IDENTITY over the PRUNED stack each build
    /**
     * t1500 — `_para`: does THIS slot's clearing ride `surfaceraster`? GEOMETRY-, ENTRY- and ENVELOPE-derived (the
     * zero band, the helix's entry-end clamp, the ramp over a partial last bite, a pattern, and finally the atom's
     * OWN declared envelope), so it cannot be a plain param guard. The predicate is `slotStackArmGap`'s — the SAME
     * one source the concrete build reads — so the twin and the wizard can never disagree about which arm a given
     * slot is on. That agreement IS the byte-identity claim, not a separate thing tested beside it.
     */
    def.deriveGuards = (p) => ({ _para: slotStackRidesRaster(p || {}) });
    /**
     * The DERIVED sockets the frozen superset baked at DEFAULT geometry, rewritten from the resolved params.
     *
     * ⚠ THE ATOM IS WRITTEN WHOLE, from `slotRasterParams`, and that is the point of it being here rather than in
     * bindings: its slot-side inputs are an `atan2` bearing, a `hypot` length and a placement of
     * `A − R(bearing)(0, width/2)` — none of which any single form param drives. The superset seeds them at
     * SLOT_DEFAULTS (a 60mm due-east slot), so a twin left unrewritten would cut the default slot's geometry
     * whatever the operator typed. Same failure `pocketDrillCentre` is there for, one op along.
     */
    def.postInstantiate = (stack, resolved) => {
        const leaf = slotLeafParams(resolved || {});
        for (const b of flattenBlocks(stack)) {
            if (!b || !b.params || b.type !== 'surfaceraster') continue;
            b.params = slotRasterParams(leaf);
        }
        return spindleHeadPatch(stack);   // t945 — then fill the blank framing progstart's rpm/dir/spin-up from the live Head → M3 (was a DEAD spindle)
    };
    /**
     * t1500 — the boundary's own words for the CAM table's why-column (`classifyExposable` reads this once it has
     * resolved the arm): '' when the slot rides the parametric atom, else the reason it does not — the SAME
     * one-source predicate the concrete build and the `_para` guard read. So a helix-entry slot's greyed Expose
     * control says which knob to change, instead of a generic "geometry / fold-driven". (Pocket's `armGap` shape.)
     */
    def.armGap = (p) => slotStackArmGap(p || {});
    def.previewGeometry = slotPreviewGeometry;   // t712 — per-feature 2D handles (A/B endpoints + width) via the declared hook
    def.entryPoint = ENTRY_POINT;   // t726 P2b - the emitting-square entry marker (replaces the sim-only circle)
    def.zRuler = { depthParam: 'depth', stepParam: 'stepdown' };   // t1025 — the depth ruler strip down the LEFT of the 2D plan (reuses zRulerStrip, like pocket)
    return def;
}
