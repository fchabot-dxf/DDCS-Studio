/**
 * DDCS Studio Wizard Manager
 * Coordinates all wizard dialogs and code generation
 */

import { el, UIUtils } from './uiUtils.js';
import { CornerWizard } from './wizards/cornerWizard.js';
import { MiddleWizard } from './wizards/middleWizard.js';
import { EdgeWizard } from './wizards/edgeWizard.js';
import { CommunicationWizard } from './wizards/communicationWizard.js';
import { WCSWizard } from './wizards/wcsWizard.js';
import { AlignmentWizard } from './wizards/alignmentWizard.js';
import { playClick, playClickReverse } from './sound.js';  // audio helper for click sounds

export class WizardManager {
    constructor(editorManager) {
        this.editorManager = editorManager;
        this.cornerWizard = new CornerWizard();
        this.middleWizard = new MiddleWizard();
        this.edgeWizard = new EdgeWizard();
        this.communicationWizard = new CommunicationWizard();
        this.wcsWizard = new WCSWizard();
        this.alignmentWizard = new AlignmentWizard();
        this.wizardElement = el('wizard');
        console.debug('WizardManager: constructor - created wizards, wizardElement=', !!this.wizardElement);
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
        const wizInputs = [
            'c_type', 'c_msg', 'c_val', 'c_cycle', 'c_id', 'c_dest', 'c_popup_mode', 'c_status_mode', 'c_status_dwell', 'c_status_color',
            'c_slot1', 'c_slot2', 'c_slot3', 'c_slot4',
            'w_sys', 'w_x', 'w_y', 'w_z', 'w_sync', 'w_slave',
            'p_axis', 'p_dir', 'p_dist', 'p_feed_fast', 'p_feed_slow',
            'p_retract', 'p_port', 'p_level', 'p_q',
            'p_sync_a', 'p_wcs',
            'p_slave',
            'c_corner', 'c_probe_seq', 'c_probe_z_first', 'c_animate', 'c_sync_a', 'c_wcs',
            'c_travel_dist', 'c_safe_z', 'c_scan_depth', 'c_radius', 'c_feed_fast', 'c_feed_slow',
            'c_dist', 'c_retract', 'c_port', 'c_level', 'c_q',
            'c_slave',
            'm_type', 'm_axis', 'm_dir', 'm_dir2', 'm_both', 'm_sync_a', 'm_wcs',
            'm_slave',
            'm_dist', 'm_retract', 'm_safe_z',
            'm_feed_fast', 'm_feed_slow', 'm_port', 'm_level', 'm_q',
            'al_check_axis', 'al_probe_dir', 'al_animate',
            'al_tolerance', 'al_dist', 'al_retract', 'al_safe_z',
            'al_feed_fast', 'al_feed_slow', 'al_port', 'al_level', 'al_q'
        ];

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

    open(type) {
        // play a feedback sound whenever a wizard is opened
        playClick();

        const box = document.querySelector('.wiz-box');
        console.debug('WizardManager.open()', type, 'wizardElement=', this.wizardElement);
        if (!this.wizardElement) {
            console.warn('WizardManager.open(): no wizard container available');
            return;
        }
        
        if (type === 'probe' || type === 'corner' || type === 'middle' || type === 'edge' || type === 'alignment') {
            box.classList.add('large');
        } else {
            box.classList.remove('large');
        }

        // Ensure overlay is visible and mark active
        this.wizardElement.style.display = 'flex';
        this.wizardElement.classList.add('active');
        
        // Hide all wizard panels
        ['wiz_comm', 'wiz_wcs', 'wiz_corner', 'wiz_middle', 'wiz_edge', 'wiz_alignment'].forEach(id => {
            const elem = el(id);
            if (elem) elem.style.display = 'none';
        });

        // Show requested wizard
        const wizElem = el('wiz_' + type);
        if (wizElem) {
            wizElem.style.display = 'block';
            // Set default message text for comm wizard (clears on first edit)
            if (type === 'comm') {
                const msgEl = el('c_msg');
                if (msgEl && !msgEl.value) {
                    msgEl.value = 'Enter message...';
                    msgEl.dataset.isDefault = 'true';
                    if (!msgEl._defaultClearBound) {
                        msgEl._defaultClearBound = true;
                        msgEl.addEventListener('keydown', function clearDefault(e) {
                            if (msgEl.dataset.isDefault === 'true') {
                                msgEl.value = '';
                                delete msgEl.dataset.isDefault;
                            }
                        }, { once: false });
                        msgEl.addEventListener('focus', function() {
                            if (msgEl.dataset.isDefault === 'true') msgEl.select();
                        });
                    }
                }

                const valEl = el('c_val');
                if (valEl && !valEl._dwellDefaultClearBound) {
                    valEl._dwellDefaultClearBound = true;
                    valEl.addEventListener('beforeinput', () => {
                        const commTypeEl = el('c_type');
                        if (!commTypeEl || commTypeEl.value !== 'dwell') return;
                        if (valEl.dataset.isDwellDefault === 'true') {
                            valEl.value = '';
                            delete valEl.dataset.isDwellDefault;
                        }
                    });
                }
            }
            // Ensure fields & preview reflect current defaults immediately
            this.update();
        }

    }

    openCorner() {
        this.open('corner');
        // open() already calls update() → updateCornerWizard()
        // Just draw the SVG here — no extra updateCornerWizard call
        setTimeout(async () => {
            if (window.drawCornerViz) await window.drawCornerViz();
            this._startCornerAnim();
        }, 50);
    }

    _startCornerAnim() {
        const animate = el('c_animate')?.checked !== false;
        const corner  = el('c_corner')?.value || 'FL';
        const seq     = el('c_probe_seq')?.value || 'YX';
        const zfirst  = el('c_probe_z_first')?.checked || false;

        // Stop any running animation
        if (window.__cornerAnimator) { try { window.__cornerAnimator.stop(); } catch(e) {} }
        // Clear any pending start timer
        if (window.__cornerAnimStartTimer) { clearTimeout(window.__cornerAnimStartTimer); window.__cornerAnimStartTimer = null; }

        if (!animate) return;

        // Create instance once, reuse it — play() handles stopping old loops via token
        if (!window.__cornerAnimator && window.CornerVizAnimator) {
            window.__cornerAnimator = new window.CornerVizAnimator();
        }
        if (window.__cornerAnimator) {
            window.__cornerAnimStartTimer = setTimeout(() => {
                window.__cornerAnimStartTimer = null;
                window.__cornerAnimator.play(corner, seq, zfirst);
            }, 80);
        }
    }

    openMiddle() {
        this.open('middle');
        setTimeout(() => {
            this.updateMiddleWizard();
        }, 50);
    }

    openEdge() {
        this.open('edge');
        setTimeout(() => {
            // prefer specialized edge SVG loader when available
            if (window.drawEdgeViz) window.drawEdgeViz();
            else if (window.drawProbeViz) window.drawProbeViz();
            this.updateEdgeWizard();
            // start animator similar to corner animator
            setTimeout(() => { this._startEdgeAnim(); }, 60);
        }, 50);
    }

    _startEdgeAnim() {
        const animate = el('p_animate')?.checked !== false; // respect animate toggle in edge wizard
        const axis = el('p_axis')?.value || 'X';
        const dir = el('p_dir')?.value || 'pos';

        // Stop any running edge animator
        if (window.__edgeAnimator) { try { window.__edgeAnimator.stop(); } catch (e) {} }
        if (!window.__edgeAnimator && window.EdgeVizAnimator) {
            window.__edgeAnimator = new window.EdgeVizAnimator();
        }

        if (window.__edgeAnimator && animate) {
            if (window.__edgeAnimStartTimer) { clearTimeout(window.__edgeAnimStartTimer); window.__edgeAnimStartTimer = null; }
            window.__edgeAnimStartTimer = setTimeout(() => {
                window.__edgeAnimStartTimer = null;
                try { window.__edgeAnimator.play(axis, dir); } catch (e) { /* noop */ }
            }, 80);
        }
    }

    openAlignment() {
        this.open('alignment');
        setTimeout(() => {
            this.updateAlignmentWizard();
            setTimeout(() => { this._startAlignmentAnim(); }, 60);
        }, 50);
    }

    _startAlignmentAnim() {
        const animate = el('al_animate')?.checked !== false;
        const checkAxis = el('al_check_axis')?.value || 'X';
        const probeDir = el('al_probe_dir')?.value || 'pos';

        if (window.__alignAnimStartTimer) { clearTimeout(window.__alignAnimStartTimer); window.__alignAnimStartTimer = null; }
        if (window.__alignAnimator) { try { window.__alignAnimator.stop(); } catch (e) {} }
        if (!animate) return;

        if (!window.__alignAnimator && window.AlignVizAnimator) {
            window.__alignAnimator = new window.AlignVizAnimator();
        }

        if (window.__alignAnimator) {
            window.__alignAnimStartTimer = setTimeout(() => {
                window.__alignAnimStartTimer = null;
                try { window.__alignAnimator.play(checkAxis, probeDir); } catch (e) { /* noop */ }
            }, 80);
        }
    }

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
        // Defensive: some environments may call update() before all wizard panels exist in DOM
        const wizVisible = (id) => {
            const e = el(id);
            return e ? e.style.display !== 'none' : false;
        };

        const wizComm = wizVisible('wiz_comm');
        const wizWcs = wizVisible('wiz_wcs');
        const wizCorner = wizVisible('wiz_corner');
        const wizMiddle = wizVisible('wiz_middle');
        const wizEdge = wizVisible('wiz_edge');
        const wizAlignment = wizVisible('wiz_alignment');

        if (wizComm) {
            this.updateCommunicationWizard();
        } else if (wizWcs) {
            this.updateWCSWizard();
        } else if (wizCorner) {
            this.updateCornerWizard();
        } else if (wizMiddle) {
            this.updateMiddleWizard();
        } else if (wizEdge) {
            this.updateEdgeWizard();
        } else if (wizAlignment) {
            this.updateAlignmentWizard();
        }
    }

