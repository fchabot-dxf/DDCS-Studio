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
import { createToolpath2d, typeOf, dashFor } from './toolpath2d.js';   // t1205 — typeOf: the ONE render-time classification the legend must share with the paint
import { LEGEND_ROWS } from './pathStyle.js';   // t317 — the ONE declared path-visual palette (the legend reads it, can't drift from the renderers)
import { traceToolpath } from '../engine/trace.js';
import { passAnchorFor } from '../engine/passAnchor.js';
import { markerWorldOf } from './markerWorld.js';   // t1235 — the ONE marker-world source the connector's far end reads   // t1205 — the ONE pass→world anchor the 3D tool + the engine DRO registers already read; the readout must use it too
import { carveTipForToolType } from '../engine/stockRemoval.js';   // t682 — the carve tip PROFILE from the tool `type` (ball-nose etc.), one source
import { wcsOffsetAt, declaredWcsOffset } from './sceneFrame.js';   // t588 — wcsOffsetAt = the ONE WCS read for RENDERING (engine G53 + 2D frame; keeps the workOrigin fallback). t861 — declaredWcsOffset = the HONEST Mach source (null when no declared WCS row, no scene-placement fallback).
import { toggleVisibilityModal } from '../ui/visibilityModal.js';   // t738 — the preview-visibility modal (opens from the toolbar 👁)
import { onDisplayChange } from './displayPrefs.js';   // t738 — re-apply the visibility registry to THIS panel on any modal change
import { GcodeExecutionEngine } from '../engine/index.js';
import { placementDeclared } from '../engine/envelopeCheck.js';   // t1836 — the ONE existing "is a WCS placement on file" gate (pre-flight's own predicate), reused by the frame note rather than re-derived
import { toggleStockEditor } from '../ui/stockEditor.js';
import { droAxisLabel, droValue, droWorkShift } from './latheDro.js';   // t1283 — the readout speaks diameter on a lathe   // the rich Stock modal (dims / shape boss-pocket-cylinder / show / templates)
import { getLastOp } from '../blocks/opRecord.js';          // the active op (wizard PREVIEW) → its declared radius-comp surfaces
import { builderOf, opLabelOf } from '../blocks/opBuilders.js';        // rebuild the op stack to read its radiuscomp atoms (disc-on-surface, inc2); opLabelOf: t1834's frame-note wording
import { magazinePockets, magazineOccupiedPockets } from '../wizards/views/atcViews.js';   // shared ATC magazine layout (handles the disk RING + a rotation) — reused for the pick-place occupancy swap; magazineOccupiedPockets (t1722) is the ONE function both this whole-program host and the single-op wizard preview call for the static "which pockets have tools" fact

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
// t588 PREVIEW-PARITY E2d — read the SETTINGS-active WCS offset from THE ONE frame source (sceneFrame.wcsOffsetAt); no local
// table lookup. Preserves the null-when-no-machine contract (callers `|| {0,0,0}`); wcsOffsetAt never returns null when m exists.
const wcsForViz = () => { const m = (window.ddcsGetSettings && window.ddcsGetSettings().machine) || null; return m ? wcsOffsetAt(m, (m.wcs && m.wcs.active) || 1) : null; };
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
    <div class="pp-progress" aria-hidden="true"><div class="pp-progress-fill"></div></div>
  </div>
  <div class="viz3d-controls">
    <button class="pp-mtoggle viz3d-2dtoggle" type="button" title="Toggle 2D / 3D view">3D</button>
    <button class="pp-stock" type="button" title="Stock — set the workpiece (dimensions, shape, show, templates)" aria-label="Stock">📦</button>
    <button class="pp-vis" type="button" title="Show / hide preview elements (stock, toolpath, tool, envelope, …) + their opacity" aria-label="Preview visibility">👁</button>
    <button class="pp-speed" type="button" title="Simulation speed — tap to cycle 1× 2× 5× 10× 20×" aria-label="Simulation speed">1×</button>
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
  <div class="viz3d-hint">drag orbit · wheel zoom · right/middle-drag pan · dbl-click fit work/machine</div>
  <div class="pp-carve-note" style="display:none" title="Material-removal preview: flat, ball-nose, and V-bit / chamfer / engraver tips are modelled from the tool type (a vee carves a V groove that widens with depth); with no tool picked, an op carves at its typed Ø (Ø6 default)."></div>
  <div class="pp-frame-note" style="display:none"></div>
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

/**
 * THE INTER-PASS CONNECTOR (t1235 Turn B) — the segment that bridges one probe pass to the next.
 *
 * WHY IT HAS TO BE SYNTHESISED: the wizards mark a pass boundary with a `REPOSITION:` comment, and the engine treats
 * that comment as the DELIMITER — it records the finishing pass's runtime end, increments `_pass` and resets the local
 * position. The traverse the operator (or the program) actually makes between the two passes is therefore consumed by
 * the boundary itself: it is never traced as a segment, and the drawn route ends up as a set of disconnected within-pass
 * fragments. That gap is the "traverse that never connects".
 *
 * BOTH ENDPOINTS ARE REAL POSITIONS — nothing here is invented geometry:
 *   FROM  passEnds[p-1]                    the previous pass's RUNTIME end (post probe + retract + lift, collision-clamped)
 *   TO    markerWorldOf(starts, ends, p)   where pass p's start marker actually renders (the same one source the 3D
 *                                          sprite and the Layout handle read), so it ends ON the marker BY DEFINITION
 *                                          and follows it on every drag without any drag-time bookkeeping.
 * Expressed in pass p's own frame (world − passAnchorFor), because that is the frame every segment of pass p is drawn in.
 *
 * CLASSIFICATION: a plain rapid. The renderers then decide what that MEANS through their existing declared language —
 * `typeOf` promotes a horizontal rapid to `lifted` (the dimmed dashed safe-travel), and a pass whose declared source is
 * MANUAL draws its traverse in the amber jog style, because the 2D reads `startSources[s.pass]`. The connector inherits
 * the operator-jog look for free rather than hardcoding a second style.
 */
function withInterPassConnectors(segs, starts, passEnds) {
    const list = Array.isArray(segs) ? segs : [];
    if (!Array.isArray(starts) || starts.length < 2 || !Array.isArray(passEnds)) return list;
    const bridge = (p) => {
        // t1670 — a pass declared anchorsAtPrev (corner's AUTO reposition) anchors its own local frame AT passEnds[p-1]
        // (passAnchorFor, below, returns ends[p-1] for exactly this row) — so this bridge's local start (`a`) always
        // reduces to {0,0,0}, the SAME point pass p's own real traced segments already begin at (the engine resets pos to
        // {0,0,0} on every REPOSITION boundary). The bridge is then geometrically redundant with the real route, not a
        // gap-filler: in diagonal mode the two exactly coincide (an invisible duplicate segment); in dogleg mode the real
        // route is a 2-leg polyline the single-segment bridge does NOT coincide with, so both render — the double-traverse
        // defect a user reported on the Corner (data) twin (NEXT-SESSION.md, 2026-08-09). Skip the bridge whenever the
        // pass declares this — its connecting traverse is already a real, traced part of the route, unlike the ops this
        // connector exists for (a self-anchored / manual pass, where the real segments never cover the inter-pass gap).
        if (starts[p] && starts[p].anchorsAtPrev) return null;
        const from = passEnds[p - 1];
        if (!from) return null;                       // no runtime end recorded → nothing honest to draw from
        const to = markerWorldOf(starts, passEnds, p);
        const off = passAnchorFor(starts, passEnds, p) || { x: 0, y: 0, z: 0 };
        const a = { x: (+from.x || 0) - off.x, y: (+from.y || 0) - off.y, z: (+from.z || 0) - off.z };
        const b = { x: (+to.x || 0) - off.x, y: (+to.y || 0) - off.y, z: (+to.z || 0) - off.z };
        if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) < 1e-6) return null;   // the passes already coincide — no traverse happened
        return { x1: a.x, y1: a.y, z1: a.z, x2: b.x, y2: b.y, z2: b.z,
            rapid: true, probe: false, type: 'rapid', feed: 0, pass: p, line: -1, connector: true };
    };
    // Insert each connector immediately BEFORE the first segment of its pass, so the animation's traveled/future split
    // and the eye both read it as what it is: the move that gets you to that pass.
    const out = [];
    let seen = 0;
    for (const s of list) {
        const p = +s.pass || 0;
        while (seen < p) { seen++; const c = bridge(seen); if (c) out.push(c); }
        out.push(s);
    }
    while (seen < starts.length - 1) { seen++; const c = bridge(seen); if (c) out.push(c); }   // trailing passes with no segments of their own
    return out;
}

