/**
 * ui/globalFunctions.js — window.* glue for HTML onclick handlers.
 * Extracted from app.js; `app` is the DDCSStudio instance.
 */
import { el } from './uiUtils.js';
import { CornerVizAnimator } from '../viz/cornerVizAnimator.js';
import { resetVirtualIO, setVirtualOutput, getVirtualInput } from '../engine/virtualIO.js';

export function setupGlobalFunctions(app) {
        // Expose key functions to global scope for HTML onclick handlers
        window.toggleStyle = () => app.themeManager.toggle();
        window.saveDefaults = () => app.saveDefaults();
        window.copyCode = () => app.editorManager.copyCode();
        window.clearCode = () => app.editorManager.clearCode();
        window.downloadFile = () => app.editorManager.downloadFile();
        window.clearSearch = () => app.dockManager.clear();
        window.insert = (key, text) => app.editorManager.insert(key, text);
        window.backspace = () => app.editorManager.backspace();
        window.editorManager = app.editorManager;

        // Wizard functions
        window.openWiz = (type) => app.wizardManager.open(type);
        window.openCornerWiz = () => app.wizardManager.openCorner();
        window.openMiddleWiz = () => app.wizardManager.openMiddle();
        window.CornerVizAnimator = CornerVizAnimator;
        window.openEdgeWiz = () => app.wizardManager.openEdge();
        window.openAlignmentWiz = () => app.wizardManager.openAlignment();
        window.closeWiz = () => app.wizardManager.close();
        window.insertWiz = () => app.wizardManager.insert();
        window.ddcsEditOp = (opId) => app.wizardManager.openForEdit(opId);   // editor hover-chip → edit an existing op
        window.ddcsCanEditOp = (opType) => app.wizardManager.canEdit(opType);   // does this op type support form-edit yet?
        window.togglePreview = () => app.wizardManager.togglePreview();
        window.updateWiz = () => app.wizardManager.update();

        // ----------------------------------------------------------------
        // Virtual I/O simulation hooks
        // Integration point for the future G-code simulation/execution engine:
        // When the engine evaluates a macro output assignment (e.g. MSETDATA
        // that maps to OUT_SPINDLE_UNCLAMP), call:
        //   setVirtualOutput('OUT_SPINDLE_UNCLAMP', true);
        // The truth table in virtualIO.js will simulate the sensor handshake.
        // On new program / simulation reset, call:
        //   resetVirtualIO();
        // ----------------------------------------------------------------
        window.virtualIO_setOutput  = setVirtualOutput;
        window.virtualIO_getInput   = getVirtualInput;
        window.virtualIO_reset      = resetVirtualIO;

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
                app.wizardManager.update();
                i.focus();
            }
        };
    }
