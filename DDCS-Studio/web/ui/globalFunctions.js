/**
 * ui/globalFunctions.js — window.* glue for HTML onclick handlers.
 * Extracted from app.js; `app` is the DDCSStudio instance.
 */
import { el } from './uiUtils.js';
import { CornerVizAnimator } from '../viz/cornerVizAnimator.js';
import { resetVirtualIO, setVirtualOutput, getVirtualInput } from '../engine/virtualIO.js';
import { rotateProgram } from '../data/rotateProgram.js';

export function setupGlobalFunctions(app) {
        // Expose key functions to global scope for HTML onclick handlers
        window.toggleStyle = () => app.themeManager.toggle();
        window.saveDefaults = () => app.saveDefaults();
        window.copyCode = () => app.editorManager.copyCode();
        window.clearCode = () => app.editorManager.clearCode();
        window.downloadFile = () => { window.ddcsTrack?.('feature', 'export'); return app.editorManager.downloadFile(); };
        window.clearSearch = () => app.dockManager.clear();
        window.insert = (key, text) => app.editorManager.insert(key, text);
        window.backspace = () => app.editorManager.backspace();
        window.editorManager = app.editorManager;

        // Wizard functions
        window.openWiz = (type, variant) => { window.ddcsTrack?.('feature', 'wizard:' + type); return app.wizardManager.open(type, variant); };
        window.openCornerWiz = () => { window.ddcsTrack?.('feature', 'wizard:corner'); return app.wizardManager.openCorner(); };
        window.openMiddleWiz = () => { window.ddcsTrack?.('feature', 'wizard:middle'); return app.wizardManager.openMiddle(); };
        window.CornerVizAnimator = CornerVizAnimator;
        window.openEdgeWiz = () => { window.ddcsTrack?.('feature', 'wizard:edge'); return app.wizardManager.openEdge(); };
        window.openAlignmentWiz = () => { window.ddcsTrack?.('feature', 'wizard:alignment'); return app.wizardManager.openAlignment(); };
        window.closeWiz = () => app.wizardManager.close();
        window.insertWiz = () => { window.ddcsTrack?.('feature', 'insert'); return app.wizardManager.insert(); };
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

        // Alignment correction: rotate the editor program by a measured fence angle about a pivot (no G68 on
        // DDCS, so Studio does it — see the alignment-real-correction memory). ALWAYS simulate the result.
        window.ddcsAlignRotate = () => {
            const ed = el('editor'); if (!ed) return;
            const ov = document.createElement('div');
            ov.style.cssText = 'position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center;';
            ov.innerHTML = `<div style="width:min(440px,92vw); background:var(--panel,#161b22); border:1px solid var(--border); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:10px;">
                <b>⟳ Rotate program (alignment)</b>
                <div class="settings-hint" style="margin:0">Rotate every XY move + arc by a measured fence angle about a pivot (the part datum). DDCS has no G68, so Studio rewrites the program. <b>Simulate the result before cutting.</b></div>
                <label>Angle (deg, CCW)<input type="number" data-ang value="0" step="0.001" style="width:100%"></label>
                <div class="settings-row"><label style="flex:1">Pivot X<input type="number" data-px value="0" step="0.001" style="width:100%"></label><label style="flex:1">Pivot Y<input type="number" data-py value="0" step="0.001" style="width:100%"></label></div>
                <div data-rout class="settings-hint" style="margin:0"></div>
                <div class="settings-row" style="justify-content:flex-end"><button class="toolbar-btn settings-io" data-rc>Cancel</button><button class="toolbar-btn settings-io" data-rgo>Rotate editor program</button></div>
            </div>`;
            document.body.appendChild(ov);
            const close = () => ov.remove();
            ov.querySelector('[data-rc]').addEventListener('click', close);
            ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
            ov.querySelector('[data-rgo]').addEventListener('click', () => {
                const ang = parseFloat(ov.querySelector('[data-ang]').value) || 0;
                const px = parseFloat(ov.querySelector('[data-px]').value) || 0;
                const py = parseFloat(ov.querySelector('[data-py]').value) || 0;
                if (!ang) { ov.querySelector('[data-rout]').textContent = 'Enter a non-zero angle.'; return; }
                const r = rotateProgram(ed.value, ang, px, py);
                ed.value = r.text;
                ed.dispatchEvent(new Event('input', { bubbles: true }));   // refresh highlight + preview
                window.ddcsTrack?.('feature', 'align-rotate');
                const msg = `Rotated ${r.rotated} move(s) by ${ang}° about (${px}, ${py}).` + (r.hadIncremental ? ' ⚠ G91 incremental moves were left unrotated — check them.' : ' Simulate to verify.');
                ov.querySelector('[data-rout]').innerHTML = msg;
                ov.querySelector('[data-rout]').style.color = r.hadIncremental ? '#ff6b6b' : '#3c9';
            });
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
