import { test, expect } from '@playwright/test';

/**
 * t1884→t1906 — THE wcsSync / w_sys ORPHANED GATE, CLOSED. `postGating.js`'s own `CAP_FIELDS.wcsSync`
 * (`w_sync`/`w_slave`) and its separate `w_sys` OPTION-level gating loop targeted `wiz_wcs` — permanently
 * `display:none` since `wcs` opens the twin (`user_wcs_data`) in-place (t1884's census, re-confirmed t1906).
 *
 * THE SEMANTIC, established fresh (not inherited from the census), same rigor as probePort/toolTable: unlike
 * `atc` (t1890 — stopped, encodes an evidence gap), this one is a CONFIRMED absence. V4.1/DM500 both declare
 * `wcsAuto:false, wcsFixed:false, wcsSync:false` (`ddcs-v41.js:19`, `ddcs-v3-dm500.js:23`) — grounded in the SAME
 * architectural fact `portingArc.js`'s own `V41_NAMED_ABSENCES.readActiveWcs` entry documents in detail: V4.1
 * has NO per-WCS-index register at all (it works ACTIVE-ONLY via #1506-1509; there is no numbered G54..G59
 * table to have an active INDEX into) — a missing CONCEPT in the firmware model, not a missing implementation.
 * Dual-gantry slave sync (`#883`/`#884`) is a separate, already-settled Expert-specific register write, cited
 * as a "gated-absence" pattern elsewhere in this project's own architecture-debt history, not a new claim.
 *
 * THE FIX: `wcsData.js`'s own `sync`/`slave` bindings gate on `_wcsSyncOk`; `sys` gates WHOLE-FIELD on
 * `_wcsPickerOk` (`caps.wcsAuto || caps.wcsFixed`) — a NAMED SIMPLIFICATION of the old dead code's own per-OPTION
 * granularity (Auto needs wcsAuto, G54-59 need wcsFixed separately; RS274NGC genuinely has fixed-only). The
 * simplification is correct for the profiles in question (V4.1/DM500 have BOTH false together, so a whole-field
 * grey and a per-option grey produce the identical visible result for them) — not attempted for RS274NGC's own
 * finer case here, since that needs extending `[data-option-gate]` beyond one option per binding, out of this
 * turn's own "genuinely small" scope. `postGating.js`'s own dead `CAP_FIELDS`/`w_sys` block is deleted entirely.
 */

const EXPERT = 'ddcs-expert-m350', V41 = 'ddcs-v41', DM500 = 'ddcs-v3-dm500';

async function fieldUnder(page, profileId, param) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef);
    return page.evaluate(async ({ profileId, param }) => {
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        setActiveProfile(profileId);
        window.ddcsEditWizardDef('user_wcs_data');
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
        return { found: !!inp, disabled: inp.disabled, title: inp.title };
    }, { profileId, param });
}

test('PRIMARY EVIDENCE, both directions: sync is LIVE on Expert, GREYED with its tooltip reason on V4.1', async ({ page }) => {
    test.setTimeout(30_000);
    const expert = await fieldUnder(page, EXPERT, 'sync');
    expect(expert.found, 'sanity: the sync field exists').toBe(true);
    expect(expert.disabled, 'Expert: live — dual-gantry sync is genuinely Expert-specific').toBe(false);

    const v41 = await fieldUnder(page, V41, 'sync');
    expect(v41.found, 'V4.1: still exists (greyed, not hidden)').toBe(true);
    expect(v41.disabled, 'V4.1: greyed — no #883/#884 equivalent').toBe(true);
    expect(v41.title, 'the tooltip explains why').toContain('DDCS-Expert-specific');
});

test('DM500 matches V4.1 (identical caps: ddcs-v41.js:19 / ddcs-v3-dm500.js:23, both wcsSync:false)', async ({ page }) => {
    test.setTimeout(30_000);
    const dm500 = await fieldUnder(page, DM500, 'sync');
    expect(dm500.disabled, 'DM500: same as V4.1').toBe(true);
    const slave = await fieldUnder(page, DM500, 'slave');
    expect(slave.disabled, 'the slave picker gates with sync (same _wcsSyncOk)').toBe(true);
});

test('the sys (WCS-number) picker greys WHOLE-FIELD on V4.1/DM500 — neither Auto nor a fixed register applies', async ({ page }) => {
    test.setTimeout(30_000);
    const expert = await fieldUnder(page, EXPERT, 'sys');
    expect(expert.disabled, 'Expert: live — has both an active-WCS var and targetable registers').toBe(false);
    const v41 = await fieldUnder(page, V41, 'sys');
    expect(v41.disabled, 'V4.1: greyed — no per-WCS-index register at all').toBe(true);
    expect(v41.title, 'names the reason').toContain('per-WCS-index register');
});

test('the vacuity trap: axisX has nothing to do with wcsSync/wcsPicker — stays live under V4.1', async ({ page }) => {
    // axisX carries NO gate at all, so it never gets a `data-op-gated` attribute — polling it directly would
    // never settle (the same shape t1890's own vacuity trap hit). Poll on `sync` (a gated sibling in the SAME
    // render pass) settling, then read axisX directly — matching the established fix pattern.
    test.setTimeout(30_000);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef);
    const r = await page.evaluate(async () => {
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        setActiveProfile('ddcs-v41');
        window.ddcsEditWizardDef('user_wcs_data');
        await new Promise((resolve, reject) => {
            const t0 = Date.now();
            const poll = () => {
                const inp = document.querySelector('[data-param="sync"]');
                if (inp && inp.dataset.opGated !== undefined) return resolve();
                if (Date.now() - t0 > 5000) return reject(new Error('sync (the sibling settle signal) never settled a gate state'));
                setTimeout(poll, 30);
            };
            poll();
        });
        const ax = document.querySelector('[data-param="axisX"]');
        return { found: !!ax, disabled: ax ? ax.disabled : null, opGated: ax ? ax.dataset.opGated : null };
    });
    expect(r.found, 'sanity: axisX exists').toBe(true);
    expect(r.opGated, 'sanity: axisX carries no gate attribute at all — confirms it is untouched').toBe(undefined);
    expect(r.disabled, 'axisX is untouched by either gate — must stay live even while sync/sys are greyed').toBe(false);
});
