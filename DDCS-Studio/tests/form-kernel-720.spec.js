import { test, expect } from '@playwright/test';

/**
 * t720 P1 — THE FORM KERNEL. The mill twins shipped with EMPTY dropdowns (drill/bore/pocket/surfacing: wcs/attach/datum/
 * pattern/shape/strategy) because the derive pipeline dropped widget declarations AND the source omitted options. This
 * verifies (d) the placement-stock resolve (cc-attach places on the real stock, twin==builtin) and (e) the standing
 * form-integrity GUARD — every registered twin's every select has ≥1 option and a value in it, no silent empty enum.
 */
test.use({ viewport: { width: 1300, height: 980 } });

// (d) — the placement stock resolves from the SETTINGS stock so a stock-attaching twin places on the real stock, emitting
// BYTE-IDENTICAL to the built-in wizard (which injects the stock via placementParams). The UNRESOLVED twin diverges.
test('(d) placement stock resolve: cc-attach twin emit == built-in for a non-default attach', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const r = await page.evaluate(async () => {
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const { surfacingDataDef, SURFACING_DEFAULTS, SURFACING_DATA_OPTYPE } = await import('/blocks/dataOps/surfacingData.js');
        const { resolvePlacementStock } = await import('/wizards/ops/placement.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        registerUserOp(surfacingDataDef());
        const twin = builderOf(SURFACING_DATA_OPTYPE);
        const STOCK = { x: 200, y: 150, z: 25 };
        // t945 — seed the live machine Head so the reference surfacingStack spins up like the twin does at build (spindleHeadPatch) → M3 byte-matched.
        const base = { ...SURFACING_DEFAULTS, w: 150, h: 100, stockAttach: 'cc', pathDatum: 'cc', spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };   // stockW/H default 0
        const filled = resolvePlacementStock(base, STOCK);   // → { stockW:200, stockH:150, stockZ:25 }
        const builtinTxt = emitMapped(surfacingStack({ ...base, stockW: 200, stockH: 150, stockZ: 25 })).text;
        const twinResolvedTxt = emitMapped(twin({ ...base, ...filled })).text;
        const twinRawTxt = emitMapped(twin(base)).text;   // stockW=0 → cc-attach at ORIGIN (the bug)
        return { filled, twinResolvedTxt, builtinTxt, twinRawMatches: twinRawTxt === builtinTxt };
    });
    expect(r.filled.stockW, 'resolve fills stockW from the settings stock').toBe(200);
    expect(r.filled.stockH, 'resolve fills stockH').toBe(150);
    expect(r.twinResolvedTxt, 'the resolved twin emits byte-identical to the built-in for cc-attach').toBe(r.builtinTxt);
    expect(r.twinRawMatches, 'WITHOUT the resolve the twin diverges (cc-attach was placing at origin) — the fix matters').toBe(false);
});

// (d2) — a TYPED stock dim is respected (only UNSET fields follow the settings stock).
test('(d) resolve respects a typed stock dim (only unset fields follow the settings stock)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
    const out = await page.evaluate(async () => {
        const { resolvePlacementStock } = await import('/wizards/ops/placement.js');
        return {
            typed: resolvePlacementStock({ stockW: 120, stockH: 0 }, { x: 200, y: 150 }),   // stockW typed → kept; stockH unset → filled
            noField: resolvePlacementStock({ w: 50 }, { x: 200, y: 150 }),                   // op has no stock fields → nothing
        };
    });
    expect(out.typed.stockW, 'a typed stockW is not overwritten').toBeUndefined();
    expect(out.typed.stockH, 'an unset stockH is filled').toBe(150);
    expect(Object.keys(out.noField).length, 'an op without stock fields is untouched').toBe(0);
});

// (e) — THE FORM-INTEGRITY GUARD (standing): open EVERY registered twin; assert every select has ≥1 option and its value
// is one of them, and there is NO empty-enum read-only fallback (the ⚠ marker my formWidgets guard renders). So an
// option-less dropdown (a dropped/omitted widget declaration) can NEVER ship silently again — the whole class is caught.
test('(e) form integrity: every registered twin renders populated, value-valid dropdowns', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz, null, { timeout: 15000 });
    const ops = await page.evaluate(async () => {
        const { userBuilderTypes } = await import('/blocks/opBuilders.js');
        return userBuilderTypes().filter((t) => typeof t === 'string' && t.startsWith('user_'));
    });
    expect(ops.length, 'the registered twins are enumerable').toBeGreaterThanOrEqual(20);
    // t2621 (BACKLOG #71/#72) — MEASURED, not assumed: uncontended, single-worker, this loop's own 32 ops
    // took 51.5s total (mean 1611ms/op, slowest — user_homing_data — 3227ms). No op comes remotely close to
    // the 8s per-op timeout below; the timeout only fires under the full suite's own well-documented 4-worker
    // contention (playwright.config.js's own w4/w6/w8 findings), transiently stalling ONE op's render — a
    // resource hiccup, not a broken dropdown. Op COUNT is also not going to grow from future migrations: read
    // `userBuilderTypes()` directly and confirmed contour/pocket/slot/corner are ALREADY registered
    // `user_*_data` twins in this SAME 32-op population TODAY — migrating them to tree mode changes their own
    // render path, not how many ops this loop walks. So the fix is not a bigger per-op number (that just moves
    // the same fragility to a different contention level) — it is telling a TRANSIENT stall apart from a REAL
    // defect: retry the SAME op once, fresh, before concluding its dropdowns are actually broken. A genuine
    // defect reproduces identically on retry; a contention stall — bursty, not sustained for the whole test —
    // very likely does not. The outer test timeout scales with op count so a retry-heavy run (many transient
    // stalls under heavy load) still has room to finish rather than failing on the WRONG signal (a Playwright
    // test-timeout instead of the actual "defects != []" assertion).
    test.setTimeout(Math.max(90_000, ops.length * 6000));
    const defects = [];
    for (const op of ops) {
        let lastErr = null, bad = null;
        for (let attempt = 0; attempt < 2 && !bad; attempt++) {
            try {
                await page.evaluate((t) => window.openWiz(t), op);
                await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
                await page.waitForTimeout(250);
                bad = await page.evaluate(() => {
                    const form = document.querySelector('#wiz_user_form');
                    const empty = [], mismatch = [], fallback = [];
                    for (const s of form.querySelectorAll('select[data-param]')) {
                        const opts = [...s.options].map((o) => o.value);
                        if (opts.length === 0) empty.push(s.dataset.param);
                        else if (!opts.includes(s.value)) mismatch.push(s.dataset.param + '=' + JSON.stringify(s.value));
                    }
                    // the formWidgets empty-enum fallback renders a read-only input flagged with a ⚠ "no options" title
                    for (const i of form.querySelectorAll('input[data-param][readonly]')) if (/no options/i.test(i.title || '')) fallback.push(i.dataset.param);
                    return { empty, mismatch, fallback };
                });
                lastErr = null;
            } catch (e) {
                lastErr = String(e).slice(0, 100);
                await page.goto('http://localhost:3211');
                await page.waitForFunction(() => window.ddcsStudio && window.openWiz, null, { timeout: 15000 });
            }
        }
        if (lastErr) { defects.push({ op, error: lastErr }); continue; }
        if (bad.empty.length || bad.mismatch.length || bad.fallback.length) defects.push({ op, ...bad });
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^cancel$/i.test(x.textContent.trim())); if (b && b.offsetParent) b.click(); });
        await page.waitForTimeout(120);
    }
    expect(defects, `form defects across ${ops.length} twins: ${JSON.stringify(defects)}`).toEqual([]);
});
