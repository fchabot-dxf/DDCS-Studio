import { test, expect } from '@playwright/test';

const SCRATCH = 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad';

// t1077 S5 — the CORRECTNESS punch-list.
// (2) DUPLICATE PARAM KEYS across parts: a sub-stack composes several parts, and two parts can legitimately carry the
// SAME param key (here a custom binding deliberately named `feed`, colliding with the surfacing generator's own `feed`).
// The modal must address each row by a PART-SCOPED key so the two rows stay independently addressable — a bare key
// would make one row's radio/value silently drive the other's.

// (4) defV STALENESS: the opunit stamps the twin's def version at fork time. If the user later EDITS that wizard def, the
// stamp goes behind — and deriveStandardParams would read the opunit's (older-shape) children through the CURRENT def's
// FROZEN bindings, silently reading the wrong sockets. It must degrade LOUDLY instead, never be silently wrong.
test('S5(4) — a STALE sub-unit (defV behind the current def) UNROLLS and says so; a current one stays LIVE', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { wrapRecognizedForFork } = await import('/blocks/devMode.js');
        const { getUserDef, defVOf } = await import('/blocks/userOps.js');
        const { subStackToSlot } = await import('/data/subStackToSlot.js');
        const OPT = 'user_surfacing_data';
        const cur = defVOf(OPT);
        const mk = (stampV) => {
            const w = wrapRecognizedForFork(getUserDef(OPT));
            const root = w.template.find((b) => b.type === 'user_root');
            root.children[0].params.defV = stampV;           // the stamp recorded at fork time
            return subStackToSlot({ opType: 'user_stale_probe', template: w.template, bindings: [] });
        };
        const stale = mk(Math.max(0, cur - 1));              // forked against an OLDER def version
        const fresh = mk(cur);                               // forked against the CURRENT def version
        const LIVE = /WHILE #\d+ LT #\d+ DO2/;
        return {
            cur,
            staleName: stale.name, staleBody: stale.body, staleLive: LIVE.test(stale.body || ''),
            freshName: fresh.name, freshLive: LIVE.test(fresh.body || ''),
        };
    });
    expect(r.cur, 'the surfacing twin is versioned').toBeGreaterThan(0);
    // STALE → degraded, and it SAYS so (visible in the part header + the slot name + the macro itself)
    expect(r.staleName, 'the stale part names the version jump and the degradation').toMatch(/def v\d+→v\d+ — unrolled, no longer live/);
    expect(r.staleBody, 'the macro carries a STALE SUB-UNIT explanation').toMatch(/STALE SUB-UNIT/);
    expect(r.staleBody, 'and tells the user how to restore it').toMatch(/re-fork/i);
    expect(r.staleLive, 'a stale sub-unit is NOT silently re-derived as a live generator loop').toBe(false);
    // CURRENT → untouched: no false degradation
    expect(r.freshName, 'a current sub-unit is NOT flagged').not.toMatch(/unrolled, no longer live/);
    expect(r.freshLive, 'a current sub-unit stays a LIVE generator loop').toBe(true);
});

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

// (1) ERROR-PATH FALL-THROUGH (safety): composeParts strips every NON-terminal part's terminal M30 so the SUCCESS path
// flows into the next part — but each generator's error handler only set #1505 and fell through to that same stripped
// end, so a failed probe / tripped guard ran straight into the NEXT part's motion. Each error branch must now HALT.
test('S5(1) SAFETY — an ERRORING non-terminal composed part HALTS; the SUCCESS path still flows on into the next part', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { cornerSlot } = await import('/data/probeToSlot.js');
        const { surfacingSlot } = await import('/data/millToSlot.js');
        const { slotFromOp } = await import('/data/opToSlot.js');
        const { composeParts, slotMacro } = await import('/data/slotPack.js');
        const used = new Set();
        const p1 = cornerSlot(used, 0);                       // part 1 — NON-terminal (its terminal M30 gets stripped)
        (p1.fields || []).forEach((f) => used.add(f.idx));
        const p2 = surfacingSlot(used, (p1.fields || []).length);
        const body = composeParts([p1.body, p2.body]);
        const lines = body.split('\n').map((s) => s.trim()).filter(Boolean);
        const errAt = lines.findIndex((l) => /;ERROR: probe did not trigger/.test(l));
        const n2At = lines.findIndex((l, i) => i > errAt && /^N2$/.test(l));
        // a FRAGMENT-tailed slot (drill has no M30 of its own) must still get the wrapper's terminator — the hasEnd tail-check
        const fragUsed = new Set();
        const f1 = cornerSlot(fragUsed, 0);
        (f1.fields || []).forEach((f) => fragUsed.add(f.idx));
        const f2 = slotFromOp('drill', 'circle', fragUsed, (f1.fields || []).length);
        const fragMacro = slotMacro({ slot: 22, name: 'frag', fields: [...(f1.fields || []), ...(f2.fields || [])], body: composeParts([f1.body, f2.body]) });
        return {
            errAt, afterErr: lines[errAt + 1] || '', n2At, afterN2: lines[n2At + 1] || '',
            lastLine: lines[lines.length - 1] || '',
            haltCount: lines.filter((l) => /^M30\b/.test(l)).length,
            fragTail: fragMacro.trim().split('\n').slice(-1)[0].trim(),
            fragHasM99: /\bM99\b/.test(fragMacro),
        };
    });
    // the ERROR branch halts right where it sets the fault — it can no longer reach the next part
    expect(r.errAt, 'the first part carries its error handler').toBeGreaterThan(0);
    expect(r.afterErr, 'the error branch HALTS immediately after flagging the fault').toMatch(/^M30\b/);
    // the SUCCESS convergence label is still NOT terminated — success must flow on into part 2
    expect(r.n2At, 'the success convergence label follows the error branch').toBeGreaterThan(r.errAt);
    expect(r.afterN2, 'the SUCCESS path is NOT halted — it flows into the next part').not.toMatch(/^M30\b/);
    expect(r.afterN2, 'and there IS a next part after it').not.toBe('');
    // the composed program still ends with exactly one terminal end
    expect(r.lastLine, 'the composed program ends with a terminator').toMatch(/^M30\b/);
    // a fragment-tailed composition still terminates (the slotMacro hasEnd TAIL check, not a body-wide scan)
    expect(r.fragHasM99, 'a slot whose LAST part is a fragment still gets the wrapper terminator').toBe(true);
    expect(r.fragTail, 'and it is the final line').toMatch(/^M99\b/);
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