    updateCommunicationWizard() {
        const type = el('c_type').value;
        const params = {
            type: type,
            msg: el('c_msg')?.value || '',
            val: el('c_val')?.value || '',
            cycle: el('c_cycle')?.value || '',
            popupMode: el('c_popup_mode')?.value || '',
            id: el('c_id')?.value || '',
            dest: el('c_dest')?.value || '',
            slot1: el('c_slot1')?.value || '',
            slot2: el('c_slot2')?.value || '',
            slot3: el('c_slot3')?.value || '',
            slot4: el('c_slot4')?.value || '',
            statusColor: el('c_status_color')?.value ?? '-1',
            statusMode:  el('c_status_mode')?.value || '1',
            statusDwell: el('c_status_dwell')?.value || ''
        };

        const commValEl = el('c_val');
        if (type === 'dwell' && commValEl) {
            if (!commValEl.value || commValEl.dataset.isDwellDefault === 'true') {
                commValEl.value = '5.0';
                commValEl.dataset.isDwellDefault = 'true';
                params.val = '5.0';
            }
        } else if (commValEl && commValEl.dataset.isDwellDefault === 'true') {
            delete commValEl.dataset.isDwellDefault;
        }

        // Update type descriptor
        const descEl = el('comm_desc');
        const modeDescs = {
            '-5000': '<b>Toast</b> — Displays message instantly without stopping the macro. No operator input required.',
            '1':     '<b>OK / Cancel</b> — Halts macro, operator presses Enter (continue) or Esc (cancel). Returns 1 (Enter) or 0 (Esc) — macro branches on result.',
            '3':     '<b>Binary Choice</b> — Halts macro, operator presses Enter or Esc to choose between two actions. Returns 1 (Enter) or 0 (Esc) — macro branches on result.',
        };
        if (descEl) {
            const descs = {
                popup:  '<b>Popup</b> (#1505) — Shows a dialog box on screen. Mode controls whether macro pauses and how the operator responds.',
                status: '<b>Status Bar</b> (#1503) — Writes a message to the bottom green bar without stopping the macro. Use for progress updates, current operation labels or live feedback during a run. Requires Pr269=YES.',
                input:  '<b>Numeric Input</b> (#2070) — Pauses macro and shows an Edit dialog for the operator to type a number. Result goes into a temp variable (#50–#499), then you copy it to a persistent variable. Use for runtime parameters like speeds or offsets.',
                beep:   '<b>Beep</b> (#2042/#2043) — #2042 sets total beep duration (ms). #2043 sets pulse cycle (ms): 0 = continuous tone; >0 = ON for cycle, OFF for cycle, repeated within #2042 duration (e.g. #2043=100 with #2042=1000 gives five 100ms beeps).',
                dwell:  '<b>Dwell</b> (G4 P) — Pauses macro execution for a fixed time in seconds. Use for spindle spin-up, coolant settling or any timed wait.',
            };
            const modeEl = type === 'popup' ? el('c_popup_mode') : el('c_status_mode');
            const modeDesc = type === 'popup' && modeEl ? (modeDescs[modeEl.value] || '') : '';
            const statusModeDesc = type === 'status' && modeEl ? (modeEl.value === '-3000' ? '<b>Persistent</b> — message stays on screen after macro ends. Operator can jog freely while reading it.' : '') : '';
            descEl.innerHTML = (descs[type] || '') + (modeDesc ? ' ' + modeDesc : '') + (statusModeDesc ? ' ' + statusModeDesc : '');
        }

        // Update field visibility
        const visibility = this.communicationWizard.getFieldVisibility(type);
        const modeBlock = el('c_mode_block');
        const valBlock = el('c_val_block');
        const msgBlock = el('c_msg_block');
        const slotsBlock = el('c_slots_block');
        const varBlock = el('c_var_block');
        const colorBlock = el('c_color_block');

        if (modeBlock) modeBlock.classList.toggle('hidden', !visibility.showMode);
        const popupModeEl = el('c_popup_mode');
        const statusModeEl = el('c_status_mode');
        const modeLabelEl = el('c_mode_label');
        if (popupModeEl) popupModeEl.style.display = visibility.showPopupMode ? '' : 'none';
        if (statusModeEl) statusModeEl.style.display = visibility.showStatusMode ? '' : 'none';
        if (modeLabelEl) modeLabelEl.textContent = visibility.modeLabel || 'MODE';
        const dwellBlock = el('c_dwell_block');
        const currentStatusMode = el('c_status_mode')?.value || '1';
        if (dwellBlock) dwellBlock.classList.toggle('hidden', !(type === 'status' && currentStatusMode !== '-3000'));
        if (valBlock) valBlock.classList.toggle('hidden', !visibility.showValue);
        if (msgBlock) msgBlock.classList.toggle('hidden', !visibility.showMessage);
        if (slotsBlock) slotsBlock.classList.toggle('hidden', !visibility.showSlots);
        if (varBlock) varBlock.classList.toggle('hidden', !visibility.showVar);
        if (colorBlock) colorBlock.classList.toggle('hidden', !visibility.showColor);
        const cycleBlock = el('c_cycle_block');
        if (cycleBlock) cycleBlock.classList.toggle('hidden', !visibility.showCycle);

        // Default message when field becomes visible and is empty
        if (visibility.showMessage) {
            const msgEl = el('c_msg');
            if (msgEl && !msgEl.value && msgEl.dataset.isDefault !== 'true') {
                msgEl.value = 'Enter message...';
                msgEl.dataset.isDefault = 'true';
            }
        }

        // Update value field label and hint based on type
        const valLabel = el('c_val_label');
        const valHint  = el('c_val_hint');
        if (valLabel) valLabel.textContent = visibility.valLabel || 'VALUE';
        if (valHint)  valHint.textContent  = visibility.valHint  || '';

        const gcode = this.communicationWizard.generate(params);
        el('wiz_comm_code').innerHTML = gcode;

        // Update screen preview
        const screenPreview = el('comm_screen_preview');
        if (screenPreview) {
            screenPreview.innerHTML = this.communicationWizard.generateScreenPreview(params);
        }
    }

