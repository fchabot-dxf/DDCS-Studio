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

  test('PHONE: the TRASH is the Clear — visible and tappable at 390px; Load/Export reach the quick menu, Insert stays gone', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio);

    // t1255 (user) — the trash must be VISIBLE and on screen at every width, phone included: it is the one door
    // to Clear now (t2078 retired the corner-menu duplicate this test used to check for instead).
    const trash = page.locator('#btn-clear');
    await expect(trash, 'the trash is on screen at 390px').toBeVisible();
    const tb = await trash.boundingBox();
    expect(tb.x >= 0 && tb.x + tb.width <= 390, 'fully inside the viewport').toBe(true);

    // BACKLOG #13 (human, from a phone screenshot: "the clear button appears larger than its siblings") ruled
    // ALL SIX buttons should share the 44px touch floor (previously only #btn-clear had it) — the reasoning:
    // shrinking clear to match its siblings would trade a cosmetic complaint for an ergonomic one on the ONE
    // destructive control in the row.
    //
    // t2169 — REVERSED, on a direct, INFORMED human override: the floor was named aloud as a tradeoff (a real
    // preview-handle/toolbar overlap needed the row to shrink to fit above/beside the 3D pull-tab, clamped to
    // the true bottom edge) and the human chose to accept the mis-tap risk rather than keep the floor. All six
    // buttons — trash included — are ~24px now (`.editor-toolbar > button`'s natural, unfloored size), split 3
    // each side of the handle via `.editor-toolbar-spacer`, each flex-sized to fill its half evenly. This test
    // now asserts the NEW shape (present, on screen, evenly sized, no button under the OTHER buttons' own size)
    // rather than a floor that no longer applies here — if a future ruling restores the floor, this is the test
    // to update again, the same way it was written down instead of silently changed the first time.
    const ids = ['editor-cam-btn', 'align-rotate-btn', 'btn-undo', 'btn-redo', 'btn-clear', 'editor-copy-btn'];
    const sizes = [];
    for (const id of ids) {
      const b = await page.locator('#' + id).boundingBox();
      expect(b, `#${id} is on screen at 390px`).toBeTruthy();
      expect(b.x >= 0 && b.x + b.width <= 390, `#${id} fully inside the viewport`).toBe(true);
      sizes.push(b.height);
    }
    const heights = new Set(sizes.map((h) => Math.round(h)));
    expect(heights.size, `all six toolbar buttons share one height (no button reads as bigger/smaller than its neighbours): ${sizes}`).toBe(1);

    // BACKLOG #13 — the toolbar sits at the BOTTOM on phone (top:8px would float it over the first line of
    // code, exactly where the caret usually is when you start typing).
    // t2155 — the anchor moved from `.editor-toolbar { top:auto; bottom:8px }` (its own absolute position) to
    // `.editor-strip { order: 2 }` (a flex reorder of the whole strip, toolbar included — see styles.css). The
    // toolbar itself is a plain flex child now with no `bottom` of its own; the strip's `order` is a layout
    // instruction, not a resolvable computed-style value like `bottom` was, so this checks the RENDERED rect
    // (where it actually ends up) rather than a CSS property that no longer exists on this element.
    // t2169 — the toolbar alone relocates now (chrome/badge/chips stay up top); unaffected by that split — the
    // toolbar's own rendered position is still what matters here, still near the bottom.
    const barTop = await page.evaluate(() => {
      const bar = document.querySelector('.editor-toolbar');
      return { rectBottom: bar.getBoundingClientRect().bottom, viewportH: window.innerHeight };
    });
    expect(barTop.rectBottom, 'the row sits near the bottom of the viewport, not the top').toBeGreaterThan(barTop.viewportH - 100);

    // t2099 — the corner file menu is gone (t2078); Load/Export reach the quick menu instead, still
    // reachable at phone width, and Clear is still not duplicated into it.
    // t2173 — Insert dropped out of this trio entirely (removed, not relocated).
    expect(await page.evaluate(() => !!document.getElementById('editor-file-btn')), 'the corner file button is gone').toBe(false);
    await page.locator('#hdrPostBtn').click();
    const menu = page.locator('#hdrPostMenu');
    await expect(menu).toBeVisible();
    for (const act of ['fileLoad', 'fileExport']) {
      await expect(menu.locator(`[data-act="${act}"]`), `${act} is in the quick menu at 390px`).toBeVisible();
    }
    await expect(menu.locator('[data-act="fileInsert"]'), 'Insert is gone, not just narrower').toHaveCount(0);
    await expect(menu.locator('[data-act="clear"]'), 'and Clear is not duplicated here').toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.screenshot({ path: 'scratchpad/s1255-phone-trash.png' });
  });
});
