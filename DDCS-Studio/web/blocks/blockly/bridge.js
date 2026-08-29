/**
 * blocks/blockly/bridge.js — derive Blockly block DEFINITIONS + toolbox FROM the ops registry.
 *
 * Every op becomes its own Blockly block (block.type === op type) so the workspace maps 1:1 to our
 * {type,params,children} stack (see stackBridge.js). Emit is NOT done here — the workspace is converted to a
 * stack and run through the proven emitMapped fold (single source of truth, shared with the STUDIO wizards).
 *
 * Field classification is by the op default's TYPE (avoids name collisions, e.g. StepDown `to` is a number
 * but MachineMove `to` is a #var string):
 *   dropdown   — field is in SELECTS / is an op operator        → field_dropdown
 *   boolean    — default is a boolean                           → field_checkbox
 *   region/bool socket — def.sockets[field]                     → input_value (check Region / Boolean)
 *   number     — default is a number                            → input_value (check Number) + math_number shadow
 *   text       — default is a string (#ref / expr / message)    → field_input
 * Block shape by kind: reporter → output (typed); container/path/loop/cond/depth/fill → + a 'DO' statement
 * mouth; everything else → a statement (prev/next). Requires window.Blockly (vendored UMD).
 */
import { PALETTE, CATEGORIES } from '../../wizards/ops/index.js';
import { WCS_SELECTORS } from '../../wizards/ops/setworkoffset.js';   // the ONE wcs vocabulary, declared beside resolveWcsIndex
import { installCornerGridField } from './cornerGridField.js';
import { installRegionPickField } from './regionPickField.js';
import { installCoordListField } from './coordListField.js';
import { installPickerField } from './pickerField.js';   // t2389 (BACKLOG #42 piece 6) — exact-name references (matchvar/atomType/whenparam)
import { installOptionsEditorField } from './optionsEditorField.js';   // t2389 (BACKLOG #42 piece 2) — the options DSL's editor
import { installComboField } from './comboField.js';   // t2389 (BACKLOG #42 piece 7) — section/units suggestion combo
import { CANVAS_ROLE_WIDGETS } from '../userOps.js';   // the ONE role-encoded widget list (shared with dev-mode; consumed lazily below → cycle-safe)
import { LAYOUT_TYPES, PANEL_TYPES } from '../../wizards/ops/panelTypes.js';   // t2393 (BACKLOG #48 item 2) — the ONE declared source for layout.kind/panel.panel's dropdowns (below), not a hand-copied subset
import { opLabelOf } from '../opBuilders.js';   // t1071 — the opunit chip's friendly per-instance label (opType → the twin's registered label)

// Fields that render as the inline 3×3 corner-grid picker (field_cornergrid), tinted per datum so PlaceOnStock's
// stock-attach (blue) and path-datum (amber) glyphs read apart — matching the 2D canvas pickers.
const CORNER_COLOUR = { stockAttach: '#4ab3ff', pathDatum: '#ffcf3a' };
const SELECTS = {
    corner: ['FL', 'FR', 'BL', 'BR'],
    probeSeq: ['XY', 'YX'],
    axis: ['X', 'Y', 'Z', 'A', 'B', 'C'],
    axisDir: ['pos', 'neg'],
    featureType: ['boss', 'pocket', 'bore'],
    wcs: WCS_SELECTORS,
    slave: [['A', '3'], ['B', '4'], ['C', '5']],
    atcMode: ['auto', 'manual'],
    testMode: ['current', 'all'],
    wcsSys: [['Auto', '0'], ['G54', '54'], ['G55', '55'], ['G56', '56'], ['G57', '57'], ['G58', '58'], ['G59', '59']],
    commType: [['Popup', 'popup'], ['Status', 'status'], ['Input', 'input'], ['Beep', 'beep'], ['Dwell', 'dwell']],
    fmode: ['G94', 'G95'],
    plane: ['G17', 'G18', 'G19'],
    dist: ['abs', 'inc'],
    stop: ['M0', 'M1'],
    cycle: ['drill', 'dwell', 'peck', 'bore'],
    state: ['on', 'off'],
    pattern: ['grid', 'line', 'circle', 'rect'],   // array (drill/bore) hole pattern
    ramp: ['step', 'helix'],                         // bore stepdown
    side: ['outside', 'inside', 'on'],               // contour/profile cutter side
    // Enum atom fields that were free TEXT — a one-letter typo silently mis-emits (e.g. coolant 'mist'→'mis'→M9).
    // Registering them here makes them dropdowns: valid by construction, the bad state is unrepresentable.
    dir: ['cw', 'ccw'],                              // spindle / Program Start spin direction (M3 / M4)
    flow: ['flood', 'mist', 'off'],                  // coolant (M8 / M7 / M9)
    arc: ['ccw', 'cw'],                              // arc move direction (G3 / G2)
    end: ['M30', 'M2', 'M99'],                       // program end (M30 reset / M2 end / M99 subprogram return)
    direction: ['bothways', 'oneway', 'otherway'],   // fill / step-over scan direction
    entry: ['plunge', 'ramp', 'helix'],              // t804 — pocket depth-entry (per-level descent)
    order: ['outside-in', 'inside-out'],             // concentric-fill ring order
    strategy: ['parallel', 'concentric'],            // step-over pass strategy
    // SIM-START (per-pass preview start, the simstart authoring block — B3). The Option-A vocabulary as dropdowns.
    anchor: ['centre', 'edge', 'frac', 'radial', 'lathe'],    // where this pass begins relative to the stock (t1301 — 'lathe': outside the BAR)
    wall: ['@dir1', '@dir2', 'min', 'max'],          // edge anchor: which wall side (@token follows the op's dir param, or a fixed min/max)
    sign: ['+', '-'],                                // radial anchor: which side of centre
    zplane: ['probe', 'top', '@flank'],              // probe height: into the stock / above the top / the bar centreline (-R)
};
const catSlug = (c) => (c || 'Ops').toLowerCase().replace(/[^a-z0-9]+/g, '');   // slug = alphanumerics only (so "Spindle & Feed" → spindlefeed, "Wizard Inputs" → wizardinputs)
export const FN = (field) => field.toUpperCase();   // Blockly input/field name from an op field
const REPORTER_CHECK = { boolean: 'Boolean', region: 'Region' };   // reporter return type → Blockly output check
const outputCheck = (def) => REPORTER_CHECK[def.returns] || 'Number';
// t1638 — A BLOCK DECLARES ITS OWN MOUTH. Was two hand-maintained kind-name lists (this array, plus an OR-chain
// restated three more times across this file and stackBridge.js) — a kind holding children but missing from ANY
// ONE of the four sites got written CHILDLESS by recToJson with no error (t1069 opunit · t1093 cam_table ·
// t1595 guard · t1627 uibox · t1636 skim, the same silent loss five times). Measured: both lists produced the
// exact same behaviour (one 'DO' statement-input mouth) — they were never two families, just one fact restated
// four ways. Now the def itself carries it, so `wizards/ops/*.js` and `mouthsOf` (below) are the ONLY two
// places a new child-holding kind is ever named. `user_root` keeps its own two NAMED mouths
// (PRESENTATION/EXECUTION) — a different shape, handled separately below — not part of this collapse.
// t2333 (the stackBridge.js sweep, found gating drill's flip at t2329) — a kind may hold MULTIPLE
// independently-named mouths (`def.mouths`, an array of `{name,label}`) instead of one (`def.mouth`, a bare
// string) — DECLARED already by split_horizontal/split_vertical (LEFT/RIGHT, TOP/BOTTOM) and groupBox/tabGroup
// (their own single-entry arrays), but never actually READ anywhere: neither the Blockly SHAPE builder
// (`addMouth`, below) nor stackBridge.js's round-trip serializer ever consulted `def.mouths`, only
// `def.mouth` — confirmed by gridContainer.js's own t2299 comment, which found and named the identical gap
// once already (its own fix switched to singular since it only needed one; split_horizontal genuinely needs
// two DISTINGUISHABLE ones, so singular can't express it). `mouthsOf` normalizes BOTH shapes to one list so
// every consumer has ONE thing to loop over — a plain `def.mouth` becomes a one-item list, byte-identical
// behavior for every existing single-mouth kind (including groupBox/tabGroup's own length-1 `mouths` arrays,
// which take the exact same single-mouth path this normalization already had — fixed as the same side effect,
// not a second change). Replaces the old singular-only `mouthOf` outright — every one of its 3 call sites
// (this file's own block-shape builder, stackBridge.js's read AND write directions) needed the multi-mouth
// case, so there was no remaining single-mouth-only consumer left to keep it for.
export const mouthsOf = (def) => def.mouths || (def.mouth ? [{ name: def.mouth, label: null }] : []);
// Blocks build/read ALL fields when a def lists them (so a dynamic block like array round-trips every pattern,
// not just the default); a `dynamic` extension toggles which are visible. The wizard uses fieldsFor() directly.
export const fieldsOf = (def, params) => (def.allFields || (def.fieldsFor ? def.fieldsFor(params || def.defaults) : def.fields)) || [];

