import { test, expect } from '@playwright/test';
import { openWizardViaBar, clickInsert } from './support/barGesture.js';

/**
 * t1828 — BUG 1 of the three t1786 trace bugs (WORK-LOG t1826 confirmed all three by real gesture; this one
 * root-caused and fixed): a cutting op (Drill) followed by ANY later op halted NOT JUST the static preview trace
 * — the REAL EXPORTED FILE (`ddcsSerializeWithMarkers()`, the same function editorManager.js's own Export uses)
 * carried the SAME premature M30, mid-program. A real controller running that exported file would stop after
 * Drill and never reach the second op at all — this is not a picture defect, it is a program-correctness defect.
 *
 * ROOT CAUSE, traced to the actual line: `opBuilders.js`'s `_framed(opType, params)` unwraps a builder that
 * self-wraps its own output in an `{type:'op', children:[...]}` container (today, only homing does this) so the
 * program-framing atoms (`progstart`/`progend`) land as its own TOP-LEVEL siblings, where `commitActiveOp()`
 * (`opSession.js`) can find and strip them before wrapping the op's bare content. Every OTHER user-authored op —
 * every twin built via `userOpFromStack`, drill included — self-wraps in `{type:'user_root', children:[...]}`
 * instead, a DIFFERENT type name `_framed`'s unwrap condition never matches. So for drill (and any other twin
 * carrying its own progstart+progend, i.e. any cutting op), `commitActiveOp()`'s `start`/`end` extraction
 * silently found nothing, `bare` stayed the UNSTRIPPED `[user_root{...}]` wrapper with `progend` (which emits its
 * own M30) still buried inside — invisible to whatever tried to find a top-level terminator.
 *
 * M5 itself was never the terminator — traced with a live step-trail (WORK-LOG t1828): `_executeStep`'s only
 * "done" exit (GcodeExecutionEngine.js) matches `/^(M30|M02|M2|M99)\b/i`, which does not include M5 at all; the
 * step-trail shows M5 and M9 both pass through cleanly, and the halt is the LITERAL M30 line drill's own
 * `progend` atom emits (`wizards/ops/program.js`'s own `end: 'M30'` default), buried where nothing strips it.
 *
 * t1920 — REWRITTEN. The original fix (`_framed` also matching `user_root`) is STILL load-bearing and UNTOUCHED
 * (see `opBuilders.js`'s own doc comment on `_framed`) — a single op's own progstart/progend still need lifting
 * to the top level for presentation/addressability, regardless of how many ops the canvas ever holds. What's
 * GONE is the reason two ops' terminators could ever collide in the first place: `opSession.js`'s own
 * `appendIntoProgram` accumulation branch + `normalizeEnds` (t1916/t1918/t1920's own ruling — a program is
 * always exactly one op; a second insert REPLACES). This test now proves BOTH ends of that: (1) Drill ALONE
 * still gets exactly one M30 at the true end — the t1828 fix itself, re-verified under the new regime, since
 * `_framed`'s lift is what makes this true regardless of accumulation; (2) inserting Corner AFTER Drill REPLACES
 * it — the bug class this file is named for (two ops' terminators colliding) has no second op left to collide
 * WITH, structurally, not because a cleanup pass happens to catch it.
 */

test('Drill alone: the REAL EXPORTED FILE has exactly one M30, and the static trace covers it (t1828\'s own fix, still load-bearing)', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // Not openWizardViaBar here: "drill" also matches Bore's own data-optype (both declare type:'drill' in
    // wizardLibrary.js), so the shared helper's own locator is ambiguous for this one entry — disambiguate by
    // visible text instead, same real click either way.
    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Mill' }).click();
    await page.locator('.dock-header .toolbar-dropdown-content button[data-optype="drill"]', { hasText: 'Drill' }).click();
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });

    const r = await page.evaluate(async () => {
        const { traceToolpath } = await import('/engine/trace.js');
        const projText = window.ddcsGetProjection().text;
        const exported = window.ddcsSerializeWithMarkers ? window.ddcsSerializeWithMarkers() : projText;
        const countM30 = (s) => (s.match(/\bM30\b/g) || []).length;
        const trace = traceToolpath(projText);
        return {
            exportedM30Count: countM30(exported),
            projectedM30Count: countM30(projText),
            traceSegCount: trace.segments ? trace.segments.length : -1,
        };
    });

    expect(r.exportedM30Count, 'the real exported file must carry exactly one M30 (the true program end)').toBe(1);
    expect(r.projectedM30Count, 'the live projection (what the preview traces) must match the exported file').toBe(1);
    expect(r.traceSegCount, 'the static trace reaches drill\'s own motion, not truncated').toBeGreaterThan(0);
});

test('Corner inserted AFTER Drill REPLACES it — no second op survives to collide terminators with', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Mill' }).click();
    await page.locator('.dock-header .toolbar-dropdown-content button[data-optype="drill"]', { hasText: 'Drill' }).click();
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });

    await openWizardViaBar(page, { group: 'Probe', optype: 'corner' });
    await expect(page.locator('#wiz_user_form [data-param="dist"]')).toBeVisible({ timeout: 5000 });
    await clickInsert(page);
    // THE STRUCTURAL PROOF: not "still >=1 op somewhere" — exactly one, and it is corner, not drill.
    await page.waitForFunction(() => {
        const ops = window.ddcsGetBlockProgram().filter((b) => b.type === 'op');
        return ops.length === 1 && ops[0].opType === 'user_corner_data';
    }, null, { timeout: 10000 });

    const r = await page.evaluate(async () => {
        const { traceToolpath } = await import('/engine/trace.js');
        const projText = window.ddcsGetProjection().text;
        const exported = window.ddcsSerializeWithMarkers ? window.ddcsSerializeWithMarkers() : projText;
        const countM30 = (s) => (s.match(/\bM30\b/g) || []).length;
        const trace = traceToolpath(projText);
        return {
            ops: window.ddcsGetBlockProgram().filter((b) => b.type === 'op').map((b) => b.opType),
            exportedM30Count: countM30(exported),
            projectedM30Count: countM30(projText),
            traceProbeCount: trace.stats ? trace.stats.probe : -1,
        };
    });

    expect(r.ops, 'exactly one op survives, and it is the NEW one — drill is gone, not accumulated alongside').toEqual(['user_corner_data']);
    // THE BUG CLASS, PROVEN DEAD: one M30, at the true end — no second op's own terminator left to bury or collide with.
    expect(r.exportedM30Count, 'the real exported file carries exactly one M30 — structurally, one op means one terminator').toBe(1);
    expect(r.projectedM30Count, 'the live projection matches the exported file').toBe(1);
    expect(r.traceProbeCount, 'the static trace reaches corner\'s own probe moves — it is the whole program now').toBeGreaterThan(0);
});
