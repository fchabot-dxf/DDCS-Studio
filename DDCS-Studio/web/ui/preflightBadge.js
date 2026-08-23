// PRE-FLIGHT ENVELOPE BADGE (t838) — the editor face of the pre-flight check (the safety story's third layer: warn BEFORE
// motion). A small badge in the editor: GREEN "fits envelope" / AMBER "can't verify (why)" / RED "N outside envelope".
// Click → the violation list; a row-click jumps the editor to that line. Follows the xform-badge precedent
// (editorOpHover.js) and subscribes to the ONE program-change hook (programModel.onChange), plus editor input +
// settings-changed so it re-checks on every program/envelope entry point.

import { onChange } from '../blocks/programModel.js';
import { checkEnvelope } from '../engine/envelopeCheck.js';
import { blockLintViolations } from './preflightBlockLint.js';   // t1568 — the BLOCK-side contributor to this same surface
import { editorStripHost } from './uiUtils.js';   // t2155 — the badge is a STRIP tenant, not a code-area one

let _mgr = null;
let badge = null, label = null, pop = null;
let iconEl = null, textEl = null;
let lastResult = null;
// t2176 amendment 4B — DECLARED, not inferred from the popover's own DOM: does this verdict have detail beyond
// what the label already says? Amber (the reason it can't verify) and a whole-program red (the per-axis
// numbers) do; the relative-anchor info note does not — its popover only repeats the SAME "needs X × Y × Z"
// sentence already in the label. Set explicitly by render()'s own three branches, read by the click handler
// below to decide whether a click opens the popover or just toggles collapse.
let hasDetail = false;

