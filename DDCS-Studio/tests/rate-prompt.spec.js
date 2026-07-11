import { test, expect } from '@playwright/test';

/**
 * RATE / FEEDBACK prompt (t598). A success-moment ask driven by ONE declared trigger config, fired after a successful
 * wizard INSERT when the gate passes + no sim runs; a dismissible toast (Rate / Later / Never); an always-available
 * header-menu entry. Verified: the PURE gate over every threshold/cooldown/version/state combo (unit) + the real-app
 * flow (toast after the insert event, Later/Never persist, below-threshold never, a running sim suppresses, the menu opens).
 */
const TODAY = () => new Date().toISOString().slice(0, 10);

test('the PURE trigger gate honours every threshold / cooldown / version / state combo', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const r = await page.evaluate(async () => {
        const { shouldShowRate, RATE_TRIGGER } = await import('/ui/ratePrompt.js');
        const C = RATE_TRIGGER, V = '10.99', NOW = 1_000_000_000_000;
        const base = { sessionCount: 2, successfulInserts: 5, state: '', shownForVersion: '' };
        const g = (over) => shouldShowRate({ ...base, ...over }, C, NOW, V);
        return {
            pass: g({}),
            fewSessions: g({ sessionCount: 1 }),
            fewInserts: g({ successfulInserts: 4 }),
            never: g({ state: 'never' }),
            done: g({ state: 'done' }),
            laterCooldown: g({ state: 'later', laterUntil: NOW + 1000 }),
            laterExpired: g({ state: 'later', laterUntil: NOW - 1000 }),
            sameVersion: g({ shownForVersion: V }),
            otherVersion: g({ shownForVersion: '9.0' }),
        };
    });
    expect(r.pass, 'thresholds met, fresh state → show').toBe(true);
    expect(r.fewSessions, 'below minSessions → no').toBe(false);
    expect(r.fewInserts, 'below minInserts → no').toBe(false);
    expect(r.never, "'never' → permanent no").toBe(false);
    expect(r.done, "'done' → no").toBe(false);
    expect(r.laterCooldown, "'later' inside the cooldown → no").toBe(false);
    expect(r.laterExpired, "'later' past the cooldown → show").toBe(true);
    expect(r.sameVersion, 'oncePerVersion: already shown this version → no').toBe(false);
    expect(r.otherVersion, 'shown a DIFFERENT version → show again').toBe(true);
});

async function boot(page, seed, opts = {}) {
    // seed only if ABSENT — so a reload preserves the state the app wrote (e.g. 'never'); addInitScript re-runs each navigation.
    await page.addInitScript((s) => { try { if (!localStorage.getItem('ddcs_rate')) localStorage.setItem('ddcs_rate', JSON.stringify(s)); } catch (_) {} }, seed);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.__ddcsRate && window.ddcsOpenRate);
    if (opts.simRunning) await page.evaluate(() => { const d = document.createElement('button'); d.className = 'pp-run on'; document.body.appendChild(d); });
}

test('a successful insert AFTER the threshold shows the toast; Later hides + persists the cooldown', async ({ page }) => {
    await boot(page, { sessionCount: 2, successfulInserts: 4, lastSessionDay: TODAY() });   // next insert → 5 (the threshold)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ddcs:op-inserted')));   // the success moment (wizardManager emits this)
    await page.waitForSelector('.ddcs-rate-toast', { timeout: 4000 });
    const t = await page.locator('.ddcs-rate-toast').innerText();
    expect(t).toContain('Enjoying DDCS Studio');
    expect(await page.locator('.ddcs-rate-toast .rate-star').count(), '5 stars (the form, t698)').toBe(5);
    expect(t).toMatch(/send by email/i);       // t698 — the mailto path (was "Send feedback")
    expect(t).toMatch(/star the project/i);    // t698 — GitHub demoted to a small footer link
    expect(t).toContain('Later');
    expect(t).toContain('Never');
    // Later → hides + persists a +14d cooldown
    await page.click('.ddcs-rate-toast .rate-later');
    await expect(page.locator('.ddcs-rate-toast')).toHaveCount(0);
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('ddcs_rate')));
    expect(st.state).toBe('later');
    expect(st.laterUntil, 'the Later cooldown is ~14 days out').toBeGreaterThan(Date.now() + 13 * 86400000);
});

