/**
 * blocks/devMode.js — the Blocks-tab AUTHORING surface: the keystone of the wizard-maker.
 *
 * Form / Block / Editor all EDIT an op; the Blocks tab is also the only rung that DEFINES one. Authoring is ALWAYS
 * ON (no normal/dev toggle — the Blocks tab IS the author/learner surface; operators stay in the wizards).
 *
 * t1610 — the per-atom inline "expose as knob" checkbox (a dim marker + checkbox + name + widget pick grown on
 * every value field of every atom) was removed by explicit user instruction (2026-08-04, 867135c0; finished here
 * after t1604 restored it on a stale premise — see the memory this corrected). It cost constant visual clutter for
 * a rarely-used capability, and `formfield` (wizards/ops/formField.js) is the confirmed, measured, working
 * replacement: a DECLARED block — `param` + `matchvar` + `key` + `widget` + `label` — placed in the user_root
 * Presentation mouth, authored deliberately rather than discovered by ticking a box on a value already in front of
 * you. `param_group`'s GUI param-pill path is the other surviving authoring route. "Save wizard…" still registers
 * a reusable custom wizard (template + the bindings `formfield`/`param_group` declare) into the library + bar.
 */
import { BLOCKS } from '../wizards/ops/index.js';
import { fieldKind, fieldsOf, FN, inlineFields, fieldOptions } from './blockly/bridge.js';
import { userOpFromStack, listUserOps, USER_OP_PREFIX, flattenBlocks, extractParamBlocks, updateUserOp, defaultParams, defVOf, decodeCanvasWidget, groupCanvasBindings, CANVAS_ROLE_WIDGETS, simIntentFromStack, simStartsFromStack, bindingsFromStack, authoredExtraBindings, getUserDef, instantiate, materializeParamGroup, forkInheritance } from './userOps.js';   // t1075 — getUserDef + instantiate: the save-time fork wrap compares the body against the source op's exact exec run; t1111 (S5.3) — the FORM materializer; t1593 — forkInheritance: the copy reads the source's DECLARED bindings, not the pill view
import { createWizard } from './wizardLibrary.js';
import { camTypeOf, materializeCamTable } from '../data/opCamMap.js';   // t1069 — the "recognized generator twin" test for the fork-time opunit wrap; t1103 (S4b) — the pendant-field materializer
import { workspaceToStack } from './blockly/stackBridge.js';
import { confirmDestructiveLoad } from './saveStates.js';   // S4-1 — the shared destructive-load guard (snapshot + confirm before replacing the program)
import { openRegionEditor } from '../ui/regionEditor.js';   // the "make your own datum" authoring editor
import { openCoordEditor } from '../ui/formWidgets.js';     // the coordinate-list ✎ editor (shares buildCoordEditor with the form)

// A pencil glyph for the dev-mode "✎ regions" affordance on a regionpick block (a FieldImage with an onClick).
const PENCIL_URI = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cfe6ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>');

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
// the numeric (math_number socket) fields on a leaf/wrap atom block — used by collectAuthoring (live workspace,
// now permanently empty — see the t1610 docstring above) and deriveGroupDef (a hand-built group's STORED _expose).
function numericFields(block) {
    const def = BLOCKS[block.type];
    if (!def) return [];
    return fieldsOf(def).filter((f) => fieldKind(def, f) === 'value');
}
function getInlineFields(block) {
    const def = BLOCKS[block.type];
    if (!def) return [];
    return inlineFields(def);
}
function isAtom(blk) {
    if (!(blk && !blk.isShadow() && blk.type !== 'op' && !blk.type.endsWith('_op') && blk.type !== 'progstart' && blk.type !== 'progend')) return false;
    // t148 — a `section`'s title is AUTHORING METADATA (the section's name), NOT an exposable wizard value. Same for the
    // panel block's panel-type field and the param_group block's group-name field (t161 — both authoring labels, not
    // values). Value-bearing atoms (assign / param / move / …) are untouched.
    const def = BLOCKS[blk.type];
    return !(def && (def.kind === 'section' || def.kind === 'structctl' || def.kind === 'panel' || def.kind === 'param_group' || def.kind === 'formfield' || def.kind === 'layoutwidget' || def.kind === 'opunit' || def.kind === 'cam_table' || def.kind === 'cam_field'));   // t148 section + t154 structural-control + t161 panel/param_group + formfield/layoutwidget (composable-authoring) + t1069 opunit + t1093 cam_table/cam_field: authoring/boundary/pendant-declaration metadata, not exposable values
}

// The authoring BODY for the live form / save: the op's children when there's an op wrapper, else the BARE top-level
// atom stack (a program hand-built directly in Blocks — #12: a hand-built stack is form-editable too). Returns
// { opRec, children, first } or null; `first` is the live Blockly block the bindings' pre-order indexes align to (the
// op's DO-chain head, or the bare chain head). A bare stack gets a synthetic opType-less opRec so the rest is uniform.
function authoringBody(ws) {
    const stack = workspaceToStack(ws);
    const opRec = stack.find((b) => b && b.type === 'op');
    if (opRec && (opRec.children || []).length) {
        const opBlk = ws.getAllBlocks().find((b) => b.type === 'op' || b.type.endsWith('_op'));
        const doIn = opBlk && (opBlk.getInput('GCODE') || opBlk.getInput('DO'));
        return { opRec, children: opRec.children, first: (doIn && doIn.connection && doIn.connection.targetBlock()) || null };
    }
    const children = stack.filter((b) => b && b.type !== 'op' && !String(b.type || '').endsWith('_op') && b.type !== 'progstart' && b.type !== 'progend');
    if (!children.length) return null;                                                     // empty workspace → nothing to author
    const first = ws.getTopBlocks(true).find((b) => isAtom(b)) || null;                    // a bare stack = one connected chain head
    return { opRec: { type: 'op', opType: null, params: {}, children }, children, first };
}

// One NON-numeric inline exposure ({ param, blockIndex, key, default, type, widget?, widgetConfig? }) classified from
// the field's kind. Shared by the live-workspace collectAuthoring and the off-records deriveGroupDef so both produce
// IDENTICAL binding shapes (one source for the field → form-widget mapping).
function inlineExposure(def, f, pname, blockIndex, defaultVal) {
    const k = fieldKind(def, f);
    let type = 'string', widget = null, widgetConfig = null;
    if (k === 'dropdown') { type = 'enum'; widget = 'dropdown'; const opts = fieldOptions(def, f); if (opts) widgetConfig = { options: opts }; }
    else if (k === 'checkbox') { type = 'bool'; widget = 'toggle'; }
    else if (k === 'cornergrid') { type = 'string'; widget = 'corner-grid'; }
    else if (k === 'coordlist') { type = 'list'; widget = 'coord-list'; }
    else if (k === 'text') { type = 'string'; widget = 'text'; }
    const bind = { param: pname, blockIndex, key: f, default: defaultVal, type };
    if (widget) bind.widget = widget;
    if (widgetConfig) bind.widgetConfig = widgetConfig;
    return bind;
}

