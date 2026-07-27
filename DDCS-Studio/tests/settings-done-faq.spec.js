import { test, expect } from '@playwright/test';

// Settings panel: a primary Done button in a footer.
//
// t1245 — the FAQ / Feedback / About part of this spec MOVED with its subject. Those three left Settings entirely
// (FAQ + About are now the quick menu's Help panel; Feedback merged into Rate / Feedback), so asking Settings about
// them would only prove they are absent. The questions themselves are worth keeping and are asked below of the
// surface that now answers them — plus a guard that Settings did not keep a copy.
test.use({ viewport: { width: 1280, height: 900 } });

test('settings has a Done button — and no longer carries FAQ / Feedback / About (t1245)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.openSettings);
  await page.evaluate(() => window.openSettings());
  await page.waitForFunction(() => document.querySelector('#settings-app .settings-done'));

  const r = await page.evaluate(() => ({
    hasDone: !!document.querySelector('#settings-app .settings-done'),
    doneCloses: typeof window.closeSettings === 'function',
    profilePanel: !!document.getElementById('set_tab_profile'),   // sanity: panels still present
    // the three that LEFT — Settings must not keep a copy of any of them
    leftovers: ['set_tab_faq', 'set_tab_feedback', 'set_tab_about'].filter((id) => document.getElementById(id)),
  }));

  expect(r.hasDone, 'Done button present').toBeTruthy();
  expect(r.doneCloses, 'closeSettings exists for Done').toBeTruthy();
  expect(r.profilePanel, 'panels intact (markup not broken)').toBeTruthy();
  expect(r.leftovers, 'FAQ / Feedback / About left Settings — no duplicate stayed behind').toEqual([]);

  // Done closes the panel (closeSettings removes .active from #settings-overlay).
  await page.evaluate(() => document.querySelector('#settings-app .settings-done').click());
  await page.waitForTimeout(80);
  const closed = await page.evaluate(() => { const ov = document.getElementById('settings-overlay'); return !ov || !ov.classList.contains('active'); });
  expect(closed, 'Done closed the settings').toBeTruthy();
});

// t1245 — the questions that moved, asked of the surface that now answers them.
test('HELP holds the FAQ and About, opens from the quick menu, and the FAQ still has its entries', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && document.querySelector('#hdrPostMenu .hdr-quick-head'), null, { timeout: 15000 });
  await page.click('#hdrPostBtn');
  await page.waitForSelector('#hdrPostMenu:not([hidden])');
  await page.click('#hdrPostMenu [data-act="help"]');
  await expect(page.locator('#helpOverlay')).toBeVisible({ timeout: 6000 });

  const h = await page.evaluate(() => ({
    faqItems: document.querySelectorAll('#help_faq details').length,
    hasAbout: /DDCS STUDIO/i.test(document.getElementById('help_about').textContent),
    hasCredits: /CREDITS/i.test(document.getElementById('help_about').textContent),
    version: (document.getElementById('help_about_ver') || {}).textContent,
    // the FAQ answer that used to send people to the retired Settings > Feedback tab
    pointsAtRate: /Rate \/ Feedback/.test(document.getElementById('help_faq').textContent),
    stillPointsAtSettingsFeedback: /Settings → <b>Feedback/.test(document.getElementById('help_faq').innerHTML),
  }));
  expect(h.faqItems, 'the FAQ came over whole').toBeGreaterThanOrEqual(10);
  expect(h.hasAbout, 'About came with it').toBe(true);
  expect(h.hasCredits, 'credits and all').toBe(true);
  expect(h.version, 'and the version reads from the one .ver source, not a hard-coded string').toMatch(/\d/);
  expect(h.pointsAtRate, 'the bug-report answer names the ONE feedback door').toBe(true);
  expect(h.stillPointsAtSettingsFeedback, 'and no longer names the retired one').toBe(false);

  await page.keyboard.press('Escape');
  await expect(page.locator('#helpOverlay')).toHaveCount(0);
});
