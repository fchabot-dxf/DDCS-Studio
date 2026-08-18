import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

/**
 * DUMP-FOLDER IMPORT — real-symptom UI (t666). Dropping a controller's disk files lands in the SAME pull-review modal
 * (found files + raw→derived rows) and Apply writes settings — zero gateway. V4.1 derives a real envelope + WCS; the
 * DM500 shows the honest "named from the eng, values N/A" (its setting layout isn't grounded).
 */
test.use({ viewport: { width: 1280, height: 900 } });
const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'bridge', 'controllers');
const b64 = (p) => readFileSync(join(repo, p)).toString('base64');
const txt = (p) => readFileSync(join(repo, p), 'utf8');

// t1229 — `targets` seeds THIS WORKSPACE'S machine. These tests import a dump FROM THE MACHINE THE WORKSPACE IS FOR
// (the ordinary case), so the controller matches and the new mismatch gate correctly stays out of the way. The gate's
// own behaviour — a dump from a DIFFERENT controller — is covered in tests/gateway-mismatch-gate-1229.spec.js.
const openControllerPanel = async (page, targets = 'ddcs-v41') => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openSettings && window.ddcsGetSettings && window.ddcsSetMachine);
    await page.evaluate((id) => window.ddcsSetMachine({ name: 'the-bench', controllerId: id }, true), targets);
    await page.evaluate(() => window.openSettings({ group: 'controller', panel: 'set_tab_profile' }));
    await page.waitForFunction(() => typeof window.ddcsOpenDumpImport === 'function');
};
// build File objects in the page from base64/text and feed the importer
const dropDump = (page, entries) => page.evaluate(async (ents) => {
    const bin = (s) => { const d = atob(s); const u = new Uint8Array(d.length); for (let i = 0; i < d.length; i++) u[i] = d.charCodeAt(i); return u; };
    const files = ents.map((e) => e.text != null ? new File([e.text], e.name) : new File([bin(e.b64)], e.name));
    await window.ddcsOpenDumpImport(files);
}, entries);

test('drop a V4.1 dump → review modal derives the envelope + WCS by name; Apply writes settings (no gateway)', async ({ page }) => {
    await openControllerPanel(page);
    // t780 — the user has attested tapCapable; the pull must NEVER overwrite it (only interface/mappingAxis are seeded).
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.spindle = s.spindle || {}; s.spindle.tapCapable = true; });
    await dropDump(page, [
        { name: 'setting', b64: b64('v4.1/assets/setting') },
        { name: 'eng', text: txt('v4.1/assets/firmware/ddcs v4.1/ddcsv4(2025-04-04)/ddcsv4(2025-04-04)/ddcsv4/eng') },
        { name: 'coord1', b64: b64('v4.1/assets/system-backup/current/coord1') },
    ]);
    await page.waitForSelector('#import-modal.active', { timeout: 8000 });
    // show ALL candidates (WCS-from-coord1 is changed:false like the network pull → hidden under "only changed")
    await page.evaluate(() => { const t = document.getElementById('import-only'); if (t && t.checked) { t.checked = false; t.dispatchEvent(new Event('change', { bubbles: true })); } });
    const body = await page.evaluate(() => document.getElementById('import-body').textContent);
    expect(body, 'the recognized dump files are listed').toContain('setting');
    expect(body, 'the envelope derived from the soft-limits (by name)').toContain('3830');
    expect(body, 'the WCS G54 derived from coord1').toContain('-300.29');
    expect(body, 'the review names the controller').toMatch(/V4\.1/i);
    expect(body, 'the spindle interface + mapping-axis rows appear (raw → derived)').toMatch(/Spindle|Interface \+ mapping/i);
    expect(body, 'the spindle interface is decoded (Analog VFD)').toMatch(/Analog/);
    // tick everything + Apply
    await page.evaluate(() => document.querySelectorAll('#import-body input[type=checkbox]').forEach((c) => { if (!c.checked) c.click(); }));
    await page.click('#import-apply');
    await page.waitForSelector('#import-modal.active', { state: 'detached', timeout: 8000 }).catch(() => {});
    const applied = await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        return { g54: (((s.machine.wcs || {}).table || [])[0]) || null, mx: s.machine.x, spindle: s.spindle };
    });
    expect(applied.g54, 'Apply wrote the G54 offsets into settings.machine.wcs').toEqual({ x: -300.29, y: -116.06, z: 1547.268 });
    expect(Math.abs(applied.mx), 'Apply wrote the X envelope (3830) into settings.machine').toBe(3830);
    // t780 — the spindle interface + mapping axis are seeded; the user's tapCapable attestation is UNTOUCHED.
    expect(applied.spindle.interface, 'Apply wrote spindle.interface (analog)').toBe('analog');
    expect(applied.spindle.mappingAxis, 'Apply wrote spindle.mappingAxis (A)').toBe('A');
    expect(applied.spindle.tapCapable, 'the pull NEVER overwrites the user-owned tapCapable attestation').toBe(true);
});

test('drop a DM500 dump → GROUNDED envelope from the cracked self-describing setting (t2073)', async ({ page }) => {
    await openControllerPanel(page, 'ddcs-v3-dm500');   // a DM500 workspace reading its own DM500 dump
    await dropDump(page, [
        { name: 'setting', b64: b64('dm500/setting') },
        { name: 'eng', text: txt('dm500/install/eng') },
    ]);
    await page.waitForSelector('#import-modal.active', { timeout: 8000 });
    const body = await page.evaluate(() => document.getElementById('import-body').textContent);
    expect(body, 'DM500 recognized').toMatch(/DM500/i);
    // t2073 — the DM500 setting is CRACKED (self-describing [f32][name] records), so the envelope now GROUNDS:
    // the review says "grounded" and no longer claims the old honest-N/A. (The grounded VALUES themselves —
    // travel 400 / soft-limits ±400 — are gated at the data level in dump-import-golden.spec.js.)
    expect(body, 'grounded from the self-describing setting').toMatch(/grounded/i);
    expect(body, 'no longer the old "values N/A / not yet grounded"').not.toMatch(/values N\/A|not yet grounded/i);
    // the GROUNDED envelope reaches the review: X/Y ±400, Z ±20, soft-limits disabled on this capture
    expect(body, 'the grounded X/Y envelope (400) renders').toContain('400');
    expect(body, 'the grounded Z envelope (20) renders').toMatch(/Z\b[^]{0,40}\b20\b/);
    expect(body, 'the controller had soft limits off (#374=0)').toMatch(/soft.?limits DISABLED/i);
    await page.screenshot({ path: 'scratchpad/dump-import-dm500.png' });
});
