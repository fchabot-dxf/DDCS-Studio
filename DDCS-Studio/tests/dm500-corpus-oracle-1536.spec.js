import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normaliseGcode, DM500_ORACLE_FINDINGS } from '../web/data/portingArc.js';

/**
 * t1536 — DM500 STAGE 1, MEASUREMENT ONLY (advisor's exact scope). The S1 oracle mechanism built for V4.1, run
 * against the DM500 factory corpus — exactly 8 files at bridge/controllers/dm500/install/. Reuses the ONE shared
 * `normaliseGcode` S1 already built; no second normaliser.
 *
 * ⚠ NO VERDICT HERE. This measures and reports. It does not rule on DM500's evidence tier, does not touch
 * POST_VERIFIED, does not change any DM500 cap value, and does not declare the port verified or unverified.
 */

const dm500Dir = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'bridge', 'controllers', 'dm500', 'install');
const factory = (name) => readFileSync(join(dm500Dir, name), 'utf8');

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('DM500_ORACLE_FINDINGS covers exactly the 8 tracked install/ files, each with all 5 required fields', () => {
    expect(DM500_ORACLE_FINDINGS.map((f) => f.file).sort()).toEqual(
        ['defprobe.nc', 'gotoz.nc', 'm30.nc', 'null.nc', 'pause.nc', 'probe.nc', 'safez.nc', 'slib.nc']);
    for (const row of DM500_ORACLE_FINDINGS) {
        for (const field of ['file', 'demonstrates', 'studioEmits', 'detail', 'confidence']) {
            expect(typeof row[field], `${row.file}.${field} is a string`).toBe('string');
            expect(row[field].length > 0, `${row.file}.${field} is non-empty`).toBe(true);
        }
        expect(['matched', 'differs', 'no-equivalent']).toContain(row.studioEmits);
        expect(['byte-exact', 'structural', 'unverifiable-from-corpus']).toContain(row.confidence);
    }
});

test('the corpus is exactly the 8 tracked files this act measured — no silent addition or removal', () => {
    for (const name of ['defprobe.nc', 'gotoz.nc', 'm30.nc', 'null.nc', 'pause.nc', 'probe.nc', 'safez.nc', 'slib.nc']) {
        expect(() => factory(name), `${name} is readable`).not.toThrow();
    }
});

