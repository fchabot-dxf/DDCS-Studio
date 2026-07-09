import { test, expect } from '@playwright/test';

test('phone (390): header fits; chevron quick-menu visible; standalone Open/Save hidden (in the chevron)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(300);

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
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(300);
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

test('quick-menu chevron: icon-only; opens Program actions + Post-processor + Theme', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.waitForTimeout(300);

  // Icon-only at full width — no "Auto · …" text leaks onto the chevron.
  const btnText = (await page.locator('#hdrPostBtn').innerText()).trim();
  expect(btnText, 'chevron shows no text label').toBe('');

  // Closed by default; opens on click.
  expect(await page.locator('#hdrPostMenu').isHidden()).toBe(true);
  await page.click('#hdrPostBtn');
  expect(await page.locator('#hdrPostMenu').isHidden()).toBe(false);
  expect(await page.getAttribute('#hdrPostBtn', 'aria-expanded')).toBe('true');

  // Program actions present (Open/Save/Save-as-custom-wizard, plus load/insert/clear/export/standalone).
  // Copy moved to a floating #editor-copy-btn (editor-chrome work, 30492fc), so it's no longer a quick-menu action.
  const programActions = await page.locator('#hdrPostMenu .hdr-quick-item[data-act]:not([data-act="settings"]):not([data-act="checklist"]):not([data-act="rate"])').count();
  expect(programActions, 'eight program actions (incl. Save as custom wizard)').toBe(8);
  expect(await page.locator('#hdrPostMenu .hdr-quick-item[data-act="wizard"]').count(), 'Save as custom wizard row present').toBe(1);
  // Settings opens as a modal from the menu.
  expect(await page.locator('#hdrPostMenu .hdr-quick-item[data-act="settings"]').count(), 'Settings… row present').toBe(1);
  // t598 — the always-available Rate / Feedback utility entry (alongside Settings / checklist).
  expect(await page.locator('#hdrPostMenu .hdr-quick-item[data-act="rate"]').count(), 'Rate / Feedback row present').toBe(1);
  // Exactly one active post and one active theme are checked.
  const postChecked = await page.locator('#hdrPostMenu .hdr-quick-item[data-post][aria-checked="true"]').count();
  const themeChecked = await page.locator('#hdrPostMenu .hq-theme-chip[data-theme][aria-checked="true"]').count();
  expect(postChecked, 'one active post checked').toBe(1);
  expect(themeChecked, 'one active theme checked').toBe(1);

  // Escape closes it.
  await page.keyboard.press('Escape');
  expect(await page.locator('#hdrPostMenu').isHidden()).toBe(true);

  // Reopen: theme chips show directly (no submenu). Pick one → it applies and the menu stays open (try-themes UX).
  await page.click('#hdrPostBtn');
  await page.click('#hdrPostMenu .hq-theme-chip[data-theme="futuristic"]');
  expect(await page.getAttribute('body', 'data-theme')).toBe('futuristic');
  expect(await page.locator('#hdrPostMenu').isHidden()).toBe(false);
});
