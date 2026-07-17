// PRE-FLIGHT ENVELOPE BADGE (t838) — the editor face of the pre-flight check (the safety story's third layer: warn BEFORE
// motion). A small badge in the editor: GREEN "fits envelope" / AMBER "can't verify (why)" / RED "N outside envelope".
// Click → the violation list; a row-click jumps the editor to that line. Follows the xform-badge precedent
// (editorOpHover.js) and subscribes to the ONE program-change hook (programModel.onChange), plus editor input +
// settings-changed so it re-checks on every program/envelope entry point.

import { onChange } from '../blocks/programModel.js';
import { checkEnvelope } from '../engine/envelopeCheck.js';

let _mgr = null;
let badge = null, label = null, pop = null;
let lastResult = null;

const editorProgram = () => { const ed = document.getElementById('editor'); return ed ? ed.value : ''; };
const settings = () => (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
const fmt = (n) => (Math.round(n * 10) / 10).toFixed(1);

// BONUS (t838): when the pull recorded that the controller's soft limits are OFF, say so — the declared envelope is then
// NOT enforced by the machine, so Studio's warning is the only guard. (settings.machine.softLimitsPulled, set at pull.)
function softLimitNote() {
    const m = settings().machine || {};
    if (m.softLimitsPulled === false) return 'Heads up: soft limits are DISABLED on your controller — the machine will NOT stop itself at these limits. This pre-flight is your only guard.';
    return '';
}
function probeNote(res) {
    if (!res.uncheckedProbes) return '';
    const n = res.uncheckedProbes;
    return `${n} probe move${n > 1 ? 's' : ''} stop trip-dependently and can't be checked statically (the deterministic moves around them are checked).`;
}

function renderPop(res) {
    pop.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'preflight-pop-head';
    const nv = res.violations.length;
    const hasStock = res.violations.some((v) => v.kind === 'through-stock');   // t937 — a mixed/through-stock verdict softens the envelope-specific wording
    head.textContent = res.status === 'red' ? (hasStock ? `${nv} pre-flight issue${nv > 1 ? 's' : ''}` : `${nv} move${nv > 1 ? 's' : ''} ${nv > 1 ? 'leave' : 'leaves'} the machine travel`)
        : res.status === 'amber' ? 'Pre-flight could not verify' : 'Pre-flight: fits the envelope';
    pop.appendChild(head);

    if (res.status === 'amber' && res.reason) {
        const why = document.createElement('div'); why.className = 'preflight-pop-note'; why.textContent = res.reason; pop.appendChild(why);
    }
    if (res.violations.length) {
        const ul = document.createElement('ul'); ul.className = 'preflight-pop-list';
        for (const v of res.violations) {
            const li = document.createElement('li');
            li.className = 'preflight-row'; li.setAttribute('data-line', v.line);
            li.textContent = v.kind === 'through-stock' ? `line ${v.line} · crosses the stock` : `line ${v.line} · ${v.axis} · ${fmt(v.overshoot)} mm over`;
            li.title = 'Jump to this line';
            li.addEventListener('click', () => { if (_mgr && _mgr.revealLine) _mgr.revealLine(v.line); pop.hidden = true; });
            ul.appendChild(li);
        }
        pop.appendChild(ul);
    }
    for (const note of [probeNote(res), softLimitNote()]) {
        if (!note) continue;
        const d = document.createElement('div'); d.className = 'preflight-pop-note'; d.textContent = note; pop.appendChild(d);
    }
}

// t862/t903 — INLINE PER-LINE DIAGNOSTICS. RED no longer shows a COUNTING chip; instead each violating source line gets a
// red-tinted annotation at its row's right edge ("Z+ 3.0mm over"), from the SAME checkEnvelope violations (one source). The
// annotation is ABSOLUTELY positioned inside the `.g-line` overlay span (out of the text flow → adds no height, so the
// overlay stays line-aligned with the textarea; and it can never push the code off-canvas). One annotation per bad LINE (a
// line breaching multiple edges lists them). Cleared + re-injected on every re-check (so it clears the moment a line is
// edited to fitness). Only in RED — amber/green carry no violations.
function renderAnnotations(res) {
    const overlay = document.getElementById('editor-highlight');
    if (!overlay) return;
    overlay.querySelectorAll('.preflight-annot').forEach((el) => el.remove());
    if (!res || res.status !== 'red' || !res.violations.length) return;
    const notes = [probeNote(res), softLimitNote()].filter(Boolean).join('\n');   // caveats ride the annotation title (no chip in RED)
    const byLine = new Map();   // a line can breach multiple edges → one annotation listing them
    for (const v of res.violations) { if (!byLine.has(v.line)) byLine.set(v.line, []); byLine.get(v.line).push(v); }
    for (const [line, vs] of byLine) {
        const span = overlay.querySelector(`.g-line[data-line-index="${line - 1}"]`);   // violation `line` is 1-based; data-line-index is 0-based
        if (!span) continue;
        const a = document.createElement('span');
        a.className = 'preflight-annot';
        a.textContent = vs.map((v) => v.kind === 'through-stock' ? 'crosses the stock' : `${v.axis} ${fmt(v.overshoot)}mm over`).join(' · ');
        if (notes) a.title = notes;
        span.appendChild(a);
    }
}

function render() {
    if (!badge) return;
    const prog = editorProgram();
    if (!prog || !prog.trim()) { badge.hidden = true; pop.hidden = true; renderAnnotations(null); return; }
    let res;
    try { res = checkEnvelope(prog, settings()); } catch (_) { badge.hidden = true; renderAnnotations(null); return; }
    lastResult = res;
    if (res.status === 'red') {
        // RED — NO chip; the per-line inline annotations ARE the diagnostic (one per bad line).
        badge.hidden = true; pop.hidden = true;
        renderAnnotations(res);
    } else if (res.status === 'amber') {
        // AMBER (can't verify) — keep a SMALL chip (there are no lines to annotate); the popover carries the reason.
        renderAnnotations(null);
        badge.hidden = false; badge.className = 'preflight-badge preflight-amber';
        label.textContent = '⚠ can’t verify';
        label.title = [res.reason, probeNote(res), softLimitNote()].filter(Boolean).join('\n\n');
        renderPop(res);
    } else {
        // GREEN — nothing (silence).
        badge.hidden = true; pop.hidden = true;
        renderAnnotations(null);
    }
}

export function initPreflightBadge(mgr) {
    _mgr = mgr;
    const editor = document.getElementById('editor');
    if (!editor || !editor.parentElement) return;

    badge = document.createElement('div'); badge.id = 'preflight-badge'; badge.className = 'preflight-badge'; badge.hidden = true;
    label = document.createElement('button'); label.type = 'button'; label.className = 'preflight-badge-label'; label.setAttribute('aria-label', 'Pre-flight envelope check');
    pop = document.createElement('div'); pop.className = 'preflight-pop'; pop.hidden = true;
    label.addEventListener('click', () => { if (badge.hidden) return; pop.hidden = !pop.hidden; });
    badge.appendChild(label); badge.appendChild(pop);
    editor.parentElement.appendChild(badge);

    let inputT = null;
    const debounced = () => { clearTimeout(inputT); inputT = setTimeout(render, 250); };   // don't re-trace on every keystroke
    onChange(() => render());                                              // wizard insert / load / blocks / editor reconcile
    editor.addEventListener('input', debounced);                           // live typing (settles at 250ms)
    window.addEventListener('ddcs:settings-changed', () => render());      // envelope / WCS-table pull changes the frame
    render();

    window.ddcsPreflightCheck = () => lastResult;                          // test/debug hook — the last computed result
}
