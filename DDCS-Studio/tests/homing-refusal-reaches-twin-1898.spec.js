import { test, expect } from '@playwright/test';

/**
 * t1896→t1898 — THE FROZEN-TEMPLATE CENSUS'S ONE BROKEN ROW, FIXED. `homingWizard.js` carries an EXPLICIT,
 * deliberate refusal for non-Expert dialects (`:168-173` — "we do NOT emit a guessed homing sequence for
 * V4.1/DM500"). t1896's census found the data-op twin's OLD `postInstantiate` (`applyHomingRecompose`, the t550
 * arm-preserving unroll) silently DEFEATED that refusal: its own `shapeStable` check was vacuously true whenever
 * the live dialect's fresh build had no per-axis arms (the refusal path returns a bare array, no `op` wrapper),
 * so a template frozen under Expert (the app's own boot-default profile) kept re-emitting its OWN stored Expert
 * arms verbatim under V4.1/DM500 — CONFIRMED LIVE (WORK-LOG t1896): opening Homing under V4.1 showed Expert's
 * real seek sequence (`#1045`/`#880`-style registers), zero refusal text, at default settings, via a normal
 * wizard-bar click. Worse than the t1868 G91 fix — this defeats an EXISTING, already-written safety guard rather
 * than merely omitting a restore step, on the op that drives the machine at its limit switches.
 *
 * THE FIX (t1898): `applyHomingRecompose` now does a FULL RECOMPOSE — `root.children = homingStack(...)` fresh
 * on every instantiation, mirroring `atc_length`/`atc_check`'s own t1894 fix exactly (no third shape). The old
 * per-arm "preserve a Blocks edit" mechanism (t550) is GONE — it was the SAME machinery that let the refusal go
 * unheeded. `homing-data-emit.spec.js`'s own E2 test is updated (not deleted) to assert the new, named trade-off.
 *
 * THIS SUITE asserts the EMITTED TEXT itself (not a flag, not a boolean) — the dispatch's own explicit
 * instruction, because this whole bug WAS a correctly-set flag the model silently ignored on the way to the
 * machine. A flag-only assertion would have looked green the whole time this was broken.
 */

async function previewFor(page, profileId) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.openWiz);
    await page.evaluate(async (profileId) => { const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile(profileId); }, profileId);
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user_code', { timeout: 8000 });
    await page.waitForFunction(() => (document.getElementById('wiz_user_code')?.textContent || '').length > 10, null, { timeout: 8000 });
    return page.evaluate(() => document.getElementById('wiz_user_code').textContent || '');
}

test('V4.1: the REFUSAL text is what comes out — no Expert seek sequence anywhere', async ({ page }) => {
    test.setTimeout(30_000);
    const t = await previewFor(page, 'ddcs-v41');
    expect(t, 'the explicit refusal message reaches the live preview').toContain('UNVERIFIED on DDCS V4.1');
    expect(t, 'no Expert seek register (#1045/#1047/#880/#1515) anywhere').not.toMatch(/#104[5-9]|#105[0-3]|#88[0-2]|#151[5-7]/);
    expect(t, 'no G31 seek line at all').not.toContain('G31');
});

test('DM500: the REFUSAL text is what comes out — no Expert seek sequence anywhere (identical-caps economy)', async ({ page }) => {
    test.setTimeout(30_000);
    const t = await previewFor(page, 'ddcs-v3-dm500');
    expect(t, 'the explicit refusal message reaches the live preview').toContain('UNVERIFIED on DDCS V3 / DM500');
    expect(t, 'no Expert seek register anywhere').not.toMatch(/#104[5-9]|#105[0-3]|#88[0-2]|#151[5-7]/);
    expect(t, 'no G31 seek line at all').not.toContain('G31');
});

test('Expert: BYTE-IDENTICAL to before — the real seek sequence, no refusal text', async ({ page }) => {
    test.setTimeout(30_000);
    const t = await previewFor(page, 'ddcs-expert-m350');
    expect(t, 'Expert still gets the real homing sequence').toContain('G31 X-320');
    expect(t, 'Expert homes X').toContain('#880=0 ( X machine coord = 0 home datum )');
    expect(t, 'no refusal text on the one verified post').not.toContain('UNVERIFIED');
});

test('THE FLIP DIRECTION IS SETTLED: register under V4.1 (refusing), switch to Expert mid-session — NOT stuck', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.openWiz);
    await page.evaluate(async () => { const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile('ddcs-v41'); });
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user_code', { timeout: 8000 });
    await page.waitForTimeout(500);
    await page.evaluate(async () => { const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js'); setActiveProfile('ddcs-expert-m350'); });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForFunction(() => (document.getElementById('wiz_user_code')?.textContent || '').includes('G31'), null, { timeout: 8000 });
    const t = await page.evaluate(() => document.getElementById('wiz_user_code').textContent || '');
    expect(t, 'not stuck on the V4.1 refusal after switching to Expert').not.toContain('UNVERIFIED');
    expect(t, 'shows the real Expert seek sequence').toContain('#880=0');
});
