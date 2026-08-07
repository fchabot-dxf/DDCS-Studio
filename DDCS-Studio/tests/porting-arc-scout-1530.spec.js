import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normaliseGcode } from '../web/data/portingArc.js';

/**
 * t1530 — THE V4.1 PORTING ARC, SCOUTED. No product behaviour changes here; what lands is the DESIGN
 * (data/portingArc.js) plus the assertions that keep it from rotting between being written and being built —
 * the `slot-capability-arc-1478` / `slot-cam-pack-scout-1508` precedent.
 *
 * The act was dispatched as four questions. The scout found that the FIRST premise is inverted — V4.1 is already
 * ported and hardware-verified, and what is missing is the verify INSTRUMENT — so every claim that reframing rests
 * on is asserted here against the real registry and the real factory corpus, before any emit is touched.
 */

const here = fileURLToPath(new URL('.', import.meta.url));
const corpus = join(here, '..', '..', 'bridge', 'controllers', 'v4.1', 'assets', 'system-backup', 'current');
const testsDir = here;

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** t1534 — the ONE normalisation policy (data/portingArc.js's V41_ORACLE_NORMALISATION), not a local copy. */
const norm = normaliseGcode;

/**
 * ── PREMISE 1 — V4.1 IS ALREADY A REGISTERED, HARDWARE-VERIFIED POST ──────────────────────────────────────────────
 * The whole reframing rests on this. Asserted against the registry rather than restated, so if V4.1 were ever
 * demoted out of POST_VERIFIED the arc's premise fails loudly instead of quietly.
 */
test('PREMISE 1 — ddcs-v41 is registered and is one of exactly two hardware-VERIFIED posts', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/dialects/index.js');
        return { ids: Object.keys(m.DIALECTS), verified: m.listPosts().filter((p) => p.verified).map((p) => p.id) };
    });
    expect(r.ids, 'the registry still carries the V4.1 dialect').toContain('ddcs-v41');
    expect(r.ids.length, 'seven posts are registered').toBe(7);
    expect(r.verified.sort(), 'exactly Expert + V4.1 are hardware-verified — the arc targets an ALREADY-verified post')
        .toEqual(['ddcs-expert-m350', 'ddcs-v41']);
});

/**
 * ── PREMISE 2 — THE DIALECT DELTA IS ALREADY DECLARED AS DATA, AND postGating READS IT ────────────────────────────
 * The dispatch asked for the Expert->V4.1 delta "as a caps/post table the existing postGating reads, not prose".
 * It already is one. These are the rows the arc's stage list is costed against.
 */
test('PREMISE 2 — the caps delta is declared, and the rows the arc depends on still read as measured', async ({ page }) => {
    await boot(page);
    const c = await page.evaluate(async () => {
        const m = await import('/wizards/dialects/index.js');
        return { e: m.getCaps('ddcs-expert-m350'), v: m.getCaps('ddcs-v41') };
    });
    // the six capability DIFFs that shape which wizards/fields V4.1 can offer at all
    for (const k of ['probeStatusCheck', 'hmi', 'probePort', 'wcsAuto', 'wcsFixed', 'wcsSync']) {
        expect(c.e[k], `Expert declares ${k} ON`).toBe(true);
        expect(c.v[k], `V4.1 declares ${k} OFF — the delta the pilot's postGating half proves`).toBe(false);
    }
    // ...and the shared floor, which is WHY the port was tractable: same var model, same flow model
    expect(c.v.vars, 'V4.1 has in-program #variables, like Expert').toBe(true);
    expect(c.v.flow, 'V4.1 has IF/GOTO flow, like Expert').toBe('goto');
});

/**
 * ── PREMISE 3 — THE CAPS TABLE INCOMPLETENESS, RESTATED NOW THAT S3 HAS CLOSED IT (t1534) ────────────────────────
 * This originally asserted the LATENT gap (three caps returning `undefined`). S3 closed it — DEFAULT_CAPS now
 * declares all 13 keys — so this test went red exactly as designed (trig-lift-plan-1466 LOCK 2 precedent) and is
 * restated to assert the CLOSED state. The fuller before/after behaviour-neutrality proof lives in
 * tests/v41-caps-completeness-1534.spec.js; this premise stays as the scout's own record that the gap is shut.
 */
