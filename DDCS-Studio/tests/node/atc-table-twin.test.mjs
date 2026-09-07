import { test, expect } from './support/harness.mjs';

/**
 * ATC-TABLE E1 (t568) — the user_atc_table_data TWIN emit. On the E0 superset: deriveGuards injects the section keys;
 * postInstantiate is a DECLARED LIVE-VIEW — it REGENERATES the whole body from the CURRENT settings.atc.tools/magazine via
 * atcTableStack (the ONE source). VERIFY: twin == atcTableStack byte-diff ZERO across toggle × table-size × profile; a
 * tool-length edit in Settings → the NEXT emit tracks (no snapshot). NOT registered/in-place (E2, done alongside).
 *
 * t2691 — TIER MIGRATION WORK PACKAGE C: moved browser→node. Both tests already call registerUserOp explicitly (pattern 1).
 */
test('E1: the twin emit == atcTableStack byte-diff ZERO across toggles × table sizes × EVERY registered dialect (t1900, was Expert + V4.1 only; live table)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { atcTableDataDef } = await import('/blocks/dataOps/atcTableData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { atcTableStack } = await import('/wizards/atcTableWizard.js');
        // t1900 — atcTableWizard.js also reads the dialect at build time (getDialect, :48/:61); widened from the
        // 2-profile sweep to the full registry via the dialect override (reaches grbl/centroid/rs274ngc/grblhal
        // too). t2137 — that live override is retired; __setDialectOverrideForTests is the in-memory, test-only
        // replacement (see dialects/index.js) — unreachable from any real UI.
        const { __setDialectOverrideForTests, listPosts } = await import('/wizards/dialects/index.js');
        registerUserOp(atcTableDataDef());
        const build = builderOf('user_atc_table_data');
        const mkTools = (n) => Array.from({ length: n }, (_, i) => ({ num: i + 1, length: 40 + i * 3, name: 'T' + (i + 1) }));
        const mkMag = (n) => Array.from({ length: n }, (_, i) => ({ pocket: i + 1, x: 100 + i * 10, y: 50, z: -20 - i }));
        const dialects = listPosts().map((p) => p.id);
        let diffs = 0, first = null, combos = 0;
        for (const dialectId of dialects) {
            __setDialectOverrideForTests(dialectId);
            for (const nt of [0, 1, 5]) for (const np of [0, 3, 8]) for (const iL of [true, false]) for (const iP of [true, false]) {
                combos++;
                const tools = mkTools(nt), magazine = mkMag(np);
                window.__tblS = { atc: { tools, magazine } }; window.ddcsGetSettings = () => window.__tblS;
                const twin = emitMapped(build({ includeLengths: iL, includePockets: iP })).text;
                const builtin = emitMapped(atcTableStack({ tools, magazine, includeLengths: iL, includePockets: iP })).text;
                if (twin !== builtin) { diffs++; if (!first) { const tl = twin.split('\n'), bl = builtin.split('\n'); let i = 0; while (i < tl.length && tl[i] === bl[i]) i++; first = { dialectId, nt, np, iL, iP, line: i, twin: tl.slice(i, i + 3), builtin: bl.slice(i, i + 3) }; } }
            }
        }
        __setDialectOverrideForTests(null);
        return { diffs, first, combos, dialectCount: dialects.length };
    });
    if (r.first) console.log('ATC-TABLE E1 DIFF ' + JSON.stringify(r.first));
    expect(r.dialectCount, 'sanity: 7 registered dialects').toBe(7);
    expect(r.combos, 'the sweep = 7 dialects × 3 tool sizes × 3 pocket sizes × 2×2 toggles').toBe(252);
    expect(r.diffs, 'twin emit == atcTableStack for ALL combos on EVERY dialect (byte-diff = ZERO)').toBe(0);
});

test('E1: the twin is a LIVE VIEW — edit a tool length in Settings → the NEXT emit tracks (no snapshot)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { atcTableDataDef } = await import('/blocks/dataOps/atcTableData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        registerUserOp(atcTableDataDef());
        const build = builderOf('user_atc_table_data');
        const params = { includeLengths: true, includePockets: false };
        // #1430 = T1's length assign (Expert toolTable base 1430). start: length 50
        window.__tblS = { atc: { tools: [{ num: 1, length: 50, name: 'endmill' }], magazine: [] } }; window.ddcsGetSettings = () => window.__tblS;
        const a = emitMapped(build(params)).text;
        // EDIT T1's length 50 → 73 in Settings → the NEXT emit tracks (live, not frozen at 50)
        window.__tblS = { atc: { tools: [{ num: 1, length: 73, name: 'endmill' }], magazine: [] } };
        const b = emitMapped(build(params)).text;
        const len = (t) => (t.match(/#1430=(-?[\d.]+)/) || [])[1];
        return { lenA: len(a), lenB: len(b) };
    });
    expect(r.lenA, 'start: T1 length #1430 = 50').toBe('50');
    expect(r.lenB, 'edited T1 length in Settings → the NEXT emit tracks (73)').toBe('73');
});
