import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 1400, height: 1000 } });

/**
 * t2335 (Finding 2 from t2333) — `render()`'s own `byParam` row-boundary lookup (`userOpView.js`) has ALWAYS
 * read `inp.closest('.form-row') || inp.closest('.grid-2') || inp.parentElement` — but NEITHER `.form-row` NOR
 * `.grid-2` was ever actually ASSIGNED to a row anywhere in `formWidgets.js` (confirmed by repo-wide grep: no
 * `styles.css` rule for either, and no `classList.add`/`className` assignment in the rendering code). For a
 * SIMPLE widget (its own `[data-param]` element a DIRECT CHILD of the row `renderOpForm`'s own `addRow` creates)
 * `inp.parentElement` happens to equal that row anyway, so it worked BY ACCIDENT. For a COMPOSITE widget —
 * roughly HALF of every widget carrying a bindable value (toggle/slider/stepper/toolpick/threadpick/
 * feedsuggest/planesuggest — each wraps its own controls in an inner span/label before appending to its row) —
 * `inp.parentElement` is that INNER wrapper, NOT the row. In TREE mode, `field_ref` relocates a row by exactly
 * this boundary (`container.appendChild(byParam[paramName].row)`) — so a composite widget's row (the wrapper,
 * not the true outer row `render()`'s own click handlers later resolve `#wiz_user_form` through) never moves;
 * the widget's own `host` closure stays stranded in the detached pre-render fragment, and anything computed
 * from it later — like `feedSuggestWidget`'s own click handler doing `host.closest('#wiz_user_form')` — silently
 * fails. THIS IS A PRE-EXISTING BUG IN EVERY COMPOSITE WIDGET, present in FLAT mode too — tree mode's own
 * relocation mechanism is just the first thing to actually DEPEND on the row boundary being correct; a flat
 * render never needed to move anything, so the wrong boundary was never exercised there.
 *
 * THE FIX: `addRow` (formWidgets.js) now tags its own row with `.form-row` unconditionally, at the ONE place a
 * row is ever created — the class `.closest()` was clearly always meant to find. This closes the gap for EVERY
 * widget uniformly (simple or composite, present or future) with no per-widget change: `.closest()` already
 * climbs past any wrapper depth to find the tagged ancestor.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => !!window.ddcsGetBlockProgram, null, { timeout: 20000 });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager, null, { timeout: 20000 });
};

const buildOp = async (page) => page.evaluate(async () => {
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { userOpView, setUserOpDef } = await import('/wizards/views/userOpView.js');
    const { flattenBlocks } = await import('/blocks/userOps.js');

    const paramGroupChildren = [
        { id: 'fr_tn', type: 'field_ref', params: { param: 'toolNum' } },
        { id: 'fr_mat', type: 'field_ref', params: { param: 'material' } },
        { id: 'fr_feed', type: 'field_ref', params: { param: 'feed' } },
    ];
    const template = [{
        type: 'user_root', params: {},
        uiChildren: [{
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{ type: 'param_group', params: { group: 'Test' }, children: paramGroupChildren }],
                RIGHT: [{ type: 'sim', params: { rotary: false, machine: false, magazine: false } }],
            },
        }],
        children: [
            { type: 'progstart', params: { rpm: 0, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
            { type: 'progend', params: { coolantOff: true, retract: true, retractZ: 0, park: false, end: 'M30' } },
        ],
    }];
    const idx = flattenBlocks(template).findIndex((b) => b.type === 'progstart');
    const def = {
        opType: 'user_t2335_composite_widget', label: 'Composite Widget Test', panel: 'form3d+2d', template,
        bindings: [
            { param: 'toolNum', blockIndex: idx, key: 'rpm', label: 'Tool', type: 'number', default: '', widget: 'toolpick' },
            { param: 'material', blockIndex: idx, key: 'clearance', label: 'Material', type: 'enum', default: '', widget: 'feedsuggest' },
            { param: 'feed', blockIndex: idx, key: 'spinUp', label: 'Feed', type: 'number', default: 100 },
        ],
    };
    registerUserOp(def);
    const mgr = window.ddcsStudio.wizardManager;
    mgr.open(def.opType);
    setUserOpDef(def);
    userOpView.onShow(mgr);
    await new Promise((res) => setTimeout(res, 300));
});

test('a composite widget (toolpick) under a field_ref in TREE mode keeps its row correctly scoped', async ({ page }) => {
    await boot(page);
    await buildOp(page);
    const r = await page.evaluate(() => {
        const form = document.getElementById('wiz_user_form');
        const tnRow = form.querySelector('[data-param="toolNum"]').closest('.form-row');
        return {
            rowFound: !!tnRow,
            rowIsInLiveForm: !!(tnRow && form.contains(tnRow)),
            rowHasFormRowClass: !!(tnRow && tnRow.classList.contains('form-row')),
        };
    });
    expect(r.rowFound, 'the toolpick row is found via .closest(\'.form-row\')').toBe(true);
    expect(r.rowIsInLiveForm, 'that row is a live descendant of #wiz_user_form, not a detached fragment').toBe(true);
    expect(r.rowHasFormRowClass, 'the row itself carries the class the lookup searches for').toBe(true);
});

test('the feeds-speeds Apply button (a composite feedsuggest widget) correctly computes and fills feed', async ({ page }) => {
    await boot(page);
    await buildOp(page);
    const r = await page.evaluate(() => {
        const form = document.getElementById('wiz_user_form');
        const tn = form.querySelector('[data-param="toolNum"]');
        const mat = form.querySelector('[data-param="material"]');
        const feed = form.querySelector('[data-param="feed"]');
        tn.value = '1'; tn.dispatchEvent(new Event('change', { bubbles: true }));
        mat.value = 'Aluminum'; mat.dispatchEvent(new Event('change', { bubbles: true }));
        const feedBefore = feed.value;
        const btn = document.querySelector('.feedsuggest-btn');
        btn.click();
        return { feedBefore, feedAfter: feed.value, btnTitle: btn.title };
    });
    expect(r.feedAfter, 'Apply correctly computed 947 for Aluminum, tool 1 (Ø6, 2fl)').toBe('947');
    expect(r.feedBefore, 'the pre-click value differs from 947 (toolpick\'s own auto-fill happened first, not the bug)').not.toBe('947');
    expect(r.btnTitle, 'the tooltip shows the real computed working, not the generic placeholder').toContain('947 mm/min');
});
