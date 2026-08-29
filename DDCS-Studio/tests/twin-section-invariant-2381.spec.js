import { test, expect } from '@playwright/test';

/**
 * t2381 — THE SECTION-METADATA INVARIANT, declared ONCE, table-driven, over EVERY registered twin.
 *
 * t2375/t2377 fixed section metadata one wizard at a time, each against its own live shell (the mill family).
 * t2379 found six more wizards (corner/edge/middle/alignment/rotary_center/rotary_clock) whose shells are
 * RETIRED — no live oracle exists, so "reproduce the shell" cannot apply, yet every one of them already
 * carries COMPLETE section metadata drawn from the SAME three canonical names formWidgets.js's own
 * `SECTION_RANK` declares (`['IDENTITY','GEOMETRY','TOOL & CUT']`, t1239). That is not a per-wizard property —
 * it is a REGISTRY-WIDE invariant: "every binding a flat-mode form renders carries a section, and where no
 * live shell dictates otherwise, that section is one of SECTION_RANK's own three." Declared here ONCE, so it
 * covers the mill family already fixed, catches every FUTURE twin automatically, and never needs a 7th/8th/
 * 33rd per-wizard file.
 *
 * ⛔ NOT A HARD GATE OF "ZERO EXCEPTIONS" — because that would be false. Two entire classes of twin
 * LEGITIMATELY diverge, and the invariant says so explicitly rather than silently widening to swallow them:
 *
 *   1. TREE-MODE twins (`hasTreeLayout(def.template)` true — currently only `user_drill_data`): their live
 *      render routes through `renderUiTree`'s own explicit `uiChildren` placement, not `renderOpForm`'s
 *      `section:`-driven boxing — `.section` is not their placement mechanism, so an "unsectioned" binding
 *      there is not a gap, it is a DIFFERENT MECHANISM achieving the same grouping. Exempted from the
 *      completeness check entirely, not asserted "complete" under a mechanism it doesn't use.
 *   2. SHELL-DRIVEN vocabulary: a twin with a LIVE shell must reproduce THAT shell's own section names
 *      (t2375's/t2377's own governing rule — "the shell decides, every time"), which are frequently NOT
 *      SECTION_RANK's three (contour's `SHAPE`/`SIDE & TOOL`, slot's `ENDPOINTS`/`TOOL & WIDTH`, etc. — all
 *      verified against their real shells already). Widening `SECTION_RANK`'s own canonical list to include
 *      every shell's own vocabulary would make the vocabulary check vacuous for everyone; naming each
 *      diverging twin explicitly keeps the check meaningful for every twin NOT on the list.
 *
 * Both exception lists are the KNOWN SET, asserted EXACTLY (t2299's/t2301's own `EXPECTED_ORPHANS` shape) —
 * closing one without shrinking the list here fails loudly (a stale exception), and a NEW twin that forgets
 * its own section metadata fails loudly too (an undeclared gap can't hide behind someone else's exception).
 * An invariant with a silent escape hatch is decoration, not a tripwire.
 *
 * ⭐ SURVEYED FIRST (t2381's own dispatch), reported below, BEFORE being made a hard gate — the numbers here
 * are the actual t2381 measurement across all 32 registered twins, not a guess:
 *
 *   14 CLEAN — complete AND canonical, no exception needed at all: atc_length, atc_check, corner, edge,
 *     middle, rotary_center, rotary_clock, alignment, homing, and all 5 lathe cutting ops (facing/odturn/
 *     parting/centerdrill/polygon).
 *   1 TREE-EXEMPT — drill (hasTreeLayout true; its own `.section` values, where present, are canonical and
 *     harmless, just not load-bearing for placement).
 *   12 VOCABULARY EXCEPTIONS — a live-shell-driven twin using its own shell's real names (contour/slot/
 *     surfacing/text — t2375/t2377; wcs — fixed and verified THIS SAME turn, wcs-form-reproduction-2381.spec.js
 *     — all five byte-for-byte confirmed against their real shells) OR a not-yet-ratcheted has-a-shell twin
 *     whose CURRENT vocabulary was never checked against its shell one way or the other (atc_test/atc_change/
 *     atc_table/comm) OR an unexplained divergence surfaced by this survey and not yet investigated (io_step's
 *     own `TYPE` — NO live shell per the advisor's own t2381 count, so unlike comm's `TYPE` this one has no
 *     shell to justify it; lathe_faceprobe/lathe_odprobe's own `PROBE` — no live shell either). Every one of
 *     the "not yet investigated" entries is commented as exactly that, not smoothed over as if it were
 *     already-verified like contour/slot/surfacing/text/wcs.
 *   5 COMPLETENESS EXCEPTIONS — a REAL absence, same class as the mill family's own pre-fix bug, left
 *     unfixed this turn because it is out of THIS turn's own dispatched scope (the probe-batch/registry-
 *     invariant turn, explicitly told not to start the ATC batch): atc_warmup_data (0/4 — has a live shell,
 *     a future ATC-turn fix), tap_data (2/20) and bore_data (25/37, both no live shell), pause_confirm
 *     (0/1, no live shell, likely moot — `sectionize` never triggers under 2 sections anyway), and
 *     **pocket_data (36/39 — entryX/entryY/toolNum unsectioned)**, the one genuine surprise: pocket was
 *     marked "ratcheted" at t2301, but that ratchet spec forces `renderUiTree` regardless of
 *     `hasTreeLayout()` (formReproduction.js's own documented, deliberate choice, matching drill's shape) —
 *     and `hasTreeLayout(pocketDataDef().template)` is actually FALSE, so pocket's REAL live render goes
 *     through flat mode, where these three fields render UNBOXED, outside every section — LIVE-CONFIRMED via
 *     `window.openWiz('user_pocket_data')` this same turn (the exact orphan-render symptom contour/surfacing/
 *     text had before their own fixes). The t2301 ratchet never caught it because it never exercises the
 *     path pocket's own users actually see. Flagged here, not fixed — pocket's own EXPECTED_ORPHANS-based
 *     tree-mode spec still passes (it tests a real, if not the live, mechanism); a real fix belongs to a
 *     turn that owns pocket, not a registry-wide invariant survey.
 *
 * ⭐ UPDATED t2383 (THE ATC BATCH) — the counts above are t2381's own snapshot; the exception lists below are
 * current. atc_warmup_data's own COMPLETENESS gap CLOSED (its shell has exactly one section, "WARM-UP
 * SEQUENCE" — added to all 4 bindings, no reorder needed). atc_test_data/atc_change_data/atc_table_data moved
 * from 'unverified' VOCABULARY exceptions to 'shell'-verified ones — each had invented section names its own
 * shell never uses (atc_test/atc_change each fabricated THREE names where the shell has exactly ONE; see
 * `atc-batch-form-reproduction-2383.spec.js`'s own header for the full per-wizard account, including a real
 * field-ORDER fix on atc_change, live-caught). atc_check_data gained a NEW vocabulary exception (`TOLERANCE`,
 * its one real shell field, corrected from the wrong `GEOMETRY`). atc_length_data stays CLEAN, untouched —
 * its shell has zero input fields for any of its bindings, so there was nothing to reproduce.
 */

