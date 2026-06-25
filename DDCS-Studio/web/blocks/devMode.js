/**
 * blocks/devMode.js — the Blocks-tab DEV (authoring) mode: the keystone of the wizard-maker.
 *
 * Form / Block / Editor all EDIT an op. Dev mode is the only rung that DEFINES one: a floating toggle turns the
 * block view into an authoring surface where each atom's numeric values grow an inline "▸ expose … as …" row
 * (standard Blockly fields, so the block itself draws it). Tick the values you want as knobs, name them, name the
 * op, and "Save as custom op" registers a reusable custom wizard (template + bindings) into the library + bar —
 * the fork-the-5%-delta flow that stages 1–5 built the machinery for.
 *
 * Exposure rule (from the density taxonomy): the candidates are NUMERIC value fields (fieldKind 'value' = a
 * math_number socket) — which is exactly the `tuning` role (feed/depth/count/offset/…). Normal mode is untouched.
 *
 * Blockly v13 notes (see vendor/blockly/API-NOTES.md): augment inside Events.disable()/enable() so the workspace
 * change listener doesn't reproject the dev-only fields away; flush with renderManagement.triggerQueuedRenders().
 * The dev fields (EXPOSE_ / PNAME_ prefixes) aren't in fieldsOf(def), so stackBridge.toRecord ignores them — they
 * never pollute the op's params or the emitted G-code.
 */
import { BLOCKS } from '../wizards/ops/index.js';
import { fieldKind, fieldsOf, FN } from './blockly/bridge.js';
import { userOpFromStack, listUserOps, USER_OP_PREFIX, flattenBlocks } from './userOps.js';
import { createWizard } from './wizardLibrary.js';
import { workspaceToStack } from './blockly/stackBridge.js';

// op-children flatten reuses userOps.flattenBlocks so binding.blockIndex shares ONE definition with the registry.
// pre-order walk of the op-container's atom blocks (DO chain + nested DO) — aligns 1:1 with flattenBlocks(op.children).
function preorderAtoms(first, out = []) {
    for (let b = first; b; b = b.getNextBlock()) {
        out.push(b);
        const doIn = b.getInput('DO');
        const child = doIn && doIn.connection && doIn.connection.targetBlock();
        if (child) preorderAtoms(child, out);
    }
    return out;
}
// the numeric (math_number socket) fields on a leaf/wrap atom block — the exposable params.
function numericFields(block) {
    const def = BLOCKS[block.type];
    if (!def) return [];
    return fieldsOf(def).filter((f) => fieldKind(def, f) === 'value');
}
function isAtom(blk) {
    return blk && !blk.isShadow() && blk.type !== 'op' && !blk.type.endsWith('_op') && blk.type !== 'progstart' && blk.type !== 'progend';
}

// the widget a numeric exposure renders as in the form (the form-widget registry keys; numeric-compatible only).
// number/slider are single-param; xy-pad/rect are MULTI-param — exposures that pick them group by order (see
// buildBindings): xy-pad in pairs (x,y), rect in fours (x,y,w,h). Leftovers fall back to a plain number.
const WIDGET_CHOICES = [['#', 'number'], ['slider', 'slider'], ['xy', 'xy-pad'], ['rect', 'rect']];

// Read the ticked exposures off the LIVE workspace → { opRec, exposures, varErr }. opRec is the active op (live
// params); exposures are { param, blockIndex, key, default, widget } in pre-order; varErr names the first exposed
// field that has a #var/expression plugged in (not a plain number) so the caller can refuse.
function collectAuthoring(ws) {
    const stack = workspaceToStack(ws);
    const opRec = stack.find((b) => b && b.type === 'op');
    if (!opRec || !(opRec.children || []).length) return null;
    const flat = flattenBlocks(opRec.children);
    const opBlk = ws.getAllBlocks().find((b) => b.type === 'op' || b.type.endsWith('_op'));
    const doIn = opBlk && opBlk.getInput('DO');
    const first = doIn && doIn.connection && doIn.connection.targetBlock();
    const atomBlocks = first ? preorderAtoms(first) : [];                                  // aligns index-for-index with flat
    const exposures = [], used = new Set();
    let varErr = null;
    atomBlocks.forEach((blk, i) => {
        const rec = flat[i];
        if (!rec || !rec.params) return;
        for (const f of numericFields(blk)) {
            if (blk.getFieldValue('EXPOSE_' + FN(f)) !== 'TRUE') continue;
            if (typeof rec.params[f] !== 'number') { if (!varErr) varErr = f; continue; }   // a #var/expression got plugged in
            let pname = (blk.getFieldValue('PNAME_' + FN(f)) || f).trim().replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '') || f;
            if (used.has(pname)) { let k = 2; while (used.has(pname + '_' + k)) k++; pname += '_' + k; }
            used.add(pname);
            exposures.push({ param: pname, blockIndex: i, key: f, default: rec.params[f], widget: blk.getFieldValue('WIDGET_' + FN(f)) || 'number' });
        }
    });
    return { opRec, exposures, varErr };
}

