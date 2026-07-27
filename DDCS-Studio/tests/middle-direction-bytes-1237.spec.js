import { test, expect } from '@playwright/test';

/**
 * t1237 — THE DIRECTION UNBAKE, byte-diff discipline.
 *
 * dir1/dir2 were baked constants; they are now declared dropdowns. Two things have to be true, and neither is provable
 * by "the tests are green":
 *
 *   1. THE DEFAULT IS UNCHANGED. dir1 'pos' + dir2 'neg' (the resolver's derived opposite) must emit byte-for-byte what
 *      the baked build emitted, or the unbake silently changed everybody's program.
 *   2. A FLIP CHANGES ONLY WHAT A DIRECTION CAN CHANGE. Every line that differs between two direction combos is
 *      classified against a DECLARED set of token classes; a line that differs for any other reason is an UNEXPLAINED
 *      diff and fails the test. That is the difference between "it changed something" and "it changed the right thing".
 */
test.use({ viewport: { width: 1280, height: 900 } });

// The declared classes a direction flip may touch. A direction decides WHICH WALL FACE each probe approaches, so it can
// move the probe/motion signs, the register expressions derived from them, and the prose that names them — nothing else.
const CLASSES = [
    { id: 'probe', re: /^G31\b/, why: 'the G31 probe move carries the approach direction' },
    { id: 'motion', re: /^G0\b|^G1\b|^G53\b/, why: 'the positioning/retract moves that flank each touch' },
    { id: 'register', re: /^#\d+\s*=/, why: 'wall / centre / retract register expressions derived from the direction' },
    { id: 'comment', re: /^\(/, why: 'the prose that names the wall or the axis pair (e.g. 2axis_XtoY_<dir2>)' },
];

const emitFor = (page, params) => page.evaluate(async (p) => {
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    return emitMapped(middleStack(p)).text;
}, params);

const BASE = { featureType: 'boss', inAxis: 'auto', transAxis: 'auto', travelShape: 'dogleg', twoAxis: true, circular: false, probeZ: false, wcs: 'active', syncA: false, axisOrder: 'XY' };

test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
});

test('THE DEFAULT IS UNCHANGED: declaring dir1/dir2 emits exactly what the baked build emitted', async ({ page }) => {
    const r = await page.evaluate(async () => {
        const { middleStack, middleAxes } = await import('/wizards/middleWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const combos = [];
        for (const featureType of ['pocket', 'boss'])
            for (const twoAxis of [false, true])
                for (const probeZ of [false, true])
                    combos.push({ featureType, twoAxis, probeZ });
        const out = [];
        for (const c of combos) {
            // "baked" = what the builder resolved BEFORE the unbake: nothing stored for dir1/dir2, so middleAxes derives
            // dir1 'pos' and dir2 = its opposite. "declared" = the same values now stated explicitly by the form.
            const baked = emitMapped(middleStack({ ...c })).text;
            const declared = emitMapped(middleStack({ ...c, dir1: 'pos', dir2: 'neg' })).text;
            out.push({ c, same: baked === declared, resolved: middleAxes({ ...c }) });
        }
        return out;
    });
    for (const row of r) {
        expect(row.resolved.dir1, 'the resolver still derives dir1 pos when nothing is stored').toBe('pos');
        expect(row.resolved.dir2, 'and dir2 as its opposite').toBe('neg');
        expect(row.same, `declaring the defaults is byte-identical to the bake @ ${JSON.stringify(row.c)}`).toBe(true);
    }
});

test('A FLIP CHANGES ONLY WHAT A DIRECTION CAN CHANGE — every differing line falls in a declared class', async ({ page }) => {
    const base = await emitFor(page, { ...BASE, dir1: 'pos', dir2: 'neg' });
    const flips = {
        'dir1 pos→neg': await emitFor(page, { ...BASE, dir1: 'neg', dir2: 'neg' }),
        'dir2 neg→pos': await emitFor(page, { ...BASE, dir1: 'pos', dir2: 'pos' }),
        'both flipped': await emitFor(page, { ...BASE, dir1: 'neg', dir2: 'pos' }),
    };

    const report = {};
    for (const [name, text] of Object.entries(flips)) {
        const a = base.split('\n'), b = text.split('\n');
        expect(b.length, `${name}: a direction flip changes signs, never the SHAPE of the program (line count)`).toBe(a.length);
        const changed = [];
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) changed.push({ i, from: a[i].trim(), to: b[i].trim() });
        expect(changed.length, `${name}: the flip actually changed something (otherwise this proves nothing)`).toBeGreaterThan(0);

        const counts = {}; const unexplained = [];
        for (const c of changed) {
            const cls = CLASSES.find((k) => k.re.test(c.from) || k.re.test(c.to));
            if (!cls) { unexplained.push(c); continue; }
            counts[cls.id] = (counts[cls.id] || 0) + 1;
        }
        report[name] = { changed: changed.length, counts, unexplained: unexplained.slice(0, 5) };
        expect(unexplained, `${name}: ZERO unexplained diffs — every changed line is a probe / motion / register / comment token`).toEqual([]);
    }
    console.log('DIRECTION BYTE-DIFF CLASSES >>> ' + JSON.stringify(report, null, 1));
});

