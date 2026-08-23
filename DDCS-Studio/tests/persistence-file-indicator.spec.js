import { test, expect } from '@playwright/test';

// PERSISTENCE-A (t1193) — the "unsaved to file" indicator + exit warning. The workspace auto-saves to localStorage
// only; a .ddcs is the sole portable copy. The signal is a content signature over the SAME BACKUP_STORES registry a
// .ddcs writes (data/backup.js), so it is true exactly when a fresh .ddcs would differ from the last one saved/opened.
// The change used below writes a ddcs_tpl_* key — a member of the 'presets' backup store, additive + boot-inert, so it
// survives a reload (a deterministic workspace mutation the boot never normalizes away).
test.use({ viewport: { width: 1400, height: 900 } });

const KEY = 'ddcs_tpl_zzz_persist_test';

async function ready(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsFileSaveState && window.ddcsWorkspaceDirtyToFile && window.ddcsMarkWorkspaceSaved);
  // wait for the boot auto-baseline to actually FIRE (the watermark is written once the seeded state settles) — before
  // that the watermark is null, which reads as "not dirty" too, so we must confirm the baseline exists AND is clean.
  await page.waitForFunction(() => localStorage.getItem('ddcs_file_watermark') != null && window.ddcsWorkspaceDirtyToFile() === false, null, { timeout: 8000 });
}

/**
 * t2188 (amendment 1) — SUPERSEDES the old "one disk button" indicator (t1223): #fileSaveChip is deleted, its
 * STATE job now carried by #hdrWsDirtyDot on the workspace chip itself — always PRESENT in the DOM (its slot
 * never disappears), clean = hidden (visually and from assistive tech), dirty = shown with an accessible name.
 * No filter/opacity cross-fade any more (that was the old chip's own artwork treatment); the dot's own contrast
 * and reflow properties are covered by tests/workspace-dirty-dot-2188.spec.js — this test stays focused on the
 * LIFECYCLE (clean → dirty → saved) this file's own PERSISTENCE-A scope is about.
 */
test('the workspace dot: always present, hidden when clean, shown when dirty, hidden again after a real save', async ({ page }) => {
  await ready(page);
  const clean = await page.evaluate(() => {
    const dot = document.getElementById('hdrWsDirtyDot');
    return { dirty: window.ddcsWorkspaceDirtyToFile(), savedAt: window.ddcsFileSavedAt(), exists: dot !== null, isOn: dot.classList.contains('is-on'), ariaHidden: dot.getAttribute('aria-hidden') };
  });
  expect(clean.dirty, 'a freshly-baselined workspace is not dirty').toBe(false);
  expect(clean.savedAt, 'it has never been saved to a .ddcs file yet').toBe(null);
  expect(clean.exists, 'the dot\'s own slot is ALWAYS present in the DOM').toBe(true);
  expect(clean.isOn, 'clean reads as no visible fill').toBe(false);
  expect(clean.ariaHidden, 'clean is removed from the accessibility tree too').toBe('true');

  await page.evaluate((k) => {
    localStorage.setItem(k, JSON.stringify([{ n: 1 }]));   // a change to the 'presets' backup store
    window.ddcsFileSaveState.refresh();
  }, KEY);
  const dirty = await page.evaluate(() => {
    const dot = document.getElementById('hdrWsDirtyDot');
    return { dirty: window.ddcsWorkspaceDirtyToFile(), exists: dot !== null, isOn: dot.classList.contains('is-on'), ariaLabel: dot.getAttribute('aria-label') };
  });
  expect(dirty.dirty, 'a workspace change makes it dirty-to-file').toBe(true);
  expect(dirty.exists, 'still present').toBe(true);
  expect(dirty.isOn, 'and switches to the visible-fill state').toBe(true);
  expect(dirty.ariaLabel, 'an accessible name that SAYS unsaved, not relying on shape/colour alone').toBe('Unsaved changes');

  const saved = await page.evaluate(() => {
    window.ddcsMarkWorkspaceSaved('m350-shop.ddcs');   // exactly what the save path calls after writing the .ddcs
    window.ddcsFileSaveState.refresh();
    const dot = document.getElementById('hdrWsDirtyDot');
    return { dirty: window.ddcsWorkspaceDirtyToFile(), savedAt: window.ddcsFileSavedAt(), isOn: dot.classList.contains('is-on') };
  });
  expect(saved.dirty, 'saving to a .ddcs clears the dirty signal').toBe(false);
  expect(saved.savedAt, 'a real .ddcs save stamps the time').toBeGreaterThan(0);
  expect(saved.isOn, 'the dot goes hidden again').toBe(false);
});

/**
 * t1221 — NO EXIT WARNING (user ruling). This test used to assert that unsaved-to-file work triggered the browser's
 * leave prompt. It is inverted now, because the warning was about a loss that does not happen: the localStorage buffer
 * SURVIVES a reload and a tab close, so the prompt fired on every refresh over work that was never at risk. A false
 * alarm on every refresh is worse than none — it trains people to click through the real ones. t2188 — the workspace
 * dot carries the not-saved-to-a-file truth now, without blocking the gesture (the disk chip that used to is gone).
 */
test('closing or reloading is NEVER blocked — the buffer survives, so there is nothing to warn about', async ({ page }) => {
  await ready(page);
  const whenClean = await page.evaluate(() => {
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(whenClean, 'a clean workspace does not block exit').toBe(false);

  const dirty = await page.evaluate((k) => {
    localStorage.setItem(k, JSON.stringify([{ n: 2 }]));
    window.ddcsFileSaveState.refresh();
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    const dot = document.getElementById('hdrWsDirtyDot');
    return { prevented: ev.defaultPrevented, dotOn: !!(dot && dot.classList.contains('is-on')), dotExists: dot !== null };
  }, KEY);
  expect(dirty.prevented, 'and NEITHER does unsaved-to-file work — the warning is gone').toBe(false);

  // the state is still told, just not by a popup (t2188 — the dot's fill says it, not a label)
  expect(dirty.dotExists, 'the workspace chip\'s own dot is the one that speaks').toBe(true);
  expect(dirty.dotOn, 'and it shows to say the work is not in a file yet').toBe(true);

  // the real reason the warning was wrong: the buffer is still there afterwards
  await page.reload();
  await page.waitForFunction(() => window.ddcsFileSaveState);
  const survived = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
  expect(survived, 'the buffer survives the reload the prompt used to warn about').toEqual([{ n: 2 }]);
});

test('the dirty state persists across a reload (watermark is stored), and Save survives too', async ({ page }) => {
  await ready(page);
  await page.evaluate((k) => { localStorage.setItem(k, JSON.stringify([{ n: 3 }])); window.ddcsFileSaveState.refresh(); }, KEY);
  expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile()), 'dirty before reload').toBe(true);

  await page.reload();
  await page.waitForFunction(() => window.ddcsFileSaveState && window.ddcsWorkspaceDirtyToFile);
  expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile()), 'still dirty after reload (unsaved work is not in a file)').toBe(true);

  // t1231 — a save is a FILE with a NAME (the nameless mark is what produced "Untitled workspace - Saved"), so the
  // save being simulated here names the file it wrote.
  await page.evaluate(() => window.ddcsMarkWorkspaceSaved('bench.ddcs'));
  await page.reload();
  await page.waitForFunction(() => window.ddcsFileSaveState && window.ddcsWorkspaceDirtyToFile);
  expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile()), 'clean after Save survives a reload').toBe(false);
});
