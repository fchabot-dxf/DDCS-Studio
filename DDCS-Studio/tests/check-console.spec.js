// Console-error scout (user t858, upgraded from a log-only scratch into a real guard): the app must BOOT with ZERO
// console errors and ZERO page errors — catches module 404s, boot-time ReferenceErrors, and CSP violations that
// individual feature specs never look at. Collected over the boot + 2s of settle; the assert names every offender.
import { test, expect } from '@playwright/test';

// DECLARED expected-absence probes: requests the app makes to DISCOVER optional infrastructure — a 404 there is the
// honest "not present" answer in a gateway-less environment (the static site included), and Chromium logs it as a
// console error no matter how gracefully the app handles it. Everything else stays a hard failure.
// t2129 (review) — '/api/config' joined the list: syncGatewaySound() now pushes the sound toggle once at
// boot (settingsPanel.js), the same "try the optional gateway, log nothing louder than this" shape as the
// existing descriptor probe — added so a gateway-less dev boot (this mem-server included) still reads clean.
const EXPECTED_ABSENCE = ['/api/descriptor', '/api/config'];

test('the app boots with ZERO console/page errors (beyond the declared absence probes)', async ({ page }) => {
  const errors = [];
  const expected = [];
  page.on('response', (r) => { if (r.status() >= 400 && EXPECTED_ABSENCE.some((p) => r.url().includes(p))) expected.push(r.url()); });
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  page.on('pageerror', (err) => errors.push('page: ' + err.message));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.editorManager, null, { timeout: 15000 });
  await page.waitForTimeout(2000);   // the settle window the scratch version watched
  // subtract exactly ONE generic load-failure line per expected-absence hit (Chromium's text carries no URL)
  const unexpected = errors.filter((e) => !/Failed to load resource/.test(e)).concat(
    errors.filter((e) => /Failed to load resource/.test(e)).slice(expected.length));
  expect(unexpected, 'boot console is clean beyond the declared absence probes:\n' + errors.join('\n')).toEqual([]);
});