const DESCRIPTIONS = {
    fmode: "Feed Mode: G94 (Units/Min) or G95 (Units/Rev)",
    plane: "Arc/Compensation Plane (G17 XY, G18 XZ, G19 YZ)",
    dist: "Distance Mode: Absolute (G90) or Incremental (G91)",
    stop: "Stop Type: M0 (Program Stop) or M1 (Optional Stop)",
    cycle: "Canned Cycle Type (Drill, Dwell, Peck, Bore)",
    state: "Output State (On/Off)",
    mode: "Mode of operation",
    x: "X coordinate",
    y: "Y coordinate",
    z: "Z coordinate",
    r: "Retract/R plane",
    q: "Peck depth / Timeout",
    dwell: "Dwell time (ms or s)",
    feed: "Feed rate",
    pin: "I/O Pin Number",
    var: "Variable to store result",
    tol: "Tolerance / Blend radius",
    op: "Operator",
    axes: "Axes to reference",
    prog: "Program Number (O-word)",
    sys: "Work Coordinate System (0-6)",
    axisx: "Enable X Axis",
    axisy: "Enable Y Axis",
    axisz: "Enable Z Axis",
    sync: "Synchronize movement",
    slave: "Slave axis alignment",
    type: "Communication type",
    color: "Popup/Beep color or mode",
    corner: "Corner to probe",
    probeseq: "Probe Sequence (XY or YX)",
    wcs: "Target WCS for result",
    probez: "Probe Z axis first",
    synca: "Sync A axis",
    qstop: "Quick stop on error",
    axis: "Axis to probe/move",
    axisdir: "Direction of movement",
    featuretype: "Feature type (Boss, Pocket, Bore)",
    dir1: "Direction 1",
    dir2: "Direction 2",
    twoaxis: "Enable 2-Axis probe",
    waitspindle: "Wait for spindle",
    dustcover: "Dust cover control",
    confirm: "Wait for operator confirmation",
    radius: "Radius of the feature",
    depth: "Depth to cut",
    step: "Stepover / Stepdown amount",
    speed: "Spindle speed (RPM)",
    dir: "Spindle direction (CW / CCW)",
    coolant: "Coolant (Flood / Mist / Off)",
    tool: "Tool Number (T)",
    value: "Value to set",
    pattern: "Hole pattern: grid, line, circle (bolt) or rect perimeter",
    ramp: "Bore stepdown: step (plunge + flat circle) or helix (linearized G1 ramp)",
    widget: "How this knob renders in the form: number / slider / dropdown (presets) / toggle (on=1, off=0)",
    options: "Dropdown presets — a comma/newline list of Label=value (numeric), e.g. Rough=500, Finish=1500",
    rotary: "Preview shows the 4th-axis rotary rig (+ the A± jog row)",
    machine: "Preview pins to the machine frame (draws the envelope)",
    magazine: "Preview shows the ATC magazine (pockets + tool stubs)",
    anchor: "Where this preview pass begins: centre / edge (a wall) / frac (a fraction of the stock) / radial (offset from centre) / lathe (outside the bar, at a Z along it)",
    wall: "Edge anchor: which wall side — @dir1/@dir2 follow the op's direction param, or a fixed min/max",
    out: "Stand-off distance outside the wall (a number, or @outset = the op's standard approach)",
    rad: "Radial offset from centre (a number, or @R = the bar radius)",
    zplane: "Probe height: probe (into the stock) / top (above) / @flank (the bar centreline, -R)",
    whenparam: "Optional gate: this pass only exists when this op param matches (the conditional pass count)",
    whenis: "Gate value the param must equal (true / false / a string)"
};
const getDesc = (f) => DESCRIPTIONS[f.toLowerCase()] || `The ${f} parameter`;

