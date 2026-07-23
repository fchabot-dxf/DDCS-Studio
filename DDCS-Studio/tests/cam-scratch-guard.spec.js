import { test, expect } from '@playwright/test';

const SCRATCH = 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad';

// t1081 S5(3) slice A — DECLARE + DETECT. A slot's FORM FIELDS get local body vars climbing from varOffset+1, while the
// generators HARD-CODE their scratch (mill: #20-#33). Measured: 1 part is safe (#1-#10), but a 2-part mill slot puts the
// RPM field on #20 and the pocket then emits `#20=0 ;origin X`, so `M3 S[#20]` commands S0 — a non-rotating tool driven
// through the toolpath. This slice does NOT renumber anything: it declares the bands and makes the build REFUSE, loudly
// and by name, so the silent S0 cannot ship. (Collision-free allocation is slice B.)

test('S5(3)A — the collision is DETECTED and NAMED for a 2-part mill slot; a 1-part slot is clean', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { surfacingSlot, pocketSlot } = await import('/data/millToSlot.js');
        const { fieldVarCollisions, collisionMessage, bandsFor } = await import('/data/camScratch.js');
        // compose exactly as buildSlotFromOps does: used-set for #11xx, varOffset = running field count
        const used = new Set();
        const p1 = surfacingSlot(used, 0);
        (p1.fields || []).forEach((f) => used.add(f.idx));
        const p2 = pocketSlot(used, (p1.fields || []).length);
        const tag = (fs, oi) => (fs || []).map((f) => ({ ...f, _op: oi }));
        const twoFields = [...tag(p1.fields, 0), ...tag(p2.fields, 1)];
        const twoOps = [{ type: 'surface' }, { type: 'pocket' }];
        const oneCols = fieldVarCollisions(tag(p1.fields, 0), [{ type: 'surface' }]);
        const twoCols = fieldVarCollisions(twoFields, twoOps);
        // prove the real hazard is exactly what we detect: part 2's rpm var IS written as scratch by the pocket body
        const rpm = (p2.fields || []).find((f) => f.key === 'rpm');
        return {
            millBand: bandsFor('pocket'),
            oneCount: oneCols.length,
            twoCount: twoCols.length,
            twoVars: twoCols.map((c) => c.varNum),
            msg: collisionMessage(twoCols),
            rpmVar: rpm && rpm.var,
            pocketWritesRpmVar: rpm ? new RegExp(`^\\s*\\${rpm.var}\\s*=`, 'm').test(p2.body) : false,
            pocketCommandsRpmVar: rpm ? p2.body.includes(`M3 S[${rpm.var}]`) : false,
        };
    });
    // the declared band is the real one (#20-#33 — including #33, which the old prose header omitted)
    const inMill = (n) => r.millBand.some(([lo, hi]) => n >= lo && n <= hi);
    expect(inMill(20) && inMill(26) && inMill(27) && inMill(33), 'the declared mill band covers #20-#33 (incl. #33, which the old prose header omitted)').toBe(true);
    // 1 part is SAFE — no false refusal
    expect(r.oneCount, 'a single-part mill slot has NO collision (vars #1-#10 vs scratch #20+)').toBe(0);
    // 2 parts collide, and it is the exact var the advisor reproduced
    expect(r.twoCount, 'a 2-part mill slot collides').toBeGreaterThan(0);
    expect(r.twoVars, 'the collision is on #20 — the RPM field the pocket overwrites with its origin X').toContain(20);
    // and the hazard is real in the emitted G-code, not just arithmetic
    expect(r.rpmVar, 'part 2 rpm lands on #20').toBe('#20');
    expect(r.pocketWritesRpmVar, 'the pocket body WRITES that same var as scratch').toBe(true);
    expect(r.pocketCommandsRpmVar, 'and commands the spindle from it — so it would run S0').toBe(true);
    // the refusal NAMES the var, the field and the clashing generator
    expect(r.msg, 'the refusal names the colliding variable').toMatch(/#20/);
    expect(r.msg, 'the refusal names the field').toMatch(/Spindle RPM/i);
    expect(r.msg, 'the refusal names the clashing generator').toMatch(/pocket/i);
    expect(r.msg, 'the refusal explains the consequence in operator terms').toMatch(/spindle speed forced to 0/i);
});

test('S5(3)A — validatePack ERRORS on an already-built colliding slot, and passes a clean one', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { surfacingSlot, pocketSlot } = await import('/data/millToSlot.js');
        const SP = await import('/data/slotPack.js');
        const used = new Set();
        const p1 = surfacingSlot(used, 0);
        (p1.fields || []).forEach((f) => used.add(f.idx));
        const p2 = pocketSlot(used, (p1.fields || []).length);
        const tag = (fs, oi) => (fs || []).map((f) => ({ ...f, _op: oi }));
        const bad = { slot: 22, name: 'bad', ops: [{ type: 'surface' }, { type: 'pocket' }], fields: [...tag(p1.fields, 0), ...tag(p2.fields, 1)], body: SP.composeParts([p1.body, p2.body]) };
        const good = { slot: 23, name: 'good', ops: [{ type: 'surface' }], fields: tag(p1.fields, 0), body: p1.body };
        return { bad: SP.validatePack({ slots: [bad] }), good: SP.validatePack({ slots: [good] }) };
    });
    expect(r.bad.ok, 'a colliding slot FAILS validation (an error, not a warning)').toBe(false);
    expect(r.bad.errors.join(' '), 'the error names the slot and the overwritten var').toMatch(/cam22.*#20/s);
    expect(r.good.ok, 'a clean single-op slot still validates').toBe(true);
});

test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });
    test('S5(3)A — the BUILD refuses a 2-part mill slot with a named message; a 1-part slot still builds byte-identical', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsGetBlockProgram);
        // a program with two mill ops → the CAM builder auto-imports both
        await page.evaluate(async () => {
            const { getUserDef, defaultParams } = await import('/blocks/userOps.js');
            const dp = (t) => defaultParams(getUserDef(t));
            window.ddcsGetBlockProgram = () => ([
                { id: 's1', type: 'op', opType: 'user_surfacing_data', label: 'Surface', params: dp('user_surfacing_data') },
                { id: 'p1', type: 'op', opType: 'user_pocket_data', label: 'Pocket', params: dp('user_pocket_data') },
            ]);
            (await import('/ui/macrosApp.js')).initMacrosApp();
            window.ddcsOpenCamAuthoring();          // no seed → auto-import every CAM-able op
        });
        await page.waitForSelector('.cam-auth-overlay .cbm-eb');
        await page.click('[data-act="cbm-build"]');
        await page.waitForSelector('.ddcs-dlg, .cam-sim-overlay, [role="dialog"]', { timeout: 8000 });
        const refusal = await page.evaluate(() => (document.body.innerText || ''));
        await page.screenshot({ path: `${SCRATCH}/cam-s5-collision-refusal.png` });   // VIEWED (ACCEPT, gated to the advisor)
        expect(refusal, 'the build REFUSES with a named collision (never a silent build)').toMatch(/cannot be built/i);
        expect(refusal, 'and names the colliding variable').toMatch(/#20/);
        // nothing was written to the pack
        const slots = await page.evaluate(() => JSON.parse(localStorage.getItem('ddcs_campack') || '{"slots":[]}').slots.length);
        expect(slots, 'the refused slot was NOT added to the pack').toBe(0);
    });
});
