// t975 — the mill-op export TITLE/filename. Mill ops lead with `G90 ( absolute )`; buildProgram's old raw-line
// fallback used that verbatim → a surfacing export became "g90_absolute.nc" (junk). The fix derives a clean title
// from the program MODEL (the first op's friendly label + its W×H) → "Surfacing …". An explicit ( header ) still wins;
// a hand-edited program (model ≠ editor) still falls back to the raw line. No emit change (export-title only).
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.editorManager && window.ddcsGetBlockProgram);
});

test('a generated SURFACING program exports as "Surfacing …", not the junk "g90 absolute"', async ({ page }) => {
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
    await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
    await page.evaluate(() => window.ddcsStudio.wizardManager.update());
    await page.evaluate(async () => { await window.ddcsStudio.wizardManager.insert(); });   // commit the op → editor + model (the real flow)
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
        const { name, code } = window.ddcsStudio.editorManager.buildProgram();
        return { name, line1: (code.split(/\r?\n/)[0] || '') };
    });
    // the REAL SYMPTOM: the derived filename is the op name, not the first CODE line (g90 absolute)
    expect(r.name.toLowerCase(), 'filename comes from the op label').toContain('surfacing');
    expect(r.name.toLowerCase(), 'NOT the junk g90-absolute filename').not.toContain('g90');
    expect(r.name.toLowerCase()).not.toContain('absolute');
    // the exported line 1 is the title comment (wrapped, paren-safe) — never a nested paren
    expect(r.line1).toMatch(/^\(\s*Surfacing/i);
    expect((r.line1.match(/\(/g) || []).length, 'no nested parens on line 1').toBe(1);
});

test('an explicit ( header ) still WINS over the model-derived name', async ({ page }) => {
    await page.evaluate(() => window.ddcsStudio.editorManager.setValue('( My Facing Job )\nG90   ( absolute )\nM3 S8000\nG0 Z5'));
    const name = await page.evaluate(() => window.ddcsStudio.editorManager.buildProgram().name);
    expect(name.toLowerCase(), 'the user header wins → my_facing_job.nc').toContain('facing');
    expect(name.toLowerCase(), 'NOT the g90 line').not.toContain('g90');
});

test('a hand-edited program with no matching model falls back to the raw first line (no stale name)', async ({ page }) => {
    // raw text the model does not track → _firstOpTitle returns '' (proj.text !== code) → raw-line fallback
    await page.evaluate(() => window.ddcsStudio.editorManager.setValue('G1 X10 Y10 F500\nG1 X20'));
    const name = await page.evaluate(() => window.ddcsStudio.editorManager.buildProgram().name);
    expect(name.toLowerCase()).toContain('g1');   // the raw first line, not a model op name
});

// t1978 — a multi-op program (the real Add gesture, t1940/t1942) wraps in ONE multi_step, and _firstOpTitle's own
// shallow top-level `.find` resolved THAT wrapper — opLabelOf('multi_step') has no OP_LABELS/USER_LABELS entry
// for the internal type, so it fell through to the bare string 'multi_step' verbatim. Every multi-operation
// export/download was titled and filed as "multi_step.nc", on every single one, since t975 shipped. Fixed via
// flattenOps (programModel.js's own declared enumeration, t1928) — same canonical-lookup shape as t1974
// (segmentFrame.js) and t1976 (editorOpHover.js).
test('a multi-op program (real Add gesture) exports as the FIRST op\'s own name, never the "multi_step" wrapper\'s', async ({ page }) => {
    // drill first, surfacing second — same known-good pair as edit-nested-op-1958/word-glow's own t1976 test.
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
    await page.waitForSelector('#wiz_drill', { state: 'visible' });
    await page.evaluate(() => window.ddcsStudio.wizardManager.update());
    await page.evaluate(async () => { await window.ddcsStudio.wizardManager.insert(); });
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).some((b) => b && b.opType === 'drill'), { timeout: 8000 });

    await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
    await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
    await page.evaluate(() => window.ddcsStudio.wizardManager.update());
    await page.evaluate(() => { window.ddcsStudio.wizardManager.insert(); });   // fires the confirm dialog (canvas non-empty)
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    await page.click('.app-dialog button:has-text("Add as a 2nd operation")');
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));
    await page.waitForFunction(async () => {
        const progMod = await import('/blocks/programModel.js');
        return progMod.flattenOps(window.ddcsGetBlockProgram() || []).length === 2;
    }, { timeout: 10000 });
    await page.waitForTimeout(200);

    const r = await page.evaluate(() => {
        const raw = window.ddcsGetBlockProgram() || [];
        const wrapped = raw.find((b) => b && b.type === 'op' && b.opType === 'multi_step');
        const { name, code } = window.ddcsStudio.editorManager.buildProgram();
        return { wrapped: !!wrapped, name, line1: (code.split(/\r?\n/)[0] || '') };
    });
    expect(r.wrapped, 'sanity: the real Add gesture genuinely produced a multi_step wrapper').toBe(true);
    expect(r.name.toLowerCase(), 'the REAL first op names the file').toContain('drill');
    expect(r.name.toLowerCase(), 'NOT the internal wrapper\'s own opType').not.toContain('multi_step');
    expect(r.line1.toLowerCase(), 'the title comment line also names the real op, not the wrapper').toContain('drill');
});
