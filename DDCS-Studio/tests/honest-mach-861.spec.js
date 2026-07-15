import { test, expect } from '@playwright/test';

/**
 * t861 — HONEST MACH PREDICTION. A user field-reported the sim chip quoting Mach Z +40 on a top-homed machine (impossible:
 * Z homes at the TOP, machine 0, and travels negative — the work origin sits BELOW home, so Mach Z ≤ 0). Root cause:
 * wcsOffsetAt fell back to machine.workOrigin (a SCENE PLACEMENT value) when no WCS row was declared, and the DRO Mach
 * column quoted that as controller truth. FIX: a DECLARED-only Mach source (declaredWcsOffset → null when undeclared);
 * the DRO shows "—" rather than the placeholder; a plausibility hint ambers a positive WCS-Z at entry. The RENDERING path
 * (wcsOffsetAt fallback → engine G53 + 2D scene) + partZeroShift (the 3D scene) are UNTOUCHED — the scene was never wrong.
 */
test.use({ viewport: { width: 1200, height: 900 } });

// The user's repro machine: top-homed (z travel -120), a POSITIVE workOrigin.z placeholder, and NO declared WCS table.
const LEAK_MACHINE = { x: 300, y: 300, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 40 }, wcs: { active: 1, table: null } };

test('the +Z leak is named: declaredWcsOffset is honest (null, no workOrigin fallback); wcsOffsetAt + partZeroShift UNTOUCHED', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async (m) => {
        const { declaredWcsOffset, wcsOffsetAt, partZeroShift } = await import('/viz/sceneFrame.js');
        const declaredRow = { x: 300, y: 300, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 40 }, wcs: { active: 1, table: [{ x: 10, y: 20, z: -50 }] } };
        return {
            // THE LEAK REPRODUCED: no declared row + a +40 workOrigin placeholder
            declaredUndeclared: declaredWcsOffset(m, 1),               // honest → null
            renderUndeclared: wcsOffsetAt(m, 1),                       // rendering → STILL the workOrigin fallback (+40)
            sceneZ: partZeroShift(m, { show: true, x: 100, y: 80, z: 20 }, 20).z,   // 3D scene Z (fixed table − floor, honest)
            // a DECLARED negative row → exact
            declaredDeclared: declaredWcsOffset(declaredRow, 1),
        };
    }, LEAK_MACHINE);
    // HONEST Mach source: no declared WCS → null (no scene-placement leaked as machine truth)
    expect(r.declaredUndeclared, 'no declared WCS row → the honest Mach source is null (no +40 leak)').toBeNull();
    // RENDERING path UNTOUCHED: wcsOffsetAt still falls back to workOrigin (+40) for the engine G53 / 2D scene
    expect(r.renderUndeclared.z, 'wcsOffsetAt keeps the workOrigin fallback for RENDERING (scene never wrong)').toBe(40);
    // 3D SCENE UNTOUCHED: partZeroShift Z is the fixed machine table minus the stock floor (−120 − 20 = −140), NOT the +40
    expect(r.sceneZ, 'partZeroShift Z is the honest fixed-table value, ≤0 — not the +40 placeholder').toBe(-140);
    // DECLARED row → exact offset (typed or pulled)
    expect(r.declaredDeclared, 'a declared WCS row → the exact Mach offset').toEqual({ x: 10, y: 20, z: -50 });
});