test('PREMISE 3 — S3 closed the caps-completeness gap: all 13 keys resolve to a boolean/string, never undefined', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/dialects/index.js');
        const ids = Object.keys(m.DIALECTS);
        const val = (c) => ids.map((id) => m.getCaps(id)[c]);
        return { inputRead: val('inputRead'), atc: val('atc'), helicalArc: val('helicalArc') };
    });
    // Expert still opts IN explicitly; every other post now reads an EXPLICIT false, not undefined
    expect(r.inputRead.filter((v) => v === true).length, 'exactly Expert declares inputRead true').toBe(1);
    expect(r.inputRead.filter((v) => v === false).length, 'the other six now read an explicit false').toBe(6);
    expect(r.inputRead.some((v) => v === undefined), 'no post reads undefined for inputRead anymore').toBe(false);
    // atc: expert=true, v41/v3-dm500 were ALREADY explicitly false, +4 previously-undeclared now also false = 6
    expect(r.atc.filter((v) => v === true).length, 'exactly Expert declares atc true').toBe(1);
    expect(r.atc.filter((v) => v === false).length, 'the other six now read an explicit false (2 already, 4 newly)').toBe(6);
    expect(r.atc.some((v) => v === undefined), 'no post reads undefined for atc anymore').toBe(false);
    expect(r.helicalArc.some((v) => v === undefined), 'helicalArc likewise — never undefined').toBe(false);
});

/**
 * ── PREMISE 4 — THE OPTIONAL-KEY PROTOCOL IS REAL, SO THE 8 MISSING KEYS ARE NOT A GAP ────────────────────────────
 * The scout's first hypothesis was that the 8 Expert keys V4.1 does not declare would crash or silently skip.
 * MEASUREMENT REFUTED IT — every call site guards with a typeof check and folds to []. Pinned so the arc does not
 * carry a phantom stage, and so the protocol cannot be broken without a red.
 */
test('PREMISE 4 — V4.1 omits 8 optional dialect keys, and the forms that need them fold to nothing', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/dialects/index.js');
        const E = m.DIALECTS['ddcs-expert-m350'], V = m.DIALECTS['ddcs-v41'];
        const missing = Object.keys(E).filter((k) => !(k in V));
        const folds = ['probeStatus', 'readActiveWcs', 'hmiPrompt', 'hmiToast', 'hmiInput']
            .map((k) => [k, Array.isArray(V[k]()) && V[k]().length === 0]);
        return { missing: missing.sort(), folds };
    });
    expect(r.missing, 'the declared optional-key set V4.1 legitimately lacks').toEqual(
        ['beep', 'hmiCancelVar', 'hmiLine', 'hmiStatus', 'probeGuard', 'waitInput', 'wcsBaseInto', 'wcsWriteIndirect']);
    for (const [k, folded] of r.folds) expect(folded, `${k} folds to [] on V4.1 — an honest absence, not a crash`).toBe(true);
});

/**
 * ── PREMISE 5 — THE PILOT BRIDGE, RUN AGAINST THE TRACKED FACTORY MACROS ──────────────────────────────────────────
 * ⭐ This is S1 in miniature and the reason WCS-zero is nominated: the oracle is string equality against files the
 * controller itself shipped. Asserted now so the pilot's premise cannot rot before the build act reaches it.
 */
test('PREMISE 5 — Studio\'s V4.1 WCS-zero reproduces the factory zeroxy.nc and zeroz.nc byte-for-byte', async ({ page }) => {
    await boot(page);
    const emit = await page.evaluate(async () => {
        const m = await import('/wizards/dialects/index.js');
        const V = m.DIALECTS['ddcs-v41'];
        return {
            xy: V.wcsZeroAtCurrent({ axisX: true, axisY: true }).join('\n'),
            z: V.wcsZeroAtCurrent({ axisZ: true }).join('\n'),
            all: V.wcsZeroAtCurrent({ axisX: true, axisY: true, axisZ: true }).join('\n'),
        };
    });
    expect(norm(emit.xy), 'zeroxy.nc — the factory macro, reproduced exactly')
        .toBe(norm(readFileSync(join(corpus, 'zeroxy.nc'), 'utf8')));
    expect(norm(emit.z), 'zeroz.nc — likewise')
        .toBe(norm(readFileSync(join(corpus, 'zeroz.nc'), 'utf8')));

    // ...and the 4th-axis row is a declared SCOPE difference, not a defect. Asserted in BOTH directions so it cannot
    // be quietly "fixed" into a mismatch, nor quietly grow into an A-axis emit without this test noticing.
    const factoryAll = norm(readFileSync(join(corpus, 'zeroall.nc'), 'utf8'));
    expect(factoryAll.split('\n'), 'the factory zeroes FOUR registers, X/Y/Z/A').toEqual(['#1506=0', '#1507=0', '#1508=0', '#1509=0']);
    expect(norm(emit.all).split('\n'), 'Studio zeroes THREE — its WCS op has no 4th-axis concept').toEqual(['#1506=0', '#1507=0', '#1508=0']);
});

