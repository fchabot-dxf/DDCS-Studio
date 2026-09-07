import { test, expect } from '@playwright/test';

const SCRATCH = 'scratchpad';

// t1077 S5 — the CORRECTNESS punch-list.
// (2) DUPLICATE PARAM KEYS across parts: a sub-stack composes several parts, and two parts can legitimately carry the
// SAME param key (here a custom binding deliberately named `feed`, colliding with the surfacing generator's own `feed`).
// The modal must address each row by a PART-SCOPED key so the two rows stay independently addressable — a bare key
// would make one row's radio/value silently drive the other's.
//
// Split from cam-substack-s5.spec.js at the tier migration work package 4; its two sibling tests (the STALE-sub-unit
// defV check and the error-path-halt composeParts check) moved to tests/node/cam-substack-s5.test.mjs. This one stayed:
// it drives the real CAM authoring modal end-to-end (window.ddcsOpenCamAuthoring, page.waitForSelector, real DOM
// queries for row keys and radio group names) — a genuine app+DOM dependency.

// build + register a forked surfacing op whose CUSTOM part binds a param named exactly `feed` (the collision)
const registerCollidingFork = (page) => page.evaluate(async () => {
    const { wrapRecognizedForFork } = await import('/blocks/devMode.js');
    const { getUserDef, userOpFromStack, registerUserOp, flattenBlocks, defaultParams } = await import('/blocks/userOps.js');
    const surfDef = getUserDef('user_surfacing_data');
    const w = wrapRecognizedForFork(surfDef);
    const root = w.template.find((b) => b.type === 'user_root');
    const feedBlk = { type: 'feed', params: { rate: 321 } };
    root.children.push(feedBlk);
    const flat = flattenBlocks(w.template);
    const def = userOpFromStack('s5_dupkey', 'Dup Key Fork', w.template, [
        { param: 'feed', blockIndex: flat.indexOf(feedBlk), key: 'rate', label: 'Custom feed', type: 'number', default: 321 },
    ]);
    registerUserOp(def);
    const op = { id: 'dk1', type: 'op', opType: def.opType, label: 'Dup Key Fork', params: defaultParams(def) };
    window.ddcsGetBlockProgram = () => [op];
    return def.opType;
});

test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });

    test('S5(2) — two parts sharing the param key "feed" stay INDEPENDENTLY addressable (part-scoped row/radio/lookup keys)', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsGetBlockProgram);
        const opType = await registerCollidingFork(page);
        await page.evaluate(async (t) => {
            (await import('/ui/macrosApp.js')).initMacrosApp();
            window.ddcsOpenCamAuthoring((window.ddcsGetBlockProgram() || []).find((o) => o.opType === t));
        }, opType);
        await page.waitForSelector('.cam-auth-overlay .cbm-eb');
        await page.screenshot({ path: `${SCRATCH}/cam-s5-dupkey.png` });   // VIEWED — both `feed` rows present and distinct

        const r = await page.evaluate(() => {
            const rows = [...document.querySelectorAll('#cbm_table tr[data-fkey]')].map((tr) => tr.getAttribute('data-fkey'));
            const feedRows = rows.filter((k) => /(^|:)feed$/.test(k));
            // the radio GROUP names must differ, else clicking one row's Expose would clear the other's
            const radioNames = [...document.querySelectorAll('#cbm_table .cbm-eb')].map((i) => i.getAttribute('name'));
            const feedRadioNames = [...new Set(radioNames.filter((n) => /feed$/.test(n)))];
            return { rows, feedRows, feedRadioNames, dupRowKeys: rows.length !== new Set(rows).size };
        });

        // BOTH feed rows exist (the surfacing generator's + the custom binding's) and their keys are DISTINCT
        expect(r.feedRows.length, 'both parts contribute a "feed" row').toBe(2);
        expect(new Set(r.feedRows).size, 'the two feed rows carry DISTINCT part-scoped keys (no collision)').toBe(2);
        expect(r.feedRows.every((k) => /^\d+:feed$/.test(k)), 'each feed key is part-scoped ("<part>:feed")').toBe(true);
        expect(r.dupRowKeys, 'no two rows in the whole table share an addressing key').toBe(false);
        expect(r.feedRadioNames.length, 'the two feed rows use SEPARATE radio groups').toBe(2);

        // and the pendant-slot lookup resolves each row to its OWN #var (not both to the first match)
        const slots = await page.evaluate(() => {
            const cell = (k) => { const tr = document.querySelector(`#cbm_table tr[data-fkey="${k}"]`); return tr ? tr.lastElementChild.textContent.trim() : null; };
            const keys = [...document.querySelectorAll('#cbm_table tr[data-fkey]')].map((tr) => tr.getAttribute('data-fkey')).filter((k) => /(^|:)feed$/.test(k));
            return keys.map(cell);
        });
        expect(slots.length, 'two pendant-slot cells').toBe(2);
        expect(slots[0], 'the two feed rows resolve to DIFFERENT pendant slots (independent lookup)').not.toBe(slots[1]);
        expect(slots.every((s) => /#\d+/.test(s)), 'each feed row resolves to a real pendant slot').toBe(true);
    });
});
