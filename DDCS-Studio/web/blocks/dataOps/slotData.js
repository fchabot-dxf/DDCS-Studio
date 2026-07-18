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
 * FRONTIERS held UNBOUND (asserted as divergence tripwires, like drill/surfacing):
 *   • `pattern` — slotStack wraps the leaf in an `array` only when patterned (a CONDITIONAL STRUCTURE swap instantiate
 *     can't do — drill frontier #1). This def is the SINGLE-slot template; pattern stays 'single'. (Array-slot = a future port.)
 *   • `clearance` — TRUE fan-out: feeds progstart (block 0) AND the slot leaf (block 3). 1 binding = 1 socket → held at default.
 *
 * Template SEEDED from slotStack(SLOT_DEFAULTS) (pattern:'single', optIn:true — the real wizard always sets opt-in);
 * the BINDINGS map is the independent artifact, proven byte-identical + binding-wiring by tests/slot-as-data.spec.js.
 */
import { slotStack } from '../../wizards/slotWizard.js';
import { userOpFromStack } from '../userOps.js';
import { spindleHeadPatch } from './spindleHead.js';   // t945 — the framing progstart inherits the live machine Head spindle at build (the form's insert-time semantics), else the data-op cuts DEAD
import { appendEntry, ENTRY_POINT } from '../../wizards/ops/entry.js';   // t726 P2b - the declared mill entry point
import { appendToolSel } from '../../wizards/ops/toolsel.js';   // t768 P1a - the declared tool-selection marker
import { entryBindingsFor, toolBindingsFor } from './deriveBindings.js';   // t726 P2b entry / t768 P1a tool — by identity (into def.bindings, not the exported EXEC bindings)
import { WCS_OPTIONS, XY_DATUM_OPTIONS, STOCK_DATUM_OPTIONS, ENTRY_OPTIONS } from './wizardOptions.js';   // t722 P2a rider — one-source (was a local copy); t842 ENTRY_OPTIONS

/** Author defaults — match slotStack's num() fallbacks. width default == toolDia (a slot is ≥ tool wide). pattern:'single'
 *  (bare leaf, no array) + optIn:true (slot is an opt-in/absolute placement op — the seed must carry it). */
export const SLOT_DEFAULTS = {
    pattern: 'single', optIn: true,
    ax: 0, ay: 0, bx: 60, by: 0, width: 6, toolDia: 6, stepoverPct: 40, depth: 4, stepdown: 1.5,
    entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1,   // t842 — depth entry (plunge default = byte-identical)
    feed: 600, plunge: 150, clearance: 5, wcs: 'active',
    originX: 0, originY: 0, stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, offZ: 0,
};

// Pre-order flatten of the bare-leaf single-slot template [progstart, wcs, placeonstock{ slot }, progend]:
//   0 progstart · 1 wcs · 2 placeonstock · 3 slot · 4 progend
// (No intermediate container — the slot leaf does its own depth passes internally — so it sits at index 3, not 4.)
const SLOT_EXEC_BINDINGS = [
    {
        param: 'wcs', blockIndex: 1, key: 'wcs', type: 'enum', default: SLOT_DEFAULTS.wcs,
        widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS },
    },
    // placement scalars (block 2, placeonstock) — opt-in: originX/originY are the raw offset; stock-attach uses the live extent
    { param: 'originX', blockIndex: 2, key: 'offX', type: 'number', default: SLOT_DEFAULTS.originX },
    { param: 'originY', blockIndex: 2, key: 'offY', type: 'number', default: SLOT_DEFAULTS.originY },
    {
        param: 'stockAttach', blockIndex: 2, key: 'stockAttach', type: 'enum', default: SLOT_DEFAULTS.stockAttach,
        widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS },
    },
    {
        param: 'pathDatum', blockIndex: 2, key: 'pathDatum', type: 'enum', default: SLOT_DEFAULTS.pathDatum,
        widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS },
    },
    {
        param: 'stockDatum', formHidden: true, blockIndex: 2, key: 'stockDatum', type: 'enum', default: SLOT_DEFAULTS.stockDatum,
        widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS },
    },
    { param: 'stockW', formHidden: true, blockIndex: 2, key: 'stockW', type: 'number', default: SLOT_DEFAULTS.stockW },
    { param: 'stockH', formHidden: true, blockIndex: 2, key: 'stockH', type: 'number', default: SLOT_DEFAULTS.stockH },
    { param: 'stockZ', formHidden: true, blockIndex: 2, key: 'stockZ', type: 'number', default: SLOT_DEFAULTS.stockZ },
    { param: 'offZ', blockIndex: 2, key: 'offZ', type: 'number', default: SLOT_DEFAULTS.offZ },
    // geometry + cut (block 3, the slot leaf). Wizard names ax/ay/bx/by/toolDia → leaf keys x0/y0/x1/y1/tool.
    { param: 'ax', blockIndex: 3, key: 'x0', type: 'number', default: SLOT_DEFAULTS.ax },
    { param: 'ay', blockIndex: 3, key: 'y0', type: 'number', default: SLOT_DEFAULTS.ay },
    { param: 'bx', blockIndex: 3, key: 'x1', type: 'number', default: SLOT_DEFAULTS.bx },
    { param: 'by', blockIndex: 3, key: 'y1', type: 'number', default: SLOT_DEFAULTS.by },
    { param: 'width', help: "Finished slot width (≥ tool Ø). Equal to the tool = a single pass.", blockIndex: 3, key: 'width', type: 'number', default: SLOT_DEFAULTS.width },
    { param: 'toolDia', blockIndex: 3, key: 'tool', type: 'number', default: SLOT_DEFAULTS.toolDia },
    { param: 'stepoverPct', blockIndex: 3, key: 'stepoverPct', type: 'number', default: SLOT_DEFAULTS.stepoverPct },
    { param: 'depth', blockIndex: 3, key: 'depth', type: 'number', default: SLOT_DEFAULTS.depth },
    { param: 'stepdown', blockIndex: 3, key: 'stepdown', type: 'number', default: SLOT_DEFAULTS.stepdown },
    // t842 — DEPTH ENTRY cluster: ramp runs along the slot length; a helix needs the slot to be wider than the tool (else degrades).
    { param: 'entry', blockIndex: 3, key: 'entry', type: 'enum', default: SLOT_DEFAULTS.entry, widget: 'dropdown', widgetConfig: { options: ENTRY_OPTIONS }, label: 'Depth Entry', help: 'How the tool descends to each depth level. Plunge = straight down. Ramp = a linear descent at ≤ the ramp angle, ALONG the slot length (degrades to plunge on a slot shorter than the ramp needs). Helix = a descending helix (needs a slot wider than the tool; else degrades).' },
    { param: 'rampAngle', blockIndex: 3, key: 'rampAngle', type: 'number', default: SLOT_DEFAULTS.rampAngle, label: 'Ramp Angle', units: '°', when: { param: 'entry', is: 'ramp' }, help: 'Max descent angle of the ramp (degrees from horizontal).' },
    { param: 'helixDia', blockIndex: 3, key: 'helixDia', type: 'number', default: SLOT_DEFAULTS.helixDia, label: 'Helix Ø', units: 'mm', when: { param: 'entry', is: 'helix' }, help: 'Diameter of the descending helix (mm). 0 = auto (the tool Ø). Clamped to the slot width; a tool-width slot degrades to plunge.' },
    { param: 'helixPitch', blockIndex: 3, key: 'helixPitch', type: 'number', default: SLOT_DEFAULTS.helixPitch, label: 'Helix Pitch', units: 'mm/rev', when: { param: 'entry', is: 'helix' }, help: 'How far the helix descends per full revolution (mm/rev).' },
    { param: 'feed', blockIndex: 3, key: 'feed', type: 'number', default: SLOT_DEFAULTS.feed },
    { param: 'plunge', blockIndex: 3, key: 'plunge', type: 'number', default: SLOT_DEFAULTS.plunge },
];