    updateWCSWizard() {
        const params = {
            sys: el('w_sys').value,
            axisX: el('w_x')?.checked || false,
            axisY: el('w_y')?.checked || false,
            axisZ: el('w_z')?.checked || false,
            sync: el('w_sync')?.checked || false,
            slave: el('w_slave')?.value || '3'
        };

        const gcode = this.wcsWizard.generate(params);
        el('wiz_wcs_code').innerHTML = UIUtils.formatGCode(gcode);

        // Update status label with human-friendly WCS name and base address
        const wcsStatus = el('wcsStatus');
        if (wcsStatus) wcsStatus.textContent = `${this.wcsWizard.getWCSName(params.sys)} - Base: ${this.wcsWizard.getWCSBase(params.sys)}`;
    }

    updateCornerWizard() {
        // Debug: log entry and the main controls we care about
        console.debug('updateCornerWizard called', {
            corner: el('c_corner')?.value,
            probeZFirst: el('c_probe_z_first')?.checked,
            probeSeq: el('c_probe_seq')?.value
        });

        const params = {
            corner: el('c_corner').value,
            probeZ: el('c_probe_z_first')?.checked || false,
            probeZFirst: el('c_probe_z_first')?.checked || false,
            syncA: el('c_sync_a').checked,
            slave: el('c_slave')?.value || '3',
            probeSeq: el('c_probe_seq').value,
            wcs: el('c_wcs').value,
            dist: el('c_dist').value,
            retract: el('c_retract').value,
            f_fast: el('c_feed_fast').value,
            f_slow: el('c_feed_slow').value,
            port: el('c_port').value,
            level: el('c_level').value,
            qStop: el('c_q').value,
            safeZ: el('c_safe_z').value,
            travelDist: el('c_travel_dist').value,
            scanDepth: el('c_scan_depth')?.value || '5',
            radius: el('c_radius')?.value || '2.0'
        };

        const gcode = this.cornerWizard.generate(params);
        el('wiz_corner_code').innerHTML = UIUtils.formatGCode(gcode);

        // Debug: indicate whether generated gcode contains Z probe sequence
        const containsZ = /(Step \d+: Z Surface Probe|G31 Z)/.test(gcode);
        console.debug('cornerWizard.generate => containsZProbe=', containsZ);

        // Update corner status label 📌
        const dirMap = { FL: 'X pos, Y pos', FR: 'X neg, Y pos', BL: 'X pos, Y neg', BR: 'X neg, Y neg' };
        const cornerStatus = el('cornerVizStatus');
        if (cornerStatus) cornerStatus.textContent = `Corner: ${params.corner} (${dirMap[params.corner]}) - ${params.probeSeq}` + (params.probeZ ? ' + Z' : '');

        // Update visualization and restart animator
        if (window.drawCornerViz) {
            window.drawCornerViz(params.probeZFirst);
        }
        this._startCornerAnim();
    }

