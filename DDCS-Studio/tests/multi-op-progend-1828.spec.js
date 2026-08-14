import { test, expect } from '@playwright/test';
import { openWizardViaBar, clickInsert } from './support/barGesture.js';

/**
 * t1828 — BUG 1 of the three t1786 trace bugs (WORK-LOG t1826 confirmed all three by real gesture; this one
 * root-caused and fixed): a cutting op (Drill) followed by ANY later op halts NOT JUST the static preview trace
 * — the REAL EXPORTED FILE (`ddcsSerializeWithMarkers()`, the same function editorManager.js's own Export uses)
 * carries the SAME premature M30, mid-program. A real controller running that exported file would stop after
 * Drill and never reach the second op at all — this is not a picture defect, it is a program-correctness defect.
 *
 * ROOT CAUSE, traced to the actual line: `opBuilders.js`'s `_framed(opType, params)` unwraps a builder that
 * self-wraps its own output in an `{type:'op', children:[...]}` container (today, only homing does this) so the
 * program-framing atoms (`progstart`/`progend`) land as its own TOP-LEVEL siblings, where `commitActiveOp()`
 * (`opSession.js`) can find and strip them before wrapping the op's bare content. Every OTHER user-authored op —
 * every twin built via `userOpFromStack`, drill included — self-wraps in `{type:'user_root', children:[...]}`
 * instead, a DIFFERENT type name `_framed`'s unwrap condition never matches. So for drill (and any other twin
 * carrying its own progstart+progend, i.e. any cutting op), `commitActiveOp()`'s `start`/`end` extraction
 * silently finds nothing, `bare` stays the UNSTRIPPED `[user_root{...}]` wrapper with `progend` (which emits its
 * own M30) still buried inside — and neither `appendIntoProgram`'s own `endIdx = cur.findIndex(b => b.type ===
 * 'progend')` lookup nor `normalizeEnds`'s recursive cleanup ever see it, because both look for a TOP-LEVEL (or
 * one-level-nested) `progend`/`endprogram` sibling, not one three levels deep inside another op's own children.
 *
 * M5 itself was never the terminator — traced with a live step-trail (WORK-LOG t1828): `_executeStep`'s only
 * "done" exit (GcodeExecutionEngine.js) matches `/^(M30|M02|M2|M99)\b/i`, which does not include M5 at all; the
 * step-trail shows M5 and M9 both pass through cleanly, and the halt is the LITERAL M30 line drill's own
 * `progend` atom emits (`wizards/ops/program.js`'s own `end: 'M30'` default), buried where nothing strips it.
 *
 * Asserts the OUTCOME a user cares about — the whole program traces and the real exported file has exactly one
 * program terminator, at the true end — not an internal parser flag.
 */

test('a cutting op followed by another op: the REAL EXPORTED FILE has exactly one M30, and the static trace covers the whole program', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // Real bar: Drill (a cutting op — brings its own progstart+progend framing), then Corner, into ONE program.
    // Not openWizardViaBar here: "drill" also matches Bore's own data-optype (both declare type:'drill' in
    // wizardLibrary.js), so the shared helper's own locator is ambiguous for this one entry — disambiguate by
    // visible text instead, same real click either way.
    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Mill' }).click();
    await page.locator('.dock-header .toolbar-dropdown-content button[data-optype="drill"]', { hasText: 'Drill' }).click();
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });

    await openWizardViaBar(page, { group: 'Probe', optype: 'corner' });
    await expect(page.locator('#wiz_user_form [data-param="dist"]')).toBeVisible({ timeout: 5000 });
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').length >= 2, null, { timeout: 10000 });

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
            traceProbeCount: trace.stats ? trace.stats.probe : -1,
        };
    });

    // THE OUTCOME: the real file a user would send to a controller has ONE terminator, at the true end.
    expect(r.exportedM30Count, 'the real exported file must carry exactly one M30 (the true program end), not one per cutting op').toBe(1);
    expect(r.projectedM30Count, 'the live projection (what the preview traces) must match the exported file').toBe(1);
    // THE OUTCOME: the static trace reaches corner's own probes — the whole program, not just drill's.
    expect(r.traceProbeCount, 'the static trace must reach corner\'s own probe moves, not halt after drill').toBeGreaterThan(0);
});
