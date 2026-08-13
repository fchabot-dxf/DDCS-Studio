/**
 * blocks/dataOps/textData.js — the TEXT (engraving) built-in expressed as a pure DATA definition (Stage 5, port #5).
 *
 * Like slot, text needed NO new atom: fillText (kind:'fill') is already flat — its "region" is the text outline computed
 * internally from textGeometry, not a Region pill — so all geometry/cut params are flat sockets. Two REQUIRED source
 * touches made it byte-identical + safe (both north-star, not format extensions):
 *   • The two header comments were made STATIC (textWizard.js): they interpolated text/tool/stroke/depth, which a static
 *     template would freeze → a forked label would drift. The values live in the executable Fill Text / Step Down atoms
 *     (one source of truth), so static text gives RAW byte-identical with a dumb data-def. [[atc_warmup]]
 *   • fillText gained extent() (== textBBox) so the place fold's liveExtent tracks the text live — REQUIRED, else a
 *     stock-attach sweep with varied text diverges (instantiate freezes the placeOnStock snapshot at template defaults).
 *   • (separately, a runaway-row guard was added to scanlineFill so the value-glow can't freeze the tab on the
 *     childless filltext leaf — see clearing.js / [[glow-safety-childless-multiplier]].)
 *
 * FONT SEAM: `font` is a bound socket (strokeFont.js FONTS registry / getFont) — so a text-as-data op is forkable by font
 * and any registered/user-loaded font drops in. The default 'single-stroke' is byte-identical to the legacy emit.
 *
 * FRONTIERS held UNBOUND (divergence tripwires): `clearance` (fan-out → progstart + the filltext leaf) and `rpm`/`dir`
 * (progstart spindle params, supplied by settings — frozen at the template default; the sweep must not vary them).
 * NOTE: text has NO wcs block (engraving is dialect-agnostic) — so, unlike drill/surfacing/slot, there is no wcs binding.
 */
import { textStack } from '../../wizards/stacks/textWizard.js';
import { userOpFromStack } from '../userOps.js';
import { appendEntry, ENTRY_POINT } from '../../wizards/ops/entry.js';   // t726 P2b - the declared mill entry point
import { appendToolSel } from '../../wizards/ops/toolsel.js';   // t768 P1a - the declared tool-selection marker
import { entryBindingsFor, toolBindingsFor } from './deriveBindings.js';   // t726 P2b entry / t768 P1a tool — by identity (into def.bindings, not the exported EXEC bindings)
import { withPassesField } from './passesField.js';   // t1613 — the derived `passes` field (declared once, every depth+stepdown twin)
import { XY_DATUM_OPTIONS, STOCK_DATUM_OPTIONS } from './wizardOptions.js';   // t722 P2a rider — one-source (was a local copy)

/** Author defaults — match textStack's num() fallbacks. optIn:true (text is an opt-in/absolute placement op — the seed
 *  must carry it). font 'single-stroke' = the built-in; stepdown defaults to depth (engraving is usually one pass). */
export const TEXT_DEFAULTS = {
    optIn: true,
    text: 'TEXT', font: 'single-stroke', height: 12, width: 1, slant: 0, rotation: 0, spacing: 1.2, lineSpacing: 1.6, align: 'left', x: 0, y: 0,
    strokeWidth: 2.5, toolDia: 1.5, stepoverPct: 50, depth: 0.4, stepdown: 0.4, feed: 400, plunge: 120, clearance: 4,
    originX: 0, originY: 0, offZ: 0, stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0,
    snSlot: 490, snWidth: 6, snIncrement: 1,   // t764 — {SN} dynamic serial (inert unless the text carries the token)
};

const ALIGN_OPTIONS = [
    ['Left', 'left'],
    ['Center', 'center'],
    ['Right', 'right'],
];

const FONT_OPTIONS = [
    ['Single-stroke (engraving)', 'single-stroke'],
];

