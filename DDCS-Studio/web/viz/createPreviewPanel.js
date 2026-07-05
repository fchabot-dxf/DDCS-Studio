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
import { getLastOp } from '../blocks/opRecord.js';          // the active op (wizard PREVIEW) → its declared radius-comp surfaces
import { builderOf } from '../blocks/opBuilders.js';        // rebuild the op stack to read its radiuscomp atoms (disc-on-surface, inc2)
import { magazinePockets } from '../wizards/views/atcViews.js';   // shared ATC magazine layout (handles the disk RING + a rotation) — reused for the pick-place occupancy swap

// DISC-ON-SURFACE (inc2): read the DECLARED radiuscomp atoms of the ops being previewed → { resultVar → { axis, sign } } for
// ENABLED comps ONLY. The flat <name>Stack carries the probeSurfaceStack atoms; a radiuscomp's `raw` (trigger #1925/6/7) gives
// the axis, `dir` the sign. Declared, NOT a #6-scan. SOURCE per host: the wizard PREVIEW passes its single active op
// (getLastOp); the EDITOR sim passes the whole program model (opts.getOps → ddcsGetBlockProgram). Multi-op → the maps merge;
// a comp-line init (`#50=0`) is harmless (no discs pending yet), and a same-var/different-axis collision degrades to a RAW
// disc (the earlier op's nudge no-ops on an empty axis), never a wrong nudge.
const TRIG_AXIS = { '#1925': 'x', '#1926': 'y', '#1927': 'z' };
function readEnabledComps(ops) {
    const map = {};
    for (const op of (ops || [])) {
        if (!op || !op.type) continue;
        let stack = null;
        try { const b = builderOf(op.type); stack = b ? b(op.params || {}) : null; } catch (_) { stack = null; }
        for (const a of (stack || [])) {
            if (!a || a.type !== 'radiuscomp' || !a.params) continue;
            const p = a.params, on = p.enable !== false && p.enable !== 'false' && p.enable !== 0;
            if (on && p.result && TRIG_AXIS[p.raw]) map[String(p.result)] = { axis: TRIG_AXIS[p.raw], sign: p.dir === '-' ? -1 : 1 };   // comp-OFF (fit) drops out → its discs stay raw
        }
    }
    return map;
}

// Stock is a sim/preview property — configured via the Stock MODAL (ui/stockEditor.js), opened from the panel's
// Stock button (you set the workpiece where you see it). The modal persists to the shared stock store and
// broadcasts ddcs:settings-changed; every panel reads it here + re-renders, so all previews show the same stock.
const stockForViz = () => { const s = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || null; return (s && s.show) ? s : null; };
const toolsForViz = () => { const a = (window.ddcsGetSettings && window.ddcsGetSettings().atc) || {}; return Array.isArray(a.tools) ? a.tools : []; };   // tool table → sim tool spec
// The active WCS offset (work origin in MACHINE coords) → drives the engine's G53 moves AND the DRO Mach column. ONE
// SOURCE: derive it straight from the G54-G59 table row for the active WCS, NOT the machine.workOrigin cache — that
// cache is only refreshed by syncWorkOrigin() (settingsPanel) and is stale {0,0,0} until the user touches the table, so
// reading it made Mach == Work. workOrigin stays the fallback for legacy paths / before a table exists.
const wcsForViz = () => {
    const m = (window.ddcsGetSettings && window.ddcsGetSettings().machine) || null;
    if (!m) return null;
    const w = m.wcs, r = w && Array.isArray(w.table) && w.table[(w.active || 1) - 1];
    if (r) return { x: +r.x || 0, y: +r.y || 0, z: +r.z || 0 };
    return m.workOrigin || null;
};
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
  <div class="pp-dro" aria-hidden="true">
    <div class="pp-dro-wcs" title="Active work-coordinate system">G54</div>
    <table class="pp-dro-tbl"><thead><tr><th></th><th>Work</th><th>Mach</th></tr></thead><tbody></tbody></table>
  </div>
  <div class="viz3d-hint">drag orbit · wheel zoom · right/middle-drag pan</div>
`;

// SLICE 2 (WCS VISIBLE): classify an executing line as a WCS call or a spindle/start call, from the RAW text only
// (no engine parsing — the verify-first confirmed raw suffices). Comments ( … ) are stripped first so a mention of a
// code inside a comment can't false-fire. Exported for unit tests. Returns 'wcs' | 'start' | null.
export function classifyCall(raw) {
    const code = String(raw || '').replace(/\([^)]*\)/g, ' ');
    if (/\bG5[4-9]\b/.test(code) || /\bG10\b/.test(code)) return 'wcs';    // WCS select (G54–G59) / set (G10 L2/L20)
    if (/\bM0*[34]\b/.test(code)) return 'start';                          // spindle on (M3 / M4) = program start
    return null;
}

// Resolve a SIMPLE indirect-address expression — `#70`, `#70+1`, `#73` — to a number, using the engine var store. Used to
// detect a WCS-offset write: an assignment whose `#[…]` target lands in the WCS table #805..#834 is the datum source.
// Only handles `#N` / `#N±M` (every wizard's WCS-target form); anything else → NaN (ignored). Exported for unit tests.
export function resolveVarExpr(expr, vars) {
    if (!vars) return NaN;
    const e = String(expr).replace(/#(\d+)/g, (_, n) => { const v = vars.get(+n); return Number.isFinite(v) ? String(v) : 'NaN'; });
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*(?:([+-])\s*(\d+(?:\.\d+)?))?\s*$/.exec(e);
    if (!m) return NaN;
    return m[2] ? (m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3]) : +m[1];
}