const optionsFor = (def, field) => {
    // t1520 — THE ATOM'S OWN VOCABULARY WINS. `SELECTS` below is keyed by BARE FIELD NAME, so one field name means one
    // enum across the whole registry — and field names collide: `dir` is the spindle's cw/ccw on progstart/spindle but the
    // stylus-compensation SIGN (+/-) on radiuscomp/probecheck; `pattern`/`cycle` name a wider vocabulary on holecycle than
    // the array block's. A value outside a dropdown's options CANNOT BE HELD BY THE FIELD: Blockly keeps option[0], so the
    // canvas silently rewrote `-` to `cw` (→ the emit's `+`) and `single` to `grid`. That put the probed surface on the
    // WRONG SIDE of the trigger by twice the stylus radius, and turned a one-hole drill into a six-hole grid — six of the
    // iron rule's eleven pinned round-trip diffs, all one cause. An atom that declares `selects: { field: [...] }` beside
    // its defaults now states its OWN vocabulary, and it is read FIRST — the collision is unrepresentable rather than
    // patched per case. The invariant it restores is asserted in value-fidelity-1520.spec.js: no atom's declared default
    // may sit outside its own dropdown's options.
    if (def.selects && def.selects[field]) return def.selects[field];
    if (field === 'op') return (def.type === 'compare' || def.type === 'ifgoto') ? ['<', '>', '<=', '>=', '==', '!='] : ['+', '-', '*', '/', '%'];
    if (field === 'mode') {
        if (def.type === 'pathmode') return ['blend', 'exact'];
        if (def.type === 'waitinput') return ['imm', 'rise', 'fall', 'high', 'low'];
        if (def.type === 'move') return ['cut', 'rapid', 'probe'];
        if (def.type === 'cam_field') return ['expose', 'bake'];   // block-native-params S1 — the pendant expose/bake toggle
    }
    // numeric-socket widgets (all commit a number). The role-encoded widgets fold a ROLE into the value (decoded by
    // userOps.decodeCanvasWidget) so the role is DECLARED, not inferred from pool order (audit #6-B): "XY pad / Rect"
    // = a form mini-canvas; "2D point / 2D rect" = plain number fields the Form+2D preview makes drag-to-edit. ONE
    // source of truth: spread the canonical CANVAS_ROLE_WIDGETS (also feeds the dev-mode dropdown) so the two author
    // surfaces can't drift. (The import closes a benign cycle — this list is read lazily here, never at module-eval.)
    if (field === 'widget' && def.type === 'param') return ['number', 'slider', 'dropdown', 'toggle', ...CANVAS_ROLE_WIDGETS];
    // FORM value-field block (composable-authoring): the form-widget + the binding value-type dropdowns.
    // t1562 — param_field's widget is OPTIONAL: empty = derive the control from `type` (enum→dropdown, bool→toggle,
    // string→text), which is what a binding that declares no widget means. The author surface has to be able to SAY
    // that, or the only way to express "inherit" would be to leave a wrong value in place. [label, value] pair so the
    // empty value still reads as a real choice in the dropdown. Scoped to param_field: formfield has its own reader,
    // which has no inherit semantics, so its vocab is left exactly as it was.
    if (field === 'widget' && def.type === 'param_field') return [['(from type)', ''], 'number', 'slider', 'dropdown', 'segmented', 'toggle', 'text', 'corner-grid', 'region-pick', 'coord-list', 'plane-suggest', 'tool-library', 'thread-preset', 'declared-io', 'stepper'];
    if (field === 'widget' && def.type === 'formfield') return ['number', 'slider', 'dropdown', 'segmented', 'toggle', 'text', 'corner-grid', 'region-pick', 'coord-list', 'plane-suggest', 'tool-library', 'thread-preset', 'declared-io', 'stepper'];   // t1105 — param_field shares formfield's widget/type vocab
    if (field === 'type' && (def.type === 'formfield' || def.type === 'param_field')) return ['number', 'int', 'enum', 'bool', 'string', 'list'];
    // LAYOUT-2D widget block (composable GUI): the anchor KIND + the coordinate FRAME (v1 = point / stock-min).
    if (field === 'anchor' && def.type === 'layoutwidget') return ['point'];
    if (field === 'frame' && def.type === 'layoutwidget') return ['stock-min', 'datum'];
    // t2393 (BACKLOG #48 item 2, the t1520 iron rule) — LIVE-CONFIRMED data loss before this fix (WORK-LOG
    // t2393): these two dropdowns hand-copied a SUBSET of their declaring table's own keys (panel: 4 of 5,
    // missing `commscreen`; layout: 2 of 14) — a block loaded with any of the missing values (a REAL
    // `def.panel`/`def.layout` value, not hypothetical) got silently rewritten to option[0] the instant it
    // deserialized. Sourced from the SAME table (`panelTypes.js`) every consumer already reads, so a THIRD
    // panel/layout type added there needs no matching edit here — it just works, and can't silently drift out
    // of sync again the way the hand-copied lists did.
    if (field === 'panel' && def.type === 'panel') return Object.keys(PANEL_TYPES);   // the GUI panel-type declaration
    if (field === 'kind' && def.type === 'layout') return Object.keys(LAYOUT_TYPES);
    // t2393 (BACKLOG #48 item 2) — flip is modeled on xform (transform.js's own header: "axis = flip about
    // X|Y"): NARROWED from the generic `SELECTS.axis` (X/Y/Z/A/B/C, shared by many unrelated blocks) to the
    // two values flip actually means — Z/A/B/C were offered and pickable but did nothing coherent.
    if (field === 'axis' && def.type === 'flip') return ['X', 'Y'];
    if (field === 'value' && def._options) return def._options;   // t154 — a structural-control (sc_*) enum: its dropdown options ride on the generated def (from CORNER_STRUCT_BINDINGS)
    return SELECTS[field] || null;
};

/** Classify a field → how it renders in Blockly. */
export function fieldKind(def, field) {
    if (def.type === 'regionpick' && field === 'value') return 'regionpick';   // the region-pick control's value → inline picker
    if (def.type === 'coordlist' && field === 'pts') return 'coordlist';        // the coordinate-list → inline positions preview
    if (CORNER_COLOUR[field]) return 'cornergrid';   // PlaceOnStock attach / path-datum → inline 3×3 picker
    // t2389 (BACKLOG #42 pieces 2/6/7) — SCOPED to param_field/formfield only (mirroring the def.type-scoped
    // checks above): `options`/`matchvar`/`atomType`/`whenparam`/`section`/`units` are common field NAMES reused
    // by dozens of unrelated blocks across the palette for unrelated purposes — a bare field-name match here
    // (like `CORNER_COLOUR[field]` gets away with, because those two names are genuinely unique) would silently
    // reclassify every one of them. `def.kind` is these two blocks' own routing key, already used the same way
    // by jsonDef()'s `isParamGroup`/etc. checks just below.
    if (def.kind === 'param_field' || def.kind === 'formfield') {
        if (field === 'options') return 'optionseditor';
        if (field === 'section' || field === 'units') return 'combo';
    }
    if (def.kind === 'formfield' && (field === 'matchvar' || field === 'atomType' || field === 'whenparam')) return 'picker';
    if (optionsFor(def, field)) return 'dropdown';
    const sock = def.sockets && def.sockets[field];
    if (sock === 'region') return 'region';
    if (sock === 'boolean') return 'boolean';
    const d = def.defaults[field];
    if (typeof d === 'boolean') return 'checkbox';
    if (typeof d === 'number') return 'value';
    return 'text';
}

