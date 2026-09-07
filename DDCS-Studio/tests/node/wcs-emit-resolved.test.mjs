import { test, expect } from './support/harness.mjs';

/**
 * t2694 — TIER MIGRATION WORK PACKAGE 4: split from wcs-emit-resolved.spec.js. This file keeps the SECOND test only
 * ("atom fix"), which is pure page.goto + page.evaluate importing blockEmitter.js/setworkoffset.js and asserting on
 * plain returned strings/data — no DOM read, no click, no editor drive. The FIRST test ("REPRO: sweep rotary twins")
 * drives the real in-place wizard (window.openWiz, document.querySelector form fields, dispatchEvent('change'),
 * window.ddcsStudio.wizardManager.insert(), document.getElementById('editor').value) — a genuine app+DOM dependency,
 * not a candidate for this tier. It stays in tests/wcs-emit-resolved-drive.spec.js.
 */

/**
 * THE FRAGILITY, NOW COVERED (t441 — the valid-by-construction atom fix). A `setworkoffset` BLOCK carrying a RAW
 * `wcs:'active'` / `'Gnn'` (a Blocks edit, an older loaded program — never produced by a current builder, but reachable)
 * used to leak the unrecognized word straight into the emit. The atom now self-resolves it IDEMPOTENTLY: `active`→`#578`,
 * `Gnn`→index; an already-resolved value passes THROUGH UNCHANGED (so every existing emit is byte-identical). Confirms
 * the Expert `#[805+[…]*5+ax]` form AND that the other dialects (grbl/rs274 P-arg, v41/dm500 G92) are NOT corrupted.
 */
test('atom fix: a raw wcs=active / Gnn setworkoffset block RESOLVES across every dialect; already-resolved passes through byte-identical', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { resolveWcsIndex } = await import('/wizards/ops/setworkoffset.js');
        const DIALECTS = ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500', 'grbl', 'rs274ngc'];
        const swo = (wcs) => [{ type: 'setworkoffset', params: { wcs, axis: 'Y', value: '#54' } }];
        const emitAll = (wcs) => Object.fromEntries(DIALECTS.map((d) => [d, emitMapped(swo(wcs), { profileId: d }).text.trim()]));

        // (1) idempotency — the helper's contract
        const helper = { active: resolveWcsIndex('active'), G54: resolveWcsIndex('G54'), G59: resolveWcsIndex('G59'), h578: resolveWcsIndex('#578'), i1: resolveWcsIndex('1'), expr: resolveWcsIndex('[#71+1]') };

        // (2) a RAW-active block vs the already-resolved #578 block must emit IDENTICALLY (the wizard bakes #578 → this proves byte-identity)
        const rawActive = emitAll('active'), baked578 = emitAll('#578');
        const rawG55 = emitAll('G55'), baked2 = emitAll('2');

        // (3) NO dialect may emit the literal word `active` for a raw-active block
        const anyActive = Object.values(rawActive).some((t) => /\bactive\b/.test(t));
        return { helper, rawActive, baked578, rawG55, baked2, anyActive };
    });
    console.log('ATOM FIX:\n' + JSON.stringify(r, null, 2));
    // helper idempotency
    expect(r.helper.active).toBe('#578');
    expect(r.helper.G54).toBe('1');
    expect(r.helper.G59).toBe('6');
    expect(r.helper.h578, '#578 passes through unchanged').toBe('#578');
    expect(r.helper.i1, 'a plain index passes through unchanged').toBe('1');
    expect(r.helper.expr, 'an expression passes through unchanged').toBe('[#71+1]');
    // raw-active resolves to EXACTLY what the wizard's baked #578 emits — every dialect byte-identical
    for (const d of Object.keys(r.rawActive)) {
        expect(r.rawActive[d], `dialect ${d}: raw wcs=active must emit identically to the baked #578`).toBe(r.baked578[d]);
        expect(r.rawG55[d], `dialect ${d}: raw wcs=G55 must emit identically to the baked index 2`).toBe(r.baked2[d]);
    }
    // Expert form is the resolved index (axis Y → offset +1)
    expect(r.rawActive['ddcs-expert-m350']).toContain('#[805+[#578-1]*5+1]=#54');
    expect(r.rawG55['ddcs-expert-m350']).toContain('#[805+[2-1]*5+1]=#54');
    // grbl P-arg carries the resolved value (byte-identical to today's baked emit)
    expect(r.rawG55['grbl']).toContain('P2');
    // no stray `active` anywhere
    expect(r.anyActive, 'no dialect emits the literal word active for a raw-active block').toBe(false);
});
