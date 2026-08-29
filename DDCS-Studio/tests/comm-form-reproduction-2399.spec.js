import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2399: COMM, the LAST twin with a live shell (wiz_comm, index.html). Unlike every prior
 * mill-family landing (WCS/t2381, the ATC batch/t2383), this one does NOT harmonise the twin to the shell —
 * dispatched explicitly as "reproduce, do not harmonise, record inconsistencies." Two live-caught findings
 * this turn, both real and both left AS-IS per that instruction:
 *
 * (1) comm did NOT hit the SECTION_THRESHOLD=8 case the dispatch expected. commData.js declares 14 bindings
 *     across 2 named sections (TYPE, GEOMETRY) — `rowCount(14) > 8 && secList.length(2) >= 2` — so
 *     `formWidgets.js`'s `sectionize` gate IS true live (confirmed: `.form-sec` boxes render, titled
 *     "GEOMETRY" then "TYPE"). WCS/ATC's declaration-direct spec shape (assert `def.bindings` sections + live
 *     DOM order, skip the chrome) was built for the OPPOSITE case (chrome never renders) — doesn't apply here.
 *     This spec instead pins the chrome that DOES render.
 *
 * (2) The shell (index.html:1100-1213) and the twin (commData.js) disagree on both section identity AND
 *     field order — not a small drift, a structural one:
 *       - shell: 3 sections — FEATURE CONTEXT (type, mode) → GEOMETRY (val, cycle, msg) → ADVANCED (id, dest,
 *         statusColor, statusDwell, slot1-4), fields in that literal DOM order.
 *       - twin:  2 sections — TYPE (type, popupMode, statusMode) / GEOMETRY (everything else, including what
 *         the shell calls ADVANCED) — and `formWidgets.js`'s own `SECTION_RANK` (`['IDENTITY','GEOMETRY','TOOL & CUT']`)
 *         sorts the twin's GEOMETRY box BEFORE its unranked TYPE box, so the rendered order is msg → statusColor →
 *         statusDwell → id → dest → val → cycle → slot1-4 → type → popupMode → statusMode — the type/mode
 *         fields that OPEN the shell's form render LAST on the twin.
 *     Not fixed this turn (explicit dispatch instruction) — a real gap for a future "resection to 3 shell
 *     sections + reorder" pass, same shape as t2383's atc_change fix. Flagged in the t2399 hand-back.
 *
 * Confirmed untouched: the twin's def-loading path (`commDataDef()` → `formBindings` → `renderOpForm`) never
 * creates or touches `.comm-screen-host`/`#comm_screen_preview` — the `'commscreen'` PANEL only reads
 * `def.panel` at userOpView.js's own render() time (`pt.mode === 'commscreen'`, line ~832), a codepath this
 * spec's def-loading never reaches. See test below.
 *
 * Emit stays byte-identical — nothing here touches commData.js; `tests/comm-twin.spec.js` (unchanged, still
 * green) is the standing proof across the type sweep × HMI + non-HMI.
 */

// ── the SHELL's own truth, hand-derived from index.html (never from the twin's declaration) ──
const SHELL_SECTION_OF = {
    type: 'FEATURE CONTEXT', popupMode: 'FEATURE CONTEXT', statusMode: 'FEATURE CONTEXT',
    val: 'GEOMETRY', cycle: 'GEOMETRY', msg: 'GEOMETRY',
    id: 'ADVANCED', dest: 'ADVANCED', statusColor: 'ADVANCED', statusDwell: 'ADVANCED',
    slot1: 'ADVANCED', slot2: 'ADVANCED', slot3: 'ADVANCED', slot4: 'ADVANCED',
};
const SHELL_ORDER = ['type', 'popupMode', 'statusMode', 'val', 'cycle', 'msg', 'id', 'dest', 'statusColor', 'statusDwell', 'slot1', 'slot2', 'slot3', 'slot4'];
// shell DOM ids, in document order, for the live-shell independent check (test below opens the real panel)
const SHELL_IDS_ORDER = ['c_type', 'c_popup_mode', 'c_status_mode', 'c_val', 'c_cycle', 'c_msg', 'c_id', 'c_dest', 'c_status_color', 'c_status_dwell', 'c_slot1', 'c_slot2', 'c_slot3', 'c_slot4'];

