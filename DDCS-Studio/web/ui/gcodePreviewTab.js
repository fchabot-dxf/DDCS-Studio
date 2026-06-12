/**
 * DDCS Studio — EDITOR / 3D tab controller
 *
 * Wires the top-level [ EDITOR | 3D ] tab strip. Switching to 3D swaps the main
 * area to a three.js toolpath preview of whatever is in the editor, and keeps it
 * live (debounced) while that tab is active. The 3D viewer is created lazily on
 * first use so the cost is only paid when the user opens it.
 */
import { parseGcode } from '../gcodeParser.js';
import { GcodeViz3D } from '../viz/gcodeViz3d.js';
import { GcodeExecutionEngine } from '../engine/index.js';

let gpViz = null;
let gpEngine = null;
let gpView = 'editor';
let gpDebounce = null;
let gpRunButton = null;

function gpEls() {
    return {
        toggle: document.getElementById('view-toggle'),
        vizContainer: document.getElementById('gcodeViz3dContainer'),
        editor: document.getElementById('editor'),
        status: document.getElementById('viz3dStatus'),
        copyBtn: document.getElementById('viz3dStatusCopy'),
    };
}

// Move the play controls (Speed/Run/Step/Loop) out of the static toolbar into the floating
// jog bar above the jog buttons, so every preview control shares one bar over the canvas.
function gpRelocatePlayControls() {
    const host = gpViz && gpViz.jogPendant && gpViz.jogPendant.querySelector('#jogPlayControls');
    if (!host) return;
    const speed = document.getElementById('viz3dSpeed');
    if (speed) { const lbl = speed.closest('label'); host.appendChild(speed); if (lbl) lbl.remove(); } // drop the "Speed" text label (the select keeps its tooltip)
    ['viz3dAnimate', 'viz3dStep', 'viz3dLoop'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) host.appendChild(el);
    });
    const bar = document.querySelector('.viz3d-controls');
    if (bar && !bar.children.length) bar.style.display = 'none';
}

/** Set the status bar text, optionally flagging it as an error (red + copy button). */
function gpSetStatus(statusEl, text, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle('has-error', isError);
    const copyBtn = document.getElementById('viz3dStatusCopy');
    if (copyBtn) copyBtn.classList.toggle('visible', !!(text && text.length > 0));
}

function gpRenderFromEditor() {
    const { editor, status } = gpEls();
    if (!gpViz || !editor) return;
    const parsed = parseGcode(editor.value);
    // Stock + machine envelope from Settings (set before setSegments so the fit includes them)
    const cfg = window.ddcsGetSettings ? window.ddcsGetSettings() : null;
    if (cfg) { gpViz.setStock(cfg.stock); gpViz.setMachine(cfg.machine); gpViz.setProbes(cfg.probes); }
    gpViz.setSegments(parsed);
    // A wizard insert can hand off the start position it was previewing — apply it once, then clear.
    if (window.__pendingSpindleStart && typeof gpViz.setStart === 'function') {
        const ps = window.__pendingSpindleStart;
        gpViz.setStart(ps.x, ps.y, ps.z, 0);
        window.__pendingSpindleStart = null;
    }
    if (!status) return;
    const s = parsed.stats;
    gpSetStatus(status, !s.drawable
        ? 'No drawable moves in this program'
        : (() => {
            const b = (gpViz && gpViz._dataBounds) || parsed.bounds;
            const r = (n) => n.toFixed(1).replace(/\.0$/, '');
            const parts = [];
            if (s.feed) parts.push(`${s.feed} cuts`);
            if (s.probe) parts.push(`${s.probe} probes`);
            if (s.rapid) parts.push(`${s.rapid} rapids`);
            if (s.retract) parts.push(`${s.retract} retracts`);
            if (s.passes > 1) parts.push(`${s.passes} passes`);
            if (s.skipped) parts.push(`${s.skipped} skipped`);
            return parts.join(' · ') +
                `   X[${r(b.minX)} ${r(b.maxX)}] Y[${r(b.minY)} ${r(b.maxY)}] Z[${r(b.minZ)} ${r(b.maxZ)}] mm`;
        })(),
    false);
}

