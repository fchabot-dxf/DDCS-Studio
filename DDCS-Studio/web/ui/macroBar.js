/**
 * ui/macroBar.js — the two header project buttons: 📂 Open (the manage/open DRAWER) and ⤓ Save (the save MODAL
 * with a folder tree picker). Both surfaces live in ui/projects/projectModal.js; this just wires the buttons so
 * the header stays to two controls. Available from Studio + Blocks (global header).
 */
import { openOpenDrawer, openSaveModal } from './projects/projectModal.js';

export function initMacroBar() {
    const openBtn = document.getElementById('projOpenBtn');
    const saveBtn = document.getElementById('projSaveBtn');
    // t854 — the drawer stays the Open/Save target for now: it carries the CLOUD volume the Library's local Projects tab
    // does not yet host (deep-linking Open → Library-Projects would drop cloud access). Projects consolidation (cloud in
    // the Library + retiring the drawer) is the Projects-tab follow-up; the Profiles… door already deep-links (its tab is
    // full-featured). window.openLibrary is registered by libraryModal's import in headerPost.
    if (openBtn) openBtn.addEventListener('click', () => openOpenDrawer());
    if (saveBtn) saveBtn.addEventListener('click', () => openSaveModal());
}
