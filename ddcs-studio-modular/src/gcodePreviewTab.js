/**
 * DDCS Studio — EDITOR / 3D tab controller
 *
 * Wires the top-level [ EDITOR | 3D ] tab strip. Switching to 3D swaps the main
 * area to a three.js toolpath preview of whatever is in the editor, and keeps it
 * live (debounced) while that tab is active. The 3D viewer is created lazily on
 * first use so the cost is only paid when the user opens it.
 */
import { parseGcode } from './gcodeParser.js';
import { GcodeViz3D } from './gcodeViz3d.js';

let gpViz = null;
let gpView = 'editor';
let gpDebounce = null;

function gpEls() {
    return {
        toggle: document.getElementById('view-toggle'),
        vizContainer: document.getElementById('gcodeViz3dContainer'),
        editor: document.getElementById('editor'),
        status: document.getElementById('viz3dStatus'),
    };
}

// Keep the in-canvas stock controls in sync with settings
function gpSyncControls() {
    const sel = document.getElementById('viz3dStockShape');
    const s = window.ddcsGetSettings ? window.ddcsGetSettings() : null;
    if (sel && s && s.stock) sel.value = s.stock.shape || 'boss';
}

function gpRenderFromEditor() {
    const { editor, status } = gpEls();
    if (!gpViz || !editor) return;
    const parsed = parseGcode(editor.value);
    // Stock + machine envelope from Settings (set before setSegments so the fit includes them)
    const cfg = window.ddcsGetSettings ? window.ddcsGetSettings() : null;
    if (cfg) { gpViz.setStock(cfg.stock); gpViz.setMachine(cfg.machine); }
    gpViz.setSegments(parsed);
    if (!status) return;
    const s = parsed.stats;
    if (!s.drawable) {
        status.textContent = 'No drawable moves — variable/probe code (#…, G31) is skipped';
    } else {
        const b = parsed.bounds;
        const r = (n) => n.toFixed(1).replace(/\.0$/, '');
        const parts = [];
        if (s.feed) parts.push(`${s.feed} cuts`);
        if (s.probe) parts.push(`${s.probe} probes`);
        if (s.rapid) parts.push(`${s.rapid} rapids`);
        if (s.retract) parts.push(`${s.retract} retracts`);
        if (s.jog) parts.push(`${s.jog} jogs`);
        if (s.skipped) parts.push(`${s.skipped} skipped`);
        status.textContent = parts.join(' · ') +
            `   X[${r(b.minX)} ${r(b.maxX)}] Y[${r(b.minY)} ${r(b.maxY)}] Z[${r(b.minZ)} ${r(b.maxZ)}] mm`;
    }
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
            window.ddcsSetSpindleStart = (x, y, z) => { if (gpViz) gpViz.setStart(x, y, z); };
            window.ddcsGetSpindleStart = () => (gpViz ? { ...gpViz.start } : null);
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
    gpSyncControls();
    // Stock / machine settings changed → redraw if the 3D drawer is open
    window.addEventListener('ddcs:settings-changed', () => {
        gpSyncControls();
        if (gpView === '3d' && gpViz) gpRenderFromEditor();
    });
    window.setGcodeView = setGcodeView;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', gpInit);
} else {
    gpInit();
}
