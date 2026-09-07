import { test, expect } from './support/harness.mjs';

// Sub-stack CAM S1 — prove the opunit composition (ENGINE ONLY). An `opunit` is a DECLARED, emit-transparent sub-unit
// boundary; subStackToSlot walks a custom op's parts, routes each opunit to its PARAMETRIC generator (geometry stays a LIVE
// #2600 loop, NOT unrolled) and each loose-atom run to stackToSlot (value params exposed), and composes them IN ORDER.

test('S1a opunit is emit-transparent — atoms wrapped in opunit are BYTE-IDENTICAL to the same atoms loose', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const atoms = [
            { type: 'feed', params: { rate: 250 } },
            { type: 'move', params: { mode: 'cut', x: 5, z: -1, feed: 300 } },
            { type: 'spindle', params: { rpm: 12000, dir: 'cw' } },
        ];
        const loose = [{ type: 'user_root', params: {}, children: atoms }];
        const wrapped = [{ type: 'user_root', params: {}, children: [{ type: 'opunit', params: { opType: 'user_x_data', defV: 1 }, children: atoms }] }];
        const opts = activeDialectOpts();
        return { loose: emitMapped(loose, opts).text, wrapped: emitMapped(wrapped, opts).text };
    });
    expect(r.wrapped, 'opunit wrapping = byte-identical to the atoms loose').toBe(r.loose);
    expect(r.loose).toContain('F250');
});