    async updateMiddleWizard() {
        const dir1val = el('m_dir')?.value || 'pos';
        const dir2val = el('m_dir2')?.value || (dir1val === 'pos' ? 'neg' : 'pos');

        const params = {
            featureType: el('m_type')?.value || 'pocket',
            axis: el('m_axis')?.value || 'X',
            dir1: dir1val,
            dir2: dir2val,
            findBoth: el('m_both')?.checked || false,
            syncA: el('m_sync_a')?.checked || false,
            slave: el('m_slave')?.value || '3',
            wcs: el('m_wcs')?.value || 'active',
            dist: el('m_dist')?.value || '20',
            retract: el('m_retract')?.value || '2',
            safeZ: el('m_safe_z')?.value || '10',
            clearance: '2',
            f_fast: el('m_feed_fast')?.value || '200',
            f_slow: el('m_feed_slow')?.value || '50',
            port: el('m_port')?.value || '3',
            level: el('m_level')?.value || '0',
            qStop: el('m_q')?.value || '1'
        };

        const middleDesc = el('middle_desc');
        if (middleDesc) {
            const pocketDetail = params.findBoth
                ? 'With <b>Probe Both Axes</b> enabled, it completes both edge touches on the selected axis, then repeats the same two-edge cycle on the perpendicular axis.'
                : 'With <b>Probe Both Axes</b> disabled, it still probes <b>two opposite edges on the selected axis</b> and calculates the midpoint on that axis.';
            const bossDetail = params.findBoth
                ? 'With <b>Probe Both Axes</b> enabled, it performs the two-edge cycle on the selected axis, then repeats on the perpendicular axis (with reposition pauses where required).'
                : 'With <b>Probe Both Axes</b> disabled, it performs <b>two opposite-edge probes on the selected axis</b> and computes midpoint/offset from that axis only.';

            middleDesc.innerHTML = params.featureType === 'boss'
                ? `<b>Boss (outside feature):</b> Start with the probe near one external wall of the boss at probe height. Keep approach clear so the stylus can move away for retract and return safely. ${bossDetail}`
                : `<b>Pocket (inside feature):</b> Start near the pocket center so there is travel room in both directions on the chosen axis. The macro performs internal wall touches and retract moves to establish center/offset safely. ${pocketDetail}`;
        }

        // Show/hide secondary direction control when Find Both is enabled
        const dir2Block = el('m_dir2_block');
        const dir2El = el('m_dir2');
        if (dir2Block) dir2Block.classList.toggle('hidden', !params.findBoth);
        if (params.findBoth && dir2El) dir2El.value = dir2val;

        const gcode = this.middleWizard.generate(params);
        el('wiz_middle_code').innerHTML = UIUtils.formatGCode(gcode);

        // Update middle status label
        const middleStatus = el('middleVizStatus');
        const dirLabel = params.dir1 === 'pos' ? 'pos' : 'neg';
        const bothLabel = params.findBoth ? ` (both: ${params.dir1}/${params.dir2})` : '';
        if (middleStatus) middleStatus.textContent = `Middle: ${params.featureType} | ${params.axis} ${dirLabel}${bothLabel}`;

        // Update visualization if function exists — await SVG injection so autoplay can find elements
        if (window.drawMiddleViz) {
            console.debug('updateMiddleWizard: calling drawMiddleViz and awaiting completion');
            await window.drawMiddleViz();
            console.debug('updateMiddleWizard: drawMiddleViz complete');

            // Diagnostic: show available SVG IDs and resolved selectors in the status area
            try {
                const svgRoot = document.getElementById('middleVizContainer')?.querySelector('svg');
                const statusEl = document.getElementById('middleVizStatus');
                if (!svgRoot) {
                    if (statusEl) statusEl.textContent = 'ERROR: SVG not injected into middleVizContainer';
                    console.warn('updateMiddleWizard: svgRoot missing after drawMiddleViz');
                } else {
                    const ids = Array.from(svgRoot.querySelectorAll('[id]')).map(e => e.id);
                    if (statusEl) {
                        // Show the first non-empty line of the generated G-code (the current configC)
                        const firstLine = (gcode || '').split(/\r?\n/).find(l => l.trim().length > 0)
                            || `Middle: ${params.featureType} | ${params.axis} ${dirLabel}${bothLabel}`;
                        const title = firstLine.length > 80 ? firstLine.slice(0,77) + '...' : firstLine;
                        // Only show the config (do not append SVG element counts)
                        statusEl.textContent = title;
                    }
                    console.debug('updateMiddleWizard: SVG element IDs (first 60)=', ids.slice(0,60));
                }
            } catch (e) { console.warn('updateMiddleWizard: diagnostics failed', e); }
        }

        // Autoplay simulation when Middle wizard is opened — use discoverAnimSteps + PathAnimator
        if (window.discoverAnimSteps && window.PathAnimator) {
            try {
                const animInput = window.discoverAnimSteps({
                    featureType: params.featureType,
                    axis: params.axis,
                    dir1: params.dir1,
                    twoAxis: !!params.findBoth,
                    dir2: params.dir2
                });
                console.debug('updateMiddleWizard: animInput', animInput);

                // Check if animation is enabled
                const animate = el('m_animate')?.checked !== false; // default true
                console.debug('updateMiddleWizard: animate =', animate);

                // Stop any running animation and cancel pending start timer
                if (window.__middleAnimTimeout) { clearTimeout(window.__middleAnimTimeout); window.__middleAnimTimeout = null; }
                if (window.__middleAnimator) {
                    try {
                        console.debug('updateMiddleWizard: stopping previous animator (if any)');
                        window.__middleAnimator.stop();
                    } catch (e) { console.debug('updateMiddleWizard: stop() threw', e); }
                }

                if (animate) {
                    // Animated mode - use PathAnimator
                    if (!window.__middleAnimator) {
                        window.__middleAnimator = new window.PathAnimator({ loop: true });
                        console.debug('updateMiddleWizard: created __middleAnimator');
                    }

                    // play asynchronously (do not block UI)
                    window.__middleAnimTimeout = setTimeout(() => {
                        window.__middleAnimTimeout = null;
                        const wcsId = `middle_probe_${params.featureType}_${params.axis}_${params.dir1}_wcs`;
                        animInput.wcsEls = [document.getElementById(wcsId)].filter(Boolean);
                        console.debug('updateMiddleWizard: starting playSequence with animInput');
                        window.__middleAnimator.playSequence(animInput).then(() => {
                          console.debug('updateMiddleWizard: playSequence completed');
                        }).catch(err => {
                          console.debug('updateMiddleWizard: playSequence rejected', err);
                        });
                    }, 60);
                } else {
                    // Static mode - show all paths immediately
                    console.debug('updateMiddleWizard: static mode - showing all paths');
                    const allSteps = [
                        ...(animInput.axis1Steps || []),
                        ...(animInput.jogPath ? [animInput.jogPath] : []),
                        ...(animInput.axis2Steps || [])
                    ];
                    setTimeout(() => {
                        allSteps.forEach(step => {
                            if (!step || !step.selector) return;
                            const pathEl = document.querySelector(step.selector);
                            if (pathEl) {
                                pathEl.classList.add('path-draw');
                                const parent = pathEl.closest('g');
                                if (parent) {
                                    if (step.type === 'probe') parent.classList.add('is-probing');
                                    else if (step.type === 'retract') parent.classList.add('is-retracting');
                                    else if (step.type === 'jog') parent.classList.add('is-jogging');
                                }
                                console.debug('updateMiddleWizard: added path-draw to', step.selector);
                            }
                        });
                    }, 60);
                }
            } catch (err) {
                console.warn('MiddleViz autoplay failed', err);
            }
        }
    }

