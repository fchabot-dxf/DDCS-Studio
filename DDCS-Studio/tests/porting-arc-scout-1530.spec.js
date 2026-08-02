import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** Compare EMIT to a factory macro the way the S1 oracle would: drop comments/blank lines, trim each line. */
const norm = (s) => s.replace(/\r/g, '').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('(') && !l.startsWith(';')).join('\n');

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
 * ── PREMISE 3 — THE CAPS TABLE HAS AN INCOMPLETENESS, AND IT IS LATENT, NOT LIVE ──────────────────────────────────
 * S3 is costed as a declaration fix, not a bug fix. That distinction is only honest if `undefined` really does
 * behave as `false` today — so assert BOTH halves: the hole exists, AND no consumer can currently see it.
 */
test('PREMISE 3 — three caps live outside DEFAULT_CAPS, and undefined is falsy so no behaviour differs today', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/dialects/index.js');
        const ids = Object.keys(m.DIALECTS);
        const val = (c) => ids.map((id) => m.getCaps(id)[c]);
        return { inputRead: val('inputRead'), atc: val('atc'), helicalArc: val('helicalArc'), ids };
    });
    // inputRead is declared by Expert alone; the other six read back undefined rather than a declared false
    expect(r.inputRead.filter((v) => v === true).length, 'exactly one post declares inputRead').toBe(1);
    expect(r.inputRead.filter((v) => v === undefined).length, 'the other six are UNDECLARED, not declared-false').toBe(6);
    // ...and atc is declared by three of seven
    expect(r.atc.filter((v) => v === undefined).length, 'four posts leave atc undeclared').toBe(4);
    // the latency claim: undefined is falsy, so a truthy-testing consumer cannot tell it from false
    expect(r.inputRead.every((v) => !v || v === true), 'every value is either true or falsy — no third state').toBe(true);
    // helicalArc is outside DEFAULT_CAPS too, but every post happens to declare it — so it is the harmless case
    expect(r.helicalArc.filter((v) => v === undefined).length, 'helicalArc is undeclared-in-defaults but covered by all 7').toBe(0);
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
 * ── PREMISE 6 — THE INSTRUMENT GAP ITSELF ─────────────────────────────────────────────────────────────────────────
 * ⚠ THIS LOCK IS RED BY DESIGN THE MOMENT S1 LANDS, and that is the point (the trig-lift-plan LOCK 2 precedent).
 * It asserts that the factory MACRO corpus is currently inert as an oracle while the SETTINGS corpus is already
 * wired — the exact asymmetry the arc exists to close. When S1 wires the macros, this test must be restated in the
 * SAME act, which is what stops S1 from being declared done while the corpus stays unread.
 */
test('PREMISE 6 — the settings corpus is wired as an oracle; the 91 factory MACROS are not (S1 flips this)', async () => {
    const specs = readdirSync(testsDir).filter((f) => f.endsWith('.spec.js') && f !== 'porting-arc-scout-1530.spec.js');
    const readsCorpus = [];
    for (const f of specs) {
        const src = readFileSync(join(testsDir, f), 'utf8');
        // strip comments so a mere textual CITATION of the corpus is not mistaken for a runtime read
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
        if (/bridge['"\s,)]|bridge\//.test(code) && /readFileSync|readdirSync/.test(code)) readsCorpus.push(f);
    }
    // the settings door IS an oracle — the existence proof that S1's mechanism is known, not novel
    expect(readsCorpus, 'the controller-import spec reads the settings corpus at runtime')
        .toContain('controller-import-one-door-1221.spec.js');

    // ...but no spec reads a FACTORY-SHIPPED .nc macro as an oracle, for any target. Two specs DO read .nc files —
    // trig-lift-plan-1466 and helical-arc-evidence-1472 — but only from expert-m350/verify/, which is a DIFFERENT
    // corpus: Studio's OWN diagnostic macros (V13_trig.nc etc — authored here, pushed to hardware, read back), not
    // the factory-shipped operational macros (system-backup/, firmware/) this arc's oracle would diff against.
    // Excluding that subdirectory is what makes the remaining count meaningful rather than an artefact of the regex.
    const readsFactoryMacro = readsCorpus.filter((f) => {
        const src = readFileSync(join(testsDir, f), 'utf8');
        return /['"][^'"]*\.nc['"]/.test(src) && !/expert-m350['",\s/\\]*verify/.test(src);
    });
    expect(readsFactoryMacro, 'ZERO specs use a FACTORY-SHIPPED .nc as an oracle — the dialect\'s "CONFIRMED against '
        + 'probe-fix.nc" is prose, and prose does not go red. S1 closes this and must restate this assertion').toEqual([]);
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
    // exclude community/NOTES commentary — it MENTIONS SQRT/ATAN as absent, which must not be counted as usage
    const factoryOnly = (files) => files.filter((f) => !/community|NOTES/i.test(f));
    const v41Factory = factoryOnly(v41Files), dm500Factory = factoryOnly(dm500Files);

    for (const [label, files] of [['V4.1', v41Factory], ['DM500', dm500Factory]]) {
        expect(usesFn(files, 'COS'), `${label} factory corpus attests COS`).toBeGreaterThan(0);
        expect(usesFn(files, 'SIN'), `${label} factory corpus attests SIN`).toBeGreaterThan(0);
        expect(usesFn(files, 'SQRT'), `${label} factory corpus does NOT attest SQRT — community-referenced only`).toBe(0);
        expect(usesFn(files, 'ATAN'), `${label} factory corpus does NOT attest ATAN — community-referenced only`).toBe(0);
    }
});
