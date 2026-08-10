import { test, expect } from '@playwright/test';

/**
 * PULL-REVIEW DETAIL ROWS (t622 — the user's direct ask to see MORE detail of what was found). Every derived section
 * in the Pull-from-controller review modal shows always-visible DETAIL sub-rows: the RAW value read → the derivation.
 * Envelope per axis = raw soft-limits → signed travel; home edges = dir bit + soft-limit cross-check → the verdict;
 * homing feeds raw → value; WCS all-6-systems raw; a sentinel/undeclared axis shows the RAW reply that didn't parse.
 * Driven against the REAL June capture (X 756 home MIN, Y -776 home MAX, Z sentinel/undeclared).
 */
test.use({ viewport: { width: 1280, height: 900 } });

const CAPTURE = {
    travel: { x: 756, y: 776, z: null },
    homeDir: { x: 1, y: -1, z: -1 },
    homeEdge: { x: 'min', y: 'max', z: 'max' },
    homeEdgeConflict: { x: false, y: false, z: false },
    homingFeeds: { speed: { x: 2000, y: 2000, z: 2000 }, precision: 150 },
    softLimits: { xMin: -9999, xMax: 756, yMin: -776, yMax: 5, zMin: -9999, zMax: 9999 },
};

async function openPull(page, { gateway = true } = {}) {
    if (gateway) {
        await page.route('**/api/profile', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'ddcs-expert-m350', name: 'DDCS Expert M350', hardwareTabs: ['probes', 'limits'], geometry: CAPTURE }) }));
        await page.route('**/api/vars**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true, values: {} }) }));
    } else {
        await page.route('**/api/profile', (r) => r.abort());
        await page.route('**/api/vars**', (r) => r.abort());
    }
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openSettings && window.ddcsGetSettings);
    await page.evaluate(() => window.openSettings());
    await page.click('.settings-main-tab[data-group="controller"]');
    await page.click('[data-target="set_tab_profile"]');
    await page.click('#set_profile_pull');
}

// read the detail rows as {label, raw, derived} objects
async function detailRows(page) {
    return page.evaluate(() => [...document.querySelectorAll('#import-modal .im-drow')].map((r) => ({
        label: (r.querySelector('.im-dlbl') || {}).textContent || '',
        raw: (r.querySelector('.im-draw') || {}).textContent || '',
        derived: (r.querySelector('.im-dder') || {}).textContent || '',
    })));
}

test('envelope + home-edge detail rows show the RAW soft-limits → the signed travel + the edge verdict (June capture)', async ({ page }) => {
    await openPull(page);
    await page.waitForSelector('#import-modal.active #import-body .im-drow', { timeout: 8000 });
    const rows = await detailRows(page);
    const find = (lbl) => rows.find((r) => r.label === lbl) || {};
    // ENVELOPE: raw min/max → signed travel
    expect(find('X envelope').raw, 'X raw soft-limits').toBe('soft-limits min -9999 · max 756');
    expect(find('X envelope').derived, 'X → +756').toBe('travel +756 mm');
    expect(find('Y envelope').raw, 'Y raw soft-limits').toBe('soft-limits min -776 · max 5');
    expect(find('Y envelope').derived, 'Y → -776').toBe('travel -776 mm');
    // HOME EDGE: dir bit + cross-check → verdict
    expect(find('X home edge').derived, 'X min-home').toContain('min-home');
    expect(find('Y home edge').raw, 'Y dir bit −1').toContain('dir bit −1');
    expect(find('Y home edge').derived, 'Y MAX-home').toContain('MAX-home');
});

test('homing feeds + WCS detail rows show raw → value; the Z sentinel note shows the RAW ±9999 reply', async ({ page }) => {
    await openPull(page);
    await page.waitForSelector('#import-modal.active #import-body .im-drow', { timeout: 8000 });
    const rows = await detailRows(page);
    const find = (lbl) => rows.find((r) => r.label === lbl) || {};
    // homing feeds raw → seeded value
    expect(find('X seek').raw, 'X seek raw register').toContain('2000 mm/min');
    expect(find('X seek').derived).toBe('2000');
    expect(find('precision (slow)').derived).toBe('150');
    // the Z sentinel axis is a note that shows the RAW ±9999 reply → why it's undeclared
    const zNote = await page.evaluate(() => {
        const row = [...document.querySelectorAll('#import-modal .im-note-row')].find((r) => /Z not declared/.test(r.textContent));
        return row ? row.textContent : '';
    });
    expect(zNote, 'Z sentinel note names the raw ±9999 reply').toMatch(/9999/);
    expect(zNote).toMatch(/sentinel|undeclared/);
    // screenshot the expanded review for the human
    await page.screenshot({ path: 'scratchpad/pull-detail-expanded.png' });
});

test('no gateway → the review still shows the visible error (detail feature does not break the error path)', async ({ page }) => {
    await openPull(page, { gateway: false });
    await page.waitForFunction(() => /gateway/i.test((document.querySelector('#import-body') || {}).innerText || ''), null, { timeout: 8000 });
    const txt = await page.evaluate(() => document.querySelector('#import-body').innerText);
    expect(txt).toMatch(/gateway not reachable/i);
});
