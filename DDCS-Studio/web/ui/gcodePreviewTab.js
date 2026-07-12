/**
 * DDCS Studio — EDITOR / 3D preview drawer (thin wrapper around the shared preview panel).
 *
 * The preview itself is the shared createPreviewPanel — IDENTICAL code + UI to the Blocks tab and the wizards.
 * This module owns only the Studio-editor chrome: the slide-in drawer (open/close via the pull-tab) and the
 * edge-resize grip, plus the spindle-start window hooks. The panel is fed the editor's program (getGcode),
 * highlights the executing line in the editor (onLine), consumes a wizard hand-off start (getStart), and seeds
 * controller params for the trace/engine (createVarStore). Run/Step/Loop, 2D/3D, stock, status, trail all live
 * in the panel, so a tweak there changes every preview at once.
 */
import { createPreviewPanel } from '../viz/createPreviewPanel.js';
import { isMarker, parseMarker } from '../blocks/opSchema.js';
import { opSimStarts } from '../viz/opSimStarts.js';
import { applyProgramIntent } from '../viz/opSimContext.js';   // t756 — the WHOLE-PROGRAM declared render intent (seat / machine-frame / rig)
import { onChange } from '../blocks/programModel.js';          // t756 — re-apply the intent when the program's ops change

// Per-pass sim-start HINTS for the editor's program — the SAME federated registry the wizards use (opSimStarts). So the
// editor sims a multi-pass probe (a boss-both) with the 2nd-axis beginning at ② — IDENTICAL to the wizard's preview —
// instead of gluing it to the literal incremental position (the stock edge / WCS).
//
// Option B (one-source, editor-clean): read the LIVE PROGRAM MODEL first — its op records carry opType + params, so no
// markers are needed in the editor text (the editor stays clean — see programModel.js "export only"). This is what fixes the
// human's symptom: right after a wizard INSERT the op+params are in the program, so the hints resolve. It also lights up
// CUSTOM ops (the program record → opSimStarts → the def.sim.starts provider). FALLBACK: a loaded .nc that already carries
// export @DDCS markers (no live program) — parse them (the original marker path). Either yields registry DEFAULT hints; a
// dragged ②/userStarts saved as op data is a later increment.
function gpStartHints() {
    const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
    // PRIMARY — the live program model (each op record → its per-pass starts, concatenated in program order).
    const prog = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
    const fromProg = [];
    for (const b of prog) {
        if (!b || b.type !== 'op' || !b.opType) continue;
        const h = opSimStarts(b.opType, b.params || {}, stock);
        if (Array.isArray(h) && h.length) fromProg.push(...h);
    }
    if (fromProg.length) return fromProg;
    // FALLBACK — a loaded .nc with export @DDCS markers but no live program model.
    const editor = document.getElementById('editor');
    const txt = editor ? editor.value : '';
    if (!txt || txt.indexOf('@DDCS') < 0) return null;
    const hints = [];
    for (const line of txt.split('\n')) {
        if (!isMarker(line)) continue;
        const m = parseMarker(line);
        if (!m) continue;
        const h = opSimStarts(m.opType, m.params, stock);
        if (Array.isArray(h) && h.length) hints.push(...h);
    }
    return hints.length ? hints : null;
}

// Seed controller parameter vars from Settings so "read from controller" macros (F#632 P#1078 L#1080 … —
// PROBE-CONFIG-SOURCE.md) resolve as a controller whose parameter page matches the Settings panel.
function gpSeededVarStore() {
    const m = new Map();
    const cfg = window.ddcsGetSettings ? window.ddcsGetSettings() : null;
    const p = (cfg && cfg.probes) || {};
    const a = (cfg && cfg.atc) || {};
    m.set(631, 1);                                  // Pr131 probe detection times
    m.set(632, Number(a.fFast) || 200);             // Pr132 probing speed
    m.set(633, Number(a.blockHeight) || 50);        // Pr133 setter block thickness
    m.set(640, Number(a.retract) || 2);             // Pr140 retraction after probe
    m.set(1075, Number(p.setterPin) || 0);          // Pr575 fixed probe port
    m.set(1077, Number(p.setterLevel) || 0);        // Pr577 fixed probe level
    m.set(1078, Number(p.probePin) || 0);           // Pr578 floating probe port
    m.set(1080, Number(p.probeLevel) || 0);         // Pr580 floating probe level
    return m;
}

