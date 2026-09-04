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
import { entryBindingsFor, toolBindingsFor, deriveBindingsFor } from './deriveBindings.js';   // t726 P2b entry / t768 P1a tool — by identity (into def.bindings, not the exported EXEC bindings)
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
//
// t2377 — SECTION ABSENCE, fixed: ZERO of these bindings carried `section:` before this turn. Same mechanism as
// t2375's contour/slot fix (see contourData.js's own header comment above CONTOUR_EXEC_BINDINGS for the full
// account) — reordered into three contiguous groups matching the shell (index.html:820-857) exactly: TEXT
// (text/height/strokeWidth/width/slant/[hidden x/y]/originX/originY/offZ/[hidden stock fields]/spacing) ->
// TOOL & FILL (toolDia/stepoverPct) -> DEPTH & FEED (depth/stepdown/feed/plunge — clearance is the declared
// UNBOUND frontier, see the file header; text has NO wcs/zMode block at all, unlike surfacing/contour/slot).
// `rpm` is ALSO a declared UNBOUND frontier for text specifically (see the file header — frozen at the Settings
// default, unlike contour/surfacing/slot which all bind it), so the TOOL section (spliced in at assembly, see
// textDataDef below) carries only `toolNum`, never a form-visible rpm row — a real, pre-existing structural
// difference, not an oversight introduced by this fix.
//
// font/rotation/lineSpacing/align/snSlot/snWidth/snIncrement have NO shell field at all (grepped index.html's
// own wiz_text block, zero hits for every one of them) — twin-only, the LARGEST orphan cluster of any mill-
// family wizard fixed so far (7, vs. contour's/surfacing's 1-3) — appended to the end of the TEXT section in
// their own PRE-EXISTING relative array order (not reshuffled), their closest conceptual home. entryX/entryY
// (SHARED entryBindingsFor, also no shell field) sit at the very end, matching contour's/surfacing's own
// placement of the same shared pair.
// t2619 (BACKLOG #71/#72, conversion tier) — CONVERTED from hand-counted `blockIndex: 3/4/5` to identity-based
// `match: {type}`: textStack's own flatten (comment above) is a STATIC tree, no guards/supersets — every block
// type (`placeonstock`/`stepdown`/`filltext`, `textWizard.js`) appears exactly once, VERIFIED by reading the
// stack builder directly (not estimated) — no `nth` needed anywhere in this file.
const TEXT_EXEC_BINDINGS = [
    // TEXT
    { param: 'text', tokenRefusal: 'The string content directly sets how many glyph-stroke moves get built into the program — the program\'s SHAPE depends on this, not a value inside one.', match: { type: 'filltext' }, key: 'text', type: 'string', default: TEXT_DEFAULTS.text, label: 'Text', section: 'TEXT', help: 'The engraved text. Two tokens: {SN} = a running serial number that increments on the controller each run (persistent #var — set the digits/increment below); {DATE} = the date you insert it, stamped statically (no controller has a live clock). Type any prefix/suffix around them, e.g. PART-{SN}.' },
    { param: 'height', tokenRefusal: 'Sets the glyph outline\'s extent, which feeds the fill\'s row-count loop before the program is built — the program\'s shape depends on this number, not a value inside one.', help: "Cap height (mm).", match: { type: 'filltext' }, key: 'height', type: 'number', default: TEXT_DEFAULTS.height, section: 'TEXT' },
    // strokeWidth: decides the too-small tool-fit refusal (no toolpath at all if it fails) alongside toolDia — a
    // genuine existence decision, unlike surfacing's toolDia (never feeds a too-large refusal).
    { param: 'strokeWidth', tokenRefusal: 'Combined with the tool diameter, this decides whether the engraving can be cut at all (refuses everywhere if the tool doesn\'t fit) — a categorical decision, not a value inside one.', help: "Letter boldness (mm). Use ≥ the tool Ø so the fill is clean.", match: { type: 'filltext' }, key: 'strokeWidth', type: 'number', default: TEXT_DEFAULTS.strokeWidth, section: 'TEXT' },
    { param: 'width', tokenRefusal: 'Sets the glyph outline\'s extent, which feeds the fill\'s row-count loop before the program is built — the program\'s shape depends on this number, not a value inside one.', help: "Horizontal scale: 1 = normal, <1 condensed, >1 extended.", match: { type: 'filltext' }, key: 'width', type: 'number', default: TEXT_DEFAULTS.width, section: 'TEXT' },
    // slant: a pure per-point coordinate transform (a skew applied to already-shaped glyph outlines) — no
    // stroke/row count changes, the same magnitude-re-resolved-downstream shape as corner's hopDist.
    { param: 'slant', tokenRefusal: 'This value is re-resolved by the text-layout atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, help: "Oblique / italic skew in degrees (0 = upright; positive leans right).", match: { type: 'filltext' }, key: 'slant', type: 'number', default: TEXT_DEFAULTS.slant, section: 'TEXT' },
    // x/y: present in the shell as HIDDEN inputs (position is driven by the 2D drag handle, not typed) — kept in
    // the TEXT section at the shell's own position, matching how stockDatum/stockW/stockH/stockZ (also formHidden)
    // are treated everywhere else in the mill family, not pulled out as if they were orphans.
    { param: 'x', tokenRefusal: 'This position is re-resolved by the text-layout atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, match: { type: 'filltext' }, key: 'x', type: 'number', default: TEXT_DEFAULTS.x, section: 'TEXT' },
    { param: 'y', tokenRefusal: 'This position is re-resolved by the text-layout atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, match: { type: 'filltext' }, key: 'y', type: 'number', default: TEXT_DEFAULTS.y, section: 'TEXT' },
    // placement scalars (block 3, placeonstock) — opt-in: originX/originY are the raw offset; stock-attach uses live extent
    { param: 'originX', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'placeonstock' }, key: 'offX', type: 'number', default: TEXT_DEFAULTS.originX, section: 'TEXT' },
    { param: 'originY', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'placeonstock' }, key: 'offY', type: 'number', default: TEXT_DEFAULTS.originY, section: 'TEXT' },
    { param: 'offZ', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'placeonstock' }, key: 'offZ', type: 'number', default: TEXT_DEFAULTS.offZ, section: 'TEXT' },
    {
        param: 'stockAttach', tokenEligible: true, match: { type: 'placeonstock' }, key: 'stockAttach', type: 'enum', default: TEXT_DEFAULTS.stockAttach,
        widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, section: 'TEXT',
    },
    {
        param: 'pathDatum', tokenEligible: true, match: { type: 'placeonstock' }, key: 'pathDatum', type: 'enum', default: TEXT_DEFAULTS.pathDatum,
        widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, section: 'TEXT',
    },
    {
        param: 'stockDatum', tokenEligible: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockDatum', type: 'enum', default: TEXT_DEFAULTS.stockDatum,
        widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS }, section: 'TEXT',
    },
    { param: 'stockW', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockW', type: 'number', default: TEXT_DEFAULTS.stockW, section: 'TEXT' },
    { param: 'stockH', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockH', type: 'number', default: TEXT_DEFAULTS.stockH, section: 'TEXT' },
    { param: 'stockZ', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockZ', type: 'number', default: TEXT_DEFAULTS.stockZ, section: 'TEXT' },
    { param: 'spacing', tokenRefusal: 'This gap is re-resolved by the text-layout atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, help: "Extra gap between letters (mm).", match: { type: 'filltext' }, key: 'spacing', type: 'number', default: TEXT_DEFAULTS.spacing, section: 'TEXT' },
    // t2377 — no shell field at all for any of these seven (twin-only) — appended here in their own pre-existing
    // relative order, TEXT's closest conceptual home.
    {
        param: 'font', tokenRefusal: 'Selects an entirely different glyph registry (a different point-generation source per letter) — a categorical choice, not a value inside one.', help: "Letter font — single-stroke engraving fill; more fonts drop in when registered.", match: { type: 'filltext' }, key: 'font', type: 'enum', default: TEXT_DEFAULTS.font,
        widget: 'dropdown', widgetConfig: { options: FONT_OPTIONS }, section: 'TEXT',
    },
    { param: 'rotation', tokenRefusal: 'This value is re-resolved by the text-layout atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, help: "Label rotation in degrees about its anchor (0 = level).", match: { type: 'filltext' }, key: 'rotation', type: 'number', default: TEXT_DEFAULTS.rotation, section: 'TEXT' },   // t708 — the label angle (deg, about the anchor); the ↻ preview handle writes it
    { param: 'lineSpacing', tokenRefusal: 'This pitch is re-resolved by the text-layout atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, help: "Line pitch for multi-line text = cap height × this.", match: { type: 'filltext' }, key: 'lineSpacing', type: 'number', default: TEXT_DEFAULTS.lineSpacing, section: 'TEXT' },   // t708 — multi-line pitch = height × this
    {
        param: 'align', tokenEligible: true, match: { type: 'filltext' }, key: 'align', type: 'enum', default: TEXT_DEFAULTS.align,
        widget: 'dropdown', widgetConfig: { options: ALIGN_OPTIONS }, section: 'TEXT',
    },
    // t764 — DYNAMIC SERIAL {SN} fields (a text carrying the {SN} token engraves a persistent, per-run-bumping serial on
    // the controller). Inert unless the text uses {SN}. The START value is NOT a field — it drives an "Initialize counter"
    // action (never emitted, else it'd reset every run). Prefix/suffix = just type static text around {SN}. {DATE} = the
    // insert-time stamp (no controller has a macro-readable clock).
    { param: 'snSlot', tokenRefusal: 'This register number is embedded literally into the serial-engrave macro before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, match: { type: 'filltext' }, key: 'snSlot', type: 'number', default: TEXT_DEFAULTS.snSlot, label: 'Serial #var', section: 'TEXT', help: 'The controller uservar holding the running serial — it persists across runs. 100-549. Avoid slots your own macros use: the park macros use #470-471, tool-change #472-473.' },
    // snWidth: directly sets a JS-unrolled per-digit extraction loop (one macro block per digit) — a real count decision.
    { param: 'snWidth', tokenRefusal: 'Sets how many per-digit extraction blocks get built into the serial macro (JS-unrolled at build time) — the program\'s shape depends on this number, not a value inside one.', match: { type: 'filltext' }, key: 'snWidth', type: 'number', default: TEXT_DEFAULTS.snWidth, label: 'Serial digits', section: 'TEXT', help: 'Digit count, zero-padded — e.g. 6 → 000042.' },
    { param: 'snIncrement', tokenRefusal: 'This value is re-resolved by the serial-engrave atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, match: { type: 'filltext' }, key: 'snIncrement', type: 'number', default: TEXT_DEFAULTS.snIncrement, label: 'Serial increment', section: 'TEXT', help: 'How much the serial advances each run (usually 1).' },
    // TOOL & FILL — strokeWidth/toolDia together decide the too-small tool-fit refusal AND the stepover that sets
    // the fill's scanline row count — a genuine existence + count decision, unlike surfacing's toolDia (never
    // feeds a too-large refusal, its stepover is controller-deferred).
    { param: 'toolDia', tokenRefusal: 'Combined with the stroke width, this decides whether the engraving can be cut at all, and sets the fill\'s scanline row count — a categorical decision, not a value inside one.', match: { type: 'filltext' }, key: 'toolDia', type: 'number', default: TEXT_DEFAULTS.toolDia, section: 'TOOL & FILL' },
    { param: 'stepoverPct', tokenRefusal: 'Directly sets the fill\'s scanline row count (JS-unrolled at build time, no controller-deferred loop) — the program\'s shape depends on this number, not a value inside one.', match: { type: 'filltext' }, key: 'stepoverPct', type: 'number', default: TEXT_DEFAULTS.stepoverPct, section: 'TOOL & FILL' },
    // DEPTH & FEED — the generic stepdown atom JS-unrolls the Z-level loop (blockEmitter.js kind==='depth'); text
    // has no controller-deferred descent the way surfaceraster does, so unlike surfacing's depth/stepdown this
    // is a genuine line-count decision. NOT deferrable.
    { param: 'depth', tokenRefusal: 'Sets how many Z-descent levels get built into the program (JS-unrolled at build time) — the program\'s SHAPE depends on this number, not a value inside one.', match: { type: 'stepdown' }, key: 'to', type: 'number', default: TEXT_DEFAULTS.depth, section: 'DEPTH & FEED' },
    { param: 'stepdown', tokenRefusal: 'Sets how many Z-descent levels get built into the program (JS-unrolled at build time) — the program\'s SHAPE depends on this number, not a value inside one.', match: { type: 'stepdown' }, key: 'by', type: 'number', default: TEXT_DEFAULTS.stepdown, section: 'DEPTH & FEED' },
    { param: 'feed', tokenRefusal: 'This value is re-resolved by the fill atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, match: { type: 'filltext' }, key: 'feed', type: 'number', default: TEXT_DEFAULTS.feed, section: 'DEPTH & FEED' },
    { param: 'plunge', tokenRefusal: 'This value is re-resolved by the fill atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, match: { type: 'filltext' }, key: 'plunge', type: 'number', default: TEXT_DEFAULTS.plunge, section: 'DEPTH & FEED' },
];

// ⚠ KEPT ALIVE (t2619): `tests/text-as-data.spec.js` imports `TEXT_BINDINGS` directly for its own "every scalar
// binding wired to the real macro" wiring check — a real external consumer, same precedent as edgeData.js's own
// `EDGE_BINDINGS` (t2599). No `.blockIndex` on these entries any more (match-based) — that test's own primary
// path already reads the REGISTERED def's own resolved `.blockIndex` (`getUserDef(...).bindings`, which
// `deriveBindings` always resolves to a concrete index regardless of whether the source spec used `match` or a
// hand-typed `blockIndex`); this export's own job is just the param/key list, unchanged.
export const TEXT_BINDINGS = TEXT_EXEC_BINDINGS;

export const TEXT_DATA_OPTYPE = 'user_text_data';

/** Build the text-as-data def: a fresh { opType, label, template, bindings } ready for registerUserOp. */
export function textDataDef() {
    // t2619 (BACKLOG #71/#72, conversion tier) — bootstrap stack (children only, uiChildren doesn't affect what
    // toolBindingsFor/entryBindingsFor find) to derive the field groups, then the SAME execChildren feed the
    // real stack below. `path_anchor` placed FIRST in the LEFT param_group's own children (mirrors
    // surfacingData.js's own t2545/t2595 precedent — the arc's pilot for this exact node type) — hides the
    // stockAttach/pathDatum field_ref rows wherever they land and mounts the real corner picker in their place,
    // byParam-driven (position-independent either way). Sections TEXT/TOOL/TOOL & FILL/DEPTH & FEED are ALL
    // unranked by SECTION_RANK — nothing to violate — so preserving TEXT_EXEC_BINDINGS' own array order (shell-
    // verified, t2377's own account) is sufficient; no reordering needed for these four names.
    const exec = textStack(TEXT_DEFAULTS);
    const execChildren = appendToolSel(appendEntry(exec));   // t726 P2b entry + t768 P1a tool marker appended (both emit nothing)
    const bootstrapStack = [{ type: 'user_root', params: {}, children: execChildren }];
    // t2377 — toolNum (SHARED toolBindingsFor, no section at the source) and entryX/entryY (SHARED
    // entryBindingsFor, stale 'GEOMETRY') are overridden LOCALLY via .map() here (Rule 1b: never edit
    // deriveBindings.js itself) and sectioned to match this op's own vocabulary — TEXT/TOOL/TOOL & FILL/
    // DEPTH & FEED, matching the shell (index.html:820-857) exactly. `rpm` is a declared frontier for text
    // specifically (see TEXT_EXEC_BINDINGS' own header note) — TOOL carries only `toolNum`, no rpm row.
    const fieldsOf = (stackForDerive) => {
        const derived = deriveBindingsFor(stackForDerive, TEXT_EXEC_BINDINGS);
        const entryXY = entryBindingsFor(stackForDerive).map((b) => ({ ...b, section: 'TEXT' }));
        const toolNum = toolBindingsFor(stackForDerive).map((b) => ({ ...b, section: 'TOOL' }));
        const textFields = derived.filter((b) => b.section === 'TEXT');
        const toolFillFields = derived.filter((b) => b.section === 'TOOL & FILL');
        const depthFeedFields = derived.filter((b) => b.section === 'DEPTH & FEED');
        return withPassesField([...textFields, ...entryXY, ...toolNum, ...toolFillFields, ...depthFeedFields]);   // t1613 — the derived `passes` field, spliced after stepdown
    };
    const bindings0 = fieldsOf(bootstrapStack);
    const fieldRefsOf = (specs) => specs.map((b) => ({ type: 'field_ref', params: { param: b.param } }));
    const bySection = (name) => bindings0.filter((b) => b.section === name);
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [{
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{
                    type: 'param_group',
                    params: { group: 'Text' },
                    children: [
                        // t2619 — REPRODUCED verbatim from the live shell (index.html's own `.wiz-usage` text
                        // for `#wiz_text`), not restated from memory — same discipline surfacingData.js's own
                        // t2545 comment names.
                        { type: 'usage_text', params: { text: 'Engraves filled text (part tags / labels) in the active WCS. Letters are pocket-filled from a single-stroke font, so the counters (holes in O, A, 8…) come out clean. Drag the pos / height handles in the 2D layout; the 3D verifies the cut. Use a small end mill (or V-bit). Spindle start + end-of-program come from Settings.' } },
                        // t2371 — the dual stock-attach/path-datum corner picker. Text's own static shell
                        // (index.html:832) mounts it at prefix "tx_" — copied verbatim, not re-derived (a wrong
                        // prefix binds the picker to another wizard's mount — the exact collision class pinned
                        // at t2367, `pa-mount-scope-2367.spec.js`).
                        { type: 'path_anchor', params: { prefix: 'tx_' } },
                        { type: 'group_box', params: { title: 'TEXT' }, children: fieldRefsOf(bySection('TEXT')) },
                        { type: 'group_box', params: { title: 'TOOL' }, children: fieldRefsOf(bySection('TOOL')) },
                        { type: 'group_box', params: { title: 'TOOL & FILL' }, children: fieldRefsOf(bySection('TOOL & FILL')) },
                        { type: 'group_box', params: { title: 'DEPTH & FEED' }, children: fieldRefsOf(bySection('DEPTH & FEED')) },
                        { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
                    ],
                }],
                RIGHT: [
                    { type: 'preview3d', params: { rotary: false, machine: false, magazine: false } },
                    { type: 'feature_canvas', params: { panel: 'form3d+2d' } },
                ],
            },
        }],
        children: execChildren,
    }];
    const bindings = fieldsOf(stack);   // t2599 — re-derived over the FINAL, real stack, so the tree and the bindings can never disagree
    const def = userOpFromStack('text_data', 'Text (data)', stack, bindings, 'form3d+2d', null, 'mill_datawiz');
    // t708 — WIDTH-HONESTY note (the DECLARED status-hint seam: registerUserOp wires def.statusHint → getUserStatusHint):
    // a tool wider than the intended stroke can't cut thinner than itself, so the ACTUAL engraved letter width =
    // max(strokeWidth, toolDia). Surface it in the in-place status when the tool forces it wider than the stroke.
    def.statusHint = (p) => {
        const n = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);
        const sw = n(p.strokeWidth, 2.5), td = n(p.toolDia, 1.5);
        return td > sw ? ` · ⚠ engraved width ${td}mm (Ø${td} tool wider than the ${sw}mm stroke)` : '';
    };
    def.entryPoint = ENTRY_POINT;   // t726 P2b - the emitting-square entry marker (replaces the sim-only circle)
    def.zRuler = { depthParam: 'depth', stepParam: 'stepdown' };   // t2044 — the depth ruler strip down the LEFT of the 2D plan (reuses zRulerStrip, like pocket)
    return def;
}
