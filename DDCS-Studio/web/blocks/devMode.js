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
        <div class="blk-dev-hint">Tick the values to expose as knobs, name each, then save this op as a reusable custom wizard.</div>
        <label class="blk-dev-name">Op name <input type="text" class="blk-dev-opname" placeholder="my corner probe" /></label>
        <button type="button" class="blk-dev-save">Save as custom op</button>`;
    _nameInput = _panel.querySelector('.blk-dev-opname');
    _panel.querySelector('.blk-dev-save').addEventListener('click', () => saveAsCustomOp());

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
                    .appendField(new B.FieldTextInput(f), 'PNAME_' + FN(f));
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

// read the ticked exposures off the live blocks → bindings → userOpFromStack → createWizard (into library + bar).
function saveAsCustomOp() {
    const ws = _ws;
    const name = (_nameInput.value || '').trim();
    if (!name) { alert('Name the custom op first.'); _nameInput.focus(); return; }

    // Read the LIVE workspace, not the model: Blockly v13 batches change events (FIRE_QUEUE / setTimeout 0), so a value
    // edited right before Save hasn't reprojected into the model yet. workspaceToStack ignores the dev-only fields (not
    // in fieldsOf) → a clean stack, and its pre-order matches preorderAtoms below.
    const stack = workspaceToStack(ws);
    const opRec = stack.find((b) => b && b.type === 'op');                                // the active op (live params)
    if (!opRec || !(opRec.children || []).length) { alert('No op to author here — insert an op first, then open Dev mode.'); return; }
    const flat = flattenBlocks(opRec.children);

    const opBlk = ws.getAllBlocks().find((b) => b.type === 'op' || b.type.endsWith('_op'));
    const doIn = opBlk && opBlk.getInput('DO');
    const first = doIn && doIn.connection && doIn.connection.targetBlock();
    const atomBlocks = first ? preorderAtoms(first) : [];                                  // aligns index-for-index with flat

    const bindings = [], used = new Set();
    atomBlocks.forEach((blk, i) => {
        const rec = flat[i];
        if (!rec || !rec.params) return;
        for (const f of numericFields(blk)) {
            if (blk.getFieldValue('EXPOSE_' + FN(f)) !== 'TRUE') continue;
            if (typeof rec.params[f] !== 'number') {                                       // a #var/expression got plugged in
                alert(`The exposed value “${f}” has a variable or expression plugged in — a parameter must be a plain number. Restore a number on that block, then save again.`);
                return;
            }
            let pname = (blk.getFieldValue('PNAME_' + FN(f)) || f).trim().replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '') || f;
            if (used.has(pname)) { let k = 2; while (used.has(pname + '_' + k)) k++; pname += '_' + k; }
            used.add(pname);
            bindings.push({ param: pname, blockIndex: i, key: f, type: 'number', default: rec.params[f], label: pname });
        }
    });
    if (!bindings.length && !confirm('No values are exposed — save as a fixed op with no parameters?')) return;

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'op';
    const existing = new Set(listUserOps().map((d) => d.opType));
    let type = slug, n = 2; while (existing.has(USER_OP_PREFIX + type)) type = slug + '_' + (n++);

    try {
        createWizard(userOpFromStack(type, name, opRec.children, bindings));
    } catch (e) { console.warn('save custom op failed', e); alert('Save failed: ' + ((e && e.message) || e)); return; }

    if (window.ddcsRefreshWizardBar) window.ddcsRefreshWizardBar();
    setDevMode(false);
    _nameInput.value = '';
    alert(`Saved “${name}” with ${bindings.length} parameter${bindings.length === 1 ? '' : 's'}. It's in your wizard library and the bar (Custom).`);
}
