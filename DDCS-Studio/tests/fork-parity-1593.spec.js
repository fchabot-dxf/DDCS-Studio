import { test, expect } from '@playwright/test';

/**
 * t1593 — FORKING A BUILT-IN MUST PRODUCE THE SAME WIZARD.
 *
 * Built-in wizards are DATA but not editable; saving one as custom forks it into an editable copy, and that fork is
 * the ONLY editing path. It produced NOTHING: measured across the whole registry, 32 twins, 549 declared bindings,
 * ZERO recovered. Corner, end to end — 23 declared form fields → 0 in the copy, 13 off-defaults set → 0 surviving,
 * 108 emitted lines → 36. The cause was a DERIVED VIEW read instead of the DECLARED TRUTH (userOps.forkInheritance).
 *
 *   BUILT-IN ──── fork (save as custom) ────▶ CUSTOM COPY   must behave IDENTICALLY
 *
 *     FORM     the same params, in order, with the same type / widget / default
 *     VALUES   non-default values survive — asserted OFF-DEFAULTS, because at defaults a dropped value and a kept
 *              one look exactly alike (a previous probe made this mistake and would have passed a perfect fork)
 *     EMIT     same params in → same G-code out, BYTE FOR BYTE
 *
 * Deliberately NOT asserted, because they differ legitimately: the copy's `user_` NAME, its EDITABILITY (the whole
 * point), and the STACK SHAPE (the fork wraps the run in an opunit sub-stack by design — t1075).
 *
 * ⚠ THE SECOND CLAIM USED TO BE A BOUNDARY, AND t1595 DISSOLVED IT. A guarded wizard could not survive the Blocks
 * canvas — `isWrap` had no 'guard', so recToJson wrote each guard CHILDLESS and every structural arm inside it was
 * discarded on render (Corner: 1157 blocks in, 98 back) — so 14 twins were REFUSED at save rather than saved as a
 * copy whose form looked complete and whose emit was a different program. The set was pinned as EXACTLY those 14 so
 * that it would shrink visibly rather than quietly. It shrank to zero: the guard now declares its predicate as
 * fields and renders its arm through a DO mouth, and this spec asserts the refused set is EMPTY.
 *
 * The pin stays, inverted: EVERY registered twin must fork, so a future change that re-breaks any of them fails
 * here rather than shipping a wizard whose copy is a different program. The arms themselves are proven by the
 * structural-flip sweep in guard-roundtrip-1595.spec.js.
 *
 * t1660 — OFF-DEFAULTS COVERS EVERY DECLARED TYPE, not just number/int. Measured exposure before this turn: 306
 * numeric bindings were swept, 57 (48 enum + 5 bool + 4 string) were not — moved-at-defaults-only, so a fork
 * that silently dropped one of THOSE would have passed this spec clean. Extended by reading the declared shape
 * (b.type + b.widgetConfig.options), not a hand-listed param per twin. Measured result: zero divergences across
 * all 32 twins — see WORK-LOG t1660 for the full sweep + the non-vacuity proof (a deliberately broken binding
 * was shown to fail this exact assertion before being restored).
 */

// t1718 (gate repair) named this spec's load-sensitivity; t1724 retired the PER-SPEC retries declared here —
// the starved population shifts run to run (measured: the 3 survivors after t1718's fix were names that hadn't
// failed the PREVIOUS run), so a fixed list of "these specs get retries" goes stale every run and becomes
// folklore again, the exact disease t1718 was trying to cure. Retries now live at the config level
// (playwright.config.js's `retries`), where contention itself is configured (`workers: 6`) — this spec needs
// no declaration of its own.