// Read the ticked exposures off the LIVE workspace → { opRec, exposures, varErr }. t1610 — the EXPOSE_ checkbox this
// reads no longer exists anywhere (augment() no longer creates it), so `exposures` is always []; kept rather than
// removed because deriveAuthoredDef still needs opRec/varErr from authoringBody, and removing this would require
// restructuring that still-live function for a change scoped to the knob's UI, not its callers.
function collectAuthoring(ws) {
    const body = authoringBody(ws);
    if (!body) return null;
    const { opRec, children, first } = body;
    const flat = flattenBlocks(children);
    const atomBlocks = first ? preorderAtoms(first) : [];                                  // aligns index-for-index with flat
    const exposures = [], used = new Set();
    let varErr = null;
    atomBlocks.forEach((blk, i) => {
        const rec = flat[i];
        if (!rec || !rec.params) return;
        const processField = (f, isNumeric) => {
            if (blk.getFieldValue('EXPOSE_' + FN(f)) !== 'TRUE') return;
            if (isNumeric && typeof rec.params[f] !== 'number') { if (!varErr) varErr = f; return; }   // a #var/expression got plugged in
            let pname = (blk.getFieldValue('PNAME_' + FN(f)) || f).trim().replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '') || f;
            if (used.has(pname)) { let k = 2; while (used.has(pname + '_' + k)) k++; pname += '_' + k; }
            used.add(pname);
            if (isNumeric) {
                exposures.push({ param: pname, blockIndex: i, key: f, default: rec.params[f], widget: blk.getFieldValue('WIDGET_' + FN(f)) || 'number' });
            } else {
                exposures.push(inlineExposure(BLOCKS[blk.type], f, pname, i, rec.params[f]));
            }
        };
        for (const f of numericFields(blk)) processField(f, true);
        for (const f of getInlineFields(blk)) processField(f, false);
    });
    return { opRec, exposures, varErr };
}

// Turn exposures into bindings. Single-param widgets (number/slider) → one binding each. The canvas pickers fold
// their ROLE into the chosen widget value (xy-x / rect-w / …), so each binding's role is DECLARED, not derived from
// pool position — groupCanvasBindings then forms canvases (a repeated role starts a new one). type stays 'number'
// for every binding: an exposure is a plain-number socket, so the value is always numeric (see extractParamBlocks).
function buildBindings(exposures) {
    const out = [], canvas = [];
    const plain = (e) => ({
        param: e.param, blockIndex: e.blockIndex, key: e.key,
        type: e.type || 'number', default: e.default, label: e.param,
        ...(e.widgetConfig ? { widgetConfig: e.widgetConfig } : {})
    });
    for (const e of exposures) {
        const dec = decodeCanvasWidget(e.widget);
        if (dec.role) canvas.push({ ...plain(e), _widget: dec.widget, role: dec.role });   // DECLARED role (folded into the widget)
        else out.push(e.widget && e.widget !== 'number' ? { ...plain(e), widget: e.widget } : plain(e));
    }
    out.push(...groupCanvasBindings(canvas, 'g'));
    return out;
}

let _ws = null, _B = null, _savebtn = null, _editChip = null;
let _editingWizard = null, _editingLabel = null;   // opType + friendly label being re-authored, or null = a fresh op
// t1599 — WHICH WIZARD THE CANVAS IS CUSTOMIZING, which is NOT the same fact as `_editingWizard` above. That one
// answers "may this wizard be Updated in place?", and editWizardDef deliberately clears it for the fork-only twins
// (surfacing / slot / drill / bore) so a recognized fork cannot destructively overwrite its twin. The right pane
// then had nothing left to ask, and showed the Preview face while a Define Custom Wizard block sat on the canvas.
// So the second fact is DECLARED here rather than inferred from the stack's shape — which cannot work, because a
// PLACED data-op twin's body carries a `user_root` too and an ordinary program must keep its Preview + G-code.
let _authoringWizard = null;

/** Derive a LIVE wizard def from the workspace WITHOUT saving — the same bindings saveAsCustomOp computes (inline
 *  exposures + GUI param pills), so the Blocks tab can render the op's form as a live VIEW of its blocks (the form is
 *  a pure function of the blocks; save is just persistence). Returns { bindings, children, varErr } or null (no op).
 *  Read-only: collectAuthoring works off a fresh workspaceToStack projection, so the live blocks aren't touched. */
export function deriveAuthoredDef(ws) {
    const a = collectAuthoring(ws || _ws);
    if (!a) return null;
    const inlineBindings = buildBindings(a.exposures);
    const paramBindings = extractParamBlocks(a.opRec.children, new Set(inlineBindings.map((b) => b.param)));
    // composable-authoring: `formfield` (value) + `layoutwidget` (GUI point) blocks ALSO declare form fields → show them
    // in the LIVE form as authored. Dedup vs the inline/param knobs (a param can't be declared twice).
    const seen = new Set([...inlineBindings, ...paramBindings].map((b) => b.param));
    const fieldBindings = authoredExtraBindings(a.opRec.children).filter((b) => !seen.has(b.param));
    return { bindings: [...inlineBindings, ...paramBindings, ...fieldBindings], children: a.opRec.children, varErr: a.varErr };
}

// Framing knobs auto-surfaced into a hand-built group's form (parity with built-in ops whose stacks carry framing):
// progstart owns spindle rpm + clearance; progend owns the retract height. Numeric params on the framing records.
const FRAMING_KNOBS = { progstart: ['rpm', 'clearance'], progend: ['retractZ'] };

/** Increment 2 — derive a wizard def from a GROUP op's STORED children: the OFF-RECORDS analogue of
 *  deriveAuthoredDef. Each child record can carry knobs in `record._expose` ({ FN(field): { p:name, w:widget } },
 *  round-tripped by stackBridge — see opSession.seedKnobExpose, the t391 provenance writer), so the editor hover-chip
 *  can open a hand-built group's form WITHOUT the Blocks tab. Bindings index into flattenBlocks(children) — the SAME
 *  pre-order opSession.setGroupChildParams writes back through. Returns a def { opType:'group', label, bindings,
 *  children, panel:'form' } (panel:'form' = no preview pane; the group has no builder — its children ARE the
 *  program). */
