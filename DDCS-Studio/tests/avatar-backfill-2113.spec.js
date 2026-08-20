import { test, expect } from '@playwright/test';

/**
 * t2113 (BACKLOG #1) — THE AVATAR SHOWED INITIALS EVEN WHEN A PHOTO EXISTED.
 *
 * *(human: "the avatar icon, it is my initials when I'm connected, but can it actually be my avatar image?")*
 *
 * ⭐ THE PLUMBING WAS ALL THERE AND STILL COULD NOT WORK — the recurring shape in this codebase. Two guards,
 * each individually reasonable, that between them made the fetch unreachable for the only case it existed for:
 *
 *   1. `renderCloudLogin()` backfilled identity when `!name && !email`. That condition dates from when
 *      identity WAS name+email; t2077 added the picture. Anyone already connected has name and email, so the
 *      condition is false and the backfill never runs. The only cure was disconnect-and-reconnect.
 *   2. That backfill lived in `renderCloudLogin()` — called by Settings (Network) and the Project Manager
 *      drawer. The HEADER AVATAR, the one surface that actually displays the picture, never called it.
 *
 * ⚠ AN ACCOUNT WITH NO PHOTO IS A LEGITIMATE EMPTY. `_tried` bounds it to one attempt per load, so that case
 * costs a single request and correctly keeps the initials — it must not become a retry loop.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
};

/** Intercept Drive's about.get — the ONLY source of the avatar (t2077: photoLink, no extra OAuth scope). */
const routeAbout = async (page, user) => {
    await page.route(/googleapis\.com\/drive\/v3\/about/, async (route) => {
        await page.evaluate(() => { window.__aboutCalls = (window.__aboutCalls || 0) + 1; });
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }) });
    });
};

/** A session that connected BEFORE t2077: name + email cached, no picture. The reported state. */
const seedLegacySession = (page) => page.evaluate(() => {
    localStorage.setItem('ddcs_cloud_token', 'test-token');
    localStorage.setItem('ddcs_cloud_name', 'Fred Chabot');
    localStorage.setItem('ddcs_cloud_email', 'dansemur@gmail.com');
    localStorage.removeItem('ddcs_cloud_pic');
    window.__aboutCalls = 0;
});

test('a pre-t2077 session backfills the PICTURE — the guard used to make this impossible', async ({ page }) => {
    await boot(page);
    await routeAbout(page, { displayName: 'Fred Chabot', emailAddress: 'dansemur@gmail.com', photoLink: 'https://example.test/me.jpg' });
    await seedLegacySession(page);
    const pic = await page.evaluate(async () => {
        const m = await import('/ui/cloudAccount.js');
        m.backfillIdentity();
        await new Promise((r) => window.addEventListener('ddcs:cloud-account', r, { once: true }));
        return localStorage.getItem('ddcs_cloud_pic');
    });
    expect(pic, 'the photo is cached after the backfill').toBe('https://example.test/me.jpg');
});

test('the HEADER is what asks — initHeaderAccount triggers the backfill', async ({ page }) => {
    await boot(page);
    await routeAbout(page, { displayName: 'Fred Chabot', emailAddress: 'dansemur@gmail.com', photoLink: 'https://example.test/me.jpg' });
    await seedLegacySession(page);
    // ⚠ Deliberately NOT calling renderCloudLogin: the bug was that only that surface asked, and a user may
    //    never open it. The avatar must be self-sufficient.
    const calls = await page.evaluate(async () => {
        const m = await import('/ui/headerAccount.js');
        m.initHeaderAccount();
        await new Promise((r) => setTimeout(r, 300));
        return window.__aboutCalls;
    });
    expect(calls, 'the header asked Drive for the identity by itself').toBeGreaterThan(0);
});

test('nothing missing ⇒ no request at all', async ({ page }) => {
    await boot(page);
    await routeAbout(page, { displayName: 'x', emailAddress: 'y', photoLink: 'z' });
    await page.evaluate(() => {
        localStorage.setItem('ddcs_cloud_token', 'test-token');
        localStorage.setItem('ddcs_cloud_name', 'Fred Chabot');
        localStorage.setItem('ddcs_cloud_email', 'dansemur@gmail.com');
        localStorage.setItem('ddcs_cloud_pic', 'https://example.test/already.jpg');
        window.__aboutCalls = 0;
    });
    const calls = await page.evaluate(async () => {
        const m = await import('/ui/cloudAccount.js');
        m.backfillIdentity();
        await new Promise((r) => setTimeout(r, 300));
        return window.__aboutCalls;
    });
    expect(calls, 'a complete identity is never re-fetched').toBe(0);
});

test('an account with NO photo asks ONCE and stops — a legitimate empty, not a retry loop', async ({ page }) => {
    await boot(page);
    await routeAbout(page, { displayName: 'Fred Chabot', emailAddress: 'dansemur@gmail.com', photoLink: '' });
    await seedLegacySession(page);
    const calls = await page.evaluate(async () => {
        const m = await import('/ui/cloudAccount.js');
        m.backfillIdentity(); m.backfillIdentity(); m.backfillIdentity();
        await new Promise((r) => setTimeout(r, 300));
        return window.__aboutCalls;
    });
    expect(calls, 'bounded to one attempt per load however often it is called').toBe(1);
});
