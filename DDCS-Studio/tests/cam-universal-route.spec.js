import { test, expect } from '@playwright/test';

// Universal CAM U2+U3 — the ROUTER + the universal build arm. A forked/custom op (user_* with no dedicated CAM generator)
// routes to camTypeOf {universal:true} → seedFromOp reads the def BINDINGS directly → value params are exposable, geometry
// params are bake-only (classifier) → stackToSlot unrolls the op into a CAM slot. A standard op still routes to its generator.

test('U2 router: a forked custom op → {universal} seed with value params exposable, geometry bake-only; a standard op → its generator', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { userOpFromStack, registerUserOp } = await import('/blocks/userOps.js');
        const { camTypeOf, seedFromOp } = await import('/data/opCamMap.js');

        // A custom op = Feed + a Move cut (value params) + a Drill (num()-consumed geometry). Plain frozen bindings (no
        // bindingSpecs), so the classifier resolves fold-membership over def.template directly. flatten: user_root(0),
        // param_group(1), feed(2), move(3), drill(4).
        const stack = [{ type: 'user_root', params: {}, uiChildren: [{ type: 'param_group', params: { group: 'Cut' }, children: [] }], children: [
            { type: 'feed', params: { rate: 200 } },
            { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 500 } },
            { type: 'holecycle', params: { pattern: 'single', cycle: 'peck', x0: 0, y0: 0, depth: 5, peck: 5, feed: 100 } },
        ] }];
        const bindings = [
            { param: 'frate', blockIndex: 2, key: 'rate', label: 'Feed', units: 'mm/min', type: 'number', default: 200 },
            { param: 'mx', blockIndex: 3, key: 'x', label: 'X', type: 'number', default: 10 },
            { param: 'mz', blockIndex: 3, key: 'z', label: 'Plunge Z', type: 'number', default: -3 },
            { param: 'dfeed', blockIndex: 4, key: 'feed', label: 'Drill feed', type: 'number', default: 100 },
            { param: 'ddepth', blockIndex: 4, key: 'depth', label: 'Drill depth', type: 'number', default: 5 },
        ];
        registerUserOp(userOpFromStack('u2_custom_data', 'My Custom Op', stack, bindings));

        const op = { type: 'op', opType: 'user_u2_custom_data', label: 'My Custom Op', params: { frate: 250, mx: 15, mz: -4, dfeed: 120, ddepth: 6 } };
        const ct = camTypeOf(op);
        const seed = seedFromOp(op);
        const byKey = {}; (seed.fields || []).forEach((f) => { byKey[f.key] = f; });

        // a STANDARD op (the corner data-op twin) must still route to its PREMIUM generator, not universal
        const cornerCt = camTypeOf({ type: 'op', opType: 'user_corner_data', params: {} });

        return { ct, camType: seed.camType, universal: seed.universal, nfields: (seed.fields || []).length, byKey, cornerCt };
    });

    // the router: a non-generator op → {universal}
    expect(r.ct, 'a forked op routes to universal').toMatchObject({ universal: true });
    expect(r.camType).toBe('universal');
    expect(r.universal).toBe(true);
    expect(r.nfields, '5 value bindings → 5 fields').toBe(5);

    // value params (val() ride-through, no fold) are EXPOSABLE; the seed value comes from op.params
    expect(r.byKey.frate, 'feed rate = value → exposable').toMatchObject({ exposable: true, value: 250 });
    expect(r.byKey.mx, 'move X = value → exposable').toMatchObject({ exposable: true, value: 15 });
    expect(r.byKey.mz, 'plunge Z = value → exposable').toMatchObject({ exposable: true, value: -4 });
    // t1091 — drill FEED now rides val() (pure F# interpolation) → EXPOSABLE. drill DEPTH drives the peck loop → still geometry.
    expect(r.byKey.dfeed, 'drill feed = value (t1091 num→val) → exposable').toMatchObject({ exposable: true });
    expect(r.byKey.ddepth, 'the hole depth is a register seed now → exposable (t1391)').toMatchObject({ exposable: true });   // t1391 — the hole depth is a live #81 register seed now (t1389 val()), not a JS loop bound: the classifier's answer INVERTS with the mechanism

    // the premium path is untouched — corner still routes to its generator
    expect(r.cornerCt, 'a standard op keeps its premium generator').toMatchObject({ camType: 'corner' });
    expect(r.cornerCt.universal).toBeUndefined();
});

