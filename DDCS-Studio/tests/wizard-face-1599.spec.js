import { test, expect } from '@playwright/test';

/**
 * t1599 — A DEFINE CUSTOM WIZARD BLOCK ON THE CANVAS MEANS THE WIZARD FACE.
 *
 * The Blocks right pane wears one of two faces: the Generator Modal (`.wizard-view`) or Preview + projected G-code.
 * A user customizing a wizard — Define Custom Wizard block, a FORM, a `panel`, a full Parameter Group, all on the
 * canvas — got the PREVIEW face, and ruled that a gap: authoring a wizard should show the wizard.
 *
 * ⚠ TRACED, NOT GUESSED, AND IT WAS NEITHER CANDIDATE. `deriveAuthoredDef` did not throw, and the `userRoot` lookup
 * did not take a wrong branch. It only ever searched the stack's TOP LEVEL — and on the Customize route the wizard
 * root sits INSIDE an `op` container, so it was never found at all. The face then rested entirely on a second term,
 * `editingWizardType()`, which `editWizardDef` DELIBERATELY clears for the fork-only twins (surfacing / slot / drill
 * / bore). Corner survived on that accident; surfacing had none of the three terms and showed Preview.
 *
 *   route                              hasTree   editing   old face   new face
 *   Customize corner (bindingSpecs)    false     set       wizard     wizard
 *   Customize surfacing (fork-only)    false     null      PREVIEW    wizard   ← the reported gap
 *   hand-built + panel + param_group   true      null      wizard     wizard
 *   bare Define Custom Wizard          false     null      PREVIEW    wizard   ← mid-edit
 *   plain program, no wizard block     false     null      Preview    Preview  ← the reverse must hold
 *   PLACED data-op twin in a program   false     null      Preview    Preview  ← the trap; see that test
 *
 * ⚠ THE OBVIOUS FIX IS WRONG, AND THE LAST ROW IS WHY. "A Define Custom Wizard block anywhere in the stack means the
 * wizard face" is what the ruling sounds like, and I wrote exactly that first — but every data-op twin's INSTANTIATED
 * body is `[user_root{…}]`, so inserting Corner into an ordinary program flipped the pane and took the sim's Preview
 * away. A placed op is a program, not an authoring session. So the face asks a DECLARED fact instead of guessing at
 * a shape: devMode.authoringWizardType(), set by every Customize including the fork-only ones, and checked against
 * the stack still holding that op so a stale session cannot claim a program it no longer describes. The old proxies
 * survive as additional SUFFICIENT conditions — a plain saved op with a param pill has no user_root at all.
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
/** What the pane is actually WEARING, read off the live DOM — not off a recomputed predicate. */
const face = async (page) => page.evaluate(() => {
    const right = document.querySelector('.right');
    const host = document.getElementById('blk-form');
    return {
        wizard: !!(right && right.classList.contains('wizard-view')),
        title: (right && right.querySelector('.blk-drawer-title') || {}).textContent || '',
        formText: (host && host.textContent || '').trim(),
        fields: host ? host.querySelectorAll('[data-param]').length : -1,
    };
});

test('CUSTOMIZE shows the wizard face — for a fork-only twin too, which is the one that was broken', async ({ page }) => {
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
        expect(f.wizard, `${opType}: customizing a wizard shows the WIZARD face`).toBe(true);
        expect(f.title, `${opType}: and the drawer says so`).toBe('Wizard View');
    }
});

test('a plain program keeps Preview + G-code — the reverse still holds', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([
        { type: 'progstart', params: { rpm: 12000, clearance: 5 } },
        { type: 'move', params: { x: 10, y: 20, z: 3 } },
        { type: 'progend', params: { retractZ: 20 } },
    ]));
    await settle(page);
    const f = await face(page);
    expect(f.wizard, 'no wizard block → NOT the wizard face').toBe(false);
    expect(f.title, 'the drawer says Preview').toBe('Preview');
    // …and it does not leave a message telling the reader to add a block while the program is right there.
    expect(f.formText, 'the hidden form host is empty, not carrying stale advice').toBe('');
});

test('a PLACED data-op twin in a program keeps Preview + G-code — the trap in the obvious fix', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await boot(page);
    // ⚠ THE OBVIOUS FIX IS WRONG AND THIS IS WHY. "A Define Custom Wizard block anywhere in the stack means the
    // wizard face" reads well and I wrote it — but EVERY data-op twin's instantiated body is `[user_root{…}]`, so
    // merely INSERTING Corner into an ordinary program flipped the whole right pane to the wizard face and took the
    // sim's Preview + projected G-code away from it. A placed op is a program, not an authoring session; the face
    // asks a DECLARED fact (devMode.authoringWizardType) instead of guessing from the stack's shape.
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
    expect(f.wizard, 'a PLACED twin is a program, not an authoring session → Preview face').toBe(false);
    expect(f.title, 'and the drawer says Preview').toBe('Preview');
});

test('MID-EDIT — a half-built wizard gets the wizard face, and the face SAYS WHAT IS MISSING', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);

    // (1) a bare Define Custom Wizard: nothing in either mouth
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'user_root', params: {}, uiChildren: [], children: [] }]));
    await settle(page);
    let f = await face(page);
    expect(f.wizard, 'a bare Define Custom Wizard is still a wizard being authored').toBe(true);
    expect(f.formText, 'and the face names what is missing, rather than showing an empty form').toMatch(/empty/i);
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
    expect(f.wizard, 'still the wizard face').toBe(true);
    expect(f.formText, 'the message distinguishes "no fields yet" from "empty"').toMatch(/no fields yet/i);
    expect(f.formText, 'and names what adds one').toMatch(/Form field/i);

    // (3) …and once the Presentation mouth declares a LAYOUT, the face stops apologising and renders it. This is the
    //     boundary between the two messages above and the real thing, asserted so a future empty-state cannot creep
    //     forward and start covering a wizard that has something to show.
    await page.evaluate(() => window.ddcsLoadBlockStack([{
        type: 'user_root', params: {},
        uiChildren: [{ type: 'panel', params: { panel: 'form3d' } }],
        children: [{ type: 'move', params: { x: 0, y: 0, z: 5 } }],
    }]));
    await settle(page);
    f = await face(page);
    expect(f.wizard, 'still the wizard face').toBe(true);
    expect(f.formText, 'a declared layout RENDERS — no empty-state message').not.toMatch(/empty|no fields yet/i);
});
