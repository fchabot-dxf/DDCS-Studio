import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

/**
 * t1221 — ONE DOOR FOR CONTROLLER PARAMETERS (user ruling).
 *
 * Settings used to carry TWO buttons doing the same act — read this machine's parameters, review them, apply what you
 * tick: "Pull from controller" (live, over the Gateway) and "Import from dump" (parse the files the controller writes
 * to USB). They are now ONE door: the pull modal, offering the TRANSPORT. Both ways in converge on the review+apply
 * seam they already shared, so neither can apply without review.
 *
 * The transport is a persistent ROW, not a chooser STEP: opening the door still starts the live read immediately, so
 * the common path costs no extra click (and the review renders straight away, as the pull specs expect).
 */
const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'bridge', 'controllers');
const b64 = (p) => readFileSync(join(repo, p)).toString('base64');
const txt = (p) => readFileSync(join(repo, p), 'utf8');

test.use({ viewport: { width: 1280, height: 900 } });

async function openProfileTab(page, targets) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openSettings && window.ddcsGetSettings && window.ddcsSetMachine);
    // t1229 — when a test APPLIES a dump, the workspace targets that same controller (importing your own machine's
    // parameters). The mismatch gate itself has its own spec; this one is about the door, not the gate.
    if (targets) await page.evaluate((id) => window.ddcsSetMachine({ name: 'the-bench', controllerId: id }, true), targets);
    await page.evaluate(() => window.openSettings({ group: 'controller', panel: 'set_tab_profile' }));
    await page.waitForSelector('#set_tab_profile', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => typeof window.ddcsOpenDumpImport === 'function');
}

// hand the real controller bytes straight to the import path (the same seam the dump specs use)
const feedFiles = (page, entries) => page.evaluate(async (ents) => {
    const bin = (s) => { const d = atob(s); const u = new Uint8Array(d.length); for (let i = 0; i < d.length; i++) u[i] = d.charCodeAt(i); return u; };
    const files = ents.map((e) => (e.text != null ? new File([e.text], e.name) : new File([bin(e.b64)], e.name)));
    await window.ddcsOpenDumpImport(files);
}, entries);

test('Settings has ONE controller-parameter door; the retired second button is gone', async ({ page }) => {
    await openProfileTab(page);
    const s = await page.evaluate(() => {
        const pull = document.getElementById('set_profile_pull');
        return {
            pull: !!pull,
            pullTitle: pull ? pull.getAttribute('title') || '' : '',
            dump: !!document.getElementById('set_profile_import_dump'),
        };
    });
    expect(s.pull, 'the one door remains').toBe(true);
    expect(s.dump, 'the duplicate "Import from dump" button is retired').toBe(false);
    // The CONTROLLER-PARAMETER surface must not borrow the word: "workspace" means the .ddcs, and this door reads a
    // machine's parameters. (The machine section above it DOES say workspace, correctly — that is the .ddcs.)
    expect(s.pullTitle, 'the door describes both ways in').toMatch(/gateway/i);
    expect(s.pullTitle, 'and names the USB file').toMatch(/\.eng/);
    expect(s.pullTitle, 'without borrowing the reserved word').not.toMatch(/workspace/i);
});

