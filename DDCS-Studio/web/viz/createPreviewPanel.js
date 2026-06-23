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
const toolsForViz = () => { const a = (window.ddcsGetSettings && window.ddcsGetSettings().atc) || {}; return Array.isArray(a.tools) ? a.tools : []; };   // tool table → sim tool spec
const wcsForViz = () => { const m = (window.ddcsGetSettings && window.ddcsGetSettings().machine) || null; return (m && m.workOrigin) ? m.workOrigin : null; };   // work origin in MACHINE coords → G53 moves draw in the part frame
const machineForViz = () => (window.ddcsGetSettings && window.ddcsGetSettings().machine) || null;   // envelope: travel + show + ox/oy/oz (drawn by viz.setMachine, gated on machine.show)
const previewPrefs = () => (window.ddcsGetSettings && window.ddcsGetSettings().preview) || {};   // Settings → Preview tab
// Z-fraction of the stock datum (0=bottom, 0.5=centre, 1=top) — the datum's height above the stock bottom, as a
// fraction of the stock height. Migrates the legacy XY-only codes (all top-Z). Used to place part-zero in the frame.
const datumZFrac = (d) => {
    let c = String(d || 'nnp');
    if (!/^[ncp]{3}$/.test(c)) c = ({ fl: 'nnp', fr: 'pnp', bl: 'npp', br: 'ppp', center: 'ccp' })[c] || 'nnp';
    const f = ({ n: 0, c: 0.5, p: 1 })[c[2]];
    return f == null ? 1 : f;
};

// Custom transport icons (currentColor → inherit the button's text colour), in place of emoji.
const ICON_PLAY = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style="vertical-align:middle" aria-hidden="true"><path d="M4.5 3 12.5 8 4.5 13Z"/></svg>';
// Stop = a square. While playing, the run button STOPS + RESETS (tool/trail cleared, next play restarts from the
// top) — so it shows a stop glyph, not a pause glyph that would imply resume-in-place.
const ICON_STOP = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style="vertical-align:middle" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx="1.5"/></svg>';
const ICON_STEP = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style="vertical-align:middle" aria-hidden="true"><path d="M3.5 3 10 8 3.5 13Z"/><rect x="11" y="3" width="2.4" height="10" rx="1"/></svg>';
const ICON_COPY = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" style="vertical-align:middle" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M3.5 10.5h-1a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1"/></svg>';
// Jog = 4-direction arrow keys (X/Y/Z step movement).
const ICON_JOG = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style="vertical-align:middle" aria-hidden="true"><path d="M8 2 6 4.5h4z"/><path d="M8 14 6 11.5h4z"/><path d="M2 8 4.5 6v4z"/><path d="M14 8 11.5 6v4z"/></svg>';
// Loop = circular repeat arrow (legible at small size, unlike the ⟳ emoji).
const ICON_LOOP = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg>';
// Follow-cam = centre-focus brackets framing a dot (keep the tool centred).
const ICON_FOLLOW = '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle" aria-hidden="true"><path d="M2 5.5V4a2 2 0 0 1 2-2h1.5"/><path d="M10.5 2H12a2 2 0 0 1 2 2v1.5"/><path d="M14 10.5V12a2 2 0 0 1-2 2h-1.5"/><path d="M5.5 14H4a2 2 0 0 1-2-2v-1.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/></svg>';

