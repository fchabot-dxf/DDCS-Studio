/**
 * DDCS Studio Wizard Manager
 *
 * Generic wizard-dialog coordinator. Everything wizard-SPECIFIC (DOM ids,
 * params reading, previews, SVG animators) lives in the per-wizard view
 * modules under wizards/views/ — this class only handles the shared overlay,
 * event wiring, dispatch, insert and the shared 3D preview host.
 */

import { el } from './ui/uiUtils.js';
import { WIZARD_VIEWS, viewByType } from './wizards/views/index.js';
import { playClick, playClickReverse } from './ui/sound.js';  // audio helper for click sounds
import { GcodeViz3D } from './viz/gcodeViz3d.js';
import { parseGcode } from './gcodeParser.js';

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
    preview3D(gcode, containerId) {
        const svgCont = document.getElementById(containerId);
        if (!svgCont || !svgCont.parentElement) return;
        const parent = svgCont.parentElement; // .viz-container
        // Dedicated host beside the SVG (the SVG is injected via innerHTML and would wipe a
        // canvas placed inside it). Hide the SVG schematic in favour of the 3D view.
        let host = parent.querySelector('.wiz-viz3d');
        if (!host) {
            host = document.createElement('div');
            host.className = 'wiz-viz3d';
            host.style.cssText = 'position:relative; width:100%; height:220px;';
            parent.insertBefore(host, svgCont);
            // Controls cloned from the main 3D viewer: stock shape + Play/Stop (default play)
            const ctrls = document.createElement('div');
            ctrls.className = 'viz3d-controls';
            ctrls.innerHTML =
                '<label>Stock <select class="wiz-shape"><option value="boss">Boss</option><option value="pocket">Pocket</option></select></label>' +
                '<button type="button" class="wiz-play on">⏸ Stop</button>';
            host.appendChild(ctrls);
            ctrls.querySelector('.wiz-shape').addEventListener('change', (e) => {
                if (window.ddcsApplySettings) window.ddcsApplySettings({ stock: { shape: e.target.value } });
                this._refresh3DStock();
            });
            ctrls.querySelector('.wiz-play').addEventListener('click', (e) => {
                if (!this._wizViz) return;
                const on = !this._wizViz._animOn;
                this._wizViz.setAnimate(on);
                e.target.classList.toggle('on', on);
                e.target.textContent = on ? '⏸ Stop' : '▶ Play';
            });
        }
        svgCont.style.display = 'none';
        try {
            if (!this._wizViz) { this._wizViz = new GcodeViz3D(host); this._wizViz._gizmoPx = 32; }
            this._wizViz.attach(host);
            this._wizViz.setActive(true);
            this._refresh3DStock();
            this._wizViz.setSegments(parseGcode(gcode || ''));
            const sel = host.querySelector('.wiz-shape');
            if (sel && window.ddcsGetSettings) sel.value = (window.ddcsGetSettings().stock || {}).shape || 'boss';
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
