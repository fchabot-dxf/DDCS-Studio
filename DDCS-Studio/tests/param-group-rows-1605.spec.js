import { test, expect } from '@playwright/test';
import { getBlkFormHost } from './support/blkFormHost.js';
import { stopLiveSim } from './support/simControls.js';
import { registerClassicFixture } from './support/classicFixture.js';

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
    // t2351 — the app's own declared "everything is wired" signal (t1279), not a hand-picked global subset —
    // see wizard-face-1599's own boot() for the full trace of why this class of wait was silently racy.
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 60000 });
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
/** The wizard-view form pane's row state, read off the live DOM. t1752 — "which host" via the SHARED
 *  getBlkFormHost (tests/support/blkFormHost.js): Customize always reaches createUserOpView('blk')'s
 *  #blk_wiz_user_form now (every twin sampled so far is sectioned/panel-shaped — t1748), but this helper
 *  doesn't assume that, it asks. */
const rows = async (page) => page.evaluate(`(() => {
    const host = (${getBlkFormHost.toString()})();
    return {
        fields: host ? [...host.querySelectorAll('[data-param]')].map((f) => f.dataset.param) : [],
        unwired: host ? [...host.querySelectorAll('.unwired-block')].map((e) => e.dataset.blockType) : [],
    };
})()`);

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
    // t1754 — ROOT-CAUSED against the pane's own contract (saving this exact stack as a custom wizard, then
    // comparing the saved def's bindings against these rendered fields): membership matches EXACTLY (30/30,
    // including zMode and passes — both ARE in the saved bindings, so the pane is right to show them).
    //
    // t2377 REBASELINE — this assertion used to check that entryX/entryY rendered FIRST, promoted ahead of
    // every other field by `renderOpForm`'s own SECTION_RANK whitelist (t1239, formWidgets.js: `['IDENTITY',
    // 'GEOMETRY', 'TOOL & CUT']`) purely because entryX/entryY were the twin's ONLY 'GEOMETRY'-sectioned
    // bindings at the time — a SYMPTOM of the section-metadata ABSENCE bug t2377 fixed (see surfacingData.js's
    // own header comment above SURFACING_BINDING_SPECS), not a real declared intent. entryX/entryY now
    // correctly carry `section: 'AREA'` (matching the shell's own field grouping, alongside originX/originY/w/h
    // — not a hardcoded-whitelist name), so the artificial front-of-form promotion is GONE: the render order
    // now follows the real section order AREA -> TOOL -> TOOL & STEPOVER -> DEPTH & FEED, and the first two
    // fields are AREA's own first-declared pair.
    expect(r.fields.slice(0, 2), 'AREA-sectioned fields (originX/originY) render first, matching the shell\'s own field order').toEqual(['originX', 'originY']);
    expect(r.fields.indexOf('toolNum'), 'toolNum sits in the TOOL section, after AREA\'s own fields (originX..h, entryX, entryY)').toBe(13);
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
    // t2545 — switched from surfacing to CORNER, since `materializeParamGroup`'s own field_ref-presence skip
    // (t2543) means a field_ref-declaring twin gets NO `param_field` canvas blocks materialized at all, and
    // surfacing had just moved onto the field_ref/group_box tree. t2631 — corner ITSELF is now field_ref-based
    // (BACKLOG #71/#72's own last op), and by then every built-in twin is — this test's whole premise (a
    // canvas `param_field` block whose own DFLT field is the thing under test) has no remaining built-in
    // subject at all, not because the two-way sync broke, but because `field_ref` doesn't carry a settable
    // default field the way `param_field` does (it references a live binding row, it doesn't declare one) —
    // this mechanism and that node type are simply not the same question. Switched to `classicFixture`
    // (t2629's synthetic, PERMANENTLY-classic op, built for exactly this "borrowed a real op that migrated out
    // from under the test" disease — passes-field-1613/pane-sizer-1353/pane-visual-host-1760/&c.) instead of
    // chasing a moving target a third time.
    const opType = await registerClassicFixture(page);
    await customize(page, opType);

    // form → block: editing a row writes the canvas declaration (the param_field's dflt) — the two-way pair of
    // the face READING row dflts. Drive the real gesture: fill + input event on the rendered field.
    // t1752 — Customize via Blocks is deterministically the createUserOpView('blk') host (sectioned template,
    // customizing=true so never the placed-op read-only case) — a plain Playwright locator can't ask
    // getBlkFormHost's "which host" question dynamically, so this is the one place a direct id is still correct.
    // t1820 — #blk_wiz_user's preview panel autoplays a looping sim on Customize (same mechanism as
    // pane-surface-scroll-1766's own chronic flake, WORK-LOG t1818); under load the still-playing sim can keep
    // the form's own layout unstable long enough for .fill()'s actionability check to time out. Scoped to the
    // whole pane rather than the sibling convention's narrower '#blk_userViz3dBox', because a plain form3d op
    // (no explicit `panel:`) mounts its preview through the layout2d slot's own parent instead — see WORK-LOG.
    await stopLiveSim(page, '#blk_wiz_user');
    const depth = page.locator('#blk_wiz_user_form [data-param="depth"]');
    await expect(depth, 'the depth row rendered').toHaveCount(1);
    await depth.fill('42');
    await depth.dispatchEvent('input');
    await page.waitForFunction(() => {
        const walk = (bs, out = []) => { for (const b of bs || []) { if (!b) continue; out.push(b); walk(Array.isArray(b.children) ? b.children : Object.values(b.children || {}).flat(), out); walk(Array.isArray(b.uiChildren) ? b.uiChildren : Object.values(b.uiChildren || {}).flat(), out); } return out; };
        const pf = walk(window.ddcsGetBlockProgram() || []).find((b) => b.type === 'param_field' && b.params && b.params.param === 'depth');
        return pf && Number(pf.params.dflt) === 42;
    }, null, { timeout: 10_000 });

    // block → form: a canvas edit of another row's dflt reaches the (non-focused) form field. setFieldValue fires
    // the real Blockly change event → reproject → the tree face's structure-unchanged value sync.
    await page.evaluate(() => {
        const blk = window.__blkws.getAllBlocks().find((b) => b.type === 'param_field' && b.getFieldValue('PARAM') === 'stepdown');
        blk.setFieldValue('0.75', 'DFLT');
    });
    await expect(page.locator('#blk_wiz_user_form [data-param="stepdown"]'), 'the canvas dflt edit lands in the form row').toHaveValue('0.75', { timeout: 10_000 });
    // …and the depth edit above survived (the sync did not clobber the earlier write with a stale rebuild).
    await expect(depth).toHaveValue('42');
});
