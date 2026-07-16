import { test, expect } from '@playwright/test';

/**
 * t899 RIDER 5 — the SANCTIONED write door for #520. Probe programs NEVER write the persistent safe-Z register (they
 * READ it with a baked fallback — safe-z-retract-822 asserts the read-only invariant). The ONLY write is the Settings
 * safe-Z margin "Apply to #520" button: a CONFIRMED one-line run-once job (`#520=<margin>` / `M30`, deliver-only) to the
 * LIVE controller via submitJob, which surfaces in the Gateway > Jobs history.
 *
 * We mock the gateway by intercepting the same-origin POST /api/jobs (client.js submitJob → postJSON) and asserting the
 * exact program submitted + that the CONFIRM gates it (cancel → no submit).
 */
async function openMachineSettings(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.openSettings);
  await page.evaluate(() => window.openSettings({ group: 'hardware', panel: 'set_tab_machine' }));
  await page.waitForSelector('#set_safez_apply', { state: 'visible' });
}

// capture every POST /api/jobs body; fulfill with a mock gateway response (a queued job id)
async function mockGateway(page) {
  const posts = [];
  await page.route('**/api/jobs', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') { try { posts.push(JSON.parse(req.postData() || '{}')); } catch { posts.push({ raw: req.postData() }); } }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jobId: 'TEST-J1', name: 'set-safez-520.nc', tracked: false }) });
  });
  return posts;
}

test('Apply-Now submits the confirmed one-liner #520=<margin> / M30 (deliver-only) to the gateway', async ({ page }) => {
  const posts = await mockGateway(page);
  await openMachineSettings(page);
  // set a distinctive margin (7 mm below home → machine Z -7)
  await page.evaluate(() => { const f = document.getElementById('set_safez_margin'); f.value = '7'; f.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.click('#set_safez_apply');
  // the CONFIRM gate appears (danger) — accept it
  await expect(page.locator('.app-dialog')).toContainText('#520');
  await page.locator('.app-dialog').getByRole('button', { name: 'Write #520 now' }).click();
  await expect.poll(() => posts.length, { timeout: 4000 }).toBe(1);
  expect(posts[0].name, 'the job has a distinct name so it is identifiable in Gateway > Jobs history').toBe('set-safez-520.nc');
  expect(posts[0].nc, 'the program writes #520 to the NEGATIVE machine Z and ends with M30').toBe('#520=-7\nM30\n');
  expect(posts[0].map, 'deliver-only — no beacon tracking map').toBeFalsy();
});

test('Apply-Now is gated by the confirm: Cancel submits NOTHING', async ({ page }) => {
  const posts = await mockGateway(page);
  await openMachineSettings(page);
  await page.click('#set_safez_apply');
  await expect(page.locator('.app-dialog')).toBeVisible();
  await page.locator('.app-dialog').getByRole('button', { name: 'Cancel' }).click();
  await page.waitForTimeout(300);
  expect(posts.length, 'cancel aborted the write — #520 is never touched without an explicit confirm').toBe(0);
});
