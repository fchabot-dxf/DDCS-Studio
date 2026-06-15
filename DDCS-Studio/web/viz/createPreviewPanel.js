/**
 * viz/createPreviewPanel.js — THE preview. One component, identical code + UI, mounted in all three hosts
 * (Studio editor, Blocks, wizard). The ONLY difference is the G-code fed in (opts.getGcode): the wizard feeds
 * its own contextual op code, Studio the editor program, Blocks the projected program.
 *
 * It builds its own DOM addressed by CLASS, scoped to its root container, so several instances coexist (no
 * global IDs). It reuses the existing `viz3d-*` CSS classes so the look is identical, and the root is
 * position:relative so it fills whatever box each host gives it (hosts differ only in layout/size).
 *
 * Owns: a GcodeViz3D (3D) + createToolpath2d (2D) sharing one engine.trace ROUTE; a GcodeExecutionEngine for
 * Play (run / step / loop, autoAnswer sensors) driving the bold trail; the 2D/3D toggle, speed, status; and the
 * STOCK control. Stock lives HERE, not in Settings — it's a sim concern: one shared value across all preview
 * instances (PREVIEW_STOCK), edited via the in-panel W×H×D + show control, broadcast so every panel agrees.
 * Editor-line-highlight + I/O panel are OPTIONAL hooks (the I/O panel is the shared window.ioPanel singleton —
 * only one engine runs at a time, ddcsStopPreview enforces it).
 *
 *   createPreviewPanel(container, { getGcode, onLine, createVarStore })
 *     → { setGcode, refresh, setActive, stop, viz, engine, el }
 */
import { GcodeViz3D } from './gcodeViz3d.js';
import { createToolpath2d } from './toolpath2d.js';
import { traceToolpath } from '../engine/trace.js';
import { GcodeExecutionEngine } from '../engine/index.js';

// Stock is a PREVIEW/sim property, shared by every panel (one workpiece across all three views), edited in the
// panel — never read from Settings. Changing it in one panel broadcasts to the others via STOCK_EVENT.
const PREVIEW_STOCK = { x: 100, y: 80, z: 20, show: false, shape: 'block' };
const STOCK_EVENT = 'ddcs:preview-stock';
const stockForViz = () => (PREVIEW_STOCK.show ? PREVIEW_STOCK : null);

const PANEL_HTML = `
  <canvas class="pp-2d" aria-hidden="true" style="position:absolute;inset:0;display:none;background:#0d1117;z-index:1"></canvas>
  <div class="pp-status viz3d-status"></div>
  <button class="pp-copy viz3d-status-copy" type="button" title="Copy status to clipboard">📋 Copy</button>
  <div class="viz3d-controls">
    <span class="viz3d-2dtoggle" style="display:flex;gap:4px">
      <button class="pp-m2d" type="button" title="2D top-down toolpath">2D</button>
      <button class="pp-m3d primary" type="button" title="3D toolpath">3D</button>
    </span>
    <label title="Show the workpiece stock (lives in the preview, not Settings)"><input type="checkbox" class="pp-stk-show"> Stock</label>
    <input type="number" class="pp-stk-x" title="stock X (mm)" style="width:44px">
    <input type="number" class="pp-stk-y" title="stock Y (mm)" style="width:44px">
    <input type="number" class="pp-stk-z" title="stock Z (mm)" style="width:44px">
    <label>Speed
      <select class="pp-speed" title="Simulation speed — 1× plays at the programmed feedrates">
        <option value="1" selected>1×</option><option value="2">2×</option><option value="5">5×</option>
        <option value="10">10×</option><option value="1000">MAX</option>
      </select>
    </label>
    <button class="pp-run" type="button" title="Run / pause the program in execution order">▶</button>
    <button class="pp-step" type="button" title="Execute one line at a time (pauses a running program)">⏭</button>
    <button class="pp-loop" type="button" title="Loop: restart the program when it completes">⟳</button>
  </div>
  <div class="viz3d-legend">
    <span><i style="background:#3b82f6"></i>Probe</span>
    <span><i style="background:#93c5fd"></i>Probe slow</span>
    <span><i style="background:#facc15"></i>Retract</span>
    <span><i style="background:#ff9a0d"></i>Jog</span>
    <span><i style="background:#00cc00"></i>Rapid</span>
  </div>
  <div class="viz3d-hint">drag orbit · wheel zoom · right/middle-drag pan</div>
`;

