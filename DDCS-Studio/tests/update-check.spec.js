import { test, expect } from '@playwright/test';

// The exe-only update banner: must stay SILENT on the web (served from a non-gateway origin) and only nag in the
// desktop exe. Guards ui/updateCheck.js (web-exclusion, version compare, banner with Download + recent commits).
test.use({ viewport: { width: 1280, height: 900 } });

test('update banner: silent on web, version compare correct, shows in (simulated) desktop', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);

  // web exclusion: the test server (port 3211) is not a gateway loopback port → not desktop → no banner
  const web = await page.evaluate(() => ({
    desktop: window.__ddcsUpd.isDesktopApp(),
    baked: window.__ddcsUpd.bakedVersion(),
    bar: !!document.querySelector('.ddcs-update-bar'),
  }));
  expect(web.desktop, 'web build is not treated as desktop').toBeFalsy();
  expect(web.baked, 'reads the baked version from the .ver chip').toMatch(/^\d+(\.\d+)+$/);
  expect(web.bar, 'no banner on the web build').toBeFalsy();

  // pure version compare
  const cmp = await page.evaluate(() => {
    const u = window.__ddcsUpd;
    return [u.isNewer('v10.21', '10.20'), u.isNewer('v10.20', '10.20'), u.isNewer('v10.19', '10.20'), u.isNewer('v11.0', '10.99')];
  });
  expect(cmp).toEqual([true, false, false, true]);

  // simulate the desktop exe + a newer release, then run the check → banner appears with Download + commit notes
  await page.evaluate(() => {
    window.pywebview = {};
    const real = window.fetch;
    window.fetch = async (url, opts) => {
      const s = String(url);
      if (s.includes('/releases/latest')) return { ok: true, json: async () => ({ tag_name: 'v9999.0', html_url: 'https://example/rel', assets: [{ name: 'release-notes.txt', browser_download_url: 'https://example/notes.txt' }, { name: 'benchgateway.exe', browser_download_url: 'https://example/other.exe' }, { name: 'DDCS-Studio-v9999.0.exe', browser_download_url: 'https://example/DDCS-Studio.exe' }], body: 'notes' }) };
      if (s.includes('/commits')) return { ok: true, json: async () => ([{ commit: { message: 'feat: shiny new thing\n\nbody' } }, { commit: { message: 'fix: a bug' } }]) };
      if (s.includes('/api/open-external')) { window.__openExt.push(JSON.parse(opts.body).url); return { ok: true, json: async () => ({ ok: true }) }; }
      return real(url, opts);
    };
  });
  await page.evaluate(() => window.__ddcsUpd.initUpdateCheck());
  await page.waitForSelector('.ddcs-update-bar');

  // t2066 — in the exe the Download opens through the gateway (POST /api/open-external → the host's real browser, once),
  // NOT window.open (whose embedded-webview double-fire was the bug). Assert the gateway was asked to open the .exe url,
  // and window.open was never touched.
  await page.evaluate(() => { window.__openExt = []; window.open = () => { window.__openExt.push('WINDOW_OPEN'); return { focus() {} }; }; });
  const barText = await page.textContent('.ddcs-update-bar');
  await page.click('.ddcs-update-bar .upd-dl');
  await page.waitForFunction(() => (window.__openExt || []).length > 0);
  const opened = await page.evaluate(() => window.__openExt);
  expect(barText).toContain('v9999.0');
  expect(opened, 'desktop download goes through the gateway once, never window.open').toEqual(['https://example/DDCS-Studio.exe']);

  await page.click('.ddcs-update-bar .upd-what');
  const notes = await page.textContent('.ddcs-update-bar .upd-notes');
  expect(notes).toContain('shiny new thing');

  // dismiss persists for that version
  await page.click('.ddcs-update-bar .upd-x');
  expect(await page.evaluate(() => localStorage.getItem('ddcs_update_dismissed'))).toBe('v9999.0');
  await page.evaluate(() => window.__ddcsUpd.initUpdateCheck());
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => !!document.querySelector('.ddcs-update-bar')), 'dismissed version does not re-nag').toBeFalsy();
});