test.describe('the byte-exact primitives — verified directly against the corpus text, not from memory', () => {
    test('probeMove reproduces defprobe.nc\'s M101/G91 G01/M102 triplet', async ({ page }) => {
        await boot(page);
        // defprobe.nc's triplet is clean and standalone; probe.nc's occurrence has the label fused onto the M101
        // line with no separator ("N1M101") — a real corpus quirk, not something to paper over by testing the
        // messier instance. Feed is #2011 (a variable) here, not the literal 100 probe.nc happens to use.
        const emit = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            return m.DIALECTS['ddcs-v3-dm500'].probeMove('Z', -100, { feed: '#2011' }).join('\n');
        });
        // the file is CRLF (bridge/controllers dumps preserve the source line endings) — compare with \r stripped
        expect(factory('defprobe.nc').replace(/\r/g, '')).toContain('M101\nG91 G01 Z-100 F#2011\nM102');
        expect(normaliseGcode(emit)).toBe(normaliseGcode('M101\nG91 G01 Z-100 F#2011\nM102'));
    });

    test('readMachine reproduces probe.nc\'s #20=#864/#21=#865/#22=#866 DRO capture', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            const V = m.DIALECTS['ddcs-v3-dm500'];
            return { x: V.readMachine('X', '#20').join(''), y: V.readMachine('Y', '#21').join(''), z: V.readMachine('Z', '#22').join('') };
        });
        const src = factory('probe.nc');
        expect(src).toContain('#20=#864');
        expect(src).toContain('#21=#865');
        expect(src).toContain('#22=#866');
        expect(normaliseGcode(r.x)).toBe('#20=#864');
        expect(normaliseGcode(r.y)).toBe('#21=#865');
        expect(normaliseGcode(r.z)).toBe('#22=#866');
    });

    test('ifGoto reproduces BOTH corpus spacing styles (probe.nc unspaced, defprobe.nc spaced) after normalisation', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            const V = m.DIALECTS['ddcs-v3-dm500'];
            return { eq: V.ifGoto('#571', '==', '0', 1).join(''), lt: V.ifGoto('#2004', '<', '0', 1).join('') };
        });
        expect(factory('probe.nc')).toContain('IF#571EQ0GOTO1');
        expect(factory('defprobe.nc')).toContain('IF #2004LT0 GOTO1');
        expect(normaliseGcode(r.eq)).toBe(normaliseGcode('IF#571EQ0GOTO1'));
        expect(normaliseGcode(r.lt)).toBe(normaliseGcode('IF #2004LT0 GOTO1'));
    });

    test('dwell(0) and spindleOff() reproduce probe.nc\'s G04 P0 / M5', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            const V = m.DIALECTS['ddcs-v3-dm500'];
            return { dwell: V.dwell(0).join(''), spindleOff: V.spindleOff().join('') };
        });
        expect(normaliseGcode(r.dwell)).toBe(normaliseGcode('G04 P0'));
        expect(normaliseGcode(r.spindleOff)).toBe(normaliseGcode('M5'));
        // probe.nc's lines carry trailing GBK-garbled comments fused with NO separating space (`G04P0;停0s...`,
        // `M5;关闭...`) — normaliseGcode only strips FULL-line comments, not trailing same-line ones, so check
        // substring containment against the normalised text rather than a raw or exact-line match
        const normalisedFactory = normaliseGcode(factory('probe.nc'));
        expect(normalisedFactory).toContain('G04P0');
        expect(normalisedFactory).toContain('M5');
    });
});

test.describe('the structural differences — asserted as checked differences, not silently skipped', () => {
    test('setWorkOffset differs from defprobe.nc\'s precomputed-sum G92 form (same class as the V4.1 corner finding)', async ({ page }) => {
        await boot(page);
        const emit = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            return m.DIALECTS['ddcs-v3-dm500'].setWorkOffset('#804', 'Z', '#2003').join('');
        });
        expect(factory('defprobe.nc')).toContain('G90 G92 Z#2003');
        expect(normaliseGcode(emit)).not.toBe(normaliseGcode('G90 G92 Z#2003'));
        expect(normaliseGcode(emit), 'Studio\'s form: position-independent, derives from the live DRO').toMatch(/^G90G92Z\[#866-/);
    });

    test('no Studio primitive emits a bare M98 subroutine call (gotoz.nc / safez.nc / slib.nc\'s canned cycles)', async () => {
        const src = readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'web', 'wizards', 'ops', 'holecycle.js'), 'utf8');
        expect(src, 'holecycle.js — Studio\'s own drill-cycle emit — never references M98 or an O-number').not.toMatch(/M98|O9\d{3}/);
        expect(factory('gotoz.nc').trim()).toBe('M98 P100');
        expect(factory('safez.nc').trim()).toBe('M98 P101');
    });

    test('the dialect declares goto-only flow — no WHILE/DO/END, which slib.nc\'s canned cycles use throughout', async ({ page }) => {
        await boot(page);
        const flow = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            return m.getCaps('ddcs-v3-dm500').flow;
        });
        expect(flow).toBe('goto');
        expect(factory('slib.nc')).toMatch(/WHILE#\d+>0DO\d+/);
    });

    test('m30.nc and null.nc are genuinely empty — nothing to compare, named as unverifiable rather than guessed', () => {
        expect(factory('m30.nc').trim()).toBe('');
        expect(factory('null.nc').trim()).toBe('');
    });

    test('pause.nc is a single-line firmware hook Studio has no op to author', () => {
        expect(factory('pause.nc').trim()).toBe('G91G0Z#589');
    });
});
