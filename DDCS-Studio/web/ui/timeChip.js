// TIME-ESTIMATE CHIP (t844) — an unobtrusive editor chip showing the program's estimated run time (e.g. "≈ 14 min"),
// live-updated on every program/settings change. It reads the ONE source (the engine trace via timeEstimate) and the
// declared settings.machine.rapidRate/toolChangeSec. HONEST: no accel/decel — the tooltip says "estimated" + the bias.

import { onChange } from '../blocks/programModel.js';
import { estimateProgram, fmtDuration } from '../engine/timeEstimate.js';
import { editorStripHost } from './uiUtils.js';   // t2155 — a STRIP tenant, not editor.parentElement

let chip = null;
let last = null;   // cache the last full estimate (incl. perLine) — the op-hover chip reads it without re-tracing per mousemove

const editorProgram = () => { const ed = document.getElementById('editor'); return ed ? ed.value : ''; };
const machine = () => (window.ddcsGetSettings && window.ddcsGetSettings().machine) || {};
const estimate = () => { last = estimateProgram(editorProgram(), { rapidRate: machine().rapidRate, toolChangeSec: machine().toolChangeSec }); return last; };

function render() {
    if (!chip) return;
    const prog = editorProgram();
    if (!prog || !prog.trim()) { chip.hidden = true; return; }
    let r;
    try { r = estimate(); } catch (_) { chip.hidden = true; return; }
    if (!(r.seconds > 0)) { chip.hidden = true; return; }
    chip.hidden = false;
    chip.textContent = '≈ ' + fmtDuration(r.seconds);
    const parts = [`cut ${fmtDuration(r.moveSec)}`];
    if (r.dwellSec > 0) parts.push(`dwell ${fmtDuration(r.dwellSec)}`);
    if (r.tcSec > 0) parts.push(`tool changes ${fmtDuration(r.tcSec)}`);
    chip.title = `Estimated run time ≈ ${fmtDuration(r.seconds)}  (${parts.join(', ')}).\nNo acceleration is modeled — a real job runs a little longer on segment-dense code.`;
}

export function initTimeChip() {
    const editor = document.getElementById('editor');
    const host = editorStripHost();
    if (!editor || !host) return;
    chip = document.createElement('div');
    chip.id = 'time-estimate-chip';
    chip.className = 'time-estimate-chip';
    chip.hidden = true;
    chip.setAttribute('aria-label', 'Estimated run time');
    host.appendChild(chip);   // order:2 in CSS places it between the badge and the toolbar regardless of DOM position

    let t = null;
    const debounced = () => { clearTimeout(t); t = setTimeout(render, 250); };   // don't re-trace on every keystroke
    onChange(() => render());                                                    // wizard insert / load / blocks / editor reconcile
    editor.addEventListener('input', debounced);                                 // live typing (settles at 250ms)
    window.addEventListener('ddcs:settings-changed', () => render());            // rapidRate / toolChangeSec change
    render();

    window.ddcsTimeEstimate = () => last || estimate();   // the current program's estimate (cached; the op-hover chip reads perLine)
}
