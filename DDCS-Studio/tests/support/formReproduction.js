import { test, expect } from '@playwright/test';

/**
 * tests/support/formReproduction.js — t2373: the SHARED ENGINE behind every "does the declared uiChildren tree
 * reproduce its shell" spec. Extracted from drill-form-reproduction-2299.spec.js and pocket-form-reproduction-
 * 2301.spec.js — read side by side, structurally near-identical (same three axes, same page.evaluate shape),
 * differing in exactly the config values below. Rule-of-three: 2 existed, this turn adds the extraction.
 *
 * ⛔ REFACTOR, NOT REWRITE — drill and pocket keep asserting exactly what they asserted before this file
 * existed: same EXPECTED_ORDER, same EXPECTED_ORPHANS, same strictness, nothing softened to make the engine
 * fit. Any wizard whose own real difference resisted sharing (drill's `registerExplicitly`, pocket's own
 * hand-picked `baseParamsCustom` instead of spreading its own DEFAULTS, pocket's extra `.grid-3` row selector)
 * is preserved as a declared config field, not smoothed away.
 *
 * Always renders via `renderUiTree` — the SAME thing both existing specs already do, deliberately, regardless
 * of whether `hasTreeLayout()` happens to route a given wizard's LIVE open through the tree renderer or the
 * flat one (neither drill's own `split_horizontal` trigger nor pocket's own lack of one changes what this
 * engine tests: "does the DECLARED tree reproduce the shell," a question independent of which renderer today's
 * `render()` happens to pick). NOT extended with a 'flat' mode this turn: the mill-family wizards (contour/
 * slot/surfacing/text) that would need one have a SEPARATE, larger, unrelated gap — their own bindings carry
 * almost no `section:` metadata matching their shells' own section names (text: 0 of ~30; slot/surfacing: 2
 * each) — so a flat-mode reproduction test for them would have nothing meaningful to reproduce yet. See t2373's
 * own WORK-LOG entry for the full finding. Speculatively half-building a flat-mode branch nothing exercises or
 * verifies this turn would violate the same discipline this file's own extraction is trying to uphold.
 *
 * THE NON-VACUITY HAZARD THIS ENGINE MUST NEVER INTRODUCE: EXPECTED_ORDER/EXPECTED_ORPHANS are the CALLER's
 * own hand-derived values (from reading the shell in index.html), never derived by this engine FROM the
 * declaration under test — if this file ever computed "the expected order" from `def.bindings`/`def.template`
 * itself, every spec would pass trivially forever, comparing the declaration to itself. This file only ever
 * RENDERS the tree and compares the result against what the CALLER already decided (test 1), or against the
 * LIVE SHELL opened for real (test 2) — it never reads EXPECTED_ORDER's own value back out of the def.
 */

const ROW_SELECTOR = '.form-row, .grid-2, .grid-3';   // the union both existing wizards' own grid layouts need

/** Register the three standard reproduction tests for one wizard. `cfg`:
 *  - wizardLabel: 'drill' | 'pocket' | … — used in test titles only.
 *  - dataModule: '/blocks/dataOps/drillData.js'
 *  - defFactory: 'drillDataDef' — the module's own factory function name.
 *  - shellOpenArg: 'drill' — passed to window.openWiz().
 *  - shellId: 'wiz_drill' — the shell's own container id.
 *  - expectedOrder / expectedOrphans: hand-derived by the CALLER from the shell — see the file header.
 *  - refStackModule / refStackExport: the hand-coded reference builder, for the emit-equivalence test.
 *  - dataOptypeExport: the module's own exported opType string constant (for builderOf).
 *  - registerExplicitly: true if `registerUserOp(def)` must be called before `builderOf` resolves it (drill);
 *    false if the def is already registered at app boot (pocket).
 *  - defaultsExport: the module's own DEFAULTS export name, used as the emit-equivalence base params UNLESS
 *    baseParamsCustom is given.
 *  - baseParamsCustom: an explicit, serializable base-params object overriding defaultsExport entirely (pocket
 *    uses `{shape:'rect',w:80,h:60}`, not its own full DEFAULTS — preserved exactly, not "fixed" to match
 *    drill's own convention).
 *  - editParam / editValue / expectedBeforeValue: which field the edit-and-read-back test types into, and what
 *    it expects there BEFORE the edit (the wizard's own real default for that param).
 */
