import { test, expect } from '@playwright/test';

/**
 * t2111 (S1, ROLES-PLAN.md) — THE SETUP FORM IS GATED BY ROLE.
 *
 * The human's own definition of the feature: *"the client is really hiding the settings that help connect
 * the gateway to the controller"*. A client is a PC with no controller wired to it, so the controller disk
 * and the controller-profile card are settings for hardware it does not have.
 *
 * ⭐ ROLES-PLAN's gate, quoted, is what these tests encode: *"the client Setup renders with no
 * controller-wiring field PRESENT (not merely disabled); the gateway Setup is byte-for-byte what it is
 * today."* Hence `toHaveCount(0)`, never `toBeDisabled` — a disabled field still says "you are missing
 * something", which is the opposite of the point.
 *
 * ⛔ AND WHAT MUST **NOT** BE GATED, which is half the value of this file: the cloud/account settings.
 * A client's ONLY transport is Drive, so hiding those would remove the one thing it needs; and a
 * Drive-less gateway is a first-class setup that must still be able to REACH them. An earlier draft of the
 * plan proposed a second gating axis for exactly this and the human retracted it — *"what cloud setting
 * would need hiding anyways"* — so the retraction gets a test rather than a comment.
 *
 * ⚠ THE CONFLICT CASE IS NOT A THIRD ROLE. `role=client` WITH a controller disk still configured is a
 * misconfiguration, and hiding the disk field in that state would make it PERMANENT — the user could never
 * clear the thing causing the contradiction. So a conflict SHOWS the fields and states the problem. That is
 * S0's own constraint ("surface disagreement, never resolve it silently") applied to the UI.
 */

const mountAdmin = async (page, desc, cfg = {}) => page.evaluate(async ({ desc, cfg }) => {
    const mod = await import('/ui/gateway/views/admin.js');
    document.getElementById('test-admin-root')?.remove();
    const root = document.createElement('div');
    root.id = 'test-admin-root';
    root.style.cssText = 'position:fixed;inset:0;z-index:99990;background:var(--bg,#111);overflow:auto;padding:20px';
    document.body.appendChild(root);
    window.__adminErr = null;
    const client = {
        descriptor: async () => desc,
        getConfig: async () => ({ machine_name: 'Ultimate Bee', dest: cfg.dest || '', backend: 'local', ...cfg }),
        profile: async () => ({ id: 'ddcs-expert-m350', name: 'DDCS Expert M350', source: 'builtin' }),
        googleStatus: async () => ({ configured: true, connected: false }),
    };
    try {
        await mod.default.mount({ root, client });
        await mod.default.render({ root, client });
    } catch (e) { window.__adminErr = String((e && e.message) || e); }
}, { desc, cfg });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
};

const GATEWAY = { role: 'gateway', role_conflict: false, dest: '\\\\10.0.0.50\\cncdisk', backend: 'local', version: '1', controller_connected: true };
const CLIENT = { role: 'client', role_conflict: false, dest: '', backend: 'local', version: '1', controller_connected: false };
const CONFLICT = { role: 'client', role_conflict: true, dest: '\\\\10.0.0.50\\cncdisk', backend: 'local', version: '1', controller_connected: false };

const wiring = (page) => page.locator('#test-admin-root').getByText('Controller disk (network share)');
const profileCard = (page) => page.locator('#test-admin-root').getByText('Controller profile');
const cloudSection = (page) => page.locator('#test-admin-root').getByText('Cloud storage (send from anywhere)');

test('GATEWAY: the controller-wiring settings are all there — unchanged from before the gate', async ({ page }) => {
    await boot(page);
    await mountAdmin(page, GATEWAY);
    expect(await page.evaluate(() => window.__adminErr), 'the admin view rendered').toBeNull();
    await expect(wiring(page), 'the controller disk field').toHaveCount(1);
    await expect(profileCard(page), 'the controller-profile card').toHaveCount(1);
});

test('CLIENT: the controller-wiring settings are ABSENT, not disabled', async ({ page }) => {
    await boot(page);
    await mountAdmin(page, CLIENT);
    expect(await page.evaluate(() => window.__adminErr)).toBeNull();
    // ROLES-PLAN: "no controller-wiring field PRESENT (not merely disabled)"
    await expect(wiring(page), 'no controller disk field on a client').toHaveCount(0);
    await expect(profileCard(page), 'no controller-profile card on a client').toHaveCount(0);
});

test('CLIENT: the CLOUD settings stay — they are the only transport a client has', async ({ page }) => {
    await boot(page);
    await mountAdmin(page, CLIENT);
    // ⛔ The retraction of the second gating axis, encoded: role gates the WIRING and nothing else.
    await expect(cloudSection(page), 'cloud storage is never gated by role').toHaveCount(1);
    await expect(page.locator('#test-admin-root').getByText('Machine name'), 'machine name stays').toHaveCount(1);
});

test('CONFLICT (client + a disk still set): the fields COME BACK, and the disagreement is stated', async ({ page }) => {
    await boot(page);
    await mountAdmin(page, CONFLICT, { dest: '\\\\10.0.0.50\\cncdisk' });
    expect(await page.evaluate(() => window.__adminErr)).toBeNull();
    // ⚠ Hiding the field here would make the contradiction PERMANENT — nothing could clear it.
    await expect(wiring(page), 'the disk field returns so it CAN be cleared').toHaveCount(1);
    await expect(page.locator('#test-admin-root').getByText(/set to CLIENT, but a controller disk is still configured/),
        'the disagreement is stated, not silently resolved').toHaveCount(1);
});
