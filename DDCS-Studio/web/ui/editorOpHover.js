/**
 * ui/editorOpHover.js — the PERSISTENT op-chip row (icon-only, one per top-level op, always visible in
 * `.editor-strip`) + the editor's own right-click op/text menus + the rotation badge + the "edited in Blocks"
 * word-glow.
 *
 * t-opchips — RULING 1 (human, verbatim): "we dont need the hover for these chips and that they can be always
 * visible in the top row." The single FLOATING "✎ Edit" chip that used to appear on mousemove-over-a-line and
 * vanish on mouseleave is RETIRED — every op gets its own small icon chip, always shown, in program order,
 * in the strip (not line-anchored inside the code area any more). Along with it: the AUTO hand-built-run
 * floating chip (the "group this loose run with one click" convenience) is also retired — grouping a loose run
 * is still reachable, unaffected, via the existing right-click "Group" menu below (showGroupMenu), which never
 * depended on the floating chip.
 *
 * Uses the program model's line→op map (window.ddcsLinesForOp) to drive the hover highlight FROM the chip now,
 * and the declared op enumeration (programModel.flattenOps) to build the row. Right-click on the CODE ITSELF
 * (not a chip) still opens the same per-op menu via window.ddcsOpAtLine — that gesture was never hover-based
 * and this ruling doesn't touch it.
 */
import { showOpMenu, showGroupMenu, hideOpMenu, openMenu, attachLongPress } from './opContextMenu.js';
import { commentMenuItems, installEditorTextOps } from './editorTextOps.js';   // t1452 — the editor's comment toggle: one implementation, three doors
import { onChange, flattenOps } from '../blocks/programModel.js';   // t736 — refresh the rotation badge on every program change; t-opchips — the ONE declared top-level-op enumeration (t1928)
import { programRotation } from '../wizards/ops/transform.js';   // t736 — the DECLARED program rotation
import { editorCodeHost, editorStripHost } from './uiUtils.js';   // t2155 — the rotation badge is a CODE-area tenant; t-opchips — the chip row is a STRIP tenant
import { entryForOpType } from '../blocks/wizardLibrary.js';   // t-opchips — opType -> the bar/Settings-resolved entry (label/icon/iconOverride)
import { entryIconHtml } from './wizIcons.js';   // t-opchips — THE shared icon resolver (header buttons + Settings picker read the same one)
import { secondsForLines, fmtDuration } from '../engine/timeEstimate.js';   // t844 — the per-op run-time, folded into the tooltip now (ruling 3's own "label -> tooltip" pattern, extended to the time this chip used to show as text)

const r3 = (n) => { const v = Math.round(n * 1000) / 1000; return Object.is(v, -0) ? 0 : v; };
// t844 — the op's estimated run time from the cached program estimate (window.ddcsTimeEstimate), summed over its lines.
function opTimeLabel(lines) {
    try { const est = window.ddcsTimeEstimate && window.ddcsTimeEstimate(); if (!est || !est.perLine) return ''; const s = secondsForLines(est.perLine, lines); return s > 0 ? '  ·  ≈ ' + fmtDuration(s) : ''; } catch (_) { return ''; }
}

