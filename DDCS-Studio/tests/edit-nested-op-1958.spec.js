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

// Hover the editor at op `opId`'s first projected line so the ✎ chip surfaces (group-edit-1954's own pattern),
// returning its pre-click render state — hidden/disabled/text — WITHOUT clicking. Caller clicks separately so the
// chip's promise and the click's effect are two distinct, orderable observations (t1958's own dispatch: "assert
// the chip and the click cannot disagree" needs its own assertion, not folded into a single combined step).
async function hoverChipFor(page, opId) {
    return page.evaluate((id) => {
        const ed = document.getElementById('editor');
        const firstLine = ((window.ddcsLinesForOp && window.ddcsLinesForOp(id)) || [0])[0] || 0;
        const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
        const rect = ed.getBoundingClientRect();
        ed.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + 40, clientY: rect.top + pad + firstLine * lh + lh / 2 - ed.scrollTop }));
        const chip = document.getElementById('op-edit-chip');
        return { hidden: chip.hidden, disabled: chip.disabled, text: chip.textContent, opId: chip.dataset.opId };
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
    await clickNow(page, '#op-edit-chip');
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
