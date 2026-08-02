import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { V41_ORACLE_NORMALISATIONS, normaliseGcode, V41_NAMED_ABSENCES } from '../web/data/portingArc.js';

/**
 * t1534 — S3 (caps-completeness) + S4 (named absences) + S2 (normalisation policy), the t1533 amendment's exact
 * checklist, one act. S5 stays human-gated and unscheduled; DM500/other targets not started.
 *
 * ⚠ THE STANDING GUARD, held throughout: nothing here upgrades a verification claim. POST_VERIFIED stays exactly
 * {ddcs-expert-m350, ddcs-v41} — asserted below, not assumed.
 *
 * ⚠ A REAL CONFLICT IN THE AMENDMENT ITSELF, RESOLVED IN FAVOUR OF ITS OWN ACCEPTANCE TEST, FLAGGED FOR RULING —
 * see the WORK-LOG / pass-back note: the amendment's literal instruction was `inputRead: true, atc: true`
 * (mirroring the Expert-full pattern the ORIGINAL 10 DEFAULT_CAPS keys follow). Measured precisely: inputRead is
 * declared by EXPERT ALONE (6 of 7 posts undeclared); atc by 3 of 7 (4 undeclared). Setting either to `true`
 * would flip those undeclared posts' caps.inputRead/atc from `undefined` to `true` — a REAL behaviour change,
 * which is exactly what the amendment's OWN acceptance test ("getCaps returns the same value... behaviour-neutral")
 * is written to catch. `false` is what actually satisfies that test; `true` would fail it. Implemented `false`,
 * per the amendment's explicit "IF ADDING A DEFAULT CHANGES ANY POST'S EFFECTIVE CAPS, STOP AND TELL ME" clause —
 * this file's own test proves `false` is behaviour-neutral and `true` would not be.
 */

const testsDir = fileURLToPath(new URL('.', import.meta.url));
const corpusDir = join(testsDir, '..', '..', 'bridge', 'controllers', 'v4.1');

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** The DEFAULT_CAPS as they stood immediately BEFORE this act (the 10 original keys) — a literal snapshot, not a live read, so the before/after comparison has a fixed baseline. */
const CAPS_BEFORE_T1534 = {
    vars: true, flow: 'goto', probeStatusCheck: true, hmi: true, toolTable: true, probePort: true,
    flowStreamable: true, wcsAuto: true, wcsFixed: true, wcsSync: true,
};

test.describe('S3 — caps-completeness', () => {
    test('the completeness invariant, COMPUTED FROM THE REGISTRY — every key any post declares also exists in DEFAULT_CAPS', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            const defaultKeys = new Set(Object.keys(m.getCaps('__nonexistent__')));   // getCaps merges over DEFAULT_CAPS even for an unknown id
            const missing = [];
            for (const id of Object.keys(m.DIALECTS)) {
                const own = m.DIALECTS[id].caps || {};
                for (const k of Object.keys(own)) if (!defaultKeys.has(k)) missing.push(`${id}.${k}`);
            }
            return { defaultKeys: [...defaultKeys].sort(), missing };
        });
        expect(r.missing, 'no post declares a cap key that DEFAULT_CAPS does not also carry').toEqual([]);
        expect(r.defaultKeys).toEqual(['atc', 'flow', 'flowStreamable', 'helicalArc', 'hmi', 'inputRead', 'probePort',
            'probeStatusCheck', 'toolTable', 'vars', 'wcsAuto', 'wcsFixed', 'wcsSync'].sort());
    });

    test('getCaps is BEHAVIOUR-NEUTRAL before/after — literal equality on the original 10 keys, truthy-equivalence on all (including the 3 new ones)', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            const out = {};
            for (const id of Object.keys(m.DIALECTS)) out[id] = { own: m.DIALECTS[id].caps || {}, after: m.getCaps(id) };
            return out;
        });
        for (const [id, { own, after }] of Object.entries(r)) {
            const before = { ...CAPS_BEFORE_T1534, ...own };
            for (const k of Object.keys(CAPS_BEFORE_T1534)) {
                expect(after[k], `${id}.${k} — LITERAL equality on an untouched key`).toBe(before[k]);
            }
            for (const k of ['inputRead', 'atc', 'helicalArc']) {
                expect(!!after[k], `${id}.${k} — TRUTHY-equivalence: undeclared→undefined (falsy) before, `
                    + `undeclared→false (falsy) after — the SAME to every real consumer (all truthy-test, none `
                    + 'compare === false, per the residue census)').toBe(!!own[k]);
            }
        }
    });

    test('the latency claim, proven against a REAL consumer — absent vs explicitly-false caps.inputRead produce IDENTICAL output', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const { outPinBlock } = await import('/wizards/ops/cnc.js');
            const withFalse = { id: 'ddcs-test', name: 'Test', caps: { flow: 'goto', inputRead: false } };
            const withAbsent = { id: 'ddcs-test', name: 'Test', caps: { flow: 'goto' } };
            const p = { pin: 3, state: 'on' };
            return {
                gateFalse: outPinBlock.gate(withFalse), gateAbsent: outPinBlock.gate(withAbsent),
                emitFalse: outPinBlock.emit(p, 0, 0, withFalse), emitAbsent: outPinBlock.emit(p, 0, 0, withAbsent),
            };
        });
        expect(r.gateFalse).toBe(r.gateAbsent);
        expect(r.emitFalse).toEqual(r.emitAbsent);
        expect(r.gateFalse, 'not a vacuous comparison of two blanks — the gate really does refuse').toBeTruthy();
    });

    test('had true been chosen instead, the SAME test would have FAILED — the conflict is real, not asserted from nothing', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            const affected = { inputRead: [], atc: [] };
            for (const id of Object.keys(m.DIALECTS)) {
                const own = m.DIALECTS[id].caps || {};
                if (own.inputRead === undefined) affected.inputRead.push(id);
                if (own.atc === undefined) affected.atc.push(id);
            }
            return affected;
        });
        expect(r.inputRead.length, 'posts that would flip undefined→true if inputRead defaulted true').toBe(6);
        expect(r.atc.length, 'posts that would flip undefined→true if atc defaulted true').toBe(4);
    });

    test('the standing guard — closing this gap did not touch which posts are hardware-VERIFIED', async ({ page }) => {
        await boot(page);
        const verified = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            return m.listPosts().filter((p) => p.verified).map((p) => p.id).sort();
        });
        expect(verified).toEqual(['ddcs-expert-m350', 'ddcs-v41']);
    });
});

