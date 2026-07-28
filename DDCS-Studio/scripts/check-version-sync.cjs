/**
 * scripts/check-version-sync.cjs — THE VERSION STAMPS AGREE, or nothing ships (t1311).
 *
 * ── THE MISTAKE THIS EXISTS FOR ──────────────────────────────────────────────────────────────────────────────────
 * A hand-edited version.json once desynced from the `.ver` chip: the in-app update banner compared the two, decided
 * the running app was stale, and covered the header with a nag — while the exe CI cut from the chip wore a different
 * number again. The rule since has been "bump-version.cjs only", and a rule in memory is weaker than a guard in the
 * tree. This is the guard.
 *
 * ── WHAT IT CHECKS, and why these four ───────────────────────────────────────────────────────────────────────────
 * `scripts/bump-version.cjs` is the ONE writer, so the surfaces are exactly the ones it stamps:
 *   1. the `.ver` chip in web/index.html   — what desktop-release.yml cuts a release from, and what the update
 *                                            banner compares against; the source of truth by declaration
 *   2. the window <title>                  — the same version, where a user reads it
 *   3. web/version.json `v`                — the cache-bustable artifact the deployed app fetches to notice a stale
 *                                            cached bundle. Desync here is the one that produced the nag.
 *   4. package.json `version`              — DATE ONLY (Y.M.D, integers), because the daily counter lives in the
 *                                            chip. So this one is checked as a RELATIONSHIP, not as equality — the
 *                                            check has to know the difference or it would demand a wrong number.
 *
 * Usable two ways, so the one declaration serves every path: `node scripts/check-version-sync.cjs` (a pre-push or CI
 * step; exits 1 and names the stale surface) and `checkVersionSync(root)` from the fast-tier spec that runs on every
 * gate — because the mistake it guards against happens at RELEASE time, not at feature time.
 */
const fs = require('fs');
const path = require('path');

const ONE_WRITER = 'scripts/bump-version.cjs';

/** Read the four stamped surfaces from a tree root (defaults to the DDCS-Studio dir this script lives in). */
function readSurfaces(root) {
    const base = root || path.join(__dirname, '..');
    const htmlPath = path.join(base, 'web', 'index.html');
    const verPath = path.join(base, 'web', 'version.json');
    const pkgPath = path.join(base, 'package.json');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const chip = (html.match(/class="ver">V([0-9][0-9.]*)</) || [])[1] || null;
    const title = (html.match(/<title>DDCS Studio V([0-9][0-9.]*)<\/title>/) || [])[1] || null;
    let verJson = null;
    try { verJson = (JSON.parse(fs.readFileSync(verPath, 'utf8')) || {}).v || null; } catch (_) { verJson = null; }
    let pkg = null;
    try { pkg = (JSON.parse(fs.readFileSync(pkgPath, 'utf8')) || {}).version || null; } catch (_) { pkg = null; }
    return { chip, title, verJson, pkg, paths: { html: htmlPath, ver: verPath, pkg: pkgPath } };
}

/** package.json carries the DATE only, as integers — V2026.07.28.12 → 2026.7.28. */
function dateOnly(v) {
    const p = String(v || '').split('.');
    if (p.length < 3) return null;
    return [p[0], String(parseInt(p[1], 10)), String(parseInt(p[2], 10))].join('.');
}

/**
 * Do the stamps agree? The `.ver` chip is the declared source of truth, so every problem is phrased as "this surface
 * is stale against the chip" — which is the sentence that tells a person what to do about it.
 * @returns {{ok:boolean, v:string|null, problems:Array<{surface:string, found:string|null, expected:string|null, fix:string}>}}
 */
function checkVersionSync(root) {
    const s = readSurfaces(root);
    const problems = [];
    const fix = `re-run ${ONE_WRITER} — it is the only thing that should write these`;
    if (!s.chip) {
        problems.push({ surface: 'the .ver chip in web/index.html', found: null, expected: 'V<version>', fix });
        return { ok: false, v: null, problems, surfaces: s };
    }
    const v = s.chip;
    if (s.title !== v) problems.push({ surface: 'the window <title> in web/index.html', found: s.title, expected: v, fix });
    if (s.verJson !== v) problems.push({ surface: 'web/version.json (the update-check artifact)', found: s.verJson, expected: v, fix });
    const wantPkg = dateOnly(v);
    if (s.pkg !== wantPkg) problems.push({ surface: 'package.json version', found: s.pkg, expected: wantPkg, fix: `${fix} (this one is the DATE only — the daily counter lives in the chip)` });
    return { ok: problems.length === 0, v, problems, surfaces: s };
}

/** The message a human reads — it names the stale surface, both numbers, and the one writer. */
function describe(res) {
    if (res.ok) return `version stamps agree: V${res.v}`;
    return ['VERSION STAMPS DISAGREE — the .ver chip says V' + (res.v || '?') + ':']
        .concat(res.problems.map((p) => `  · ${p.surface} says ${p.found == null ? '(missing)' : p.found}, expected ${p.expected} — ${p.fix}`))
        .join('\n');
}

module.exports = { checkVersionSync, readSurfaces, describe, dateOnly, ONE_WRITER };

if (require.main === module) {
    const res = checkVersionSync(process.argv[2]);
    console[res.ok ? 'log' : 'error'](describe(res));
    process.exit(res.ok ? 0 : 1);
}