export function setGcodeView(view) {
    const els = gpEls();
    gpView = view;
    const is3d = view === '3d';

    // Drawer slides in/out; the code editor stays visible underneath either way.
    if (els.vizContainer) els.vizContainer.classList.toggle('open', is3d);
    if (els.toggle) {
        els.toggle.classList.toggle('open', is3d); // slide the pull-tab onto the drawer edge
        els.toggle.title = is3d ? 'Hide the 3D preview' : 'Show 3D toolpath preview';
    }

    if (!is3d) {
        if (gpViz) gpViz.setActive(false);
        return;
    }
    if (!gpViz) {
        try {
            gpViz = new GcodeViz3D(els.vizContainer);
            window.__gpViz = gpViz; // debug accessor
            // Spindle / program-zero start (draggable in the view; also settable programmatically)
            window.ddcsSetSpindleStart = (x, y, z, pass) => { if (gpViz) gpViz.setStart(x, y, z, pass || 0); };
            window.ddcsGetSpindleStart = () => (gpViz && gpViz.starts[0] ? { ...gpViz.starts[0] } : null);
            window.ddcsGetStarts = () => (gpViz ? gpViz.starts.map((s) => ({ ...s })) : null);
            gpRelocatePlayControls(); // pull Speed/Run/Step/Loop into the floating jog bar
        } catch (err) {
            console.error('3D preview init failed', err);
            if (els.status) els.status.textContent = '3D unavailable: ' + err.message;
            return;
        }
    }
    gpViz.setActive(true);
    gpRenderFromEditor();
}

