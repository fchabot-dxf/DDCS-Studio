import { test, expect } from '@playwright/test';

// Guardrail [B] — the atc_change install banner is a live TRI-STATE when a gateway is connected: it VERIFIES (read-only)
// that T.nc actually exists on the controller (client.readSysfile('T.nc')). Driven with a MOCKED gateway (the real
// /api/sysfile + /api/descriptor endpoints are stubbed). Asserts the banner VALUE per state:
//   GREEN  installed-verified   ·   RED  not-found-on-controller   ·   AMBER  can't verify (no gateway)
// The real-machine verification is flagged for the human's next connected session (can't exercise a live controller here).

async function openChangeWizard(page, method) {
  await page.waitForFunction(() => typeof window.updateWiz === 'function');
  await page.evaluate(() => window.openWiz('atc_change'));
  await page.locator('#atc_change_method').selectOption(method);   // an automatic method in the default T# M6 mode → the banner shows
}
const connect = (page, bridged) => page.evaluate((b) => document.dispatchEvent(new CustomEvent('ddcs:gateway-status', { detail: { bridged: b } })), bridged);
const stubDescriptorOk = (page) => page.route('**/api/descriptor', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, device: 'DDCS Expert' }) }));

test('[B] GREEN — T.nc installed on the controller (gateway verified)', async ({ page }) => {
  await stubDescriptorOk(page);
  await page.route('**/api/sysfile*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, name: 'T.nc', content: '( T.nc )\nIF #1504==#1300 GOTO999\nN999\nM99\n' }) }));
  await page.goto('http://localhost:3211');
  await openChangeWizard(page, 'firmware');
  await connect(page, true);
  const banner = page.locator('#atc_change_macrodep');
  await expect(banner).toBeVisible();
  await expect(banner, 'GREEN: verified installed').toContainText('T.nc installed on the controller');
  await expect(banner).toContainText('verified via the connected gateway');
});

test('[B] RED — T.nc NOT FOUND on the connected controller', async ({ page }) => {
  await stubDescriptorOk(page);
  await page.route('**/api/sysfile*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, name: 'T.nc' }) }));   // connected, but no T.nc
  await page.goto('http://localhost:3211');
  await openChangeWizard(page, 'firmware');
  await connect(page, true);
  const banner = page.locator('#atc_change_macrodep');
  await expect(banner).toBeVisible();
  await expect(banner, 'RED: not found on the controller').toContainText('T.nc NOT FOUND on the controller');
  await expect(banner).toContainText('NOTHING');
});

test('[B] AMBER — no gateway connected → can\'t verify (today\'s install text)', async ({ page }) => {
  await page.route('**/api/descriptor', (r) => r.abort());   // no gateway answers
  await page.goto('http://localhost:3211');
  await openChangeWizard(page, 'firmware');
  await connect(page, false);
  const banner = page.locator('#atc_change_macrodep');
  await expect(banner).toBeVisible();
  await expect(banner, 'AMBER: unverified install reminder (unchanged text)').toContainText('Calls your installed T.nc macro');
  await expect(banner).toContainText('NOTHING');
  await expect(banner, 'NOT the verified-green text').not.toContainText('installed on the controller');
});

test('[B] the tri-state re-verifies live: RED → GREEN when T.nc appears', async ({ page }) => {
  await stubDescriptorOk(page);
  let installed = false;
  await page.route('**/api/sysfile*', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(installed ? { ok: true, name: 'T.nc', content: '( T.nc )\nM99\n' } : { ok: false, name: 'T.nc' }) }));
  await page.goto('http://localhost:3211');
  await openChangeWizard(page, 'generic');
  await connect(page, true);
  const banner = page.locator('#atc_change_macrodep');
  await expect(banner).toContainText('T.nc NOT FOUND on the controller');   // starts missing
  // the operator installs T.nc, then a reconnect re-verifies (a read-only re-check)
  installed = true;
  await connect(page, false);
  await connect(page, true);
  await expect(banner, 'a live re-check flips RED → GREEN').toContainText('T.nc installed on the controller');
});
