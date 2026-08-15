import { test, expect } from '@playwright/test';

/**
 * t1884→t1890 — TOOLTABLE FIELD GATING, the toolTable half of the dispatched "ATC and toolTable capability gates"
 * act. `postGating.js`'s own `data-cap="toolTable"` (wiz_atc_length/check/warmup/table) was ORPHANED — all 4
 * targets permanently `display:none` since the wizards-as-data migration (t1884's census, re-confirmed t1890 by
 * direct grep). Same class as probePort (t1880): a real capability gate with a dead DOM target.
 *
 * THE SEMANTIC, established from primary source before wiring anything (t1890's own explicit instruction, echoing
 * t1880's "no gate is better than a wrong gate" — this time applied to BOTH `atc` and `toolTable`, which turned
 * out to have DIFFERENT evidence quality):
 *   - `caps.toolTable` is TRUE for every DDCS variant (Expert/V4.1/DM500 — each declares its own CONFIRMED base
 *     register: #1430/#1560/#1430) plus rs274ngc (#5401) and centroid; FALSE only for `grbl.js`, whose own caps
 *     declare `vars: false, flow: 'none'` — a categorically variable-less firmware. This is a genuine, confirmed,
 *     structural absence (grbl has no #-variable engine to hold a table AT ALL), unlike `atc` (left untouched
 *     this turn — see WORK-LOG t1890 for the full evidence trail: `caps.atc: false` on V4.1/DM500 turned out to
 *     encode an EVIDENCE GAP, not a confirmed absence, per the project's own `portingArc.js`
 *     `V41_NAMED_ABSENCES.atcTables` and its own t1535 ruling — reported, not wired).
 *   - Of the 4 toolTable-`data-cap` legacy targets, only 3 ops actually WRITE/READ the tool-length table:
 *     atcLengthData (writes it — `atcLengthWizard.js`'s own `TO('#103','#102')`), atcCheckData (reads it back for
 *     comparison), and atcTableData's own `includeLengths` toggle (writes `#[table base + T-1]` directly).
 *     atcWarmupData (a spindle M3/dwell/M3/dwell/M5 sequence) has ZERO toolTable dependency — no #variable, no
 *     tooloffset block anywhere in `atcWarmupWizard.js` — so its own `data-cap="toolTable"` was mis-scoped from
 *     the start, not merely orphaned; it is REMOVED with no replacement gate (nothing to gate).
 *   - atcTableData's own SIBLING toggle, `includePockets`, writes #1330/#1350/#1370 (the ATC pocket/model
 *     registers) — governed by the SEPARATE `atc` cap, not `toolTable`. Left UNGATED this turn (its own help
 *     text already names the "mapped ATC model" caveat) — gating it now would have silently taken the very
 *     design position (grey a V4.1/DM500 field because `caps.atc` says so) this turn's own report defers to
 *     the advisor.
 *
 * THE FIX: `atcLengthData.js`/`atcCheckData.js`'s own scalar bindings and `atcTableData.js`'s own `includeLengths`
 * binding now carry `gate: { param: '_toolTableOk', is: false, tip: '...' }` — the SAME pattern `_probePortOk`
 * (t1880) and `_rigidOk` (`tapData.js`) already use. `_toolTableOk` is computed in `userOpView.js` (mirroring
 * `activePostProbePort`) from `caps.toolTable`, fresh on every twin-form render. `postGating.js`'s own dead
 * `CAP_WHY.toolTable` entry is deleted; `CAP_FIELDS`/`data-cap="atc"` (still orphaned, but NOT this turn's call to
 * resolve) are left untouched.
 *
 * grbl is reached via the ACTIVE-POST override (`setActivePostId`, `wizards/dialects/index.js`) — a live,
 * user-reachable codegen target independent of the 4 selectable machine profiles (io-step-edge-dialect.spec.js's
 * own precedent) — not via `setActiveProfile` (grbl is not one of the 4 profiles in `controllerProfiles.js`).
 */

const EXPERT = 'ddcs-expert-m350';

async function fieldUnder(page, { profileId, postId, opType, param }) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef);
    return page.evaluate(async ({ profileId, postId, opType, param }) => {
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        setActiveProfile(profileId);
        const { setActivePostId } = await import('/wizards/dialects/index.js');
        setActivePostId(postId || 'auto');
        window.ddcsEditWizardDef(opType);
        await new Promise((resolve, reject) => {
            const t0 = Date.now();
            const poll = () => {
                const inp = document.querySelector(`[data-param="${param}"]`);
                if (inp && inp.dataset.opGated !== undefined) return resolve();
                if (Date.now() - t0 > 5000) return reject(new Error(`${param} field never settled a gate state`));
                setTimeout(poll, 30);
            };
            poll();
        });
        const inp = document.querySelector(`[data-param="${param}"]`);
        return { found: !!inp, disabled: inp.disabled, title: inp.title, opGated: inp.dataset.opGated };
    }, { profileId, postId, opType, param });
}

