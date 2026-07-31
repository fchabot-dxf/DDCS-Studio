import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * t1472 — HELICAL ARCS: THE CAPABILITY IS DECLARED, AND THE EVIDENCE IS MEASURED RATHER THAN ASSUMED.
 *
 * ── THE ACT THIS BELONGS TO, AND THE PREMISE IT CORRECTED ───────────────────────────────────────────────────────
 * The true-arc helix act opened on "the circle contour already emits G3 — the compact form is proven in-family".
 * Half of that is right and the half that matters is not:
 *
 *     PLANAR   G02/G03 with I/J          richly attested — 7353 lines in the captured CNCDISK job that ran on the
 *                                        user's own M350, plus the V4.1 factory slib-g's `G02 X0 I-#6` full circle
 *     HELICAL  the same arc carrying a Z  ZERO across every captured .nc in the repo, and the M350 reference
 *                                        documents no G02/G03 at all
 *
 * They are DIFFERENT CAPABILITIES, and the second one steers a cut: an arc whose Z is silently dropped cuts a
 * circle at one depth and hands the next block a full-depth plunge. This is the t1339 ATAN lesson pointed at
 * geometry instead of arithmetic — a neighbouring form working proves only itself.
 *
 * ── SO THESE LOCKS MEASURE THE CORPUS, NOT A SENTENCE ───────────────────────────────────────────────────────────
 * LOCK 1 re-counts the dumps on every run. The day a capture DOES contain a helical arc it goes red, and the
 * Expert's `helicalArc: false` has to be re-decided rather than quietly kept — the same self-red-ing shape as the
 * literal boundaries. LOCK 4 pins the one place Studio already emits this form, so a second one cannot appear
 * unnoticed while the capability is still unproven.
 */

const REPO = join('..');
// NO \b AFTER THE CODE. Posted G-code writes `G02X441.96Y48.961I-38.295` with no separators at all, and a word
// boundary needs a non-word character — so /\bG0?[23]\b/ silently matched 11 lines out of 7355 on the first run and
// would have "proved" the corpus had almost no arcs. A trailing digit-guard is what actually excludes G20/G28.
const ARC = /\bG0?[23](?![0-9])/;
const HAS_Z = /Z\s*-?[\d.#[]/;
const stripComments = (ln) => ln.replace(/\([^)]*\)/g, ' ').replace(/;.*$/, ' ');

/**
 * CAPTURED evidence only. `verify/` is excluded and the exclusion is the point: those macros are the questions WE
 * wrote to ask the machine, not answers it gave — V16_helical_arc.nc commands the very form this lock says nobody
 * has ever seen. Counting our own probe as corpus would let a test prove itself. (This lock found that on its first
 * real run, which is the best argument for keeping it.)
 */
function ncFiles(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (name === 'verify') continue;
        const p = join(dir, name);
        let s; try { s = statSync(p); } catch (_) { continue; }
        if (s.isDirectory()) ncFiles(p, out);
        else if (name.toLowerCase().endsWith('.nc')) out.push(p);
    }
    return out;
}

test('LOCK 1 — the captured corpus: planar arcs ARE attested, helical arcs are NOT (re-measured every run)', () => {
    const root = join(REPO, 'bridge', 'controllers');
    const files = ncFiles(root);
    expect(files.length, 'the capture corpus is present').toBeGreaterThan(20);
    let planar = 0; const helical = [];
    for (const f of files) {
        const txt = readFileSync(f, 'utf8');
        txt.split('\n').forEach((ln, i) => {
            const u = stripComments(ln.toUpperCase());
            const at = u.search(ARC);
            if (at < 0) return;
            if (HAS_Z.test(u.slice(at))) helical.push(`${f}:${i + 1}  ${ln.trim().slice(0, 90)}`);
            else planar++;
        });
    }
    // the POSITIVE half — without it "0 helical" could just mean "no arcs anywhere", which proves nothing
    expect(planar, 'planar arcs are richly attested, so the corpus really does contain arc evidence').toBeGreaterThan(1000);
    // ⚠ THE OBSTRUCTION. Goes RED the day a dump shows a helical arc — then the declaration must be re-decided.
    expect(helical, 'a captured macro now carries a HELICAL arc — re-decide caps.helicalArc against this evidence '
        + 'instead of leaving it false:\n' + helical.join('\n')).toEqual([]);
});

