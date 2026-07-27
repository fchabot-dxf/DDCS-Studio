import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

/**
 * t1243 (user amendment) — THE STALE-MODULE GHOST, killed as a CLASS.
 *
 * Studio ships RAW ES modules — no bundle, no hashed filenames. So a cache header is the only thing standing between a
 * fix and a browser that quietly re-runs the code the fix deleted. `npm start` was measured sending `max-age=3600` on
 * every module: for an hour after an edit, a NORMAL reload served the old file. That produced five separate "the bug
 * came back" reports in one day (a Browse button, backup copies, Untitled-yet-Saved, a beforeunload popup) — each one
 * a hunt through code that no longer existed.
 *
 * The rule this file enforces: EVERY path that serves Studio to a browser must make the browser revalidate.
 *   - the mem-server (the suite's transport)      → asserted live, on a real module response
 *   - `npm start` (the dev server the user runs)  → asserted on the declared script
 *   - the fairy bridge/desktop server             → asserted on its static send
 *   - Cloudflare Pages                            → measured 2026-07-27 as `public, max-age=0, must-revalidate`,
 *     which already revalidates, so NO _headers file was added. If that ever changes, this note is the record of why.
 */
const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (p) => readFileSync(join(repo, p), 'utf8');

const revalidates = (cc) => /no-store|no-cache|max-age\s*=\s*0/i.test(String(cc || ''));

test('the SERVED module carries a revalidating cache header — the header, not a promise about it', async ({ request }) => {
    const res = await request.get('http://localhost:3211/app.js');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type'], 'served as a module').toMatch(/javascript/);
    expect(revalidates(res.headers()['cache-control']),
        `a module served as ${res.headers()['cache-control']} can be re-run from cache after a fix`).toBe(true);
    // and the stamp the app HEAD-fetches to say "what am I running" is still there
    expect(res.headers()['last-modified'], 'the build stamp source').toBeTruthy();
});

test('every other serving path declares it too — dev server, bridge/desktop server', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts.start, 'http-server defaults to max-age=3600; -c-1 turns that into no-cache').toMatch(/-c-1/);

    const fairy = readFileSync(join(repo, '..', 'bridge', 'bridge-app', 'fairy', 'server.py'), 'utf8');
    expect(fairy, 'the desktop/bridge static send: no header at all means HEURISTIC caching, which is the same ghost')
        .toMatch(/send_header\("Cache-Control",\s*"no-cache"\)/);
});

test('a stale cache is DETECTABLE, not something you have to suspect', async ({ page }) => {
    const lines = [];
    page.on('console', (m) => lines.push(m.text()));
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.__ddcsBuild, null, { timeout: 15000 });

    // the served build is stated once, on every boot
    expect(lines.some((l) => /served app\.js build:/.test(l)), 'the boot says what it is running').toBe(true);
    // …and on a HEALTHY server the comparison says NOT stale — so the warning means something when it does fire
    expect(await page.evaluate(() => window.__ddcsStale), 'no-cache server → the cached copy matches the served one').toBe(false);
    const tip = await page.locator('.ver').getAttribute('title');
    expect(tip, 'the chip carries the build stamp').toMatch(/build:/);

    // the detector compares the CACHE against the SERVER — the two fetch modes are the whole mechanism
    const src = read('web/app.js');
    expect(src, "what the module loader would get").toMatch(/cache:\s*'force-cache'/);
    expect(src, 'against what the server has now').toMatch(/method:\s*'HEAD',\s*cache:\s*'no-store'/);
    expect(src, 'and it names the fix when they differ').toMatch(/STALE MODULE CACHE/);
});

test('…and it FIRES on a genuinely stale cache — the detector is exercised, not just present', async ({ page }) => {
    // Stage the exact ghost: the browser's copy is OLD, the server's is NEW. Only the app's two probe fetches are
    // rewritten — the module load itself (resourceType 'script') passes straight through, so the app boots normally.
    const OLD = 'Mon, 20 Jul 2026 10:00:00 GMT';
    const NEW = 'Sat, 25 Jul 2026 18:30:00 GMT';
    await page.route('**/app.js', async (route) => {
        const req = route.request();
        if (req.resourceType() === 'script') return route.continue();
        if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'last-modified': NEW, 'content-type': 'text/javascript' }, body: '' });
        return route.fulfill({ status: 200, headers: { 'last-modified': OLD, 'content-type': 'text/javascript' }, body: '' });
    });
    const warns = [];
    page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });

    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.__ddcsStale === true, null, { timeout: 15000 });
    expect(warns.some((l) => /STALE MODULE CACHE/.test(l)), 'it says so, once, in words that stop the hunt').toBe(true);
    expect(warns.find((l) => /STALE MODULE CACHE/.test(l)), 'naming BOTH dates and the way out').toMatch(/2026-07-20[\s\S]*2026-07-25[\s\S]*Ctrl\+Shift\+R/);
    expect(await page.locator('.ver').getAttribute('title'), 'and the chip stops claiming a healthy build').toMatch(/^STALE/);
});