const SECTION_RANK = ['IDENTITY', 'GEOMETRY', 'TOOL & CUT'];

// TREE-mode twins: `.section` is not their placement mechanism (renderUiTree's own uiChildren tree is).
// Exempt from the COMPLETENESS check. If this list ever needs a second entry, that is itself worth a look —
// today only drill's own uiChildren declares a real split_horizontal/split_vertical switch.
const TREE_MODE_TWINS = ['user_drill_data'];

// COMPLETENESS exceptions — a REAL, already-confirmed gap (a binding with no `section:` at all), out of
// THIS turn's own dispatched scope. Each carries the exact missing-param set as of t2381's own measurement —
// closing the gap (adding sections) must ALSO remove the entry here, or the exact-match assertion below
// catches the drift either way (a shrunk gap not reflected here, or a widened one).
const COMPLETENESS_EXCEPTIONS = {
    // no live shell (advisor's own t2381 count) — a real internal gap, not a shell-reproduction bug.
    user_tap_data: ['toolNum', 'wcs', 'stockAttach', 'pathDatum', 'stockDatum', 'stockW', 'stockH', 'stockZ', 'originX', 'originY', 'offZ', 'x', 'y', 'pitch', 'depth', 'rpm', 'dwell', 'rigid'],
    user_bore_data: ['toolNum', 'wcs', 'stockAttach', 'pathDatum', 'stockDatum', 'stockW', 'stockH', 'stockZ', 'originX', 'originY', 'pattern', 'skip'],
    // no live shell — a single field; `sectionize` never triggers under 2 named sections regardless, so this
    // is likely moot rather than urgent.
    user_pause_confirm: ['msg'],
    // t2381's OWN surprise finding: pocket was marked "ratcheted" at t2301, but that spec forces `renderUiTree`
    // regardless of `hasTreeLayout()` — and pocket's REAL live render is FLAT (hasTreeLayout() is false for
    // it), where these three (SHARED-deriver-sourced: toolNum from toolBindingsFor, entryX/entryY from
    // entryBindingsFor — the same trio contour/surfacing/text needed local .map() overrides for) render
    // UNBOXED. Live-confirmed via window.openWiz('user_pocket_data') this same turn. See this file's own
    // header comment for the full account.
    user_pocket_data: ['entryX', 'entryY', 'toolNum'],
};

