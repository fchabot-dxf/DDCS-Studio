/**
 * ui/editorOpHover.js — hover an op in the editor → highlight its lines + a floating "✎ Edit" chip → click to
 * re-open that op's wizard for editing.
 *
 * Uses the program model's line→op map (window.ddcsOpAtLine / ddcsLinesForOp), which is only valid while the
 * editor still matches the live projection (the model guards that — hand-edited text returns no op). The op's
 * params are the single source of truth; ddcsEditOp seeds the wizard from them and replaceOp rebuilds the op.
 * The editor text is transparent over the #editor-highlight overlay, so the .op-hover class shows behind it.
 */
import { showOpMenu, showGroupMenu, hideOpMenu } from './opContextMenu.js';
import { onChange } from '../blocks/programModel.js';   // t736 — refresh the rotation badge on every program change
import { programRotation } from '../wizards/ops/transform.js';   // t736 — the DECLARED program rotation

const r3 = (n) => { const v = Math.round(n * 1000) / 1000; return Object.is(v, -0) ? 0 : v; };

export function initEditorOpHover() {
    const editor = document.getElementById('editor');
    const overlay = document.getElementById('editor-highlight');
    if (!editor || !overlay || !editor.parentElement) return;

    const chip = document.createElement('button');
    chip.id = 'op-edit-chip'; chip.className = 'op-edit-chip'; chip.type = 'button'; chip.hidden = true;
    editor.parentElement.appendChild(chip);

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
    editor.parentElement.appendChild(badge);
    const updateBadge = () => {
        const rot = (typeof window.ddcsGetBlockProgram === 'function') ? programRotation(window.ddcsGetBlockProgram() || []) : { angle: 0, pivotX: 0, pivotY: 0 };
        if (!rot.angle) { badge.hidden = true; return; }
        badgeLabel.textContent = '⟳ ' + r3(rot.angle) + '°';
        badgeLabel.title = `Program rotated ${r3(rot.angle)}° about (${r3(rot.pivotX)}, ${r3(rot.pivotY)}) — click to adjust`;
        badge.hidden = false;
    };
    onChange(() => updateBadge());
    updateBadge();

    let hoverOpId = null;
    const lineHeight = () => {
        const cs = getComputedStyle(editor);
        const lh = parseFloat(cs.lineHeight);
        return (Number.isFinite(lh) && lh > 0) ? lh : ((parseFloat(cs.fontSize) || 14) * 1.6);
    };
    const padTop = () => parseFloat(getComputedStyle(editor).paddingTop) || 0;
    const lineAtY = (clientY) => Math.max(0, Math.floor((clientY - editor.getBoundingClientRect().top + editor.scrollTop - padTop()) / lineHeight()));
    const clearHi = () => overlay.querySelectorAll('.g-line.op-hover').forEach((s) => s.classList.remove('op-hover'));
    const hide = () => { clearHi(); chip.hidden = true; hoverOpId = null; };

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
            for (const op of (window.ddcsGetBlockProgram() || [])) {
                if (!op || op.type !== 'op' || !window.ddcsOpBlockEdited(op.id)) continue;
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

    editor.addEventListener('mousemove', (e) => {
        if (typeof window.ddcsOpAtLine !== 'function') return;
        const line = lineAtY(e.clientY);
        const op = window.ddcsOpAtLine(line);
        if (!op) {
            // AUTO (advisor-gated): a PURE hand-built stack (whole program = one loose run, no real ops) auto-shows an
            // editable chip with NO gesture. No mutation on render — the chip just appears; clicking it WRAPS the run
            // in a group op (groupLooseAtoms) then opens the inc-2 form. A mixed program returns null here (the
            // right-click "Group" gesture owns those), so the auto-chip never shows over a mixed program.
            const run = (typeof window.ddcsAutoGroupRunAtLine === 'function') ? window.ddcsAutoGroupRunAtLine(line) : null;
            if (run && run.length) {
                if (hoverOpId === '__autorun__') return;        // already showing it → don't thrash
                hoverOpId = '__autorun__';
                clearHi();
                const lines = (window.ddcsLinesForRun && window.ddcsLinesForRun(run)) || [];
                lines.forEach((j) => { const s = overlay.querySelector(`.g-line[data-line-index="${j}"]`); if (s) s.classList.add('op-hover'); });
                const first = lines.length ? lines[0] : 0;
                chip.textContent = '✎ Hand-built';
                chip.disabled = false;
                chip.title = 'Edit this hand-built stack as a form';
                chip.style.top = Math.max(2, Math.round(first * lineHeight() + padTop() - editor.scrollTop)) + 'px';
                chip.dataset.opId = '';                          // no op yet — the wrap happens on click
                chip.dataset.autoRun = JSON.stringify(run);
                chip.hidden = false;
                return;
            }
            if (hoverOpId) hide();
            return;
        }
        if (op.id === hoverOpId) return;            // unchanged → don't thrash
        hoverOpId = op.id;
        clearHi();
        const lines = (window.ddcsLinesForOp && window.ddcsLinesForOp(op.id)) || [];
        lines.forEach((j) => { const s = overlay.querySelector(`.g-line[data-line-index="${j}"]`); if (s) s.classList.add('op-hover'); });
        const first = lines.length ? lines[0] : 0;
        const editable = !window.ddcsCanEditOp || window.ddcsCanEditOp(op.opType);
        chip.textContent = (editable ? '✎ ' : '🔒 ') + (op.label || op.opType);
        chip.disabled = !editable;
        chip.title = editable ? `Edit this ${op.label || op.opType}` : `${op.label || op.opType}: form-edit not wired yet`;
        chip.style.top = Math.max(2, Math.round(first * lineHeight() + padTop() - editor.scrollTop)) + 'px';
        // Chip floats on the LEFT of the editor (left: 12px in CSS) — clear of the right-side 3D preview
        // drawer / view-cube gizmo, so it's always reachable (the "out of reach" report).
        chip.dataset.opId = op.id;
        chip.dataset.autoRun = '';                  // a real op chip, not the auto-run chip
        chip.hidden = false;
    });
    // Keep the chip visible when the pointer moves onto it; hide otherwise.
    editor.addEventListener('mouseleave', () => setTimeout(() => { if (!chip.matches(':hover')) hide(); }, 60));
    chip.addEventListener('click', async () => {
        const id = chip.dataset.opId;
        let autoRun = null; try { autoRun = chip.dataset.autoRun ? JSON.parse(chip.dataset.autoRun) : null; } catch (_) { /* */ }
        hide();
        if (id && window.ddcsEditOp) { window.ddcsEditOp(id); return; }
        // AUTO: wrap the lone loose run into a group op (explicit on the edit click, not on render), then open its form.
        if (autoRun && autoRun.length) {
            try {
                const { groupLooseAtoms } = await import('../blocks/opSession.js');
                const gid = groupLooseAtoms('Hand-built', autoRun);
                if (gid && window.ddcsEditOp) window.ddcsEditOp(gid);
            } catch (_) { /* */ }
        }
    });
    editor.addEventListener('scroll', () => { if (!chip.hidden) hide(); });   // avoid drift; re-hover to show again

    // Right-click an op → shared context menu (✎ Edit / ⧉ Duplicate / 🗑 Delete). Over a LOOSE hand-built run
    // (no op wrapper → ddcsOpAtLine null) → the in-context "Group" menu instead: wrap that contiguous run in one
    // `group` op so it becomes editable (the headline feature; each loose run groups independently).
    editor.addEventListener('contextmenu', (e) => {
        if (typeof window.ddcsOpAtLine !== 'function') return;
        const line = lineAtY(e.clientY);
        const op = window.ddcsOpAtLine(line);
        if (op) {
            e.preventDefault();
            hide();                                        // drop the hover chip while the menu is up
            showOpMenu(op, e.clientX, e.clientY);
            return;
        }
        const run = (typeof window.ddcsLooseRunAtLine === 'function') ? window.ddcsLooseRunAtLine(line) : null;
        if (!run || !run.length) return;                   // not over an op or a loose run → leave the native menu
        e.preventDefault();
        hide();
        showGroupMenu(run, e.clientX, e.clientY);
    });
    editor.addEventListener('scroll', hideOpMenu);
}
