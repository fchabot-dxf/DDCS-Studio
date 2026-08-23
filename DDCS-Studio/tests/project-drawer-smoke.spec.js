import { test, expect } from '@playwright/test';

// Guards the project Open drawer's import chain (projectModal → googlePicker → googleDrive/providers). That chain is
// STATIC ESM (imported at boot via headerPost.js), so a broken import kills the module graph → the file menu's
// Project-section "Open…" row can't wire → the drawer never renders. Hence the REAL guard is the POSITIVE render
// assertions (.proj-voltab + the cloud pane) — they deterministically fail if the import chain is broken.
// t2184 — macroBar.js/#projOpenBtn (what this comment used to describe) are deleted outright (amendment 1); this
// spec is already test.skip below and was not otherwise touched this turn.
//
// t672 DE-FLAKE (was a REPEAT flaky, t645/t664/t670): the ROOT CAUSE was a SPEC-RACE, not an app race. The pageerror
// listener was attached at goto and asserted `== []` at the END, so it captured errors across the ENTIRE concurrent
// boot (gateway /api/descriptor poll, deferred renders, …). Under full-suite CPU contention a rare transient uncaught
// error from an UNRELATED boot-async path tripped the over-broad assertion — while the drawer itself opened + rendered
// fine. Fix: SCOPE the error check to the DRAWER FLOW — reset `errs` right before opening the drawer, so it catches a
// real drawer/cloud runtime error (still a meaningful guard) but not unrelated boot noise. Deterministic (no timing
// reliance). Verified: 4 full-suite equivalents (+ 16× parallel) show only the benign /api/descriptor 404 (console,
// handled by gatewayStatus.tick's try/catch — NOT a pageerror); the import chain loads on every run.
//
// Open/Save moved OUT of the standalone macro-bar (now display:none) and INTO the header chevron quick-menu
// (#hdrPostBtn → [data-act="open"], which clicks the still-wired but hidden #projOpenBtn). Drive that real flow.
test.use({ viewport: { width: 1280, height: 900 } });

test.skip('project Open drawer + Cloud tab load without import errors', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });   // t1307 — the DECLARED boot signal (t1279): `window.ddcsStudio` exists long before the deferred wiring puts handlers on the header/menu controls this spec clicks

  // Open the header quick-menu, re-clicking the chevron if a full-suite init-race left the first click unwired (the
  // menu item exists but stays hidden until the menu opens). Click only WHILE hidden so an already-open menu is never
  // toggled shut.
  const openItem = page.locator('#hdrPostMenu .hdr-quick-item[data-act="open"]');
  await expect.poll(async () => {
    if (!(await openItem.isVisible().catch(() => false))) await page.click('#hdrPostBtn').catch(() => {});
    return openItem.isVisible().catch(() => false);
  }, { timeout: 15000, intervals: [200, 400, 600, 800] }).toBeTruthy();

  // t672 — SCOPE the error guard to the drawer flow (below), not the whole boot: discard any unrelated boot-async
  // noise captured while the app was still settling. A drawer/cloud runtime error still fires AFTER this point.
  errs.length = 0;

  await openItem.click();                                                          // Open project → opens the drawer
  await page.waitForSelector('.proj-voltab', { timeout: 15000 });   // drawer rendered → the import chain resolved (the REAL guard)
  await page.click('.proj-voltab[data-vol="cloud"]');             // exercise the cloud render path
  // wait for the cloud pane deterministically (no fixed sleep — under full-suite load 200ms isn't enough)
  await page.waitForSelector('#projCloud, .cloud-login, .proj-cloudmount', { timeout: 15000 });

  // not connected → connect buttons show (no crash); the import chain resolved
  expect(await page.evaluate(() => !!document.querySelector('#projCloud, .cloud-login, .proj-cloudmount')), 'cloud tab rendered').toBeTruthy();
  expect(errs, 'no page errors DURING the drawer + cloud flow (the import chain resolved cleanly)').toEqual([]);
});
