import { test, expect } from './support/harness.mjs';

/**
 * SYSSTART PER-POST DIALECT (t646, polish item 1). The Macros → sysstart Generate/Push/Deploy build the boot macro with
 * `emitMapped(homingStack(homingRunParams(settings)), activeDialectOpts()).text`. homingStack resolves the ACTIVE post itself
 * (getDialect) and REFUSES a homing sequence on a non-Expert post (unverified M98/param map). This asserts the boot macro on
 * V4.1 is the honest refusal (no Expert homing sequence) and Expert is unchanged byte-for-byte.
 */
const SETTINGS = {
    machine: { x: 300, y: 200, z: 120, softLimits: true },
    homing: { axes: {
        x: { enable: true, order: 1, method: 'seek', seekFeed: 600, slowFeed: 100, backoff: 5 },
        y: { enable: true, order: 2, method: 'seek', seekFeed: 600, slowFeed: 100, backoff: 5 },
        z: { enable: true, order: 3, method: 'seek', seekFeed: 600, slowFeed: 100, backoff: 5 },
    } },
    motors: {}, limits: {}, sysstartCustomGcode: '',
};

test('sysstart boot macro folds per ACTIVE post: V4.1 refuses, Expert emits the real homing sequence', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (SETTINGS) => {
        const { homingStack, homingRunParams } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const { setActiveProfile } = await import('/shared/js/profiles/controllerProfiles.js');
        const build = () => emitMapped(homingStack(homingRunParams(SETTINGS)), activeDialectOpts()).text;   // the threaded form
        const buildNoOpts = () => emitMapped(homingStack(homingRunParams(SETTINGS))).text;                  // the OLD (no-dialect) form
        const out = {};
        for (const id of ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500']) {
            setActiveProfile(id);
            out[id] = { threaded: build(), noOpts: buildNoOpts() };
        }
        setActiveProfile('ddcs-expert-m350');
        return out;
    }, SETTINGS);

    // Expert: the REAL homing sequence + threading is byte-identical (Expert IS the default)
    expect(r['ddcs-expert-m350'].threaded, 'Expert emits the G31 home seek').toContain('G31');
    expect(r['ddcs-expert-m350'].threaded, 'Expert sets the homed flag').toContain('#1515');
    expect(r['ddcs-expert-m350'].threaded, 'Expert threaded == no-opts (byte-identical, unchanged)').toBe(r['ddcs-expert-m350'].noOpts);

    // V4.1: the honest refusal, NO Expert homing sequence
    for (const id of ['ddcs-v41', 'ddcs-v3-dm500']) {
        expect(r[id].threaded, `${id} boot macro states the refusal`).toContain('UNVERIFIED');
        expect(r[id].threaded, `${id} emits NO G31 home seek`).not.toContain('G31');
        expect(r[id].threaded, `${id} emits NO M98 native home`).not.toContain('M98P501');
        expect(r[id].threaded, `${id} writes NO homed flag #1515`).not.toContain('#1515');
    }
});
