import { test, expect } from '@playwright/test';

/**
 * header-account-2077 — THE ONE ACCOUNT DOOR, and the header space it was given (t2077).
 *
 * Sign-in used to live in TWO places that read DIFFERENT state (Library's cloud account off localStorage,
 * Gateway Setup's Connect off the gateway) while secretly sharing ONE credential in the exe — so connecting
 * in one left the other saying "not connected". The human hit exactly that and asked for one login, in the
 * header, because it is a first-run action.
 *
 * Room was made by DELETING the permanently-hidden Transfer button and MOVING undo/redo into the editor pane
 * (the t1227 "moved not lost" precedent) — plus the Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y bindings they never had.
 * The last test is the one that matters most: program-undo must NOT hijack Ctrl+Z while the user is typing.
 */
test.use({ viewport: { width: 1280, height: 900 } });

test('header account chip: signed-out shows a real Sign in control', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
  const chip = await page.evaluate(() => {
    const h = document.getElementById('hdrAccount');
    const b = h?.querySelector('button');
    return { exists: !!h, inHeader: !!h?.closest('.app-header'), cls: h?.className,
             signInLabel: b?.getAttribute('aria-label'), hasSlot: !!h?.querySelector('.hdr-acct-slot') };
  });
  expect(chip.exists, 'the account chip is mounted').toBe(true);
  expect(chip.inHeader, 'it lives in the top header').toBe(true);
  expect(chip.signInLabel, 'signed out is a generic avatar whose accessible name is Sign in').toBe('Sign in');
  expect(chip.hasSlot, 'it renders the shared round avatar slot').toBe(true);
  expect(chip.cls).toContain('signed-out');
});

test('signed-in state renders avatar + name from stored account', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
  await page.evaluate(() => {
    localStorage.setItem('ddcs_cloud_token', 'tok');
    localStorage.setItem('ddcs_cloud_provider', 'google');
    localStorage.setItem('ddcs_cloud_name', 'Fred Chabot');
    localStorage.setItem('ddcs_cloud_email', 'fred@example.com');
    window.dispatchEvent(new CustomEvent('ddcs:cloud-account'));
  });
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const h = document.getElementById('hdrAccount');
    return { cls: h.className, ini: h.querySelector('.hdr-acct-ini')?.textContent,
             label: h.querySelector('button')?.getAttribute('aria-label') || '',
             sameShape: !!h.querySelector('.hdr-acct-slot') };
  });
  expect(r.cls).toContain('signed-in');
  expect(r.ini, 'initials fallback when no photo').toBe('FC');
  expect(r.label, 'the account is named for screen readers even with no visible text').toContain('Fred');
  expect(r.sameShape, 'signed in reuses the SAME round slot — the header must not restyle on sign-in').toBe(true);
});

test('the transfer button is gone and undo/redo moved into the editor pane', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
  const r = await page.evaluate(() => ({
    transfer: !!document.getElementById('transferBtn'),
    undoInHeader: !!document.querySelector('.hdr-controls #btn-undo'),
    undoExists: !!document.getElementById('btn-undo'),
    redoExists: !!document.getElementById('btn-redo'),
    blockShiftButtonsGone: !document.getElementById('editor-indent') && !document.getElementById('editor-outdent'),
  }));
  expect(r.blockShiftButtonsGone, 'the retired block-shift buttons stay gone').toBe(true);
  expect(r.transfer, 'transfer button deleted').toBe(false);
  expect(r.undoInHeader, 'undo no longer in the header').toBe(false);
  expect(r.undoExists && r.redoExists, 'undo/redo still exist (moved, not lost)').toBe(true);
});

test('Ctrl+Z is ignored while typing in a text field (native undo keeps it)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
  const fired = await page.evaluate(() => {
    let called = 0;
    const real = window.ddcsUndo; window.ddcsUndo = () => { called++; };
    const ed = document.getElementById('editor'); ed.focus();
    ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    window.ddcsUndo = real;
    return called;
  });
  expect(fired, 'program undo must NOT hijack Ctrl+Z inside the editor textarea').toBe(0);
});