export function deriveGroupDef(groupOp) {
    const children = (groupOp && groupOp.children) || [];
    const flat = flattenBlocks(children);
    const exposures = [], used = new Set();
    flat.forEach((rec, i) => {
        // FRAMING parity: progstart/progend carry the spindle/clearance/retract the user expects as knobs (a built-in
        // op's form exposes them). They have no _expose (isAtom skips them), so auto-surface a FIXED set by type. The
        // writeback (setGroupChildParams) reaches them by the same blockIndex/key as any other binding.
        const framing = rec && FRAMING_KNOBS[rec.type];
        if (framing) {
            if (!rec.params) return;
            for (const key of framing) {
                if (typeof rec.params[key] !== 'number') continue;
                let pname = key;
                if (used.has(pname)) { let k = 2; while (used.has(pname + '_' + k)) k++; pname += '_' + k; }
                used.add(pname);
                exposures.push({ param: pname, blockIndex: i, key, default: rec.params[key], widget: 'number' });
            }
            return;
        }
        const expo = rec && rec._expose;
        if (!expo || !rec.params) return;
        const def = BLOCKS[rec.type];
        if (!def) return;
        const handle = (f, isNumeric) => {
            const e = expo[FN(f)];
            if (!e) return;                                                       // this field isn't exposed
            if (isNumeric && typeof rec.params[f] !== 'number') return;           // a #var/expression — not a plain-number knob
            let pname = (e.p || f).trim().replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '') || f;
            if (used.has(pname)) { let k = 2; while (used.has(pname + '_' + k)) k++; pname += '_' + k; }
            used.add(pname);
            if (isNumeric) exposures.push({ param: pname, blockIndex: i, key: f, default: rec.params[f], widget: e.w || 'number' });
            else exposures.push(inlineExposure(def, f, pname, i, rec.params[f]));
        };
        for (const f of numericFields(rec)) handle(f, true);                       // numericFields/getInlineFields read def off .type → work on a record
        for (const f of getInlineFields(rec)) handle(f, false);
    });
    const bindings = buildBindings(exposures);
    // A complete canvas group (point/rect/circle → a `group` binding) gets a form2d 2D-PREVIEW so its handle is
    // DRAG-editable (layoutSpecFromOp drives the bound x/y fields) — the spatial-gui "drag the preview" path. A
    // plain-number-only group stays form-only (no preview pane needed).
    const has2D = bindings.some((b) => b && b.group);
    return { opType: 'group', label: (groupOp && groupOp.label) || 'Hand-built', bindings, children, panel: has2D ? 'form2d' : 'form' };
}

/** The opType being re-authored (the "editing a saved wizard" context), or null = building/authoring fresh. */
export function editingWizardType() { return _editingWizard; }
/** t1599 — the opType this canvas was opened to CUSTOMIZE, or null. Set for every Customize, including the fork-only
 *  twins `editingWizardType` deliberately reports null for. The right pane reads it to decide its face. */
export function authoringWizardType() { return _authoringWizard; }

/** Write a form VALUE back to the block it's bound to — the live round-trip's form→block direction. Maps the
 *  binding's (blockIndex, key) to the live Blockly socket and sets the number SURGICALLY (a math_number shadow, or a
 *  GUI param pill's value) — only that value changes, no stack regenerate. Fires normally so the reproject updates
 *  the G-code + preview. Returns true if written. (preorderAtoms aligns index-for-index with the flattened children,
 *  the same alignment deriveAuthoredDef's blockIndex uses.) When NO derived binding names the param (the Customize
 *  route — t1605), falls back to writing the canvas param_field's dflt: the declaration row is the value there. */
export function writeAuthoredValue(ws, param, value) {
    ws = ws || _ws;
    if (!ws || !Number.isFinite(value)) return false;
    const def = deriveAuthoredDef(ws);
    const b = def && def.bindings.find((x) => x.param === param);
    if (b && b.blockIndex != null && b.key != null) {
        const body = authoringBody(ws);                                                        // op DO-chain OR a bare stack head
        const blk = (body && body.first ? preorderAtoms(body.first) : [])[b.blockIndex];
        const sock = blk && blk.getInput(FN(b.key));
        const tgt = sock && sock.connection && sock.connection.targetBlock();
        if (tgt && tgt.type === 'math_number') { tgt.setFieldValue(String(value), 'NUM'); return true; }   // a direct value socket
        if (tgt && tgt.type === 'param') {                                                                  // a GUI param pill → set its value
            const vin = tgt.getInput(FN('value'));
            const vt = vin && vin.connection && vin.connection.targetBlock();
            if (vt && vt.type === 'math_number') { vt.setFieldValue(String(value), 'NUM'); return true; }
        }
        return false;
    }
    // t1605 — the CUSTOMIZE route: a twin's bindings live in the REGISTRY, not on its canvas (no knobs, no pills),
    // so no derived binding names this param. The canvas's own declaration row IS the writable value there: the
    // param_field block naming this param. Writing its dflt field is the exact two-way pair of the wizard-view face
    // READING row dflts (formBindings over the canvas template) — edit a form row, the row's own block shows it.
    const pf = ws.getAllBlocks().find((blk) => blk && blk.type === 'param_field' && String(blk.getFieldValue(FN('param'))) === String(param));
    if (pf) { pf.setFieldValue(String(value), FN('dflt')); return true; }
    return false;
}

/** Mount the ALWAYS-ON authoring surface: a "Save wizard…" button, grown on every render. There is no normal/dev
 *  toggle — the Blocks tab IS the author/learner surface (operators stay in the wizards); the wizard metadata
 *  (name / panel / preview-rig) is collected in a Save DIALOG at save time. Returns { onModelRender }. */
export function mountDevMode(ws, B, hostEl) {
    _ws = ws; _B = B;

    // The one persistent authoring action: name + save the current op as a reusable custom wizard. The ⌄ quick menu
    // calls the same window.ddcsSaveAsWizard (with no exposures it saves a parameterless wizard).
    _savebtn = document.createElement('button');
    _savebtn.type = 'button';
    _savebtn.className = 'blk-dev-savebtn';
    _savebtn.textContent = '💾 Save wizard…';
    _savebtn.title = 'Name this op and save it as a reusable custom wizard';
    _savebtn.addEventListener('click', () => saveAsCustomOp());

    // "✎ Editing: <name>" chip — shown only while re-authoring a saved wizard (keyed on _editingWizard), so the
    // Blocks tab reads as "your wizard" not a blank canvas. Pairs with the breathing edge-glow (.editing-wizard).
    _editChip = document.createElement('div');
    _editChip.className = 'blk-edit-chip';
    _editChip.hidden = true;

    if (typeof window !== 'undefined') {
        window.ddcsSaveAsWizard = () => saveAsCustomOp();
        window.ddcsEditWizardDef = (opType) => editWizardDef(opType);   // re-author a saved wizard (load its template)
        window.ddcsEditWizardDefs = (opTypes) => editWizardDefs(opTypes);   // S4-5 — load a MULTI-op concat into Blocks (composed CAM slot)
    }

    hostEl.append(_savebtn, _editChip);
    augment(); refreshEditingChrome();           // a program may already be loaded at mount
    return { onModelRender: () => { augment(); refreshEditingChrome(); } };   // re-apply on every rebuild
}

// Reflect the "editing a saved wizard" context: a breathing accent edge-glow (.editing-wizard on #blocks-app) + the
// "✎ Editing: <name>" chip. Both clear when _editingWizard is null (a fresh op / after Save). Keyed on one flag.
function refreshEditingChrome() {
    const app = (typeof document !== 'undefined') && document.getElementById('blocks-app');
    if (app) app.classList.toggle('editing-wizard', !!_editingWizard);
    if (_editChip) {
        _editChip.textContent = _editingWizard ? ('✎ Editing: ' + (_editingLabel || _editingWizard)) : '';
        _editChip.hidden = !_editingWizard;
    }
}