/** The dropdown options for a field (if it's a dropdown), used by devMode for enum bindings. */
export const fieldOptions = (def, field) => optionsFor(def, field);

/** The inline fields (non-numeric sockets) eligible for dev-mode exposure. */
export function inlineFields(def) {
    return fieldsOf(def).filter((f) => {
        const k = fieldKind(def, f);
        return k === 'dropdown' || k === 'text' || k === 'cornergrid' || k === 'checkbox' || k === 'coordlist';
    });
}

/** One Blockly JSON block def from an op def. */
function jsonDef(def) {
    const isSection = def.kind === 'section';
    const isStructctl = def.kind === 'structctl';   // t154 — keeps its label (e.g. "Probe Z First") but drops the field-name prefix ("value")
    const isOpunit = def.kind === 'opunit';   // t1071 — a friendly per-instance label + the opType/defV routing key rendered READ-ONLY (editable = a corruptible foot-gun)
    const isParamGroup = def.kind === 'param_group';   // t1075 rider — the header read "Parameter Group group X" (the word twice) → "Parameter Group: X"
    const args0 = [];
    // t146 — HEADER ROW (message0): the block's label + its inline fields. Statement-input MOUTHS go on their OWN rows
    // BELOW (message1/message2 via addMouth) so the label never sits beside the mouth (which shoved nested blocks right
    // + widened the block) → the block collapses to CONTENT WIDTH, nested content starts hard-left. The item-b separator-
    // header pattern, GENERALIZED in the shared builder to EVERY C-mouth kind. Authoring layout only — emit is untouched.
    // The `section` block shows JUST its title (no "Section title" prefix): drop the label + the field-name for it.
    let message0 = isSection ? '' : (isOpunit ? '▨ %1 ·' : (isParamGroup ? def.label + ':' : def.label)), n = isOpunit ? 1 : 0;
    if (isOpunit) args0.push({ type: 'field_label', name: 'OPUNIT_LABEL', text: def.label });   // filled per-instance from opType by ddcs_opunit; the routing key (opType/defV) follows READ-ONLY
    // t2387 (BACKLOG #42 piece 5) — live-caught before shipping: a field's caption word ("help"/"min"/…) is baked
    // into message0 as a bare STRING LITERAL, which Blockly's own message-parser turns into an UNNAMED implicit
    // `field_label` distinct from the named value field %n — hiding the NAMED field (`getField(FN(f)).setVisible`)
    // never touches that implicit label, so an "enabled-hidden" field left a DANGLING caption word with no box next
    // to it (confirmed live: a real twin's Parameter Group screenshot showed "help options min max step units" as
    // bare orphaned text on every number-widget row). Fix: a field this def lists in `enablers` gets its OWN NAMED
    // label field (`FN(f)+'_LBL'`) instead of embedding the word in the string — the SAME two-driver visibility
    // toggle in `registerDynExtension` (below) then hides label+box together. Every other field (the large
    // majority — nothing declares `enablers` except param_field/formfield) keeps the byte-identical literal-text
    // path; this only changes shape for the handful of fields that opted into hide-when-empty.
    const enablerFieldSet = new Set((def.enablers || []).flatMap((en) => en.fields));
    for (const f of fieldsOf(def)) {
        const k = fieldKind(def, f);
        // t2385 (BACKLOG #42 piece 1) — a def MAY declare its own `labels: {field: 'friendly text'}` map so
        // the block FACE reads a human word (e.g. `dflt` -> "default") while the STORAGE key never changes —
        // `def.labels` is per-def, not the shared bare-field-name `DESCRIPTIONS` map above (that one is keyed
        // by field name ACROSS every block kind — e.g. 'value'/'type'/'dwell' are reused by dozens of
        // unrelated blocks — so widening IT would relabel every one of them, not just the def that asked).
        // Absent `labels` (every pre-existing def), this falls back to the raw field name — byte-identical
        // face text for every block that doesn't opt in.
        // t2387 (BACKLOG #42 piece 3) — the ONE established sentence-shaped pair (formField.js's own `whenparam`+
        // `whenis`, t1640): "whenparam [socket] whenis [socket]" reads as what it MEANS instead — "show when
        // [socket] is [socket]" — same two fields, same storage, same precedent as isSection/isOpunit's own
        // prefix-dropping just below. Name-keyed (not a per-def flag) because the pair is unique to these two
        // field names across the whole registry — grepped, no other def declares either.
        const sentenceLabel = f === 'whenparam' ? 'show when' : f === 'whenis' ? 'is' : null;
        const faceLabel = sentenceLabel || (def.labels && def.labels[f]) || f;
        if (enablerFieldSet.has(f) && !(isSection || isStructctl || isOpunit || isParamGroup)) {
            args0.push({ type: 'field_label', name: FN(f) + '_LBL', text: faceLabel });   // t2387 — a NAMED, independently hideable caption (see the header note above)
            message0 += ` %${++n} %${++n}`;
        } else {
            message0 += (isSection || isStructctl || isOpunit || isParamGroup) ? ` %${++n}` : ` ${faceLabel} %${++n}`;   // opunit drops the "opType"/"defV" prefixes (the friendly label carries the meaning); param_group drops the redundant "group"
        }
        const desc = getDesc(f);
        if (k === 'cornergrid') args0.push({ type: 'field_cornergrid', name: FN(f), value: String(def.defaults[f] ?? ''), colour: CORNER_COLOUR[f], tooltip: desc });
        else if (k === 'regionpick') args0.push({ type: 'field_regionpick', name: FN(f), value: String(def.defaults[f] ?? 0), tooltip: desc });
        else if (k === 'coordlist') args0.push({ type: 'field_coordlist', name: FN(f), value: String(def.defaults[f] ?? '{"points":[],"z":0}'), tooltip: desc });
        // t2389 (BACKLOG #42 pieces 2/6/7) — `pickKind`/`comboKind` are the field's own NAME (matchvar/atomType/
        // whenparam; section/units) — the field class reads live candidates from the workspace at popup-open
        // time using that name to pick which enumeration to run (pickerField.js/comboField.js's own headers).
        else if (k === 'optionseditor') args0.push({ type: 'field_optionseditor', name: FN(f), value: String(def.defaults[f] ?? ''), tooltip: desc });
        else if (k === 'picker') args0.push({ type: 'field_picker', name: FN(f), value: String(def.defaults[f] ?? ''), pickKind: f.toLowerCase(), tooltip: desc });
        else if (k === 'combo') args0.push({ type: 'field_combo', name: FN(f), text: String(def.defaults[f] ?? ''), comboKind: f, tooltip: desc });
        else if (k === 'dropdown') args0.push({ type: 'field_dropdown', name: FN(f), options: optionsFor(def, f).map((o) => Array.isArray(o) ? o : [o, o]), tooltip: desc });
        else if (k === 'checkbox') args0.push({ type: 'field_checkbox', name: FN(f), checked: def.defaults[f] !== false, tooltip: desc });
        else if (k === 'text') args0.push({ type: 'field_input', name: FN(f), text: String(def.defaults[f] ?? ''), tooltip: desc });
        else if (k === 'region') args0.push({ type: 'input_value', name: FN(f), check: 'Region', tooltip: desc });
        else if (k === 'boolean') args0.push({ type: 'input_value', name: FN(f), check: 'Boolean', tooltip: desc });
        else args0.push({ type: 'input_value', name: FN(f), check: 'Number', tooltip: desc });
    }
    const block = {
        // t152 — user_root uses EXTERNAL inputs (inputsInline:false) so its dummy mouth-LABEL rows each stay on their own
        // row (the block label / Presentation / Execution don't merge into one cramped row); every other block stays inline.
        type: def.type, message0: message0.trim() || def.label, args0, inputsInline: def.kind !== 'user_root',
        // DECLARED HELP SLOT (1c): a def with a `help` string uses it as the block tooltip (the plain-string form v13
        // applies via setTooltip during jsonInit); a def without help keeps the default "<label> (<category>)".
        style: catSlug(def.category) + '_style', tooltip: def.help || `${def.label} (${def.category})`,
    };
    // t146 — each statement-input MOUTH on its OWN row below the header (message1, message2, …), with an optional
    // sub-label. Generalized: user_root's 2 named mouths, and every def.mouth kind's own mouth (t1638).
    let row = 1;
    // t152 — a sub-LABELED mouth (user_root's Presentation/Execution) puts its label on its OWN dummy row ABOVE the mouth
    // (a full-height header row → the long label fits cleanly, not cramped beside the C-notch). Un-labeled mouths (every
    // def.mouth kind — passed no `sub`) are UNCHANGED: just the statement-input row (the section blocks stay as-is).
    const addMouth = (name, sub) => {
        if (sub) { block['message' + row] = sub + ' %1'; block['args' + row] = [{ type: 'input_dummy' }]; row++; }
        block['message' + row] = '%1'; block['args' + row] = [{ type: 'input_statement', name }]; row++;
    };
    if (def.kind === 'user_root') { addMouth('PRESENTATION', 'Presentation (UI & Sim)'); addMouth('EXECUTION', 'Execution (G-code)'); }
    else for (const m of mouthsOf(def)) addMouth(m.name, m.label);
    if (def.dynamic) block.extensions = ['ddcs_dynfields'];   // toggle pattern-specific inputs per the `dynamic` field
    if (isSection) block.extensions = [...(block.extensions || []), 'ddcs_seccolor'];   // t132 — per-instance concern colour from data.color (authoring-only, never emitted)
    if (isOpunit) block.extensions = [...(block.extensions || []), 'ddcs_opunit'];   // t1071 — friendly label from opType + lock the routing key read-only
    if (def.kind === 'cam_field' || def.kind === 'param_field') block.extensions = [...(block.extensions || []), 'ddcs_camfield'];   // t1093/t1105 — lock the `param` routing key read-only (a hand-edit corrupts the binding join); param_field shares the lock
    if (def.kind === 'reporter') block.output = outputCheck(def);   // value block
    else { block.previousStatement = null; block.nextStatement = null; }   // statement block
    return block;
}

