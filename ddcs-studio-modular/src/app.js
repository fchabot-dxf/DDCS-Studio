/**
 * DDCS Studio - Main Application
 * Version 9.49 - Modular ES6 Edition
 * 
 * CNC G-code Generator for DDCS Expert M350 Controller
 */

import { ThemeManager } from './themes.js';
import { ScaleManager } from './scaleManager.js';
import { VariableDatabase } from './variableDB.js';
import { EditorManager } from './editorManager.js';
import { DockManager } from './dockManager.js';
import { WizardManager } from './wizardManager.js';
import { el } from './uiUtils.js';
import { CornerVizAnimator } from './cornerVizAnimator.js';
import { playClick } from './sound.js';  // click feedback sound
// Edge viz animator (registers `window.EdgeVizAnimator`)
import './edgeVizAnimator.js';
// Alignment viz animator (registers `window.AlignVizAnimator`)
import './alignVizAnimator.js';

// MiddleViz helpers (animation, id mapping, visibility controller)
import './middleVizUtils.js';
import './middleVizAnimator.js';
import './middleVizManager.js';

class DDCSStudio {
    constructor() {
        this.themeManager = new ThemeManager();
        console.debug('DDCSStudio: ThemeManager initialized');
        this.scaleManager = new ScaleManager();
        console.debug('DDCSStudio: ScaleManager initialized');
        this.variableDB = new VariableDatabase();
        console.debug('DDCSStudio: VariableDatabase initialized');
        this.editorManager = new EditorManager();
        console.debug('DDCSStudio: EditorManager initialized');
        this.dockManager = new DockManager(this.variableDB, this.editorManager);
        console.debug('DDCSStudio: DockManager initialized');
        this.wizardManager = new WizardManager(this.editorManager);
        console.debug('DDCSStudio: WizardManager initialized');

        console.debug('DDCSStudio: calling init()');
        this.init();
    }

    init() {
        console.debug('DDCSStudio.init() start');
        // Setup global window functions for backwards compatibility
        this.setupGlobalFunctions();
        console.debug('DDCSStudio.init() - setupGlobalFunctions complete');

        // Enforce numeric-only input on generator numeric fields
        this.setupNumericInputGuards();

        // Setup file upload handler
        this.setupFileUpload();

        // Setup window resize handler
        window.addEventListener('resize', () => {
            if (this.scaleManager.isAutoScale()) {
                this.scaleManager.apply();
            }
        });

        // Visual Viewport -> detect virtual keyboard on mobile (adds/removes `keyboard-active` on <body>)
        if (window.visualViewport) {
            // track previous keyboard state so we only play sound when it opens
            this._keyboardActive = false;

            const _checkKeyboard = () => {
                try {
                    const vv = window.visualViewport;
                    const newActive = vv && vv.height < window.innerHeight * 0.8;

                    if (newActive && !this._keyboardActive) {
                        // keyboard just opened
                        playClick();
                    }
                    this._keyboardActive = newActive;

                    if (newActive) {
                        document.body.classList.add('keyboard-active');
                    } else {
                        document.body.classList.remove('keyboard-active');
                    }
                } catch (e) { /* noop */ }
            };
            window.visualViewport.addEventListener('resize', _checkKeyboard);
            window.visualViewport.addEventListener('scroll', _checkKeyboard);
            // initial check
            _checkKeyboard();
        }

        // Apply initial scale
        this.scaleManager.apply();

        // Initialize corner visualization
        this.initializeCornerVisualization();
        this.setupVisualizationListeners();

        // Log layout snapshot for debugging: sizes, transforms, and visibility
        window.addEventListener('scaleChanged', (ev) => {
            console.debug('scaleChanged event received', ev.detail);
            this.logLayoutSnapshot();
        });
        // initial snapshot
        this.logLayoutSnapshot();
    }

