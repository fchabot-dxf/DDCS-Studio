/**
 * blocks/blockly/bridge.js — derive the Blockly Blocks tab FROM the ops registry (single source of truth).
 *
 * For each CNC op (Move/Machine/Ops/Modify) we build a Blockly block def + a G-code generator that REUSES
 * the op's existing kernel (`def.emit` / `def.points`) — so the generator is the blockModel.emit fold in
 * Blockly's shape, not a rewrite. Control/Logic/Math/Variables come from Blockly's NATIVE blocks (the point
 * of adopting Blockly: its variable system, mutators, i18n) with G-code generators added here.
 *
 * Field → socket mapping mirrors the hand-rolled tab: selects → field_dropdown; name/text → field_input;
 * everything numeric → an input_value with a math_number SHADOW (default = the op's default) — i.e. a value
 * socket that shows an editable number but accepts a dropped reporter. Requires window.Blockly (vendored UMD).
 *
 * SCOPE NOTE (Phase 2): variables/loops/containers need static evaluation + point-stamping with dx/dy like
 * the emit fold. Leaf/Machine/Move/Ops generation is correct now; container/path/loop emit best-effort
 * (body once) and are marked TODO until the scope pass lands.
 */
import { PALETTE, evalExpr } from '../../wizards/ops/index.js';

// ---- field classification (mirrors blocksApp.js valueHTML) ----
const SELECTS = {
  pattern: ['grid', 'line', 'circle'], mode: ['rapid', 'cut', 'probe'], flow: ['flood', 'mist', 'off'],
  wcs: ['G54', 'G55', 'G56', 'G57', 'G58', 'G59'], dir: ['cw', 'ccw'], arc: ['ccw', 'cw'],
};
const TEXT_FIELDS = new Set(['name', 'var', 'text']);
const catSlug = (c) => (c || 'Ops').toLowerCase().replace(/\s+/g, '');
const FN = (field) => field.toUpperCase();   // Blockly input/field name from an op field
const optionsFor = (type, field) =>
  field === 'op' ? (type === 'compare' ? ['<', '>', '<=', '>=', '==', '!='] : ['+', '-', '*', '/', '%'])
    : (SELECTS[field] || null);
const fieldKind = (type, field) => optionsFor(type, field) ? 'dropdown' : TEXT_FIELDS.has(field) ? 'text' : 'value';

const CNC_KINDS = new Set(['leaf', 'move', 'container', 'path']);   // the ops we define ourselves (rest = native Blockly)
const cncDefs = () => PALETTE.filter((d) => CNC_KINDS.has(d.kind));
const fieldsOf = (def, params) => (def.fieldsFor ? def.fieldsFor(params || def.defaults) : def.fields);
const isWrap = (def) => def.kind === 'container' || def.kind === 'path';

// ---- build one Blockly JSON block def from an op def ----
function jsonDef(def) {
  const fields = fieldsOf(def);
  let message = def.label, n = 0;
  const args = [];
  for (const f of fields) {
    const k = fieldKind(def.type, f);
    message += ` ${f} %${++n}`;
    if (k === 'dropdown') args.push({ type: 'field_dropdown', name: FN(f), options: optionsFor(def.type, f).map((o) => [o, o]) });
    else if (k === 'text') args.push({ type: 'field_input', name: FN(f), text: String(def.defaults[f] ?? '') });
    else args.push({ type: 'input_value', name: FN(f), check: 'Number' });
  }
  if (isWrap(def)) { message += ` %${++n}`; args.push({ type: 'input_statement', name: 'DO' }); }   // the C-mouth
  return {
    type: def.type, message0: message, args0: args, inputsInline: true,
    previousStatement: null, nextStatement: null,
    style: catSlug(def.category) + '_style', tooltip: `${def.label} (${def.category})`,
  };
}

// ---- the G-code generator entry for an op def (reuses def.emit / def.points) ----
function makeGen(def, gen) {
  const ORDER = 0;
  gen.forBlock[def.type] = (block, g) => {
    const p = {};
    for (const f of fieldsOf(def)) {
      if (fieldKind(def.type, f) === 'value') {
        const code = g.valueToCode(block, FN(f), ORDER);
        let v = def.defaults[f];
        if (code !== '') { try { const n = evalExpr(code, Object.create(null)); v = isNaN(n) ? code : n; } catch { v = code; } }
        p[f] = v;
      } else p[f] = block.getFieldValue(FN(f));
    }
    if (def.kind === 'leaf' || def.kind === 'move') return def.emit(p, 0, 0).join('\n') + '\n';
    // container/path: shape is right; point-stamping with dx/dy is the Phase-2 scope pass
    const body = g.statementToCode(block, 'DO');
    return `( ${def.label}: ${fieldsOf(def).map((f) => `${f}=${p[f]}`).join(' ')} — TODO stamp )\n${body}`;
  };
}