const makeOpDef = (type, label, msgAdd = '', argsAdd = []) => ({
    type: type,
    message0: `⬡ %1 ${msgAdd}`,
    args0: [
        { type: 'field_label_serializable', name: 'LABEL', text: label, tooltip: getDesc(type) },
        ...argsAdd.map(a => ({ ...a, tooltip: getDesc(a.name) }))
    ],
    // t152 — each op-block mouth label (GCODE / SIM) on its OWN dummy row ABOVE the mouth, so the label row is taller + fits cleanly.
    message1: 'GCODE %1',
    args1: [ { type: 'input_dummy' } ],
    message2: '%1',
    args2: [ { type: 'input_statement', name: 'GCODE' } ],
    message3: 'SIM %1',
    args3: [ { type: 'input_dummy', name: 'SIM_LBL' } ],   // t788 — named so the empty-SIM adaptive hide can drop the label row too
    message4: '%1',
    args4: [ { type: 'input_statement', name: 'SIM' } ],
    previousStatement: null, nextStatement: null,
    colour: 210,
    tooltip: 'Recorded op — edit via its wizard.',
});

export const OP_BLOCKS = [
    makeOpDef('op', 'op'),
    makeOpDef('corner_op', 'Corner Probe', 'Corner %2 Seq %3 WCS %4 Z-First %5 Sync %6 Slave %7 Stop %8', [
        { type: 'field_dropdown', name: 'CORNER', options: SELECTS.corner.map(o => [o, o]) },
        { type: 'field_dropdown', name: 'PROBESEQ', options: SELECTS.probeSeq.map(o => [o, o]) },
        { type: 'field_dropdown', name: 'WCS', options: SELECTS.wcs.map(o => [o, o]) },
        { type: 'field_checkbox', name: 'PROBEZ', checked: false },
        { type: 'field_checkbox', name: 'SYNCA', checked: false },
        { type: 'field_dropdown', name: 'SLAVE', options: SELECTS.slave },
        { type: 'field_checkbox', name: 'QSTOP', checked: false }
    ]),
    makeOpDef('edge_op', 'Edge Probe', 'Axis %2 Dir %3 WCS %4 Sync %5 Slave %6 Stop %7', [
        { type: 'field_dropdown', name: 'AXIS', options: SELECTS.axis.map(o => [o, o]) },
        { type: 'field_dropdown', name: 'AXISDIR', options: SELECTS.axisDir.map(o => [o, o]) },
        { type: 'field_dropdown', name: 'WCS', options: SELECTS.wcs.map(o => [o, o]) },
        { type: 'field_checkbox', name: 'SYNCA', checked: false },
        { type: 'field_dropdown', name: 'SLAVE', options: SELECTS.slave },
        { type: 'field_checkbox', name: 'QSTOP', checked: false }
    ]),
    makeOpDef('circular_op', 'Circular Probe', 'Type %2 WCS %3 Stop %4', [
        { type: 'field_dropdown', name: 'FEATURETYPE', options: SELECTS.featureType.map(o => [o, o]) },
        { type: 'field_dropdown', name: 'WCS', options: SELECTS.wcs.map(o => [o, o]) },
        { type: 'field_checkbox', name: 'QSTOP', checked: false }
    ]),
    makeOpDef('middle_op', 'Middle Probe', 'Type %2 Axis %3 Dir %4 %5 2-Axis Dir2 %6 WCS %7 Z-First %8 Sync %9 Slave %10 Stop %11', [
        { type: 'field_dropdown', name: 'FEATURETYPE', options: SELECTS.featureType.map(o => [o, o]) },
        { type: 'field_dropdown', name: 'AXIS', options: SELECTS.axis.map(o => [o, o]) },
        { type: 'field_dropdown', name: 'DIR1', options: SELECTS.axisDir.map(o => [o, o]) },
        { type: 'field_checkbox', name: 'TWOAXIS', checked: false },
        { type: 'field_dropdown', name: 'DIR2', options: SELECTS.axisDir.map(o => [o, o]) },
        { type: 'field_dropdown', name: 'WCS', options: SELECTS.wcs.map(o => [o, o]) },
        { type: 'field_checkbox', name: 'PROBEZ', checked: false },
        { type: 'field_checkbox', name: 'SYNCA', checked: false },
        { type: 'field_dropdown', name: 'SLAVE', options: SELECTS.slave },
        { type: 'field_checkbox', name: 'QSTOP', checked: false }
    ]),
    makeOpDef('atc_change_op', 'ATC Tool Change', 'Mode %2 Wait-Spindle %3 Dust-Cover %4 Confirm %5', [
        { type: 'field_dropdown', name: 'MODE', options: SELECTS.atcMode.map(o => [o, o]) },
        { type: 'field_checkbox', name: 'WAITSPINDLE', checked: true },
        { type: 'field_checkbox', name: 'DUSTCOVER', checked: false },
        { type: 'field_checkbox', name: 'CONFIRM', checked: false }
    ]),
    makeOpDef('atc_test_op', 'ATC Magazine Test', 'Mode %2 Wait-Spindle %3 Dust-Cover %4', [
        { type: 'field_dropdown', name: 'MODE', options: SELECTS.testMode.map(o => [o, o]) },
        { type: 'field_checkbox', name: 'WAITSPINDLE', checked: true },
        { type: 'field_checkbox', name: 'DUSTCOVER', checked: false }
    ]),
    makeOpDef('atc_check_op', 'ATC Tool Check', 'Wait-Spindle %2 Dust-Cover %3', [
        { type: 'field_checkbox', name: 'WAITSPINDLE', checked: true },
        { type: 'field_checkbox', name: 'DUSTCOVER', checked: false }
    ]),
    makeOpDef('atc_length_op', 'ATC Tool Length', ''),
    makeOpDef('atc_warmup_op', 'ATC Spindle Warmup', ''),
    makeOpDef('surfacing_op', 'Surfacing', ''),
    makeOpDef('pocket_op', 'Pocket', ''),
    makeOpDef('slot_op', 'Slot', ''),
    makeOpDef('drill_op', 'Drill', ''),
    makeOpDef('text_op', 'Text', ''),
    makeOpDef('wcs_op', 'WCS', 'Target %2 X %3 Y %4 Z %5 Sync %6 Slave %7', [
        { type: 'field_dropdown', name: 'SYS', options: SELECTS.wcsSys },
        { type: 'field_checkbox', name: 'AXISX', checked: true },
        { type: 'field_checkbox', name: 'AXISY', checked: true },
        { type: 'field_checkbox', name: 'AXISZ', checked: true },
        { type: 'field_checkbox', name: 'SYNC', checked: false },
        { type: 'field_dropdown', name: 'SLAVE', options: SELECTS.slave }
    ]),
    makeOpDef('comm_op', 'Communication', 'Type %2 Mode %3 Color %4', [
        { type: 'field_dropdown', name: 'TYPE', options: SELECTS.commType },
        { type: 'field_number', name: 'MODE', value: 1 },
        { type: 'field_number', name: 'COLOR', value: -1 }
    ])
];