const PANEL_HTML = `
  <canvas class="pp-2d" aria-hidden="true" style="position:absolute;top:0;left:0;width:100%;height:100%;display:none;background:#0d1117;z-index:1"></canvas>
  <div class="pp-statusbar">
    <button class="pp-copy viz3d-status-copy" type="button" title="Copy this status line to the clipboard" aria-label="Copy status">${ICON_COPY}</button>
    <div class="pp-status viz3d-status"></div>
  </div>
  <div class="viz3d-controls">
    <button class="pp-mtoggle viz3d-2dtoggle" type="button" title="Toggle 2D / 3D view">3D</button>
    <button class="pp-stock" type="button" title="Stock — set the workpiece (dimensions, shape, show, templates)" aria-label="Stock">📦</button>
    <button class="pp-speed" type="button" title="Simulation speed — tap to cycle 1× 2× 5× 10×" aria-label="Simulation speed">1×</button>
    <button class="pp-run" type="button" title="Run the program · while running, click to stop and reset to the start">${ICON_PLAY}</button>
    <button class="pp-step" type="button" title="Execute one line at a time (pauses a running program)">${ICON_STEP}</button>
    <button class="pp-loop" type="button" title="Loop: restart the program when it completes" aria-label="Loop">${ICON_LOOP}</button>
    <button class="pp-follow" type="button" title="Follow-cam — keep the tool centred while playing (Settings → Preview to set damping)" aria-label="Follow cam" style="display:none">${ICON_FOLLOW}</button>
    <button class="pp-jog" type="button" title="Jog the start marker (X/Y/Z step buttons)" aria-label="Jog" style="display:none">${ICON_JOG}</button>
    <button class="pp-io" type="button" title="Show/hide the virtual I/O panel (sensors and outputs)">I/O</button>
  </div>
  <div class="viz3d-legend"></div>
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
    let curStart = null;   // operator start the user dragged (2D handle / 3D marker); getStartPos() reads it
    const t2 = createToolpath2d(cv2d, {
        // 2D start-handle drag → record it, mirror to the 3D marker, and re-trace from the new start.
        onStartDrag: (pos) => { curStart = { x: +pos.x || 0, y: +pos.y || 0, z: +pos.z || 0 }; if (viz && viz.starts) viz.starts[0] = curStart; setGcode(); },
    });
    t2.setMachine(machineForViz()); t2.setStock(stockForViz()); t2.setWcs(wcsForViz());   // 2D mirrors the 3D scene

    let viz = null;            // GcodeViz3D (lazy — only when 3D is shown and WebGL is available)
    // forceMachine: a host hint that this op is INHERENTLY machine-frame (ATC tool changes move in G53) so the
    // envelope must always draw, even when the traced path happens not to reach a G53 (auto-change with no tool
    // loaded, warmup/drawbar with no motion, the parameter-write table). Set by the host via setForceMachine().
    let forceMachine = false;
    let mode = previewPrefs().defaultView === '2d' ? '2d' : '3d', active = false, segs = [], fitted = false, lastAnchor = null, lastStockKey = '';
    let lastRunCode = null, loopOn = false, loopTimer = null, autoStarted = false, liveTimer = null;

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
    let speedIx = Math.max(0, SPEEDS.indexOf(Number(previewPrefs().defaultSpeed) || 1));
    const simSpeed = () => SPEEDS[speedIx] || 1;
    // Apply the Settings → Preview options to the live viz (follow-cam damping + show-rapids).
    function applyPreviewSettings() {
        const pv = previewPrefs();
        if (t2.setGridStep) t2.setGridStep(pv.gridStep);   // 2D grid spacing — works even without the 3D viz built
        if (!viz) return;
        const damp = Number.isFinite(pv.followDamp) ? pv.followDamp : 50;        // 0 = snappy … 100 = very damped
        if (viz.setFollowLerp) viz.setFollowLerp(0.32 - (damp / 100) * 0.30);
        if (viz.setShowRapids) viz.setShowRapids(pv.showRapids !== false);
        if (viz.setGridStep) viz.setGridStep(pv.gridStep);   // Preview → grid spacing (mm; 0/'' = auto)
        if (viz.setHead) viz.setHead(pv.head);               // Preview → spindle/collet body sizes (sim-only, match the real machine)
        if (viz.setPartVisible && pv.parts) viz.setPartVisible(pv.parts);   // Preview → which assembly pieces show
    }
    const nearest2d = (pos) => {
        let bi = 0, bd = Infinity;
        for (let i = 0; i < segs.length; i++) { const s = segs[i], dx = s.x2 - pos.x, dy = s.y2 - pos.y, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; bi = i; } }
        return bi + 1;
    };

    function ensureViz() {
        if (viz) return viz;
        try { viz = new GcodeViz3D(container); viz._gizmoPx = 36; viz._animOn = false; viz.setStock(stockForViz()); viz.setMachine(machineForViz()); applyPreviewSettings(); }
        catch (e) { console.warn('preview 3D unavailable — using 2D', e); viz = null; setMode('2d'); }
        // Dragging the 3D start marker is a user override (like the 2D handle) — record it so getStartPos() reads it.
        if (viz) viz.onStartChange = (starts) => { const s = starts && starts[0]; if (s) { curStart = { x: +s.x || 0, y: +s.y || 0, z: +s.z || 0 }; setGcode(); } };
        return viz;
    }

    let engine = null;
    function ensureEngine() {
        if (engine) return engine;
        engine = new GcodeExecutionEngine({
            autoAnswer: window.ioPanel ? window.ioPanel.isAutoSensors() : true,
            stock: stockForViz(),
            wcsOffset: wcsForViz(),
            simSpeed: simSpeed(),
            createVarStore: opts.createVarStore || null,
            onLineChange: ({ lineIndex, raw }) => { if (typeof opts.onLine === 'function') opts.onLine(lineIndex); if (raw) setStatus(`Executing line ${lineIndex + 1}: ${raw.trim()}`); },
            onPositionChange: (pos) => { if (viz && viz.setToolPosition) viz.setToolPosition(pos); if (mode === '2d' && segs.length) t2.seek(nearest2d(pos)); },
            onStatus: ({ message }) => setStatus(message),
            onWait: (wait) => { if (!window.ioPanel) return; if (wait) window.ioPanel.show(); window.ioPanel.setWait(wait); },   // float the I/O panel during a probe/M-code wait
            onFinish: () => {
                updateRunBtn();
                if (typeof opts.onLine === 'function') opts.onLine(null);
                if (loopOn) { clearTimeout(loopTimer); loopTimer = setTimeout(() => { lastRunCode = get('getGcode') || lastRunCode; engine.run(lastRunCode); updateRunBtn(); }, 800); }
            },
        });
        return engine;
    }

    function updateRunBtn() {
        const b = q('.pp-run'); if (!b) return;
        const running = !!(engine && engine.running), paused = !!(engine && engine.paused);
        b.classList.toggle('on', running && !paused);
        b.innerHTML = (running && !paused) ? ICON_STOP : ICON_PLAY;
    }

    // Render the static route in the active view from the fed G-code (engine.trace resolves #vars/loops/probes).
    // The operator start the wizard reads on insert: a drag (curStart, set by either the 2D handle or the 3D marker)
    // wins, else the wizard-inferred start, else the viz default. The inferred start must beat viz.starts[0] because
    // that defaults to a truthy {0,0,0} which would otherwise shadow it on the first render.
    const getStartPos = () => curStart || get('getStart') || (viz && viz.starts && viz.starts[0]) || null;
    // The sim tool, RESPECTING THE TOOL TABLE: the host's op tool (getTool) wins; else the program's active T#
    // looked up in the tool table (settings.atc.tools → type/Ø/length); else infer from the path (probe → touch
    // probe); else a default endmill.
    function simTool(code, parsed) {
        const ht = get('getTool'); if (ht) return ht;
        const m = /\bT(\d+)\b/.exec(code || '');
        if (m) {
            const t = toolsForViz().find((x) => parseInt(x && x.num, 10) === parseInt(m[1], 10));
            if (t) return { type: t.type || 'endmill', dia: Number(t.dia) || 6, length: Number(t.length) || undefined };
        }
        if ((parsed && parsed.stats && parsed.stats.probe) > 0) return { type: 'probe', dia: 6 };
        return { type: 'endmill', dia: 6 };
    }
    function setGcode(text) {
        const code = text != null ? text : (get('getGcode') || '');
        // Inferred operator start (wizard preview): probes test from the real tool position so an incremental
        // probe macro doesn't trace from the origin (on the stock face) and clamp its first probe to zero.
        const st = getStartPos();
        const stk = stockForViz(), mch = machineForViz(), wo = wcsForViz() || {};
        let parsed;
        try {
            parsed = traceToolpath(code, { stock: stk, start: st, wcsOffset: wcsForViz() });
            // (b) Faithful machine frame: an ABSOLUTE (mill) program's G53 / machine moves must resolve to where the
            // part actually SITS in the envelope, not at part-zero. Part-zero's machine Z = the table + the datum's
            // height above the stock bottom. Re-trace once with that as the work-origin Z so e.g. `G53 Z0` (the
            // end "safe Z" retract) draws at machine home (the top) instead of plunging onto a bottom-datum origin.
            if (mch && mch.show && stk && stk.x > 0 && parsed.stats && parsed.stats.absolute) {
                const z = Math.min(0, mch.z || 0) + datumZFrac(stk.datum) * (Number(stk.z) || 0);
                parsed = traceToolpath(code, { stock: stk, start: st, wcsOffset: { x: wo.x || 0, y: wo.y || 0, z } });
            }
        } catch (e) { console.warn('trace failed', e); parsed = { segments: [], stats: {} }; }
        segs = parsed.segments || [];
        t2.setSegments(segs);   // keep the 2D view in sync so a 2D toggle shows the path immediately
        t2.setStart(st);        // the draggable 2D start handle
        if (mode === '3d') {
            const v = ensureViz();
            if (v) {
                v.setActive(true);
                // Op-aware route anchor, driven by G90/G91: a purely INCREMENTAL program (no absolute position
                // established — e.g. an incremental probe macro) is start-relative, so the route emanates from the
                // start marker. An ABSOLUTE program (G90/G53 — mill) sits at its own coords; the start is independent
                // and moving it must not drag the path. Set BEFORE setSegments so _rebuild uses it.
                // forceMachine (ATC) pins the op to the machine frame: never anchor to the start, always show the
                // envelope — tool changes are G53 even when this particular trace didn't reach one.
                const anchor = !forceMachine && !(parsed.stats && parsed.stats.absolute);
                v._anchorToStart = anchor;
                // ONE flag drives the whole frame: an incremental / operator-relative op (a probe) is LOCAL —
                // stock top-at-0 AND no machine envelope; an absolute / WCS op (mill, WCS setup) shows the MACHINE
                // frame — datum-aware stock + the envelope. The op's coordinate nature decides it, not the host.
                if (anchor !== lastAnchor) {
                    v.setStock(stockForViz());
                    v.setMachine(anchor ? null : machineForViz());     // probe → no envelope; mill → per settings
                    t2.setMachine(anchor ? null : machineForViz());    // 2D mirrors
                    lastAnchor = anchor;
                }
                // Place EVERY pass's start marker before setSegments so each anchored (probe) pass offsets to its own
                // start. A multi-point probe (rotary 3-point fit, alignment A/B) repositions between touches → one pass
                // each; the wizard supplies a per-pass hint array (getStartHints) so the passes land at DISTINCT points
                // (else all passes default to the same start and the circle solve is degenerate). Pass 0 also honours a
                // user drag (curStart, via st). setSegments has already grown viz.starts to passCount.
                if (v.starts) {
                    const hints = get('getStartHints');
                    const hint = (p) => Array.isArray(hints) ? (hints[p] || hints[0]) : null;
                    const passCount = (parsed.stats && parsed.stats.passes) || 1;
                    for (let p = 0; p < passCount; p++) {
                        // pass 0 honours the user's drag (st); every pass falls back to its hint, then its existing start.
                        const h = (p === 0 && st) || hint(p) || v.starts[p] || { x: 0, y: 0, z: 0 };
                        v.starts[p] = { x: +h.x || 0, y: +h.y || 0, z: +h.z || 0 };
                    }
                }
                v.setSegments(parsed, !fitted); fitted = true;
                if (v.setSimTool) v.setSimTool(simTool(code, parsed));   // per-op tool from the tool table (see simTool)
                if (v.setSimMode) v.setSimMode(((parsed.stats && parsed.stats.probe) > 0) ? 'probe' : 'mill');   // probe = translucent stock, mill = solid
            }
        }
        const s = parsed.stats || {};
        setStatus(!s.drawable ? 'No drawable moves' : [s.feed && `${s.feed} cuts`, s.probe && `${s.probe} probes`, s.rapid && `${s.rapid} rapids`].filter(Boolean).join(' · '));
        syncJog();
        renderLegend(parsed);
        if (engine && engine.running) scheduleLiveRestart();   // live edit while playing → re-run on the new path
    }
    const refresh = () => setGcode();

    // A param/stock edit landed WHILE the animation is running: the static route already redrew above; restart the
    // moving tool so it follows the change immediately (instead of finishing the stale pass first, then looping).
    // Debounced so a continuous drag / typing settles before the re-run, and skipped if the G-code didn't change.
    function scheduleLiveRestart() {
        if (liveTimer) clearTimeout(liveTimer);
        liveTimer = setTimeout(() => {
            liveTimer = null;
            if (engine && engine.running && (get('getGcode') || '') !== lastRunCode) { stopPlay(); play(); }
        }, 180);
    }

    // Single bottom bar: the jog grid lives in the 3D viz's pendant; the bar's ✛ Jog button toggles it and only
    // shows when there's a start marker to jog (3D + starts). I/O toggles the shared virtual-I/O panel.
    function syncJog() {
        // GREY OUT (don't hide) buttons that don't apply, so the toolbar layout never shifts. Jog + follow-cam are
        // 3D-only; in 2D you nudge the start via its draggable handle instead.
        const setEnabled = (el, ok) => { if (!el) return; el.style.display = ''; el.style.opacity = ok ? '' : '0.35'; el.style.pointerEvents = ok ? '' : 'none'; el.title = ok ? (el.dataset.t || el.title) : '3D view only'; };
        setEnabled(q('.pp-jog'), mode === '3d' && viz && viz.jogPendant && viz.starts && viz.starts.length > 0);
        setEnabled(q('.pp-follow'), mode === '3d' && viz);
    }

    // Legend: show ONLY the path types present in the current toolpath (classified like the 3D viz). Probe splits
    // fast/slow at the program's max probe feed; jog = the inter-pass move (≥2 start markers).
    const LEGEND = [   // colours match the 3D view (gcodeViz3d line groups)
        { key: 'feed', label: 'Cut', color: '#35d0ff' },
        { key: 'probe', label: 'Probe', color: '#3b82f6' },
        { key: 'probeSlow', label: 'Probe slow', color: '#93c5fd' },
        { key: 'retract', label: 'Retract', color: '#33cc55' },
        { key: 'jog', label: 'Jog', color: '#ff9a0d' },
        { key: 'rapid', label: 'Rapid', color: '#ffcc00' },
    ];
    function renderLegend(parsed) {
        const el = q('.viz3d-legend'); if (!el) return;
        const ss = (parsed && parsed.segments) || [];
        let maxProbeFeed = 0;
        for (const s of ss) { if ((s.type === 'probe' || s.probe) && (s.feed || 0) > maxProbeFeed) maxProbeFeed = s.feed; }
        const present = new Set();
        for (const s of ss) {
            const type = s.type || (s.probe ? 'probe' : s.rapid ? 'rapid' : 'feed');
            if (type === 'rapid') present.add('rapid');
            else if (type === 'retract') present.add('retract');
            else if (type === 'probe') present.add(((s.feed || 0) > 0 && (s.feed || 0) < maxProbeFeed) ? 'probeSlow' : 'probe');
            else present.add('feed');   // G1 cut/plunge — the basic feed move
        }
        if (viz && viz.starts && viz.starts.length > 1) present.add('jog');
        el.innerHTML = LEGEND.filter((x) => present.has(x.key)).map((x) => `<span style="color:${x.color}">${x.label}</span>`).join('');
        el.style.display = el.childElementCount ? '' : 'none';
    }

    function setMode(next) {
        if (next === 'io') { toggleIoFloat(); return; }   // I/O is a FLOATING panel now — it never docks over the view
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
        if (mode === '2d') { t2.setMachine(machineForViz()); t2.setStock(stockForViz()); t2.fit(); }   // frame the full scene on toggle
        syncJog();
    }
    // The I/O button toggles the FLOATING virtual-I/O panel (mounts in <body>, draggable). It OVERLAYS the
    // preview instead of replacing it, so the 2D/3D view stays put. (Docking it blanked full-screen/portrait
    // layouts where the embedded panel landed off-screen.)
    function toggleIoFloat() {
        if (!window.ioPanel) return;
        if (window.ioPanel.isVisible()) window.ioPanel.hide(); else window.ioPanel.show();
        const b = q('.pp-io'); if (b) b.classList.toggle('on', window.ioPanel.isVisible());
    }

    function play() {
        const eng = ensureEngine();
        eng.simSpeed = simSpeed();
        eng.autoAnswer = window.ioPanel ? window.ioPanel.isAutoSensors() : true;
        eng.stock = stockForViz();
        eng._stockOffset = getStartPos() || { x: 0, y: 0, z: 0 };   // probes test from the operator start (see trace.js)
        eng._wcsOffset = wcsForViz() || { x: 0, y: 0, z: 0 };          // G53 machine moves draw in the part frame (see trace.js)
        if (mode === '3d') ensureViz();
        if (viz) viz.setAnimate(false);                 // engine drives the tool/trail, not the geometric sweep
        lastRunCode = get('getGcode') || '';
        eng.run(lastRunCode);
        updateRunBtn();
    }
    function stopPlay() {
        if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
        if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; }   // drop a queued live-restart (harmless on the restart path: it nulls liveTimer first)
        if (engine && engine.running) engine.stop();
        t2.stop();
        if (viz) viz.setAnimate(false);
        if (typeof opts.onLine === 'function') opts.onLine(null);
        updateRunBtn();
    }

    // Static scrub: place the tool at the position the program reaches by the END of source line `i` (or the
    // nearest earlier move). Drives "click a code line → see where the tool lands" when not playing.
    function seekLine(i) {
        if (!segs.length || i == null) return;
        let best = null;
        for (const s of segs) { if (s.line != null && s.line <= i) best = s; }
        const pos = best ? { x: best.x2, y: best.y2, z: best.z2 } : { x: segs[0].x1, y: segs[0].y1, z: segs[0].z1 };
        if (mode === '3d') { const v = ensureViz(); if (v && v.setToolPosition) v.setToolPosition(pos); }
        else t2.seek(nearest2d(pos));
    }

    // ---- stock: a button that opens the rich Stock modal (ui/stockEditor.js). The modal persists to the shared
    //      store + broadcasts ddcs:settings-changed; renderStock() then pushes it into this panel's viz/engine. ----
    function renderStock() {
        const s = stockForViz();
        if (viz) viz.setStock(s); if (engine) engine.stock = stockForViz(); t2.setStock(s);
        // A stock GEOMETRY change (dims / shape / datum) must refresh the view — the grid floor + framing are set
        // in fit(), which otherwise only runs once. Reset `fitted` so the next render re-fits (grid follows the
        // new stock bottom). Keyed so unrelated settings changes don't reframe.
        const key = s ? `${s.x}/${s.y}/${s.z}/${s.shape}/${s.datum}` : '';
        if (key !== lastStockKey) { lastStockKey = key; fitted = false; }
    }
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
    q('.pp-io').addEventListener('click', () => toggleIoFloat());   // toggle the FLOATING I/O panel (overlays; doesn't replace the view)
    q('.pp-follow').addEventListener('click', () => {
        const v = ensureViz(); if (!v || !v.setFollowCam) return;
        const on = !v.followCam;
        v.setFollowCam(on);
        q('.pp-follow').classList.toggle('on', on);
    });

    window.addEventListener('ddcs:stop-previews', stopPlay);
    // Stock (or other settings) changed — e.g. the Stock modal — update the workpiece box + re-trace (probe clamp).
    window.addEventListener('ddcs:settings-changed', () => { renderStock(); const m = (viz && viz._anchorToStart) ? null : machineForViz(); if (viz) viz.setMachine(m); t2.setMachine(m); applyPreviewSettings(); if (active) setGcode(); });

    function setActive(on) {
        active = !!on;
        if (!active) { stopPlay(); autoStarted = false; if (viz) viz.setActive(false); return; }
        if (mode === '3d') { const v = ensureViz(); if (v) v.setActive(true); }
        else if (mode === '2d' && cv2d) cv2d.style.display = '';   // 2D default: ensure the canvas is visible
        setGcode();
        if (mode === '2d') t2.fit();   // frame the full 2D scene on activate (default-2D)
        autoStartOnOpen();
    }

    // On the first activation with drawable content, apply the Preview on-open defaults: centre-lock the camera
    // and auto-play in a loop (both toggleable in Settings → Preview). Fires once per open (autoStarted), so live
    // wizard edits don't restart it — the loop re-reads the latest G-code each iteration instead.
    function autoStartOnOpen() {
        if (autoStarted || !active) return;
        const pv = previewPrefs();
        if (mode === '3d' && pv.followDefault !== false) {
            const v = ensureViz();
            if (v && v.setFollowCam) { v.setFollowCam(true); const fb = q('.pp-follow'); if (fb) fb.classList.add('on'); }
        }
        if (!segs.length) return;   // no drawable content yet — retry on the next activation
        autoStarted = true;
        if (pv.autoLoop !== false) {
            loopOn = true; const lb = q('.pp-loop'); if (lb) lb.classList.add('on');
            play();
        }
    }

    // Reflect the initial view (Settings → default view) in the toggle label + 2D-canvas visibility WITHOUT
    // building the lazy 3D viz (it builds on first activation). Without this, a 2D default opened to a blank pane
    // with the toggle stuck on "3D" — because `mode` was set but setMode() never ran.
    { const _mt = q('.pp-mtoggle'); if (_mt) _mt.textContent = mode === '2d' ? '2D' : '3D'; if (cv2d) cv2d.style.display = mode === '2d' ? '' : 'none'; }

    // Host hint: pin this preview to the MACHINE frame (ATC ops). Forces the envelope on regardless of the traced
    // G-code, and re-renders if active so the change shows immediately.
    function setForceMachine(on) {
        on = !!on;
        if (on === forceMachine) return;
        forceMachine = on;
        lastAnchor = null;   // force the anchor/envelope block in setGcode to re-evaluate
        if (active) setGcode();
    }

    return { setGcode, refresh, setActive, setView: setMode, stop: stopPlay, seekLine, getStartPos, setForceMachine, get viz() { return viz; }, get engine() { return engine; }, el: container };
}
