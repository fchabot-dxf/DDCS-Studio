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
 * Renders via `renderUiTree` for `mode:'tree'` (the default, unchanged since t2373 — drill/pocket keep asserting
 * exactly what they always did). `mode:'flat'` (added t2375, for contour/slot — the two wizards this turn gave
 * real `section:` metadata) renders via `renderOpForm` DIRECTLY, with no `renderUiTree` layer: that IS the real
 * render for a flat-mode wizard (no `split_*` node in its `uiChildren`, so `hasTreeLayout()` routes its live
 * `render()` the same way), so there is no separate "declared tree vs shell" question to ask — the DECLARED
 * BINDINGS' own array order + `section:` values (not a uiChildren tree) are what has to reproduce the shell,
 * which is exactly what contourData.js's and slotData.js's own t2375 header comments describe fixing. Flat mode
 * has no orphan concept (renderOpForm places every bound field somewhere, section box or bare row — there is no
 * separate placement tree for a field to fall out of), so its own `expectedOrder` is the FULL field list and
 * `expectedOrphans` is always `[]`. NOT reproduced here: `mountFlatPathAnchor`'s own picker mount (a userOpView.js-
 * private helper, unexported, reached only through the real `render()` — already its own proven concern via
 * t2371's `pa-mount-scope-2367.spec.js`, not re-tested by this structural engine).
 *
 * text/surfacing are NOT covered by this turn's own flat-mode addition — they still carry the SAME "almost no
 * section: metadata" gap `slot`/`surfacing` had before this turn (text: 0 of ~30 bindings). Left for a later
 * turn (t2375's own dispatch named contour+slot only — "one of each shape, so the pattern is proven both ways
 * before the remaining two").
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
 *  - expectedFrontierSections: shell section titles the twin LEGITIMATELY never renders because every field in
 *    them is a declared, unbound FRONTIER (t2375 — slot's own "REPEAT (array)" section: `pattern` stays
 *    unbound, this def is the single-slot template, see slotData.js's own header comment) — filtered out of
 *    the shell's own section list before the flat-mode comparison, so a real future regression (a bound field
 *    silently losing its section) still fails loudly.
 *  - expectedSectionTitles (t2403, pocket): when set, test 2's chrome check stops comparing the render's own
 *    section titles against the LIVE SHELL's — it pins them independently instead, against THIS array (the
 *    render's real chrome) and `expectedShellSectionTitles` (the shell's own real labels, hand-derived same as
 *    always). For a twin sectioned with the CANONICAL vocabulary (SECTION_RANK) rather than harmonized to a
 *    shell that uses its own one-off names (pocket: GEOMETRY/TOOL & CUT vs the shell's SHAPE/TOOL/TOOL &
 *    STEPOVER/DEPTH & FEED — a real, legitimate divergence, not a bug), forcing chrome-name equality would be
 *    a FALSE assertion; leaving the check out entirely would silently stop testing chrome at all. Pinning both
 *    sides as their own truths (the t2399 shape) keeps the axis meaningful without asserting something false.
 *    Every OTHER caller (drill/contour/slot) leaves this unset and keeps the original shell-equality check,
 *    unchanged.
 */
