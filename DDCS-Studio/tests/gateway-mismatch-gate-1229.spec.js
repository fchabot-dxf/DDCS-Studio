import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

/**
 * t1229 A2 — THE MISMATCH GATE (user-ruled).
 *
 * The workspace's machine record names the controller it targets. A read (pull / dump / the review render) is ALWAYS
 * allowed — detection is how you find out what you are looking at. What is gated is landing values and pushing code:
 *
 *   PULL-APPLY on a mismatch → ONE dialog, exactly two buttons: [Duplicate as a <detected> workspace] [Cancel].
 *     A pull NEVER retargets the workspace you are in. Duplicate = Save-As-a-copy, the copy adopts the detected
 *     controller, and the pulled values land IN THE COPY.
 *   PUSH on a mismatch → HARD BLOCK: the statement and [Cancel] only. No override, no duplicate offer — a push is a
 *     write to a physical machine, and if the controller is wrong then everything about the program is suspect.
 *
 * The dump path is driven with the repo's REAL controller bytes, so the detection under test is the real one.
 */
const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'bridge', 'controllers');
const b64 = (p) => readFileSync(join(repo, p)).toString('base64');
const txt = (p) => readFileSync(join(repo, p), 'utf8');
const V41_ENG = 'v4.1/assets/firmware/ddcs v4.1/ddcsv4(2025-04-04)/ddcsv4(2025-04-04)/ddcsv4/eng';

test.use({ viewport: { width: 1280, height: 950 } });

async function bootAsExpert(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openSettings && window.ddcsGetSettings && window.ddcsSetMachine);
    // this workspace is an Expert M350 — the dumps below are a V4.1, so they mismatch by construction
    await page.evaluate(() => window.ddcsSetMachine({ name: 'shop-m350', controllerId: 'ddcs-expert-m350' }, true));
    await page.evaluate(() => window.openSettings({ group: 'controller', panel: 'set_tab_profile' }));
    await page.waitForFunction(() => typeof window.ddcsOpenDumpImport === 'function');
}

/** Hand the real controller bytes to the import path (the same seam the dump specs use). */
const feed = (page, entries) => page.evaluate(async (ents) => {
    const bin = (s) => { const d = atob(s); const u = new Uint8Array(d.length); for (let i = 0; i < d.length; i++) u[i] = d.charCodeAt(i); return u; };
    await window.ddcsOpenDumpImport(ents.map((e) => (e.text != null ? new File([e.text], e.name) : new File([bin(e.b64)], e.name))));
}, entries);

const feedV41 = (page) => feed(page, [
    { name: 'setting', b64: b64('v4.1/assets/setting') },
    { name: 'eng', text: txt(V41_ENG) },
]);

const tickAll = async (page) => {
    await page.evaluate(() => { const o = document.getElementById('import-only'); o.checked = false; o.dispatchEvent(new Event('change')); });
    await page.evaluate(() => document.querySelectorAll('#import-body input[type=checkbox][data-cand]').forEach((c) => { if (!c.checked) c.click(); }));
};

test('READS ARE FREE: a mismatched controller still renders the full review, and says so up front', async ({ page }, testInfo) => {
    await bootAsExpert(page);
    await feedV41(page);
    await page.waitForSelector('#import-modal.active #import-body .im-row', { timeout: 8000 });

    // the review is THERE — detection is how you find out, so nothing about reading is gated
    expect(await page.locator('#import-body .im-row').count()).toBeGreaterThan(0);
    const banner = page.locator('#import-modal .im-banner');
    await expect(banner).toContainText(/This controller is a .*V4\.1.* this workspace targets a .*M350/);
    await expect(banner, 'and it states what Apply will offer — a claim the apply handler honours').toContainText(/never retargets this workspace/i);
    await page.locator('#import-modal .im-panel').screenshot({ path: testInfo.outputPath('mismatch-review.png') });
});

