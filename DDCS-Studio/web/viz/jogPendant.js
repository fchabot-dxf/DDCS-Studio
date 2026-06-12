/**
 * viz/jogPendant.js — the bottom action bar of the 3D preview: a Stock launcher
 * + virtual-I/O toggle in the header, over the step-jog buttons for the draggable
 * start marker. Extracted from GcodeViz3D.
 */
import { toggleStockEditor } from '../ui/stockEditor.js';

export function setupJogPendant(viz) {
        const div = document.createElement('div');
        div.className = 'viz3d-jog-pendant';
        div.style.cssText = 'background: rgba(18, 18, 22, 0.95); border-top: 1px solid rgba(255,255,255,0.08); padding: 8px 12px 12px; color: #fff; z-index: 100; font-size: 11px; display: none; user-select: none; width: 100%; box-sizing: border-box;';
        div.innerHTML = `
            <div class="jog-bar" style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; padding: 0 4px;">
                <span style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <button id="jogStockBtn" title="Stock setup — shape, size, templates (updates the 3D view live)">Stock</button>
                    <span id="jogPlayControls" style="display: flex; align-items: center; gap: 6px;"></span>
                    <span style="display: flex; align-items: center; gap: 8px; color: #888;">
                        <label style="cursor:pointer;"><input type="radio" name="jogStep" value="1"> 1.0</label>
                        <label style="cursor:pointer;"><input type="radio" name="jogStep" value="10" checked> 10</label>
                    </span>
                </span>
                <button id="jogIOBtn" title="Show/hide the virtual I/O panel (sensors and outputs)">I/O</button>
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
        `;
        viz.container.appendChild(div);
        viz.jogPendant = div;
        
        // Prevent touches on the jog panel from rotating the view
        div.addEventListener('pointerdown', e => e.stopPropagation());
        
        const stockBtn = div.querySelector('#jogStockBtn');
        if (stockBtn) stockBtn.addEventListener('click', () => toggleStockEditor(stockBtn));
        const ioBtn = div.querySelector('#jogIOBtn');
        if (ioBtn) ioBtn.addEventListener('click', () => { if (window.ioPanel) window.ioPanel.toggle(); });

        div.querySelectorAll('button[data-axis]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const axis = btn.getAttribute('data-axis');
                const dir = parseFloat(btn.getAttribute('data-dir'));
                const stepInput = div.querySelector('input[type="radio"]:checked');
                const step = stepInput ? parseFloat(stepInput.value) : 1;
                
                if (viz.starts && viz.starts.length > 0) {
                    const s = viz.starts[0]; // Jog the primary start position
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
    }