    logLayoutSnapshot() {
        try {
            const bodyScale = document.body.getAttribute('data-scale');
            const bodyStyle = getComputedStyle(document.body);
            const appShell = document.querySelector('.app-shell');
            const main = document.querySelector('.main');
            const editor = document.getElementById('editor');
            const varList = document.getElementById('varList');
            const wizard = document.getElementById('wizard');

            const shellRect = appShell ? appShell.getBoundingClientRect() : null;
            const mainRect = main ? main.getBoundingClientRect() : null;
            const editorRect = editor ? editor.getBoundingClientRect() : null;

            console.debug('LayoutSnapshot', {
                bodyScale,
                bodyTransform: bodyStyle.transform,
                bodyClient: { w: document.body.clientWidth, h: document.body.clientHeight },
                appShellTransform: appShell ? getComputedStyle(appShell).transform : null,
                appShellRect: shellRect && { x: Math.round(shellRect.x), y: Math.round(shellRect.y), w: Math.round(shellRect.width), h: Math.round(shellRect.height) },
                mainRect: mainRect && { x: Math.round(mainRect.x), y: Math.round(mainRect.y), w: Math.round(mainRect.width), h: Math.round(mainRect.height) },
                editorRect: editorRect && { w: Math.round(editorRect.width), h: Math.round(editorRect.height) },
                editorClientHeight: editor ? editor.clientHeight : null,
                varListChildCount: varList ? varList.querySelectorAll('.var-item').length : 0,
                wizardDisplay: wizard ? getComputedStyle(wizard).display : 'missing'
            });
        } catch (err) {
            console.warn('logLayoutSnapshot failed', err);
        }
    }

