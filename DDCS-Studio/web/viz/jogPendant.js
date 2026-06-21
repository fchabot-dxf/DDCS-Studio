/**
 * viz/jogPendant.js — the bottom action bar of the 3D preview: a jog-drawer toggle
 * + virtual-I/O toggle in the header, over the step-jog buttons for the draggable
 * start marker. (Stock lives in the preview controls' 📦 button.) Extracted from GcodeViz3D.
 */
export function setupJogPendant(viz) {
        const div = document.createElement('div');
        div.className = 'viz3d-jog-pendant';
        div.style.cssText = 'color: #fff; z-index: 100; font-size: 11px; display: none; user-select: none; box-sizing: border-box;';
        // Drawer: the bulky jog grid (.jog-grid-wrap) is collapsed by default — it isn't always
        // used — and pops up above the always-visible slim bar when toggled. Grid is first in the
        // DOM and the pendant is bottom-anchored, so expanding grows the panel upward.
        div.innerHTML = `
            <div class="jog-grid-wrap" style="display: none; background: rgba(18,18,22,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px; margin-bottom: 6px;">
                <div class="jog-start-sel" style="display: none; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                    <span style="color:#9fb4c8;">Start</span>
                    <span class="jog-start-btns" style="display: flex; gap: 4px;"></span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; color: #888; margin-bottom: 6px;">
                    <span style="color:#9fb4c8;">Step</span>
                    <button class="toolbar-btn jog-step-cycle" data-step="10" title="Click to cycle the jog step: 0.1 → 1 → 10 → 100" style="min-width:46px; padding:2px 8px; font-weight:bold;">10</button>
                    <span style="color:#5f6b7a; font-size:10px;">mm</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; color: #888; margin-bottom: 6px;">
                    <span style="color:#9fb4c8;">Pos</span>
                    <input class="jog-pos" data-axis="x" type="number" step="0.1" title="Start X (mm) — type for a precise position" style="width:48px;">
                    <input class="jog-pos" data-axis="y" type="number" step="0.1" title="Start Y (mm)" style="width:48px;">
                    <input class="jog-pos" data-axis="z" type="number" step="0.1" title="Start Z (mm)" style="width:48px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 32px 32px; gap: 6px;">
                    <button class="toolbar-btn" data-axis="z" data-dir="-1" style="font-weight:bold; padding:0;">Z-</button>
                    <button class="toolbar-btn" data-axis="y" data-dir="1" style="font-weight:bold; padding:0;">Y+</button>
                    <button class="toolbar-btn" data-axis="z" data-dir="1" style="font-weight:bold; padding:0;">Z+</button>
                    <button class="toolbar-btn" data-axis="x" data-dir="-1" style="font-weight:bold; padding:0;">X-</button>
                    <button class="toolbar-btn" data-axis="y" data-dir="-1" style="font-weight:bold; padding:0;">Y-</button>
                    <button class="toolbar-btn" data-axis="x" data-dir="1" style="font-weight:bold; padding:0;">X+</button>
                </div>
            </div>
        `;
        viz.container.appendChild(div);
        viz.jogPendant = div;

        // Prevent touches on the jog panel from rotating the view
        div.addEventListener('pointerdown', e => e.stopPropagation());
        // (The visible bar moved into the single preview controls bar — its ✛ Jog button toggles .jog-grid-wrap,
        //  I/O toggles the I/O panel. This pendant is now just the collapsible jog grid + start selector.)

        div.querySelectorAll('button[data-axis]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const axis = btn.getAttribute('data-axis');
                const dir = parseFloat(btn.getAttribute('data-dir'));
                const stepBtn = div.querySelector('.jog-step-cycle');
                const step = stepBtn ? parseFloat(stepBtn.dataset.step) : 1;
                
                const idx = viz.selectedStart || 0;
                if (viz.starts && viz.starts[idx]) {
                    const s = viz.starts[idx]; // jog the selected start (see the Start selector)
                    if (axis === 'x') s.x += dir * step;
                    if (axis === 'y') s.y += dir * step;
                    if (axis === 'z') s.z += dir * step;
                    
                    viz._positionMarkers();
                    viz._rebuild();
                    viz.render();
                    if (typeof viz.onStartChange === 'function') viz.onStartChange(viz.starts);
                    if (viz._syncJogPos) viz._syncJogPos();   // refresh the precise X/Y/Z fields after a jog
                }
            });
        });

        // Step is a single CYCLE-TOGGLE button: 0.1 → 1 → 10 → 100 → (wrap). Brings back the fine (0.1) and
        // coarse (100) steps without four radios cluttering the row.
        const STEPS = [0.1, 1, 10, 100];
        const stepBtn = div.querySelector('.jog-step-cycle');
        if (stepBtn) stepBtn.addEventListener('click', () => {
            const i = (STEPS.indexOf(parseFloat(stepBtn.dataset.step)) + 1) % STEPS.length;
            stepBtn.dataset.step = String(STEPS[i]);
            stepBtn.textContent = String(STEPS[i]);
        });

        // Precise start entry — type the selected start's X/Y/Z directly (complements drag + step-jog). syncPos
        // refreshes the fields from the marker (after a jog, a drag, or a start switch); editing a field moves it.
        const posInputs = [...div.querySelectorAll('.jog-pos')];
        const syncPos = () => {
            const s = (viz.starts && viz.starts[viz.selectedStart || 0]) || { x: 0, y: 0, z: 0 };
            posInputs.forEach((inp) => { if (document.activeElement !== inp) inp.value = Number((s[inp.dataset.axis] || 0).toFixed(3)); });
        };
        viz._syncJogPos = syncPos;   // gcodeViz3d calls this after a drag so the fields track it
        posInputs.forEach((inp) => inp.addEventListener('change', () => {
            const idx = viz.selectedStart || 0;
            if (!viz.starts || !viz.starts[idx]) return;
            const v = parseFloat(inp.value); if (!Number.isFinite(v)) return;
            viz.starts[idx][inp.dataset.axis] = v;
            viz._positionMarkers(); viz._rebuild(); viz.render();
            if (typeof viz.onStartChange === 'function') viz.onStartChange(viz.starts);
        }));
        syncPos();

        // Start selector — pick which start marker the jog buttons drive. Multi-pass programs
        // (e.g. the middle wizard, where a reposition creates a 2nd start) get one button per
        // start; the viz rebuilds this whenever the pass count changes (viz._renderJogStarts).
        const startSel = div.querySelector('.jog-start-sel');
        const startBtns = div.querySelector('.jog-start-btns');
        const renderStarts = () => {
            const n = (viz.starts && viz.starts.length) || 1;
            startSel.style.display = n > 1 ? 'flex' : 'none';
            startBtns.innerHTML = '';
            const sel = viz.selectedStart || 0;
            for (let i = 0; i < n; i++) {
                const b = document.createElement('button');
                b.textContent = String(i + 1);
                b.title = `Jog start ${i + 1}`;
                if (i === sel) b.classList.add('on');
                b.addEventListener('click', () => { if (viz.selectStart) viz.selectStart(i); if (viz._syncJogPos) viz._syncJogPos(); });
                startBtns.appendChild(b);
            }
        };
        viz._renderJogStarts = renderStarts;
        renderStarts();
    }