export function registerFormReproductionSuite(cfg) {
    const {
        wizardLabel, dataModule, defFactory, shellOpenArg, shellId,
        expectedOrder, expectedOrphans, refStackModule, refStackExport, dataOptypeExport,
        registerExplicitly = false, defaultsExport, baseParamsCustom = null,
        editParam = 'depth', editValue = '17.5', expectedBeforeValue,
    } = cfg;

    test(`${wizardLabel}-form-reproduction: declared tree places fields in the same structure as the shell`, async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsGetBlockProgram);

        const r = await page.evaluate(async ({ dataModule, defFactory, rowSelector }) => {
            const dd = await import(dataModule);
            const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
            const def = dd[defFactory]();
            const userRoot = def.template.find((b) => b && b.type === 'user_root');

            const binds = formBindings(def);
            const tempHost = document.createElement('div');
            const readersFlat = renderOpForm(tempHost, binds) || [];
            const byParam = {};
            tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
                if (!inp || !inp.dataset || !inp.dataset.param) return;
                const row = inp.closest(rowSelector) || inp.parentElement;
                byParam[inp.dataset.param] = { row, read: readersFlat[idx] || (() => ({ [inp.dataset.param]: inp.value })) };
            });

            const host = document.createElement('div');
            document.body.appendChild(host);
            const readers = renderUiTree(host, userRoot.uiChildren, def.bindings || [], byParam);

            const fields = [...host.querySelectorAll('[data-param]')].map((el) => el.dataset.param);
            const orphanCount = readers.orphanCount;
            const explicit = fields.slice(0, fields.length - orphanCount);
            const orphans = fields.slice(fields.length - orphanCount).sort();

            return { fields, explicit, orphans, orphanCount, boundParamCount: Object.keys(byParam).length };
        }, { dataModule, defFactory, rowSelector: ROW_SELECTOR });

        expect(r.orphanCount).toBe(expectedOrphans.length);
        expect(r.orphans).toEqual(expectedOrphans);
        expect(r.explicit).toEqual(expectedOrder);
        expect(r.fields.length).toBe(r.boundParamCount);   // every bound param placed exactly once — nothing dropped
    });

    test(`${wizardLabel}-form-reproduction: usage text, section titles and code-preview tag match the live shell`, async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsGetBlockProgram);

        await page.evaluate((arg) => window.openWiz(arg), shellOpenArg);
        await page.waitForSelector('#' + shellId, { state: 'visible' });

        const shell = await page.evaluate((sid) => {
            const root = document.querySelector('#' + sid + ' .wiz-controls');
            const usage = root.querySelector('.wiz-usage')?.textContent || '';
            const codeLabel = root.querySelector('.preview-block .label')?.textContent.replace(/\s+/g, ' ').trim() || '';
            const sectionTitles = [...root.querySelectorAll('.section-label')]
                .filter((el) => el.offsetParent !== null)
                .map((el) => el.textContent);
            return { usage, codeLabel, sectionTitles };
        }, shellId);

        const tree = await page.evaluate(async ({ dataModule, defFactory, rowSelector }) => {
            const dd = await import(dataModule);
            const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
            const def = dd[defFactory]();
            const userRoot = def.template.find((b) => b && b.type === 'user_root');
            const binds = formBindings(def);
            const tempHost = document.createElement('div');
            const readersFlat = renderOpForm(tempHost, binds) || [];
            const byParam = {};
            tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
                if (!inp || !inp.dataset || !inp.dataset.param) return;
                const row = inp.closest(rowSelector) || inp.parentElement;
                byParam[inp.dataset.param] = { row, read: readersFlat[idx] || (() => ({ [inp.dataset.param]: inp.value })) };
            });
            const host = document.createElement('div');
            document.body.appendChild(host);
            renderUiTree(host, userRoot.uiChildren, def.bindings || [], byParam);
            const usage = host.querySelector('.wiz-usage')?.textContent || '';
            const codeLabel = host.querySelector('.preview-block .label')?.textContent.replace(/\s+/g, ' ').trim() || '';
            const sectionTitles = [...host.querySelectorAll('.form-sec-title')].map((el) => el.textContent);
            return { usage, codeLabel, sectionTitles };
        }, { dataModule, defFactory, rowSelector: ROW_SELECTOR });

        expect(tree.usage).toBe(shell.usage);
        expect(tree.codeLabel).toBe(shell.codeLabel);
        expect(tree.sectionTitles).toEqual(shell.sectionTitles);
    });

    test(`${wizardLabel}-form-reproduction: an edit in the declared tree reaches the op model and comes back`, async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsGetBlockProgram);

        const r = await page.evaluate(async (a) => {
            const dd = await import(a.dataModule);
            const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
            const refMod = await import(a.refStackModule);
            const { registerUserOp } = await import('/blocks/userOps.js');
            const { builderOf } = await import('/blocks/opBuilders.js');
            const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');

            const def = dd[a.defFactory]();
            if (a.registerExplicitly) registerUserOp(def);
            const dataBuilder = builderOf(dd[a.dataOptypeExport]);   // === instantiate(def, params) — the SAME path a real save uses

            const userRoot = def.template.find((b) => b && b.type === 'user_root');
            const binds = formBindings(def);
            const tempHost = document.createElement('div');
            const readersFlat = renderOpForm(tempHost, binds) || [];
            const byParam = {};
            tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
                if (!inp || !inp.dataset || !inp.dataset.param) return;
                const row = inp.closest(a.rowSelector) || inp.parentElement;
                byParam[inp.dataset.param] = { row, read: readersFlat[idx] || (() => ({ [inp.dataset.param]: inp.value })) };
            });
            const host = document.createElement('div');
            document.body.appendChild(host);
            const readers = renderUiTree(host, userRoot.uiChildren, def.bindings || [], byParam);

            // WRITE: default render, edit the target field's real DOM input the way a user would, read it back
            // through the SAME aggregation userOpView.js itself uses (_readers.map(read) → Object.assign).
            const before = {};
            for (const read of readers) Object.assign(before, read());

            const editInput = host.querySelector(`[data-param="${a.editParam}"]`);
            editInput.value = a.editValue;
            editInput.dispatchEvent(new Event('input', { bubbles: true }));
            editInput.dispatchEvent(new Event('change', { bubbles: true }));

            const after = {};
            for (const read of readers) Object.assign(after, read());

            // COMES BACK: feed the edited param set through the ACTUAL build path and confirm the emitted G-code
            // is byte-identical to the hand-coded reference builder fed the SAME edited params.
            const spindle = (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {};
            const base = a.baseParamsCustom ? { ...a.baseParamsCustom, spindle } : { ...dd[a.defaultsExport], spindle };
            const emitParams = { ...base, ...after };
            const eq = emitEquivalence(refMod[a.refStackExport], dataBuilder, [emitParams]);

            return {
                beforeVal: Number(before[a.editParam]),
                afterVal: Number(after[a.editParam]),
                eqPass: eq.pass,
                firstDiff: eq.firstDiff,
            };
        }, {
            dataModule, defFactory, rowSelector: ROW_SELECTOR, refStackModule, refStackExport,
            dataOptypeExport, registerExplicitly, defaultsExport, baseParamsCustom, editParam, editValue,
        });

        expect(r.beforeVal).toBe(expectedBeforeValue);
        expect(r.afterVal).toBe(Number(editValue));
        expect(r.eqPass).toBe(true);
    });
}