// grow each atom's "✎ regions"/"✎ positions" affordances where they apply (Events.disable → no reproject).
// t1610 — the per-atom inline expose-as-knob row this used to also grow (XMARK_/EXPOSE_/PNAME_/WIDGET_ fields,
// restoreExpose, the change-listener that persisted them across a reprojection) is REMOVED, by explicit user
// instruction; formfield is the replacement authoring path (see the file's top docstring).
function augment() {
    const B = _B, ws = _ws;
    if (!ws) return;
    B.Events.disable();
    try {
        for (const blk of ws.getAllBlocks()) {
            if (blk.type === 'regionpick') { augmentRegionPick(blk); if (blk.queueRender) blk.queueRender(); continue; }   // ✎ regions affordance
            if (blk.type === 'coordlist') { augmentCoordList(blk); if (blk.queueRender) blk.queueRender(); continue; }     // ✎ positions affordance
            if (!isAtom(blk)) continue;
            if (blk.queueRender) blk.queueRender();
        }
    } finally { B.Events.enable(); }
    try { if (B.renderManagement) B.renderManagement.triggerQueuedRenders(); } catch (_) { /* */ }
}

// The "✎ regions" affordance: a pencil FieldImage on a regionpick block that opens the region editor and
// writes the authored spec back to the SAME block.data channel the runtime + round-trip already use (one spec, no
// divergence). Authoring lives on the Blocks tab; *using* the picker is a click in the wizard form / runtime.
function augmentRegionPick(blk) {
    if (blk.getInput('RGNED')) return;   // idempotent
    blk.appendDummyInput('RGNED').appendField(new _B.FieldImage(PENCIL_URI, 16, 16, '✎ regions', () => openRegionAuthor(blk)));
}
export function openRegionAuthor(blk) {   // exported so the pencil onClick AND tests can trigger it the same way
    let spec = null;
    try { const d = blk.data ? JSON.parse(blk.data) : {}; if (d.spec) spec = typeof d.spec === 'string' ? JSON.parse(d.spec) : d.spec; } catch (_) { /* fresh */ }
    openRegionEditor(spec ? { spec } : null, (newSpec) => {
        let d = {}; try { d = blk.data ? JSON.parse(blk.data) : {}; } catch (_) { /* */ }
        d.spec = JSON.stringify(newSpec);
        blk.data = JSON.stringify(d);                            // spec rides block.data (runtime + round-trip read it)
        const f = blk.getField('VALUE');
        if (f) {
            const cur = f.getValue();
            if (newSpec.regions && newSpec.regions.length && !newSpec.regions.some((r) => String(r.value) === cur)) f.setValue(String(newSpec.regions[0].value));
            if (f.forceRerender) f.forceRerender();              // redraw the inline picker from the new spec
        }
    });
}

// The "✎ positions" affordance: a pencil on a coordlist block that opens the coordinate-list editor and writes the
// edited list back to the SAME `pts` field VALUE the runtime + round-trip read — the one divergence from region-pick
// (whose spec rides block.data). Authoring lives on the Blocks tab; USING the positioner is a wizard-form gesture.
function augmentCoordList(blk) {
    if (blk.getInput('CLED')) return;   // idempotent
    blk.appendDummyInput('CLED').appendField(new _B.FieldImage(PENCIL_URI, 16, 16, '✎ positions', () => openCoordAuthor(blk)));
}
export function openCoordAuthor(blk) {   // exported so the pencil onClick AND tests trigger it the same way
    const f = blk.getField('PTS');
    let state = { points: [], z: 0 };
    try { const v = f && f.getValue(); if (v) { const o = JSON.parse(v); if (o && Array.isArray(o.points)) state = { points: o.points, z: o.z }; } } catch (_) { /* fresh */ }
    openCoordEditor(state, (next) => {
        if (!f) return;
        f.setValue(JSON.stringify({ points: (next.points || []).map((p) => ({ x: p.x, y: p.y })), z: next.z }));
        if (f.forceRerender) f.forceRerender();              // redraw the inline positions preview from the new list
    });
}

// RE-AUTHOR a saved wizard: load its template (with its param pills) back into the Blocks tab + dev mode, so the
// GUI blocks round-trip and you can tweak them. Saving then UPDATES that wizard (same opType) instead of duplicating.
// t1069 (SUB-STACK S3) — when opening a RECOGNIZED generator twin (surfacing/corner/…) to CUSTOMIZE, WRAP its exec atoms in an
// opunit(opType, defV) at LOAD time. This is the RELIABLE moment (user_root.children still EQUALS the source exec run exactly);
// save-time is unreliable (the run can be interleaved by free-form Blockly editing, and the standard atoms carry no identity —
// north-star forbids inferring them). subStackToSlot then routes the opunit to its generator (the standard part stays LIVE) and
// the added loose atoms unroll+expose. A genuine custom user op (camTypeOf → universal) is NOT wrapped. PURE + exported for test:
// returns { template (possibly opunit-wrapped), recognized }.
export function wrapRecognizedForFork(def) {
    const opType = def && def.opType;
    const ct = camTypeOf({ opType, params: defaultParams(def) });
    const recognized = !!(ct && ct.camType && !ct.universal);
    const tpl = JSON.parse(JSON.stringify((def && def.template) || []));
    if (recognized) {
        const root = tpl.find((b) => b && b.type === 'user_root') || tpl[0];
        if (root && Array.isArray(root.children) && root.children.length) {
            root.children = [{ type: 'opunit', params: { opType, defV: defVOf(opType) }, children: root.children }];   // the exec run → one opunit boundary
        }
    }
    return { template: tpl, recognized };
}

// The pre-order atom TYPE SEQUENCE of a stack — the identity test for "is this body still the source op's exec run?".
// A literal deep-equal is NOT usable here (measured): the workspace round-trip FILLS an absent socket with the block
// default (progstart gains `rpm:0`) while instantiate's clone carries empty `children: []` arrays the workspace record
// omits — benign normalization noise that would make the gate NEVER fire, silently killing the feature. The type
// sequence catches exactly what matters: an atom ADDED, REMOVED or REORDERED — the interleaving that makes the standard
// run un-identifiable. It deliberately TOLERATES a value edit, which is correct to wrap: subStackToSlot RE-DERIVES the
// standard part's params from the actual sockets (deriveStandardParams), so a tuned value is read back, never lost.
const typeSeq = (stack) => flattenBlocks(stack || []).map((b) => (b && b.type) || '?').join('|');

