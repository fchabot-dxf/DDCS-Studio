import { test, expect } from './support/harness.mjs';

/**
 * ROTARY HOMING (t670, advisor-ruled). A rotary A/B axis is homeable by SWITCH-SEEK (not just set-zero): the direction is
 * DECLARED on a rotary home-switch I/O row (rotary has no envelope edge); the arm mirrors the linear G31 seek in DEGREES,
 * with the registers extended by index at N=3 (A: P#1054 L#1056 / #883 / #1518) and N=4 (B: P#1057 L#1059 / #884 / #1519).
 * Continuous → 360+margin; bounded → span+margin. No declared dir → honest skip. A slave-role axis is never homed.
 */

const emitFor = (page, mutate) => page.evaluate(async (mut) => {
    const { homingStack, homingRunParams } = await import('/wizards/homingWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { activeDialectOpts } = await import('/wizards/previewEmit.js');
    const s = window.ddcsGetSettings();
    // eslint-disable-next-line no-new-func
    (new Function('s', mut))(s);
    return emitMapped(homingStack(homingRunParams(s, s.__sel ? { selected: s.__sel } : {}), {}), activeDialectOpts()).text || '';
}, mutate);

test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.showApp);
});

test('rotary A switch-seek emits the G31 arm at N=3 (P#1054 L#1056 / #883 / #1518), degrees; continuous vs bounded; B at N=4', async ({ page }) => {
    // continuous, positive → 360+20 = 380° (the slow re-touch F is modal-suppressed — same F100 as the back-off)
    const contPos = await emitFor(page, `
        s.__sel = ['a']; s.motors.a = { role:'rotary', around:'x' };
        s.homing = { philosophy:'sequential', axes:{ a:{ rotary:'seek', enable:true, seekFeed:1000, backoff:5, slowFeed:100, continuous:true } } };
        s.limits.aHomeDir = 'pos';`);
    expect(contPos).toMatch(/G31 A380 F1000 P#1054 L#1056/);
    expect(contPos, 'degree back-off + slow re-touch (backoff 5 → 7; F modal-carried)').toMatch(/G31 A7 P#1054 L#1056/);
    expect(contPos, 'degree back-off in the arm').toMatch(/G01 A-5 F100/);
    expect(contPos, 'A home datum + homed flag (N=3)').toContain('#883');
    expect(contPos).toContain('#1518');

    // bounded (continuous off, span 180°) → 180+20 = 200°
    const bounded = await emitFor(page, `
        s.__sel = ['a']; s.motors.a = { role:'rotary', around:'x' }; s.machine.a = 180;
        s.homing = { philosophy:'sequential', axes:{ a:{ rotary:'seek', enable:true, seekFeed:1000, backoff:5, slowFeed:100, continuous:false } } };
        s.limits.aHomeDir = 'pos';`);
    expect(bounded, 'bounded rotary seeks span+margin (200°), not 360').toMatch(/G31 A200 F1000 P#1054 L#1056/);

    // negative direction → -380
    const neg = await emitFor(page, `
        s.__sel = ['a']; s.motors.a = { role:'rotary', around:'x' };
        s.homing = { philosophy:'sequential', axes:{ a:{ rotary:'seek', enable:true, seekFeed:1000, backoff:5, slowFeed:100, continuous:true } } };
        s.limits.aHomeDir = 'neg';`);
    expect(neg, 'negative declared dir → negative seek').toMatch(/G31 A-380 F1000 P#1054 L#1056/);

    // B at N=4 → P#1057 L#1059 / #884 / #1519
    const bAxis = await emitFor(page, `
        s.__sel = ['b']; s.motors.b = { role:'rotary', around:'y' };
        s.homing = { philosophy:'sequential', axes:{ b:{ rotary:'seek', enable:true, seekFeed:900, backoff:5, slowFeed:100, continuous:true } } };
        s.limits.bHomeDir = 'pos';`);
    expect(bAxis).toMatch(/G31 B380 F900 P#1057 L#1059/);
    expect(bAxis).toContain('#884');
    expect(bAxis).toContain('#1519');
});

test('no declared direction → honest skip; set-zero method → no motion; LINEAR arm unchanged (byte-identical index map)', async ({ page }) => {
    // rotary seek but NO declared dir → the honest skip comment, no G31
    const noDir = await emitFor(page, `
        s.__sel = ['a']; s.motors.a = { role:'rotary', around:'x' };
        s.homing = { philosophy:'sequential', axes:{ a:{ rotary:'seek', enable:true } } };
        s.limits.aHomeDir = '';`);
    expect(noDir, 'no declared switch → honest SKIP, no seek').toMatch(/homing SKIPPED for this axis/);
    expect(noDir).not.toContain('G31 A');

    // set-zero method → no motion (just the datum + flag)
    const setzero = await emitFor(page, `
        s.__sel = ['a']; s.motors.a = { role:'rotary', around:'x' };
        s.homing = { philosophy:'sequential', axes:{ a:{ rotary:'setzero', enable:true } } };`);
    expect(setzero, 'set-zero = no motion').not.toContain('G31 A');
    expect(setzero).toContain('#1518');

    // LINEAR X arm still emits the confirmed index map P#1045 L#1047 (unchanged)
    const linX = await emitFor(page, `
        s.__sel = ['x']; s.machine.x = 300; s.limits.xMinHome = true;
        s.homing = { philosophy:'sequential', axes:{ x:{ enable:true, seekFeed:800, backoff:5, slowFeed:100 } } };`);
    expect(linX, 'linear X uses the confirmed P#1045 L#1047').toMatch(/G31 X-?\d+ F800 P#1045 L#1047/);
});

test('the homing DATA TWIN recomposes the rotary seek arm byte-identically (E1 unroll)', async ({ page }) => {
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { homingDataDef } = await import('/blocks/dataOps/homingData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { homingStack } = await import('/wizards/homingWizard.js');
        registerUserOp(homingDataDef());
        const build = builderOf('user_homing_data');
        const cfg = { a: { rotary: 'seek', enable: true, seekFeed: 1000, backoff: 5, slowFeed: 100, continuous: true } };
        const machine = {}, limits = { aHomeDir: 'pos' };
        window.__s = { machine, limits, homing: { axes: cfg }, motors: { a: { role: 'rotary', around: 'x' } } };
        window.ddcsGetSettings = () => window.__s;
        const twin = emitMapped(build({ axes: ['a'], softLimits: true })).text;
        const builtin = emitMapped(homingStack({ axes: ['a'], config: cfg, machine, limits, softLimits: true })).text;
        return { twin, match: twin === builtin };
    });
    expect(r.twin, 'the data twin emits the rotary A seek arm').toMatch(/G31 A380 F1000 P#1054 L#1056/);
    expect(r.match, 'the twin recomposes the rotary seek arm byte-identically to homingStack (E1 unroll covers it)').toBe(true);
});
