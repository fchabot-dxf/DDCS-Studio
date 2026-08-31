/**
 * blocks/blockCanvasFind.js — t2435 (BACKLOG #44, owner-approved "4 yes"): find a block ALREADY ON the Blocks
 * canvas. The palette search (blocksApp.js's own `.blk-search`) filters what you can ADD from the toolbox;
 * nothing searches the ~98 blocks a corner stack already has. Same request, one tab over, from the same owner
 * who asked for the editor's own find bar (t2383, ui/editorFind.js).
 *
 * SAME CONTRACT as the editor's find bar, so the two feel identical: live n-of-m count, Enter/Shift+Enter or
 * the ▲/▼ buttons cycle matches, Esc closes, case-insensitive. SEARCH ONLY — no replace, the same reason the
 * editor's own bar has none (a separate feature with its own overwrite hazards). The match-cycling shape
 * (`cycleIndex`/`formatCount`) is shared with editorFind.js via findBarCore.js; the actual MATCHING logic is
 * NOT shared — the editor searches character offsets in a textarea, this searches Blockly block/field objects,
 * different enough that sharing would mean an editor-specific abstraction leaking into the canvas or vice
 * versa. What carries over instead: the UI contract above, and the PAN+GLOW reveal already proven live by
 * `blocksApp.js`'s own FORM → BLOCK gesture (t2397) — reused verbatim via the `panAndGlow` callback this
 * module is handed, not rediscovered.
 *
 * A MATCH IS A BLOCK, not a text range (the real difference from the editor): a hit pans the canvas to it and
 * glows it, rather than selecting a range. Matched against every field's own RENDERED TEXT
 * (`Field.prototype.getText()` — Blockly's own public method, uniform across every field kind: a caption like
 * "depth", a typed value like "18000"/"#100", a dropdown's own displayed option like "cw") plus the block's own
 * `type` as a fallback so a fieldless wrapper block can still be found by name. Generous on purpose, per the
 * dispatch's own instruction — a param NAME, a variable, and a literal must all hit, because that's what
 * someone is actually looking for.
 *
 * EDGE CASES, decided with the file in hand rather than guessed:
 *  - A COLLAPSED block matching only on a field hidden inside it: EXPANDED before panning/glowing — a glow on
 *    a collapsed summary that hides the very field that matched would show the user nothing useful. Uses
 *    Blockly's own `setCollapsed(false)`, the native un-collapse.
 *  - A block inside a COLLAPSED PARENT (a container/mouth block): `getAllBlocks(false)` already returns every
 *    block regardless of the parent's own collapsed state (confirmed live — Blockly's own tree walk doesn't
 *    prune on collapse), so it is found; if its own IMMEDIATE ancestor chain includes a collapsed block, that
 *    ancestor is expanded too (the same reasoning as the collapsed-match case: panning to a block still hidden
 *    inside a collapsed parent would show nothing).
 *  - Off-canvas at high zoom: `ws.centerOnBlock(id)` PANS to it (Blockly's own built-in) — no zoom-to-fit is
 *    added; centering alone is what the existing t2397 reveal already relies on and nothing in verification
 *    showed it insufficient.
 *  - Zero matches: the count reads "0/0" (matching the editor's own convention) and the input gets a visible
 *    `.no-match` state — never a silent no-op.
 */
import { cycleIndex, formatCount } from '../ui/findBarCore.js';

/** Every block whose own type, or any field's own rendered text, contains `query` (case-insensitive). Field
 *  text comes from `field.getText()` — the SAME text Blockly itself paints on the canvas, so a match is
 *  guaranteed visible once panned to (not a raw stored value the field renders differently, e.g. a dropdown's
 *  code vs its label). */
function computeBlockMatches(ws, query) {
    if (!query) return [];
    const q = query.toLowerCase();
    const hit = (blk) => {
        if (String(blk.type || '').toLowerCase().includes(q)) return true;
        for (const input of blk.inputList || []) {
            for (const field of input.fieldRow || []) {
                try { if (String(field.getText() || '').toLowerCase().includes(q)) return true; } catch (_) { /* a field mid-teardown — skip it, not fatal */ }
            }
        }
        return false;
    };
    return ws.getAllBlocks(false).filter(hit);
}

/** Expand `blk` and every collapsed ancestor above it, so panning to it actually shows the matched field. */
function expandForReveal(blk) {
    let b = blk;
    while (b) {
        try { if (b.isCollapsed && b.isCollapsed()) b.setCollapsed(false); } catch (_) { /* best-effort */ }
        b = (b.getSurroundParent && b.getSurroundParent()) || null;
    }
}

