/**
 * _svgPreview.bak.js — BACKUP (not imported). The wizard preview wiring as it was BEFORE the shared
 * createPreviewPanel mount. Kept per request so the SVG-schematic / GcodeViz3D preview structure is
 * recoverable. The per-wizard SVG schematics themselves live in wizards/views/* and were NOT changed —
 * preview3D only hid the SVG (display:none) and showed the 3D viewer; this is just the manager-side wiring.
 *
 * WHY KEEP IT: the per-wizard SVG schematics are the natural source for the DDCS CAM-menu thumbnails
 * (camN.bmp — each deployed macro slot shows a bitmap on the controller; see the DDCS CAM slot format memo).
 * Render the op's SVG → camN.bmp when deploying an op to a CAM slot, so the controller menu has a real preview.
 *
 * Imports it used (in wizardManager): GcodeViz3D from ./viz/gcodeViz3d.js, traceToolpath from ./engine/trace.js,
 * createToolpath2d from ./viz/toolpath2d.js.
 */

// --- preview3D: build the host beside the SVG (hidden), with a shared 2D canvas + [2D|3D]+Play controls ---
function preview3D_OLD(gcode, containerId, start) {
    const svgCont = document.getElementById(containerId);
    if (!svgCont || !svgCont.parentElement) return;
    const parent = svgCont.parentElement; // .viz-container
    let host = parent.querySelector('.wiz-viz3d');
    if (!host) {
        host = document.createElement('div');
        host.className = 'wiz-viz3d';
        host.style.cssText = 'position:relative; width:100%;';
        parent.insertBefore(host, svgCont);
        const visual = host.closest('.wiz-visual') || parent;
        if (visual) {
            const oldLeg = visual.querySelector('.viz-legend');
            if (oldLeg) oldLeg.remove();
            const lg = document.createElement('div');
            lg.className = 'viz-legend';
            lg.innerHTML =
                '<div class="viz-legend-item"><div class="viz-legend-line cut"></div>Cut</div>' +
                '<div class="viz-legend-item"><div class="viz-legend-line travel"></div>Rapid</div>' +
                '<div class="viz-legend-item"><div class="viz-legend-line retract"></div>Retract</div>' +
                '<div class="viz-legend-item"><div class="viz-legend-line probe"></div>Probe</div>' +
                '<div class="viz-legend-item"><div class="viz-legend-line jog"></div>Jog</div>';
            visual.appendChild(lg);
        }
        const cv = document.createElement('canvas');
        cv.className = 'wiz-viz2d';
        cv.style.cssText = 'width:100%; height:100%; display:none; background:#0d1117;';
        host.appendChild(cv);
        host.__t2 = createToolpath2d(cv);
        const ctrls = document.createElement('div');
        ctrls.className = 'viz3d-controls';
        ctrls.innerHTML =
            '<span class="seg"><button type="button" class="wiz-m2d op-btn">2D</button>' +
            '<button type="button" class="wiz-m3d op-btn primary">3D</button></span>' +
            '<button type="button" class="wiz-play on">⏸ Stop</button>';
        host.appendChild(ctrls);
        ctrls.querySelector('.wiz-m2d').addEventListener('click', () => this._setWizPreviewMode('2d', host));
        ctrls.querySelector('.wiz-m3d').addEventListener('click', () => this._setWizPreviewMode('3d', host));
        ctrls.querySelector('.wiz-play').addEventListener('click', (e) => {
            let on;
            if (this._wizPreviewMode === '2d') on = host.__t2.toggle();
            else { if (!this._wizViz) return; on = !this._wizViz._animOn; this._wizViz.setAnimate(on); }
            e.target.classList.toggle('on', on);
            e.target.textContent = on ? '⏸ Stop' : '▶ Play';
        });
    }
    svgCont.style.display = 'none';
    host.__gcode = gcode || '';
    host.__start = start || null;
    if (!this._wizPreviewMode) this._wizPreviewMode = '3d';
    this._renderWizPreview(host);
}

function _setWizPreviewMode_OLD(mode, host) {
    this._wizPreviewMode = mode;
    const c = host.querySelector('.viz3d-controls');
    if (c) {
        c.querySelector('.wiz-m2d').classList.toggle('primary', mode === '2d');
        c.querySelector('.wiz-m3d').classList.toggle('primary', mode === '3d');
        const pb = c.querySelector('.wiz-play'); if (pb) { pb.classList.remove('on'); pb.textContent = '▶ Play'; }
    }
    this._renderWizPreview(host);
}

function _renderWizPreview_OLD(host) {
    const cv = host.querySelector('.wiz-viz2d');
    const r3d = this._wizViz && this._wizViz.renderer ? this._wizViz.renderer.domElement : null;
    if (this._wizPreviewMode === '2d') {
        if (cv) cv.style.display = '';
        if (this._wizViz) { this._wizViz.setAnimate(false); this._wizViz.setActive(false); }
        if (r3d) r3d.style.display = 'none';
        if (host.__t2) host.__t2.setGcode(host.__gcode);
        return;
    }
    if (cv) cv.style.display = 'none';
    if (host.__t2) host.__t2.stop();
    try {
        if (!this._wizViz) { this._wizViz = new GcodeViz3D(host); this._wizViz._gizmoPx = 32; }
        this._wizViz.attach(host);
        if (this._wizViz.renderer && this._wizViz.renderer.domElement) this._wizViz.renderer.domElement.style.display = '';
        this._wizViz.setActive(true);
        this._refresh3DStock();
        const start = host.__start;
        if (start && this._wizViz.starts) this._wizViz.starts[0] = { x: +start.x || 0, y: +start.y || 0, z: +start.z || 0 };
        const wizStock = window.ddcsGetSettings ? window.ddcsGetSettings().stock : null;
        this._wizViz.setSegments(traceToolpath(host.__gcode || '', { stock: wizStock }), this._wizNeedsFit !== false);
        this._wizNeedsFit = false;
    } catch (e) { console.warn('wizard 3D preview failed', e); }
}

function _refresh3DStock_OLD() {
    if (this._wizViz && window.ddcsGetSettings) {
        try { this._wizViz.setStock(window.ddcsGetSettings().stock); } catch (e) { /* ignore */ }
        try { this._wizViz.setProbes(window.ddcsGetSettings().probes); } catch (e) { /* ignore */ }
    }
}

export { preview3D_OLD, _setWizPreviewMode_OLD, _renderWizPreview_OLD, _refresh3DStock_OLD };
