/**
 * tests/_boot.js — the shared app/workspace-readiness wait. t2233: 16+ spec files each hand-rolled their own
 * `page.waitForFunction(predicate, arg, { timeout: N })` for the SAME kind of check (has the app/workspace
 * finished booting or catching up with the edit I just made) — N picked independently per file (60000, 30000,
 * 10000, 8000, or the third argument omitted entirely). Omitting it does NOT inherit the project's 60s test
 * timeout — playwright.config.js sets `use.actionTimeout: 5_000` (meant for real UI actions like click/fill),
 * which `page.setDefaultTimeout()` also governs for waitForFunction, so an "unbounded-looking" call was
 * actually the TIGHTEST of all: 5 seconds. Confirmed by running the flaky batch and reading the raised
 * TimeoutError text directly ("Timeout 5000ms exceeded") rather than assuming.
 *
 * A duplicated timeout number that must stay under an outer budget (the test's own test.setTimeout(), or the
 * config default) is a bug waiting on the next config change — raise actionTimeout or lower a file's own
 * number and 16 files silently start undercutting it again. This helper has NO timeout parameter, on purpose:
 * it disables waitForFunction's own timeout (`timeout: 0`) so the ENCLOSING test's timeout is the single
 * authority. The wait still fails loud and still surfaces a real hang — it just can't drift out of sync with
 * whatever the test's own budget is, because there is no second number to keep in sync.
 *
 *   await waitReady(page, () => !!window.__blkws)
 *   await waitReady(page, () => window.__blkws && window.__blkws.getAllBlocks().length > 0)
 *
 * If a call genuinely needs a SHORTER budget than the test's own timeout (e.g. to fail fast on a broken
 * selector rather than run out the whole test), that is a different case — name the reason at the call site
 * and keep an explicit page.waitForFunction(..., { timeout: N }) there instead of using this helper.
 */
export async function waitReady(page, predicate, arg) {
    await page.waitForFunction(predicate, arg, { timeout: 0 });
}
