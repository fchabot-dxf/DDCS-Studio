import { test, expect } from '@playwright/test';

/**
 * t844 — TIME ESTIMATES. Total + per-op runtime from the sim's OWN move+feed knowledge (the engine trace + the SAME rate
 * model playback uses). Rapids use a declared rate; dwells + tool changes add their allowances. Honest: no accel/decel.
 */
const est = (page, prog, opts) => page.evaluate(async ({ prog, opts }) => {
    const { estimateProgram } = await import('/engine/timeEstimate.js');
    const r = estimateProgram(prog, opts);
    return { seconds: r.seconds, moveSec: r.moveSec, dwellSec: r.dwellSec, tcSec: r.tcSec };
}, { prog, opts });

test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
});

test('EXACT math on a hand-computable program (rapid + feed + dwell + tool change)', async ({ page }) => {
    // G0 X60 : 60mm rapid @6000 = 0.6 s ; G1 X160 F600 : 100mm feed @600 = 10 s ; G4 P500 : 0.5 s ; M6 : 15 s → 26.1 s
    const r = await est(page, 'G21 G90\nG0 X60\nG1 X160 F600\nG4 P500\nM6 T2', { rapidRate: 6000, toolChangeSec: 15 });
    expect(r.moveSec, 'rapid 0.6 + feed 10 = 10.6 s').toBeCloseTo(10.6, 3);
    expect(r.dwellSec, 'G4 P500 = 0.5 s').toBeCloseTo(0.5, 3);
    expect(r.tcSec, 'one M6 x 15 s').toBeCloseTo(15, 3);
    expect(r.seconds, 'total 26.1 s').toBeCloseTo(26.1, 3);
});

test('RAPIDS use the declared rate (halve the rate → the rapid time doubles)', async ({ page }) => {
    const fast = await est(page, 'G21 G90\nG0 X60', { rapidRate: 6000 });   // 60/6000*60 = 0.6
    const slow = await est(page, 'G21 G90\nG0 X60', { rapidRate: 3000 });   // 60/3000*60 = 1.2
    expect(fast.moveSec).toBeCloseTo(0.6, 3);
    expect(slow.moveSec).toBeCloseTo(1.2, 3);
    expect(slow.moveSec / fast.moveSec, 'the declared rapidRate feeds the estimate').toBeCloseTo(2, 3);
});

test('the settings.machine.rapidRate is the wired source (default 6000 present)', async ({ page }) => {
    const rr = await page.evaluate(() => (window.ddcsGetSettings().machine || {}).rapidRate);
    expect(rr, 'settings.machine.rapidRate declared').toBe(6000);
    const tc = await page.evaluate(() => (window.ddcsGetSettings().machine || {}).toolChangeSec);
    expect(tc, 'settings.machine.toolChangeSec declared').toBe(15);
});

test('the estimate matches the SIM PLAYBACK MODEL (the engine per-move formula, independently recomputed)', async ({ page }) => {
    const r = await page.evaluate(async () => {
        const { estimateProgram } = await import('/engine/timeEstimate.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const prog = 'G21 G90\nG0 X50 Y20\nG1 X150 Y20 F800\nG1 X150 Y120\nG0 Z5';
        const RR = 6000;
        const est = estimateProgram(prog, { rapidRate: RR });
        // the engine playback model (GcodeExecutionEngine): rate = rapid ? rapidRate : (feed>0?feed:600); realMs = dist/rate*60000
        const segs = traceToolpath(prog, {}).segments || [];
        let playbackSec = 0;
        for (const s of segs) { const d = Math.hypot(s.x2 - s.x1, s.y2 - s.y1, s.z2 - s.z1); const rate = s.rapid ? RR : (s.feed > 0 ? s.feed : 600); playbackSec += rate > 0 ? d / rate * 60 : 0; }
        return { est: est.moveSec, playbackSec };
    });
    expect(r.est, 'the estimate move-time == the sim playback model to the last ms').toBeCloseTo(r.playbackSec, 6);
});

test('PER-OP split sums to the total move time (each op positive)', async ({ page }) => {
    await page.evaluate(async () => {
        window.ddcsLoadBlockStack([]);
        window.openWiz('surfacing', undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
        window.openWiz('pocket', undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
    });
    await page.waitForTimeout(450);
    const r = await page.evaluate(async () => {
        const { estimateProgram, secondsForLines } = await import('/engine/timeEstimate.js');
        const est = estimateProgram(window.ddcsGetBlockGcode(), { rapidRate: 6000 });
        const ops = (window.ddcsGetBlockProgram() || []).filter((b) => b && b.type === 'op');
        let sum = 0; const per = [];
        for (const op of ops) { const s = secondsForLines(est.perLine, window.ddcsLinesForOp(op.id) || []); per.push(s); sum += s; }
        return { moveSec: est.moveSec, sum, nOps: ops.length, per };
    });
    expect(r.nOps, 'a 2-op program').toBeGreaterThanOrEqual(2);
    for (const s of r.per) expect(s, 'each op has a positive estimate').toBeGreaterThan(0);
    // The per-op split is a valid partition: it never exceeds the total, and the ops account for ~all the motion (a tiny
    // residual is program-level moves — a header rapid — that belong to no op).
    expect(r.sum, 'the per-op split never exceeds the total').toBeLessThanOrEqual(r.moveSec + 1e-6);
    expect(r.sum / r.moveSec, 'the per-op times account for ~all the move time (tiny program-level moves aside)').toBeGreaterThan(0.99);
});

test('CHIP: the editor shows the estimate live + updates on edit; legible in both themes', async ({ page }, testInfo) => {
    await page.waitForFunction(() => document.getElementById('time-estimate-chip'));
    const setProg = (t) => page.evaluate((t) => { const ed = document.getElementById('editor'); ed.value = t; ed.dispatchEvent(new Event('input', { bubbles: true })); }, t);
    await setProg('G21 G90\nG1 X100 F600\nG1 Y100');
    const chip = page.locator('#time-estimate-chip');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('≈');
    const t1 = await chip.textContent();
    await setProg('G21 G90\n' + Array.from({ length: 24 }, (_, i) => `G1 X${100 + i * 120} F600`).join('\n'));
    await page.waitForTimeout(350);
    const t2 = await chip.textContent();
    expect(t2, 'the chip updates on edit (a much longer program → a larger estimate)').not.toBe(t1);
    for (const theme of ['futuristic', 'normal']) {
        await page.evaluate((t) => document.body.setAttribute('data-theme', t), theme);
        await page.waitForTimeout(80);
        await chip.screenshot({ path: testInfo.outputPath(`timechip-${theme}.png`) });
    }
});

test('PER-OP hover chip shows the op estimate; the editor shows both chips (screenshot)', async ({ page }, testInfo) => {
    await page.evaluate(async () => {
        window.ddcsLoadBlockStack([]);
        window.openWiz('pocket', undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
    });
    await page.waitForTimeout(450);
    const ed = await page.locator('#editor').boundingBox();
    const chip = page.locator('#op-edit-chip');
    let shown = false;
    for (let ln = 2; ln <= 18 && !shown; ln++) {                 // scan editor lines until the op-hover chip appears
        await page.mouse.move(ed.x + 30, ed.y + ln * 20 + 4);
        await page.waitForTimeout(70);
        const txt = (await chip.textContent().catch(() => '')) || '';
        if (await chip.isVisible().catch(() => false) && /≈/.test(txt)) shown = true;
    }
    expect(shown, 'hovering an op line shows the per-op run-time on the chip (≈ …)').toBe(true);
    await page.locator('.editor-container').screenshot({ path: testInfo.outputPath('editor-context.png') });
});
