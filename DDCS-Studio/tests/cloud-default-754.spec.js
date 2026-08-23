import { test, expect } from '@playwright/test';
import { autoAppDialog } from './_appDialog.js';

/**
 * t754 — CLOUD-DEFAULT-WHEN-CONNECTED, re-encoded twice now.
 *
 * t1265: the SETTING that used to gate "does a new save pre-target cloud" was removed (being signed in became the
 * whole condition, not a preference).
 *
 * t2190: the whole SAVE-TARGET CHOICE this spec was about is gone, not just the setting behind it. Per the
 * workspace-is-the-storage-boundary ruling (scratchpad/t-projects-in-workspace.md), Save always writes into the
 * WORKSPACE's own project store — never Cloud directly. Cloud participates only as a LIBRARY SHELF: an explicit
 * Export copies an already-saved workspace project OUT to Drive; nothing is ever saved-first-to-cloud, so there is
 * no "cloud write fails, falls back to local" case any more — the local copy already exists before Export ever
 * runs, so an Export failure risks a copy, never the source. See ui/projects/projectManager.js's own header.
 *
 * What survives untouched: savePrefs.js still exposes only the two non-preference helpers other surfaces (profiles,
 * wizard templates) still use — that assertion has no relationship to how Projects saves any more, so it stays.
 */
test.use({ viewport: { width: 1000, height: 900 } });

const seed = async (page) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.openProjectManager);
  await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'op', opType: 'pocket', label: 'Pocket', params: {}, children: [], simChildren: [] }]));
};
const setConn = (page, on) => page.evaluate((v) => { if (v) { localStorage.setItem('ddcs_cloud_token', 'tok'); localStorage.setItem('ddcs_cloud_provider', 'google'); } else { localStorage.removeItem('ddcs_cloud_token'); } }, on);

test('CONNECTED or not, Save always lands in the WORKSPACE — there is no Cloud save target to pre-select any more', async ({ page }) => {
  for (const connected of [true, false]) {
    await seed(page);
    await setConn(page, connected);
    await autoAppDialog(page, { accept: true, prompt: 'ct754_' + connected });
    await page.evaluate(async () => (await import('/ui/projects/projectManager.js')).openProjectManager({ promptSave: true }));
    await page.waitForSelector(`#projmOverlay [data-prow="ct754_${connected}"]`, { timeout: 5000 });
    // it is in the LOCAL/workspace store (projectStore's IDB), never written to Drive
    const inStore = await page.evaluate(async (name) => {
      const store = await import('/ui/projects/projectStore.js');
      return !!(await store.readProject(name));
    }, 'ct754_' + connected);
    expect(inStore, `saved into the workspace regardless of cloud connection (connected=${connected})`).toBe(true);
    await page.evaluate(() => document.getElementById('projmOverlay')?.remove());
  }
});

test('t1265/t2190 — no save-target preference exists anywhere: savePrefs.js keeps only the two things that were never preferences', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const api = await page.evaluate(async () => {
    const m = await import('/ui/savePrefs.js');
    return Object.keys(m).sort();
  });
  expect(api, 'savePrefs keeps only the two things that were never preferences').toEqual(['cloudConnected', 'localFallbackNote']);
});

test('an EXPORT-to-cloud failure never touches the already-saved local copy (nothing to lose — the source was saved first)', async ({ page }) => {
  await page.route('**googleapis.com/**', (r) => r.abort());   // force every Drive API call to fail
  await seed(page);
  await setConn(page, true);
  await autoAppDialog(page, { accept: true, prompt: 'export_fail_test' });
  await page.evaluate(async () => (await import('/ui/projects/projectManager.js')).openProjectManager({ promptSave: true }));
  await page.waitForSelector('#projmOverlay [data-prow="export_fail_test"]', { timeout: 5000 });
  // switch the manager's shelf to Cloud, then export the row — Drive is unreachable, so it should fail loudly
  await page.click('#projmOverlay [data-place="cloud"]');
  await page.waitForTimeout(200);
  // autoAppDialog above dismisses each dialog on its own MutationObserver tick, too fast for a body-text poll to
  // catch — read its recorded log instead (appDialogLog), which captures the message before dismissing it.
  await page.click('#projmOverlay [data-prow="export_fail_test"] [data-pm="export"]');
  await page.waitForFunction(() => (window.__appDlgLog || []).some((m) => /could not write to drive/i.test(m)), null, { timeout: 5000 });
  // the LOCAL copy this test seeded is untouched by the failed export
  const stillThere = await page.evaluate(async (name) => {
    const store = await import('/ui/projects/projectStore.js');
    return !!(await store.readProject(name));
  }, 'export_fail_test');
  expect(stillThere, 'the workspace copy survives an export failure — it was already saved before Export ran').toBe(true);
});
