import { test, expect } from '@playwright/test';

/**
 * t1605 — renderUiTree renders a `param_group`'s rows.
 *
 * t1599 gave the Blocks right pane the correct FACE (Customize a twin → the Wizard View), but the face's
 * CONTENT was incomplete: where Surfacing's parameter rows belong, the pane showed the unwired placeholder
 * `⚠ "param_group" — not wired yet` beside empty Feature Canvas / Visualization boxes. Two gaps compounded:
 *
 *   · `renderUiTree` had no `param_group` branch — the node fell to the unwired-placeholder else, and its
 *     28 `param_field` children traversed into a byParam map that was EMPTY, because
 *   · the right pane's registered-def fallback looked for `b.params.opType` while an op block carries
 *     `opType` TOP-LEVEL (opBuilders.makeOp) — so on the Customize route (op wrapping the root) the def
 *     stayed the DERIVED one, whose bindings are [] for a twin (no knobs, no pills on its canvas).
 *
 * The fix is CONSUMPTION, not derivation (t1562's one-source rule): the rows the tree places are the ones
 * `renderOpForm(formBindings(def))` already materializes — the param_group branch is transparent and its
 * param_field children pick their pre-rendered row out of byParam. Values are LIVE both ways on this face:
 * a form row edit writes the canvas param_field's dflt (writeAuthoredValue's declaration fallback), and a
 * canvas dflt edit syncs back into the non-focused form field (the tree face's structure-unchanged sync).
 */

const boot = async (page) => {
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsEditWizardDef, null, { timeout: 60000 });
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 60000 });
};
const settle = async (page) => {
    let last = -1;
    for (let i = 0; i < 120; i++) {
        const n = await page.evaluate(() => window.__blkws.getAllBlocks().length);
        if (n === last) return;
        last = n;
        await page.waitForTimeout(250);
    }
};
const customize = async (page, opType) => {
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.evaluate((t) => window.ddcsEditWizardDef(t), opType);
    await settle(page);
};
/** The wizard-view form pane's row state, read off the live DOM. */
const rows = async (page) => page.evaluate(() => {
    const host = document.getElementById('blk-form');
    return {
        fields: host ? [...host.querySelectorAll('[data-param]')].map((f) => f.dataset.param) : [],
        unwired: host ? [...host.querySelectorAll('.unwired-block')].map((e) => e.dataset.blockType) : [],
    };
});

test('Customize Surfacing — the param_group renders as its rows, not a placeholder', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await boot(page);
    await customize(page, 'user_surfacing_data');
    const r = await rows(page);
    expect(r.unwired, 'no "param_group — not wired yet" placeholder remains').not.toContain('param_group');
    // The canvas param_group carries the twin's materialized declaration rows; the form face must show them.
    expect(r.fields.length, 'the parameter rows render where the placeholder sat').toBeGreaterThanOrEqual(20);
    expect(r.fields, 'the rows are the DECLARED ones (spot-checked)').toEqual(expect.arrayContaining(['depth', 'stepdown', 'toolDia', 'feed']));
    // Row ORDER is the canvas's declared mouth order — toolNum leads the surfacing group.
    expect(r.fields.indexOf('toolNum'), 'declared first row renders first').toBe(0);
});

test('Customize Corner — the full row set renders too (post-guard-render)', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await boot(page);
    await customize(page, 'user_corner_data');
    const r = await rows(page);
    expect(r.unwired, 'no param_group placeholder').not.toContain('param_group');
    expect(r.fields.length, 'corner renders its full declared row set').toBeGreaterThanOrEqual(20);
});

test('values are LIVE both ways on the wizard-view face', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await boot(page);
    await customize(page, 'user_surfacing_data');

    // form → block: editing a row writes the canvas declaration (the param_field's dflt) — the two-way pair of
    // the face READING row dflts. Drive the real gesture: fill + input event on the rendered field.
    const depth = page.locator('#blk-form [data-param="depth"]');
    await expect(depth, 'the depth row rendered').toHaveCount(1);
    await depth.fill('2.5');
    await depth.dispatchEvent('input');
    await page.waitForFunction(() => {
        const walk = (bs, out = []) => { for (const b of bs || []) { if (!b) continue; out.push(b); walk(Array.isArray(b.children) ? b.children : Object.values(b.children || {}).flat(), out); walk(Array.isArray(b.uiChildren) ? b.uiChildren : Object.values(b.uiChildren || {}).flat(), out); } return out; };
        const pf = walk(window.ddcsGetBlockProgram() || []).find((b) => b.type === 'param_field' && b.params && b.params.param === 'depth');
        return pf && Number(pf.params.dflt) === 2.5;
    }, null, { timeout: 10_000 });

    // block → form: a canvas edit of another row's dflt reaches the (non-focused) form field. setFieldValue fires
    // the real Blockly change event → reproject → the tree face's structure-unchanged value sync.
    await page.evaluate(() => {
        const blk = window.__blkws.getAllBlocks().find((b) => b.type === 'param_field' && b.getFieldValue('PARAM') === 'stepdown');
        blk.setFieldValue('0.75', 'DFLT');
    });
    await expect(page.locator('#blk-form [data-param="stepdown"]'), 'the canvas dflt edit lands in the form row').toHaveValue('0.75', { timeout: 10_000 });
    // …and the depth edit above survived (the sync did not clobber the earlier write with a stale rebuild).
    await expect(depth).toHaveValue('2.5');
});
