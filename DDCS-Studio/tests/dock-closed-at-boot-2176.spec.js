import { test, expect } from '@playwright/test';

/**
 * t2176 amendment 1 — "the app opens on the keyboard dock open, wrong" / "it should be closed on open."
 *
 * ⚠ NOT REPRODUCED LOCALLY, despite a thorough measurement pass (see WORK-LOG for the full trail): #controller-
 * dock never carries `is-expanded` at boot in this harness, at phone (412×915) or desktop (1400×900) width, with
 * or without a saved `ddcs_dock_h`, and a 7-sample timing sweep (0/50/100/200/400/800/1500ms after `page.goto`)
 * shows `.dock-body` at `display:none` from the moment the element first exists — no flash. The advisor's own
 * candidate (`--dock-h` leaking past the `.is-expanded` gate) does not hold: `.dock-body`'s tall-height rule
 * (styles.css ~1657) IS correctly scoped under `#controller-dock.is-expanded`, and the base rule (~1633) is
 * `display:none` unconditionally otherwise. Neither `is-expanded` (grepped: only styles.css + dockManager.js
 * ever reference it) nor any dock-body display override without that guard exists anywhere in web/.
 *
 * This is therefore a REGRESSION LOCK, not a reproduction of the reported bug — it codifies the invariant the
 * dispatch named ("closed-on-boot is the DEFAULT, not a stored preference") so any FUTURE change that breaks it
 * is caught, while the actual live symptom (real device/browser, or possibly a stale deploy — this repo's own
 * pages.dev serves whatever was last pushed to `main`, which this branch is ahead of) needs more specifics than
 * this local harness can supply. Flagged back to the advisor, not silently "fixed" without evidence of what's
 * actually broken.
 */
test.use({ viewport: { width: 412, height: 915 } });

async function bootAndMeasure(page, { dockH } = {}) {
    await page.goto('http://localhost:3211');
    await page.evaluate((h) => { if (h) localStorage.setItem('ddcs_dock_h', String(h)); else localStorage.removeItem('ddcs_dock_h'); }, dockH);
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    return page.evaluate(() => {
        const dock = document.getElementById('controller-dock');
        const body = dock.querySelector('.dock-body');
        return { isExpanded: dock.classList.contains('is-expanded'), bodyDisplay: getComputedStyle(body).display };
    });
}

test('fresh boot, no saved dock height: the dock is collapsed', async ({ page }) => {
    const s = await bootAndMeasure(page);
    expect(s.isExpanded, 'no is-expanded class at boot').toBe(false);
    expect(s.bodyDisplay, 'the dock body takes no space when collapsed').toBe('none');
});

test('boot WITH a saved dock height (a returning user who once resized it): still collapsed', async ({ page }) => {
    // the one state a "closed-on-boot is the default, not a stored preference" ruling exists specifically to
    // guard against — a persisted HEIGHT must never be read as a persisted OPEN/CLOSED state.
    const s = await bootAndMeasure(page, { dockH: 450 });
    expect(s.isExpanded, 'a saved height alone must never imply expanded').toBe(false);
    expect(s.bodyDisplay).toBe('none');
});

test('no boot-time flash: the dock stays collapsed through the whole ready sequence, not just at the end', async ({ page }) => {
    await page.goto('http://localhost:3211', { waitUntil: 'commit' });
    let sawExpanded = false;
    for (const delay of [50, 100, 150, 200, 300, 500]) {
        await page.waitForTimeout(delay);
        const expanded = await page.evaluate(() => {
            const dock = document.getElementById('controller-dock');
            return !!(dock && dock.classList.contains('is-expanded'));
        });
        if (expanded) sawExpanded = true;
    }
    expect(sawExpanded, 'never observed is-expanded at any sampled point during boot').toBe(false);
});
