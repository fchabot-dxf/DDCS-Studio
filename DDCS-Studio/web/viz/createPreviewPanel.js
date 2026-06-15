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
 * Play (run / step / loop, autoAnswer sensors) driving the bold trail; the 2D/3D toggle, speed, status; and a
 * STOCK button that opens the rich Stock modal (ui/stockEditor.js — dims/shape/show/templates), so the workpiece
 * is set from the preview. Editor-line-highlight + I/O panel are OPTIONAL hooks (the I/O panel is the shared
 * window.ioPanel singleton — only one engine runs at a time, ddcsStopPreview enforces it).
 *
 *   createPreviewPanel(container, { getGcode, onLine, createVarStore })
 *     → { setGcode, refresh, setActive, stop, viz, engine, el }
 */
import { GcodeViz3D } from './gcodeViz3d.js';
import { createToolpath2d } from './toolpath2d.js';
import { traceToolpath } from '../engine/trace.js';
import { GcodeExecutionEngine } from '../engine/index.js';
import { toggleStockEditor } from '../ui/stockEditor.js';   // the rich Stock modal (dims / shape boss-pocket-cylinder / show / templates)

// Stock is a sim/preview property — configured via the Stock MODAL (ui/stockEditor.js), opened from the panel's
// Stock button (you set the workpiece where you see it). The modal persists to the shared stock store and
// broadcasts ddcs:settings-changed; every panel reads it here + re-renders, so all previews show the same stock.
const stockForViz = () => { const s = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || null; return (s && s.show) ? s : null; };

