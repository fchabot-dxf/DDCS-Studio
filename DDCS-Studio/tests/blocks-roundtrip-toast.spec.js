import { test, expect } from '@playwright/test';

// ROUND-TRIP DISCOVERABILITY (human 07-04): make the invisible form↔Blocks round-trip legible — a ONE-TIME toast on
// the first wizard-op insert + a Settings FAQ entry. Reuses the shared transient toast; a persisted flag shows it once.

test('round-trip toast: shows ONCE on the first wizard-op insert, never again', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => localStorage.removeItem('ddcs_seen_blocks_roundtrip'));   // fresh profile

  // FIRST insert → the one-time Blocks round-trip toast appears + the persisted flag is set.
  const first = await page.evaluate(async () => {
    const wm = window.ddcsStudio.wizardManager;
    wm.open('drill'); wm.update();
    await wm.insert();
    const t = document.querySelector('.toast');
    return { text: t ? t.textContent : null, flag: localStorage.getItem('ddcs_seen_blocks_roundtrip') };
  });
  expect(first.text, 'the toast shows on the first insert').toContain('editable block stack');
  expect(first.text, 'and points at the Blocks tab').toContain('Blocks');
  expect(first.flag, 'the once-ever flag is persisted').toBe('1');

  // SECOND insert (flag now set) → NO toast (never nags).
  const second = await page.evaluate(async () => {
    document.querySelectorAll('.toast').forEach((t) => t.remove());   // clear the first toast's DOM
    const wm = window.ddcsStudio.wizardManager;
    wm.open('drill'); wm.update();
    await wm.insert();
    const t = document.querySelector('.toast');
    return t ? t.textContent : null;
  });
  expect(second, 'no toast on subsequent inserts — shown once ever').toBeNull();
});

test('round-trip FAQ: the Settings FAQ explains editing a wizard op in Blocks', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings);
  await page.evaluate(async () => { const { openSettings } = await import('/ui/settingsPanel.js'); openSettings({ group: 'general', panel: 'set_tab_faq' }); });
  const faq = page.locator('#set_tab_faq');
  await expect(faq, 'the FAQ has the round-trip entry').toContainText('Can I edit a wizard op after inserting it?');
  await expect(faq, 'it names the editable block stack').toContainText('editable block stack');
  await expect(faq, 'and the round-trip back to the form').toContainText('round-trip back to the wizard form');
});
