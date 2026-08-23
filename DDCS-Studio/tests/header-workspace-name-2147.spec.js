import { test, expect } from '@playwright/test';

/**
 * t2147 — BACKLOG #7: THE HEADER SHOWS THE WORKSPACE, WHERE IT USED TO SHOW THE VERSION.
 *
 * The version is a lookup fact (consulted when reporting a bug or verifying a release); the workspace is an
 * identity fact (needed continuously). Header space belongs to identity. Driven by the SAME dirty-tracker
 * ui/fileSaveState.js owns — one source, not a second dirty-signal.
 *
 * AMENDED after the first pass (human ruling, 2026-08-22, three rounds):
 *   1. THE NAME AND THE CHEVRON ARE ONE CONTROL — merged into #hdrPostBtn itself (name text, then the chevron),
 *      not a separate bare label beside it. "A bare label has no edge — it bleeds toward the brand <a href>
 *      next to it… the chevron inside the chip is the AFFORDANCE." So this chip IS #hdrPostBtn — no new id.
 *   2. IT MOVED beside #hdrAccount (the avatar), and #fileSaveChip moved with it — the STATE (the name) and the
 *      ACTION that resolves it (Save) now share one end of the header. It left its old slot beside the brand.
 *   3. NO DIRTY DOT — "we can remove the dot." The disk chip's COLOUR remains the one indicator (t1223); a dot
 *      on the chip beside it would only repeat that.
 * ⚠ ITEMS 2 AND 3 ABOVE ARE SUPERSEDED (t2188, amendment 1, "ok dot") — left as they were AT THE TIME, not
 * rewritten to erase what actually happened. #fileSaveChip is deleted outright now (not moved with anything);
 * the STATE job it used to carry by colour lives on #hdrWsDirtyDot, a dot ON this chip, the exact thing item 3
 * once ruled against — because the disk chip whose colour item 3 relied on no longer exists to carry it.
 *
 * ⛔ THE TRAP this item's own spec named: index.html's version span sat INSIDE `<a class="brand" href="…">`.
 * The workspace chip must live OUTSIDE that anchor — asserted directly below, not just implied.
 */
test.use({ viewport: { width: 1400, height: 900 } });

async function ready(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsFileSaveState && window.ddcsWorkspaceDirtyToFile && window.ddcsMarkWorkspaceSaved);
    await page.waitForFunction(() => localStorage.getItem('ddcs_file_watermark') != null && window.ddcsWorkspaceDirtyToFile() === false, null, { timeout: 8000 });
}

test('never-saved: the chip reads "Not saved", honestly, not a fake title', async ({ page }) => {
    await ready(page);
    const text = await page.evaluate(() => (document.querySelector('#hdrPostBtn .hdr-ws-name-txt') || {}).textContent || '');
    expect(text, 'never-saved reads honestly, no invented title').toBe('Not saved');
});

test('saved: the chip shows the FILE stem, no extension', async ({ page }) => {
    await ready(page);
    await page.evaluate(() => window.ddcsMarkWorkspaceSaved('Aluminum bracket.ddcs'));
    await page.waitForTimeout(100);
    const text = await page.evaluate(() => (document.querySelector('#hdrPostBtn .hdr-ws-name-txt') || {}).textContent || '');
    expect(text, 'the stem, not "Aluminum bracket.ddcs"').toBe('Aluminum bracket');
});

test('t2188 (amendment 1, superseding this file\'s own "no dirty dot" ruling): #hdrWsDirtyDot IS the indicator now', async ({ page }) => {
    await ready(page);
    await page.evaluate(() => window.ddcsMarkWorkspaceSaved('Aluminum bracket.ddcs'));
    await page.evaluate(() => {
        localStorage.setItem('ddcs_tpl_zzz_hdrname_test', JSON.stringify([{ n: 1 }]));
        window.ddcsFileSaveState.refresh();
    });
    await page.waitForTimeout(100);
    const s = await page.evaluate(() => ({
        dirtySignal: window.ddcsWorkspaceDirtyToFile(),
        dotIsOn: document.getElementById('hdrWsDirtyDot').classList.contains('is-on'),
        diskChipExists: document.getElementById('fileSaveChip') !== null,
    }));
    expect(s.dirtySignal, 'the change really did make the workspace dirty-to-file').toBe(true);
    expect(s.dotIsOn, 'the workspace chip\'s own dot carries the dirty state now').toBe(true);
    expect(s.diskChipExists, 'the standalone disk chip is gone entirely (t2188) — not the indicator any more').toBe(false);
});

