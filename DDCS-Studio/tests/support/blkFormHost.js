/**
 * tests/support/blkFormHost.js — t1752: the ONE place that knows which DOM element is currently rendering the
 * Blocks tab's Wizard View pane content.
 *
 * Since t1744/t1748, a "show" case renders through createUserOpView('blk') into #blk_wiz_user_form (visible
 * whenever #blk_wiz_user is not display:none); #blk-form is now only the host for the empty / mid-edit-without-
 * layout faces. Multiple specs need "the field the pane is currently showing," and hand-copying the id string (or
 * the visibility check) into each one is exactly the drift this project's own north star warns about — the NEXT
 * host move would need N edits instead of one. This is that one place.
 *
 * Runs INSIDE the browser — pass the function itself to page.evaluate (Playwright serializes it), so it must stay
 * self-contained: no closures, no imports, only the DOM.
 */
export function getBlkFormHost() {
    const newWrap = document.getElementById('blk_wiz_user');
    const newHost = document.getElementById('blk_wiz_user_form');
    const newVisible = !!(newWrap && newHost && getComputedStyle(newWrap).display !== 'none');
    return newVisible ? newHost : document.getElementById('blk-form');
}