export function initEditorOpHover() {
    const editor = document.getElementById('editor');
    const overlay = document.getElementById('editor-highlight');
    const host = editorCodeHost();     // t2155 — the rotation badge is a CODE-area tenant
    const stripHost = editorStripHost();   // t-opchips — the op-chip row is a STRIP tenant, alongside the badge/toolbar
    if (!editor || !overlay || !host || !stripHost) return;

    // t-opchips — THE PERSISTENT OP-CHIP ROW. `.op-chip-row` is its own horizontally-scrolling strip tenant
    // (RULING 2: same row, scrolls sideways — own-row and wrap were both shown as mockups and rejected), so a
    // 20-op program still leaves the STRIP itself one row tall (styles.css owns the scroll mechanics).
    const chipRow = document.createElement('div');
    chipRow.className = 'op-chip-row';
    chipRow.setAttribute('role', 'toolbar');
    chipRow.setAttribute('aria-label', 'Program operations');
    stripHost.appendChild(chipRow);

    let currentOps = [];   // the last-rendered flattenOps() result — contextmenu/long-press resolve against THIS, not a re-derive
    const clearRowHi = () => overlay.querySelectorAll('.g-line.op-hover').forEach((s) => s.classList.remove('op-hover'));
    const highlightOp = (opId) => {
        clearRowHi();
        const lines = (window.ddcsLinesForOp && window.ddcsLinesForOp(opId)) || [];
        lines.forEach((j) => { const s = overlay.querySelector(`.g-line[data-line-index="${j}"]`); if (s) s.classList.add('op-hover'); });
    };

    // t-opchips RULING 3 (human, verbatim): "it should also reuse the wizard icon it has" + "so no label just the
    // icon, and tooltips with label" — entryForOpType resolves the SAME entry the bar/Settings picker read
    // (wizardLibrary.js), so a user iconOverride reaches the chip with zero extra code; entryIconHtml is the ONE
    // resolver — no per-op-type glyph map here or anywhere else.
    function renderOpChips() {
        const program = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
        currentOps = flattenOps(program);   // t1928 — the ONE declared top-level-op enumeration; a group's own children are its G-code body, not sibling ops (unchanged nested-op scope, see WORK-LOG)
        chipRow.innerHTML = '';
        for (const op of currentOps) {
            if (!op || op.id == null) continue;
            const entry = entryForOpType(op.opType);
            const label = op.label || (entry && entry.label) || op.opType || 'operation';
            const lines = (window.ddcsLinesForOp && window.ddcsLinesForOp(op.id)) || [];
            const tooltip = label + opTimeLabel(lines);   // t844 — the per-op run-time, folded in (was the chip's own visible text; ruling 3 moved the label to the tooltip, so the time rides with it)
            const editable = !window.ddcsCanEditOp || window.ddcsCanEditOp(op.opType);
            const btn = document.createElement('button');
            btn.type = 'button'; btn.className = 'op-chip'; btn.dataset.opId = op.id;
            btn.title = tooltip; btn.setAttribute('aria-label', label);   // RULING 3 — icon only; the label (+ time) lives in the tooltip (desktop) and the op menu (touch, ruling 4). aria-label stays the plain label — a screen reader doesn't need the run-time estimate to identify the control.
            btn.innerHTML = (entry && entryIconHtml(entry)) || '⚙';   // a generic fallback for an opType with no bar identity (e.g. a hand-built `group`)
            btn.disabled = !editable;
            if (!editable) btn.title = `${label}: form-edit not wired yet`;
            btn.addEventListener('mouseenter', () => highlightOp(op.id));
            btn.addEventListener('mouseleave', clearRowHi);
            btn.addEventListener('click', () => { if (editable && window.ddcsEditOp) window.ddcsEditOp(op.id); });
            chipRow.appendChild(btn);
        }
    }
    onChange(() => renderOpChips());
    renderOpChips();

    // t-opchips RULING 4: right-click AND long-press open the op's context menu — the SAME editorOpHover.js:
    // contextmenu -> showOpMenu path this file already proved for right-click-on-the-CODE (below), plus
    // attachLongPress (opContextMenu.js), which SYNTHESIZES a real contextmenu event on touch so this is the
    // ONLY handler either input mode goes through — no separate touch branch, per that module's own comment.
    // Wired ONCE on the ROW (not per chip), matching how attachLongPress(editor) already works below: the
    // synthesized/native event's own `target` names which chip was pressed.
    chipRow.addEventListener('contextmenu', (e) => {
        const chipEl = e.target.closest && e.target.closest('.op-chip');
        if (!chipEl) return;
        e.preventDefault();
        const op = currentOps.find((o) => o && String(o.id) === chipEl.dataset.opId);
        if (op) showOpMenu(op, e.clientX, e.clientY);
    });
    attachLongPress(chipRow);

    // t736 — the PROGRAM ROTATION badge: a program-level pill beside the ⟳ Transform button showing the DECLARED xform
    // rotation ("⟳ 6.98°"). Click the label = reopen Transform prefilled; the ✕ = clear the declaration to 0 (the emit's
    // 0° fold makes that BYTE-IDENTICAL). Program-level (NOT on an op pill — the rotation is program-wide). Updated on
    // every program change (onChange) — apply / clear / a Blocks edit of angle/pivot all refresh it.
    const badge = document.createElement('div');
    badge.id = 'xform-badge'; badge.className = 'xform-badge'; badge.hidden = true;
    const badgeLabel = document.createElement('button');
    badgeLabel.type = 'button'; badgeLabel.className = 'xform-badge-label';
    badgeLabel.addEventListener('click', () => { if (typeof window.ddcsAlignRotate === 'function') window.ddcsAlignRotate(); });
    const badgeX = document.createElement('button');
    badgeX.type = 'button'; badgeX.className = 'xform-badge-x'; badgeX.textContent = '✕'; badgeX.title = 'Clear the program rotation (back to 0°)';
    badgeX.addEventListener('click', (e) => {
        e.stopPropagation();
        const stack = (typeof window.ddcsGetBlockProgram === 'function' && window.ddcsGetBlockProgram()) || [];
        const rest = stack.filter((b) => !(b && b.type === 'xform'));   // drop the declaration → the emit is byte-identical to pre-rotation
        if (typeof window.ddcsLoadBlockStack === 'function') window.ddcsLoadBlockStack(rest);
    });
    badge.appendChild(badgeLabel); badge.appendChild(badgeX);
    host.appendChild(badge);
    const updateBadge = () => {
        const rot = (typeof window.ddcsGetBlockProgram === 'function') ? programRotation(window.ddcsGetBlockProgram() || []) : { angle: 0, pivotX: 0, pivotY: 0 };
        if (!rot.angle) { badge.hidden = true; return; }
        badgeLabel.textContent = '⟳ ' + r3(rot.angle) + '°';
        badgeLabel.title = `Program rotated ${r3(rot.angle)}° about (${r3(rot.pivotX)}, ${r3(rot.pivotY)}) — click to adjust`;
        badge.hidden = false;
    };
    onChange(() => updateBadge());
    updateBadge();

    // t-opchips — lineHeight/padTop/lineAtY are still needed: right-click on the CODE ITSELF (not a chip) still
    // resolves which op/loose-run owns the clicked line, below. Only the floating hover-chip machinery that used
    // to live here (hoverOpId, its own clearHi/hide) is gone — clearRowHi (above) is the chip row's replacement.
    const lineHeight = () => {
        const cs = getComputedStyle(editor);
        const lh = parseFloat(cs.lineHeight);
        return (Number.isFinite(lh) && lh > 0) ? lh : ((parseFloat(cs.fontSize) || 14) * 1.6);
    };
    const padTop = () => parseFloat(getComputedStyle(editor).paddingTop) || 0;
    const lineAtY = (clientY) => Math.max(0, Math.floor((clientY - editor.getBoundingClientRect().top + editor.scrollTop - padTop()) / lineHeight()));

    // Wrap chars [start, end) of a .g-line in a <span class="word-edited"> (glow just the edited token). Walks the
    // line's text nodes — they concatenate to the rendered line text, so offsets map straight through the colour
    // spans formatGCode inserts. surroundContents covers the common case (token in one text node); the extract
    // fallback handles a range that crosses a colour-span boundary (e.g. an axis value next to its yellow letter).
    const wrapRange = (lineEl, start, end) => {
        const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
        let pos = 0, sNode = null, sOff = 0, eNode = null, eOff = 0, n;
        while ((n = walker.nextNode())) {
            const len = n.nodeValue.length;
            if (sNode === null && pos + len > start) { sNode = n; sOff = start - pos; }
            if (pos + len >= end) { eNode = n; eOff = end - pos; break; }
            pos += len;
        }
        if (!sNode || !eNode) return;
        const range = document.createRange();
        range.setStart(sNode, sOff); range.setEnd(eNode, eOff);
        const span = document.createElement('span'); span.className = 'word-edited';
        try { range.surroundContents(span); }
        catch (_) { span.appendChild(range.extractContents()); range.insertNode(span); }
    };

    // Persistent "edited in Blocks" glow: any op whose blocks diverge from its form params (isOpBlockEdited) gets
    // its SPECIFIC emitted editor lines marked — WORD-LEVEL where a value token was edited (editedRangesForOp),
    // whole-line for an injected atom. The detector lives in the lazy opGlow module. Wrapping word spans mutates
    // the overlay, so disconnect the observer around the mutation phase (else it re-fires on our own edits → loop).
    let obs = null;
    const glowEdited = () => {
        if (typeof window.ddcsOpBlockEdited !== 'function' || typeof window.ddcsGetBlockProgram !== 'function') return;
        if (obs) obs.disconnect();
        try {
            overlay.querySelectorAll('.g-line.op-block-edited').forEach((s) => s.classList.remove('op-block-edited'));
            overlay.querySelectorAll('span.word-edited').forEach((s) => s.replaceWith(...s.childNodes));   // unwrap stale
            overlay.normalize();                                                                          // merge split text nodes → clean offsets
            // t1988 — TWO DIFFERENT QUESTIONS, not one widened to cover both. `flattenOps` (t1928) answers "what
            // OPERATIONS does this program hold" — it treats a `multi_step` wrapper as transparent (its own steps
            // are the real operations) and every OTHER op as OPAQUE, correctly: a `group` op's own `.children` are
            // its G-code body, not a second operation sitting beside it — that is the same reason `flattenOps`
            // must NOT recurse into it, and why the setup sheet / time-estimate split are right to count it once.
            // This loop asks a DIFFERENT question — "which OP-RECORD, at ANY depth, owns this recorded edit" — and
            // a `group` op's own body can genuinely CONTAIN another independently-addressable op (t1986, live-
            // confirmed: ordinary Blocks-tab drag nests one `group` inside another; `opEdits.recordEdit` records
            // the change under the INNERMOST op's own id, per `blocksApp.js`'s own nearest-'op'-ancestor walk).
            // t1976's `flattenOps` loop never visited that inner id at all — not a gap in `flattenOps`'s own job,
            // a genuinely different enumeration this one needs. Rather than re-deriving the recursion (and its
            // `user_root`/`USER_OP_PREFIX` boundary, t1972 — an op nested in another's authoring body must stay
            // unaddressable here too, the same as it is for Edit), this sweeps every RENDERED line through the ONE
            // already-canonical per-line answer (`ddcsOpAtLine`, t1842→t1972) and collects the distinct owners —
            // the exact pattern `segmentFrame.js`'s own `frameSegments` already established for "ask every line,
            // don't re-derive the boundary a second time."
            const editableOps = new Map();
            overlay.querySelectorAll('.g-line[data-line-index]').forEach((s) => {
                const idx = Number(s.dataset.lineIndex);
                const op = Number.isFinite(idx) ? window.ddcsOpAtLine(idx) : null;
                if (op && op.id != null && !editableOps.has(op.id)) editableOps.set(op.id, op);
            });
            for (const op of editableOps.values()) {
                if (!op || !window.ddcsOpBlockEdited(op.id)) continue;
                const entries = window.ddcsEditedRangesForOp ? window.ddcsEditedRangesForOp(op.id)
                    : ((window.ddcsEditedLinesForOp ? window.ddcsEditedLinesForOp(op.id) : (window.ddcsLinesForOp && window.ddcsLinesForOp(op.id)) || []).map((line) => ({ line, range: null })));
                for (const { line, range } of entries) {
                    const s = overlay.querySelector(`.g-line[data-line-index="${line}"]`); if (!s) continue;
                    if (!range) s.classList.add('op-block-edited');       // injected / container edit → whole-line
                    else wrapRange(s, range[0], range[1]);                // value-edited token → just the word
                }
            }
        } finally {
            if (obs) obs.observe(overlay, { childList: true, subtree: true });
        }
    };
    window.ddcsRefreshBlockGlow = glowEdited;
    obs = new MutationObserver(glowEdited);
    obs.observe(overlay, { childList: true, subtree: true });
    import('../blocks/opGlow.js').then((m) => {
        window.ddcsOpBlockEdited = m.isOpBlockEdited;
        window.ddcsEditedLinesForOp = m.editedLinesForOp;
        window.ddcsEditedRangesForOp = m.editedRangesForOp;
        glowEdited();
    }).catch(() => { /* detector optional */ });

    // Right-click an op → shared context menu (✎ Edit / ⧉ Duplicate / 🗑 Delete). Over a LOOSE hand-built run
    // (no op wrapper → ddcsOpAtLine null) → the in-context "Group" menu instead: wrap that contiguous run in one
    // `group` op so it becomes editable (the headline feature; each loose run groups independently).
    editor.addEventListener('contextmenu', (e) => {
        const line = lineAtY(e.clientY);
        const op = (typeof window.ddcsOpAtLine === 'function') ? window.ddcsOpAtLine(line) : null;
        if (op) {
            e.preventDefault();
            clearRowHi();                                  // don't leave a stale chip-row highlight lit under the menu
            showOpMenu(op, e.clientX, e.clientY);
            return;
        }
        const run = (typeof window.ddcsLooseRunAtLine === 'function') ? window.ddcsLooseRunAtLine(line) : null;
        if (run && run.length) {
            e.preventDefault();
            clearRowHi();
            showGroupMenu(run, e.clientX, e.clientY);
            return;
        }
        /**
         * t1450 — PLAIN TEXT: the comment/uncomment entry. This is the branch that used to `return` and leave the
         * native menu, and it is the only place the entry can live without displacing something: over an OP the
         * op actions are what the user came for, and over a loose run it is Group.
         *
         * The rule the next act's menu pass states is already honoured here — an entry only shortcuts an action that
         * exists somewhere visible. This is a toolbar button AND Ctrl+/; the menu is the third door to one
         * implementation, never its only door. t2139 — indent/outdent's own two entries retired with the feature.
         */
        e.preventDefault();
        openMenu(commentMenuItems(), e.clientX, e.clientY);
    });
    editor.addEventListener('scroll', hideOpMenu);
    installEditorTextOps();   // t1452 — Ctrl+/ + the toolbar button (idempotent; the menu path is above)
    // t1452 — LONG-PRESS = right-click. The user tests on a phone, where there is no right button, so without
    // this the editor menu simply does not exist on the surface it is most needed. It synthesises a real
    // `contextmenu` event, so the ONE handler above serves both inputs and they can never drift apart.
    attachLongPress(editor);
}
