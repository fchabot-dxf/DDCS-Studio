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
 * never disappears), dirty = shown with an accessible name. No filter/opacity cross-fade any more (that was
 * the old chip's own artwork treatment); the dot's own contrast and reflow properties are covered by
 * tests/workspace-dirty-dot-2188.spec.js — this test stays focused on the LIFECYCLE (never-saved → dirty →
 * saved) this file's own PERSISTENCE-A scope is about.
 *
 * BACKLOG #25 (owner-ruled 2026-08-26) — "clean" at a fresh boot is NOT the hidden state any more: no .ddcs
 * has EVER been written here, which is the MORE urgent of the two problem states this dot now distinguishes
 * (workspace-dirty-dot-2188.spec.js has the full shape-distinction account) — rebaselined below, not silenced,
 * since a never-saved workspace genuinely has no backup regardless of whether THIS session happens to match
 * its own localStorage watermark.
 */
test('the workspace dot: always present, a HOLLOW RING before any save, FILLED once dirty, hidden again after a real save', async ({ page }) => {
  await ready(page);
  const neverSaved = await page.evaluate(() => {
    const dot = document.getElementById('hdrWsDirtyDot');
    return { dirty: window.ddcsWorkspaceDirtyToFile(), savedAt: window.ddcsFileSavedAt(), exists: dot !== null, isOn: dot.classList.contains('is-on'), isNeverSaved: dot.classList.contains('is-never-saved'), ariaHidden: dot.getAttribute('aria-hidden') };
  });
  expect(neverSaved.dirty, 'a freshly-baselined workspace is not dirty (a separate fact from having no file)').toBe(false);
  expect(neverSaved.savedAt, 'it has never been saved to a .ddcs file yet').toBe(null);
  expect(neverSaved.exists, 'the dot\'s own slot is ALWAYS present in the DOM').toBe(true);
  expect(neverSaved.isOn, 'visible — a hollow ring, not hidden: no file anywhere is the more urgent state').toBe(true);
  expect(neverSaved.isNeverSaved, 'the hollow-ring shape class').toBe(true);
  expect(neverSaved.ariaHidden, 'exposed to assistive tech').toBeNull();

  // BACKLOG #25 — "Unsaved changes" is the label for a REAL file gone stale, not for never-having-saved at
  // all (that's the ring, asserted above with its own label) — so a real file must exist first, THEN dirty it.
  await page.evaluate((k) => {
    window.ddcsMarkWorkspaceSaved('m350-shop.ddcs');
    window.ddcsFileSaveState.refresh();
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

/**
 * t2196 (bug fix) — OPENING a workspace for a DIFFERENT controller than the one active in this browser must settle
 * clean, not dirty. ui/workspaceManager.js's own openWorkspaceObject() marks the watermark twice, but both marks
 * land BEFORE its location.reload() — and app.js's boot re-seeds controller-dependent user-op content (e.g. a tool
 * register that only some dialects map) AFTER that reload, on the fresh page. The pre-reload marks cannot see that,
 * so a freshly-opened file that adopts a new controller read dirty before anyone touched anything (measured live:
 * `userOps` was the one store that differed). The fix leaves a pending-open marker (markPendingOpen) for the
 * reloaded page's own boot to consume and re-baseline against, once boot has settled — reusing the exact
 * stabilize-loop the first-run baseline already uses (ui/fileSaveState.js's settleThenMark).
 *
 * This test drives the SAME sequence openWorkspaceObject does (build → restore → mark ×2 → markPendingOpen →
 * reload), rather than calling the UI door, because the door needs a granted-folder File System Access handle this
 * harness cannot grant headlessly — the sequence itself, not the click path, is what regressed.
 */
test('opening a workspace under a DIFFERENT controller settles clean, not dirty, once boot re-seeds settle', async ({ page }) => {
  await ready(page);

  const before = await page.evaluate(async () => {
    const backup = await import('/data/backup.js');
    const profiles = await import('/shared/js/profiles/controllerProfiles.js');
    const obj = await backup.buildBackup();
    const cur = profiles.getActiveProfile().id;
    const other = Object.keys(profiles.CONTROLLER_PROFILES).find((id) => id !== cur);
    if (obj.stores && obj.stores.machine) obj.stores.machine.controllerId = other;
    await backup.restoreBackup(obj);
    backup.markWorkspaceSavedToFile('open-2196.ddcs', 'local');
    try { await backup.markItemsSavedToFile(); } catch (_) {}
    await new Promise((r) => setTimeout(r, 950));   // mirrors controllerSettled()'s own wait
    backup.markWorkspaceSavedToFile('open-2196.ddcs', 'local');
    try { await backup.markItemsSavedToFile(); } catch (_) {}
    backup.markPendingOpen('open-2196.ddcs', 'local');   // t2196 — the fix under test
    return { switched: cur !== other };
  });
  expect(before.switched, 'the two profiles picked really differ (or this test proves nothing)').toBe(true);

  await page.reload();
  await page.waitForFunction(() => window.ddcsFileSaveState && window.ddcsWorkspaceDirtyToFile);
  // the settle loop ticks at 400ms, needs 2 stable ticks; boot's own re-seed is synchronous, so this is generous.
  await page.waitForFunction(() => window.ddcsWorkspaceDirtyToFile() === false, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);   // let refresh()'s DOM/dot update land too
  expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile()), 'a just-opened file must not read dirty before any edit').toBe(false);

  // and the acceptance bar's other half: a REAL edit after the settle must still be caught.
  await page.evaluate((k) => { localStorage.setItem(k, JSON.stringify([{ n: 9 }])); window.ddcsFileSaveState.refresh(); }, KEY);
  expect(await page.evaluate(() => window.ddcsWorkspaceDirtyToFile()), 'a real edit right after open is still caught').toBe(true);
});