/** Define every op as a Blockly block. (Emit happens via stackBridge → emitMapped, not a Blockly generator.) */
let _Blockly = null;
export const getBlockly = () => _Blockly;   // stackBridge needs the serialization API to render blocks (v11)
const DEF_BY_TYPE = {}; PALETTE.forEach((d) => { DEF_BY_TYPE[d.type] = d; });

// t2385 — a SECOND mechanism limit, live-caught the same way as the one below: `Block.prototype.setOnChange`
// is a SINGLE-SLOT assignment, not a listener list — a block with TWO extensions that each call `setOnChange`
// (param_field carries both `ddcs_dynfields`, below, AND `ddcs_camfield`, further down, which locks its own
// `PARAM` field read-only) silently lets the LATER extension's call overwrite the EARLIER one's handler
// entirely. Confirmed live: with both extensions applied (as `jsonDef()` already does for every `param_field`/
// `cam_field`), `ddcs_dynfields`'s own visibility-toggling onChange never fired at all — `ddcs_camfield`
// registered second and clobbered it, even though `ddcs_dynfields`'s OWN logic was already correct (proven
// firing standalone on `formfield`, which carries no camfield lock). `addOnChange` below COMPOSES instead of
// overwriting — any extension that wants an onChange hook calls this, never `block.setOnChange` directly, so
// a third future extension composes cleanly too instead of re-discovering this same bug.
function addOnChange(block, fn) {
    if (!block._ddcsOnChangeChain) {
        block._ddcsOnChangeChain = [];
        block.setOnChange(function (e) {
            for (const cb of block._ddcsOnChangeChain) { try { cb.call(this, e); } catch (err) { /* one bad link doesn't break the rest */ } }
        });
    }
    block._ddcsOnChangeChain.push(fn);
}

