import { test, expect } from '@playwright/test';
import { autoAppDialog } from './_appDialog.js';

/**
 * t1938 — THE THREE SILENT DOORS, CLOSED. `saveStates.confirmDestructiveLoad` (S4-1) already existed and already
 * proved out (blocks-load-guard-s41.spec.js) for `ddcsEditWizardDef`'s own re-author gesture. This turn routes the
 * three OTHER doors that replaced the program with NO warning through the SAME seam, never a second one: loading a
 * marked `.nc` file (ui/commandDeck.js), opening a saved `.mjson` project (blocks/programFile.js's `loadProject` —
 * the ONE choke point all 4 of its own UI callers share), and the editor's Clear button (ui/editorManager.js).
 * The wizard-bar Insert door is deliberately NOT here — it gets its own 3-way Add/Replace/Cancel dialog next turn.
 *
 * Each door gets the SAME two proofs, per t1930's own naming: Cancel leaves the program BYTE-IDENTICAL (asserted
 * against the emitted G-code, not a flag), and Proceed is genuinely recoverable — the snapshot lands and Undo
 * restores the prior program byte-identically.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function boot(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram && window.ddcsGetBlockGcode
        && window.ddcsUndo && window.openWiz && window.updateWiz && window.insertWiz && window.clearCode && window.loadGcodeFile);
}

async function insertDrill(page) {
    await page.evaluate(async () => {
        window.openWiz('drill', undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
    });
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).some((b) => b && b.type === 'op'), { timeout: 8000 });
}

// ── DOOR 1 — Clear ──────────────────────────────────────────────────────────────────────────────────────────────

test('CLEAR: Cancel leaves the program byte-identical', async ({ page }) => {
    await boot(page);
    await insertDrill(page);
    const gcodeBefore = await page.evaluate(() => window.ddcsGetBlockGcode());

    await page.evaluate(() => { window.clearCode(); });   // fire without awaiting (async, blocks on the confirm)
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    await page.click('.app-dialog button:has-text("Cancel")');
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));

    expect(await page.evaluate(() => window.ddcsGetBlockGcode()), 'Cancel leaves the G-code byte-identical').toBe(gcodeBefore);
    expect(await page.evaluate(() => (window.ddcsGetBlockProgram() || []).length), 'the program was not wiped').toBeGreaterThan(0);
});

test('CLEAR: Proceed clears, and Undo restores the prior program byte-identically', async ({ page }) => {
    await boot(page);
    await insertDrill(page);
    const gcodeBefore = await page.evaluate(() => window.ddcsGetBlockGcode());

    await autoAppDialog(page, { accept: true });
    await page.evaluate(() => window.clearCode());
    expect(await page.evaluate(() => (window.ddcsGetBlockProgram() || []).length), 'Proceed actually clears').toBe(0);

    await page.evaluate(() => window.ddcsUndo());
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length > 0, { timeout: 8000 });
    expect(await page.evaluate(() => window.ddcsGetBlockGcode()), 'Undo restores byte-identical G-code').toBe(gcodeBefore);
});

test('CLEAR: an empty canvas gets no prompt at all (nothing to lose)', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length === 0);

    await page.evaluate(() => window.clearCode());   // awaited directly — must resolve with no dialog to click
    expect(await page.evaluate(() => !!document.querySelector('.app-dialog')), 'no confirm raised for an empty program').toBe(false);
});

// ── DOOR 2 — open a saved .mjson project (blocks/programFile.js's loadProject, the ONE choke point) ───────────────

const otherProject = () => ({
    kind: 'ddcs.macro', v: 1, name: 'Other Job',
    stack: [{ id: 'op-other', type: 'op', opType: 'user_other_job', label: 'Other Job', requires: [], params: {}, children: [{ type: 'move', params: { x: 5, y: 5, z: -1 } }] }],
});

test('OPEN PROJECT: Cancel returns null and leaves the program byte-identical', async ({ page }) => {
    await boot(page);
    await insertDrill(page);
    const gcodeBefore = await page.evaluate(() => window.ddcsGetBlockGcode());

    await page.evaluate(async (other) => {
        const { loadProject } = await import('/blocks/programFile.js');
        window.__loadPromise = loadProject(other);   // not awaited here — it hangs on the confirm
    }, otherProject());
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    await page.click('.app-dialog button:has-text("Cancel")');
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));

    const result = await page.evaluate(() => window.__loadPromise);
    expect(result, 'loadProject returns null on Cancel — the caller knows nothing loaded').toBe(null);
    expect(await page.evaluate(() => window.ddcsGetBlockGcode()), 'Cancel leaves the G-code byte-identical').toBe(gcodeBefore);
});

test('OPEN PROJECT: Proceed loads the new program, and Undo restores the prior one byte-identically', async ({ page }) => {
    await boot(page);
    await insertDrill(page);
    const gcodeBefore = await page.evaluate(() => window.ddcsGetBlockGcode());

    await autoAppDialog(page, { accept: true });
    const result = await page.evaluate(async (other) => {
        const { loadProject } = await import('/blocks/programFile.js');
        return loadProject(other);
    }, otherProject());
    expect(result && result.name, 'loadProject returns the loaded object on success').toBe('Other Job');
    expect(await page.evaluate(() => (window.ddcsGetBlockProgram() || []).some((b) => b.opType === 'user_other_job')),
        'the new program actually loaded').toBe(true);

    await page.evaluate(() => window.ddcsUndo());
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).some((b) => b.type === 'op' && b.opType !== 'user_other_job'), { timeout: 8000 });
    expect(await page.evaluate(() => window.ddcsGetBlockGcode()), 'Undo restores byte-identical G-code').toBe(gcodeBefore);
});

test('OPEN PROJECT: an empty canvas gets no prompt at all', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length === 0);

    const result = await page.evaluate(async (other) => {
        const { loadProject } = await import('/blocks/programFile.js');
        return loadProject(other);   // awaited directly — must resolve with no dialog to click
    }, otherProject());
    expect(result && result.name, 'loaded straight through, no confirm').toBe('Other Job');
    expect(await page.evaluate(() => !!document.querySelector('.app-dialog')), 'no confirm raised for an empty program').toBe(false);
});

// ── DOOR 3 — load a marked multi-op .nc file (ui/commandDeck.js's loadGcodeFile) ───────────────────────────────────

/** A real marked multi-op .nc export, built via the real import-fixture pattern this session already established
 *  (flow-labels-unique-1408.spec.js / t1928): insert an op, export its marker text, on a THROWAWAY canvas state —
 *  discarded before the door-under-test ever sees it. */
