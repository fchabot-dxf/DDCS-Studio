import { test, expect } from '@playwright/test';

/**
 * WCS-EMIT REGRESSION REPRO (t439) — drive the REAL in-place wizard → INSERT → read the EDITOR TEXTAREA VALUE (exactly
 * what the DDCS check lints: headerPost.js reads document.getElementById('editor').value) → run validate(). Sweeps the
 * structural arms of both rotary twins × every WCS. Verify-real-symptom: the advisor's static model says #578; the human
 * saw `active`. This pins which text the linter sees and whether ANY combo emits a flagged stray `active`.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function driveInsertAndLint(page, opType, overrides) {
    const res = await page.evaluate(async ({ op, ov }) => {
        // t1944 — window.clearCode() (the user-facing Clear button) now confirms on a non-empty canvas (t1938) and
        // was called here fire-and-forget (never awaited); across this sweep's 13 iterations, the 2nd one onward
        // now leaves an unanswered dialog behind. This test's own intent is "start each combo from an empty
        // canvas," not "exercise the Clear confirmation" — ddcsLoadBlockStack([]) is the SAME programmatic clear
        // every other fixture in this suite already uses for that.
        window.ddcsLoadBlockStack([]);
        await window.openWiz(op);
        await new Promise((r) => setTimeout(r, 250));
        // set overrides on the form
        for (const [k, v] of Object.entries(ov)) {
            const el = document.querySelector(`#wiz_user_form [data-param="${k}"]`);
            if (el) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }
        }
        await new Promise((r) => setTimeout(r, 200));
        await window.ddcsStudio.wizardManager.insert();
        await new Promise((r) => setTimeout(r, 300));

        const editorEl = document.getElementById('editor');
        const editorValue = editorEl ? editorEl.value : '(no editor el)';
        const buildProg = (window.editorManager && window.editorManager.buildProgram) ? window.editorManager.buildProgram().code : '';
        const serialized = (typeof window.ddcsSerializeWithMarkers === 'function') ? window.ddcsSerializeWithMarkers().code || window.ddcsSerializeWithMarkers() : '';

        const V = await import('/shared/js/validate/validate.js');
        const lintEditor = V.validate(editorValue);
        const lintBuild = V.validate(String(buildProg));
        // Any stray-word finding mentioning 'active'?
        const activeFindings = [...lintEditor.findings, ...lintBuild.findings].filter((f) => /active/i.test(f.msg));
        // SWO lines in each surface
        const swo = (t) => String(t).split('\n').filter((l) => /805\+/.test(l));
        return {
            editorSWO: swo(editorValue), buildSWO: swo(buildProg),
            editorHasMarker: /@DDCS/.test(editorValue), buildHasMarker: /@DDCS/.test(String(buildProg)),
            lintEditor: { ok: lintEditor.ok, errors: lintEditor.errors, warnings: lintEditor.warnings, findings: lintEditor.findings.slice(0, 6) },
            activeFindings,
            editorSample: editorValue.split('\n').filter((l) => /active|805\+|@DDCS/.test(l)).slice(0, 8),
        };
    }, { op: opType, ov: overrides });
    return res;
}

test('REPRO: sweep rotary twins → lint the editor textarea (the DDCS-check surface)', async ({ page }) => {
    page.on('console', (m) => { const t = m.text(); if (!/Download the React|LayoutSnapshot/.test(t)) console.log('PAGE:', t); });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.editorManager && window.clearCode);

    const combos = [
        ['user_rotary_center_data', { wcs: 'active' }],
        ['user_rotary_center_data', { wcs: 'G54' }],
        ['user_rotary_center_data', { wcs: 'G59', method: 'fit' }],
        ['user_rotary_clock_data', { wcs: 'active', action: 'set' }],
        ['user_rotary_clock_data', { wcs: 'G54', action: 'rotate' }],
        ['user_rotary_clock_data', { wcs: 'G57', action: 'report' }],
        // the dispatch asked: check corner + edge + middle + alignment too (structural-guard / no-wcs twins)
        ['user_corner_data', { wcs: 'active' }],
        ['user_corner_data', { wcs: 'G55' }],
        ['user_edge_data', { wcs: 'active' }],
        ['user_edge_data', { wcs: 'G58' }],
        ['user_middle_data', { wcs: 'active' }],
        ['user_middle_data', { wcs: 'G56' }],
        ['user_alignment_data', {}],
    ];
    const out = {};
    for (const [op, ov] of combos) {
        const key = `${op}|${JSON.stringify(ov)}`;
        out[key] = await driveInsertAndLint(page, op, ov);
    }
    for (const key of Object.keys(out)) {
        const r = out[key];
        console.log(`\n### ${key}`);
        console.log(`  editor has marker: ${r.editorHasMarker} | build has marker: ${r.buildHasMarker}`);
        console.log(`  editor SWO: ${JSON.stringify(r.editorSWO)}`);
        console.log(`  lint(editor): ok=${r.lintEditor.ok} errors=${r.lintEditor.errors} warnings=${r.lintEditor.warnings}`);
        if (r.lintEditor.findings.length) console.log(`  findings: ${JSON.stringify(r.lintEditor.findings)}`);
        if (r.activeFindings.length) console.log(`  *** ACTIVE FINDINGS: ${JSON.stringify(r.activeFindings)}`);
    }
    // REGRESSION GUARD (assert-the-value): across ALL probe twins × WCS, the DDCS check on the EDITOR TEXTAREA
    // (the exact surface headerPost lints) must be ERROR-FREE and flag NO stray `active`. A future emit path that
    // leaks an unresolved WCS index (`#[805+[active-1]*5+…]`) trips this — the real symptom, not a proxy.
    for (const key of Object.keys(out)) {
        const r = out[key];
        expect(r.activeFindings.length, `${key}: the DDCS check flagged a stray 'active' — ${JSON.stringify(r.activeFindings)}`).toBe(0);
        expect(r.lintEditor.errors, `${key}: the DDCS check reported errors on the editor emit — ${JSON.stringify(r.lintEditor.findings)}`).toBe(0);
        expect(r.editorHasMarker, `${key}: the editor textarea must stay clean (markers are export-only)`).toBe(false);
    }
});

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