// ── the TWIN's current, ACTUAL, recorded state — a pin, not a claim it matches the shell (it doesn't; see header) ──
const TWIN_SECTION_OF = {
    type: 'TYPE', popupMode: 'TYPE', statusMode: 'TYPE',
    msg: 'GEOMETRY', statusColor: 'GEOMETRY', statusDwell: 'GEOMETRY', id: 'GEOMETRY', dest: 'GEOMETRY',
    val: 'GEOMETRY', cycle: 'GEOMETRY', slot1: 'GEOMETRY', slot2: 'GEOMETRY', slot3: 'GEOMETRY', slot4: 'GEOMETRY',
};
const TWIN_ORDER = ['msg', 'statusColor', 'statusDwell', 'id', 'dest', 'val', 'cycle', 'slot1', 'slot2', 'slot3', 'slot4', 'type', 'popupMode', 'statusMode'];
const TWIN_SEC_TITLES = ['GEOMETRY', 'TYPE'];   // rendered section-chrome order (SECTION_RANK sorts GEOMETRY before the unranked TYPE)

test('comm-form-reproduction: the shell\'s own section-per-field mapping (hand-derived, independent of the twin)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('comm'));
    await page.waitForSelector('#wiz_comm', { state: 'visible' });

    // FEATURE CONTEXT / GEOMETRY / ADVANCED are static <span class="section-label"> markers in the shell's own
    // DOM — read their live text so a shell edit (a renamed or reordered section) fails this test honestly.
    const labels = await page.evaluate(() => {
        const root = document.querySelector('#wiz_comm');
        return [...root.querySelectorAll('.section-label')].map((el) => el.textContent.trim());
    });
    expect(labels).toEqual(['VISUALIZATION', 'FEATURE CONTEXT', 'GEOMETRY', 'ADVANCED']);
    expect(SHELL_ORDER.length).toBe(14);
    expect(Object.keys(SHELL_SECTION_OF).length).toBe(14);
});

test('comm-form-reproduction: the shell\'s own live field order (independent check, via window.openWiz)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('comm'));
    await page.waitForSelector('#wiz_comm', { state: 'visible' });

    const shellFields = await page.evaluate(() => {
        const root = document.querySelector('#wiz_comm');
        return [...root.querySelectorAll('input,select')]
            .filter((el) => /^c_/.test(el.id))
            .map((el) => el.id);
    });
    expect(shellFields).toEqual(SHELL_IDS_ORDER);
});

test('comm-form-reproduction: the twin\'s declared sections are pinned (recorded — deliberately NOT matching the shell, see header)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);

    const r = await page.evaluate(async () => {
        const dd = await import('/blocks/dataOps/commData.js');
        const def = dd.commDataDef();
        const bindings = def.bindings || [];
        const sectionOf = {};
        for (const b of bindings) sectionOf[b.param] = b.section || null;
        return { sectionOf, count: bindings.length };
    });

    expect(r.count, 'comm has 14 bindings today — a changed count is worth a fresh look at this spec').toBe(14);
    expect(r.sectionOf).toEqual(TWIN_SECTION_OF);
    // the recorded discrepancy: the twin's sections do not equal the shell's (asserted false on purpose,
    // so a future harmonisation pass that DOES align them fails this line as a signal to update the spec)
    expect(r.sectionOf).not.toEqual(SHELL_SECTION_OF);
});

test('comm-form-reproduction: the twin\'s rendered chrome + field order are pinned (live DOM, declaration-driven)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);

    const r = await page.evaluate(async () => {
        const dd = await import('/blocks/dataOps/commData.js');
        const { formBindings, renderOpForm } = await import('/ui/formWidgets.js');
        const def = dd.commDataDef();
        const host = document.createElement('div');
        document.body.appendChild(host);
        renderOpForm(host, formBindings(def));
        const order = [...host.querySelectorAll('[data-param]')].map((el) => el.dataset.param);
        const secTitles = [...host.querySelectorAll('.form-sec-title')].map((el) => el.textContent);
        return { order, secTitles };
    });

    // 14 rows > SECTION_THRESHOLD(8) and 2 named sections → chrome DOES render (unlike WCS/ATC's ≤9-binding forms)
    expect(r.secTitles).toEqual(TWIN_SEC_TITLES);
    expect(r.order).toEqual(TWIN_ORDER);
    expect(r.order).not.toEqual(SHELL_ORDER);
});

test('comm-form-reproduction: def-loading (formBindings/renderOpForm) never touches the commscreen panel wiring', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);

    const r = await page.evaluate(async () => {
        const before = document.querySelectorAll('.comm-screen-host, #comm_screen_preview').length;
        const dd = await import('/blocks/dataOps/commData.js');
        const { formBindings, renderOpForm } = await import('/ui/formWidgets.js');
        const def = dd.commDataDef();
        const host = document.createElement('div');
        document.body.appendChild(host);
        renderOpForm(host, formBindings(def));
        const after = document.querySelectorAll('.comm-screen-host, #comm_screen_preview').length;
        return { before, after, panel: def.panel };
    });

    expect(r.panel).toBe('commscreen');
    expect(r.after).toBe(r.before);
});