// t2695 — TIER MIGRATION: S1b calls getUserDef('user_surfacing_data') directly, assuming pre-seeding from the real app's
// boot (web/app.js's seedDefaultPortedUserOps(), which registers every SEED_BUILDERS factory incl. surfacingDataDef). The
// node harness's page.goto stub never runs that boot, so this test registers the same factory explicitly (seeding pattern 2).
test('S1b subStackToSlot — a standard sub-unit stays LIVE (generator loop) + custom feed/z exposed as #var, in ORDER', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { getUserDef, defVOf, flattenBlocks, registerUserOp, listUserOps } = await import('/blocks/userOps.js');
        const { surfacingDataDef } = await import('/blocks/dataOps/surfacingData.js');
        if (!listUserOps().some((d) => d.opType === 'user_surfacing_data')) registerUserOp(surfacingDataDef());
        const { subStackToSlot, deriveStandardParams } = await import('/data/subStackToSlot.js');
        const slotPack = await import('/data/slotPack.js');

        const surfDef = getUserDef('user_surfacing_data');
        const surfExec = surfDef.template[0].children;   // the 8 exec atoms (progstart…toolsel) — keep the trailing markers

        // TARGET (hand-built): user_root{ opunit(user_surfacing_data){surfacing atoms}, feed{rate}, move{z} }
        const feedBlk = { type: 'feed', params: { rate: 300 } };
        const moveBlk = { type: 'move', params: { mode: 'cut', z: -2 } };
        const target = {
            opType: 'user_substack_target',
            template: [{ type: 'user_root', params: {}, children: [
                { type: 'opunit', params: { opType: 'user_surfacing_data', defV: defVOf('user_surfacing_data') }, children: surfExec },
                feedBlk,
                moveBlk,
            ] }],
            bindings: [],
        };
        // the custom part's bindings point at the loose feed/move (indices computed over the full flatten)
        const flat = flattenBlocks(target.template);
        target.bindings = [
            { param: 'cfeed', blockIndex: flat.indexOf(feedBlk), key: 'rate', label: 'Cut feed', units: 'mm/min', type: 'number', default: 300 },
            { param: 'cz', blockIndex: flat.indexOf(moveBlk), key: 'z', label: 'Plunge Z', units: 'mm', type: 'number', default: -2 },
        ];

        // the re-derivation recovers the surfacing params from the opunit's sockets (one-source READ)
        const derived = deriveStandardParams(surfDef, surfExec);

        const slot = subStackToSlot(target);
        const byKey = {}; (slot.fields || []).forEach((f) => { byKey[f.key] = f; });
        const macro = slotPack.slotMacro({ slot: 40, name: slot.name, fields: slot.fields, body: slot.body });
        return {
            derivedStepover: derived.stepover, derivedDepth: derived.depth,
            body: slot.body, nfields: slot.fields.length,
            stepoverVar: byKey.stepoverPct ? byKey.stepoverPct.var : null,   // t1325 — the surface generator's knob is the PERCENTAGE now; the mm is derived in the macro
            derivedToolDia: derived.toolDia, derivedStepoverPct: derived.stepoverPct,   // t1361 — the two sockets the mm is derived from
            cfeed: byKey.cfeed || null, cz: byKey.cz || null,
            macro,
        };
    });

    // (1) the re-derivation recovered the surfacing params from the sub-stack sockets (one-source, not a snapshot)
    // t1361 — READ FROM THE SOCKETS THAT EXIST. The re-derivation itself is generic (it walks the def's bindings), so
    // nothing about it changed; what changed is which sockets surfacing HAS. The flat `surfacefill.stepover` mm is
    // gone — `surfaceraster` carries the tool Ø and the percentage — and the depth moved from `stepdown.to` onto the
    // same atom. The recovered stepover is still the SAME 7.2mm, one derivation removed, which is the whole claim:
    // the sub-unit reads its parameters from the stack rather than from a snapshot taken beside it.
    expect(r.derivedToolDia, 'tool Ø re-derived from the surfaceraster socket').toBe(12);
    expect(r.derivedStepoverPct, 'stepover % re-derived from the surfaceraster socket').toBe(60);
    expect(r.derivedToolDia * r.derivedStepoverPct / 100, 'and it is the same 7.2mm the flat socket used to hold').toBeCloseTo(7.2, 6);
    expect(r.derivedDepth, 'depth re-derived from the surfaceraster depth socket').toBe(0.5);

    // (2) the surfacing sub-unit stays LIVE — the generator's runtime WHILE raster loop is intact, NOT unrolled
    expect(r.body, 'Z-layer WHILE loop').toMatch(/WHILE #\d+ LT #\d+ DO1/);
    expect(r.body, 'raster ROW WHILE loop (the stepover loop)').toMatch(/WHILE #\d+ LT #\d+ DO2/);
    expect(r.body, 'row count computed live from the stepover var').toContain(';raster row count');
    expect(r.body, 'NO unrolled literal raster passes (all cut targets are #vars)').not.toMatch(/G1 [XY]-?\d/);
    // the stepover is an exposed #var driving the loop (a live #2600 knob)
    // t1325 — PREMISE CHANGED BY RULING, restated. The exposed knob is the stepover PERCENTAGE; the row count now
    // divides by the DERIVED mm (#22 = toolØ · pct / 100), so the loop is still driven by a live pendant value — one
    // step removed, and the property this guarded (the raster is computed at the machine, not baked) is intact.
    expect(r.stepoverVar, 'the stepover percentage is an exposed field').toBeTruthy();
    expect(r.body, 'and the row count divides by the derived mm, which reads that knob').toContain('/#22]   ;raster row count');
    expect(r.body, 'which is itself derived from the exposed percentage').toContain(` * ${r.stepoverVar} / 100]`);

    // (3) the custom feed + plunge Z are EXPOSED as #vars (a #2600 knob each), not baked
    expect(r.cfeed, 'custom feed exposed').toBeTruthy();
    expect(r.cz, 'custom plunge Z exposed').toBeTruthy();
    expect(r.body, 'custom feed rides F#var').toContain(`F${r.cfeed.var}`);
    expect(r.body, 'custom plunge Z rides Z#var').toContain(`Z${r.cz.var}`);
    // the custom #vars are allocated AROUND the surfacing siblings (no #11xx collision)
    expect(r.cfeed.idx, 'custom feed #11xx is past the surfacing 1100-1109').toBeGreaterThanOrEqual(1110);

    // (4) EXECUTION ORDER preserved — the surfacing sub-unit's toolpath emits BEFORE the custom feed/move
    expect(r.body.indexOf(';raster row count'), 'surfacing before custom').toBeLessThan(r.body.indexOf(`Z${r.cz.var}`));

    // (5) slotMacro renders a valid macro (header + the composed body)
    // t2117 -- the header comment is `( cam<N>.nc — ... )`, not `( macro_cam<N>.nc — ... )`: the vendor's own
    // dispatcher parameter (#968) looks for `cam<N>.nc` at the controller's /local root, confirmed against
    // THIS machine's own live SYSDISK/eng, not just the vendor sample (VENDOR-PACK-FIXES-PLAN.md T4).
    expect(r.macro, 'slotMacro renders').toContain('( cam');
    expect(r.macro).toContain(`F${r.cfeed.var}`);
});

test('S1c robustness: a standard opunit with an unregistered opType fails SOFT (a placeholder), not a silent drop', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { subStackToSlot } = await import('/data/subStackToSlot.js');
        const target = {
            opType: 'user_missing_target',
            template: [{ type: 'user_root', params: {}, children: [
                { type: 'opunit', params: { opType: 'user_does_not_exist', defV: 1 }, children: [{ type: 'move', params: { mode: 'cut', x: 5, z: -1 } }] },
                { type: 'move', params: { mode: 'cut', z: -3 } },
            ] }],
            bindings: [],
        };
        const slot = subStackToSlot(target);
        return { name: slot.name, body: slot.body };
    });
    expect(r.body, 'missing sub-unit → a placeholder comment, not silently dropped').toContain('op def not found');
    expect(r.name, 'the missing op is named in the slot').toContain('missing op');
});
