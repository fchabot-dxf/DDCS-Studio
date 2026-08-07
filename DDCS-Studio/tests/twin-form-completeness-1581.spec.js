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
 * DATA-DRIVEN, not a hand-typed parallel list: `app.js`'s `SEED_BUILDERS` is the SAME registry the app itself uses
 * for boot-seeding every workspace and for each wizard's "Restore to factory" action (t1107) — read it only for
 * the opType strings (calling each builder is a pure, side-effect-free factory call), never used to register.
 *
 * t1583/t1585 — DO NOT REGISTER MANUALLY. `app.js`'s `init()` already calls `seedDefaultPortedUserOps()` on every
 * page load, which registers all 32 twins via `createUserOp`/`updateUserOp` before this test's own code ever runs.
 * A test that ALSO calls `registerUserOp`/`createUserOp` on the same opType a second time in the same page session
 * is a REDUNDANT re-registration — and for 7 of the 32 twins (atc_warmup + the 6 lathe turning/probe ops) that
 * second call throws (a stale/colliding block-index derivation), even though the FIRST, real, boot-time
 * registration succeeded cleanly every time (confirmed: 15/15 fresh boots, real `openWiz()` opens + G-code emits
 * clean for all 7, and 4 of the 6 lathe ops have their OWN dedicated, already-passing tests exercising this exact
 * twin+emit path). The original version of this spec manually re-registered and asserted those 7 as a permanent
 * "known construction failure" set — a false claim the spec's own bug produced. Fixed by reading the ALREADY
 * boot-seeded def (`listUserOps()`) instead of building and registering a second one. THE CLASS, for the next
 * person writing a twin test: if your test's own `registerUserOp`/`createUserOp` call predates
 * `seedDefaultPortedUserOps` (or you're just not sure), don't register manually at all — resolve the boot-seeded
 * def/builder instead; a redundant registration is harmless for most twins but silently throws for a few.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('every registered data twin: the form presents every declared binding (formBindings drops none)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async () => {
        const A = await import('/app.js');
        const U = await import('/blocks/userOps.js');
        const OB = await import('/blocks/opBuilders.js');
        const FW = await import('/ui/formWidgets.js');
        const perTwin = [];
        for (const fn of A.SEED_BUILDERS) {
            const opType = fn().opType;   // pure factory call, just to read the opType string — never registered
            const stored = U.listUserOps().find((d) => d.opType === opType);   // the ALREADY boot-seeded def
            if (!stored) { perTwin.push({ opType, error: 'not found in the boot-seeded registry' }); continue; }
            if (!OB.builderOf(opType)) { perTwin.push({ opType, error: 'no working builder wired for a registered def' }); continue; }
            const fb = FW.formBindings(stored);
            const rawParams = stored.bindings.map((b) => b.param).filter((p) => p != null);
            const fbParams = new Set(fb.map((b) => b.param));
            const missing = rawParams.filter((p) => !fbParams.has(p));
            perTwin.push({ opType, rawCount: rawParams.length, formCount: fb.length, missing });
        }
        return perTwin;
    });

    const problems = r.filter((t) => t.error);
    expect(problems, 'every twin in the registry must actually be boot-seeded with a working builder').toEqual([]);

    expect(r.length, 'the full registry, not a subset').toBe(32);

    const withMissing = r.filter((t) => t.missing.length > 0);
    expect(withMissing, 'every twin\'s form must present every declared binding — if this fails, formBindings() (or whatever the current form-assembly seam is) is dropping params again').toEqual([]);
});