// Turn exposures into bindings. Single-param widgets (number/slider) → one binding each. Multi-param canvas
// pickers (xy-pad/rect) → group by ORDER of appearance: xy-pad in pairs (roles x,y), rect in fours (x,y,w,h);
// the group's first binding carries the widget. An incomplete trailing group degrades to plain numbers.
function buildBindings(exposures) {
    const out = [], pools = { 'xy-pad': [], rect: [] };
    const plain = (e) => ({ param: e.param, blockIndex: e.blockIndex, key: e.key, type: 'number', default: e.default, label: e.param });
    for (const e of exposures) {
        if (e.widget === 'xy-pad' || e.widget === 'rect') pools[e.widget].push(e);
        else out.push(e.widget && e.widget !== 'number' ? { ...plain(e), widget: e.widget } : plain(e));
    }
    let gi = 0;
    const group = (pool, size, roles, widget) => {
        let i = 0;
        for (; i + size <= pool.length; i += size) {
            const gid = 'g' + (++gi);
            for (let r = 0; r < size; r++) {
                const bnd = { ...plain(pool[i + r]), group: gid, role: roles[r] };
                if (r === 0) bnd.widget = widget;
                out.push(bnd);
            }
        }
        for (; i < pool.length; i++) out.push(plain(pool[i]));                              // leftover → plain number
    };
    group(pools['xy-pad'], 2, ['x', 'y'], 'xy-pad');
    group(pools.rect, 4, ['x', 'y', 'w', 'h'], 'rect');
    return out;
}

let _on = false, _ws = null, _B = null, _toggle = null, _panel = null, _nameInput = null;

export function isDevMode() { return _on; }

/** Mount the floating dev toggle + save panel into the canvas host. Returns { onModelRender } for blocksApp. */
export function mountDevMode(ws, B, hostEl) {
    _ws = ws; _B = B;

    _toggle = document.createElement('button');
    _toggle.type = 'button';
    _toggle.className = 'blk-dev-toggle';
    _toggle.title = 'Author mode — expose values as parameters and save this op as a reusable custom wizard';
    _toggle.textContent = '🛠 Dev';
    _toggle.addEventListener('click', () => setDevMode(!_on));

    _panel = document.createElement('div');
    _panel.className = 'blk-dev-panel';
    _panel.hidden = true;
    _panel.innerHTML = `
        <div class="blk-dev-hint">Tick the values to expose as knobs and pick a widget for each, then Save as custom wizard. (You can also save anytime from the ⌄ menu — dev mode is only for adding knobs.)</div>
        <label class="blk-dev-name">Wizard name <input type="text" class="blk-dev-opname" placeholder="my corner probe" /></label>
        <label class="blk-dev-name">Panel <select class="blk-dev-paneltype">
            <option value="form3d">Form + 3D preview</option>
            <option value="form2d">Form + 2D layout</option>
            <option value="form">Form only</option>
        </select></label>
        <button type="button" class="blk-dev-save">Save as custom wizard</button>`;
    _nameInput = _panel.querySelector('.blk-dev-opname');
    _panel.querySelector('.blk-dev-save').addEventListener('click', () => saveAsCustomOp());

    // Saving a wizard = registering the current op's stack as a bar button (+ its form). NOT gated behind dev mode —
    // the ⌄ quick menu calls this too (with no exposures it saves a parameterless wizard; add knobs later in dev mode).
    if (typeof window !== 'undefined') window.ddcsSaveAsWizard = () => saveAsCustomOp();

    hostEl.append(_toggle, _panel);
    return { onModelRender: () => { if (_on) augment(); } };
}

export function setDevMode(on) {
    _on = !!on;
    if (_toggle) _toggle.classList.toggle('active', _on);
    if (_panel) _panel.hidden = !_on;
    if (_on) augment(); else clearAugment();
}