const PANEL_HTML = `
  <canvas class="pp-2d" aria-hidden="true" style="position:absolute;inset:0;display:none;background:#0d1117;z-index:1"></canvas>
  <div class="pp-status viz3d-status"></div>
  <button class="pp-copy viz3d-status-copy" type="button" title="Copy status to clipboard">📋 Copy</button>
  <div class="viz3d-controls">
    <button class="pp-mtoggle viz3d-2dtoggle" type="button" title="Toggle 2D / 3D view">3D</button>
    <button class="pp-stock" type="button" title="Stock — set the workpiece (dimensions, shape, show, templates)" aria-label="Stock">📦</button>
    <button class="pp-speed" type="button" title="Simulation speed — tap to cycle 1× 2× 5× 10×" aria-label="Simulation speed">1×</button>
    <button class="pp-run" type="button" title="Run / pause the program in execution order">▶</button>
    <button class="pp-step" type="button" title="Execute one line at a time (pauses a running program)">⏭</button>
    <button class="pp-loop" type="button" title="Loop: restart the program when it completes">⟳</button>
    <button class="pp-jog" type="button" title="Jog the start marker (X/Y/Z step buttons)" style="display:none">✛ Jog</button>
    <button class="pp-io" type="button" title="Show/hide the virtual I/O panel (sensors and outputs)">I/O</button>
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

    // The 2D canvas only repaints when told to; without this it goes blank if first drawn at a transient/zero
    // size (drawer slide-in) or after the panel is resized. Re-fit the 2D route whenever the container resizes.
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => { if (mode === '2d') t2.redraw(); }).observe(container);
    }

    const setStatus = (text, isError = false) => {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.classList.toggle('has-error', !!isError);
        const cp = q('.pp-copy'); if (cp) cp.classList.toggle('visible', !!(text && text.length));
    };
    const SPEEDS = [1, 2, 5, 10];
    let speedIx = 0;
    const simSpeed = () => SPEEDS[speedIx] || 1;
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
        // Inferred operator start (wizard preview): probes test from the real tool position so an incremental
        // probe macro doesn't trace from the origin (on the stock face) and clamp its first probe to zero.
        const st = get('getStart');
        let parsed; try { parsed = traceToolpath(code, { stock: stockForViz(), start: st }); }
        catch (e) { console.warn('trace failed', e); parsed = { segments: [], stats: {} }; }
        segs = parsed.segments || [];
        t2.setSegments(segs);   // keep the 2D view in sync so a 2D toggle shows the path immediately
        if (mode === '3d') {
            const v = ensureViz();
            if (v) {
                v.setActive(true);
                // Place the origin marker before setSegments so the (origin-relative) route offsets to it.
                if (st && v.starts) v.starts[0] = { x: +st.x || 0, y: +st.y || 0, z: +st.z || 0 };
                v.setSegments(parsed, !fitted); fitted = true;
            }
        }
        const s = parsed.stats || {};
        setStatus(!s.drawable ? 'No drawable moves' : [s.feed && `${s.feed} cuts`, s.probe && `${s.probe} probes`, s.rapid && `${s.rapid} rapids`].filter(Boolean).join(' · '));
        syncJog();
    }
    const refresh = () => setGcode();

    // Single bottom bar: the jog grid lives in the 3D viz's pendant; the bar's ✛ Jog button toggles it and only
    // shows when there's a start marker to jog (3D + starts). I/O toggles the shared virtual-I/O panel.
    function syncJog() {
        const b = q('.pp-jog'); if (!b) return;
        b.style.display = (mode === '3d' && viz && viz.jogPendant && viz.starts && viz.starts.length > 0) ? '' : 'none';
    }

    function setMode(next) {
        mode = next;
        stopPlay();
        const mt = q('.pp-mtoggle');
        if (mt) mt.textContent = mode === '2d' ? '2D' : '3D';   // single toggle: label = current view
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
        if (mode === '2d') t2.redraw();   // re-fit to the now-visible canvas size (toggle / after resize)
    }

    function play() {
        const eng = ensureEngine();
        eng.simSpeed = simSpeed();
        eng.autoAnswer = window.ioPanel ? window.ioPanel.isAutoSensors() : true;
        eng.stock = stockForViz();
        eng._stockOffset = get('getStart') || { x: 0, y: 0, z: 0 };   // probes test from the operator start (see trace.js)
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

    // ---- stock: a button that opens the rich Stock modal (ui/stockEditor.js). The modal persists to the shared
    //      store + broadcasts ddcs:settings-changed; renderStock() then pushes it into this panel's viz/engine. ----
    function renderStock() { if (viz) viz.setStock(stockForViz()); if (engine) engine.stock = stockForViz(); }
    q('.pp-stock').addEventListener('click', (e) => toggleStockEditor(e.currentTarget));

    // ---- play / view controls ----
    q('.pp-mtoggle').addEventListener('click', () => setMode(mode === '2d' ? '3d' : '2d'));
    q('.pp-run').addEventListener('click', () => {
        const eng = ensureEngine();
        if (eng.running && !eng.paused) stopPlay();
        else if (eng.running && eng.paused) { eng.resume(); updateRunBtn(); }
        else play();
    });
    q('.pp-step').addEventListener('click', () => { const eng = ensureEngine(); if (viz && !eng.running) viz.setAnimate(false); eng.step(get('getGcode') || ''); updateRunBtn(); });
    q('.pp-loop').addEventListener('click', () => { loopOn = !loopOn; q('.pp-loop').classList.toggle('on', loopOn); if (!loopOn && loopTimer) { clearTimeout(loopTimer); loopTimer = null; } });
    q('.pp-speed').addEventListener('click', () => {   // cycle 1× → 2× → 5× → 10× → 1×
        speedIx = (speedIx + 1) % SPEEDS.length;
        q('.pp-speed').textContent = SPEEDS[speedIx] + '×';
        if (engine) engine.simSpeed = simSpeed();
    });
    q('.pp-copy').addEventListener('click', () => { if (statusEl && statusEl.textContent && navigator.clipboard) navigator.clipboard.writeText(statusEl.textContent); });
    q('.pp-jog').addEventListener('click', () => {
        const v = ensureViz(); if (!v || !v.jogPendant) return;
        const grid = v.jogPendant.querySelector('.jog-grid-wrap'); if (!grid) return;
        const open = grid.style.display === 'none';
        grid.style.display = open ? '' : 'none';
        q('.pp-jog').classList.toggle('on', open);
    });
    q('.pp-io').addEventListener('click', () => { if (window.ioPanel) window.ioPanel.toggle(); });

    window.addEventListener('ddcs:stop-previews', stopPlay);
    // Stock (or other settings) changed — e.g. the Stock modal — update the workpiece box + re-trace (probe clamp).
    window.addEventListener('ddcs:settings-changed', () => { renderStock(); if (active) setGcode(); });

    function setActive(on) {
        active = !!on;
        if (!active) { stopPlay(); if (viz) viz.setActive(false); return; }
        if (mode === '3d') { const v = ensureViz(); if (v) v.setActive(true); }
        setGcode();
    }

    return { setGcode, refresh, setActive, stop: stopPlay, get viz() { return viz; }, get engine() { return engine; }, el: container };
}