// t2171 — COLLAPSE TO ICON. Dispatch: "make it collapse after 2 seconds, both green or red" (a shorthand for
// "whichever colour it's showing" — amber/info/red all collapse the same way, not just the two named). Three
// rules, all load-bearing (this chip is the ONLY travel check a jog-start/relative program gets, so it must
// never go silently unreadable):
//   1. collapsed is NOT hidden — the className (and so the background colour) stays on `badge` the whole time;
//      only the TEXT span disappears, the icon (and the colour behind it) survives at a glance.
//   2. a STATE CHANGE (new status/text — not just any render() call; typing that doesn't change the verdict must
//      not keep resetting the clock) re-expands and restarts the timer.
//   3. never collapse while the popover is open, or while the pointer is over the badge.
// Rule 2 is MORE than the human literally asked for (2s collapse, both colours) — it's this turn's own call to
// make "re-check the same thing twice" not read as "it changed," and easy to overrule if it reads wrong live.
let collapseT = null, collapsed = false, hovering = false, lastLabelKey = null;
function cancelCollapse() { clearTimeout(collapseT); collapseT = null; }
function expandBadge() { collapsed = false; badge.classList.remove('collapsed'); cancelCollapse(); }
function scheduleCollapse() {
    cancelCollapse();
    if (hovering || !pop.hidden) return;   // rule 3 — guarded at arm time AND re-checked at fire time below
    collapseT = setTimeout(() => {
        if (hovering || !pop.hidden) return;   // state may have changed during the wait
        collapsed = true; badge.classList.add('collapsed');
    }, 2000);
}
// icon+text as separate persistent nodes (not one textContent string) — collapse hides ONLY the text span,
// so the icon (and the className driving the background colour) is unaffected by collapse state.
function setLabel(icon, text) { iconEl.textContent = icon; textEl.textContent = text; }
// t2176 amendment 2 — THE SECOND HALF of the fix (the key-strip alone wasn't enough). Each render() branch used
// to do a bare `badge.className = 'preflight-badge preflight-X'` — a full reassignment that WIPES whatever else
// was on the element, including 'collapsed', regardless of whether afterRender() below goes on to decide
// "nothing actually changed." So even a correctly-detected no-op render still visibly un-collapsed the badge, a
// SEPARATE bug from (but compounding) the className-in-the-key one. Routing every class assignment through this
// preserves 'collapsed' across a same-verdict re-render; a REAL state change still un-collapses it correctly,
// via expandBadge() in afterRender(), which removes the class explicitly right after this runs.
function setBadgeClass(semantic) { badge.className = semantic + (collapsed ? ' collapsed' : ''); }
// t2176 amendment 2 (human: "the needs dimension chip doesnt close after 2 second") — REGRESSION, root-caused
// (not guessed — confirmed by reading the loop, then locked with a test that fails without this fix): the key
// used to read `badge.className` DIRECTLY, and collapsing itself ADDS the 'collapsed' class to `badge` — so the
// NEXT render() (any of them: editor input, onChange, settings-changed — nothing has to actually change) saw a
// className that now differs from `lastLabelKey`, read that as "the verdict changed," and called expandBadge()
// + scheduleCollapse() again. The collapsed state was an input to the very detector deciding whether to leave
// it collapsed — a live version of the badge sat there re-expanding on every incidental re-render, which reads
// as "never actually collapses" exactly as reported. Fixed by excluding the collapse marker from the key: only
// the SEMANTIC class (which colour/verdict) plus the text drives "did this actually change."
const semanticClass = () => badge.className.replace(/\s*\bcollapsed\b\s*/, ' ').trim();
// rule 2 — re-expand + restart the timer, but ONLY on an actual state change (className+icon+text), not on
// every render() (typing that leaves the verdict unchanged must not keep resetting the clock).
function afterRender() {
    const visible = !badge.hidden;
    const key = visible ? `${semanticClass()}|${iconEl.textContent}|${textEl.textContent}` : null;
    if (key === lastLabelKey) return;
    lastLabelKey = key;
    if (visible) { expandBadge(); scheduleCollapse(); }
    else { cancelCollapse(); collapsed = false; badge.classList.remove('collapsed'); }
}

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
    if (!prog || !prog.trim()) { badge.hidden = true; pop.hidden = true; renderAnnotations(null); afterRender(); return; }
    let res;
    try { res = checkEnvelope(prog, settings()); } catch (_) { badge.hidden = true; renderAnnotations(null); afterRender(); return; }
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
            setBadgeClass('preflight-badge preflight-red');
            setLabel('⚠', ' needs more travel than the machine has');
            label.title = res.violations.filter((v) => v.line == null).map((v) => `${v.axis}: needs ${fmt(v.needed)} mm, the machine has ${fmt(v.span)} mm`).join('\n');
            renderPop(res);
            hasDetail = true;   // the per-axis needed/span numbers — not in the label
        }
    } else if (res.status === 'amber') {
        // AMBER (can't verify) — keep a SMALL chip (there are no lines to annotate); the popover carries the reason.
        renderAnnotations(null);
        badge.hidden = false; setBadgeClass('preflight-badge preflight-amber');
        setLabel('⚠', ' can’t verify');
        label.title = [res.reason, probeNote(res), softLimitNote()].filter(Boolean).join('\n\n');
        renderPop(res);
        hasDetail = true;   // the WHY — not in the label, which only says "can't verify"
    } else {
        // GREEN — silence, with ONE exception (t1323): a jog-start program fits, but only from a start the operator
        // chooses, so the useful thing to say is how much room to leave. A quiet neutral chip, one sentence, no alarm
        // colour — it is information, not a warning, and an anchored program still says nothing at all.
        renderAnnotations(null);
        const note = clearanceNote(res);
        pop.hidden = true;
        badge.hidden = !note;
        if (note) {
            setBadgeClass('preflight-badge preflight-info');
            const e = res.extent;
            setLabel('↔', ` needs ${fmt(e.x)} × ${fmt(e.y)} × ${fmt(e.z)} mm`);
            label.title = note;
            renderPop({ ...res, violations: [] });
            pop.insertBefore(Object.assign(document.createElement('div'), { className: 'preflight-pop-note', textContent: note }), pop.firstChild.nextSibling);
            // t2176 amendment 4B — NOT hasDetail: the popover here just repeats the SAME "needs X × Y × Z"
            // sentence the label already shows (line above) — nothing a click would newly reveal, which is why
            // the human's own ask ("click should collapse/uncollapse, simple") lands cleanly on THIS state.
            hasDetail = false;
        }
    }
    afterRender();
}

