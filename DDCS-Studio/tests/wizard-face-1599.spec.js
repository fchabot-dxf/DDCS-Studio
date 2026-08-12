import { test, expect } from '@playwright/test';

/**
 * t1599 — A DEFINE CUSTOM WIZARD BLOCK ON THE CANVAS MEANS THE WIZARD VIEW TAB HAS CONTENT.
 *
 * t1734 — RETIRED THE FACE, KEPT THE FACT. The Blocks right column used to wear one of two faces (the Generator
 * Modal, class `.wizard-view`, or Preview + projected G-code) chosen FOR the user by a predicate. GAMEPLAN STEP 3
 * deleted that predicate's PANE-VISIBILITY role along with the Projected G-code pane: Wizard View and 3D are now
 * two ALWAYS-PRESENT tabs, clicked, never guessed. What survives — unchanged — is the underlying fact this spec
 * traces: whether the Wizard View tab's CONTENT is the wizard's form, an empty/mid-edit message, or truly nothing.
 * `renderLiveForm`'s `show` predicate (deriveLiveWizard's authoredHere/customizing/hasTree/def) is exactly as it
 * was; only `setRightFace` — the part that used to also hide/show the whole pane and rewrite the drawer title — is
 * gone. This file is repointed accordingly: `face()` (below) now reads `#blk-form`'s CONTENT only, never the DOM
 * class/title that no longer exists.
 *
 * ── THE FINDING THAT SHAPED THE UNDERLYING FACT (still true, still why the code looks the way it does) ───────────
 * `deriveAuthoredDef` did not throw, and the `userRoot` lookup did not take a wrong branch. It only ever searched
 * the stack's TOP LEVEL — and on the Customize route the wizard root sits INSIDE an `op` container, so it was never
 * found at all. The face then rested entirely on a second term, `editingWizardType()`, which `editWizardDef`
 * DELIBERATELY clears for the fork-only twins (surfacing / slot / drill / bore). Corner survived on that accident;
 * surfacing had none of the three terms and showed nothing.
 *
 *   route                              hasTree   editing   old face   content today
 *   Customize corner (bindingSpecs)    false     set       wizard     form
 *   Customize surfacing (fork-only)    false     null      PREVIEW    form     ← the reported gap
 *   hand-built + panel + param_group   true      null      wizard     form
 *   bare Define Custom Wizard          false     null      PREVIEW    form     ← mid-edit
 *   plain program, no wizard block     false     null      Preview    empty    ← the reverse must hold
 *   PLACED data-op twin in a program   false     null      Preview    empty    ← the trap; see that test
 *
 * ⚠ THE OBVIOUS FIX IS WRONG, AND THE LAST ROW IS WHY. "A Define Custom Wizard block anywhere in the stack means
 * content" is what the ruling sounds like, and I wrote exactly that first — but every data-op twin's INSTANTIATED
 * body is `[user_root{…}]`, so inserting Corner into an ordinary program would have conjured a form for it. A placed
 * op is a program, not an authoring session. So the content asks a DECLARED fact instead of guessing at a shape:
 * devMode.authoringWizardType(), set by every Customize including the fork-only ones, and checked against the stack
 * still holding that op so a stale session cannot claim a program it no longer describes. The old proxies survive
 * as additional SUFFICIENT conditions — a plain saved op with a param pill has no user_root at all.
 */

const boot = async (page) => {
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsEditWizardDef, null, { timeout: 60000 });
    // t1734 — the Blocks tab must actually be OPEN for face()/settle() to read anything: ddcsEditWizardDef opens it
    // as a side effect (so the CUSTOMIZE test below always worked), but ddcsLoadBlockStack alone does not — the
    // other three tests here only ever call that, and window.__blkws stayed undefined until this was added (a
    // pre-existing gap in boot(), unrelated to the tab restructure — found while verifying the repoint below).
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
/** What the Wizard View tab's CONTENT is — read off #blk-form, not off a DOM class/title (t1734: neither exists
 *  any more; the tab itself is always present regardless of this). */
const face = async (page) => page.evaluate(() => {
    const host = document.getElementById('blk-form');
    return {
        formText: (host && host.textContent || '').trim(),
        fields: host ? host.querySelectorAll('[data-param]').length : -1,
    };
});