    setupGlobalFunctions() {
        // Expose key functions to global scope for HTML onclick handlers
        window.toggleStyle = () => this.themeManager.toggle();
        window.toggleScale = () => this.scaleManager.toggle();
        window.saveDefaults = () => this.saveDefaults();
        window.copyCode = () => this.editorManager.copyCode();
        window.clearCode = () => this.editorManager.clearCode();
        window.downloadFile = () => this.editorManager.downloadFile();
        window.clearSearch = () => this.dockManager.clear();
        window.insert = (key, text) => this.editorManager.insert(key, text);
        window.backspace = () => this.editorManager.backspace();

        // Wizard functions
        window.openWiz = (type) => this.wizardManager.open(type);
        window.openCornerWiz = () => this.wizardManager.openCorner();
        window.openMiddleWiz = () => this.wizardManager.openMiddle();
        window.CornerVizAnimator = CornerVizAnimator;
        window.openEdgeWiz = () => this.wizardManager.openEdge();
        window.openAlignmentWiz = () => this.wizardManager.openAlignment();
        window.closeWiz = () => this.wizardManager.close();
        window.insertWiz = () => this.wizardManager.insert();
        window.togglePreview = () => this.wizardManager.togglePreview();
        window.updateWiz = () => this.wizardManager.update();

        // Communication wizard: audible beep preview (Web Audio)
        window.playCommBeepPreview = async (durationMs = 500, cycleMs = 0) => {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;

                const parsedDur = Number(durationMs);
                const parsedCycle = Number(cycleMs);
                const dur = Number.isFinite(parsedDur) && parsedDur > 0 ? parsedDur : 500;
                const cycle = Number.isFinite(parsedCycle) && parsedCycle > 0 ? parsedCycle : 0;

                if (!window.__commBeepAudioCtx) {
                    window.__commBeepAudioCtx = new AudioCtx();
                }
                const ctx = window.__commBeepAudioCtx;
                if (ctx.state === 'suspended') await ctx.resume();

                // Stop any currently playing preview tone before starting a new one
                if (window.__commBeepNodes) {
                    try { window.__commBeepNodes.oscillator.stop(); } catch (e) { /* noop */ }
                    try { window.__commBeepNodes.oscillator.disconnect(); } catch (e) { /* noop */ }
                    try { window.__commBeepNodes.gainNode.disconnect(); } catch (e) { /* noop */ }
                    window.__commBeepNodes = null;
                }

                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();
                oscillator.type = 'square';
                oscillator.frequency.value = 850;

                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);

                const start = ctx.currentTime + 0.01;
                const end = start + (dur / 1000);
                gainNode.gain.cancelScheduledValues(start);
                gainNode.gain.setValueAtTime(0, start);

                if (cycle > 0) {
                    const pulse = cycle / 1000;
                    let time = start;
                    while (time < end) {
                        const onStart = time;
                        const onEnd = Math.min(onStart + pulse, end);
                        gainNode.gain.setValueAtTime(0.16, onStart);
                        gainNode.gain.setValueAtTime(0.16, onEnd);
                        gainNode.gain.setValueAtTime(0, onEnd);
                        time += pulse * 2;
                    }
                } else {
                    gainNode.gain.setValueAtTime(0.16, start);
                    gainNode.gain.setValueAtTime(0, end);
                }

                window.__commBeepNodes = { oscillator, gainNode };
                oscillator.onended = () => {
                    try { oscillator.disconnect(); } catch (e) { /* noop */ }
                    try { gainNode.disconnect(); } catch (e) { /* noop */ }
                    if (window.__commBeepNodes && window.__commBeepNodes.oscillator === oscillator) {
                        window.__commBeepNodes = null;
                    }
                };

                oscillator.start(start);
                oscillator.stop(end);
            } catch (err) {
                console.warn('Beep preview failed', err);
            }
        };

        // Insert in message function for wizards
        window.insertInMsg = (t) => {
            const i = el('c_msg');
            if (i) {
                i.value = i.value.slice(0, i.selectionStart) + t + i.value.slice(i.selectionEnd);
                this.wizardManager.update();
                i.focus();
            }
        };
    }

    setupFileUpload() {
        const csvInput = el('csvInput');
        if (!csvInput) return;

        csvInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                this.variableDB.loadFromCSV(e.target.result);
            };
            reader.readAsText(file);
        });
    }

    setupNumericInputGuards() {
        const ALLOWED_INTEGER_CHARS = new Set('0123456789'.split(''));
        const ALLOWED_DECIMAL_CHARS = new Set('0123456789.'.split(''));
        const CONTROL_KEYS = new Set([
            'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
            'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
            'Home', 'End'
        ]);

        // Numeric input policy table (single source of truth)
        // - integer: digits only (0-9)
        // - decimal: digits + one decimal point (0-9 and .)
        // - signed variants can be added later if needed
        const NUMERIC_INPUT_POLICY = {
            integer: [
                'c_dist', 'c_retract', 'c_safe_z', 'c_travel_dist', 'c_port',
                'm_port', 'p_port', 'al_port',
                'c_cycle', 'c_id', 'c_status_dwell',
                'c_slot1', 'c_slot2', 'c_slot3', 'c_slot4'
            ],
            decimal: [
                'c_feed_fast', 'c_feed_slow',
                'm_dist', 'm_retract', 'm_safe_z', 'm_feed_fast', 'm_feed_slow',
                'p_dist', 'p_retract', 'p_feed_fast', 'p_feed_slow',
                'al_dist', 'al_retract', 'al_safe_z', 'al_tolerance', 'al_feed_fast', 'al_feed_slow',
                'c_val'
            ]
        };

        const integerFieldIds = NUMERIC_INPUT_POLICY.integer;
        const decimalFieldIds = NUMERIC_INPUT_POLICY.decimal;

        const numericFieldIds = [...integerFieldIds, ...decimalFieldIds];

        const sanitizeNumeric = (value, allowDecimal, allowNegative) => {
            let text = String(value ?? '');
            text = text.replace(/[^\d.\-]/g, '');

            if (allowNegative) {
                text = text.replace(/(?!^)-/g, '');
            } else {
                text = text.replace(/-/g, '');
            }

            if (allowDecimal) {
                const firstDot = text.indexOf('.');
                if (firstDot !== -1) {
                    text = text.slice(0, firstDot + 1) + text.slice(firstDot + 1).replace(/\./g, '');
                }
            } else {
                text = text.replace(/\./g, '');
            }

            return text;
        };

        numericFieldIds.forEach((id) => {
            const input = el(id);
            if (!input) return;

            const allowDecimal = decimalFieldIds.includes(id);
            const allowNegative = false;
            const allowedChars = allowDecimal ? ALLOWED_DECIMAL_CHARS : ALLOWED_INTEGER_CHARS;

            input.setAttribute('inputmode', allowDecimal ? 'decimal' : 'numeric');
            input.setAttribute('autocomplete', 'off');

            const currentType = (input.getAttribute('type') || '').toLowerCase();
            if (!currentType) input.setAttribute('type', 'text');

            if (input.dataset.numericGuardBound === 'true') return;
            input.dataset.numericGuardBound = 'true';

            input.addEventListener('keydown', (e) => {
                if (!e.key) return;
                if (e.ctrlKey || e.metaKey || e.altKey) return;
                if (CONTROL_KEYS.has(e.key)) return;
                if (e.key.length !== 1) return;

                if (!allowedChars.has(e.key)) {
                    e.preventDefault();
                    return;
                }

                if (e.key === '.') {
                    if (!allowDecimal) {
                        e.preventDefault();
                        return;
                    }
                    const start = input.selectionStart ?? 0;
                    const end = input.selectionEnd ?? 0;
                    const nextValue = input.value.slice(0, start) + e.key + input.value.slice(end);
                    if ((nextValue.match(/\./g) || []).length > 1) {
                        e.preventDefault();
                        return;
                    }
                }

                if (e.key === '-') {
                    if (!allowNegative) {
                        e.preventDefault();
                        return;
                    }
                }
            });

            input.addEventListener('input', () => {
                const cleaned = sanitizeNumeric(input.value, allowDecimal, allowNegative);
                if (cleaned !== input.value) {
                    input.value = cleaned;
                }
            });

            // Sanitize initial values too
            input.value = sanitizeNumeric(input.value, allowDecimal, allowNegative);
        });
    }

    initializeCornerVisualization() {
        document.addEventListener('DOMContentLoaded', () => {
            const cornerVizCorner = document.getElementById('cornerVizCorner');
            if (cornerVizCorner) {
                ['cornerFL', 'cornerFR', 'cornerBL', 'cornerBR'].forEach(cornerId => {
                    const corner = cornerVizCorner.querySelector('#' + cornerId);
                    if (corner) {
                        const yxSeq = corner.querySelector('[id^="probeYX"]');
                        const xySeq = corner.querySelector('[id^="probeXY"]');
                        if (yxSeq) yxSeq.style.display = 'none';
                        if (xySeq) xySeq.style.display = 'none';
                    }
                });
            }
        });
    }

    setupVisualizationListeners() {
        // Corner wizard visualization listeners
        ['c_corner', 'c_probe_seq', 'c_probe_z_first'].forEach(id => {
            const elem = el(id);
            if (elem) {
                elem.addEventListener('change', () => {
                    if (el('wiz_corner').style.display !== 'none') {
                        if (window.drawCornerViz) {
                            window.drawCornerViz();
                        }
                    }
                });
            }
        });

        // Middle wizard visualization listeners
        ['m_type', 'm_axis', 'm_dir', 'm_dir2', 'm_both', 'm_animate'].forEach(id => {
            const elem = el(id);
            if (elem) {
                elem.addEventListener('change', () => {
                    if (el('wiz_middle').style.display !== 'none') {
                        // Call the full update which triggers both viz and animation
                        if (this.wizardManager && this.wizardManager.updateMiddleWizard) {
                            this.wizardManager.updateMiddleWizard();
                        } else if (window.drawMiddleViz) {
                            window.drawMiddleViz();
                        }
                    }
                });
            }
        });

        // Edge/probe visualization listeners — wire to actual control IDs
        ['p_axis', 'p_dir', 'p_animate'].forEach(id => {
            const elem = el(id);
            if (elem) {
                elem.addEventListener('change', () => {
                    // Only update when the Edge wizard panel is visible
                    if (el('wiz_edge') && el('wiz_edge').style.display !== 'none') {
                        if (window.drawEdgeViz) window.drawEdgeViz();
                        else if (window.drawProbeViz) window.drawProbeViz();

                        // Ensure wizard manager refreshes its state and (re)starts animator
                        if (this.wizardManager && this.wizardManager.updateEdgeWizard) this.wizardManager.updateEdgeWizard();
                        if (this.wizardManager && this.wizardManager._startEdgeAnim) this.wizardManager._startEdgeAnim();
                    }
                });
            }
        });

        // Alignment visualization listeners
        ['al_check_axis', 'al_probe_dir', 'al_animate'].forEach(id => {
            const elem = el(id);
            if (elem) {
                elem.addEventListener('change', () => {
                    if (el('wiz_alignment') && el('wiz_alignment').style.display !== 'none') {
                        if (window.drawAlignmentViz) window.drawAlignmentViz();
                        if (this.wizardManager && this.wizardManager.updateAlignmentWizard) this.wizardManager.updateAlignmentWizard();
                    }
                });
            }
        });
    }

    openCorner() {
        this.open('corner');
        setTimeout(() => {
            if (window.drawCornerViz) window.drawCornerViz();
            this.updateCornerWizard();
        }, 10);
    }

    openMiddle() {
        this.open('middle');
        setTimeout(() => {
            if (window.drawMiddleViz) window.drawMiddleViz();
            this.updateMiddleWizard();
        }, 10);
    }

    openEdge() {
        this.open('edge');
        setTimeout(() => {
            if (window.drawProbeViz) window.drawProbeViz();
            this.updateEdgeWizard();
        }, 10);
    }

    saveDefaults() {
        // All wizard input IDs to snapshot
        const inputIds = [
            'c_corner', 'c_probe_seq', 'c_wcs',
            'c_dist', 'c_retract', 'c_safe_z', 'c_travel_dist', 'c_scan_depth',
            'c_feed_fast', 'c_feed_slow', 'c_port', 'c_level', 'c_q', 'c_slave',
            'm_type', 'm_axis', 'm_dir', 'm_dir2', 'm_wcs',
            'm_dist', 'm_retract', 'm_safe_z', 'm_feed_fast', 'm_feed_slow',
            'm_port', 'm_level', 'm_q', 'm_slave',
            'p_axis', 'p_dir', 'p_wcs',
            'p_dist', 'p_retract', 'p_feed_fast', 'p_feed_slow',
            'p_port', 'p_level', 'p_q', 'p_slave',
            'al_check_axis', 'al_probe_dir',
            'al_dist', 'al_retract', 'al_safe_z', 'al_tolerance',
            'al_feed_fast', 'al_feed_slow', 'al_port', 'al_level', 'al_q',
            'w_sys', 'w_slave',
            'c_type'
        ];
        const checkboxIds = [
            'c_probe_z_first', 'c_sync_a', 'c_animate',
            'm_both', 'm_sync_a', 'm_animate',
            'p_sync_a', 'p_animate',
            'al_animate',
            'w_x', 'w_y', 'w_z', 'w_sync'
        ];

        // Capture live values
        const values = {};
        inputIds.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) values[id] = elem.value;
        });
        const checked = {};
        checkboxIds.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) checked[id] = elem.checked;
        });

        // Snapshot only user-defined variable entries (tiny — system defaults are baked into the build)
        // Embed as window.__ddcs_user_vars so variableDB.js can read it synchronously at init,
        // before any async module loading — localStorage timing is unreliable on a fresh machine.
        const userEntries = this.variableDB ? this.variableDB.getAll().filter(e => !e.isSys) : [];

        // Build patched HTML with saved defaults block
        const buildHtml = () => {
            let html = document.documentElement.outerHTML;
            const restoreScript = `<script id="__saved_defaults">
(function(){
    var values = ${JSON.stringify(values)};
    var checked = ${JSON.stringify(checked)};
    // User variable entries embedded at download time — read synchronously by variableDB.js
    window.__ddcs_user_vars = ${JSON.stringify(userEntries)};
    function restore() {
        Object.keys(values).forEach(function(id){ var e=document.getElementById(id); if(e) e.value=values[id]; });
        Object.keys(checked).forEach(function(id){ var e=document.getElementById(id); if(e) e.checked=checked[id]; });
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', restore); } else { restore(); }
    window.addEventListener('load', function(){ setTimeout(restore, 300); });
})();
<\/script>`;
            html = html.replace(/<script id="__saved_defaults"[\s\S]*?<\/script>\s*/g, '');
            html = html.replace('</body>', restoreScript + '\n</body>');
            return html;
        };

        // Download the patched HTML
        const html = buildHtml();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ddcs-studio-standalone.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
}

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.ddcsStudio = new DDCSStudio();
    });
} else {
    window.ddcsStudio = new DDCSStudio();
}

export default DDCSStudio;
