import { test, expect } from '@playwright/test';

/**
 * COMM per-post fold (t632) — the Communication HMI idioms became dialect-aware ATOMS (message/confirm/asknumber/hmistatus/
 * hmibeep/dwell), so commStack is dialect-agnostic DATA the emitter maps per post (the probe E-series treatment). This asserts:
 *   • EXPERT — the exact register forms (byte truth vs appcode/communicationWizard.nc; binary popup writes #1505=3, R2).
 *   • V4.1 / DM500 (no scripted HMI) — ZERO executable Expert-register leaks (#1505/#1503/#2070/#2039/#2042/#2043); a BLOCKING
 *     dialog (OK-Cancel / binary / input) still BLOCKS via M0; dwell folds to the post's own P units (Expert ms → DM500 sec).
 *   • The data-op TWIN == the built-in commStack byte-for-byte on EVERY post (the un-freeze — the twin no longer bakes the
 *     active post's Expert bytes; it folds per dialect like every other wizard).
 * This is the NUMERIC/structural per-post truth (assert-the-value, not golden==golden).
 */
test.use({ viewport: { width: 1280, height: 900 } });

const ARMS = [
    { name: 'popup-toast',    p: { type: 'popup', popupMode: -5000, msg: 'Job complete' } },
    { name: 'popup-okcancel', p: { type: 'popup', popupMode: 1, msg: 'Continue with operation?' } },
    { name: 'popup-binary',   p: { type: 'popup', popupMode: 3, msg: 'Pick a branch', slot1: '1' } },
    { name: 'status-std',     p: { type: 'status', statusMode: 1, msg: 'Probing in progress', statusColor: 255, statusDwell: 1000 } },
    { name: 'status-persist', p: { type: 'status', statusMode: -3000, msg: 'Machine homed' } },
    { name: 'input',          p: { type: 'input', id: '100', dest: '#805', msg: 'Enter feed rate' } },
    { name: 'beep-pulsed',    p: { type: 'beep', val: 500, cycle: 50 } },
    { name: 'beep-plain',     p: { type: 'beep', val: 500 } },
    { name: 'dwell',          p: { type: 'dwell', val: 1000 } },
];
const POSTS = ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500', 'grbl', 'rs274ngc'];
const LEAK = /#1505|#1503|#2070|#2039|#2042|#2043/;

test('comm folds per post: Expert register truth, V4.1/DM500 no leaks + M0, twin == built-in on every post', async ({ page }) => {
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async ({ ARMS, POSTS }) => {
        const { commStack } = await import('/wizards/communicationWizard.js');
        const { commDataDef } = await import('/blocks/dataOps/commData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        let registerErr = null;
        try { registerUserOp(commDataDef()); } catch (e) { registerErr = String((e && e.message) || e); }
        const build = builderOf('user_comm_data');
        const out = { registerErr, builtin: {}, twin: {} };
        for (const arm of ARMS) {
            out.builtin[arm.name] = {}; out.twin[arm.name] = {};
            for (const id of POSTS) {
                const dialect = getDialect(id);
                try { out.builtin[arm.name][id] = emitMapped(commStack(arm.p), { dialect }).text; } catch (e) { out.builtin[arm.name][id] = 'THREW: ' + e; }
                try { out.twin[arm.name][id] = emitMapped(build(arm.p), { dialect }).text; } catch (e) { out.twin[arm.name][id] = 'THREW: ' + e; }
            }
        }
        return out;
    }, { ARMS, POSTS });

    expect(errs, 'no pageerrors').toEqual([]);
    expect(r.registerErr, 'the twin def registers without error').toBe(null);
    const B = (arm, id) => r.builtin[arm][id];

    // ── EXPERT register truth (vs appcode/communicationWizard.nc) ──
    expect(B('popup-toast', 'ddcs-expert-m350')).toContain('#1505=-5000(Job complete)');
    expect(B('popup-okcancel', 'ddcs-expert-m350')).toContain('#1505=1(Continue with operation?)');
    expect(B('popup-okcancel', 'ddcs-expert-m350')).toContain('IF #1505==0 GOTO9');
    expect(B('popup-binary', 'ddcs-expert-m350'), 'R2: binary writes MODE 3 (#1505=3), nc:15').toContain('#1505=3(Pick a branch)');
    expect(B('popup-binary', 'ddcs-expert-m350')).toContain('IF #1505==0 GOTO8');
    expect(B('status-std', 'ddcs-expert-m350')).toContain('#2039=255 ( Status bar color - BGR )');
    expect(B('status-std', 'ddcs-expert-m350')).toContain('#1503=1(Probing in progress)');
    expect(B('status-std', 'ddcs-expert-m350')).toContain('#2039=-1 ( Restore default color )');
    expect(B('status-std', 'ddcs-expert-m350')).toContain('G4 P1000  ( Dwell - keep message visible )');
    expect(B('status-persist', 'ddcs-expert-m350')).toContain('#1503=-3000(Machine homed)');
    expect(B('input', 'ddcs-expert-m350')).toContain('#2070=100(Enter feed rate)');
    expect(B('input', 'ddcs-expert-m350')).toContain('#805=#100 ( Copy to persistent )');
    expect(B('beep-pulsed', 'ddcs-expert-m350')).toContain('#2043=50 ( Pulse width ms )');
    expect(B('beep-pulsed', 'ddcs-expert-m350')).toContain('#2042=500 ( Total duration ms )');
    expect(B('beep-plain', 'ddcs-expert-m350')).toContain('#2042=500 ( Beep duration ms )');
    expect(B('dwell', 'ddcs-expert-m350')).toContain('G04 P1000');

    // ── V4.1 / DM500 — no executable Expert-register leaks; blocking dialogs keep M0; dwell folds to the post's P units ──
    for (const id of ['ddcs-v41', 'ddcs-v3-dm500']) {
        for (const arm of ARMS) {
            expect(B(arm.name, id), `no register leak: ${arm.name} @ ${id}`).not.toMatch(LEAK);
        }
        for (const arm of ['popup-okcancel', 'popup-binary', 'input']) {
            expect(B(arm, id), `blocking dialog degrades WITH M0: ${arm} @ ${id}`).toMatch(/\bM0\b/);
        }
    }
    // dwell units per post: Expert ms (P1000), V4.1 ms (P1000), DM500 seconds (P1)
    expect(B('dwell', 'ddcs-v41')).toContain('G04 P1000');
    expect(B('dwell', 'ddcs-v3-dm500')).toContain('G04 P1');
    expect(B('dwell', 'ddcs-v3-dm500'), 'no baked-Expert ms leak on DM500 (the old freeze)').not.toContain('P1000');

    // ── TWIN == built-in on EVERY post (the un-freeze) ──
    for (const arm of ARMS) {
        for (const id of POSTS) {
            expect(r.twin[arm.name][id], `twin == built-in: ${arm.name} @ ${id}`).toBe(B(arm.name, id));
        }
    }
});
