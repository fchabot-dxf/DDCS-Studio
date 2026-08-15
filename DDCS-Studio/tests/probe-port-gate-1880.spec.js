import { test, expect } from '@playwright/test';

/**
 * t1876→t1878→t1880 — PROBE-PORT FIELD GATING, closing the headline gap the audit found: `postGating.js`'s own
 * `CAP_FIELDS.probePort` (15 field ids: c_port/m_port/p_port/al_port/circ_q/rc_q/rcl_q + level/q siblings) was
 * NON-FUNCTIONAL — pre-wizards-as-data artifacts with zero DOM presence anywhere, confirmed by grep and by
 * opening all 6 probe wizards live (t1878, WORK-LOG). The real, current surface is smaller too: only `port`
 * survives as an editable param per op (level/Q were dropped from the twin system entirely, not merely
 * relabeled).
 *
 * THE SEMANTIC, established from primary source before gating anything (t1880's own explicit instruction — "no
 * gate is better than a wrong gate"): each dialect's OWN `probeMove` function signature —
 *   - `ddcs-expert-m350.js:34`: `probeMove(axis, dist, {feed, port=3, level=0})` → emits `P${port} L${level}`.
 *     The port IS a live, user-editable G-code word here.
 *   - `ddcs-v41.js:22`: `probeMove(axis, dist, {feed})` → NO port/level param at all; emits a FIXED `L#682 Q1
 *     K0`. The controller selects the port in firmware; nothing Studio emits could change it.
 *   - `ddcs-v3-dm500.js:26`: `probeMove` doesn't use G31 at all (`M101` arm / `G91` move / `M102` disarm,
 *     move-until-input) — no port concept whatsoever.
 * So `caps.probePort: false` does NOT mean "cannot probe" (V4.1/DM500 both probe, live, via their own forms —
 * V4.1 confirmed against the user's real controller). It means: the Port NUMBER is never read by this dialect's
 * own probe-move emit — editing it does nothing, silently, which is the actual hazard the gate exists to name.
 *
 * THE FIX: each of the 6 ops' own `port` param declaration (`cornerData.js`, `middleData.js`, `edgeData.js`,
 * `alignmentData.js`, `rotaryCenterData.js`, `rotaryClockData.js`) now carries a `gate: { param:
 * '_probePortOk', is: false, tip: '...' }` — the SAME pattern `tapData.js:58`'s own `_rigidOk` already uses
 * (grey, not hide, with a tooltip reason). `_probePortOk` is computed in `userOpView.js` (mirroring `_oword`/
 * `_rigidOk` right beside it) from `caps.probePort`, fresh on every twin-form render — not gated by
 * `postGating.js` at all (that mechanism only re-runs on load + `ddcs:settings-changed`, and would need to
 * learn a new selector convention for a form that already re-renders its own gates on every op switch).
 * `postGating.js`'s own dead `probePort` entry (both `CAP_FIELDS` and `CAP_WHY`) is DELETED as part of the same
 * act — leaving it would have the file keep CLAIMING to gate probe ports while doing nothing.
 *
 * IDENTICAL-CAPS ECONOMY: V4.1 and DM500 declare BYTE-IDENTICAL `caps.probePort: false` (verified by reading
 * both files side by side — `ddcs-v41.js:17` and `ddcs-v3-dm500.js:21`, both `probePort: false` in the same
 * caps object shape). So this suite tests V4.1 as the representative non-Expert case; DM500 is not re-tested
 * live — a divergence between the two would be a REGRESSION in one of those two files, not something this test
 * (or a DM500-specific copy of it) could ever have caught differently.
 */

const EXPERT = 'ddcs-expert-m350', V41 = 'ddcs-v41';
const PROBE_OPS = ['user_corner_data', 'user_middle_data', 'user_edge_data', 'user_alignment_data', 'user_rotary_center_data', 'user_rotary_clock_data'];

