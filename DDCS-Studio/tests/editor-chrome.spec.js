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
    await page.locator('#editor-file-btn').click();
    await expect(page.locator('#editor-file-menu [data-efm="clear"]'), 'Clear editor moved, it did not vanish').toBeVisible();
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('editor chrome: header Clear hidden on phone; the editor corner menu is the phone access point', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditorFileMenu);

    await expect(page.locator('#btn-clear')).toBeHidden();           // hidden ≤600px
    // t1227 — Clear left the quick menu, so on a PHONE the corner menu is the only way to it. It has to be reachable
    // and tappable at 390px, or the curation quietly took Clear away from phones.
    const btn = page.locator('#editor-file-btn');
    await expect(btn, 'the corner file button is on screen at 390px').toBeVisible();
    const box = await btn.boundingBox();
    expect(box.width, 'and wide enough to hit').toBeGreaterThanOrEqual(24);
    await btn.click();
    await expect(page.locator('#editor-file-menu [data-efm="clear"]')).toBeVisible();
    await expect(page.locator('#editor-file-menu [data-efm="load"]'), 'with the rest of the file actions').toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('phone-editor-file-menu.png') });
  });
});
