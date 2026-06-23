import { test, expect } from '@playwright/test';

// During play, the wizard's CODE PREVIEW should highlight the executing line — the same behaviour as the Studio
// main editor. The wizard panel now gets an onLine callback that flags pre[id$="_code"] .g-line.active-line.
test.use({ viewport: { width: 1280, height: 900 } });

test('wizard preview highlights the executing line during play', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  // the drill preview auto-plays on open (loop default); catch the moving highlight within the play window
  const appeared = await page
    .waitForFunction(() => !!document.querySelector('pre[id^="wiz_"][id$="_code"] .g-line.active-line'), { timeout: 6000 })
    .then(() => true)
    .catch(() => false);
  expect(appeared, 'an executing line is highlighted in the wizard code during play').toBeTruthy();

  // the highlighted line is a real, indexed g-line in the drill code preview
  const ok = await page.evaluate(() => {
    const ln = document.querySelector('#wiz_drill_code .g-line.active-line');
    return !!ln && ln.getAttribute('data-line-index') != null;
  });
  expect(ok, 'highlight lands on an indexed code line in #wiz_drill_code').toBeTruthy();
});