test('PULL-APPLY on a mismatch: ONE dialog, exactly two buttons, and Cancel changes NOTHING', async ({ page }, testInfo) => {
    await bootAsExpert(page);
    const before = await page.evaluate(() => ({ machine: window.ddcsGetMachine(), envX: window.ddcsGetSettings().machine.x }));
    await feedV41(page);
    await page.waitForSelector('#import-modal.active #import-body .im-row', { timeout: 8000 });
    await tickAll(page);
    await page.click('#import-apply');

    const dlg = page.locator('.app-dialog');
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText(/This controller is a .*V4\.1/);
    await expect(dlg).toContainText(/this workspace targets a .*M350/);
    const buttons = dlg.locator('button');
    await expect(buttons, 'exactly two ways out — no "apply anyway"').toHaveCount(2);
    await expect(buttons.nth(1)).toHaveText(/Duplicate as a .*V4\.1.* workspace/);
    await expect(buttons.nth(0)).toHaveText('Cancel');
    await page.locator('.app-dialog > div').screenshot({ path: testInfo.outputPath('pull-mismatch-dialog.png') });

    await buttons.nth(0).click();
    const after = await page.evaluate(() => ({ machine: window.ddcsGetMachine(), envX: window.ddcsGetSettings().machine.x }));
    expect(after.machine, 'the workspace was NOT retargeted').toEqual(before.machine);
    expect(after.envX, 'and nothing was applied').toBe(before.envX);
    await expect(page.locator('#import-modal.active'), 'the review is still open — Cancel means cancel, not close').toHaveCount(1);
});

test('DUPLICATE: a copy is written, it adopts the detected controller, the values land IN IT — the original is untouched', async ({ page }) => {
    await bootAsExpert(page);
    // a fake File System Access layer: the workspace is "saved" to alpha.ddcs, and Save As writes a second file
    await page.evaluate(() => {
        const files = window.__fs = new Map([['shop-m350.ddcs', 'ORIGINAL BYTES']]);
        window.showDirectoryPicker = undefined;
        window.showSaveFilePicker = async (opts) => {
            const name = (opts && opts.suggestedName) || 'copy.ddcs';
            window.__picked = name;
            return {
                name, queryPermission: async () => 'granted', requestPermission: async () => 'granted',
                createWritable: async () => ({ write: async (t) => files.set(name, t), close: async () => {} }),
            };
        };
        window.ddcsMarkWorkspaceSaved('shop-m350.ddcs');
    });
    await feedV41(page);
    await page.waitForSelector('#import-modal.active #import-body .im-row', { timeout: 8000 });
    await tickAll(page);
    await page.click('#import-apply');
    await page.locator('.app-dialog button', { hasText: /Duplicate as/ }).click();
    // the first-save ask names the copy (its default already carries the detected controller)
    await page.waitForSelector('#wssAsk', { timeout: 8000 });
    expect(await page.inputValue('#wssName'), 'the suggested name says what the copy is for').toMatch(/shop-m350-ddcs-v4-1|v4/i);
    await page.locator('#wssAsk [data-wss="save"]').click();

    // wait for the LAST step, not the first: the retarget happens before the values are applied and before the copy is
    // re-written, so watching the machine record would read the file mid-flight (the t1225 lesson, same shape)
    await expect(page.locator('#import-modal.active'), 'the modal closes when the whole act is done').toHaveCount(0, { timeout: 10000 });
    const r = await page.evaluate(() => ({
        machine: window.ddcsGetMachine(),
        envX: Math.abs(window.ddcsGetSettings().machine.x),
        original: window.__fs.get('shop-m350.ddcs'),
        picked: window.__picked,
        copy: window.__fs.get(window.__picked),
    }));
    expect(r.machine.controllerId, 'the COPY is the detected machine').toBe('ddcs-v41');
    expect(r.envX, 'and the pulled V4.1 envelope landed (the by-name golden)').toBe(3830);
    expect(r.original, 'the workspace we came from is byte-for-byte untouched').toBe('ORIGINAL BYTES');
    expect(r.copy, 'the copy was written').toBeTruthy();
    const copyObj = JSON.parse(r.copy);
    expect(copyObj.stores.machine.controllerId, 'and the FILE on disk carries the retarget + the pulled values').toBe('ddcs-v41');
    expect(Math.abs(copyObj.stores.settings.machine.x)).toBe(3830);
});

test('THE STATED ASSUMPTION: an eng alone says ASSUMED, offers a picker, and the comparison follows the correction', async ({ page }, testInfo) => {
    await bootAsExpert(page);
    await feed(page, [{ name: 'eng', text: txt(V41_ENG) }]);   // no setting file → nothing MEASURES the controller
    await page.waitForSelector('#import-modal.active #import-idrow', { timeout: 8000 });

    const row = page.locator('#import-idrow');
    await expect(row, 'it is shown as an assumption, not a fact').toHaveClass(/is-assumed/);
    await expect(row).toContainText(/Assumed controller/i);
    await expect(row, 'and it says WHY it assumed that').toContainText(/eng file alone/i);
    expect(await page.locator('#import-idpick').inputValue(), 'recognizeDump assumed the DM500 from the eng shape').toBe('ddcs-v3-dm500');
    await expect(page.locator('#import-modal .im-banner'), 'so the assumed id mismatches this Expert workspace').toContainText(/DM500|V3/i);
    await page.locator('#import-modal .im-panel').screenshot({ path: testInfo.outputPath('stated-assumption.png') });

    // CORRECT the pick to what this workspace actually is → the comparison follows the correction, not the guess
    await page.selectOption('#import-idpick', 'ddcs-expert-m350');
    await expect(page.locator('#import-modal .im-banner'), 'corrected → no mismatch to state').toHaveCount(0);
    await expect(page.locator('#import-idrow'), 'and the row is no longer an assumption to be wary of').not.toHaveClass(/is-assumed/);
});

