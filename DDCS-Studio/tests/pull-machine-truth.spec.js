import { test, expect } from '@playwright/test';

/**
 * PULL-FROM-CONTROLLER SETS THE MACHINE TRUTH (t594, increment 2 — the Studio pull-review wiring). The gateway derives the
 * envelope + home edges + feeds from the controller dump (unit-tested in bridge/.../test_pull_geometry.py against the REAL
 * capture); this drives the Studio side: the review SHOWS them before apply (never silent — [[controller-import-remote-sim]]),
 * and Apply lands settings.machine (signed) + settings.limits <edge>Home + Homing Setup feeds. The /api/profile geometry here
 * is a FIXTURE of the gateway's verified derivation of the real June capture (X 756/min, Y 776/max→-776, Z ±9999 sentinel).
 */
test.use({ viewport: { width: 1280, height: 900 } });

// The gateway's derived geometry for the real Expert capture (matches bridge test_pull_geometry.py exactly).
const CAPTURE_GEOMETRY = {
    travel: { x: 756, y: 776, z: null },          // Z null = both soft-limit ends ±9999 (undeclared)
    homeDir: { x: 1, y: -1, z: -1 },              // +X, -Y
    homeEdge: { x: 'min', y: 'max', z: 'max' },
    homeEdgeConflict: { x: false, y: false, z: false },
    homingFeeds: { speed: { x: 2000, y: 2000, z: 2000 }, precision: 150 },
    softLimits: { xMin: -9999, xMax: 756, yMin: -776, yMax: 5, zMin: -9999, zMax: 9999 },
    machZero: { x: 0, y: 0, z: 0 },
};

async function openPull(page, geometry) {
    await page.route('**/api/profile', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'ddcs-expert-m350', name: 'DDCS Expert M350', hardwareTabs: ['probes', 'limits'], geometry }) }));
    await page.route('**/api/vars**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true, values: {} }) }));
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openSettings && window.ddcsGetSettings);
    await page.evaluate(() => window.openSettings());
    await page.click('.settings-main-tab[data-group="controller"]');
    await page.click('[data-target="set_tab_profile"]');
    await page.click('#set_profile_pull');
    await page.waitForSelector('#import-modal.active #import-body .im-row', { timeout: 8000 });
}

test('the review SHOWS the derived envelope + home + feeds (X 756/min, Y -776/MAX, Z not declared, feeds 2000/150)', async ({ page }) => {
    await openPull(page, CAPTURE_GEOMETRY);
    const body = await page.locator('#import-body').innerText();
    expect(body, 'signed X + min-home').toMatch(/756/);
    expect(body).toContain('min-home');
    expect(body, 'signed Y = -776 (max home)').toMatch(/-776/);
    expect(body).toContain('MAX-home');
    expect(body, 'Z sentinel → not declared, user-owned').toContain('Z not declared on the controller');
    expect(body, 'homing feeds seed').toContain('Seek 2000');
    expect(body).toContain('Slow 150');
    // nothing applied yet — the review is not silent
    const before = await page.evaluate(() => { const m = window.ddcsGetSettings().machine; return { x: m.x, y: m.y, z: m.z }; });
    expect(before.x, 'no apply before the operator clicks Apply').not.toBe(756);
});

test('APPLY lands settings.machine (signed) + settings.limits <edge>Home + Homing feeds; the sentinel axis is untouched', async ({ page }) => {
    await openPull(page, CAPTURE_GEOMETRY);
    const zBefore = await page.evaluate(() => window.ddcsGetSettings().machine.z);
    // apply ALL pre-ticked candidates — the geometry apply is AUTHORITATIVE (runs after the hardware apply), so even with the
    // Hardware profile ticked (its applyControllerProfile sets an UNSIGNED travel) the SIGNED envelope + home + feeds win.
    // (fire via evaluate: the async onclick disables the button mid-dispatch, which trips Playwright's actionability retry.)
    await page.evaluate(() => document.querySelector('#import-apply').click());
    await page.waitForFunction(() => { const m = document.querySelector('#import-modal'); return m && !m.classList.contains('active'); }, null, { timeout: 8000 });
    const s = await page.evaluate(() => { const g = window.ddcsGetSettings(); return { m: g.machine, lim: g.limits, hx: (g.homing.axes || {}).x }; });
    expect(s.m.x, 'machine.x = +756 (min home → +X reach)').toBe(756);
    expect(s.m.y, 'machine.y = -776 (max home → -Y reach)').toBe(-776);
    expect(s.m.z, 'sentinel Z untouched — the user owns it').toBe(zBefore);
    expect(s.lim.xMinHome, 'X min-home declared').toBe(true);
    expect(s.lim.xMaxHome, 'X max not home (≤1/axis)').toBe(false);
    expect(s.lim.yMaxHome, 'Y max-home declared').toBe(true);
    expect(s.lim.yMinHome, 'Y min not home').toBe(false);
    expect(s.hx.seekFeed, 'homing seek feed seeded (#107)').toBe(2000);
    expect(s.hx.slowFeed, 'homing slow feed = precision (#118)').toBe(150);
});

test('a homeEdgeConflict axis is FLAGGED in the review (soft-limit derivation shown, dir-bit noted)', async ({ page }) => {
    const g = JSON.parse(JSON.stringify(CAPTURE_GEOMETRY));
    g.homeEdgeConflict.x = true;   // the dir bit disagrees with the soft-limit far reach on X
    await openPull(page, g);
    const body = await page.locator('#import-body').innerText();
    expect(body, 'the conflict is surfaced in the review row').toContain('dir-bit differs');
});