test('PRIMARY EVIDENCE, both directions: atcLength\'s Max Plunge field is LIVE on Expert, GREYED with its tooltip reason on grbl', async ({ page }) => {
    test.setTimeout(30_000);
    const expert = await fieldUnder(page, { profileId: EXPERT, opType: 'user_atc_length_data', param: 'maxDist' });
    expect(expert.found, 'sanity: the field exists on Expert').toBe(true);
    expect(expert.disabled, 'Expert: live (has a real, mapped tool-length table)').toBe(false);
    expect(expert.title, 'Expert: no gate tooltip when live').toBe('');

    const grbl = await fieldUnder(page, { profileId: EXPERT, postId: 'grbl', opType: 'user_atc_length_data', param: 'maxDist' });
    expect(grbl.found, 'sanity: the field still exists on grbl (greyed, not hidden)').toBe(true);
    expect(grbl.disabled, 'grbl: GREYED — no #-variable engine to hold a tool-length table at all').toBe(true);
    expect(grbl.title, 'grbl: the tooltip explains why, not just that').toContain('tool-length table');
});

test('V4.1 and DM500 both stay LIVE — the identical-caps economy (ddcs-v41.js:17 / ddcs-v3-dm500.js:21, both caps.toolTable:true)', async ({ page }) => {
    test.setTimeout(30_000);
    const v41 = await fieldUnder(page, { profileId: 'ddcs-v41', opType: 'user_atc_length_data', param: 'maxDist' });
    expect(v41.disabled, 'V4.1 has a confirmed, mapped tool-length table (#1560/#1561) — must stay live').toBe(false);
    // DM500 is not re-tested live: its own caps.toolTable declaration is BYTE-IDENTICAL to V4.1's (both `true` in
    // the same caps object shape) — a divergence would be a regression in one of those two files, not something
    // a DM500-specific copy of this test could ever catch differently.
});

test('every toolTable-dependent field/op gates under grbl — atcCheck\'s scalars and atcTable\'s includeLengths, not just atcLength', async ({ page }) => {
    test.setTimeout(60_000);
    const targets = [
        { opType: 'user_atc_length_data', param: 'maxDist' },
        { opType: 'user_atc_length_data', param: 'port' },
        { opType: 'user_atc_check_data', param: 'tolerance' },
        { opType: 'user_atc_table_data', param: 'includeLengths' },
    ];
    const results = [];
    for (const t of targets) results.push({ ...t, ...(await fieldUnder(page, { profileId: EXPERT, postId: 'grbl', ...t })) });

    const notFound = results.filter((r) => !r.found);
    const notGreyed = results.filter((r) => r.found && !r.disabled);
    expect(notFound, `every target field must exist (greyed, not hidden) — missing: ${JSON.stringify(notFound)}`).toEqual([]);
    expect(notGreyed, `every target field must be greyed under grbl — still live: ${JSON.stringify(notGreyed)}`).toEqual([]);
});

test('the vacuity trap: atcTable\'s includePockets (the atc-governed sibling) stays LIVE under grbl — this gate is NOT a whole-form grey', async ({ page }) => {
    // includePockets carries NO gate at all (left ungated this turn — see the file header), so it never gets a
    // `data-op-gated` attribute; polling on IT directly would never settle. Poll on its own sibling,
    // includeLengths (which IS gated), settling in the SAME render pass, then read includePockets directly —
    // the same two-field pattern probe-port-gate-1880.spec.js's own "radius" vacuity check uses.
    test.setTimeout(30_000);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef);
    const r = await page.evaluate(async () => {
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        setActiveProfile('ddcs-expert-m350');
        const { setActivePostId } = await import('/wizards/dialects/index.js');
        setActivePostId('grbl');
        window.ddcsEditWizardDef('user_atc_table_data');
        await new Promise((resolve, reject) => {
            const t0 = Date.now();
            const poll = () => {
                const inp = document.querySelector('[data-param="includeLengths"]');
                if (inp && inp.dataset.opGated !== undefined) return resolve();
                if (Date.now() - t0 > 5000) return reject(new Error('includeLengths (the sibling settle signal) never settled a gate state'));
                setTimeout(poll, 30);
            };
            poll();
        });
        const pockets = document.querySelector('[data-param="includePockets"]');
        return { found: !!pockets, disabled: pockets ? pockets.disabled : null, opGated: pockets ? pockets.dataset.opGated : null };
    });
    expect(r.found, 'sanity: includePockets exists').toBe(true);
    expect(r.opGated, 'sanity: includePockets carries no gate attribute at all — confirms it is untouched, not merely enabled').toBe(undefined);
    expect(r.disabled, 'includePockets is governed by the SEPARATE atc cap (left ungated this turn) — must stay untouched by _toolTableOk').toBe(false);
});

test('atcWarmup has ZERO toolTable dependency — its fields stay live under grbl too (mis-scoped legacy data-cap removed, no replacement gate)', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef);
    const r = await page.evaluate(async () => {
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        setActiveProfile('ddcs-expert-m350');
        const { setActivePostId } = await import('/wizards/dialects/index.js');
        setActivePostId('grbl');
        window.ddcsEditWizardDef('user_atc_warmup_data');
        await new Promise((r2) => setTimeout(r2, 400));
        const rpm1 = document.querySelector('[data-param="rpm1"]');
        return { found: !!rpm1, disabled: rpm1 ? rpm1.disabled : null };
    });
    expect(r.found, 'sanity: rpm1 exists').toBe(true);
    expect(r.disabled, 'a spindle warm-up sequence needs no tool table — must stay live even on grbl').toBe(false);
});
