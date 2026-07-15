/**
 * ui/macroBar.js — the two header project buttons: 📂 Open (the LIBRARY Projects tab) and ⤓ Save (the save MODAL
 * with a folder tree picker). Both surfaces this wires so the header stays to two controls. Available from Studio +
 * Blocks (global header).
 */
import { openSaveModal } from './projects/projectModal.js';
import { openLibrary } from './libraryModal.js';

export function initMacroBar() {
    const openBtn = document.getElementById('projOpenBtn');
    const saveBtn = document.getElementById('projSaveBtn');
    // t863 — 📂 Open deep-links into the LIBRARY Projects tab (now hosts BOTH volumes — local + cloud — via renderCloudInto,
    // so the old drawer's cloud access is fully covered). The drawer (openOpenDrawer) stays mounted for the save flow but is
    // no longer an entry point. ⤓ Save opens the focused save modal (the same one the Library's "Save current…" delegates to).
    if (openBtn) openBtn.addEventListener('click', () => openLibrary('projects'));
    if (saveBtn) saveBtn.addEventListener('click', () => openSaveModal());
}
