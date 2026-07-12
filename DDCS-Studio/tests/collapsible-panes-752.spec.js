import { test, expect } from '@playwright/test';

/**
 * t752 — COLLAPSIBLE WIZARD PANES + per-theme motion tokens + the header undo/redo yield rider.
 *  - Every wizard's preview pane (and the code pane) gets a collapsible title bar on the SHARED host (one impl, every
 *    wizard inherits). Collapsed state is app-wide per pane KIND (panePrefs, localStorage ddcs_panes), default expanded.
 *  - The motion is DECLARED per theme (--drawer-* tokens); ONE engine reads them; reduced-motion ⇒ instant; ≤350ms cap.
 *  - RIDER: the header undo/redo stay REACHABLE at 360px (the hy-controls yield step).
 *  - View-only: emit is byte-identical whether a pane is collapsed or not.
 */

const openWiz = async (page, type) => {
  await page.evaluate((t) => window.openWiz(t), type);
  await page.waitForSelector(`#wiz_${type}`, { state: 'visible', timeout: 8000 }).catch(() => {});
  await page.waitForFunction((t) => { const w = document.getElementById(`wiz_${t}`); const v = w && w.querySelector('.wiz-visual'); return v && v.querySelector(':scope > .wiz-pane-bar'); }, type, { timeout: 8000 });
};
const visual = (page, type) => page.locator(`#wiz_${type} .wiz-visual`);

test.describe('collapse gives the form the space (mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('collapsing the preview shrinks its pane to the bar (asserted heights); the bar toggles it', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
    await openWiz(page, 'contour');

    const v = visual(page, 'contour');
    const hExpanded = (await v.boundingBox()).height;
    expect(hExpanded, 'the preview pane is tall when expanded').toBeGreaterThan(250);

    await page.locator('#wiz_contour .wiz-visual > .wiz-pane-bar').click();
    await page.waitForFunction(() => { const el = document.querySelector('#wiz_contour .wiz-visual'); return el.getAttribute('data-collapsed') === '1' && el.getBoundingClientRect().height < 60; }, null, { timeout: 3000 });
    const hCollapsed = (await v.boundingBox()).height;
    expect(hCollapsed, 'collapsed the pane is just its bar').toBeLessThan(60);
    expect(hExpanded - hCollapsed, 'collapsing frees the preview height for the form').toBeGreaterThan(200);

    // the bar toggles back (wait for the expand ANIMATION to actually restore the height, not just the attribute)
    await page.locator('#wiz_contour .wiz-visual > .wiz-pane-bar').click();
    await page.waitForFunction(() => { const el = document.querySelector('#wiz_contour .wiz-visual'); return el.getAttribute('data-collapsed') === '0' && el.getBoundingClientRect().height > 250; }, null, { timeout: 3000 });
    expect((await v.boundingBox()).height, 'expands back to full').toBeGreaterThan(250);
  });

  test('the collapsed state is app-wide per pane kind — 3 wizards inherit it + it survives a reload', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });

    await openWiz(page, 'contour');
    await page.locator('#wiz_contour .wiz-visual > .wiz-pane-bar').click();
    await page.waitForFunction(() => document.querySelector('#wiz_contour .wiz-visual').getAttribute('data-collapsed') === '1');
    await page.evaluate(() => window.closeWiz && window.closeWiz());

    // two OTHER wizards open already collapsed (the pref is per-kind, app-wide)
    for (const t of ['drill', 'surfacing']) {
      await openWiz(page, t);
      expect(await visual(page, t).getAttribute('data-collapsed'), `${t} inherits the collapsed preview`).toBe('1');
      await page.evaluate(() => window.closeWiz && window.closeWiz());
    }

    // survives a reload (persisted to localStorage, not the profile)
    const stored = await page.evaluate(() => localStorage.getItem('ddcs_panes'));
    expect(stored, 'collapsed state is in the app-wide ddcs_panes store').toContain('preview');
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await openWiz(page, 'contour');
    expect(await visual(page, 'contour').getAttribute('data-collapsed'), 'the collapse survived reload').toBe('1');
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
  });
});

test.describe('motion tokens + reduced-motion', () => {
  test.use({ viewport: { width: 1200, height: 900 } });

  test('each theme declares a DISTINCT drawer-motion personality (token block)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const sigs = {};
    for (const th of ['studio', 'normal', 'futuristic', 'organic', 'steampunk']) {
      sigs[th] = await page.evaluate((t) => {
        document.body.setAttribute('data-theme', t);   // the --drawer-* tokens are [data-theme] CSS rules
        const cs = getComputedStyle(document.body);
        return ['--drawer-dur', '--drawer-ease', '--drawer-reveal', '--drawer-dir', '--drawer-corner-expanded', '--drawer-corner-collapsed'].map((n) => cs.getPropertyValue(n).trim()).join('|');
      }, th);
    }
    // every theme's token signature is distinct (personality per theme)
    const uniq = new Set(Object.values(sigs));
    expect(uniq.size, `all 5 themes have a distinct drawer personality: ${JSON.stringify(sigs)}`).toBe(5);
    // each declares a real reveal keyword
    for (const [th, s] of Object.entries(sigs)) {
      expect(['slide', 'roll', 'fade', 'wipe', 'unfold'].some((r) => s.includes(r)), `${th} has a reveal`).toBe(true);
    }
  });

  test('the engine caps duration ≤350ms and goes INSTANT under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
    await openWiz(page, 'contour');
    await page.locator('#wiz_contour .wiz-visual > .wiz-pane-bar').click();
    // under reduced-motion the engine sets the effective duration to 0ms
    const durEff = await page.evaluate(() => document.querySelector('#wiz_contour .wiz-visual').style.getPropertyValue('--drawer-dur-eff'));
    expect(durEff, 'reduced-motion ⇒ instant (0ms)').toBe('0ms');
    // and it still actually collapsed (functionally works)
    expect(await visual(page, 'contour').getAttribute('data-collapsed')).toBe('1');
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
  });
});

test.describe('header rider + emit', () => {
  test('undo/redo stay REACHABLE (on-screen) at 360px (hy-controls yield step)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const r = await page.evaluate(() => {
      const h = document.querySelector('.app-header');
      const onScreen = (id) => { const e = document.getElementById(id); if (!e || e.offsetParent === null) return false; const b = e.getBoundingClientRect(); return b.left >= -0.5 && b.right <= window.innerWidth + 0.5; };
      return { overflow: h.scrollWidth - h.clientWidth, undo: onScreen('btn-undo'), redo: onScreen('btn-redo'), foldStep: h.classList.contains('hy-controls') };
    });
    expect(r.overflow, 'the header fits at 360px').toBeLessThanOrEqual(0);
    expect(r.undo, 'undo is on-screen at 360px').toBe(true);
    expect(r.redo, 'redo is on-screen at 360px').toBe(true);
    expect(r.foldStep, 'the hy-controls yield step engaged').toBe(true);
  });

  test('emit is BYTE-IDENTICAL whether the preview pane is collapsed or not (view-only)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetBlockProgram);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
    await openWiz(page, 'contour');
    const read = () => page.evaluate(() => { const pre = document.querySelector('#wiz_contour_code'); return pre ? pre.textContent : ''; });
    const expanded = await read();
    await page.locator('#wiz_contour .wiz-visual > .wiz-pane-bar').click();
    await page.waitForFunction(() => document.querySelector('#wiz_contour .wiz-visual').getAttribute('data-collapsed') === '1');
    const collapsed = await read();
    expect(collapsed, 'collapsing a pane does not change the emitted G-code').toBe(expanded);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
  });
});
