import { test, expect } from '@playwright/test';

/**
 * t2333 (Finding 1 from t2329, found gating drill's flip) — `stackBridge.js`'s `recToJson` threw the moment a
 * real `split_horizontal`/`split_vertical` node carried children: `block "split_horizontal" (kind "undefined")
 * carries 2 children but its def declares no \`mouth\`` — a deliberate, loud t1638 guard (five prior silent
 * losses this way — t1069/t1093/t1595/t1627/t1636), correctly firing on a genuine gap rather than a false
 * alarm: `wizards/ops/layout.js` already declares `mouths: [{name:'LEFT'},{name:'RIGHT'}]` (PLURAL) for both
 * split blocks, but neither the Blockly SHAPE builder (`bridge.js`'s `addMouth` call) nor `stackBridge.js`'s
 * round-trip serializer (`toRecord`/`recToJson`) ever read `def.mouths` — only the singular `def.mouth`, which
 * split_horizontal never set (it genuinely needs TWO distinguishable mouths; a single `mouth:'DO'` would merge
 * LEFT+RIGHT into one undifferentiated list). `gridContainer.js`'s own t2299 comment already named this exact
 * "plural declared, singular consumed" gap once, for itself — its own fix switched to singular since it only
 * needed one mouth. `groupBox.js` and `tabGroup.js` (its OUTER `mouths:[{name:'TABS'}]`) carry the identical
 * dead-plural shape, never yet given real children to expose it.
 *
 * THE FIX: `bridge.js`'s new `mouthsOf(def)` normalizes `def.mouths` (plural) OR `def.mouth` (singular, wrapped
 * as a one-item list) — one shape, one thing to loop over, for the 3 places that used to check `mouthOf`
 * (bridge.js's own block-shape builder, stackBridge.js's read AND write directions). A single mouth (every
 * existing kind, including groupBox/tabGroup's own length-1 `mouths` arrays) takes the SAME single-mouth path
 * as before — `rec.children` stays a flat array, byte-identical. Two-or-more mouths (only split_horizontal/
 * split_vertical currently) read/write `rec.children[name]` per mouth — the SAME mouth-keyed object shape
 * `childrenOf` already normalizes everywhere else in the app, so nothing downstream needed to learn anything
 * new. `mouthOf` (singular-only) is removed outright — no consumer needed it once all three call sites moved
 * to the generalized `mouthsOf`.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => !!window.ddcsGetBlockProgram && window.ddcsEditWizardDef, null, { timeout: 20000 });
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 20000 });
};

test('stackToWorkspace no longer throws on a split_horizontal, and workspaceToStack reads its two mouths back', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { stackToWorkspace, workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
        const ws = window.__blkws;
        const template = [{
            id: 'root1', type: 'user_root', params: {},
            uiChildren: [{
                id: 'split1', type: 'split_horizontal', params: { ratio: '1:1' },
                children: {
                    LEFT: [{ id: 'pg1', type: 'param_group', params: { group: 'Test' }, children: [
                        { id: 'fr1', type: 'field_ref', params: { param: 'rpm' } },
                    ] }],
                    RIGHT: [{ id: 'sim1', type: 'sim', params: { rotary: false, machine: false, magazine: false } }],
                },
            }],
            children: [
                { id: 'ps1', type: 'progstart', params: { rpm: 0, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
                { id: 'pe1', type: 'progend', params: { coolantOff: true, retract: true, retractZ: 0, park: false, end: 'M30' } },
            ],
        }];
        let writeError = null, readError = null, readBack = null;
        try { stackToWorkspace(template, ws); } catch (e) { writeError = e.message; }
        if (!writeError) { try { readBack = workspaceToStack(ws); } catch (e) { readError = e.message; } }
        return { writeError, readError, readBack };
    });
    expect(r.writeError, `stackToWorkspace threw: ${r.writeError}`).toBeNull();
    expect(r.readError, `workspaceToStack threw: ${r.readError}`).toBeNull();
    const root = (r.readBack || []).find((b) => b.type === 'user_root');
    expect(root, 'user_root survived the round-trip').toBeTruthy();
    const split = (root.uiChildren || []).find((b) => b.type === 'split_horizontal');
    expect(split, 'split_horizontal survived the round-trip inside uiChildren').toBeTruthy();
    expect(split.children && split.children.LEFT && split.children.LEFT[0] && split.children.LEFT[0].type, 'LEFT mouth survived with its param_group').toBe('param_group');
    expect(split.children && split.children.RIGHT && split.children.RIGHT[0] && split.children.RIGHT[0].type, 'RIGHT mouth survived with its sim node').toBe('sim');
});

test('a single-mouth kind (param_group) stays byte-identical: flat children array, not mouth-keyed', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { stackToWorkspace, workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
        const ws = window.__blkws;
        const template = [{
            id: 'root1', type: 'user_root', params: {},
            uiChildren: [{ id: 'pg1', type: 'param_group', params: { group: 'Solo' }, children: [
                { id: 'fr1', type: 'field_ref', params: { param: 'rpm' } },
            ] }],
            children: [{ id: 'ps1', type: 'progstart', params: { rpm: 0, dir: 'cw', spinUp: 0, clearance: 5, skim: false } }],
        }];
        stackToWorkspace(template, ws);
        const readBack = workspaceToStack(ws);
        return { readBack };
    });
    const root = (r.readBack || []).find((b) => b.type === 'user_root');
    const pg = (root.uiChildren || []).find((b) => b.type === 'param_group');
    expect(Array.isArray(pg.children), 'a single-mouth kind still reads back a plain array, not an object').toBe(true);
    expect(pg.children[0].type, 'the single mouth\'s content survived').toBe('field_ref');
});
