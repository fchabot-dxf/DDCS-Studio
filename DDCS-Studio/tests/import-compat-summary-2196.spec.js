import { test, expect } from '@playwright/test';

/**
 * t2196 (amendment 3, from t2192) — THE CONFIRM-ON-IMPORT SUMMARY.
 *
 * t2194 retired the standalone-file LIBRARY shelf in both managers (wizardManager.js's and projectManager.js's
 * own) because it misrepresented itself as a second container. Its one real value — seeing what a file was
 * BEFORE it became part of the workspace — moves here: a single confirm shown at the moment of import, built by
 * the ONE shared ui/importCompat.js, covering name clash, wrong machine/axes (ui/axisGating.js's own declared
 * tables), wrong dialect (a .mjson project's own `post` field — a .wiz wizard never carries one, so that line
 * never appears for a wizard import), the #-variables it uses (a LISTED FACT, never a verdict — human ruling:
 * a workspace cannot know whether its own #510 means the same thing as the file's), what it makes, and
 * provenance.
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function boot(page) {
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.openWizardManager && window.openProjectManager, null, { timeout: 60000 });
}

/** Read the visible confirm dialog's full text (title + body), without answering it yet. */
async function dialogText(page) {
    const dlg = page.locator('.app-dialog').last();
    await dlg.waitFor({ state: 'visible', timeout: 8000 });
    return dlg.innerText();
}

const WIZ_FILE = (opType, label, extra = {}) => ({
    kind: 'ddcs.wizard', v: 1,
    op: { opType, label, template: [{ type: 'move_rapid', params: { x: 3 } }], bindings: [], group: 'custom', ...extra },
});

test('WIZARD import: a clean fork of a built-in shows Makes + Provenance, no warnings', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.openWizardManager());
    const file = JSON.stringify(WIZ_FILE('user_corner_data', 'My Corner Twin', { forkedFrom: 'user_corner_data' }));
    await page.setInputFiles('#wizmImportInput', { name: 'my-corner.wiz', mimeType: 'application/json', buffer: Buffer.from(file) });
    const text = await dialogText(page);
    expect(text, 'names what it makes').toContain('Makes: Corner');
    expect(text, 'names provenance').toContain('Fork of');
    expect(text, 'no false machine warning').not.toContain('Wrong machine');
    await page.keyboard.press('Escape');
});

test('WIZARD import: a twin needing axes this LATHE workspace lacks is flagged before it lands', async ({ page }) => {
    await boot(page);
    await page.evaluate(async () => { const M = await import('/data/workspaceMachine.js'); M.setMachine({ kind: 'lathe', chuck: 'spindle' }, false); });
    await page.evaluate(() => window.openWizardManager());
    // user_pocket_data twins the built-in 'pocket' (needs X+Y) — a lathe declares X+Z only.
    const file = JSON.stringify(WIZ_FILE('user_pocket_data', 'Imported Pocket'));
    await page.setInputFiles('#wizmImportInput', { name: 'pocket.wiz', mimeType: 'application/json', buffer: Buffer.from(file) });
    const text = await dialogText(page);
    expect(text, 'the axis mismatch is named BEFORE import, not discovered after').toMatch(/Wrong machine.*Y axis/i);

    // Cancel — nothing lands
    await page.keyboard.press('Escape');
    const has = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        return U.listUserOps().some((d) => d.opType === 'user_pocket_data' && d.label === 'Imported Pocket');
    });
    expect(has, 'Cancel really cancels — the flagged import never lands').toBe(false);
});

test('WIZARD import: #-variables used are LISTED, never verdicted', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.openWizardManager());
    const file = JSON.stringify(WIZ_FILE('user_myvars_data', 'Uses Vars', {
        template: [{ type: 'assign', params: { var: '#510', value: '[#511+1]' } }],
    }));
    await page.setInputFiles('#wizmImportInput', { name: 'vars.wiz', mimeType: 'application/json', buffer: Buffer.from(file) });
    const text = await dialogText(page);
    expect(text, 'names the numbers used').toContain('#510');
    expect(text, 'names every number, not just the first').toContain('#511');
    expect(text, 'asks the human to check, no verdict word claiming they are fine or unknown').toMatch(/check they mean what you expect/i);
    expect(text, 'never claims a verdict this app cannot know').not.toMatch(/\b(unknown|compatible|incompatible|ok|safe)\b/i);
    await page.keyboard.press('Escape');
});

