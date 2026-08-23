import { test, expect } from '@playwright/test';

test('phone (390): header fits; chevron quick-menu visible; no standalone header disk buttons (retired t2184)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });   // t1307 — the DECLARED boot signal (t1279): `window.ddcsStudio` exists long before the deferred wiring puts handlers on the header/menu controls this spec clicks

  const s = await page.evaluate(() => {
    const h = document.querySelector('.app-header');
    return {
      overflow: h.scrollWidth - h.clientWidth,
      docScrollW: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      chevronVisible: document.getElementById('hdrPostBtn').offsetParent !== null,
      // t2184 (amendment 1) — the standalone macro-bar (#projOpenBtn/#projSaveBtn) is DELETED, not hidden;
      // this asserts it no longer exists at all rather than checking an offsetParent on a removed element.
      macroGone: document.getElementById('macroBar') === null,
      noBurger: document.getElementById('hdrBurger') === null,
    };
  });
  expect(s.overflow, 'header fits on phone').toBeLessThanOrEqual(0);
  expect(s.docScrollW, 'no horizontal page scroll').toBeLessThanOrEqual(s.vw + 1);
  expect(s.chevronVisible, 'quick-menu chevron visible on phone').toBe(true);
  expect(s.macroGone, 'the standalone macro-bar is gone entirely, not just hidden').toBe(true);
  expect(s.noBurger, 'no ☰ burger').toBe(true);
  await page.screenshot({ path: 'tests/_header-390.png', clip: { x: 0, y: 0, width: 390, height: 60 } });
});

test('desktop (1100): quick-menu chevron present; no standalone header disk buttons (retired t2184)', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
  const d = await page.evaluate(() => {
    const h = document.querySelector('.app-header');
    return {
      chevronVisible: document.getElementById('hdrPostBtn').offsetParent !== null,
      macroGone: document.getElementById('macroBar') === null,
      overflow: h.scrollWidth - h.clientWidth,
    };
  });
  expect(d.chevronVisible, 'quick-menu chevron visible on desktop').toBe(true);
  expect(d.macroGone, 'the standalone macro-bar is gone entirely, not just hidden').toBe(true);
  expect(d.overflow, 'no header overflow on desktop').toBeLessThanOrEqual(0);
});

test('quick-menu chip: no stale dialect text on it; opens Program actions + Post-processor', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

  // t2147 (BACKLOG #7, amended) — the chevron is no longer icon-only: the workspace name merged INTO this same
  // button ("lets move the workspace/quickmenu single entry point beside the avatar"). The old claim being
  // guarded here was narrower than "no text at all" — it was "no leftover 'Auto · <dialect>' label", a stale
  // string from a retired feature; the workspace name is the NEW, intended text, not a regression of this rule.
  const btnText = (await page.locator('#hdrPostBtn').innerText()).trim();
  expect(btnText, 'the chip shows the workspace name, not the old dialect label').not.toMatch(/^Auto/);

  // Closed by default; opens on click.
  expect(await page.locator('#hdrPostMenu').isHidden()).toBe(true);
  await page.click('#hdrPostBtn');
  expect(await page.locator('#hdrPostMenu').isHidden()).toBe(false);
  expect(await page.getAttribute('#hdrPostBtn', 'aria-expanded')).toBe('true');

  // Program actions present (load/export/setupSheet/library/checklist). Copy moved to a floating
  // #editor-copy-btn. Save/Open/wizard moved to Library.
  // t2149 (BACKLOG #9) — Rate moved OUT of this menu to the new #hdrAppMenu (the logo) — this menu is FILE
  // scope now (see header-menu-split-2149.spec.js for that split's own coverage). t2184 (amendment 2) —
  // Settings moved BACK here (it's saved into the .ddcs — workspace content, not product chrome).
  // t2184 (amendment 16) — EVERY row in this menu is a `.hq-ws-btn` grid tile now, not a `.hdr-quick-item`
  // (that distinction is retired entirely), so every selector below drops the class.
  expect(await page.locator('#hdrPostMenu [data-act="library"]').count(), 'Library row present').toBe(1);
  // t2184 (amendment 16) — settings is a `.hq-ws-btn` grid tile now, not a standalone `.hdr-quick-item`.
  expect(await page.locator('#hdrPostMenu [data-act="settings"]').count(), 'Settings… lives here now (t2184 amendment 2)').toBe(1);
  expect(await page.locator('#hdrPostMenu [data-act="rate"]').count(), 'Rate / Feedback stays in the app menu, not here').toBe(0);
  // t688 b2 — the dialect (Generate-for) list is GONE from the menu. t1227 — and so is the identity's own door: the
  // machine name + dialect are a quiet DISPLAY line above Save/Open now, with no click of their own.
  // t2147 (BACKLOG #1) — and theme is gone too: Settings' own #set_theme picker is the one door now.
  const dialectItems = await page.locator('#hdrPostMenu .hdr-quick-item[data-post]').count();
  const identityDoors = await page.locator('#hdrPostMenu [data-profact="browse"]').count();
  const identityLine = await page.locator('#hdrPostMenu .hq-identity-line .hq-identity-txt').count();
  const themeChips = await page.locator('#hdrPostMenu .hq-theme-chip').count();
  expect(dialectItems, 'no dialect switching in the menu (moved to Settings)').toBe(0);
  expect(identityDoors, 'the identity is not a door any more (t1227)').toBe(0);
  expect(identityLine, 'it is a plain-text line — still there, just not pressable').toBe(1);
  expect(themeChips, 'no theme chips in this menu any more (BACKLOG #1)').toBe(0);
  // t2149 — Settings…/Rate now live in the app menu (the logo button); see header-menu-split-2149.spec.js for
  // that menu's own row coverage — not duplicated here.

  // Escape closes it.
  await page.keyboard.press('Escape');
  expect(await page.locator('#hdrPostMenu').isHidden()).toBe(true);
});

// t2147 (BACKLOG #1) — theme lost its only tested path when the quick-menu chips left; Settings' own #set_theme
// picker already existed and already switched independently of them (nothing new was built), but it had NO
// test coverage of its own. Closing that gap here, not leaving the surviving door unverified.
test('theme switches from Settings’ own picker (the one door now that the quick-menu chips are gone)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.openSettings, null, { timeout: 20000 });
  await page.evaluate(() => window.openSettings({ group: 'lookfeel', panel: 'set_tab_appearance' }));
  await page.waitForSelector('#set_theme', { timeout: 6000 });
  await page.selectOption('#set_theme', 'futuristic');
  await expect.poll(() => page.getAttribute('body', 'data-theme')).toBe('futuristic');
});
