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
import { installCornerGridField } from './cornerGridField.js';
import { installRegionPickField } from './regionPickField.js';
import { installCoordListField } from './coordListField.js';
import { CANVAS_ROLE_WIDGETS } from '../userOps.js';   // the ONE role-encoded widget list (shared with dev-mode; consumed lazily below → cycle-safe)

// Fields that render as the inline 3×3 corner-grid picker (field_cornergrid), tinted per datum so PlaceOnStock's
// stock-attach (blue) and path-datum (amber) glyphs read apart — matching the 2D canvas pickers.
const CORNER_COLOUR = { stockAttach: '#4ab3ff', pathDatum: '#ffcf3a' };
const SELECTS = {
    corner: ['FL', 'FR', 'BL', 'BR'],
    probeSeq: ['XY', 'YX'],
    axis: ['X', 'Y', 'Z', 'A', 'B', 'C'],
    axisDir: ['pos', 'neg'],
    featureType: ['boss', 'pocket', 'bore'],
    wcs: ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59', 'G59P1', 'G59P2', 'G59P3', 'G59P4', 'G59P5', 'G59P6', 'G59P7', 'G59P8', 'G59P9', 'G59P10'],
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
    order: ['outside-in', 'inside-out'],             // concentric-fill ring order
    strategy: ['parallel', 'concentric'],            // step-over pass strategy
    // SIM-START (per-pass preview start, the simstart authoring block — B3). The Option-A vocabulary as dropdowns.
    anchor: ['centre', 'edge', 'frac', 'radial'],    // where this pass begins relative to the stock
    wall: ['@dir1', '@dir2', 'min', 'max'],          // edge anchor: which wall side (@token follows the op's dir param, or a fixed min/max)
    sign: ['+', '-'],                                // radial anchor: which side of centre
    zplane: ['probe', 'top', '@flank'],              // probe height: into the stock / above the top / the bar centreline (-R)
};
const catSlug = (c) => (c || 'Ops').toLowerCase().replace(/[^a-z0-9]+/g, '');   // slug = alphanumerics only (so "Spindle & Feed" → spindlefeed, "Wizard UI" → wizardui)
export const FN = (field) => field.toUpperCase();   // Blockly input/field name from an op field
const REPORTER_CHECK = { boolean: 'Boolean', region: 'Region' };   // reporter return type → Blockly output check
const outputCheck = (def) => REPORTER_CHECK[def.returns] || 'Number';
export const isWrap = (def) => ['container', 'path', 'loop', 'cond', 'depth', 'fill', 'place', 'rotate'].includes(def.kind);
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
    anchor: "Where this preview pass begins: centre / edge (a wall) / frac (a fraction of the stock) / radial (offset from centre)",
    wall: "Edge anchor: which wall side — @dir1/@dir2 follow the op's direction param, or a fixed min/max",
    out: "Stand-off distance outside the wall (a number, or @outset = the op's standard approach)",
    rad: "Radial offset from centre (a number, or @R = the bar radius)",
    zplane: "Probe height: probe (into the stock) / top (above) / @flank (the bar centreline, -R)",
    whenparam: "Optional gate: this pass only exists when this op param matches (the conditional pass count)",
    whenis: "Gate value the param must equal (true / false / a string)"
};
const getDesc = (f) => DESCRIPTIONS[f.toLowerCase()] || `The ${f} parameter`;

const optionsFor = (def, field) => {
    if (field === 'op') return (def.type === 'compare' || def.type === 'ifgoto') ? ['<', '>', '<=', '>=', '==', '!='] : ['+', '-', '*', '/', '%'];
    if (field === 'mode') {
        if (def.type === 'pathmode') return ['blend', 'exact'];
        if (def.type === 'waitinput') return ['imm', 'rise', 'fall', 'high', 'low'];
        if (def.type === 'move') return ['cut', 'rapid', 'probe'];
    }
    // numeric-socket widgets (all commit a number). The role-encoded widgets fold a ROLE into the value (decoded by
    // userOps.decodeCanvasWidget) so the role is DECLARED, not inferred from pool order (audit #6-B): "XY pad / Rect"
    // = a form mini-canvas; "2D point / 2D rect" = plain number fields the Form+2D preview makes drag-to-edit. ONE
    // source of truth: spread the canonical CANVAS_ROLE_WIDGETS (also feeds the dev-mode dropdown) so the two author
    // surfaces can't drift. (The import closes a benign cycle — this list is read lazily here, never at module-eval.)
    if (field === 'widget' && def.type === 'param') return ['number', 'slider', 'dropdown', 'toggle', ...CANVAS_ROLE_WIDGETS];
    if (field === 'panel' && def.type === 'panel') return ['form3d', 'form2d', 'form'];   // the GUI panel-type declaration
    if (field === 'kind' && def.type === 'layout') return ['none', 'corner'];
    return SELECTS[field] || null;
};