// SLICE 3: the axis a G31 PROBE move targets (the first axis word carrying a value), or null if the line isn't a G31.
// Exported for unit tests. The per-axis probe-WCS is built one G31 at a time, so we only need which axis each touches.
export function probeAxis(raw) {
    const code = String(raw || '').replace(/\([^)]*\)/g, ' ');
    if (!/\bG31\b/.test(code)) return null;
    const m = code.match(/\bG31\b[^()]*?([XYZ])\s*[-#\[\d.]/i);   // value may be a literal (-10), a #var (#8), or an expr ([0-#1])
    return m ? m[1].toLowerCase() : null;
}

export function createPreviewPanel(container, opts = {}) {
    const get = (k) => (typeof opts[k] === 'function' ? opts[k]() : opts[k]);
    container.classList.add('preview-panel');
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.insertAdjacentHTML('beforeend', PANEL_HTML);
    const q = (sel) => container.querySelector(sel);
    const cv2d = q('.pp-2d');
    const statusEl = q('.pp-status');
    let curStart = null;   // operator start the user dragged (2D handle / 3D marker); getStartPos() reads it (pass 0)
    let passStarts = [];   // INC1: per-pass operator starts [{x,y,z}] — the shared source of truth for BOTH views' numbered markers
    let userStarts = [];   // INC2: per-pass USER overrides (a jog or a drag) — these BEAT the wizard's inferStarts HINT so an edited ② STICKS (the hint only positions an un-touched pass)
    let lastPassSources = [];   // t81 — the latest per-pass reposition sources (auto/manual), exposed (getPassSources) so the Layout canvas colours its handles to MATCH the top panel
    let lastPassEnds = null;    // t107 — the latest per-pass runtime world-ENDs from the trace, exposed (getPassEnds) so the Layout canvas relocates its reposition marker + anchors the END-relative drag to the SAME runtime END
    // A per-pass start drag from ANY view — the 2D toolpath handle, the 3D marker, or the feature-canvas ②-aim handle —
    // records it as the USER override (a sim-only DECLARED value: it BEATS the inferStarts hint + persists), mirrors to the
    // 3D marker, then re-traces + replays from the new start. ONE seam, so every view edits the SAME userStarts (the
    // feature-canvas drag is just another writer of it — exposed on the panel return for the view-owned canvas).
    function onStartDrag(pos, pass) {
        const p = pass | 0, np = { x: +pos.x || 0, y: +pos.y || 0, z: +pos.z || 0 };
        passStarts[p] = np; userStarts[p] = np;          // shared source of truth + USER override (beats the hint, persists)
        if (p === 0) curStart = np;                      // pass 0 = the operator start getStartPos() reads
        if (viz && viz.starts) viz.starts[p] = np;       // mirror to the 3D marker
        setGcode(); replayFromStart();                   // #18: re-run the sim from the new start
    }
    const t2 = createToolpath2d(cv2d, { onStartDrag });
    t2.setMachine(machineForViz()); t2.setStock(stockForViz()); t2.setWcs(wcsForViz());   // 2D mirrors the 3D scene

    let viz = null;            // GcodeViz3D (lazy — only when 3D is shown and WebGL is available)
    // forceMachine: a host hint that this op is INHERENTLY machine-frame (ATC tool changes move in G53) so the
    // envelope must always draw, even when the traced path happens not to reach a G53 (auto-change with no tool
    // loaded, warmup/drawbar with no motion, the parameter-write table). Set by the host via setForceMachine().
    let forceMachine = false;
    let rotaryFixture = false;   // host hint: show the 4th-axis rig (rotary probe ops). Applied to the lazy viz on create + on toggle.
    // P-C.1b: the FIRMWARE ATC tool-swap context. atcChoreo (the push choreography) + atcStation (its region) are armed
    // by the atc_change firmware view; during play we watch #1300 and, on a REAL tool change (a program T#/M6), retire
    // the OLD tool to the station + put the NEW tool on the spindle. lastTool tracks the previous #1300 (the FIRST value
    // seen is the starting tool, NOT a swap). Isolated firmware op (no tool change) → #1300 never flips → no swap.
    let atcChoreo = null, atcStation = null, lastTool = null, deviceIoListener = null;
    let mode = previewPrefs().defaultView === '2d' ? '2d' : '3d', active = false, segs = [], fitted = false, lastAnchor = null, lastStockKey = '', curAnchor = false;
    let lastRunCode = null, loopOn = false, loopTimer = null, autoStarted = false, liveTimer = null;

    // DRO — a dual numeric readout mirroring the DDCS controller: Work (the tool's program position) + Mach. Work comes
    // straight from onPositionChange; Mach = Work + the ACTIVE WCS offset. `activeWcsOffset()` is the SINGLE swap-point:
    // today the sim has one offset (wcsForViz = settings.machine.workOrigin, so G54=G55=G59), but reading it LIVE here
    // means when the engine gains a real per-G54-G59 WCS table, this call returns the active WCS's offset and the Mach
    // column becomes truly per-WCS with NO change to the DRO. The Work column flashes + the WCS label updates on a
    // WCS/probe event (reusing the slice-2 classify hook). Rows = X/Y/Z, plus A/B when the rotary rig is shown.
    const droEl = q('.pp-dro'), droWcsEl = q('.pp-dro-wcs'), droBody = q('.pp-dro-tbl tbody');
    let simActiveWcs = null;   // #4: a G54-G59 PROGRAM LINE overrides the active WCS for the SIM/DRO ONLY (never settings.machine.wcs.active); reset each run
    const activeWcsIdx = () => { if (simActiveWcs) return simActiveWcs; const m = machineForViz(); return (m && m.wcs && m.wcs.active) || 1; };
    const activeWcsOffset = () => {   // Mach = Work + this; follows the program-driven active WCS once a G54-G59 line fired, else the settings active
        const m = machineForViz(); if (!m) return { x: 0, y: 0, z: 0 };
        const w = m.wcs, r = w && Array.isArray(w.table) && w.table[activeWcsIdx() - 1];
        return r ? { x: +r.x || 0, y: +r.y || 0, z: +r.z || 0 } : (m.workOrigin || { x: 0, y: 0, z: 0 });
    };
    const activeWcsName = () => 'G' + (53 + activeWcsIdx());   // table[0]=G54
    let droAxes = ['x', 'y', 'z'];
    function buildDro() {
        droAxes = rotaryFixture ? ['x', 'y', 'z', 'a', 'b'] : ['x', 'y', 'z'];
        if (droBody) droBody.innerHTML = droAxes.map((ax) => `<tr data-ax="${ax}"><th>${ax.toUpperCase()}</th><td class="pp-dro-w">0.000</td><td class="pp-dro-m">0.000</td></tr>`).join('');
    }
    function updateDro(pos) {
        if (!droBody) return;
        const off = activeWcsOffset();
        droAxes.forEach((ax) => {
            const w = +(pos && pos[ax]) || 0, m = w + (+off[ax] || 0);
            const row = droBody.querySelector(`tr[data-ax="${ax}"]`);
            if (row) { row.children[1].textContent = w.toFixed(3); row.children[2].textContent = m.toFixed(3); }
        });
    }
    function setDroWcs(raw) {   // a G54-G59 select drives the SIM active WCS — label + Mach offset (G10 set-offset keeps the current label)
        const m = String(raw || '').replace(/\([^)]*\)/g, ' ').match(/\bG5([4-9])\b/);
        if (!m) return;
        simActiveWcs = +m[1] - 3;                            // G54→1 … G59→6 — SIM/viz DISPLAY ONLY, never settings.machine.wcs.active
        if (engine) engine._wcsOffset = activeWcsOffset();   // the engine's G53 moves track the program's WCS change too
        if (droWcsEl) droWcsEl.textContent = m[0];
    }
    function flashDro() {       // re-trigger the CSS flash on the Work column (the re-reference cue)
        if (!droEl) return;
        droEl.classList.remove('pp-dro-flash'); void droEl.offsetWidth; droEl.classList.add('pp-dro-flash');
    }
    buildDro();
    if (droWcsEl) droWcsEl.textContent = activeWcsName();   // start the label on the active WCS (whose offset Mach uses)

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
    let speedIx = Math.max(0, SPEEDS.indexOf(Number(previewPrefs().defaultSpeed) || 2));   // STICKY: defaults to 2×, restores the user's last pick
    const simSpeed = () => SPEEDS[speedIx] || 1;
    if (q('.pp-speed')) q('.pp-speed').textContent = simSpeed() + '×';   // reflect the (sticky) speed on load, not the hardcoded 1×
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
        if (viz) viz.onStartChange = (starts) => {   // a 3D jog/drag (any pass) → sync the shared starts, PIN the moved pass, re-trace + replay (#18, INC2)
            if (!Array.isArray(starts) || !starts.length) return;
            starts.forEach((s, p) => {
                const np = { x: +s.x || 0, y: +s.y || 0, z: +s.z || 0 }, cur = passStarts[p];
                if (!cur || cur.x !== np.x || cur.y !== np.y || cur.z !== np.z) userStarts[p] = np;   // pin only the pass that actually MOVED (the jogged one) → its edit beats the hint
                passStarts[p] = np;
            });
            curStart = passStarts[0];
            setGcode(); replayFromStart();
        };
        if (viz && rotaryFixture && viz.setRotaryFixture) viz.setRotaryFixture(true);   // persist the rig hint across lazy viz creation
        return viz;
    }

    let engine = null;
    let pendingProbe = null;   // SLICE 3: the axis of a G31 awaiting completion (resolved on the next onLineChange)
    let pendingDatum = null;   // a WCS-offset write awaiting its COMMITTED value — onLineChange fires BEFORE the assign runs, so read the target var on the NEXT line (robust to ANY RHS expr, incl. the comp's bracketed [#1927-#6])
    let compMap = {};   // DISC-ON-SURFACE (inc2): the previewed ops' enabled-comp { resultVar → { axis, sign } } map (read per run)
    // The ops whose declared radius-comps drive the disc-on-surface: the EDITOR sim injects its whole program model
    // (opts.getOps → ddcsGetBlockProgram); every other host (wizard/Blocks preview) uses the single active op (getLastOp).
    const compOps = () => {
        if (typeof opts.getOps === 'function') { try { return opts.getOps() || []; } catch (_) { return []; } }
        const op = getLastOp(); return op ? [op] : [];
    };
    function ensureEngine() {
        if (engine) return engine;
        engine = new GcodeExecutionEngine({
            autoAnswer: window.ioPanel ? window.ioPanel.isAutoSensors() : true,
            stock: stockForViz(),
            wcsOffset: wcsForViz(),
            simSpeed: simSpeed(),
            createVarStore: opts.createVarStore || null,
            onLineChange: ({ lineIndex, raw }) => {
                if (typeof opts.onLine === 'function') opts.onLine(lineIndex);
                if (raw) setStatus(`Executing line ${lineIndex + 1}: ${raw.trim()}`);
                // SLICE 3: a previous G31 has now FINISHED (the engine clamped it to the contact; the tool sits there) →
                // build that axis of the probe-WCS. Resolving on the NEXT line guarantees the tool is at the contact.
                if (pendingProbe && viz && viz.probeAxisTouched) { viz.probeAxisTouched(pendingProbe, engine.feedVal); flashDro(); }   // probe re-references the DRO (feedVal = the just-finished probe's feed → disc size)
                pendingProbe = null;
                // DATUM = the WCS-WRITE event (DEFERRED read). onLineChange fires BEFORE the assign executes, so the write
                // detected last line has now run → read the engine's OWN computed value at the target address (robust to ANY
                // RHS expression, incl. the comp's bracketed `[#1927-#6]` that the old single-var regex missed → Z-first bug).
                if (pendingDatum && engine.vars && viz && viz.markDatumWrite) {
                    const val = engine.vars.get(pendingDatum.target);
                    if (Number.isFinite(val)) viz.markDatumWrite(['x', 'y', 'z'][pendingDatum.off], val);
                }
                pendingDatum = null;
                // WCS VISIBLE: a WCS/start call fires a temporal FLASH — the 3D marker glows + the code line glows/fades.
                const kind = raw ? classifyCall(raw) : null;
                if (kind) {
                    if (viz && viz.flashMarker) viz.flashMarker(kind);
                    if (typeof opts.onCallFlash === 'function') opts.onCallFlash(lineIndex, kind);
                    if (kind === 'wcs') { setDroWcs(raw); flashDro(); }   // DRO: update the active-WCS label + flash the Work column (re-zero cue)
                }
                if (raw) { const pa = probeAxis(raw); if (pa) pendingProbe = pa; }   // a G31 → resolve on the next line
                // Detect an assign to a WCS-offset target (#[…] resolving into the table at #70+0/1/2 = X/Y/Z) and DEFER the
                // value read to the next line (above) — onLineChange fires before the assign executes, so read the committed value next.
                if (engine.vars) {
                    const asg = raw && /^\s*#\[([^\]]+)\]\s*=\s*(.+?)\s*$/.exec(raw);
                    const base = engine.vars.get(70);   // the active WCS base address (#70 — every wizard sets it before writing)
                    if (asg && Number.isFinite(base)) {
                        const target = resolveVarExpr(asg[1], engine.vars);   // the resolved WCS-offset ADDRESS (#[#73] → 807 …)
                        const off = target - base;                            // RELATIVE to #70 → 0 X, 1 Y, 2 Z (3/4 = A/B, ignored)
                        if (off === 0 || off === 1 || off === 2) pendingDatum = { off, target };   // robust to #578/#70's absolute value (only the offset matters)
                    }
                }
                // DISC-ON-SURFACE (inc2): a radius-comp RESULT write (`#50=…` / the corner Z's `#[#73]=…`) whose target is a
                // DECLARED enabled-comp result var → slide that touch's discs (dropped since the last comp on its axis) onto the
                // wall by ±#6 toward the probe dir. RELATIVE (the result value is engine-frame; the disc rides the part frame).
                if (raw && viz && viz.nudgeSurface) {
                    const lhs = /^\s*(#\d+|#\[[^\]]+\])\s*=/.exec(raw);
                    const c = lhs && compMap[lhs[1]];
                    if (c) { const r = engine.vars.get(6); if (Number.isFinite(r)) viz.nudgeSurface(c.axis, r * c.sign); }
                }
            },
            onPositionChange: (pos) => { if (viz && viz.setToolPosition) viz.setToolPosition(pos); updateDro(pos); checkToolSwap(); if (mode === '2d' && segs.length) { t2.seek(nearest2d(pos)); t2.setToolPosition(pos); } },   // 2D head rides the SAME live pos as the 3D (in sync; ptx/pty puts it on the pinned stock)
            onStatus: ({ message }) => setStatus(message),
            onWait: (wait) => { if (!window.ioPanel) return; if (wait) window.ioPanel.show(); window.ioPanel.setWait(wait); },   // float the I/O panel during a probe/M-code wait
            onFinish: () => {
                if (pendingProbe && viz && viz.probeAxisTouched) viz.probeAxisTouched(pendingProbe, engine.feedVal);   // SLICE 3: a trailing G31 (last line)
                pendingProbe = null;
                if (pendingDatum && engine.vars && viz && viz.markDatumWrite) {   // a trailing WCS write (last line) → flush its committed value
                    const val = engine.vars.get(pendingDatum.target);
                    if (Number.isFinite(val)) viz.markDatumWrite(['x', 'y', 'z'][pendingDatum.off], val);
                }
                pendingDatum = null;
                updateRunBtn();
                if (typeof opts.onLine === 'function') opts.onLine(null);
                if (loopOn) { clearTimeout(loopTimer); loopTimer = setTimeout(() => { lastRunCode = get('getGcode') || lastRunCode; if (viz && viz.resetProbe) viz.resetProbe(); pendingProbe = null; pendingDatum = null; compMap = readEnabledComps(compOps()); engine.run(lastRunCode); updateRunBtn(); }, 2000); }   // 2 s idle so the final datum/result is VISIBLE before looping (was 800 ms — cleared too fast); fresh probe overlay each loop (datum re-derives from the WCS-write)
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
        // Attach the configured SIM probe body dims (Settings → Preview → 3D PROBE) to ANY probe tool, so the
        // rendered touch probe matches what the user set on the diagram. Non-probe tools pass through untouched.
        const withProbe = (t) => (t && t.type === 'probe') ? { ...t, probeDims: (previewPrefs().probe || {}) } : t;
        const ht = get('getTool'); if (ht) return withProbe(ht);
        const m = /\bT(\d+)\b/.exec(code || '');
        if (m) {
            const t = toolsForViz().find((x) => parseInt(x && x.num, 10) === parseInt(m[1], 10));
            if (t) return withProbe({ type: t.type || 'endmill', dia: Number(t.dia) || 6, length: Number(t.length) || undefined });
        }
        if ((parsed && parsed.stats && parsed.stats.probe) > 0) return withProbe({ type: 'probe', dia: 6 });
        return { type: 'endmill', dia: 6 };
    }
    // THE one declared source of the per-pass starts (inc2): the precedence userStarts > pass-0 start > registry hint
    // (getStartHints) > prev. Pure (reads the closures); BOTH feeds — the trace and the engine — call it so they never
    // diverge. The pass COUNT comes from the wizard's hints (which mirror its reposition() calls); single-pass ops have no
    // hints → one start; the engine falls back to _stockOffset past the array. A dragged ② (userStarts) persists.
    function computePassStarts(st) {
        const hints = get('getStartHints');
        const hintFor = (p) => Array.isArray(hints) ? (hints[p] || hints[0]) : null;
        const count = Math.max(Array.isArray(hints) ? hints.length : 0, 1);
        const next = [];
        for (let p = 0; p < count; p++) {
            const h = userStarts[p] || (p === 0 && st) || hintFor(p) || passStarts[p] || { x: 0, y: 0, z: 0 };
            const hint = hintFor(p);   // sim-marker-distinguish (t69): `emits` (+ t83 `source`, t94 `anchorsAtPrev`) is a DECLARED property of the pass HINT (opSimStarts), not of a drag/operator override — so it survives a userStarts drag
            next.push({ x: +h.x || 0, y: +h.y || 0, z: +h.z || 0, emits: !!(hint && hint.emits), source: hint && hint.source, anchorsAtPrev: !!(hint && hint.anchorsAtPrev) });
        }
        return next;
    }

    function setGcode(text) {
        const code = text != null ? text : (get('getGcode') || '');
        // Inferred operator start (wizard preview): probes test from the real tool position so an incremental
        // probe macro doesn't trace from the origin (on the stock face) and clamp its first probe to zero.
        const st = getStartPos();
        // inc2: per-pass starts from computePassStarts — THE one declared source, fed IDENTICALLY to BOTH consumers (the
        // trace's passStarts param below + the engine's _passStarts), so they never diverge. Computed BEFORE the trace.
        passStarts = computePassStarts(st);
        // inc2 SINGLE-FEED coherence: while the sim RUNS, refresh the engine's copy from the SAME computation, so a live
        // edit that changes the starts but NOT the macro (a STOCK change → new hints, same G-code) updates the engine too —
        // scheduleLiveRestart only re-plays on a G-CODE change, so it would otherwise leave _passStarts stale. Gated to
        // code===lastRunCode so a G-code-changing edit (handled by the re-play) never feeds the OLD running pass new starts.
        if (engine && engine.running && code === lastRunCode) engine._passStarts = (passStarts && passStarts.length) ? passStarts : null;
        const stk = stockForViz(), mch = machineForViz(), wo = wcsForViz() || {};
        let parsed;
        try {
            // passStarts → the engine fires each REPOSITION pass's probe from ITS start ② (Part 1), so boss-both collides.
            parsed = traceToolpath(code, { stock: stk, start: st, wcsOffset: wcsForViz(), passStarts });
            // (b) Faithful machine frame: an ABSOLUTE (mill) program's G53 / machine moves must resolve to where the
            // part actually SITS in the envelope, not at part-zero. Part-zero's machine Z = the table + the datum's
            // height above the stock bottom. Re-trace once with that as the work-origin Z so e.g. `G53 Z0` (the
            // end "safe Z" retract) draws at machine home (the top) instead of plunging onto a bottom-datum origin.
            if (mch && mch.show && stk && stk.x > 0 && parsed.stats && parsed.stats.absolute) {
                const z = Math.min(0, mch.z || 0) + datumZFrac(stk.datum) * (Number(stk.z) || 0);
                parsed = traceToolpath(code, { stock: stk, start: st, wcsOffset: { x: wo.x || 0, y: wo.y || 0, z }, passStarts });
            }
        } catch (e) { console.warn('trace failed', e); parsed = { segments: [], stats: {} }; }
        segs = parsed.segments || [];
        // t107 — the per-pass RUNTIME world-ENDs from the trace (machine-faithful re-park anchors: post probe+retract+lift,
        // collision-clamped). Fed to BOTH views so an anchorsAtPrev pass draws its dog-leg FROM where the tool actually is +
        // relocates its marker to the same point; stashed for the Layout drag (relTo:'wall1' → the runtime END). Preview-only.
        const passEnds = parsed.passEnds || null;
        lastPassEnds = passEnds;
        // ONE anchor flag for BOTH views (mirrors the 3D's v._anchorToStart): an op with no established absolute
        // position (an incremental probe) is start-relative → the path emanates from the operator START; an absolute
        // (G90/G53 mill) op sits at its own coords. forceMachine (ATC) pins to the machine frame regardless.
        curAnchor = !forceMachine && !(parsed.stats && parsed.stats.absolute);
        t2.setSegments(segs);   // keep the 2D view in sync so a 2D toggle shows the path immediately
        t2.setStarts(passStarts);   // the draggable 2D start handles — ALL per-pass starts, numbered (①②…)
        // t83 — per-pass reposition source (auto=cyan/straight, manual=amber/arc). PREFER the DECLARED source (the op's sim
        // provider — e.g. corner reads it from the LIVE param travelApproach), over the engine's G-code-TEXT inference
        // (parsed.stats.passSources, unreliable + static — it read 'manual' even at corner's auto default). Fall back to the
        // inference only for ops that DON'T declare a source (middle/edge). ONE declared truth feeds BOTH panels (top + Layout).
        const parsedSrc = (parsed.stats && parsed.stats.passSources) || [];
        const passSources = passStarts.map((s, p) => s.source || parsedSrc[p] || 'auto');
        lastPassSources = passSources;   // t81 — expose to the Layout canvas so its handles match the top panel's colours
        if (t2.setStartSources) t2.setStartSources(passSources);
        if (t2.setStartEmits) t2.setStartEmits(passStarts.map((s) => !!s.emits));   // sim-marker-distinguish (t69): the SHAPE axis (emitting=solid vs sim-only=hollow), orthogonal to the auto/manual COLOUR
        if (t2.setPassEnds) t2.setPassEnds(passEnds);        // t107 — an anchorsAtPrev pass anchors its route + relocates its marker to the previous pass's runtime END (machine-faithful)
        t2.setAnchor(curAnchor);                              // 2D mirrors the 3D anchor: anchored → path emanates from the start, not the stock pin
        t2.setMachine(curAnchor ? null : machineForViz());   // anchored (probe) → LOCAL scene (no envelope), like the 3D's setMachine(null)
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
                const anchor = curAnchor;
                v._anchorToStart = anchor;
                // ONE flag drives the whole frame: an incremental / operator-relative op (a probe) is LOCAL —
                // stock top-at-0 AND no machine envelope; an absolute / WCS op (mill, WCS setup) shows the MACHINE
                // frame — datum-aware stock + the envelope. The op's coordinate nature decides it, not the host.
                if (anchor !== lastAnchor) {
                    v.setStock(stockForViz());
                    v.setMachine(anchor ? null : machineForViz());     // probe → no envelope; mill → per settings
                    lastAnchor = anchor;                               // (the 2D's anchor/machine are set above, for both views)
                }
                // Place EVERY pass's start marker before setSegments so each anchored (probe) pass offsets to its own
                // start. A multi-point probe (rotary 3-point fit, alignment A/B) repositions between touches → one pass
                // each; the wizard supplies a per-pass hint array (getStartHints) so the passes land at DISTINCT points
                // (else all passes default to the same start and the circle solve is degenerate). Pass 0 also honours a
                // user drag (curStart, via st). setSegments has already grown viz.starts to passCount.
                if (v.starts) {   // sync the 3D markers from the shared per-pass starts (computed above for both views)
                    for (let p = 0; p < passStarts.length; p++) v.starts[p] = { x: passStarts[p].x, y: passStarts[p].y, z: passStarts[p].z, anchorsAtPrev: !!passStarts[p].anchorsAtPrev };   // t94 — carry the draw-anchor flag so the route resolves it (marker sprite still uses x/y/z)
                }
                if (v._syncJogPos) v._syncJogPos();   // t297 — BIDIRECTIONAL pendant: refresh the jog-pendant Pos fields from the freshly-mirrored viz.starts, so EVERY drag surface (2D-top handle, Layout ◇/#-handle, 3D gizmo) writes the pendant back — not only the 3D gizmo. Kills the pendant-overrides-handle asymmetric-refresh bug (setGcode runs after every drag). syncPos skips the focused field → live typing is safe.
                if (v.setStartSources) v.setStartSources(passSources);   // colour each start marker by its reposition source (auto=cyan, manual=amber)
                if (v.setStartEmits) v.setStartEmits(passStarts.map((s) => !!s.emits));   // sim-marker-distinguish (t69): SHAPE each marker (emitting=solid vs sim-only=hollow), orthogonal to the colour
                if (v.setPassEnds) v.setPassEnds(passEnds);   // t107 — BEFORE setSegments: the route rebuild anchors an anchorsAtPrev pass at the previous pass's runtime END + relocates its marker sprite to end+cross
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
        if (mode === '2d') { t2.setMachine(curAnchor ? null : machineForViz()); t2.setStock(stockForViz()); t2.fit(); }   // frame the full scene on toggle (anchored → local, like the 3D)
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
        simActiveWcs = null;   // #4: each run reverts to the settings active WCS; the program's G54-G59 lines re-drive it (display only)
        eng.simSpeed = simSpeed();
        eng.autoAnswer = window.ioPanel ? window.ioPanel.isAutoSensors() : true;
        eng.stock = stockForViz();
        eng._stockOffset = getStartPos() || { x: 0, y: 0, z: 0 };   // probes test from the operator start (see trace.js)
        eng._passStarts = (passStarts && passStarts.length) ? passStarts : null;   // Part 1: each REPOSITION pass probes from ITS start ② (boss-both)
        eng._wcsOffset = wcsForViz() || { x: 0, y: 0, z: 0 };          // G53 machine moves draw in the part frame (see trace.js)
        if (mode === '3d') ensureViz();
        if (viz && viz.setSimSpeed) viz.setSimSpeed(simSpeed());   // probe discs fade in SIM time (track the speed button)
        if (viz && viz.resetProbe) viz.resetProbe();    // SLICE 3: fresh probe-WCS each run (superimposed on the stock-WCS)
        pendingProbe = null; pendingDatum = null; compMap = readEnabledComps(compOps());   // fresh deferred state + the active op's declared surfaces, each run
        updateDro(getStartPos() || { x: 0, y: 0, z: 0 });   // DRO: reset to the start position for the fresh run
        if (droWcsEl) droWcsEl.textContent = activeWcsName();   // refresh the label to the active WCS (catches a settings switch)
        if (viz) viz.setAnimate(false);                 // engine drives the tool/trail, not the geometric sweep
        lastTool = null; if (viz && viz.showRetiredTool) viz.showRetiredTool(null);   // P-C.1b: fresh run re-arms the tool-swap watch + clears any retired tool
        if (viz && viz.setStationDevice) { viz.setStationDevice('pusher', false); viz.setStationDevice('pin', false); viz.setStationDevice('collet', false); }   // P-C.2b/3a: devices to rest before the sequence re-animates them
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
    // #18: dragging/declaring the start re-runs the sim animation from the NEW start (not just the static re-trace), so
    // you SEE the probe travel from where you moved it. Once per drag (the handle fires on release). play() reads the
    // updated start via getStartPos() → _stockOffset, so the re-run emanates from there.
    function replayFromStart() {
        if (!active || !segs.length) return;
        stopPlay(); play();
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
    // Stock has no Settings tab, so its "needs setup" signal lives HERE: glow the Stock button while stock is still
    // the shipped default (mirrors the checklist's stockSet detector via window.ddcsStockNeedsSetup).
    const updateStockGlow = () => { const b = q('.pp-stock'); if (b) b.classList.toggle('needs-setup', !!(window.ddcsStockNeedsSetup && window.ddcsStockNeedsSetup())); };
    updateStockGlow();

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
        if (viz && viz.setSimSpeed) viz.setSimSpeed(simSpeed());   // live: re-speed the in-flight disc fades too
        // STICKY: persist the pick to settings.preview.defaultSpeed (the same value the Settings → Preview field shows),
        // so the chosen speed survives a refresh instead of resetting to the default each session.
        const s = window.ddcsGetSettings && window.ddcsGetSettings();
        if (s && s.preview && s.preview.defaultSpeed !== simSpeed()) { s.preview.defaultSpeed = simSpeed(); window.ddcsSaveSettings && window.ddcsSaveSettings(); }
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
    window.addEventListener('ddcs:settings-changed', () => { renderStock(); updateStockGlow(); const m = (viz && viz._anchorToStart) ? null : machineForViz(); if (viz) viz.setMachine(m); t2.setMachine(m); applyPreviewSettings(); if (active) setGcode(); });

    function setActive(on) {
        active = !!on;
        if (!active) { stopPlay(); autoStarted = false; if (viz) viz.setActive(false); if (deviceIoListener) { window.removeEventListener('io_change', deviceIoListener); deviceIoListener = null; } return; }   // t181 tidy: drop the ATC device io_change listener when the preview deactivates (the view re-arms via setAtcSwap on next update)
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

    // Host hint: show/hide the 4th-axis rotary rig (rotary probe ops). Symmetric with setForceMachine — stores the
    // flag so it survives lazy viz creation (ensureViz re-applies it) and applies straight away if the viz exists.
    function setRotaryFixture(on) {
        on = !!on;
        if (on === rotaryFixture) return;
        rotaryFixture = on;
        if (viz && viz.setRotaryFixture) viz.setRotaryFixture(on);   // rebuilds the stock so the rig appears/disappears
        buildDro();   // DRO gains/loses the A/B rows with the rotary rig
    }

    // Arm the ATC tool-swap + device animation for this op. A 'push' (firmware) or 'pick-place' (generic/disk)
    // choreography arms it; anything else disarms. The swap fires from checkToolSwap (below) on the #1300 flip.
    function setAtcSwap(choreo, region) {
        const kind = choreo && choreo.kind;
        atcChoreo = (kind === 'push' || kind === 'pick-place') ? choreo : null;
        atcStation = region || null;
        lastTool = null;
        if (!atcChoreo && viz && viz.showRetiredTool) viz.showRetiredTool(null);
        // Station DEVICES (pusher + locating pin) are the FIRMWARE PUSH only; pick-place has no station devices (its
        // collet is on the SPINDLE — P-C.3a). Reset the collet to CLOSED when (dis)arming.
        if (viz && viz.setStationDevices) viz.setStationDevices(kind === 'push' ? region : null);
        if (viz && viz.setStationDevice) viz.setStationDevice('collet', false);
        if (deviceIoListener) { window.removeEventListener('io_change', deviceIoListener); deviceIoListener = null; }
        if (atcChoreo && viz && viz.setStationDevice) {
            deviceIoListener = (e) => {
                const d = e && e.detail; if (!d || !d.pin || !viz) return;
                if (d.pin === 'OUT_PUSHER') viz.setStationDevice('pusher', !!d.state);              // firmware M160 extend / M161 retract
                else if (d.pin === 'OUT_LOCATING_PIN') viz.setStationDevice('pin', !!d.state);      // firmware M156 engage / M157 release
                else if (d.pin === 'OUT_SPINDLE_UNCLAMP' && d.state) viz.setStationDevice('collet', true);   // pick-place M154 → collet OPEN
                else if (d.pin === 'OUT_SPINDLE_CLAMP' && d.state) viz.setStationDevice('collet', false);    // pick-place M155 → collet CLOSE
            };
            window.addEventListener('io_change', deviceIoListener);
        }
    }
    // Watch #1300 during play — the FIRST value is the starting tool (no swap); a subsequent change old→new IS a real
    // tool change (a program T#/M6), so retire the OLD tool to the station + put the NEW tool on the spindle. Called
    // from onPositionChange, so the swap lands as the push moves execute (≈ at the push stroke). Firmware-scoped.
    function checkToolSwap() {
        if (!atcChoreo || !engine) return;
        const cur = engine.vars.get(1300);
        if (cur == null || cur === lastTool) return;
        if (lastTool == null) {
            // the INITIAL spindle tool. For PICK-PLACE, empty ITS pocket (the tool is in the spindle, not the magazine);
            // a DISK carousel rotates so that pocket sits at the fixed pickup (where it was last picked).
            if (atcChoreo.kind === 'pick-place') renderPickPlaceMag(cur);
        } else doToolSwap(lastTool, cur);   // old → new (a real tool change)
        lastTool = cur;
    }
    // ATC magazine helpers (pick-place occupancy + the disk carousel rotation). Read the config straight from
    // settings.atc; reuse the shared magazinePockets layout (handles the disk RING + a rotation theta).
    const atcCfg = () => (window.ddcsGetSettings && window.ddcsGetSettings().atc) || {};
    const magToolNums = () => (Array.isArray(atcCfg().magazine) ? atcCfg().magazine : []).filter((p) => p && p.tool !== '' && p.tool != null).map((p) => Number(p.tool));
    const isDiskMag = () => atcCfg().magType === 'disk';
    const magPocketIndex = (toolN) => (Array.isArray(atcCfg().magazine) ? atcCfg().magazine : []).findIndex((p) => p && Number(p.tool) === Number(toolN));   // 0-based slot
    // DISK: the ring angle (theta) that brings a tool's pocket to the fixed PICKUP (pocket 0's spot). -(i/n)·2π.
    const diskTheta = (toolN) => { if (!isDiskMag()) return 0; const n = (Array.isArray(atcCfg().magazine) ? atcCfg().magazine : []).length || 1; const i = magPocketIndex(toolN); return i < 0 ? 0 : -(i / n) * Math.PI * 2; };
    // the pocket list for the OCCUPIED tools, at the current ring rotation (theta); disk = ring-laid, else per-tool XY.
    const magPocketList = (occupied, theta) => magazinePockets(atcCfg(), theta || 0).filter((p) => p.tool && occupied.has(Number(p.tool.num)));
    const pocketPos = (toolN, theta) => { const p = magazinePockets(atcCfg(), theta || 0).find((q) => q.tool && Number(q.tool.num) === Number(toolN)); return p ? { x: Number(p.x) || 0, y: Number(p.y) || 0, z: Number(p.z) || 0 } : null; };
    // Render the pick-place magazine with `spindleTool` REMOVED (it is on the spindle) + the disk ring ROTATED so
    // spindleTool's pocket sits at the pickup (the carousel just indexed it there). theta stored on the viz for tests.
    function renderPickPlaceMag(spindleTool) {
        const theta = diskTheta(spindleTool);
        if (viz) { viz._diskTheta = theta; if (viz.setMagazine) viz.setMagazine(magPocketList(new Set(magToolNums().filter((t) => t !== spindleTool)), theta)); }
    }
    function doToolSwap(oldN, newN) {
        const tools = toolsForViz();
        const spec = (n) => tools.find((t) => t && Number(t.num) === Number(n)) || { type: 'endmill', dia: 6, length: 35 };
        if (atcChoreo && atcChoreo.kind === 'pick-place') {
            // PICK-PLACE: the OLD tool RETURNS to its pocket + the NEW tool LEAVES its pocket → onto the spindle. Occupancy
            // = all tools MINUS the new one; the ring rotates so the new (just-picked) pocket is at the pickup (disk).
            renderPickPlaceMag(newN);
            if (viz && viz.highlightStation) { const th = diskTheta(newN), o = pocketPos(oldN, th), n = pocketPos(newN, th); if (o || n) viz.highlightStation({ z: Math.max((o || n).z, (n || o).z), start: o || n, end: n || o, retreat: n || o }, 'TOOL CHANGE'); }
            if (viz && viz.setSimTool) viz.setSimTool(spec(newN));   // NEW on the spindle (part frame — cross-frame)
        } else {
            // PUSH (firmware): retire the OLD tool to the push station (P-C.1b — UNCHANGED).
            if (viz && viz.showRetiredTool) viz.showRetiredTool(spec(oldN), atcStation);
            if (viz && viz.setSimTool) viz.setSimTool(spec(newN));
        }
    }

    return { setGcode, refresh, setActive, setView: setMode, stop: stopPlay, seekLine, getStartPos, setForceMachine, setRotaryFixture, setAtcSwap, onStartDrag, getPassStarts: () => passStarts, getPassSources: () => lastPassSources, getPassEnds: () => lastPassEnds, get viz() { return viz; }, get engine() { return engine; }, el: container };
}
