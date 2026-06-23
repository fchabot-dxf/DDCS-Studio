/**
 * ui/opContextMenu.js — the shared right-click op menu (✎ Edit / ⧉ Duplicate / 🗑 Delete), reused by every
 * surface that can identify an op: the editor (line→op), the Blocks code panel (span ancestry→op), and the
 * Blockly op blocks. Acts via the window hooks (ddcsEditOp + opStacks duplicate/delete) — params stay the truth.
 */
let menu = null;
function ensure() {
    if (menu) return menu;
    menu = document.createElement('div');
    menu.className = 'op-ctx-menu'; menu.hidden = true;
    document.body.appendChild(menu);
    document.addEventListener('mousedown', (e) => { if (menu && !menu.hidden && !menu.contains(e.target)) hideOpMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideOpMenu(); });
    window.addEventListener('ddcs:stop-previews', hideOpMenu);
    return menu;
}

export function hideOpMenu() { if (menu) menu.hidden = true; }

/** Show the op menu for `op` ({ id, opType, label }) at viewport (x, y). */
export function showOpMenu(op, x, y) {
    if (!op || !op.id) return;
    const m = ensure();
    m.innerHTML = '';
    const editable = !window.ddcsCanEditOp || window.ddcsCanEditOp(op.opType);
    const item = (label, fn, disabled) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'op-ctx-item'; b.textContent = label; b.disabled = !!disabled;
        b.addEventListener('click', () => { hideOpMenu(); fn(); });
        m.appendChild(b);
    };
    item(`✎ Edit ${op.label || op.opType || 'op'}`, () => window.ddcsEditOp && window.ddcsEditOp(op.id), !editable);
    item('⧉ Duplicate', async () => { try { (await import('../blocks/opStacks.js')).duplicateOp(op.id); } catch (_) { /* */ } });
    item('🗑 Delete', async () => { try { (await import('../blocks/opStacks.js')).deleteOp(op.id); } catch (_) { /* */ } });
    // Clamp into the viewport.
    m.hidden = false;
    const r = m.getBoundingClientRect();
    m.style.left = Math.round(Math.min(x, window.innerWidth - r.width - 6)) + 'px';
    m.style.top = Math.round(Math.min(y, window.innerHeight - r.height - 6)) + 'px';
}