// t1075 (Part C) — the placed-op → SAVE fork route must produce the SAME opunit sub-stack the Customize (editWizardDef)
// route does, so fork behaviour is ONE-SOURCE regardless of how the user got into Blocks. Wrap the exec run in an opunit
// ONLY when ALL THREE hold:
//   (1) RECOGNIZED — a generator twin whose DEFAULT variant resolves to a generator (the SAME test wrapRecognizedForFork
//       uses), so the save-time wrap matches the load-time wrap exactly;
//   (2) NOT ALREADY WRAPPED — an op opened via editWizardDef already carries the opunit (it round-trips through the
//       workspace), so re-wrapping would DOUBLE-wrap it;
//   (3) UNTOUCHED — the body's atom TYPE SEQUENCE still equals the source op's exec run (instantiate(def, the op's own
//       params)). If the user added/removed/reordered atoms the standard run is un-identifiable — shape-inference is
//       FORBIDDEN — so leave it universal. (See typeSeq: a literal deep-equal can never fire; a value edit is safe.)
// Any condition fails → return false and save UNIVERSAL exactly as today (a correct universal fork beats a corrupt sub-stack).
// Mutates a.opRec.children IN PLACE so the block records keep their IDENTITY, then re-derives each exposure's blockIndex
// BY IDENTITY over the wrapped flatten — NEVER a blanket +1: the shift is NON-UNIFORM (exec children shift by one, the
// uiChildren panel/sim/param_group do NOT), so a blanket +1 would silently corrupt the saved op's emit + form.
// NOTE (measured): for a data-op twin the body is [user_root{…}] and preorderAtoms only descends a 'DO' input, so
// user_root's PRESENTATION/EXECUTION mouths are never walked → inline EXPOSE ticks yield NO exposures for these ops
// (pre-existing). The live binding source is extractParamBlocks (param pills), which runs AFTER this wrap and therefore
// indexes the WRAPPED stack correctly by construction. The exposure re-derive is kept: it is correct, and it is the
// right behaviour the moment an exposure can exist here. Exported for test (like wrapRecognizedForFork).
export function wrapForkAtSave(a) {
    try {
        const opType = a && a.opRec && a.opRec.opType;
        if (!opType) return false;                                                     // a hand-built bare stack (opType null) — never a fork
        const def = getUserDef(opType);
        if (!def) return false;
        const ct = camTypeOf({ opType, params: defaultParams(def) });
        if (!(ct && ct.camType && !ct.universal)) return false;                        // (1) not a recognized generator twin
        const root = (a.opRec.children || []).find((b) => b && b.type === 'user_root');
        if (!root || !Array.isArray(root.children) || !root.children.length) return false;
        if (root.children.length === 1 && root.children[0] && root.children[0].type === 'opunit') return false;   // (2) already wrapped (the editWizardDef route)
        if (typeSeq(a.opRec.children) !== typeSeq(instantiate(def, a.opRec.params || {}))) return false;          // (3) atom added/removed/reordered → un-identifiable
        const flatBefore = flattenBlocks(a.opRec.children);                            // the indices a.exposures were computed against
        root.children = [{ type: 'opunit', params: { opType, defV: defVOf(opType) }, children: root.children }];  // IN PLACE — identity preserved
        const flatAfter = flattenBlocks(a.opRec.children);
        for (const e of (a.exposures || [])) {
            const ref = flatBefore[e.blockIndex];
            const ni = ref ? flatAfter.indexOf(ref) : -1;
            if (ni >= 0) e.blockIndex = ni;                                            // re-derived BY IDENTITY
        }
        return true;
    } catch (_) { return false; }   // any doubt → leave it universal
}

// t1103 (block-native params S4b) — is a def a UNIVERSAL-arm op whose value bindings are PILL-derivable? Only these get a
// materialized cam_table: a generator twin's cam_table would be inert (its build never reads camFieldsFromStack — measured
// t1101), and a LITERAL-binding universal twin (contour: hand-assembled bindings, no pills) hits a pre-existing no-pill save
// limitation the cam_table would activate, so it is SKIPPED (gated to S6). A pill-based op's bindings re-index automatically
// on save (extractParamBlocks over the post-injection flatten), so the injection persists correctly.
const hasParamPills = (template) => flattenBlocks(template || []).some((b) => b && b.params && Object.values(b.params).some((v) => v && typeof v === 'object' && v.type === 'param'));
export function maybeMaterializeCamTable(def) {
    try {
        if (!def || !def.opType || !Array.isArray(def.template)) return def;
        const ct = camTypeOf({ opType: def.opType, params: defaultParams(def) });
        if (!ct || !ct.universal) return def;                                             // universal-arm ONLY (not a generator twin)
        if (!(def.bindings || []).some((b) => b && b.blockIndex != null)) return def;     // needs value bindings to declare
        if (flattenBlocks(def.template).some((b) => b && b.type === 'cam_table')) return def;   // idempotent — already materialized
        if (!hasParamPills(def.template)) return def;                                     // PILL-derivable only (literal twins → S6)
        materializeCamTable(def);   // inject camTableFromBindings into the Presentation mouth + identity re-derive the bindings
    } catch (_) { /* leave the op unmaterialized on any doubt — the fallback path is always correct */ }
    return def;
}

// t1111 (block-native params S5.3) — the FORM materialize hook, the analog of maybeMaterializeCamTable. Gives an op with
// value bindings its FORM fields as param_field blocks (a param_group) when opened to customize. NO universal gate (the form
// applies to ANY custom op, not just the universal build arm). PILL-derivable only (the same no-pill save limit S4b found for
// literal twins → S6). Idempotent. COMPOSES with maybeMaterializeCamTable: both run at editWizardDef, each re-derives the
// bindings BY IDENTITY over the CURRENT (post-previous-injection) flatten, so the combined shift is correct. CANVAS ops are
// NOT skipped — formBindings preserves a canvas binding's group/role/widget, so a materialized param_group stays byte-neutral.
export function maybeMaterializeParamGroup(def) {
    try {
        if (!def || !def.opType || !Array.isArray(def.template)) return def;
        const hasVal = (def.bindings || []).some((b) => b && b.blockIndex != null);
        if (!hasVal && (!def.bindingSpecs || !def.bindingSpecs.some((s) => s && s.match))) return def;
        const existing = flattenBlocks(def.template).find((b) => b && b.type === 'param_group');
        if (existing && existing.children && existing.children.length > 0) return def;   // idempotent — already has a populated form group
        materializeParamGroup(def);
    } catch (_) { /* leave the op unmaterialized on any doubt — the fallback path is always correct */ }
    return def;
}

// S4-5 — reconstruct a user op into a Blocks op (the shared step editWizardDef + the multi-op editWizardDefs both use):
// resolve the def, opt-in MATERIALIZE its pendant fields (a pill-based op gains its cam_field/param_field blocks so they
// are editable in Blocks — t1103/t1111, a no-op for twins/literal/already-done), wrap a RECOGNIZED generator twin's exec
// atoms in an opunit (t1069 — keeps the standard sub-unit live), then makeOp the template. Returns { opC, def, recognized }
// or null (def gone / build failed). NO surface side effects (no guard / showApp / load).
export async function reconstructUserOpBlock(opType) {
    const def = getUserDef(opType);
    if (!def) return null;
    maybeMaterializeCamTable(def);
    maybeMaterializeParamGroup(def);
    const { template: forkTpl, recognized } = wrapRecognizedForFork(def);
    try {
        const { makeOp } = await import('./opBuilders.js');
        return { opC: makeOp(opType, defaultParams(def), forkTpl), def, recognized };   // wrap template → an op (pills round-trip)
    } catch (e) { console.warn('reconstruct op block: build failed', e); return null; }
}

