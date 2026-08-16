import { expect } from '@playwright/test';

/**
 * tests/support/barGesture.js — the real command-bar gesture chain (t1776, Addition 1), extracted at t1790
 * (Addition 7) so the modal spec can reuse it instead of a second copy.
 *
 * The group dropdown is click-to-toggle (commandDeck.js:741 — a real click listener on the group button, not a
 * CSS :hover rule), so a real Playwright click genuinely opens it — no forced style manipulation needed.
 * `wizItemHtml` stamps `data-optype` from `e.type || e.opensAs || e.id` — most entries declare `type`, which
 * wins over `opensAs`, so the DOM attribute is often the short id (e.g. corner's is "corner", not
 * "user_corner_data") — pass whichever string the library entry actually declares as `type`.
 */

/** Open a wizard from the real command bar: click its GROUP dropdown ("Probe"/"Mill"/"Setup"/…), then its
 *  entry (`button[data-optype="<optype>"]`). Lands on the shared `#wiz_user` modal for any user-op entry. */
export async function openWizardViaBar(page, { group, optype }) {
    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: group }).click();
    const entry = page.locator(`.dock-header .toolbar-dropdown-content button[data-optype="${optype}"]`);
    await expect(entry).toBeVisible({ timeout: 5000 });
    await entry.click();
}

/** Fill a real form field in the currently-open modal/pane and dispatch `change` (formWidgets.js listens on
 *  change/input to persist into the live op) — the same real DOM interaction a keystroke-then-blur produces. */
export async function fillField(page, { formSelector, param, value }) {
    const field = page.locator(`${formSelector} [data-param="${param}"]`);
    await expect(field).toBeVisible({ timeout: 5000 });
    await field.fill(value);
    await field.dispatchEvent('change');
    return field;
}

/** Click the real INSERT button (index.html:1156's `.wiz-foot button.primary`). */
export async function clickInsert(page) {
    const insertBtn = page.locator('.wiz-foot button.primary', { hasText: 'INSERT' });
    await insertBtn.waitFor({ state: 'visible', timeout: 5000 });
    await insertBtn.click();
}

/** t1944 — click INSERT on a canvas that's already non-empty: t1942's own 3-way confirm (Add/Replace/Cancel)
 *  now appears, and nothing dismisses it on its own. `choiceLabel` names the button to click (e.g.
 *  "Replace it", "Add as a 2nd operation", "Cancel"); waits for the dialog to appear, clicks it, waits for it
 *  to close. Use this instead of a bare `clickInsert` whenever the canvas already holds a prior operation. */
export async function clickInsertChoice(page, choiceLabel) {
    const insertBtn = page.locator('.wiz-foot button.primary', { hasText: 'INSERT' });
    await insertBtn.waitFor({ state: 'visible', timeout: 5000 });
    await insertBtn.click();
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    await page.click(`.app-dialog button:has-text("${choiceLabel}")`);
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));
}

/** Click the real BLOCKS tab (index.html:136's `[data-app="blocks"]`). */
export async function clickBlocksTab(page) {
    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
}