test('WIZARD import: a NAME CLASH folds into the one summary — no separate second confirm', async ({ page }) => {
    await boot(page);
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        U.createUserOp(U.userOpFromStack('clash', 'Existing Copy', [{ type: 'move_rapid', params: { x: 1 } }], [{ param: 'x', label: 'X', type: 'number', blockIndex: 0, key: 'x', dflt: 1 }]));
    });
    await page.evaluate(() => window.openWizardManager());
    const file = JSON.stringify(WIZ_FILE('user_clash', 'File Copy'));
    await page.setInputFiles('#wizmImportInput', { name: 'clash.wiz', mimeType: 'application/json', buffer: Buffer.from(file) });
    const text = await dialogText(page);
    expect(text, 'the collision is named IN the summary').toContain('Already in this workspace');
    expect(text, 'and it names what it will be replaced with').toContain('Makes:');
    await page.keyboard.press('Escape');
});

test('PROJECT import: wrong dialect is flagged from the bundle\'s own `post` field', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.openProjectManager());
    const obj = { kind: 'ddcs.macro', v: 1, name: 'V41 job', post: 'ddcs-v41', profile: 'ddcs-v41', stock: null, stack: [{ type: 'op', opType: 'user_pocket_data' }] };
    await page.setInputFiles('#projmImportInput', { name: 'v41-job.mjson', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)) });
    const text = await dialogText(page);
    expect(text, 'names the file\'s own dialect and this workspace\'s').toMatch(/Wrong dialect.*DDCS V4\.1.*DDCS Expert/i);
    await page.keyboard.press('Escape');
});

test('PROJECT import: wrong machine/axes across the WHOLE stack, deduplicated, plus provenance from `profile`', async ({ page }) => {
    await boot(page);
    await page.evaluate(async () => { const M = await import('/data/workspaceMachine.js'); M.setMachine({ kind: 'lathe', chuck: 'spindle' }, false); });
    await page.evaluate(() => window.openProjectManager());
    const obj = {
        kind: 'ddcs.macro', v: 1, name: 'Mill job', post: 'ddcs-expert-m350', profile: 'ddcs-expert-m350', stock: null,
        stack: [{ type: 'op', opType: 'user_pocket_data' }, { type: 'op', opType: 'user_corner_data' }],   // both need X+Y — one reason, not two
    };
    await page.setInputFiles('#projmImportInput', { name: 'mill-job.mjson', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)) });
    const text = await dialogText(page);
    const warnCount = (text.match(/Wrong machine/g) || []).length;
    expect(warnCount, 'the SAME axis reason across two ops in the stack is named once, not once per op').toBe(1);
    expect(text, 'provenance names the authoring machine profile').toContain('Provenance:');
    await page.keyboard.press('Escape');
});

test('PROJECT import: a real, compatible file actually lands after confirming', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.openProjectManager());
    const obj = { kind: 'ddcs.macro', v: 1, name: 'clean-job', post: 'ddcs-expert-m350', profile: 'ddcs-expert-m350', stock: null, stack: [{ type: 'op', opType: 'user_corner_data' }] };
    await page.setInputFiles('#projmImportInput', { name: 'clean-job.mjson', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)) });
    await dialogText(page);
    await page.keyboard.press('Enter');   // confirm import
    await page.locator('.app-dialog').last().waitFor({ state: 'visible', timeout: 8000 });   // "is in this workspace now"
    await page.keyboard.press('Enter');
    const landed = await page.evaluate(async () => {
        const store = await import('/ui/projects/projectStore.js');
        return await store.readProject('clean-job');
    });
    expect(landed, 'confirming really imports the file, readable back from the workspace store').toBeTruthy();
    expect(landed.name).toBe('clean-job');
});
