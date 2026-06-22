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
import { playClick, playClickReverse } from './ui/sound.js';  // audio helper for click sounds
import { decorateProbeSrc } from './ui/probeSrcGlyph.js';     // controller-source chips on probe inputs
import { createPreviewPanel } from './viz/createPreviewPanel.js';   // THE shared preview (identical to Blocks/Studio), fed the wizard's op code
import { openTemplatesPopover, closeTemplatesPopover } from './ui/wizardTemplates.js';   // per-op save/load templates (local + cloud)

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

// EDIT seeding: op param key → its form field id, per op type (the inverse of each view's update() reads).
// _seedForm() restores these into the form when re-opening a wizard to edit an op (params = single truth).
// Flat maps cover most wizards; drill has a custom view.setForm (pattern variants), atc_length is Settings-
// driven (no per-op fields). value vs checkbox is decided by the element type at seed time.
const PARAM_FIELDS = {
    surfacing: { originX: 'sf_originX', originY: 'sf_originY', offZ: 'sf_offZ', pathDatum: 'sf_pathDatum', stockAttach: 'sf_stockAttach', w: 'sf_w', h: 'sf_h', strategy: 'sf_strategy', toolDia: 'sf_toolDia', stepoverPct: 'sf_stepoverPct', depth: 'sf_depth', stepdown: 'sf_stepdown', clearance: 'sf_clearance', feed: 'sf_feed', plunge: 'sf_plunge', rpm: 'sf_rpm' },
    pocket: { shape: 'p_shape', strategy: 'p_strategy', originX: 'p_originX', originY: 'p_originY', offZ: 'p_offZ', pathDatum: 'p_pathDatum', stockAttach: 'p_stockAttach', w: 'p_w', h: 'p_h', dia: 'p_dia', toolDia: 'p_toolDia', stepoverPct: 'p_stepoverPct', depth: 'p_depth', stepdown: 'p_stepdown', clearance: 'p_clearance', feed: 'p_feed', plunge: 'p_plunge', rpm: 'p_rpm' },
    slot: { ax: 'sl_ax', ay: 'sl_ay', bx: 'sl_bx', by: 'sl_by', width: 'sl_width', originX: 'sl_offX', originY: 'sl_offY', offZ: 'sl_offZ', pathDatum: 'sl_pathDatum', stockAttach: 'sl_stockAttach', toolDia: 'sl_toolDia', stepoverPct: 'sl_stepoverPct', depth: 'sl_depth', stepdown: 'sl_stepdown', clearance: 'sl_clearance', feed: 'sl_feed', plunge: 'sl_plunge', rpm: 'sl_rpm' },
    text: { text: 'tx_text', x: 'tx_x', y: 'tx_y', originX: 'tx_offX', originY: 'tx_offY', offZ: 'tx_offZ', pathDatum: 'tx_pathDatum', stockAttach: 'tx_stockAttach', height: 'tx_height', spacing: 'tx_spacing', align: 'tx_align', strokeWidth: 'tx_strokeWidth', toolDia: 'tx_toolDia', stepoverPct: 'tx_stepoverPct', depth: 'tx_depth', stepdown: 'tx_stepdown', clearance: 'tx_clearance', feed: 'tx_feed', plunge: 'tx_plunge', rpm: 'tx_rpm' },
    corner: { corner: 'c_corner', probeZ: 'c_probe_z_first', syncA: 'c_sync_a', slave: 'c_slave', probeSeq: 'c_probe_seq', wcs: 'c_wcs', dist: 'c_dist', retract: 'c_retract', f_fast: 'c_feed_fast', f_slow: 'c_feed_slow', qStop: 'c_q', safeZ: 'c_safe_z', travelDist: 'c_travel_dist', scanDepth: 'c_scan_depth', radius: 'c_radius' },
    edge: { axis: 'p_axis', dir: 'p_dir', wcs: 'p_wcs', dist: 'p_dist', retract: 'p_retract', syncA: 'p_sync_a', slave: 'p_slave', f_fast: 'p_feed_fast', f_slow: 'p_feed_slow', qStop: 'p_q' },
    middle: { featureType: 'm_type', axis: 'm_axis', findBoth: 'm_both', syncA: 'm_sync_a', slave: 'm_slave', wcs: 'm_wcs', dist: 'm_dist', retract: 'm_retract', safeZ: 'm_safe_z', f_fast: 'm_feed_fast', f_slow: 'm_feed_slow', qStop: 'm_q', dir1: 'm_dir', dir2: 'm_dir2' },
    wcs: { sys: 'w_sys', axisX: 'w_x', axisY: 'w_y', axisZ: 'w_z', sync: 'w_sync', slave: 'w_slave' },
    alignment: { checkAxis: 'al_check_axis', probeDir: 'al_probe_dir', tolerance: 'al_tolerance', dist: 'al_dist', retract: 'al_retract', safeZ: 'al_safe_z', f_fast: 'al_feed_fast', f_slow: 'al_feed_slow', qStop: 'al_q' },
    circular: { featureType: 'circ_type', wcs: 'circ_wcs', dist: 'circ_dist', retract: 'circ_retract', safeZ: 'circ_safe_z', f_fast: 'circ_feed_fast', f_slow: 'circ_feed_slow', qStop: 'circ_q' },
    rotary_clock: { action: 'rcl_action', reference: 'rcl_reference', span: 'rcl_span', wcs: 'rcl_wcs', dist: 'rcl_dist', retract: 'rcl_retract', safeZ: 'rcl_safe_z', f_fast: 'rcl_feed_fast', f_slow: 'rcl_feed_slow', qStop: 'rcl_q' },
    rotary_center: { method: 'rc_method', datum: 'rc_datum', diameter: 'rc_diameter', wcs: 'rc_wcs', dist: 'rc_dist', retract: 'rc_retract', safeZ: 'rc_safe_z', f_fast: 'rc_feed_fast', f_slow: 'rc_feed_slow', qStop: 'rc_q' },
    comm: { type: 'c_type', msg: 'c_msg', val: 'c_val', cycle: 'c_cycle', popupMode: 'c_popup_mode', id: 'c_id', dest: 'c_dest', slot1: 'c_slot1', slot2: 'c_slot2', slot3: 'c_slot3', slot4: 'c_slot4', statusColor: 'c_status_color', statusMode: 'c_status_mode', statusDwell: 'c_status_dwell' },
    atc_check: { tolerance: 'atc_check_tol' },
    atc_warmup: { rpm1: 'atc_warmup_rpm1', time1: 'atc_warmup_time1', rpm2: 'atc_warmup_rpm2', time2: 'atc_warmup_time2' },
    atc_change: { mode: 'atc_change_mode', x: 'atc_change_x', y: 'atc_change_y', z: 'atc_change_z', zClear: 'atc_change_zclear', fixedT: 'atc_change_fixedt', waitSpindle: 'atc_change_m300', dustCover: 'atc_change_cover', confirm: 'atc_change_confirm' },
    atc_test: { mode: 'atc_test_mode', cycles: 'atc_test_cycles', dwellMs: 'atc_test_dwell', first: 'atc_test_first', count: 'atc_test_count', zClear: 'atc_test_zclear', descend: 'atc_test_descend' },
    atc_table: { lengths: 'atc_table_lengths', pockets: 'atc_table_pockets' },
};

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
        });
    }


    /** Pre-fill the touch-probe wizards' per-op fields from the global 3D-probe defaults. */
    applyProbeDefaults() {
        const p = (window.ddcsGetSettings && window.ddcsGetSettings().probes) || null;
        if (!p) return;
        for (const [id, key] of Object.entries(PROBE_DEFAULT_FIELDS)) {
            const v = p[key];
            if (v == null) continue;
            const e = el(id);
            if (e) e.value = v;
        }
    }

    /** The view whose panel is currently visible (or null). */
    activeView() {
        return this.views.find((v) => {
            const e = el(v.panelId);
            return e && e.style.display !== 'none';
        }) || null;
    }

    open(type, variant) {
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

        const view = viewByType.get(type) || null;
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

        // Hide all wizard panels
        this.views.forEach((v) => {
            const elem = el(v.panelId);
            if (elem) elem.style.display = 'none';
        });

        // Show requested wizard
        const wizElem = el('wiz_' + type);
        if (wizElem) {
            wizElem.style.display = 'block';
            this._setupSplitter(wizElem);   // draggable form/preview divider (all two-pane wizards)
            // Variant entry: a view may declare identity-splitting variants (e.g. drill vs bore) that share one
            // form. The view locks the variant param + hides its selector so the menu choice fixes the identity.
            if (view && typeof view.applyVariant === 'function') view.applyVariant(variant);
            if (view && typeof view.onShow === 'function') view.onShow(this);
            decorateProbeSrc(view);   // controller/Studio source chips (before first generate)
            this.applyProbeDefaults();   // seed probe fields from the global 3D-probe defaults
            // Ensure fields & preview reflect current defaults immediately
            this.update();
            if (view && typeof view.onOpen === 'function') view.onOpen(this);
        }
    }

    /**
     * Open a wizard to EDIT an existing op (from the editor's hover chip). Seeds the form from the op's params
     * — the single source of truth (no snapshot) — glows the modal to mark it as editing, and on insert REPLACES
     * that op (replaceOp rebuilds its blocks from the edited params) instead of appending a new one.
     */
    /** Does this op type support seeding its form from params (so it can be edited in place)? */
    canEdit(opType) {
        const view = viewByType.get(opType);
        return !!(opType && (PARAM_FIELDS[opType] || (view && typeof view.setForm === 'function')));
    }

    /** params → form: a custom view.setForm() when it has one (e.g. drill's pattern variants), else the central
     *  PARAM_FIELDS map (value/checkbox decided by element type). params are the single source of truth — no snapshot. */
    _seedForm(opType, params) {
        const view = viewByType.get(opType);
        if (view && typeof view.setForm === 'function') { view.setForm(params || {}); return; }
        const map = PARAM_FIELDS[opType]; if (!map || !params) return;
        for (const key in map) {
            const e = el(map[key]); if (!e) continue;
            const val = params[key]; if (val == null) continue;
            if (e.type === 'checkbox') e.checked = !!val; else e.value = val;
        }
    }

    openForEdit(opId) {
        const prog = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
        const op = prog.find((b) => b && b.type === 'op' && b.id === opId);
        if (!op || !op.opType) return;
        this.open(op.opType);                          // normal open (clears editing + glow, seeds defaults)
        this._seedForm(op.opType, op.params);          // params → form (the single source of truth)
        this.update();                                 // re-render preview + code from the seeded values
        this.editingOpId = opId;                       // now mark as editing this op
        const box = document.querySelector('.wiz-box'); if (box) box.classList.add('editing');  // accent glow
    }

    // Back-compat entry points (older callers and window.* glue)
    openCorner() { this.open('corner'); }
    openMiddle() { this.open('middle'); }
    openEdge() { this.open('edge'); }
    openAlignment() { this.open('alignment'); }

    /**
     * Hide the wizard overlay.  If `reverse` is truthy the click sound will
     * play backwards; callers that are performing an insert should pass
     * `false` so only the forward animation is heard.
     */
    close(reverse = true) {
        if (reverse) {
            playClickReverse();
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

    // Back-compat named update/anim entry points used by app.js listeners
    updateCornerWizard() { return viewByType.get('corner').update(this); }
    updateMiddleWizard() { return viewByType.get('middle').update(this); }
    updateEdgeWizard() { return viewByType.get('edge').update(this); }
    updateAlignmentWizard() { return viewByType.get('alignment').update(this); }
    updateCommunicationWizard() { return viewByType.get('comm').update(this); }
    updateWCSWizard() { return viewByType.get('wcs').update(this); }
    updateAtcLengthWizard() { return viewByType.get('atc_length').update(this); }
    updateAtcWarmupWizard() { return viewByType.get('atc_warmup').update(this); }
    updateAtcChangeWizard() { return viewByType.get('atc_change').update(this); }
    _startCornerAnim() { viewByType.get('corner').startAnim(); }
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
            const ops = await import('./blocks/opStacks.js');
            if (this.editingOpId) {
                // EDIT: rebuild THIS op from the new params (single source of truth) and replace it in place.
                const { getLastOp } = await import('./blocks/opRecord.js');
                const op = getLastOp();
                committed = op ? ops.replaceOp(this.editingOpId, op.params) : false;
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

        // do not fire reverse sound when closing as part of insertion
        this.close(false);
    }

    // Render the wizard's generated G-code in the active wizard's viz area using THE shared preview panel
    // (identical code + UI to Studio main + Blocks). The SVG schematic is hidden (kept in wizards/views/* +
    // _svgPreview.bak.js for the DDCS CAM-menu thumbnails). The wizard feeds its own op code + inferred start.
    preview3D(gcode, containerId, start) {
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
                onLine: (i) => this._highlightWizLine(host, i),   // play → highlight the executing line in the CODE PREVIEW (like Studio main)
            });
        }
        svgCont.style.display = 'none';
        host.__gcode = gcode || '';
        host.__start = start || null;
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

    // Draw the ATC magazine (pockets + tool stubs) in the 3D preview on the machine envelope. Opt-in (ATC wizards
    // only) — call AFTER preview3D so the panel/viz exists. pockets = [{x,y,z,dia,length,pocket,tool,color}].
    previewMagazine(containerId, pockets) {
        const svgCont = document.getElementById(containerId);
        const host = svgCont && svgCont.parentElement && svgCont.parentElement.querySelector('.wiz-viz3d');
        const viz = host && host.__panel && host.__panel.viz;
        if (viz && viz.setMagazine) viz.setMagazine(pockets || []);
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
