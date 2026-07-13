/**
 * ui/selectLoad.js — the ONE declared SELECT-THEN-LOAD interaction for every file/profile browser
 * (projects local + cloud, profiles local + cloud). Generalises the tool-library "Use" precedent
 * (accent commit button + double-click) with an explicit one-at-a-time SELECTED state and a
 * disabled-until-selected primary button, so no row-click loads ambiguously and there are no dead clicks.
 *
 * A row opts in with class `sl-row` + `data-sl-id="<id>"`; the ACTIVE row additionally carries
 * `data-sl-active` (a distinct badge, drawn by the caller — NOT the selection highlight). A single click
 * on a row SELECTS it (one at a time, accent ring); a dedicated primary button `[data-sl-primary]`
 * (disabled until a selection) OR a double-click on a row COMMITS via `onLoad(id, row)`. Buttons / links
 * INSIDE a row (rename, delete, …) act on their own — they never select. Navigation-only rows (folders)
 * simply omit `sl-row`, so they keep their own click handler.
 *
 * Delegation lives on a STABLE root element so the rows AND the primary button can be freely re-rendered
 * inside it (the guard makes install idempotent). Call `syncPrimary(root)` after each re-render — a new
 * row list carries no selection, so the primary button must disable again.
 */

/** Install the select-then-load delegation on `root` once. `onLoad(id, rowEl)` runs on commit. */
export function installSelectLoad(root, onLoad) {
    if (!root) return;
    if (root.__slWired) { syncPrimary(root); return; }
    root.__slWired = true;
    const rows = () => Array.from(root.querySelectorAll('.sl-row'));
    const selectedRow = () => root.querySelector('.sl-row.sl-selected');
    const isRowAction = (el) => !!(el.closest && el.closest('button, a, input, select, label'));
    const select = (row) => { rows().forEach((r) => r.classList.toggle('sl-selected', r === row)); syncPrimary(root); };
    const commit = (row) => { if (row && row.dataset.slId != null) onLoad(row.dataset.slId, row); };
    root.addEventListener('click', (e) => {
        const prim = e.target.closest && e.target.closest('[data-sl-primary]');
        if (prim) { if (!prim.disabled) commit(selectedRow()); return; }   // the dedicated Load / Open button
        if (isRowAction(e.target)) return;                                  // a row's own rename/delete/etc.
        const row = e.target.closest('.sl-row'); if (row && root.contains(row)) select(row);
    });
    root.addEventListener('dblclick', (e) => {
        if (isRowAction(e.target)) return;
        const row = e.target.closest('.sl-row'); if (row && root.contains(row)) { select(row); commit(row); }
    });
    syncPrimary(root);
}

/** Re-evaluate the primary button's disabled state — call after each re-render (no selection ⇒ disabled). */
export function syncPrimary(root) {
    if (!root) return;
    const btn = root.querySelector('[data-sl-primary]');
    if (btn) btn.disabled = !root.querySelector('.sl-row.sl-selected');
}