/** Mount the find bar into `container` (the Blockly canvas host — `position:relative`, so this overlays it the
 *  same way the editor's own find bar overlays the code area). `panAndGlow(blk)` is blocksApp.js's own reveal
 *  primitive (t2397), passed in rather than reimplemented — this module never touches `style.filter` itself.
 *  Idempotent — safe to call again after a re-render, same convention as `installEditorFind`. */
export function installBlockCanvasFind(ws, container, panAndGlow) {
    if (!ws || !container) return;
    if (container.dataset.findWired === '1') return;
    container.dataset.findWired = '1';

    const chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'blk-find-chip'; chip.title = 'Find on canvas'; chip.setAttribute('aria-label', 'Find on canvas');
    chip.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

    const bar = document.createElement('div');
    bar.className = 'blk-findbar hidden'; bar.setAttribute('role', 'search'); bar.setAttribute('aria-label', 'Find on canvas');
    const input = document.createElement('input');
    input.type = 'text'; input.className = 'blk-find-input'; input.placeholder = 'Find on canvas…';
    input.setAttribute('aria-label', 'Find text on canvas'); input.autocomplete = 'off'; input.autocapitalize = 'off'; input.spellcheck = false;
    const countEl = document.createElement('span'); countEl.className = 'blk-find-count'; countEl.textContent = '0/0';
    const btnPrev = document.createElement('button'); btnPrev.type = 'button'; btnPrev.className = 'toolbar-btn blk-find-nav'; btnPrev.title = 'Previous match (Shift+Enter)'; btnPrev.setAttribute('aria-label', 'Previous match');
    btnPrev.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>';
    const btnNext = document.createElement('button'); btnNext.type = 'button'; btnNext.className = 'toolbar-btn blk-find-nav'; btnNext.title = 'Next match (Enter)'; btnNext.setAttribute('aria-label', 'Next match');
    btnNext.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
    const btnClose = document.createElement('button'); btnClose.type = 'button'; btnClose.className = 'toolbar-btn blk-find-close'; btnClose.title = 'Close (Esc)'; btnClose.setAttribute('aria-label', 'Close find bar'); btnClose.textContent = '✕';
    bar.append(input, countEl, btnPrev, btnNext, btnClose);
    container.append(chip, bar);

    let matches = [];
    let current = -1;

    function renderCount() {
        countEl.textContent = formatCount(current, matches.length);
        input.classList.toggle('no-match', !!input.value && matches.length === 0);
    }

    function refresh() {
        matches = computeBlockMatches(ws, input.value.trim());
        if (current >= matches.length) current = matches.length - 1;
        if (matches.length && current < 0) current = 0;
        renderCount();
    }

    function goTo(idx) {
        if (!matches.length) return;
        current = cycleIndex(0, idx, matches.length);
        const blk = matches[current];
        expandForReveal(blk);
        // `panAndGlow` already calls `ws.centerOnBlock` — no need to call it here too (it did, once; harmless
        // redundancy, removed while chasing a real mis-centering bug below that turned out to be elsewhere).
        // `panAndGlow` is the ONE place that pans now; only fall back to a direct call if it's ever absent.
        if (panAndGlow) panAndGlow(blk);
        else { try { ws.centerOnBlock(blk.id); } catch (_) { /* best-effort pan */ } }
        renderCount();
    }

    function open() {
        bar.classList.remove('hidden');
        chip.classList.add('active');
        // t2435 amendment — kept as a harmless, strictly-safer default; per t2437 it was NOT the real bug
        // (the editor's own equivalent case turned out to be the 60px keyboard pin, not a scroll fight).
        input.focus({ preventScroll: true }); input.select();
        // t2437 — the SAME "give the canvas real room while a find bar needs to be read" signal as
        // editorFind.js's own `open()`; styles.css pins `.blk-bk-host` under this class + `keyboard-active`
        // the same way it already pins `.editor-container` for the editor.
        document.body.classList.add('ddcs-find-open');
        refresh();
        if (matches.length) goTo(current < 0 ? 0 : current);
    }

    function close() {
        bar.classList.add('hidden');
        document.body.classList.remove('ddcs-find-open');
        chip.classList.remove('active');
        current = -1; matches = [];
    }

    input.addEventListener('input', () => { refresh(); if (matches.length) goTo(current < 0 ? 0 : current); });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); goTo(current + (e.shiftKey ? -1 : 1)); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
        // ⛔ SEARCH ONLY — every other key (including ones that would edit a Blockly field) stays exactly what
        // it already is: normal text input inside THIS input element, never reaching any block. Nothing here
        // forwards a keystroke to Blockly; the input has no relationship to a block field at all.
    });
    btnPrev.addEventListener('click', () => goTo(current - 1));
    btnNext.addEventListener('click', () => goTo(current + 1));
    btnClose.addEventListener('click', close);
    chip.addEventListener('click', () => (bar.classList.contains('hidden') ? open() : close()));
}