// VOCABULARY exceptions — a twin using a section name OUTSIDE SECTION_RANK's own three, for one of two
// reasons, each labeled explicitly:
//   'shell'      — VERIFIED against a real, still-live shell (t2375/t2377's own governing rule: the shell
//                  decides). Byte-for-byte confirmed already; not re-litigated here.
//   'unverified' — a live shell exists but this vocabulary was never checked against it (a not-yet-ratcheted
//                  wizard, own future turn's job) OR no live shell exists and the divergence has NOT been
//                  investigated (flagged, not excused).
const VOCABULARY_EXCEPTIONS = {
    // t2383 — fixed THIS turn: the shell (index.html:917-940) declares exactly ONE section, "WARM-UP
    // SEQUENCE", verified byte-for-byte (atc-batch-form-reproduction-2383.spec.js). Also closed the same
    // twin's own COMPLETENESS exception (was 0/4, now 4/4) — see this file's own t2383 update note above.
    user_atc_warmup_data: { reason: 'shell', sections: ['WARM-UP SEQUENCE'] },
    user_contour_data: { reason: 'shell', sections: ['SHAPE', 'SIDE & TOOL', 'DEPTH & FEED'] },
    user_slot_data: { reason: 'shell', sections: ['ENDPOINTS', 'TOOL', 'TOOL & WIDTH', 'DEPTH & FEED'] },
    user_surfacing_data: { reason: 'shell', sections: ['AREA', 'TOOL', 'TOOL & STEPOVER', 'DEPTH & FEED'] },
    user_text_data: { reason: 'shell', sections: ['TEXT', 'TOOL', 'TOOL & FILL', 'DEPTH & FEED'] },
    // t2383 — fixed THIS turn: the shell (index.html:1036-1074) declares exactly ONE section ("ATC
    // COMMISSIONING TEST"), verified byte-for-byte (atc-batch-form-reproduction-2383.spec.js).
    user_atc_test_data: { reason: 'shell', sections: ['ATC COMMISSIONING TEST'] },
    // t2383 — fixed THIS turn: the shell (index.html:972-1033) declares exactly ONE section ("TOOL CHANGE"),
    // verified byte-for-byte (atc-batch-form-reproduction-2383.spec.js).
    user_atc_change_data: { reason: 'shell', sections: ['TOOL CHANGE'] },
    // t2383 — fixed THIS turn: the shell's own real name (index.html:957) is "TOOL TABLE → CONTROLLER",
    // verified byte-for-byte (atc-batch-form-reproduction-2383.spec.js).
    user_atc_table_data: { reason: 'shell', sections: ['TOOL TABLE → CONTROLLER'] },
    // t2383 — the shell (index.html:900-907) has exactly ONE real input field (`tolerance`, under
    // "TOLERANCE"); the other 7 bindings have no shell field at all and keep the canonical GEOMETRY/
    // TOOL & CUT split — verified (atc-batch-form-reproduction-2383.spec.js).
    user_atc_check_data: { reason: 'shell', sections: ['TOLERANCE'] },
    // t2381 — fixed THIS SAME turn: WCS's shell (index.html:1196-1237) declares FEATURE CONTEXT/WCS/OPTIONS,
    // none of which are SECTION_RANK's own three — reproducing the shell means diverging from the canonical
    // vocabulary entirely here, verified byte-for-byte (wcs-form-reproduction-2381.spec.js).
    user_wcs_data: { reason: 'shell', sections: ['FEATURE CONTEXT', 'OPTIONS', 'WCS'] },
    user_comm_data: { reason: 'unverified', sections: ['TYPE'] },   // GEOMETRY (its other section) is already canonical
    // NO live shell (advisor's own t2381 count), yet uses a non-canonical name — unlike comm's own `TYPE`
    // (which at least has a shell that MIGHT justify it), io_step has no shell to justify anything. Flagged,
    // not excused: this is exactly the "twin is wrong, not the vocabulary" question the dispatch named,
    // genuinely unresolved by this survey turn.
    user_io_step: { reason: 'unverified', sections: ['TYPE'] },   // GEOMETRY (its other section) is already canonical
    // NO live shell — a 4th section name (`PROBE`) neither an existing shell nor SECTION_RANK explains.
    // Plausibly a deliberate, reasonable addition (lathe's own probe ops are a distinct function from its
    // cutting ops) — NOT verified as such this turn; flagged for a future lathe-probe-owning turn to decide.
    user_lathe_faceprobe: { reason: 'unverified', sections: ['PROBE'] },   // IDENTITY (its other section) is already canonical
    user_lathe_odprobe: { reason: 'unverified', sections: ['PROBE'] },   // IDENTITY (its other section) is already canonical
};

