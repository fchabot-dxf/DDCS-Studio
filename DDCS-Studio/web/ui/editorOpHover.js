/**
 * ui/editorOpHover.js — hover an op in the editor → highlight its lines + a floating "✎ Edit" chip → click to
 * re-open that op's wizard for editing.
 *
 * Uses the program model's line→op map (window.ddcsOpAtLine / ddcsLinesForOp), which is only valid while the
 * editor still matches the live projection (the model guards that — hand-edited text returns no op). The op's
 * params are the single source of truth; ddcsEditOp seeds the wizard from them and replaceOp rebuilds the op.
 * The editor text is transparent over the #editor-highlight overlay, so the .op-hover class shows behind it.
 */
import { showOpMenu, hideOpMenu } from './opContextMenu.js';

export function initEditorOpHover() {
    const editor = document.getElementById('editor');
    const overlay = document.getElementById('editor-highlight');
    if (!editor || !overlay || !editor.parentElement) return;

    const chip = document.createElement('button');
    chip.id = 'op-edit-chip'; chip.className = 'op-edit-chip'; chip.type = 'button'; chip.hidden = true;
    editor.parentElement.appendChild(chip);

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

    // Persistent "edited in Blocks" glow: any op whose blocks diverge from its form params (isOpBlockEdited) gets
    // its emitted editor lines marked. The detector lives in the lazy opStacks module — import it once so it's
    // available on the editor side; re-glow whenever the highlight overlay rebuilds (childList only, so our own
    // class toggles don't re-trigger it).
    const glowEdited = () => {
        if (typeof window.ddcsOpBlockEdited !== 'function' || typeof window.ddcsGetBlockProgram !== 'function') return;
        overlay.querySelectorAll('.g-line.op-block-edited').forEach((s) => s.classList.remove('op-block-edited'));
        for (const op of (window.ddcsGetBlockProgram() || [])) {
            if (!op || op.type !== 'op' || !window.ddcsOpBlockEdited(op.id)) continue;
            ((window.ddcsLinesForOp && window.ddcsLinesForOp(op.id)) || []).forEach((j) => {
                const s = overlay.querySelector(`.g-line[data-line-index="${j}"]`); if (s) s.classList.add('op-block-edited');
            });
        }
    };
    window.ddcsRefreshBlockGlow = glowEdited;
    new MutationObserver(glowEdited).observe(overlay, { childList: true, subtree: true });
    import('../blocks/opStacks.js').then((m) => { window.ddcsOpBlockEdited = m.isOpBlockEdited; glowEdited(); }).catch(() => { /* detector optional */ });

    editor.addEventListener('mousemove', (e) => {
        if (typeof window.ddcsOpAtLine !== 'function') return;
        const op = window.ddcsOpAtLine(lineAtY(e.clientY));
        if (!op) { if (hoverOpId) hide(); return; }
        if (op.id === hoverOpId) return;            // unchanged → don't thrash
        hoverOpId = op.id;
        clearHi();
        const lines = (window.ddcsLinesForOp && window.ddcsLinesForOp(op.id)) || [];
        lines.forEach((j) => { const s = overlay.querySelector(`.g-line[data-line-index="${j}"]`); if (s) s.classList.add('op-hover'); });
        const first = lines.length ? lines[0] : 0;
        const editable = !window.ddcsCanEditOp || window.ddcsCanEditOp(op.opType);
        const edited = typeof window.ddcsOpBlockEdited === 'function' && window.ddcsOpBlockEdited(op.id);
        chip.textContent = (editable ? '✎ ' : '🔒 ') + (op.label || op.opType) + (edited ? '  ✦' : '');
        chip.classList.toggle('block-edited', !!edited);
        chip.disabled = !editable;
        chip.title = (editable ? `Edit this ${op.label || op.opType}` : `${op.label || op.opType}: form-edit not wired yet`) + (edited ? ' — edited in Blocks' : '');
        chip.style.top = Math.max(2, Math.round(first * lineHeight() + padTop() - editor.scrollTop)) + 'px';
        // Chip floats on the LEFT of the editor (left: 12px in CSS) — clear of the right-side 3D preview
        // drawer / view-cube gizmo, so it's always reachable (the "out of reach" report).
        chip.dataset.opId = op.id;
        chip.hidden = false;
    });
    // Keep the chip visible when the pointer moves onto it; hide otherwise.
    editor.addEventListener('mouseleave', () => setTimeout(() => { if (!chip.matches(':hover')) hide(); }, 60));
    chip.addEventListener('click', () => { const id = chip.dataset.opId; hide(); if (id && window.ddcsEditOp) window.ddcsEditOp(id); });
    editor.addEventListener('scroll', () => { if (!chip.hidden) hide(); });   // avoid drift; re-hover to show again

    // Right-click an op → shared context menu (✎ Edit / ⧉ Duplicate / 🗑 Delete).
    editor.addEventListener('contextmenu', (e) => {
        if (typeof window.ddcsOpAtLine !== 'function') return;
        const op = window.ddcsOpAtLine(lineAtY(e.clientY));
        if (!op) return;                                   // not over an op → leave the native menu
        e.preventDefault();
        hide();                                            // drop the hover chip while the menu is up
        showOpMenu(op, e.clientX, e.clientY);
    });
    editor.addEventListener('scroll', hideOpMenu);
}