export function createPreviewPanel(container, opts = {}) {
    const get = (k) => (typeof opts[k] === 'function' ? opts[k]() : opts[k]);
    // E3 (rotary round-bar) — a per-op SIM-STOCK override: if the op declares `getStock` (a DERIVED preview stock, e.g. the
    // rotary round bar projected from #57), use it for THIS panel's viz/engine/trace; else the shared global stock. Sim-only,
    // no settings.stock mutation. Every other op omits getStock → previewStock() === stockForViz() (byte-identical behaviour).
    const previewStock = () => { try { const s = (typeof opts.getStock === 'function') ? opts.getStock() : null; return s || stockForViz(); } catch (_) { return stockForViz(); } };
    container.classList.add('preview-panel');
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.insertAdjacentHTML('beforeend', PANEL_HTML);
    const q = (sel) => container.querySelector(sel);
    const cv2d = q('.pp-2d');
    const statusEl = q('.pp-status');
    // t865 — the PROGRESS BAR: a thin fill next to the "Running line N/total" counter, ONE SOURCE with it (both driven
    // by the engine's current line + engine.totalLines; see onLineChange). Visible only while playing; hidden when idle.
    const progressEl = q('.pp-progress'), progressFill = q('.pp-progress-fill');
    const setProgress = (lineIndex) => {
        if (!progressEl || !progressFill) return;
        const total = (engine && engine.totalLines) || 0;
        if (lineIndex == null || total <= 0) { progressEl.classList.remove('on'); progressFill.style.width = '0%'; return; }
        const frac = Math.max(0, Math.min(1, (lineIndex + 1) / total));
        progressEl.classList.add('on'); progressFill.style.width = (frac * 100).toFixed(1) + '%';
    };
    let curStart = null;   // operator start the user dragged (2D handle / 3D marker); getStartPos() reads it (pass 0)
    let passStarts = [];   // INC1: per-pass operator starts [{x,y,z}] — the shared source of truth for BOTH views' numbered markers
    let userStarts = [];   // INC2: per-pass USER overrides (a jog or a drag) — these BEAT the wizard's inferStarts HINT so an edited ② STICKS (the hint only positions an un-touched pass)
    let lastPassSources = [];   // t81 — the latest per-pass reposition sources (auto/manual), exposed (getPassSources) so the Layout canvas colours its handles to MATCH the top panel
    let lastPassEnds = null;    // t107 — the latest per-pass runtime world-ENDs from the trace, exposed (getPassEnds) so the Layout canvas relocates its reposition marker + anchors the END-relative drag to the SAME runtime END
    // t592 PREVIEW DRAGS WRITE THE PROGRAM — a host writer for an op that DECLARES a marker→param binding (simStartParams):
    // a preview-panel marker drag (this 2D top handle OR the 3D gizmo) routes through THE SAME writer the Layout canvas uses
    // (userOpView.writeSimStartFrac), so it writes the BOUND PARAMS (fraction / relSpanFrom span, with the envelope clamp +
    // handle independence) → recorded + re-emitted → every surface follows. Returns true when it wrote (→ skip the sim-only
    // userStarts write below; the host's re-render moves the marker from the params). Absent / returns false → today's sim-only
    // behavior (a manual-jog start on a non-declared op is legitimately sim-only — the DECLARED line).
    let markerDragWriter = null;
    function setMarkerDragWriter(fn) { markerDragWriter = (typeof fn === 'function') ? fn : null; }
    // A per-pass start drag from ANY view — the 2D toolpath handle, the 3D marker, or the feature-canvas ②-aim handle —
    // records it as the USER override (a sim-only DECLARED value: it BEATS the inferStarts hint + persists), mirrors to the
    // 3D marker, then re-traces + replays from the new start. ONE seam, so every view edits the SAME userStarts (the
    // feature-canvas drag is just another writer of it — exposed on the panel return for the view-owned canvas).
    function onStartDrag(pos, pass) {
        const p = pass | 0;
        // t1000 — a WORK-FRAME start (a probe like the corner) has a FIXED approach-Z (the provider's, e.g. a few mm down the
        // wall); dragging it in the XY plane must NOT move it in Z (handles-are-independent, extended to Z). The corner has no
        // markerDragWriter → it fell to the pin below and stamped the dragged pos.z into userStarts[p], shifting the sim Z. So
        // for a work-frame op hold the current provider Z. A MACHINE-FRAME start (homing) is a real 3D machine position whose Z
        // IS draggable → keep pos.z there. (The other 4 probes route through markerDragWriter → they return early below.)
        const z0 = (!machineFrameTool && passStarts[p] && Number.isFinite(+passStarts[p].z)) ? +passStarts[p].z : (+pos.z || 0);
        const np = { x: +pos.x || 0, y: +pos.y || 0, z: z0 };
        if (markerDragWriter && markerDragWriter(p, np)) return;   // t592 — a declared op: the bound params were written + the host re-rendered; the marker follows the param, so no sim-only userStarts override
        passStarts[p] = np; userStarts[p] = np;          // shared source of truth + USER override (beats the hint, persists)
        if (p === 0) curStart = np;                      // pass 0 = the operator start getStartPos() reads
        if (viz && viz.starts) viz.starts[p] = np;       // mirror to the 3D marker
        setGcode(); replayFromStart();                   // #18: re-run the sim from the new start
    }
    const t2 = createToolpath2d(cv2d, { onStartDrag });
    t2.setMachine(machineForViz()); t2.setStock(previewStock()); t2.setWcs(wcsForViz());   // 2D mirrors the 3D scene

    let viz = null;            // GcodeViz3D (lazy — only when 3D is shown and WebGL is available)
    // forceMachine: a host hint that this op is INHERENTLY machine-frame (ATC tool changes move in G53) so the
    // envelope must always draw, even when the traced path happens not to reach a G53 (auto-change with no tool
    // loaded, warmup/drawbar with no motion, the parameter-write table). Set by the host via setForceMachine().
    let forceMachine = false;
    let rotaryFixture = false;   // host hint: show the 4th-axis rig (rotary probe ops). Applied to the lazy viz on create + on toggle.
    let machineFrameTool = false;   // t497 host hint: render the live tool in the MACHINE frame (homing — no stock shift). Re-applied on lazy viz create.
    let seatAtStart = false;   // t570 host hint: SEAT the trace/engine INITIAL POSITION at the draggable Start (marker A) — the homing initialPos seam WITHOUT the machine-frame tool render (alignment: an in-place probe on the WCS/part frame; the drawn path must begin at A, not origin).
    const startSeated = () => machineFrameTool || seatAtStart;   // either hint seats the initial position at the Start (homing's machine-frame tool implies it; alignment opts in without the machine-frame render)
    // t1203 host hint ([[probes-never-read-wcs]]): this program PROBES FOR the WCS, so its machine-frame G53 excursions must
    // render via the honest safe-Z margin approximation EVEN WHEN a WCS table is declared (that table describes a DIFFERENT,
    // previously-measured setup — not the one being probed). Declared per-op in opSimContext; applied via setProbesForWcs.
    let probesForWcs = false;
    // P-C.1b: the FIRMWARE ATC tool-swap context. atcChoreo (the push choreography) + atcStation (its region) are armed
    // by the atc_change firmware view; during play we watch #1300 and, on a REAL tool change (a program T#/M6), retire
    // the OLD tool to the station + put the NEW tool on the spindle. lastTool tracks the previous #1300 (the FIRST value
    // seen is the starting tool, NOT a swap). Isolated firmware op (no tool change) → #1300 never flips → no swap.
    let atcChoreo = null, atcStation = null, lastTool = null, deviceIoListener = null;
    let limitEdges = null, limitIoListener = null;   // H4 (t487) — the home/limit switch devices + their io_change trip listener
    let mode = previewPrefs().defaultView === '2d' ? '2d' : '3d', active = false, segs = [], fitted = false, lastAnchor = null, lastStockKey = '', curAnchor = false, lastPreviewStockSig = '';
    let toolPosSubs = [];   // t309 — live-tool-position subscribers (the Layout animation overlay). Fed the SAME engine head as the 3D/2D, in ANY view mode; cb(pos, segIndex) each tick, cb(null,0) on stop.
    let touchSubs = [];      // t319/INC-6 — on-touch (G31 contact) subscribers (the Layout overlay's pulse). cb({pos, axis, feed, slow, pass, speed}).
    let lastPass = 0;        // the live tool's current pass index (from onPositionChange) — the pulse rides the SAME per-pass anchored frame as the head
    let lastRunCode = null, loopOn = false, loopTimer = null, autoStarted = false, liveTimer = null;
    let lastAbsolute = false;   // t580 PREVIEW-PARITY E1 — the last trace's absolute-ness (mill G90/G53), so play() picks the SAME mill part-Z work origin the drawn route did (simConfig)
    // t680 — MATERIAL REMOVAL (E1): the static END-STATE (on setGcode) + the LIVE progressive carve (during play), throttled
    // with an honest degrade (F). ON by default; a preview.carve=false toggle turns it off. Per-panel (G) — the viz owns the map.
    const carveEnabled = () => previewPrefs().carve !== false;
    let _carveTR = 3, _carveTip = 'flat', _carveAngle = 90, _carvePrev = null, _carveDirty = false, _carveLastRemesh = 0, _carveHeavySince = 0, _carveDegraded = false, _carveSegs = [], _carveRaf = 0;
    let _flipBoundaries = [], _flipsApplied = new Set();   // t881 — two-sided setup-flip boundaries {emitted-line, axis} + which fired this run
    // t875 — V-CARVE: the vee included angle for the carve cone (the tool's declared angle, else a per-type default).
    const _VEE_DEFAULT = { vbit: 90, chamfer: 90, engraver: 30 };
    const veeAngleOf = (t) => (Number(t && t.angle) > 0 ? Number(t.angle) : (_VEE_DEFAULT[t && t.type] || 90));
    // The END-STATE carve (build the grid mesh + carve every segment + re-mesh) is DEFERRED to the next frame so it never
    // blocks setGcode / a drag / a wizard open. A panel that closes before the frame (a transient wizard, e.g. the params
    // sweep opening 40 wizards in a tight loop) cancels it via setActive(false) → the carve costs nothing there. The LIVE
    // per-frame carve during play is separate (onPositionChange, already rAF-throttled).
    function scheduleEndStateCarve(v, hasCut) {
        if (_carveRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(_carveRaf);
        _carveRaf = 0;
        // No cuts (probe / rapid-only) or carve off → show the plain stock box, build NOTHING (setCarve(false) no-ops if it
        // was never on). This is the big win: probe wizards (corner/alignment/middle) never pay the carve-mesh cost.
        // t1283 — A LATHE BAR ALWAYS CARVES ITS PROFILE. The gate above exists for the mill's heightmap, which is
        // expensive and pointless on a probe program; the turned profile is one array per bar and IS the picture, so
        // a lathe never opts out of it.
        const lathe = !!(v._isLatheStock && v._isLatheStock());
        if (!lathe && (!carveEnabled() || !hasCut)) { if (v.setCarve) v.setCarve(false); return; }
        const run = () => {
            _carveRaf = 0;
            if (!active || !v.setCarve) return;   // deactivated/closed before the frame → skip
            v.setCarve(true);
            if (lathe || !(engine && engine.running)) v.carveEndState(_carveSegs, _carveTR, _carveTip, _carveAngle);
        };
        _carveRaf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(run) : (run(), 0);
    }
    function carveRemeshThrottled() {
        if (!_carveDirty || !viz || !viz.carveLiveCrisp) return;
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
        if (now - _carveLastRemesh < 45) return;   // carve EVERY tick; re-mesh batched (~22fps) — the ruling's rAF throttle
        _carveLastRemesh = now; _carveDirty = false;
        // t816 — INCREMENTAL LIVE CRISPING: re-mesh the CRISP walls over JUST the dirty rect (the wall crisps a beat behind
        // the cutter). The first call swaps the smooth mesh for the crisp one (a one-time build ~ the stop-crisp cost); later
        // calls splice the sub-rect (~0.1ms). Degrade still guards a sustained heavy program (the one-time init self-resets).
        const cost = viz.carveLiveCrisp();
        // DEGRADE (F): re-mesh cost > 8ms sustained ~1s → stop the live re-mesh and JUMP to the full end-state (a manual toggle overrides)
        if (cost > 8) { if (!_carveHeavySince) _carveHeavySince = now; else if (!_carveDegraded && now - _carveHeavySince > 1000) {
            _carveDegraded = true; setStatus('Live carve paused (heavy program) — showing the end-state');
            if (viz.carveEndState) viz.carveEndState(_carveSegs, _carveTR, _carveTip, _carveAngle);   // fall back to end-state-only NOW, not a frozen partial
        } } else _carveHeavySince = 0;
    }

    // DRO — a dual numeric readout mirroring the DDCS controller: Work (the tool's program position) + Mach. Work comes
    // straight from onPositionChange; Mach = Work + the ACTIVE WCS offset. `activeWcsOffset()` is the SINGLE swap-point:
    // today the sim has one offset (wcsForViz = settings.machine.workOrigin, so G54=G55=G59), but reading it LIVE here
    // means when the engine gains a real per-G54-G59 WCS table, this call returns the active WCS's offset and the Mach
    // column becomes truly per-WCS with NO change to the DRO. The Work column flashes + the WCS label updates on a
    // WCS/probe event (reusing the slice-2 classify hook). Rows = X/Y/Z, plus A/B when the rotary rig is shown.
    const droEl = q('.pp-dro'), droWcsEl = q('.pp-dro-wcs'), droBody = q('.pp-dro-tbl tbody');
    let simActiveWcs = null;   // #4: a G54-G59 PROGRAM LINE overrides the active WCS for the SIM/DRO ONLY (never settings.machine.wcs.active); reset each run
    const activeWcsIdx = () => { if (simActiveWcs) return simActiveWcs; const m = machineForViz(); return (m && m.wcs && m.wcs.active) || 1; };
    // Mach = Work + this; follows the program-driven active WCS once a G54-G59 line fired (simActiveWcs → activeWcsIdx),
    // else the settings active. t588 — reads THE ONE frame source (wcsOffsetAt); the sim override lives in activeWcsIdx, passed in.
    const activeWcsOffset = () => wcsOffsetAt(machineForViz(), activeWcsIdx());
    const activeWcsName = () => 'G' + (53 + activeWcsIdx());   // table[0]=G54
    let droAxes = ['x', 'y', 'z'];
    function buildDro() {
        droAxes = rotaryFixture ? ['x', 'y', 'z', 'a', 'b'] : ['x', 'y', 'z'];
        // t1283 — the X row is marked Ø on a lathe: a turner reads diameters, and an UNMARKED doubled number is
        // indistinguishable from a bug. The frame stays radius underneath — this is a display, not a second frame.
        if (droBody) droBody.innerHTML = droAxes.map((ax) => `<tr data-ax="${ax}"><th>${droAxisLabel(ax)}</th><td class="pp-dro-w">0.000</td><td class="pp-dro-m">0.000</td></tr>`).join('');
    }
    // t1205 — PASS-LOCAL → WORLD. The engine runs a multi-pass probe macro in PASS-LOCAL coords (every `( REPOSITION: )`
    // resets pos to the pass origin) and reports that local position plus `pass`; the CONSUMER anchors it. The 3D tool
    // already does (gcodeViz3d.setToolPosition → passAnchorFor) and so do the engine's own DRO registers — but the READOUT
    // did not, so after any reposition it quoted the pass-local number as Work (e.g. Work −70 while the tool was correctly
    // at world −5). ONE conversion, every consumer: same helper, same arrays.
    function worldOf(pos) {
        if (!pos) return pos;
        // PREFER the engine's OWN stamp: it resolved the anchor from its LIVE pass state. Stitching here with the panel's
        // route-trace copy drifts whenever the two were traced under different configs (measured: the same corner run
        // reported anchors -5 / 70 / 20 / 90 across re-traces). The local stitch remains for positions the engine never
        // produced — the static seekLine scrub, which reads the SAME traced segs as lastPassEnds, so those two agree.
        if (pos.world) return { ...pos, ...pos.world };
        const o = passAnchorFor(passStarts, lastPassEnds, (pos.pass != null ? pos.pass : 0)) || { x: 0, y: 0, z: 0 };
        return { ...pos, x: (+pos.x || 0) + (+o.x || 0), y: (+pos.y || 0) + (+o.y || 0), z: (+pos.z || 0) + (+o.z || 0) };
    }
    function updateDro(rawPos) {
        if (!droBody) return;
        const pos = worldOf(rawPos);   // quote the WORLD position the tool is actually at, not the pass-local one
        // t861 — HONEST Mach: quote Mach = Work + the DECLARED WCS offset ONLY. No declared WCS row (typed or pulled) →
        // we cannot know the machine offset, so the Mach column shows "—" rather than a scene-placement placeholder dressed
        // as controller truth (the +40 Mach-Z leak). The engine G53 rendering keeps activeWcsOffset() (workOrigin fallback).
        const off = declaredWcsOffset(machineForViz(), activeWcsIdx());
        // t1301 — a start-anchored op reports against a start expressed in the STOCK frame; a lathe bar's work zero is
        // its CENTRELINE, half a diameter away. Take that shift off before displaying, or the readout puts the stylus a
        // whole radius further out than it is. Display only — nothing downstream reads this.
        const shift = droWorkShift(previewStock());
        droAxes.forEach((ax) => {
            const w = (+(pos && pos[ax]) || 0) - (+shift[ax] || 0);
            const row = droBody.querySelector(`tr[data-ax="${ax}"]`);
            // t1283 — BOTH columns go through the one formatter: on a lathe X reads as a DIAMETER (Work and Mach
            // alike), everything else passes through. The number the machine holds is still the radius.
            if (row) {
                row.children[1].textContent = droValue(ax, w).toFixed(3);
                row.children[2].textContent = off ? droValue(ax, w + (+off[ax] || 0)).toFixed(3) : '—';
            }
        });
    }
    function setDroWcs(raw) {   // a G54-G59 select drives the SIM active WCS — label + Mach offset (G10 set-offset keeps the current label)
        const m = String(raw || '').replace(/\([^)]*\)/g, ' ').match(/\bG5([4-9])\b/);
        if (!m) return;
        simActiveWcs = +m[1] - 3;                            // G54→1 … G59→6 — SIM/viz DISPLAY ONLY, never settings.machine.wcs.active
        // t1241 A2 — this used to assign the RAW table row straight onto the running engine, which threw away the two
        // things the route's own frame applies: the machine-frame zeroing and the mill part-Z map. Mid-program the tool
        // then ran in a different frame from the route it was drawing over. Reseed through THE ONE config instead.
        if (engine) applySimConfig(engine, lastAbsolute);
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
        new ResizeObserver(() => {
            if (mode === '2d') t2.redraw();
            // t1768 — the legend/DRO overlay from the TOP, the toolbar from the BOTTOM; in a short box (the
            // Blocks pane's mobile drawer) they can collide. Read the ACTUAL box height rather than add a THIRD
            // width breakpoint on top of the two that already govern .wiz-viz3d's own height — a container this
            // narrow isn't necessarily this short (desktop two-pane vs. the mobile stack collapse differently).
            container.classList.toggle('viz3d-compact', container.clientHeight < 200);
        }).observe(container);
    }

    // t867 rider — the status chip shows the RAW EXECUTING LINE (one source with the editor highlight): "N · <verbatim
    // source>", end-trimmed with an ellipsis when long. The per-move paraphrase (length / feed / seconds) demotes to the
    // hover tooltip (set from the engine's RUNNING status; see onStatus). The progress bar underneath is unchanged (t865).
    const CHIP_MAX = 52;
    // t1239 (user) — THE CALC TAG. Stepping through a probe macro spends many lines on ARITHMETIC (register assigns, IF
    // tests, comments) where nothing moves, and a chip that only ever showed a line read as a frozen sim. A small tag
    // says which kind of line you are on, so "nothing moved" becomes "nothing was SUPPOSED to move". Display only — it
    // reads the same raw line the chip already shows and changes no semantics.
    /**
     * ⚠ t1395 — THREE OF THESE PATTERNS CONTAINED A LITERAL BACKSPACE (0x08) WHERE `\b` WAS MEANT, and had since well
     * before the drill arc. A `\b` written through any quoting layer that eats escapes becomes the control character it
     * names, and the result LOOKS right in every log and diff — which is why it survived so long.
     *
     * The effect was not subtle once traced: `/\x08G0?[0-3]\x08/` can never match, so ordinary motion fell through to the
     * `[MG]\d` catch-all and every G0/G1 line was tagged **`set`** — "a mode with no motion" — while the tool was moving.
     * G31/G38 probes got the same wrong tag, and M98/M99 lost `flow` to `set` too. Since the chip shows the executing
     * line, that mislabelled most of a running program. Found by the t1393 sweep for stray 0x08 bytes.
     */
    const calcTagOf = (raw) => {
        const t = String(raw == null ? '' : raw).trim();
        if (!t) return '';
        if (/^\s*[(;]/.test(t)) return 'note';                       // a comment
        if (/^\s*(IF|WHILE|GOTO|END\d|DO\d|M9[89])\b/i.test(t)) return 'flow';   // a branch / loop / call
        if (/^\s*#\s*\d+\s*=/.test(t) || /^\s*#\s*\[/.test(t)) return 'calc';   // a register assignment
        if (/\bG3[18]\b/i.test(t)) return '';                        // a probe IS motion
        if (/\bG0?[0-3]\b|\bG53\b/i.test(t)) return '';            // ordinary motion — no tag
        if (/^\s*[MG]\d/i.test(t)) return 'set';                     // a mode / M-code with no motion
        return '';
    };
    const fmtExecLine = (lineNo, raw) => {
        const t = String(raw == null ? '' : raw).trim();
        const tag = calcTagOf(t);
        return `${lineNo} · ${t.length > CHIP_MAX ? t.slice(0, CHIP_MAX - 1) + '…' : t}${tag ? `  [${tag}]` : ''}`;
    };
    const setStatus = (text, isError = false) => {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.classList.toggle('has-error', !!isError);
        statusEl.title = '';   // t867 rider — a fresh text status clears any stale paraphrase tooltip (the tooltip is owned by the running paraphrase)
        const cp = q('.pp-copy'); if (cp) cp.classList.toggle('visible', !!(text && text.length));
    };
    const SPEEDS = [1, 2, 5, 10, 20];   // 20× tier (t786) — a fast fly-through for long programs; app-wide (users get it too)
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
        // t744 — rapid visibility + which assembly parts show FOLDED into the ONE visibility registry (displayPrefs → viz.applyDisplay);
        // the settings.preview.showRapids / .parts switches are gone. gridStep (spacing, not visibility) + head (body sizes) stay here.
        if (viz.setGridStep) viz.setGridStep(pv.gridStep);   // Preview → grid spacing (mm; 0/'' = auto)
        if (viz.setHead) viz.setHead(pv.head);               // Preview → spindle/collet body sizes (sim-only, match the real machine)
    }
    const nearest2d = (pos) => {
        let bi = 0, bd = Infinity;
        for (let i = 0; i < segs.length; i++) { const s = segs[i], dx = s.x2 - pos.x, dy = s.y2 - pos.y, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; bi = i; } }
        return bi + 1;
    };
    // t319/INC-6 — a G31 CONTACT: fire the touch pulse into the top 2D + the Layout overlay (the 3D already flashes its
    // own disc via viz.probeAxisTouched). SLOW = a fine re-probe (feed < the program's max probe feed) → a BIGGER pulse.
    function firePulse(axis) {
        const p = (engine && engine.pos) || {}, feed = (engine && engine.feedVal) || 0;
        let maxPF = 0; for (const s of segs) { if ((s.type === 'probe' || s.probe) && (s.feed || 0) > maxPF) maxPF = s.feed; }
        const ev = { pos: { x: +p.x || 0, y: +p.y || 0, z: +p.z || 0 }, axis, feed, slow: feed > 0 && feed < maxPF, pass: lastPass, speed: simSpeed() };
        if (t2 && t2.pulse) t2.pulse(ev);
        for (const cb of touchSubs) cb(ev);
    }

    /**
     * ── t1460 — SURFACE 6: the 3D PREVIEW's right-click menu ──────────────────────────────────────────────────────
     *
     * The 3D view already SUPPRESSES the native menu (gcodeViz3d does `contextmenu → preventDefault`, because
     * right-drag pans), so this is a menu on a surface that had one taken away rather than one competing for it.
     *
     * ── RULE 1, CHECKED PER ENTRY ────────────────────────────────────────────────────────────────────────────────
     *   VIEW PRESETS  the ViewCube in the corner already snaps the camera to a named face — `pickCube` calls the same
     *                 `viz.setView(v)` these entries call. The menu is the keyboard-free, cube-free way to the same
     *                 three views a user actually asks for.
     *   FIT           the panel's own hint line already advertises it in words: *"dbl-click fit work/machine"*. The
     *                 entry names the behaviour that hint describes, calling the same `fitAll` the dblclick handler
     *                 does — including its wide/work toggle, so the menu and the gesture stay one behaviour.
     *   THE 3 LINKS   each opens a surface that exists and is reachable on its own: Settings → Machine, Settings →
     *                 Preview, and the Stock modal (`ddcsOpenStock`, the same door the Setup checklist uses).
     *
     * ⚠ AND THE LINK LIST IS CAPPED AT THREE, DELIBERATELY. The rule for this menu is that a link earns its place by
     * GOVERNING WHAT THE VIEW SHOWS — the envelope box, the preview display options, the stock body. Tool table,
     * WCS, Program and the rest all influence a program somewhere, and a menu that grows to "everything related"
     * stops being a shortcut and becomes a second Settings index nobody maintains.
     */
    function openVizMenu(ev) {
        if (!viz) return;
        ev.preventDefault();
        Promise.all([import('../ui/opContextMenu.js'), import('../ui/settingsPanel.js')]).then(([CM, SP]) => {
            const view = (v, label) => ({ label, fn: () => { try { viz.setView(v); } catch (_) { /* pre-render */ } } });
            CM.openMenu([
                view('top', '⬒ Top view'),
                view('front', '⬓ Front view'),
                view('iso', '⬔ Iso view'),
                { label: '⤢ Fit to work', fn: () => { try { viz.fitAll(false); } catch (_) { /* */ } } },
                { label: '⚙ Machine / envelope…', fn: () => SP.openSettings({ group: 'hardware', panel: 'set_tab_machine' }) },
                { label: '⚙ Preview display…', fn: () => SP.openSettings({ panel: 'set_tab_preview' }) },
                { label: '⚙ Stock…', fn: () => { if (window.ddcsOpenStock) window.ddcsOpenStock(); } },
            ], ev.clientX, ev.clientY);
        }).catch(() => { /* menu module optional */ });
    }

    function ensureViz() {
        if (viz) return viz;
        try {
            viz = new GcodeViz3D(container); viz._gizmoPx = 36; viz._animOn = false; viz.setStock(previewStock()); viz.setMachine(machineForViz()); applyPreviewSettings();
            // t1460 — the view's own menu + long-press (the phone has no right button, and no ViewCube-sized target).
            container.addEventListener('contextmenu', openVizMenu);
            import('../ui/opContextMenu.js').then((m) => m.attachLongPress(container)).catch(() => { /* optional */ });
        }
        catch (e) { console.warn('preview 3D unavailable — using 2D', e); viz = null; setMode('2d'); }
        // Dragging the 3D start marker is a user override (like the 2D handle) — record it so getStartPos() reads it.
        if (viz) viz.onStartChange = (starts) => {   // a 3D jog/drag (any pass) → sync the shared starts, PIN the moved pass, re-trace + replay (#18, INC2)
            if (!Array.isArray(starts) || !starts.length) return;
            // t592 — a DECLARED op (simStartParams): route the MOVED marker through the host param writer (the SAME writer the
            // Layout + 2D handle use), so a 3D-gizmo drag writes the bound params/emit. The envelope clamp + handle independence
            // live in writeSimStartFrac. On a write, the host re-renders (the marker follows the param) → skip the sim-only pin.
            if (markerDragWriter) {
                for (let p = 0; p < starts.length; p++) {
                    const s = starts[p]; if (!s) continue;
                    const np = { x: +s.x || 0, y: +s.y || 0, z: +s.z || 0 }, cur = passStarts[p];
                    if (cur && (cur.x !== np.x || cur.y !== np.y || cur.z !== np.z) && markerDragWriter(p, np)) return;
                }
            }
            starts.forEach((s, p) => {
                const np = { x: +s.x || 0, y: +s.y || 0, z: +s.z || 0 }, cur = passStarts[p];
                if (!cur || cur.x !== np.x || cur.y !== np.y || cur.z !== np.z) userStarts[p] = np;   // pin only the pass that actually MOVED (the jogged one) → its edit beats the hint
                passStarts[p] = np;
            });
            curStart = passStarts[0];
            setGcode(); replayFromStart();
        };
        if (viz && rotaryFixture && viz.setRotaryFixture) viz.setRotaryFixture(true);   // persist the rig hint across lazy viz creation
        if (viz && machineFrameTool && viz.setToolMachineFrame) viz.setToolMachineFrame(true);   // t497 — persist the machine-frame tool hint (homing) across lazy viz creation
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
    // t881 — TWO-SIDED FLIP boundaries: each `setup` that a `flip` sibling names gets its FIRST emitted line (via the
    // projection map, window.ddcsLinesForOp) → {line, axis}. During playback, crossing that line turns the stock over +
    // carries the carve field. No setup+flip → [] (single-setup untouched). Sorted by line.
    const computeFlipBoundaries = () => {
        const out = [];
        try {
            const blocks = compOps() || [];
            const setups = blocks.filter((b) => b && b.type === 'setup');
            for (const fl of blocks.filter((b) => b && b.type === 'flip')) {
                const idx = Number((fl.params || {}).setup);
                const su = setups.find((s) => Number((s.params || {}).index) === idx);
                if (!su || !window.ddcsLinesForOp) continue;
                const lines = window.ddcsLinesForOp(su.id) || [];
                if (lines.length) out.push({ line: Math.min(...lines), axis: (fl.params || {}).axis || 'X' });
            }
        } catch (_) { /* projection not ready → no boundaries */ }
        return out.sort((a, b) => a.line - b.line);
    };
    /**
     * t1289 — THE WORK TURNS, and the two traps that beat the first two attempts are the spec here.
     *
     * TRAP ONE — WHAT SAYS "RUNNING". Not a repaint (updateRunBtn fires on every re-render) and not `engine.running`
     * (a static route TRACE sets it, which is why the bar span while idle). The engine declares `playing`, raised only
     * between a real run() and its end, and pushes it through onPlayState.
     *
     * TRAP TWO — WHICH VIZ. Only the panel that is ACTIVE — the one on screen — turns its bar. A hidden panel's viz
     * is a stale instance nobody is looking at, and letting it spin is how a viewer's bar ended up depending on which
     * panel built last. Deactivating stops it, so the answer cannot outlive the panel that gave it.
     */
    function applyLatheSpin(playing) {
        if (!viz || !viz.setLatheSpin) return;
        const lathe = !!(viz._isLatheStock && viz._isLatheStock());
        viz.setLatheSpin(!!playing && lathe && active);
    }

    function ensureEngine() {
        if (engine) return engine;
        engine = new GcodeExecutionEngine({
            autoAnswer: window.ioPanel ? window.ioPanel.isAutoSensors() : true,
            stock: previewStock(),
            wcsOffset: wcsForViz(),
            simSpeed: simSpeed(),
            rapidRate: (machineForViz() || {}).rapidRate,   // t844 — time-true playback uses the DECLARED G0 rate, so it matches the time estimate
            createVarStore: opts.createVarStore ? (() => opts.createVarStore({ persist: true })) : null,   // t1241 A5 — the RUN owns the persistent store (a serial bumped by one Play survives into the next)
            // t1289 — the ONE truthful running signal, from the thing that owns run state. Raised by a real run and
            // lowered by stop OR by the program ending, so idle looks identical however the run finished.
            onPlayState: (playing) => { applyLatheSpin(playing); updateRunBtn(); },
            onLineChange: ({ lineIndex, raw }) => {
                if (typeof opts.onLine === 'function') opts.onLine(lineIndex);
                if (raw != null) setStatus(fmtExecLine(lineIndex + 1, raw));   // t867 rider — the RAW executing line (one source with the editor highlight), not a paraphrase
                setProgress(lineIndex);   // t865 — the progress bar fills from the SAME line index the counter shows (one source)
                // t881 — TWO-SIDED FLIP: crossing a setup-2 boundary turns the stock over about the declared axis + carries the
                // carve field (side-1's through-holes) to the new top. Once per boundary per run.
                if (_flipBoundaries.length && viz) {
                    for (const b of _flipBoundaries) {
                        if (lineIndex >= b.line && !_flipsApplied.has(b.line)) {
                            _flipsApplied.add(b.line);
                            if (viz.setPartFlip) viz.setPartFlip(b.axis);
                            if (viz.carveMirrorField && carveEnabled() && !_carveDegraded) viz.carveMirrorField(b.axis, (previewStock() || {}).z);
                        }
                    }
                }
                // SLICE 3: a previous G31 has now FINISHED (the engine clamped it to the contact; the tool sits there) →
                // build that axis of the probe-WCS. Resolving on the NEXT line guarantees the tool is at the contact.
                if (pendingProbe && viz && viz.probeAxisTouched) { viz.probeAxisTouched(pendingProbe, engine.feedVal); flashDro(); firePulse(pendingProbe); }   // probe re-references the DRO (feedVal = the just-finished probe's feed → disc size); t319 — pulse the 2D + Layout too
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
            onPositionChange: (pos) => { lastPass = pos.pass || 0;
                // t780 (user) — the chip LEADS WITH THE MEANINGFUL FRAME: machine for machine-semantic motion
                // (a declared machine-frame op — ATC/homing — or a PROBE segment: the probe is REWRITING the WCS,
                // so quoting work coords mid-probe quotes the frame being replaced), work+WCS otherwise. The mach
                // values use the DRO's OWN activeWcsOffset (one source — the chip can never disagree with the DRO).
                const kSeg = segs.length ? nearest2d(pos) : 0;
                const sg = segs[kSeg];
                const probeSeg = pos.probing != null ? !!(pos.probing || pos.g53) : !!(sg && (sg.probe || /probe/i.test(sg.type || '')));   // t780 (user) — the ENGINE's own move semantics win (probe OR G53 = machine-frame motion); the traced segment is the fallback
                const machineOp = !!(viz && (viz._toolMachineFrame || viz._forceMachineBox));
                const off = activeWcsOffset();
                pos.frame = (machineOp || probeSeg) ? 'mach' : 'work';
                // t1205 — the quoted machine coords are WORLD + the WCS offset. `pos` itself stays PASS-LOCAL because
                // setToolPosition/t2 anchor it themselves; only the quoted numbers get the pass→world stitch.
                const posW = worldOf(pos);
                pos.mach = { x: (+posW.x || 0) + (+off.x || 0), y: (+posW.y || 0) + (+off.y || 0), z: (+posW.z || 0) + (+off.z || 0) };
                pos.wcs = (droWcsEl && droWcsEl.textContent) || '';
                if (viz && viz.setToolPosition) viz.setToolPosition(pos); updateDro(pos); checkToolSwap(); if (mode === '2d' && segs.length) { t2.seek(kSeg); t2.setToolPosition(pos); } if (toolPosSubs.length) { for (const cb of toolPosSubs) cb(pos, kSeg); }
                // t680 — LIVE progressive carve: remove material along the swept sub-step (feed class handled inside carveStep), re-mesh throttled.
                if (viz && viz.carveStep && carveEnabled() && !_carveDegraded) { if (_carvePrev) viz.carveStep(_carvePrev, pos, _carveTR, _carveTip, _carveAngle); _carvePrev = pos; if (viz.carveDirty && viz.carveDirty()) _carveDirty = true; carveRemeshThrottled(); } },   // 2D head rides the SAME live pos as the 3D (in sync; ptx/pty puts it on the pinned stock) — t309: ALSO tee to the Layout overlay in ANY mode (a mode==='2d' gate would starve corner's 3D-top Layout)
            onStatus: ({ message, transient }) => {
                // t867 rider — a TRANSIENT playback status (the per-move length/feed/seconds paraphrase + the line counter)
                // belongs in the hover TOOLTIP, not the chip (the chip shows the raw executing line). EVERY other status —
                // waiting on I/O, M-codes, homing, dwell, errors, completion — is an operator message that stays IN the chip.
                if (transient) { if (statusEl) statusEl.title = message || ''; }
                else setStatus(message);
            },
            onWait: (wait) => { if (!window.ioPanel) return; if (wait) window.ioPanel.show(); window.ioPanel.setWait(wait); },   // float the I/O panel during a probe/M-code wait
            onFinish: () => {
                if (pendingProbe && viz && viz.probeAxisTouched) { viz.probeAxisTouched(pendingProbe, engine.feedVal); firePulse(pendingProbe); }   // SLICE 3: a trailing G31 (last line) — t319 pulse too
                pendingProbe = null;
                if (pendingDatum && engine.vars && viz && viz.markDatumWrite) {   // a trailing WCS write (last line) → flush its committed value
                    const val = engine.vars.get(pendingDatum.target);
                    if (Number.isFinite(val)) viz.markDatumWrite(['x', 'y', 'z'][pendingDatum.off], val);
                }
                pendingDatum = null;
                updateRunBtn();
                if (typeof opts.onLine === 'function') opts.onLine(null);
                setProgress(null);   // t865 — run finished → hide the progress bar (a looped run re-shows it on its next line)
                // t1241 A6 — the loop replay used to hand-roll a PARTIAL seed (config + probe overlay + the deferred
                // probe/datum state) and missed everything else seedFreshRun does — the stock-flip reset, the device
                // rest states, the retired tool, the sim speed. A looped run is a FRESH run; seed it like one.
                if (loopOn) { clearTimeout(loopTimer); loopTimer = setTimeout(() => { lastRunCode = get('getGcode') || lastRunCode; if (viz && viz.resetProbe) viz.resetProbe(); compMap = readEnabledComps(compOps()); seedFreshRun(engine); engine.run(lastRunCode); updateRunBtn(); }, 2000); }   // t1205 — re-apply THE ONE simConfig on a loop replay too (it bypassed it, so a config change mid-session only took effect after a manual re-run)   // 2 s idle so the final datum/result is VISIBLE before looping (was 800 ms — cleared too fast); fresh probe overlay each loop (datum re-derives from the WCS-write)
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
    /** t1285 — is this a lathe workspace? Asked of the machine record, which is the one place that knows. */
    const isLatheWorkspace = () => { try { return !!(window.ddcsIsLathe && window.ddcsIsLathe()); } catch (_) { return false; } };
    function simTool(code, parsed) {
        // Attach the configured SIM probe body dims (Settings → Preview → 3D PROBE) to ANY probe tool, so the
        // rendered touch probe matches what the user set on the diagram. Non-probe tools pass through untouched.
        // t1301 — an op that DECLARES its probe dims wins over the global preference: the settings diagram is a default
        // for "whatever probe you own", while a lathe probe op states the stylus radius its own emit compensates by.
        const withProbe = (t) => (t && t.type === 'probe') ? { ...t, probeDims: { ...(previewPrefs().probe || {}), ...(t.probeDims || {}) } } : t;
        const ht = get('getTool'); if (ht) return withProbe(ht);
        const m = /\bT(\d+)\b/.exec(code || '');
        if (m) {
            const t = toolsForViz().find((x) => parseInt(x && x.num, 10) === parseInt(m[1], 10));
            if (t) return withProbe({ type: t.type || 'endmill', dia: Number(t.dia) || 6, length: Number(t.length) || undefined, angle: Number(t.angle) || undefined });   // t875 — carry the vee angle to the carve + sim cone
        }
        if ((parsed && parsed.stats && parsed.stats.probe) > 0) return withProbe({ type: 'probe', dia: 6 });
        // t1285 — A LATHE'S DEFAULT TOOL IS NOT AN ENDMILL. This function is the ONE owner of tool identity: the mesh
        // and the header line both read it, so anything decided downstream is overwritten the next time it runs. That
        // is why keying the tool on the stock, or on a flag set beside this, kept losing — the answer has to be HERE.
        // Kind in, correct tool out, whoever re-renders and whenever.
        if (isLatheWorkspace()) {
            const drill = /centerdrill/.test(String(opts.opType || ''));   // the OPTYPE (lathe_centerdrill) — a separate, American-spelled identity, untouched
            return drill
                ? { type: 'centredrill', dia: 6, _default: true }   // t1722 — the TOOL kind, matches LATHE_TOOL_KINDS' declared id; the tailstock really does hold a bit on centre
                : { type: 'turning', dia: 6, _default: true };      // everything else is an insert on a holder
        }
        return { type: 'endmill', dia: 6, _default: true };   // no host tool / no T# / not a probe → the honest 6mm default (E); flagged so the carve note can own up to the assumption
    }
    // THE one declared source of the per-pass starts (inc2): the precedence userStarts > pass-0 start > registry hint
    // (getStartHints) > prev. Pure (reads the closures); BOTH feeds — the trace and the engine — call it so they never
    // diverge. The pass COUNT comes from the wizard's hints (which mirror its reposition() calls); single-pass ops have no
    // hints → one start; the engine falls back to _stockOffset past the array. A dragged ② (userStarts) persists.
    function computePassStarts(st) {
        const hints = get('getStartHints');
        const hintFor = (p) => Array.isArray(hints) ? (hints[p] || hints[0]) : null;
        const count = Math.max(Array.isArray(hints) ? hints.length : 0, 1);
        const pinned = get('getPinnedStarts') || null;   // t301 MARKER PARITY (Seam A) — datum-PINNED wall worlds (pass → {x,y}) from the Layout's spot store
        const next = [];
        for (let p = 0; p < count; p++) {
            const h = userStarts[p] || (p === 0 && st) || hintFor(p) || passStarts[p] || { x: 0, y: 0, z: 0 };
            const hint = hintFor(p);   // sim-marker-distinguish (t69): `emits` (+ t83 `source`, t94 `anchorsAtPrev`) is a DECLARED property of the pass HINT (opSimStarts), not of a drag/operator override — so it survives a userStarts drag
            // t1684 (census finding 2) — `emits` stays the DECLARED tri-state (undefined = an op that never declares
            // per-pass emits, true/false = corner's own opSimStarts computation): the old `!!` coerced every non-declaring
            // op's undefined to a hard false, which the renderers would have read as "declared sim-only" and hollowed out
            // every other op's reposition marker. Only a genuine `false` (corner's own zsurf/pass-0) means sim-only now.
            const row = { x: +h.x || 0, y: +h.y || 0, z: +h.z || 0, emits: hint ? hint.emits : undefined, source: hint && hint.source, anchorsAtPrev: !!(hint && hint.anchorsAtPrev) };
            const pin = pinned && pinned[p];   // t301 — the operator PINNED this wall (a Layout spot): its world is ABSOLUTE (stock-datum-relative). Override x/y + flag `pinned` so _markerWorld skips the passEnds relocation → the 3D marker HOLDS like the Layout (no spot → the pure-auto chain, byte-identical).
            if (pin && Number.isFinite(+pin.x) && Number.isFinite(+pin.y)) { row.x = +pin.x; row.y = +pin.y; row.pinned = true; }
            next.push(row);
        }
        return next;
    }

    // t580 PREVIEW-PARITY E1 — THE ONE sim config: the SINGLE source both the static route trace AND the animated run read,
    // so the drawn route can NEVER be configured differently from the played tool. Every 'works-here-wrong-there' bug this
    // session was config DRIFT between the two call sites (setGcode's traceToolpath vs play()'s eng._*): the wcsOffset (homing
    // → machine coords; mill → part-Z) and the stock (previewStock vs stockForViz) were set in parallel and fell out of sync.
    // `absolute` (from the last trace's stats) selects the mill part-Z work origin; a probe/homing op ignores it.
    const simStock = () => machineFrameTool ? null : previewStock();   // a homing SWITCH-SEEK ignores the workpiece for COLLISION (rendered separately); the op sim-stock (rotary bar) wins over the global, for BOTH consumers
    function simWcsOffset(absolute, stk) {
        if (machineFrameTool) return { x: 0, y: 0, z: 0 };   // a machine-frame route/run draws in MACHINE coords (no work-origin shift — the recurring few-inch delta)
        // t1241 A2 — read the ACTIVE index (the program's G54-G59 override when one has fired, else the settings active).
        // wcsForViz() always read the SETTINGS row, which is why the DRO path had to hand-roll its own offset.
        const wo = activeWcsOffset() || wcsForViz() || { x: 0, y: 0, z: 0 };
        const mch = machineForViz();
        // faithful machine frame for an ABSOLUTE (mill) program: part-zero's machine Z = the table + the datum height above the
        // stock bottom, so a `G53 Z0` (end safe-Z retract) draws at machine home (the top) instead of plunging onto a bottom-datum origin.
        if (mch && mch.show && stk && stk.x > 0 && absolute) {
            return { x: wo.x || 0, y: wo.y || 0, z: Math.min(0, mch.z || 0) + datumZFrac(stk.datum) * (Number(stk.z) || 0) };
        }
        return { x: wo.x || 0, y: wo.y || 0, z: wo.z || 0 };
    }
    // t826 — UNDECLARED placement (no real WCS row backs the work origin): a machine-frame G53 Z retract has no true scene
    // position, so render it as the DECLARED safe-Z margin ABOVE the work origin (Z=0, the probe datum) — the honest preview
    // approximation the user ruled good (never machine 0). Declared (a WCS row) OR a machine-frame op → null = the exact map.
    function g53ApproxForViz() {
        if (machineFrameTool) return null;
        const m = machineForViz();
        // t1203 — PROBES NEVER READ THE WCS: a probe op PRODUCES the WCS, so a declared table describes a different
        // (previously measured, possibly stale) setup. Ignore it here and keep the honest margin approximation.
        const declared = !probesForWcs && m && m.wcs && Array.isArray(m.wcs.table) && m.wcs.table.length > 0;
        if (declared) return null;
        return Math.abs(Number(m && m.safeZMargin) || 5);   // mm above the work origin (approx: the run's top work-Z ≈ 0)
    }
    function simConfig(absolute) {
        const st = getStartPos(), seat = startSeated(), stk = simStock();
        return {
            stock: stk,
            start: st || { x: 0, y: 0, z: 0 },                 // the operator start (stockOffset — probes test from here)
            initialPos: seat ? (st || null) : null,            // t540/t570 — seat the tool at the draggable Start (homing machine-frame / alignment)
            continuous: seatAtStart,                           // t570 — an auto-traverse op is ONE continuous path (no per-pass origin reset)
            passStarts,                                        // per-pass starts (multi-point probe collision fires from each)
            wcsOffset: simWcsOffset(absolute, stk),
            g53ApproxZ: g53ApproxForViz(),                     // t826 — undeclared: render machine-frame G53 Z retracts as a margin-clearance above the work
            // t1189 — the STATIC route trace must seed the SAME #vars as play (the engine already gets this at creation).
            // Without it a CAM-slot macro reads its #2600+ mirrors as 0 → e.g. a Pocket's size guard trips.
            // t1241 A5 — but the trace must NOT keep what it writes: `persist:false` (the default) hands it a COPY, so a
            // {SN} serial no longer increments on every re-trace. The RUN below asks for the persistent store.
            createVarStore: opts.createVarStore ? (() => opts.createVarStore({ persist: false })) : null,
        };
    }
    // Apply the ONE config to the LIVE animation engine (the trace consumes it via traceToolpath opts).
    function applySimConfig(eng, absolute) {
        const c = simConfig(absolute);
        eng.stock = c.stock;
        eng._stockOffset = c.start;
        eng._initialPos = c.initialPos;   // already seat-gated in simConfig
        eng._continuous = c.continuous;
        eng._passStarts = (c.passStarts && c.passStarts.length) ? c.passStarts : null;
        eng._wcsOffset = c.wcsOffset;
        eng._g53ApproxZ = c.g53ApproxZ;   // t826 — undeclared: the live tool retracts to the same margin-clearance the route drew
    }

    /**
     * t1241 A — THE ONE RESEED PATH (the two-consumer drift class).
     *
     * The panel has TWO consumers of the same config: the DRAWN ROUTE (a fresh trace) and the RUNNING ENGINE (a live
     * play). Every setter and listener that re-traced updated the first and left the second on stale config — the
     * machine-frame hint, the WCS row, the stock, a settings change. The engine then drew a route that its own tool
     * disagreed with, which is exactly the class of "works here, wrong there" bug this panel keeps producing.
     * So: anything that re-traces while a play is in flight calls THIS, and this is the only place that decides how a
     * running engine catches up (restart on the seat pattern — the engine's seeded state cannot be patched mid-run).
     */
    function reseedRunning() {
        if (!engine || !engine.running) return false;
        stopPlay(); play();
        return true;
    }
    /** Re-trace the route AND bring a running engine with it — the pair that used to be done by hand at each site. */
    function retraceAndReseed() {
        if (!active) return;
        setGcode();
        reseedRunning();
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
        // t580 PREVIEW-PARITY E1 — the drawn route is traced from THE ONE simConfig() (the same source play() feeds the engine),
        // so it can't be configured differently from the played tool. simConfig encodes the machine-frame stock-ignore (a homing
        // switch-seek reaches the envelope home edge, not the workpiece), the machine-coords wcsOffset (no few-inch shift), the
        // seat, continuous, and the per-pass starts. Non-homing ops keep the stock (they probe/cut it) — see simStock/simWcsOffset.
        const stk = simStock(), mch = machineForViz();
        let parsed;
        try {
            // Pass 1: the base config (absolute unknown until traced). An ABSOLUTE (mill) program then re-traces with the
            // part-Z work origin (b): part-zero's machine Z = the table + the datum height above the stock bottom, so a `G53 Z0`
            // (end safe-Z retract) draws at machine home (the top) instead of plunging onto a bottom-datum origin — simWcsOffset
            // encodes this, gated on `absolute` (a homing/machine-frame or non-mill op returns the base, so the re-trace is a no-op).
            parsed = traceToolpath(code, simConfig(false));
            if (!machineFrameTool && mch && mch.show && stk && stk.x > 0 && parsed.stats && parsed.stats.absolute) {
                parsed = traceToolpath(code, simConfig(true));
            }
        } catch (e) { console.warn('trace failed', e); parsed = { segments: [], stats: {} }; }
        lastAbsolute = !!(parsed.stats && parsed.stats.absolute);   // play() reads this so its wcsOffset matches the route's final trace (mill part-Z parity)
        segs = parsed.segments || [];
        // t107 — the per-pass RUNTIME world-ENDs from the trace (machine-faithful re-park anchors: post probe+retract+lift,
        // collision-clamped). Fed to BOTH views so an anchorsAtPrev pass draws its dog-leg FROM where the tool actually is +
        // relocates its marker to the same point; stashed for the Layout drag (relTo:'wall1' → the runtime END). Preview-only.
        const passEnds = parsed.passEnds || null;
        lastPassEnds = passEnds;
        // ONE anchor flag for BOTH views (mirrors the 3D's v._anchorToStart): an op with no established absolute
        // position (an incremental probe) is start-relative → the path emanates from the operator START; an absolute
        // (G90 mill) op sits at its own coords. t826 — stats.absolute is driven by the DIST MODE (G90), NOT by a G53: a
        // mid-program G53 safe-Z retract in an incremental probe is a LOCAL machine-frame excursion (it renders in the
        // machine frame via the wcsOffset map + the undeclared g53ApproxZ), so the probe passes STAY start-anchored (each
        // pass anchors to its own start via passAnchor.js) instead of collapsing to machine 0. forceMachine (ATC) pins regardless.
        curAnchor = !forceMachine && !(parsed.stats && parsed.stats.absolute);
        // t1235 TURN B — THE INTER-PASS CONNECTOR. The route the engine traces has a HOLE at every pass boundary: a
        // `REPOSITION:` comment CONSUMES the between-pass traverse (it is the pass delimiter — the engine resets pos and
        // starts a new frame there), so no segment ever bridges passEnds[n-1] → the next pass's start. The drawn route
        // showed only within-pass motion, which is why the traverse read as a stub that never connects.
        // The bridge is SYNTHESISED into the ONE route feed, so the 2D panel, the Layout overlay and the 3D all get it
        // from the same array. It is honest by construction: both endpoints are positions the tool actually occupies —
        // the previous pass's RUNTIME end and the next pass's marker world — so it re-anchors on every drag for free.
        segs = withInterPassConnectors(segs, passStarts, passEnds);
        parsed.segments = segs;   // the 3D takes the whole `parsed` object → literally the same array, not a copy
        t2.setSegments(segs);   // keep the 2D view in sync so a 2D toggle shows the path immediately
        if (t2.setMachineFrame) t2.setMachineFrame(machineFrameTool);   // t652 — machine-frame op → the 2D draws in raw machine coords (Start + envelope), matching the 3D (robust vs lazy init)
        t2.setStarts(passStarts);   // the draggable 2D start handles — ALL per-pass starts, numbered (①②…)
        // t83 — per-pass reposition source (auto=cyan/straight, manual=amber/arc). PREFER the DECLARED source (the op's sim
        // provider — e.g. corner reads it from the LIVE param travelApproach), over the engine's G-code-TEXT inference
        // (parsed.stats.passSources, unreliable + static — it read 'manual' even at corner's auto default). Fall back to the
        // inference only for ops that DON'T declare a source (middle/edge). ONE declared truth feeds BOTH panels (top + Layout).
        const parsedSrc = (parsed.stats && parsed.stats.passSources) || [];
        const passSources = passStarts.map((s, p) => s.source || parsedSrc[p] || 'auto');
        lastPassSources = passSources;   // t81 — expose to the Layout canvas so its handles match the top panel's colours
        if (t2.setStartSources) t2.setStartSources(passSources);
        if (t2.setStartEmits) t2.setStartEmits(passStarts.map((s) => s.emits));   // sim-marker-distinguish (t69): the SHAPE axis (emitting=solid vs sim-only=hollow), orthogonal to the auto/manual COLOUR. t1684 — pass the DECLARED tri-state through undisturbed (undefined = an op that never declares per-pass emits, not "false"); coercing it here is what made the value unreadable downstream
        if (t2.setPassEnds) t2.setPassEnds(passEnds);        // t107 — an anchorsAtPrev pass anchors its route + relocates its marker to the previous pass's runtime END (machine-faithful)
        t2.setAnchor(curAnchor);                              // 2D mirrors the 3D anchor: anchored → path emanates from the start, not the stock pin
        t2.setMachine(machineForViz());   // t744 — ENVELOPE EVERYWHERE (2D): draw the declared box regardless of anchor (the modal's `envelope` element gates it; paint reads displayOf)
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
                // t674 — a SEATED op (alignment) anchors its DRAWN trace to the Start too: the animation already rides
                // engine.pos (seeded at the Start via initialPos), but the drawn route ignores the seat, so a final
                // absolute / G53 park (stats.absolute → _anchorToStart OFF) drew the whole path from the origin. Give the
                // trace the same seat the play uses (gcodeViz3d reads _seatAtStart). NOT added to the animation's `o` — the
                // seat is already in engine.pos there (adding it would double-count). Machine-frame ops (homing) are the
                // machTool branch — untouched (negative control).
                v._seatAtStart = seatAtStart;
                // ONE flag drives the whole frame: an incremental / operator-relative op (a probe) is LOCAL —
                // stock top-at-0 AND no machine envelope; an absolute / WCS op (mill, WCS setup) shows the MACHINE
                // frame — datum-aware stock + the envelope. The op's coordinate nature decides it, not the host.
                // t1722 (gate repair) — the anchor-only gate missed a REAL case: a per-op DERIVED preview stock
                // (getStock/previewStock — the rotary round bar, now also middle_data's boss/pocket/cylinder shape)
                // can change on a LIVE param edit (e.g. ticking "Circular") WITHOUT the anchor changing at all, and
                // setStock() was then never called again — the panel kept showing the stock shape from whenever the
                // anchor last flipped. Track the derived stock's OWN signature (shape is what a shape-preview bug
                // actually needs — dims already reflow through the existing global-stock path) alongside the anchor.
                const _ps = previewStock();
                const stockSig = _ps ? String(_ps.shape) : '';
                if (anchor !== lastAnchor || stockSig !== lastPreviewStockSig) {
                    v.setStock(_ps);
                    v.setMachine(machineForViz());     // t738 — ENVELOPE EVERYWHERE: draw the declared box regardless of the anchor (the box + the G53 start-anchor are SEPARABLE — the start-anchor stock frame above stays as-is); the modal's `envelope` element gates it inside setMachine
                    lastAnchor = anchor;                               // (the 2D's anchor/machine are set above, for both views)
                    lastPreviewStockSig = stockSig;
                }
                // Place EVERY pass's start marker before setSegments so each anchored (probe) pass offsets to its own
                // start. A multi-point probe (rotary 3-point fit, alignment A/B) repositions between touches → one pass
                // each; the wizard supplies a per-pass hint array (getStartHints) so the passes land at DISTINCT points
                // (else all passes default to the same start and the circle solve is degenerate). Pass 0 also honours a
                // user drag (curStart, via st). setSegments has already grown viz.starts to passCount.
                if (v.starts) {   // sync the 3D markers from the shared per-pass starts (computed above for both views)
                    for (let p = 0; p < passStarts.length; p++) v.starts[p] = { x: passStarts[p].x, y: passStarts[p].y, z: passStarts[p].z, anchorsAtPrev: !!passStarts[p].anchorsAtPrev, pinned: !!passStarts[p].pinned };   // t94 draw-anchor flag + t301 `pinned` (a datum-held wall — _markerWorld skips the passEnds relocation)
                }
                if (v._syncJogPos) v._syncJogPos();   // t297 — BIDIRECTIONAL pendant: refresh the jog-pendant Pos fields from the freshly-mirrored viz.starts, so EVERY drag surface (2D-top handle, Layout ◇/#-handle, 3D gizmo) writes the pendant back — not only the 3D gizmo. Kills the pendant-overrides-handle asymmetric-refresh bug (setGcode runs after every drag). syncPos skips the focused field → live typing is safe.
                if (v.setStartSources) v.setStartSources(passSources);   // colour each start marker by its reposition source (auto=cyan, manual=amber)
                if (v.setStartEmits) v.setStartEmits(passStarts.map((s) => s.emits));   // sim-marker-distinguish (t69): SHAPE each marker (emitting=solid vs sim-only=hollow), orthogonal to the colour. t1684 — the DECLARED tri-state, undisturbed (see the 2D call site's note)
                if (v.setPassEnds) v.setPassEnds(passEnds);   // t107 — BEFORE setSegments: the route rebuild anchors an anchorsAtPrev pass at the previous pass's runtime END + relocates its marker sprite to end+cross
                v.setSegments(parsed, !fitted); fitted = true;
                if (v.setSimTool) v.setSimTool(simTool(code, parsed));   // per-op tool from the tool table (see simTool)
                if (v.setSimMode) v.setSimMode(((parsed.stats && parsed.stats.probe) > 0) ? 'probe' : 'mill');   // probe = translucent stock, mill = solid
                if (startSeated() && v.setToolPosition) v.setToolPosition(getStartPos() || { x: 0, y: 0, z: 0 });   // t540 homing / t570 alignment — seat the PRE-PLAY tool at the draggable Start, coherent with the Start-anchored route (play() re-seats it too)
                // t680 — MATERIAL REMOVAL: (un)swap the box for the displaced grid, and when NOT playing show the instant END-STATE
                // (carve every segment once). During play the live progressive carve drives it instead. Tool Ø from simTool (E).
                if (v.setCarve) {
                    const tl = simTool(code, parsed); _carveTR = (Number(tl && tl.dia) || 6) / 2;
                    _carveTip = carveTipForToolType(tl && tl.type);   // ball-nose → spherical carve; vbit/chamfer/engraver → vee cone (one source: the tool `type`)
                    _carveAngle = veeAngleOf(tl);   // t875 — the vee cone included angle
                    _carveSegs = (parsed && parsed.segments) || [];   // remembered for the LIVE→end-state degrade jump (F)
                    if (v._buildCarveArc) v._buildCarveArc(_carveSegs, _carveTR);   // t816 — the whole toolpath is known upfront → the t814 arc snap applies to the LIVE crisp splice too
                    const hasCut = !!(parsed.stats && parsed.stats.feed > 0);   // material removal only for CUTTING programs; probe/rapid → the plain box
                    scheduleEndStateCarve(v, hasCut);   // DEFERRED (perf): never block setGcode; a transient/probe wizard costs ~nothing
                    // honest note (rulings B/E + t682): NAME the tip in use — ball-nose is modelled; flat is exact; a vee/chamfer
                    // is still rendered flat (approx). Plus the Ø6 assumption when no tool is set.
                    const note = q('.pp-carve-note');
                    if (note) {
                        const show = carveEnabled() && !!(parsed.stats && parsed.stats.feed > 0);   // only when there's material to remove
                        const tp = tl && tl.type;
                        // …and the HEADER names what the scene shows. A lathe op calling its insert a flat endmill is
                        // the same lie as drawing one: same source, same answer.
                        const tipName = tp === 'turning' ? 'turning tool (insert)'
                            : tp === 'centredrill' ? 'centre drill'   // t1722 — matches LATHE_TOOL_KINDS' declared id, one spelling not two
                            : (_carveTip === 'ball' ? 'ball-nose' : (_carveTip === 'vee' ? tp + ' (v-carve)' : 'flat endmill'));
                        // t722 P2a (2)+(4) — HONEST wording (no cognition verbs) + the op's TYPED Ø: an unset tool states the
                        // default fact; an op-value tool discloses only the tip-shape unknown (the Ø is the typed op value).
                        const dia = Math.round((Number(tl && tl.dia) || 6) * 10) / 10;
                        const disc = (tl && tl._default) ? (' Ø' + dia + ' (default — no tool set)')
                            : ((tl && tl._opValue) ? (' Ø' + dia + ' — op value, no tool picked') : (' Ø' + dia));
                        note.textContent = show ? ('Material view · ' + tipName + disc) : '';
                        note.style.display = show ? '' : 'none';
                    }
                }
                if (v.applyDisplay) v.applyDisplay();   // t738 — apply the ONE declared visibility registry across every element (after all the rebuilds)
            }
            // t881 — the t879 honest two-sided note is RETIRED: the sim now flips the stock at the setup-2 boundary and carries
            // the carve field (through-holes) through the flip (onLineChange + carveMirrorField), so the caveat no longer holds.
        }
        const s = parsed.stats || {};
        // t1383 — A TRUNCATED PREVIEW SAYS SO (ruled). The tracer has always reported `stats.capped` and nothing ever read
        // it, so a path cut short by the runaway guard was indistinguishable from a finished one — and this route is what a
        // user checks a program against before cutting. The sentence comes from the engine (`cappedWhy`, one phrasing in
        // declaredWork.js) so both views and any later host say the same thing, and it is an ERROR, not a warning.
        //
        // It REPLACES the move counts rather than joining them, and that is the honest choice: the counts below are of the
        // moves that were TRACED, so on a truncated path they are a partial tally wearing the badge of a total — which is
        // the same silent-partial defect one level along. It belongs at THIS write and not at the trace above, because this
        // is the ONE summary status setGcode ends on; set earlier, it was simply overwritten here (measured, not assumed).
        // t1444 — …AND A REFUSED PROGRAM SAYS WHY, for the same reason and one rung more specific. A build-time refusal
        // emits no motion, so it arrived here as "No drawable moves" — the sentence for an EMPTY program, which is
        // exactly what a user asking "why is nothing drawn?" cannot act on. `refusedWhy` is the op's OWN words, carried
        // out of the emitted `;ERROR:` comment by the engine, so no surface re-phrases a refusal it did not author.
        // It is tested FIRST because it is the more specific truth: a refusal has nothing to truncate.
        if (s.refused) setStatus(s.refusedWhy, true);
        else if (s.capped) setStatus(s.cappedWhy || 'Preview truncated — the path shown is INCOMPLETE.', true);
        else setStatus(!s.drawable ? 'No drawable moves' : [s.feed && `${s.feed} cuts`, s.probe && `${s.probe} probes`, s.rapid && `${s.rapid} rapids`].filter(Boolean).join(' · '));
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
    const LEGEND = LEGEND_ROWS;   // t317 — the ONE declared palette (viz/pathStyle.js); colours can't drift from the renderers (fixes the old Cut #35d0ff → the real gradient-high #35ffd0)
    function renderLegend(parsed) {
        const el = q('.viz3d-legend'); if (!el) return;
        const ss = (parsed && parsed.segments) || [];
        let maxProbeFeed = 0;
        for (const s of ss) { if ((s.type === 'probe' || s.probe) && (s.feed || 0) > maxProbeFeed) maxProbeFeed = s.feed; }
        const present = new Set();
        for (const s of ss) {
            // t1205 — classify through the SAME seam the 2D paint uses (toolpath2d.typeOf), so a horizontal rapid is
            // recognised as `lifted` safe-travel here too. Building the set from RAW trace types could never produce
            // `lifted` (that reclassification lives only in the renderer), so its legend row was unreachable — the
            // legend claimed "yellow = Rapid" while most rapids actually drew as the dashed safe-travel variant.
            const type = typeOf(s);
            if (type === 'lifted') present.add('lifted');
            else if (type === 'rapid') present.add('rapid');
            else if (type === 'retract') present.add('retract');
            else if (type === 'probe') present.add(((s.feed || 0) > 0 && (s.feed || 0) < maxProbeFeed) ? 'probeSlow' : 'probe');
            else present.add('feed');   // G1 cut/plunge — the basic feed move
        }
        if (viz && viz.starts && viz.starts.length > 1) present.add('jog');
        // t1241 C14 — a colour-only chip cannot tell Rapid from Safe travel: since lifted took the rapid HUE they render
        // as two identical yellows, so the legend claimed a distinction the eye could not make. Each chip now draws its
        // own DASH SAMPLE from the declared token (dashFor), which is the thing that actually distinguishes them.
        const sample = (key) => {
            const d = dashFor(key === 'probeSlow' ? 'probe' : key);
            const pattern = (d && d.length) ? `repeating-linear-gradient(90deg, currentColor 0 ${d[0]}px, transparent ${d[0]}px ${d[0] + (d[1] || d[0])}px)` : 'currentColor';
            return `<i class="lg-dash" aria-hidden="true" style="background:${pattern}"></i>`;
        };
        el.innerHTML = LEGEND.filter((x) => present.has(x.key)).map((x) => `<span style="color:${x.color}">${sample(x.key)}${x.label}</span>`).join('');
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
        retraceAndReseed();   // t1241 A — the tripwire caught this one too: a frame flip mid-play left the live tool behind
        if (mode === '2d') { t2.setMachine(machineForViz()); t2.setStock(stockForViz()); t2.fit(); }   // t744 — envelope everywhere (2D): pass the declared machine regardless of anchor
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

    // t1205 — THE ONE FRESH-RUN SEED. play() and the STEP button both begin a run, so both must start from the same
    // state; the step handler used to copy four of these lines and silently OMIT simActiveWcs (after playing a G55
    // program a fresh stepped run kept the stale G55 label + Mach offset) as well as the probe/datum resets. One helper,
    // one source — a new per-run reset can never again be added to play() alone.
    function seedFreshRun(eng) {
        simActiveWcs = null;   // #4: each run reverts to the settings active WCS; the program's G54-G59 lines re-drive it (display only)
        eng.simSpeed = simSpeed();
        eng.autoAnswer = window.ioPanel ? window.ioPanel.isAutoSensors() : true;
        // t580 PREVIEW-PARITY E1 — configure the ANIMATION engine from THE ONE simConfig() (the same source the drawn route
        // traced from), so the played tool can't diverge: the homing switch-seek stock-ignore, the machine-coords/mill-part-Z
        // wcsOffset (lastAbsolute, from the route's final trace), the seat, continuous, and the per-pass starts — all one source.
        applySimConfig(eng, lastAbsolute);
        pendingProbe = null; pendingDatum = null;                 // fresh deferred probe/datum state
        compMap = readEnabledComps(compOps());                    // the active op's declared comp surfaces
        if (viz && viz.resetProbe) viz.resetProbe();              // fresh probe overlay
        updateDro(getStartPos() || { x: 0, y: 0, z: 0 });         // honest baseline before the first line executes
        if (droWcsEl) droWcsEl.textContent = activeWcsName();     // label follows the reset active WCS
    }

    function play() {
        const eng = ensureEngine();
        seedFreshRun(eng);
        if (mode === '3d') ensureViz();
        if (viz && viz.setSimSpeed) viz.setSimSpeed(simSpeed());   // probe discs fade in SIM time (track the speed button)
        if (viz) viz.setAnimate(false);                 // engine drives the tool/trail, not the geometric sweep
        lastTool = null; if (viz && viz.showRetiredTool) viz.showRetiredTool(null);   // P-C.1b: fresh run re-arms the tool-swap watch + clears any retired tool
        if (viz && viz.setStationDevice) { viz.setStationDevice('pusher', false); viz.setStationDevice('pin', false); viz.setStationDevice('collet', false); }   // P-C.2b/3a: devices to rest before the sequence re-animates them
        if (viz && viz.setLimitSwitchDevice && limitEdges) for (const ed of limitEdges) viz.setLimitSwitchDevice(ed.edge, false);   // H4: home/limit switches to rest — the run re-trips them via io_change
        // t497 — seat a MACHINE-FRAME tool (homing) at the start BEFORE the run, so it renders at the top even before the
        // engine's first onPositionChange (a seek-to-home is a no-move → wouldn't fire it, leaving the tool at the shifted
        // build spot). The engine then drives it from here.
        if (viz && startSeated() && viz.setToolPosition) viz.setToolPosition(getStartPos() || { x: 0, y: 0, z: 0 });
        // t680 — the LIVE progressive carve starts from PRISTINE stock (recesses seeded) and removes material as the tool moves.
        if (viz && viz.carveReseed && carveEnabled() && !_carveDegraded) { viz.carveReseed(); _carvePrev = null; _carveDirty = false; }
        if (viz && viz.setPartFlip) viz.setPartFlip(null);   // t881 — a fresh run starts un-flipped; recompute the two-sided boundaries for THIS program
        _flipsApplied.clear(); _flipBoundaries = computeFlipBoundaries();
        lastRunCode = get('getGcode') || '';
        eng.run(lastRunCode);
        updateRunBtn();
        setProgress(0);   // t865 — show the progress bar (empty) at run start now the program is loaded (engine.totalLines set); onLineChange fills it
    }
    function stopPlay() {
        if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
        if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; }   // drop a queued live-restart (harmless on the restart path: it nulls liveTimer first)
        if (engine && engine.running) engine.stop();
        t2.stop();
        if (viz) viz.setAnimate(false);
        if (typeof opts.onLine === 'function') opts.onLine(null);
        setProgress(null);   // t865 — playback stopped → hide the progress bar (visible only while playing)
        for (const cb of toolPosSubs) cb(null, 0);   // t309 — tell the Layout overlay the sim stopped (clears its red head, redraws the static path)
        // t680/t682 — the run finished/stopped: settle the live carve into the CRISP vertical-wall END-STATE mesh (no-op if no carve)
        if (viz && viz.carveFinalize && carveEnabled()) viz.carveFinalize(_carveSegs, _carveTR, _carveTip);   // t814 — feed the arc-corner snap
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
        // t1205 — carry the segment's PASS so both consumers anchor it: the 3D tool offsets by passAnchorFor, and the DRO
        // (worldOf) quotes the world position. Without the pass a scrub into a later pass rendered at pass 0's anchor.
        const pos = best ? { x: best.x2, y: best.y2, z: best.z2, pass: best.pass } : { x: segs[0].x1, y: segs[0].y1, z: segs[0].z1, pass: segs[0].pass };
        if (mode === '3d') { const v = ensureViz(); if (v && v.setToolPosition) v.setToolPosition(pos); }
        else t2.seek(nearest2d(pos));
        // t1203 — the DRO follows the scrub too: these are traced positions in the SAME work frame onPositionChange
        // reports, so the one DRO writer derives Work AND Mach from them. Without this, clicking a code line moved the
        // tool while the readout kept the last RUN's numbers (the same staleness class as the stepped run).
        updateDro(pos);
    }

    // ---- stock: a button that opens the rich Stock modal (ui/stockEditor.js). The modal persists to the shared
    //      store + broadcasts ddcs:settings-changed; renderStock() then pushes it into this panel's viz/engine. ----
    function renderStock() {
        const s = stockForViz();
        // t1241 A3 — the VIZ draws the global stock, but a running ENGINE collides against the SIM stock (simStock():
        // a homing switch-seek ignores the workpiece, a rotary op has its own bar). Assigning the global one here meant
        // any settings change mid-play silently swapped the collision body under the tool. One source: simConfig's.
        if (viz) viz.setStock(s); if (engine) engine.stock = simConfig(lastAbsolute).stock; t2.setStock(s);
        // A stock GEOMETRY change (dims / shape / datum) must refresh the view — the grid floor + framing are set
        // in fit(), which otherwise only runs once. Reset `fitted` so the next render re-fits (grid follows the
        // new stock bottom). Keyed so unrelated settings changes don't reframe.
        const key = s ? `${s.x}/${s.y}/${s.z}/${s.shape}/${s.datum}` : '';
        if (key !== lastStockKey) { lastStockKey = key; fitted = false; }
    }
    q('.pp-stock').addEventListener('click', (e) => toggleStockEditor(e.currentTarget));
    { const vb = q('.pp-vis'); if (vb) vb.addEventListener('click', (e) => toggleVisibilityModal(e.currentTarget)); }
    // t738 — re-apply the ONE visibility registry to THIS panel whenever the modal changes an element (live, every mounted panel)
    onDisplayChange(() => { if (viz && viz.applyDisplay) viz.applyDisplay(); if (t2 && t2.applyDisplay) t2.applyDisplay(); });
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
    // t1203 — STEP must land in the SAME configured frame a run does, and must show where the tool actually is. A fresh
    // stepped run previously skipped play()'s setup entirely: no applySimConfig (so _stockOffset/_passStarts/_wcsOffset/
    // _g53ApproxZ were stale or defaults) and no DRO seed (so the readout still showed the PREVIOUS run's numbers until
    // the first committed move). Seed on the first click only; the engine now commits each stepped line's end position,
    // which fires onPositionChange → updateDro (Work AND Mach from the one writer).
    q('.pp-step').addEventListener('click', () => {
        const eng = ensureEngine();
        if (!eng.running) { seedFreshRun(eng); if (viz) viz.setAnimate(false); }   // a stepped run IS a fresh run — same seed as play()
        eng.step(get('getGcode') || '');
        updateRunBtn();
    });
    q('.pp-loop').addEventListener('click', () => { loopOn = !loopOn; q('.pp-loop').classList.toggle('on', loopOn); if (!loopOn && loopTimer) { clearTimeout(loopTimer); loopTimer = null; } });
    q('.pp-speed').addEventListener('click', () => {   // cycle 1× → 2× → 5× → 10× → 20× → 1×
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
    // t1241 A4 — …and a running play is brought with it (retraceAndReseed), instead of re-tracing the ROUTE and leaving
    // the engine on the config it was seeded with.
    window.addEventListener('ddcs:settings-changed', () => { renderStock(); updateStockGlow(); const m = machineForViz(); if (viz) viz.setMachine(m); t2.setMachine(m); applyPreviewSettings(); retraceAndReseed(); });   // t744 — envelope everywhere: the declared machine regardless of anchor (the registry gates the box in both viz.setMachine + t2.paint)

    function setActive(on) {
        active = !!on;
        if (!active) { applyLatheSpin(false); try { if (window.__ddcsActiveViz === viz) window.__ddcsActiveViz = null; } catch (_) {} if (_carveRaf && typeof cancelAnimationFrame === 'function') { cancelAnimationFrame(_carveRaf); _carveRaf = 0; } stopPlay(); autoStarted = false; if (viz) viz.setActive(false); if (deviceIoListener) { window.removeEventListener('io_change', deviceIoListener); deviceIoListener = null; } if (limitIoListener) { window.removeEventListener('io_change', limitIoListener); limitIoListener = null; } return; }   // t181/H4 tidy: drop the ATC + limit-switch io_change listeners when the preview deactivates (re-armed via setAtcSwap / setLimitSwitches on next update)
        // t1289 — WHICH INSTANCE IS LIVE, stated rather than guessed. A panel that activates is the one on screen; a
        // hidden one's viz is a stale object nobody is looking at. Published so a test can assert about the scene the
        // user can actually see, instead of whichever instance happened to be constructed last.
        if (mode === '3d') {
            const v = ensureViz();
            if (v) {
                v.setActive(true);
                // …and the OWNERSHIP HANDOFF: whoever becomes live tells the previous holder to stop. A panel can
                // leave the screen by routes that never reach setActive(false) — closing a wizard is one — so the
                // arriving panel is the reliable place to end the outgoing one's answer.
                try {
                    const prev = window.__ddcsActiveViz;
                    if (prev && prev !== v && prev.setLatheSpin) prev.setLatheSpin(false);
                    window.__ddcsActiveViz = v;
                } catch (_) {}
            }
        }
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
        if (viz && viz.setForceMachineBox) viz.setForceMachineBox(on);   // t540 — a machine-frame op FORCES the envelope box regardless of settings.machine.show
        if (on === forceMachine) return;
        forceMachine = on;
        lastAnchor = null;   // force the anchor/envelope block in setGcode to re-evaluate
        retraceAndReseed();   // t1241 A — the tripwire caught this one too: a frame flip mid-play left the live tool on the old frame
    }

    // t1203 — Host hint: this program probes FOR the WCS (see `probesForWcs`). Changes g53ApproxForViz's answer, which
    // rides in simConfig, so a change must re-trace. Symmetric with setForceMachine (early-return when unchanged).
    function setProbesForWcs(on) {
        on = !!on;
        if (on === probesForWcs) return;
        probesForWcs = on;
        // t1205 — RE-SEED THE RUNNING PLAY, not just the drawn route (same class t674 fixed for setSeatAtStart). A wizard
        // view calls preview3D FIRST and applies the declared intent AFTER, so the on-open auto-play has already captured
        // _g53ApproxZ while this flag was still false — the animation would keep mapping G53 through the declared WCS table
        // for the whole first run. scheduleLiveRestart bails on unchanged G-code, so only a forced restart re-seeds it.
        retraceAndReseed();   // t1241 A — was the same pair hand-rolled; through the one path now
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

    // Host hint: render the live tool in the MACHINE frame (homing — the tool homes in machine coords, no workpiece, so
    // it must NOT ride the stock-floor part-frame shift). Symmetric with setRotaryFixture — stores the flag so it
    // survives lazy viz creation (ensureViz re-applies it) and applies straight away if the viz exists. t497.
    function setToolMachineFrame(on) {
        on = !!on;
        if (on === machineFrameTool) return;
        machineFrameTool = on;
        if (viz && viz.setToolMachineFrame) viz.setToolMachineFrame(on);
        if (t2 && t2.setMachineFrame) t2.setMachineFrame(on);   // t652 — the 2D draws the machine frame too (Start + envelope raw machine coords), matching the 3D
        // t578 — a machine-frame flip changes the trace FRAME (machine coords + seat + stock-ignore); RE-TRACE so the
        // seated route lands NOW. t1241 A1 — and RESEED a running play through the one path: the flip used to update
        // the drawn route only, leaving the live tool in the part frame it was seeded with (the homing first-open class).
        retraceAndReseed();
    }

    // t1834/t1836 — Host hint: WHICH op type(s) are forcing this whole-program preview into the machine frame (so
    // the stock is withheld — see simStock()). An HONEST NOTE, not an error: nothing is broken.
    //
    // t1836 CORRECTION (user-caught): the t1834 wording claimed the stock's position is "unknown until a probe
    // runs" — FALSE. A WCS offset, once recorded, ALREADY EXISTS; a probe REPLACES it, it does not create it from
    // nothing. [[probes-never-read-wcs]] is about a DIFFERENT thing — the SIM must not map a probe's OWN moves
    // through the WCS table (that op is busy producing the value, not consuming it) — it says nothing about
    // whether a WCS value exists at all. The genuinely honest, NARROWER reason: THIS WORKSPACE has no WCS offsets
    // recorded (`machine.wcs.table` empty/unpulled) — there is nothing on file to place the workpiece against. If
    // a WCS table IS populated, that reason no longer holds (a real, if provisional, offset exists) — reusing
    // engine/envelopeCheck.js's own `placementDeclared` predicate (the ONE existing "is a WCS placement on file"
    // gate, already used by the pre-flight safety check) rather than inventing a second one: the note is
    // SUPPRESSED whenever `placementDeclared` is true, since claiming "nothing to place it against" would then be
    // false too, and this turn deliberately does NOT build the per-segment-frame machinery (Option B) that would
    // let the note say something narrower-but-still-true in that case.
    //
    // Same pattern as the existing `.pp-carve-note` (an always-neutral caption, never styled as a warning/error) —
    // reused rather than inventing a second notification style. Purely descriptive: does not touch forceMachine/
    // machineFrameTool or any render/collision decision. Forward-compatible by construction — this is driven by the
    // SAME opTypes list applyProgramIntent already computes the union from, so if per-segment frame-awareness ever
    // replaces that whole-program union, whoever changes applyProgramIntent's call to this function changes both at
    // once; there's no separate copy of the condition to fall out of sync.
    const frameNoteEl = q('.pp-frame-note');
    function setFrameNote(opTypes) {
        if (!frameNoteEl) return;
        const list = Array.isArray(opTypes) ? opTypes.filter(Boolean) : [];
        if (!list.length || placementDeclared(machineForViz())) { frameNoteEl.textContent = ''; frameNoteEl.style.display = 'none'; return; }
        const names = [...new Set(list.map((t) => opLabelOf(t)))].join(' + ');
        frameNoteEl.textContent = `Workpiece hidden — ${names} runs in machine coordinates; this workspace has no WCS offsets recorded, so there's nothing on file to place it against.`;
        frameNoteEl.style.display = '';
    }

    // Host hint: SEAT the trace/engine initial position at the draggable Start (marker A) — the homing initialPos seam WITHOUT
    // the machine-frame tool RENDER (alignment: an in-place probe whose drawn path must begin at A, on the part frame). t570.
    function setSeatAtStart(on) {
        on = !!on;
        if (on === seatAtStart) return;
        seatAtStart = on;
        // t674 — re-trace so the DRAWN route re-seats (via v._seatAtStart) AND re-seed the RUNNING play: the declared seat
        // intent is applied AFTER the on-open auto-play (preview3D → setActive → autoStartOnOpen ran while seatAtStart was
        // still false → engine seeded pos=0). scheduleLiveRestart bails on unchanged G-code, so the running animation stays
        // at origin until a drag. Force a restart so the sim seats at the Start on FRESH OPEN with zero interaction.
        retraceAndReseed();   // t1241 A — was the same pair hand-rolled; through the one path now
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
    // Arm the HOME/LIMIT SWITCH devices for this op's preview (Homing H4, t487). Builds a switch body at each fitted
    // home-end edge (viz.setLimitSwitchDevices) + wires an io_change listener that LIGHTS/PLUNGES the device when its
    // switch trips — the SAME pattern as the ATC device listener above, keyed by IN_HOME_<axis> / IN_LIMIT_<axis>_<side>
    // (the H3 live trip pins). edges = [{edge, axis, side, …}] (machine coords) or null/[] to disarm. Reset on play,
    // dropped on setActive(false).
    function setLimitSwitches(edges) {
        limitEdges = (Array.isArray(edges) && edges.length) ? edges : null;
        if (viz && viz.setLimitSwitchDevices) viz.setLimitSwitchDevices(limitEdges);
        if (limitIoListener) { window.removeEventListener('io_change', limitIoListener); limitIoListener = null; }
        if (limitEdges) {
            limitIoListener = (e) => {
                const d = e && e.detail; if (!d || !d.pin || !viz || !viz.setLimitSwitchDevice) return;
                for (const ed of limitEdges) {
                    const home = `IN_HOME_${ed.axis.toUpperCase()}`;
                    const lim = `IN_LIMIT_${ed.axis.toUpperCase()}_${String(ed.side).toUpperCase()}`;
                    if (d.pin === home || d.pin === lim) viz.setLimitSwitchDevice(ed.edge, !!d.state);
                }
            };
            window.addEventListener('io_change', limitIoListener);
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
    // DISK: the ring angle (theta) that brings a tool's pocket to the fixed PICKUP (pocket 0's spot). -(offset + i/n·2π):
    // it cancels BOTH the declared mounting offset (t885) and the pocket's index so the target lands exactly at the pickup.
    const diskTheta = (toolN) => { if (!isDiskMag()) return 0; const n = (Array.isArray(atcCfg().magazine) ? atcCfg().magazine : []).length || 1; const i = magPocketIndex(toolN); const off = (Number(atcCfg().diskOffsetDeg) || 0) * Math.PI / 180; return i < 0 ? 0 : -(off + (i / n) * Math.PI * 2); };
    // the pocket list for the OCCUPIED tools, at the current ring rotation (theta); disk = ring-laid, else per-tool XY.
    const magPocketList = (occupied, theta) => { const all = magazinePockets(atcCfg(), theta || 0); const list = all.filter((p) => p.tool && occupied.has(Number(p.tool.num))); list.disk = all.disk; return list; };   // t885 — keep the carousel-plate metadata through the occupancy filter
    const pocketPos = (toolN, theta) => { const p = magazinePockets(atcCfg(), theta || 0).find((q) => q.tool && Number(q.tool.num) === Number(toolN)); return p ? { x: Number(p.x) || 0, y: Number(p.y) || 0, z: Number(p.z) || 0 } : null; };
    // Render the pick-place magazine with `spindleTool` REMOVED (it is on the spindle) + the disk ring ROTATED so
    // spindleTool's pocket sits at the pickup (the carousel just indexed it there). theta stored on the viz for tests.
    function renderPickPlaceMag(spindleTool) {
        const theta = diskTheta(spindleTool);
        if (viz) { viz._diskTheta = theta; if (viz.setMagazine) viz.setMagazine(magPocketList(new Set(magToolNums().filter((t) => t !== spindleTool)), theta)); }
    }
    /**
     * t1241 D15 — SHOW THE MAGAZINE because the program says so. `showMagazine` was DECLARED per-op and UNIONED by
     * programSimContext, but nothing ever applied it: an ATC op in the editor or Blocks program rendered no magazine
     * while the same op in its wizard did. The pockets themselves come from the profile (magazinePockets); this only
     * decides whether they are rendered, which is what the declaration always meant.
     */
    function setShowMagazine(on) {
        if (!viz || !viz.setMagazine) return;
        // t1722 — the SAME shared function atcViews.js's single-op wizard preview calls (magazineOccupiedPockets),
        // not the locally-parameterized magPocketList above (which exists for renderPickPlaceMag's DIFFERENT need —
        // excluding the specific tool currently on the spindle during a tool-change animation, not "all occupied").
        // The two hosts showing the SAME static "which pockets have tools" fact for the SAME declared showMagazine
        // intent now call one function and cannot disagree by construction.
        viz.setMagazine(on ? magazineOccupiedPockets(atcCfg(), 0) : null);
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

    return { setGcode, refresh, setActive, setView: setMode, stop: stopPlay, seekLine, getStartPos, setForceMachine, setRotaryFixture, setToolMachineFrame, setFrameNote, setSeatAtStart, setProbesForWcs, setShowMagazine, setMarkerDragWriter, setAtcSwap, setLimitSwitches, onStartDrag, getPassStarts: () => passStarts, getPassSources: () => lastPassSources, getPassEnds: () => lastPassEnds,
        getSegments: () => segs,                                                          // t309 — the shared trace for the Layout animation overlay (no re-trace)
        // t1187 — a CLEAN geometry-only PNG data-URL of the sim (stock + toolpath, NO overlay: grid/axes/handles/markers/HUD).
        // 2D-toolpath capture (the WebGL 3D clean-capture is a follow-on — no preserveDrawingBuffer + no clean-overlay toggle
        // yet). If 2D is hidden (3D active), it is shown behind the 3D canvas + fitted for the capture, then re-hidden — no flash.
        snapshot: () => {
            if (!segs || !segs.length) return null;   // not simulated yet
            const hidden = cv2d && cv2d.style.display === 'none';
            if (hidden) { cv2d.style.display = ''; if (t2.fit) t2.fit(); }
            const url = t2.snapshot ? t2.snapshot() : null;
            if (hidden) cv2d.style.display = 'none';
            return url;
        },
        getSimConfig: () => simConfig(lastAbsolute),                                       // t580 PREVIEW-PARITY E1 — THE ONE config the route traced from + play() feeds the engine (read-only; parity checks assert eng._* == this)
        getAnchor: () => curAnchor,                                                       // t309 — the anchored/absolute frame flag (feed the overlay so its path frame matches)
        onToolPos: (cb) => { if (typeof cb === 'function') toolPosSubs.push(cb); return () => { toolPosSubs = toolPosSubs.filter((f) => f !== cb); }; },   // t309 — subscribe to the live engine head (fires in ANY mode); returns an unsubscribe
        onProbeTouch: (cb) => { if (typeof cb === 'function') touchSubs.push(cb); return () => { touchSubs = touchSubs.filter((f) => f !== cb); }; },   // t319 — subscribe to G31 contacts (the Layout pulse); cb({pos, axis, feed, slow, pass, speed})
        get viz() { return viz; }, get engine() { return engine; }, el: container };
}