test('U3 universal build: stackToSlot unrolls the forked op — exposed value params → #var + readLine, geometry → baked literals', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { userOpFromStack, registerUserOp, getUserDef } = await import('/blocks/userOps.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const slotPack = await import('/data/slotPack.js');

        const stack = [{ type: 'user_root', params: {}, uiChildren: [{ type: 'param_group', params: { group: 'Cut' }, children: [] }], children: [
            { type: 'feed', params: { rate: 200 } },
            { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 500 } },
            { type: 'holecycle', params: { pattern: 'single', cycle: 'peck', x0: 0, y0: 0, depth: 5, peck: 5, feed: 100 } },
        ] }];
        const bindings = [
            { param: 'frate', blockIndex: 2, key: 'rate', label: 'Feed', units: 'mm/min', type: 'number', default: 200 },
            { param: 'mx', blockIndex: 3, key: 'x', label: 'X', type: 'number', default: 10 },
            { param: 'mz', blockIndex: 3, key: 'z', label: 'Plunge Z', type: 'number', default: -3 },
            { param: 'ddepth', blockIndex: 4, key: 'depth', label: 'Drill depth', type: 'number', default: 5 },
        ];
        registerUserOp(userOpFromStack('u3_build_data', 'Build Op', stack, bindings));
        const def = getUserDef('user_u3_build_data');

        // the decl declFromOp would build for a universal op: value params exposed (positive, seeded), geometry baked to its value
        const decl = {
            frate: { exposed: true, value: 250 },
            mz: { exposed: true, value: -4 },
            mx: { exposed: false, value: 15 },        // user chose to bake X
            ddepth: { exposed: false, value: 6 },     // t1391 — exposABLE now, but the user CHOSE to bake it at the op's value
        };
        const slot = stackToSlot(def, decl);
        return { name: slot.name, nfields: slot.fields.length, keys: slot.fields.map((f) => f.key), body: slot.body,
            macro: slotPack.slotMacro({ slot: 30, name: slot.name, fields: slot.fields, body: slot.body }) };
    });

    // exposed value params → 2 fields (frate + mz); baked mx + geometry ddepth → literals
    expect(r.nfields, 'frate + mz exposed → 2 fields').toBe(2);
    expect(r.keys.sort()).toEqual(['frate', 'mz']);
    // the exposed #vars ride val() through to F#/Z#; the pendant field seeds from the op value (250 / -4)
    expect(r.body, 'exposed feed → F#var').toMatch(/F#\d/);
    expect(r.body, 'exposed plunge Z → Z#var').toMatch(/Z#\d/);
    expect(r.body, 'baked X → literal 15').toContain('X15');
    // t1391 — THE CLAIM IS UNCHANGED, ITS EVIDENCE MOVED. This asserted `Z-6` because the literal kernel UNROLLED its peck
    // ladder and baked each depth as a Z word. The parametric body seeds the depth into #81 and the loop feeds against it,
    // so the same fact — the op's value 6 reached the emit rather than the binding default 5 — is read at the seed.
    expect(r.body, 'the baked depth reached the emit as the register seed (6, not the default 5)').toMatch(/#81=6\b/);
    expect(r.body, 'and not the binding default').not.toMatch(/#81=5\b/);
    // a real slot macro renders (reads + body)
    expect(r.macro).toContain('#2600');
    expect(r.macro, 'the exposed feed reads its mirror').toMatch(/#\d=#2600/);
});

test('U3 robustness: stackToSlot fails SOFT (a placeholder slot) when the op def is missing — no crash on a stale saved pack', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { stackToSlot } = await import('/data/stackToSlot.js');
        // getUserDef(deletedOp) → null; the CAM pack (an independent store) still holds the universal op → rebuild must not throw
        let threw = false, slot = null;
        try { slot = stackToSlot(null, { feed: { exposed: true } }); } catch (e) { threw = true; }
        return { threw, name: slot && slot.name, nfields: slot && slot.fields.length, body: slot && slot.body };
    });
    expect(r.threw, 'a null def must NOT throw').toBe(false);
    expect(r.name).toBe('(missing op)');
    expect(r.nfields).toBe(0);
    expect(r.body).toContain('not found');
});
