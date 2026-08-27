import { test, expect } from '@playwright/test';

/**
 * t2323 (BACKLOG #21's own next layer, found gating drill's flip at t2321) — WIRE THE GEOMETRY SEAM.
 *
 * userOpView.js's own render() (isTree branch) correctly hides the shell's native `.wiz-visual` pane and
 * widens `.wiz-controls` to fill the modal, expecting a declared tree's own `sim` node to provide
 * visualization instead. But `update()` — the SAME file, the function that actually DRAWS geometry
 * (mgr.preview3D, applySimIntent, every drag-handle/marker call) — kept targeting the OLD plain ids that
 * pane used to own, never taught to follow render() into tree mode. Real geometry drew into a pane render()
 * had just hidden — confirmed live at t2321 with drill's own flip: the SVG had real content (5 children) but
 * a 0x0x0x0 bounding rect, because it was drawn inside the WRONG (hidden) container.
 *
 * The fix: `vizBase`/`vid`/`vel` (userOpView.js, right after `pt`/`viz3dBox`) resolve every viz-family base id
 * to the tree-suffixed one (matching formWidgets.js's own `sim` branch: userViz3dContainer_tree,
 * userVizContainer_tree, …) whenever `hasTreeLayout(_def.template)` is true — FLAT mode (the untouched,
 * default case) resolves to the exact same bare id every existing call always used.
 *
 * DRILL ITSELF STAYS UNFLIPPED THIS TURN (per the dispatch's own explicit boundary) — this test proves the
 * seam using a SYNTHETIC tree-mode op registered fresh, the same technique every prior gate-check in this
 * arc has used, so it needs no source-file flip to run. Drives `setUserOpDef` + the view's own `onShow`/
 * `update` methods directly (both exported from userOpView.js, the same object wizardManager.js itself
 * calls) rather than `wizardManager.open()`'s own `listUserOps()` lookup, which does not yet see an op
 * registered in the very same tick — a registration-timing quirk of the test harness, unrelated to the fix.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => !!window.ddcsGetBlockProgram, null, { timeout: 20000 });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager, null, { timeout: 20000 });
};

const driveOpenDirect = async (page, def) => {
    return page.evaluate(async (def) => {
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { userOpView, setUserOpDef } = await import('/wizards/views/userOpView.js');
        registerUserOp(def);
        const mgr = window.ddcsStudio.wizardManager;
        // open() routes any 'user_'-prefixed type to #wiz_user and shows it (isUserOp(type)), independent of
        // whether its own internal listUserOps().find(...) lookup succeeds — so this correctly mounts/shows
        // the right DOM shell even though that internal lookup won't see an op registered this same tick.
        mgr.open(def.opType);
        setUserOpDef(def);   // override _def directly with the correct def, bypassing that same lookup
        userOpView.onShow(mgr);   // the real render() trigger (applyPanel + render), same call wizardManager.js itself makes
        userOpView.update(mgr);   // the real geometry-drawing pass — this is what t2323 fixed
        await new Promise((res) => setTimeout(res, 800));

        const treeContainer = document.getElementById('userVizContainer_tree');
        const shellContainer = document.getElementById('userVizContainer');
        const treeStatus = document.getElementById('userVizStatus_tree');
        const shellStatus = document.getElementById('userVizStatus');
        const rectOf = (el) => el ? el.getBoundingClientRect() : null;
        const sr = rectOf(shellContainer);
        const tr = rectOf(treeContainer);
        // A container's own bounding rect is a STRUCTURAL/CSS fact owned by render()'s (unmodified,
        // already-correct) tree layout — non-zero regardless of whether update() ever wrote geometry
        // into it. update()'s own unambiguous side effect is the status line it sets as its last act
        // (`status.textContent = ...`), so THAT — which container actually received real text — is
        // what proves update() targeted the tree's own container rather than the hidden shell's.
        return {
            treeContainerFound: !!treeContainer,
            shellContainerFound: !!shellContainer,
            shellContainerVisible: !!(sr && sr.width > 0 && sr.height > 0),
            treeStatusText: treeStatus ? treeStatus.textContent : null,
            shellStatusText: shellStatus ? shellStatus.textContent : null,
            // t2327 — the exact blind spot t2325 found live: a container can be FOUND, non-hidden, and even
            // carry real status text while still rendering physically PAST the right edge of the viewport
            // (the split_horizontal responsive-stacking gap). Checked at whatever viewport the test itself
            // runs at — no override here, so this runs at the project's own 412px default unless the test
            // sets one, the exact width t2325's finding was specific to.
            treeContainerOnScreen: !!(tr && tr.x >= 0 && tr.x + tr.width <= window.innerWidth),
        };
    }, def);
};

test('TREE mode: geometry draws into the tree\'s own rendered container, not the hidden shell pane', async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page);

    const template = [{
        type: 'user_root', params: {},
        uiChildren: [{
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{ type: 'param_group', params: { group: 'Test' }, children: [
                    { type: 'field_ref', params: { param: 'rpm' } },
                ] }],
                RIGHT: [{ type: 'sim', params: { rotary: false, machine: false, magazine: false } }],
            },
        }],
        children: [
            { type: 'progstart', params: { rpm: 0, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
            { type: 'progend', params: { coolantOff: true, retract: true, retractZ: 0, park: false, end: 'M30' } },
        ],
    }];
    const rpmIdx = await page.evaluate(async (t) => {
        const { flattenBlocks } = await import('/blocks/userOps.js');
        return flattenBlocks(t).findIndex((b) => b.type === 'progstart');
    }, template);
    const def = {
        opType: 'user_t2323_seam_test', label: 'Seam Test (tree)', panel: 'form3d+2d', template,
        bindings: [{ param: 'rpm', blockIndex: rpmIdx, key: 'rpm', label: 'RPM', type: 'number', default: 0 }],
    };

    const r = await driveOpenDirect(page, def);
    expect(r.treeContainerFound, 'the tree\'s own _tree-suffixed container exists').toBe(true);
    expect(r.shellContainerVisible, 'the shell\'s own native pane stays hidden in tree mode, as render() intends').toBe(false);
    // The unambiguous proof update() itself (not render()'s already-correct structural work) targeted the
    // tree's own container: its own status-line write landed on the _tree-suffixed element, not the shell's.
    expect(r.treeStatusText, 'update() wrote its status line into the tree\'s own container').toBeTruthy();
    expect(r.shellStatusText, 'update() did NOT write into the hidden shell\'s status element').toBeFalsy();
    // t2327 — the tree's own container must be ON-SCREEN, not just present: t2325 found this exact template
    // shape (a fixed-360px split at the project's default 412px viewport) renders the tree container fully
    // past the right edge of the page before that turn's responsive-stacking fix.
    expect(r.treeContainerOnScreen, 'the tree\'s own container renders within the visible viewport, not off past the right edge').toBe(true);
});

test('CONTROL — FLAT mode: geometry still draws into the plain (non-suffixed) container, byte-identical', async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page);

    const template = [{
        type: 'user_root', params: {},
        uiChildren: [
            { type: 'param_group', params: { group: 'Test' }, children: [
                { type: 'field_ref', params: { param: 'rpm' } },
            ] },
        ],
        children: [
            { type: 'progstart', params: { rpm: 0, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
            { type: 'progend', params: { coolantOff: true, retract: true, retractZ: 0, park: false, end: 'M30' } },
        ],
    }];
    const rpmIdx = await page.evaluate(async (t) => {
        const { flattenBlocks } = await import('/blocks/userOps.js');
        return flattenBlocks(t).findIndex((b) => b.type === 'progstart');
    }, template);
    const def = {
        opType: 'user_t2323_flat_test', label: 'Flat Test', panel: 'form3d+2d', template,
        bindings: [{ param: 'rpm', blockIndex: rpmIdx, key: 'rpm', label: 'RPM', type: 'number', default: 0 }],
    };

    const r = await driveOpenDirect(page, def);
    expect(r.shellContainerFound, 'the plain shell container exists (no tree, no split node)').toBe(true);
    expect(r.shellContainerVisible, 'FLAT mode is unaffected — geometry still draws into the same pane it always did').toBe(true);
    expect(r.treeContainerFound, 'no _tree-suffixed container exists — nothing declared a split node').toBe(false);
    expect(r.shellStatusText, 'update() wrote its status line into the plain (unsuffixed) container, byte-identical to before').toBeTruthy();
});
