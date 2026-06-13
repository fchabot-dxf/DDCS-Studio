/**
 * viz/jogPendant.js — the bottom action bar of the 3D preview: a Stock launcher
 * + virtual-I/O toggle in the header, over the step-jog buttons for the draggable
 * start marker. Extracted from GcodeViz3D.
 */
import { toggleStockEditor } from '../ui/stockEditor.js';

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
                    <label style="cursor:pointer;"><input type="radio" name="jogStep" value="1"> 1.0</label>
                    <label style="cursor:pointer;"><input type="radio" name="jogStep" value="10" checked> 10</label>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 32px 32px; gap: 6px;">
                    <button class="toolbar-btn" data-axis="z" data-dir="-1" style="font-weight:bold; padding:0;">Z-</button>
                    <button class="toolbar-btn" data-axis="y" data-dir="1" style="font-weight:bold; padding:0;">Y+</button>
                    <button class="toolbar-btn" data-axis="z" data-dir="1" style="font-weight:bold; padding:0;">Z+</button>
                    <button class="toolbar-btn" data-axis="x" data-dir="-1" style="font-weight:bold; padding:0;">X-</button>
                    <button class="toolbar-btn" data-axis="y" data-dir="-1" style="font-weight:bold; padding:0;">Y-</button>
                    <button class="toolbar-btn" data-axis="x" data-dir="1" style="font-weight:bold; padding:0;">X+</button>
                </div>
                <div style="display: flex; gap: 6px; margin-top: 6px;">
                    <button class="toolbar-btn" data-axis="xy" data-dir="0" style="flex:1; height:24px; padding:0; background:#2b3340; border-color:#555; color:#e6ecf2;" title="Reset X/Y to 0">0 XY</button>
                    <button class="toolbar-btn" data-axis="z" data-dir="0" style="flex:1; height:24px; padding:0; background:#2b3340; border-color:#555; color:#e6ecf2;" title="Reset Z to 0">0 Z</button>
                </div>
            </div>
            <div class="jog-bar" style="display: flex; align-items: center; gap: 6px; padding: 5px 6px; background: rgba(18,18,22,0.92); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;">
                <button id="jogToggle" title="Show/hide the jog buttons">✛ Jog</button>
                <button id="jogStockBtn" title="Stock setup — shape, size, templates (updates the 3D view live)">Stock</button>
                <span id="jogPlayControls" style="display: flex; align-items: center; gap: 6px;"></span>
                <button id="jogIOBtn" title="Show/hide the virtual I/O panel (sensors and outputs)">I/O</button>
            </div>
        `;
        viz.container.appendChild(div);
        viz.jogPendant = div;
        
        // Prevent touches on the jog panel from rotating the view
        div.addEventListener('pointerdown', e => e.stopPropagation());
        
        const stockBtn = div.querySelector('#jogStockBtn');
        if (stockBtn) stockBtn.addEventListener('click', () => toggleStockEditor(stockBtn));
        const ioBtn = div.querySelector('#jogIOBtn');
        if (ioBtn) ioBtn.addEventListener('click', () => { if (window.ioPanel) window.ioPanel.toggle(); });

        // Drawer toggle for the jog grid (collapsed by default).
        const toggleBtn = div.querySelector('#jogToggle');
        const gridWrap = div.querySelector('.jog-grid-wrap');
        if (toggleBtn && gridWrap) toggleBtn.addEventListener('click', () => {
            const open = gridWrap.style.display === 'none';
            gridWrap.style.display = open ? '' : 'none';
            toggleBtn.classList.toggle('on', open);
        });

        div.querySelectorAll('button[data-axis]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const axis = btn.getAttribute('data-axis');
                const dir = parseFloat(btn.getAttribute('data-dir'));
                const stepInput = div.querySelector('input[type="radio"]:checked');
                const step = stepInput ? parseFloat(stepInput.value) : 1;
                
                const idx = viz.selectedStart || 0;
                if (viz.starts && viz.starts[idx]) {
                    const s = viz.starts[idx]; // jog the selected start (see the Start selector)
                    if (axis === 'x') s.x += dir * step;
                    if (axis === 'y') s.y += dir * step;
                    if (axis === 'z') s.z += dir * step;
                    if (axis === 'xy' && dir === 0) { s.x = 0; s.y = 0; }
                    if (axis === 'z' && dir === 0) { s.z = 0; }
                    
                    viz._positionMarkers();
                    viz._rebuild();
                    viz.render();
                    if (typeof viz.onStartChange === 'function') viz.onStartChange(viz.starts);
                }
            });
        });

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
                b.addEventListener('click', () => { if (viz.selectStart) viz.selectStart(i); });
                startBtns.appendChild(b);
            }
        };
        viz._renderJogStarts = renderStarts;
        renderStarts();
    }
