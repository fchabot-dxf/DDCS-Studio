import { test, expect } from '@playwright/test';

/**
 * MILL/ATC IN-PLACE BATCH (t407) — Slot + Surfacing + Text + ATC Warm-up finished to IN-PLACE via the drill opensAs
 * one-liner (one declaration per built-in entry: re-point the click to the twin + hide the twin's Data-Wiz entry +
 * seamless plain title). All SINGLE-SHAPE (no Bore-style variant gap). VERIFY EACH per-wizard: opensAs wired + plain
 * title + twin retired · emit BYTE-IDENTICAL to the built-in stack · the in-place form NON-EMPTY · the SIM renders
 * (toolpath for slot/surfacing/text; machine+magazine for atcWarmup which declares forceMachine+showMagazine).
 */
const CFG = [
    { op: 'user_slot_data',       id: 'slot',       label: 'Slot',            mod: '/blocks/dataOps/slotData.js',       defKey: 'SLOT_DEFAULTS',       stackMod: '/wizards/slotWizard.js',       stackKey: 'slotStack' },
    { op: 'user_surfacing_data',  id: 'surfacing',  label: 'Surfacing',       mod: '/blocks/dataOps/surfacingData.js',  defKey: 'SURFACING_DEFAULTS',  stackMod: '/wizards/surfacingWizard.js',  stackKey: 'surfacingStack' },
    { op: 'user_text_data',       id: 'text',       label: 'Text / engrave',  mod: '/blocks/dataOps/textData.js',       defKey: 'TEXT_DEFAULTS',       stackMod: '/wizards/textWizard.js',       stackKey: 'textStack' },
    { op: 'user_atc_warmup_data', id: 'atc_warmup', label: 'Warm-up',         mod: '/blocks/dataOps/atcWarmupData.js',  defKey: 'ATC_WARMUP_DEFAULTS', stackMod: '/wizards/atcWarmupWizard.js',  stackKey: 'atcWarmupStack' },
];

test('opensAs wiring + emit BYTE-IDENTICAL: all 4 built-ins open their twin IN-PLACE (plain title, twin retired); the twin emit == the built-in stack', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async (cfg) => {
        const WL = await import('/blocks/wizardLibrary.js');
        const U = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const entries = WL.listEntries();
        const out = [];
        for (const c of cfg) {
            const M = await import(c.mod), SM = await import(c.stackMod);
            const defaults = M[c.defKey];
            const builtin = builderOf(c.op) ? emitMapped(builderOf(c.op)(defaults)).text : null;
            // t945 — the cutting twin inherits the machine Head at build (spindleHeadPatch); seed the same live Head into the
            // reference shim stack so its header spins up identically (inert for a non-cutting stack that skips makeStart).
            const shim = emitMapped(SM[c.stackKey]({ ...defaults, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} })).text;
            const entry = entries.find((e) => e.id === c.id);
            const twinEntry = entries.find((e) => e.type === c.op);   // the SEPARATE Data-Wiz entry (should be gone)
            out.push({
                id: c.id,
                opensAs: entry && entry.opensAs,
                title: WL.builtinLabelForTwin(c.op),
                twinRetired: !twinEntry,
                registered: !!builderOf(c.op),
                byteIdentical: builtin != null && builtin === shim,
            });
        }
        return out;
    }, CFG);
    for (const c of CFG) {
        const got = r.find((x) => x.id === c.id);
        expect(got.registered, `${c.id}: the twin ${c.op} is seeded/registered`).toBe(true);
        expect(got.opensAs, `${c.id}: the built-in entry opensAs the twin`).toBe(c.op);
        expect(got.title, `${c.id}: the seamless in-place title is the built-in plain label`).toBe(c.label);
        expect(got.twinRetired, `${c.id}: the twin's own Data-Wiz entry is retired (one-source hide)`).toBe(true);
        expect(got.byteIdentical, `${c.id}: the twin emit is BYTE-IDENTICAL to the built-in stack (the golden)`).toBe(true);
    }
});

test.use({ viewport: { width: 1400, height: 1000 } });
for (const c of CFG) {
    test(`DRIVE: ${c.id} opens IN-PLACE with a NON-EMPTY form + the sim renders`, async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
        await page.evaluate((op) => window.openWiz(op), c.op);
        await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
        await page.waitForTimeout(500);
        const r = await page.evaluate(() => {
            const f = document.getElementById('wiz_user_form');
            const params = Array.from(f.querySelectorAll('[data-param]')).map((e) => e.getAttribute('data-param'));
            const viz = document.querySelector('#wiz_user canvas, #wiz_user svg');   // 3D WebGL canvas OR 2D SVG
            return { fieldCount: params.length, params, hasViz: !!viz };
        });
        { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: `scratchpad/inplace_${c.id}.png`, clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
        expect(r.fieldCount, `${c.id}: the in-place form is NON-EMPTY (the emit-only twin renders its knobs)`).toBeGreaterThan(0);
        expect(r.hasViz, `${c.id}: the sim/preview pane renders`).toBe(true);
        console.log(`IN-PLACE ${c.id}: ${r.fieldCount} fields → ${r.params.join(', ')}`);
    });
}
