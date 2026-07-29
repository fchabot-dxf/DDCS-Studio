import { test, expect } from '@playwright/test';

/**
 * t736 — TRANSFORM BECOMES DECLARED + THE ROTATION CHIP. The ⟳ Transform rotation is now a FLAT program-level
 * declaration — a childless `xform{angle,pivotX,pivotY}` sibling at the top of the stack (the mill ENTRY-marker shape).
 * The EMITTER applies it ONCE at generation (applyProgramTransform in emitMapped); the ops' own params stay clean; it
 * round-trips through Blocks + save/load; a program BADGE beside the ⟳ Transform button shows it (click = reopen
 * prefilled, ✕ = clear to 0 = BYTE-IDENTICAL). Legacy makeRotate wrappers still emit (coexist, no migration).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

/**
 * t1365 — SEEDED FROM A POCKET, because this file is about the XFORM and surfacing stopped being a program a
 * whole-program rotation can act on. Surfacing emits PARAMETRICALLY now, and t1353's guard REFUSES to text-rotate a
 * program carrying parametric motion rather than half-applying one (it measured the failure: rotation couples the
 * axes, so a move it can only half-rewrite gains a second axis word — uncommanded motion on a cutting line). Refusing
 * is the shipped truth; the rotation machinery is not surfacing-specific, so it is demonstrated on a literal op that
 * still rotates, and the refusal gets its own test at the bottom of this file.
 */
async function seedProgram(page, wiz = 'pocket') {
    await page.evaluate(async (w) => {
        window.ddcsLoadBlockStack([]);
        window.openWiz(w, undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
    }, wiz);
    await page.waitForTimeout(350);
}

test('rotate via the modal → xform declared + emit rotated + op params UNTOUCHED + badge shows; ✕ → byte-identical', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetBlockProgram && window.ddcsGetBlockGcode && window.ddcsAlignRotate);
    await seedProgram(page);

    const base = await page.evaluate(() => window.ddcsGetBlockGcode());
    const opsBefore = await page.evaluate(() => JSON.stringify((window.ddcsGetBlockProgram() || []).filter((b) => b.type === 'op').map((o) => o.params)));
    expect(base.trim().length, 'the seed program emitted G-code').toBeGreaterThan(0);

    // open the Transform modal, type an angle, apply
    await page.evaluate(() => window.ddcsAlignRotate());
    await page.waitForSelector('[data-pane="align"] [data-ang]', { state: 'visible', timeout: 8000 });
    await page.fill('[data-pane="align"] [data-ang]', '12');
    await page.dispatchEvent('[data-pane="align"] [data-ang]', 'input');
    await page.click('[data-pane="align"] [data-rgo]');
    await page.waitForTimeout(350);

    // (a) the rotation is a DECLARED flat xform sibling at the top of the stack
    const decl = await page.evaluate(() => { const s = window.ddcsGetBlockProgram() || []; const x = s.find((b) => b && b.type === 'xform'); return { params: x ? x.params : null, first: s[0] && s[0].type }; });
    expect(decl.params, 'the rotation is a declared xform sibling').not.toBeNull();
    expect(decl.params.angle, 'angle 12° declared').toBeCloseTo(12, 3);
    expect(decl.first, 'the xform sits at the TOP of the stack (program-level)').toBe('xform');

    // (b) the emit is rotated (differs from base) AND the ops' own params are untouched (program-level, not baked)
    const rotated = await page.evaluate(() => window.ddcsGetBlockGcode());
    expect(rotated, 'the emit changed (rotation applied at generation)').not.toBe(base);
    const opsAfter = await page.evaluate(() => JSON.stringify((window.ddcsGetBlockProgram() || []).filter((b) => b.type === 'op').map((o) => o.params)));
    expect(opsAfter, 'the ops keep their own params (the rotation is program-level, never baked into the ops)').toBe(opsBefore);

    // (c) the program BADGE shows the active rotation
    await expect(page.locator('#xform-badge')).toBeVisible();
    await expect(page.locator('#xform-badge .xform-badge-label')).toContainText('12');

    // (d) ✕ clears the declaration → BYTE-IDENTICAL to pre-rotation + badge hidden
    await page.click('#xform-badge .xform-badge-x');
    await page.waitForTimeout(350);
    const cleared = await page.evaluate(() => window.ddcsGetBlockGcode());
    expect(cleared, 'clearing the rotation is byte-identical to the pre-rotation emit (the 0° fold)').toBe(base);
    await expect(page.locator('#xform-badge')).toBeHidden();
});

