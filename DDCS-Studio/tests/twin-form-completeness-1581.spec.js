import { test, expect } from '@playwright/test';

/**
 * t1581 — PIN THE INVARIANT: every REGISTERED data twin's form presents every declared binding.
 *
 * t1579 found `formBindings()` (ui/formWidgets.js) silently dropping structural/gating bindings — a param with no
 * emit socket (no `blockIndex`), so `paramGroupFromBindings()` correctly gives it no `param_field` row — the
 * moment ANY `param_group` existed on a def. Confirmed across corner, pocket, edge, alignment, middle (up to 12 of
 * 22 fields gone from middle's form). Fixed at the one consumer: `formBindings()` now unions row-less bindings
 * back in at their declared position. This spec is the regression tripwire so that class cannot return silently.
 *
 * DATA-DRIVEN, not a hand-typed parallel list: iterates `app.js`'s `SEED_BUILDERS` — the SAME registry the app
 * itself uses for boot-seeding every workspace and for each wizard's "Restore to factory" action (t1107). A newly
 * registered twin is covered the day it's added there, with no second place to remember to update.
 *
 * A handful of twins fail their OWN construction (`registerUserOp` throws — a binding whose `match` doesn't
 * resolve in the template) — a pre-existing, SEPARATE defect, upstream of `formBindings` entirely (it never gets
 * called). Confirmed pre-existing for `user_atc_warmup_data` via its own dedicated, already-red
 * `atc-warmup-as-data.spec.js`; the 6 lathe ones show the identical error shape, not independently root-caused
 * (out of scope — see WORK-LOG t1581). Named and skipped explicitly rather than silently: the skip list itself is
 * asserted, so it can only shrink (a future fix) or change with a visible diff in this file, never grow unnoticed.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// t1581 — construction failures unrelated to formBindings (see header). Update ONLY when you've confirmed WHY a
// twin moved on/off this list (a new WORK-LOG entry, not a silent edit).
const KNOWN_CONSTRUCTION_FAILURES = [
    'user_atc_warmup_data',
    'user_lathe_centerdrill', 'user_lathe_faceprobe', 'user_lathe_facing', 'user_lathe_odprobe', 'user_lathe_odturn', 'user_lathe_parting',
].sort();

test('every registered data twin: the form presents every declared binding (formBindings drops none)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async () => {
        const A = await import('/app.js');
        const U = await import('/blocks/userOps.js');
        const FW = await import('/ui/formWidgets.js');
        const perTwin = [];
        for (const fn of A.SEED_BUILDERS) {
            let def;
            try { def = fn(); } catch (e) { perTwin.push({ opType: '(unbuildable)', constructError: String(e) }); continue; }
            try {
                U.registerUserOp(def);   // runtime-only, federated user layer — mirrors how the real opensAs flow registers a built-in twin
            } catch (e) {
                perTwin.push({ opType: def.opType, constructError: String(e) });
                continue;
            }
            const fb = FW.formBindings(def);
            const rawParams = def.bindings.map((b) => b.param).filter((p) => p != null);
            const fbParams = new Set(fb.map((b) => b.param));
            const missing = rawParams.filter((p) => !fbParams.has(p));
            perTwin.push({ opType: def.opType, rawCount: rawParams.length, formCount: fb.length, missing });
        }
        return perTwin;
    });

    const constructFailed = r.filter((t) => t.constructError).map((t) => t.opType).sort();
    expect(constructFailed, 'the KNOWN construction-failure set is exactly this — a change here is itself news (a fix landed, or a NEW twin broke construction) and needs its own WORK-LOG entry, not a silent list edit').toEqual(KNOWN_CONSTRUCTION_FAILURES);

    const checkable = r.filter((t) => !t.constructError);
    expect(checkable.length, 'sanity: most of the registry should be checkable, not skipped').toBeGreaterThan(20);

    const withMissing = checkable.filter((t) => t.missing.length > 0);
    expect(withMissing, 'every checkable twin\'s form must present every declared binding — if this fails, formBindings() (or whatever the current form-assembly seam is) is dropping params again').toEqual([]);
});
