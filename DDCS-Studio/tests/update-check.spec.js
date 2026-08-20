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
  expect(notes.toLowerCase(), 'the feat commit shows as a plain, sentence-cased user line').toContain('shiny new thing');

  // dismiss persists for that version
  await page.click('.ddcs-update-bar .upd-x');
  expect(await page.evaluate(() => localStorage.getItem('ddcs_update_dismissed'))).toBe('v9999.0');
  await page.evaluate(() => window.__ddcsUpd.initUpdateCheck());
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => !!document.querySelector('.ddcs-update-bar')), 'dismissed version does not re-nag').toBeFalsy();
});

// t2068 — the "What's new" list is for USERS, not developers: raw commit subjects are translated to plain lines —
// internal commits (docs/test/chore/release) dropped, conventional-commit prefixes + task ids + "-- detail" tails removed.
test('What\'s new: commit subjects become plain user-facing lines (internal commits dropped)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  const out = await page.evaluate(() => window.__ddcsUpd.userFacingNotes([
    'fix(gateway): var-read used the wrong slot for setting params -- WCS pulled "000" (t2067)',
    'feat(update): prefer the in-place same-name update; demote the dated manual Download (t2066)',
    'docs(findings): the setting file is param-indexed, not macro (t2067)',
    'release: V2026.08.17.9 -- WCS pull fix reaches the exe (t2067)',
    'test(job-history): drive the real path end to end',
    'refactor(preview): delete dead odPassExtent',
  ]));
  expect(out, 'succinct: only feat/fix, lead clause only (tails/arrows/semicolons/parens dropped), deduped').toEqual([
    'Var-read used the wrong slot for setting params',
    'Prefer the in-place same-name update',
  ]);
});

// t2066 — the notes stay SHORT: deduped, and capped so a busy release doesn't dump a changelog on the user.
test('What\'s new: deduped and capped at a few highlights', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  const out = await page.evaluate(() => window.__ddcsUpd.userFacingNotes([
    'fix: the surfacing preview shows nothing', 'fix: the surfacing preview shows nothing -- flow-label collision',
    'feat: pull reads the machine WCS live', 'fix: gateway job-in-flight false alarm',
    'feat: cleaner update notes', 'fix: one more thing', 'fix: and another',
  ]));
  expect(out.length, 'capped at a few, not everything').toBeLessThanOrEqual(3);
  expect(out.filter((x) => /surfacing preview shows nothing/i.test(x)).length, 'the two identical-gist lines collapse to one').toBe(1);
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
      barText: document.querySelector('.ddcs-update-bar')?.textContent || '',
      selfBeforeDl: !!(self && dl && (self.compareDocumentPosition(dl) & Node.DOCUMENT_POSITION_FOLLOWING)),
      dlText: dl && dl.textContent,
      dlDemoted: !!(dl && dl.classList.contains('upd-dl-fallback')),
    };
  });
  // t2113 - PREMISE UPDATED, NOT DELETED (BACKLOG #5). This asserted the version inside the BUTTON. That
  // made the button the widest element in the bar, and its width grew with the version string, so the bar
  // reflowed differently per release and its balance could not be judged at any one width. The version now
  // appears ONCE, in .upd-msg, two elements to the left.
  // ⭐ The INTENT survives and is what is asserted now: a user must be able to see WHICH version they are
  //    about to install, before clicking. That was always a property of the BAR, not of the button.
  expect(r.barText, 'the bar names the version being installed').toContain('v9999.0');
  expect(r.selfText, 'the in-place action is short and does not repeat the version').toBe('Update and restart');
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

