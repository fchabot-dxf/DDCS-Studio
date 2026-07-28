import { test, expect } from '@playwright/test';

/**
 * Editor chrome (#4): Clear moved to a header button beside undo/redo (desktop; hidden on phone), Copy moved to a
 * floating button in the editor (all widths). Locks: the buttons exist + are wired to clearCode/copyCode (with a
 * flash on Copy), and the header Clear hides on phone.
 *
 * t1227 CURATION — Clear left the chevron quick-menu for the EDITOR's own corner file menu, with Load/Insert/Export.
 * The phone case is the one that matters and is asserted below: the header Clear is hidden ≤600px, so the corner menu
 * is now the phone's access point and it must actually be reachable there.
 */

test.describe('desktop', () => {
  test.use({ viewport: { width: 1400, height: 1000 } });

  test('editor chrome: header Clear + floating Copy wired; menu drops Copy, keeps Clear', async ({ page }) => {
    await page.goto('http://localhost:3211');
    // initHeaderPost (which wires the floating Copy button) runs AFTER window.copyCode exists; its last act is
    // building the chevron menu, so wait for that to avoid clicking before the listener attaches.
    await page.waitForFunction(() => window.copyCode && window.clearCode
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
    // t1255 — Clear is not in the corner menu either: the header TRASH is the one door to it, at every width.
    await page.locator('#editor-file-btn').click();
    await expect(page.locator('#editor-file-menu [data-efm="clear"]'), 'no second Clear in the corner menu').toHaveCount(0);
    await expect(page.locator('#btn-clear'), 'the trash IS the clear').toBeVisible();
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('PHONE: the TRASH is the Clear — visible and tappable at 390px; the corner menu holds file actions only', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditorFileMenu);

    // t1255 (user) — RE-ENCODED. The old shape was: the trash hides ≤600px, so the corner menu carries Clear for
    // phones. That duplicate is gone, which means the trash MUST be here — otherwise the phone loses Clear entirely,
    // which is exactly the regression this test now exists to catch.
    const trash = page.locator('#btn-clear');
    await expect(trash, 'the trash is on screen at 390px').toBeVisible();
    const tb = await trash.boundingBox();
    expect(Math.min(tb.width, tb.height), 'and is a real touch target').toBeGreaterThanOrEqual(44);
    expect(tb.x >= 0 && tb.x + tb.width <= 390, 'fully inside the viewport').toBe(true);

    // the corner menu still holds the FILE actions, and only those
    const btn = page.locator('#editor-file-btn');
    await expect(btn, 'the corner file button is on screen at 390px').toBeVisible();
    await btn.click();
    for (const id of ['load', 'insert', 'export']) {
      await expect(page.locator(`#editor-file-menu [data-efm="${id}"]`), `${id} is in the file menu`).toBeVisible();
    }
    await expect(page.locator('#editor-file-menu [data-efm="clear"]'), 'and Clear is not duplicated here').toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.screenshot({ path: 'scratchpad/s1255-phone-trash.png' });
  });
});
