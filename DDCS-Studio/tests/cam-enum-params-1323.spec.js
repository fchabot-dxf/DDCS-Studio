import { test, expect } from '@playwright/test';

/**
 * t1323 (3) — CAM SLOT ENUM PARAMS, IN THEIR TWO CLASSES.
 *
 * USER SCREENSHOT (Build CAM slot on Surfacing): the param table walked only value params, so zMode had NO ROW — while
 * the footer copy already promised enum support. A skim CAM slot could not be built at all.
 *
 * THE TWO CLASSES, and why they are not one feature — they differ in WHO READS THE VALUE:
 *   VALUE enum — the macro reads it as a number at RUN time → the pendant can hold it → the full Expose treatment.
 *   BUILD enum — it changes the PROGRAM'S SHAPE (the G91 wrap is built or it is not). AMENDED MID-TURN (user, live):
 *                this is NOT bake-only — the macro can carry EVERY arm and IF/GOTO on the pendant mirror, the pattern
 *                the corner generator has always used by hand. So THREE dispositions: BAKE (the DEFAULT — a macro must
 *                not carry possibility-space unless asked), EXPOSE AS VALUE (value enums), EXPOSE AS BRANCH (opt-in,
 *                refused when the arms would bloat the macro).
 * And the class was already declared at every param: a binding's `blockIndex` is the socket its value lands in, so a
 * structural binding (blockIndex == null) has nowhere for a runtime value to go. This turn only names it.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('THE CLASSES ARE DECLARED, not sniffed — the socket a param has IS its class', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { enumClassOf, buildEnumFields } = await import('/data/opCamMap.js');
        const def = uo.getUserDef('user_surfacing_data');
        const enums = (def.bindings || []).filter((b) => b.type === 'enum').map((b) => ({ param: b.param, socket: b.blockIndex != null, cls: enumClassOf(b) }));
        return { enums, build: buildEnumFields(def, uo.defaultParams(def)) };
    });
    // zMode has NO socket — it drives the postInstantiate fork, so it cannot be anything but a build-time enum
    const zm = r.enums.find((e) => e.param === 'zMode');
    expect(zm, `surfacing declares a zMode enum: ${JSON.stringify(r.enums)}`).toBeTruthy();
    expect(zm.socket, 'with no value socket').toBe(false);
    expect(zm.cls, 'therefore: BUILD').toBe('build');
    // …and every enum that DOES have a socket is a value enum, by the same one rule
    for (const e of r.enums.filter((e) => e.socket)) expect(e.cls, `${e.param} has a socket → value`).toBe('value');
    // the row the table was missing, with its friendly labels and its reason
    expect(r.build.length, 'one build-enum row').toBe(1);
    expect(r.build[0].key).toBe('zMode');
    expect(r.build[0].buildEnum.map((o) => o.value), 'the def’s own options — not a copy').toEqual(['normal', 'skim']);
    // AMENDED: two arms fit the budget, so branch-expose is OFFERED — but `exposed:false` is the declared default.
    expect(r.build[0].branchable, 'two arms fit the branch budget').toBe(true);
    expect(r.build[0].exposed, 'and yet it defaults to BAKE — no possibility-space unless asked').toBe(false);
    expect(r.build[0]._exposeTip, 'the tip explains the branch, postGating-style').toMatch(/branch/i);
});

test('THE ROW EXISTS NOW — a Surfacing op seeds a zMode row it never had', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { seedFromOp } = await import('/data/opCamMap.js');
        const def = uo.getUserDef('user_surfacing_data');
        const norm = seedFromOp({ opType: 'user_surfacing_data', params: uo.defaultParams(def) });
        const skim = seedFromOp({ opType: 'user_surfacing_data', params: { ...uo.defaultParams(def), zMode: 'skim' } });
        const row = (s) => (s.fields || []).find((f) => f.key === 'zMode');
        return {
            normArm: norm.camType, normRow: row(norm), normUnsupported: norm.unsupported,
            skimArm: skim.camType, skimRow: row(skim), skimUnsupported: skim.unsupported,
            skimUniversal: !!skim.universal,
        };
    });
    // NORMAL — the compact surface generator, unchanged, now WITH the row that states the shape it builds
    expect(r.normArm, 'the normal arm is untouched').toBe('surface');
    expect(r.normRow, 'and it finally carries a zMode row').toBeTruthy();
    expect(r.normRow.value).toBe('normal');
    expect(r.normRow.exposed, 'defaulting to BAKE — the slot carries one shape unless the operator opts in').toBe(false);
    // SKIM — the surface generator emits ONE fixed absolute shape, so a skim op routes to the universal unroll (the same
    // ruling as pocket-polygon and single-axis middle). The point is that it BUILDS AT ALL: today it could not.
    expect(r.skimUnsupported, 'a skim surfacing is buildable — this is the user’s blocked case').toBeUndefined();
    expect(r.skimUniversal, 'via the universal unroll, whose source is the op’s own reshaped stack').toBe(true);
    expect(r.skimRow, 'with its row too').toBeTruthy();
    expect(r.skimRow.value).toBe('skim');
});

test('AND THE MACRO CARRIES THE SKIM SHAPE — the whole point: the right numbers in the RIGHT program', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const def = uo.getUserDef('user_surfacing_data');
        const P = uo.defaultParams(def);
        const slot = (zMode) => stackToSlot(def, { zMode: { exposed: false, value: zMode } }, new Set(), 0);
        // THE INDEPENDENT TRUTH: what the op ITSELF emits in each mode (builderOf = instantiate + postInstantiate).
        const own = (zMode) => String(emitProgram(builderOf('user_surfacing_data')({ ...P, zMode })));
        return { skimBody: slot('skim').body, normBody: slot('normal').body, ownSkim: own('skim'), ownNormal: own('normal') };
    });
    // t1361 — SAME RULE, NEW SIGNATURE. The skim shape used to be a G91 wrapper; it is now a program that READS the
    // live work position into #62-#64 and runs its ordinary absolute body in that frame (t1355 — there is nothing in
    // a loop's text for a relativizer to rewrite). So the token that says "this is the skim program" is the frame
    // read, not G91, and that is what both sides are matched on. What is being asserted is unchanged.
    const SKIM_SHAPE = /#62=#790/;
    // The skim shape is what postInstantiate builds…
    expect(r.ownSkim, 'the op’s own skim emit reads the live frame').toMatch(SKIM_SHAPE);
    expect(r.ownNormal, 'and its normal emit does not').not.toMatch(SKIM_SHAPE);
    // …and the CAM slot's macro must carry the same shape. Before this turn the unroll called instantiate directly, so
    // postInstantiate never ran and a skim slot emitted the NORMAL program — the right numbers, the wrong shape.
    expect(r.skimBody, 'the skim SLOT macro reads the live frame too').toMatch(SKIM_SHAPE);
    expect(r.normBody, 'the normal slot macro does not — the two are genuinely different programs').not.toMatch(SKIM_SHAPE);
    expect(r.skimBody === r.normBody, 'so the build enum actually changed the built program').toBe(false);
});

test('A VALUE ENUM STILL EXPOSES — its pendant number lands in the slot', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { seedFromOp } = await import('/data/opCamMap.js');
        // corner: the CAM generator's value enums (which corner, which WCS) — the macro reads them as ints at run time
        const seed = seedFromOp({ opType: 'user_corner_data', params: { corner: 'BL', wcs: 'active' } });
        const enums = (seed.fields || []).filter((f) => f.enum);
        // …and the BUILT slot: the generator allocates a #11xx pendant param per exposed field and the macro READS it
        const { cornerSlot } = await import('/data/probeToSlot.js');
        const built = cornerSlot(new Set(), 0);
        const bEnum = (built.fields || []).filter((f) => enums.some((e) => e.key === f.key));
        return { camType: seed.camType, enums: enums.map((f) => ({ key: f.key, value: f.value, exposed: f.exposed, exposable: f.exposable, opts: f.enum.length })),
            built: bEnum.map((f) => ({ key: f.key, idx: f.idx, v: f.var, read: !!(f.var && String(built.body || '').includes(f.var)) })) };
    });
    expect(r.camType).toBe('corner');
    expect(r.enums.length, `the corner generator carries value enums: ${JSON.stringify(r.enums)}`).toBeGreaterThan(0);
    for (const e of r.enums) {
        expect(typeof e.value, `${e.key} resolves to the INT the macro reads`).toBe('number');
        expect(e.exposed, `${e.key} is exposed by default — the full treatment the footer promises`).toBe(true);
        expect(e.exposable, `${e.key} is not greyed — a pendant number really does drive it`).not.toBe(false);
    }
    // THE NUMBER LANDS: each value enum gets a real pendant param (#11xx, mirrored to #26xx and read into the local #var
    // the body uses) — precisely what a BUILD enum can never have, which is why the two classes are kept apart.
    expect(r.built.length, `the built slot allocates them: ${JSON.stringify(r.built)}`).toBeGreaterThan(0);
    for (const f of r.built) {
        expect(f.idx, `${f.key} gets a pendant param`).toBeTruthy();
        expect(f.read, `${f.key}'s macro reads its ${f.v} at run time`).toBe(true);
    }
});

test('THE TABLE DRAWS IT — a dropdown in the Value column, BAKE preselected, branch offered with its reason', async ({ page }) => {
    await boot(page);
    // Drive the REAL surface: the op menu's "Build CAM slot" on a Surfacing op, exactly as the user did.
    await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const P = uo.defaultParams(uo.getUserDef('user_surfacing_data'));
        window.ddcsSetBlockProgram && window.ddcsSetBlockProgram([{ type: 'op', opType: 'user_surfacing_data', params: P, children: builderOf('user_surfacing_data')(P) }]);
    });
    await page.evaluate(() => window.showApp && window.showApp('macros'));
    await page.waitForTimeout(1200);
    const r = await page.evaluate(async () => {
        // the app's OWN entry point — the one the op menu's "Build CAM slot" item calls, with the real op record
        await import('/ui/macrosApp.js').then((m) => m.initMacrosApp());
        const uo = await import('/blocks/userOps.js');
        const P = uo.defaultParams(uo.getUserDef('user_surfacing_data'));
        window.ddcsOpenCamAuthoring({ opType: 'user_surfacing_data', params: P, label: 'Surfacing' });
        await new Promise((res) => setTimeout(res, 900));
        const row = document.querySelector('tr[data-fkey="zMode"]');
        if (!row) return { row: false, entry: !!window.ddcsOpenCamAuthoring, rows: Array.from(document.querySelectorAll('tr[data-fkey]')).map((t) => t.dataset.fkey) };
        const sel = row.querySelector('select.cbm-build');
        const expose = row.querySelector('input[data-mode="expose"]');
        const bake = row.querySelector('input[data-mode="bake"]');
        return {
            row: true,
            options: sel ? Array.from(sel.options).map((o) => o.value) : null,
            exposeDisabled: expose ? expose.disabled : null,
            exposeChecked: expose ? expose.checked : null,
            bakeChecked: bake ? bake.checked : null,
            exposeReason: expose ? (expose.closest('label') || {}).title : null,
            bakeDisabled: bake ? bake.disabled : null,
            slotCell: row.lastElementChild ? row.lastElementChild.textContent.trim() : null,
        };
    });
    expect(r.row, `the zMode row is drawn — the row the screenshot was missing: ${JSON.stringify(r)}`).toBe(true);
    expect(r.options, 'a dropdown of the def’s own modes, in the Value column').toEqual(['normal', 'skim']);
    // AMENDED (user, live): two arms fit the budget, so "Expose as branch" is OFFERED — but BAKE is preselected, so the
    // slot carries one shape until someone consciously opts into carrying both.
    expect(r.exposeDisabled, 'branch-expose is available for a 2-arm enum').toBe(false);
    expect(r.exposeReason, 'and the control explains what it does').toMatch(/branch/i);
    expect(r.bakeChecked, 'BAKE is the preselected default — the choice is visible and conscious').toBe(true);
    expect(r.exposeChecked, 'nothing carries possibility-space by default').toBe(false);
    expect(r.bakeDisabled, 'and bake stays available').toBe(false);
    expect(r.slotCell, 'the slot column names the shape being built').toMatch(/built as/i);
});

test('EXPOSE AS BRANCH — ONE installed macro, and the SIM executes each arm to its own shape', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const def = uo.getUserDef('user_surfacing_data');
        // THE OPT-IN: this slot's zMode is exposed as a branch, so the macro must carry both arms.
        const slot = stackToSlot(def, { zMode: { exposed: true } }, new Set(), 0);
        const f = (slot.fields || []).find((x) => x.key === 'zMode');
        // RUN THE ONE INSTALLED MACRO TWICE, differing ONLY in the pendant number the operator would dial in: replace
        // the canonical read (#var=#mirror) with the value, exactly as the controller would have loaded it.
        // t1361 — THE ARMS ARE TOLD APART BY WHERE THEY CUT, not by a mode flag. `stats.absolute` used to separate
        // them because Skim was a G91 walk; the skim arm is absolute now too (it reads the live position into
        // registers and cuts absolutely in THAT frame — t1355), so that flag says "true" for both and discriminates
        // nothing. What still differs is the only thing that ever mattered: the NORMAL arm is anchored to the WCS and
        // ignores where the operator is standing, while the SKIM arm follows the jog. So each arm is run twice, with
        // the controller's live-position registers seeded to two different points, and the paths are compared.
        const run = (n, jog) => {
            const nc = [`#790=${jog}`, `#791=${jog}`, `#792=${jog}`,
                ...slot.body.split(NL).map((l) => l.indexOf(f.var + '=#') === 0 ? (f.var + '=' + n) : l)].join(NL);
            const t = traceToolpath(nc);
            const segs = (t.segments || []);
            // the CUT extents, not every segment: the opening Z move happens before the tool has travelled in XY, so
            // it sits at X0 in both arms and would mask the very shift being measured.
            const cuts = segs.filter((s) => !s.rapid);
            const xs = cuts.flatMap((s) => [s.x1, s.x2]).filter((v) => Number.isFinite(v));
            const ys = cuts.flatMap((s) => [s.y1, s.y2]).filter((v) => Number.isFinite(v));
            return { segs: segs.length, cuts: cuts.length, absolute: !!(t.stats && t.stats.absolute),
                minX: xs.length ? +Math.min(...xs).toFixed(3) : null, minY: ys.length ? +Math.min(...ys).toFixed(3) : null };
        };
        return { field: f && { idx: f.idx, var: f.var, min: f.min, max: f.max, def: f.def }, body: slot.body,
            arm0: run(0, 0), arm1: run(1, 0), arm0Jogged: run(0, 30), arm1Jogged: run(1, 30) };
    });
    // THE PENDANT KNOB: a real slot param, 0..1, so the shape is picked at the machine.
    expect(r.field, 'the branch gets its own pendant param').toBeTruthy();
    expect(r.field.min).toBe(0);
    expect(r.field.max, 'one number per arm').toBe(1);
    // THE MAPPING IS ON THE SHEET — a bare 0/1 on a controller screen means nothing by itself.
    expect(r.body, 'the macro states which number is which arm').toMatch(/0 = Normal[\s\S]*1 = Skim/);
    // ONE MACRO, BOTH ARMS, jumped by the mirror — the corner generator's own IF/GOTO pattern, built from the def.
    expect(r.body, 'the jump onto the second arm').toContain('IF ' + r.field.var + ' EQ 1 GOTO 810');
    expect(r.body, 'the label it jumps to').toContain('N810');
    expect(r.body, 'and the skim arm really is in there').toMatch(/#62=#790/);   // t1361 — the frame read IS the skim arm now (was G91)
    // AND IT EXECUTES: the sim runs that one macro at each pendant value and walks a DIFFERENT program each time.
    expect(r.arm0.segs, 'arm 0 executes real motion').toBeGreaterThan(0);
    expect(r.arm1.segs, 'arm 1 executes real motion').toBeGreaterThan(0);
    // PENDANT 0 — the NORMAL arm: anchored to the WCS, so moving the operator moves nothing.
    expect(r.arm0Jogged.minX, `pendant 0 is WCS-referenced — jogging elsewhere does not move it: ${JSON.stringify([r.arm0, r.arm0Jogged])}`).toBe(r.arm0.minX);
    expect(r.arm0Jogged.minY, 'in Y as well').toBe(r.arm0.minY);
    // PENDANT 1 — the SKIM arm: the face is cut wherever the tool was jogged to, so a 30mm move takes the path with it.
    expect(r.arm1Jogged.minX, `pendant 1 follows the jog — 30mm across is 30mm of toolpath: ${JSON.stringify([r.arm1, r.arm1Jogged])}`).toBeCloseTo(r.arm1.minX + 30, 3);
    expect(r.arm1Jogged.minY, 'in Y as well').toBeCloseTo(r.arm1.minY + 30, 3);
});

test('AND THE BRANCH IS REFUSED WHEN IT WOULD BLOAT — the arm budget, with its reason shown', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { buildEnumFields, BRANCH_ARM_CAP, branchRefusal } = await import('/data/opCamMap.js');
        // a synthetic def with more arms than the budget — the same declaration shape, just wider
        const wide = { bindings: [{ param: 'mode', type: 'enum', default: 'a', label: 'Mode', widgetConfig: { options: [['A', 'a'], ['B', 'b'], ['C', 'c'], ['D', 'd'], ['E', 'e']] } }] };
        const f = buildEnumFields(wide, {})[0];
        return { cap: BRANCH_ARM_CAP, arms: f.buildEnum.length, branchable: f.branchable, tip: f._exposeTip, refusal: branchRefusal(5) };
    });
    expect(r.arms).toBe(5);
    expect(r.arms > r.cap, 'five arms exceed the budget').toBe(true);
    expect(r.branchable, 'so branch-expose is refused — five copies of the program is not a macro').toBe(false);
    // REFUSED, NOT HIDDEN: the operator is told why, and Bake stays the honest way to build it.
    expect(r.tip, 'with the reason on the control').toBe(r.refusal);
    expect(r.tip).toMatch(/bake the shape instead/i);
});