    updateAlignmentWizard() {
        const params = {
            checkAxis:  el('al_check_axis')?.value  || 'X',
            probeDir:   el('al_probe_dir')?.value    || 'pos',
            tolerance:  el('al_tolerance')?.value    || '0.2',
            dist:       el('al_dist')?.value         || '20',
            retract:    el('al_retract')?.value      || '2',
            safeZ:      el('al_safe_z')?.value       || '10',
            f_fast:     el('al_feed_fast')?.value    || '200',
            f_slow:     el('al_feed_slow')?.value    || '50',
            port:       el('al_port')?.value         || '3',
            level:      el('al_level')?.value        || '0',
            qStop:      el('al_q')?.value            || '1'
        };

        const gcode = this.alignmentWizard.generate(params);
        el('wiz_alignment_code').innerHTML = UIUtils.formatGCode(gcode);

        const probeAxis = params.checkAxis === 'X' ? 'Y' : 'X';
        const status = el('alignmentVizStatus');
        if (status) {
            status.textContent = `Alignment | Check: ${params.checkAxis} | Probe: ${probeAxis}`;
        }

        // Update alignment visualization
        if (window.drawAlignmentViz) {
            try {
                const drawResult = window.drawAlignmentViz();
                if (drawResult && typeof drawResult.then === 'function') {
                    drawResult.then(() => this._startAlignmentAnim()).catch(() => {});
                } else {
                    this._startAlignmentAnim();
                }
            } catch (e) { console.warn('drawAlignmentViz failed', e); }
        } else {
            this._startAlignmentAnim();
        }
    }

