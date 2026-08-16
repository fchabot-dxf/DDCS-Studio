import { test, expect } from './support/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * op-lookup-scan-1968 — THE RATCHET against the flattenOps/findOpById bypass class (t1928/t1954/t1958/t1966).
 *
 * ── THE CLASS ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * A function asks "which blocks in the program are real operations" or "find the op with this id" by walking a
 * program-stack-sourced array (`getStack()`/`window.ddcsGetBlockProgram()`) with a SHALLOW, top-level-only test
 * (`.type === 'op'`, `.type !== 'op'`, or a bare `.id === …` with no recursion into `.children`) — silently
 * missing/mishandling any op nested inside a `multi_step` import wrapper. `flattenOps`/`findOpById`
 * (`web/blocks/programModel.js`) are the ONE declared recursive answer; three prior manual sweeps (t1928, t1955,
 * t1960) found 11 sites this way — a FOURTH, mechanically-framed sweep (t1966) found 6 more the first three
 * missed. That is the whole argument for this file over a fifth sweep: manual framing has a real, nonzero miss
 * rate; a tuned mechanical scan does not, for the exact shape it checks (see the false-positive-rate note below
 * for what it still can't see).
 *
 * ── THE RATCHET (the advisor's own ruling, t1968) ────────────────────────────────────────────────────────────────
 * Not an allow-list (that would hide real bugs behind green) and not a permanent red (that blinds the release
 * gate — a red that's always red stops being informative). Instead: an explicit INVENTORY of the sites known
 * open TODAY. The scan's own findings and the inventory must match EXACTLY, in both directions —
 *   - the scan finds something NOT in the inventory  → FAIL (a new site landed, or someone deleted an inventory
 *     entry without fixing the code — indistinguishable to the scan, and both must be caught).
 *   - the inventory names something the scan does NOT find → FAIL (a stale entry: either genuinely fixed, in
 *     which case remove it, or the scan itself broke — either way this must not go unnoticed).
 * The inventory may only ever SHRINK (an entry removed because its site was actually fixed, proven by its own
 * non-vacuous test elsewhere). It is the DEBT LIST, not a hiding place: each entry states what a user-visible
 * symptom would be, so a future reader can pick one off without re-deriving it.
 *
 * ── KEYED BY {file, function name}, NOT LINE — deliberately ─────────────────────────────────────────────────────
 * `ARCHITECTURE.md`'s own citations drift on every edit above their cited line (t1952's own design turn measured
 * this at 10 repetitions). A function's NAME survives an edit that its LINE NUMBER does not. The inventory below
 * carries no line numbers; the failure message computes the CURRENT line from the scan itself, so a mismatch is
 * always reported at today's real location without the inventory ever needing hand-updating for an unrelated
 * edit above it.
 *
 * ── THE SHAPE, precisely, and why brace-slicing beats a line-window ─────────────────────────────────────────────
 * For every named function/arrow/method in `web/**\/*.js` (excluding `programModel.js` itself — the canonical
 * file, where `flattenOps`/`findOpById`/`findOpInStack`/`groupConsecutiveOps` legitimately do this top-level
 * work BY DEFINITION), the function is a candidate if, within its OWN brace-matched body (not a fixed line
 * window — `setGroupChildParams`'s and `mergeOpBlocks`' own violations sit on different lines than their own
 * `.children` reference, which is used AFTER the shallow find concludes, for an unrelated reason — a
 * line-window would either miss the violation or wrongly credit it with recursion machinery it doesn't have):
 *   1. it references `getStack(`/`ddcsGetBlockProgram(` (a program-stack source) NEAR (within 500 chars of) —
 *   2. a shallow per-item test: `.type === 'op'`, `.type !== 'op'` (glowEdited's own `for…of` shape — the JS
 *      construct varies between `.find`/`.filter`/`.findIndex` and a plain loop, the bug doesn't), or a bare
 *      `.id === …` not immediately paired with `.opType ===` (a registry-lookup false positive, see below) —
 *   3. AND it does not call `flattenOps(`/`findOpById(`/`findOpInStack(` (the canonical answer) —
 *   4. AND it does not delegate to a LOCALLY-DEFINED helper that is itself self-recursive into `.children`
 *      (`opSession.js`'s own `find`/`flat`, `setupSheet.js`'s `collectOps`) — detected structurally (does a
 *      function call itself with a `.children`-shaped argument?), not by a hand-kept list of "known-safe" names.
 * Comments are blanked before matching (a doc comment that says "…scope find() to…" for PROSE reasons is not a
 * call) — string literal CONTENTS are NOT blanked (`.type === 'op'` needs its own `'op'` to survive).
 *
 * ── FALSE-POSITIVE RATE, reported honestly (the advisor's own explicit ask) ─────────────────────────────────────
 * Tuned against known ground truth, not assumed: started from a literal "does `.children` appear anywhere in the
 * function" rule, which MISSED 2 of the 9 previously-known sites (`setGroupChildParams`/`mergeOpBlocks`, whose
 * own unrelated post-search `.children` reference wrongly read as recursion machinery) and separately produced
 * false positives along the way while tuning (a `setupGlobalFunctions` mega-function where an UNRELATED
 * `.find()` on a wholly different array, 38KB away from its own single `getStack()` reference, collided at
 * whole-function granularity — fixed by the proximity check; `replayReconcile` excluded by its own doc
 * comment's prose "…scope find() to…" — fixed by comment-blanking).
 * **Known remaining blind spot, not fixed, named rather than hidden**: a program-stack array passed in as a
 * PARAMETER (not a direct `getStack()`/`ddcsGetBlockProgram()` call in the same function) would not be detected
 * — every currently-known site calls one of those two directly, so this has zero false-negative cost TODAY, but
 * a future site shaped that way would not be caught by this file alone. Re-tune if one is ever found by hand.
 *
 * ── THE GUARDED-FALLBACK EXCLUSION WAS REMOVED HERE (t1970), not kept as belt-and-suspenders ────────────────────
 * This detector originally also excluded the idiom `window.ddcsFindOpById ? window.ddcsFindOpById(...) :
 * <shallow fallback>` — t1958/t1964's own already-fixed sites, still carrying a guard that could never fire
 * (t1962's own boot-chain trace). t1970 deleted all 6 of those guards in favor of a direct import, so the
 * pattern this exclusion protected against no longer has a single live instance anywhere in `web/`. An
 * exclusion clause nothing in the real tree exercises is a claim the checker can't back up — kept, it would be
 * the checker asserting protection against a shape it can no longer prove it still recognizes. Deleted along
 * with its own synthetic proof-test, per the same reasoning as everything else this file protects: an
 * assertion that can't fail isn't evidence.
 */

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../../..');
const DDCS = path.join(REPO_ROOT, 'DDCS-Studio');
const WEB = path.join(DDCS, 'web');
const EXCLUDED_FILES = [path.join(WEB, 'blocks', 'programModel.js')];   // the canonical file itself

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE SCANNER — pure functions, testable on synthetic snippets before ever touching the real tree (below).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function walkJsFiles(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walkJsFiles(p, out);
        else if (entry.name.endsWith('.js')) out.push(p);
    }
    return out;
}

/** Brace-match from `openBraceIdx` to the function's own closing `}`. Returns { body, scan } — `body` is the
 *  raw slice (line-count/reporting); `scan` is the same slice with every COMMENT blanked to spaces (length-
 *  preserving, so character offsets still line up for the proximity check below) — string literals untouched. */
function sliceBody(text, openBraceIdx) {
    let depth = 0, inStr = null, inComment = null;
    const scanChars = [];
    for (let j = openBraceIdx; j < text.length; j++) {
        const c = text[j], c2 = text[j + 1];
        const blank = (ch) => (ch === '\n' ? '\n' : ' ');
        if (inComment === 'line') { scanChars.push(blank(c)); if (c === '\n') inComment = null; continue; }
        if (inComment === 'block') { scanChars.push(blank(c)); if (c === '*' && c2 === '/') { inComment = null; scanChars.push(' '); j++; } continue; }
        if (inStr) { scanChars.push(c); if (c === '\\') { j++; scanChars.push(text[j] || ''); continue; } if (c === inStr) inStr = null; continue; }
        if (c === '/' && c2 === '/') { inComment = 'line'; scanChars.push(' ', ' '); j++; continue; }
        if (c === '/' && c2 === '*') { inComment = 'block'; scanChars.push(' ', ' '); j++; continue; }
        if (c === "'" || c === '"' || c === '`') { inStr = c; scanChars.push(c); continue; }
        scanChars.push(c);
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return { body: text.slice(openBraceIdx, j + 1), scan: scanChars.join('') }; }
    }
    return { body: text.slice(openBraceIdx), scan: scanChars.join('') };
}

const RESERVED = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'else', 'do', 'try']);

/** Every named function declaration / const-arrow / class-method-shorthand in `text`, with its own brace-sliced
 *  body. Not a full parser — three targeted shapes, matched against every known site in the codebase (see the
 *  false-positive note above for what this missed before being tuned, and what it still can't see). */
export function findFunctions(text) {
    const out = [];
    const patterns = [
        /(?:^|\n)[ \t]*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g,               // function NAME(
        /(?:^|\n)[ \t]*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\([^()]*\)\s*=>\s*\{/g,   // const NAME = (...) => {
        /^[ \t]{2,}(?:async\s+)?(\w+)\s*\([^()]*\)\s*\{[ \t]*$/gm,                        // class-method NAME(...) {
    ];
    for (const re of patterns) {
        let m;
        re.lastIndex = 0;
        while ((m = re.exec(text))) {
            const name = m[1];
            if (!name || RESERVED.has(name)) continue;
            const realBraceIdx = m[0].endsWith('{') ? m.index + m[0].length - 1 : text.indexOf('{', m.index + m[0].length);
            if (realBraceIdx < 0) continue;
            const { body, scan } = sliceBody(text, realBraceIdx);
            const line = text.slice(0, m.index).split('\n').length;
            out.push({ name, line, body, scan });
        }
    }
    return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function allIndices(s, re) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    const out = []; let m;
    while ((m = g.exec(s))) { out.push(m.index); if (m[0].length === 0) g.lastIndex++; }
    return out;
}

const CANONICAL = ['flattenOps', 'findOpById', 'findOpInStack'];
const PROXIMITY = 500;   // chars — every known-genuine site's own getStack()<->shallow-check distance is well
                          // under 200; the one false positive this excluded during tuning (setupGlobalFunctions,
                          // an unrelated .find() 38KB from its own single getStack() reference) sat far outside it.

/** True if `fn`'s own name is called with a `.children`-shaped argument inside its own body — a locally-defined
 *  recursive helper (opSession.js's own `find`/`flat`, setupSheet.js's `collectOps`), detected structurally. */
function isSelfRecursiveIntoChildren(fn) {
    return new RegExp('\\b' + esc(fn.name) + '\\(\\s*[\\w.]*\\.children\\b').test(fn.scan);
}

/** Is `fn` a candidate violation of the shape described in this file's own header comment? */
export function isViolation(fn, safeHelperNames) {
    const s = fn.scan;
    if (CANONICAL.some((n) => new RegExp('\\b' + n + '\\(').test(s))) return false;
    const stackIdx = allIndices(s, /getStack\(|ddcsGetBlockProgram\(/);
    if (!stackIdx.length) return false;
    const checkIdx = [
        ...allIndices(s, /\.type\s*===\s*'op'/),
        ...allIndices(s, /\.type\s*!==\s*'op'/),
        ...allIndices(s, /\.id\s*===/).filter((i) => !/\.opType\s*===/.test(s.slice(Math.max(0, i - 60), i + 60))),
    ];
    if (!checkIdx.length) return false;
    if (!stackIdx.some((si) => checkIdx.some((ci) => Math.abs(si - ci) <= PROXIMITY))) return false;
    for (const helper of safeHelperNames) {
        if (new RegExp('(?<!\\.)\\b' + esc(helper) + '\\(').test(s)) return false;
    }
    return true;
}

/** All violations in one file's text, with OUTER-function de-duplication: a violation found in a nested
 *  closure (glowEdited) also makes its OUTER wrapper (initEditorOpHover) match by accident, since the outer
 *  body textually contains the inner one — same bug, one report. Keeps only the INNERMOST match. */
export function scanFileText(text) {
    const fns = findFunctions(text);
    const safeHelperNames = fns.filter(isSelfRecursiveIntoChildren).map((fn) => fn.name);
    const violators = fns.filter((fn) => isViolation(fn, safeHelperNames));
    return violators.filter((v) => !violators.some((other) => other !== v && other.body.length < v.body.length && v.body.includes(other.body)));
}

function scanTree() {
    const out = [];
    for (const f of walkJsFiles(WEB)) {
        if (EXCLUDED_FILES.includes(f)) continue;
        const text = fs.readFileSync(f, 'utf8');
        for (const fn of scanFileText(text)) out.push({ file: path.relative(DDCS, f).replace(/\\/g, '/'), name: fn.name, line: fn.line });
    }
    return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE INVENTORY — the debt, currently open. Keyed by {file, name}, never line (see the header comment). Each
// entry states the user-visible symptom so a future reader can pick one off without re-deriving it.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const INVENTORY = [
    { file: 'web/blocks/opSession.js', name: 'deleteOp', why: 'right-click Delete on an op nested inside a multi_step import silently no-ops' },
    { file: 'web/blocks/opSession.js', name: 'duplicateOp', why: 'right-click Duplicate on a nested op silently no-ops' },
    { file: 'web/blocks/opSession.js', name: 'setGroupChildParams', why: 'editing a hand-built group\'s own form fields silently fails once that group is promoted into a multi_step (any 2+ top-level ops wrap, group included)' },
    { file: 'web/blocks/opSession.js', name: 'replayReconcile', why: 'the edit-glow diff for a nested op reads "no edits" instead of erroring, so a real block-level edit never highlights' },
    { file: 'web/blocks/opSession.js', name: 'mergeOpBlocks', why: 'the block-edit-aware 3-way AST merge silently no-ops for a nested op, discarding the user\'s hand edits with no error' },
    { file: 'web/ui/editorManager.js', name: '_firstOpTitle', why: 'an exported/downloaded .nc for a multi-op program is titled/filed as "multi_step" instead of the real first op\'s name (cosmetic)' },
    { file: 'web/ui/opContextMenu.js', name: 'showOpMenu', why: 'the right-click menu on a nested op falls back to a thinner, stale record (missing params/children) for its CAM-authoring actions' },
    // t1976 — web/ui/editorOpHover.js's glowEdited FIXED: iterates `flattenOps(ddcsGetBlockProgram())` (t1928's
    // own declared enumeration) instead of a shallow top-level loop; the edit-detection itself (isOpBlockEdited /
    // editedRangesForOp, opGlow.js) was already correct BY ID (t1958), the gap was purely what this loop visited.
    // See WORK-LOG t1976 and word-glow.spec.js's new nested-op test for the non-vacuity proof + screenshot.
    // t1974 — web/viz/segmentFrame.js's frameOwnerAtLine FIXED: now resolves via programModel.js's own canonical
    // `opAtLine` (a genuine recursive walker, correctly excluded by the detector) instead of a local shallow
    // top-level find(). See WORK-LOG t1974 and option-b-slice3-live-visibility-1874.spec.js's new WRAPPED
    // PROGRAM test for the non-vacuity proof and the user-visible assertion.
    { file: 'web/ui/macrosApp.js', name: 'openCamAuthoring', why: '"auto-import all CAM-able program ops" silently skips every op nested inside a multi_step wrapper — a multi-op program\'s later ops never reach CAM authoring' },
];

const keyOf = (x) => `${x.file}::${x.name}`;

/** The core ratchet comparison, exported so both the real-tree test and the two meta-tests below share ONE
 *  implementation — a bug in the comparison itself would otherwise need fixing (and re-verifying) twice. */
export function diffInventory(scanned, inventory) {
    const scannedKeys = new Set(scanned.map(keyOf));
    const inventoryKeys = new Set(inventory.map(keyOf));
    const newViolations = scanned.filter((s) => !inventoryKeys.has(keyOf(s)));
    const staleEntries = inventory.filter((e) => !scannedKeys.has(keyOf(e)));
    return { newViolations, staleEntries, clean: !newViolations.length && !staleEntries.length };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 1 — THE DETECTOR ITSELF, proven on synthetic snippets (not the real tree) — the shape fires where it
// should and stays quiet where it shouldn't, independent of the ratchet mechanics tested in Part 3.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('detector: fires on a synthetic shallow-scan violation', () => {
    const src = `
export function fakeDeleteOp(opId) {
    const cur = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
    const idx = cur.findIndex((b) => b && b.type === 'op' && b.id === opId);
    if (idx < 0) return false;
    return true;
}`;
    const hits = scanFileText(src);
    expect(hits.map((h) => h.name)).toEqual(['fakeDeleteOp']);
});

test('detector: silent on a genuine recursive walker (the canonical shape itself)', () => {
    const src = `
function fakeFindOpInStack(blocks, id) {
    for (const b of (blocks || [])) {
        if (b.children) { const f = fakeFindOpInStack(b.children, id); if (f) return f; }
        if (b.type === 'op' && b.id === id) return b;
    }
    return null;
}
export function fakeLookup(id) {
    const prog = window.ddcsGetBlockProgram() || [];
    return fakeFindOpInStack(prog, id);
}`;
    expect(scanFileText(src)).toEqual([]);
});

test('detector: silent on a doc comment that merely SAYS "find(" for prose reasons', () => {
    const src = `
export function fakeReconcile(opId) {
    const prog = window.ddcsGetBlockProgram() || [];
    // note: this scopes find() to the op's own subtree, unrelated prose that must not be read as a call
    const op = prog.find((b) => b && b.type === 'op' && b.id === opId);
    return op;
}`;
    // this one SHOULD still fire (the real .find() call on the line below the comment is genuine) — proves
    // comment-blanking removes the PROSE match without silencing the REAL one sitting right next to it.
    expect(scanFileText(src).map((h) => h.name)).toEqual(['fakeReconcile']);
});

test('detector: a function-scoped .children reference used AFTER the shallow find (not as recursion) still counts as a violation', () => {
    // setGroupChildParams' own real shape: .children is read off the ALREADY-FOUND record, never passed to a
    // recursive call — this must not be mistaken for recursion machinery.
    const src = `
export function fakeGroupEdit(groupId) {
    const cur = window.ddcsGetBlockProgram() || [];
    const idx = cur.findIndex((b) => b && b.type === 'op' && b.id === groupId);
    if (idx < 0) return false;
    const grp = cur[idx];
    doSomethingWith(grp.children);
    return true;
}`;
    expect(scanFileText(src).map((h) => h.name)).toEqual(['fakeGroupEdit']);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 2 — THE INVENTORY MATCHES THE REAL TREE, exactly, right now.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test(`op-lookup-scan: the inventory (${INVENTORY.length} open sites) matches the real tree exactly — no growth, no stale entries`, () => {
    const scanned = scanTree();
    const { newViolations, staleEntries, clean } = diffInventory(scanned, INVENTORY);
    if (!clean) {
        const lines = [];
        if (newViolations.length) {
            lines.push(`${newViolations.length} NEW violation(s) not in the inventory (fix it, or add it with its own user-visible symptom):`);
            newViolations.forEach((v) => lines.push(`  ${v.file}:${v.line} ${v.name}`));
        }
        if (staleEntries.length) {
            lines.push(`${staleEntries.length} inventory entr${staleEntries.length === 1 ? 'y' : 'ies'} the scan no longer finds (genuinely fixed → remove it; scan broken → fix the scan):`);
            staleEntries.forEach((e) => lines.push(`  ${e.file} :: ${e.name}`));
        }
        throw new Error('\n' + lines.join('\n'));
    }
    expect(clean).toBe(true);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 3 — PROVE BOTH RATCHET DIRECTIONS (the advisor's own explicit requirement, t1968 #4).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('ratchet direction 1: a new violation not in the inventory FAILS', () => {
    const scanned = scanTree();
    const withFakeExtra = [...scanned, { file: 'web/fake/does-not-exist.js', name: 'fakeNewViolation', line: 1 }];
    const { clean, newViolations } = diffInventory(withFakeExtra, INVENTORY);
    expect(clean, 'a scanned violation absent from the inventory must fail the ratchet').toBe(false);
    expect(newViolations.some((v) => v.name === 'fakeNewViolation')).toBe(true);
});

test('ratchet direction 2: removing an inventory entry WITHOUT fixing the site FAILS (the real tree still has it)', () => {
    const scanned = scanTree();   // the REAL, current tree — not a mock
    const dishonestlyShrunk = INVENTORY.slice(1);   // "someone" deletes the first entry, the code is untouched
    const { clean, staleEntries } = diffInventory(scanned, dishonestlyShrunk);
    // staleEntries stays empty here (we removed FROM the inventory, not added to it) — the real signal is that
    // the scan itself still contains the dropped entry's own key, unaccounted for, which the FULL-inventory test
    // above would catch. Assert that directly: the scan's own findings still include the deleted entry's site.
    expect(scanned.some((v) => v.file === INVENTORY[0].file && v.name === INVENTORY[0].name),
        'the site named by the removed entry must still be found by the scan — proving the removal was dishonest, not a real fix').toBe(true);
    expect(staleEntries.length, 'sanity: shrinking the inventory itself produces no stale entries (that direction is checked by Part 2 against the FULL inventory, not this deliberately-shrunk one)').toBe(0);
});