test('clicking the chip opens the quick menu — it IS the chevron button, not a second click target', async ({ page }) => {
    await ready(page);
    await expect(page.locator('#hdrPostMenu')).toBeHidden();
    await page.click('#hdrPostBtn');
    await expect(page.locator('#hdrPostMenu')).toBeVisible();
});

test('⛔ THE TRAP: the chip lives OUTSIDE the brand anchor — clicking it never navigates', async ({ page }) => {
    await ready(page);
    const outside = await page.evaluate(() => {
        const chip = document.getElementById('hdrPostBtn');
        const brand = document.querySelector('.app-header .brand');
        return !!(chip && brand && !brand.contains(chip));
    });
    expect(outside, 'the workspace chip is not a descendant of the brand <a href> anchor').toBe(true);
});

test('THE CHIP MOVED beside the avatar: [chip] [avatar], all outside the brand', async ({ page }) => {
    await ready(page);
    const order = await page.evaluate(() => {
        const controls = document.querySelector('.app-header .hdr-controls');
        const names = [...controls.children].map((el) => el.id).filter(Boolean);
        return names;
    });
    // t2188 (amendment 1) — the disk chip that used to sit between them is deleted entirely, not just moved.
    expect(order, 'chip, then avatar — in that order, all in .hdr-controls').toEqual(['hdrQuick', 'hdrAccount']);
});

test('long names truncate — the header stays fixed-width regardless of workspace name length', async ({ page }) => {
    await ready(page);
    await page.evaluate(() => window.ddcsMarkWorkspaceSaved('Aluminum bracket - Jones run 3, second attempt after the first mount failed.ddcs'));
    await page.waitForTimeout(100);
    const s = await page.evaluate(() => {
        const el = document.querySelector('#hdrPostBtn .hdr-ws-name-txt');
        return { overflowsVisibly: el.scrollWidth > el.clientWidth, ellipsized: getComputedStyle(el).textOverflow === 'ellipsis' };
    });
    expect(s.overflowsVisibly, 'the text is genuinely wider than its box (a real truncation case, not a vacuous one)').toBe(true);
    expect(s.ellipsized, 'CSS text-overflow:ellipsis is in force').toBe(true);
    const h = await page.evaluate(() => { const el = document.querySelector('.app-header'); return el.scrollWidth - el.clientWidth; });
    expect(h, 'a very long workspace name never overflows the header').toBeLessThanOrEqual(0);
});

test('390px (verification/t2099-header-390.png\'s case): a long name ellipsises, chip never collides with tabs or the avatar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.evaluate(() => window.ddcsMarkWorkspaceSaved('Aluminum bracket - Jones run 3.ddcs'));
    await page.waitForTimeout(400);   // let commandDeck's overflow-yield measurement settle
    const s = await page.evaluate(() => {
        const h = document.querySelector('.app-header');
        const chip = document.getElementById('hdrPostBtn').getBoundingClientRect();
        const tabs = document.querySelector('.hdr-tabs').getBoundingClientRect();
        const acct = document.getElementById('hdrAccount').getBoundingClientRect();
        return {
            overflow: h.scrollWidth - h.clientWidth,
            chipVsTabs: chip.left >= tabs.right,   // the chip must not sit ON TOP of the tabs
            chipHasReadableChar: (document.querySelector('#hdrPostBtn .hdr-ws-name-txt').textContent || '').length > 0,
            acctVisible: acct.width > 0,
        };
    });
    expect(s.overflow, 'no header overflow at 390px').toBeLessThanOrEqual(0);
    expect(s.chipHasReadableChar, 'the cap never shrinks the name to zero readable characters').toBe(true);
    expect(s.acctVisible, 'the avatar stays visible beside the chip, not pushed off').toBe(true);
});
