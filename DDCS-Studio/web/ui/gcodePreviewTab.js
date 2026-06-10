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

// Keep the in-canvas stock controls in sync with settings
function gpSyncControls() {
    const sel = document.getElementById('viz3dStockShape');
    const s = window.ddcsGetSettings ? window.ddcsGetSettings() : null;
    if (sel && s && s.stock) sel.value = s.stock.shape || 'boss';
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
        } catch (err) {
            console.error('3D preview init failed', err);
            if (els.status) els.status.textContent = '3D unavailable: ' + err.message;
            return;
        }
    }
    gpViz.setActive(true);
    gpRenderFromEditor();
    gpSyncControls();
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
    // Stock-shape selector that lives in the 3D canvas
    const shapeSel = document.getElementById('viz3dStockShape');
    if (shapeSel) {
        shapeSel.addEventListener('change', () => {
            if (window.ddcsApplySettings) window.ddcsApplySettings({ stock: { shape: shapeSel.value } });
        });
    }
    // View-snap buttons (Top / Front / Right / Iso)
    document.querySelectorAll('#gcodeViz3dContainer .viz3d-views button').forEach((btn) => {
        btn.addEventListener('click', () => { if (gpViz) gpViz.setView(btn.dataset.view); });
    });
    // Run/stop button for the execution engine
    const runBtn = document.getElementById('viz3dAnimate');
    gpRunButton = runBtn;
    if (runBtn) {
        runBtn.classList.remove('on');
        runBtn.textContent = '▶ Run';
        runBtn.title = 'Run the program through the execution engine';
        runBtn.addEventListener('click', () => {
            const code = els.editor ? els.editor.value : '';
            if (!gpEngine) {
                const cfg = window.ddcsGetSettings ? window.ddcsGetSettings() : null;
                gpEngine = new GcodeExecutionEngine({
                    stock: cfg && cfg.stock ? cfg.stock : null,
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
                    onFinish: () => {
                        gpUpdateRunButton(false);
                        if (window.editorManager && typeof window.editorManager.clearActiveLine === 'function') {
                            window.editorManager.clearActiveLine();
                        }
                    },
                });
            }

            if (gpEngine.running) {
                gpEngine.stop();
                gpUpdateRunButton(false);
                return;
            }

            const validation = gpEngine.verifySyntax(code);
            if (!validation.valid) {
                const errText = validation.errors.map((err) => `Ln ${err.lineIndex + 1}: ${err.message}`).join('\n');
                gpSetStatus(els.status, errText, true);
                return;
            }

            // Disable the independent animation loop; engine drives tool position instead
            if (gpViz) gpViz.setAnimate(false);
            gpEngine.run(code);
            gpUpdateRunButton(true);
        });
    }
    gpSyncControls();

    function gpUpdateRunButton(running) {
        if (!gpRunButton) return;
        gpRunButton.classList.toggle('on', running);
        gpRunButton.textContent = running ? '⏸ Stop' : '▶ Run';
        gpRunButton.title = running ? 'Stop execution' : 'Run the program through the execution engine';
    }
    // Stock / machine settings changed → redraw if the 3D drawer is open
    window.addEventListener('ddcs:settings-changed', () => {
        gpSyncControls();
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