// Dynamic block extension: show only the fields the current `dynamic` value calls for (e.g. array → only the
// chosen pattern's fields). Degrades safely — if anything throws, all fields stay visible (still editable).
//
// t2385 — FIXED a mechanism limit live-caught before it shipped a SECOND silently-broken consumer (BACKLOG #42
// piece 1): `jsonDef()` (this file's own block-shape builder) packs every `args0` field of one message0 ROW
// into a SINGLE shared Blockly Input (confirmed live: a fresh `formfield` block has `inputList.length === 1`
// holding all 29 of its own fields) — `getInput(FN(f))` can therefore never find a NAMED input for a bare
// inline field (`field_input`/`field_dropdown`/`field_checkbox`/etc, i.e. everything `fieldKind()` does NOT
// classify as `region`/`boolean`/the numeric `value` fallback), so `inp.setVisible(...)` below was silently a
// no-op for every one of them — `formfield`'s own `dynamic: ['bindMode','widget']` never actually hid
// anything, contradicting its own header comment's claim, undetected until this turn's own live probe.
// `Block.getField(name)` (confirmed live: `hasSetVisible: true`, and toggling it actually sets the field's own
// SVG root to `display:none` after a render) searches every field on the block regardless of which Input (if
// any) wraps it — a strict superset of what `getInput` could ever reach, so switching to it fixes the true
// no-op (formfield, and now param_field) with zero regression risk for anything `getInput` already reached.
function registerDynExtension(Blockly) {
    try {
        Blockly.Extensions.register('ddcs_dynfields', function () {
            const def = DEF_BY_TYPE[this.type];
            if (!def || !def.dynamic || !def.fieldsFor) return;
            const all = def.allFields || [];
            // t1640 — `dynamic` may name ONE field (every prior user, e.g. array's 'pattern') or an ARRAY of them
            // (formfield: 'bindMode' picks assign-var vs op-param, 'widget' picks the config fields, independently) —
            // byte-identical for a bare string (wraps to a 1-element array, same single-field read as before).
            const dynFields = Array.isArray(def.dynamic) ? def.dynamic : [def.dynamic];
            // t2387 (BACKLOG #42 piece 5) — a def MAY additionally declare `enablers: [{label, fields:[...]}]`:
            // fields that are HIDDEN once empty even when their widget makes them applicable (help / limits /
            // show-when / units — the "wall of boxes" the whole backlog entry exists to shrink), shown again once
            // non-empty OR once the canvas's own "Block options…" popup (blocksApp.js) reveals the group. This
            // composes with the widget-based `show` set below as ONE test (applicable AND (non-empty OR forced)) —
            // never two mechanisms fighting, per the dispatch's own explicit requirement. `_ddcsForcedVisible` is a
            // plain per-block-instance Set, NEVER serialized (no new stored state, per BACKLOG #42's own ruling) —
            // it lives only as long as this in-memory block does, so a field revealed-but-left-empty goes back to
            // hidden the moment the canvas reloads fresh (save/reload, undo past the reveal, a new page load).
            const enablerFields = (def.enablers || []).flatMap((en) => en.fields);
            const nonEmpty = (v) => v !== undefined && v !== null && String(v).trim() !== '';
            const apply = () => {
                try {
                    const params = { ...def.defaults };
                    for (const df of dynFields) params[df] = this.getFieldValue(FN(df));
                    const show = new Set(def.fieldsFor(params).map(FN));
                    if (enablerFields.length) {
                        const forced = this._ddcsForcedVisible || new Set();
                        for (const f of enablerFields) {
                            if (!show.has(FN(f))) continue;   // not applicable to this widget anyway — the widget test wins either way
                            if (!nonEmpty(this.getFieldValue(FN(f))) && !forced.has(f)) show.delete(FN(f));
                        }
                    }
                    all.forEach((f) => { const fld = this.getField(FN(f)); if (fld) fld.setVisible(show.has(FN(f))); });
                    // t2387 — the enabler fields' own NAMED caption (jsonDef()'s `_LBL` twin, see its own header
                    // note) toggles in LOCKSTEP with the value field it labels — a dangling "help" with no box
                    // next to it is exactly the bug this second line exists to prevent.
                    for (const f of enablerFields) { const lbl = this.getField(FN(f) + '_LBL'); if (lbl) lbl.setVisible(show.has(FN(f))); }
                    if (this.rendered) { if (this.queueRender) this.queueRender(); else if (this.render) this.render(); }
                } catch (e) { /* degrade to all-fields-visible */ }
            };
            this._ddcsApplyDyn = apply;   // t2387 — exposed so the canvas's own "Block options…" popup (blocksApp.js) can force a recompute after setting `_ddcsForcedVisible`, without reaching into this closure
            addOnChange(this, function () {
                if (this.isInFlyout || !this.workspace) return;
                // t2387 — watch the enabler fields too, not just `dynamic`'s own: a JSON-loaded block sets an
                // optional field's real value AFTER this extension's initial `apply()` call (which only saw the
                // still-empty default), and that value-set fires exactly this onChange — without watching it here,
                // a loaded (non-empty) help/limits/units/show-when value would stay wrongly hidden forever, since
                // nothing else ever re-runs `apply()` for it.
                const watch = enablerFields.length ? [...dynFields, ...enablerFields] : dynFields;
                const v = watch.map((df) => this.getFieldValue(FN(df))).join('|');
                if (v === this._ddcsDyn) return;
                this._ddcsDyn = v; apply();
            });
            apply();
        });
    } catch (e) { /* already registered */ }
}

// t132 — CONCERN COLOUR: a `section` block carries an OPTIONAL declared colour (params.color → rides in the block's `data`,
// never a rendered field, never emitted). This extension applies it as the Blockly block colour so the concern-sections read
// apart at a glance. Deserialization sets `data` AFTER init, so re-apply on the next tick + as a setOnChange fallback. A
// section with no declared colour keeps its category style (so the 5 other user ops, which declare none, render unchanged).
function registerSecColorExtension(Blockly) {
    try {
        Blockly.Extensions.register('ddcs_seccolor', function () {
            const self = this;
            const apply = () => { try { const c = self.data ? JSON.parse(self.data).color : null; if (c) { self.setColour(c); self._ddcsSecColored = true; } } catch (_) { /* keep style */ } };
            apply();                        // paste / programmatic create (data already set)
            setTimeout(apply, 0);           // JSON load sets `data` after init → colour on the next tick
            addOnChange(self, function () { if (!self._ddcsSecColored) apply(); });   // fallback until it lands — t2385: composed, not a raw setOnChange (see addOnChange's own header note)
        });
    } catch (e) { /* already registered */ }
}