test('the twin emits the SAME bytes as the built-in for every direction combo', async ({ page }) => {
    const r = await page.evaluate(async () => {
        const { middleStack } = await import('/wizards/middleWizard.js');
        const { middleDataDef, MIDDLE_DATA_OPTYPE } = await import('/blocks/dataOps/middleData.js');
        const { createUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        localStorage.removeItem('ddcs_user_ops');
        createUserOp(middleDataDef());
        const build = builderOf(MIDDLE_DATA_OPTYPE);
        const diffs = [];
        for (const dir1 of ['pos', 'neg'])
            for (const dir2 of ['pos', 'neg'])
                for (const axisOrder of ['XY', 'YX'])
                    for (const twoAxis of [false, true]) {
                        const p = { featureType: 'boss', inAxis: 'auto', transAxis: 'auto', travelShape: 'dogleg', circular: false, probeZ: false, wcs: 'active', syncA: false, axisOrder, dir1, dir2, twoAxis };
                        const a = emitMapped(middleStack(p)).text;
                        const b = emitMapped(build(p)).text;
                        if (a !== b) diffs.push({ p, a: a.slice(0, 600), b: b.slice(0, 600) });
                    }
        return { diffs, count: diffs.length };
    });
    if (r.diffs[0]) console.log('TWIN DIFF @ ' + JSON.stringify(r.diffs[0].p) + '\n--- built-in ---\n' + r.diffs[0].a + '\n--- twin ---\n' + r.diffs[0].b);
    expect(r.count, 'the twin is byte-identical to the built-in for every order × dir1 × dir2 × findBoth combo').toBe(0);
});

test('ROUND TRIP: the declared directions survive record → reverse-sync → rebuild', async ({ page }) => {
    const r = await page.evaluate(async () => {
        const { middleDataDef, MIDDLE_DATA_OPTYPE } = await import('/blocks/dataOps/middleData.js');
        const { createUserOp, getUserDef } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        localStorage.removeItem('ddcs_user_ops');
        createUserOp(middleDataDef());
        const def = getUserDef(MIDDLE_DATA_OPTYPE) || {};
        const fields = (def.bindings || []).filter((b) => b.param === 'dir1' || b.param === 'dir2');
        const build = builderOf(MIDDLE_DATA_OPTYPE);
        const p = { featureType: 'boss', twoAxis: true, axisOrder: 'YX', dir1: 'neg', dir2: 'pos' };
        const text = emitMapped(build(p)).text;
        return {
            fieldCount: fields.length,
            dir1: fields.find((f) => f.param === 'dir1') || null,
            dir2: fields.find((f) => f.param === 'dir2') || null,
            // the emitted marker comment names the SECOND-axis direction — the visible proof the pick reached the emit
            marker: (text.match(/2axis_\w+_(pos|neg)/) || [])[1] || null,
        };
    });
    expect(r.fieldCount, 'both directions are declared bindings on the twin').toBe(2);
    expect(r.dir1.label, "mirroring the built-in's own wording").toBe('1st Axis Dir');
    expect(r.dir2.label).toBe('2nd Axis Dir');
    expect(r.dir2.when, 'the second direction shows only under Find Both, exactly like the built-in form').toEqual({ param: 'twoAxis', is: true });
    expect(r.marker, 'the declared dir2 reached the emitted program').toBe('pos');
});