export function registerFormReproductionSuite(cfg) {
    const {
        wizardLabel, dataModule, defFactory, shellOpenArg, shellId,
        expectedOrder, expectedOrphans, refStackModule, refStackExport, dataOptypeExport,
        registerExplicitly = false, defaultsExport, baseParamsCustom = null,
        editParam = 'depth', editValue = '17.5', expectedBeforeValue,
        mode = 'tree', expectedFrontierSections = [],
        expectedSectionTitles = null, expectedShellSectionTitles = null,
    } = cfg;

    test(`${wizardLabel}-form-reproduction: declared ${mode === 'flat' ? 'bindings place' : 'tree places'} fields in the same structure as the shell`, async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsGetBlockProgram);

        const r = await page.evaluate(async ({ dataModule, defFactory, rowSelector, mode }) => {
            const dd = await import(dataModule);
            const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
            const def = dd[defFactory]();
            const binds = formBindings(def);

            if (mode === 'flat') {
                const host = document.createElement('div');
                document.body.appendChild(host);
                renderOpForm(host, binds);
                const fields = [...host.querySelectorAll('[data-param]')].map((el) => el.dataset.param);
                return { fields, explicit: fields, orphans: [], orphanCount: 0, boundParamCount: fields.length };
            }

            const userRoot = def.template.find((b) => b && b.type === 'user_root');
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
        }, { dataModule, defFactory, rowSelector: ROW_SELECTOR, mode });

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

        const tree = await page.evaluate(async ({ dataModule, defFactory, rowSelector, mode }) => {
            const dd = await import(dataModule);
            const { renderUiTree, formBindings, renderOpForm } = await import('/ui/formWidgets.js');
            const def = dd[defFactory]();
            const binds = formBindings(def);

            if (mode === 'flat') {
                const host = document.createElement('div');
                document.body.appendChild(host);
                renderOpForm(host, binds);
                const usage = host.querySelector('.wiz-usage')?.textContent || '';
                const codeLabel = host.querySelector('.preview-block .label')?.textContent.replace(/\s+/g, ' ').trim() || '';
                const sectionTitles = [...host.querySelectorAll('.form-sec-title')].map((el) => el.textContent);
                return { usage, codeLabel, sectionTitles };
            }

            const userRoot = def.template.find((b) => b && b.type === 'user_root');
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
        }, { dataModule, defFactory, rowSelector: ROW_SELECTOR, mode });

        // t2375 — flat-mode wizards (contour/slot) declare NEITHER a `usage_text` NOR a `preview_code` uiChildren
        // node (only sim/path_anchor/param_group) — both `.wiz-usage` and the `.preview-block` label are built by
        // renderUiTree's own node handling, not renderOpForm, so neither renders from a bare renderOpForm call.
        // That gap (usage/code-preview-tag parity) is a SEPARATE, pre-existing frontier, not part of this turn's
        // own section-metadata fix — left unasserted here rather than expanded into scope. Section titles are the
        // one axis this turn's fix actually owns, and the only one asserted for flat mode.
        if (mode !== 'flat') {
            expect(tree.usage).toBe(shell.usage);
            expect(tree.codeLabel).toBe(shell.codeLabel);
        }
        if (expectedSectionTitles) {
            // t2403 — pocket's own real divergence: the render's chrome (canonical GEOMETRY/TOOL & CUT) does
            // NOT match the shell's own one-off names — pinned independently, not asserted equal, per this
            // file's own header note on `expectedSectionTitles`.
            expect(tree.sectionTitles).toEqual(expectedSectionTitles);
            if (expectedShellSectionTitles) expect(shell.sectionTitles).toEqual(expectedShellSectionTitles);
        } else {
            const expectedSections = shell.sectionTitles.filter((t) => !expectedFrontierSections.includes(t));
            expect(tree.sectionTitles).toEqual(expectedSections);
        }
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

            const binds = formBindings(def);
            let host, readers;
            if (a.mode === 'flat') {
                host = document.createElement('div');
                document.body.appendChild(host);
                readers = renderOpForm(host, binds) || [];
            } else {
                const userRoot = def.template.find((b) => b && b.type === 'user_root');
                const tempHost = document.createElement('div');
                const readersFlat = renderOpForm(tempHost, binds) || [];
                const byParam = {};
                tempHost.querySelectorAll('[data-param]').forEach((inp, idx) => {
                    if (!inp || !inp.dataset || !inp.dataset.param) return;
                    const row = inp.closest(a.rowSelector) || inp.parentElement;
                    byParam[inp.dataset.param] = { row, read: readersFlat[idx] || (() => ({ [inp.dataset.param]: inp.value })) };
                });
                host = document.createElement('div');
                document.body.appendChild(host);
                readers = renderUiTree(host, userRoot.uiChildren, def.bindings || [], byParam);
            }

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
            dataOptypeExport, registerExplicitly, defaultsExport, baseParamsCustom, editParam, editValue, mode,
        });

        expect(r.beforeVal).toBe(expectedBeforeValue);
        expect(r.afterVal).toBe(Number(editValue));
        expect(r.eqPass).toBe(true);
    });
}
