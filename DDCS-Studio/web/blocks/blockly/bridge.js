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
    pattern: ['grid', 'line', 'circle', 'rect'], mode: ['rapid', 'cut', 'probe'], flow: ['flood', 'mist', 'off'],
    wcs: ['G54', 'G55', 'G56', 'G57', 'G58', 'G59'], dir: ['cw', 'ccw'], arc: ['ccw', 'cw'],
    shape: ['rect', 'circle', 'polygon', 'ellipse'], strategy: ['parallel', 'concentric'], direction: ['bothways', 'oneway', 'otherway'],
    order: ['outside-in', 'inside-out'],   // Fill Concentric ring order (kept off 'direction' to avoid a dropdown clash)
    dist: ['abs', 'inc'], axis: ['X', 'Y', 'Z', 'A'], end: ['M30', 'M2'], method: ['peck', 'helical'],
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

// The op-CONTAINER block (not an op atom — not in PALETTE/toolbox). A recorded op { opType, requires, params,
// children } shown as a labelled group with a DO mouth holding its atoms. opType/requires/params round-trip via
// the block's serialized `data` (a JSON blob); the LABEL field shows + serializes the op name. Editing the op's
// params is done via its wizard form, not Blockly fields — so they ride along opaquely. Caps-gated at emit.
const OP_BLOCK_DEF = {
    type: 'op',
    message0: '⬡ %1 %2',
    args0: [
        { type: 'field_label_serializable', name: 'LABEL', text: 'op' },
        { type: 'input_statement', name: 'DO' },
    ],
    previousStatement: null, nextStatement: null,
    colour: 210,
    tooltip: 'Recorded op — edit via its wizard; emitted per the active post (caps-gated).',
};

/** Define every op as a Blockly block. (Emit happens via stackBridge → emitMapped, not a Blockly generator.) */
let _Blockly = null;
export const getBlockly = () => _Blockly;   // stackBridge needs the serialization API to render blocks (v11)
export function installBlockly(Blockly) {
    _Blockly = Blockly;
    Blockly.defineBlocksWithJsonArray([...PALETTE.map(jsonDef), OP_BLOCK_DEF]);
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
