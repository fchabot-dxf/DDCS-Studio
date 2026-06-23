import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

// "Download standalone" in the header quick-menu: the client-side single-file build (ui/bundleStandalone.js,
// a port of tools/bundle_standalone.py). The correctness check is that the produced file BOOTS OFFLINE —
// we generate it from the running app, write it to a temp file, open it via file://, and assert the app
// initialises (window.ddcsGetSettings) with no console page errors.
test.use({ viewport: { width: 1280, height: 900 } });

test('quick-menu shows "Download standalone" and it produces a self-contained HTML that boots offline', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => typeof window.ddcsGetSettings === 'function');

  // 1) the quick-menu lists the action
  await page.click('#hdrPostBtn');
  const item = page.locator('#hdrPostMenu .hdr-quick-item[data-act="standalone"]');
  await expect(item).toHaveText(/Download standalone/);
  await page.keyboard.press('Escape');

  // 2) build the bundle in-page (same code path the handler invokes)
  const html = await page.evaluate(async () => {
    const m = await import('./ui/bundleStandalone.js');
    return m.buildStandaloneHtml();
  });
  expect(typeof html).toBe('string');
  // self-contained: no leftover module entry, css inlined, bundle script present
  expect(html).not.toMatch(/<script[^>]*type=['"]module['"]/);
  expect(html).toContain('inlined styles.css');
  expect(html).toContain('// --- app.js ---');
  expect(html).toContain('window.__ASSETS_BIN');

  // 3) write to a temp file and open it OFFLINE via file:// — must boot with no page errors
  const tmp = path.join(os.tmpdir(), `ddcs-standalone-${Date.now()}.html`);
  await fs.writeFile(tmp, html, 'utf8');
  try {
    const fresh = await page.context().newPage();
    const freshErrors = [];
    fresh.on('pageerror', (e) => freshErrors.push(String(e)));
    // block any network so we prove it's truly self-contained (allow only the file:// document + data: URIs)
    await fresh.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith('file://') || u.startsWith('data:')) return route.continue();
      return route.abort();
    });
    await fresh.goto(pathToFileURL(tmp).href);
    await fresh.waitForFunction(() => typeof window.ddcsGetSettings === 'function', { timeout: 15000 });
    const booted = await fresh.evaluate(() => !!(window.ddcsStudio && window.ddcsGetSettings && window.ddcsGetSettings()));
    expect(booted, 'standalone boots offline (ddcsStudio + ddcsGetSettings live)').toBeTruthy();
    expect(freshErrors, 'no JS page errors in the offline standalone').toEqual([]);
    await fresh.close();
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }

  expect(errors, 'no JS page errors building the bundle').toEqual([]);
});