test('CUSTOMIZE renders the wizard\'s form — for a fork-only twin too, which is the one that was broken', async ({ page }) => {
    test.setTimeout(300_000);
    page.on('dialog', (d) => d.accept());
    await boot(page);
    for (const opType of ['user_surfacing_data', 'user_slot_data', 'user_drill_data', 'user_bore_data', 'user_corner_data']) {
        await page.evaluate(() => window.ddcsLoadBlockStack([]));
        await page.evaluate((t) => window.ddcsEditWizardDef(t), opType);
        await settle(page);
        const f = await face(page);
        // The four fork-only twins are the ones `editWizardDef` clears the editing context for — they had NONE of
        // the three old terms true. Corner rides along to prove the fix did not trade one route for another.
        expect(f.fields, `${opType}: customizing a wizard renders its bound fields`).toBeGreaterThan(0);
    }
});

test('a plain program leaves the Wizard View tab empty — the reverse still holds', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([
        { type: 'progstart', params: { rpm: 12000, clearance: 5 } },
        { type: 'move', params: { x: 10, y: 20, z: 3 } },
        { type: 'progend', params: { retractZ: 20 } },
    ]));
    await settle(page);
    const f = await face(page);
    expect(f.fields, 'no wizard block → no fields conjured').toBe(0);
    // …and it does not leave a message telling the reader to add a block while the program is right there.
    expect(f.formText, 'the form host is truly empty, not carrying stale advice').toBe('');
});

test('a PLACED data-op twin in a program leaves the Wizard View tab empty — the trap in the obvious fix', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await boot(page);
    // ⚠ THE OBVIOUS FIX IS WRONG AND THIS IS WHY. "A Define Custom Wizard block anywhere in the stack means
    // content" reads well and I wrote it — but EVERY data-op twin's instantiated body is `[user_root{…}]`, so
    // merely INSERTING Corner into an ordinary program would have conjured a form for it and taken the sim's 3D
    // tab's relevance away. A placed op is a program, not an authoring session; the content asks a DECLARED fact
    // (devMode.authoringWizardType) instead of guessing from the stack's shape.
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const OB = await import('/blocks/opBuilders.js');
        const def = U.getUserDef('user_corner_data');
        const params = U.defaultParams(def);
        window.ddcsLoadBlockStack([OB.makeOp('user_corner_data', params, U.instantiate(def, params))]);
    });
    await settle(page);
    const placed = await page.evaluate(() => {
        const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op');
        return { hasOp: !!op, opType: op && op.opType };
    });
    expect(placed.opType, 'the program really does hold a placed data-op twin').toBe('user_corner_data');
    const f = await face(page);
    expect(f.fields, 'a PLACED twin is a program, not an authoring session → no fields conjured').toBe(0);
    expect(f.formText, 'and no stale/mismatched message either — truly empty').toBe('');
});

test('MID-EDIT — a half-built wizard\'s tab SAYS WHAT IS MISSING, never a blank form', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);

    // (1) a bare Define Custom Wizard: nothing in either mouth
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'user_root', params: {}, uiChildren: [], children: [] }]));
    await settle(page);
    let f = await face(page);
    expect(f.formText, 'a bare Define Custom Wizard names what is missing, rather than showing an empty form').toMatch(/empty/i);
    expect(f.formText, 'naming the mouth to drop blocks into').toMatch(/Presentation/i);
    expect(f.fields, 'no form fields are drawn — there are none to draw').toBe(0);

    // (2) a Presentation mouth that HAS content but declares no layout and binds no field — an EMPTY Parameter
    //     Group is the shape you get halfway through adding one. A different absence, so a different sentence.
    await page.evaluate(() => window.ddcsLoadBlockStack([{
        type: 'user_root', params: {},
        uiChildren: [{ type: 'param_group', params: { group: 'Settings' }, children: [] }],
        children: [{ type: 'move', params: { x: 0, y: 0, z: 5 } }],
    }]));
    await settle(page);
    f = await face(page);
    expect(f.formText, 'the message distinguishes "no fields yet" from "empty"').toMatch(/no fields yet/i);
    expect(f.formText, 'and names what adds one').toMatch(/Form field/i);

    // (3) …and once the Presentation mouth declares a LAYOUT, the tab stops apologising and renders it. This is the
    //     boundary between the two messages above and the real thing, asserted so a future empty-state cannot creep
    //     forward and start covering a wizard that has something to show.
    await page.evaluate(() => window.ddcsLoadBlockStack([{
        type: 'user_root', params: {},
        uiChildren: [{ type: 'panel', params: { panel: 'form3d' } }],
        children: [{ type: 'move', params: { x: 0, y: 0, z: 5 } }],
    }]));
    await settle(page);
    f = await face(page);
    expect(f.formText, 'a declared layout RENDERS — no empty-state message').not.toMatch(/empty|no fields yet/i);
});