// S4-5 — the MULTI-OP analog of editWizardDef: reconstruct EACH op + load the CONCAT into Blocks as ONE program (the
// composed CAM slot, seen as blocks). ONE destructive-load guard for the whole concat. Deliberately NO single-op editing
// chrome: there is no single wizard being re-authored, so _editingWizard is cleared — per-op editing is via each op's own
// op-menu "Customize as blocks" (which sets the single-op chrome + fires the S4-3 defVStale round-trip that rebuilds the
// slot). A dedicated slot-level "Editing camN" chip + an in-Blocks per-op Save selector are a flagged follow-on (t1155).
// One op reaching here (e.g. a mixed slot with a single block-able op) delegates to the normal single-op editWizardDef.
/**
 * ── t1518 — WAIT FOR THE BLOCKS APP, AND SAY SO **OUT LOUD** WHEN IT NEVER ARRIVES ────────────────────────────────
 *
 * Both re-author entry points polled for the Blocks app for 4 seconds and then carried on regardless — the load line
 * is `if (window.ddcsLoadBlockStack) …`, so an expired wait skipped it and returned normally.
 *
 * MEASURED before this was written, by holding the app down and calling the real function: **5133ms**, no stack
 * loaded, and the surface left saying `✎ Editing: Measured skipme` with the edge-glow on and an EMPTY canvas.
 * `visibleAlert: false` — nothing told anyone. That is worse than a silent skip: the chrome makes a CLAIM about a
 * state the app is not in, and the next Save reads the live workspace, so an operator who trusts the chip is one
 * click from writing an empty op over the wizard they meant to edit.
 *
 * ⚠ THE FIX IS NOT A LONGER WAIT. Four seconds is already generous; a slower machine is not the failure mode being
 * handled, an app that never mounts is. So the cap is UNCHANGED and the give-up is what changes: it refuses, in the
 * surface this function already uses for its other refusal ("That wizard is no longer in your library" — no new
 * affordance), and it returns BEFORE the chrome is set, so nothing claims an edit that did not happen.
 *
 * ONE function, both callers, because there were already two identical copies of the wait — patching each would have
 * made the fix the third copy. The sibling's failure was the quieter one and no better: `editWizardDefs` clears the
 * chrome, so it says nothing at all after the user has already accepted a destructive-load prompt.
 */
async function blocksAppReady(what) {
    const up = () => !!(window.ddcsLoadBlockStack && window.__blkws);
    for (let i = 0; i < 80 && !up(); i++) await new Promise((r) => setTimeout(r, 50));   // 4s — the original cap, unchanged
    if (up()) return true;
    alert(`Could not open ${what} in Blocks — the Blocks editor did not finish loading (waited 4 seconds).\n\n`
        + 'Your program was not changed. Open the Blocks tab and try again; if it stays blank, reload the page.');
    return false;
}

export async function editWizardDefs(opTypes) {
    const recs = [];
    for (const t of (opTypes || [])) { const r = await reconstructUserOpBlock(t); if (r) recs.push(r); }
    if (!recs.length) return;
    if (recs.length === 1) return editWizardDef(recs[0].def.opType);
    const opCs = recs.map((r) => r.opC);
    if (!(await confirmDestructiveLoad(opCs, { label: 'before edit', what: recs.length + ' ops' }))) return;
    if (window.showApp) window.showApp('blocks');
    if (!(await blocksAppReady(recs.length + ' ops'))) return;   // t1518 — refuse loudly rather than load nothing quietly
    _editingWizard = null; _editingLabel = null; _authoringWizard = null; refreshEditingChrome();   // multi-op: no single-op re-author chrome (t1599 — and no single wizard is being customized either)
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(opCs);
    await new Promise((r) => setTimeout(r, 150));
}

export async function editWizardDef(opType) {
    const r = await reconstructUserOpBlock(opType);
    if (!r) { alert('That wizard is no longer in your library.'); return; }
    const { opC, def, recognized } = r;
    // S4-1 — the shared destructive-load guard: opening this op in Blocks REPLACES the current program. Snapshot +
    // confirm BEFORE switching surfaces, so a Cancel leaves the program AND the current tab untouched (empty / identical
    // program → no prompt). Fixes the latent silent-wipe this path had.
    if (!(await confirmDestructiveLoad([opC], { label: 'before edit', what: def.label || opType }))) return;
    if (window.showApp) window.showApp('blocks');
    // t1518 — …and this returns BEFORE the editing chrome below, so a failed load never leaves a chip claiming an edit
    if (!(await blocksAppReady(def.label || opType))) return;
    // recognized fork → a FRESH op (no destructive in-place Update of the twin, which the opunit +1 shift would corrupt).
    // EXCEPT a maintained-as-data twin (corner/edge/pocket/middle, bindingSpecs): lockUpdate ALREADY blocks its Update, so keep
    // _editingWizard → its "maintained as data" guard + Save-as-new UX is unchanged. Only the NON-bindingSpecs recognized twins
    // (surfacing/slot/drill/bore, previously Updatable) need the new fork-only protection.
    const forkOnly = recognized && !isMaintainedAsData(def);
    _editingWizard = forkOnly ? null : opType; _editingLabel = forkOnly ? null : (def.label || opType);
    _authoringWizard = opType;   // t1599 — set for EVERY Customize, fork-only included: the face asks this, not the Update lock
    refreshEditingChrome();   // glow + "✎ Editing: <name>" chip (the editing-context UI)
    if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack([opC]);
    await new Promise((r) => setTimeout(r, 150));   // let it project + render (authoring affordances grow automatically)
}