export function initPreflightBadge(mgr) {
    _mgr = mgr;
    const editor = document.getElementById('editor');
    const host = editorStripHost();   // t2155 — a STRIP tenant now, not editor.parentElement
    if (!editor || !host) return;

    badge = document.createElement('div'); badge.id = 'preflight-badge'; badge.className = 'preflight-badge'; badge.hidden = true;
    label = document.createElement('button'); label.type = 'button'; label.className = 'preflight-badge-label'; label.setAttribute('aria-label', 'Pre-flight envelope check');
    iconEl = document.createElement('span'); iconEl.className = 'preflight-badge-icon';
    textEl = document.createElement('span'); textEl.className = 'preflight-badge-text';
    label.appendChild(iconEl); label.appendChild(textEl);
    pop = document.createElement('div'); pop.className = 'preflight-pop'; pop.hidden = true;
    // t2176 amendment 4B (human: "clicking the need envellop chip should collapse uncollapse, simple") — ONE
    // rule, not three: a click REVEALS WHATEVER DETAIL EXISTS.
    //   1. collapsed → expand it. Always first — nothing else makes sense to do on a collapsed badge.
    //   2. expanded + hasDetail (amber/red — a popover with real content beyond the label) → toggle the popover,
    //      the existing behaviour.
    //   3. expanded + !hasDetail (the relative-anchor info note — its popover only repeats the label) → nothing
    //      to reveal, so the click just collapses it manually (not a 2s wait — a direct answer to a direct tap).
    label.addEventListener('click', () => {
        if (badge.hidden) return;
        if (collapsed) { expandBadge(); scheduleCollapse(); return; }
        if (hasDetail) {
            pop.hidden = !pop.hidden;
            // rule 3 — opening un-collapses (reading the popover with only the icon showing above it read oddly)
            // and pauses the timer for as long as it's open; closing resumes the normal 2s countdown.
            if (pop.hidden) scheduleCollapse(); else expandBadge();
            return;
        }
        collapsed = true; badge.classList.add('collapsed'); cancelCollapse();
    });
    // rule 3 — the pointer being over the badge (reading it, about to click it) pauses collapse the same way
    // an open popover does; it does not force-expand an ALREADY-collapsed icon (nothing to protect there — the
    // icon stays clickable either way), only stops it from collapsing mid-hover.
    // t2176 amendment 2's second candidate, CONFIRMED live: a touch tap synthesizes ONE mouseenter with no
    // matching mouseleave (the device has no pointer to "leave" with), which would pin `hovering` true forever
    // on first tap and permanently refuse to ever schedule a collapse again. Scoped to hover-CAPABLE devices
    // only (matchMedia) — on touch, "engaging with the badge" is the popover/collapsed-state click handling
    // above, not a hover concept that doesn't meaningfully exist there.
    const canHover = !!(window.matchMedia && window.matchMedia('(hover: hover)').matches);
    if (canHover) {
        badge.addEventListener('mouseenter', () => { hovering = true; cancelCollapse(); });
        badge.addEventListener('mouseleave', () => { hovering = false; if (pop.hidden) scheduleCollapse(); });
    }
    badge.appendChild(label); badge.appendChild(pop);
    host.insertBefore(badge, host.firstChild);   // ⭐ FIRST child, so it reads leftmost regardless of module init order (also backed by `order` in CSS)

    let inputT = null;
    const debounced = () => { clearTimeout(inputT); inputT = setTimeout(render, 250); };   // don't re-trace on every keystroke
    onChange(() => render());                                              // wizard insert / load / blocks / editor reconcile
    editor.addEventListener('input', debounced);                           // live typing (settles at 250ms)
    window.addEventListener('ddcs:settings-changed', () => render());      // envelope / WCS-table pull changes the frame
    render();

    window.ddcsPreflightCheck = () => lastResult;                          // test/debug hook — the last computed result
}