/** A FRESH page navigation per (profile, op) check — deliberately not a same-session profile switch. The twin
 *  form's own re-render is an async pipeline with no exposed "render complete" signal; switching profiles
 *  within one session and polling `data-op-gated` can catch the OUTGOING render's already-settled state before
 *  the incoming one lands (proven flaky in manual testing — a fresh load never was). Slower, but correct. */
async function portFieldUnder(page, profileId, opType) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef);
    return page.evaluate(async ({ profileId, opType }) => {
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        setActiveProfile(profileId);
        window.ddcsEditWizardDef(opType);
        await new Promise((resolve, reject) => {
            const t0 = Date.now();
            const poll = () => {
                const inp = document.querySelector('[data-param="port"]');
                if (inp && inp.dataset.opGated !== undefined) return resolve();
                if (Date.now() - t0 > 5000) return reject(new Error('port field never settled a gate state'));
                setTimeout(poll, 30);
            };
            poll();
        });
        const inp = document.querySelector('[data-param="port"]');
        return { found: !!inp, disabled: inp.disabled, title: inp.title, opGated: inp.dataset.opGated };
    }, { profileId, opType });
}

test('PRIMARY EVIDENCE, both directions: Corner\'s Port field is LIVE on Expert, GREYED with its tooltip reason on V4.1', async ({ page }) => {
    test.setTimeout(30_000);
    const expert = await portFieldUnder(page, EXPERT, 'user_corner_data');
    expect(expert.found, 'sanity: the Port field exists on Expert').toBe(true);
    expect(expert.disabled, 'Expert: the port field is LIVE (its own probeMove reads it)').toBe(false);
    expect(expert.title, 'Expert: no gate tooltip when live').toBe('');

    const v41 = await portFieldUnder(page, V41, 'user_corner_data');
    expect(v41.found, 'sanity: the Port field still exists on V4.1 (greyed, not hidden)').toBe(true);
    expect(v41.disabled, 'V4.1: the port field is GREYED — its own probeMove never reads a port').toBe(true);
    expect(v41.title, 'V4.1: the tooltip explains why, not just that').toContain('no port number');
});

test('every one of the 6 probe ops gates its own Port field under V4.1 — not just Corner', async ({ page }) => {
    test.setTimeout(90_000);
    const results = [];
    for (const opType of PROBE_OPS) results.push({ opType, ...(await portFieldUnder(page, V41, opType)) });

    const notFound = results.filter((r) => !r.found);
    const notGreyed = results.filter((r) => r.found && !r.disabled);
    expect(notFound, `every op's own Port field must exist (greyed, not hidden) — missing: ${JSON.stringify(notFound.map((r) => r.opType))}`).toEqual([]);
    expect(notGreyed, `every op's own Port field must be greyed under V4.1 — still live: ${JSON.stringify(notGreyed.map((r) => r.opType))}`).toEqual([]);
});

test('the gate does not grey EVERYTHING regardless of dialect — a different field on the same form stays live under V4.1', async ({ page }) => {
    // The vacuity trap named in the dispatch: a gate that greys the whole form would pass the tests above
    // trivially. Pick a field on the SAME corner form that has nothing to do with probePort (radius, the
    // stylus-tip compensation) and confirm it's untouched.
    test.setTimeout(30_000);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef);

    const r = await page.evaluate(async () => {
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        setActiveProfile('ddcs-v41');
        window.ddcsEditWizardDef('user_corner_data');
        await new Promise((resolve, reject) => {
            const t0 = Date.now();
            const poll = () => {
                const inp = document.querySelector('[data-param="port"]');
                if (inp && inp.dataset.opGated !== undefined) return resolve();
                if (Date.now() - t0 > 5000) return reject(new Error('settle timeout'));
                setTimeout(poll, 30);
            };
            poll();
        });
        const radius = document.querySelector('[data-param="radius"]');
        return { found: !!radius, disabled: radius ? radius.disabled : null };
    });
    expect(r.found, 'sanity: the radius field exists').toBe(true);
    expect(r.disabled, 'radius has nothing to do with probePort — must stay live even while port is greyed').toBe(false);
});