test('LOCK 2 — every dialect DECLARES helicalArc; none is silently absent', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const r = await page.evaluate(async () => {
        const mod = await import('/wizards/dialects/index.js');
        const all = mod.DIALECTS || mod.dialects || mod.default;
        const list = Array.isArray(all) ? all : Object.values(all || {});
        return list.filter((d) => d && d.id).map((d) => ({ id: d.id, caps: d.caps || {}, has: !!d.caps && Object.prototype.hasOwnProperty.call(d.caps, 'helicalArc'), v: d.caps && d.caps.helicalArc }));
    });
    expect(r.length, 'the registry loaded').toBeGreaterThan(4);
    const silent = r.filter((d) => !d.has).map((d) => d.id);
    // "declared, not assumed": a dialect that says nothing would be read as false by accident rather than on evidence.
    expect(silent, 'these dialects do not declare helicalArc — an undeclared capability is an assumed one').toEqual([]);
    for (const d of r) expect(typeof d.v, `${d.id} declares a boolean`).toBe('boolean');
});

test('LOCK 3 — the DDCS family declares FALSE, and the spec-defined targets declare true', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const r = await page.evaluate(async () => {
        const mod = await import('/wizards/dialects/index.js');
        const all = mod.DIALECTS || mod.dialects || mod.default;
        const list = Array.isArray(all) ? all : Object.values(all || {});
        return Object.fromEntries(list.filter((d) => d && d.id).map((d) => [d.id, !!(d.caps || {}).helicalArc]));
    });
    // the three DDCS targets: the ONLY machines anyone here can actually run, and the corpus says nothing for them
    for (const id of ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500']) {
        expect(r[id], `${id} must stay false until V16_helical_arc.nc answers on the machine`).toBe(false);
    }
    // the spec-defined ones: helical motion is IN the standard these implement — a different evidence class entirely
    for (const id of ['rs274ngc', 'grbl']) expect(r[id], `${id} declares helical support from its own spec`).toBe(true);
});

test('LOCK 4 — exactly ONE shipped site emits a helical arc, and it is inventoried', () => {
    const web = join('web');
    const files = [];
    (function walk(d) {
        for (const n of readdirSync(d)) {
            const p = join(d, n);
            const s = statSync(p);
            if (s.isDirectory()) { if (n !== 'vendor') walk(p); } else if (n.endsWith('.js')) files.push(p);
        }
    })(web);
    const sites = [];
    for (const f of files) {
        readFileSync(f, 'utf8').split('\n').forEach((ln, i) => {
            const t = ln.trim();
            if (t.startsWith('*') || t.startsWith('//')) return;      // prose about arcs is not an arc
            const m = /G0?[23]\s/.exec(ln);
            if (m && /[ }]Z[$\-\d#[{]/.test(ln.slice(m.index))) sites.push(`${f}:${i + 1}`);
        });
    }
    // ⚠ THE PRE-EXISTING EXPOSURE, NAMED. The circle contour's RAMP entry has been sending a helical G3 to real
    // machines since it shipped, on a capability nothing has confirmed. This test does not fix that — it stops a
    // SECOND one appearing while the question is open, and goes red the day the first one is dealt with either way.
    expect(sites.length, 'shipped helical-arc emit sites:\n' + sites.join('\n')).toBe(1);
    expect(sites[0].replace(/\\/g, '/'), 'and it is the circle-contour ramp entry').toContain('wizards/ops/contour.js');
});

test('LOCK 5 — the machine test exists and probes the Z, not just the arc', () => {
    const p = join(REPO, 'bridge', 'controllers', 'expert-m350', 'verify', 'V16_helical_arc.nc');
    expect(existsSync(p), 'V16_helical_arc.nc is written and ready for the visit').toBe(true);
    const txt = readFileSync(p, 'utf8');
    const code = txt.split('\n').filter((l) => !l.trim().startsWith('(')).join('\n');
    expect(code, 'it commands a helical arc — an arc word carrying a Z').toMatch(/G0?3[^\n]*Z-/);
    expect(code, 'and READS the work-Z register either side, because "did it move" is the whole question').toContain('#792');
    expect(code, 'it reports the DROP, so a silently-ignored Z reads as 0.000 rather than as nothing').toMatch(/#1505\s*=\s*-5000/);
});