export function createPreviewPanel(container, opts = {}) {
    const get = (k) => (typeof opts[k] === 'function' ? opts[k]() : opts[k]);
    container.classList.add('preview-panel');
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.insertAdjacentHTML('beforeend', PANEL_HTML);
    const q = (sel) => container.querySelector(sel);
    const cv2d = q('.pp-2d');
    const statusEl = q('.pp-status');
    const t2 = createToolpath2d(cv2d);

    let viz = null;            // GcodeViz3D (lazy — only when 3D is shown and WebGL is available)
    let mode = '3d', active = false, segs = [], fitted = false;
    let lastRunCode = null, loopOn = false, loopTimer = null;

    const setStatus = (text, isError = false) => {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.classList.toggle('has-error', !!isError);
        const cp = q('.pp-copy'); if (cp) cp.classList.toggle('visible', !!(text && text.length));
    };
    const simSpeed = () => { const e = q('.pp-speed'); const v = e ? parseFloat(e.value) : 1; return Number.isFinite(v) && v > 0 ? v : 1; };
    const nearest2d = (pos) => {
        let bi = 0, bd = Infinity;
        for (let i = 0; i < segs.length; i++) { const s = segs[i], dx = s.x2 - pos.x, dy = s.y2 - pos.y, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; bi = i; } }
        return bi + 1;
    };

    function ensureViz() {
        if (viz) return viz;
        try { viz = new GcodeViz3D(container); viz._gizmoPx = 36; viz._animOn = false; viz.setStock(stockForViz()); }
        catch (e) { console.warn('preview 3D unavailable — using 2D', e); viz = null; setMode('2d'); }
        return viz;
    }

    let engine = null;
    function ensureEngine() {
        if (engine) return engine;
        engine = new GcodeExecutionEngine({
            autoAnswer: window.ioPanel ? window.ioPanel.isAutoSensors() : true,
            stock: stockForViz(),
            simSpeed: simSpeed(),
            createVarStore: opts.createVarStore || null,
            onLineChange: ({ lineIndex, raw }) => { if (typeof opts.onLine === 'function') opts.onLine(lineIndex); if (raw) setStatus(`Executing line ${lineIndex + 1}: ${raw.trim()}`); },
            onPositionChange: (pos) => { if (viz && viz.setToolPosition) viz.setToolPosition(pos); if (mode === '2d' && segs.length) t2.seek(nearest2d(pos)); },
            onStatus: ({ message }) => setStatus(message),
            onWait: (wait) => { if (window.ioPanel) { if (wait) window.ioPanel.show(); window.ioPanel.setWait(wait); } },
            onFinish: () => {
                updateRunBtn();
                if (typeof opts.onLine === 'function') opts.onLine(null);
                if (loopOn && lastRunCode != null) { clearTimeout(loopTimer); loopTimer = setTimeout(() => { engine.run(lastRunCode); updateRunBtn(); }, 800); }
            },
        });
        return engine;
    }

    function updateRunBtn() {
        const b = q('.pp-run'); if (!b) return;
        const running = !!(engine && engine.running), paused = !!(engine && engine.paused);
        b.classList.toggle('on', running && !paused);
        b.textContent = !running ? '▶' : (paused ? '▶' : '⏸');
    }

    // Render the static route in the active view from the fed G-code (engine.trace resolves #vars/loops/probes).
    function setGcode(text) {
        const code = text != null ? text : (get('getGcode') || '');
        let parsed; try { parsed = traceToolpath(code, { stock: stockForViz() }); }
        catch (e) { console.warn('trace failed', e); parsed = { segments: [], stats: {} }; }
        segs = parsed.segments || [];
        if (mode === '2d') t2.setSegments(segs);
        else {
            const v = ensureViz();
            if (v) {
                v.setActive(true);
                // Optional inferred start (wizard preview): place the origin marker before setSegments so the path offsets to it.
                const st = get('getStart'); if (st && v.starts) v.starts[0] = { x: +st.x || 0, y: +st.y || 0, z: +st.z || 0 };
                v.setSegments(parsed, !fitted); fitted = true;
            }
        }
        const s = parsed.stats || {};
        setStatus(!s.drawable ? 'No drawable moves' : [s.feed && `${s.feed} cuts`, s.probe && `${s.probe} probes`, s.rapid && `${s.rapid} rapids`].filter(Boolean).join(' · '));
    }
    const refresh = () => setGcode();

    function setMode(next) {
        mode = next;
        stopPlay();
        const m2 = q('.pp-m2d'), m3 = q('.pp-m3d');
        if (m2) m2.classList.toggle('primary', mode === '2d');
        if (m3) m3.classList.toggle('primary', mode === '3d');
        if (cv2d) cv2d.style.display = mode === '2d' ? '' : 'none';
        // The 3D renderer canvas is z-index 2 (above the 2D canvas), so 2D must HIDE it, not just show the 2D
        // canvas underneath — otherwise the toggle looks dead (3D still covering it).
        if (mode === '2d') {
            if (viz) { viz.setActive(false); if (viz.renderer) viz.renderer.domElement.style.display = 'none'; }
        } else {
            const v = ensureViz();
            if (v) { if (v.renderer) v.renderer.domElement.style.display = ''; v.setActive(true); }
        }
        if (active) setGcode();
    }

    function play() {
        const eng = ensureEngine();
        eng.simSpeed = simSpeed();
        eng.autoAnswer = window.ioPanel ? window.ioPanel.isAutoSensors() : true;
        eng.stock = stockForViz();
        if (mode === '3d') ensureViz();
        if (viz) viz.setAnimate(false);                 // engine drives the tool/trail, not the geometric sweep
        lastRunCode = get('getGcode') || '';
        eng.run(lastRunCode);
        updateRunBtn();
    }
    function stopPlay() {
        if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
        if (engine && engine.running) engine.stop();
        t2.stop();
        if (viz) viz.setAnimate(false);
        if (typeof opts.onLine === 'function') opts.onLine(null);
        updateRunBtn();
    }

    // ---- stock control (lives in the preview; shared across panels) ----
    function syncStockInputs() {
        const sh = q('.pp-stk-show'), x = q('.pp-stk-x'), y = q('.pp-stk-y'), z = q('.pp-stk-z');
        if (sh) sh.checked = !!PREVIEW_STOCK.show;
        if (x) x.value = PREVIEW_STOCK.x; if (y) y.value = PREVIEW_STOCK.y; if (z) z.value = PREVIEW_STOCK.z;
    }
    function applyStock() {                              // push PREVIEW_STOCK into this panel's viz + re-trace (probe clamp)
        if (viz) viz.setStock(stockForViz());
        if (engine) engine.stock = stockForViz();
        if (active) setGcode();
    }
    function onStockEdit() {
        PREVIEW_STOCK.show = !!q('.pp-stk-show').checked;
        PREVIEW_STOCK.x = Number(q('.pp-stk-x').value) || 0;
        PREVIEW_STOCK.y = Number(q('.pp-stk-y').value) || 0;
        PREVIEW_STOCK.z = Number(q('.pp-stk-z').value) || 0;
        window.dispatchEvent(new CustomEvent(STOCK_EVENT));   // tell the other panels
        applyStock();
    }
    ['pp-stk-show', 'pp-stk-x', 'pp-stk-y', 'pp-stk-z'].forEach((c) => { const el = q('.' + c); if (el) el.addEventListener('change', onStockEdit); });
    window.addEventListener(STOCK_EVENT, () => { syncStockInputs(); applyStock(); });
    syncStockInputs();

    // ---- play / view controls ----
    q('.pp-m2d').addEventListener('click', () => setMode('2d'));
    q('.pp-m3d').addEventListener('click', () => setMode('3d'));
    q('.pp-run').addEventListener('click', () => {
        const eng = ensureEngine();
        if (eng.running && !eng.paused) stopPlay();
        else if (eng.running && eng.paused) { eng.resume(); updateRunBtn(); }
        else play();
    });
    q('.pp-step').addEventListener('click', () => { const eng = ensureEngine(); if (viz && !eng.running) viz.setAnimate(false); eng.step(get('getGcode') || ''); updateRunBtn(); });
    q('.pp-loop').addEventListener('click', () => { loopOn = !loopOn; q('.pp-loop').classList.toggle('on', loopOn); if (!loopOn && loopTimer) { clearTimeout(loopTimer); loopTimer = null; } });
    q('.pp-speed').addEventListener('change', () => { if (engine) engine.simSpeed = simSpeed(); });
    q('.pp-copy').addEventListener('click', () => { if (statusEl && statusEl.textContent && navigator.clipboard) navigator.clipboard.writeText(statusEl.textContent); });

    window.addEventListener('ddcs:stop-previews', stopPlay);

    function setActive(on) {
        active = !!on;
        if (!active) { stopPlay(); if (viz) viz.setActive(false); return; }
        if (mode === '3d') { const v = ensureViz(); if (v) v.setActive(true); }
        setGcode();
    }

    return { setGcode, refresh, setActive, stop: stopPlay, get viz() { return viz; }, get engine() { return engine; }, el: container };
}