/** Classify a field → how it renders in Blockly. */
export function fieldKind(def, field) {
    if (def.type === 'regionpick' && field === 'value') return 'regionpick';   // the region-pick control's value → inline picker
    if (def.type === 'coordlist' && field === 'pts') return 'coordlist';        // the coordinate-list → inline positions preview
    if (CORNER_COLOUR[field]) return 'cornergrid';   // PlaceOnStock attach / path-datum → inline 3×3 picker
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
    const args0 = [];
    // t146 — HEADER ROW (message0): the block's label + its inline fields. Statement-input MOUTHS go on their OWN rows
    // BELOW (message1/message2 via addMouth) so the label never sits beside the mouth (which shoved nested blocks right
    // + widened the block) → the block collapses to CONTENT WIDTH, nested content starts hard-left. The item-b separator-
    // header pattern, GENERALIZED in the shared builder to EVERY C-mouth kind. Authoring layout only — emit is untouched.
    // The `section` block shows JUST its title (no "Section title" prefix): drop the label + the field-name for it.
    let message0 = isSection ? '' : def.label, n = 0;
    for (const f of fieldsOf(def)) {
        const k = fieldKind(def, f);
        message0 += isSection ? ` %${++n}` : ` ${f} %${++n}`;
        const desc = getDesc(f);
        if (k === 'cornergrid') args0.push({ type: 'field_cornergrid', name: FN(f), value: String(def.defaults[f] ?? ''), colour: CORNER_COLOUR[f], tooltip: desc });
        else if (k === 'regionpick') args0.push({ type: 'field_regionpick', name: FN(f), value: String(def.defaults[f] ?? 0), tooltip: desc });
        else if (k === 'coordlist') args0.push({ type: 'field_coordlist', name: FN(f), value: String(def.defaults[f] ?? '{"points":[],"z":0}'), tooltip: desc });
        else if (k === 'dropdown') args0.push({ type: 'field_dropdown', name: FN(f), options: optionsFor(def, f).map((o) => Array.isArray(o) ? o : [o, o]), tooltip: desc });
        else if (k === 'checkbox') args0.push({ type: 'field_checkbox', name: FN(f), checked: def.defaults[f] !== false, tooltip: desc });
        else if (k === 'text') args0.push({ type: 'field_input', name: FN(f), text: String(def.defaults[f] ?? ''), tooltip: desc });
        else if (k === 'region') args0.push({ type: 'input_value', name: FN(f), check: 'Region', tooltip: desc });
        else if (k === 'boolean') args0.push({ type: 'input_value', name: FN(f), check: 'Boolean', tooltip: desc });
        else args0.push({ type: 'input_value', name: FN(f), check: 'Number', tooltip: desc });
    }
    const block = {
        type: def.type, message0: message0.trim() || def.label, args0, inputsInline: true,
        style: catSlug(def.category) + '_style', tooltip: `${def.label} (${def.category})`,
    };
    // t146 — each statement-input MOUTH on its OWN row below the header (message1, message2, …), with an optional
    // sub-label. Generalized: user_root's 2 mouths, param_group + section's DO, and every isWrap kind's DO.
    let row = 1;
    const addMouth = (name, sub) => { block['message' + row] = (sub ? sub + ' ' : '') + '%1'; block['args' + row] = [{ type: 'input_statement', name }]; row++; };
    if (def.kind === 'user_root') { addMouth('PRESENTATION', 'Presentation (UI & Sim)'); addMouth('EXECUTION', 'Execution (G-code)'); }
    else if (def.kind === 'param_group' || isSection) addMouth('DO');
    else if (isWrap(def)) addMouth('DO');
    if (def.dynamic) block.extensions = ['ddcs_dynfields'];   // toggle pattern-specific inputs per the `dynamic` field
    if (isSection) block.extensions = [...(block.extensions || []), 'ddcs_seccolor'];   // t132 — per-instance concern colour from data.color (authoring-only, never emitted)
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
    message1: 'GCODE %1',
    args1: [ { type: 'input_statement', name: 'GCODE' } ],
    message2: 'SIM %1',
    args2: [ { type: 'input_statement', name: 'SIM' } ],
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

// Dynamic block extension: show only the fields the current `dynamic` value calls for (e.g. array → only the
// chosen pattern's fields). Degrades safely — if anything throws, all fields stay visible (still editable).
function registerDynExtension(Blockly) {
    try {
        Blockly.Extensions.register('ddcs_dynfields', function () {
            const def = DEF_BY_TYPE[this.type];
            if (!def || !def.dynamic || !def.fieldsFor) return;
            const all = def.allFields || [];
            const apply = () => {
                try {
                    const params = { ...def.defaults, [def.dynamic]: this.getFieldValue(FN(def.dynamic)) };
                    const show = new Set(def.fieldsFor(params).map(FN));
                    all.forEach((f) => { const inp = this.getInput(FN(f)); if (inp) inp.setVisible(show.has(FN(f))); });
                    if (this.rendered) { if (this.queueRender) this.queueRender(); else if (this.render) this.render(); }
                } catch (e) { /* degrade to all-fields-visible */ }
            };
            this.setOnChange(function () {
                if (this.isInFlyout || !this.workspace) return;
                const v = this.getFieldValue(FN(def.dynamic));
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
            self.setOnChange(function () { if (!self._ddcsSecColored) apply(); });   // fallback until it lands
        });
    } catch (e) { /* already registered */ }
}

export function installBlockly(Blockly) {
    _Blockly = Blockly;
    installCornerGridField(Blockly);   // register field_cornergrid BEFORE the blocks that reference it
    installRegionPickField(Blockly);   // register field_regionpick (the region-pick control's block adapter)
    installCoordListField(Blockly);    // register field_coordlist (the coordinate-list positions preview)
    registerDynExtension(Blockly);
    registerSecColorExtension(Blockly);
    Blockly.defineBlocksWithJsonArray([...PALETTE.map(jsonDef), ...OP_BLOCKS]);
}

/** A value input's shadow (an editable default number) for the toolbox. */
const shadow = (v) => ({ shadow: { type: 'math_number', fields: { NUM: Number(v) || 0 } } });

/** The colour-coded toolbox: one category per ops CATEGORY, blocks derived from the registry. `extraCategories`
 *  (caller-supplied, e.g. the learner-library Snippets / Complete Programs groups) are appended after the ops cats —
 *  injected by the caller so this low-level module needn't import the higher-level stack→flyout converter (cycle). */
export function buildToolbox(extraCategories = []) {
    const byCat = {};
    PALETTE.forEach((def) => {
        const inputs = {};
        fieldsOf(def).forEach((f) => { if (fieldKind(def, f) === 'value') inputs[FN(f)] = shadow(def.defaults[f]); });
        (byCat[def.category] ||= []).push({ kind: 'block', type: def.type, ...(Object.keys(inputs).length ? { inputs } : {}) });
    });
    const cats = CATEGORIES.filter((c) => byCat[c]).map((c) => ({
        kind: 'category', name: c, categorystyle: catSlug(c) + '_cat', contents: byCat[c],
    }));
    // Tree sidebar: the per-category atom blocks live under a collapsible "⚛ Atoms" parent; the caller's groups
    // (the learner library — Snippets / Complete Programs) are siblings. So the rail reads Atoms · Snippets · Programs.
    const atoms = { kind: 'category', name: '⚛ Atoms', expanded: 'true', contents: cats };
    return { kind: 'categoryToolbox', contents: [atoms, ...(extraCategories || [])] };
}
