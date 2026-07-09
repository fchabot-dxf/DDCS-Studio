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
    expect(t).toContain('Rate on GitHub');
    expect(t).toContain('Send feedback');   // t598 amendment — the no-GitHub path
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

test('the header ⋮ menu Rate/Feedback entry shows the toast with BOTH destinations (GitHub + email)', async ({ page }) => {
    await boot(page, { state: 'done' });   // even after "done", the unprompted menu path stays available
    await page.click('#hdrPostBtn');
    await page.waitForSelector('#hdrPostMenu .hdr-quick-item[data-act="rate"]');
    await page.click('#hdrPostMenu .hdr-quick-item[data-act="rate"]');
    await page.waitForSelector('.ddcs-rate-toast');
    const go = await page.getAttribute('.ddcs-rate-toast .rate-go', 'href');
    const fb = await page.getAttribute('.ddcs-rate-toast .rate-feedback', 'href');
    expect(go, 'Rate → the GitHub repo').toContain('github.com/fchabot-dxf/DDCS-Studio');
    expect(fb, 'Send feedback → a mailto to the maintainer').toMatch(/^mailto:dansemur@gmail\.com/);
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
