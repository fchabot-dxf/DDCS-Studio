// t973 — SOFT-LIMIT AWARENESS (LOOP #3, ruling A). The envelope check ALREADY flags a program that leaves the machine
// soft-travel box (envelope-check-838); this adds (1) the `kind:'soft-limit'` label and (2) the ENABLE-STATE severity —
// when the controller's soft limits are OFF (softLimitsPulled===false) a breach is UNGUARDED (the machine will NOT stop
// itself → a hard-stop crash risk). GUARDRAIL: ADDITIVE — the overshoot STAYS red in BOTH cases (a guarded breach still
// halts the job mid-run); OFF only ESCALATES the wording, never downgrades/clears. softLimitsEnforced is the ONE source
// (checkEnvelope result), folding the old preflightBadge.softLimitNote settings re-read. No emit change (pre-flight only).
import { test, expect } from '@playwright/test';

// Envelope X/Y 0..300, Z -120..0. Declared = a non-empty WCS table. softLimitsPulled: false=OFF, true=ON, unset=unknown.
const mach = (softLimitsPulled) => {
    const m = { x: 300, y: 300, z: -120, wcs: { active: 1, table: [{ x: 0, y: 0, z: 0 }] } };
    if (softLimitsPulled !== undefined) m.softLimitsPulled = softLimitsPulled;
    return { machine: m, limits: {} };
};
const run = (page, program, settings) => page.evaluate(async ({ program, settings }) => {
    const { checkEnvelope } = await import('/engine/envelopeCheck.js');
    return checkEnvelope(program, settings);
}, { program, settings });

test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
});

test('CORE: an over-travel move is labelled kind:soft-limit + stays RED; the axis/line/overshoot are BYTE-IDENTICAL to the envelope check', async ({ page }) => {
    // G0 X400 → machine X=400, 100mm past X max (300). The SAME breach envelope-check-838 flags — only the label is new.
    const r = await run(page, 'G21 G90\nG0 X400', mach(undefined));
    expect(r.status).toBe('red');
    const v = r.violations.find((v) => v.axis === 'X+');
    expect(v, 'the X+ breach exists').toBeTruthy();
    expect(v.kind, 'it is now labelled soft-limit').toBe('soft-limit');
    expect(v.line, 'line/axis/overshoot are unchanged (detection byte-identical)').toBe(2);
    expect(v.overshoot).toBeGreaterThan(99);
    expect(v.overshoot).toBeLessThan(101);
});

test('CORE: softLimitsEnforced is the ONE source — false when the controller has them OFF, true when ON, null when unknown', async ({ page }) => {
    const prog = 'G21 G90\nG0 X400';
    expect((await run(page, prog, mach(false))).softLimitsEnforced, 'pulled OFF → not enforced (UNGUARDED)').toBe(false);
    expect((await run(page, prog, mach(true))).softLimitsEnforced, 'pulled ON → enforced (self-protected)').toBe(true);
    expect((await run(page, prog, mach(undefined))).softLimitsEnforced, 'never pulled → unknown').toBeNull();
    // ADDITIVE GUARDRAIL: the breach is RED in ALL three cases — the enable state never downgrades/clears it.
    for (const slp of [false, true, undefined]) expect((await run(page, prog, mach(slp))).status, `soft limits ${slp} still RED`).toBe('red');
});

test('CORE: within-travel stays clean (green) — the label/severity never invents a breach', async ({ page }) => {
    const r = await run(page, 'G21 G90 M3 S1000\nG0 X10 Y10\nG1 Z-5 F100', mach(false));   // OFF, but INSIDE the box
    expect(r.status).toBe('green');
    expect(r.violations.length).toBe(0);
    expect(r.softLimitsEnforced, 'the enable state is still reported on a green result').toBe(false);
});