test('the declaration drives the emit (edit angle → follows) + save/load round-trips it', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetBlockProgram && window.ddcsGetBlockGcode);
    await seedProgram(page);
    const base = await page.evaluate(() => window.ddcsGetBlockGcode());

    // declare a 20° rotation (as the modal writes it)
    await page.evaluate(async () => {
        const { makeXform } = await import('/blocks/programFraming.js');
        window.ddcsLoadBlockStack([makeXform({ angle: 20, pivotX: 5, pivotY: 5 }), ...window.ddcsGetBlockProgram()]);
    });
    await page.waitForTimeout(300);
    const at20 = await page.evaluate(() => window.ddcsGetBlockGcode());
    expect(at20).not.toBe(base);

    // EDIT the angle (as a Blocks edit of the field would) → the emit FOLLOWS
    await page.evaluate(() => {
        const s = (window.ddcsGetBlockProgram() || []).map((b) => ({ ...b, params: { ...b.params } }));
        s.find((b) => b.type === 'xform').params.angle = 40;
        window.ddcsLoadBlockStack(s);
    });
    await page.waitForTimeout(300);
    const at40 = await page.evaluate(() => window.ddcsGetBlockGcode());
    expect(at40, 'changing the declared angle re-emits (everything follows the declaration)').not.toBe(at20);
    await expect(page.locator('#xform-badge .xform-badge-label')).toContainText('40');

    // SAVE → LOAD round-trips the declaration (rides the stack; .mjson serializes it)
    const saved = await page.evaluate(async () => { const m = await import('/blocks/programFile.js'); return JSON.stringify(m.serializeProject('t736')); });
    expect(saved).toContain('xform');
    await page.evaluate(() => window.ddcsLoadBlockStack([]));   // wipe
    await page.waitForTimeout(150);
    await page.evaluate(async (j) => { const m = await import('/blocks/programFile.js'); m.loadProject(JSON.parse(j)); }, saved);
    await page.waitForTimeout(300);
    const afterLoad = await page.evaluate(() => { const s = window.ddcsGetBlockProgram() || []; const x = s.find((b) => b && b.type === 'xform'); return { angle: x ? x.params.angle : null, emit: window.ddcsGetBlockGcode() }; });
    expect(afterLoad.angle, 'the xform declaration survives save/load').toBeCloseTo(40, 3);
    expect(afterLoad.emit, 'the loaded program emits rotated (the declaration round-trips)').toBe(at40);
});

test('the xform renders + round-trips through the Blocks workspace (Blocks-editable, not dropped)', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetBlockProgram && window.showApp);
    await seedProgram(page);
    await page.evaluate(async () => { const { makeXform } = await import('/blocks/programFraming.js'); window.ddcsLoadBlockStack([makeXform({ angle: 15, pivotX: 3, pivotY: 7 }), ...window.ddcsGetBlockProgram()]); });
    await page.evaluate(() => window.showApp('blocks'));   // open the Blocks tab → renderFromModel puts the model (incl. the xform) into the workspace
    // DETERMINISTIC: wait for the xform block to actually RENDER into the workspace (Blockly lazy-inits + renders async;
    // an arbitrary sleep flaked under full-gate load). If it never renders, this times out → the real bug surfaces.
    await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).some((b) => b.type === 'xform'), { timeout: 8000 });
    // read the LIVE Blockly workspace back to a stack — the xform must be present with its fields (it renders + is
    // editable via the generic fields path; if it were dropped/uneditable it would vanish from workspaceToStack)
    const rt = await page.evaluate(async () => {
        const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
        const x = (workspaceToStack(window.__blkws) || []).find((b) => b && b.type === 'xform');
        return x ? x.params : null;
    });
    expect(rt, 'the xform round-trips through the Blocks workspace (renders + editable, not dropped)').not.toBeNull();
    expect(rt.angle, 'angle survives the Blocks round-trip').toBeCloseTo(15, 3);
    expect(rt.pivotX, 'pivotX survives the Blocks round-trip').toBeCloseTo(3, 3);
});

/**
 * t1365 — AND THE REFUSAL IS THE OTHER HALF OF THE SAME TRUTH. A program carrying a PARAMETRIC body cannot be
 * text-rotated: the rotation rewrites a move with BOTH axis words, and on `G0 X0 Y#47` it can only replace the X —
 * so it used to APPEND, giving the controller a second Y on a cutting line (t1353's measurement). It refuses the
 * whole program now and touches nothing, and it SAYS SO rather than failing silently, because the operator asked
 * for a rotation and would otherwise believe it happened.
 *
 * This is the flow that narrows: a program containing a surfacing op cannot be aligned by the Transform / Align
 * rotate today. The improvement turn absorbs rotation INTO the atom (a declared frame angle, the same way placement
 * and the skim frame were absorbed) — at which point this test's second half becomes "it rotates", not "it refuses".
 */
test('a PARAMETRIC program refuses the rotation, with its reason, and is left byte-identical', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    const warnings = [];
    page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetBlockProgram && window.ddcsGetBlockGcode && window.ddcsAlignRotate);
    await seedProgram(page, 'surfacing');

    const base = await page.evaluate(() => window.ddcsGetBlockGcode());
    expect(base, 'the seed really is the parametric surfacing body').toContain('SURFACING, parametric');

    await page.evaluate(() => window.ddcsAlignRotate());
    await page.waitForSelector('[data-pane="align"] [data-ang]', { state: 'visible', timeout: 8000 });
    await page.fill('[data-pane="align"] [data-ang]', '12');
    await page.dispatchEvent('[data-pane="align"] [data-ang]', 'input');
    await page.click('[data-pane="align"] [data-rgo]');
    await page.waitForTimeout(350);

    // THE PROGRAM IS UNTOUCHED — not half-rotated, not silently partly-rewritten.
    const after = await page.evaluate(() => window.ddcsGetBlockGcode());
    expect(after, 'a parametric program comes back byte-identical — nothing was half-applied').toBe(base);
    // …AND THE REASON IS SAID OUT LOUD. Silence is the worst refusal.
    expect(warnings.join(' | '), `the refusal names itself (saw: ${warnings.join(' | ')})`).toMatch(/rotate.*(refused|skipped)/i);
});
