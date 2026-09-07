import { test, expect } from '@playwright/test';

/**
 * WCS-EMIT REGRESSION REPRO (t439) — drive the REAL in-place wizard → INSERT → read the EDITOR TEXTAREA VALUE (exactly
 * what the DDCS check lints: headerPost.js reads document.getElementById('editor').value) → run validate(). Sweeps the
 * structural arms of both rotary twins × every WCS. Verify-real-symptom: the advisor's static model says #578; the human
 * saw `active`. This pins which text the linter sees and whether ANY combo emits a flagged stray `active`.
 *
 * t2694 — TIER MIGRATION WORK PACKAGE 4: split from wcs-emit-resolved.spec.js. This test drives window.openWiz, real
 * form DOM (document.querySelector + dispatchEvent), window.ddcsStudio.wizardManager.insert(), and reads the real
 * editor textarea — a genuine app+DOM dependency, not a candidate for the node tier. Its sibling ("atom fix" — pure
 * import()+evaluate, no DOM) moved to tests/node/wcs-emit-resolved.test.mjs.
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
