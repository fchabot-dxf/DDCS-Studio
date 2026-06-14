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
import { CONTROLLER_PROFILES, getActiveProfile, setActiveProfile } from './shared/js/profiles/controllerProfiles.js';
import { GcodeViz3D } from './viz/gcodeViz3d.js';
import { parseGcode } from './gcodeParser.js';
import { createToolpath2d } from './viz/toolpath2d.js';   // shared 2D toolpath view (uniform with Blocks/Studio)

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
        // Click outside wizard to close
        this.wizardElement.addEventListener('click', (e) => {
            if (e.target.id === 'wizard') {
                this.close();
            }
        });

        // Drag the whole generator by its header bar (but not the profile select / gear / close).
        const box = this.wizardElement.querySelector('.wiz-box');
        const head = box && box.querySelector('.wiz-head');
        if (box && head) makeDraggable(box, head, { ignore: 'select, button, input, .wiz-gear, .wiz-close' });

        // Settings (stock/probe/machine) changed — if a wizard is open, re-run its update() so the
        // preview + the inferred spindle start track the new values live (e.g. editing stock size via
        // the in-wizard ⚙). Read-only re-render; never writes settings, so no loop.
        window.addEventListener('ddcs:settings-changed', () => {
            if (this.wizardElement && this.wizardElement.classList.contains('active')) this.update();
        });

        // Active-controller-profile chip in the shared wizard header — shows + switches the GLOBAL
        // profile so generated code matches the machine's dialect (not a per-wizard override).
        const prof = el('wizProfile');
        if (prof) prof.addEventListener('change', () => {
            setActiveProfile(prof.value);
            // Also switch the variable list to match the controller (the var DB fires variableDB:ready,
            // which the command deck's controller selector listens to, so everything stays in sync).
            const p = CONTROLLER_PROFILES[prof.value];
            const vdb = window.ddcsStudio && window.ddcsStudio.variableDB;
            if (p && p.varFamily && vdb) vdb.setControllerVars(p.varFamily);
            window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));   // re-render the open wizard with the new dialect
        });

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

    /** Refresh the header profile chip (options + current selection) — shows which machine you're generating for. */
    syncProfileChip() {
        const prof = el('wizProfile');
        if (!prof) return;
        prof.innerHTML = Object.values(CONTROLLER_PROFILES)
            .map((p) => `<option value="${p.id}">${p.name}${p.source === 'controller' ? ' (from controller)' : ''}</option>`).join('');
        prof.value = getActiveProfile().id;
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

    open(type) {
        // play a feedback sound whenever a wizard is opened
        playClick();

        const view = viewByType.get(type) || null;
        const box = document.querySelector('.wiz-box');
        // Re-centre on open: clear any drag offset left from a previous session.
        if (box) Object.assign(box.style, { position: '', left: '', top: '', right: '', bottom: '', transform: '', margin: '' });
        this._wizNeedsFit = true;   // frame the 3D preview once on open; input-change re-renders keep the camera
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
            if (view && typeof view.onShow === 'function') view.onShow(this);
            decorateProbeSrc(view);   // controller/Studio source chips (before first generate)
            this.syncProfileChip();   // show which controller profile this code targets
            this.applyProbeDefaults();   // seed probe fields from the global 3D-probe defaults
            // Ensure fields & preview reflect current defaults immediately
            this.update();
            if (view && typeof view.onOpen === 'function') view.onOpen(this);
        }
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
        // Hide overlay and clear active state
        this.wizardElement.classList.remove('active');
        this.wizardElement.style.display = 'none';
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

    insert() {
        const view = this.activeView();
        const code = view ? el(view.codeElId)?.textContent : '';

        if (code) {
            this.editorManager.insert(code);
            // Carry the start position the user set in this wizard's 3D preview over to the main preview.
            // Apply now if the main viz exists; stash it so it's also applied when the main view next renders.
            try {
                const ws = (this._wizViz && this._wizViz.starts) ? this._wizViz.starts[0] : null;
                if (ws) {
                    window.__pendingSpindleStart = { x: ws.x, y: ws.y, z: ws.z };
                    if (window.ddcsSetSpindleStart) window.ddcsSetSpindleStart(ws.x, ws.y, ws.z, 0);
                }
            } catch (e) { /* preview is optional */ }
            // play click on successful insert
            playClick();
        } else {
            console.warn('WizardManager: No visible wizard or empty code.');
        }

        // do not fire reverse sound when closing as part of insertion
        this.close(false);
    }

    // Render the generated G-code as a live 3D toolpath in the active wizard's viz area
    // (a shared GcodeViz3D moved between wizards; replaces the SVG schematic).
    preview3D(gcode, containerId, start) {
        const svgCont = document.getElementById(containerId);
        if (!svgCont || !svgCont.parentElement) return;
        const parent = svgCont.parentElement; // .viz-container
        // Dedicated host beside the SVG (the SVG is injected via innerHTML and would wipe a
        // canvas placed inside it). Hide the SVG schematic in favour of the 3D view.
        let host = parent.querySelector('.wiz-viz3d');
        if (!host) {
            host = document.createElement('div');
            host.className = 'wiz-viz3d';
            host.style.cssText = 'position:relative; width:100%;';   // height via CSS (.wiz-viz3d) so two-pane can grow it
            parent.insertBefore(host, svgCont);
            // Canonical path legend — the 3D colour scheme is identical in every wizard, so define it
            // once here and drop it into the visual pane, replacing any inline legend. Includes the
            // Cut colour (blue→cyan depth gradient) that the per-wizard legends were missing.
            const visual = host.closest('.wiz-visual') || parent;
            if (visual) {
                const oldLeg = visual.querySelector('.viz-legend');
                if (oldLeg) oldLeg.remove();
                const lg = document.createElement('div');
                lg.className = 'viz-legend';
                lg.innerHTML =
                    '<div class="viz-legend-item"><div class="viz-legend-line cut"></div>Cut</div>' +
                    '<div class="viz-legend-item"><div class="viz-legend-line travel"></div>Rapid</div>' +
                    '<div class="viz-legend-item"><div class="viz-legend-line retract"></div>Retract</div>' +
                    '<div class="viz-legend-item"><div class="viz-legend-line probe"></div>Probe</div>' +
                    '<div class="viz-legend-item"><div class="viz-legend-line jog"></div>Jog</div>';
                visual.appendChild(lg);
            }
            // Shared 2D toolpath view (covers the 3D when active) + its controller, so the wizard preview has
            // the same 2D/3D + Play surface as the Blocks tab and Studio main.
            const cv = document.createElement('canvas');
            cv.className = 'wiz-viz2d';
            cv.style.cssText = 'width:100%; height:100%; display:none; background:#0d1117;';
            host.appendChild(cv);
            host.__t2 = createToolpath2d(cv);
            // Controls: [2D | 3D] toggle + Play/Stop (Play = 2D progressive reveal, or the 3D animation).
            const ctrls = document.createElement('div');
            ctrls.className = 'viz3d-controls';
            ctrls.innerHTML =
                '<span class="seg"><button type="button" class="wiz-m2d op-btn">2D</button>' +
                '<button type="button" class="wiz-m3d op-btn primary">3D</button></span>' +
                '<button type="button" class="wiz-play on">⏸ Stop</button>';
            host.appendChild(ctrls);
            ctrls.querySelector('.wiz-m2d').addEventListener('click', () => this._setWizPreviewMode('2d', host));
            ctrls.querySelector('.wiz-m3d').addEventListener('click', () => this._setWizPreviewMode('3d', host));
            ctrls.querySelector('.wiz-play').addEventListener('click', (e) => {
                let on;
                if (this._wizPreviewMode === '2d') on = host.__t2.toggle();
                else { if (!this._wizViz) return; on = !this._wizViz._animOn; this._wizViz.setAnimate(on); }
                e.target.classList.toggle('on', on);
                e.target.textContent = on ? '⏸ Stop' : '▶ Play';
            });
        }
        svgCont.style.display = 'none';
        host.__gcode = gcode || '';
        host.__start = start || null;
        if (!this._wizPreviewMode) this._wizPreviewMode = '3d';
        this._renderWizPreview(host);
    }

    /** Switch the wizard preview between 2D and 3D (shared across wizards), reset the Play button, re-render. */
    _setWizPreviewMode(mode, host) {
        this._wizPreviewMode = mode;
        const c = host.querySelector('.viz3d-controls');
        if (c) {
            c.querySelector('.wiz-m2d').classList.toggle('primary', mode === '2d');
            c.querySelector('.wiz-m3d').classList.toggle('primary', mode === '3d');
            const pb = c.querySelector('.wiz-play'); if (pb) { pb.classList.remove('on'); pb.textContent = '▶ Play'; }
        }
        this._renderWizPreview(host);
    }

    /** Render the active view (2D shared canvas or the 3D GcodeViz3D) from host.__gcode. */
    _renderWizPreview(host) {
        const cv = host.querySelector('.wiz-viz2d');
        const r3d = this._wizViz && this._wizViz.renderer ? this._wizViz.renderer.domElement : null;
        if (this._wizPreviewMode === '2d') {
            if (cv) cv.style.display = '';
            if (this._wizViz) { this._wizViz.setAnimate(false); this._wizViz.setActive(false); }
            if (r3d) r3d.style.display = 'none';
            if (host.__t2) host.__t2.setGcode(host.__gcode);
            return;
        }
        if (cv) cv.style.display = 'none';
        if (host.__t2) host.__t2.stop();
        try {
            if (!this._wizViz) { this._wizViz = new GcodeViz3D(host); this._wizViz._gizmoPx = 32; }
            this._wizViz.attach(host);
            if (this._wizViz.renderer && this._wizViz.renderer.domElement) this._wizViz.renderer.domElement.style.display = '';
            this._wizViz.setActive(true);
            this._refresh3DStock();
            // Position the start marker BEFORE setSegments so the incremental probe path is offset to it
            // (the inferred spindle start for this corner/config). setSegments keeps starts[0]. Preview hint
            // only — the user can still drag to override. Re-set each render so it tracks the config.
            const start = host.__start;
            if (start && this._wizViz.starts) this._wizViz.starts[0] = { x: +start.x || 0, y: +start.y || 0, z: +start.z || 0 };
            this._wizViz.setSegments(parseGcode(host.__gcode || ''), this._wizNeedsFit !== false);
            this._wizNeedsFit = false;   // subsequent input-change re-renders keep the camera
        } catch (e) { console.warn('wizard 3D preview failed', e); }
    }

    // Old private name kept as an alias for any external callers
    _preview3D(gcode, containerId) { return this.preview3D(gcode, containerId); }

    _refresh3DStock() {
        if (this._wizViz && window.ddcsGetSettings) {
            try { this._wizViz.setStock(window.ddcsGetSettings().stock); } catch (e) { /* ignore */ }
            try { this._wizViz.setProbes(window.ddcsGetSettings().probes); } catch (e) { /* ignore */ }
        }
    }

    togglePreview() {
        const commPreview = el('comm_preview_block');
        const wcsPreview = el('wcs_preview_block');
        const probePreview = el('probe_preview_block');

        if (commPreview) commPreview.classList.toggle('hidden');
        if (wcsPreview) wcsPreview.classList.toggle('hidden');
        if (probePreview) probePreview.classList.toggle('hidden');
    }
}
