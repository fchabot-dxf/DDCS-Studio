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
 * t1223 (user-refined) — THE INDICATOR IS ONE DISK BUTTON. Always present, because it is the Save control as well as
 * the state: accent = unsaved, muted = saved. It carries NO label and NO timestamp — the colour is the state — and its
 * tooltip is the FILENAME plus the dialect. The old fat pill spelled all of that out in prose beside the icon.
 */
test('the disk button is always present; accent = unsaved, muted = saved; the tooltip names the file + dialect', async ({ page }) => {
  await ready(page);
  const clean = await page.evaluate(() => {
    const c = document.getElementById('fileSaveChip');
    const cs = getComputedStyle(c);
    return { dirty: window.ddcsWorkspaceDirtyToFile(), savedAt: window.ddcsFileSavedAt(), hidden: c.hidden, title: c.title,
             isSaved: c.classList.contains('saved'), isDirty: c.classList.contains('dirty'), text: c.textContent.trim(),
             savedStyle: { filter: cs.filter, opacity: cs.opacity } };
  });
  expect(clean.dirty, 'a freshly-baselined workspace is not dirty').toBe(false);
  expect(clean.savedAt, 'it has never been saved to a .ddcs file yet').toBe(null);
  expect(clean.hidden, 'the disk is ALWAYS present — it is the Save control too').toBe(false);
  expect(clean.isSaved, 'clean reads as the muted/saved styling').toBe(true);
  expect(clean.savedStyle.filter, 'saved = the SAME artwork desaturated, not a different grey shape').toMatch(/grayscale/);
  expect(clean.savedStyle.opacity, 'and it recedes — lower contrast/opacity at rest').not.toBe('1');
  expect(clean.text, 'no label beside the icon').toBe('');
  expect(clean.title, 'the tooltip says WHAT the name is').toMatch(/^Workspace:/);
  expect(clean.title, 'never-saved is stated honestly, not faked as a filename').toMatch(/not saved yet/i);

  await page.evaluate((k) => {
    localStorage.setItem(k, JSON.stringify([{ n: 1 }]));   // a change to the 'presets' backup store
    window.ddcsFileSaveState.refresh();
  }, KEY);
  // the states cross-fade (transition: filter/opacity), and getComputedStyle mid-transition returns the INTERPOLATED
  // value — read the settled style, not the frame the assertion happened to catch
  await page.waitForTimeout(300);
  const dirty = await page.evaluate(() => {
    const c = document.getElementById('fileSaveChip');
    const cs = getComputedStyle(c);
    return { dirty: window.ddcsWorkspaceDirtyToFile(), hidden: c.hidden, isDirty: c.classList.contains('dirty'), text: c.textContent.trim(),
             filter: cs.filter, opacity: cs.opacity, alsoSaved: c.classList.contains('saved') };
  });
  expect(dirty.dirty, 'a workspace change makes it dirty-to-file').toBe(true);
  expect(dirty.hidden, 'still present').toBe(false);
  expect(dirty.isDirty, 'and switches to the accent (attention) styling').toBe(true);
  expect(dirty.text, 'still no label — the colour is the whole message').toBe('');
  expect(dirty.alsoSaved, 'the two states are exclusive').toBe(false);
  expect(dirty.filter, 'unsaved keeps the artwork at FULL colour').toMatch(/none/);
  expect(dirty.opacity, 'and comes forward at full strength — the colour does the work, not a border').toBe('1');

  const saved = await page.evaluate(() => {
    window.ddcsMarkWorkspaceSaved('m350-shop.ddcs');   // exactly what the save path calls after writing the .ddcs
    window.ddcsFileSaveState.refresh();
    const c = document.getElementById('fileSaveChip');
    return { dirty: window.ddcsWorkspaceDirtyToFile(), savedAt: window.ddcsFileSavedAt(), isSaved: c.classList.contains('saved'), title: c.title, text: c.textContent.trim() };
  });
  expect(saved.dirty, 'saving to a .ddcs clears the dirty signal').toBe(false);
  expect(saved.savedAt, 'a real .ddcs save stamps the time').toBeGreaterThan(0);
  expect(saved.isSaved, 'the disk goes muted').toBe(true);
  expect(saved.title, 'the tooltip is labelled, then the FILENAME…').toMatch(/^Workspace: m350-shop\.ddcs/);
  expect(saved.title, '…plus the dialect it generates for').toMatch(/·\s*\S/);
  expect(saved.text, 'and never grows a label or a timestamp').toBe('');
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
    return { prevented: ev.defaultPrevented, chipAccent: !!(chip && chip.classList.contains('dirty')), chipShown: !!(chip && chip.offsetParent !== null) };
  }, KEY);
  expect(dirty.prevented, 'and NEITHER does unsaved-to-file work — the warning is gone').toBe(false);

  // the state is still told, just not by a popup (t1223 — the disk's COLOUR says it, not a label)
  expect(dirty.chipShown, 'the disk button is the one that speaks').toBe(true);
  expect(dirty.chipAccent, 'and it goes accent to say the work is not in a file yet').toBe(true);

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
