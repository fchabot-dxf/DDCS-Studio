import { test, expect } from '@playwright/test';

// Settings panel: a primary Done button in a footer; Feedback moved to just before About; a FAQ tab (before
// Feedback) with collapsible entries. Also guards that the added markup didn't break the panel.
test.use({ viewport: { width: 1280, height: 900 } });

test('settings has a Done button, a FAQ tab, and Feedback sits before About', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.openSettings);
  await page.evaluate(() => window.openSettings());
  await page.waitForFunction(() => document.querySelector('#settings-app .settings-done'));

  const r = await page.evaluate(() => {
    const order = [...document.querySelectorAll('.settings-sidebar .settings-tab[data-group="general"]')].map((b) => b.dataset.target);
    document.querySelector('.settings-tab[data-target="set_tab_faq"]').click();
    return {
      hasDone: !!document.querySelector('#settings-app .settings-done'),
      doneCloses: typeof window.closeSettings === 'function',
      order,
      faqShown: getComputedStyle(document.getElementById('set_tab_faq')).display !== 'none',
      faqItems: document.querySelectorAll('#set_tab_faq details').length,
      profilePanel: !!document.getElementById('set_tab_profile'),   // sanity: panels still present
    };
  });

  expect(r.hasDone, 'Done button present').toBeTruthy();
  expect(r.doneCloses, 'closeSettings exists for Done').toBeTruthy();
  expect(r.profilePanel, 'panels intact (markup not broken)').toBeTruthy();
  expect(r.faqShown, 'FAQ panel shows on click').toBeTruthy();
  expect(r.faqItems, 'FAQ has several entries').toBeGreaterThanOrEqual(10);
  const faq = r.order.indexOf('set_tab_faq'), fb = r.order.indexOf('set_tab_feedback'), ab = r.order.indexOf('set_tab_about');
  expect(fb, 'Feedback immediately before About').toBe(ab - 1);
  expect(faq, 'FAQ before Feedback').toBeLessThan(fb);

  // Done closes the panel (closeSettings removes .active from #settings-overlay).
  await page.evaluate(() => document.querySelector('#settings-app .settings-done').click());
  await page.waitForTimeout(80);
  const closed = await page.evaluate(() => { const ov = document.getElementById('settings-overlay'); return !ov || !ov.classList.contains('active'); });
  expect(closed, 'Done closed the settings').toBeTruthy();
});
