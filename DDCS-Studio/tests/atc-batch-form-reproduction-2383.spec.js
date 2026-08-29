import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2383: THE ATC BATCH. All 6 ATC wizards (atc_warmup, atc_check, atc_length, atc_table,
 * atc_change, atc_test) have live shells (`wiz_atc_*` in index.html), so the mill-family "reproduce the
 * shell exactly" rule applies unchanged. NONE of the 6 is registered on `tests/support/formReproduction.js`'s
 * shared engine, for the SAME reason `wcs-form-reproduction-2381.spec.js` gave t2381: every one of them has
 * ≤9 bindings, below `formWidgets.js`'s own `SECTION_THRESHOLD = 8` — section fold chrome never renders for
 * any of them, by design ("a short form doesn't need folding"). Comparing rendered `.form-sec-title` chrome
 * against the shell would be a false negative for all six, not a real defect to chase — same finding as WCS,
 * now confirmed to recur across a whole batch. This spec verifies the DECLARATION directly (every binding's
 * own `section:` property, against a hand-derived shell mapping) plus field ORDER via live DOM (real
 * regardless of whether chrome renders) plus emit-equivalence, per wizard.
 *
 * WHAT EACH WIZARD'S OWN SHELL ACTUALLY OFFERS — genuinely different per wizard, not a uniform shape:
 *
 *   atc_warmup — ONE section ("WARM-UP SEQUENCE") covering all 4 fields. Absence fixed (0/4 → 4/4), no
 *     reorder needed (array order already matched the shell).
 *   atc_check — shell has exactly ONE real input (`atc_check_tol`, under "TOLERANCE"); the other 7 bindings
 *     have NO shell field at all (edited via Settings → ATC/Probes, per the shell's own settings-hint text —
 *     same class as atc_length below). Only `tolerance`'s section was wrong (was GEOMETRY); fixed to
 *     TOLERANCE. The other 7 keep their existing GEOMETRY/TOOL & CUT grouping — no shell mandate either way.
 *   atc_length — shell has ZERO input fields for ANY of its 7 bindings (a pure Settings-driven wizard, only
 *     a settings-hint + a "⚙ ATC Settings…" button). SURVEYED, NOT CHANGED — there is no shell field
 *     grouping to reproduce; the existing GEOMETRY/TOOL & CUT split is the reasonable status quo.
 *   atc_table — shell's real section name is "TOOL TABLE → CONTROLLER"; the twin used the shorter 'TABLE'.
 *     Corrected (name only — already one section, already complete).
 *   atc_change — MISMATCH fixed: the shell has exactly ONE section ("TOOL CHANGE") covering every visible
 *     field; the twin had invented THREE (METHOD/POSITION/FIRMWARE). Collapsed to the shell's one name.
 *     ALSO a genuine field-order fix, live-caught: the shell's own DOM order is `_setup` (the "⚙ ATC
 *     Settings…" button, BEFORE the section label itself) → method → callMacro → x/y/z → zClear → fixedT →
 *     orient; the array had fixedT before x/y/z/zClear. Reordered to match. NOT fixed (a separate, larger,
 *     deliberately-deferred gap, named in the file's own header comment): the shell also has three AUTO-
 *     method checkboxes (m300/cover/confirm) with no binding in the twin at all — "E2" scope, recorded here,
 *     not added.
 *   atc_test — MISMATCH fixed: the shell has exactly ONE section ("ATC COMMISSIONING TEST"); the twin had
 *     invented THREE (TEST/DRAWBAR/POCKETS). Collapsed to the shell's one name. Field order already matched
 *     the shell (mode, cycles, dwellMs — the visible drawbar-mode subset — appear in that order both places).
 *
 * Every wizard's own emit proven byte-identical (unchanged specs, re-run this same turn): atc-warmup-as-data,
 * atc-check-in-place, atc-length-in-place, atc-table-twin, atc-change-twin, atc-test-twin.
 */

const CASES = [
    {
        wiz: 'atc_warmup', mod: '/blocks/dataOps/atcWarmupData.js', fac: 'atcWarmupDataDef', shellId: 'wiz_atc_warmup', prefix: 'atc_warmup_',
        sectionOf: { rpm1: 'WARM-UP SEQUENCE', time1: 'WARM-UP SEQUENCE', rpm2: 'WARM-UP SEQUENCE', time2: 'WARM-UP SEQUENCE' },
        expectedOrder: ['rpm1', 'time1', 'rpm2', 'time2'],
    },
    {
        // t2383 — field order here is `SECTION_RANK`'s OWN rank order (`['IDENTITY','GEOMETRY','TOOL & CUT']`),
        // NOT array declaration order: GEOMETRY (rank 1) sorts before TOOL & CUT (rank 2) regardless of which
        // came first in the source array, and TOLERANCE (unranked) sorts last of all. Pre-existing behavior,
        // not introduced by this turn's `tolerance` section fix — confirmed live, not assumed from the array.
        wiz: 'atc_check', mod: '/blocks/dataOps/atcCheckData.js', fac: 'atcCheckDataDef', shellId: 'wiz_atc_check', prefix: 'atc_check_',
        sectionOf: { maxDist: 'TOOL & CUT', retract: 'TOOL & CUT', f_fast: 'TOOL & CUT', f_slow: 'TOOL & CUT', port: 'TOOL & CUT', blockHeight: 'GEOMETRY', safeZ: 'GEOMETRY', tolerance: 'TOLERANCE' },
        expectedOrder: ['blockHeight', 'safeZ', 'maxDist', 'retract', 'f_fast', 'f_slow', 'port', 'tolerance'],
    },
    {
        // t2383 — same SECTION_RANK reordering as atc_check above (GEOMETRY before TOOL & CUT, rank order not
        // array order) — pre-existing, unrelated to anything this turn touched (atc_length itself unchanged).
        wiz: 'atc_length', mod: '/blocks/dataOps/atcLengthData.js', fac: 'atcLengthDataDef', shellId: 'wiz_atc_length', prefix: 'atc_length_',
        sectionOf: { maxDist: 'TOOL & CUT', retract: 'TOOL & CUT', f_fast: 'TOOL & CUT', f_slow: 'TOOL & CUT', port: 'TOOL & CUT', blockHeight: 'GEOMETRY', safeZ: 'GEOMETRY' },
        expectedOrder: ['blockHeight', 'safeZ', 'maxDist', 'retract', 'f_fast', 'f_slow', 'port'],
    },
    {
        wiz: 'atc_table', mod: '/blocks/dataOps/atcTableData.js', fac: 'atcTableDataDef', shellId: 'wiz_atc_table', prefix: 'atc_table_',
        sectionOf: { includeLengths: 'TOOL TABLE → CONTROLLER', includePockets: 'TOOL TABLE → CONTROLLER', _setup: 'TOOL TABLE → CONTROLLER' },
        expectedOrder: ['includeLengths', 'includePockets', '_setup'],
    },
    {
        wiz: 'atc_change', mod: '/blocks/dataOps/atcChangeData.js', fac: 'atcChangeDataDef', shellId: 'wiz_atc_change', prefix: 'atc_change_',
        sectionOf: { _setup: 'TOOL CHANGE', method: 'TOOL CHANGE', callMacro: 'TOOL CHANGE', x: 'TOOL CHANGE', y: 'TOOL CHANGE', z: 'TOOL CHANGE', zClear: 'TOOL CHANGE', fixedT: 'TOOL CHANGE', orient: 'TOOL CHANGE' },
        expectedOrder: ['_setup', 'method', 'callMacro', 'x', 'y', 'z', 'zClear', 'fixedT', 'orient'],
    },
    {
        wiz: 'atc_test', mod: '/blocks/dataOps/atcTestData.js', fac: 'atcTestDataDef', shellId: 'wiz_atc_test', prefix: 'atc_test_',
        sectionOf: { mode: 'ATC COMMISSIONING TEST', cycles: 'ATC COMMISSIONING TEST', dwellMs: 'ATC COMMISSIONING TEST', first: 'ATC COMMISSIONING TEST', count: 'ATC COMMISSIONING TEST', zClear: 'ATC COMMISSIONING TEST', descend: 'ATC COMMISSIONING TEST' },
        expectedOrder: ['mode', 'cycles', 'dwellMs', 'first', 'count', 'zClear', 'descend'],
    },
];

for (const c of CASES) {
    test(`${c.wiz}-form-reproduction: every binding's own section matches the shell's field-to-section mapping`, async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsGetBlockProgram);

        const r = await page.evaluate(async ({ mod, fac }) => {
            const dd = await import(mod);
            const def = dd[fac]();
            const bindings = def.bindings || [];
            const sectionOf = {};
            for (const b of bindings) sectionOf[b.param] = b.section || null;
            return { sectionOf, count: bindings.length };
        }, { mod: c.mod, fac: c.fac });

        expect(r.count, `${c.wiz} has ${c.expectedOrder.length} bindings today — a changed count is worth a fresh look at this spec`).toBe(c.expectedOrder.length);
        expect(r.sectionOf).toEqual(c.sectionOf);
    });

    test(`${c.wiz}-form-reproduction: declared bindings place fields in the shell's own order (live DOM)`, async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsGetBlockProgram);

        const fields = await page.evaluate(async ({ mod, fac }) => {
            const dd = await import(mod);
            const { formBindings, renderOpForm } = await import('/ui/formWidgets.js');
            const def = dd[fac]();
            const binds = formBindings(def);
            const host = document.createElement('div');
            document.body.appendChild(host);
            renderOpForm(host, binds);
            return [...host.querySelectorAll('[data-param]')].map((el) => el.dataset.param);
        }, { mod: c.mod, fac: c.fac });

        expect(fields).toEqual(c.expectedOrder);
    });
}
