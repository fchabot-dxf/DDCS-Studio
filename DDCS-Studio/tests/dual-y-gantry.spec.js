import { test, expect } from '@playwright/test';

/**
 * DUAL-Y GANTRY (t648, user-ruled) — the ONE SOURCE is settings.motors[ax]={role:'slave',follows}. Everything DERIVES.
 * HOMING: a slave axis is never independently homed; the MASTER's homing emits the slave sync, with slaveFollows injected
 * from the axes declaration (not a stored dropdown). This asserts the DATUM/VALUES: a declared dual-Y (A slaved to Y) makes
 * Y's homing GAIN `#[880+idx]=masterCoord` + `#[1515+idx]=1` and A DROP OUT of the sequence; no slave → byte-identical.
 */
test.use({ viewport: { width: 1000, height: 800 } });

const BASE = {
    machine: { x: 300, y: 200, z: 120, softLimits: true },
    homing: { philosophy: 'sequential', axes: {
        x: { enable: true, order: 2, method: 'seek', seekFeed: 800, backoff: 5, slowFeed: 100, offset: 0, slaveFollows: '' },
        y: { enable: true, order: 3, method: 'seek', seekFeed: 800, backoff: 5, slowFeed: 100, offset: 0, slaveFollows: '' },
        z: { enable: true, order: 1, method: 'seek', seekFeed: 600, backoff: 5, slowFeed: 100, offset: 0, slaveFollows: '' },
        a: { enable: false, order: 4, method: 'setzero', slaveFollows: '' },
        b: { enable: false, order: 5, method: 'setzero', slaveFollows: '' },
    } },
    limits: {},
};
const LINEAR = { x: { role: 'linear' }, y: { role: 'linear' }, z: { role: 'linear' }, a: { role: 'unused', around: 'x' }, b: { role: 'unused', around: 'y' } };
const DUAL_Y = { ...LINEAR, a: { role: 'slave', follows: 'y' } };   // A (idx 3) slaved to Y — the user's own rig

test('homing derives the slave sync from the axes declaration; A drops out of the sequence; no-slave is byte-identical', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async ({ BASE, LINEAR, DUAL_Y }) => {
        const { homingStack, homingRunParams } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        setActiveProfile('ddcs-expert-m350');
        const emit = (motors) => emitMapped(homingStack(homingRunParams({ ...BASE, motors }))).text;
        const rp = (motors) => homingRunParams({ ...BASE, motors });
        return { linear: emit(LINEAR), dualY: emit(DUAL_Y), rpLinear: rp(LINEAR).axes, rpDualY: rp(DUAL_Y).axes };
    }, { BASE, LINEAR, DUAL_Y });

    // DUAL-Y: Y homing GAINS the slave sync — #[880+3]=#[880+1] (slave A coord = master Y coord) + #[1515+3]=1 (A homed flag)
    expect(r.dualY, 'dual-Y: the slave A coord follows the master Y coord (#883=#881)').toContain('#883=#881');
    expect(r.dualY, 'dual-Y: the slave A homed flag is set (#1518=1)').toContain('#1518=1');
    // A is NEVER independently homed (no Home A block, A not in the run axes)
    expect(r.dualY, 'dual-Y: A is not independently homed (no Home A seek/setzero block)').not.toMatch(/Home A —/);
    expect(r.rpDualY, 'dual-Y: A is excluded from the homing run axes').not.toContain('a');

    // NO SLAVE: byte-identical — NO sync lines, A absent (unused). This is the guard the advisor's harness checks.
    expect(r.linear, 'no-slave: no slave-coord sync').not.toContain('#883=');
    expect(r.linear, 'no-slave: no slave homed-flag write').not.toContain('#1518=1');
    // the ONLY difference between linear and dual-Y is the injected sync (X/Y/Z seeks identical)
    const stripSync = (t) => t.split('\n').filter((l) => !/#883|#1518|Sync slave/.test(l)).join('\n');
    expect(stripSync(r.dualY), 'dual-Y minus the sync lines == the plain linear homing (nothing else changed)').toBe(r.linear);
});

test('REAL-SYMPTOM: a pulled dual-gantry dump seeds A=Gantry slave of Y; the vertical Axes list + homing derive it', async ({ page }) => {
    // simulate a pulled June-capture dual-gantry dump: homing.axes.y carries the legacy DUAL binding (slaveIdx 3 = A slaved to Y)
    await page.addInitScript(() => {
        const s = { homing: { philosophy: 'sequential', axes: {
            x: { enable: true, order: 2, method: 'seek', seekFeed: 800, slowFeed: 100, backoff: 5 },
            y: { enable: true, order: 3, method: 'dual', dual: { slaveIdx: 3 }, seekFeed: 800, slowFeed: 100, backoff: 5 },
            z: { enable: true, order: 1, method: 'seek', seekFeed: 600, slowFeed: 100, backoff: 5 },
        } }, machine: { x: 300, y: 200, z: 120, softLimits: true } };
        localStorage.setItem('ddcs_studio_settings', JSON.stringify(s));
    });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetSettings && window.openSettings);

    // the pull SEEDING fired at load → the ONE SOURCE (settings.motors.a) is a gantry slave following Y
    const motorsA = await page.evaluate(() => window.ddcsGetSettings().motors.a);
    expect(motorsA.role, 'A seeded as a gantry slave from the dump dual binding').toBe('slave');
    expect(motorsA.follows, 'A follows the master Y').toBe('y');

    // it DERIVES: the homing emit gains the sync + A drops out (the SAME datum, now sourced from the seeded topology)
    const emit = await page.evaluate(async () => {
        const { homingStack, homingRunParams } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        setActiveProfile('ddcs-expert-m350');
        return emitMapped(homingStack(homingRunParams(window.ddcsGetSettings()))).text;
    });
    expect(emit, 'the seeded topology drives the Y homing sync').toContain('#883=#881');
    expect(emit, 'the seeded topology sets the A homed flag').toContain('#1518=1');

    // the vertical Axes list shows A = Gantry slave, follows Y (the restructured UI, matching the homing cards)
    await page.evaluate(() => window.openSettings({ group: 'hardware', panel: 'set_tab_machine' }));
    await page.waitForSelector('#set_axes_list .axis-card[data-axis="a"]', { timeout: 8000 });
    const ui = await page.evaluate(() => {
        const card = document.querySelector('#set_axes_list .axis-card[data-axis="a"]');
        const role = card.querySelector('.ax-role')?.value;
        const follows = card.querySelector('.ax-follows')?.value;
        const cards = document.querySelectorAll('#set_axes_list .axis-card').length;
        const homingSlaveDerived = (document.querySelector('.hm-slave-derived')?.textContent || '').trim();
        return { role, follows, cards, homingSlaveDerived };
    });
    expect(ui.role, 'the A axis card shows role = Gantry slave').toBe('slave');
    expect(ui.follows, 'the A axis card shows follows = Y').toBe('y');
    expect(ui.cards, 'a VERTICAL per-axis list (one card per A/B, not a 3-col grid)').toBe(2);
    expect(ui.homingSlaveDerived, 'the homing card shows the DERIVED slave read-only (from Axes)').toMatch(/syncs slave\s*A.*from Axes/i);
    await page.evaluate(() => document.querySelector('#set_axes_list').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'scratchpad/dual-y-axes.png' });
});