function gpInit() {
    const els = gpEls();
    if (els.toggle) {
        els.toggle.addEventListener('click', () => setGcodeView(gpView === '3d' ? 'editor' : '3d'));
    }
    // Drag the edge grip to resize the 3D drawer (mouse + touch via Pointer Events). It sets
    // --viz3d-size on the editor-container, which drives the drawer's width/height AND the toggle's
    // resting edge; the viz canvas auto-refits via its ResizeObserver.
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
            // the drawer is anchored bottom-right, so dragging the grip toward the editor (left / up) grows it
            const raw = vertical ? (startPx - (e.clientY - startY)) : (startPx - (e.clientX - startX));
            const size = Math.max(MIN_PX, Math.min(maxPx, raw));
            ec.style.setProperty('--viz3d-size', size + 'px');
            e.preventDefault();
        });
        const endResize = () => {
            if (pid === null) return;
            try { grip.releasePointerCapture(pid); } catch (_) { /* ignore */ }
            pid = null;
            ec.classList.remove('viz3d-resizing');
        };
        grip.addEventListener('pointerup', endResize);
        grip.addEventListener('pointercancel', endResize);
    }
    if (els.editor) {
        els.editor.addEventListener('input', () => {
            if (gpView !== '3d') return;
            clearTimeout(gpDebounce);
            gpDebounce = setTimeout(gpRenderFromEditor, 300);
        });
    }
    // View-snap buttons (Top / Front / Right / Iso)
    document.querySelectorAll('#gcodeViz3dContainer .viz3d-views button').forEach((btn) => {
        btn.addEventListener('click', () => { if (gpViz) gpViz.setView(btn.dataset.view); });
    });
    // Run / Step / Loop controls for the execution engine (I/O toggle now lives in the jog bar)
    const runBtn = document.getElementById('viz3dAnimate');
    const stepBtn = document.getElementById('viz3dStep');
    const loopBtn = document.getElementById('viz3dLoop');
    gpRunButton = runBtn;
    let gpLoopTimer = null;
    let gpLastRunCode = null;   // code of the last continuous Run (loop restarts this, never a stepped run)
    const gpCancelLoop = () => { if (gpLoopTimer) { clearTimeout(gpLoopTimer); gpLoopTimer = null; } };

    const speedSel = document.getElementById('viz3dSpeed');
    const gpSimSpeed = () => {
        const v = speedSel ? parseFloat(speedSel.value) : 1;
        return Number.isFinite(v) && v > 0 ? v : 1;
    };

    function ensureEngine() {
        if (gpEngine) return gpEngine;
        const cfg = window.ddcsGetSettings ? window.ddcsGetSettings() : null;
        gpEngine = new GcodeExecutionEngine({
            stock: cfg && cfg.stock ? cfg.stock : null,
            autoAnswer: window.ioPanel ? window.ioPanel.isAutoSensors() : true,
            simSpeed: gpSimSpeed(),
            onLineChange: ({ lineIndex, raw }) => {
                if (window.editorManager && typeof window.editorManager.setActiveLine === 'function') {
                    window.editorManager.setActiveLine(lineIndex);
                }
                if (els.status) {
                    els.status.textContent = `Executing line ${lineIndex + 1}/${gpEngine.totalLines}: ${raw.trim()}`;
                }
            },
            onPositionChange: (pos) => {
                if (gpViz && typeof gpViz.setToolPosition === 'function') {
                    gpViz.setToolPosition(pos);
                }
            },
            onStatus: ({ message }) => {
                gpSetStatus(els.status, message, false);
            },
            onWait: (wait) => {
                // Parked on a sensor wait → surface the I/O panel and pulse the pin
                if (window.ioPanel) {
                    if (wait) window.ioPanel.show();
                    window.ioPanel.setWait(wait);
                }
            },
            onFinish: ({ stats }) => {
                gpUpdateRunButton();
                if (window.editorManager && typeof window.editorManager.clearActiveLine === 'function') {
                    window.editorManager.clearActiveLine();
                }
                // One "program done" beep — only if it actually executed something
                if (stats && stats.steps > 1 && gpViz && typeof gpViz._beep === 'function') gpViz._beep();
                // Loop: restart the last continuous Run after a short pause
                if (loopBtn && loopBtn.classList.contains('on') && gpLastRunCode != null) {
                    gpCancelLoop();
                    gpLoopTimer = setTimeout(() => {
                        gpLoopTimer = null;
                        gpEngine.run(gpLastRunCode);
                        gpUpdateRunButton();
                    }, 800);
                }
            },
        });
        return gpEngine;
    }

    // Validate before any run/step; show errors in the status bar
    function gpValidate(code) {
        const validation = ensureEngine().verifySyntax(code);
        if (!validation.valid) {
            const errText = validation.errors.map((err) => `Ln ${err.lineIndex + 1}: ${err.message}`).join('\n');
            gpSetStatus(els.status, errText, true);
            return false;
        }
        return true;
    }

    if (runBtn) {
        runBtn.classList.remove('on');
        runBtn.textContent = '▶';
        runBtn.title = 'Run the program through the execution engine';
        runBtn.addEventListener('click', () => {
            const code = els.editor ? els.editor.value : '';
            const eng = ensureEngine();
            if (eng.running && !eng.paused) {
                gpCancelLoop();
                gpLastRunCode = null;   // explicit stop also stops looping
                eng.stop();
            } else if (eng.running && eng.paused) {
                eng.resume();
            } else {
                if (!gpValidate(code)) return;
                // Disable the independent animation loop; engine drives tool position instead
                if (gpViz) gpViz.setAnimate(false);
                gpLastRunCode = code;
                eng.run(code);
            }
            gpUpdateRunButton();
        });
    }
    if (stepBtn) {
        stepBtn.addEventListener('click', () => {
            const code = els.editor ? els.editor.value : '';
            const eng = ensureEngine();
            gpCancelLoop();
            gpLastRunCode = null;       // stepping is interactive — don't loop it
            if (!eng.running && !gpValidate(code)) return;
            if (!eng.running && gpViz) gpViz.setAnimate(false);
            eng.step(code);   // starts paused from the top, or pauses a continuous run
            gpUpdateRunButton();
        });
    }
    if (loopBtn) {
        loopBtn.addEventListener('click', () => {
            loopBtn.classList.toggle('on');
            if (!loopBtn.classList.contains('on')) gpCancelLoop();
        });
    }
    // The I/O panel's "Auto sensors" checkbox drives the engine's virtual-sensor answers
    window.addEventListener('ddcs:auto-sensors-changed', (e) => {
        if (gpEngine) gpEngine.autoAnswer = !!(e.detail && e.detail.on);
    });
    // Speed multiplier — takes effect immediately, even mid-move
    if (speedSel) {
        speedSel.addEventListener('change', () => {
            if (gpEngine) gpEngine.simSpeed = gpSimSpeed();
        });
    }

    function gpUpdateRunButton() {
        if (!gpRunButton) return;
        const running = !!(gpEngine && gpEngine.running);
        const paused = !!(gpEngine && gpEngine.paused);
        gpRunButton.classList.toggle('on', running && !paused);
        gpRunButton.textContent = !running ? '▶' : (paused ? '▶' : '⏸');
        gpRunButton.title = !running ? 'Run the program through the execution engine'
            : (paused ? 'Resume continuous execution' : 'Stop execution');
    }
    // Stock / machine settings changed → redraw if the 3D drawer is open
    window.addEventListener('ddcs:settings-changed', () => {
        if (gpView === '3d' && gpViz) gpRenderFromEditor();
    });
    window.setGcodeView = setGcodeView;

    // Wire the copy button
    const copyBtn = gpEls().copyBtn;
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const status = gpEls().status;
            if (!status || !status.textContent) return;
            navigator.clipboard.writeText(status.textContent).then(() => {
                copyBtn.textContent = '✓ Copied';
                setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1500);
            }).catch(() => {
                // Fallback: select the text
                const range = document.createRange();
                range.selectNodeContents(status);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            });
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', gpInit);
} else {
    gpInit();
}