    updateEdgeWizard() {
        const params = {
            axis: el('p_axis')?.value || 'X',
            dir: el('p_dir')?.value || 'pos',
            wcs: el('p_wcs')?.value || 'active',
            dist: el('p_dist')?.value || '15',
            retract: el('p_retract')?.value || '2',
            syncA: el('p_sync_a')?.checked || false,
            slave: el('p_slave')?.value || '3',
            f_fast: el('p_feed_fast')?.value || '200',
            f_slow: el('p_feed_slow')?.value || '50',
            port: el('p_port')?.value || '3',
            level: el('p_level')?.value || '0',
            qStop: el('p_q')?.value || '1'
        };

        console.debug('updateEdgeWizard', params);
        const gcode = this.edgeWizard.generate(params);
        console.debug('edge generate => containsG31=', /G31/.test(gcode));
        el('wiz_edge_code').innerHTML = UIUtils.formatGCode(gcode);

        // Update edge status label
        const edgeStatus = el('edgeVizStatus');
        if (edgeStatus) edgeStatus.textContent = `Edge: ${params.axis}${params.dir === 'pos' ? '+' : '-'}`;

        // Update visualization: prefer specialized edge SVG loader if available
        if (window.drawEdgeViz) {
            window.drawEdgeViz();
        } else if (window.drawProbeViz) {
            window.drawProbeViz();
        }
    }

    insert() {
        let code = '';

        // Helper to check if a specific wizard panel is currently visible
        const isVisible = (id) => {
            const element = el(id);
            return element && element.style.display !== 'none';
        };

        // Determine which wizard is active and get its code
        if (isVisible('wiz_comm')) {
            code = el('wiz_comm_code')?.textContent;
        } else if (isVisible('wiz_wcs')) {
            code = el('wiz_wcs_code')?.textContent;
        } else if (isVisible('wiz_corner')) {
            code = el('wiz_corner_code')?.textContent;
        } else if (isVisible('wiz_middle')) {
            code = el('wiz_middle_code')?.textContent;
        } else if (isVisible('wiz_edge')) {
            code = el('wiz_edge_code')?.textContent;
        } else if (isVisible('wiz_alignment')) {
            code = el('wiz_alignment_code')?.textContent;
        }

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

    togglePreview() {
        const commPreview = el('comm_preview_block');
        const wcsPreview = el('wcs_preview_block');
        const probePreview = el('probe_preview_block');

        if (commPreview) commPreview.classList.toggle('hidden');
        if (wcsPreview) wcsPreview.classList.toggle('hidden');
        if (probePreview) probePreview.classList.toggle('hidden');
    }
}