// ── t2075 — the standing bug this turn fixes: ok:true alone used to be treated as success and the button sat on
// "Updated — restarting…" forever even when the relaunch had already silently died. The server now only sets
// relaunched:true once it has OBSERVED the new process survive its own proven crash window; the client must
// require BOTH ok and relaunched, and show the NAMED reason otherwise — never a silent/forever "restarting".
test('self-update: ok:true but relaunched:false shows the NAMED reason, never a silent forever-restarting state', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  await page.evaluate(() => {
    window.pywebview = {};
    const real = window.fetch;
    window.fetch = async (url, opts) => {
      const s = String(url);
      if (s.includes('/releases/latest')) return { ok: true, json: async () => ({ tag_name: 'v9999.0', html_url: 'https://example/rel', assets: [{ name: 'DDCS-Studio-v9999.0.exe', browser_download_url: 'https://example/DDCS-Studio.exe' }], body: 'notes' }) };
      if (s.includes('/commits')) return { ok: true, json: async () => ([]) };
      if (s.includes('/api/update/status')) return { ok: true, json: async () => ({ supported: true, writable: true, has_asset: true, has_checksum: true, tag: 'v9999.0' }) };
      if (s.includes('/api/update/apply')) return { ok: true, json: async () => ({ ok: true, relaunched: false, error: 'the new version exited immediately (code 3) — open it yourself.' }) };
      return real(url, opts);
    };
  });
  await page.evaluate(() => window.__ddcsUpd.initUpdateCheck());
  await page.waitForSelector('.ddcs-update-bar .upd-self');
  await page.click('.ddcs-update-bar .upd-self');
  await page.waitForSelector('.app-dialog');
  const dlgText = await page.textContent('.app-dialog');
  expect(dlgText, 'the exact reason from the server reaches the user').toContain('exited immediately (code 3)');
  const btn = await page.evaluate(() => document.querySelector('.ddcs-update-bar .upd-self').textContent);
  expect(btn, 'the button never gets stuck on "restarting" for an unconfirmed relaunch').not.toMatch(/restarting/i);
});

test('self-update: a CONFIRMED relaunch shows "restarting…" then settles once the app reconnects', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  await page.evaluate(() => {
    window.pywebview = {};
    let descriptorCalls = 0;
    const real = window.fetch;
    window.fetch = async (url, opts) => {
      const s = String(url);
      if (s.includes('/releases/latest')) return { ok: true, json: async () => ({ tag_name: 'v9999.0', html_url: 'https://example/rel', assets: [{ name: 'DDCS-Studio-v9999.0.exe', browser_download_url: 'https://example/DDCS-Studio.exe' }], body: 'notes' }) };
      if (s.includes('/commits')) return { ok: true, json: async () => ([]) };
      if (s.includes('/api/update/status')) return { ok: true, json: async () => ({ supported: true, writable: true, has_asset: true, has_checksum: true, tag: 'v9999.0' }) };
      if (s.includes('/api/update/apply')) return { ok: true, json: async () => ({ ok: true, relaunched: true, tag: 'v9999.0' }) };
      if (s.includes('/api/descriptor')) {
        descriptorCalls++;
        if (descriptorCalls < 2) throw new TypeError('Failed to fetch');   // the old process stepping aside
        return { ok: true, json: async () => ({}) };                      // the new one answering
      }
      return real(url, opts);
    };
  });
  await page.evaluate(() => window.__ddcsUpd.initUpdateCheck());
  await page.waitForSelector('.ddcs-update-bar .upd-self');
  await page.click('.ddcs-update-bar .upd-self');
  await page.waitForFunction(() => (document.querySelector('.ddcs-update-bar .upd-self') || {}).textContent === 'Updated — restarting…');
  await page.waitForFunction(() => (document.querySelector('.ddcs-update-bar .upd-self') || {}).textContent === 'Updated — restarted', { timeout: 10000 });
});

// ── t2075 (amended three times, human-ruled — this is the FINAL shape) — the post-update WELCOME modal: a
// different, CENTRAL surface from the pre-update banner, keyed on stored-vs-current AT BOOT (never a flag from
// the updater), gone forever once dismissed (no re-open anywhere), composed notes preferred, one panel per
// entry, "Skip all" closes the WHOLE sequence in one click. The headline "Updated to v<version>" is the exact,
// human-specified wording and is the PRIMARY payload — it answers "did my update actually work," the very
// question the update hang left unanswered.
test('welcome modal: fires on a real version change, exact headline, one panel per composed entry, Next/Back/Done navigate', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  await page.evaluate(() => {
    window.pywebview = {};
    localStorage.setItem('ddcs_seen_version', '0.0.1');
    window.__ddcsUpd.RELEASE_NOTES[window.__ddcsUpd.bakedVersion()] = [
      { short: 'A', full: 'COMPOSED PANEL ONE, with the how.' },
      { short: 'B', full: 'COMPOSED PANEL TWO.' },
    ];
  });
  await page.evaluate(() => window.__ddcsUpd.checkWelcomeNotice());
  await page.waitForSelector('.ddcs-welcome-modal');
  const headline = await page.textContent('.wcm-head');
  const version = await page.evaluate(() => window.__ddcsUpd.bakedVersion());
  expect(headline, 'the exact, human-specified wording — past tense, lowercase v').toContain(`Updated to v${version}`);
  expect(await page.textContent('.wcm-body')).toContain('COMPOSED PANEL ONE');
  expect(await page.textContent('.wcm-dots')).toHaveLength(2);
  expect(await page.textContent('.wcm-next')).toBe('Next');
  await page.click('.wcm-next');
  expect(await page.textContent('.wcm-body')).toContain('COMPOSED PANEL TWO');
  expect(await page.textContent('.wcm-next'), 'the last panel says Done, not Next').toBe('Done');
  await page.click('.wcm-back');
  expect(await page.textContent('.wcm-body')).toContain('COMPOSED PANEL ONE');
  await page.click('.wcm-next');
  await page.click('.wcm-next');   // Done on the last panel
  await page.waitForFunction(() => !document.querySelector('.ddcs-welcome-modal'));
});