// ── REAL-SYMPTOM: drive the actual pre-flight badge in the editor ─────────────────────────────────────────────────────
async function drive(page, { program, softLimitsPulled }) {
    await page.evaluate(({ slp }) => {
        const s = window.ddcsGetSettings();
        s.machine = s.machine || {};
        Object.assign(s.machine, { x: 300, y: 300, z: -120 });
        s.machine.wcs = { active: 1, table: [{ x: 0, y: 0, z: 0 }] };
        if (slp === undefined) delete s.machine.softLimitsPulled; else s.machine.softLimitsPulled = slp;
        window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));
    }, { slp: softLimitsPulled });
    await page.evaluate((program) => {
        const ed = document.getElementById('editor');
        ed.value = program; ed.dispatchEvent(new Event('input', { bubbles: true }));
    }, program);
    await page.waitForTimeout(340);   // let the debounced render() (250ms) settle
}

test('REAL-SYMPTOM: soft limits OFF → the over-travel line annotation carries the UNGUARDED escalation', async ({ page }) => {
    await page.waitForFunction(() => document.getElementById('preflight-badge'));
    await drive(page, { program: 'G21 G90\nG0 X400', softLimitsPulled: false });
    const annot = page.locator('.g-line[data-line-index="1"] .preflight-annot');
    await expect(annot).toHaveCount(1);
    await expect(annot, 'the base overshoot text is preserved (additive)').toContainText('X+ 100.0mm over');
    await expect(annot, 'soft limits OFF → UNGUARDED escalation').toContainText('UNGUARDED');
});

test('REAL-SYMPTOM: soft limits ON → the SAME breach is red + "mm over", but NO UNGUARDED escalation (the machine self-protects)', async ({ page }) => {
    await page.waitForFunction(() => document.getElementById('preflight-badge'));
    await drive(page, { program: 'G21 G90\nG0 X400', softLimitsPulled: true });
    const annot = page.locator('.g-line[data-line-index="1"] .preflight-annot');
    await expect(annot).toHaveCount(1);
    await expect(annot).toContainText('X+ 100.0mm over');
    await expect(annot, 'enforced → no crash-risk escalation on the line').not.toContainText('UNGUARDED');
    // the guarded-breach CONTEXT rides the title (still a halt to fix, not "ignore")
    await expect(annot).toHaveAttribute('title', /halts the job/i);
});

test('REAL-SYMPTOM GUARD: the escalation is ABSENT before the enable state says OFF — an in-travel program shows nothing', async ({ page }) => {
    await page.waitForFunction(() => document.getElementById('preflight-badge'));
    await drive(page, { program: 'G21 G90 M3 S1000\nG0 X10 Y10\nG1 Z-5 F100', softLimitsPulled: false });
    await expect(page.locator('#editor-highlight .preflight-annot'), 'no breach → no annotation, no escalation').toHaveCount(0);
    await expect(page.locator('#preflight-badge')).toBeHidden();
});

test('SEND-GATE: the pre-flight confirm carries the UNGUARDED warning when soft limits are OFF (the safety-critical push surface)', async ({ page }) => {
    await page.evaluate(async () => {
        const mod = await import('/ui/gateway/views/send.js');
        const root = document.createElement('div'); root.id = 'test-send-root';
        root.style.cssText = 'position:fixed;inset:0;z-index:99990;background:var(--bg,#111);overflow:auto;padding:20px';
        document.body.appendChild(root);
        window.__submitted = 0;
        mod.default.mount({ root, client: { submitJob: async () => { window.__submitted++; return { jobId: 'J1', tracked: false }; } } });
        const cb = root.querySelector('input[type=checkbox]'); if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await drive(page, { program: 'G21 G90\nG0 X400', softLimitsPulled: false });   // an over-travel breach + soft limits OFF
    const sendRoot = page.locator('#test-send-root');
    await sendRoot.getByText('Use current Studio program').click();
    await sendRoot.locator('button.primary').click();
    const dlg = page.locator('.app-dialog');
    await expect(dlg, 'the breach still gates the send (additive, never downgraded)').toContainText('leave the machine travel');
    await expect(dlg, 'soft limits OFF → the UNGUARDED crash-risk warning').toContainText('soft limits are DISABLED');
    await page.evaluate(() => { const r = document.getElementById('test-send-root'); if (r) r.style.zIndex = '1'; });
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(await page.evaluate(() => window.__submitted), 'cancel aborted the push').toBe(0);
});