async function buildMarkedNcText(page) {
    return page.evaluate(async () => {
        window.ddcsLoadBlockStack([]);
        window.openWiz('surfacing', undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
        return window.ddcsSerializeWithMarkers();
    });
}

test('LOAD .NC FILE: Cancel leaves the program byte-identical', async ({ page }) => {
    await boot(page);
    const markedText = await buildMarkedNcText(page);   // throwaway canvas state, built first
    await insertDrill(page);                            // NOW seed the real "current" program
    const gcodeBefore = await page.evaluate(() => window.ddcsGetBlockGcode());

    await page.evaluate(() => { window.loadGcodeFile(); });   // creates the hidden #gcode-file-input
    await page.setInputFiles('#gcode-file-input', { name: 'job.nc', mimeType: 'text/plain', buffer: Buffer.from(markedText) });
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    await page.click('.app-dialog button:has-text("Cancel")');
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));

    expect(await page.evaluate(() => window.ddcsGetBlockGcode()), 'Cancel leaves the G-code byte-identical').toBe(gcodeBefore);
    // the raw-load fallback (ed.value = text) must NOT have run either — Cancel refuses the whole load, not just the model
    expect(await page.evaluate(() => document.getElementById('editor').value), 'the editor text is untouched too').toBe(gcodeBefore);
});

test('LOAD .NC FILE: Proceed loads the file, and Undo restores the prior program byte-identically', async ({ page }) => {
    await boot(page);
    const markedText = await buildMarkedNcText(page);
    await insertDrill(page);
    const gcodeBefore = await page.evaluate(() => window.ddcsGetBlockGcode());

    await autoAppDialog(page, { accept: true });
    await page.evaluate(() => { window.loadGcodeFile(); });
    await page.setInputFiles('#gcode-file-input', { name: 'job.nc', mimeType: 'text/plain', buffer: Buffer.from(markedText) });
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).some((b) => b && b.opType === 'surfacing'), { timeout: 8000 });

    await page.evaluate(() => window.ddcsUndo());
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).some((b) => b && b.opType === 'drill'), { timeout: 8000 });
    expect(await page.evaluate(() => window.ddcsGetBlockGcode()), 'Undo restores byte-identical G-code').toBe(gcodeBefore);
});

test('LOAD .NC FILE: an empty canvas gets no prompt at all', async ({ page }) => {
    await boot(page);
    const markedText = await buildMarkedNcText(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length === 0);

    await page.evaluate(() => { window.loadGcodeFile(); });
    await page.setInputFiles('#gcode-file-input', { name: 'job.nc', mimeType: 'text/plain', buffer: Buffer.from(markedText) });
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).some((b) => b && b.opType === 'surfacing'), { timeout: 8000 });
    expect(await page.evaluate(() => !!document.querySelector('.app-dialog')), 'no confirm raised for an empty program').toBe(false);
});
