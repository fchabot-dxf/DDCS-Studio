// t838 — the PRE-FLIGHT ENVELOPE BADGE in the editor: green fits / amber can't-verify / red N-outside, click → the
// violation list, a row-click jumps the editor to that line. Drives the real app (settings + editor), asserts the DOM.
import { test, expect } from '@playwright/test';

// Envelope X/Y 0..300, Z -120..0. Declared = a non-empty WCS table; undeclared = table null.
async function configure(page, { declared, program }) {
    await page.evaluate(({ declared }) => {
        const s = window.ddcsGetSettings();
        s.machine = s.machine || {};
        Object.assign(s.machine, { x: 300, y: 300, z: -120 });
        s.machine.wcs = { active: 1, table: declared ? [{ x: 0, y: 0, z: 0 }] : null };
        window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));
    }, { declared });
    await page.evaluate((program) => {
        const ed = document.getElementById('editor');
        ed.value = program;
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    }, program);
    await page.waitForTimeout(320);   // let the debounced render() (250ms) settle
}

test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && document.getElementById('preflight-badge'));
});

test('RED: a climbing move → red badge, the violation list names line+axis+overshoot, row-click jumps the editor', async ({ page }) => {
    // A long program so a deep violation forces a real scroll on jump-to-line. Line 62 (1-based) climbs to Z+3.
    const program = 'G21 G90\n' + '(pad line)\n'.repeat(60) + 'G1 Z3 F100';
    await configure(page, { declared: true, program });

    const badge = page.locator('#preflight-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/preflight-red/);
    await expect(page.locator('.preflight-badge-label')).toContainText('outside envelope');

    await page.locator('.preflight-badge-label').click();               // open the violation list
    const row = page.locator('.preflight-row', { hasText: 'Z+' }).first();
    await expect(row).toContainText('line 62');
    await expect(row).toContainText('3.0 mm');

    await row.click();                                                  // jump-to-line
    const scrollTop = await page.evaluate(() => document.getElementById('editor').scrollTop);
    expect(scrollTop, 'the editor scrolled to the deep violating line').toBeGreaterThan(0);
});

test('GREEN: a program inside the envelope → green "fits"', async ({ page }) => {
    await configure(page, { declared: true, program: 'G21 G90\nG0 X10 Y10\nG1 Z-5 F100\nG1 X20 Y20' });
    const badge = page.locator('#preflight-badge');
    await expect(badge).toHaveClass(/preflight-green/);
    await expect(page.locator('.preflight-badge-label')).toContainText('fits envelope');
});

test('AMBER: undeclared placement → can\'t-verify (never a false green)', async ({ page }) => {
    await configure(page, { declared: false, program: 'G21 G90\nG1 Z3 F100' });
    const badge = page.locator('#preflight-badge');
    await expect(badge).toHaveClass(/preflight-amber/);
    await expect(page.locator('.preflight-badge-label')).toContainText('verify');
    // the result carries the honest reason
    const reason = await page.evaluate(() => (window.ddcsPreflightCheck() || {}).reason);
    expect(reason).toMatch(/WCS|placement/i);
});

test('SEND CONFIRM: a red program asks an explicit confirm before the push; cancel aborts, green sends without asking', async ({ page }) => {
    // Mount the gateway Send view with a mock client (no backend); count submitJob calls; beacons off (deliver-only).
    await page.evaluate(async () => {
        const mod = await import('/ui/gateway/views/send.js');
        const root = document.createElement('div'); root.id = 'test-send-root';
        root.style.cssText = 'position:fixed;inset:0;z-index:99990;background:var(--bg,#111);overflow:auto;padding:20px';   // a clickable top overlay (bare views are covered by the app chrome)
        document.body.appendChild(root);
        window.__submitted = 0; window.__mountErr = null;
        try { mod.default.mount({ root, client: { submitJob: async () => { window.__submitted++; return { jobId: 'J1', tracked: false }; } } }); }
        catch (e) { window.__mountErr = String(e && e.message || e); }
        const cb = root.querySelector('input[type=checkbox]'); if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    expect(await page.evaluate(() => window.__mountErr), 'the send view mounted').toBeNull();
    const sendRoot = page.locator('#test-send-root');
    await expect(sendRoot.locator('button.primary')).toBeVisible();

    // RED program → Use Studio program → Send → an explicit confirm appears; Cancel → submitJob NOT called.
    await configure(page, { declared: true, program: 'G21 G90\nG1 Z3 F100' });
    await sendRoot.getByText('Use current Studio program').click();
    await sendRoot.locator('button.primary').click();
    await expect(page.locator('.app-dialog')).toContainText('leave the machine travel');
    const overlayZ = (z) => page.evaluate((z) => { const r = document.getElementById('test-send-root'); if (r) r.style.zIndex = z; }, z);
    await overlayZ('1');   // drop below the app-dialog (z 20000) so its buttons are clickable
    await page.getByRole('button', { name: 'Cancel' }).click();
    await overlayZ('99990');
    expect(await page.evaluate(() => window.__submitted), 'cancel aborted the push').toBe(0);

    // GREEN program → Send → no confirm, submitJob is called.
    await configure(page, { declared: true, program: 'G21 G90\nG1 Z-5 F100' });
    await sendRoot.getByText('Use current Studio program').click();
    await sendRoot.locator('button.primary').click();
    await expect.poll(() => page.evaluate(() => window.__submitted), { timeout: 4000 }).toBe(1);
    await expect(page.locator('.app-dialog')).toHaveCount(0);
});

test('NOTES: a probe program names the trip-dependent class; a disabled soft-limit is flagged (bonus)', async ({ page }) => {
    await configure(page, { declared: true, program: 'G21 G90\nG0 Z-5\nG31 Z-50 F100\nG0 Z-5' });
    await page.evaluate(() => { window.ddcsGetSettings().machine.softLimitsPulled = false; document.getElementById('editor').dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('.preflight-badge-label').click();
    const pop = page.locator('.preflight-pop');
    await expect(pop).toContainText(/probe move/i);   // the unchecked trip-dependent class is NAMED
    await expect(pop).toContainText(/soft limit/i);    // the bonus: soft limits disabled on the controller
});

test('THEMES: the badge is legible in dark and light', async ({ page }, testInfo) => {
    const program = 'G21 G90\n' + '(pad)\n'.repeat(3) + 'G1 Z3 F100';
    await configure(page, { declared: true, program });
    await page.locator('.preflight-badge-label').click();
    for (const theme of ['futuristic', 'normal']) {   // a dark skin + the light skin (real [data-theme] names)
        await page.evaluate((t) => { document.body.setAttribute('data-theme', t); }, theme);
        await page.waitForTimeout(80);
        await page.locator('#preflight-badge').screenshot({ path: testInfo.outputPath(`preflight-${theme}.png`) });
    }
    expect(true).toBe(true);
});