// Pre-order flatten of textStack's [comment, comment, progstart, placeonstock{ stepdown{ filltext } }, progend]:
//   0 comment · 1 comment · 2 progstart · 3 placeonstock · 4 stepdown · 5 filltext · 6 progend
// t1758 — MACHINE VARIABLES ROLL OUT, mill family. Text's `filltext`/`stepdown` kernels are fully JS-unrolled at
// emit time (fillText.js / textGeometry.js / clearing.js's scanlineFill) with NO controller-deferred loop the way
// surfaceraster.js has — so several params sharing a NAME with surfacing carry the OPPOSITE verdict here (depth/
// stepdown/feed/plunge/toolDia/stepoverPct): traced fresh against text's own kernels, not copied from surfacing.
const TEXT_EXEC_BINDINGS = [
    // placement scalars (block 3, placeonstock) — opt-in: originX/originY are the raw offset; stock-attach uses live extent
    { param: 'originX', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 3, key: 'offX', type: 'number', default: TEXT_DEFAULTS.originX },
    { param: 'originY', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 3, key: 'offY', type: 'number', default: TEXT_DEFAULTS.originY },
    { param: 'offZ', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, blockIndex: 3, key: 'offZ', type: 'number', default: TEXT_DEFAULTS.offZ },
    {
        param: 'stockAttach', tokenEligible: true, blockIndex: 3, key: 'stockAttach', type: 'enum', default: TEXT_DEFAULTS.stockAttach,
        widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS },
    },
    {
        param: 'pathDatum', tokenEligible: true, blockIndex: 3, key: 'pathDatum', type: 'enum', default: TEXT_DEFAULTS.pathDatum,
        widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS },
    },
    {
        param: 'stockDatum', tokenEligible: true, formHidden: true, blockIndex: 3, key: 'stockDatum', type: 'enum', default: TEXT_DEFAULTS.stockDatum,
        widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS },
    },
    { param: 'stockW', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, blockIndex: 3, key: 'stockW', type: 'number', default: TEXT_DEFAULTS.stockW },
    { param: 'stockH', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, blockIndex: 3, key: 'stockH', type: 'number', default: TEXT_DEFAULTS.stockH },
    { param: 'stockZ', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, blockIndex: 3, key: 'stockZ', type: 'number', default: TEXT_DEFAULTS.stockZ },
    // depth pass (block 4, stepdown) — the generic stepdown atom JS-unrolls the Z-level loop (blockEmitter.js
    // kind==='depth'); text has no controller-deferred descent the way surfaceraster does, so unlike surfacing's
    // depth/stepdown this is a genuine line-count decision. NOT deferrable.
    { param: 'depth', tokenRefusal: 'Sets how many Z-descent levels get built into the program (JS-unrolled at build time) — the program\'s SHAPE depends on this number, not a value inside one.', blockIndex: 4, key: 'to', type: 'number', default: TEXT_DEFAULTS.depth },
    { param: 'stepdown', tokenRefusal: 'Sets how many Z-descent levels get built into the program (JS-unrolled at build time) — the program\'s SHAPE depends on this number, not a value inside one.', blockIndex: 4, key: 'by', type: 'number', default: TEXT_DEFAULTS.stepdown },
    // glyph geometry + cut (block 5, the filltext leaf)
    { param: 'text', tokenRefusal: 'The string content directly sets how many glyph-stroke moves get built into the program — the program\'s SHAPE depends on this, not a value inside one.', blockIndex: 5, key: 'text', type: 'string', default: TEXT_DEFAULTS.text, label: 'Text', help: 'The engraved text. Two tokens: {SN} = a running serial number that increments on the controller each run (persistent #var — set the digits/increment below); {DATE} = the date you insert it, stamped statically (no controller has a live clock). Type any prefix/suffix around them, e.g. PART-{SN}.' },
    {
        param: 'font', tokenRefusal: 'Selects an entirely different glyph registry (a different point-generation source per letter) — a categorical choice, not a value inside one.', help: "Letter font — single-stroke engraving fill; more fonts drop in when registered.", blockIndex: 5, key: 'font', type: 'enum', default: TEXT_DEFAULTS.font,
        widget: 'dropdown', widgetConfig: { options: FONT_OPTIONS },
    },
    { param: 'height', tokenRefusal: 'Sets the glyph outline\'s extent, which feeds the fill\'s row-count loop before the program is built — the program\'s shape depends on this number, not a value inside one.', help: "Cap height (mm).", blockIndex: 5, key: 'height', type: 'number', default: TEXT_DEFAULTS.height },
    { param: 'width', tokenRefusal: 'Sets the glyph outline\'s extent, which feeds the fill\'s row-count loop before the program is built — the program\'s shape depends on this number, not a value inside one.', help: "Horizontal scale: 1 = normal, <1 condensed, >1 extended.", blockIndex: 5, key: 'width', type: 'number', default: TEXT_DEFAULTS.width },
    // slant/rotation: pure per-point coordinate transforms (a skew/rotate applied to already-shaped glyph outlines)
    // — no stroke/row count changes, the same magnitude-re-resolved-downstream shape as corner's hopDist.
    { param: 'slant', tokenRefusal: 'This value is re-resolved by the text-layout atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, help: "Oblique / italic skew in degrees (0 = upright; positive leans right).", blockIndex: 5, key: 'slant', type: 'number', default: TEXT_DEFAULTS.slant },
    { param: 'rotation', tokenRefusal: 'This value is re-resolved by the text-layout atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, help: "Label rotation in degrees about its anchor (0 = level).", blockIndex: 5, key: 'rotation', type: 'number', default: TEXT_DEFAULTS.rotation },   // t708 — the label angle (deg, about the anchor); the ↻ preview handle writes it
    { param: 'spacing', tokenRefusal: 'This gap is re-resolved by the text-layout atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, help: "Extra gap between letters (mm).", blockIndex: 5, key: 'spacing', type: 'number', default: TEXT_DEFAULTS.spacing },
    { param: 'lineSpacing', tokenRefusal: 'This pitch is re-resolved by the text-layout atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, help: "Line pitch for multi-line text = cap height × this.", blockIndex: 5, key: 'lineSpacing', type: 'number', default: TEXT_DEFAULTS.lineSpacing },   // t708 — multi-line pitch = height × this
    {
        param: 'align', tokenEligible: true, blockIndex: 5, key: 'align', type: 'enum', default: TEXT_DEFAULTS.align,
        widget: 'dropdown', widgetConfig: { options: ALIGN_OPTIONS },
    },
    { param: 'x', tokenRefusal: 'This position is re-resolved by the text-layout atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 5, key: 'x', type: 'number', default: TEXT_DEFAULTS.x },
    { param: 'y', tokenRefusal: 'This position is re-resolved by the text-layout atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 5, key: 'y', type: 'number', default: TEXT_DEFAULTS.y },
    // strokeWidth/toolDia: together decide the too-small tool-fit refusal (no toolpath at all if it fails) AND the
    // stepover that sets the fill's scanline row count — a genuine existence + count decision, unlike surfacing's
    // toolDia (never feeds a too-large refusal, its stepover is controller-deferred).
    { param: 'strokeWidth', tokenRefusal: 'Combined with the tool diameter, this decides whether the engraving can be cut at all (refuses everywhere if the tool doesn\'t fit) — a categorical decision, not a value inside one.', help: "Letter boldness (mm). Use ≥ the tool Ø so the fill is clean.", blockIndex: 5, key: 'strokeWidth', type: 'number', default: TEXT_DEFAULTS.strokeWidth },
    { param: 'toolDia', tokenRefusal: 'Combined with the stroke width, this decides whether the engraving can be cut at all, and sets the fill\'s scanline row count — a categorical decision, not a value inside one.', blockIndex: 5, key: 'toolDia', type: 'number', default: TEXT_DEFAULTS.toolDia },
    { param: 'stepoverPct', tokenRefusal: 'Directly sets the fill\'s scanline row count (JS-unrolled at build time, no controller-deferred loop) — the program\'s shape depends on this number, not a value inside one.', blockIndex: 5, key: 'stepoverPct', type: 'number', default: TEXT_DEFAULTS.stepoverPct },
    { param: 'feed', tokenRefusal: 'This value is re-resolved by the fill atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 5, key: 'feed', type: 'number', default: TEXT_DEFAULTS.feed },
    { param: 'plunge', tokenRefusal: 'This value is re-resolved by the fill atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 5, key: 'plunge', type: 'number', default: TEXT_DEFAULTS.plunge },
    // t764 — DYNAMIC SERIAL {SN} fields (a text carrying the {SN} token engraves a persistent, per-run-bumping serial on
    // the controller). Inert unless the text uses {SN}. The START value is NOT a field — it drives an "Initialize counter"
    // action (never emitted, else it'd reset every run). Prefix/suffix = just type static text around {SN}. {DATE} = the
    // insert-time stamp (no controller has a macro-readable clock).
    { param: 'snSlot', tokenRefusal: 'This register number is embedded literally into the serial-engrave macro before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 5, key: 'snSlot', type: 'number', default: TEXT_DEFAULTS.snSlot, label: 'Serial #var', help: 'The controller uservar holding the running serial — it persists across runs. 100-549. Avoid slots your own macros use: the park macros use #470-471, tool-change #472-473.' },
    // snWidth: directly sets a JS-unrolled per-digit extraction loop (one macro block per digit) — a real count decision.
    { param: 'snWidth', tokenRefusal: 'Sets how many per-digit extraction blocks get built into the serial macro (JS-unrolled at build time) — the program\'s shape depends on this number, not a value inside one.', blockIndex: 5, key: 'snWidth', type: 'number', default: TEXT_DEFAULTS.snWidth, label: 'Serial digits', help: 'Digit count, zero-padded — e.g. 6 → 000042.' },
    { param: 'snIncrement', tokenRefusal: 'This value is re-resolved by the serial-engrave atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, blockIndex: 5, key: 'snIncrement', type: 'number', default: TEXT_DEFAULTS.snIncrement, label: 'Serial increment', help: 'How much the serial advances each run (usually 1).' },
];

// Wrapped-template indexes (user_root + param_group precede execution children).
const WRAP_PREFIX_COUNT = 4;   // user_root + panel + sim + param_group
export const TEXT_BINDINGS = TEXT_EXEC_BINDINGS.map((b) => ({ ...b, blockIndex: b.blockIndex + WRAP_PREFIX_COUNT }));

export const TEXT_DATA_OPTYPE = 'user_text_data';

/** Build the text-as-data def: a fresh { opType, label, template, bindings } ready for registerUserOp. */
export function textDataDef() {
    const exec = textStack(TEXT_DEFAULTS);
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },   // t708 text arc — the 3D engraving trace/carve AND the FeatureCanvas 2D real-letter layout (via filltext.previewGeometry: real letters + pos/rotation handles)
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            {
                type: 'param_group',
                params: { group: 'Text' },
                children: [],
            },
        ],
        children: appendToolSel(appendEntry(exec)),   // t726 P2b entry + t768 P1a tool marker appended (both emit nothing; no body-index shift)
    }];
    const def = userOpFromStack('text_data', 'Text (data)', stack, withPassesField([...toolBindingsFor(stack), ...TEXT_BINDINGS, ...entryBindingsFor(stack)]), 'form3d+2d', null, 'mill_datawiz');   // t1613 — the derived `passes` field, spliced after stepdown
    // t708 — WIDTH-HONESTY note (the DECLARED status-hint seam: registerUserOp wires def.statusHint → getUserStatusHint):
    // a tool wider than the intended stroke can't cut thinner than itself, so the ACTUAL engraved letter width =
    // max(strokeWidth, toolDia). Surface it in the in-place status when the tool forces it wider than the stroke.
    def.statusHint = (p) => {
        const n = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);
        const sw = n(p.strokeWidth, 2.5), td = n(p.toolDia, 1.5);
        return td > sw ? ` · ⚠ engraved width ${td}mm (Ø${td} tool wider than the ${sw}mm stroke)` : '';
    };
    def.entryPoint = ENTRY_POINT;   // t726 P2b - the emitting-square entry marker (replaces the sim-only circle)
    return def;
}
