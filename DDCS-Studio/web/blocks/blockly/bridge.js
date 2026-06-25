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
    side: ['outside', 'inside', 'on']                // contour/profile cutter side
};
const catSlug = (c) => (c || 'Ops').toLowerCase().replace(/\s+/g, '');
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
    ramp: "Bore stepdown: step (plunge + flat circle) or helix (linearized G1 ramp)"
};
const getDesc = (f) => DESCRIPTIONS[f.toLowerCase()] || `The ${f} parameter`;

const optionsFor = (def, field) => {
    if (field === 'op') return (def.type === 'compare' || def.type === 'ifgoto') ? ['<', '>', '<=', '>=', '==', '!='] : ['+', '-', '*', '/', '%'];
    if (field === 'mode') {
        if (def.type === 'pathmode') return ['blend', 'exact'];
        if (def.type === 'waitinput') return ['imm', 'rise', 'fall', 'high', 'low'];
        if (def.type === 'move') return ['cut', 'rapid', 'probe'];
    }
    if (field === 'widget' && def.type === 'param') return ['number', 'slider'];   // numeric-socket widgets (more come with grouping / B)
    return SELECTS[field] || null;
};

/** Classify a field → how it renders in Blockly. */
export function fieldKind(def, field) {
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

/** One Blockly JSON block def from an op def. */
function jsonDef(def) {
    const args = [];
    let message = def.label, n = 0;
    for (const f of fieldsOf(def)) {
        const k = fieldKind(def, f);
        message += ` ${f} %${++n}`;
        const desc = getDesc(f);
        if (k === 'cornergrid') args.push({ type: 'field_cornergrid', name: FN(f), value: String(def.defaults[f] ?? ''), colour: CORNER_COLOUR[f], tooltip: desc });
        else if (k === 'dropdown') args.push({ type: 'field_dropdown', name: FN(f), options: optionsFor(def, f).map((o) => Array.isArray(o) ? o : [o, o]), tooltip: desc });
        else if (k === 'checkbox') args.push({ type: 'field_checkbox', name: FN(f), checked: def.defaults[f] !== false, tooltip: desc });
        else if (k === 'text') args.push({ type: 'field_input', name: FN(f), text: String(def.defaults[f] ?? ''), tooltip: desc });
        else if (k === 'region') args.push({ type: 'input_value', name: FN(f), check: 'Region', tooltip: desc });
        else if (k === 'boolean') args.push({ type: 'input_value', name: FN(f), check: 'Boolean', tooltip: desc });
        else args.push({ type: 'input_value', name: FN(f), check: 'Number', tooltip: desc });
    }
    if (isWrap(def)) { message += ` %${++n}`; args.push({ type: 'input_statement', name: 'DO' }); }
    const block = {
        type: def.type, message0: message, args0: args, inputsInline: true,
        style: catSlug(def.category) + '_style', tooltip: `${def.label} (${def.category})`,
    };
    if (def.dynamic) block.extensions = ['ddcs_dynfields'];   // toggle pattern-specific inputs per the `dynamic` field
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
    message1: '%1',
    args1: [ { type: 'input_statement', name: 'DO' } ],
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
    makeOpDef('middle_op', 'Middle Probe', 'Type %2 Axis %3 Dir %4 %5 2-Axis Dir2 %6 WCS %7 Sync %8 Slave %9 Stop %10', [
        { type: 'field_dropdown', name: 'FEATURETYPE', options: SELECTS.featureType.map(o => [o, o]) },
        { type: 'field_dropdown', name: 'AXIS', options: SELECTS.axis.map(o => [o, o]) },
        { type: 'field_dropdown', name: 'DIR1', options: SELECTS.axisDir.map(o => [o, o]) },
        { type: 'field_checkbox', name: 'TWOAXIS', checked: false },
        { type: 'field_dropdown', name: 'DIR2', options: SELECTS.axisDir.map(o => [o, o]) },
        { type: 'field_dropdown', name: 'WCS', options: SELECTS.wcs.map(o => [o, o]) },
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

export function installBlockly(Blockly) {
    _Blockly = Blockly;
    installCornerGridField(Blockly);   // register field_cornergrid BEFORE the blocks that reference it
    registerDynExtension(Blockly);
    Blockly.defineBlocksWithJsonArray([...PALETTE.map(jsonDef), ...OP_BLOCKS]);
}

/** A value input's shadow (an editable default number) for the toolbox. */
const shadow = (v) => ({ shadow: { type: 'math_number', fields: { NUM: Number(v) || 0 } } });

/** The colour-coded toolbox: one category per ops CATEGORY, blocks derived from the registry. */
export function buildToolbox() {
    const byCat = {};
    PALETTE.forEach((def) => {
        const inputs = {};
        fieldsOf(def).forEach((f) => { if (fieldKind(def, f) === 'value') inputs[FN(f)] = shadow(def.defaults[f]); });
        (byCat[def.category] ||= []).push({ kind: 'block', type: def.type, ...(Object.keys(inputs).length ? { inputs } : {}) });
    });
    const cats = CATEGORIES.filter((c) => byCat[c]).map((c) => ({
        kind: 'category', name: c, categorystyle: catSlug(c) + '_cat', contents: byCat[c],
    }));
    return { kind: 'categoryToolbox', contents: cats };
}
