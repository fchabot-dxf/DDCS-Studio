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

/**
 * t1562 — THE SIBLING HALF OF THE SAME INVARIANT: present is not enough, it must be the RIGHT CONTROL.
 *
 * The test above can only see a binding that VANISHES. It is blind to one that survives with its widget mangled, which
 * is exactly what t1562 found: `paramGroupFromBindings` baked `widget: b.widget || 'number'`, turning "no widget
 * declared, derive it from `type`" into an explicit 'number' — and an explicit widget BEATS the type-derived default in
 * `resolveFormWidget`. 13 bindings across 7 twins collapsed into number boxes: corner's `clearMode` enum, wcs's four
 * axis toggles, and every string field (text's `text`, pauseConfirm's `msg`, comm's 4 slots, drill/bore `skip`) — a
 * text field you could not type text into. Same source and same shape as t1579, one layer further in.
 *
 * THE PROPERTY: form assembly is PRESENTATION-NEUTRAL. Materializing a param_group must never change which control a
 * binding resolves to. Asserted with the app's OWN `resolveFormWidget` rather than a hand-typed type→widget table in
 * the test — a parallel copy here would drift from `DEFAULT_BY_TYPE` the moment someone adds a type, and would then
 * pass while the app was wrong. Identity of the resolved widget function is the check; FORM_WIDGETS is scanned only to
 * turn that function back into a readable name for the failure message.
 *
 * Scope is deliberately the 32 BOOT-SEEDED twins, whose param_group is machine-materialized from their own bindings. A
 * human editing a `param_field` block MAY legitimately choose a different control — that is what the authoring surface
 * is for — so this invariant is about the materializer being neutral, not about forbidding overrides.
 */
test('every registered data twin: materialization preserves each binding\'s CONTROL (widget/type fidelity)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async () => {
        const A = await import('/app.js');
        const U = await import('/blocks/userOps.js');
        const FW = await import('/ui/formWidgets.js');
        const nameOf = (fn) => (Object.entries(FW.FORM_WIDGETS).find(([, v]) => v === fn) || ['<unregistered>'])[0];
        const perTwin = [];
        for (const fn of A.SEED_BUILDERS) {
            const opType = fn().opType;
            const stored = U.listUserOps().find((d) => d.opType === opType);
            if (!stored) { perTwin.push({ opType, error: 'not found in the boot-seeded registry' }); continue; }
            const byParam = {};
            for (const b of FW.formBindings(stored)) if (b && b.param != null) byParam[b.param] = b;
            const mangled = [];
            for (const b of (stored.bindings || [])) {
                if (!b || b.param == null) continue;
                const after = byParam[b.param];
                if (!after) continue;   // absence is the OTHER test's job — do not double-report it here
                if (FW.resolveFormWidget(b) !== FW.resolveFormWidget(after)) {
                    mangled.push({ param: b.param, declared: nameOf(FW.resolveFormWidget(b)), rendered: nameOf(FW.resolveFormWidget(after)) });
                }
                if ((after.type || 'number') !== (b.type || 'number')) {
                    mangled.push({ param: b.param, declaredType: b.type || 'number', renderedType: after.type || 'number' });
                }
            }
            perTwin.push({ opType, mangled });
        }
        return perTwin;
    });

    const problems = r.filter((t) => t.error);
    expect(problems, 'every twin in the registry must actually be boot-seeded').toEqual([]);
    expect(r.length, 'the full registry, not a subset').toBe(32);

    const withMangled = r.filter((t) => t.mangled.length > 0);
    expect(withMangled, 'materializing a param_group must not change which control a binding renders as — an enum must stay a dropdown, a bool a toggle, a string a text field').toEqual([]);
});
