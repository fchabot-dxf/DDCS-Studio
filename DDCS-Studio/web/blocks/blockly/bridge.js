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
// t2395 (BACKLOG #47 item 1) — the GOTO FAMILY: each of these five blocks names a `label` block's own `n` by
// ONE field, but the field's own NAME differs per block (goto.n, ifgoto.goto, probecheck.goto, confirm.cancel,
// hmiconfirm.cancel — the same collision risk `SELECTS`' bare-name keying already has to guard against
// elsewhere in this file), so a `(def.type, field)` table is the declared, unambiguous source rather than a
// name-based guess. FORWARD-AUTHORABLE (BACKLOG #47's own reference-not-declaration rung): the picker lists
// the stack's own labels but a typed NEW number still commits (`allowNew`, pickerField.js) — "people place the
// jump before the label."
const LABEL_TARGET_FIELDS = { goto: 'n', ifgoto: 'goto', probecheck: 'goto', confirm: 'cancel', hmiconfirm: 'cancel' };
// t2453 (BACKLOG #47 tier 2) — TOOL NUMBERS, the same REFERENCE/forward-authorable shape as the goto family
// above (a `(def.type, field)` table for the same name-collision reason): `tool.n` / `toolsel.toolNum` name a
// tool-library entry (settings.atc.tools[]) that lives OUTSIDE the stack entirely (declared in Settings, not
// by any block on this canvas) — so unlike matchvar/atomType (a reference to a thing that must ALREADY exist
// IN THIS STACK), referencing a tool number nobody has catalogued yet is legitimate authoring, not a mistake
// (the owner's own standing rule: machine configuration is theirs). `allowNew: true`, same as goto — the
// TRAFFIC LIGHT (pickerField.js's own getText()) says "not in your tool table" instead of refusing it.
// ⛔ `tooloffset.tool` was NOT added here despite BACKLOG #47's own dispatch naming it under this tier: its
// default (`measure.js`, `tool: '#1300'`) is a REGISTER REFERENCE (the currently-loaded tool, dialect vars.
// toolTable-relative), not a catalogued tool NUMBER — BACKLOG #47 itself originally listed `tooloffset.tool/
// value` under item 2 (macro-var names), not item 3 (tool/pin numbers); the dispatch's own tier grouping
// mis-sorted it. ⚠ Tried the OTHER obvious fix too (routing it to assign.var's own combo/traffic-light
// mechanism, since its shape genuinely matches) and REVERTED it: `classify(1300)` (data/varMap.js) resolves to
// `camsetting`, not `scratch`/`uservar`, so the traffic light would show "⚠ camsetting register — not free
// scratch/user space" on the field's OWN correct, unedited default — every freshly-dropped `tooloffset` block
// would open already warning, which is exactly the noise the traffic light was built to avoid on a clean case
// (comboField.js's own header: "a plain scratch/uservar value stays exactly as typed, no decoration"). Left
// untouched (plain text, unchanged) — a real follow-up exists (`tooloffset.value`, default `'#102'`, has the
// identical tension) but deciding it needs the file in hand at that time, not a reflexive reuse here.
const TOOL_TARGET_FIELDS = { tool: 'n', toolsel: 'toolNum' };
// t2453 (BACKLOG #47 tier 2) — I/O PIN NUMBERS: `outpin.pin` / `waitinput.pin` share a bare field NAME across
// OPPOSITE meanings (output vs input — the exact `LABEL_TARGET_FIELDS`-style collision), and `probe.port`
// names a THIRD field for the same input concept (`ui/ioTable.js`'s own INPUT_TYPES already catalogues a
// `type:'probe'` row for this exact pin). `settings.inputs`/`settings.outputs`' own `.pin` field IS the same
// raw numbering space these blocks emit (`ui/ioTable.js`'s own header: "Pin ranges: inputs 1-24, outputs
// 1-20" — matching outpin.js's own "DDCS raw outputs are pins 0-20" comment) — one source, not re-derived.
// Same REFERENCE/forward-authorable ladder rung as tool numbers: an uncatalogued pin is legitimate (the
// owner's machine, not yet fully catalogued in Settings), never a closed gate.
const IO_TARGET_FIELDS = { outpin: { field: 'pin', kind: 'output' }, waitinput: { field: 'pin', kind: 'input' }, probe: { field: 'port', kind: 'input' } };
// t2453 (BACKLOG #47 tier 3) — `flip.setup`: established WITH THE FILE IN HAND (transform.js) that this is the
// CLOSED rung, not goto's forward-authorable one, despite superficially looking like the same "reference a
// sibling block's own number" shape label targets are. Two reasons, not just "the dispatch's own hunch":
// (1) a `setup` block is a whole SECTION boundary a user builds (title + its own child ops) BEFORE it means
// anything to flip — unlike a `label`, a lightweight one-field marker commonly dropped inline ahead of the
// jump that targets it, there is no ordinary authoring flow where you'd type "flip setup 3" before setup 3's
// own boundary exists to flip; (2) setups are FEW (a two-sided job has exactly 2, rarely 3+), so closing this
// picker costs no real workflow flexibility the way closing goto would (forward jumps in a long linear
// program are routine; referencing a not-yet-built setup section is not). A typo here is the entry's own
// "worst failure mode" (the flip silently never applies, wrong side gets cut) — closing the picker removes
// that whole class rather than merely warning about it.
const SETUP_TARGET_FIELDS = { flip: 'setup' };
// t2525 (BACKLOG #71) — the HANDLE blocks' own PARAM-NAMING fields: which EXISTING formfield/param_field param
// each handle drives (userOps.js's own `handleBindingsFromStack`/`attach()` looks it up and merges the
// handle's anchor onto that REAL binding — the fix for the central t2523 finding, a handle that dragged but
// never reached emit). CLOSED, same rung as `flip.setup` above and for the identical reason: a handle pointing
// at a param that doesn't exist is a plain authoring defect, never legitimate forward-authoring the way a
// goto/tool/pin reference can be — so no `allowNew`, reusing pickKind 'whenparam' as-is (pickerField.js's own
// candidate set is ALREADY "every formfield/param_field's own PARAM in this stack", exactly what a handle
// needs; the `b.id !== blk.id` self-exclusion it applies is a harmless no-op here since a handle is never
// itself a formfield/param_field). One block type may name more than one field (point_handle: fx+fy;
// rect_handle: field+fieldH) — an array, unlike the other TARGET_FIELDS maps above which only ever needed one.
const HANDLE_ANCHOR_FIELDS = {
    length_handle: ['field'],
    point_handle: ['fx', 'fy'],
    rect_handle: ['field', 'fieldH'],
    radial_handle: ['field'],
    scale_handle: ['field', 'baseField'],   // t2533 — baseField is read-only (never merged onto), but still a must-match picker
    shear_handle: ['field', 'hField'],   // t2533 — hField is read-only (never merged onto), but still a must-match picker
    proj_length_handle: ['field'],
    probe_vector_handle: ['field', 'fieldAxis', 'fieldDir'],   // t2557 — dist/axis/dir, all three must-match (axis/dir are ENUM string writes, see panelTypes.js's own t2557 guard)
    diag_aim_handle: ['fieldTravel', 'fieldPrimary', 'axisField', 'signField'],   // t2573 — fieldTravel/fieldPrimary are written; axisField/signField are read-only companions (never merged onto), same doctrine as scale_handle's baseField
    cross_aim_handle: ['field', 'axisField', 'signField'],   // t2583 — field is written; axisField/signField are read-only companions (never merged onto), same doctrine as diag_aim_handle's own; relToRow is a DIFFERENT picker kind (RELTO_TARGET_FIELDS below), a sim-start row id, not a param
};
// t2585 (BACKLOG #61 follow-up) — `relToRow`: the `relTo` REFERENCE field, naming an EXISTING `simstart` block's
// own `id` (must already exist, the SAME closed doctrine HANDLE_ANCHOR_FIELDS established — a relTo pointing at
// a row that was never declared anywhere is a plain authoring defect, not legitimate forward-authoring; a row
// legitimately ABSENT under the op's current `when`-gate state at RUNTIME is a separate, already-handled case —
// see panelTypes.js's own crossAim branch, which falls back gracefully rather than treating that as broken).
// TWO consumers, genuinely unique field name (grepped): `formfield`'s own pre-existing point-handle relTo socket,
// and `cross_aim_handle`'s new one (t2583) — both were free text before this turn, meaning `relTo` had NEVER
// been reachable by a person clicking through the app, only via a literal template (this session's own fourth
// instance of "a declared seam with no way in" — see simStart.js's own header for the full account).
const RELTO_TARGET_FIELDS = { formfield: 'relToRow', cross_aim_handle: 'relToRow' };
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
    whenis: "Gate value the param must equal (true / false / a string)",
    // t2431 (BACKLOG #49) — the ~25 uncovered high-traffic field names the top-20 blocks' own tooltips exposed.
    // ⚠ FLAGGED: `to`/`by` are deliberately GENERIC (a probe's `to` is a target position; Step Down's `to` is a
    // total depth — two real, different meanings sharing one bare field name across the registry, the same
    // collision this map's own header warns about) — worded broadly enough to not be WRONG for either rather
    // than precise for one and misleading for the other.
    note: "Optional comment appended to the line",
    z0: "Z the build frame starts from",
    peck: "Peck depth per pass",
    pitch: "Bore stepdown per pass (step or helix)",
    holedia: "Hole diameter",
    tooldia: "Tool diameter",
    clearance: "Retract/clearance height above the work",
    cols: "Number of columns",
    rows: "Number of rows",
    dx: "Column spacing",
    dy: "Row spacing",
    count: "Number of items in the pattern",
    spacing: "Distance between items",
    angle: "Angle in degrees",
    dia: "Diameter",
    startangle: "Angle of the first item in the pattern",
    w: "Width",
    h: "Height",
    nx: "Points across (perimeter pattern)",
    ny: "Points down (perimeter pattern)",
    skip: "Items to skip, e.g. 2,5 (1-based)",
    rhs: "Right-hand side of the comparison",
    rpm: "Spindle speed (RPM)",
    spinup: "Pause after the spindle starts, before moving (ms or s)",
    skim: "Relative (G91) program — no absolute Z reference",
    spindleoff: "Turn the spindle off",
    coolantoff: "Turn coolant off",
    retract: "Retract before ending",
    retractz: "Z height to retract to",
    park: "Move to a park position before ending",
    parkx: "Park position X",
    parky: "Park position Y",
    end: "End-of-program code (M30 reset / M2 end / M99 subprogram return)",
    rate: "Feedrate",
    sec: "Pause duration in seconds",
    flow: "Coolant flow: flood, mist, or off",
    to: "Target value or position",
    by: "Amount per step",
    confirmevery: "Pause for confirmation every N passes (0 = never)",
    region: "The area to clear (plug in a Region block)",
    stepover: "Distance between adjacent passes",
    strategy: "Pass layout: parallel rows or concentric rings",
    direction: "Pass direction: both ways, one way, or the other way",
    plunge: "Feedrate when plunging into the cut",
    text: "The exact text to emit, unchanged",
    code: "M-code number",
    seek: "Expected probe travel distance",
    eps: "Tolerance for the probe miss-check"
};
// t2433 (BACKLOG #49) — `DESCRIPTIONS` is keyed by BARE FIELD NAME across the WHOLE registry (t1520's own comment
// above names the exact collision this closes: `dir` is spindle CW/CCW on progstart/spindle but the probe/
// radiuscomp travel SIGN elsewhere — one name, two real meanings, and the shared map could only ever say one of
// them). `def.fieldHelp = {field: 'tooltip text'}` lets a def override the shared entry for its OWN field,
// falling back to it when the def says nothing — the same per-def-beats-shared shape `def.labels` already uses
// for face text, kept as its own map rather than folded into `labels` (that one holds short face words; this
// one holds full tooltip sentences, a different kind of content). `def` is OPTIONAL so the two `makeOpDef`
// call sites below (a different, def-less block family) stay byte-identical, unchanged.
const getDesc = (f, def) => (def && def.fieldHelp && def.fieldHelp[f]) || DESCRIPTIONS[f.toLowerCase()] || `The ${f} parameter`;

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
    // t2527 (BACKLOG #71/t2513) — LIVE-CONFIRMED: these two committed 'tool-library'/'thread-preset', but
    // formWidgets.js's own FORM_WIDGETS registry has ALWAYS keyed them 'toolpick'/'threadpick' (matching
    // deriveBindings.js's own hand-written TOOL_BINDING_SPECS + pocketData.js/tapData.js's own `widget:
    // 'threadpick'` bindings, all pre-existing and correct) — every OTHER entry here is hyphenated AND matches
    // its FORM_WIDGETS key exactly (`plane-suggest`/`declared-io`/`corner-grid`/`region-pick`/`coord-list`);
    // only these two silently diverged. `resolveFormWidget` (formWidgets.js) falls through to a type-based
    // default on ANY unrecognized widget string with no warning (the general pattern this bug is one instance
    // of — see that function's own note) — so a formfield authored with either of these NEVER reached the real
    // picker widget, degrading silently to a plain number input. [label, value] pairs keep the friendly display
    // text while fixing the committed value to the string FORM_WIDGETS actually reads.
    if (field === 'widget' && def.type === 'param_field') return [['(from type)', ''], 'number', 'slider', 'dropdown', 'segmented', 'toggle', 'text', 'corner-grid', 'region-pick', 'coord-list', 'plane-suggest', ['tool-library', 'toolpick'], ['thread-preset', 'threadpick'], 'declared-io', 'stepper'];
    if (field === 'widget' && def.type === 'formfield') return ['number', 'slider', 'dropdown', 'segmented', 'toggle', 'text', 'corner-grid', 'region-pick', 'coord-list', 'plane-suggest', ['tool-library', 'toolpick'], ['thread-preset', 'threadpick'], 'declared-io', 'stepper'];   // t1105 — param_field shares formfield's widget/type vocab
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
    if (field === 'panel' && def.type === 'feature_canvas') return Object.keys(PANEL_TYPES);   // the GUI panel-type declaration (t2515 — block type renamed from 'panel'; the field stays 'panel')
    if (field === 'kind' && def.type === 'layout') return Object.keys(LAYOUT_TYPES);
    // t2393 (BACKLOG #48 item 2) — flip is modeled on xform (transform.js's own header: "axis = flip about
    // X|Y"): NARROWED from the generic `SELECTS.axis` (X/Y/Z/A/B/C, shared by many unrelated blocks) to the
    // two values flip actually means — Z/A/B/C were offered and pickable but did nothing coherent.
    if (field === 'axis' && def.type === 'flip') return ['X', 'Y'];
    // t2517 (BACKLOG #71 pilot) — length_handle: NARROWED the same way flip's axis is, from the generic
    // SELECTS.axis (X/Y/Z/A/B/C) to the two the `length` canvas gesture actually supports (canvasWidgets.js's
    // own `d.axis==='x'` check is the ceiling — a 1D drag along one FeatureCanvas plane axis, never Z/A/B/C).
    if (field === 'axis' && def.type === 'length_handle') return ['X', 'Y'];
    // t2533 (BACKLOG #71) — proj_length_handle's own axis: same narrowing as length_handle's, same ceiling
    // (canvasWidgets.js's own `projLength` gesture generalizes to any (nx,ny) unit vector, but this block only
    // ever picks a cardinal one — see its own header for why a free vector pair is the wrong declared shape).
    if (field === 'axis' && def.type === 'proj_length_handle') return ['X', 'Y'];
    // t2521 (BACKLOG #71) — rect_handle's own valueField: WHICH declared param the handle's displayed number
    // reflects when both field/fieldH are active (canvasWidgets.js's own t2495 routing) — exactly two legal
    // values, the block's own two field NAMES, never a free-typed string.
    if (field === 'valueField' && def.type === 'rect_handle') return [['field (W)', 'field'], ['fieldH (H)', 'fieldH']];
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
    if (LABEL_TARGET_FIELDS[def.type] === field) return 'picker';   // t2395 (BACKLOG #47 item 1) — the goto family, see LABEL_TARGET_FIELDS' own header
    if (TOOL_TARGET_FIELDS[def.type] === field) return 'picker';   // t2453 (BACKLOG #47 tier 2) — tool numbers, see TOOL_TARGET_FIELDS' own header
    if (IO_TARGET_FIELDS[def.type] && IO_TARGET_FIELDS[def.type].field === field) return 'picker';   // t2453 (BACKLOG #47 tier 2) — I/O pin numbers, see IO_TARGET_FIELDS' own header
    if (SETUP_TARGET_FIELDS[def.type] === field) return 'picker';   // t2453 (BACKLOG #47 tier 3) — flip.setup, CLOSED (no allowNew) — see SETUP_TARGET_FIELDS' own header
    if (HANDLE_ANCHOR_FIELDS[def.type] && HANDLE_ANCHOR_FIELDS[def.type].includes(field)) return 'picker';   // t2525 (BACKLOG #71) — see HANDLE_ANCHOR_FIELDS' own header
    if (RELTO_TARGET_FIELDS[def.type] === field) return 'picker';   // t2585 — relTo's own reachability fix, see RELTO_TARGET_FIELDS' own header
    // t2393 (BACKLOG #48 item 3) — the magic scope names: a `z`/`by` field whose OWN DEFAULT equals its OWN
    // NAME (`z: 'z'`, `by: 'by'`) is self-describing as "an expression read against Step Down's own published
    // scope" — a signal genuinely unique to this pattern (an ordinary numeric Z field defaults to a NUMBER,
    // never the literal string 'z'), so this is narrow by construction without needing a `def.kind`/`def.type`
    // allowlist across the 8 files that use it.
    if ((field === 'z' || field === 'by') && def.defaults && def.defaults[field] === field) return 'combo';
    // t2395 (BACKLOG #47 item 2) — `assign.var`, THE PILOT: a DECLARATION site (typing stays open — see
    // comboField.js's own header for the full declare-vs-reference account). Scoped narrowly to `assign` only
    // this turn, on purpose — several OTHER blocks also carry a bare `var` field with the same macro-var
    // meaning (count.var, hmi's two, macro.var, measure's two, and the `.*`/saveVar/workClear/addrVar family
    // BACKLOG #47 itself names) and are real candidates for the SAME treatment, but "wire assign as the pilot…
    // other var fields ONLY where the field type drops in trivially" is the dispatch's own scoping — left
    // uncovered this turn, named in WORK-LOG rather than blanket-matched here without individually confirming
    // each one's own shape first.
    if (def.type === 'assign' && field === 'var') return 'combo';
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
    // t2405 (BACKLOG #53) — t2387's own fix scoped the NAMED-caption treatment to `enablers` fields only ("shown
    // = non-empty"); it never reached the WIDGET-driven hide path (`dynamic`+`fieldsFor` — holecycle/param/
    // progend/drillcycle/slot/pocketfill/region and every other consumer this arc built), so those blocks kept
    // baking every caption as a bare string literal — the exact same dangling-word bug, just via the OTHER hide
    // mechanism (owner screenshot: un-revealed NUMBER rows trailing a bare "options"). A def with `dynamic`+
    // `fieldsFor` can hide/show ANY of its own fields depending on state, so EVERY one of them needs an
    // independently-hideable caption too, not just the enabler subset — `apply()` (registerDynExtension, below)
    // toggles it in the SAME loop that already toggles the value field/socket.
    const dynamicGated = !!(def.dynamic && def.fieldsFor);
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
        if ((enablerFieldSet.has(f) || dynamicGated) && !(isSection || isStructctl || isOpunit || isParamGroup)) {
            args0.push({ type: 'field_label', name: FN(f) + '_LBL', text: faceLabel });   // t2387 — a NAMED, independently hideable caption (see the header note above)
            message0 += ` %${++n} %${++n}`;
        } else {
            message0 += (isSection || isStructctl || isOpunit || isParamGroup) ? ` %${++n}` : ` ${faceLabel} %${++n}`;   // opunit drops the "opType"/"defV" prefixes (the friendly label carries the meaning); param_group drops the redundant "group"
        }
        const desc = getDesc(f, def);
        if (k === 'cornergrid') args0.push({ type: 'field_cornergrid', name: FN(f), value: String(def.defaults[f] ?? ''), colour: CORNER_COLOUR[f], tooltip: desc });
        else if (k === 'regionpick') args0.push({ type: 'field_regionpick', name: FN(f), value: String(def.defaults[f] ?? 0), tooltip: desc });
        else if (k === 'coordlist') args0.push({ type: 'field_coordlist', name: FN(f), value: String(def.defaults[f] ?? '{"points":[],"z":0}'), tooltip: desc });
        // t2389 (BACKLOG #42 pieces 2/6/7) — `pickKind`/`comboKind` are the field's own NAME (matchvar/atomType/
        // whenparam; section/units) — the field class reads live candidates from the workspace at popup-open
        // time using that name to pick which enumeration to run (pickerField.js/comboField.js's own headers).
        else if (k === 'optionseditor') args0.push({ type: 'field_optionseditor', name: FN(f), value: String(def.defaults[f] ?? ''), tooltip: desc });
        // t2395 (BACKLOG #47 item 1) — the goto family's own field NAME varies per block (goto.n vs ifgoto.goto
        // vs confirm/hmiconfirm.cancel — see LABEL_TARGET_FIELDS' own header), so `pickKind` can't be the bare
        // field name the way matchvar/atomType/whenparam's already is; routed to the shared 'label' enumeration
        // instead, with `allowNew` (forward-authorable: a typed number with no matching label still commits).
        else if (k === 'picker' && LABEL_TARGET_FIELDS[def.type] === f) args0.push({ type: 'field_picker', name: FN(f), value: String(def.defaults[f] ?? ''), pickKind: 'label', allowNew: true, tooltip: desc });
        // t2453 (BACKLOG #47 tier 2) — same fixed-pickKind shape as the goto branch just above (the field's own
        // NAME varies per block — n/toolNum — so pickKind can't be derived from it the way the generic fallback
        // below does); REFERENCE, forward-authorable (allowNew), see TOOL_TARGET_FIELDS' own header.
        else if (k === 'picker' && TOOL_TARGET_FIELDS[def.type] === f) args0.push({ type: 'field_picker', name: FN(f), value: String(def.defaults[f] ?? ''), pickKind: 'tool', allowNew: true, tooltip: desc });
        // t2453 (BACKLOG #47 tier 2) — I/O pins: `pinKind` carries input-vs-output PER BLOCK TYPE (outpin.pin
        // and waitinput.pin share the bare field name 'pin' but mean opposite things — see IO_TARGET_FIELDS'
        // own header); also REFERENCE, forward-authorable.
        else if (k === 'picker' && IO_TARGET_FIELDS[def.type] && IO_TARGET_FIELDS[def.type].field === f) args0.push({ type: 'field_picker', name: FN(f), value: String(def.defaults[f] ?? ''), pickKind: 'pin', pinKind: IO_TARGET_FIELDS[def.type].kind, allowNew: true, tooltip: desc });
        // t2453 (BACKLOG #47 tier 3) — flip.setup: CLOSED (no allowNew) — see SETUP_TARGET_FIELDS' own header
        // for why this is the must-match rung, not the forward-authorable one tool/pin/goto all use.
        else if (k === 'picker' && SETUP_TARGET_FIELDS[def.type] === f) args0.push({ type: 'field_picker', name: FN(f), value: String(def.defaults[f] ?? ''), pickKind: 'setup', tooltip: desc });
        // t2525 (BACKLOG #71) — handle blocks: CLOSED (no allowNew), pickKind fixed to 'whenparam' regardless of
        // the field's own name (fx/fy/field/fieldH, none of which pickerField.js's own switch recognises as a
        // pickKind) — see HANDLE_ANCHOR_FIELDS' own header for why 'whenparam' is the right candidate set to reuse.
        else if (k === 'picker' && HANDLE_ANCHOR_FIELDS[def.type] && HANDLE_ANCHOR_FIELDS[def.type].includes(f)) args0.push({ type: 'field_picker', name: FN(f), value: String(def.defaults[f] ?? ''), pickKind: 'whenparam', tooltip: desc });
        // t2585 (BACKLOG #61 follow-up) — `relToRow`: CLOSED (no allowNew), same must-match rung as the handle
        // anchor fields just above and for the identical reason (a reference to a row nobody declared is a plain
        // authoring defect) — its own `pickKind` ('relTo') is a NEW enumeration (pickerField.js), not a reuse of
        // 'whenparam': the candidate set is every `simstart` block's own `id` field, not a formfield/param_field's
        // PARAM. See RELTO_TARGET_FIELDS' own header.
        else if (k === 'picker' && RELTO_TARGET_FIELDS[def.type] === f) args0.push({ type: 'field_picker', name: FN(f), value: String(def.defaults[f] ?? ''), pickKind: 'relTo', tooltip: desc });
        else if (k === 'picker') args0.push({ type: 'field_picker', name: FN(f), value: String(def.defaults[f] ?? ''), pickKind: f.toLowerCase(), tooltip: desc });
        else if (k === 'combo') args0.push({ type: 'field_combo', name: FN(f), text: String(def.defaults[f] ?? ''), comboKind: f, tooltip: desc });
        // t2643 (BACKLOG #71/#72) — ⚠ GENERAL DEFECT NAMED, NOT GENERALLY FIXED: Blockly's own built-in
        // `field_dropdown` ALWAYS selects `options[0]` for a freshly-created block — its `fromJson` has no
        // "initial value" property at all (confirmed live: adding a `value` key to the args0 object, tried
        // first, was silently ignored — every custom field class above accepts `value`/`text`, but this is
        // Blockly's own stock class, a different contract). So `def.defaults[f]` is NEVER consulted for ANY
        // dropdown-kind field on ANY block in the registry — only each field's OWN OPTION ORDER decides its
        // fresh-drag value. Fixing this in general (reordering every dropdown's own options to put its declared
        // default first) is an UNMEASURED, registry-wide blast radius — the exact class of mistake t2641's own
        // Part B just got burned by. Named here, left for its own turn, not guessed at under this turn's
        // narrower mandate.
        // ⭐ THE ONE INSTANCE FIXED HERE, contained: `feature_canvas.panel` — PANEL_TYPES' own key order (hence
        // `optionsFor`'s returned order, since it's `Object.keys(PANEL_TYPES)`) put `'form'` (viz:false, hides
        // the WHOLE visualization pane) first, so every freshly-dragged feature_canvas silently got the one
        // option that makes it look completely empty. This IS t2639's own blank-canvas dead end, confirmed live
        // (tests/panel-default-2643.spec.js): a fresh drag serialized PANEL='form'. Fixed by reordering THIS
        // field's own options only (not PANEL_TYPES itself, which other consumers — the Save dialog's <select>,
        // devMode.js — read in its own declared order for unrelated reasons) so 'form2d' (this block's own
        // declared default, featureCanvas.js) sorts first; every other option stays reachable, just reordered.
        else if (k === 'dropdown') {
            let opts = optionsFor(def, f).map((o) => Array.isArray(o) ? o : [o, o]);
            if (f === 'panel' && def.type === 'feature_canvas') {
                const i = opts.findIndex((o) => o[1] === def.defaults[f]);
                if (i > 0) opts = [opts[i], ...opts.slice(0, i), ...opts.slice(i + 1)];
            }
            args0.push({ type: 'field_dropdown', name: FN(f), options: opts, tooltip: desc });
        }
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
                    // t2393 (BACKLOG #48 item 1) — LIVE-CAUGHT REGRESSION from t2385's own fix, before it shipped
                    // a SECOND broken consumer: t2385 switched `getInput→getField` to fix INLINE fields (text/
                    // dropdown/checkbox, packed into one shared Input — getInput could never find them), but a
                    // plain NUMERIC field (holecycle's cols/dia/w/…, array's own cols/dx/dy/…) is an `input_value`
                    // SOCKET, not a Field at all — `getField(FN(f))` returns undefined for one, so `all.forEach`
                    // silently touched nothing for every value-socket field. Confirmed live: `array`'s own
                    // `dynamic:'pattern'` (the very first, pre-t2385 consumer of this mechanism, all-numeric
                    // fields) has been silently NOT hiding anything since t2385 shipped — undetected because
                    // nothing asserted per-field VISIBILITY for it, only round-trip/emit correctness, which this
                    // never touches. `getInput` is the correct reader for a socket (confirmed: `Input` has its
                    // own `setVisible`, the ORIGINAL pre-t2385 mechanism) — checking BOTH per field, in the order
                    // most fields actually are (inline fields outnumber sockets registry-wide), covers both
                    // shapes with the one shared loop instead of two mechanisms that each covered half.
                    // t2405 (BACKLOG #53) — every field in `all` now ALSO gets its own NAMED caption toggled in
                    // lockstep (jsonDef()'s own widened `dynamicGated` condition, see its header note) — the
                    // WIDGET-driven hide path was leaking a dangling caption exactly like the enabler path did
                    // before t2387, just never covered. One loop, both the value field/socket AND its label.
                    all.forEach((f) => {
                        const target = this.getField(FN(f)) || this.getInput(FN(f));
                        if (target) target.setVisible(show.has(FN(f)));
                        const lbl = this.getField(FN(f) + '_LBL');
                        if (lbl) lbl.setVisible(show.has(FN(f)));
                    });
                    // t2387 — the enabler fields' own NAMED caption (jsonDef()'s `_LBL` twin, see its own header
                    // note) toggles in LOCKSTEP with the value field it labels — a dangling "help" with no box
                    // next to it is exactly the bug this second line exists to prevent. Kept separate from the
                    // `all`-based loop above: a def with ONLY `enablers` (no `dynamic`/`fieldsFor`) has an empty
                    // `all`, so this is the only thing that reaches its own labels.
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