// Wrapped-template indexes (user_root + param_group precede execution children).
const WRAP_PREFIX_COUNT = 4;   // user_root + panel + sim + param_group
export const SLOT_BINDINGS = SLOT_EXEC_BINDINGS.map((b) => ({ ...b, blockIndex: b.blockIndex + WRAP_PREFIX_COUNT }));

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

/** Build the slot-as-data def: a fresh { opType, label, template, bindings } ready for registerUserOp. */
export function slotDataDef() {
    const exec = slotStack(SLOT_DEFAULTS);
    const stack = [{
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
        children: appendToolSel(appendEntry(exec)),   // t726 P2b entry + t768 P1a tool marker appended (both emit nothing; no body-index shift)
    }];
    const def = userOpFromStack('slot_data', 'Slot (data)', stack, [...toolBindingsFor(stack), ...SLOT_BINDINGS, ...entryBindingsFor(stack)], 'form3d+2d', null, 'mill_datawiz');
    def.previewGeometry = slotPreviewGeometry;   // t712 — per-feature 2D handles (A/B endpoints + width) via the declared hook
    def.entryPoint = ENTRY_POINT;   // t726 P2b - the emitting-square entry marker (replaces the sim-only circle)
    def.postInstantiate = spindleHeadPatch;   // t945 — fill the blank framing progstart's rpm/dir/spin-up from the live Head → M3 (was a DEAD spindle)
    return def;
}
