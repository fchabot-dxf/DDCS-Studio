import { test, expect } from '@playwright/test';

test('phone (390): header fits; chevron quick-menu visible; standalone Open/Save hidden (in the chevron)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });   // t1307 — the DECLARED boot signal (t1279): `window.ddcsStudio` exists long before the deferred wiring puts handlers on the header/menu controls this spec clicks

  const s = await page.evaluate(() => {
    const h = document.querySelector('.app-header');
    const macro = document.getElementById('macroBar');
    return {
      overflow: h.scrollWidth - h.clientWidth,
      docScrollW: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      chevronVisible: document.getElementById('hdrPostBtn').offsetParent !== null,
      macroHidden: macro.offsetParent === null,
      noBurger: document.getElementById('hdrBurger') === null,
    };
  });
  expect(s.overflow, 'header fits on phone').toBeLessThanOrEqual(0);
  expect(s.docScrollW, 'no horizontal page scroll').toBeLessThanOrEqual(s.vw + 1);
  expect(s.chevronVisible, 'quick-menu chevron visible on phone').toBe(true);
  expect(s.macroHidden, 'standalone Open/Save hidden on phone (now in the chevron)').toBe(true);
  expect(s.noBurger, 'no ☰ burger').toBe(true);
  await page.screenshot({ path: 'tests/_header-390.png', clip: { x: 0, y: 0, width: 390, height: 60 } });
});

test('desktop (1100): quick-menu chevron present; standalone Open/Save moved into it', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
  const d = await page.evaluate(() => {
    const h = document.querySelector('.app-header');
    return {
      chevronVisible: document.getElementById('hdrPostBtn').offsetParent !== null,
      macroHidden: document.getElementById('macroBar').offsetParent === null,
      overflow: h.scrollWidth - h.clientWidth,
    };
  });
  expect(d.chevronVisible, 'quick-menu chevron visible on desktop').toBe(true);
  expect(d.macroHidden, 'standalone Open/Save hidden on desktop (moved into the chevron)').toBe(true);
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

  // Program actions present (load/insert/clear/export/setupSheet/settings/library/checklist/rate).
  // Copy moved to a floating #editor-copy-btn. Save/Open/wizard moved to Library. Standalone moved to Settings.
  const programActions = await page.locator('#hdrPostMenu .hdr-quick-item[data-act]').count();
  // Expect fewer items now. Let's just check the ones that exist.
  expect(await page.locator('#hdrPostMenu .hdr-quick-item[data-act="library"]').count(), 'Library row present').toBe(1);
  // Settings opens as a modal from the menu.
  expect(await page.locator('#hdrPostMenu .hdr-quick-item[data-act="settings"]').count(), 'Settings… row present').toBe(1);
  // t598 — the always-available Rate / Feedback utility entry (alongside Settings / checklist).
  expect(await page.locator('#hdrPostMenu .hdr-quick-item[data-act="rate"]').count(), 'Rate / Feedback row present').toBe(1);
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