test.describe('S4 — the named absences', () => {
    test('V41_NAMED_ABSENCES exists with exactly the 3 declared unknowns, all 5 fields non-empty on each', () => {
        expect(Object.keys(V41_NAMED_ABSENCES).sort()).toEqual(['atcTables', 'hmiPrompt', 'readActiveWcs']);
        for (const [id, row] of Object.entries(V41_NAMED_ABSENCES)) {
            for (const field of ['what', 'todayBehaviour', 'whyAbsent', 'liftNeeds', 'blocked']) {
                expect(typeof row[field], `${id}.${field} is a string`).toBe('string');
                expect(row[field].length > 0, `${id}.${field} is non-empty`).toBe(true);
            }
            expect(row.blocked, `${id}.blocked names teachable or evidence-blocked`).toMatch(/teachable|evidence-blocked/);
        }
    });

    test('each row still matches the dialect\'s actual fold-to-[] behaviour — not stale', async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async () => {
            const m = await import('/wizards/dialects/index.js');
            const V = m.DIALECTS['ddcs-v41'];
            return { readActiveWcs: V.readActiveWcs(), hmiPrompt: V.hmiPrompt(), atcVar: V.vars.atc, atcCap: V.caps.atc };
        });
        expect(r.readActiveWcs).toEqual([]);
        expect(r.hmiPrompt).toEqual([]);
        expect(r.atcVar).toBeNull();
        expect(r.atcCap).toBe(false);
    });

    test('the hmiPrompt row\'s correction is grounded in the actual .rc file, not the filename', () => {
        const rcPath = join(corpusDir, 'assets', 'firmware', 'ddcs v4.1', 'ddcsv4(2025-04-04)', 'ddcsv4(2025-04-04)',
            'ddcsv4', 'probe-float.rc');
        const rc = readFileSync(rcPath, 'utf8');
        expect(rc, 'probe-float.rc is compiled GUI-Builder C source, not a runtime-authorable prompt payload')
            .toMatch(/GUI_Builder|emWin/);
        expect(V41_NAMED_ABSENCES.hmiPrompt.whyAbsent).toMatch(/GUI-Builder|emWin/);
    });
});

test.describe('S2 — the normalisation policy', () => {
    test('every declared normalisation is one normaliseGcode (the oracle) really applies, and none has an empty safeBecause', () => {
        for (const n of V41_ORACLE_NORMALISATIONS) {
            expect(n.safeBecause.length > 0, `${n.transform}.safeBecause is non-empty`).toBe(true);
            expect(['user-attested', 'factory-corpus', 'spec-attested', 'assumption']).toContain(n.evidenceTier);
        }
        const ids = V41_ORACLE_NORMALISATIONS.map((n) => n.transform);
        expect(ids.sort()).toEqual(['collapse-whitespace', 'drop-blank-and-comment-lines', 'strip-carriage-returns']);

        // behavioural proof each transform is REALLY performed by normaliseGcode, not merely declared
        expect(normaliseGcode('A\r\nB'), 'strip-carriage-returns').toBe('A\nB');
        expect(normaliseGcode('A\n\n( a comment )\n; another\nB'), 'drop-blank-and-comment-lines').toBe('A\nB');
        expect(normaliseGcode('G91 G31 Z-1000'), 'collapse-whitespace').toBe('G91G31Z-1000');
    });

    test('the oracle spec (v41-corpus-oracle-1532) imports the ONE normaliseGcode — no duplicated logic left behind', () => {
        for (const f of ['porting-arc-scout-1530.spec.js', 'v41-corpus-oracle-1532.spec.js']) {
            const src = readFileSync(join(testsDir, f), 'utf8');
            expect(src, `${f} imports the shared normaliseGcode`)
                .toMatch(/import\s*\{\s*normaliseGcode\s*\}\s*from\s*['"]\.\.\/web\/data\/portingArc\.js['"]/);
            expect(src, `${f} has no local re-implementation left behind`).not.toMatch(/replace\(\/\\s\+\/g,\s*''\)/);
        }
    });

    test('the two REFUSED normalisations are still unevidenced — a corpus change that introduces one must flip this', () => {
        const files = [];
        const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
            const p = join(d, e.name);
            if (e.isDirectory()) walk(p); else if (e.name.endsWith('.nc')) files.push(p);
        } };
        walk(join(corpusDir, 'assets', 'system-backup'));
        walk(join(corpusDir, 'assets', 'firmware'));
        const text = files.map((f) => { try { return readFileSync(f, 'utf8'); } catch (e) { return ''; } }).join('\n');
        expect(/[XYZFL#]-?0\d+/.test(text), 'still zero leading-zero numerics in the tracked V4.1 corpus').toBe(false);
    });
});