// ⚠ t1595 — EVERY WAIT EXPLICIT. `waitForFunction(fn, {timeout})` passes the options object as the page-function's
// ARGUMENT, so the option is silently ignored and the config's 5s actionTimeout applies — the second line below used
// to read exactly that way. It mattered from t1595 on, because rendering a guard's arms took Corner's canvas from
// 111 blocks to 1852 and this spec opens all 32 twins in one test.
// The REGISTRY boot: the app, no Blocks canvas. The partition test below only READS registered defs, and mounting
// Blockly for it cost the whole test its 60s cap under a loaded suite — a pure-data claim should not wait on a
// canvas it never looks at.
const bootRegistry = async (page) => {
    await page.goto('/', { timeout: 60000 });
    // t2351 — the app's own declared "everything is wired" signal (t1279), not a hand-picked global subset —
    // see wizard-face-1599's own boot() for the full trace of why this class of wait was silently racy.
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 60000 });
};
// …and the CANVAS boot, for the tests that perform the real gesture.
const boot = async (page) => {
    await bootRegistry(page);
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 60000 });
};

/** Open a wizard to customize and wait for the CANVAS TO SETTLE — not for a fixed sleep that was tuned when the
 *  biggest guarded wizard put 111 blocks on the canvas instead of 1852. */
const customize = async (page, opType) => {
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.evaluate((x) => window.ddcsEditWizardDef(x), opType);
    await page.waitForFunction(() => {
        const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op');
        return !!(op && (op.children || []).length) && window.__blkws.getAllBlocks().length > 0;
    }, null, { timeout: 60000 });
    let last = -1;
    for (let i = 0; i < 120; i++) {
        const n = await page.evaluate(() => window.__blkws.getAllBlocks().length);
        if (n === last && n > 0) return;
        last = n;
        await page.waitForTimeout(250);
    }
};

// Everything about a form field a copy must reproduce: which params, in what ORDER, and how each renders.
// Kept as SOURCE TEXT so both defs are keyed by the identical expression inside the page (a function argument to
// page.evaluate cannot be serialized, and re-typing the key twice is how the two sides quietly drift apart).
const FORM_KEY_SRC = `(d) => (d.bindings || [])
    .map((b) => b.param + ':' + b.type + ':' + (b.widget || '') + ':' + (b.group || '') + ':' + (b.role || '') + ':' + b.default).join('|')`;

test('the registry PARTITIONS on guards, and the inheritance rule covers every twin', async ({ page }) => {
    await bootRegistry(page);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const rows = [];
        for (const s of U.listUserOps()) {
            const def = U.getUserDef(s.opType);
            if (!def) continue;
            rows.push({
                opType: def.opType,
                guards: U.flattenBlocks(def.template || []).filter((b) => b && b.type === 'guard').length,
                valueBindings: (def.bindings || []).filter((b) => b && b.blockIndex != null).length,
                specs: (def.bindingSpecs || []).length,
                bindings: (def.bindings || []).length,
            });
        }
        return rows;
    });
    expect(r.length, 'the shipped twins are registered').toBeGreaterThanOrEqual(32);
    // Every twin declares SOMETHING — else "549 bindings recovered" would be a claim about an empty registry.
    expect(r.filter((x) => x.bindings === 0), 'every shipped twin declares at least one binding').toEqual([]);

    // THE INHERITANCE PARTITION forkInheritance documents and depends on: a binding's frozen blockIndex is only
    // re-mapped for defs whose template the fork reproduces 1:1. A twin with BOTH value-socket bindings AND guards
    // would need an index remapped across a stack whose arms move — and it must therefore carry bindingSpecs, which
    // re-derive every index BY IDENTITY at build. This is a measured property of the registry, pinned so a new wizard
    // cannot quietly become the first counter-example.
    const unmappable = r.filter((x) => x.guards > 0 && x.valueBindings > 0 && x.specs === 0);
    expect(unmappable.map((x) => x.opType),
        'a twin with value-socket bindings AND guards must declare bindingSpecs (its indices move with the arms)').toEqual([]);
});