// t1071 — the `opunit` chip: derive a FRIENDLY per-instance label from the opType it wraps (e.g. "Surface / face unit") and
// render the routing key READ-ONLY. An opunit is a DECLARED sub-unit boundary created programmatically at fork/load time; its
// opType is the key subStackToSlot routes on, so a hand-edit in the workspace would corrupt the routing (audit Finding 1). The
// value still round-trips (the field is present, just non-editable). Degrades safely — if anything throws, the chip stays raw.
function registerOpunitExtension(Blockly) {
    try {
        Blockly.Extensions.register('ddcs_opunit', function () {
            const self = this;
            // this Blockly has no Field.setEditable — editability is the EDITABLE property (isCurrentlyEditable reads it) + enabled_
            // (isClickable gates the click-to-edit). Set both so the routing key can neither open an editor nor report editable.
            const lock = (f) => { if (!f) return; try { f.EDITABLE = false; if (f.setEnabled) f.setEnabled(false); else if (f.updateEditable) f.updateEditable(); } catch (_) { /* keep field */ } };
            const apply = () => {
                try {
                    const ot = self.getFieldValue('OPTYPE') || '';
                    const lf = self.getField('OPUNIT_LABEL');
                    if (lf && ot) lf.setValue(opLabelOf(ot) + ' unit');   // the twin it forks, made friendly ("Surface / face" → "Surface / face unit")
                    lock(self.getField('OPTYPE'));   // the routing key: READ-ONLY (corruptible foot-gun otherwise)
                    const dInp = self.getInput && self.getInput('DEFV');   // defV rides a math_number shadow → lock its NUM field too (a version stamp, not operator-set)
                    const dTgt = dInp && dInp.connection && dInp.connection.targetBlock();
                    lock(dTgt && dTgt.getField && dTgt.getField('NUM'));
                } catch (_) { /* keep the raw chip */ }
            };
            apply();
            setTimeout(apply, 0);           // JSON load sets fields/shadows AFTER init → re-derive the label + re-lock
            addOnChange(self, function () { if (!self._ddcsOpunit) { self._ddcsOpunit = true; apply(); } });   // fallback until the field/shadow lands — t2385: composed, not a raw setOnChange
        });
    } catch (e) { /* already registered */ }
}

// t1093 — the `cam_field` chip: lock the `param` routing key READ-ONLY. `param` names the def value-binding this pendant row
// declares (the join key camFieldsFromStack / stackToSlot address by); a hand-edit in the workspace would dangle the binding.
// The value still round-trips (the field is present, just non-editable), mirroring the opunit routing-key lock. Degrades
// safely — if anything throws, the chip stays editable rather than breaking the block.
function registerCamFieldExtension(Blockly) {
    try {
        Blockly.Extensions.register('ddcs_camfield', function () {
            const self = this;
            const lock = (f) => { if (!f) return; try { f.EDITABLE = false; if (f.setEnabled) f.setEnabled(false); else if (f.updateEditable) f.updateEditable(); } catch (_) { /* keep field */ } };
            const apply = () => { try { lock(self.getField('PARAM')); } catch (_) { /* keep the raw chip */ } };
            apply();
            setTimeout(apply, 0);   // JSON load / dynfields rebuild sets fields AFTER init → re-lock on the next tick
            addOnChange(self, function () { lock(self.getField('PARAM')); });   // re-lock after a mode toggle rebuilds the fields — t2385: was self.setOnChange, which silently overwrote ddcs_dynfields' own handler on a block (param_field) carrying both extensions
        });
    } catch (e) { /* already registered */ }
}

export function installBlockly(Blockly) {
    _Blockly = Blockly;
    installCornerGridField(Blockly);   // register field_cornergrid BEFORE the blocks that reference it
    installRegionPickField(Blockly);   // register field_regionpick (the region-pick control's block adapter)
    installCoordListField(Blockly);    // register field_coordlist (the coordinate-list positions preview)
    installPickerField(Blockly);       // t2389 — register field_picker (BACKLOG #42 piece 6)
    installOptionsEditorField(Blockly);   // t2389 — register field_optionseditor (BACKLOG #42 piece 2)
    installComboField(Blockly);        // t2389 — register field_combo (BACKLOG #42 piece 7)
    registerDynExtension(Blockly);
    registerSecColorExtension(Blockly);
    registerOpunitExtension(Blockly);   // t1071 — the opunit chip's friendly label + read-only routing key
    registerCamFieldExtension(Blockly);   // t1093 — the cam_field chip's read-only param routing key
    Blockly.defineBlocksWithJsonArray([...PALETTE.map(jsonDef), ...OP_BLOCKS]);
}

/** t1570 — the DECLARED catch-all palette group. A block whose category is not in CATEGORIES lands here rather
 *  than vanishing: visible and draggable, and obviously wrong to anyone looking, which is the point. Named once
 *  so the toolbox builder and the invariant spec cannot drift on the string. */
export const UNCATEGORISED = 'Uncategorised';

/** A value input's shadow (an editable default number) for the toolbox. */
const shadow = (v) => ({ shadow: { type: 'math_number', fields: { NUM: Number(v) || 0 } } });

/** The colour-coded toolbox: one category per ops CATEGORY, blocks derived from the registry. `extraCategories`
 *  (caller-supplied, e.g. the learner-library Snippets / Complete Programs groups) are appended after the ops cats —
 *  injected by the caller so this low-level module needn't import the higher-level stack→flyout converter (cycle). */
export function buildToolbox(extraCategories = []) {
    const byCat = {};
    PALETTE.filter((def) => !def.hidden).forEach((def) => {   // t903 — hidden atoms (e.g. safetraverse until P2.5) stay in BLOCKS but never appear as a DRAGGABLE toolbox entry
        const inputs = {};
        fieldsOf(def).forEach((f) => { if (fieldKind(def, f) === 'value') inputs[FN(f)] = shadow(def.defaults[f]); });
        (byCat[def.category] ||= []).push({ kind: 'block', type: def.type, ...(Object.keys(inputs).length ? { inputs } : {}) });
    });
    const cats = CATEGORIES.filter((c) => byCat[c]).map((c) => ({
        kind: 'category', name: c, categorystyle: catSlug(c) + '_cat', contents: byCat[c],
    }));
    // t1570 — NO BLOCK MAY VANISH FOR LACKING A LISTED CATEGORY. This line used to be the whole story, and it
    // iterates CATEGORIES: a def whose `category` is absent from that list (a new block, a typo, a category added
    // to a def but not to the list) was silently dropped from the toolbox — present in BLOCKS, draggable from
    // nowhere. Nothing currently triggers it, which is exactly why it would have gone unnoticed the first time a
    // regroup landed. Anything unlisted now lands in a visible catch-all instead of disappearing; the invariant
    // spec asserts the palette-reachable SET, so this can never silently regress.
    const unlisted = Object.keys(byCat).filter((c) => !CATEGORIES.includes(c)).sort();
    if (unlisted.length) {
        cats.push({
            kind: 'category', name: UNCATEGORISED, categorystyle: catSlug(UNCATEGORISED) + '_cat',
            contents: unlisted.flatMap((c) => byCat[c]),
        });
    }
    // Tree sidebar: the per-category atom blocks live under a collapsible "⚛ Atoms" parent; the caller's groups
    // (the learner library — Snippets / Complete Programs) are siblings. So the rail reads Atoms · Snippets · Programs.
    const atoms = { kind: 'category', name: '⚛ Atoms', expanded: 'true', contents: cats };
    return { kind: 'categoryToolbox', contents: [atoms, ...(extraCategories || [])] };
}
