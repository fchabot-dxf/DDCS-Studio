import { test, expect } from '@playwright/test';

// INTENTIONAL SAVE (t1199) — Ctrl+S / Save writes the WHOLE workspace (.ddcs) to a user-owned file via the File System
// Access API (the deliberate "saved" act; localStorage stays temporary). Headless Chromium has no showSaveFilePicker,
// so the FSA path is exercised with an injected mock handle; the fallback path is the real default (no FSA → download).
test.use({ viewport: { width: 1400, height: 900 } });

// Install a mock FSA picker returning a fake handle that captures every write. window.__pickCount tracks re-picks.
const MOCK_FSA = () => {
  window.__written = [];
  window.__pickCount = 0;
  window.showSaveFilePicker = async () => {
    window.__pickCount++;
    return {
      name: 'my-workspace.ddcs',
      createWritable: async () => ({ write: async (t) => { window.__written.push(t); }, close: async () => {} }),
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
    };
  };
};

async function ready(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsSaveWorkspace && window.ddcsFileSavedAt && window.ddcsFileSavedName);
}

test('FSA save writes the workspace to a user-owned file, reuses the handle, and reads "Saved to <name>"', async ({ page }) => {
  await ready(page);
  await page.evaluate(MOCK_FSA);

  const first = await page.evaluate(async () => {
    const r = await window.ddcsSaveWorkspace();
    return { r, picks: window.__pickCount, wrote: window.__written.length, body: window.__written[0] || '', savedAt: window.ddcsFileSavedAt(), name: window.ddcsFileSavedName() };
  });
  expect(first.r.viaFsa, 'used the File System Access path').toBe(true);
  expect(first.picks, 'the picker was shown once (first save)').toBe(1);
  expect(first.body, 'the whole workspace backup was written to the file').toContain('ddcs.backup');
  expect(first.savedAt, 'a real file save stamps the time').toBeGreaterThan(0);
  expect(first.name, 'the saved filename is recorded').toBe('my-workspace.ddcs');

  // a SECOND save reuses the SAME handle — a real "Save", not "Save As" every time
  const second = await page.evaluate(async () => { await window.ddcsSaveWorkspace(); return { picks: window.__pickCount, wrote: window.__written.length }; });
  expect(second.picks, 'no re-pick on the second save (handle reused)').toBe(1);
  expect(second.wrote, 'the file was written again').toBe(2);

  // the persistence-A chip reflects the filename
  const chip = await page.evaluate(() => { const c = document.getElementById('fileSaveChip'); return { saved: c.classList.contains('saved'), text: c.querySelector('.fsc-tx').textContent }; });
  expect(chip.saved, 'the chip is in the saved state').toBe(true);
  expect(chip.text, 'the chip names the file').toContain('my-workspace.ddcs');
});

test('Ctrl+S triggers the workspace save (Ctrl+Shift+S forces a re-pick = Save As)', async ({ page }) => {
  await ready(page);
  await page.evaluate(MOCK_FSA);

  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true })));
  await page.waitForFunction(() => window.__written && window.__written.length >= 1, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.__pickCount)).toBe(1);

  // Ctrl+Shift+S = Save As → forces the picker again even though a handle exists
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, shiftKey: true, cancelable: true })));
  await page.waitForFunction(() => window.__pickCount >= 2, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.__written.length)).toBeGreaterThanOrEqual(2);
});

test('without FSA it falls back to a download (still marks the workspace saved)', async ({ page }) => {
  await ready(page);
  // simulate a browser without the File System Access API (Firefox / older Safari) → the download fallback
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  expect(await page.evaluate(() => typeof window.showSaveFilePicker !== 'function'), 'FSA unset for the fallback path').toBe(true);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }),
    page.evaluate(() => window.ddcsSaveWorkspace()),
  ]);
  expect(download.suggestedFilename(), 'a .ddcs file is downloaded').toMatch(/\.ddcs$/);
  expect(await page.evaluate(() => window.ddcsFileSavedAt()), 'the download still marks the workspace saved').toBeGreaterThan(0);
});