test('Never is permanent — it stays never across a reload', async ({ page }) => {
    await boot(page, { sessionCount: 2, successfulInserts: 4, lastSessionDay: TODAY() });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ddcs:op-inserted')));
    await page.waitForSelector('.ddcs-rate-toast');
    await page.click('.ddcs-rate-toast .rate-never');
    await expect(page.locator('.ddcs-rate-toast')).toHaveCount(0);
    await page.reload();   // the seed is only set when ABSENT → the app-written 'never' survives
    await page.waitForFunction(() => window.__ddcsRate);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ddcs:op-inserted')));
    await page.waitForTimeout(300);
    await expect(page.locator('.ddcs-rate-toast'), "'never' stays never after reload").toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ddcs_rate')).state)).toBe('never');
});

test('below the insert threshold → the toast never shows', async ({ page }) => {
    await boot(page, { sessionCount: 2, successfulInserts: 1, lastSessionDay: TODAY() });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ddcs:op-inserted')));   // → 2 inserts, still < 5
    await page.waitForTimeout(300);
    await expect(page.locator('.ddcs-rate-toast'), 'below minInserts → no toast').toHaveCount(0);
});

test('a running sim suppresses the ask even at the threshold', async ({ page }) => {
    await boot(page, { sessionCount: 2, successfulInserts: 4, lastSessionDay: TODAY() }, { simRunning: true });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ddcs:op-inserted')));
    await page.waitForTimeout(300);
    await expect(page.locator('.ddcs-rate-toast'), 'a running sim suppresses the ask').toHaveCount(0);
});

test('a REAL wizard insert (the success moment) fires the toast AFTER the op commits', async ({ page }) => {
    await boot(page, { sessionCount: 2, successfulInserts: 4, lastSessionDay: TODAY() });
    await page.waitForFunction(() => window.openWiz && window.insertWiz);
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.preview = s.preview || {}; s.preview.autoLoop = false; });
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    const before = await page.evaluate(() => (window.ddcsGetBlockProgram?.() || []).length);
    await page.evaluate(async () => { await window.insertWiz(); });   // wizardManager.insert → commit → emit ddcs:op-inserted
    await page.waitForSelector('.ddcs-rate-toast', { timeout: 5000 });
    const after = await page.evaluate(() => (window.ddcsGetBlockProgram?.() || []).length);
    expect(after, 'the op actually committed (the toast is AFTER a real insert)').toBe(before + 1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ddcs_rate')).successfulInserts), 'the insert counter bumped to the threshold').toBe(5);
});

test('the toast slides in on show (a one-time entrance animation)', async ({ page }) => {
    await boot(page, { sessionCount: 2, successfulInserts: 4, lastSessionDay: TODAY() });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ddcs:op-inserted')));
    await page.waitForSelector('.ddcs-rate-toast');
    const anim = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.ddcs-rate-toast')); return { name: s.animationName, dur: s.animationDuration }; });
    expect(anim.name, 'the slide-in keyframe is applied on show').toBe('ddcs-rate-in');
    expect(anim.dur, '~250ms entrance').toBe('0.25s');
});

test('prefers-reduced-motion → the toast shows instantly (no animation)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });   // set BEFORE the toast renders so the media query applies
    await boot(page, { sessionCount: 2, successfulInserts: 4, lastSessionDay: TODAY() });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ddcs:op-inserted')));
    await page.waitForSelector('.ddcs-rate-toast');
    const name = await page.evaluate(() => getComputedStyle(document.querySelector('.ddcs-rate-toast')).animationName);
    expect(name, 'reduced-motion disables the entrance animation').toBe('none');
});

