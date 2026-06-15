import { test, expect } from '@playwright/test';

// Guards the project Open drawer's import chain (projectModal → googlePicker → googleDrive/providers). A broken
// import here previously killed the drawer and left the Open/Save buttons dead, so assert it opens cleanly and
// the Cloud tab renders with no page errors.
test.use({ viewport: { width: 1280, height: 900 } });

test('project Open drawer + Cloud tab load without import errors', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  await page.click('#projOpenBtn');
  await page.waitForSelector('.proj-voltab', { timeout: 5000 });   // drawer rendered → projectModal loaded
  await page.click('.proj-voltab[data-vol="cloud"]');             // exercise the cloud render path
  await page.waitForTimeout(200);

  // not connected → connect buttons show (no crash); the import chain resolved
  expect(await page.evaluate(() => !!document.querySelector('#projCloud, .cloud-login, .proj-cloudmount')), 'cloud tab rendered').toBeTruthy();
  expect(errs, 'no page errors (cloud imports resolved)').toEqual([]);
});