// t2066 — when the gateway reports the in-place same-name self-update is available, it becomes the PRIMARY action and
// the dated manual Download is demoted to a labelled fallback. Users kept grabbing the version-named `DDCS-Studio-vX.exe`
// from Downloads (a dated name that can't replace the running exe) instead of the one-click in-place update.
test('in-place update available → self-update primary, dated Download demoted to a labelled fallback', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  await page.evaluate(() => {
    window.pywebview = {};   // simulate the exe
    const real = window.fetch;
    window.fetch = async (url, opts) => {
      const s = String(url);
      if (s.includes('/releases/latest')) return { ok: true, json: async () => ({ tag_name: 'v9999.0', html_url: 'https://example/rel', assets: [{ name: 'DDCS-Studio-v9999.0.exe', browser_download_url: 'https://example/DDCS-Studio.exe' }], body: 'notes' }) };
      if (s.includes('/commits')) return { ok: true, json: async () => ([]) };
      if (s.includes('/api/update/status')) return { ok: true, json: async () => ({ supported: true, writable: true, has_asset: true, has_checksum: true, tag: 'v9999.0' }) };
      return real(url, opts);
    };
  });
  await page.evaluate(() => window.__ddcsUpd.initUpdateCheck());
  await page.waitForSelector('.ddcs-update-bar .upd-self');   // the in-place button appears only when status says it can

  const r = await page.evaluate(() => {
    const self = document.querySelector('.ddcs-update-bar .upd-self');
    const dl = document.querySelector('.ddcs-update-bar .upd-dl');
    return {
      selfText: self && self.textContent,
      selfBeforeDl: !!(self && dl && (self.compareDocumentPosition(dl) & Node.DOCUMENT_POSITION_FOLLOWING)),
      dlText: dl && dl.textContent,
      dlDemoted: !!(dl && dl.classList.contains('upd-dl-fallback')),
    };
  });
  expect(r.selfText, 'the in-place update names the version').toContain('v9999.0');
  expect(r.selfBeforeDl, 'the in-place update sits before the manual Download').toBe(true);
  expect(r.dlText, 'Download is relabelled as a manual fallback').toBe('Download manually');
  expect(r.dlDemoted, 'Download carries the demoted fallback class').toBe(true);
});

// t2066 (root fix of t1185) — the Download used to double-fire inside the embedded webview (the webview downloaded the
// .exe AND the system browser did). It now opens through the gateway HOST-SIDE (POST /api/open-external → webbrowser.open,
// exactly once), so in the exe window.open is never touched at all. Assert: exactly ONE gateway open, window.open unused,
// default prevented, no page navigation. A re-entrancy latch also means two clicks are still just one open.
test('Download opens exactly ONCE through the gateway; window.open is never used in the exe', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  await page.evaluate(() => {
    window.pywebview = {};   // simulate the exe
    window.__openExt = [];
    window.__winOpen = 0;
    window.open = () => { window.__winOpen++; return { focus() {} }; };
    const real = window.fetch;
    window.fetch = async (url, opts) => {
      const s = String(url);
      if (s.includes('/releases/latest')) return { ok: true, json: async () => ({ tag_name: 'v9999.0', html_url: 'https://example/rel', assets: [{ name: 'release-notes.txt', browser_download_url: 'https://example/notes.txt' }, { name: 'benchgateway.exe', browser_download_url: 'https://example/other.exe' }, { name: 'DDCS-Studio-v9999.0.exe', browser_download_url: 'https://example/DDCS-Studio.exe' }], body: 'notes' }) };
      if (s.includes('/commits')) return { ok: true, json: async () => ([]) };
      if (s.includes('/api/open-external')) { window.__openExt.push(JSON.parse(opts.body).url); return { ok: true, json: async () => ({ ok: true }) }; }
      return real(url, opts);
    };
  });
  await page.evaluate(() => window.__ddcsUpd.initUpdateCheck());
  await page.waitForSelector('.ddcs-update-bar .upd-dl');

  // click TWICE in quick succession — the re-entrancy latch must collapse it to a single open
  const before = await page.evaluate(() => location.href);
  const prevented = await page.evaluate(() => {
    const a = document.querySelector('.ddcs-update-bar .upd-dl');
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    a.dispatchEvent(ev);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return ev.defaultPrevented;
  });
  await page.waitForFunction(() => (window.__openExt || []).length > 0);
  const r = await page.evaluate(() => ({ openExt: window.__openExt, winOpen: window.__winOpen }));
  const navigated = (await page.evaluate(() => location.href)) !== before;

  expect(r.openExt, 'exactly ONE gateway open, of the .exe url — even after a double-click').toEqual(['https://example/DDCS-Studio.exe']);
  expect(r.winOpen, 'window.open is never used on the desktop path').toBe(0);
  expect(prevented, 'the click default is prevented').toBe(true);
  expect(navigated, 'no page navigation on click').toBe(false);
});