test('welcome modal: "Skip all" closes the WHOLE sequence in one click, from any panel', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  await page.evaluate(() => {
    window.pywebview = {};
    localStorage.setItem('ddcs_seen_version', '0.0.1');
    window.__ddcsUpd.RELEASE_NOTES[window.__ddcsUpd.bakedVersion()] = [
      { short: 'A', full: 'Panel one.' }, { short: 'B', full: 'Panel two.' }, { short: 'C', full: 'Panel three.' },
    ];
  });
  await page.evaluate(() => window.__ddcsUpd.checkWelcomeNotice());
  await page.waitForSelector('.ddcs-welcome-modal');
  expect(await page.textContent('.wcm-skip')).toBe('Skip all');
  await page.click('.wcm-next');   // now on panel 2 of 3
  await page.click('.wcm-skip');
  await page.waitForFunction(() => !document.querySelector('.ddcs-welcome-modal'));
});

test('welcome modal: never fires on first-ever launch (no stored version) or when the version has not changed', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  // first-ever launch: nothing stored yet — this is a POST-UPDATE notice, not onboarding
  await page.evaluate(() => { window.pywebview = {}; localStorage.removeItem('ddcs_seen_version'); });
  await page.evaluate(() => window.__ddcsUpd.checkWelcomeNotice());
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => !!document.querySelector('.ddcs-welcome-modal')), 'a first-ever launch stays silent — no "Welcome to vX" onboarding').toBeFalsy();
  expect(await page.evaluate(() => localStorage.getItem('ddcs_seen_version')), 'the current version is now stamped as seen').toBe(await page.evaluate(() => window.__ddcsUpd.bakedVersion()));

  // an ordinary relaunch of the SAME version: stored === current
  await page.evaluate(() => window.__ddcsUpd.checkWelcomeNotice());
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => !!document.querySelector('.ddcs-welcome-modal')), 'no notice when the version has not changed').toBeFalsy();
});

// t2075 — human's CORRECTION, superseding an earlier ruling: a version with no composed notes still gets the
// modal (its core job — confirming the update landed — does not depend on notes existing), just the bare
// headline as a single panel: no body text, no "no release notes" filler, no Skip (nothing to skip), one Done.
test('welcome modal: a version with NO composed notes still appears — bare headline only, no derived-title filler, single Done', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  await page.evaluate(() => {
    window.pywebview = {};
    localStorage.setItem('ddcs_seen_version', '0.0.1');
    // ESTABLISH the no-notes premise instead of assuming it. This used to rely on the shipped
    // RELEASE_NOTES happening to have no entry for the current baked version — so cutting a REAL
    // release with composed notes broke this test retroactively, through no fault of the code under
    // test (V2026.08.18.1 did exactly that). Deleting the entry makes the premise true whatever ships.
    delete window.__ddcsUpd.RELEASE_NOTES[window.__ddcsUpd.bakedVersion()];
    const real = window.fetch;
    window.fetch = async (url, opts) => {
      const s = String(url);
      // the modal must NEVER derive from commits (that fallback is banner-only) — prove it by making the call blow up
      if (s.includes('/commits')) throw new Error('the welcome modal must not fetch commits when there are no composed notes');
      return real(url, opts);
    };
  });
  await page.evaluate(() => window.__ddcsUpd.checkWelcomeNotice());
  await page.waitForSelector('.ddcs-welcome-modal');
  const version = await page.evaluate(() => window.__ddcsUpd.bakedVersion());
  expect(await page.textContent('.wcm-head')).toContain(`Updated to v${version}`);
  expect(await page.evaluate(() => !!document.querySelector('.wcm-body')), 'no body element at all when there is nothing composed to say').toBeFalsy();
  expect(await page.evaluate(() => !!document.querySelector('.wcm-skip')), 'no Skip on a single, already-terminal panel').toBeFalsy();
  expect(await page.evaluate(() => !!document.querySelector('.wcm-dots')), 'no progress dots for a single panel').toBeFalsy();
  expect(await page.textContent('.wcm-next'), 'a single Done, not Next').toBe('Done');
  await page.click('.wcm-next');
  await page.waitForFunction(() => !document.querySelector('.ddcs-welcome-modal'));
});

