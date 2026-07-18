import { test, expect } from '@playwright/test';

/**
 * t947 — THE DEAD-SPINDLE GUARD (Part 2 of the spindle fix; the PRIMARY spindle-safety guarantee). A pre-flight class
 * "this program CUTS (a G1/G2/G3 FEED move) but never commands the spindle (no preceding M3/M4)" → FLAG it inline + GATE
 * the SEND. It makes a dead-spindle program impossible to send even if Option C's default slips (a zeroed Head, a new op
 * that forgets to opt in, a refactor). The heuristic NATURALLY excludes probe programs (G0 rapids + G31, no feed cut).
 *
 * Value-asserted against the check (checkEnvelope with SYNTHETIC settings — no app-state mutation), plus a real send-view
 * DOM drive for the send-confirm gate. The envelope + through-stock classes are UNTOUCHED (they still fire alongside).
 */
const DECLARED = { machine: { x: 300, y: 300, z: -120, wcs: { active: 1, table: [{ x: 0, y: 0, z: 0 }] } }, limits: {} };
const UNDECLARED = { machine: { x: 300, y: 300, z: -120, wcs: { active: 1, table: null } }, limits: {} };
const run = (page, program, settings) => page.evaluate(async ({ program, settings }) => {
    const { checkEnvelope } = await import('/engine/envelopeCheck.js');
    return checkEnvelope(program, settings);
}, { program, settings });

test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
});

test('DEAD: a cutting program (G1 feed) with NO spindle-on is RED with a no-spindle violation on the FIRST cut line', async ({ page }) => {
    // line 2 = G0 rapid to start (in-envelope, NOT a feed cut); line 3 = the first G1 feed CUT, with no M3 anywhere → dead.
    const r = await run(page, 'G21 G90\nG0 X10 Y10\nG1 Z-5 F100\nG1 X20 Y20 F200', DECLARED);
    expect(r.status, 'a dead-spindle cut is RED (gates the send)').toBe('red');
    const v = r.violations.find((x) => x.kind === 'no-spindle');
    expect(v, 'a no-spindle violation exists').toBeTruthy();
    expect(v.line, 'flagged at the FIRST feed cut (line 3 — the G1 Z-5, not the G0 rapid)').toBe(3);
});

test('PROBE: a probe program (G0 + G31, no feed cut) does NOT false-positive — the guard excludes probes by construction', async ({ page }) => {
    const r = await run(page, 'G21 G90\nG0 Z-5\nG31 Z-50 F100\nG0 Z-5', DECLARED);
    expect(r.violations.some((v) => v.kind === 'no-spindle'), 'no no-spindle on a probe (no G1/G2/G3 feed)').toBe(false);
});

test('NORMAL: an in-envelope cutting program WITH M3 does NOT flag (green)', async ({ page }) => {
    const r = await run(page, 'G21 G90\nM3 S1000\nG0 X10 Y10\nG1 Z-5 F100\nG1 X20 Y20 F200', DECLARED);
    expect(r.violations.some((v) => v.kind === 'no-spindle'), 'M3 present → no dead-spindle flag').toBe(false);
    expect(r.status, 'a normal in-envelope cutting program is green').toBe('green');
});

test('M4 (ccw) satisfies the guard; a COMMENTED M3 does NOT', async ({ page }) => {
    const r4 = await run(page, 'G21 G90\nM4 S1000\nG1 Z-5 F100', DECLARED);
    expect(r4.violations.some((v) => v.kind === 'no-spindle'), 'M4 (ccw) counts as spindle-on').toBe(false);
    const rc = await run(page, 'G21 G90\n( M3 S1000 spindle )\nG1 Z-5 F100', DECLARED);
    expect(rc.violations.some((v) => v.kind === 'no-spindle'), 'a COMMENTED M3 does NOT count → the cut is still dead').toBe(true);
});

test('DEAD even when the envelope is UNVERIFIABLE (amber) — the guard promotes the verdict to RED', async ({ page }) => {
    const r = await run(page, 'G21 G90\nG1 Z-5 F100', UNDECLARED);
    expect(r.status, 'a dead-spindle is text-verifiable → red even with an undeclared placement (never a false amber)').toBe('red');
    expect(r.violations.some((v) => v.kind === 'no-spindle')).toBe(true);
});

test('ENVELOPE coexists: a dead program that ALSO climbs past Z+ reports BOTH classes', async ({ page }) => {
    const r = await run(page, 'G21 G90\nG1 Z3 F100', DECLARED);   // Z+3 over the top AND no M3 before the cut
    expect(r.status).toBe('red');
    expect(r.violations.some((v) => v.kind === 'no-spindle'), 'the dead-spindle class fires').toBe(true);
    expect(r.violations.some((v) => v.axis === 'Z+'), 'the envelope Z+ class STILL fires alongside').toBe(true);
});

test('DATA-OP (post-C): a surfacing data-op emit (has the Head M3) does NOT flag', async ({ page }) => {
    const prog = await page.evaluate(async () => {
        const { surfacingDataDef, SURFACING_DATA_OPTYPE } = await import('/blocks/dataOps/surfacingData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        registerUserOp(surfacingDataDef());
        return emitMapped(builderOf(SURFACING_DATA_OPTYPE)()).text;
    });
    const r = await run(page, prog, DECLARED);
    expect(r.violations.some((v) => v.kind === 'no-spindle'), 'the Option-C-fixed data-op has M3 → no dead-spindle flag').toBe(false);
});

test('SEND GATE: a dead-spindle program asks the DEAD-SPINDLE confirm before the push; Cancel aborts the send', async ({ page }) => {
    await page.evaluate(async () => {
        const mod = await import('/ui/gateway/views/send.js');
        const root = document.createElement('div'); root.id = 'test-send-root';
        root.style.cssText = 'position:fixed;inset:0;z-index:99990;background:var(--bg,#111);overflow:auto;padding:20px';
        document.body.appendChild(root);
        window.__submitted = 0; window.__mountErr = null;
        try { mod.default.mount({ root, client: { submitJob: async () => { window.__submitted++; return { jobId: 'J1', tracked: false }; } } }); }
        catch (e) { window.__mountErr = String(e && e.message || e); }
        const cb = root.querySelector('input[type=checkbox]'); if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    expect(await page.evaluate(() => window.__mountErr), 'the send view mounted').toBeNull();
    // a DEAD cutting program (in-envelope, so the ONLY breach is the dead spindle) in the Studio editor
    await page.evaluate(() => {
        const s = window.ddcsGetSettings(); s.machine = s.machine || {};
        Object.assign(s.machine, { x: 300, y: 300, z: -120 }); s.machine.wcs = { active: 1, table: [{ x: 0, y: 0, z: 0 }] };
        const ed = document.getElementById('editor');
        ed.value = 'G21 G90\nG0 X10 Y10\nG1 Z-5 F100\nG1 X20 Y20 F200';
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const sendRoot = page.locator('#test-send-root');
    await sendRoot.getByText('Use current Studio program').click();
    await sendRoot.locator('button.primary').click();
    await expect(page.locator('.app-dialog'), 'the confirm names the dead spindle, not the envelope').toContainText('never turns the spindle on');
    // Cancel → NOT submitted
    const overlayZ = (z) => page.evaluate((z) => { const r = document.getElementById('test-send-root'); if (r) r.style.zIndex = z; }, z);
    await overlayZ('1');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await overlayZ('99990');
    expect(await page.evaluate(() => window.__submitted), 'Cancel aborted the push').toBe(0);
});
