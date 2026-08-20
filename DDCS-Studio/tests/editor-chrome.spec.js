import { test, expect } from '@playwright/test';

/**
 * Editor chrome (#4): Clear + Copy live in the editor's own toolbar row (t2078; both visible at every width —
 * t1255's "the trash IS the clear at every width" ruling is unchanged, only where the trash sits moved).
 * Locks: the buttons exist + are wired to clearCode/copyCode (with a flash on Copy), the quick menu never
 * duplicates either, and the phone case keeps Clear a real (≥44px) touch target.
 *
 * t2099 — REWRITTEN. da280131/t2078 replaced the architecture this file used to describe (Clear beside
 * undo/redo in the HEADER, hidden on phone; a corner FILE menu holding Load/Insert/Export) with: one
 * `.editor-toolbar` row (Clear + Copy + Make + Transform + undo/redo) always visible, and Load/Insert/Export
 * moved to the quick menu instead of a now-retired corner menu (editor-file-menu-1227.spec.js covers that
 * side in full; editor-toolbar-2078.spec.js is the authoritative reference for the toolbar's own shape).
 * What's still true and re-asserted here: Clear/Copy are wired to the same handlers, neither duplicates into
 * the quick menu, and — the one genuine regression this rewrite fixes rather than just re-describes — Clear
 * must still clear a real ≥44px touch target on a phone (t1255's own ruling; t2078's move left the phone-width
 * CSS rule targeting a class the button no longer carries, so the floor silently stopped applying — fixed in
 * styles.css, see the #btn-clear comment there).
 */

test.describe('desktop', () => {
  test.use({ viewport: { width: 1400, height: 1000 } });

  test('editor chrome: toolbar Clear + Copy wired; quick menu carries neither', async ({ page }) => {
    await page.goto('http://localhost:3211');
    // initHeaderPost (which wires the floating Copy button) runs AFTER window.copyCode exists; its last act is
    // building the chevron menu, so wait for that to avoid clicking before the listener attaches.
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.copyCode && window.clearCode   // t1307 — the declared boot signal FIRST (t1279): the globals below exist before the deferred wiring reaches the controls this spec clicks
      && document.querySelector('#hdrPostMenu') && document.querySelector('#hdrPostMenu').children.length > 0);

    await expect(page.locator('#btn-clear')).toBeVisible();
    await expect(page.locator('#editor-copy-btn')).toBeVisible();

    // wired to the existing handlers (spy them; the handlers read window.* at click time) + the Copy flash
    const r = await page.evaluate(() => {
      const out = { copy: 0, clear: 0, flashed: false };
      window.copyCode = () => { out.copy++; };
      window.clearCode = () => { out.clear++; };
      const cb = document.getElementById('editor-copy-btn');
      cb.click();
      out.flashed = cb.classList.contains('copied');
      document.getElementById('btn-clear').click();
      return out;
    });
    expect(r.copy).toBe(1);
    expect(r.clear).toBe(1);
    expect(r.flashed, 'Copy button flashes the copied class').toBe(true);

    // the chevron quick-menu carries NEITHER editor action now (t1227): Copy is the floating button, Clear is in the
    // editor's corner file menu — where the rest of the program's file actions live
    await page.locator('#hdrPostBtn').click();
    await expect(page.locator('#hdrPostMenu')).toBeVisible();
    await expect(page.locator('#hdrPostMenu [data-act="copy"]')).toHaveCount(0);
    await expect(page.locator('#hdrPostMenu [data-act="clear"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    // t2099 — t1255's "one door" ruling holds, but the corner file menu it used to name is RETIRED (t2078), not
    // a second door: confirm there is no menu left anywhere for Clear to hide a duplicate in.
    expect(await page.evaluate(() => !!document.getElementById('editor-file-btn')), 'the corner file button is gone').toBe(false);
    expect(await page.evaluate(() => !!document.getElementById('editor-file-menu')), 'the corner file menu is gone').toBe(false);
    await expect(page.locator('#btn-clear'), 'the toolbar trash IS the clear').toBeVisible();
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('PHONE: the TRASH is the Clear — visible and tappable at 390px; Load/Insert/Export reach the quick menu', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio);

    // t1255 (user) — the trash must be a REAL touch target at every width, phone included: it is the one door to
    // Clear now (t2078 retired the corner-menu duplicate this test used to check for instead).
    const trash = page.locator('#btn-clear');
    await expect(trash, 'the trash is on screen at 390px').toBeVisible();
    const tb = await trash.boundingBox();
    expect(Math.min(tb.width, tb.height), 'and is a real touch target').toBeGreaterThanOrEqual(44);
    expect(tb.x >= 0 && tb.x + tb.width <= 390, 'fully inside the viewport').toBe(true);

    // t2099 — the corner file menu is gone (t2078); Load/Insert/Export reach the quick menu instead, still
    // reachable at phone width, and Clear is still not duplicated into it.
    expect(await page.evaluate(() => !!document.getElementById('editor-file-btn')), 'the corner file button is gone').toBe(false);
    await page.locator('#hdrPostBtn').click();
    const menu = page.locator('#hdrPostMenu');
    await expect(menu).toBeVisible();
    for (const act of ['fileLoad', 'fileInsert', 'fileExport']) {
      await expect(menu.locator(`[data-act="${act}"]`), `${act} is in the quick menu at 390px`).toBeVisible();
    }
    await expect(menu.locator('[data-act="clear"]'), 'and Clear is not duplicated here').toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.screenshot({ path: 'scratchpad/s1255-phone-trash.png' });
  });
});
