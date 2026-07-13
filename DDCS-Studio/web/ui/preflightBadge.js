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
    head.textContent = res.status === 'red' ? `${nv} move${nv > 1 ? 's' : ''} ${nv > 1 ? 'leave' : 'leaves'} the machine travel`
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
            li.textContent = `line ${v.line} · ${v.axis} · ${fmt(v.overshoot)} mm over`;
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

function render() {
    if (!badge) return;
    const prog = editorProgram();
    if (!prog || !prog.trim()) { badge.hidden = true; pop.hidden = true; return; }
    let res;
    try { res = checkEnvelope(prog, settings()); } catch (_) { badge.hidden = true; return; }
    lastResult = res;
    badge.hidden = false;
    badge.className = 'preflight-badge preflight-' + res.status;
    const n = res.violations.length;
    const pn = probeNote(res), sn = softLimitNote();
    const tip = (t) => { label.title = [t, pn, sn].filter(Boolean).join('\n\n'); };
    if (res.status === 'green') { label.textContent = '✓ fits envelope'; tip('Every move stays inside the declared machine travel.'); }
    else if (res.status === 'amber') { label.textContent = '⚠ can’t verify'; tip(res.reason); }
    else { label.textContent = `✕ ${n} outside envelope`; tip(`${n} move${n > 1 ? 's' : ''} would leave the machine travel — click for the list.`); }
    renderPop(res);
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
