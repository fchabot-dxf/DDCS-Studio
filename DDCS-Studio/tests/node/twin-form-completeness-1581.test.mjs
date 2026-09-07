import { test, expect } from './support/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * t1581 — PIN THE INVARIANT: every REGISTERED data twin's form presents every declared binding.
 *
 * t1579 found `formBindings()` (ui/formWidgets.js) silently dropping structural/gating bindings — a param with no
 * emit socket (no `blockIndex`), so `paramGroupFromBindings()` correctly gives it no `param_field` row — the
 * moment ANY `param_group` existed on a def. Confirmed across corner, pocket, edge, alignment, middle (up to 12 of
 * 22 fields gone from middle's form). Fixed at the one consumer: `formBindings()` now unions row-less bindings
 * back in at their declared position. This spec is the regression tripwire so that class cannot return silently.
 *
 * DATA-DRIVEN, not a hand-typed parallel list: originally read `app.js`'s `SEED_BUILDERS` for the opType strings
 * (calling each builder is a pure, side-effect-free factory call, never used to register).
 *
 * ── NODE-TIER ADAPTATION (this file) ─────────────────────────────────────────────────────────────────────────────
 * `app.js` is NOT importable in this tier — it calls `finishBoot()` at module scope (real DOM / `Audio` etc.), the
 * same finding already recorded in preview-spec-gate-1688.test.mjs and architecture-map-1698.test.mjs. So the twin
 * set is DISCOVERED from `blocks/dataOps/*Data.js` (every `/DataDef$/` export) instead of read off `SEED_BUILDERS`
 * — the same technique those two files already use, cross-checked elsewhere to agree with `SEED_BUILDERS` 32-for-32.
 * The browser original also never registers manually — it relies on `app.js`'s own boot-time
 * `seedDefaultPortedUserOps()` having already run before the test body executes. Here nothing boots automatically,
 * so this file seeds every discovered twin via `createUserOp` (existence-checked, fresh each call — node persists
 * the module-level store across every test in this process, so a twin seeded by test 1 must not be re-created by
 * test 2's own seed pass) — the SAME seeding pattern already used elsewhere in this tier (pattern 3: a test that
 * reads the PERSISTED store, not the live registry, needs `createUserOp` with an existence check).
 */

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const WEB = path.join(ROOT, 'web');

async function collectBuilders() {
    const dir = path.join(WEB, 'blocks', 'dataOps');
    const files = fs.readdirSync(dir).filter((f) => /Data\.js$/.test(f)).sort();
    const builders = [];
    for (const f of files) {
        const mod = await import('/blocks/dataOps/' + f);
        for (const key of Object.keys(mod).filter((k) => /DataDef$/.test(k))) builders.push(mod[key]);
    }
    return builders;
}

// existence-checked, called fresh at the top of every test — never memoized (node persists the store across tests).
async function seedAllTwins(U, builders) {
    const have = new Set(U.listUserOps().map((d) => d.opType));
    for (const fn of builders) {
        const def = fn();
        if (!have.has(def.opType)) { U.createUserOp(def); have.add(def.opType); }
    }
}

test('every registered data twin: the form presents every declared binding (formBindings drops none)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const OB = await import('/blocks/opBuilders.js');
        const FW = await import('/ui/formWidgets.js');
        const builders = await collectBuilders();
        await seedAllTwins(U, builders);
        const perTwin = [];
        for (const fn of builders) {
            const opType = fn().opType;   // pure factory call, just to read the opType string — never registered here
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
        const U = await import('/blocks/userOps.js');
        const FW = await import('/ui/formWidgets.js');
        const builders = await collectBuilders();
        await seedAllTwins(U, builders);
        const nameOf = (fn) => (Object.entries(FW.FORM_WIDGETS).find(([, v]) => v === fn) || ['<unregistered>'])[0];
        const perTwin = [];
        for (const fn of builders) {
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
