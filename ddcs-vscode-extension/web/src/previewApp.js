// previewApp.js — entrypoint for the pop-out preview window (its own WebviewPanel). Renders ONLY the
// shared 2D/3D toolpath preview of the current program, fed the G-code from the host (the .nc document).
import { createPreviewPanel } from '../../../DDCS-Studio/web/viz/createPreviewPanel.js';

// Forward console to the host (→ _debug.log) so this window can be debugged like the main app.
let __seq = 0;
['log', 'warn', 'error'].forEach((lvl) => {
    const orig = console[lvl].bind(console);
    console[lvl] = (...args) => {
        orig(...args);
        try {
            const text = args.map((a) => typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch (_) { return String(a); } })()).join(' ');
            if (window.vscode) window.vscode.postMessage({ type: 'log', text: '[preview] #' + (++__seq) + ' [' + lvl + '] ' + text.slice(0, 1500) });
        } catch (_) {}
    };
});

let currentGcode = '';
let currentStart = null;   // operator start (from the wizard's 3D preview) — positions the toolpath + probes
let panel = null;

document.addEventListener('DOMContentLoaded', () => {
    try { console.log('[DDCS preview] init; localStorage keys=' + Object.keys(localStorage).join(',')); } catch (_) {}
    try {
        // createPreviewPanel builds its own UI into the host and renders from getGcode().
        panel = createPreviewPanel(document.getElementById('preview-host'), {
            getGcode: () => currentGcode,
            getStart: () => currentStart,
        });
        panel.setActive(true);
        console.log('[DDCS preview] panel created');
        if (currentGcode) { panel.setGcode(currentGcode); }
    } catch (err) {
        console.error('[DDCS preview] createPreviewPanel failed: ' + (err && err.message ? err.message : err));
    }
    // Ask the host for the current G-code (and it'll push live updates after).
    try { if (window.vscode) window.vscode.postMessage({ type: 'previewReady' }); } catch (_) {}
});

// G-code from the host: initial payload + every document change.
window.addEventListener('message', (e) => {
    const m = e.data;
    if (m && m.type === 'gcode') {
        currentGcode = m.text || '';
        if (m.start !== undefined && m.start !== null) { currentStart = m.start; }
        console.log('[DDCS preview] gcode received, len=' + currentGcode.length + ' start=' + JSON.stringify(currentStart));
        if (panel) {
            try { panel.setGcode(currentGcode); console.log('[DDCS preview] setGcode done'); }
            catch (err) { console.error('[DDCS preview] setGcode failed: ' + (err && err.message ? err.message : err)); }
        }
    }
});