// The Save DIALOG — the metadata collection surface (name / panel / DECLARED preview-rig), shown at save time and
// dismissed after, instead of a persistent panel that lingers over the canvas. Prefilled from `init`; on Save it
// calls onConfirm({ name, panel, sim }). The preview rig is an explicit DECLARATION (never inferred from motion —
// see opSimContext / [[custom-op-sim-intent-infer-vs-declare]]). Self-contained (inline styles), like blockEditNotice.
function openSaveDialog(init, onConfirm) {
    const m = document.createElement('div');
    m.className = 'blk-dev-savedlg';
    m.innerHTML = `<style>
        .blk-dev-savedlg{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);}
        .blk-dev-savedlg .bds{background:var(--panel,#1d2530);color:var(--text-main,#e6edf3);border:1px solid var(--line,rgba(255,255,255,.18));border-radius:9px;width:min(380px,94vw);box-shadow:0 14px 48px rgba(0,0,0,.55);padding:14px 16px;display:flex;flex-direction:column;gap:10px;}
        .blk-dev-savedlg h3{margin:0;font:700 14px/1 inherit;}
        .blk-dev-savedlg .blk-dev-hint{font:400 11px/1.4 inherit;color:var(--text-dim,#9fb0c0);}
        .blk-dev-savedlg label.blk-dev-name{display:flex;flex-direction:column;gap:3px;font:600 11px/1 inherit;color:var(--text-dim,#9fb0c0);}
        .blk-dev-savedlg input[type=text],.blk-dev-savedlg select{padding:6px 8px;font:inherit;color:var(--text-main,#e6edf3);background:var(--bg,#0b0f14);border:1px solid var(--line,rgba(255,255,255,.18));border-radius:6px;}
        .blk-dev-savedlg .blk-dev-sim{display:flex;flex-direction:column;gap:4px;font:600 11px/1 inherit;color:var(--text-dim,#9fb0c0);}
        .blk-dev-savedlg .blk-dev-sim label{display:flex;align-items:center;gap:6px;font-weight:400;cursor:pointer;color:var(--text-main,#e6edf3);}
        .blk-dev-savedlg .blk-dev-sim-why{cursor:help;opacity:.7;}
        .blk-dev-savedlg .bds-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:2px;}
        .blk-dev-savedlg button{padding:7px 13px;font:700 12px/1 inherit;cursor:pointer;border-radius:6px;border:1px solid var(--line,rgba(255,255,255,.18));background:transparent;color:var(--text-main,#e6edf3);}
        .blk-dev-savedlg .blk-dev-save{border:none;color:#fff;background:var(--accent,#3b82f6);}
        .blk-dev-savedlg .blk-dev-save:hover{filter:brightness(1.1);}</style>
        <div class="bds">
            <h3>Save as custom wizard</h3>
            <div class="blk-dev-hint" style="margin-bottom:8px;">Saved directly into your current workspace. <span style="opacity:0.75">(Export later via Settings → Wizard Bar to share)</span></div>
            <div class="blk-dev-editnote blk-dev-hint" hidden></div>
            <div class="blk-dev-hint">${init.knobs ? `${init.knobs} form field${init.knobs === 1 ? '' : 's'} declared.` : 'No form fields declared — saves a fixed (parameterless) wizard. Use a “Parameter Group” block to add them.'}</div>
            <label class="blk-dev-name">Wizard name <input type="text" class="blk-dev-opname" placeholder="my corner probe" /></label>
            <label class="blk-dev-name">Panel <select class="blk-dev-paneltype">
                <option value="form3d">Form + 3D preview</option>
                <option value="form3d+2d">Form + 3D preview + 2D layout</option>
                <option value="form2d">Form + 2D layout</option>
                <option value="form">Form only</option>
            </select></label>
            <div class="blk-dev-sim">Preview rig <span class="blk-dev-sim-why" title="DECLARE what the preview shows for this op — never guessed from the G-code. Rotary reveals the 4th-axis rig + the A± jog row; Machine pins to the envelope; Magazine draws the ATC pockets.">ⓘ</span>
                <label><input type="checkbox" class="blk-dev-sim-rotary"> 4th-axis rotary (jog)</label>
                <label><input type="checkbox" class="blk-dev-sim-machine"> Machine frame</label>
                <label><input type="checkbox" class="blk-dev-sim-magazine"> ATC magazine</label>
            </div>
            <div class="bds-foot">
                <button type="button" class="blk-dev-cancel">Cancel</button>
                <button type="button" class="blk-dev-update" hidden>Update</button>
                <button type="button" class="blk-dev-save">Save</button>
            </div>
        </div>`;
    document.body.appendChild(m);
    const q = (s) => m.querySelector(s);
    q('.blk-dev-opname').value = init.name || '';
    q('.blk-dev-paneltype').value = init.panel || 'form3d';
    q('.blk-dev-sim-rotary').checked = !!(init.sim && init.sim.showRotaryRig);
    q('.blk-dev-sim-machine').checked = !!(init.sim && init.sim.forceMachine);
    q('.blk-dev-sim-magazine').checked = !!(init.sim && init.sim.showMagazine);
    setTimeout(() => { try { q('.blk-dev-opname').focus(); } catch (_) { /* */ } }, 0);

    const close = () => { m.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    q('.blk-dev-cancel').addEventListener('click', close);
    m.addEventListener('click', (e) => { if (e.target === m) close(); });

    // Non-destructive save: when re-authoring, "Update <name>" overwrites the original (explicit, outline) while the
    // accent "Save as new" makes a separate copy (the safe default — the original is untouched unless you click Update).
    if (init.editing) {
        const locked = !!init.lockUpdate;   // maintained-as-data (bindingSpecs): Update is disabled (would strip the derive mechanism)
        const note = q('.blk-dev-editnote');
        if (note) {
            note.textContent = locked
                ? `“${init.editing.label}” is maintained as data — “Update” would strip its data-driven parameters, so it's disabled. “Save as new” keeps the original and saves a copy.`
                : `Editing “${init.editing.label}” — “Update” overwrites it; “Save as new” keeps it and saves a copy.`;
            note.hidden = false;
        }
        const upd = q('.blk-dev-update');
        if (upd) {
            upd.textContent = `Update “${init.editing.label}”`;
            upd.hidden = false;
            if (locked) { upd.disabled = true; upd.title = 'Maintained as data — updating here would strip the data-driven parameters. Use “Save as new”, or edit the template.'; upd.style.opacity = '.45'; upd.style.cursor = 'not-allowed'; }
        }
        q('.blk-dev-save').textContent = 'Save as new';
    }
    const commit = (mode) => {
        const name = (q('.blk-dev-opname').value || '').trim();
        if (!name) { try { q('.blk-dev-opname').focus(); } catch (_) { /* */ } return; }   // name is required
        const r = q('.blk-dev-sim-rotary').checked, mc = q('.blk-dev-sim-machine').checked, mg = q('.blk-dev-sim-magazine').checked;
        const sim = (r || mc || mg) ? { showRotaryRig: r, forceMachine: mc, showMagazine: mg } : null;
        close();
        onConfirm({ name, panel: q('.blk-dev-paneltype').value || 'form3d', sim, mode });
    };
    q('.blk-dev-save').addEventListener('click', () => commit('new'));        // a fresh op, OR "Save as new" (a copy)
    const updBtn = q('.blk-dev-update'); if (updBtn) updBtn.addEventListener('click', () => commit('update'));   // explicit overwrite
}

// A def MAINTAINED AS DATA carries `bindingSpecs` — its value sockets are re-derived BY IDENTITY over the pruned
// stack every build (corner's M2 mechanism). The visual knob-save CAN'T preserve that: collectAuthoring→buildBindings
// flattens the rich bindings to plain ones and userOpFromStack drops bindingSpecs, so a visual Update would silently
// STRIP the derive mechanism (+ relTo/when/group/role/section/help/sourceField). So such a def REFUSES the visual
// Update, and its template is edited at the source. Plain user-op defs (no bindingSpecs) are unaffected. Exported so
// the save flow + tests read ONE declared rule.
// t1593/t1595 — the non-destructive "Save as new" (a copy) is again the path, and it is now a BETTER one than when
// that sentence was first written: the copy no longer strips the specs (forkInheritance carries them) and the canvas
// renders a guard's arms, so a copy of corner is a working wizard rather than the empty shell it used to be.
export function isMaintainedAsData(def) {
    if (!(def && Array.isArray(def.bindingSpecs) && def.bindingSpecs.length)) return false;
    // LOCK LIFTS (composable-authoring PILOT 1): once every bindingSpec is authored as a `formfield` block in the def's
    // template, the visual save round-trips them LOSSLESSLY (userOps.bindingsFromStack reconstructs def.bindingSpecs), so
    // the lock is unnecessary. A hand-written-spec def (no formfield blocks — today's corner/edge/middle) has none of its
    // specs authored as blocks → stays LOCKED (byte-identical, unchanged). Partial coverage stays locked (a save would drop
    // the un-authored specs).
    const authored = new Set(bindingsFromStack((def && def.template) || []).map((s) => s.param));
    return !def.bindingSpecs.every((s) => authored.has(s.param));
}

// Register the current op's STACK as a custom WIZARD — a bar button (+ its form). Reads the ticked exposures (if any)
// → bindings → userOpFromStack → createWizard (into the library + bar). No exposures just means a parameterless
// wizard (add form fields via a formfield/param_group block to add them). Called by the 💾 Save button + the ⌄ quick
// menu.
function saveAsCustomOp() {
    if (!_ws) { alert('Open an op in the Blocks tab first, then save it as a wizard.'); return; }
    // Read the LIVE workspace SYNCHRONOUSLY here — BEFORE the Save dialog awaits user input — so the bindings/defaults
    // freeze at save-initiation. Blockly v13 batches change events (FIRE_QUEUE / setTimeout 0), so a value edited just
    // before Save hasn't reprojected yet; capturing now keeps the saved default = the LIVE value, not a stale-model
    // revert during the dialog.
    const a = collectAuthoring(_ws);
    if (!a) { alert('No op to save — insert an op in Blocks first.'); return; }
    if (a.varErr) { alert(`The exposed value “${a.varErr}” has a variable or expression plugged in — a knob must be a plain number. Restore a number on that block, then save again.`); return; }

    // t1075 (Part C) — a placed RECOGNIZED op opened in Blocks DIRECTLY (not via Customize) and saved would fork as
    // UNIVERSAL (its standard part baked, never live in CAM). Wrap it in the SAME opunit boundary the Customize route
    // produces, so fork behaviour is one-source regardless of route. Gated + in place + exposure indices re-derived by
    // identity (see wrapForkAtSave); a no-op for every other save, so all existing save paths are byte-identical.
    wrapForkAtSave(a);

    const inlineBindings = buildBindings(a.exposures);
    // GUI param blocks plugged into value sockets ALSO declare knobs — extract them (mutates the template: pills → numbers).
    const paramBindings = extractParamBlocks(a.opRec.children, new Set(inlineBindings.map((b) => b.param)));
    const authoredBindings = [...inlineBindings, ...paramBindings];
    // t1593 — A FORK INHERITS ITS SOURCE'S DECLARATIONS (see userOps.forkInheritance for the full account). Both
    // extractors above read a DERIVED VIEW — ticked knobs and param PILLS — and a shipped twin declares its bindings
    // literally or as bindingSpecs, so for all 32 of them they legitimately return NOTHING and the copy registered as an
    // EMPTY SHELL: 549 declared bindings, zero recovered. Inherited rows come FIRST so the copy keeps the wizard's
    // declared field ORDER; anything authored in the workspace is appended and WINS by param name (a pill the user just
    // plugged in is the newer declaration for that knob). A hand-built stack (no source opType) inherits nothing.
    const inherited = forkInheritance(getUserDef(a.opRec.opType), a.opRec.children);
    const bindings = inherited
        ? [...inherited.bindings.filter((b) => !authoredBindings.some((x) => x.param === b.param)), ...authoredBindings]
        : authoredBindings;

    // A GUI `panel`/`sim` block in the stack WINS over the dialog choice (a declaration baked into the template) —
    // capture both now so the dialog can prefill with the truth and the commit can honour the override.
    const panelBlk = flattenBlocks(a.opRec.children).find((b) => b && b.type === 'panel');
    const blkPanel = (panelBlk && panelBlk.params && panelBlk.params.panel) || null;
    const blkSim = simIntentFromStack(a.opRec.children);   // undefined = no sim block in the stack
    const editingDef = _editingWizard ? listUserOps().find((d) => d.opType === _editingWizard) : null;
    const lockUpdate = isMaintainedAsData(editingDef);   // a maintained-as-data def refuses the visual Update (see isMaintainedAsData)

    // A 2D-point / 2D-rect knob is ONLY drag-to-edit on the Form+2D preview — so default a freshly-authored op that
    // has one to form2d, else the feature is silently hidden behind the form3d default. Still a DECLARATION: a `panel`
    // block, a re-authored wizard's own panel, and the dialog dropdown all override (group[0] carries the widget).
    const hasNumberRole = bindings.some((b) => b.widget === 'point' || b.widget === 'nrect');

    openSaveDialog({
        name: editingDef ? (editingDef.label || '') : '',
        panel: blkPanel || (editingDef && editingDef.panel) || (hasNumberRole ? 'form2d' : 'form3d'),
        sim: blkSim !== undefined ? blkSim : ((editingDef && editingDef.sim) || null),
        knobs: bindings.length,
        editing: editingDef ? { opType: _editingWizard, label: editingDef.label || _editingWizard } : null,
        lockUpdate,   // maintained-as-data → the dialog disables Update + explains why (Save-as-new stays)
    }, (meta) => {
        const panel = blkPanel || meta.panel;
        let sim = blkSim !== undefined ? blkSim : meta.sim;
        // `simstart` blocks in the stack DECLARE the per-pass sim-starts → def.sim.starts (B3, read like the sim block).
        const blkStarts = simStartsFromStack(a.opRec.children);
        if (blkStarts && blkStarts.length) sim = { ...(sim || {}), starts: blkStarts };
        // Non-destructive: only an EXPLICIT "Update" (mode 'update') overwrites the re-authored wizard. Anything else —
        // a fresh op, or "Save as new" while editing — creates a SEPARATE wizard, leaving the original untouched.
        const update = meta.mode === 'update' && _editingWizard;
        // GUARD (belt-and-suspenders; the dialog already disables the Update button): a maintained-as-data def refuses
        // the visual Update — it would strip bindingSpecs + the rich metadata. Save-as-new (a copy) is the path.
        if (update && lockUpdate) {
            alert(`“${(editingDef && editingDef.label) || _editingWizard}” is maintained as data — updating it here would strip its data-driven parameters. Use “Save as new”, or edit its template.`);
            return;
        }
        // t1593 — the inherited declarations that are NOT the bindings list: `bindingSpecs` (the fork's emit re-derives its
        // value sockets BY IDENTITY over its own pruned stack, exactly as the source does) and `forkedFrom` (which source
        // this copy came from — the provenance registerUserOp reads to re-attach the source's code hooks, since a function
        // cannot be stored on a def). Both are inert DATA on the def; neither is derivable from the template.
        const authorFork = (type, name) => {
            const d = userOpFromStack(type, name, a.opRec.children, bindings, panel, sim);
            if (inherited) {
                if (inherited.bindingSpecs) d.bindingSpecs = inherited.bindingSpecs;
                d.forkedFrom = inherited.forkedFrom;
            }
            return d;
        };
        try {
            if (update) {
                updateUserOp(authorFork(_editingWizard, meta.name));
            } else {
                const slug = meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'wizard';
                const existing = new Set(listUserOps().map((d) => d.opType));
                let type = slug, n = 2; while (existing.has(USER_OP_PREFIX + type)) type = slug + '_' + (n++);
                createWizard(authorFork(type, meta.name));
            }
        } catch (e) { console.warn('save wizard failed', e); alert('Save failed: ' + ((e && e.message) || e)); return; }

        if (window.ddcsRefreshWizardBar) window.ddcsRefreshWizardBar();
        _editingWizard = null; _editingLabel = null; _authoringWizard = null; refreshEditingChrome();   // exit the editing context (glow + chip clear)
        alert(update ? `Updated “${meta.name}”.` : `Saved “${meta.name}” as a new wizard — it's a button in the bar (Custom)${bindings.length ? ` with ${bindings.length} knob${bindings.length === 1 ? '' : 's'}` : ''}.`);
    });
}