test('PUSH on a mismatch is a HARD BLOCK: one statement, ONE button, and nothing is submitted', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsSetMachine);
    await page.evaluate(() => window.ddcsSetMachine({ name: 'shop-m350', controllerId: 'ddcs-expert-m350' }, true));

    await page.evaluate(async () => {
        const mod = await import('/ui/gateway/views/send.js');
        const root = document.createElement('div'); root.id = 'test-send-root';
        root.style.cssText = 'position:fixed;inset:0;z-index:99990;background:var(--bg,#111);overflow:auto;padding:20px';
        document.body.appendChild(root);
        window.__submitted = 0;
        mod.default.mount({
            root,
            client: {
                profile: async () => ({ id: 'ddcs-v41', name: 'DDCS V4.1' }),   // the machine on the other end is NOT ours
                submitJob: async () => { window.__submitted++; return { jobId: 'J1', tracked: false }; },
            },
        });
        const cb = root.querySelector('input[type=checkbox]'); if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        const ed = document.getElementById('editor');
        ed.value = 'G21 G90\nM3 S1000\nG0 X10 Y10\nG1 Z-5 F100';   // a clean program: the ONLY thing wrong is the machine
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const sendRoot = page.locator('#test-send-root');
    await sendRoot.getByText('Use current Studio program').click();
    await sendRoot.locator('button.primary').click();

    const dlg = page.locator('.app-dialog');
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText(/This controller is a .*V4\.1.* this workspace targets a .*M350/);
    await expect(dlg.locator('button'), 'ONE way out — no send-anyway, no duplicate offer on the write side').toHaveCount(1);
    await expect(dlg.locator('button')).toHaveText('Cancel');
    // the test harness root sits above everything (z 99990) so the real app can't be clicked by accident — drop it to
    // SEE and reach the dialog, the way the t947 send spec does (the first screenshot came back a blank grey box:
    // the harness was painting over the very thing under test)
    const rootZ = (z) => page.evaluate((v) => { document.getElementById('test-send-root').style.zIndex = v; }, z);
    await rootZ('1');
    await page.locator('.app-dialog > div').screenshot({ path: testInfo.outputPath('push-hard-block.png') });
    await dlg.locator('button').click();
    await rootZ('99990');
    expect(await page.evaluate(() => window.__submitted), 'nothing reached the machine').toBe(0);
});

test('a MATCHING controller sends as before — the gate only fires on a real mismatch', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsSetMachine);
    await page.evaluate(() => window.ddcsSetMachine({ name: 'shop-m350', controllerId: 'ddcs-expert-m350' }, true));
    await page.evaluate(async () => {
        const mod = await import('/ui/gateway/views/send.js');
        const root = document.createElement('div'); root.id = 'test-send-root';
        root.style.cssText = 'position:fixed;inset:0;z-index:99990;background:var(--bg,#111);overflow:auto;padding:20px';
        document.body.appendChild(root);
        window.__submitted = 0;
        // the same machine this workspace targets → no gate; and a wide envelope so the pre-flight stays green
        const s = window.ddcsGetSettings(); s.machine = s.machine || {};
        Object.assign(s.machine, { x: 3000, y: 3000, z: -300 }); s.machine.wcs = { active: 1, table: [{ x: 0, y: 0, z: 0 }] };
        mod.default.mount({
            root,
            client: {
                profile: async () => ({ id: 'ddcs-expert-m350', name: 'DDCS Expert M350' }),
                submitJob: async () => { window.__submitted++; return { jobId: 'J1', tracked: false }; },
            },
        });
        const cb = root.querySelector('input[type=checkbox]'); if (cb) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        const ed = document.getElementById('editor');
        ed.value = 'G21 G90\nM3 S1000\nG0 X10 Y10\nG1 Z-5 F100';
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const sendRoot = page.locator('#test-send-root');
    await sendRoot.getByText('Use current Studio program').click();
    await sendRoot.locator('button.primary').click();
    await expect.poll(() => page.evaluate(() => window.__submitted), { timeout: 8000 }).toBe(1);
    await expect(page.locator('.app-dialog'), 'no dialog at all on a matching machine').toHaveCount(0);
});
