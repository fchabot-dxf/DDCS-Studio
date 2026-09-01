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
 *   ASSERTED — a hand-written claim that names a fact and describes what MUST be there. These cannot be
 *     regenerated (they are prose about a fact, not the fact's own declaration), so each is a `{file, find}` entry
 *     checked against the file's CURRENT content — `find` is a literal substring (occasionally a narrow regex)
 *     drawn from the cited line's own real text, chosen to be the smallest UNIQUE thing that would break if the
 *     citation rotted OR if the claim stopped being true — not a paraphrase of the whole sentence.
 *
 * ── OPTION B (t1996) — SUBSTRING ANCHORS, NOT LINE NUMBERS, WITH A MANDATORY UNIQUENESS CHECK ────────────────────
 * Every citation below used to carry a `line` (occasionally `line`+`lineEnd`); the checker searched only that
 * range. DROPPED, in favour of `find` alone, checked against the WHOLE FILE, required to match EXACTLY ONCE.
 *
 * WHY: this session's own two real citation drifts (INV3's `console.error`, `programModel.js`, moved 538→586;
 * INV6's `hookKeysOf`, `userOps.js`, moved 893→917) both happened because an edit landed A LINE ABOVE the cited
 * one, inside the SAME enclosing function the citation was already scoped to — a symbol-level anchor ("does
 * function X still exist somewhere in this file") would not have caught either one, since the function's own name
 * never moved or changed; only the LINE the citation actually meant did. A substring drawn from the cited line's
 * own content, searched whole-file, catches exactly this: the line itself is what must still exist, wherever it
 * now sits — this is a STRICTLY STRONGER claim than "line N contains X," not a weaker one that merely drops the
 * number, because it also fails the moment the same text starts appearing TWICE (a genuine ambiguity a line-
 * numbered citation could paper over by accident).
 *
 * THE UNIQUENESS CHECK IS THE WHOLE POINT, NOT AN OPTIONAL EXTRA. A `find` that matches ZERO times means the
 * citation rotted or the claim it names was fixed (update the map, or the claim, whichever is true). A `find`
 * that matches TWO OR MORE times means the anchor is not distinctive enough to mean any one specific thing —
 * dropping the line number without ALSO requiring uniqueness would make the checker WEAKER while looking like an
 * improvement (a non-unique `find` could match on an unrelated line and report false confidence). Measured before
 * building: 8 of the first 10 sampled patterns (`/dialect/`, `/getTransform/`, `/placement/`, `/_writable/`, …)
 * matched 2+ times whole-file under their OLD short regex — real tightening work, not a mechanical line-drop. All
 * 52 citations below are the FULL TRIMMED SOURCE LINE (or a hand-shortened unique fragment of it where the full
 * line was unwieldy) — verified, not assumed, against the tree at the point this turn landed.
 *
 * ONE CITATION WAS FOUND GENUINELY WRONG WHILE RE-ANCHORING, NOT JUST STALE: `INV8 validateUserOp fork-arm
 * check` cited `userOps.js:746`, inside `find:/./ ` — a trivial always-true placeholder that had NEVER actually
 * verified anything (any non-empty line satisfies it). Line 746 sits inside a DIFFERENT function entirely (the
 * `instantiate` binding loop), not `validateUserOp`. The real claim — "the fork-arm check is asserted silent
 * rather than deleted" — lives at `userOps.js:861`, the `⚠ THIS CHECK STAYS, AND IS EXPECTED TO BE SILENT`
 * comment. Re-anchored there. This is exactly the class of decorative-not-enforced claim Option B exists to end.
 *
 * ── SCOPE, PER THE DISPATCH (start with what would mislead into a wrong fix) ────────────────────────────────────
 * Every TRAP (24 sub-claims across 9 named traps), every INVARIANT (21 sub-claims across 17 named invariants), and
 * (t2004) every REGISTRIES-table row naming a real `file:line` fact (10 sub-claims) is checked — these are exactly
 * the claims a reader ACTS on. The Q1/Q2/Q3 diagrams' own prose citations are covered by the GENERATED counts above
 * (Q1's registry sizes) plus the highest-value ASSERTED ones (Q3's 7 frame-algebra file:lines, since a coordinate
 * bug there is the single most expensive class of defect this session's WORK-LOG records). NOT YET covered, and
 * REMAINING genuinely UNENFORCED — see "THE PROSE HALF" below for exactly what that means and why: Q1/Q2's own
 * diagram-annotation citations, "KNOWN DIVERGENCE" (explicitly already-accepted debt, not a claim someone would act
 * on as fact), and "WHERE THE GATES ARE" / "UNVERIFIED" (tables of NO's / named gaps — the negative-assertion
 * question is different in kind, considered but not built this turn; see t2004's own WORK-LOG entry for the sizing
 * call). If any of those later earns its own TRAP or INVARIANT entry, it earns a citation here too regardless.
 *
 * ── THE PROSE HALF — STATED PLAINLY, PER THE DISPATCH'S OWN EITHER/OR ────────────────────────────────────────────
 * t1970 found four `wizardManager.js` prose mentions already stale BEFORE that turn's own edits (`this.open()`
 * cited at `:401`, actually at `:413` even on the PRE-t1970 tree — 12 lines of pre-existing drift, left alone
 * rather than guessed at). None of the four were ever promoted into TRAP_CLAIMS/INVARIANT_CLAIMS/Q3_CLAIMS, so
 * none of them were checked by anything in this file at t1996. Measured at t1996 (`grep -oE
 * "[A-Za-z0-9_/.-]+\.(js|mjs|md):[0-9]+"`): `ARCHITECTURE.md` carries 149 `file:line`-shaped citations total —
 * a raw pattern count, so it includes the same fact cited more than once across different sections, not 149
 * distinct claims. t1996 landed 52 (every TRAP/INVARIANT/Q3); t2004 landed the REGISTRIES table (10 more, 62
 * total) — verifying each one against CURRENT source turned up two real, reported findings (see the REGISTRY_CLAIMS
 * comment above): several stale line numbers (claim true, number drifted) and one WRONG TARGET (`panelTypes.js:267`
 * pointed at unrelated code, re-anchored to `:292`), fixed in ARCHITECTURE.md's own prose rather than silently
 * re-pointed. The remaining ~87 are Q1/Q2 diagram annotations, "KNOWN DIVERGENCE", "WHERE THE GATES ARE", and
 * "UNVERIFIED" — bringing them under this mechanism needs the same individual "read the current line, pick a
 * genuinely unique anchor" treatment each prior batch got; sized and named as remaining work, not attempted this
 * turn (t2004's own WORK-LOG entry lists exactly which sections and why the boundary landed here). **Stated
 * plainly: those ~87 remain unenforced prose.** A future citation earns enforcement here the moment it graduates
 * into a named TRAP or INVARIANT (the existing scope rule, unchanged) — that is the honest boundary, not
 * "eventually, someday."
 *
 * ── NON-VACUITY (done by hand against a scratch copy, not as a permanent test — see WORK-LOG t1698 + t1996) ─────
 * t1698's own original proof: a citation moved in a scratch copy of a real source file, pointed the checker at
 * the scratch copy, confirmed it failed NAMING the exact claim, restored. t1996 re-proved the SAME mechanism
 * under the new substring+uniqueness design, twice: (1) moved a cited line within its own file (the citation
 * still found it, wherever it landed — proving line-independence); (2) deleted the cited content entirely (the
 * checker reported 0 matches, by name); (3) duplicated a cited line so it appeared twice (the checker reported
 * 2 matches, by name, as a DIFFERENT failure reason than 0). All three against a scratch copy, restored after.
 * Proven once for the mechanism, not once per citation — see WORK-LOG t1996 for the exact commands run.
 *
 * ── t2006 — THE MAP RESTATES ITS OWN CHECKED FACTS. THAT IS A SECOND SOURCE, NOT A COVERAGE GAP ──────────────────
 * t2004 found INV6's own PROSE (`userOps.js:893-900`) still stale a full turn after its machine-checked twin (INV6,
 * above) was correctly re-anchored to `:917`. The checker got fixed; the prose a few sections away never caught
 * up — because it is a SEPARATE, independent restatement of the same fact, not a reference to the checked one.
 * Measured (proximity-correlated every one of the 62 already-checked claims — TRAP/INVARIANT/Q3/REGISTRY —
 * against all 149 raw citations in ARCHITECTURE.md, then hand-confirmed the close matches, since same-file
 * proximity alone over-counts in dense files like `userOps.js`/`panelTypes.js`/`featureCanvas.js` where several
 * DISTINCT facts sit within a few dozen lines): at least 4 facts among the 62 are independently restated in 2-3
 * SEPARATE named sections of the document (9+ total citation sites for those 4 alone) — `BUILTINS`/`opensAs`
 * (Q1's own diagram AND its own prose line AND the REGISTRIES row — ironically inside a box literally labelled
 * "THE ONE DECLARATION"), `def.mouth`'s reader (REGISTRIES row + INVARIANT #1's own guard description), `_BASE_
 * DEF_SHAPE`/`hookKeysOf` (REGISTRIES row + INVARIANT #6, the t2004 finding), and the WebGL canvas's in-flow
 * append (Q3's own diagram + TRAP8). Likely more beyond these 4 — the proximity tool flagged ~126 candidate close
 * citations across the 62 claims before hand-filtering; only these 4 were individually confirmed as genuinely the
 * SAME fact rather than a nearby-but-different one, so this is a measured FLOOR, not an exhaustive count.
 *
 * A related, adjacent finding: even PART 1's own GENERATED test hardcodes `wizLib.slice(41, 81)` for BUILTINS —
 * a FIFTH copy of the same "42-81" fact, this time as functional test logic rather than prose (if the array ever
 * moves, this slice would silently read the wrong byte range rather than erroring). Named here, not fixed this
 * turn — regex-based extraction (matching `SEED_BUILDERS`'s own approach two lines below it) would remove the
 * dependency but is a separate, scoped change.
 *
 * THE DESIGN CALL: prose should REFERENCE a claim already machine-checked elsewhere (by section/id, e.g. "see
 * § THE REGISTRIES") rather than RESTATE its file:line and count independently — one canonical prose home per
 * fact, backed by the checker, instead of N independent copies that can only individually go stale or be
 * individually fixed. Argued, not asserted: a bare restated line number is EXACTLY the shape of "two sources
 * that both fail loudly instead of one that can't" (t2006's own dispatch) — fixing one copy after a drift, as
 * t1996/t2004 both did, does nothing for its siblings, which is how INV6's prose survived stale through an entire
 * turn that fixed the identical fact three sections away.
 *
 * THE COST, ARGUED HONESTLY RATHER THAN ASSUMED AWAY: a reader who has ARCHITECTURE.md open WITHOUT this test
 * file loses the immediate "jump to this exact line" convenience at the REFERENCING site — they must follow the
 * pointer to the fact's ONE canonical home (a named section, not a bare id — an id alone means nothing without
 * this file open) to get the real file:line. This is a real, not hypothetical, cost for a document whose own
 * header promises "a `file:line` you can check in one jump." The trade only pays for itself where a fact is
 * ALREADY independently checked elsewhere AND restated at least once more — for a fact cited exactly ONCE,
 * referencing would just relocate the citation for no gain, so this is NOT a blanket rule for all 149 citations,
 * only for the CONFIRMED restatements.
 *
 * WORKED EXAMPLE LANDED (t2006, one section — not a migration): Q1's own "THE ONE DECLARATION" diagram
 * box and its neighbouring "BUILTINS = 25 entries; ALL 25 declare opensAs" prose line no longer restate
 * `wizardLibrary.js:42-81` / the 25/25 counts — both now point to "§ THE REGISTRIES" by name, where the
 * `REG BUILTINS bar+opensAs registry` claim above (and PART 1's own GENERATED count test) already own the fact.
 * ARCHITECTURE.md's own text still names WHERE to look (a section header, not a bare test id) — the cost above,
 * paid deliberately for the one fact t2006 confirmed genuinely restated three times.
 *
 * ── t2008 — THE OTHER 3 CONFIRMED DUPLICATES CONVERTED, AND THE MOST DANGEROUS COPY FIXED ─────────────────────────
 * All three remaining t2006-confirmed restatements now reference instead of restate, each carrying a NAMED section
 * PLUS what it asserts (not a bare cross-reference — t2006's own condition for keeping "one jump" real):
 *   - `def.mouth`'s reader: the REGISTRIES row now says "see INVARIANT #1" instead of restating `bridge.js:78` —
 *     INVARIANT #1 (already machine-checked as `INV1 mouth reader`) is the canonical home.
 *   - `_BASE_DEF_SHAPE`/`hookKeysOf`: INVARIANT #6's own guard line now says "see § THE REGISTRIES" instead of
 *     restating `userOps.js:917-924` — REGISTRIES (already machine-checked as `REG hookKeysOf export`, plus INV6
 *     itself for `_BASE_DEF_SHAPE`) is the canonical home. This is the exact fact whose stale copy started this
 *     whole design turn (t2004) — it is the one where "keep both in sync by hand" was tried once already and
 *     failed, so removing the second copy (not re-syncing it) is the point.
 *   - The WebGL canvas's in-flow append: Q3's own diagram now says "see § TRAPS #8" instead of restating
 *     `gcodeViz3d.js:68` — TRAP8 (already machine-checked) is the canonical home.
 * All 4 confirmed duplicates from t2006 are now single-sourced. The wider Q1/Q2 sweep for MORE duplicates beyond
 * these 4 is still not attempted — named, sized, and left for whoever picks up the recommendation next (see
 * WORK-LOG t2006 for the full per-section breakdown and reasoning, WORK-LOG t2008 for this turn's).
 *
 * THE FIFTH COPY, FIXED FIRST BECAUSE IT WAS THE MOST DANGEROUS: PART 1's own GENERATED test (below) used to
 * hardcode `wizLib.slice(41, 81)` for BUILTINS and `viewsIndex.slice(34, 48)` for WIZARD_VIEWS — copies of the
 * SAME two facts, but as TEST LOGIC rather than prose, and the more dangerous kind: a shifted array does not fail
 * loudly, it silently reads the WRONG byte range. Both replaced with regex extraction (matching `SEED_BUILDERS`'
 * own sibling two lines below, already line-independent). PROVEN, not assumed: shifted a scratch copy of each
 * source file by inserting lines before the array (content unchanged, only its position moved) and compared both
 * forms' output — `BUILTINS` unshifted: OLD 25/25, NEW 25/25 (agree); shifted by 10 lines: OLD read **18/18**
 * (silently wrong — the hardcoded slice grabbed the wrong 40 lines), NEW still read **25/25** (correct, found the
 * array wherever it moved). `WIZARD_VIEWS` unshifted: OLD 14, NEW 14; shifted by 7 lines: OLD read **7** (silently
 * wrong), NEW still read **14**. Neither real source file was touched for this proof — pure scratch-copy string
 * manipulation, restored nowhere because nothing on disk was ever changed.
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
// t1996 (Option B) — THE ASSERTED-citation check, whole-file, uniqueness-required. `find` (a literal substring,
// or occasionally a narrow RegExp for a hand-written claim that genuinely needs one — see INV12/INV15) is tested
// against EVERY line of the file independently (never across a line break — a citation names one real line of
// source, not a multi-line span glued together). Returns the 1-based line numbers of every match, so a caller
// can report "0 matches" (rotted/deleted) and "2+ matches" (not a unique anchor) as the two DIFFERENT failure
// reasons the mandatory uniqueness requirement exists to distinguish — collapsing them into one boolean is
// exactly the weaker check dropping the line number without this requirement would have produced.
function citationMatchLines(absPath, find) {
    const ls = linesOf(absPath);
    const re = find instanceof RegExp ? find : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const out = [];
    for (let n = 1; n <= ls.length; n++) {
        const line = ls[n - 1];
        if (line != null && re.test(line)) out.push(n);
    }
    return out;
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
    // BUILTINS: 25 entries, 25 with opensAs (§ THE REGISTRIES / REG BUILTINS bar+opensAs registry, above)
    // t2008 — this used to hardcode `wizLib.slice(41, 81)`, a SIXTH copy of the "42-81" fact (t2006's own count),
    // and the most dangerous one: a shifted array would silently slice the WRONG byte range instead of failing
    // loudly, exactly the risk t2006 named and did not fix. Extracted by regex now, matching SEED_BUILDERS' own
    // sibling extraction 12 lines below — line-independent, so a moved array is still found, wherever it lands.
    const wizLibText = fs.readFileSync(path.join(WEB, 'blocks/wizardLibrary.js'), 'utf8');
    const builtinsMatch = wizLibText.match(/const BUILTINS = \[([\s\S]*?)\n\];/);
    must('wizardLibrary.js no longer declares `const BUILTINS = [...]` at all — the registry ARCHITECTURE.md cites moved',
        () => expect(!!builtinsMatch).toBe(true));
    const builtinsBlock = builtinsMatch[1];
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

    // WIZARD_VIEWS: 14 entries (t1730 — middle/rotary_center/rotary_clock/edge/alignment/homing retired, 20→14)
    // t2008 — same fix as BUILTINS above: was `viewsIndex.slice(34, 48)`, a hardcoded line range that would
    // silently slice the wrong block if the array ever moved. Regex-extracted now, line-independent.
    const viewsText = fs.readFileSync(path.join(WEB, 'wizards/views/index.js'), 'utf8');
    const viewsMatch = viewsText.match(/export const WIZARD_VIEWS = \[([\s\S]*?)\n\];/);
    must('wizards/views/index.js no longer declares `export const WIZARD_VIEWS = [...]` at all — the registry ARCHITECTURE.md cites moved',
        () => expect(!!viewsMatch).toBe(true));
    const viewCount = (viewsMatch[1].match(/^\s{4}\w+View,$/gm) || []).length;
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
// t1996 (Option B) — every `find` below is the FULL TRIMMED SOURCE LINE of the cited claim (a hand-shortened
// unique fragment where the full line was unwieldy), verified whole-file-unique against the tree at the point
// this turn landed. No `line`/`lineEnd` — the substring IS the citation now; see the header comment for why.
const TRAP_CLAIMS = [
    { id: 'TRAP1 Corner view import gone', file: 'web/wizards/views/index.js', find: '// Corner wizard retired 2026-07-02 (④) — REPLACED by the "Corner (data)" twin (user_corner_data, the generic user-op view).' },
    { id: 'TRAP1 Corner opensAs the twin', file: 'web/blocks/wizardLibrary.js', find: "{ id: 'corner', type: 'corner', label: 'Corner', icon: '📐', group: 'probe', opensAs: 'user_corner_data' }," },
    { id: 'TRAP1 cornerWizard.js import (cornerData.js:44)', file: 'web/blocks/dataOps/cornerData.js', find: "import { cornerStack, cornerReposOffsets, dirsOf, cornerHeaderComments } from '../../wizards/stacks/cornerWizard.js';" },
    { id: 'TRAP1 cornerStack() usage (cornerData.js:261)', file: 'web/blocks/dataOps/cornerData.js', find: 'const exec = cornerStack(params, { superset: true });' },
    { id: 'TRAP2 the overlay never folds placement before t1686 fix (getTransform)', file: 'web/viz/featureCanvas.js', find: 'getTransform() {' },
    { id: 'TRAP2 the crosshair went through _S not _disp (spec.origin)', file: 'web/wizards/ops/panelTypes.js', find: 'const _lathe = latheLayoutSpec(def, params, (m, opts) => { for (const k in m) _writeParam(k, m[k], opts); });' },
    { id: 'TRAP3 the declared _writable replacement', file: 'web/wizards/ops/panelTypes.js', find: 'const _writable = (name) => _declaredParams.has(name) && !_unwritable.has(name) && (!_host || !!_field(name));' },
    { id: 'TRAP4 RESOLVED — activeDialectOpts returns {dialect} only now, matching the three copies below', file: 'web/wizards/previewEmit.js', find: 'try { return { dialect: resolveActivePost(getActiveProfile().id) }; } catch (_) { return {}; }' },
    { id: 'TRAP4 programModel.js keeps its own {dialect}-only copy', file: 'web/blocks/programModel.js', find: 'function dialectOpts() { try { return { dialect: resolveActivePost(getActiveProfile().id) }; } catch (_) { return {}; } }' },
    { id: 'TRAP4 opGlow.js keeps its own {dialect}-only copy', file: 'web/blocks/opGlow.js', find: 'const dialectOpts = () => { try { return { dialect: resolveActivePost(getActiveProfile().id) }; } catch (_) { return {}; } };' },
    { id: 'TRAP4 opSession.js keeps its own {dialect}-only copy', file: 'web/blocks/opSession.js', find: 'const dialectOpts = () => { try { return { dialect: resolveActivePost(getActiveProfile().id) }; } catch (_) { return {}; } };' },
    { id: 'TRAP4 RESOLVED — the emit is unconditionally flush-left now, no settings, no per-dialect branch (t2141 — a dependency-free leaf, not inline in blockEmitter.js any more)', file: 'web/data/gcodeSyntaxGuards.js', find: "for (const t of T) if (t && typeof t.line === 'string') t.line = t.line.replace(/^[ \\t]+/, '');" },
    { id: 'TRAP4 t2141 CLOSED — the CAM slot-macro path applies both guards too, at the slotMacro boundary, on the fully-composed body, defaulting to the DDCS gate so camN.nc stays dialect-resolution-free', file: 'web/data/slotPack.js', find: "export function slotMacro(slot, dialect = DDCS_GATE) {" },
    { id: 'TRAP5 canEdit reads paramFields', file: 'web/wizardManager.js', find: 'canEdit(opType) {' },
    { id: 'TRAP5 FIELD_BIND.corner folded at opSchema.js', file: 'web/blocks/opSchema.js', find: "corner: { corner: 'c_corner', probeZ: 'c_probe_z_first', syncA: 'c_sync_a', slave: 'c_slave'" },
    { id: 'TRAP6 commData.js passes setup_datawiz', file: 'web/blocks/dataOps/commData.js', find: "const def = userOpFromStack('comm_data', 'Communication (data)', commDataStack(), bindings, 'commscreen', {}, 'setup_datawiz');" },
    { id: 'TRAP6 homingData.js passes setup_datawiz', file: 'web/blocks/dataOps/homingData.js', find: "const def = userOpFromStack('homing_data', 'Homing (data)', homingDataStack(HOMING_DEFAULTS), [...HOMING_STRUCT_BINDINGS], 'form3d+2d', { forceMachine: true }, 'setup_datawiz');" },
    { id: 'TRAP6 GROUPS declares only probe/atc/mill _datawiz', file: 'web/blocks/wizardLibrary.js', find: "{ id: 'probe_datawiz', label: 'Probe Data Wiz', section: 'right' }," },
    { id: 'TRAP7 commandDeck stamps type||opensAs||id', file: 'web/ui/commandDeck.js', find: 'return `${sub}<button data-optype="${_escHtml(e.type || e.opensAs || e.id || \'\')}" onclick="${wizItemOnclick(e)}">${wizItemIcon(e)}${_escHtml(e.label)}</button>`;' },
    { id: 'TRAP8 the stale z-index comment', file: 'web/viz/createPreviewPanel.js', find: '// The 3D renderer canvas is z-index 2 (above the 2D canvas), so 2D must HIDE it, not just show the 2D' },
    { id: 'TRAP8 .attach( only caller is the retired bak file', file: 'web/viz/gcodeViz3d.js', find: 'attach(container) {' },
    { id: 'TRAP8 the WebGL canvas is appended in flow', file: 'web/viz/gcodeViz3d.js', find: 'container.appendChild(renderer.domElement);' },
    { id: 'TRAP9 (fixed t1816) renderLayout2D caches FeatureCanvas per container', file: 'web/wizards/ops/panelTypes.js', find: 'const layout = container.__layout || (container.__layout = new FeatureCanvas());' },
    { id: 'TRAP9 _mount wipes container.innerHTML', file: 'web/viz/featureCanvas.js', find: "container.innerHTML = '';" },
    { id: 'TRAP9 renderDeclaredLayout has zero live callers (userOpView.js:661)', file: 'web/wizards/views/userOpView.js', find: 'const fc = renderLayout2D(c, _def, params, simStart, sources, passEnds, _layoutSpots, setSpots, ps, simMarkers);   // t301 Seam C + t508 simMarkers (declared marker→param handles)' },
];

test('architecture map ASSERTED: every TRAP citation still holds, uniquely', () => {
    const wrong = [];
    for (const c of TRAP_CLAIMS) {
        const abs = path.join(DDCS, c.file);
        try {
            const lines = citationMatchLines(abs, c.find);
            if (lines.length === 0) wrong.push(`${c.id} — ${c.file}: NOT FOUND anywhere (rotted, or the trap was fixed and the map should say so) — ${c.find}`);
            else if (lines.length > 1) wrong.push(`${c.id} — ${c.file}: matches ${lines.length}× (lines ${lines.join(', ')}) — not a unique anchor, tighten the pattern — ${c.find}`);
        } catch (e) { wrong.push(`${c.id} — ${e.message}`); }
    }
    must('a TRAP citation rotted or stopped being unique — the substring ARCHITECTURE.md points at either no longer exists (the citation needs updating, or the TRAP ITSELF is stale and the map should say so) or now matches more than once (tighten the pattern). Read the diff at that location before deciding which.',
        () => expect(wrong).toEqual([]));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 3 — ASSERTED: every INVARIANT citation still holds
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// t1996 (Option B) — same convention as TRAP_CLAIMS above: `find` is the full trimmed source line (or a hand-
// shortened unique fragment), no `line`/`lineEnd`, checked whole-file, required to match exactly once.
// `INV8 validateUserOp fork-arm check` was RE-ANCHORED, not merely re-verified: its old citation (userOps.js:746,
// find:/./ — a trivial always-true placeholder) pointed at a DIFFERENT function entirely and had never actually
// checked anything. The real claim — "the fork-arm check is asserted silent rather than deleted" — lives at
// userOps.js:861 today; see the header comment for the full account.
const INVARIANT_CLAIMS = [
    // t2333 — re-anchored, not merely re-verified: was `carries ${rec.children.length} children` (mouthOf reader) —
    // t2319's own childrenOf fix to this throw's own text, and t2333's own mouthOf→mouthsOf generalization, both
    // landed without this citation being updated at the time. Real text/reader confirmed live at their current lines.
    { id: 'INV1 mouth guard throws by name', file: 'web/blocks/blockly/stackBridge.js', find: 'carries ${childrenOf(rec.children).length} children but its def declares no' },
    { id: 'INV1 mouth reader', file: 'web/blocks/blockly/bridge.js', find: 'export const mouthsOf = (def) => def.mouths || (def.mouth ? [{ name: def.mouth, label: null }] : []);' },
    { id: 'INV1 the fifth, deliberately-left kind list', file: 'web/blocks/blockEmitter.js', find: "if (['container', 'path', 'loop', 'cond', 'depth', 'fill', 'place', 'rotate', 'skim', 'guard'].includes(def.kind)) b.children = [];" },
    { id: 'INV2 leaf record fields declared-or-throw', file: 'web/blocks/blockly/stackBridge.js', find: 'carries an undeclared top-level field "${k}"' },
    { id: 'INV3 subscriber isolation logs, never swallows', file: 'web/blocks/programModel.js', find: "subs.forEach((fn) => { try { fn({ stack, proj, origin }); } catch (e) { console.error('[programModel] a subscriber threw:', e); } });" },
    { id: 'INV4 CLEAN_SHAPES', file: 'DDCS-Studio/tests/node/declared-key-coverage-1678.test.mjs', find: 'const CLEAN_SHAPES = [' },
    { id: 'INV5 KNOWN GAP part 2 is empty by design', file: 'DDCS-Studio/tests/node/declared-key-coverage-1678.test.mjs', find: '// ── PART 2 — KNOWN GAPS. The t1678 census found three live, evidence-backed findings and reported them for their' },
    { id: 'INV6 hookKeysOf derives from one real constructor call', file: 'web/blocks/userOps.js', find: "const _BASE_DEF_SHAPE = new Set(Object.keys(userOpFromStack('__probe__', 'probe', [], [], 'form3d', { probe: true }, 'probe')));" },
    { id: 'INV7 getTransform folds placement', file: 'web/viz/featureCanvas.js', find: 'getTransform() {' },
    { id: 'INV7 onTransform relays the same composed value', file: 'web/viz/featureCanvas.js', find: 'if (this._onTransform && this._tf) this._onTransform(this.getTransform(), VW, VH);   // t309 — re-pin the animation overlay to the current transform (this is the ONE place all pan/zoom/fit/resize/render land)' },
    { id: 'INV8 fork-parity byte-identity gate exists', file: 'DDCS-Studio/tests/fork-parity-1593.spec.js', find: "import { test, expect } from '@playwright/test';" },
    { id: 'INV8 validateUserOp fork-arm check', file: 'web/blocks/userOps.js', find: '// ⚠ THIS CHECK STAYS, AND IS EXPECTED TO BE SILENT. It is what noticed the loss in the first place, and it is' },
    { id: 'INV10 fork-parity typed sweep', file: 'DDCS-Studio/tests/fork-parity-1593.spec.js', find: "import { test, expect } from '@playwright/test';" },
    { id: 'INV11 UPDATE_PREVIEW_SNAPSHOT rewrites and throws', file: 'DDCS-Studio/tests/node/preview-spec-gate-1688.test.mjs', find: 'if (process.env.UPDATE_PREVIEW_SNAPSHOT) {' },
    { id: 'INV12 tri-state fill: emits !== false', file: 'web/viz/startGlyph.js', find: 'fill: emits !== false,' },
    { id: 'INV12 pass 0 is manual regardless of source', file: 'web/viz/startGlyph.js', find: "return pass === 0 || source === 'manual';" },
    { id: 'INV13 FAIL CLOSED return null', file: 'web/blocks/userOps.js', find: 'if (!blk || !blk.params || !(c.key in blk.params)) return null;   // FAIL CLOSED (see above)' },
    { id: 'INV14 postInstantiate ordering', file: 'web/blocks/userOps.js', find: "return (typeof def.postInstantiate === 'function') ? def.postInstantiate(stack, resolved) : stack;" },
    // NEXT-SESSION.md is rewritten wholesale each cycle (advisor-owned) — anchored by content, not a position;
    // whole-file uniqueness is exactly what a line number could never have expressed for a file like this one.
    { id: 'INV15 corner is the gated pilot, standing ruling', file: 'NEXT-SESSION.md', find: '- **Corner is the gated pilot** — no wizard ports until corner is right.' },
    { id: 'INV17 AGENTS.md one commit one concern', file: 'AGENTS.md', find: '### 4. One commit, one concern' },
    { id: 'INV17 AGENTS.md trace consumers before cleanup', file: 'AGENTS.md', find: '### 5. Do not "clean up" code you have not traced' },
];

test('architecture map ASSERTED: every INVARIANT citation still holds, uniquely', () => {
    const wrong = [];
    for (const c of INVARIANT_CLAIMS) {
        const abs = path.isAbsolute(c.file) ? c.file
            : c.file.startsWith('DDCS-Studio/') ? path.join(REPO_ROOT, c.file)
            : !c.file.includes('/') ? path.join(REPO_ROOT, c.file)   // bare filename (AGENTS.md, NEXT-SESSION.md, …) = repo-root doc
            : path.join(DDCS, c.file);
        try {
            const lines = citationMatchLines(abs, c.find);
            if (lines.length === 0) wrong.push(`${c.id} — ${c.file}: NOT FOUND anywhere (rotted, or the guard was fixed/moved and the map should say so) — ${c.find}`);
            else if (lines.length > 1) wrong.push(`${c.id} — ${c.file}: matches ${lines.length}× (lines ${lines.join(', ')}) — not a unique anchor, tighten the pattern — ${c.find}`);
        } catch (e) { wrong.push(`${c.id} — ${e.message}`); }
    }
    must('an INVARIANT citation rotted or stopped being unique — the guard ARCHITECTURE.md names either no longer lives where it says, or the substring now matches more than one place. An invariant whose guard has moved or disappeared is worse than a stale trap: someone will trust the rule is still enforced.',
        () => expect(wrong).toEqual([]));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PART 4 — ASSERTED: Q3's frame-algebra citations (the single most expensive defect class this session's WORK-LOG
// records — t1672/t1686's ~275px split — so its exact citations are checked even though the rest of Q3's prose
// is diagram, not claim-per-line)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// t1996 (Option B) — same convention: full trimmed source line, no `line`/`lineEnd`, whole-file, exactly once.
const Q3_CLAIMS = [
    { id: 'Q3 _disp folds placement', file: 'web/viz/featureCanvas.js', find: '_disp(x, y) { const p = this._placement || { x: 0, y: 0 }; return this._S(x + (p.x || 0), y + (p.y || 0)); }' },
    { id: 'Q3 placement assigned at _draw', file: 'web/viz/featureCanvas.js', find: 'this._placement = spec.placement || { x: 0, y: 0 };   // pattern items/handles ride this; stock is datum-fixed' },
    { id: 'Q3 overlay tx() reads view.ox', file: 'web/viz/toolpath2d.js', find: 'const tx = (x) => view.ox + x * view.scale;' },
    { id: 'Q3 partZeroShift is the ONE declared transform', file: 'web/viz/sceneFrame.js', find: 'export function partZeroShift(machine, stock, stockFloorZ) {' },
    { id: 'Q3 stockPinOffset — a DIFFERENT number', file: 'web/viz/sceneFrame.js', find: 'export function stockPinOffset(machine, stock) {' },
    { id: 'Q3 placeShiftFromParams / PlaceOnStock attach shift', file: 'web/wizards/ops/placement.js', find: 'export function placeShiftFromParams(p = {}, liveBbox = null) {' },
    { id: 'Q3 lathe spec carries no placement key (early-return)', file: 'web/wizards/ops/panelTypes.js', find: 'const _lathe = latheLayoutSpec(def, params, (m, opts) => { for (const k in m) _writeParam(k, m[k], opts); });' },
];

test('architecture map ASSERTED: Q3 frame-algebra citations still hold (the highest-cost defect class), uniquely', () => {
    const wrong = [];
    for (const c of Q3_CLAIMS) {
        const abs = path.join(DDCS, c.file);
        try {
            const lines = citationMatchLines(abs, c.find);
            if (lines.length === 0) wrong.push(`${c.id} — ${c.file}: NOT FOUND anywhere — ${c.find}`);
            else if (lines.length > 1) wrong.push(`${c.id} — ${c.file}: matches ${lines.length}× (lines ${lines.join(', ')}) — not a unique anchor — ${c.find}`);
        } catch (e) { wrong.push(`${c.id} — ${e.message}`); }
    }
    must('a Q3 frame-algebra citation rotted or stopped being unique — this is the exact class of coordinate bug (t1672/t1686) the map exists to prevent a THIRD occurrence of',
        () => expect(wrong).toEqual([]));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// t2004 — THE REGISTRIES TABLE, the first slice of the ~97 "remaining unenforced prose" citations named at t1996.
// Same Option B convention (full trimmed source line, whole-file, exactly once). Every row of the REGISTRIES table
// that names an actual `file:line` fact is here EXCEPT "guard predicate shape" (informational: GUARD_FIELDS is
// verified accurate but the row states no trap a reader acts on beyond what INV1's own guard already backs) and
// "per-atom scratch vars" / "the posts" (cite a FILE, not a specific line/fact — nothing to substring-anchor).
// `_BASE_DEF_SHAPE` (userOps.js:917) is already enforced by INV6 above — not duplicated here, only its PROSE line
// number in this table's own row was stale and got fixed in ARCHITECTURE.md alongside `hookKeysOf`'s.
//
// VERIFIED, NOT ASSUMED: read every cited line's CURRENT content against the claim before writing a `find` string.
// Two real findings, both reported and fixed in ARCHITECTURE.md's own prose (not silently re-pointed):
//   - STALE LINES (drift, the claim itself still true): `web/app.js:101-108` → actually 100-107 (SEED_BUILDERS);
//     `app.js:99-100` → actually 98-99 (its own export-reason comment); `wizards/views/index.js:35-48` → actually
//     34-48 (WIZARD_VIEWS starts one line earlier); `stackBridge.js:23`/`:35` → actually `:24`/`:36`
//     (DURABLE_DATA_FIELDS/KNOWN_LEAF_RECORD_FIELDS); `userOps.js:900` → actually `:924` (`hookKeysOf`, the SAME
//     +24-ish shift t1996 already found on this file's neighbouring `_BASE_DEF_SHAPE` citation).
//   - ONE WRONG TARGET, not mere drift: `panelTypes.js:267` (claimed as MULTI_WIDGETS' reader) is CORNER-MARKER-
//     INDEPENDENCE code — nothing to do with `MULTI_WIDGETS`. The real reader (the `.has()` check `renderUnit`'s
//     own comment at `:283-284` describes) is at `:292`. Re-anchored there; ARCHITECTURE.md's own prose corrected
//     with a note, matching the INV8 precedent (t1996) rather than silently moved.
const REGISTRY_CLAIMS = [
    { id: 'REG BUILTINS bar+opensAs registry', file: 'web/blocks/wizardLibrary.js', find: 'const BUILTINS = [' },
    { id: 'REG SEED_BUILDERS data-twin registry', file: 'web/app.js', find: 'export const SEED_BUILDERS = [' },
    { id: 'REG SEED_BUILDERS export reason (sweep the registry, not a hand list)', file: 'web/app.js', find: 'rather than a hand-typed parallel list that a new twin could silently fall out of.' },
    { id: 'REG WIZARD_VIEWS coded-view registry', file: 'web/wizards/views/index.js', find: 'export const WIZARD_VIEWS = [' },
    // t2333 — re-anchored: mouthOf (singular-only) replaced by mouthsOf, which also reads the plural def.mouths
    // a multi-mouth kind (split_horizontal/split_vertical) declares.
    { id: 'REG def.mouth/def.mouths reader (which kinds hold children)', file: 'web/blocks/blockly/bridge.js', find: 'export const mouthsOf = (def) => def.mouths || (def.mouth ? [{ name: def.mouth, label: null }] : []);' },
    { id: 'REG DURABLE_DATA_FIELDS (Blockly round-trip survivors)', file: 'web/blocks/blockly/stackBridge.js', find: "const DURABLE_DATA_FIELDS = ['modalPre', '_expose'];" },
    { id: 'REG KNOWN_LEAF_RECORD_FIELDS', file: 'web/blocks/blockly/stackBridge.js', find: "const KNOWN_LEAF_RECORD_FIELDS = new Set(['id', 'type', 'params', 'children', 'uiChildren', 'collapsed', 'disabled', 'comment', '_group', ...DURABLE_DATA_FIELDS]);" },
    { id: 'REG hookKeysOf export (what counts as a hook)', file: 'web/blocks/userOps.js', find: 'export const hookKeysOf = (def) => Object.keys(def || {}).filter(isHookKey);' },
    { id: 'REG GUARD_FIELDS (guard predicate shape)', file: 'web/wizards/ops/guard.js', find: "export const GUARD_FIELDS = ['whenparam', 'whenis', 'whentype'];" },
    { id: 'REG MULTI_WIDGETS reader in panelTypes (re-anchored, was wrong target)', file: 'web/wizards/ops/panelTypes.js', find: 'if (unit.length > 1 && MULTI_WIDGETS.has(unit[0] && unit[0].widget)) for (const b of unit) _unwritable.add(b.param);' },
    { id: 'REG kindFirst — lathe group leads the bar', file: 'web/blocks/wizardLibrary.js', find: 'const kindFirst = (ids) => {' },
];

test('architecture map ASSERTED: every REGISTRIES-table citation still holds, uniquely', () => {
    const wrong = [];
    for (const c of REGISTRY_CLAIMS) {
        const abs = path.join(DDCS, c.file);
        try {
            const lines = citationMatchLines(abs, c.find);
            if (lines.length === 0) wrong.push(`${c.id} — ${c.file}: NOT FOUND anywhere (rotted, or the registry was renamed/removed and the map should say so) — ${c.find}`);
            else if (lines.length > 1) wrong.push(`${c.id} — ${c.file}: matches ${lines.length}× (lines ${lines.join(', ')}) — not a unique anchor, tighten the pattern — ${c.find}`);
        } catch (e) { wrong.push(`${c.id} — ${e.message}`); }
    }
    must('a REGISTRIES-table citation rotted or stopped being unique — this table exists specifically so a reader NAMES the declaration instead of copying it; a stale name is worse than no name',
        () => expect(wrong).toEqual([]));
});