// ── t2075 — the banner PREFERS composed release notes (RELEASE_NOTES[version].short) over derived commit
// titles when the human wrote them for this release; a release that forgot them keeps the old derived behaviour.
test('What\'s new banner prefers composed release notes over derived commit titles when present for the release', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.__ddcsUpd);
  await page.evaluate(() => {
    window.pywebview = {};
    window.__ddcsUpd.RELEASE_NOTES['9999.0'] = [
      { short: 'COMPOSED HEADLINE ONE', full: 'full one' },
      { short: 'COMPOSED HEADLINE TWO', full: 'full two' },
    ];
    const real = window.fetch;
    window.fetch = async (url, opts) => {
      const s = String(url);
      if (s.includes('/releases/latest')) return { ok: true, json: async () => ({ tag_name: 'v9999.0', html_url: 'https://example/rel', assets: [{ name: 'DDCS-Studio-v9999.0.exe', browser_download_url: 'https://example/DDCS-Studio.exe' }], body: 'notes' }) };
      if (s.includes('/commits')) throw new Error('must not derive from commits when composed notes exist for this release');
      return real(url, opts);
    };
  });
  await page.evaluate(() => window.__ddcsUpd.initUpdateCheck());
  await page.waitForSelector('.ddcs-update-bar');
  await page.click('.ddcs-update-bar .upd-what');
  const notes = await page.textContent('.ddcs-update-bar .upd-notes');
  expect(notes).toContain('COMPOSED HEADLINE ONE');
  expect(notes).toContain('COMPOSED HEADLINE TWO');
});

/**
 * t2113 (BACKLOG #5) — THE BAR MUST RENDER ON ONE ROW. Geometry, because the reported symptom was geometric
 * and no assertion could see it: "the buttons cluster to the left and have a big empty space on the right".
 *
 * ⭐ The cause was the CENTRING, not the width cap. `position:fixed; left:50%` halves the AVAILABLE width, so
 * width:max-content was clamped to 50vw, the 694px row could not fit at 1280px, and the short wrapped row
 * left the dead space. I tuned max-width TWICE on the wrong hypothesis and shipped a 3-row regression before
 * measuring. This test is the measurement, kept.
 *
 * ⚠ ROWS ARE COUNTED BY HEIGHT, NOT BY offsetTop. `align-items:center` gives items of different heights
 * different tops ON THE SAME ROW - counting distinct tops reports 3 rows for a perfectly fine bar, which is
 * exactly the false alarm that sent me tuning the wrong number.
 */
test('the update bar renders on ONE row and hugs its content (BACKLOG #5)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
  const r = await page.evaluate(() => {
    const bar = document.createElement('div');
    bar.className = 'ddcs-update-bar';
    bar.innerHTML = '<span class="upd-msg">⬆ Update available — <b>v2026.08.20.11</b></span>'
      + '<button class="upd-btn upd-self" type="button">Update and restart</button>'
      + '<button class="upd-btn upd-dl upd-dl-fallback" type="button">Download manually</button>'
      + '<button class="upd-btn upd-what" type="button">What’s new ▾</button>'
      + '<button class="upd-x" type="button">✕</button>'
      + '<div class="upd-notes" hidden></div>';
    document.body.appendChild(bar);
    const kids = [...bar.children].filter((c) => c.offsetParent !== null);
    const tallest = Math.max(...kids.map((c) => c.getBoundingClientRect().height));
    const b = bar.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    const inner = b.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const widest = Math.max(...kids.map((c) => c.getBoundingClientRect().right));
    bar.remove();
    return { rowsHeight: inner, tallest, width: b.width, slackRight: b.right - widest };
  });
  expect(r.rowsHeight, 'the bar is ONE row tall, not wrapped').toBeLessThan(r.tallest * 1.6);
  expect(r.width, 'and it is wide enough for the whole row at 1280px').toBeGreaterThan(690);
  expect(r.slackRight, 'it hugs its content — no dead band on the right').toBeLessThan(20);
});
