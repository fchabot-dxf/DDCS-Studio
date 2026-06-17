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

const SELECTS = {
    corner: ['FL', 'FR', 'BL', 'BR'],
    probeSeq: ['XY', 'YX'],
    axis: ['X', 'Y', 'Z', 'A', 'B', 'C'],
    axisDir: ['pos', 'neg'],
    featureType: ['boss', 'pocket', 'bore'],
    wcs: ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59', 'G59P1', 'G59P2', 'G59P3', 'G59P4', 'G59P5', 'G59P6', 'G59P7', 'G59P8', 'G59P9', 'G59P10'],
    slave: [['A', '3'], ['B', '4'], ['C', '5']],
    atcMode: ['auto', 'manual'],
    testMode: ['current', 'all']
};
const catSlug = (c) => (c || 'Ops').toLowerCase().replace(/\s+/g, '');
export const FN = (field) => field.toUpperCase();   // Blockly input/field name from an op field
const REPORTER_CHECK = { boolean: 'Boolean', region: 'Region' };   // reporter return type → Blockly output check
const outputCheck = (def) => REPORTER_CHECK[def.returns] || 'Number';
export const isWrap = (def) => ['container', 'path', 'loop', 'cond', 'depth', 'fill'].includes(def.kind);
export const fieldsOf = (def, params) => (def.fieldsFor ? def.fieldsFor(params || def.defaults) : def.fields) || [];

const optionsFor = (def, field) =>
    field === 'op' ? (def.type === 'compare' ? ['<', '>', '<=', '>=', '==', '!='] : ['+', '-', '*', '/', '%'])
        : (SELECTS[field] || null);

/** Classify a field → how it renders in Blockly. */
export function fieldKind(def, field) {
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
        if (k === 'dropdown') args.push({ type: 'field_dropdown', name: FN(f), options: optionsFor(def, f).map((o) => [o, o]) });
        else if (k === 'checkbox') args.push({ type: 'field_checkbox', name: FN(f), checked: def.defaults[f] !== false });
        else if (k === 'text') args.push({ type: 'field_input', name: FN(f), text: String(def.defaults[f] ?? '') });
        else if (k === 'region') args.push({ type: 'input_value', name: FN(f), check: 'Region' });
        else if (k === 'boolean') args.push({ type: 'input_value', name: FN(f), check: 'Boolean' });
        else args.push({ type: 'input_value', name: FN(f), check: 'Number' });
    }
    if (isWrap(def)) { message += ` %${++n}`; args.push({ type: 'input_statement', name: 'DO' }); }
    const block = {
        type: def.type, message0: message, args0: args, inputsInline: true,
        style: catSlug(def.category) + '_style', tooltip: `${def.label} (${def.category})`,
    };
    if (def.kind === 'reporter') block.output = outputCheck(def);   // value block
    else { block.previousStatement = null; block.nextStatement = null; }   // statement block
    return block;
}

const makeOpDef = (type, label, msgAdd = '', argsAdd = []) => ({
    type: type,
    message0: `⬡ %1 ${msgAdd}`,
    args0: [
        { type: 'field_label_serializable', name: 'LABEL', text: label },
        ...argsAdd
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
    makeOpDef('text_op', 'Text', '')
];

/** Define every op as a Blockly block. (Emit happens via stackBridge → emitMapped, not a Blockly generator.) */
let _Blockly = null;
export const getBlockly = () => _Blockly;   // stackBridge needs the serialization API to render blocks (v11)
export function installBlockly(Blockly) {
    _Blockly = Blockly;
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
