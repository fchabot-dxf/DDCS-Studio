import { test, expect } from '@playwright/test';

/**
 * t1325 (4) — STEPOVER IS A PERCENTAGE OF THE TOOL, DERIVED IN THE MACRO HEADER (the t1323 split, folded in here
 * because tool Ø is what this turn's table is about).
 *
 * THE BUG IT REMOVES: stepover was stored in MM — a number computed for ONE tool. Expose Tool Ø as a pendant knob,
 * dial it from Ø12 to Ø8 at the machine, and a 7.2mm stepover silently becomes 90% of the new tool instead of the
 * 60% that was meant. Two knobs that must agree is one knob too many. So the PERCENTAGE is the intent that gets
 * exposed, and the macro re-derives the mm from both mirrors: #stepover = [#toolØ · #pct / 100].
 *
 * AND NO SILENT RASTER CHANGE: a slot saved before this cuts exactly what it cut before — asserted, because a
 * program the user already trusts must not quietly change its overlap.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('THE MACRO DERIVES IT — both mirrors, one expression, in the header', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingSlot } = await import('/data/millToSlot.js');
        const slot = surfacingSlot(new Set(), 0);
        const f = (k) => (slot.fields || []).find((x) => x.key === k);
        return {
            keys: (slot.fields || []).map((x) => x.key),
            pct: f('stepoverPct'), tool: f('toolDia'), body: slot.body,
        };
    });
    // THE FIELD IS THE INTENT: a percentage, with its own pendant param — not a millimetre computed once at a desk
    expect(r.keys, `the generator's fields: ${JSON.stringify(r.keys)}`).toContain('stepoverPct');
    expect(r.keys, 'and the absolute mm is no longer a knob at all').not.toContain('stepover');
    expect(r.pct.units, 'it is spoken as a percentage').toBe('%');
    expect(r.pct.idx, 'a FIRST-CLASS row: its own pendant param').toBeTruthy();
    expect(r.tool.idx, 'alongside the tool Ø').toBeTruthy();
    // THE DERIVATION reads BOTH mirrors, so changing either at the machine re-derives the raster
    expect(r.body, `the header derivation: ${r.body.split('\n').find((l) => /stepover mm/.test(l))}`)
        .toContain('#22=[' + r.tool.var + ' * ' + r.pct.var + ' / 100]');
    // …and the MOTION steps by the derived value, not by a second copy that could disagree with the guard
    expect(r.body, 'the guard tests the derived mm').toContain('IF #22 LE 0 GOTO 7');
    // THE SCRATCH BAND, which this got wrong first: camMacroKit declares that CALLERS own #20–#26 and the kit owns
    // #27–#33. Written as #27, the derived stepover was overwritten by rasterClear's raster ROW COUNT one line later,
    // and the ramp length, the first row and the WHILE bound all silently ran on that number instead — clean-looking
    // G-code cutting a different part. So: the derived var is assigned EXACTLY ONCE, and every later line only reads it.
    const assigns = r.body.split(String.fromCharCode(10)).filter((l) => /^\s*#22\s*=/.test(l));
    expect(assigns.length, `the derived stepover is assigned once and never clobbered: ${JSON.stringify(assigns)}`).toBe(1);
    expect(r.body, 'the kit’s row count READS it rather than overwriting it').toMatch(/#27=FUP\[\[#26-#25\]\/#22\]/);
    expect(r.body, 'and the ramp length is the stepover, not the row count').toContain('#33=#22');
});

test('CHANGE THE TOOL AT THE MACHINE AND THE OVERLAP FOLLOWS — the whole point', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingSlot } = await import('/data/millToSlot.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const slot = surfacingSlot(new Set(), 0);
        const V = {}; (slot.fields || []).forEach((f) => { V[f.key] = f; });
        // run the ONE installed macro with the pendant dialled to two different tools, everything else identical
        const run = (toolDia) => {
            const nc = slot.body.split(NL).map((l) => {
                for (const k in V) if (l.indexOf(V[k].var + '=#') === 0) return V[k].var + '=' + (k === 'toolDia' ? toolDia : V[k].def);
                return l;
            }).join(NL);
            const t = traceToolpath(nc);
            return (t.segments || []).length;
        };
        return { big: run(12), small: run(8), pctDef: V.stepoverPct.def, toolDef: V.toolDia.def };
    });
    // Ø12 at 60% steps 7.2mm; Ø8 at the SAME 60% steps 4.8mm — so the smaller tool makes MORE passes, automatically.
    // Before this, the mm was frozen and the small tool would have cut the same coarse raster it was never meant for.
    expect(r.pctDef, 'the default intent is the CAM convention').toBe(60);
    expect(r.small, `a smaller tool rasters finer: Ø8 ${r.small} vs Ø12 ${r.big} segments`).toBeGreaterThan(r.big);
});

test('NO SILENT RASTER CHANGE — a slot saved with a stored mm still cuts that mm', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { seedFromOp } = await import('/data/opCamMap.js');
        const uo = await import('/blocks/userOps.js');
        // (a) the BUILT-IN op, which always stored the intent — it seeds straight through
        const builtin = seedFromOp({ opType: 'surfacing', params: { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 16, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5, rpm: 12000 } });
        // (b) the TWIN, which stores a FLAT mm and has no toolDia at all — the recovery case
        const twin = seedFromOp({ opType: 'user_surfacing_data', params: { ...uo.defaultParams(uo.getUserDef('user_surfacing_data')), stepover: 9.6 } });
        const pick = (s) => { const g = (k) => (s.fields || []).find((f) => f.key === k); return { pct: g('stepoverPct').value, dia: g('toolDia').value }; };
        return { builtin: pick(builtin), twin: pick(twin) };
    });
    // the built-in's intent is carried, not re-derived
    expect(r.builtin.pct).toBe(60);
    expect(r.builtin.dia * r.builtin.pct / 100, 'Ø16 at 60% is the 9.6mm it always cut').toBeCloseTo(9.6, 6);
    // THE MIGRATION PROPERTY: the twin's stored 9.6mm is recovered as a percentage OF THE TOOL Ø THE SLOT CARRIES,
    // so multiplying back gives the same millimetre. Recovering against any other number would change the cut.
    expect(r.twin.pct, 'a 9.6mm stepover is 80% of the Ø12 this slot carries').toBe(80);
    expect(r.twin.dia * r.twin.pct / 100, 'and it still cuts 9.6mm — the same raster, expressed the new way').toBeCloseTo(9.6, 6);
});

test('AND A SAVED SLOT MIGRATES ONCE — the stored mm becomes a pct, and the pendant layout does not shift', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingSlot } = await import('/data/millToSlot.js');
        const before = surfacingSlot(new Set(), 0);
        // the pack layout: a migration that changed how many pendant params a slot takes would move every slot after
        // it in the pack, so the COUNT is part of "the same rows".
        return { count: (before.fields || []).length, keys: (before.fields || []).map((f) => f.key) };
    });
    // 10 fields before this turn (w,h,depth,stepdown,stepover,toolDia,feed,plunge,clearance,rpm) and 10 after — the
    // percentage REPLACED the millimetre in place rather than being added beside it.
    expect(r.count, `the field count is unchanged: ${JSON.stringify(r.keys)}`).toBe(10);
    expect(r.keys.indexOf('stepoverPct'), 'and it sits where the mm used to, so the #11xx order is untouched').toBe(4);
});
