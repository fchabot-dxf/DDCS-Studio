import { test, expect } from '@playwright/test';

/**
 * PULL-FROM-CONTROLLER FEEDBACK + STACKING (t608 amendment). The human clicked "Pull from controller" (Settings →
 * Controller → Profile) and got a SILENT no-op: the review modal DID open + render its busy/error text, but at
 * z-index 1000 it was BURIED behind the settings-overlay (z 12000) → invisible. The existing pull tests asserted
 * DOM presence (.im-row), never VISUAL stacking, so they missed it ([[verify-real-symptom-not-just-test]]).
 * Fix: the settings-opened modals (import / toollib / cloudprof) bump to z 13100 (above the overlay, matching
 * ioTable). Plus the feedback half — a busy button + a gateway-down vs controller-unreachable error, now visible.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const GEO = {
    travel: { x: 756, y: 776, z: null }, homeDir: { x: 1, y: -1, z: -1 },
    homeEdge: { x: 'min', y: 'max', z: 'max' }, homeEdgeConflict: {},
    homingFeeds: { speed: { x: 2000, y: 2000, z: 2000 }, precision: 150 },
};

async function toProfileTab(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openSettings && window.ddcsGetSettings);
    await page.evaluate(() => window.openSettings());
    await page.click('.settings-main-tab[data-group="controller"]');
    await page.click('[data-target="set_tab_profile"]');
}

// Is the topmost element at the modal panel's centre INSIDE that modal (i.e. actually on top, not buried)?
async function stackInfo(page, modalSel, panelSel) {
    return page.evaluate(([modalSel, panelSel]) => {
        const modal = document.querySelector(modalSel);
        const ov = document.querySelector('.settings-overlay');
        const panel = document.querySelector(panelSel);
        const r = panel.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
            modalZ: +getComputedStyle(modal).zIndex,
            ovZ: ov ? +getComputedStyle(ov).zIndex : 0,
            insideModal: !!(top && top.closest(modalSel)),
        };
    }, [modalSel, panelSel]);
}

test('gateway present → the Pull review modal renders ON TOP of the settings overlay (hit-testable, not buried)', async ({ page }) => {
    await page.route('**/api/profile', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'ddcs-expert-m350', name: 'DDCS Expert M350', hardwareTabs: ['probes', 'limits'], geometry: GEO }) }));
    await page.route('**/api/vars**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true, values: {} }) }));
    await toProfileTab(page);
    await page.click('#set_profile_pull');
    await page.waitForSelector('#import-modal.active #import-body .im-row', { timeout: 8000 });
    const s = await stackInfo(page, '#import-modal', '#import-modal .im-panel');
    expect(s.modalZ, 'import-modal z must clear the settings overlay').toBeGreaterThan(s.ovZ);
    expect(s.modalZ, 'the shared "above settings" tier').toBe(13100);
    expect(s.insideModal, 'the modal is the TOPMOST element at its centre (the actual bug: it used to be buried)').toBe(true);
});

test('no gateway → Pull shows a VISIBLE, on-top error naming the gateway (not a silent no-op)', async ({ page }) => {
    await page.route('**/api/profile', (r) => r.abort());   // bridge unreachable → the client throws
    await page.route('**/api/vars**', (r) => r.abort());
    await toProfileTab(page);
    await page.click('#set_profile_pull');
    await page.waitForSelector('#import-modal.active', { timeout: 8000 });
    // the busy/error text must render AND be on top
    await page.waitForFunction(() => /gateway/i.test((document.querySelector('#import-body') || {}).innerText || ''), null, { timeout: 8000 });
    const info = await page.evaluate(() => {
        const r = document.querySelector('#import-modal .im-panel').getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { txt: document.querySelector('#import-body').innerText, insideModal: !!(top && top.closest('#import-modal')) };
    });
    // t2095 — the literal 'Gateway not reachable — is the bridge / desktop app running?' this regex used to match
    // was deliberately REPLACED by commit 70243fa5 ("spell out that 'Live via the Gateway' needs the desktop app
    // open alongside the website") with more actionable wording — a genuine copy improvement, not a regression;
    // this test's own regex was simply never updated in that same commit. Matches the CURRENT message's own
    // actionable claim instead of the retired literal phrase.
    expect(info.txt, 'the error names the gateway as the reason and says what to do about it (no-gateway branch)')
        .toMatch(/desktop app.*running/i);
    expect(info.insideModal, 'the error message is visible on top of settings, not buried').toBe(true);
});

test('the tool-library modal (same class, opened from within Settings) also stacks above the overlay', async ({ page }) => {
    await toProfileTab(page);
    // the tool library lives in the ATC section — reveal it, then open the modal
    await page.evaluate(() => { const b = document.getElementById('set_atc_library'); if (b) b.click(); });
    await page.waitForSelector('#toollib-modal.active', { timeout: 8000 });
    const s = await stackInfo(page, '#toollib-modal', '#toollib-modal .tl-panel');
    expect(s.modalZ, 'toollib-modal z clears the settings overlay').toBeGreaterThan(s.ovZ);
    expect(s.insideModal, 'the tool library renders on top of settings').toBe(true);
});
