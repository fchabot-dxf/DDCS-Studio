/**
 * ui/globalFunctions.js — window.* glue for HTML onclick handlers.
 * Extracted from app.js; `app` is the DDCSStudio instance.
 */
import { el } from './uiUtils.js';
import { CornerVizAnimator } from '../viz/cornerVizAnimator.js';
import { resetVirtualIO, setVirtualOutput, getVirtualInput } from '../engine/virtualIO.js';
import { rotateProgram, translateProgram } from '../data/rotateProgram.js';
import { parseGcode } from '../gcodeParser.js';
import { FeatureCanvas } from '../viz/featureCanvas.js';
import { makeRotate } from '../blocks/programFraming.js';

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
            const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
            const ov = document.createElement('div');
            ov.style.cssText = 'position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center;';
            ov.innerHTML = `<div style="width:min(580px,94vw); background:var(--panel,#161b22); border:1px solid var(--border); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:10px;">
                <b>⟳ Rotate program (alignment)</b>
                <div class="settings-hint" style="margin:0">Drag the <b style="color:#ffce54">pivot</b> ▪ and the <b style="color:#ffce54">handle</b> ● to rotate the toolpath, or type exact values. The <b style="color:#43525f">grey</b> outline is the original, <b style="color:#4ab3ff">blue</b> is the rotated result. DDCS has no G68, so Studio rewrites every XY move + arc. <b>Simulate before cutting.</b></div>
                <div data-canvas style="width:100%; height:320px; background:#000; border:1px solid var(--border); border-radius:8px; overflow:hidden;"></div>
                <div class="settings-row" style="gap:10px; align-items:flex-end">
                    <label style="flex:1">Angle (deg, CCW)<input type="number" data-ang value="0" step="0.001" style="width:100%"></label>
                    <label style="flex:1">Pivot X<input type="number" data-px value="0" step="0.001" style="width:100%"></label>
                    <label style="flex:1">Pivot Y<input type="number" data-py value="0" step="0.001" style="width:100%"></label>
                </div>
                <div data-rout class="settings-hint" style="margin:0"></div>
                <div class="settings-row" style="justify-content:flex-end"><button class="toolbar-btn settings-io" data-rc>Cancel</button><button class="toolbar-btn settings-io" data-r763 title="Alternative: copy a #763 snippet to set the controller's native toolpath Z-rotation (Pr263). Only applies in 3D-toolpath mode — verify on your machine.">Copy #763 snippet</button><button class="toolbar-btn settings-io" data-rgo>Rotate editor program</button></div>
            </div>`;
            document.body.appendChild(ov);
            const close = () => ov.remove();
            ov.querySelector('[data-rc]').addEventListener('click', close);
            ov.addEventListener('click', (e) => { if (e.target === ov) close(); });

            // --- 2D rotation preview (same canvas as the wizard layout view) ----------------------------------
            // Parse the editor program into XY segments, then drive a pivot + rotation handle through the canvas.
            // Pivot defaults to the part datum (0,0) — the usual alignment pivot. The handle is a clock hand whose
            // angle IS the rotation, so dragging it rotates the blue (result) outline about the pivot live.
            const segs = (parseGcode(ed.value).segments) || [];
            const runsOf = (wantRapid) => {                 // contiguous polylines, split on gaps + (optionally) move type
                const out = []; let cur = null, lx = null, ly = null;
                for (const s of segs) {
                    if (wantRapid != null && !!s.rapid !== wantRapid) { cur = null; continue; }
                    if (!cur || lx == null || Math.abs(s.x1 - lx) > 1e-4 || Math.abs(s.y1 - ly) > 1e-4) { cur = [{ x: s.x1, y: s.y1 }]; out.push(cur); }
                    cur.push({ x: s.x2, y: s.y2 }); lx = s.x2; ly = s.y2;
                }
                return out;
            };
            const allRuns = runsOf(null), feedRuns = runsOf(false), rapidRuns = runsOf(true);
            // bbox → a stable rotation-handle radius (independent of the live angle so the ring doesn't breathe).
            let bx0 = 0, by0 = 0, bx1 = 0, by1 = 0, any = false;
            segs.forEach((s) => { [[s.x1, s.y1], [s.x2, s.y2]].forEach(([x, y]) => { if (!any) { bx0 = bx1 = x; by0 = by1 = y; any = true; } else { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); } }); });
            const handleR = Math.max(any ? Math.hypot(bx1 - bx0, by1 - by0) * 0.5 : 0, 12);
            const st = { ang: 0, px: 0, py: 0 };
            const rotRun = (run) => { const t = st.ang * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); return run.map((p) => ({ x: st.px + (p.x - st.px) * c - (p.y - st.py) * s, y: st.py + (p.x - st.px) * s + (p.y - st.py) * c })); };
            const canvasEl = ov.querySelector('[data-canvas]');
            const angI = ov.querySelector('[data-ang]'), pxI = ov.querySelector('[data-px]'), pyI = ov.querySelector('[data-py]');
            const fc = new FeatureCanvas();
            const buildSpec = () => {
                const t = st.ang * Math.PI / 180;
                const paths = [];
                allRuns.forEach((r) => paths.push({ pts: r, cls: 'fc-path-ghost' }));      // original (before)
                feedRuns.forEach((r) => paths.push({ pts: rotRun(r), cls: 'fc-path' }));    // rotated cut moves
                rapidRuns.forEach((r) => paths.push({ pts: rotRun(r), cls: 'fc-path-rapid' }));
                return {
                    items: [{ kind: 'circle', cx: st.px, cy: st.py, r: handleR }],          // rotation ring (dashed guide)
                    paths,
                    handles: [
                        { id: 'pivot', x: st.px, y: st.py, kind: 'move', label: 'pivot' },
                        { id: 'rot', x: st.px + handleR * Math.cos(t), y: st.py + handleR * Math.sin(t), label: r3(st.ang) + '°' },
                    ],
                    onDrag: (id, w) => {
                        if (id === 'pivot') { st.px = r3(w.x); st.py = r3(w.y); }
                        else if (id === 'rot') { st.ang = r3(Math.atan2(w.y - st.py, w.x - st.px) * 180 / Math.PI); }
                        syncInputs(); fc.render(canvasEl, buildSpec());
                    },
                };
            };
            const syncInputs = () => { angI.value = r3(st.ang); pxI.value = r3(st.px); pyI.value = r3(st.py); };
            const redraw = () => fc.render(canvasEl, buildSpec());
            angI.addEventListener('input', () => { st.ang = parseFloat(angI.value) || 0; redraw(); });
            pxI.addEventListener('input', () => { st.px = parseFloat(pxI.value) || 0; redraw(); });
            pyI.addEventListener('input', () => { st.py = parseFloat(pyI.value) || 0; redraw(); });
            requestAnimationFrame(redraw);   // wait for the modal to lay out so the canvas measures a real size

            // Native alternative: write the angle to #763 (Pr263 Z toolpath rotation). Applies only in 3D
            // toolpath mode — unconfirmed on this firmware, so it's an opt-in snippet the operator verifies.
            ov.querySelector('[data-r763]').addEventListener('click', () => {
                if (!st.ang) { ov.querySelector('[data-rout]').textContent = 'Set a non-zero angle first.'; return; }
                const snip = `#763=${st.ang}   ( Z-axis toolpath rotation — needs 3D toolpath mode active; verify on the machine )`;
                try { navigator.clipboard?.writeText(snip); } catch (_) { /* no clipboard */ }
                const o = ov.querySelector('[data-rout]');
                o.innerHTML = 'Copied native snippet (run on the controller instead of rotating the program):<br><code>' + snip + '</code><br>⚠ Only applies in 3D-toolpath mode — unconfirmed on this firmware. Verify before trusting it.';
                o.style.color = '#fd0';
            });
            ov.querySelector('[data-rgo]').addEventListener('click', () => {
                if (!st.ang) { ov.querySelector('[data-rout]').textContent = 'Set a non-zero angle (drag the handle or type one).'; return; }
                const o = ov.querySelector('[data-rout]');
                // Preferred ATOM path: wrap the block program in a Rotate atom — non-lossy, reversible, round-trips in
                // the Blocks tab. The preview rotated the CURRENTLY shown geometry, so we always nest a fresh wrapper
                // (two alignments compose, and preview == result). Only when the editor still matches the live
                // projection (else the stack is stale and re-emitting would clobber a hand-edit).
                const stack = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
                const proj = (window.ddcsGetBlockGcode && window.ddcsGetBlockGcode()) || '';
                if (stack.length && proj.trim() && proj === ed.value && window.ddcsLoadBlockStack) {
                    window.ddcsLoadBlockStack([makeRotate({ angle: st.ang, pivotX: st.px, pivotY: st.py }, stack)]);
                    window.ddcsTrack?.('feature', 'align-rotate-atom');
                    close();   // done — the editor + preview now show the rotated result; the Rotate atom is in Blocks
                    return;
                }
                // Fallback: in-place text rewrite (raw G-code with no block program, or a not-yet-reconciled edit). Lossy.
                const r = rotateProgram(ed.value, st.ang, st.px, st.py);
                ed.value = r.text;
                ed.dispatchEvent(new Event('input', { bubbles: true }));   // refresh highlight + preview
                window.ddcsTrack?.('feature', 'align-rotate');
                const msg = `Rotated ${r.rotated} move(s) by ${st.ang}° about (${st.px}, ${st.py}). ⚠ Text rewrite (no block program to wrap) — not reversible.` + (r.hadIncremental ? ' G91 incremental moves were left unrotated — check them.' : ' Simulate to verify.');
                o.innerHTML = msg;
                o.style.color = r.hadIncremental ? '#ff6b6b' : '#fd0';
            });
        };

        // Position: translate the whole editor program by dX/dY/dZ — reposition the toolpath on the stock (a
        // path-placement companion to ⟳ Align). Pure rewrite; ALWAYS simulate the result.
        window.ddcsPositionTranslate = () => {
            const ed = el('editor'); if (!ed) return;
            const ov = document.createElement('div');
            ov.style.cssText = 'position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center;';
            ov.innerHTML = `<div style="width:min(460px,92vw); background:var(--panel,#161b22); border:1px solid var(--border); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:10px;">
                <b>✥ Position program (translate)</b>
                <div class="settings-hint" style="margin:0">Shift every absolute move by an offset — reposition the whole toolpath on the stock. Arc offsets and G91/G53 moves are left as-is. <b>Simulate the result before cutting.</b></div>
                <div class="settings-row"><label style="flex:1">Shift X<input type="number" data-dx value="0" step="0.001" style="width:100%"></label><label style="flex:1">Shift Y<input type="number" data-dy value="0" step="0.001" style="width:100%"></label><label style="flex:1">Shift Z<input type="number" data-dz value="0" step="0.001" style="width:100%"></label></div>
                <div data-tout class="settings-hint" style="margin:0"></div>
                <div class="settings-row" style="justify-content:flex-end"><button class="toolbar-btn settings-io" data-tc>Cancel</button><button class="toolbar-btn settings-io" data-tgo>Position editor program</button></div>
            </div>`;
            document.body.appendChild(ov);
            const close = () => ov.remove();
            ov.querySelector('[data-tc]').addEventListener('click', close);
            ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
            ov.querySelector('[data-tgo]').addEventListener('click', () => {
                const dx = parseFloat(ov.querySelector('[data-dx]').value) || 0;
                const dy = parseFloat(ov.querySelector('[data-dy]').value) || 0;
                const dz = parseFloat(ov.querySelector('[data-dz]').value) || 0;
                if (!dx && !dy && !dz) { ov.querySelector('[data-tout]').textContent = 'Enter a non-zero shift.'; return; }
                const r = translateProgram(ed.value, dx, dy, dz);
                ed.value = r.text;
                ed.dispatchEvent(new Event('input', { bubbles: true }));   // refresh highlight + preview
                window.ddcsTrack?.('feature', 'position-translate');
                const msg = `Shifted ${r.moved} move(s) by (${dx}, ${dy}, ${dz}).` + (r.hadIncremental ? ' ⚠ G91 incremental moves were left as-is — check them.' : ' Simulate to verify.');
                ov.querySelector('[data-tout]').innerHTML = msg;
                ov.querySelector('[data-tout]').style.color = r.hadIncremental ? '#ff6b6b' : '#3c9';
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
