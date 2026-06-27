/**
 * ui/opContextMenu.js — the shared right-click op menu (✎ Edit / ⧉ Duplicate / 🗑 Delete), reused by every
 * surface that can identify an op: the editor (line→op), the Blocks code panel (span ancestry→op), and the
 * Blockly op blocks. Acts via the window hooks (ddcsEditOp + opSession duplicate/delete) — params stay the truth.
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

// Render the items into the shared menu element + clamp it into the viewport at (x, y).
function place(m, x, y) {
    m.hidden = false;
    const r = m.getBoundingClientRect();
    m.style.left = Math.round(Math.min(x, window.innerWidth - r.width - 6)) + 'px';
    m.style.top = Math.round(Math.min(y, window.innerHeight - r.height - 6)) + 'px';
}
function item(m, label, fn, disabled) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'op-ctx-item'; b.textContent = label; b.disabled = !!disabled;
    b.addEventListener('click', () => { hideOpMenu(); fn(); });
    m.appendChild(b);
}

/** Show the op menu for `op` ({ id, opType, label }) at viewport (x, y). */
export function showOpMenu(op, x, y) {
    if (!op || !op.id) return;
    const m = ensure();
    m.innerHTML = '';
    const editable = !window.ddcsCanEditOp || window.ddcsCanEditOp(op.opType);
    item(m, `✎ Edit ${op.label || op.opType || 'op'}`, () => window.ddcsEditOp && window.ddcsEditOp(op.id), !editable);
    item(m, '⧉ Duplicate', async () => { try { (await import('../blocks/opSession.js')).duplicateOp(op.id); } catch (_) { /* */ } });
    item(m, '🗑 Delete', async () => { try { (await import('../blocks/opSession.js')).deleteOp(op.id); } catch (_) { /* */ } });
    place(m, x, y);
}

/** Show the in-context "Group" menu for a contiguous LOOSE run (right-click a hand-built atom). `runIds` is the run
 *  of top-level loose block ids (from programModel.looseRunAtLine); "Group" wraps exactly that run in one `group` op
 *  → the editor hover ✎ chip then finds it. Declarative + explicit: the user PICKS the run, the app never auto-grabs. */
export function showGroupMenu(runIds, x, y) {
    if (!Array.isArray(runIds) || !runIds.length) return;
    const m = ensure();
    m.innerHTML = '';
    item(m, `▣ Group ${runIds.length} block${runIds.length === 1 ? '' : 's'}`, async () => {
        try { (await import('../blocks/opSession.js')).groupLooseAtoms('Hand-built', runIds); } catch (_) { /* */ }
    });
    place(m, x, y);
}