test('THE REAL GESTURE — fork EVERY shipped twin: form + emit BYTE FOR BYTE, and nothing is refused', async ({ page }) => {
    test.setTimeout(300_000);
    const alerts = [];
    page.on('dialog', (d) => { alerts.push(d.message()); d.accept(); });
    await boot(page);
    const twins = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        return U.listUserOps().map((d) => d.opType);
    });
    expect(twins.length, 'the shipped twins are registered').toBeGreaterThanOrEqual(32);

    const results = [];
    for (let i = 0; i < twins.length; i++) {
        alerts.length = 0;
        await customize(page, twins[i]);                                    // ← the real "Customize as blocks" route
        await page.evaluate(() => window.ddcsSaveAsWizard());               // ← the real "Save wizard…" gesture
        const field = page.locator('.blk-dev-savedlg .blk-dev-opname');
        await field.waitFor({ state: 'visible', timeout: 30000 });
        await field.fill('Fk' + i, { timeout: 30000 });
        await page.click('.blk-dev-savedlg .blk-dev-save', { timeout: 30000 });
        await page.waitForFunction(() => !document.querySelector('.blk-dev-savedlg'), null, { timeout: 30000 });
        const r = await page.evaluate(async ([src, n, key]) => {
            const U = await import('/blocks/userOps.js');
            const s = U.getUserDef(src), c = U.getUserDef('user_fk' + n);
            const guards = U.flattenBlocks(s.template || []).filter((b) => b && b.type === 'guard').length;
            if (!c) return { opType: src, guards, saved: false };
            // OFF-DEFAULTS: every value socket moved off its declared default, so a dropped value cannot masquerade
            // as a kept one. Structural params stay put — they choose the ARM, which is the other claim.
            // t1660 — EVERY declared TYPE, not just number/int: numeric bindings were the only ones swept until
            // this turn (48 enum + 5 bool + 4 string bindings, across the whole registry, were invisible to this
            // claim — moved-at-defaults-only, so a fork that silently dropped one would have passed here clean).
            // Reads the DECLARED shape generically (b.type + b.widgetConfig.options), never a hand-listed param —
            // the same declare-not-handroll bar this project applies everywhere else.
            const P = { ...U.defaultParams(s) };
            let off = 0;
            for (const b of (s.bindings || [])) {
                if (b.blockIndex == null) continue;
                if (b.type === 'number' || b.type === 'int') { P[b.param] = Number(b.default || 0) + 7; off++; }
                else if (b.type === 'bool') { P[b.param] = !b.default; off++; }
                else if (b.type === 'enum') {
                    // A single-option enum (e.g. text's `font`) has no alternative to move to — not a gap, a
                    // genuinely fixed field; skipped rather than counted as swept. The ONE declared legitimate skip.
                    const opts = (b.widgetConfig && b.widgetConfig.options) || [];
                    const alt = opts.map(([, v]) => v).find((v) => v !== b.default);
                    if (alt !== undefined) { P[b.param] = alt; off++; }
                } else if (b.type === 'string') { P[b.param] = String(b.default || '') + ' [t1660 off-default]'; off++; }
                // t1662 THE DURABLE HALF — every value-socket binding is either MOVED off its default (the
                // branches above) or explicitly SKIPPED for the ONE declared reason (a single-option enum, inside
                // the enum branch itself). Anything else — a binding type NONE of the branches above recognize —
                // FAILS LOUD, naming the type, instead of silently sweeping nothing: an unrecognized type used to
                // contribute off=0 with no signal, exactly the shape that let enum/bool/string hide before t1660
                // — a future 5th type would repeat it invisibly. Same standard as t1638's mouth guard and t1654's
                // durable-field guard: a new type joins by being HANDLED here, not by being silently forgotten.
                else {
                    throw new Error(`fork-parity-1593: binding "${b.param}" on ${src} has an unrecognized type `
                        + `"${b.type}" — it would silently sweep OFF=0 (proving nothing) instead of being moved `
                        + `off its default. Add a branch for "${b.type}" above.`);
                }
            }
            const { emitProgram } = await import('/blocks/blockEmitter.js');
            let srcGcode = null, copyGcode = null, err = null;
            try { srcGcode = emitProgram(U.instantiate(s, P)); copyGcode = emitProgram(U.instantiate(c, P)); }
            catch (e) { err = String((e && e.message) || e); }
            const K = eval(key);
            return {
                opType: src, guards, saved: true, off, err,
                srcForm: K(s), copyForm: K(c),
                emitSame: srcGcode != null && srcGcode === copyGcode,
                srcLines: srcGcode ? srcGcode.split('\n').length : -1,
                copyLines: copyGcode ? copyGcode.split('\n').length : -1,
                forkedFrom: c.forkedFrom,
                // t1682 — OP_CODE_HOOKS (a hand-maintained 8-name list) is gone: reconcileCodeHooks now derives "is
                // this a hook" from the def's own shape instead of a list that had already gone stale (7 real hooks
                // missing from it). hookKeysOf reads the SAME generic rule, so this claim now covers every hook a
                // twin declares, not just the 8 the old list happened to name — sorted so key-enumeration ORDER
                // can't produce a false mismatch between the source and the copy.
                srcHooks: U.hookKeysOf(s).sort().join(','),
                copyHooks: U.hookKeysOf(c).sort().join(','),
            };
        }, [twins[i], i, FORM_KEY_SRC]);
        r.alert = alerts.join(' ~ ');
        results.push(r);
    }

    // t1595 — the set that used to be excluded. Kept as a NAMED subset rather than folded away, because "the guarded
    // twins fork too" is the claim that closed this arc and it should stay legible if one of them ever regresses.
    const guarded = results.filter((r) => r.guards > 0);
    expect(results.length, 'every registered twin is forked here').toBeGreaterThanOrEqual(32);
    expect(guarded.length, 'the guarded twins — the ones that were refused until t1595 — are among them').toBeGreaterThanOrEqual(14);

    // ── CLAIM 1: EVERY twin forks to an IDENTICAL wizard ────────────────────────────────────────────────────────
    for (const r of results) {
        expect(r.saved, `${r.opType}: a guard-free twin must fork (alert: ${r.alert})`).toBe(true);
        // ORDER MATTERS HERE: the two headline claims are asserted FIRST, so a pre-change run fails ON THEM rather
        // than on a provenance field that simply did not exist yet — a red that only proves the test is new.
        // FORM — same params, same order, same type/widget/group/role/default
        expect(r.copyForm, `${r.opType}: the copy's FORM must be the wizard's form`).toBe(r.srcForm);
        // VALUES + EMIT — same params in, same G-code out, byte for byte, with every numeric knob OFF its default
        expect(r.err, `${r.opType}: both build`).toBeNull();
        expect(r.emitSame, `${r.opType}: EMIT must be byte-identical at ${r.off} off-default values `
            + `(${r.srcLines} lines vs ${r.copyLines})`).toBe(true);
        // …and the behaviour hooks the emit depends on came across with it (a function cannot ride on a def)
        expect(r.copyHooks, `${r.opType}: the copy runs the source's code hooks`).toBe(r.srcHooks);
        expect(r.forkedFrom, `${r.opType}: the copy records the wizard it came from`).toBe(r.opType);
    }
    // The measurement that made this turn: at least one twin proves it on a substantial form, not a one-knob op.
    const biggest = results.reduce((a, b) => (b.off > a.off ? b : a));
    expect(biggest.off, 'the strongest case moves at least 25 values off their defaults').toBeGreaterThanOrEqual(25);

    // ── CLAIM 2: NOTHING IS REFUSED ANY MORE ────────────────────────────────────────────────────────────────────
    // The refusal is still in `validateUserOp` and still data-driven (it fires when a copy comes back with fewer
    // blocks inside its guards than its source declares). It is asserted to be SILENT, not deleted: it is the thing
    // that would catch the canvas losing arms again, and an assertion that it never fires is how we know it isn't.
    expect(results.filter((r) => !r.saved).map((r) => r.opType), 'the refused set is EMPTY — every twin forks').toEqual([]);
    for (const r of guarded) {
        expect(r.alert, `${r.opType}: a guarded fork saves without warning about lost arms`).not.toMatch(/structural fork arms/);
    }
});
