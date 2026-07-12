import { test, expect } from '@playwright/test';

/**
 * t754 — CLOUD-DEFAULT-WHEN-CONNECTED. ONE declared setting (savePrefs: cloud-when-connected | always-local). A NEW
 * project save pre-targets the cloud when signed in (local one click away); signed out it lands LOCAL with a quiet
 * sync note; a cloud write that FAILS falls back to a local save + a note — the save always lands (no lost work). The
 * setting flips the default. View-only wrt the machine — emit is untouched.
 */
test.use({ viewport: { width: 1000, height: 900 } });

const seed = async (page) => {
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram);
  await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'move', params: { x: 10, y: 10, z: -1, mode: 'rapid' } }]));
};
const setConn = (page, on) => page.evaluate((v) => { if (v) { localStorage.setItem('ddcs_cloud_token', 'tok'); localStorage.setItem('ddcs_cloud_provider', 'google'); } else { localStorage.removeItem('ddcs_cloud_token'); } }, on);
const setPref = (page, p) => page.evaluate(async (x) => { const m = await import('/ui/savePrefs.js'); m.setDefaultSaveLocation(x); }, p);
const openSave = (page) => page.evaluate(async () => { const m = await import('/ui/projects/projectModal.js'); await m.openSaveModal(); });
const closeSave = (page) => page.evaluate(() => { const ov = document.querySelector('.proj-savemodal'); if (ov) ov.hidden = true; });
const segState = (page) => page.evaluate(() => {
  const ov = document.querySelector('.proj-savemodal');
  const seg = {}; ov.querySelectorAll('.proj-starget').forEach((b) => { seg[b.dataset.starget] = { on: b.classList.contains('on'), disabled: b.disabled }; });
  const note = ov.querySelector('#projSaveNote');
  return { seg, noteShown: !!(note && !note.hidden), noteText: note ? note.textContent : '' };
});

test('CONNECTED + cloud pref → the save dialog pre-targets Cloud; Local is one click away', async ({ page }) => {
  await page.goto('http://localhost:3211'); await seed(page);
  await setConn(page, true); await setPref(page, 'cloud-when-connected');
  await openSave(page);
  const s = await segState(page);
  expect(s.seg.cloud.on, 'Cloud is pre-selected when connected').toBe(true);
  expect(s.seg.cloud.disabled, 'Cloud is enabled').toBe(false);
  expect(s.seg.local.disabled, 'Local is one click away').toBe(false);
  expect(s.noteShown, 'no fallback note when cloud is the live target').toBe(false);
});

test('DISCONNECTED → Local is the target with the quiet sync note; Cloud is disabled', async ({ page }) => {
  await page.goto('http://localhost:3211'); await seed(page);
  await setConn(page, false); await setPref(page, 'cloud-when-connected');
  await openSave(page);
  const s = await segState(page);
  expect(s.seg.local.on, 'Local is selected when signed out').toBe(true);
  expect(s.seg.cloud.disabled, 'Cloud is disabled when signed out').toBe(true);
  expect(s.noteShown, 'the sync note is shown').toBe(true);
  expect(s.noteText).toContain('connect cloud to sync');
});

test('the setting FLIPS the default: always-local stays Local even when connected', async ({ page }) => {
  await page.goto('http://localhost:3211'); await seed(page);
  await setConn(page, true);
  await setPref(page, 'always-local'); await openSave(page);
  expect((await segState(page)).seg.local.on, 'always-local → Local even when connected').toBe(true);
  await closeSave(page);
  await setPref(page, 'cloud-when-connected'); await openSave(page);
  expect((await segState(page)).seg.cloud.on, 'cloud-when-connected → Cloud when connected').toBe(true);
});

test('a cloud write that FAILS falls back to a LOCAL save + a note (no lost work)', async ({ page }) => {
  await page.route('**googleapis.com/**', (r) => r.abort());   // force every Drive API call to fail → gdrive throws
  await page.goto('http://localhost:3211'); await seed(page);
  await setConn(page, true); await setPref(page, 'cloud-when-connected');
  // clear any prior copy of the test project
  await page.evaluate(async () => { try { const s = await import('/ui/projects/projectStore.js'); await s.remove && s.remove('cloudfail_test'); } catch (_) { /* ok */ } });
  await openSave(page);
  await page.evaluate(() => { const ov = document.querySelector('.proj-savemodal'); ov.querySelector('#projSaveName').value = 'cloudfail_test'; });
  const target = await segState(page);
  expect(target.seg.cloud.on, 'the save is aimed at cloud').toBe(true);
  await page.evaluate(() => document.querySelector('.proj-savemodal [data-sact="save"]').click());

  // the project must land in the LOCAL store despite the cloud failure (no lost work)
  await page.waitForFunction(async () => { const s = await import('/ui/projects/projectStore.js'); const items = await s.list(''); return items.some((i) => /cloudfail_test/.test(i.name || i.path || '')); }, null, { timeout: 8000 });
  // the fallback note surfaces in the app dialog layer (poll — dlgNotice renders just after the local save resolves)
  await page.waitForFunction(() => /saved locally|work is safe/i.test(document.body.textContent || ''), null, { timeout: 5000 });
});