// t756 (R-C) — the EDITOR preview consumes the WHOLE-PROGRAM declared intent (opSimContext), so a program with an
// alignment op seats at the Start, a machine op (ATC/homing) draws the machine frame, a rotary program shows the rig
// — the SAME truths the wizard/Blocks previews honor, via the ONE applyProgramIntent seam (no imperative preview* here).
const editorOpTypes = () => (window.ddcsGetBlockProgram ? (window.ddcsGetBlockProgram() || []) : []).filter((b) => b && b.type === 'op' && b.opType).map((b) => b.opType);
const applyEditorIntent = () => { if (gpPanel) applyProgramIntent(gpPanel, editorOpTypes()); };

let gpPanel = null;
let gpView = 'editor';   // drawer open ('3d') vs closed ('editor')

const gpEls = () => ({
    toggle: document.getElementById('view-toggle'),
    vizContainer: document.getElementById('gcodeViz3dContainer'),
    host: document.getElementById('viz3d-panel-host'),
    editor: document.getElementById('editor'),
});

function ensurePanel() {
    if (gpPanel) return gpPanel;
    const els = gpEls();
    if (!els.host || !els.editor) return null;
    gpPanel = createPreviewPanel(els.host, {
        getGcode: () => (els.editor ? els.editor.value : ''),
        onLine: (i) => {
            const em = window.editorManager; if (!em) return;
            if (i == null) { if (em.clearActiveLine) em.clearActiveLine(); }
            else if (em.setActiveLine) em.setActiveLine(i);
        },
        // WCS VISIBLE (slice 2): a WCS/start call line flashes in the editor as the sim reaches it (the 3D marker glows too).
        onCallFlash: (i, kind) => { const em = window.editorManager; if (em && em.flashLine) em.flashLine(i, kind); },
        // A wizard insert hands off the start it was previewing — consume it once; else the op marker's pass-0 hint (①), so
        // pass 0 begins at the inferred start too (matching the wizard), not the viz default {0,0,0} / the WCS origin.
        getStart: () => { const ps = window.__pendingSpindleStart; window.__pendingSpindleStart = null; return ps || (gpStartHints() || [])[0] || null; },
        // Per-pass start HINTS from the program's op markers (opSimStarts registry) → the editor sims a boss-both's 2nd-axis
        // at ②, the SAME as the wizard. Consumed by the panel's computePassStarts (the trace + engine passStarts).
        getStartHints: gpStartHints,
        // DISC-ON-SURFACE (multi-op, t149): the declared radius-comps the disc nudges to come from the WHOLE program model
        // (every op's builderOf stack), so editor Simulate lands the probe disc on the TRUE surface for ANY probe op — the
        // same declared-driven nudge as the wizard preview, read SIM-SIDE from the model (Option B, never an editor-text marker).
        getOps: () => (window.ddcsGetBlockProgram ? (window.ddcsGetBlockProgram() || []) : []).filter((b) => b && b.type === 'op' && b.opType).map((b) => ({ type: b.opType, params: b.params || {} })),
        createVarStore: gpSeededVarStore,
    });
    // Spindle / program-zero start hooks (read/write the panel's draggable 3D marker) — used by the wizard insert.
    window.ddcsSetSpindleStart = (x, y, z, pass) => { const v = gpPanel && gpPanel.viz; if (v && v.setStart) v.setStart(x, y, z, pass || 0); };
    window.ddcsGetSpindleStart = () => { const v = gpPanel && gpPanel.viz; return (v && v.starts && v.starts[0]) ? { ...v.starts[0] } : null; };
    window.ddcsGetStarts = () => { const v = gpPanel && gpPanel.viz; return v ? v.starts.map((s) => ({ ...s })) : null; };
    window.__gpPanel = gpPanel;   // debug accessor
    return gpPanel;
}

