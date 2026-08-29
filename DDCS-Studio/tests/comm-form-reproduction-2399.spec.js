import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — t2399/t2401: COMM, the LAST twin with a live shell (wiz_comm, index.html), now HARMONIZED
 * to match it — landing the same way WCS/t2381 and the ATC batch/t2383 did.
 *
 * t2399 first pinned this as a deliberate, RECORDED mismatch ("reproduce, do not harmonise") — that reading
 * was corrected at t2401: "do not harmonise" guards the SHELL (never edit it to make a test pass), not the
 * twin. The twin's own declaration now matches.
 *
 * Two live findings along the way, both real:
 *
 * (1) comm did NOT hit the SECTION_THRESHOLD=8 case a dispatch once expected. commData.js declares 14
 *     bindings across 3 named sections — `rowCount(14) > 8 && secList.length(3) >= 2` — so `formWidgets.js`'s
 *     `sectionize` gate IS true live: real `.form-sec`/`.form-sec-title` chrome renders. WCS/ATC's
 *     declaration-direct spec shape (assert `def.bindings` sections + live DOM order, skip the chrome) was
 *     built for the OPPOSITE case (chrome never renders, ≤9 bindings) — doesn't apply here. This spec compares
 *     the chrome that actually renders.
 *
 * (2) A genuine SECTION_RANK collision, live-caught at t2401 while attempting the harmonization: the shell's
 *     own first section is "FEATURE CONTEXT" (type, mode) and its second is "GEOMETRY" (val, cycle, msg) —
 *     but `formWidgets.js`'s `SECTION_RANK` ranks 'GEOMETRY' explicitly, which sorts it BEFORE any unranked
 *     section regardless of array declaration order (confirmed with an isolated probe: an unranked section
 *     declared FIRST still rendered second). Simply renaming/reordering commData.js's own bindings to the
 *     shell's names, in the shell's own order, would NOT have reproduced the shell's real order — GEOMETRY
 *     would still jump to the front. Fixed at the shared layer: `SECTION_RANK` gained `'FEATURE CONTEXT'`,
 *     ranked ahead of `'GEOMETRY'` (same conceptual slot as `'IDENTITY'` — "what it is" before "where it is"
 *     — see formWidgets.js's own comment). Confirmed safe for WCS, the only other `'FEATURE CONTEXT'` user:
 *     its own WCS/OPTIONS sections stay unranked/tied, so nothing there changes (its own spec, unchanged,
 *     stays green).
 *
 * Confirmed untouched: the twin's def-loading path (`commDataDef()` → `formBindings` → `renderOpForm`) never
 * creates or touches `.comm-screen-host`/`#comm_screen_preview` — the `'commscreen'` PANEL only reads
 * `def.panel` at userOpView.js's own render() time (`pt.mode === 'commscreen'`, line ~832), a codepath this
 * spec's def-loading never reaches.
 *
 * Emit stays byte-identical — the resection only touched `section:`/array order, never a value or a `when`
 * clause; `tests/comm-twin.spec.js` (unchanged, still green) is the standing proof across the type sweep ×
 * HMI + non-HMI.
 */

// ── the SHELL's own truth, hand-derived from index.html (never from the twin's declaration) — unchanged
//    since t2399; this is what the twin now matches. ──
const SHELL_SECTION_OF = {
    type: 'FEATURE CONTEXT', popupMode: 'FEATURE CONTEXT', statusMode: 'FEATURE CONTEXT',
    val: 'GEOMETRY', cycle: 'GEOMETRY', msg: 'GEOMETRY',
    id: 'ADVANCED', dest: 'ADVANCED', statusColor: 'ADVANCED', statusDwell: 'ADVANCED',
    slot1: 'ADVANCED', slot2: 'ADVANCED', slot3: 'ADVANCED', slot4: 'ADVANCED',
};
const SHELL_ORDER = ['type', 'popupMode', 'statusMode', 'val', 'cycle', 'msg', 'id', 'dest', 'statusColor', 'statusDwell', 'slot1', 'slot2', 'slot3', 'slot4'];
const SHELL_IDS_ORDER = ['c_type', 'c_popup_mode', 'c_status_mode', 'c_val', 'c_cycle', 'c_msg', 'c_id', 'c_dest', 'c_status_color', 'c_status_dwell', 'c_slot1', 'c_slot2', 'c_slot3', 'c_slot4'];
const SHELL_SEC_TITLES = ['FEATURE CONTEXT', 'GEOMETRY', 'ADVANCED'];

test('comm-form-reproduction: the shell\'s own section-per-field mapping (hand-derived, independent of the twin)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('comm'));
    await page.waitForSelector('#wiz_comm', { state: 'visible' });

    const labels = await page.evaluate(() => {
        const root = document.querySelector('#wiz_comm');
        return [...root.querySelectorAll('.section-label')].map((el) => el.textContent.trim());
    });
    expect(labels).toEqual(['VISUALIZATION', ...SHELL_SEC_TITLES]);
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

test('comm-form-reproduction: every binding\'s own section matches the shell\'s field-to-section mapping', async ({ page }) => {
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
    expect(r.sectionOf).toEqual(SHELL_SECTION_OF);
});

test('comm-form-reproduction: declared bindings place fields in the shell\'s own order, rendered chrome included (live DOM)', async ({ page }) => {
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

    // 14 rows > SECTION_THRESHOLD(8) and 3 named sections → chrome DOES render (unlike WCS/ATC's ≤9-binding forms)
    expect(r.secTitles).toEqual(SHELL_SEC_TITLES);
    expect(r.order).toEqual(SHELL_ORDER);
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
