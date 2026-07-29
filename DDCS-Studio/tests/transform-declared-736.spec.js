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
 *
 * t1375 — SEEDED FROM SURFACING AGAIN, and the paragraph above is kept rather than tidied away because it was true for
 * exactly as long as it was written to be. The rotation is no longer applied to a parametric op's TEXT: the angle
 * reaches the atom as program context and the atom BAKES it into the coordinates it emits, while
 * applyProgramTransform stays range-aware and still rotates everything around it. So the narrowed flow re-opens — a
 * program containing a surfacing op can be aligned again — and the refusal test at the bottom of this file became a
 * rotation test. The GUARD keeps its meaning: it still refuses a skim-rotation and any hand-authored parametric text
 * no atom claimed (see surfacing-rotation-absorbed-1375).
 */
async function seedProgram(page, wiz = 'surfacing') {
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
 * t1375 — FLIPPED, exactly as that note said it would be: "at which point this test's second half becomes 'it
 * rotates', not 'it refuses'." The rotation is no longer done to the parametric text at all — the angle reaches the
 * atom as program context and the atom bakes it into the coordinates it emits. So this now measures the REAL GESTURE
 * end to end: type an angle into the Transform modal on a parametric surfacing program, and the geometry turns.
 *
 * IT IS ASSERTED AGAINST THE GEOMETRY, NOT THE TEXT. The emitted coordinates are expressions the machine resolves, so
 * "did it rotate" cannot be read off the G-code with a regex. The engine resolves both programs and every cutting
 * point of the rotated one must be the un-rotated point turned 12° about the datum — an independent truth, computed
 * here rather than taken from the thing under test.
 */
test('a PARAMETRIC program ROTATES — the atom absorbs the angle, and the toolpath really turns', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    const warnings = [];
    page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetBlockProgram && window.ddcsGetBlockGcode && window.ddcsAlignRotate);
    await seedProgram(page, 'surfacing');

    const base = await page.evaluate(() => window.ddcsGetBlockGcode());
    expect(base, 'the seed really is the parametric surfacing body').toContain('SURFACING, parametric');
    const cutOf = async () => page.evaluate(async () => {
        const { traceToolpath } = await import('/engine/trace.js');
        return (traceToolpath(window.ddcsGetBlockGcode()).segments || []).filter((s) => !s.rapid).map((s) => [s.x2, s.y2, s.z2, +Number(s.feed || 0).toFixed(3)]);   // t1377 — feed included: a rotation must not change how fast anything cuts
    });
    const before = await cutOf();
    expect(before.length, 'the parametric program resolves to real cutting moves').toBeGreaterThan(4);

    await page.evaluate(() => window.ddcsAlignRotate());
    await page.waitForSelector('[data-pane="align"] [data-ang]', { state: 'visible', timeout: 8000 });
    await page.fill('[data-pane="align"] [data-ang]', '12');
    await page.dispatchEvent('[data-pane="align"] [data-ang]', 'input');
    await page.click('[data-pane="align"] [data-rgo]');
    await page.waitForTimeout(350);

    // (1) THE EMIT CHANGED — the rotation is no longer turned away at the door.
    const after = await page.evaluate(() => window.ddcsGetBlockGcode());
    expect(after, 'the rotation reached a parametric program (it is not byte-identical any more)').not.toBe(base);
    // (2) NOTHING WAS REFUSED, and the absence is asserted rather than assumed.
    expect(warnings.join(' | '), `no refusal on a datum-framed parametric program (saw: ${warnings.join(' | ')})`).not.toMatch(/(rotate|rotation).*(refused|skipped)/i);
    // (3) AND THE GEOMETRY TURNED BY THE ANGLE ASKED FOR, about the datum, point for point.
    const turned = await cutOf();
    expect(turned.length, 'same number of cutting moves — a rotation is not a different program').toBe(before.length);
    const th = 12 * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
    for (let i = 0; i < before.length; i++) {
        const [x, y, z] = before[i];
        expect(turned[i][0], `cut ${i} X turned 12° about the datum`).toBeCloseTo(x * c - y * s, 2);
        expect(turned[i][1], `cut ${i} Y turned 12° about the datum`).toBeCloseTo(x * s + y * c, 2);
        expect(turned[i][2], `cut ${i} Z is untouched by a planar rotation`).toBeCloseTo(z, 3);
        expect(turned[i][3], `cut ${i} runs at the SAME FEED — a rotation moves a point, never a speed (t1377)`).toBe(before[i][3]);
    }
    // (4) AND CLEARING IT IS STILL BYTE-IDENTICAL — the 0° fold, which is what keeps the mechanism invisible until asked for.
    await page.click('#xform-badge .xform-badge-x');
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => window.ddcsGetBlockGcode()), 'clearing the rotation returns the exact original bytes').toBe(base);
});
