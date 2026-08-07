// PRE-FLIGHT ENVELOPE BADGE (t838) — the editor face of the pre-flight check (the safety story's third layer: warn BEFORE
// motion). A small badge in the editor: GREEN "fits envelope" / AMBER "can't verify (why)" / RED "N outside envelope".
// Click → the violation list; a row-click jumps the editor to that line. Follows the xform-badge precedent
// (editorOpHover.js) and subscribes to the ONE program-change hook (programModel.onChange), plus editor input +
// settings-changed so it re-checks on every program/envelope entry point.

import { onChange } from '../blocks/programModel.js';
import { checkEnvelope } from '../engine/envelopeCheck.js';
import { blockLintViolations } from './preflightBlockLint.js';   // t1568 — the BLOCK-side contributor to this same surface

let _mgr = null;
let badge = null, label = null, pop = null;
let lastResult = null;

const editorProgram = () => { const ed = document.getElementById('editor'); return ed ? ed.value : ''; };
const settings = () => (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
const fmt = (n) => (Math.round(n * 10) / 10).toFixed(1);

// BONUS (t838): when the pull recorded that the controller's soft limits are OFF, say so — the declared envelope is then
// NOT enforced by the machine, so Studio's warning is the only guard. t973 — folded to ONE source: the enable state now
// rides checkEnvelope's result (res.softLimitsEnforced), not a second read of settings, so the note + the per-row UNGUARDED
// escalation can never drift.
function softLimitNote(res) {
    if (!res) return '';
    if (res.softLimitsEnforced === false) return 'Heads up: soft limits are DISABLED on your controller — the machine will NOT stop itself at these limits. This pre-flight is your only guard.';
    // t973 — when the controller DOES enforce soft limits, a breach still halts the job mid-run (it just won't crash). Context
    // only when there IS a soft-limit breach (no green-state noise), so a guarded overshoot never reads as "the machine handles it, ignore".
    if (res.softLimitsEnforced === true && (res.violations || []).some((v) => v.kind === 'soft-limit')) return 'Soft limits are enabled on your controller — it will stop at the envelope, but the breach still halts the job mid-run.';
    return '';
}
// t1323 — THE ONE CALM NOTE. A program with no absolute anchor (a jog-start skim: the operator positions the tool, then
// the body walks relatively) cannot be judged line by line — there is no line that is "over" anything, because there is no
// declared start. What IS true, and useful, is how much room the walk needs. Said ONCE, in the editor's quiet slot, in the
// operator's own terms: "needs 100 × 54 × 10.5 mm of travel from wherever you start it". Never a badge per line.
function clearanceNote(res) {
    if (!res || res.anchor !== 'relative' || !res.extent) return '';
    const e = res.extent;
    return `Starts from wherever you jog it — needs ${fmt(e.x)} × ${fmt(e.y)} × ${fmt(e.z)} mm of travel (X × Y × Z) from that start.`;
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
    // t1568 — the RED headline counts ENVELOPE breaches only: an unresolved expression is not a move that "leaves
    // the machine travel", it is a move we could not place at all. It gets its own row in the list below.
    const nv = res.violations.filter((v) => v.kind !== 'unresolved-expr').length;
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
            li.className = 'preflight-row'; li.setAttribute('data-line', v.line == null ? '' : v.line);
            // t1323 — a travel-extent breach belongs to the WHOLE PROGRAM (no anchor → no guilty line), so it reads as a
            // fact about the program and is not clickable-to-a-line. Every other kind keeps its line, unchanged.
            li.textContent = v.kind === 'unresolved-expr' ? (v.line == null ? `could not resolve · ${v.msg}` : `line ${v.line} · could not resolve · ${v.msg}`)
                : v.kind === 'travel-extent' ? `the whole program · needs ${fmt(v.needed)} mm of ${v.axis} travel, the machine has ${fmt(v.span)} mm`
                : v.kind === 'no-spindle' ? `line ${v.line} · cuts with the spindle OFF (no M3)` : v.kind === 'through-stock' ? `line ${v.line} · crosses the stock` : v.kind === 'soft-limit' ? `line ${v.line} · ${v.axis} · ${fmt(v.overshoot)} mm over${res.softLimitsEnforced === false ? ' · UNGUARDED — the machine will NOT stop' : ''}` : `line ${v.line} · ${v.axis} · ${fmt(v.overshoot)} mm over`;
            if (v.line != null) {
                li.title = 'Jump to this line';
                li.addEventListener('click', () => { if (_mgr && _mgr.revealLine) _mgr.revealLine(v.line); pop.hidden = true; });
            }
            ul.appendChild(li);
        }
        pop.appendChild(ul);
    }
    for (const note of [probeNote(res), softLimitNote(res)]) {
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
    const notes = [probeNote(res), softLimitNote(res)].filter(Boolean).join('\n');   // caveats ride the annotation title (no chip in RED)
    const byLine = new Map();   // a line can breach multiple edges → one annotation listing them
    // t1323 — a whole-program violation (travel-extent: no anchor, so no guilty line) has no row to annotate; it is stated
    // ONCE in the popover instead. Annotating it on line 1 would be the same cry-wolf in a smaller font.
    for (const v of res.violations) { if (v.line == null) continue; if (!byLine.has(v.line)) byLine.set(v.line, []); byLine.get(v.line).push(v); }
    for (const [line, vs] of byLine) {
        const span = overlay.querySelector(`.g-line[data-line-index="${line - 1}"]`);   // violation `line` is 1-based; data-line-index is 0-based
        if (!span) continue;
        const a = document.createElement('span');
        a.className = 'preflight-annot';
        // t1568 — an unresolved expression has no axis/overshoot (that is the whole point: the number never existed),
        // so it needs its own branch or it would render as "undefined NaNmm over" on a red program that also has one.
        const parts = vs.map((v) => v.kind === 'unresolved-expr' ? 'could not resolve' : v.kind === 'no-spindle' ? 'spindle OFF · no M3' : v.kind === 'through-stock' ? 'crosses the stock' : `${v.axis} ${fmt(v.overshoot)}mm over`);
        // t973 — the UNGUARDED escalation rides the line ONCE (a line can breach two edges; don't repeat it per-edge).
        const unguarded = res.softLimitsEnforced === false && vs.some((v) => v.kind === 'soft-limit');
        a.textContent = parts.join(' · ') + (unguarded ? ' · UNGUARDED' : '');
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
    // t1568 — SECOND CONTRIBUTOR, same surface. An unresolvable expression means a coordinate never became a
    // number, so the envelope check on that line was never actually performed — which is precisely what amber
    // ("can't verify") declares. It can only RAISE green → amber; a red verdict is a stronger claim that stands
    // on its own and keeps its per-line annotations. Contributes nothing when the block→line map is stale.
    const exprViol = blockLintViolations();
    if (exprViol.length) {
        res = { ...res, violations: [...res.violations, ...exprViol] };
        // The reason states the CLASS; the rows below carry the detail (which identifier, which line). Repeating the
        // message here read as the same sentence twice in the popover when there was only one.
        const mine = exprViol.length === 1
            ? 'an expression did not resolve, so that move’s position could not be checked'
            : `${exprViol.length} expressions did not resolve, so those moves’ positions could not be checked`;
        if (res.status === 'green') { res.status = 'amber'; res.reason = mine; }
        // Already amber for its own reason (no envelope, no WCS table) — say BOTH. Our sentence must not be
        // swallowed just because something else got there first; they are independent reasons it cannot verify.
        else if (res.status === 'amber') res.reason = [res.reason, mine].filter(Boolean).join(' · ');
        // RED stands on its own: "outside the envelope" is a stronger, separately-earned claim. The rows are still
        // appended above so the unresolved expression is visible, but it never softens or re-colours a red verdict.
    }
    lastResult = res;
    if (res.status === 'red') {
        // RED — the per-line inline annotations ARE the diagnostic (one per bad line), so normally no chip.
        renderAnnotations(res);
        // t1323 — EXCEPT a whole-program breach (a relative walk WIDER than the travel): it has no line to annotate, and a
        // red verdict that draws nothing is worse than the cry-wolf it replaced. It gets the chip it has no other home for.
        const wholeProgram = res.violations.some((v) => v.line == null);
        badge.hidden = !wholeProgram; pop.hidden = true;
        if (wholeProgram) {
            badge.className = 'preflight-badge preflight-red';
            label.textContent = '⚠ needs more travel than the machine has';
            label.title = res.violations.filter((v) => v.line == null).map((v) => `${v.axis}: needs ${fmt(v.needed)} mm, the machine has ${fmt(v.span)} mm`).join('\n');
            renderPop(res);
        }
    } else if (res.status === 'amber') {
        // AMBER (can't verify) — keep a SMALL chip (there are no lines to annotate); the popover carries the reason.
        renderAnnotations(null);
        badge.hidden = false; badge.className = 'preflight-badge preflight-amber';
        label.textContent = '⚠ can’t verify';
        label.title = [res.reason, probeNote(res), softLimitNote()].filter(Boolean).join('\n\n');
        renderPop(res);
    } else {
        // GREEN — silence, with ONE exception (t1323): a jog-start program fits, but only from a start the operator
        // chooses, so the useful thing to say is how much room to leave. A quiet neutral chip, one sentence, no alarm
        // colour — it is information, not a warning, and an anchored program still says nothing at all.
        renderAnnotations(null);
        const note = clearanceNote(res);
        pop.hidden = true;
        badge.hidden = !note;
        if (note) {
            badge.className = 'preflight-badge preflight-info';
            const e = res.extent;
            label.textContent = `↔ needs ${fmt(e.x)} × ${fmt(e.y)} × ${fmt(e.z)} mm`;
            label.title = note;
            renderPop({ ...res, violations: [] });
            pop.insertBefore(Object.assign(document.createElement('div'), { className: 'preflight-pop-note', textContent: note }), pop.firstChild.nextSibling);
        }
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
