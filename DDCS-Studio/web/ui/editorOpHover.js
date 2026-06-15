/**
 * ui/editorOpHover.js — hover an op in the editor → highlight its lines + a floating "✎ Edit" chip → click to
 * re-open that op's wizard for editing.
 *
 * Uses the program model's line→op map (window.ddcsOpAtLine / ddcsLinesForOp), which is only valid while the
 * editor still matches the live projection (the model guards that — hand-edited text returns no op). The op's
 * params are the single source of truth; ddcsEditOp seeds the wizard from them and replaceOp rebuilds the op.
 * The editor text is transparent over the #editor-highlight overlay, so the .op-hover class shows behind it.
 */
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
        chip.textContent = (editable ? '✎ ' : '🔒 ') + (op.label || op.opType);
        chip.disabled = !editable;
        chip.title = editable ? `Edit this ${op.label || op.opType}` : `${op.label || op.opType}: form-edit not wired yet`;
        chip.style.top = Math.max(2, Math.round(first * lineHeight() + padTop() - editor.scrollTop)) + 'px';
        chip.dataset.opId = op.id;
        chip.hidden = false;
    });
    // Keep the chip visible when the pointer moves onto it; hide otherwise.
    editor.addEventListener('mouseleave', () => setTimeout(() => { if (!chip.matches(':hover')) hide(); }, 60));
    chip.addEventListener('click', () => { const id = chip.dataset.opId; hide(); if (id && window.ddcsEditOp) window.ddcsEditOp(id); });
    editor.addEventListener('scroll', () => { if (!chip.hidden) hide(); });   // avoid drift; re-hover to show again

    // Right-click an op → context menu: Edit / Duplicate / Delete.
    const menu = document.createElement('div');
    menu.id = 'op-ctx-menu'; menu.className = 'op-ctx-menu'; menu.hidden = true;
    document.body.appendChild(menu);
    const hideMenu = () => { menu.hidden = true; };
    const item = (label, fn, disabled) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'op-ctx-item'; b.textContent = label; b.disabled = !!disabled;
        b.addEventListener('click', () => { hideMenu(); fn(); });
        menu.appendChild(b);
    };
    editor.addEventListener('contextmenu', (e) => {
        if (typeof window.ddcsOpAtLine !== 'function') return;
        const op = window.ddcsOpAtLine(lineAtY(e.clientY));
        if (!op) return;                                   // not over an op → leave the native menu
        e.preventDefault();
        hide();                                            // drop the hover chip while the menu is up
        menu.innerHTML = '';
        const editable = !window.ddcsCanEditOp || window.ddcsCanEditOp(op.opType);
        item(`✎ Edit ${op.label || op.opType}`, () => window.ddcsEditOp && window.ddcsEditOp(op.id), !editable);
        item('⧉ Duplicate', async () => { try { (await import('../blocks/opStacks.js')).duplicateOp(op.id); } catch (_) { /* */ } });
        item('🗑 Delete', async () => { try { (await import('../blocks/opStacks.js')).deleteOp(op.id); } catch (_) { /* */ } });
        menu.style.left = Math.round(e.clientX) + 'px';
        menu.style.top = Math.round(e.clientY) + 'px';
        menu.hidden = false;
    });
    document.addEventListener('mousedown', (e) => { if (!menu.hidden && !menu.contains(e.target)) hideMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideMenu(); });
    window.addEventListener('ddcs:stop-previews', hideMenu);
}
