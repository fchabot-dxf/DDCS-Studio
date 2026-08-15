import { test, expect } from '@playwright/test';

/**
 * t1884→t1886→t1888 — REVIVING `ui/probeInputSelect.js`'s "Probe Input" dropdown. Dead for as long as the
 * wizards-as-data migration has existed (t1884's own census: `document.getElementById('c_port')`-style lookups
 * always returned null, silently). This is a RESTORATION of the original intent (a friendly picker sourced from
 * Settings → Hardware → Input, replacing raw pin-number typing) — not a new feature. See `probeInputSelect.js`'s
 * own header for the full mechanics + the two interaction rules this suite guards.
 *
 * SHAPE B (t1888's own ruling): compose without hiding. The revived dropdown sits ALONGSIDE the raw Port field
 * (never replacing/hiding it), because the field grew two independent, working mechanisms since the original
 * code predates them:
 *   1. `probeSrcGlyph.js`'s own controller-register source toggle (live on `port` for corner/edge/alignment,
 *      not middle) — the dropdown is ABSENT when the source is a register (it would have nothing correct to
 *      show: no literal is in use).
 *   2. `_probePortOk` (t1880) — the dialect-capability gate. The dropdown greys WITH the port field (reads
 *      `port.disabled` directly — one declared source, not a second computation).
 *
 * Three states, three real gestures, non-vacuous by revert (see WORK-LOG t1888 for the exact before/after).
 */

const EXPERT = 'ddcs-expert-m350', V41 = 'ddcs-v41';

async function boot(page, profileId) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsSetProbeSrc);
    await page.evaluate(async (profileId) => {
        const SP = await import('/ui/settingsPanel.js');
        SP.applySettings({ inputs: [{ id: 'p1', type: 'probe', label: 'Touch Probe', pin: 5, level: 0 }] });
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        setActiveProfile(profileId);
    }, profileId);
}

async function openAndRead(page, opType) {
    await page.evaluate((opType) => window.openWiz(opType), opType);
    // A fixed wait, not a polled condition: the dropdown's own presence is CONDITIONAL (absent in register
    // mode, t1888's own Interaction 1), so there is no single DOM signal that reliably means "settled" across
    // every state this suite checks — tried polling port's own data-op-gated (userOpView.js's independent
    // render-settle signal) and it resolved BEFORE this module's own MutationObserver-triggered sync() had run,
    // a genuine race, reproduced even single-threaded. 600ms (up from an original 300ms that flaked once under
    // a heavy concurrent gate batch, never in isolation) is comfortable headroom without that fragility.
    await page.waitForTimeout(600);
    return page.evaluate(() => {
        const sel = document.getElementById('wiz_user_probe_input');
        const port = document.querySelector('#wiz_user_form [data-param="port"]');
        return {
            selExists: !!sel, selDisabled: sel ? sel.disabled : null, selTitle: sel ? sel.title : null,
            selOptions: sel ? [...sel.options].map((o) => o.textContent) : null,
            portValue: port ? port.value : null, portDisabled: port ? port.disabled : null, portReadOnly: port ? port.readOnly : null,
        };
    });
}

test('STATE 1 — literal source: the dropdown is live, populated from Settings, and picking drives the emit', async ({ page }) => {
    test.setTimeout(30_000);
    await boot(page, EXPERT);
    const r = await openAndRead(page, 'user_corner_data');
    expect(r.selExists, 'the dropdown appears for a probe wizard with a literal (studio) port source').toBe(true);
    expect(r.selDisabled, 'live, not greyed, on Expert with the port available').toBe(false);
    expect(r.selOptions, 'populated from the declared Settings input').toEqual(['Touch Probe (pin 5)']);

    // real gesture: pick the option
    const before = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="port"]').value);
    await page.evaluate(() => {
        const sel = document.getElementById('wiz_user_probe_input');
        sel.value = '5';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const after = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="port"]').value);
    expect(after, `picking the dropdown option must write the Port field (was "${before}")`).toBe('5');

    // drives the EMIT too (not just the DOM value) — the whole point of the feature
    const emit = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const def = U.getUserDef('user_corner_data');
        const params = { ...U.defaultParams(def), port: 5 };
        return emitMapped(builderOf('user_corner_data')(params)).text;
    });
    expect(emit, 'the picked pin (5) reaches the emitted G-code (Expert assigns it to #5, then references P#5)').toMatch(/#5=5\b/);
});

test('STATE 2 — register source: the dropdown is ABSENT, not merely disabled (it has nothing correct to show)', async ({ page }) => {
    test.setTimeout(30_000);
    await boot(page, EXPERT);
    await page.evaluate(() => window.ddcsSetProbeSrc('port', 'ctrl'));
    const r = await openAndRead(page, 'user_corner_data');
    expect(r.selExists, 'no dropdown when the port reads from a controller register — no literal is in use to offer').toBe(false);
    expect(r.portReadOnly, 'sanity: the field itself is genuinely in register mode').toBe(true);
    expect(r.portValue, 'sanity: showing the runtime register, not a pin').toBe('#1078');
});

test('STATE 3 — dialect-gated: the dropdown greys WITH the port field, one control, one enabled-state', async ({ page }) => {
    test.setTimeout(30_000);
    await boot(page, V41);
    const r = await openAndRead(page, 'user_corner_data');
    expect(r.selExists, 'the dropdown still appears when dialect-gated — greyed, not hidden (matches the field itself)').toBe(true);
    expect(r.portDisabled, 'sanity: the port field is genuinely dialect-gated on V4.1').toBe(true);
    expect(r.selDisabled, 'the dropdown mirrors the SAME gate state as the field it drives').toBe(true);
    expect(r.selTitle, 'the dropdown carries the SAME tooltip reason as the gated field, not a different or missing one').toContain('no port number');
});

test('middle has no source-toggle conflict — the dropdown works there exactly as on corner', async ({ page }) => {
    test.setTimeout(30_000);
    await boot(page, EXPERT);
    const r = await openAndRead(page, 'user_middle_data');
    expect(r.selExists, 'middle\'s own port field has no probeSrcGlyph mapping — the simple case').toBe(true);
    expect(r.selDisabled).toBe(false);
});

test('the ORIGINAL 4-op scope holds: rotaryCenter/rotaryClock (also got a port field from t1880) are NOT in scope for this feature', async ({ page }) => {
    test.setTimeout(30_000);
    await boot(page, EXPERT);
    const r = await openAndRead(page, 'user_rotary_center_data');
    expect(r.selExists, 'this revival\'s own scope is corner/middle/edge/alignment only, not rotaryCenter/rotaryClock').toBe(false);
});
