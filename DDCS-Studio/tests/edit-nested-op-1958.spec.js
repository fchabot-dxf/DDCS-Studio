import { test, expect } from '@playwright/test';

/**
 * t1958 — EDIT WAS SILENTLY DEAD ON A MULTI-OPERATION PROGRAM. Release-quality: V2026.08.15.12 shipped Add-to-
 * program (t1940/t1942), and a real Add always wraps 2+ ops in a `multi_step` (programModel.js's own
 * `groupConsecutiveOps`) — so every multi-operation job a user now BUILDS (not just imports) hits this.
 *
 * THE DEFECT WAS TWO LOOKUPS FOR ONE QUESTION. The editor hover chip resolves its own opId via
 * `window.ddcsOpAtLine` (recurses into a multi_step's children, proven t1922) — so the ✎ chip renders, ENABLED,
 * for an op nested inside a multi_step wrapper. But `wizardManager.js`'s `openForEdit` (the chip's own click
 * handler, via `window.ddcsEditOp`) resolved the SAME id with a shallow, top-level-only `.find` — so the click
 * silently returned, no error, no form. A visible, clickable control that does nothing.
 *
 * THE FIX is not "add flattenOps here" (this is a by-ID question, not a by-line/enumeration one) — it is ONE
 * declared by-id lookup (`programModel.js`'s `findOpById`, exported beside `flattenOps`) that BOTH the chip's
 * resolver and the click's resolver are incapable of disagreeing about, plus its write-side counterpart
 * (`replaceOpById`) so the EDIT FORM'S OWN COMMIT (`opSession.js`'s `replaceOp`) reaches the same nested op too —
 * opening the form is only half the gesture; committing a changed value back to it is the other half.
 *
 * Drives the REAL gesture throughout: the real wizard bar to Add a 2nd operation (not a hand-built stack), the
 * real editor hover chip (not a direct `openForEdit` call), the real INSERT button to commit. A unit call on the
 * resolvers would pass while the chip stayed dead — this proves the whole path, chip render through committed
 * param.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function boot(page) {
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram && window.ddcsGetBlockGcode
        && window.openWiz && window.updateWiz && window.insertWiz && window.ddcsLinesForOp);
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length === 0);
}

async function insertDirect(page, opType) {
    await page.evaluate(async (t) => {
        window.openWiz(t, undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
    }, opType);
    await page.waitForFunction((t) => (window.ddcsGetBlockProgram() || []).some((b) => b && b.type === 'op' && b.opType === t), opType, { timeout: 8000 });
}

// Real "+ Add as a 2nd operation" gesture (t1942's own established flow) — the path that now always produces a
// multi_step wrapper for 2+ ops (groupConsecutiveOps, run.length > 1).
async function addSecondOp(page, opType) {
    await page.evaluate((t) => { window.openWiz(t, undefined, true); window.updateWiz(); }, opType);
    await page.evaluate(() => { window.insertWiz(); });   // fire without awaiting — hangs on the confirm dialog
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    await page.click('.app-dialog button:has-text("Add as a 2nd operation")');
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));
}

function clickNow(page, selector) {
    return page.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.click(); }, selector);
}

// t-opchips — the chip is PERSISTENT now, found by the op's own id in the row — no hover needed. `flattenOps`
// (what builds the row) treats a `multi_step` wrapper transparently, so a NESTED op still gets its own real
// chip; this is the exact same nested-resolution claim t1958 proved via hover, now via a direct lookup instead.
// Caller clicks separately so the chip's existence and the click's effect stay two distinct, orderable
// observations (t1958's own dispatch: "assert the chip and the click cannot disagree").
async function hoverChipFor(page, opId) {
    return page.evaluate((id) => {
        const chip = document.querySelector(`.op-chip[data-op-id="${id}"]`);
        return chip ? { hidden: false, disabled: chip.disabled, title: chip.title, opId: chip.dataset.opId } : { hidden: true, disabled: null, title: null, opId: null };
    }, opId);
}

test('a real Add-built 2-op program: Edit on the SECOND (nested) op opens seeded with ITS params, and a changed value commits back to it', async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page);

    // BUILD: real Add gesture — drill first, surfacing second. groupConsecutiveOps wraps both in ONE multi_step.
    await insertDirect(page, 'drill');
    await addSecondOp(page, 'surfacing');

    const structure = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        const raw = window.ddcsGetBlockProgram() || [];
        const topOps = raw.filter((b) => b && b.type === 'op');
        const flat = progMod.flattenOps(raw);
        return {
            topLevelOpCount: topOps.length,
            topLevelOpType: topOps[0] && topOps[0].opType,
            flatOpTypes: flat.map((b) => b.opType),
            secondOpId: flat[1] && flat[1].id,
            secondOpW: flat[1] && flat[1].params && flat[1].params.w,
            firstOpId: flat[0] && flat[0].id,
        };
    });
    // SANITY — the REAL Add path genuinely produces a multi_step wrapper (not two top-level ops): if this ever
    // stops being true the whole premise of this test (and t1958's own dispatch) is moot.
    expect(structure.topLevelOpCount, 'sanity: exactly one top-level op after Add').toBe(1);
    expect(structure.topLevelOpType, 'sanity: it is the multi_step wrapper').toBe('multi_step');
    expect(structure.flatOpTypes, 'sanity: both real ops present, drill first then surfacing').toEqual(['drill', 'surfacing']);
    expect(Number(structure.secondOpW), 'sanity: surfacing kept its own default w (100), not corrupted by the Add').toBe(100);

    await clickNow(page, '[data-app="studio"]');
    await page.waitForTimeout(300);

    // THE CHIP'S PROMISE — hover the SECOND (nested) op's own line. It must render ENABLED: ddcsOpAtLine already
    // recurses into multi_step (proven pre-existing, t1922), so this half of the story was never broken.
    const chip = await hoverChipFor(page, structure.secondOpId);
    expect(chip.hidden, 'the ✎ chip renders for an op nested inside a multi_step wrapper').toBe(false);
    expect(chip.disabled, 'the chip is the EDITABLE affordance, not a lock').toBe(false);
    expect(chip.opId, 'the chip is bound to the SECOND (surfacing) op\'s own id, not the wrapper\'s').toBe(structure.secondOpId);

    // Baseline BEFORE the click — the wizard overlay is not already open on this op (so a false pass can't hide
    // behind stale state left over from Add's own wizard session).
    const before = await page.evaluate(() => ({
        overlayActive: document.getElementById('wizard').classList.contains('active'),
        editingOpId: window.ddcsStudio.wizardManager.editingOpId,
    }));

    // THE CLICK'S EFFECT — the chip and the click must NOT disagree. Pre-fix: the chip above rendered enabled and
    // clicking it did NOTHING (openForEdit's own top-level-only `.find` silently failed) — this is that exact
    // defect shape's own dedicated assertion, not folded into the "eventually the form is right" check below.
    await clickNow(page, `.op-chip[data-op-id="${structure.secondOpId}"]`);
    await page.waitForTimeout(350);   // openForEdit → open() → _seedForm → update(), all synchronous once triggered
    const after = await page.evaluate(() => ({
        overlayActive: document.getElementById('wizard').classList.contains('active'),
        editingOpId: window.ddcsStudio.wizardManager.editingOpId,
    }));
    expect(after.overlayActive, 'clicking the chip actually opened the wizard overlay (the click was not a no-op)').toBe(true);
    expect(after.editingOpId, 'the wizard is editing the SECOND op\'s own id — not null (dead click), not the first op\'s id, not the wrapper\'s id').toBe(structure.secondOpId);
    expect(after.editingOpId, 'sanity: the click genuinely changed something vs. before').not.toBe(before.editingOpId);

    // THE FORM IS SEEDED WITH SURFACING'S OWN PARAMS — not the drill wizard, not empty defaults from a fresh open.
    const seededW = await page.evaluate(() => document.getElementById('sf_w') && document.getElementById('sf_w').value);
    expect(Number(seededW), 'the form is seeded with the SECOND op\'s own w (100) — not empty, not the first op\'s').toBe(100);

    // EDIT + COMMIT — change w, click the real INSERT button (now acting as Update, editingOpId is set).
    await page.evaluate(() => {
        const el = document.getElementById('sf_w');
        el.value = '150';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await clickNow(page, '.wiz-foot button.primary');

    // THE COMMIT REACHED THE RIGHT OP — surfacing's own w updated in place (same id, same position), drill
    // untouched, op count unchanged (not a phantom duplicate/insert).
    await page.waitForFunction((expected) => {
        const raw = window.ddcsGetBlockProgram() || [];
        const wrapper = raw.find((b) => b && b.type === 'op' && b.opType === 'multi_step');
        const kids = (wrapper && wrapper.children) || [];
        const surf = kids.find((b) => b && b.opType === 'surfacing');
        return surf && Number(surf.params && surf.params.w) === expected;
    }, 150, { timeout: 8000 });

    const result = await page.evaluate(async (ids) => {
        const progMod = await import('/blocks/programModel.js');
        const raw = window.ddcsGetBlockProgram() || [];
        const flat = progMod.flattenOps(raw);
        return {
            opTypes: flat.map((b) => b.opType),
            secondId: flat[1] && flat[1].id,
            secondW: flat[1] && flat[1].params && flat[1].params.w,
            firstId: flat[0] && flat[0].id,
            firstParams: flat[0] && flat[0].params,
        };
    }, { firstId: structure.firstOpId, secondId: structure.secondOpId });

    expect(result.opTypes, 'still exactly the two operations — the commit did not duplicate or drop one').toEqual(['drill', 'surfacing']);
    expect(result.secondId, 'the edited op kept its OWN id — this was a param update, not a replace-with-new').toBe(structure.secondOpId);
    expect(Number(result.secondW), 'the changed value committed back to the SECOND op').toBe(150);
    expect(result.firstId, 'the first op (drill) kept its own id, untouched by editing the second').toBe(structure.firstOpId);
});

// t1992 — mergeOpBlocks was the WORST bug of the five opSession.js shallow-lookup sites: it silently no-op'd for
// a nested op, DISCARDING the user's own hand-typed Blocks edit with no error, on the exact op they just edited.
// Drives the REAL end-to-end gesture: build via the real Add gesture (nested), make a REAL Blockly field edit on
// the nested op (so isOpBlockEdited reads true), open its ✎ chip, change a DIFFERENT form field, click Insert
// (now acting as Update) — this fires showBlockEditNotice — and choose "Keep both" (data-c="merge"). Both the
// hand-edited Blocks value AND the form change must survive; the first op must be completely untouched.
test('a real Merge choice on a nested (2nd) op keeps its hand-edited Blocks value AND the form change; the first op is untouched', async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page);

    await insertDirect(page, 'drill');
    await addSecondOp(page, 'surfacing');

    const structure = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        const flat = progMod.flattenOps(window.ddcsGetBlockProgram() || []);
        return { firstOpId: flat[0] && flat[0].id, secondOpId: flat[1] && flat[1].id, secondW: flat[1] && flat[1].params && flat[1].params.w };
    });
    expect(Number(structure.secondW), 'sanity: surfacing kept its own default w (100)').toBe(100);

    // REAL Blockly field edit on the nested op's own atom — a value override on a numeric field OTHER than `w`
    // (the depth field), so the merge must reconcile TWO independent changes, not one value touched twice.
    // Capture the EDITED ATOM'S OWN id, not just the new value — the precise, non-fooled proof that Merge
    // actually ran (vs. silently falling back to Replace, which rebuilds fresh atoms with FRESH ids: a stale
    // shallow lookup returns false → wizardManager's own `if (!committed)` fallback calls replaceOp, which
    // still correctly sets the FORM's new value, so a text-substring check on the emitted G-code could pass for
    // the wrong reason if the hand-edited NUMBER happened to also appear somewhere else in the program by
    // coincidence — checking for the SAME ATOM ID surviving with the edited value cannot be fooled that way).
    await clickNow(page, '[data-app="blocks"]');
    await page.waitForFunction((id) => window.__blkws && window.__blkws.getBlockById(id), structure.secondOpId, { timeout: 8000 });
    const edited = await page.evaluate((opId) => {
        const ws = window.__blkws;
        const op = ws.getBlockById(opId);
        const nums = op.getDescendants(false).filter((b) => b.type === 'math_number');
        // pick a field distinctly NOT the width (w=100) to avoid colliding with the form's own w change below.
        const target = nums.find((b) => Number(b.getFieldValue('NUM')) !== 100) || nums[0];
        if (!target) return null;
        // a math_number shadow has no record identity of its own (toRecord folds it straight into its OWNING
        // leaf atom's own numeric param) — the id to track is the SURROUNDING leaf atom's, not the shadow's.
        const owner = target.getSurroundParent && target.getSurroundParent();
        if (!owner) return null;
        const to = Number(target.getFieldValue('NUM')) + 3;
        target.setFieldValue(String(to), 'NUM');
        return { ownerId: owner.id, to };
    }, structure.secondOpId);
    expect(edited, 'found a numeric field (with a real owning atom) on the nested op to hand-edit').not.toBeNull();
    await page.waitForTimeout(250);

    const editedCheck = await page.evaluate((opId) => window.ddcsOpBlockEdited && window.ddcsOpBlockEdited(opId), structure.secondOpId);
    expect(editedCheck, 'sanity: the nested op is declared block-edited before opening its form').toBe(true);

    // Open the ✎ chip for the SECOND (nested) op from the editor surface, then change a DIFFERENT form field.
    await clickNow(page, '[data-app="studio"]');
    await page.waitForTimeout(300);
    const chip = await hoverChipFor(page, structure.secondOpId);
    expect(chip.hidden, 'the chip renders for the nested, block-edited op').toBe(false);
    await clickNow(page, `.op-chip[data-op-id="${structure.secondOpId}"]`);
    await page.waitForTimeout(350);
    await page.evaluate(() => {
        const el = document.getElementById('sf_w');
        el.value = '175'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Insert (now Update) — a block-edited op fires the informed notice; choose "Keep both".
    await clickNow(page, '.wiz-foot button.primary');
    await page.waitForSelector('.block-edit-notice', { timeout: 8000 });
    await clickNow(page, '.block-edit-notice [data-c="merge"]');
    await page.waitForFunction(() => !document.querySelector('.block-edit-notice'), { timeout: 8000 });

    const result = await page.evaluate(async ({ firstId, secondId, ownerId }) => {
        const progMod = await import('/blocks/programModel.js');
        const flat = progMod.flattenOps(window.ddcsGetBlockProgram() || []);
        // find the SAME owning atom by its own id, anywhere inside the second op's own children tree.
        const findById = (arr, id) => { for (const b of (arr || [])) { if (!b) continue; if (b.id === id) return b; if (b.children) { const f = findById(b.children, id); if (f) return f; } } return null; };
        const second = flat[1];
        const survivedAtom = second ? findById(second.children, ownerId) : null;
        return {
            opTypes: flat.map((b) => b.opType),
            firstId2: flat[0] && flat[0].id, firstParams: flat[0] && flat[0].params,
            secondId2: second && second.id, secondW: second && second.params && second.params.w,
            survivedAtomParams: survivedAtom ? survivedAtom.params : null,
        };
    }, { firstId: structure.firstOpId, secondId: structure.secondOpId, ownerId: edited.ownerId });

    expect(result.opTypes, 'still exactly the two operations').toEqual(['drill', 'surfacing']);
    expect(result.firstId2, 'the first op (drill) kept its own id').toBe(structure.firstOpId);
    expect(result.secondId2, 'the merged op kept its own id (Merge, not a fresh insert)').toBe(structure.secondOpId);
    expect(Number(result.secondW), 'the FORM change (w=175) committed').toBe(175);
    // the precise, non-fooled check: the SAME hand-edited atom (by its own Blockly-assigned id, `mergeArrays`'s
    // own `if (edited[a.eIdx].id) tBlock.id = edited[a.eIdx].id`) survives inside the merged op's own children,
    // carrying the edited value SOMEWHERE in its own params — a replace-fallback rebuilds fresh atoms with fresh
    // ids, so this atom id would not exist at all if Merge silently degraded to Replace. Scoped to this ONE
    // atom's own params (not the whole emitted program), so a coincidental number match elsewhere can't fool it.
    expect(result.survivedAtomParams, `the hand-edited atom (id ${edited.ownerId}) must survive the merge INSIDE the second op — got ${JSON.stringify(result)}`).not.toBeNull();
    expect(JSON.stringify(result.survivedAtomParams), `that atom's own params must carry the EDITED value (${edited.to}), not the rebuilt one — got ${JSON.stringify(result.survivedAtomParams)}`).toContain(String(edited.to));
});

// dispatch a real contextmenu event at the editor row for projected line `lineIdx` (group-gesture.spec.js's own
// established technique), return which menu items are showing.
async function rightClickEditorLine(page, lineIdx) {
    return page.evaluate((lineIdx) => {
        const ed = document.getElementById('editor');
        const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
        const rect = ed.getBoundingClientRect();
        const x = rect.left + 40, y = rect.top + pad + lineIdx * lh + lh / 2 - ed.scrollTop;
        ed.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
        const menu = document.querySelector('.op-ctx-menu');
        const items = menu && !menu.hidden ? [...menu.querySelectorAll('.op-ctx-item')].map((b) => b.textContent) : [];
        return { menuShown: !!(menu && !menu.hidden), items };
    }, lineIdx);
}
async function clickMenuItem(page, re) {
    return page.evaluate((src) => {
        const btn = [...document.querySelectorAll('.op-ctx-menu .op-ctx-item')].find((b) => new RegExp(src).test(b.textContent));
        if (!btn) return false;
        btn.click();
        return true;
    }, re.source);
}

// t1992 — right-click Delete/Duplicate on a nested op silently no-op'd, the same shape edit/glow/merge already
// had: the chip/menu renders (ddcsOpAtLine already recurses correctly), but opSession.js's own deleteOp/
// duplicateOp each carried a top-level-only findIndex, so the click did nothing — no error, no feedback.
test('right-click Delete on the SECOND (nested) op removes ONLY it — the first op survives untouched', async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page);
    await insertDirect(page, 'drill');
    await addSecondOp(page, 'surfacing');

    const structure = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        const flat = progMod.flattenOps(window.ddcsGetBlockProgram() || []);
        return { firstOpId: flat[0] && flat[0].id, secondOpId: flat[1] && flat[1].id, opTypes: flat.map((b) => b.opType) };
    });
    expect(structure.opTypes, 'sanity: drill first, surfacing (nested) second').toEqual(['drill', 'surfacing']);

    await clickNow(page, '[data-app="studio"]');
    await page.waitForTimeout(300);
    const line = ((await page.evaluate((id) => window.ddcsLinesForOp && window.ddcsLinesForOp(id), structure.secondOpId)) || [0])[0];
    const menu = await rightClickEditorLine(page, line);
    expect(menu.menuShown, 'the right-click menu renders over the nested op').toBe(true);
    expect(menu.items.some((t) => /Delete/.test(t)), `Delete is offered — got ${JSON.stringify(menu.items)}`).toBe(true);
    const clicked = await clickMenuItem(page, /Delete/);
    expect(clicked, 'the Delete menu item was found and clicked').toBe(true);
    await page.waitForTimeout(300);

    const after = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        const flat = progMod.flattenOps(window.ddcsGetBlockProgram() || []);
        return { opTypes: flat.map((b) => b.opType), ids: flat.map((b) => b.id) };
    });
    expect(after.opTypes, `Delete must remove ONLY the nested surfacing op — got ${JSON.stringify(after)}`).toEqual(['drill']);
    expect(after.ids[0], 'the surviving op is the SAME drill op, untouched').toBe(structure.firstOpId);
});

test('right-click Duplicate on the SECOND (nested) op inserts a real copy right after it — the first op is untouched', async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page);
    await insertDirect(page, 'drill');
    await addSecondOp(page, 'surfacing');

    const structure = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        const flat = progMod.flattenOps(window.ddcsGetBlockProgram() || []);
        return { firstOpId: flat[0] && flat[0].id, secondOpId: flat[1] && flat[1].id, secondW: flat[1] && flat[1].params && flat[1].params.w };
    });

    await clickNow(page, '[data-app="studio"]');
    await page.waitForTimeout(300);
    const line = ((await page.evaluate((id) => window.ddcsLinesForOp && window.ddcsLinesForOp(id), structure.secondOpId)) || [0])[0];
    const menu = await rightClickEditorLine(page, line);
    expect(menu.items.some((t) => /Duplicate/.test(t)), `Duplicate is offered — got ${JSON.stringify(menu.items)}`).toBe(true);
    const clicked = await clickMenuItem(page, /Duplicate/);
    expect(clicked, 'the Duplicate menu item was found and clicked').toBe(true);
    await page.waitForTimeout(300);

    const after = await page.evaluate(async ({ firstOpId, secondOpId }) => {
        const progMod = await import('/blocks/programModel.js');
        const flat = progMod.flattenOps(window.ddcsGetBlockProgram() || []);
        return {
            opTypes: flat.map((b) => b.opType), ids: flat.map((b) => b.id),
            firstStillThere: flat.some((b) => b.id === firstOpId),
            secondStillThere: flat.some((b) => b.id === secondOpId),
        };
    }, structure);
    expect(after.opTypes, `Duplicate must produce THREE ops, the copy as a real sibling right after the original — got ${JSON.stringify(after)}`).toEqual(['drill', 'surfacing', 'surfacing']);
    expect(after.firstStillThere, 'the first op (drill) kept its own id, untouched').toBe(true);
    expect(after.secondStillThere, 'the ORIGINAL nested op kept its own id (not replaced by the copy)').toBe(true);
    expect(new Set(after.ids).size, 'all three ops have DISTINCT ids — the copy is not a shared reference').toBe(3);
});

// t1992 — replayReconcile has NO live UI caller anywhere in the app today (grepped: zero call sites outside
// opSession.js's own definition and direct test calls — pocket-rides-raster-1406.spec.js, slot-twin-repoint-
// 1500.spec.js, this file). Its own doc comment describes an intended integration ("the single rebuild the
// three diff surfaces — glow / chip / Merge-Replace notice — share") that isn't actually wired in; whether that
// was never finished or was refactored away is unverified, named not guessed. So there is no live GESTURE to
// drive for this site — the honest verification is function-level, matching the established convention those
// two sibling files already use (calling replayReconcile directly on a real op's own id), extended to a NESTED
// one: before t1992, `prog.find(...)` was top-level-only, so this silently returned null for anything nested.
test('replayReconcile (function-level — no live UI caller today) rebuilds the SECOND (nested) op\'s own atoms from its declared params', async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page);
    // surfacing first, drill second (nested) — NOT drill-then-surfacing: surfacing's own RECONCILERS entry is
    // stale against its CURRENT parametric emit shape (`surfaceraster`, per surfacingWizard.js's own t1359 guard
    // — the old `stepdown`/`surfacefill` shape RECONCILERS.surfacing still looks for is test-only dead code today,
    // confirmed by reading, not guessed), a pre-existing, unrelated gap outside this turn's scope. `drill`'s own
    // reconciler (RECONCILERS.drill, reading `holecycle`) matches its current shape, so it isolates the ONE thing
    // this test is actually about: does replayReconcile's own BY-ID resolution reach a nested op.
    await insertDirect(page, 'surfacing');
    await addSecondOp(page, 'drill');

    const r = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        const session = await import('/blocks/opSession.js');
        const flat = progMod.flattenOps(window.ddcsGetBlockProgram() || []);
        const second = flat[1];   // drill, nested inside the multi_step wrapper
        const rebuilt = second ? session.replayReconcile(second.id) : null;
        return { secondOpType: second && second.opType, isTopLevel: (window.ddcsGetBlockProgram() || []).some((b) => b && b.id === (second && second.id)), rebuiltIsArray: Array.isArray(rebuilt), rebuiltLength: rebuilt ? rebuilt.length : -1 };
    });
    expect(r.secondOpType, 'sanity: the second op is drill, and RECONCILERS.drill matches its current emit shape').toBe('drill');
    expect(r.isTopLevel, 'sanity: this op is genuinely NESTED, not top-level (else the old code would pass by accident)').toBe(false);
    expect(r.rebuiltIsArray, 'replayReconcile must resolve the NESTED op and return its rebuilt atom array, not null').toBe(true);
    expect(r.rebuiltLength, 'the rebuilt atom set is non-empty').toBeGreaterThan(0);
});

// t1992 — setGroupChildParams's own REAL UI door (userOpView.applyGroupEdits, wizardManager.js:499) requires
// deriving a group DEF (deriveGroupDef) and rendering its generic widget form — substantially more scaffolding
// than this turn's remaining budget affords honestly. This calls the fixed function directly instead, against a
// REALISTIC nested shape (t1986's own live-confirmed drag: a group inside another group, built via the real
// groupLooseAtoms mechanism + Blockly's real connection object, not hand-built JSON) — narrower than a full
// widget-driven gesture, but a genuine exercise of the exact code path the fix touched, not a synthetic bypass.
// PARKED for a fuller UI-level pass: driving `applyGroupEdits`'s own generic form end-to-end, named here rather
// than silently skipped.
test('setGroupChildParams (function-level, narrower than a full form-widget gesture — see comment) writes into a NESTED group\'s own children', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram && window.ddcsLoadBlockStack && window.showApp, null, { timeout: 15000 });

    const setup = await page.evaluate(async () => {
        const ops = await import('/blocks/opSession.js');
        window.ddcsLoadBlockStack([
            { type: 'move', id: 'm1', params: { mode: 'rapid', x: 10, y: 10, z: 5 } },
        ]);
        const gidA = ops.groupLooseAtoms('Group A', ['m1']);
        window.ddcsLoadBlockStack([
            ...window.ddcsGetBlockProgram(),
            { type: 'move', id: 'm2', params: { mode: 'cut', x: 20, y: 20, z: -2, feed: 200 } },
        ]);
        const gidB = ops.groupLooseAtoms('Group B', ['m2']);
        return { gidA, gidB };
    });

    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(({ gidA, gidB }) => window.__blkws && window.__blkws.getBlockById(gidA) && window.__blkws.getBlockById(gidB), setup, { timeout: 8000 });
    await page.evaluate(({ gidA, gidB }) => {
        const ws = window.__blkws;
        const blkA = ws.getBlockById(gidA), blkB = ws.getBlockById(gidB);
        const gcodeInput = blkA.getInput('GCODE');
        let cur = gcodeInput.connection.targetBlock();
        while (cur && cur.nextConnection && cur.nextConnection.targetBlock()) cur = cur.nextConnection.targetBlock();
        (cur ? cur.nextConnection : gcodeInput.connection).connect(blkB.previousConnection);
    }, setup);
    await page.evaluate(async () => {
        const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
        window.ddcsLoadBlockStack(workspaceToStack(window.__blkws));
    });
    await page.waitForTimeout(300);

    const result = await page.evaluate(async ({ gidA, gidB }) => {
        const ops = await import('/blocks/opSession.js');
        const progMod = await import('/blocks/programModel.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        const before = progMod.findOpById(window.ddcsGetBlockProgram() || [], gidB);
        const isNested = !(window.ddcsGetBlockProgram() || []).some((b) => b && b.id === gidB);   // gidA is top-level; gidB must NOT be
        const flatBefore = flattenBlocks(before.children);
        const moveIdx = flatBefore.findIndex((r) => r.type === 'move');
        const ok = ops.setGroupChildParams(gidB, [{ blockIndex: moveIdx, key: 'x', value: 999 }]);
        const after = progMod.findOpById(window.ddcsGetBlockProgram() || [], gidB);
        const flatAfter = flattenBlocks(after.children);
        return { isNested, ok, editedX: flatAfter[moveIdx] && flatAfter[moveIdx].params && flatAfter[moveIdx].params.x, aStillTop: (window.ddcsGetBlockProgram() || []).some((b) => b && b.id === gidA) };
    }, setup);

    expect(result.isNested, 'sanity: Group B is genuinely nested inside Group A, not top-level').toBe(true);
    expect(result.ok, 'setGroupChildParams must resolve the NESTED group and report success').toBe(true);
    expect(result.editedX, 'the edit landed on the nested group\'s own child atom').toBe(999);
    expect(result.aStillTop, 'the outer group (A) is untouched, still top-level').toBe(true);
});