test('the DRO Mach column: "—" when undeclared, EXACT when a declared negative row exists', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const readMach = async (machine) => page.evaluate(async (m) => {
        const s = window.ddcsGetSettings();
        s.machine = m; s.preview = s.preview || {}; s.preview.autoLoop = false;
        const { createPreviewPanel } = await import('/viz/createPreviewPanel.js');
        document.querySelectorAll('.__mp').forEach((n) => n.remove());
        const host = document.createElement('div'); host.className = '__mp'; document.body.appendChild(host);
        const panel = createPreviewPanel(host, { getGcode: () => 'G21 G90\nG0 X10 Y20 Z-3\nM30' });
        // trigger a run → updateDro fires (createPreviewPanel line ~781 resets the DRO to the start position on play)
        const runBtn = host.querySelector('.pp-run'); if (runBtn) runBtn.click();
        await new Promise((res) => setTimeout(res, 250));
        const mach = [...host.querySelectorAll('.pp-dro-m')].map((c) => c.textContent);
        const work = [...host.querySelectorAll('.pp-dro-w')].map((c) => c.textContent);
        panel.stop && panel.stop();
        return { mach, work };
    }, machine);

    // UNDECLARED (the leak machine): every Mach cell is "—" — NOT a number derived from the +40 workOrigin placeholder
    const undeclared = await readMach(LEAK_MACHINE);
    expect(undeclared.mach.length, 'the DRO has Mach cells').toBeGreaterThan(0);
    expect(undeclared.mach.every((c) => c === '—'), `undeclared WCS → Mach hidden (not the +40 workOrigin placeholder), got ${JSON.stringify(undeclared.mach)}`).toBe(true);
    expect(undeclared.work.every((c) => /^-?\d/.test(c)), 'Work is still a real number (it comes from the program, not the WCS)').toBe(true);

    // DECLARED negative row: Mach = Work + the declared offset (X+10, Y+20, Z-50), whatever the current Work — assert the
    // per-axis delta (robust to the run's start position). None hidden.
    const declared = await readMach({ x: 300, y: 300, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 40 }, wcs: { active: 1, table: [{ x: 10, y: 20, z: -50 }] } });
    expect(declared.mach.every((c) => c !== '—'), 'declared WCS → Mach is quoted (not hidden)').toBe(true);
    const delta = (i) => Number(declared.mach[i]) - Number(declared.work[i]);
    expect(delta(0), 'Mach X = Work + declared X (+10) — from the declared row, not the +40 placeholder').toBeCloseTo(10, 2);
    expect(delta(1), 'Mach Y = Work + declared Y (+20)').toBeCloseTo(20, 2);
    expect(delta(2), 'Mach Z = Work + declared Z (-50)').toBeCloseTo(-50, 2);
});

test('plausibility at entry: the Settings WCS table ambers a POSITIVE Z on a top-homed machine', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openSettings, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.machine = { x: 300, y: 300, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: [{ x: 0, y: 0, z: 0 }] } }; });
    await page.evaluate(() => window.openSettings({ group: 'controller', panel: 'set_tab_wcs' }));
    await page.waitForSelector('#set_mach_wcs_table input[data-wcs-z]', { state: 'attached', timeout: 6000 });
    const zInput = page.locator('#set_mach_wcs_table input[data-wcs-z]').first();
    // a POSITIVE Z on a top-homed machine (z travel -120) → the amber hint + input outline
    await zInput.fill('40'); await zInput.dispatchEvent('change');
    await expect(page.locator('.wcs-z-implausible-hint')).toBeVisible();
    // a NEGATIVE Z is plausible → the hint hides
    await zInput.fill('-50'); await zInput.dispatchEvent('change');
    await expect(page.locator('.wcs-z-implausible-hint')).toBeHidden();
});

test('pre-flight inherits the honesty via the shared route: undeclared placement → amber (cannot verify)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const { checkEnvelope } = await import('/engine/envelopeCheck.js');
        // a climbing move, placement UNDECLARED (no WCS table) → we must NOT quote/verify machine truth → amber
        const prog = 'G21 G90\nG0 X10 Y10 Z5\nM30';
        const undeclared = checkEnvelope(prog, { machine: { x: 300, y: 300, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 40 }, wcs: { active: 1, table: null } } });
        const declared = checkEnvelope(prog, { machine: { x: 300, y: 300, z: -120, show: true, wcs: { active: 1, table: [{ x: 0, y: 0, z: -50 }] } } });
        return { undeclared: undeclared.status, declaredStatus: declared.status };
    });
    expect(r.undeclared, 'undeclared placement → amber (the shared wcsOffsetAt/placementDeclared route ambers it, no leaked Mach)').toBe('amber');
    expect(r.declaredStatus, 'a declared WCS row lets the pre-flight verify (green/red, not amber)').not.toBe('amber');
});