// ---- native Blockly blocks → G-code (basic; static-eval scope is Phase 2) ----
const val = (g, b, name, d) => { const c = g.valueToCode(b, name, 0); return c === '' ? d : c; };
function installNatives(gen) {
  const O = 0;
  gen.forBlock['math_number'] = (b) => [String(b.getFieldValue('NUM')), O];
  gen.forBlock['math_arithmetic'] = (b, g) => {
    const op = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', POWER: '**' }[b.getFieldValue('OP')];
    return [`(${val(g, b, 'A', '0')} ${op} ${val(g, b, 'B', '0')})`, O];
  };
  gen.forBlock['logic_compare'] = (b, g) => {
    const op = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }[b.getFieldValue('OP')];
    return [`${val(g, b, 'A', '0')} ${op} ${val(g, b, 'B', '0')}`, O];
  };
  gen.forBlock['logic_operation'] = (b, g) => {
    const op = b.getFieldValue('OP') === 'AND' ? '&&' : '||';
    return [`${val(g, b, 'A', 'true')} ${op} ${val(g, b, 'B', 'true')}`, O];
  };
  gen.forBlock['logic_boolean'] = (b) => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', O];
  gen.forBlock['variables_get'] = (b) => [b.getField('VAR').getText(), O];
  gen.forBlock['variables_set'] = (b, g) => `( ${b.getField('VAR').getText()} = ${val(g, b, 'VALUE', '0')} )\n`;
  gen.forBlock['controls_if'] = (b, g) => `( if ${val(g, b, 'IF0', 'true')} )\n${g.statementToCode(b, 'DO0')}`;
  gen.forBlock['controls_repeat_ext'] = (b, g) => `( repeat ${val(g, b, 'TIMES', '0')} )\n${g.statementToCode(b, 'DO')}`;
}

/** Define all CNC blocks + a 'GCode' generator (CNC + native blocks). Returns the generator. */
export function installBlockly(Blockly) {
  Blockly.defineBlocksWithJsonArray(cncDefs().map(jsonDef));
  const gen = new Blockly.Generator('GCode');
  gen.ORDER_ATOMIC = 0;
  gen.scrub_ = function (block, code, thisOnly) {
    const next = block.nextConnection && block.nextConnection.targetBlock();
    return code + (thisOnly ? '' : gen.blockToCode(next));
  };
  cncDefs().forEach((def) => makeGen(def, gen));
  installNatives(gen);
  return gen;
}

/** A value input's shadow (an editable default number) for the toolbox. */
const shadow = (v) => ({ shadow: { type: 'math_number', fields: { NUM: Number(v) || 0 } } });

/** Build the colour-coded toolbox: CNC categories from the registry + native Control/Logic/Math/Variables. */
export function buildToolbox() {
  const byCat = {};
  cncDefs().forEach((def) => {
    const inputs = {};
    fieldsOf(def).forEach((f) => { if (fieldKind(def.type, f) === 'value') inputs[FN(f)] = shadow(def.defaults[f]); });
    (byCat[def.category] ||= []).push({ kind: 'block', type: def.type, ...(Object.keys(inputs).length ? { inputs } : {}) });
  });
  const cncCats = ['Move', 'Machine', 'Ops', 'Modify'].filter((c) => byCat[c]).map((c) => ({
    kind: 'category', name: c, categorystyle: catSlug(c) + '_cat', contents: byCat[c],
  }));
  const nativeCats = [
    { kind: 'category', name: 'Control', categorystyle: 'control_cat', contents: [
      { kind: 'block', type: 'controls_if' },
      { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: shadow(4) } } ] },
    { kind: 'category', name: 'Logic', categorystyle: 'control_cat', contents: [
      { kind: 'block', type: 'logic_compare' }, { kind: 'block', type: 'logic_operation' },
      { kind: 'block', type: 'logic_boolean' } ] },
    { kind: 'category', name: 'Math', categorystyle: 'math_cat', contents: [
      { kind: 'block', type: 'math_number', fields: { NUM: 0 } }, { kind: 'block', type: 'math_arithmetic' } ] },
    { kind: 'category', name: 'Variables', categorystyle: 'variables_cat', custom: 'VARIABLE' },
  ];
  return { kind: 'categoryToolbox', contents: [...cncCats, ...nativeCats] };
}
