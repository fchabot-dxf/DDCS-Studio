/**
 * ui/editorFind.js — t2383, owner-requested: a find bar for the G-code editor. The editor is a plain
 * TEXTAREA (editorManager.js), so the browser's own Ctrl+F can never see its content — a long program is
 * unsearchable, full stop. Ctrl+F (desktop) or the toolbar button (touch — the owner is a heavy phone user)
 * opens a small bar: live match count (n of m), Enter/Shift+Enter or the ▲/▼ buttons cycle matches, Esc
 * closes. Each match scrolls into view and is selected in the real textarea (native `setSelectionRange`,
 * the same "select + scroll" shape `revealLine`/`_scrollToLine` in editorManager.js already use for a
 * violation-row jump — reused here, not reinvented).
 *
 * SEARCH ONLY, per the dispatch — no replace (a separate feature with its own overwrite hazards). Case-
 * insensitive by default (no toggle this turn — nothing else asked for).
 */
import { cycleIndex, formatCount } from './findBarCore.js';   // t2435 — the match-cycling shape shared with the Blocks-canvas find bar

const editorEl = () => document.getElementById('editor');

/** Every occurrence of `query` in `text`, case-insensitive, as { start, end } char offsets. */
function computeMatches(text, query) {
    if (!query) return [];
    const hay = text.toLowerCase();
    const needle = query.toLowerCase();
    const out = [];
    let i = 0;
    while (true) {
        const idx = hay.indexOf(needle, i);
        if (idx === -1) break;
        out.push({ start: idx, end: idx + needle.length });
        i = idx + needle.length;   // non-overlapping — matches editors' own conventional "find next" behavior
    }
    return out;
}

/** Wire the find bar's entry points (Ctrl+F, the toolbar button, the bar's own controls). Idempotent — safe
 *  to call again after a re-render, same convention as installEditorTextOps(). */
export function installEditorFind() {
    const ed = editorEl();
    const bar = document.getElementById('editor-findbar');
    const input = document.getElementById('editor-find-input');
    const countEl = document.getElementById('editor-find-count');
    const btnPrev = document.getElementById('editor-find-prev');
    const btnNext = document.getElementById('editor-find-next');
    const btnClose = document.getElementById('editor-find-close');
    const btnOpen = document.getElementById('editor-find-btn');
    if (!ed || !bar || !input || !countEl || !btnPrev || !btnNext || !btnClose) return;
    if (ed.dataset.findWired === '1') return;
    ed.dataset.findWired = '1';

    let matches = [];
    let current = -1;

    function renderCount() {
        countEl.textContent = formatCount(current, matches.length);
    }

    function refresh() {
        matches = computeMatches(ed.value, input.value);
        if (current >= matches.length) current = matches.length - 1;
        if (matches.length && current < 0) current = 0;
        input.classList.toggle('no-match', !!input.value && matches.length === 0);
        renderCount();
    }

    // The SAME line-height math editorManager.js's own _scrollToLine uses, so a match centers the view the
    // same way a revealed violation-row line already does — one convention, not a second one invented here.
    function scrollToOffset(charOffset) {
        const before = ed.value.slice(0, charOffset);
        const lineIndex = before.split('\n').length - 1;
        const cs = getComputedStyle(ed);
        let lineHeight = parseFloat(cs.lineHeight);
        if (Number.isNaN(lineHeight) || lineHeight <= 0) lineHeight = parseFloat(cs.fontSize) * 1.6 || 22;
        const target = Math.max(0, Math.round(lineIndex * lineHeight - ed.clientHeight / 2));
        ed.scrollTop = target;
    }

    function goTo(idx) {
        if (!matches.length) return;
        current = cycleIndex(0, idx, matches.length);   // idx already carries the target index (not a delta) at every call site — cycleIndex(0, idx, n) wraps it the same way the old modulo did
        const m = matches[current];
        ed.focus();   // #editor carries inputmode="none" (suppresses the OS keyboard) — focusing it is safe/expected here, the same as editorAutocomplete.js's own insert-then-focus
        ed.setSelectionRange(m.start, m.end);
        scrollToOffset(m.start);
        renderCount();
    }

    function open() {
        bar.classList.remove('hidden');
        if (btnOpen) btnOpen.classList.add('active');
        const selected = ed.value.slice(ed.selectionStart, ed.selectionEnd);
        if (selected && !selected.includes('\n')) input.value = selected;   // seed from a real selection, not a multi-line one
        // t2435 amendment (owner-corrected, real device + screenshots): the LEAD wasn't the keyboard's own
        // resize, it's the browser's own default "scroll the newly-focused element into view" behaviour —
        // the owner's own two screenshots show the WHOLE PAGE shifted (the bar moved from below the wizard-
        // button row to above it) the moment the input took focus, not just a shrunk viewport. `preventScroll`
        // stops the browser from doing that scroll itself; OUR OWN reveal logic (scrollToOffset below) is
        // what should be moving the view, not an uncontrolled browser default fighting it.
        input.focus({ preventScroll: true });
        input.select();
        refresh();
        if (matches.length) goTo(current < 0 ? 0 : current);
    }

    function close() {
        bar.classList.add('hidden');
        if (btnOpen) btnOpen.classList.remove('active');
        current = -1;
        matches = [];
    }

    input.addEventListener('input', () => { refresh(); if (matches.length) goTo(current < 0 ? 0 : current); });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); goTo(current + (e.shiftKey ? -1 : 1)); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    btnPrev.addEventListener('click', () => goTo(current - 1));
    btnNext.addEventListener('click', () => goTo(current + 1));
    btnClose.addEventListener('click', close);
    if (btnOpen) btnOpen.addEventListener('click', () => (bar.classList.contains('hidden') ? open() : close()));

    // Ctrl+F — kept to the editor pane: only handled when the editor is actually visible (not a different
    // app view, e.g. Blocks) and focus isn't inside some OTHER input/textarea/select/contenteditable (a
    // wizard field, Settings, …), so this never steals the shortcut from an unrelated text field elsewhere.
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() !== 'f' || !(e.ctrlKey || e.metaKey)) return;
        if (ed.offsetParent === null) return;   // the editor pane isn't on screen right now
        const t = e.target;
        const inOtherField = !!t && t !== ed && t !== input && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || t.isContentEditable);
        if (inOtherField) return;
        e.preventDefault();
        open();
    });

    // Esc also closes when focus is in the editor itself (not just the find input).
    ed.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !bar.classList.contains('hidden')) { e.preventDefault(); close(); }
    });
}
