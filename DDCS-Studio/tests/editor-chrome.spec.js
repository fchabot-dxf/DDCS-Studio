import { test, expect } from '@playwright/test';

/**
 * Editor chrome (#4): Clear moved to a header button beside undo/redo (desktop; hidden on phone, where the chevron
 * quick-menu keeps it), Copy moved to a floating button in the editor (all widths). Locks: the buttons exist + are
 * wired to clearCode/copyCode (with a flash on Copy), the chevron menu dropped 'copy' but kept 'clear', and the
 * header Clear hides on phone.
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

    // the chevron quick-menu dropped 'Copy program' but kept 'Clear editor'
    await page.locator('#hdrPostBtn').click();
    await expect(page.locator('#hdrPostMenu')).toBeVisible();
    await expect(page.locator('#hdrPostMenu [data-act="copy"]')).toHaveCount(0);
    await expect(page.locator('#hdrPostMenu [data-act="clear"]')).toHaveCount(1);
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('editor chrome: header Clear hidden on phone; chevron menu still has Clear', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);

    await expect(page.locator('#btn-clear')).toBeHidden();           // hidden ≤600px
    await page.locator('#hdrPostBtn').click();
    await expect(page.locator('#hdrPostMenu [data-act="clear"]')).toHaveCount(1);
  });
});
