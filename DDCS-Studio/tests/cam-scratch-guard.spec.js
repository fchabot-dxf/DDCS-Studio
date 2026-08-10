import { test, expect } from '@playwright/test';

const SCRATCH = 'scratchpad';

// t1081 slice A declared the generator scratch bands and made the build REFUSE a slot whose form values its own
// generator would clobber. t1083 slice B then made that collision IMPOSSIBLE by minting local vars around the band.
// So the guard is now a BACKSTOP: it must still detect + refuse correctly (proven here on SYNTHETIC fields), while the
// REAL generators produce nothing for it to catch. If these synthetic tests ever pass with real generator output, the
// allocator has regressed.

test('S5(3) backstop — the guard still DETECTS and NAMES a collision (synthetic), while the real generators produce NONE', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { surfacingSlot, pocketSlot } = await import('/data/millToSlot.js');
        const { fieldVarCollisions, collisionMessage, bandsFor, maxLocalVar } = await import('/data/camScratch.js');
        // SYNTHETIC: a field deliberately sitting on #20, owned by a pocket op → the guard must catch it
        const synthetic = fieldVarCollisions(
            [{ key: 'rpm', label: 'Spindle RPM', var: '#20', _op: 1 }, { key: 'w', label: 'Width (X)', var: '#5', _op: 1 }],
            [{ type: 'surface' }, { type: 'pocket' }],
        );
        // REAL: the same 2-part mill composition slice A had to refuse now allocates clean
        const used = new Set();
        const p1 = surfacingSlot(used, 0); (p1.fields || []).forEach((f) => used.add(f.idx));
        const f1 = (p1.fields || []).map((f) => ({ ...f, _op: 0 }));
        const p2 = pocketSlot(used, maxLocalVar(f1));
        const f2 = (p2.fields || []).map((f) => ({ ...f, _op: 1 }));
        const real = fieldVarCollisions([...f1, ...f2], [{ type: 'surface' }, { type: 'pocket' }]);
        return {
            millBand: bandsFor('pocket'),
            syntheticCount: synthetic.length, syntheticVar: synthetic[0] && synthetic[0].varNum,
            msg: collisionMessage(synthetic),
            realCount: real.length,
        };
    });
    // the declared band is the real one (#20-#33 — including the #33 the old prose header omitted)
    const inMill = (n) => r.millBand.some(([lo, hi]) => n >= lo && n <= hi);
    expect(inMill(20) && inMill(26) && inMill(27) && inMill(33), 'the declared mill band covers #20-#33').toBe(true);
    // the BACKSTOP still works, and still names everything an operator needs
    expect(r.syntheticCount, 'a field sitting in its own generator band is detected').toBe(1);
    expect(r.syntheticVar, 'and it is the right variable').toBe(20);
    expect(r.msg, 'the refusal names the colliding variable').toMatch(/#20/);
    expect(r.msg, 'the refusal names the field').toMatch(/Spindle RPM/i);
    expect(r.msg, 'the refusal names the generator that would clobber it').toMatch(/pocket/i);
    expect(r.msg, 'the refusal explains the consequence in operator terms').toMatch(/spindle speed forced to 0/i);
    // …and after slice B the real generators give it NOTHING to catch
    expect(r.realCount, 'the REAL 2-part mill composition no longer collides (slice B) — the guard is quiet').toBe(0);
});

test('S5(3) backstop — validatePack ERRORS on a synthetic colliding slot, and passes a real composed one', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { surfacingSlot, pocketSlot } = await import('/data/millToSlot.js');
        const { maxLocalVar } = await import('/data/camScratch.js');
        const SP = await import('/data/slotPack.js');
        // synthetic: a hand-made slot whose pocket field sits on #20 (what a pre-guard build could have produced)
        const bad = { slot: 22, name: 'bad', ops: [{ type: 'pocket' }], body: '', fields: [{ idx: 1100, key: 'rpm', label: 'Spindle RPM', var: '#20', _op: 0 }] };
        // real: a 2-part composed slot built through the new allocator
        const used = new Set();
        const p1 = surfacingSlot(used, 0); (p1.fields || []).forEach((f) => used.add(f.idx));
        const f1 = (p1.fields || []).map((f) => ({ ...f, _op: 0 }));
        const p2 = pocketSlot(used, maxLocalVar(f1));
        const f2 = (p2.fields || []).map((f) => ({ ...f, _op: 1 }));
        const good = { slot: 23, name: 'good', ops: [{ type: 'surface' }, { type: 'pocket' }], fields: [...f1, ...f2], body: SP.composeParts([p1.body, p2.body]) };
        return { bad: SP.validatePack({ slots: [bad] }), good: SP.validatePack({ slots: [good] }) };
    });
    expect(r.bad.ok, 'a colliding slot FAILS validation (an error, not a warning)').toBe(false);
    expect(r.bad.errors.join(' '), 'the error names the slot and the overwritten var').toMatch(/cam22.*#20/s);
    expect(r.good.ok, 'a REAL 2-part composed slot validates cleanly after slice B').toBe(true);
});

test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });
    test('S5(3)B — the real 2-op mill build now SUCCEEDS (no refusal) and lands one composed slot', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsGetBlockProgram);
        await page.evaluate(async () => {
            const { getUserDef, defaultParams } = await import('/blocks/userOps.js');
            const dp = (t) => defaultParams(getUserDef(t));
            window.ddcsGetBlockProgram = () => ([
                { id: 's1', type: 'op', opType: 'user_surfacing_data', label: 'Surface', params: dp('user_surfacing_data') },
                { id: 'p1', type: 'op', opType: 'user_pocket_data', label: 'Pocket', params: dp('user_pocket_data') },
            ]);
            (await import('/ui/macrosApp.js')).initMacrosApp();
            window.ddcsOpenCamAuthoring();
        });
        await page.waitForSelector('.cam-auth-overlay .cbm-eb');
        await page.click('[data-act="cbm-build"]');
        // slice B: no refusal — we go straight to the destination prompt
        await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
        await page.screenshot({ path: `${SCRATCH}/cam-s5b-2op-built.png` });   // VIEWED (ACCEPT, gated to the advisor)
        const r = await page.evaluate(() => {
            const pack = JSON.parse(localStorage.getItem('ddcs_campack') || '{"slots":[]}');
            const s = pack.slots.slice(-1)[0] || {};
            const spindles = (s.body || '').match(/M3 S\[(#\d+)\]/g) || [];
            const assignsOf = (v) => ((s.body || '').match(new RegExp(`^\\s*\\${v}\\s*=`, 'gm')) || []).length;
            const vars = (s.fields || []).map((f) => f.var);
            return {
                slots: pack.slots.length, ops: (s.ops || []).length,
                collisions: (s.varCollisions || []).length,
                spindleAssigns: spindles.map((m) => assignsOf(m.match(/#\d+/)[0])),
                inMillBand: vars.filter((v) => { const n = +String(v).replace('#', ''); return n >= 20 && n <= 33; }),
            };
        });
        expect(r.slots, 'the slot WAS built (no refusal)').toBe(1);
        expect(r.ops, 'it composes both ops').toBe(2);
        expect(r.collisions, 'the backstop recorded NO collision').toBe(0);
        expect(r.inMillBand, 'no field var sits in the mill scratch band #20-#33').toEqual([]);
        expect(r.spindleAssigns.every((n) => n === 1), 'every spindle var is assigned exactly once (its own readLine)').toBe(true);
    });
});
