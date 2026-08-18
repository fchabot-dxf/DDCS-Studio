import { test, expect } from './support/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * dialect-emit-golden-2072 — THE PER-CONTROLLER EMIT GOLDEN (browser-free tier).
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────────────────────────────────────────
 * t2070 removed leading whitespace from every DDCS emit (the Expert M350 rejects an indented `N`-label as a hard
 * syntax error) and rewrote every inline `IF x<y THEN x=y` clamp into the `IF x>=y GOTO<n> … N<n>` form the Expert's
 * macro parser actually accepts. That fix ships to THREE dialects — expert, v4.1, v3-dm500 — but its only regression
 * proof ran under `DEFAULT_DIALECT` (expert): the pocket golden and the node emit sweep all emit under the default.
 * V4.1 and DM500 had the `flushIndent: true` FLAG set on their dialect and nothing that asserted their actual bytes.
 * That is the exact coverage shape that let t1866 ship ("three DDCS dialects ship and only one was ever exercised" —
 * gcode-dialect-emit-invariants-1870's own header). This file closes it for the two HARDWARE-VERIFIED posts the user
 * runs — expert-m350 and v4.1 — by locking their emitted bytes for the ops that actually exercise the fix.
 *
 * ── WHY THE NODE TIER ────────────────────────────────────────────────────────────────────────────────────────────
 * The whole assertion is about G-code TEXT: build a stack, `emitMapped(stack, { dialect })`, look at the string. No
 * DOM, no canvas. So it runs browser-free (support/register.mjs) in milliseconds instead of booting Chromium per
 * dialect — the same tier and reasoning as surfacing-as-data.test.mjs.
 *
 * ── THE OP SET (declared, not swept) ─────────────────────────────────────────────────────────────────────────────
 * Three ops, each chosen for what it proves — read from the emit itself (see the probe in WORK-LOG t2072), never
 * assumed:
 *   · user_surfacing_data — WHILE…DO loops AND an inline-clamp (`#45`), the canonical t2070 case. The exact program
 *     family the user saw the Expert reject at the bench.
 *   · user_pocket_data    — a second, independently-shaped looped body + clamp (ring clearing), so the flush/clamp
 *     contract is not proven on one op's quirks alone.
 *   · user_corner_data (probeZFirst) — a probe/WCS-write op whose emitted bytes GENUINELY DIFFER between the two
 *     dialects (Expert writes the active-WCS table indirectly via `#578`/`#[#73]`; v4.1 uses `G90 G92`). It is here
 *     so the golden is a TRUE per-controller artifact — a fixture that would notice if the two posts silently
 *     collapsed to the same output — not two identical blobs. NON-VACUITY below asserts that difference is real.
 *
 * ── THE TWO NAMED CONTRACTS (on top of the byte snapshot) ────────────────────────────────────────────────────────
 * A snapshot diff tells you a line moved; a named property tells you WHICH t2070 contract broke:
 *   FLUSH     — no emitted line carries leading whitespace, on EITHER dialect. This is the whole of t2070's first
 *               half (an indented label is the syntax error); asserting it per-line per-dialect makes "V4.1 went back
 *               to indented" a red gate, not a silent hardware surprise.
 *   NO-THEN   — no emitted line contains a `THEN` (the inline `IF…THEN <var>=` clamp the Expert rejects). The fix
 *               replaces every one with an `IF…GOTO<n>` skip, so a single surviving `THEN` is the clamp regressing.
 *   CLAMP→GOTO— positively, surfacing/pocket (which HAVE clamps) still emit an `IF…GOTO<n>` with a matching column-0
 *               `N<n>` label — so NO-THEN cannot pass by the clamp having vanished entirely.
 *
 * ── SNAPSHOT REGENERATION (deliberate, never accidental — same protocol as preview-spec-gate-1688) ───────────────
 *   compare (CI + default):   cd DDCS-Studio && npm run test:node
 *   regenerate:               UPDATE_DIALECT_GOLDEN=1 npm run test:node   (PowerShell: $env:UPDATE_DIALECT_GOLDEN=1)
 * Regeneration REWRITES the fixture AND FAILS the run, so the flag can never be left on in CI and the author is
 * forced to read `git diff tests/node/__snapshots__/` before the suite can go green again.
 *
 * ── STABILITY ────────────────────────────────────────────────────────────────────────────────────────────────────
 * Emit is a pure function of (stack, dialect) here — default params, a fixed dialect object, no localStorage, no
 * active-post override (getActivePostId() reads the empty node store → 'auto', so `getDialect(id)` is exactly the id
 * asked for). Nothing on this path uses Date/Math.random/locale (the same grep that clears the other node goldens).
 * CRLF: the compare splits on /\r?\n/ so a fixture checked out CRLF on Windows / LF on CI matches the always-LF fresh
 * render — a comparison of CONTENT, not line endings.
 */

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const SNAP = path.join(ROOT, 'tests', 'node', '__snapshots__', 'dialect-emit-golden-2072.txt');

// The two hardware-verified posts (dialects/index.js POST_VERIFIED). The dump-derived posts stay out until proven on
// metal — a golden of an unverified post's bytes would be a golden of a guess.
const DIALECTS = ['ddcs-expert-m350', 'ddcs-v41'];

// opType → the param overrides that route to the branch carrying the thing this op is here to prove (corner's WCS
// write is gated behind probeZFirst, exactly as gcode-dialect-emit-invariants-1870 routes it). Read from the wizard,
// not guessed.
const OPS = [
    { opType: 'user_surfacing_data', overrides: {}, hasClamp: true },
    { opType: 'user_pocket_data', overrides: {}, hasClamp: true },
    { opType: 'user_corner_data', overrides: { probeZFirst: true }, hasClamp: false },
];

/** node:test drops playwright's `expect(value, message)` 2nd arg; prepend it so a red gate prints the contract. */
function must(message, fn) {
    try { fn(); } catch (err) { err.message = `\n  GATE: ${message}\n\n${err.message}`; throw err; }
}

// ── BOOT (memoized: one registration pass per process) ───────────────────────────────────────────────────────────
let _booted = null;
function boot() { return (_booted = _booted || _boot()); }
async function _boot() {
    await import('/ui/settingsPanel.js');   // publishes window.ddcsGetSettings, exactly as the browser boot does
    const U = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { getDialect } = await import('/wizards/dialects/index.js');

    // Register every data twin ONCE (a second registerUserOp throws for several — guarded, same as the preview gate).
    const dir = path.join(ROOT, 'web', 'blocks', 'dataOps');
    for (const f of fs.readdirSync(dir).filter((n) => /Data\.js$/.test(n)).sort()) {
        const mod = await import('/blocks/dataOps/' + f);
        for (const key of Object.keys(mod).filter((k) => /DataDef$/.test(k))) {
            try { U.registerUserOp(mod[key]()); } catch { /* already registered this process */ }
        }
    }
    return { U, builderOf, emitMapped, getDialect };
}

/** The emitted G-code for one (op, dialect), through the app's own emit path. */
async function emitFor(env, op, dialectId) {
    const def = env.U.getUserDef(op.opType);
    if (!def) return { found: false, text: '' };
    const params = { ...env.U.defaultParams(def), ...op.overrides };
    const stack = env.builderOf(op.opType)(params);
    const text = env.emitMapped(stack, { dialect: env.getDialect(dialectId) }).text;
    return { found: true, text };
}

/** Every (dialect × op) emit, in a fixed order — the shared read behind every test below. */
async function allEmits(env) {
    const rows = [];
    for (const dialectId of DIALECTS) {
        for (const op of OPS) {
            const { found, text } = await emitFor(env, op, dialectId);
            rows.push({ dialectId, op, found, text });
        }
    }
    return rows;
}

// A comment is `( … )` or a trailing `;…`; strip both so a contract check reads the CODE, never a word that merely
// appears inside an annotation.
const codeOf = (line) => line.replace(/\(.*?\)/g, '').replace(/;.*$/, '');

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE BYTE GOLDEN — the drift net
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test('per-controller emit golden: every (dialect × op) matches the checked-in bytes', async () => {
    const env = await boot();
    const rows = await allEmits(env);

    const lines = [];
    lines.push(`# dialect-emit golden 2072 — ${DIALECTS.length} verified posts × ${OPS.length} ops`);
    lines.push('# emit path: emitMapped(builderOf(op)(defaultParams+overrides), { dialect: getDialect(id) })');
    lines.push('# contracts pinned per line elsewhere in this file: FLUSH (no leading ws), NO-THEN (no inline clamp), CLAMP→GOTO');
    lines.push('#');
    for (const r of rows) {
        must(`${r.op.opType} did not resolve to a real builder`, () => expect(r.found).toBe(true));
        lines.push(`\n===== ${r.op.opType} @ ${r.dialectId} =====`);
        lines.push(r.text.replace(/\s+$/, ''));
    }
    const OUT = lines.join('\n') + '\n';

    if (process.env.UPDATE_DIALECT_GOLDEN) {
        fs.mkdirSync(path.dirname(SNAP), { recursive: true });
        fs.writeFileSync(SNAP, OUT);
        throw new Error(`dialect golden REGENERATED at ${path.relative(ROOT, SNAP)} — read \`git diff\` on it, then re-run WITHOUT UPDATE_DIALECT_GOLDEN`);
    }
    must(`missing golden fixture ${path.relative(ROOT, SNAP)} — create it with UPDATE_DIALECT_GOLDEN=1 npm run test:node`,
        () => expect(fs.existsSync(SNAP)).toBe(true));
    const lineSplit = (s) => s.split(/\r?\n/);
    must('a DDCS post\'s emitted bytes CHANGED. Read the diff: is it a deliberate emit change (regenerate with UPDATE_DIALECT_GOLDEN=1 and review the fixture diff), or did one dialect drift from the other / from the flush+clamp form t2070 fixed?',
        () => expect(lineSplit(OUT)).toEqual(lineSplit(fs.readFileSync(SNAP, 'utf8'))));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONTRACT: FLUSH — no leading whitespace on any emitted line, on EITHER dialect (t2070 first half)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test('FLUSH — no emitted line carries leading whitespace on any verified DDCS post', async () => {
    const env = await boot();
    const rows = await allEmits(env);
    const indented = [];
    for (const r of rows) {
        r.text.split('\n').forEach((ln, i) => {
            if (ln.length && /^[ \t]/.test(ln)) indented.push(`${r.op.opType}@${r.dialectId} line ${i + 1}: ${JSON.stringify(ln)}`);
        });
    }
    must('an emitted line starts with whitespace — the DDCS Expert rejects an indented N-label as a hard syntax error (t2070). dialect.flushIndent or applyIndentStyle stopped stripping it for this post.',
        () => expect(indented).toEqual([]));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONTRACT: NO-THEN + CLAMP→GOTO — the inline clamp is gone, and where a clamp exists it survives as IF…GOTO (t2070)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test('CLAMP — no inline IF…THEN survives, and every clamped op still emits an IF…GOTO skip', async () => {
    const env = await boot();
    const rows = await allEmits(env);

    const withThen = [];
    const missingGoto = [];
    for (const r of rows) {
        const codeLines = r.text.split('\n').map(codeOf);
        codeLines.forEach((ln, i) => { if (/\bTHEN\b/.test(ln)) withThen.push(`${r.op.opType}@${r.dialectId} line ${i + 1}`); });
        if (r.op.hasClamp) {
            const hasGoto = codeLines.some((ln) => /\bIF\b.*\bGOTO\s*\d+/.test(ln));
            const label = r.text.match(/\bGOTO\s*(\d+)/);
            const hasLabel = label && new RegExp(`^N${label[1]}\\b`, 'm').test(r.text);   // the target label sits at column 0
            if (!hasGoto || !hasLabel) missingGoto.push(`${r.op.opType}@${r.dialectId} (hasGoto=${hasGoto}, hasLabel=${!!hasLabel})`);
        }
    }
    must('an emitted line still uses the inline `IF … THEN <var>=…` clamp form — the DDCS Expert rejects it; t2070 rewrote every one into an IF…GOTO skip. This is the clamp regressing.',
        () => expect(withThen).toEqual([]));
    must('a clamped op (surfacing/pocket) no longer emits an IF…GOTO<n> with a matching column-0 N<n> label — so NO-THEN would be passing only because the clamp vanished entirely, not because it was rewritten.',
        () => expect(missingGoto).toEqual([]));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// NON-VACUITY — the golden actually DISTINGUISHES the two controllers (else it's two identical blobs)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test('NON-VACUITY — at least one op emits genuinely different bytes on Expert vs V4.1', async () => {
    const env = await boot();
    const differ = [];
    for (const op of OPS) {
        const ex = (await emitFor(env, op, 'ddcs-expert-m350')).text;
        const v4 = (await emitFor(env, op, 'ddcs-v41')).text;
        if (ex && v4 && ex !== v4) differ.push(op.opType);
    }
    must('NO op differs between Expert and V4.1 — the two posts have collapsed to identical output, so this golden can no longer catch a per-controller divergence. corner\'s WCS write (Expert #578-indirect vs v4.1 G90 G92) is supposed to differ.',
        () => expect(differ.length > 0).toBe(true));
});
