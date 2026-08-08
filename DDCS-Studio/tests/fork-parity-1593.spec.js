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
 * ⚠ THE SECOND CLAIM IS THE BOUNDARY, AND IT IS THE MORE IMPORTANT ONE. A guarded wizard cannot survive the Blocks
 * canvas: `isWrap` has no 'guard', so recToJson writes each guard CHILDLESS and every structural arm inside it is
 * discarded on render (Corner: 1157 blocks in, 98 back). Such a fork is REFUSED at save rather than saved as a copy
 * whose form looks complete and whose emit is a different program. This spec pins BOTH sides — the forkable set is
 * exactly the guard-free twins and it works, the guarded set is exactly the refused ones and it says so — so the
 * boundary shrinks visibly when the canvas learns to render a guard, and a 33rd wizard cannot land outside it.
 */

const boot = async (page) => {
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsEditWizardDef);
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, { timeout: 20000 });
};

// Everything about a form field a copy must reproduce: which params, in what ORDER, and how each renders.
// Kept as SOURCE TEXT so both defs are keyed by the identical expression inside the page (a function argument to
// page.evaluate cannot be serialized, and re-typing the key twice is how the two sides quietly drift apart).
const FORM_KEY_SRC = `(d) => (d.bindings || [])
    .map((b) => b.param + ':' + b.type + ':' + (b.widget || '') + ':' + (b.group || '') + ':' + (b.role || '') + ':' + b.default).join('|')`;

test('the registry PARTITIONS on guards, and the inheritance rule covers every twin', async ({ page }) => {
    await boot(page);
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

test('THE REAL GESTURE — fork every shipped twin: guard-free ones keep form + emit BYTE FOR BYTE, guarded ones REFUSE', async ({ page }) => {
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
        await page.evaluate(() => window.ddcsLoadBlockStack([]));   // empty program → the destructive-load guard stays silent
        await page.waitForTimeout(150);
        await page.evaluate((x) => window.ddcsEditWizardDef(x), twins[i]);   // ← the real "Customize as blocks" route
        await page.waitForTimeout(1100);
        await page.evaluate(() => window.ddcsSaveAsWizard());               // ← the real "Save wizard…" gesture
        await page.waitForTimeout(150);
        await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Fk' + i);
        await page.click('.blk-dev-savedlg .blk-dev-save');
        await page.waitForTimeout(400);
        const r = await page.evaluate(async ([src, n, key]) => {
            const U = await import('/blocks/userOps.js');
            const s = U.getUserDef(src), c = U.getUserDef('user_fk' + n);
            const guards = U.flattenBlocks(s.template || []).filter((b) => b && b.type === 'guard').length;
            if (!c) return { opType: src, guards, saved: false };
            // OFF-DEFAULTS: every numeric value socket moved off its declared default, so a dropped value cannot
            // masquerade as a kept one. Structural params stay put — they choose the ARM, which is the other claim.
            const P = { ...U.defaultParams(s) };
            let off = 0;
            for (const b of (s.bindings || [])) {
                if (b.blockIndex == null) continue;
                if (b.type === 'number' || b.type === 'int') { P[b.param] = Number(b.default || 0) + 7; off++; }
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
                srcHooks: U.OP_CODE_HOOKS.filter((k) => typeof s[k] === 'function').join(','),
                copyHooks: U.OP_CODE_HOOKS.filter((k) => typeof c[k] === 'function').join(','),
            };
        }, [twins[i], i, FORM_KEY_SRC]);
        r.alert = alerts.join(' ~ ');
        results.push(r);
    }

    const forkable = results.filter((r) => r.guards === 0);
    const guarded = results.filter((r) => r.guards > 0);
    expect(forkable.length, 'there are guard-free twins to fork').toBeGreaterThanOrEqual(18);
    expect(guarded.length, 'there are guarded twins to refuse').toBeGreaterThanOrEqual(14);

    // ── CLAIM 1: a guard-free twin forks to an IDENTICAL wizard ─────────────────────────────────────────────────
    for (const r of forkable) {
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
    const biggest = forkable.reduce((a, b) => (b.off > a.off ? b : a));
    expect(biggest.off, 'the strongest case moves at least 25 values off their defaults').toBeGreaterThanOrEqual(25);

    // ── CLAIM 2: a guarded twin is REFUSED, and says why ────────────────────────────────────────────────────────
    // Not "it fails somehow" — the canvas cannot render a guard's children, so a saved copy would keep one arm and
    // emit a different program. Refusing is the safe direction; passing quietly is the one that reaches a machine.
    for (const r of guarded) {
        expect(r.saved, `${r.opType}: a guarded twin must NOT save a copy that emits a different program`).toBe(false);
        expect(r.alert, `${r.opType}: the refusal names the reason`).toMatch(/structural fork arms/);
    }
});
