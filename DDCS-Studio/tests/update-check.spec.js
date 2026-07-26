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
      if (s.includes('/releases/latest')) return { ok: true, json: async () => ({ tag_name: 'v9999.0', html_url: 'https://example/rel', assets: [{ name: 'DDCS-Studio.exe', browser_download_url: 'https://example/DDCS-Studio.exe' }], body: 'notes' }) };
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
  expect(bar.text).toContain('v9999.0');
  expect(bar.href).toBe('https://example/DDCS-Studio.exe');

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

// t1185 — the Download button used to fire TWICE (the anchor's target=_blank navigation AND a window.open in the click
// listener). The fix: preventDefault + a SINGLE window.open (location.href only if the popup is blocked). Exactly one download.
test('Download button triggers exactly ONE download: window.open once + anchor default prevented', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  await page.evaluate(() => {
    window.pywebview = {};   // simulate the exe
    const real = window.fetch;
    window.fetch = async (url, opts) => {
      const s = String(url);
      if (s.includes('/releases/latest')) return { ok: true, json: async () => ({ tag_name: 'v9999.0', html_url: 'https://example/rel', assets: [{ name: 'DDCS-Studio.exe', browser_download_url: 'https://example/DDCS-Studio.exe' }], body: 'notes' }) };
      if (s.includes('/commits')) return { ok: true, json: async () => ([]) };
      return real(url, opts);
    };
  });
  await page.evaluate(() => window.__ddcsUpd.initUpdateCheck());
  await page.waitForSelector('.ddcs-update-bar a.upd-btn');

  const r = await page.evaluate(() => {
    const opens = [];
    window.open = (...a) => { opens.push(a); return { focus() {} }; };   // truthy → the location.href fallback stays untaken
    const before = location.href;
    const a = document.querySelector('.ddcs-update-bar a.upd-btn');
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    a.dispatchEvent(ev);
    return { opens, defaultPrevented: ev.defaultPrevented, navigated: location.href !== before };
  });
  expect(r.opens.length, 'window.open fires exactly ONCE (not twice)').toBe(1);
  expect(r.opens[0], 'opens the download URL in a new tab, noopener').toEqual(['https://example/DDCS-Studio.exe', '_blank', 'noopener']);
  expect(r.defaultPrevented, 'the anchor navigation default is prevented → no second download').toBe(true);
  expect(r.navigated, 'no page navigation on click').toBe(false);
});
