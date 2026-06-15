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
      if (s.includes('/releases/latest')) return { ok: true, json: async () => ({ tag_name: 'v99.0', html_url: 'https://example/rel', assets: [{ name: 'DDCS-Studio.exe', browser_download_url: 'https://example/DDCS-Studio.exe' }], body: 'notes' }) };
      if (s.includes('/commits')) return { ok: true, json: async () => ([{ commit: { message: 'feat: shiny new thing\n\nbody' } }, { commit: { message: 'fix: a bug' } }]) };
      return real(url, opts);
    };
  });
  await page.evaluate(() => window.__ddcsUpd.initUpdateCheck());
  await page.waitForSelector('.ddcs-update-bar');

  const bar = await page.evaluate(() => {
    const b = document.querySelector('.ddcs-update-bar');
    return { text: b.textContent, href: b.querySelector('a.upd-btn').getAttribute('href') };
  });
  expect(bar.text).toContain('v99.0');
  expect(bar.href).toBe('https://example/DDCS-Studio.exe');

  await page.click('.ddcs-update-bar .upd-what');
  const notes = await page.textContent('.ddcs-update-bar .upd-notes');
  expect(notes).toContain('shiny new thing');

  // dismiss persists for that version
  await page.click('.ddcs-update-bar .upd-x');
  expect(await page.evaluate(() => localStorage.getItem('ddcs_update_dismissed'))).toBe('v99.0');
  await page.evaluate(() => window.__ddcsUpd.initUpdateCheck());
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => !!document.querySelector('.ddcs-update-bar')), 'dismissed version does not re-nag').toBeFalsy();
});
