import { test, expect } from '@playwright/test';

// Guards the project Open drawer's import chain (projectModal → googlePicker → googleDrive/providers). A broken
// import here previously killed the drawer and left the Open/Save buttons dead, so assert it opens cleanly and
// the Cloud tab renders with no page errors.
//
// Open/Save moved OUT of the standalone macro-bar (now display:none) and INTO the header chevron quick-menu
// (#hdrPostBtn → [data-act="open"], which clicks the still-wired but hidden #projOpenBtn). Drive that real flow.
test.use({ viewport: { width: 1280, height: 900 } });

test('project Open drawer + Cloud tab load without import errors', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  // Open the header quick-menu, re-clicking the chevron if a full-suite init-race left the first click unwired (the
  // menu item exists but stays hidden until the menu opens). Click only WHILE hidden so an already-open menu is never
  // toggled shut.
  const openItem = page.locator('#hdrPostMenu .hdr-quick-item[data-act="open"]');
  await expect.poll(async () => {
    if (!(await openItem.isVisible().catch(() => false))) await page.click('#hdrPostBtn').catch(() => {});
    return openItem.isVisible().catch(() => false);
  }, { timeout: 15000, intervals: [200, 400, 600, 800] }).toBeTruthy();
  await openItem.click();                                                          // Open project → opens the drawer
  await page.waitForSelector('.proj-voltab', { timeout: 15000 });   // drawer rendered → projectModal loaded (timeouts generous for full-suite load)
  await page.click('.proj-voltab[data-vol="cloud"]');             // exercise the cloud render path
  // wait for the cloud pane deterministically (no fixed sleep — under full-suite load 200ms isn't enough)
  await page.waitForSelector('#projCloud, .cloud-login, .proj-cloudmount', { timeout: 15000 });

  // not connected → connect buttons show (no crash); the import chain resolved
  expect(await page.evaluate(() => !!document.querySelector('#projCloud, .cloud-login, .proj-cloudmount')), 'cloud tab rendered').toBeTruthy();
  expect(errs, 'no page errors (cloud imports resolved)').toEqual([]);
});
