/**
 * ui/macroBar.js — the two header project buttons: 📂 Open (the manage/open DRAWER) and ⤓ Save (the save MODAL
 * with a folder tree picker). Both surfaces live in ui/projects/projectModal.js; this just wires the buttons so
 * the header stays to two controls. Available from Studio + Blocks (global header).
 */
import { openOpenDrawer, openSaveModal } from './projects/projectModal.js';

export function initMacroBar() {
    const openBtn = document.getElementById('projOpenBtn');
    const saveBtn = document.getElementById('projSaveBtn');
    if (openBtn) openBtn.addEventListener('click', () => openOpenDrawer());
    if (saveBtn) saveBtn.addEventListener('click', () => openSaveModal());
}
