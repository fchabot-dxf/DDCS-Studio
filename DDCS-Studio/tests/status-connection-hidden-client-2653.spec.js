import { test, expect } from '@playwright/test';

/**
 * t2653 (BACKLOG #83, owner-ruled 2026-09-06) — on a CLIENT device with NO local daemon at all, the Status
 * tab's Connection section can only ever show a red "unreachable" dot: `deriveStatus`'s own `if (!d) return
 * {dot:"bad", label:"unreachable"}` is the ONE branch reachable when the device call fails, no other outcome
 * possible. That is a DEFINITIONAL fact of being a client with nothing local to report — the identity pill one
 * line up already states it plainly ("This PC is a CLIENT..."). Showing it again as a red alarm reads as a
 * problem when nothing has failed. Hidden entirely for that one case; every other role/state keeps it, because
 * it then carries REAL, varying information the identity pill does not: a GATEWAY's own dot answers "is MY
 * daemon reaching the controller right now"; a MISMATCH client still runs a real local daemon (just wired to a
 * different controller) and `deriveStatus` resolves it to "live"/"controller offline"/"sandbox" — genuinely
 * live facts about THIS PC's own machine, not a restatement of the mismatch classification.
 */

const mountStatus = async (page) => page.evaluate(async () => {
    localStorage.setItem('ddcs_machine', JSON.stringify({ controllerId: 'ddcs-expert-m350', kind: 'mill' }));
    const mod = await import('/ui/gateway/views/status.js');
    document.getElementById('test-status-root')?.remove();
    const root = document.createElement('div');
    root.id = 'test-status-root';
    root.style.cssText = 'position:fixed;inset:0;z-index:99990;background:var(--bg,#111);overflow:auto;padding:20px';
    document.body.appendChild(root);
    await mod.default.mount({ root, client: window.__testClient });
    await mod.default.onPoll({ root, client: window.__testClient });
});

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
};

const installClient = (page, descriptor) => page.evaluate((d) => {
    window.__testClient = {
        descriptor: async () => { if (d === null) throw new Error('no gateway'); return d; },
        readVars: async () => ({}),
    };
}, descriptor);

// identified by POSITION (mount()'s own fixed append order: identity, conn, desc, vars), not by its own
// section-label text — the hidden case clears its children entirely, including that very label.
const connectionState = (page) => page.evaluate(() => {
    const sections = [...document.querySelectorAll('#test-status-root section.block')];
    const conn = sections[1];
    if (!conn) return { present: false };
    return { present: true, visible: getComputedStyle(conn).display !== 'none', text: conn.textContent };
});

const GATEWAY_DESC = {
    role: 'gateway', dest: '\\\\10.0.0.50\\cncdisk', backend: 'local', version: '1',
    controller_connected: true, machine_name: 'Ultimate Bee', controller_profile_id: 'ddcs-expert-m350',
};
const MISMATCH_DESC = { ...GATEWAY_DESC, controller_profile_id: 'ddcs-v41' };   // a real local daemon, wired elsewhere

test('CLIENT with no local daemon at all: the Connection section is hidden — the identity pill already says this', async ({ page }) => {
    await boot(page);
    await installClient(page, null);
    await mountStatus(page);
    const conn = await connectionState(page);
    expect(conn.visible, 'the section is not shown as a red alarm restating "you are a client"').toBe(false);
});

test('GATEWAY: the Connection section stays — its dot is a real, varying fact about this PC\'s own daemon', async ({ page }) => {
    await boot(page);
    await installClient(page, GATEWAY_DESC);
    await mountStatus(page);
    const conn = await connectionState(page);
    expect(conn.present, 'the section renders at all').toBe(true);
    expect(conn.visible, 'and is visible on a gateway').toBe(true);
});

test('MISMATCH client (a REAL local daemon, wired to a different controller): the Connection section stays — it is not the definitional-red case', async ({ page }) => {
    await boot(page);
    await installClient(page, MISMATCH_DESC);
    await mountStatus(page);
    const conn = await connectionState(page);
    expect(conn.present, 'the section renders').toBe(true);
    expect(conn.visible, 'a mismatch client has a REAL local daemon to report on — not hidden').toBe(true);
    expect(conn.text, 'and it genuinely reports live, not the generic red unreachable text').toMatch(/live/i);
});
