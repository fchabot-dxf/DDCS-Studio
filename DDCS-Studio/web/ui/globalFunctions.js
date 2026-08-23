/**
 * ui/globalFunctions.js — window.* glue for HTML onclick handlers.
 * Extracted from app.js; `app` is the DDCSStudio instance.
 */
import { el } from './uiUtils.js';
import { resetVirtualIO, setVirtualOutput, getVirtualInput } from '../engine/virtualIO.js';
import { rotateProgram, translateProgram } from '../data/rotateProgram.js';
import { parseGcode } from '../gcodeParser.js';
import { FeatureCanvas } from '../viz/featureCanvas.js';
import { makePlace, makeXform } from '../blocks/programFraming.js';
import { programRotation } from '../wizards/ops/transform.js';   // t736 — the DECLARED program rotation
import { openHomingSetup } from './settingsPanel.js';
import { openStockEditor } from './stockEditor.js';

export function setupGlobalFunctions(app) {
        // Expose key functions to global scope for HTML onclick handlers
        window.toggleStyle = () => app.themeManager.toggle();
        window.copyCode = () => app.editorManager.copyCode();
        window.clearCode = () => app.editorManager.clearCode();
        window.downloadFile = () => { window.ddcsTrack?.('feature', 'export'); return app.editorManager.downloadFile(); };
        window.clearSearch = () => app.dockManager.clear();
        window.insert = (key, text) => app.editorManager.insert(key, text);
        window.backspace = () => app.editorManager.backspace();
        window.editorManager = app.editorManager;

        // Wizard functions
        window.openWiz = (type, variant, bypassPrereq) => { window.ddcsTrack?.('feature', 'wizard:' + type); return app.wizardManager.open(type, variant, bypassPrereq); };
        // openCornerWiz retired (④) — the built-in Corner is replaced by the "Corner (data)" twin (opens via openWiz('user_corner_data')).
        // openMiddleWiz/openEdgeWiz/openAlignmentWiz retired t1730 (gameplan step 2, Tier B) — already unrouted
        // from any live menu/onclick (WIZ_SPECIAL_OPENER has been {} since the opensAs port); their target
        // wizardManager methods are gone too (their coded views are deleted — see WORK-LOG t1730). Opens via
        // openWiz('user_middle_data'|'user_edge_data'|'user_alignment_data').
        window.closeWiz = () => app.wizardManager.close();
        window.openHomingSetup = () => { window.ddcsTrack?.('feature', 'homing:setup'); return openHomingSetup(); };
        window.ddcsOpenStock = (opts) => openStockEditor(undefined, opts);   // the rich Stock modal (centred, no anchor needed) — used by the Setup checklist; opts.returnTo='checklist' makes the ✕ go back
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

        // ── Toolpath Transform: ONE tabbed modal hosting ⟳ Align (rotate) + ✥ Position (move). Both editor buttons
        // open this same modal; each defaults to its own tab. Both transforms are ATOMS (rotate / placeOnStock) that
        // round-trip through Blocks — the modal only drives them. ALWAYS simulate the result before cutting.
        const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

        // Parse the editor program into contiguous XY polylines (the toolpath outline both tabs draw). `wantRapid`:
        // null = all moves, false = cut moves only, true = rapids only.
        const programRuns = (segs, wantRapid) => {
            const out = []; let cur = null, lx = null, ly = null;
            for (const s of segs) {
                if (wantRapid != null && !!s.rapid !== wantRapid) { cur = null; continue; }
                if (!cur || lx == null || Math.abs(s.x1 - lx) > 1e-4 || Math.abs(s.y1 - ly) > 1e-4) { cur = [{ x: s.x1, y: s.y1 }]; out.push(cur); }
                cur.push({ x: s.x2, y: s.y2 }); lx = s.x2; ly = s.y2;
            }
            return out;
        };

        // The shared tabbed scaffold. Opens once, builds both tab panes, returns nothing. `initial` = 'align'|'position'.
        const openTransformModal = (initial) => {
            const ed = el('editor'); if (!ed) return;
            const segs = (parseGcode(ed.value).segments) || [];
            const allRuns = programRuns(segs, null), feedRuns = programRuns(segs, false), rapidRuns = programRuns(segs, true);

            const ov = document.createElement('div');
            ov.style.cssText = 'position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center;';
            ov.innerHTML = `<div style="width:min(620px,94vw); background:var(--panel,#161b22); border:1px solid var(--border); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:10px;">
                <div class="settings-row" style="gap:6px; align-items:center">
                    <button class="toolbar-btn settings-io" data-tab="align" style="flex:1">⟳ Align (rotate)</button>
                    <button class="toolbar-btn settings-io" data-tab="position" style="flex:1">✥ Position (move)</button>
                    <button class="toolbar-btn settings-io" data-tab="alignfix" style="flex:1">📐 Alignment fix</button>
                </div>
                <div data-pane="align" style="display:flex; flex-direction:column; gap:10px"></div>
                <div data-pane="position" style="display:flex; flex-direction:column; gap:10px"></div>
                <div data-pane="alignfix" style="display:flex; flex-direction:column; gap:10px"></div>
            </div>`;
            document.body.appendChild(ov);
            const close = () => ov.remove();
            ov.addEventListener('click', (e) => { if (e.target === ov) close(); });

            const alignFc = buildAlignPane(ov.querySelector('[data-pane="align"]'), ed, { allRuns, feedRuns, rapidRuns, segs }, close);
            const posFc = buildPositionPane(ov.querySelector('[data-pane="position"]'), ed, { allRuns, feedRuns, rapidRuns, segs }, close);
            buildAlignFixPane(ov.querySelector('[data-pane="alignfix"]'), ed, close);   // t840 — the measured-alignment correction entry

            const panes = { align: ov.querySelector('[data-pane="align"]'), position: ov.querySelector('[data-pane="position"]'), alignfix: ov.querySelector('[data-pane="alignfix"]') };
            const tabBtns = { align: ov.querySelector('[data-tab="align"]'), position: ov.querySelector('[data-tab="position"]'), alignfix: ov.querySelector('[data-tab="alignfix"]') };
            const show = (which) => {
                for (const k of ['align', 'position', 'alignfix']) {
                    panes[k].style.display = k === which ? 'flex' : 'none';
                    tabBtns[k].style.fontWeight = k === which ? '700' : '';
                    tabBtns[k].style.opacity = k === which ? '1' : '.65';
                }
                // The just-shown canvas was display:none when first rendered (so it measured 0) — redraw now it's visible.
                requestAnimationFrame(() => { (which === 'align' ? alignFc : which === 'position' ? posFc : null)?.(); });
            };
            tabBtns.align.addEventListener('click', () => show('align'));
            tabBtns.position.addEventListener('click', () => show('position'));
            tabBtns.alignfix.addEventListener('click', () => show('alignfix'));
            show(initial === 'position' ? 'position' : initial === 'alignfix' ? 'alignfix' : 'align');
        };

        // The ONE program-level xform writer (t737): replace-never-nest a flat xform{angle,pivotX,pivotY} at the stack top;
        // angle 0 → DROP the declaration → byte-identical. Returns true if it wrote into the block program; false when
        // there's no block program to declare into (the caller does the lossy text-rewrite fallback). Shared by the Align
        // (rotate) pane and the Alignment-fix pane (t840) so the declaration is written in exactly ONE place.
        function writeXformDeclaration(ed, angle, px, py) {
            const stack = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
            const proj = (window.ddcsGetBlockGcode && window.ddcsGetBlockGcode()) || '';
            if (!(stack.length && proj.trim() && proj === ed.value && window.ddcsLoadBlockStack)) return false;
            const rest = stack.filter((b) => !(b && b.type === 'xform'));   // drop the old declaration (replace, not compose)
            window.ddcsLoadBlockStack(angle ? [makeXform({ angle, pivotX: px, pivotY: py }), ...rest] : rest);
            return true;
        }

        // Alignment-fix tab (t840) — the MEASURED alignment correction. The alignment wizard is a pure MEASURER: it probes
        // the fence and writes the misalignment angle into #1512 on the controller (it never moves or cuts). Read that angle
        // off the controller screen and type it here; Studio rotates the whole program about the DATUM (the WCS origin =
        // (0,0) in work coords — the pivot the t716 ruling names) to match — the SAME declared program-level xform the Align
        // tab writes (badge + .nc marker + Blocks all follow), so you needn't physically re-square the part. Pull-prefill of
        // #1512 is a LATER upgrade (the seam: read the pulled/typed #1512 into the field here).
        function buildAlignFixPane(pane, ed, close) {
            const cur = (window.ddcsGetBlockProgram) ? programRotation(window.ddcsGetBlockProgram() || []) : { angle: 0, pivotX: 0, pivotY: 0 };
            const seed = (cur.angle && !cur.pivotX && !cur.pivotY) ? cur.angle : 0;   // prefill only a rotation already about the datum
            pane.innerHTML = `
                <div class="settings-hint" style="margin:0">The <b>alignment probe</b> measures your workpiece's skew into <b>#1512</b> on the controller — it only MEASURES, it never moves or cuts. Read that angle off the controller screen and type it here: Studio rotates the whole program <b>about the datum</b> to match, so you don't have to physically re-square the part. DDCS has no G68, so Studio rewrites every XY move + arc. <b>Simulate before cutting.</b></div>
                <div class="settings-row" style="gap:10px; align-items:flex-end">
                    <label style="flex:1">Measured angle (deg, signed)<input type="number" data-afang value="${seed || ''}" step="0.001" min="-45" max="45" placeholder="e.g. 1.25" style="width:100%"></label>
                </div>
                <div data-afout class="settings-hint" style="margin:0"></div>
                <div class="settings-row" style="justify-content:flex-end"><button class="toolbar-btn settings-io" data-afc>Cancel</button><button class="toolbar-btn settings-io" data-afgo>Apply alignment rotation</button></div>`;
            const angI = pane.querySelector('[data-afang]'), out = pane.querySelector('[data-afout]');
            pane.querySelector('[data-afc]').addEventListener('click', close);
            pane.querySelector('[data-afgo]').addEventListener('click', () => {
                const a = Math.max(-45, Math.min(45, r3(parseFloat(angI.value) || 0)));   // signed, sane clamp (a skew, not a re-orient)
                if (writeXformDeclaration(ed, a, 0, 0)) {   // rotate about the datum (0,0)
                    window.ddcsTrack?.('feature', a ? 'align-correction' : 'align-correction-clear');
                    close(); return;
                }
                if (!a) { out.textContent = 'Type the measured angle (read #1512 off the controller).'; return; }
                const r = rotateProgram(ed.value, a, 0, 0);   // fallback: raw text, no block program to declare into (lossy)
                ed.value = r.text; ed.dispatchEvent(new Event('input', { bubbles: true }));
                window.ddcsTrack?.('feature', 'align-correction');
                out.innerHTML = `Rotated ${r.rotated} move(s) by ${a}° about the datum. ⚠ Text rewrite (no block program) — not reversible.` + (r.hadIncremental ? ' G91 incremental moves left unrotated — check them.' : ' Simulate to verify.');
                out.style.color = r.hadIncremental ? '#ff6b6b' : '#fd0';
            });
        }

        // Align tab — the existing 2D rotate GUI: pivot + angle handle (clock hand) + live rotated outline. Returns a
        // redraw fn (the modal calls it when the tab becomes visible, so the canvas measures a real size).
        function buildAlignPane(pane, ed, runs, close) {
            const { allRuns, feedRuns, rapidRuns, segs } = runs;
            pane.innerHTML = `
                <div class="settings-hint" style="margin:0">Drag the <b style="color:#ffce54">pivot</b> ▪ and the <b style="color:#ffce54">handle</b> ● to rotate the toolpath, or type exact values. The <b style="color:#43525f">grey</b> outline is the original, <b style="color:#4ab3ff">blue</b> is the rotated result. DDCS has no G68, so Studio rewrites every XY move + arc. <b>Simulate before cutting.</b></div>
                <div data-canvas style="width:100%; height:320px; background:#000; border:1px solid var(--border); border-radius:8px; overflow:hidden;"></div>
                <div class="settings-row" style="gap:10px; align-items:flex-end">
                    <label style="flex:1">Angle (deg, CCW)<input type="number" data-ang value="0" step="0.001" style="width:100%"></label>
                    <label style="flex:1">Pivot X<input type="number" data-px value="0" step="0.001" style="width:100%"></label>
                    <label style="flex:1">Pivot Y<input type="number" data-py value="0" step="0.001" style="width:100%"></label>
                </div>
                <div data-rout class="settings-hint" style="margin:0"></div>
                <div class="settings-row" style="justify-content:flex-end"><button class="toolbar-btn settings-io" data-rc>Cancel</button><button class="toolbar-btn settings-io" data-r763 title="Alternative: copy a #763 snippet to set the controller's native toolpath Z-rotation (Pr263). Only applies in 3D-toolpath mode — verify on your machine.">Copy #763 snippet</button><button class="toolbar-btn settings-io" data-rgo>Rotate editor program</button></div>`;
            pane.querySelector('[data-rc]').addEventListener('click', close);

            // bbox → a stable rotation-handle radius (independent of the live angle so the ring doesn't breathe).
            let bx0 = 0, by0 = 0, bx1 = 0, by1 = 0, any = false;
            segs.forEach((s) => { [[s.x1, s.y1], [s.x2, s.y2]].forEach(([x, y]) => { if (!any) { bx0 = bx1 = x; by0 = by1 = y; any = true; } else { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); } }); });
            const handleR = Math.max(any ? Math.hypot(bx1 - bx0, by1 - by0) * 0.5 : 0, 12);
            // t736 — PREFILL from the DECLARED program rotation (the chip's "reopen prefilled"): the editor geometry is
            // ALREADY rotated by it, so UN-ROTATE the runs back to the base program and seat st at the current rotation. The
            // preview shows the ABSOLUTE rotation (base rotated by st.ang) and apply REPLACES the declaration (not compose).
            const cur = (window.ddcsGetBlockProgram) ? programRotation(window.ddcsGetBlockProgram() || []) : { angle: 0, pivotX: 0, pivotY: 0 };
            const unrot = (pts) => { const t = -cur.angle * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); return pts.map((p) => ({ x: cur.pivotX + (p.x - cur.pivotX) * c - (p.y - cur.pivotY) * s, y: cur.pivotY + (p.x - cur.pivotX) * s + (p.y - cur.pivotY) * c })); };
            const baseAll = cur.angle ? allRuns.map(unrot) : allRuns, baseFeed = cur.angle ? feedRuns.map(unrot) : feedRuns, baseRapid = cur.angle ? rapidRuns.map(unrot) : rapidRuns;
            const st = { ang: cur.angle, px: cur.pivotX, py: cur.pivotY };
            const rotRun = (run) => { const t = st.ang * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); return run.map((p) => ({ x: st.px + (p.x - st.px) * c - (p.y - st.py) * s, y: st.py + (p.x - st.px) * s + (p.y - st.py) * c })); };
            const canvasEl = pane.querySelector('[data-canvas]');
            const angI = pane.querySelector('[data-ang]'), pxI = pane.querySelector('[data-px]'), pyI = pane.querySelector('[data-py]');
            const fc = new FeatureCanvas();
            const buildSpec = () => {
                const t = st.ang * Math.PI / 180;
                const paths = [];
                baseAll.forEach((r) => paths.push({ pts: r, cls: 'fc-path-ghost' }));      // the base (un-rotated) program — before
                baseFeed.forEach((r) => paths.push({ pts: rotRun(r), cls: 'fc-path' }));    // rotated cut moves (absolute st.ang)
                baseRapid.forEach((r) => paths.push({ pts: rotRun(r), cls: 'fc-path-rapid' }));
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
            syncInputs();   // t736 — show the prefilled current rotation (the chip's "reopen prefilled")
            angI.addEventListener('input', () => { st.ang = parseFloat(angI.value) || 0; redraw(); });
            pxI.addEventListener('input', () => { st.px = parseFloat(pxI.value) || 0; redraw(); });
            pyI.addEventListener('input', () => { st.py = parseFloat(pyI.value) || 0; redraw(); });

            // Native alternative: write the angle to #763 (Pr263 Z toolpath rotation). Applies only in 3D
            // toolpath mode — unconfirmed on this firmware, so it's an opt-in snippet the operator verifies.
            pane.querySelector('[data-r763]').addEventListener('click', () => {
                if (!st.ang) { pane.querySelector('[data-rout]').textContent = 'Set a non-zero angle first.'; return; }
                const snip = `#763=${st.ang}   ( Z-axis toolpath rotation — needs 3D toolpath mode active; verify on the machine )`;
                try { navigator.clipboard?.writeText(snip); } catch (_) { /* no clipboard */ }
                const o = pane.querySelector('[data-rout]');
                o.innerHTML = 'Copied native snippet (run on the controller instead of rotating the program):<br><code>' + snip + '</code><br>⚠ Only applies in 3D-toolpath mode — unconfirmed on this firmware. Verify before trusting it.';
                o.style.color = '#fd0';
            });
            pane.querySelector('[data-rgo]').addEventListener('click', () => {
                const o = pane.querySelector('[data-rout]');
                if (!st.ang && !cur.angle) { o.textContent = 'Set a non-zero angle (drag the handle or type one).'; return; }
                // DECLARED path (t736): write a FLAT program-level xform{angle,pivotX,pivotY} at the TOP of the stack — the
                // EMITTER applies it at generation (ops untouched); it round-trips through Blocks + save/load and drives the
                // rotation BADGE. st is the ABSOLUTE angle (prefilled from the current), so apply REPLACES the one declaration
                // (never composes/nests); st.ang 0 → drop it (BYTE-IDENTICAL). Only when the editor matches the projection.
                if (writeXformDeclaration(ed, st.ang, st.px, st.py)) {
                    window.ddcsTrack?.('feature', st.ang ? 'align-rotate-xform' : 'align-rotate-clear');
                    close();   // done — the editor + preview show the rotated result; the xform declaration + badge are live
                    return;
                }
                // Fallback: in-place text rewrite (raw G-code with no block program to declare into). Lossy.
                if (!st.ang) { o.textContent = 'Set a non-zero angle (drag the handle or type one).'; return; }
                const r = rotateProgram(ed.value, st.ang, st.px, st.py);
                ed.value = r.text;
                ed.dispatchEvent(new Event('input', { bubbles: true }));   // refresh highlight + preview
                window.ddcsTrack?.('feature', 'align-rotate');
                const msg = `Rotated ${r.rotated} move(s) by ${st.ang}° about (${st.px}, ${st.py}). ⚠ Text rewrite (no block program to wrap) — not reversible.` + (r.hadIncremental ? ' G91 incremental moves were left unrotated — check them.' : ' Simulate to verify.');
                o.innerHTML = msg;
                o.style.color = r.hadIncremental ? '#ff6b6b' : '#fd0';
            });
            return redraw;
        }

        // Position tab — a NEW 2D GUI mirroring Align: the program outline + a draggable handle that translates it. Drag
        // updates the dX/dY fields and the live blue (shifted) outline; typing updates the outline (and the handle). Z is
        // a field (the canvas is XY). Returns a redraw fn the modal calls when the tab becomes visible.
        function buildPositionPane(pane, ed, runs, close) {
            const { allRuns, feedRuns, rapidRuns } = runs;
            pane.innerHTML = `
                <div class="settings-hint" style="margin:0">Drag the <b style="color:#ffce54">move</b> ▪ handle to reposition the toolpath on the stock, or type an exact shift. The <b style="color:#43525f">grey</b> outline is the original, <b style="color:#4ab3ff">blue</b> is the shifted result. Arc offsets and G91/G53 moves are left as-is. <b>Simulate before cutting.</b></div>
                <div data-canvas style="width:100%; height:320px; background:#000; border:1px solid var(--border); border-radius:8px; overflow:hidden;"></div>
                <div class="settings-row" style="gap:10px; align-items:flex-end">
                    <label style="flex:1">Shift X<input type="number" data-dx value="0" step="0.001" style="width:100%"></label>
                    <label style="flex:1">Shift Y<input type="number" data-dy value="0" step="0.001" style="width:100%"></label>
                    <label style="flex:1">Shift Z<input type="number" data-dz value="0" step="0.001" style="width:100%"></label>
                </div>
                <div data-tout class="settings-hint" style="margin:0"></div>
                <div class="settings-row" style="justify-content:flex-end"><button class="toolbar-btn settings-io" data-tc>Cancel</button><button class="toolbar-btn settings-io" data-tgo>Position editor program</button></div>`;
            pane.querySelector('[data-tc]').addEventListener('click', close);

            // bbox of the program → centre point, the anchor the move handle sits on (so dragging the centre shifts all).
            let bx0 = 0, by0 = 0, bx1 = 0, by1 = 0, any = false;
            runs.segs.forEach((s) => { [[s.x1, s.y1], [s.x2, s.y2]].forEach(([x, y]) => { if (!any) { bx0 = bx1 = x; by0 = by1 = y; any = true; } else { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); } }); });
            const cx0 = any ? (bx0 + bx1) / 2 : 0, cy0 = any ? (by0 + by1) / 2 : 0;   // original centre (handle home)
            const st = { dx: 0, dy: 0, dz: 0 };
            const shiftRun = (run) => run.map((p) => ({ x: p.x + st.dx, y: p.y + st.dy }));
            const canvasEl = pane.querySelector('[data-canvas]');
            const dxI = pane.querySelector('[data-dx]'), dyI = pane.querySelector('[data-dy]'), dzI = pane.querySelector('[data-dz]');
            const fc = new FeatureCanvas();
            const buildSpec = () => {
                const paths = [];
                allRuns.forEach((r) => paths.push({ pts: r, cls: 'fc-path-ghost' }));      // original (before)
                feedRuns.forEach((r) => paths.push({ pts: shiftRun(r), cls: 'fc-path' }));  // shifted cut moves
                rapidRuns.forEach((r) => paths.push({ pts: shiftRun(r), cls: 'fc-path-rapid' }));
                return {
                    paths,
                    handles: [
                        { id: 'move', x: cx0 + st.dx, y: cy0 + st.dy, kind: 'move', label: `Δ ${r3(st.dx)}, ${r3(st.dy)}` },
                    ],
                    // Drag the handle → the shift IS (world − original centre). Updates the dX/dY fields + the blue outline.
                    onDrag: (id, w) => {
                        if (id === 'move') { st.dx = r3(w.x - cx0); st.dy = r3(w.y - cy0); }
                        syncInputs(); fc.render(canvasEl, buildSpec());
                    },
                };
            };
            const syncInputs = () => { dxI.value = r3(st.dx); dyI.value = r3(st.dy); };
            const redraw = () => fc.render(canvasEl, buildSpec());
            dxI.addEventListener('input', () => { st.dx = parseFloat(dxI.value) || 0; redraw(); });
            dyI.addEventListener('input', () => { st.dy = parseFloat(dyI.value) || 0; redraw(); });
            dzI.addEventListener('input', () => { st.dz = parseFloat(dzI.value) || 0; });   // Z is field-only (canvas is XY)

            pane.querySelector('[data-tgo]').addEventListener('click', () => {
                st.dz = parseFloat(dzI.value) || 0;
                const dx = st.dx, dy = st.dy, dz = st.dz;
                const o = pane.querySelector('[data-tout]');
                if (!dx && !dy && !dz) { o.textContent = 'Enter a non-zero shift (drag the handle or type one).'; o.style.color = ''; return; }
                // Preferred ATOM path: wrap the block program in a PlaceOnStock atom (a pure XYZ shift — opt-in, no
                // attach corner) — non-lossy, reversible, round-trips in the Blocks tab. Only when the editor still
                // matches the live projection (else the stack is stale and re-emitting would clobber a hand-edit).
                const stack = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
                const proj = (window.ddcsGetBlockGcode && window.ddcsGetBlockGcode()) || '';
                if (stack.length && proj.trim() && proj === ed.value && window.ddcsLoadBlockStack) {
                    // optIn + no stockAttach/pathDatum → placementShift returns exactly (originX, originY, offZ) = (dx,dy,dz).
                    window.ddcsLoadBlockStack([makePlace({ optIn: true, originX: dx, originY: dy, offZ: dz, stockZ: 0 }, null, stack)]);
                    window.ddcsTrack?.('feature', 'position-place-atom');
                    close();   // done — the editor + preview now show the shifted result; the PlaceOnStock atom is in Blocks
                    return;
                }
                // Fallback: in-place text rewrite (raw G-code with no block program, or a not-yet-reconciled edit). Lossy.
                const r = translateProgram(ed.value, dx, dy, dz);
                ed.value = r.text;
                ed.dispatchEvent(new Event('input', { bubbles: true }));   // refresh highlight + preview
                window.ddcsTrack?.('feature', 'position-translate');
                const msg = `Shifted ${r.moved} move(s) by (${dx}, ${dy}, ${dz}). ⚠ Text rewrite (no block program to wrap) — not reversible.` + (r.hadIncremental ? ' G91 incremental moves were left as-is — check them.' : ' Simulate to verify.');
                o.innerHTML = msg;
                o.style.color = r.hadIncremental ? '#ff6b6b' : '#3c9';
            });
            return redraw;
        }

        // Both editor buttons open the ONE tabbed modal, each defaulting to its own tab.
        window.ddcsAlignRotate = () => openTransformModal('align');
        window.ddcsPositionTranslate = () => openTransformModal('position');
        // t1047 S1d — CAM authoring door 2 (editor toolbar): ensure the Macros app is wired (idempotent), then open the
        // authoring modal with the seed picker (no specific op).
        window.ddcsBuildCamSlot = async () => { try { (await import('./macrosApp.js')).initMacrosApp(); } catch (_) { /* */ } if (window.ddcsOpenCamAuthoring) window.ddcsOpenCamAuthoring(); };
        // t1191 — the editor '＋ Make ▾' menu consolidates CAM slot + K-button (NO 3rd floating button). It pops ABOVE the
        // #editor-cam-btn (which keeps its id + --kbd-clear position); each item idempotently wires the Macros app, then runs.
        window.ddcsEditorMakeMenu = (btn) => {
            const ID = 'editor-make-menu';
            const openM = document.getElementById(ID); if (openM) { openM.remove(); return; }   // toggle
            const menu = document.createElement('div');
            menu.id = ID; menu.setAttribute('role', 'menu');
            const itemCss = 'display:block; width:100%; text-align:left; padding:7px 14px; background:transparent; border:none; color:var(--text-main,#e8ecf1); cursor:pointer; font-size:12px; border-radius:5px; white-space:nowrap;';
            menu.innerHTML = `<button type="button" role="menuitem" data-mk="cam" style="${itemCss}">✚ CAM slot</button>`
                + `<button type="button" role="menuitem" data-mk="kbtn" style="${itemCss}">⌨ K-button</button>`;
            document.body.appendChild(menu);
            const r = btn.getBoundingClientRect();
            menu.style.cssText = `position:fixed; left:${Math.round(r.left)}px; bottom:${Math.round(window.innerHeight - r.top + 6)}px; z-index:1200; background:var(--panel,#2a2f3a); border:1px solid var(--border,#444); border-radius:8px; padding:4px; min-width:132px; box-shadow:0 8px 28px rgba(0,0,0,.5);`;
            menu.querySelectorAll('[data-mk]').forEach((b) => { b.addEventListener('mouseenter', () => { b.style.background = 'rgba(255,255,255,.10)'; }); b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; }); });
            menu.addEventListener('click', async (e) => {
                const it = e.target.closest('[data-mk]'); if (!it) return; const mk = it.dataset.mk; menu.remove();
                try { (await import('./macrosApp.js')).initMacrosApp(); } catch (_) { /* */ }
                if (mk === 'cam' && window.ddcsBuildCamSlot) window.ddcsBuildCamSlot();
                else if (mk === 'kbtn' && window.ddcsMakeKButton) window.ddcsMakeKButton();
            });
            setTimeout(() => { const off = (ev) => { if (!menu.contains(ev.target) && ev.target !== btn) { menu.remove(); document.removeEventListener('mousedown', off); } }; document.addEventListener('mousedown', off); }, 0);
        };

        // t1227 — the editor's FILE menu (user curation). Load / Insert / Export / Clear used to be rows in the header
        // quick menu; they act on the PROGRAM IN THE PANE, so they moved to the pane. Same handlers, one declared row
        // list, popping BELOW its button (it lives in the editor's top-right, unlike '＋ Make ▾' at the bottom).
        const EDITOR_FILE_ACTIONS = [
            { id: 'load', label: '📂 Load…', title: 'Load a program file (replaces the editor)', run: () => window.loadGcodeFile?.() },
            // t2178 (tail) — this row's label was already fairly literal; the real gap is that its OWN handler
            // (window.insertGcodeFile) was DELETED entirely at t2173 ("insert is redundant beside load, remove
            // it completely") — this whole menu is dead code (see the file's own comment above: no caller left
            // since t2078 retired the corner button that used to open it), so this row now names an action that
            // no longer exists anywhere in the live app. `run` stays a safe no-op (optional chaining), unchanged.
            { id: 'insert', label: '➕ Insert…', title: 'Insert a program file at the cursor', run: () => window.insertGcodeFile?.() },
            // t2178 — was "Deploy the program as a file" (stale since amendment 8: Export no longer deploys to a
            // granted folder, it opens the OS's own native save dialog). Matches the quick-menu's own wording.
            { id: 'export', label: '⭳ Save G-code as…', title: 'Save the program as a .nc file — the native save dialog opens so you pick the destination yourself', run: () => window.downloadFile?.() },
            // t1255 (user) — CLEAR IS NOT HERE. The header's 🗑 trash IS the clear, at every width now; this row was a
            // phone-only stand-in from t1227, back when the trash hid below 600px. Two doors to a destructive action is
            // one door too many — and the one that hid was the one people learned.
        ];
        window.ddcsEditorFileMenu = (btn) => {
            const ID = 'editor-file-menu';
            const openM = document.getElementById(ID); if (openM) { openM.remove(); return; }   // toggle
            const menu = document.createElement('div');
            menu.id = ID; menu.setAttribute('role', 'menu');
            const itemCss = 'display:block; width:100%; text-align:left; padding:7px 14px; background:transparent; border:none; color:var(--text-main,#e8ecf1); cursor:pointer; font-size:12px; border-radius:5px; white-space:nowrap;';
            menu.innerHTML = EDITOR_FILE_ACTIONS.map((a) =>
                (a.sep ? '<div style="height:1px; margin:4px 6px; background:var(--border,#444);"></div>' : '')
                + `<button type="button" role="menuitem" data-efm="${a.id}" title="${a.title}" style="${itemCss}">${a.label}</button>`).join('');
            document.body.appendChild(menu);
            const r = btn.getBoundingClientRect();
            menu.style.cssText = `position:fixed; right:${Math.round(window.innerWidth - r.right)}px; top:${Math.round(r.bottom + 6)}px; z-index:1200; background:var(--panel,#2a2f3a); border:1px solid var(--border,#444); border-radius:8px; padding:4px; min-width:150px; box-shadow:0 8px 28px rgba(0,0,0,.5);`;
            menu.querySelectorAll('[data-efm]').forEach((b) => { b.addEventListener('mouseenter', () => { b.style.background = 'rgba(255,255,255,.10)'; }); b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; }); });
            menu.addEventListener('click', (e) => {
                const it = e.target.closest('[data-efm]'); if (!it) return;
                menu.remove();
                (EDITOR_FILE_ACTIONS.find((a) => a.id === it.dataset.efm) || {}).run?.();
            });
            setTimeout(() => { const off = (ev) => { if (!menu.contains(ev.target) && !btn.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', off); } }; document.addEventListener('mousedown', off); }, 0);
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
