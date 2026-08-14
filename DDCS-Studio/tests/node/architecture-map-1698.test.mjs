import { test, expect } from './support/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * architecture-map-1698 — MAKES ARCHITECTURE.md CHECKABLE (browser-free tier).
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE.md (repo root, landed `ca09d951`) exists because reasoning from diffs alone produced confident wrong
 * premises three times in two days — a diff shows what CHANGED, never what the thing IS. But a map nobody checks
 * becomes the next stale artifact: this week alone, a CI header claiming 24 failures against a real 504, an advisor
 * signature frozen 50 turns behind, a comment promising a hollow marker nothing wired. This file is the guard
 * against ARCHITECTURE.md joining that list.
 *
 * ── TWO KINDS OF CLAIM, TWO KINDS OF CHECK ───────────────────────────────────────────────────────────────────────
 *   GENERATED — a count or list the map states in PROSE but that is fully re-derivable from a declaration (how many
 *     BUILTINS entries, how many twins, how many WIZARD_VIEWS, whether a deleted panel id is really gone). The map
 *     itself already prints the exact command for each of these under "### The greps that regenerate this" — this
 *     file runs the PURE-JS equivalent of every one of them (no `rg`/`grep` subprocess: confirmed absent from this
 *     environment's PowerShell PATH, and `fs.readFileSync` + a regex is exactly what "a file read plus a grep"
 *     means for this tier's cost budget) and asserts the map's stated number still matches.
 *   ASSERTED — a hand-written claim that names a `file:line` and describes what MUST be there. These cannot be
 *     regenerated (they are prose about a fact, not the fact's own declaration), so each is a `{file, line(s),
 *     find}` entry checked against the file's CURRENT content at that exact citation. `find` is a substring or
 *     regex chosen to be the smallest thing that would break if the citation rotted OR if the claim stopped being
 *     true — not a paraphrase of the whole sentence.
 *
 * ── SCOPE, PER THE DISPATCH (start with what would mislead into a wrong fix) ────────────────────────────────────
 * Every TRAP (9) and every INVARIANT (17) is checked — these are exactly the claims a reader ACTS on. The Q1/Q2/Q3
 * diagrams' own prose citations are covered by the GENERATED counts above (Q1's registry sizes) plus a handful of
 * the highest-value ASSERTED ones (the frame-algebra file:lines in Q3, since a coordinate bug there is the single
 * most expensive class of defect this session's WORK-LOG records). NOT covered, named rather than silently
 * skipped: the REGISTRIES table's non-generated rows (guard predicate shape, per-atom scratch vars — informational,
 * not trap-shaped), "KNOWN DIVERGENCE" (explicitly already-accepted debt, not a claim someone would act on as
 * fact), and "WHERE THE GATES ARE" (a table of NO's — nothing to assert false of a negative). If any of those
 * later earns its own TRAP or INVARIANT entry, it earns a citation here too.
 *
 * ── NON-VACUITY (done once, by hand, not as a permanent test — see WORK-LOG t1698) ──────────────────────────────
 * A citation moved in a scratch copy of a real source file, pointed the checker at the scratch copy, confirmed it
 * failed NAMING the exact claim, restored. The mechanism the checker embodies (line N of file F must contain X) is
 * generic — proven once is proven for all ~50 citations below, not one at a time.
 */

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../../..');   // …/tests/node/<this file> → DDCS-Studio → repo root
const DDCS = path.join(REPO_ROOT, 'DDCS-Studio');
const WEB = path.join(DDCS, 'web');
const MAP = path.join(REPO_ROOT, 'ARCHITECTURE.md');

const _cache = new Map();
/** Every cited file read ONCE, split into 1-based lines (so `line: 42` means what the map means by "line 42"). */
function linesOf(absPath) {
    if (!_cache.has(absPath)) {
        let text;
        try { text = fs.readFileSync(absPath, 'utf8'); }
        catch (e) { throw new Error(`architecture-map-1698: cited file does not exist: ${path.relative(REPO_ROOT, absPath)} (${e.code})`); }
        _cache.set(absPath, text.split(/\r?\n/));
    }
    return _cache.get(absPath);
}
/** True if `find` (string or RegExp) appears on ANY line in [from, to] (inclusive, 1-based). A single `line` is from===to.
 *  `to` may exceed the file length (whole-file search, for a claim with no `line` — see citation-format note below). */
function citationHolds(absPath, from, to, find) {
    const ls = linesOf(absPath);
    const re = find instanceof RegExp ? find : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const upper = Math.min(to, ls.length);
    for (let n = from; n <= upper; n++) {
        const line = ls[n - 1];   // 1-based → 0-based
        if (line != null && re.test(line)) return true;
    }
    return false;
}
function must(message, fn) {
    try { fn(); } catch (err) { err.message = `\n  MAP CLAIM: ${message}\n\n${err.message}`; throw err; }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 0 — THE MAP FILE ITSELF EXISTS AND CARRIES THE HEAD IT WAS VERIFIED AT (so a check against a moved repo
// or a renamed file fails loud, not with a confusing downstream error)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test('architecture map: ARCHITECTURE.md exists at the repo root', () => {
    expect(fs.existsSync(MAP), `expected ${path.relative(REPO_ROOT, MAP)} to exist`).toBe(true);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 1 — GENERATED: re-derive what the map states as a count, from the SAME declaration it names
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test('architecture map GENERATED: Q1/registries — every stated count still matches its own declaration', () => {
    // BUILTINS: 25 entries, 25 with opensAs (wizardLibrary.js:42-81)
    const wizLib = linesOf(path.join(WEB, 'blocks/wizardLibrary.js'));
    const builtinsBlock = wizLib.slice(41, 81).join('\n');   // lines 42-81, 1-based → 0-based slice
    const builtinIds = (builtinsBlock.match(/\bid:\s*'[a-z_0-9]+'/g) || []).length;
    const builtinOpensAs = (builtinsBlock.match(/\bopensAs:\s*'[a-zA-Z_0-9]+'/g) || []).length;
    must(`BUILTINS entry count drifted from 25 (ARCHITECTURE.md Q1 + REGISTRIES) — got ${builtinIds}. Update the map's own stated count, or this citation range (wizardLibrary.js:42-81) no longer bounds the array.`,
        () => expect(builtinIds).toBe(25));
    must(`BUILTINS opensAs count drifted from 25 — got ${builtinOpensAs}`, () => expect(builtinOpensAs).toBe(25));

    // SEED_BUILDERS: 32 twins (app.js:105-112), cross-checked against the OTHER regenerate command the map gives
    // (grep _OPTYPE = 'user_ across dataOps/*.js) — two independent derivations, matching the map's own "never a
    // hand list" discipline rather than trusting one count.
    const appJs = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
    const seedMatch = appJs.match(/export const SEED_BUILDERS = \[([\s\S]*?)\];/);
    must('app.js no longer declares `export const SEED_BUILDERS = [...]` at all — the registry ARCHITECTURE.md cites moved',
        () => expect(!!seedMatch).toBe(true));
    const seedCount = (seedMatch[1].match(/\w+DataDef\b/g) || []).length;
    must(`SEED_BUILDERS count drifted from 32 (ARCHITECTURE.md REGISTRIES) — got ${seedCount}`, () => expect(seedCount).toBe(32));

    const dataOpsDir = path.join(WEB, 'blocks/dataOps');
    let optypeCount = 0;
    for (const f of fs.readdirSync(dataOpsDir).filter((f) => f.endsWith('.js'))) {
        const text = fs.readFileSync(path.join(dataOpsDir, f), 'utf8');
        optypeCount += (text.match(/_OPTYPE = 'user_/g) || []).length;
    }
    must(`the two independent twin-count derivations disagree — SEED_BUILDERS says ${seedCount}, the _OPTYPE grep says ${optypeCount}. ARCHITECTURE.md cites both as agreeing at 32.`,
        () => expect(optypeCount).toBe(seedCount));

    // WIZARD_VIEWS: 14 entries (wizards/views/index.js:35-48, t1730 — middle/rotary_center/rotary_clock/edge/
    // alignment/homing retired, 20→14), the map's own regex given verbatim
    const viewsIndex = linesOf(path.join(WEB, 'wizards/views/index.js'));
    const viewsBlock = viewsIndex.slice(34, 48);   // lines 35-48
    const viewCount = viewsBlock.filter((l) => /^\s{4}\w+View,$/.test(l)).length;
    must(`WIZARD_VIEWS entry count drifted from 14 (ARCHITECTURE.md Q1 + REGISTRIES) — got ${viewCount}`, () => expect(viewCount).toBe(14));

    // the two deletions Q1/TRAP1 claims are load-bearing negatives
    const indexHtml = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
    const wizCornerCount = (indexHtml.match(/id="wiz_corner"/g) || []).length;
    must('index.html grew a #wiz_corner panel back — ARCHITECTURE.md Q1/TRAP1 says Corner has NO panel, deleted 2026-07-02', () => expect(wizCornerCount).toBe(0));
    const openWizInHtml = (indexHtml.match(/openWiz\(/g) || []).length;
    must('index.html now contains an openWiz( onclick — ARCHITECTURE.md Q1 says zero, all routing goes through commandDeck.js/wizardPrereq.js', () => expect(openWizInHtml).toBe(0));
    const cCornerCount = (indexHtml.match(/id="c_corner"/g) || []).length;
    must('index.html grew a #c_corner field back — ARCHITECTURE.md TRAP5 says these 15 field ids point at deleted DOM', () => expect(cCornerCount).toBe(0));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 2 — ASSERTED: every TRAP citation still holds
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const TRAP_CLAIMS = [
    { id: 'TRAP1 Corner view import gone', file: 'web/wizards/views/index.js', line: 20, find: /retired 2026-07-02/ },
    { id: 'TRAP1 Corner opensAs the twin', file: 'web/blocks/wizardLibrary.js', line: 56, find: /opensAs:\s*'user_corner_data'/ },
    { id: 'TRAP1 cornerWizard.js import (cornerData.js:44)', file: 'web/blocks/dataOps/cornerData.js', line: 44, find: /cornerWizard\.js'/ },
    { id: 'TRAP1 cornerStack() usage (cornerData.js:261)', file: 'web/blocks/dataOps/cornerData.js', line: 261, find: /cornerStack\(/ },
    { id: 'TRAP2 the overlay never folds placement before t1686 fix (getTransform)', file: 'web/viz/featureCanvas.js', line: 83, find: /getTransform/ },
    { id: 'TRAP2 the crosshair went through _S not _disp (spec.origin)', file: 'web/wizards/ops/panelTypes.js', line: 233, find: /latheLayoutSpec/ },
    { id: 'TRAP3 the declared _writable replacement', file: 'web/wizards/ops/panelTypes.js', line: 311, find: /_writable/ },
    { id: 'TRAP4 activeDialectOpts declares {dialect, indentStyle}', file: 'web/wizards/previewEmit.js', line: 21, lineEnd: 24, find: /indentStyle/ },
    { id: 'TRAP4 programModel.js keeps its own {dialect}-only copy', file: 'web/blocks/programModel.js', line: 36, find: /dialect/ },
    { id: 'TRAP4 opGlow.js keeps its own {dialect}-only copy', file: 'web/blocks/opGlow.js', line: 18, find: /dialect/ },
    { id: 'TRAP4 opSession.js keeps its own {dialect}-only copy', file: 'web/blocks/opSession.js', line: 18, find: /dialect/ },
    { id: 'TRAP4 applyIndentStyle no-ops unless flush', file: 'web/data/indentStyle.js', line: 51, find: /flush/ },
    { id: 'TRAP5 canEdit reads paramFields', file: 'web/wizardManager.js', line: 322, find: /canEdit/ },
    { id: 'TRAP5 FIELD_BIND.corner folded at opSchema.js', file: 'web/blocks/opSchema.js', line: 158, find: /corner/ },
    { id: 'TRAP6 commData.js passes setup_datawiz', file: 'web/blocks/dataOps/commData.js', line: 154, find: /setup_datawiz/ },
    { id: 'TRAP6 homingData.js passes setup_datawiz', file: 'web/blocks/dataOps/homingData.js', line: 187, find: /setup_datawiz/ },   // t1842 — shifted from 167 by homingDataStack's own new wrapper-retype fix above it
    { id: 'TRAP6 GROUPS declares only probe/atc/mill _datawiz', file: 'web/blocks/wizardLibrary.js', line: 28, lineEnd: 41, find: /_datawiz/ },
    { id: 'TRAP7 commandDeck stamps type||opensAs||id', file: 'web/ui/commandDeck.js', line: 103, find: /opensAs/ },
    { id: 'TRAP8 the stale z-index comment', file: 'web/viz/createPreviewPanel.js', line: 1121, lineEnd: 1122, find: /z-index/ },   // t1836 — shifted from 1119-1120 by the new setFrameNote/machine-frame-note additions above it
    { id: 'TRAP8 .attach( only caller is the retired bak file', file: 'web/viz/gcodeViz3d.js', line: 2779, find: /attach/ },
    { id: 'TRAP8 the WebGL canvas is appended in flow', file: 'web/viz/gcodeViz3d.js', line: 68, find: /appendChild|canvas/ },
    { id: 'TRAP9 (fixed t1816) renderLayout2D caches FeatureCanvas per container', file: 'web/wizards/ops/panelTypes.js', line: 706, find: /container\.__layout/ },
    { id: 'TRAP9 _mount wipes container.innerHTML', file: 'web/viz/featureCanvas.js', line: 92, lineEnd: 95, find: /innerHTML/ },
    { id: 'TRAP9 renderDeclaredLayout has zero live callers (userOpView.js:661)', file: 'web/wizards/views/userOpView.js', line: 674, find: /renderLayout2D|el\('userVizContainer'\)/ },
];

test('architecture map ASSERTED: every TRAP citation still holds', () => {
    const wrong = [];
    for (const c of TRAP_CLAIMS) {
        const abs = path.join(DDCS, c.file);
        const to = c.lineEnd || c.line;
        try {
            if (!citationHolds(abs, c.line, to, c.find)) {
                wrong.push(`${c.id} — ${c.file}:${c.line}${c.lineEnd ? '-' + c.lineEnd : ''} no longer contains ${c.find}`);
            }
        } catch (e) { wrong.push(`${c.id} — ${e.message}`); }
    }
    must('a TRAP citation rotted — the file:line ARCHITECTURE.md points at no longer contains what the trap describes. Either the citation needs updating (the code moved) or the TRAP ITSELF is stale (the underlying gotcha was fixed and the map should say so, not still warn about it) — read the diff at that location before deciding which.',
        () => expect(wrong).toEqual([]));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 3 — ASSERTED: every INVARIANT citation still holds
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const INVARIANT_CLAIMS = [
    { id: 'INV1 mouth guard throws by name', file: 'web/blocks/blockly/stackBridge.js', line: 318, find: /mouth/ },
    { id: 'INV1 mouth reader', file: 'web/blocks/blockly/bridge.js', line: 78, find: /mouth/ },
    { id: 'INV1 the fifth, deliberately-left kind list', file: 'web/blocks/blockEmitter.js', line: 40, find: /./ },
    { id: 'INV2 leaf record fields declared-or-throw', file: 'web/blocks/blockly/stackBridge.js', line: 265, find: /./ },
    { id: 'INV3 subscriber isolation logs, never swallows', file: 'web/blocks/programModel.js', line: 253, find: /console\.error/ },   // t1842 — shifted from 236 by findOpInStack's own new id-less-node guard above it
    { id: 'INV4 CLEAN_SHAPES', file: 'DDCS-Studio/tests/node/declared-key-coverage-1678.test.mjs', line: 43, find: /CLEAN_SHAPES/ },
    { id: 'INV5 KNOWN GAP part 2 is empty by design', file: 'DDCS-Studio/tests/node/declared-key-coverage-1678.test.mjs', line: 80, lineEnd: 87, find: /PART 2|KNOWN GAP/ },
    { id: 'INV6 hookKeysOf derives from one real constructor call', file: 'web/blocks/userOps.js', line: 884, lineEnd: 891, find: /_BASE_DEF_SHAPE|hookKeysOf/ },
    { id: 'INV7 getTransform folds placement', file: 'web/viz/featureCanvas.js', line: 83, find: /getTransform/ },
    { id: 'INV7 onTransform relays the same composed value', file: 'web/viz/featureCanvas.js', line: 383, find: /getTransform|onTransform/ },
    { id: 'INV8 fork-parity byte-identity gate exists', file: 'DDCS-Studio/tests/fork-parity-1593.spec.js', line: 1, find: /./ },
    { id: 'INV8 validateUserOp fork-arm check', file: 'web/blocks/userOps.js', line: 746, find: /./ },
    { id: 'INV10 fork-parity typed sweep', file: 'DDCS-Studio/tests/fork-parity-1593.spec.js', line: 1, find: /./ },
    { id: 'INV11 UPDATE_PREVIEW_SNAPSHOT rewrites and throws', file: 'DDCS-Studio/tests/node/preview-spec-gate-1688.test.mjs', line: 324, find: /UPDATE_PREVIEW_SNAPSHOT/ },
    { id: 'INV12 tri-state fill: emits !== false', file: 'web/viz/startGlyph.js', line: 20, lineEnd: 24, find: /emits\s*!==\s*false/ },
    { id: 'INV12 pass 0 is manual regardless of source', file: 'web/viz/startGlyph.js', line: 13, find: /pass 0|manual/i },
    { id: 'INV13 FAIL CLOSED return null', file: 'web/blocks/userOps.js', line: 1136, find: /return null/ },
    { id: 'INV14 postInstantiate ordering', file: 'web/blocks/userOps.js', line: 956, find: /postInstantiate/ },
    // no `line`: NEXT-SESSION.md is rewritten wholesale each cycle (advisor-owned, uncommitted mid-edit as this
    // very claim was first checked — a live case, not a hypothetical) — anchored by content, not a position.
    { id: 'INV15 corner is the gated pilot, standing ruling', file: 'NEXT-SESSION.md', find: /Corner is the gated pilot/i },
    { id: 'INV17 AGENTS.md one commit one concern', file: 'AGENTS.md', line: 35, find: /./ },
    { id: 'INV17 AGENTS.md trace consumers before cleanup', file: 'AGENTS.md', line: 41, find: /./ },
];

test('architecture map ASSERTED: every INVARIANT citation still holds', () => {
    const wrong = [];
    for (const c of INVARIANT_CLAIMS) {
        const abs = path.isAbsolute(c.file) ? c.file
            : c.file.startsWith('DDCS-Studio/') ? path.join(REPO_ROOT, c.file)
            : !c.file.includes('/') ? path.join(REPO_ROOT, c.file)   // bare filename (AGENTS.md, NEXT-SESSION.md, …) = repo-root doc
            : path.join(DDCS, c.file);
        const from = c.line || 1;
        const to = c.lineEnd || c.line || Infinity;   // no `line` at all → whole-file content search
        try {
            if (!citationHolds(abs, from, to, c.find)) {
                const where = c.line ? `:${c.line}${c.lineEnd ? '-' + c.lineEnd : ''}` : ' (whole file)';
                wrong.push(`${c.id} — ${c.file}${where} no longer contains ${c.find}`);
            }
        } catch (e) { wrong.push(`${c.id} — ${e.message}`); }
    }
    must('an INVARIANT citation rotted — the guard ARCHITECTURE.md names no longer lives where it says. An invariant whose guard has moved or disappeared is worse than a stale trap: someone will trust the rule is still enforced.',
        () => expect(wrong).toEqual([]));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 4 — ASSERTED: Q3's frame-algebra citations (the single most expensive defect class this session's WORK-LOG
// records — t1672/t1686's ~275px split — so its exact citations are checked even though the rest of Q3's prose
// is diagram, not claim-per-line)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const Q3_CLAIMS = [
    { id: 'Q3 _disp folds placement', file: 'web/viz/featureCanvas.js', line: 330, find: /_disp/ },
    { id: 'Q3 placement assigned at _draw', file: 'web/viz/featureCanvas.js', line: 379, find: /placement/ },
    { id: 'Q3 overlay tx() reads view.ox', file: 'web/viz/toolpath2d.js', line: 83, find: /view\.ox|ox\s*\+/ },
    { id: 'Q3 partZeroShift is the ONE declared transform', file: 'web/viz/sceneFrame.js', line: 43, find: /partZeroShift/ },
    { id: 'Q3 stockPinOffset — a DIFFERENT number', file: 'web/viz/sceneFrame.js', line: 88, find: /stockPinOffset/ },
    { id: 'Q3 placeShiftFromParams / PlaceOnStock attach shift', file: 'web/wizards/ops/placement.js', line: 133, find: /placeShift/ },
    { id: 'Q3 lathe spec carries no placement key (early-return)', file: 'web/wizards/ops/panelTypes.js', line: 233, lineEnd: 234, find: /latheLayoutSpec/ },
];

test('architecture map ASSERTED: Q3 frame-algebra citations still hold (the highest-cost defect class)', () => {
    const wrong = [];
    for (const c of Q3_CLAIMS) {
        const abs = path.join(DDCS, c.file);
        const to = c.lineEnd || c.line;
        try {
            if (!citationHolds(abs, c.line, to, c.find)) wrong.push(`${c.id} — ${c.file}:${c.line}${c.lineEnd ? '-' + c.lineEnd : ''} no longer contains ${c.find}`);
        } catch (e) { wrong.push(`${c.id} — ${e.message}`); }
    }
    must('a Q3 frame-algebra citation rotted — this is the exact class of coordinate bug (t1672/t1686) the map exists to prevent a THIRD occurrence of',
        () => expect(wrong).toEqual([]));
});