// grow each atom with an inline "▸ expose <field> as <name>" row per numeric value (Events.disable → no reproject).
function augment() {
    const B = _B, ws = _ws;
    if (!ws) return;
    B.Events.disable();
    try {
        for (const blk of ws.getAllBlocks()) {
            if (!isAtom(blk)) continue;
            for (const f of numericFields(blk)) {
                const inputName = 'DECL_' + FN(f);
                if (blk.getInput(inputName)) continue;                                   // idempotent
                const valIn = blk.getInput(FN(f));
                const tgt = valIn && valIn.connection && valIn.connection.targetBlock();
                if (!tgt || !tgt.isShadow()) continue;                                    // only plain-number sockets are exposable
                blk.appendDummyInput(inputName)
                    .appendField('▸ expose')
                    .appendField(new B.FieldCheckbox('FALSE'), 'EXPOSE_' + FN(f))
                    .appendField(f + ' as')
                    .appendField(new B.FieldTextInput(f), 'PNAME_' + FN(f))
                    .appendField(new B.FieldDropdown(WIDGET_CHOICES), 'WIDGET_' + FN(f));   // how it renders in the form
            }
            if (blk.queueRender) blk.queueRender();
        }
    } finally { B.Events.enable(); }
    try { if (B.renderManagement) B.renderManagement.triggerQueuedRenders(); } catch (_) { /* */ }
}

function clearAugment() {
    const B = _B, ws = _ws;
    if (!ws) return;
    B.Events.disable();
    try {
        for (const blk of ws.getAllBlocks()) {
            if (!isAtom(blk)) continue;
            for (const f of numericFields(blk)) {
                const inputName = 'DECL_' + FN(f);
                if (blk.getInput(inputName)) { try { blk.removeInput(inputName); } catch (_) { /* */ } }
            }
            if (blk.queueRender) blk.queueRender();
        }
    } finally { B.Events.enable(); }
    try { if (B.renderManagement) B.renderManagement.triggerQueuedRenders(); } catch (_) { /* */ }
}

// Register the current op's STACK as a custom WIZARD — a bar button (+ its form). Reads the ticked exposures (if any)
// → bindings → userOpFromStack → createWizard (into the library + bar). Works with OR without dev mode: no exposures
// just means a parameterless wizard (add knobs later in dev mode). Called by the dev panel + the ⌄ quick menu.
function saveAsCustomOp() {
    if (!_ws) { alert('Open an op in the Blocks tab first, then save it as a wizard.'); return; }
    // Read the LIVE workspace, not the model: Blockly v13 batches change events (FIRE_QUEUE / setTimeout 0), so a value
    // edited right before Save hasn't reprojected yet (collectAuthoring uses workspaceToStack, which ignores the
    // dev-only EXPOSE_/PNAME_/WIDGET_ fields and whose pre-order matches preorderAtoms).
    const a = collectAuthoring(_ws);
    if (!a) { alert('No op to save — insert an op in Blocks first.'); return; }
    if (a.varErr) { alert(`The exposed value “${a.varErr}” has a variable or expression plugged in — a knob must be a plain number. Restore a number on that block, then save again.`); return; }

    // Name: the dev panel field if it has one, else ASK — so the ⌄ menu can save with no dev panel open.
    let name = (_nameInput && _nameInput.value || '').trim();
    if (!name) name = (window.prompt('Name this wizard (it becomes a button in the bar):', '') || '').trim();
    if (!name) return;   // cancelled

    const bindings = buildBindings(a.exposures);
    if (!bindings.length && !confirm('No knobs exposed — save as a fixed wizard (a bar button with no parameters)?')) return;

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'wizard';
    const existing = new Set(listUserOps().map((d) => d.opType));
    let type = slug, n = 2; while (existing.has(USER_OP_PREFIX + type)) type = slug + '_' + (n++);

    const psel = _panel && _panel.querySelector('.blk-dev-paneltype');
    const panel = (psel && psel.value) || 'form3d';
    try {
        createWizard(userOpFromStack(type, name, a.opRec.children, bindings, panel));
    } catch (e) { console.warn('save wizard failed', e); alert('Save failed: ' + ((e && e.message) || e)); return; }

    if (window.ddcsRefreshWizardBar) window.ddcsRefreshWizardBar();
    if (_on) setDevMode(false);
    if (_nameInput) _nameInput.value = '';
    alert(`Saved “${name}” — it's now a button in the bar (Custom)${bindings.length ? ` with ${bindings.length} knob${bindings.length === 1 ? '' : 's'}` : ''}.`);
}
