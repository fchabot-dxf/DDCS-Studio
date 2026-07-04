/**
 * DDCS Studio Wizard Manager
 *
 * Generic wizard-dialog coordinator. Everything wizard-SPECIFIC (DOM ids,
 * params reading, previews, SVG animators) lives in the per-wizard view
 * modules under wizards/views/ — this class only handles the shared overlay,
 * event wiring, dispatch, insert and the shared 3D preview host.
 */

import { el, makeDraggable } from './ui/uiUtils.js';
import { WIZARD_VIEWS, viewByType } from './wizards/views/index.js';
import { userOpView, setUserOpDef } from './wizards/views/userOpView.js';   // ONE generic view for every user_* op (reuses #wiz_user)
import { listUserOps } from './blocks/userOps.js';
const isUserOp = (t) => typeof t === 'string' && t.startsWith('user_');
import { playClick, playClickReverse } from './ui/sound.js';  // audio helper for click sounds
import { decorateProbeSrc } from './ui/probeSrcGlyph.js';     // controller-source chips on probe inputs
import { mountSafeZFrameToggles } from './ui/safeZFrameToggle.js';   // SPATIAL-MODEL 1c: the shared safe-Z frame toggle (rel|mach)
import { createPreviewPanel } from './viz/createPreviewPanel.js';   // THE shared preview (identical to Blocks/Studio), fed the wizard's op code
import { openTemplatesPopover, closeTemplatesPopover } from './ui/wizardTemplates.js';   // per-op save/load templates (local + cloud)
import { frameWizardSections } from './ui/wizardSections.js';   // group each form's fields into framed categories
import { needsPrereqPrompt } from './ui/wizardPrereq.js';   // just-in-time "add a probe / ATC" prompt for hardware-gated wizards

// Map the touch-probe wizards' per-op input fields to the global 3D-probe defaults
// (settings.probes). open() pre-fills these so every wizard starts from the configured
// probe; the user can still tweak any field for that operation. Pin/level are read from
// settings directly in each view, so they're not listed here.
const PROBE_DEFAULT_FIELDS = {
    c_radius: 'radius',
    al_feed_fast: 'fastFeed', c_feed_fast: 'fastFeed', circ_feed_fast: 'fastFeed', m_feed_fast: 'fastFeed', p_feed_fast: 'fastFeed', rc_feed_fast: 'fastFeed', rcl_feed_fast: 'fastFeed',
    al_feed_slow: 'slowFeed', c_feed_slow: 'slowFeed', circ_feed_slow: 'slowFeed', m_feed_slow: 'slowFeed', p_feed_slow: 'slowFeed', rc_feed_slow: 'slowFeed', rcl_feed_slow: 'slowFeed',
    al_retract: 'retract', c_retract: 'retract', circ_retract: 'retract', m_retract: 'retract', p_retract: 'retract', rc_retract: 'retract', rcl_retract: 'retract',
    al_safe_z: 'safeZ', c_safe_z: 'safeZ', circ_safe_z: 'safeZ', m_safe_z: 'safeZ', rc_safe_z: 'safeZ', rcl_safe_z: 'safeZ',
    al_dist: 'maxDist', c_dist: 'maxDist', circ_dist: 'maxDist', m_dist: 'maxDist', p_dist: 'maxDist', rc_dist: 'maxDist', rcl_dist: 'maxDist',
    al_q: 'qStop', c_q: 'qStop', circ_q: 'qStop', m_q: 'qStop', p_q: 'qStop', rc_q: 'qStop', rcl_q: 'qStop',
};

// Per-wizard STICKY overrides: editing a probe field (e.g. corner MAX PROBE) is remembered for THAT wizard,
// keyed by its field id — so it survives reopen/refresh and overrides ONLY its own field, never the global
// probe-default (settings.probes). A field the user never touched still follows the global on open. The wizard
// box looked like where you set a default but was really a volatile mirror of the one global setting; this makes
// the per-field edit stick where the user expects it.
const PROBE_FIELD_OVERRIDE_KEY = 'ddcs_probe_field_overrides';
function loadProbeFieldOverrides() {
    try { return JSON.parse(localStorage.getItem(PROBE_FIELD_OVERRIDE_KEY)) || {}; } catch (_) { return {}; }
}
function saveProbeFieldOverride(id, value) {
    const o = loadProbeFieldOverrides();
    o[id] = value;
    try { localStorage.setItem(PROBE_FIELD_OVERRIDE_KEY, JSON.stringify(o)); } catch (_) { /* storage full / disabled — non-fatal */ }
}