export function setGcodeView(view) {
    const els = gpEls();
    gpView = view;
    const is3d = view === '3d';   // open the preview drawer
    if (els.vizContainer) els.vizContainer.classList.toggle('open', is3d);
    if (els.toggle) {
        els.toggle.classList.toggle('open', is3d);   // slide the pull-tab onto the drawer edge
        els.toggle.title = is3d ? 'Hide the toolpath preview' : 'Show the toolpath preview';
    }
    if (!is3d) { if (gpPanel) gpPanel.setActive(false); return; }   // closed → pause/stop the panel
    const panel = ensurePanel();
    if (panel) { panel.setActive(true); applyEditorIntent(); }      // open → mount/activate + render the editor program, applying the whole-program intent
}

function gpInit() {
    const els = gpEls();
    if (els.toggle) els.toggle.addEventListener('click', () => setGcodeView(gpView === '3d' ? 'editor' : '3d'));

    // Edge-resize grip → --viz3d-size (drawer width/height); the panel auto-refits via its ResizeObservers.
    const grip = els.vizContainer ? els.vizContainer.querySelector('.viz3d-resize') : null;
    const ec = els.vizContainer ? els.vizContainer.closest('.editor-container') : null;
    if (grip && ec) {
        const MIN_PX = 160;
        let startX = 0, startY = 0, startPx = 0, vertical = false, pid = null;
        grip.addEventListener('pointerdown', (e) => {
            vertical = window.matchMedia('(orientation: portrait)').matches;
            const r = els.vizContainer.getBoundingClientRect();
            startPx = vertical ? r.height : r.width;
            startX = e.clientX; startY = e.clientY; pid = e.pointerId;
            ec.classList.add('viz3d-resizing');
            try { grip.setPointerCapture(e.pointerId); } catch (_) { /* older browsers */ }
            e.preventDefault();
        });
        grip.addEventListener('pointermove', (e) => {
            if (pid === null || e.pointerId !== pid) return;
            const cr = ec.getBoundingClientRect();
            const maxPx = Math.round((vertical ? cr.height : cr.width) * 0.92);
            const raw = vertical ? (startPx - (e.clientY - startY)) : (startPx - (e.clientX - startX));
            ec.style.setProperty('--viz3d-size', Math.max(MIN_PX, Math.min(maxPx, raw)) + 'px');
            e.preventDefault();
        });
        const endResize = () => { if (pid === null) return; try { grip.releasePointerCapture(pid); } catch (_) { /* ignore */ } pid = null; ec.classList.remove('viz3d-resizing'); };
        grip.addEventListener('pointerup', endResize);
        grip.addEventListener('pointercancel', endResize);
    }

    // Live update while the drawer is open (the panel debounces its own renders internally).
    if (els.editor) els.editor.addEventListener('input', () => { if (gpView === '3d' && gpPanel) gpPanel.setGcode(els.editor.value); });
    // t756 — the program's OPS changed (insert / edit / load) → re-apply the whole-program render intent (seat / frame / rig).
    onChange(() => { if (gpView === '3d') applyEditorIntent(); });

    // Click / move the caret in the editor → place the tool in the preview at that line (when not playing).
    if (els.editor) {
        const seekToCaret = () => {
            if (gpView !== '3d' || !gpPanel || !gpPanel.seekLine || (gpPanel.engine && gpPanel.engine.running)) return;
            const line = els.editor.value.slice(0, els.editor.selectionStart).split('\n').length - 1;
            gpPanel.seekLine(line);
        };
        els.editor.addEventListener('click', seekToCaret);
        els.editor.addEventListener('keyup', (e) => { if (e.key && e.key.indexOf('Arrow') === 0) seekToCaret(); });
    }

    window.setGcodeView = setGcodeView;
    // Leaving the preview context stops the run (the panel also listens to ddcs:stop-previews); covers the
    // drawer-close + legacy callers (showApp/wizard/settings).
    window.ddcsStopPreview = () => { if (gpPanel) gpPanel.stop(); };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gpInit);
else gpInit();