/**
 * ── PREMISE 6 — THE INSTRUMENT GAP, RESTATED NOW THAT S1 HAS LANDED (the trig-lift-plan LOCK 2 precedent) ──────────
 * This lock WENT RED the moment t1532's S1 build landed — exactly as designed. It originally asserted the
 * PRE-S1 state (zero factory-macro oracles, anywhere); restating it in the SAME act that closes the gap is what
 * stops S1 from being declared done while the assertion describing "done" still describes "not done".
 */
test('PREMISE 6 — the settings corpus AND the factory macro corpus are both wired as oracles (S1 landed, t1532)', async () => {
    const specs = readdirSync(testsDir).filter((f) => f.endsWith('.spec.js') && f !== 'porting-arc-scout-1530.spec.js');
    const readsCorpus = [];
    for (const f of specs) {
        const src = readFileSync(join(testsDir, f), 'utf8');
        // strip comments so a mere textual CITATION of the corpus is not mistaken for a runtime read
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
        if (/bridge['"\s,)]|bridge\//.test(code) && /readFileSync|readdirSync/.test(code)) readsCorpus.push(f);
    }
    // the settings door IS an oracle — the existence proof S1's mechanism followed
    expect(readsCorpus, 'the controller-import spec reads the settings corpus at runtime')
        .toContain('controller-import-one-door-1221.spec.js');

    // the factory MACRO corpus is now ALSO an oracle — v41-corpus-oracle-1532 diffs Studio's V4.1 emit against the
    // tracked .nc files directly (excluding ANY verify/ directory — expert-m350/verify/ and, since t1538,
    // v4.1/verify/ — Studio's OWN diagnostic/bench-kit macros, a different corpus from factory-shipped ones).
    // v41-caps-completeness-1534 (S2) reads the same corpus too, to keep the two REFUSED normalisations honest — a
    // second, narrower reader, not a duplicate oracle. dm500-corpus-oracle-1536 (t1536) is a THIRD, the same S1
    // mechanism run against the (much thinner) DM500 corpus. v41-bench-kit-nomotion-1538 (t1538) ALSO reads .nc
    // files and mentions 'verify', but only its OWN kit's .nc files under v4.1/verify/ — excluded for the same
    // reason expert-m350/verify/ always was, not counted as a fourth factory-macro oracle
    const readsFactoryMacro = readsCorpus.filter((f) => {
        const src = readFileSync(join(testsDir, f), 'utf8');
        return /['"][^'"]*\.nc['"]/.test(src) && !/['",\s/\\]verify['",\s/\\]/.test(src);
    });
    expect(readsFactoryMacro.sort(), 'the three specs that now use a factory corpus as an oracle')
        .toEqual(['dm500-corpus-oracle-1536.spec.js', 'v41-caps-completeness-1534.spec.js', 'v41-corpus-oracle-1532.spec.js']);
});

/**
 * ── PREMISE 7 — Q1'S DISPOSITION: THE BRANCH IS SUPERSEDED, ASSERTED AGAINST ITS OWN MAP ──────────────────────────
 * The branch's WIZARD-PORTING-MAP.md lists 11 wizards as "not ported". The claim that main superseded the branch is
 * asserted against that POPULATION rather than against a sample of it — the t1528 lesson, applied.
 */
test('PREMISE 7 — every wizard the stale branch lists as "not ported" now has a data twin on main', async ({ page }) => {
    await boot(page);
    const present = await page.evaluate(async () => {
        const names = ['pocket', 'contour', 'edge', 'middle', 'alignment', 'rotaryClock', 'rotaryCenter',
            'atcLength', 'atcCheck', 'atcChange', 'atcTest'];
        const out = {};
        for (const n of names) {
            try { const m = await import(`/blocks/dataOps/${n}Data.js`); out[n] = !!m && Object.keys(m).length > 0; }
            catch (e) { out[n] = false; }
        }
        return out;
    });
    for (const [n, ok] of Object.entries(present)) {
        expect(ok, `${n} — listed "not ported" on wizard-porting-work@76348158, ported on main`).toBe(true);
    }
});

/**
 * ── PREMISE 8 (t1529 AMENDMENT) — THE PARAMETRIC-FLOOR CLAIMS PER OTHER TARGET ────────────────────────────────────
 * The amendment's whole point is that the ARC ORDER should be rulable on evidence, not assumption. Pinned so the
 * "DM500 reads as likely-parametric but thinner-evidenced than V4.1" claim cannot quietly drift into either a
 * stronger or weaker claim than what was actually measured.
 */
test('PREMISE 8 — grbl-class caps confirm the standing UNROLL classification (not re-derived, verified)', async ({ page }) => {
    await boot(page);
    const c = await page.evaluate(async () => {
        const m = await import('/wizards/dialects/index.js');
        return { grbl: m.getCaps('grbl'), grblhal: m.getCaps('grblhal'), rs274ngc: m.getCaps('rs274ngc'), centroid: m.getCaps('centroid') };
    });
    expect(c.grbl.vars, 'plain grbl has no in-program #variables — definitional, not measured').toBe(false);
    expect(c.grbl.flow, 'and no flow construct at all').toBe('none');
    expect(c.grblhal.flow, 'grblHAL has O-word flow...').toBe('oword');
    expect(c.grblhal.flowStreamable, '...but NOT while streaming — SD/littlefs only, a real ceiling below Expert/V4.1').toBe(false);
    expect(c.rs274ngc.vars, 'rs274ngc has vars').toBe(true);
    expect(c.centroid.flow, 'centroid uses goto flow like the DDCS family').toBe('goto');
});

test('PREMISE 8 — DM500\'s trig floor is the SAME SHAPE as V4.1\'s (COS/SIN attested, SQRT/ATAN not) but a thinner corpus', () => {
    const v41Dir = join(here, '..', '..', 'bridge', 'controllers', 'v4.1');
    const dm500Dir = join(here, '..', '..', 'bridge', 'controllers', 'dm500');
    const countFactoryTracked = (dir) => {
        // mirrors `git ls-files` scope closely enough for this assertion: everything under the dir, no .git internals
        const out = [];
        const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
            const p = join(d, e.name);
            if (e.isDirectory()) walk(p); else out.push(p);
        } };
        walk(dir);
        return out;
    };
    const v41Files = countFactoryTracked(v41Dir);
    const dm500Files = countFactoryTracked(dm500Dir);
    // DM500's on-disk footprint is far thinner than V4.1's — the corpus-strength half of the claim
    expect(dm500Files.length, 'DM500 has far fewer tracked files than V4.1').toBeLessThan(Math.floor(v41Files.length / 5));

    const usesFn = (files, fn) => files.filter((f) => {
        try { return new RegExp(`\\b${fn}\\b`).test(readFileSync(f, 'utf8')); } catch (e) { return false; }
    }).length;
    // exclude community/NOTES commentary (mentions SQRT/ATAN as absent, not usage) AND verify/ (t1538 — Studio's
    // OWN bench-kit probe macros, which literally probe SQRT/ATAN by name; not factory-shipped, same exclusion
    // class as expert-m350/verify/ elsewhere in this file)
    // t1573 — FINDINGS.md joins the same exclusion class. The claim under test is about what the VENDOR'S
    // factory-shipped files use; `community`, `NOTES` and `verify/` were already excluded because they are
    // OUR commentary and OUR probe macros ABOUT the controller. FINDINGS.md is the same thing — the research
    // log — and it now names ATAN because the 2026-08-07 bench run CONFIRMED `ATAN[a, b]` works and returns
    // degrees. Recording that hardware answer must not be able to falsify a claim about the factory corpus.
    const factoryOnly = (files) => files.filter((f) => !/community|NOTES|FINDINGS|[\\/]verify(-motion)?[\\/]/i.test(f));
    const v41Factory = factoryOnly(v41Files), dm500Factory = factoryOnly(dm500Files);

    for (const [label, files] of [['V4.1', v41Factory], ['DM500', dm500Factory]]) {
        expect(usesFn(files, 'COS'), `${label} factory corpus attests COS`).toBeGreaterThan(0);
        expect(usesFn(files, 'SIN'), `${label} factory corpus attests SIN`).toBeGreaterThan(0);
        expect(usesFn(files, 'SQRT'), `${label} factory corpus does NOT attest SQRT — community-referenced only`).toBe(0);
        expect(usesFn(files, 'ATAN'), `${label} factory corpus does NOT attest ATAN — community-referenced only`).toBe(0);
    }
});
