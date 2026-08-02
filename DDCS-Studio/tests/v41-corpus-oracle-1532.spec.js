import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normaliseGcode } from '../web/data/portingArc.js';

/**
 * t1532 — S1, THE CORPUS ORACLE. The 91 tracked V4.1 factory macros become an EXECUTABLE ORACLE, read at runtime
 * the way tests/controller-import-one-door-1221.spec.js already reads the settings corpus — plain readFileSync at
 * the spec layer, no new product-code mechanism (t1531 ruling: "follow that shape, do not invent a second one").
 *
 * PILOT (WCS zero-at-current): the op the advisor ratified because it already has a byte-level factory counterpart.
 * SECOND SUBJECT (corner): the richer op, at the fidelity its evidence actually supports — three primitives are
 * byte-tested against the factory corpus; the WCS-write step is NOT, and the reason is stated rather than hidden.
 */

const corpusDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'bridge', 'controllers', 'v4.1',
    'assets', 'system-backup', 'current');
const factory = (name) => readFileSync(join(corpusDir, name), 'utf8');

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** t1534 — the ONE normalisation policy (data/portingArc.js's V41_ORACLE_NORMALISATION), not a local copy. */
const norm = normaliseGcode;

test.describe('PILOT — WCS zero-at-current', () => {
    test('reproduces zeroxy.nc and zeroz.nc byte-for-byte (normalised)', async ({ page }) => {
        await boot(page);
        const emit = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            const V = m.DIALECTS['ddcs-v41'];
            return {
                xy: V.wcsZeroAtCurrent({ axisX: true, axisY: true }).join('\n'),
                z: V.wcsZeroAtCurrent({ axisZ: true }).join('\n'),
            };
        });
        expect(norm(emit.xy), 'zeroxy.nc').toBe(norm(factory('zeroxy.nc')));
        expect(norm(emit.z), 'zeroz.nc').toBe(norm(factory('zeroz.nc')));
    });

    test('the zeroall.nc 4th-axis gap is a named SCOPE difference, asserted in both directions', async ({ page }) => {
        await boot(page);
        const emitAll = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            return m.DIALECTS['ddcs-v41'].wcsZeroAtCurrent({ axisX: true, axisY: true, axisZ: true }).join('\n');
        });
        const factoryAll = norm(factory('zeroall.nc'));
        expect(factoryAll.split('\n'), 'the factory zeroes FOUR registers — X/Y/Z/A').toEqual(['#1506=0', '#1507=0', '#1508=0', '#1509=0']);
        expect(norm(emitAll).split('\n'), 'Studio zeroes THREE — its WCS op has no 4th-axis concept, on ANY dialect').toEqual(['#1506=0', '#1507=0', '#1508=0']);
    });

    test('the WCS-selector default is inert on V4.1 by CONSTRUCTION — setWorkOffset never reads its first argument', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            const V = m.DIALECTS['ddcs-v41'];
            return {
                a: V.setWorkOffset('#578', 'X', '#100').join('\n'),
                b: V.setWorkOffset('active', 'X', '#100').join('\n'),
                c: V.setWorkOffset('literally-anything', 'X', '#100').join('\n'),
            };
        });
        expect(r.a).toBe(r.b);
        expect(r.b).toBe(r.c);
    });
});

test.describe('SECOND SUBJECT — corner, at the fidelity the corpus actually supports', () => {
    test('probeMove reproduces probe-float.nc\'s G31 form (the TEMPLATE corner\'s probe atom calls unconditionally)', async ({ page }) => {
        await boot(page);
        const emit = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            return m.DIALECTS['ddcs-v41'].probeMove('Z', -1000, { feed: '#106' }).join('');
        });
        // probe-float.nc: "G91G31Z-1000L#682Q1K0F#106" — the G91 mode-set is a separate line in the file; the probe
        // MOVE itself is the G31... portion this dialect function owns
        expect(norm(emit)).toBe('G31Z-1000L#682Q1K0F#106');
    });

    test('probeTrigVar resolves the exact register probe-fix.nc reads post-probe (#1502 for Z)', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            const V = m.DIALECTS['ddcs-v41'];
            return { x: V.probeTrigVar('X'), y: V.probeTrigVar('Y'), z: V.probeTrigVar('Z') };
        });
        // probe-fix.nc reads Z's trigger with "#108=#1502" and "#1556=#1502" — #1502 is the register this asserts
        expect(r.z).toBe('#1502');
        expect(r.x).toBe('#1500');
        expect(r.y).toBe('#1501');
        expect(factory('probe-fix.nc')).toContain('#1502');
    });

    test('machineMove reproduces probe-fix.nc\'s G0 G53 form (the retract corner\'s safeRetractNode composes through)', async ({ page }) => {
        await boot(page);
        const emit = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            return m.DIALECTS['ddcs-v41'].machineMove('Z', '#102').join('');
        });
        expect(norm(emit)).toBe(norm(factory('probe-fix.nc').split('\n').find((l) => l.startsWith('G0G53'))));
    });

    /**
     * ⚠ NOT BYTE-TESTED, ON PURPOSE — this is the fidelity ceiling this second subject actually has, stated rather
     * than silently skipped. probe-vertex.nc writes its G92 offset AT THE TRIGGER POINT with a value PRECOMPUTED
     * before the probe (`G90G92Z#114+#3`); corner writes its WCS offset AFTER RETRACTING to a saved/scratch position
     * (`#102`/`#101`), which is why setWorkOffset uses the position-INDEPENDENT `[#dro-value]` form instead — the
     * two solve the same G92 semantic from different physical states and are not expected to produce the same line.
     * Asserted here as a STRUCTURAL fact (both are real, both fire G90 G92, the expressions differ) rather than
     * skipped silently — the difference is checked, even though equality is not the claim.
     */
    test('the WCS-write step is a DIFFERENT (not wrong) formula from probe-vertex.nc, and that difference is checked', async ({ page }) => {
        await boot(page);
        const emit = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            return m.DIALECTS['ddcs-v41'].setWorkOffset('#578', 'Z', '#102').join('');
        });
        const factoryLine = factory('probe-vertex.nc').split('\n').find((l) => l.startsWith('G90G92Z'));
        expect(factoryLine, 'probe-vertex.nc DOES fire a Z work-offset write — the comparison point exists').toBeTruthy();
        expect(norm(emit)).not.toBe(norm(factoryLine));
        expect(norm(emit), 'Studio\'s form: position-independent, derives from the LIVE dro').toMatch(/^G90G92Z\[#1502-/);
        expect(norm(factoryLine), 'the factory\'s form: a precomputed sum, no #1502 reference at all').not.toContain('#1502');
    });
});
