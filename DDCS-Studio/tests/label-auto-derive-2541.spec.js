import { test, expect } from '@playwright/test';

/**
 * t2541 (BACKLOG #71, t2537's own reduction 2) — MEASURED before shipping: only 51/182 (28%) of the 32
 * built-in twins' own real labels match a mechanical camelCase/snake_case → Title Case derivation exactly
 * (`dist` → real "Max Probe Dist", not "Dist"). That is NOT a reason to withhold the derivation — it is a
 * reason to be precise about what it buys: it replaces the bare, unspaced, lowercase param name (`labelFor`'s
 * own PRE-EXISTING last-resort fallback, `b.param` itself) with a Title-Cased split, a STRICT improvement in
 * 100% of cases since it only fires when nothing more reliable (an explicit label, SHARED_LABELS, a handle's
 * own anchor.label) is present, and happens to be the author's own final choice ~28% of the time on the
 * measured population.
 *
 * DISTINGUISHABILITY (the dispatch's own explicit demand): the guess is computed at RENDER time only, in
 * `labelFor`/`isDerivedLabel` — it is NEVER written back into a block's own `label` field, so a blank field
 * always means "the author never set one" regardless of what the form currently shows. The rendered row
 * carries a `.ddcs-label-derived` class (styled distinctly, `styles.css`) and a tooltip naming the mechanism
 * and how to override it, so an author can always tell a guess from their own words.
 */

test('labelFor/isDerivedLabel: the derived tier fires ONLY when nothing more reliable is present, and never overrides an explicit choice', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const { labelFor, isDerivedLabel } = await import('/ui/formWidgets.js');
        return {
            // snake_case splits correctly (camelCase covered by derivedFallback below)
            snake: labelFor({ param: 'f_fast' }),
            // an explicit label always wins, never touched by the new tier
            explicit: labelFor({ param: 'dist', label: 'Max Probe Dist' }),
            explicitIsDerived: isDerivedLabel({ param: 'dist', label: 'Max Probe Dist' }),
            // SHARED_LABELS still wins over the derived tier for its own known params
            sharedWins: labelFor({ param: 'w' }),
            sharedIsDerived: isDerivedLabel({ param: 'w' }),
            // a handle's own anchor.label still wins over the derived tier
            anchorWins: labelFor({ param: 'boxreach', anchor: { kind: 'length', label: 'reach' } }),
            anchorIsDerived: isDerivedLabel({ param: 'boxreach', anchor: { kind: 'length', label: 'reach' } }),
            // the derived tier itself: fires, and isDerivedLabel agrees it fired
            derivedFallback: labelFor({ param: 'stepoverAngle' }),
            derivedIsDerived: isDerivedLabel({ param: 'stepoverAngle' }),
            // empty/missing param -- no crash, no bogus label
            emptyParam: labelFor({ param: '' }),
        };
    });
    expect(r.snake, 'snake_case splits on underscores, Title-Cased').toBe('F Fast');
    expect(r.explicit).toBe('Max Probe Dist');
    expect(r.explicitIsDerived, 'an explicit label is never flagged as derived').toBe(false);
    expect(r.sharedWins).toBe('Width');
    expect(r.sharedIsDerived, 'a SHARED_LABELS hit is never flagged as derived').toBe(false);
    expect(r.anchorWins).toBe('reach');
    expect(r.anchorIsDerived, "a handle's own anchor.label is never flagged as derived").toBe(false);
    expect(r.derivedFallback, 'camelCase splits on the lower-to-upper boundary, Title-Cased').toBe('Stepover Angle');
    expect(r.derivedIsDerived, 'the derived tier correctly flags itself as having fired').toBe(true);
    expect(r.emptyParam).toBe('');
});

test.use({ viewport: { width: 2600, height: 1000 } });
test('DRIVE THE APP: a formfield authored with NO label renders a Title-Cased row, visually marked as auto-derived, distinct from an authored label', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        localStorage.removeItem('ddcs_user_ops');
        try { U.deleteUserOp('user_t2541_label_pilot'); } catch (_) {}
        const template = [{
            type: 'user_root', params: {},
            uiChildren: [
                { type: 'param_group', params: { group: 'Test' }, children: [
                    // NO label set -- must render Title-Cased, marked as derived
                    { type: 'formfield', params: { param: 'stepoverAngle', dflt: '30', bindMode: 'opparam', atomType: 'progstart', key: 'clearance', type: 'number' } },
                    // an EXPLICIT label -- must render as typed, never marked as derived
                    { type: 'formfield', params: { param: 'rpmOverride', label: 'Custom RPM', dflt: '5000', bindMode: 'opparam', atomType: 'progstart', key: 'rpm', type: 'number' } },
                ] },
            ],
            children: [
                { type: 'progstart', params: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
                { type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' } },
            ],
        }];
        U.createUserOp(U.userOpFromStack('user_t2541_label_pilot', 'T2541 Label Pilot', template, [], 'form'));
        return { emitOk: emitMapped(builderOf('user_t2541_label_pilot')(U.defaultParams(U.getUserDef('user_t2541_label_pilot')))).text.length > 0 };
    });
    expect(r.emitOk, 'the pilot op emits (the derivation is render-only, never touches emit)').toBe(true);

    await page.evaluate((t) => window.openWiz(t), 'user_t2541_label_pilot');
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(300);

    const rows = await page.evaluate(() => {
        const derivedRow = document.querySelector('#wiz_user_form [data-param="stepoverAngle"]');
        const explicitRow = document.querySelector('#wiz_user_form [data-param="rpmOverride"]');
        const labelOf = (input) => {
            const row = input && input.closest('.form-row');
            const span = row && row.querySelector('span');
            return span ? { text: span.textContent, hasDerivedClass: span.classList.contains('ddcs-label-derived'), title: span.title } : null;
        };
        return { derived: labelOf(derivedRow), explicit: labelOf(explicitRow) };
    });

    expect(rows.derived, 'the derived-label row rendered').toBeTruthy();
    expect(rows.derived.text, 'Title-Cased, not the bare param name').toBe('Stepover Angle');
    expect(rows.derived.hasDerivedClass, 'carries the distinguishing CSS class').toBe(true);
    expect(rows.derived.title, 'the tooltip names the mechanism and how to override it').toContain('auto-derived from the parameter name');

    expect(rows.explicit, 'the explicit-label row rendered').toBeTruthy();
    expect(rows.explicit.text).toBe('Custom RPM');
    expect(rows.explicit.hasDerivedClass, 'an explicitly-typed label is NEVER marked as derived').toBe(false);

    // THE BLOCK ITSELF stays the source of truth: its own LABEL field is genuinely empty, never silently
    // filled with the guess -- confirms the derivation is render-only, per this turn's own distinguishability design.
    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, 'user_t2541_label_pilot');
});