test('the header ⋮ menu Rate/Feedback entry shows the toast with BOTH destinations (GitHub + email)', async ({ page }) => {
    await boot(page, { state: 'done' });   // even after "done", the unprompted menu path stays available
    await page.click('#hdrPostBtn');
    await page.waitForSelector('#hdrPostMenu .hdr-quick-item[data-act="rate"]');
    await page.click('#hdrPostMenu .hdr-quick-item[data-act="rate"]');
    await page.waitForSelector('.ddcs-rate-toast');
    const go = await page.getAttribute('.ddcs-rate-toast .rate-github', 'href');
    const fb = await page.getAttribute('.ddcs-rate-toast .rate-email', 'href');
    expect(go, 'the footer star-the-project link → the GitHub repo').toContain('github.com/fchabot-dxf/DDCS-Studio');
    expect(fb, 'send by email → a mailto to the maintainer').toMatch(/^mailto:dansemur@gmail\.com/);
});

test('Send feedback records "done" + fires the rate_feedback analytics event', async ({ page }) => {
    await boot(page, { sessionCount: 2, successfulInserts: 5, lastSessionDay: TODAY() });
    const r = await page.evaluate(() => {
        const ev = []; window.ddcsTrack = (e) => ev.push(e);
        window.__ddcsRate.sendFeedback();   // the toast/menu Send-feedback action (mailto nav is a no-op in headless)
        return { ev, state: JSON.parse(localStorage.getItem('ddcs_rate')).state };
    });
    expect(r.state, 'feedback counts as engaged → done (stops the auto-prompt)').toBe('done');
    expect(r.ev, 'the analytics event fires').toContain('rate_feedback');
});

test('the RATE FORM (t698): pick stars + comment → Send POSTs {stars,comment,version,app} to /rate; the email path carries them', async ({ page }) => {
    await boot(page, { sessionCount: 2, successfulInserts: 5, lastSessionDay: TODAY() });
    await page.route('**/rate', (route) => route.fulfill({ status: 200, body: 'ok' }));
    await page.evaluate(() => { window.__ddcsForceTrack = true; window.__ddcsNoTrack = false; window.DDCS_ANALYTICS_URL = 'https://mock.test/e'; });
    await page.evaluate(() => window.ddcsOpenRate());
    await page.waitForSelector('.ddcs-rate-toast .rate-star');
    await page.click('.ddcs-rate-toast .rate-star[data-v="4"]');
    await page.fill('.ddcs-rate-toast .rate-comment', 'love the wizards');
    const [req] = await Promise.all([
        page.waitForRequest((r) => /\/rate$/.test(r.url()) && r.method() === 'POST', { timeout: 5000 }),
        page.click('.ddcs-rate-toast .rate-submit'),
    ]);
    const body = JSON.parse(req.postData());
    expect(body.stars, 'the POST carries the star rating').toBe(4);
    expect(body.comment, 'the POST carries the comment').toBe('love the wizards');
    expect(typeof body.version === 'string' && (body.app === 'web' || body.app === 'exe'), 'the POST carries version + app').toBe(true);
    // the email/offline path pre-fills the same
    const href = decodeURIComponent(await page.evaluate(() => window.__ddcsRate.mailtoHref(4, 'love the wizards')));
    expect(href, 'the mailto carries the stars + comment').toMatch(/4\/5[\s\S]*love the wizards/);
});

test('the RATE FORM: Send with NO stars does not submit (validated 1–5)', async ({ page }) => {
    await boot(page, { sessionCount: 2, successfulInserts: 5, lastSessionDay: TODAY() });
    let posted = false;
    await page.route('**/rate', (route) => { posted = true; route.fulfill({ status: 200, body: 'ok' }); });
    await page.evaluate(() => { window.__ddcsForceTrack = true; window.DDCS_ANALYTICS_URL = 'https://mock.test/e'; });
    await page.evaluate(() => window.ddcsOpenRate());
    await page.waitForSelector('.ddcs-rate-toast .rate-submit');
    await page.click('.ddcs-rate-toast .rate-submit');   // no stars picked
    await page.waitForTimeout(400);
    expect(posted, 'no POST without a star rating').toBe(false);
    await expect(page.locator('.ddcs-rate-toast'), 'the form stays open to pick a star').toHaveCount(1);
});