function hasTreeLayout(template) {
    if (!Array.isArray(template)) return false;
    const root = template.find((b) => b && b.type === 'user_root');
    if (!root || !Array.isArray(root.uiChildren) || root.uiChildren.length === 0) return false;
    const childrenOf = (n) => Array.isArray(n) ? n : (n && n.children) || (n && n.uiChildren) || [];
    function checkNodes(nodes) {
        for (const n of childrenOf(nodes)) {
            if (!n) continue;
            if (n.type === 'split_horizontal' || n.type === 'split_vertical') return true;
            if (n.children && checkNodes(n.children)) return true;
            if (n.uiChildren && checkNodes(n.uiChildren)) return true;
        }
        return false;
    }
    return checkNodes(root.uiChildren);
}

test('SURVEY: section-metadata completeness + vocabulary across every registered twin', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsEditWizardDef);

    const rows = await page.evaluate(async ({ hasTreeLayoutSrc }) => {
        const hasTreeLayout = new Function('return ' + hasTreeLayoutSrc)();
        const U = await import('/blocks/userOps.js');
        const out = [];
        for (const s of U.listUserOps()) {
            const opType = s.opType;
            const def = U.getUserDef(opType);
            if (!def) { out.push({ opType, error: 'no def' }); continue; }
            const bindings = def.bindings || [];
            const missing = bindings.filter((b) => !b.section).map((b) => b.param).sort();
            const sectionsUsed = [...new Set(bindings.filter((b) => b.section).map((b) => b.section))].sort();
            out.push({ opType, tree: hasTreeLayout(def.template), total: bindings.length, missing, sectionsUsed });
        }
        return out;
    }, { hasTreeLayoutSrc: hasTreeLayout.toString() });

    expect(rows.length, 'registry sanity — expected 32 twins as of t2381; a changed count is not a failure but IS worth a fresh look at every list in this file').toBeGreaterThan(0);

    const completenessFailures = [];
    const vocabFailures = [];
    const staleExceptions = [];

    for (const r of rows) {
        if (r.error) { completenessFailures.push(`${r.opType}: ${r.error}`); continue; }

        // COMPLETENESS — skip TREE-mode twins entirely (section: isn't their mechanism).
        if (!TREE_MODE_TWINS.includes(r.opType)) {
            const known = COMPLETENESS_EXCEPTIONS[r.opType];
            if (known) {
                const knownSorted = [...known].sort();
                if (JSON.stringify(r.missing) !== JSON.stringify(knownSorted)) {
                    staleExceptions.push(`${r.opType}: COMPLETENESS_EXCEPTIONS says [${knownSorted.join(', ')}] but the twin's own missing set is now [${r.missing.join(', ')}] — update the exception list (the gap shrank, grew, or moved)`);
                }
            } else if (r.missing.length) {
                completenessFailures.push(`${r.opType}: ${r.missing.length} unsectioned binding(s) — [${r.missing.join(', ')}] — not a declared exception`);
            }
        } else if (r.tree === false) {
            staleExceptions.push(`${r.opType}: listed as TREE_MODE_TWINS but hasTreeLayout() now returns false — remove from the tree exemption, its completeness now counts for real`);
        }

        // VOCABULARY — every section name must be in SECTION_RANK, unless declared.
        const outside = r.sectionsUsed.filter((s) => !SECTION_RANK.includes(s));
        const known = VOCABULARY_EXCEPTIONS[r.opType];
        if (outside.length) {
            if (!known) {
                vocabFailures.push(`${r.opType}: uses non-canonical section(s) [${outside.join(', ')}] — not a declared exception`);
            } else {
                const knownSorted = [...known.sections].sort();
                const outsideSorted = [...outside].sort();
                if (JSON.stringify(outsideSorted) !== JSON.stringify(knownSorted)) {
                    staleExceptions.push(`${r.opType}: VOCABULARY_EXCEPTIONS says [${knownSorted.join(', ')}] but the twin's own non-canonical set is now [${outsideSorted.join(', ')}] — update the exception list`);
                }
            }
        } else if (known) {
            staleExceptions.push(`${r.opType}: listed in VOCABULARY_EXCEPTIONS but now uses only canonical sections — remove the (now-closed) exception`);
        }
    }

    if (completenessFailures.length || vocabFailures.length || staleExceptions.length) {
        console.log('COMPLETENESS FAILURES:\n' + completenessFailures.map((f) => '  ' + f).join('\n'));
        console.log('VOCABULARY FAILURES:\n' + vocabFailures.map((f) => '  ' + f).join('\n'));
        console.log('STALE EXCEPTIONS:\n' + staleExceptions.map((f) => '  ' + f).join('\n'));
    }
    expect(completenessFailures, 'undeclared section-completeness gaps').toEqual([]);
    expect(vocabFailures, 'undeclared non-canonical section vocabulary').toEqual([]);
    expect(staleExceptions, 'exception lists no longer match the twins they describe').toEqual([]);
});