// EDIT seeding: the form-field binding now lives ON each SCHEMA param (blocks/opSchema.js, SCHEMA[op][param].field).
// paramFields(opType) returns the { param → field id } map for an op (the old PARAM_FIELDS, derived from the schema);
// _seedForm() uses it to restore params into the form when re-opening a wizard to edit an op (params = single truth).
import { paramFields } from './blocks/opSchema.js';

export class WizardManager {
    constructor(editorManager) {
        this.editorManager = editorManager;
        this.views = WIZARD_VIEWS;
        this.wizardElement = el('wizard');
        console.debug('WizardManager: constructor - registry size=', this.views.length, 'wizardElement=', !!this.wizardElement);
        // Defensive: only setup listeners if wizard container is present
        if (this.wizardElement) {
            this.setupEventListeners();
            console.debug('WizardManager: event listeners set up');
        } else {
            console.warn('WizardManager: wizard element (#wizard) not found');
        }
    }

    setupEventListeners() {
        // Click outside wizard to close — but only when the press STARTED on the backdrop too. Otherwise a
        // drag that begins inside a field (selecting text) and releases past the wizard edge lands its click
        // on the backdrop and closes the wizard mid-selection. Require pointerdown AND click both on #wizard.
        let downOnBackdrop = false;
        this.wizardElement.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target.id === 'wizard'; });
        this.wizardElement.addEventListener('click', (e) => {
            if (e.target.id === 'wizard' && downOnBackdrop) this.close();
        });

        // Click a line in a wizard CODE PREVIEW (when not playing) → place the tool there + highlight the line.
        this.wizardElement.addEventListener('click', (e) => {
            const ln = e.target.closest('pre[id^="wiz_"][id$="_code"] .g-line');
            if (!ln) return;
            const i = parseInt(ln.getAttribute('data-line-index'), 10);
            const panel = this._activePanel;
            if (!Number.isFinite(i) || !panel || (panel.engine && panel.engine.running)) return;   // don't fight a running play
            const codeEl = ln.closest('pre[id^="wiz_"][id$="_code"]');
            codeEl.querySelectorAll('.g-line.active-line').forEach((s) => s.classList.remove('active-line'));
            ln.classList.add('active-line');
            if (panel.seekLine) panel.seekLine(i);
        });

        // Drag the whole generator by its header bar (but not the gear / close).
        const box = this.wizardElement.querySelector('.wiz-box');
        const head = box && box.querySelector('.wiz-head');
        if (box && head) makeDraggable(box, head, { ignore: 'select, button, input, .wiz-gear, .wiz-close, .wiz-templates' });

        // Wizard header → Templates popover (save / load this op's parameter templates).
        const tplBtn = this.wizardElement.querySelector('.wiz-templates');
        if (tplBtn) tplBtn.addEventListener('click', (e) => { e.stopPropagation(); openTemplatesPopover(this, tplBtn); });

        // Settings (stock/probe/machine) changed — if a wizard is open, re-run its update() so the
        // preview + the inferred spindle start track the new values live (e.g. editing stock size via
        // the in-wizard ⚙). Read-only re-render; never writes settings, so no loop.
        window.addEventListener('ddcs:settings-changed', () => {
            if (this.wizardElement && this.wizardElement.classList.contains('active')) this.update();
        });

        // (The post-processor selector lives in the app header now — ui/headerPost.js — not per-generator.)

        // Escape key to close wizard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.wizardElement && this.wizardElement.classList.contains('active')) {
                    this.close();
                    e.preventDefault();
                }
            }
        });

        // Setup input listeners for all wizard controls
        this.setupWizardInputListeners();
    }

    setupWizardInputListeners() {
        const wizInputs = this.views.flatMap((v) => v.inputIds || []);

        wizInputs.forEach(id => {
            const element = el(id);
            if (!element) return;
            const tag = element.tagName.toLowerCase();
            const type = (element.type || '').toLowerCase();
            // Text/number inputs: use 'input' for live updates
            // Select/checkbox/radio: use only 'change' to avoid double-firing
            if (tag === 'select' || type === 'checkbox' || type === 'radio') {
                element.addEventListener('change', () => this.update());
            } else {
                element.addEventListener('input', () => this.update());
            }
            // Per-wizard sticky: a committed edit to a probe-default field is remembered (its own field only,
            // not the global). 'change' fires on user commit (blur/Enter) — NOT on applyProbeDefaults' programmatic
            // .value set — so only genuine edits persist; untouched fields keep following the global default.
            if (id in PROBE_DEFAULT_FIELDS) {
                element.addEventListener('change', () => saveProbeFieldOverride(id, element.value));
            }
        });
    }


    /** Pre-fill the touch-probe wizards' per-op fields from the global 3D-probe defaults — but a per-wizard
     *  STICKY override (a value the user edited in THIS wizard) wins, so the edit survives reopen/refresh. */
    applyProbeDefaults() {
        const p = (window.ddcsGetSettings && window.ddcsGetSettings().probes) || null;
        if (!p) return;
        const overrides = loadProbeFieldOverrides();
        for (const [id, key] of Object.entries(PROBE_DEFAULT_FIELDS)) {
            const v = (id in overrides) ? overrides[id] : p[key];   // sticky per-field edit beats the global default
            if (v == null) continue;
            const e = el(id);
            if (e) e.value = v;
        }
    }

    /** The view whose panel is currently visible (or null). The shared #wiz_user panel maps to the generic view. */
    activeView() {
        const u = el('wiz_user');
        if (u && u.style.display !== 'none') return userOpView;
        return this.views.find((v) => {
            const e = el(v.panelId);
            return e && e.style.display !== 'none';
        }) || null;
    }

    /**
     * Reverse-sync: pull the (possibly block-edited) active op back into the OPEN wizard's form, so editing the
     * PlaceOnStock cornergrid / params in the Blocks tab shows up here. Wired to the tab switch back to Studio
     * (gatewayStatus.showApp). No-op unless a wizard is open AND it matches the op the Blocks tab is showing.
     */
    async pullFromBlocks() {
        const view = this.activeView();
        if (!view || !this.wizardElement || !this.wizardElement.classList.contains('active')) return;
        let reconcileActiveOp;
        try { ({ reconcileActiveOp } = await import('./blocks/opSession.js')); } catch (_) { return; }
        const r = reconcileActiveOp();
        if (!r || r.type !== view.type || !r.fields) return;
        for (const id in r.fields) {
            const e = el(id), val = r.fields[id];
            if (e && e.type === 'checkbox') {   // booleans (e.g. middle's circular / both) sync via .checked, not .value
                if (val == null || e.checked === !!val) continue;
                e.checked = !!val;
                e.dispatchEvent(new Event('change', { bubbles: true }));
                continue;
            }
            if (!e || val == null || String(e.value) === String(val)) continue;
            e.value = String(val);
            e.dispatchEvent(new Event('input', { bubbles: true }));   // refresh the form's anchor pickers + re-run the wizard
        }
    }

    open(type, variant, bypassPrereq) {
        // Just-in-time hardware gate: if this wizard needs a probe / ATC that isn't configured, show a small
        // non-blocking prompt instead of opening. "Open anyway" re-enters with bypassPrereq, so the gate is a
        // thin pass-through when the hardware is present (or the user already chose to proceed).
        if (needsPrereqPrompt(type, variant, bypassPrereq)) return;
        // play a feedback sound whenever a wizard is opened
        playClick();
        this._activeType = type;   // for the Templates popover (save/load this op's parameter templates)
        closeTemplatesPopover();
        this.editingOpId = null;   // a fresh open is a NEW op; openForEdit re-marks it. Clear the edit glow.
        { const b = document.querySelector('.wiz-box'); if (b) b.classList.remove('editing'); }
        // Opening a wizard leaves the Studio preview context — stop any running engine/play (every preview panel
        // + Studio's drawer) so nothing keeps executing behind the wizard and clobbers the code it inserts.
        window.dispatchEvent(new CustomEvent('ddcs:stop-previews'));
        if (window.ddcsStopPreview) window.ddcsStopPreview();

        const view = viewByType.get(type) || (isUserOp(type) || type === 'group' ? userOpView : null);
        // tell the generic view which custom op — EXCEPT a group, whose derived def is set by _openGroupForEdit (no library def to look up)
        if (view === userOpView && type !== 'group') setUserOpDef(listUserOps().find((d) => d.opType === type) || null);
        const box = document.querySelector('.wiz-box');
        // Re-centre on open: clear any drag offset left from a previous session.
        if (box) Object.assign(box.style, { position: '', left: '', top: '', right: '', bottom: '', transform: '', margin: '' });
        console.debug('WizardManager.open()', type, 'view=', !!view, 'wizardElement=', this.wizardElement);
        if (!this.wizardElement) {
            console.warn('WizardManager.open(): no wizard container available');
            return;
        }

        if (view ? view.large : type === 'probe') {
            box.classList.add('large');
        } else {
            box.classList.remove('large');
        }
        // Two-pane layout (form left / visuals right) for wizards with a 3D preview.
        box.classList.toggle('two-pane', !!(view && view.twoPane));

        // Ensure overlay is visible and mark active
        this.wizardElement.style.display = 'flex';
        this.wizardElement.classList.add('active');

        // Hide all wizard panels (incl. the shared custom-op panel)
        this.views.forEach((v) => {
            const elem = el(v.panelId);
            if (elem) elem.style.display = 'none';
        });
        { const u = el('wiz_user'); if (u) u.style.display = 'none'; }

        // Show requested wizard (every user_* op shares the one #wiz_user panel)
        const wizElem = el(view === userOpView ? 'wiz_user' : 'wiz_' + type);
        if (wizElem) {
            wizElem.style.display = 'block';
            frameWizardSections(wizElem);   // group the form's fields into framed categories (idempotent)
            this._setupSplitter(wizElem);   // draggable form/preview divider (all two-pane wizards)
            // Variant entry: a view may declare identity-splitting variants (e.g. drill vs bore) that share one
            // form. The view locks the variant param + hides its selector so the menu choice fixes the identity.
            if (view && typeof view.applyVariant === 'function') view.applyVariant(variant);
            if (view && typeof view.onShow === 'function') view.onShow(this);
            decorateProbeSrc(view);   // controller/Studio source chips (before first generate)
            mountSafeZFrameToggles(() => this.update());   // the shared rel|mach safe-Z frame toggle on adopting wizards' safe-Z fields (idempotent)
            this.applyProbeDefaults();   // seed probe fields from the global 3D-probe defaults
            // Ensure fields & preview reflect current defaults immediately
            this.update();
            if (view && typeof view.onOpen === 'function') view.onOpen(this);
            // Transactional snapshot: capture the form state now, so a Cancel can revert to it.
            this._formSnapshot = this._captureForm();
        }
    }

    /**
     * Open a wizard to EDIT an existing op (from the editor's hover chip). Seeds the form from the op's params
     * — the single source of truth (no snapshot) — glows the modal to mark it as editing, and on insert REPLACES
     * that op (replaceOp rebuilds its blocks from the edited params) instead of appending a new one.
     */
    /** Does this op type support seeding its form from params (so it can be edited in place)? */
    canEdit(opType) {
        if (isUserOp(opType)) return true;                 // every custom op edits in the generic #wiz_user view
        if (opType === 'group') return true;               // a hand-built group edits via its derived (off-records) form

        const view = viewByType.get(opType);
        return !!(opType && (Object.keys(paramFields(opType)).length || (view && typeof view.setForm === 'function')));
    }

    /** params → form: a custom view.setForm() when it has one (e.g. drill's pattern variants), else the dict's
     *  field binding (value/checkbox decided by element type). params are the single source of truth — no snapshot. */
    _seedForm(opType, params) {
        const view = viewByType.get(opType) || (isUserOp(opType) ? userOpView : null);
        if (view && typeof view.setForm === 'function') { view.setForm(params || {}); return; }
        const map = paramFields(opType); if (!params || !Object.keys(map).length) return;
        for (const key in map) {
            const e = el(map[key]); if (!e) continue;
            const val = params[key]; if (val == null) continue;
            if (e.type === 'checkbox') e.checked = !!val; else e.value = val;
        }
    }

    /** Snapshot the current values of all input fields for the active wizard view. */
    _captureForm() {
        const view = this.activeView();
        if (!view || !view.inputIds) return null;
        const snap = {};
        for (const id of view.inputIds) {
            const e = el(id);
            if (!e) continue;
            snap[id] = e.type === 'checkbox' ? e.checked : e.value;
        }
        return snap;
    }

    /** Restore all input fields from a previous snapshot. */
    _restoreForm(snap) {
        if (!snap) return;
        for (const [id, val] of Object.entries(snap)) {
            const e = el(id);
            if (!e) continue;
            if (e.type === 'checkbox') e.checked = !!val; else e.value = val;
        }
    }

    /** Open a hand-built GROUP op's form (the editor hover ✎ chip on a grouped run, increment 2). The group has no
     *  builder/library def — derive it from the op's STORED children (devMode.deriveGroupDef, off the persisted
     *  _expose) and drive the shared #wiz_user view. On insert, userOpView.applyGroupEdits writes the form values
     *  surgically back to the group's children (no replaceOp rebuild — a group has no builder). */
    async _openGroupForEdit(op) {
        let deriveGroupDef;
        try { ({ deriveGroupDef } = await import('./blocks/devMode.js')); } catch (_) { return; }
        setUserOpDef(deriveGroupDef(op));              // set the derived def FIRST; open('group') won't clobber it
        this.open('group');                            // routes to userOpView + #wiz_user, render()s the form, clears edit glow
        this.update();                                 // emit the group's code preview from the seeded values
        this.editingOpId = op.id;                      // now mark as editing this group
        const box = document.querySelector('.wiz-box'); if (box) box.classList.add('editing');  // accent glow
        this._formSnapshot = this._captureForm();
    }

    openForEdit(opId) {
        const prog = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
        const op = prog.find((b) => b && b.type === 'op' && b.id === opId);
        if (!op || !op.opType) return;
        if (op.opType === 'group') { this._openGroupForEdit(op); return; }   // group: derive the form from its stored children
        this.open(op.opType);                          // normal open (clears editing + glow, seeds defaults)
        let params = op.params;
        // Back-compat: old atc_change ops carry mode/magType, not method — derive method so the form shows right.
        if (op.opType === 'atc_change' && params && !params.method) {
            const method = params.mode === 'auto' ? (params.magType === 'disk' ? 'disk' : 'generic') : 'manual';
            params = { ...params, method };
        }
        this._seedForm(op.opType, params);             // params → form (the single source of truth)
        this.update();                                 // re-render preview + code from the seeded values
        this.editingOpId = opId;                       // now mark as editing this op
        const box = document.querySelector('.wiz-box'); if (box) box.classList.add('editing');  // accent glow
        // Transactional snapshot: capture the form state now, so a Cancel can revert to it.
        this._formSnapshot = this._captureForm();
    }

    // Back-compat entry points (older callers and window.* glue). (openCorner retired ④ — Corner (data) opens via open('user_corner_data').)
    openMiddle() { this.open('middle'); }
    openEdge() { this.open('edge'); }
    openAlignment() { this.open('alignment'); }

    /**
     * Hide the wizard overlay.  If `reverse` is truthy the click sound will
     * play backwards; callers that are performing an insert should pass
     * `false` so only the forward animation is heard. If `isCancel` is true, 
     * the form's edits are discarded by restoring the snapshot taken on open.
     */
    close(reverse = true, isCancel = true) {
        if (reverse) {
            playClickReverse();
        }
        if (isCancel && this._formSnapshot) {
            this._restoreForm(this._formSnapshot);
        }
        closeTemplatesPopover();
        // Hide overlay and clear active state
        this.wizardElement.classList.remove('active');
        this.wizardElement.style.display = 'none';
        this.editingOpId = null;   // leave edit mode
        const box = this.wizardElement.querySelector('.wiz-box'); if (box) box.classList.remove('editing');
    }

    update() {
        const view = this.activeView();
        if (view) return view.update(this);
    }

    // Back-compat named update/anim entry points used by app.js listeners (updateCornerWizard retired ④)
    updateMiddleWizard() { return viewByType.get('middle').update(this); }
    updateEdgeWizard() { return viewByType.get('edge').update(this); }
    updateAlignmentWizard() { return viewByType.get('alignment').update(this); }
    updateCommunicationWizard() { return viewByType.get('comm').update(this); }
    updateWCSWizard() { return viewByType.get('wcs').update(this); }
    updateAtcLengthWizard() { return viewByType.get('atc_length').update(this); }
    updateAtcWarmupWizard() { return viewByType.get('atc_warmup').update(this); }
    updateAtcChangeWizard() { return viewByType.get('atc_change').update(this); }
    _startEdgeAnim() { viewByType.get('edge').startAnim(); }
    _startAlignmentAnim() { viewByType.get('alignment').startAnim(); }

    async insert() {
        const view = this.activeView();
        const code = view ? el(view.codeElId)?.textContent : '';

        // Accumulate this op INTO the one program (its high-level blocks slot before Program End) so multiple
        // inserts coexist and all show in Blocks — not two framed programs concatenated (M30 mid-file). Ops with
        // no block builder yet (probe/ATC families) fall back to a plain text insert.
        let committed = false;
        try {
            const ops = await import('./blocks/opSession.js');
            const { isOpBlockEdited, opEditSummary } = await import('./blocks/opGlow.js');
            if (this.editingOpId) {
                // GROUP edit: a hand-built group has no builder, so apply the form values to its STORED children
                // (surgical writeback) instead of a replaceOp rebuild. Detect by the op's type in the live program.
                const prog = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
                const tgt = prog.find((b) => b && b.type === 'op' && b.id === this.editingOpId);
                if (tgt && tgt.opType === 'group') {
                    committed = await userOpView.applyGroupEdits(this.editingOpId);
                    if (committed) { this.close(false, false); playClick(); return; }
                }
                // EDIT: rebuild THIS op from the new params (single source of truth) and replace it in place.
                const { getLastOp } = await import('./blocks/opRecord.js');
                const op = getLastOp();
                if (isOpBlockEdited && isOpBlockEdited(this.editingOpId)) {
                    const { showBlockEditNotice } = await import('./ui/blockEditNotice.js');
                    // informed: show WHAT a Replace would discard (the block-only residue) — same MID #1 diff.
                    const choice = await showBlockEditNotice(op?.label || op?.type || this._activeType || 'op', opEditSummary(this.editingOpId));
                    if (choice === 'cancel') return;                         // back to the form, nothing inserted
                    if (choice === 'merge') {
                        // True AST Merge: weave custom atoms into the newly generated form code
                        committed = ops.mergeOpBlocks ? ops.mergeOpBlocks(this.editingOpId, op.params) : false;
                        if (committed) { this.close(false); playClick(); return; }
                    }
                }
                if (!committed) {
                    committed = op ? ops.replaceOp(this.editingOpId, op.params) : false;   // 'replace' / no edit → rebuild from form
                }
            } else {
                committed = ops.commitActiveOp() || (!!code && ops.commitDecodedCode(code));   // builder op → high-level; else decode the generated code → blocks
            }
        } catch (e) { console.warn('commit op failed', e); }
        if (!committed && !this.editingOpId && code) this.editorManager.insert(code);   // last resort (new op, nothing decoded)

        if (committed || code) {
            // Carry the start position the user set in this wizard's 3D preview over to the main preview.
            try {
                const p = this._activePanel;
                const ws = (p && p.getStartPos) ? p.getStartPos() : ((p && p.viz && p.viz.starts) ? p.viz.starts[0] : null);
                if (ws) {
                    window.__pendingSpindleStart = { x: ws.x, y: ws.y, z: ws.z };
                    if (window.ddcsSetSpindleStart) window.ddcsSetSpindleStart(ws.x, ws.y, ws.z, 0);
                }
            } catch (e) { /* preview is optional */ }
            playClick();
        } else {
            console.warn('WizardManager: No visible wizard or empty code.');
        }

        // do not fire reverse sound when closing as part of insertion, and do not revert the form snapshot
        this.close(false, false);
    }

    // Render the wizard's generated G-code in the active wizard's viz area using THE shared preview panel
    // (identical code + UI to Studio main + Blocks). The SVG schematic is hidden (kept in wizards/views/* +
    // _svgPreview.bak.js for the DDCS CAM-menu thumbnails). The wizard feeds its own op code + inferred start.
    preview3D(gcode, containerId, start, startHints) {
        const svgCont = document.getElementById(containerId);
        if (!svgCont || !svgCont.parentElement) return;
        const parent = svgCont.parentElement; // .viz-container
        let host = parent.querySelector('.wiz-viz3d');
        if (!host) {
            host = document.createElement('div');
            host.className = 'wiz-viz3d';
            host.style.cssText = 'position:relative; width:100%;';   // height via CSS (.wiz-viz3d) so two-pane can grow it
            parent.insertBefore(host, svgCont);
            // The shared panel carries its own legend + controls; drop any per-wizard inline legend.
            const visual = host.closest('.wiz-visual') || parent;
            const oldLeg = visual && visual.querySelector('.viz-legend'); if (oldLeg) oldLeg.remove();
            host.__panel = createPreviewPanel(host, {
                getGcode: () => host.__gcode || '',
                getStart: () => host.__start,
                // Per-pass start hints (multi-point probe): one start per manual REPOSITION so 3-point/A-B probes
                // land at DISTINCT points (else the degenerate single-start solve). Optional (most ops are 1-pass).
                getStartHints: () => host.__startHints,
                onLine: (i) => this._highlightWizLine(host, i),   // play → highlight the executing line in the CODE PREVIEW (like Studio main)
            });
        }
        svgCont.style.display = 'none';
        host.__gcode = gcode || '';
        host.__start = start || null;
        host.__startHints = Array.isArray(startHints) ? startHints : null;
        this._activePanel = host.__panel;   // for insert(): read the start the user set/dragged in this preview
        host.__panel.setActive(true);        // mark active + render this op's code
    }

    // Highlight the executing (or clicked) line in this wizard's CODE PREVIEW — same blue as the Studio editor.
    // i = null clears. Scope to the host's own wizard BODY (#wiz_<name>.wiz-body) — all wizards share one .wiz-box,
    // so a broader scope would grab the first wizard's code, not the active one.
    _highlightWizLine(host, i) {
        const body = (host && host.closest && host.closest('.wiz-body')) || document;
        body.querySelectorAll('pre[id^="wiz_"][id$="_code"] .g-line.active-line').forEach((s) => s.classList.remove('active-line'));
        if (i == null) return;
        const codeEl = body.querySelector('pre[id^="wiz_"][id$="_code"]');
        const ln = codeEl && codeEl.querySelector(`.g-line[data-line-index="${i}"]`);
        if (ln) ln.classList.add('active-line');   // no scrollIntoView — the CODE PREVIEW must not jump while playing; the line just pulses (CSS animation)
    }

    // Pin a wizard preview to the MACHINE frame so the envelope always draws (ATC tool changes are inherently G53,
    // even when a given trace — auto-change with no tool, warmup/drawbar with no motion, the table-write macro —
    // doesn't reach a G53). Opt-in (ATC wizards only) — call AFTER preview3D so the panel exists.
    previewMachine(containerId, on) {
        const svgCont = document.getElementById(containerId);
        const host = svgCont && svgCont.parentElement && svgCont.parentElement.querySelector('.wiz-viz3d');
        const panel = host && host.__panel;
        if (panel && panel.setForceMachine) panel.setForceMachine(on !== false);
    }

    // Draw the ATC magazine (pockets + tool stubs) in the 3D preview on the machine envelope. Opt-in (ATC wizards
    // only) — call AFTER preview3D so the panel/viz exists. pockets = [{x,y,z,dia,length,pocket,tool,color}].
    previewMagazine(containerId, pockets) {
        const svgCont = document.getElementById(containerId);
        const host = svgCont && svgCont.parentElement && svgCont.parentElement.querySelector('.wiz-viz3d');
        const viz = host && host.__panel && host.__panel.viz;
        if (viz && viz.setMagazine) viz.setMagazine(pockets || []);
    }

    // Highlight the ATC FIRMWARE push station (the taught #1320-1326 region) in the 3D preview on the machine frame.
    // Opt-in (the atc_change firmware method only) — call AFTER preview3D. region = { z, start, end, retreat } (machine
    // coords) or null to clear. The view resolves it from the op's declared choreography (ATC_CHOREOGRAPHY.firmware).
    previewAtcStation(containerId, region) {
        const svgCont = document.getElementById(containerId);
        const host = svgCont && svgCont.parentElement && svgCont.parentElement.querySelector('.wiz-viz3d');
        const viz = host && host.__panel && host.__panel.viz;
        if (viz && viz.highlightStation) viz.highlightStation(region || null);
    }

    // Show/hide the 4th-axis rig (chuck + tailstock) around a cylinder stock in the 3D preview. Opt-in (rotary
    // probe wizards only) — call AFTER preview3D so the panel/viz exists.
    previewRotaryFixture(containerId, on) {
        const svgCont = document.getElementById(containerId);
        const host = svgCont && svgCont.parentElement && svgCont.parentElement.querySelector('.wiz-viz3d');
        const viz = host && host.__panel && host.__panel.viz;
        if (viz && viz.setRotaryFixture) viz.setRotaryFixture(on);
    }

    // Draggable splitter between the form (.wiz-controls, left) and the preview (.wiz-visual, right) for every
    // two-pane wizard. Drag resizes the form width; the 3D viz auto-resizes (its own ResizeObserver). The chosen
    // width is remembered across wizards. Idempotent per wizard body.
    _setupSplitter(wizElem) {
        const pane = wizElem && wizElem.querySelector('.wiz-2pane');
        if (!pane || pane.__split) return;
        const controls = pane.querySelector(':scope > .wiz-controls');
        const visual = pane.querySelector(':scope > .wiz-visual');
        if (!controls || !visual) return;
        pane.__split = true;
        controls.style.order = '1'; visual.style.order = '3';
        const sp = document.createElement('div');
        sp.className = 'wiz-splitter';
        sp.style.cssText = 'order:2; flex:0 0 6px; align-self:stretch; cursor:col-resize; border-radius:4px; background:var(--border,#444); opacity:.45; touch-action:none; transition:opacity .12s;';
        sp.title = 'Drag to resize the form / preview';
        pane.appendChild(sp);
        let drag = false;
        const setW = (px) => { const r = pane.getBoundingClientRect(); controls.style.flex = '0 0 ' + Math.max(220, Math.min(r.width - 260, px)) + 'px'; };
        const stored = parseFloat(localStorage.getItem('ddcs_wiz_split_px'));
        if (Number.isFinite(stored)) requestAnimationFrame(() => setW(stored));
        sp.addEventListener('pointerdown', (e) => { drag = true; sp.setPointerCapture(e.pointerId); sp.style.opacity = '.95'; e.preventDefault(); });
        sp.addEventListener('pointermove', (e) => { if (!drag) return; setW(e.clientX - pane.getBoundingClientRect().left); });
        const end = (e) => { if (!drag) return; drag = false; sp.style.opacity = '.45'; try { sp.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ } localStorage.setItem('ddcs_wiz_split_px', String(controls.getBoundingClientRect().width)); };
        sp.addEventListener('pointerup', end); sp.addEventListener('pointercancel', end);
        sp.addEventListener('pointerenter', () => { if (!drag) sp.style.opacity = '.8'; });
        sp.addEventListener('pointerleave', () => { if (!drag) sp.style.opacity = '.45'; });
    }

    // Old private name kept as an alias for any external callers
    _preview3D(gcode, containerId) { return this.preview3D(gcode, containerId); }

    togglePreview() {
        const commPreview = el('comm_preview_block');
        const wcsPreview = el('wcs_preview_block');
        const probePreview = el('probe_preview_block');

        if (commPreview) commPreview.classList.toggle('hidden');
        if (wcsPreview) wcsPreview.classList.toggle('hidden');
        if (probePreview) probePreview.classList.toggle('hidden');
    }
}
