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

test('never-saved clean = hidden → a change reads TEMPORARY → a .ddcs save reads "Saved to file"', async ({ page }) => {
  await ready(page);
  const clean = await page.evaluate(() => ({ dirty: window.ddcsWorkspaceDirtyToFile(), savedAt: window.ddcsFileSavedAt(), chip: (function () { const c = document.getElementById('fileSaveChip'); return { hidden: c.hidden }; })() }));
  expect(clean.dirty, 'a freshly-baselined workspace is not dirty').toBe(false);
  expect(clean.savedAt, 'it has never been saved to a .ddcs file yet').toBe(null);
  expect(clean.chip.hidden, 'clean + never-file-saved → the chip is hidden (nothing to announce)').toBe(true);

  const dirty = await page.evaluate((k) => {
    localStorage.setItem(k, JSON.stringify([{ n: 1 }]));   // a change to the 'presets' backup store
    window.ddcsFileSaveState.refresh();
    const c = document.getElementById('fileSaveChip');
    return { dirty: window.ddcsWorkspaceDirtyToFile(), hidden: c.hidden, isDirty: c.classList.contains('dirty'), text: c.querySelector('.fsc-tx').textContent };
  }, KEY);
  expect(dirty.dirty, 'a workspace change makes it dirty-to-file').toBe(true);
  expect(dirty.hidden, 'the chip shows when there is temporary work').toBe(false);
  expect(dirty.isDirty, 'it uses the .dirty (temporary) styling').toBe(true);
  expect(dirty.text, 'it frames the state as TEMPORARY').toMatch(/Temporary/i);
  expect(dirty.text, 'the temporary state never reads as the saved state').not.toMatch(/Saved to file/i);

  const saved = await page.evaluate(() => {
    window.ddcsMarkWorkspaceSaved();   // exactly what exportEverything() calls after writing the .ddcs
    window.ddcsFileSaveState.refresh();
    const c = document.getElementById('fileSaveChip');
    return { dirty: window.ddcsWorkspaceDirtyToFile(), savedAt: window.ddcsFileSavedAt(), hidden: c.hidden, isSaved: c.classList.contains('saved'), text: c.querySelector('.fsc-tx').textContent };
  });
  expect(saved.dirty, 'saving to a .ddcs clears the dirty signal').toBe(false);
  expect(saved.savedAt, 'a real .ddcs save stamps the time').toBeGreaterThan(0);
  expect(saved.hidden, 'once saved to a file the chip stays visible as a positive status').toBe(false);
  expect(saved.isSaved, 'it switches to the .saved styling').toBe(true);
  expect(saved.text, 'and reads "Saved to file · <ago>" — SAVED reserved for the file').toMatch(/Saved to file/);
});

/**
 * t1221 — NO EXIT WARNING (user ruling). This test used to assert that unsaved-to-file work triggered the browser's
 * leave prompt. It is inverted now, because the warning was about a loss that does not happen: the localStorage buffer
 * SURVIVES a reload and a tab close, so the prompt fired on every refresh over work that was never at risk. A false
 * alarm on every refresh is worse than none — it trains people to click through the real ones. The chip carries the
 * not-saved-to-a-file truth without blocking the gesture.
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
    const chip = document.getElementById('fileSaveChip');
    return { prevented: ev.defaultPrevented, chipText: chip ? chip.textContent : '', chipShown: !!(chip && chip.offsetParent !== null) };
  }, KEY);
  expect(dirty.prevented, 'and NEITHER does unsaved-to-file work — the warning is gone').toBe(false);

  // the state is still told, just not by a popup
  expect(dirty.chipShown, 'the chip is the one that speaks').toBe(true);
  expect(dirty.chipText, 'and it still says the work is only temporary').toMatch(/Temporary/i);

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

  await page.evaluate(() => window.ddcsMarkWorkspaceSaved());
  await page.reload();
  await page.waitForFunction(() => window.ddcsFileSaveState && window.ddcsWorkspaceDirtyToFile);
  expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile()), 'clean after Save survives a reload').toBe(false);
});