test('the modal offers BOTH transports, and the live read still starts on open (no extra click)', async ({ page }, testInfo) => {
    // no gateway → the live transport reports it honestly; the row must still show both ways in
    await page.route('**/api/profile', (r) => r.abort());
    await page.route('**/api/vars**', (r) => r.abort());
    await openProfileTab(page);
    await page.click('#set_profile_pull');
    await page.waitForSelector('#import-modal.active', { timeout: 8000 });

    const live = page.locator('#import-src-live');
    const file = page.locator('#import-src-file');
    await expect(live, 'transport: live via the Gateway').toBeVisible();
    await expect(file, 'transport: from a USB file').toBeVisible();
    // the offline option covers BOTH shapes a USB copy comes in: the .eng parameter file, or a copied disk folder
    await expect(file, 'the offline transport names both shapes').toHaveText(/From a USB copy \(\.eng file or disk folder\)/);
    await expect(file).toHaveAttribute('title', /parameter file the controller saves to USB/i);
    await expect(live, 'opening the door reads LIVE by default — the row is not a gate').toHaveClass(/is-active/);

    // the honest no-gateway message survives the consolidation. t2095 — the literal 'gateway not reachable'
    // wording was deliberately REPLACED by commit 70243fa5 ("spell out that 'Live via the Gateway' needs the
    // desktop app open alongside the website") with more actionable copy; this assertion was never updated in
    // that same commit (pull-modal-stacking.spec.js had the identical stale string, fixed the same way this turn).
    await expect(page.locator('#import-body')).toContainText(/desktop app.*running/i);
    // ONE door means one of each: the empty state points AT the transport row instead of repeating its button
    await expect(page.locator('#import-src-file'), 'exactly one way to reach the USB transport').toHaveCount(1);
    await expect(page.locator('#import-fromdump'), 'no duplicate USB button inside the modal').toHaveCount(0);

    // t1221 amendment — the undo copy is AUTOMATIC, so the manual duplicate is gone and the modal SAYS so
    await expect(page.locator('#import-backup'), 'the manual "Backup Profile" duplicate is retired').toHaveCount(0);
    // t1223 — the footer must state what the app ACTUALLY does now: the silent copy was swept, so it promises the
    // save-first PROMPT instead. A claim the code no longer honours is the bug this assertion exists to catch.
    await expect(page.locator('#import-safenote')).toContainText(/asked to save it before applying/i);
    // settled vocabulary: "profile" is dead on this surface (workspace stays reserved for the .ddcs, as used above)
    const modalText = await page.locator('#import-modal .im-panel').innerText();
    expect(modalText, 'the dead word "profile" is gone from this surface').not.toMatch(/profile/i);

    await page.locator('#import-modal .im-panel').screenshot({ path: testInfo.outputPath('one-door-both-transports.png') });
});

test('a USB .eng file goes through the SAME review before anything is applied', async ({ page }, testInfo) => {
    await openProfileTab(page, 'ddcs-v41');

    const before = await page.evaluate(() => JSON.parse(JSON.stringify(window.ddcsGetSettings().machine || {})));

    // a real V4.1 parameter set, named the way the UI names it (.eng) — recognition must not depend on the bare name
    await feedFiles(page, [
        { name: 'setting', b64: b64('v4.1/assets/setting') },
        { name: 'machine.eng', text: txt('v4.1/assets/firmware/ddcs v4.1/ddcsv4(2025-04-04)/ddcsv4(2025-04-04)/ddcsv4/eng') },
        { name: 'coord1', b64: b64('v4.1/assets/system-backup/current/coord1') },
    ]);

    // THE REVIEW STEP — rows to inspect, and nothing applied yet
    await page.waitForSelector('#import-modal.active #import-body .im-row', { timeout: 8000 });
    await expect(page.locator('#import-src-file'), 'the file transport is the active one').toHaveClass(/is-active/);
    const mid = await page.evaluate(() => JSON.parse(JSON.stringify(window.ddcsGetSettings().machine || {})));
    expect(mid, 'the review is a REVIEW — nothing is applied until Apply').toEqual(before);
    await page.locator('#import-modal .im-panel').screenshot({ path: testInfo.outputPath('eng-review-step.png') });

    // tick everything and apply → the derived envelope lands (the V4.1 by-name goldens)
    await page.evaluate(() => { const o = document.getElementById('import-only'); o.checked = false; o.dispatchEvent(new Event('change')); });
    await page.evaluate(() => document.querySelectorAll('#import-body input[type=checkbox][data-cand]').forEach((c) => { if (!c.checked) c.click(); }));
    await page.evaluate(() => { delete window.__ddcsSafetyExport; });
    await page.evaluate(() => document.querySelector('#import-apply').click());
    await page.waitForFunction(() => !document.getElementById('import-modal').classList.contains('active'), null, { timeout: 8000 });

    const after = await page.evaluate(() => window.ddcsGetSettings().machine);
    expect(Math.abs(after.x), 'the reviewed envelope applied (V4.1 golden X travel)').toBe(3830);
    expect(Math.abs(after.y), 'and Y').toBe(3900);
    // t1223 — the automatic SILENT export is gone: applying now routes through the save-first prompt instead, and a
    // clean buffer (this one) has nothing to protect, so nothing is written behind the user's back at all.
    const safety = await page.evaluate(() => window.__ddcsSafetyExport || null);
    expect(safety, 'no unasked-for .ddcs lands in Downloads — the prompt replaced the silent copy').toBeNull();
});
