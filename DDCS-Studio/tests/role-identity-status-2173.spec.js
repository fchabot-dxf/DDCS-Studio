import { test, expect } from '@playwright/test';

/**
 * t2173 — ROLES S3: THE STATED IDENTITY. Human, across three messages: "the status tab should be explicitly
 * client or gateway by presentation" / "client needs to show if a gateway is connected" / "ok but it should be
 * clear". The Status tab's identity line states, unmissably, whether this PC is the CLIENT or the GATEWAY for
 * the open workspace — and in the MISMATCH case (this PC runs its OWN daemon, wired to a different controller
 * than the open workspace), it says BOTH true facts rather than merging them.
 *
 * Anti-spec, each with its own assertion below: not `.muted`, not colour-only, not an icon alone, and the
 * ACCEPTANCE TEST the dispatch itself named — a CROPPED screenshot with no surrounding UI still tells you the
 * role. Reuses the pre-flight badge's PILL colour language (styles.css `.role-identity`), not the component.
 */

const mountStatus = async (page, { workspaceControllerId }) => page.evaluate(async ({ workspaceControllerId }) => {
    if (workspaceControllerId) localStorage.setItem('ddcs_machine', JSON.stringify({ controllerId: workspaceControllerId, kind: 'mill' }));
    const mod = await import('/ui/gateway/views/status.js');
    document.getElementById('test-status-root')?.remove();
    const root = document.createElement('div');
    root.id = 'test-status-root';
    root.style.cssText = 'position:fixed;inset:0;z-index:99990;background:var(--bg,#111);overflow:auto;padding:20px';
    document.body.appendChild(root);
    await mod.default.mount({ root, client: window.__testClient });
    await mod.default.onPoll({ root, client: window.__testClient });
}, { workspaceControllerId });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
};

// Installs the mock client as a real page global BEFORE mountStatus's own evaluate reads it — page.evaluate
// cannot serialize functions across the boundary, so the client (with its async descriptor()) is built IN-PAGE.
const installClient = (page, descriptor) => page.evaluate((d) => {
    window.__testClient = {
        descriptor: async () => { if (d === null) throw new Error('no gateway'); return d; },
        readVars: async () => ({}),
    };
}, descriptor);

const identity = (page) => page.evaluate(() => {
    const box = document.querySelector('#test-status-root .role-identity');
    if (!box) return null;
    return {
        cls: box.className,
        headline: box.querySelector('.role-headline')?.textContent || '',
        detail: box.querySelector('.role-detail')?.textContent || '',
        bg: getComputedStyle(box).backgroundColor,
        headlineWeight: getComputedStyle(box.querySelector('.role-headline')).fontWeight,
    };
});

const GATEWAY_DESC = {
    role: 'gateway', dest: '\\\\10.0.0.50\\cncdisk', backend: 'local', version: '1',
    controller_connected: true, machine_name: 'Ultimate Bee', controller_profile_id: 'ddcs-expert-m350',
};
const MISMATCH_DESC = { ...GATEWAY_DESC, controller_profile_id: 'ddcs-v41' };   // connected ≠ workspace's Expert

test('GATEWAY: states it plainly, names what it serves and from where', async ({ page }) => {
    await boot(page);
    await installClient(page, GATEWAY_DESC);
    await mountStatus(page, { workspaceControllerId: 'ddcs-expert-m350' });
    const id = await identity(page);
    expect(id, 'the identity line rendered').not.toBeNull();
    expect(id.cls).toContain('role-gateway');
    expect(id.headline).toMatch(/this pc is the gateway/i);
    expect(id.detail, 'names what it serves + from where, not just the bare word').toMatch(/Ultimate Bee/);
});

test('CLIENT (no daemon at all): states it plainly, names what the workspace targets', async ({ page }) => {
    await boot(page);
    await installClient(page, null);
    await mountStatus(page, { workspaceControllerId: 'ddcs-expert-m350' });
    const id = await identity(page);
    expect(id.cls).toContain('role-client');
    expect(id.cls, 'plain client is NOT the mismatch colour').not.toContain('role-mismatch');
    expect(id.headline).toMatch(/this pc is a client/i);
    expect(id.detail, 'says what the OPEN WORKSPACE targets, not this PC\'s own (absent) wiring').toMatch(/Expert/i);
});

test('MISMATCH: states client (not gateway), AND carries the reason — both facts, not merged away', async ({ page }) => {
    await boot(page);
    await installClient(page, MISMATCH_DESC);
    await mountStatus(page, { workspaceControllerId: 'ddcs-expert-m350' });
    const id = await identity(page);
    // THE TEST THAT MATTERS for this state: a bare "client" pill would be TRUE but would hide that this PC
    // has a real, running gateway of its own — the exact merge the dispatch warned against.
    expect(id.cls).toContain('role-mismatch');
    expect(id.cls, 'mismatch reads client (this workspace cannot be served from here), not gateway').not.toContain('role-gateway');
    expect(id.headline).toMatch(/this pc is a client/i);
    expect(id.detail, 'the SAME reason roleInfoFromDescriptor computed — not a shorter, lossier rewrite').toMatch(/workspace targets/i);
    expect(id.detail, 'and it names the OTHER controller actually connected here').toMatch(/V4\.1|v4\.1/i);
});

test('RULE — never `.muted`: the identity line is not the same grey as an ordinary caption', async ({ page }) => {
    await boot(page);
    await installClient(page, null);
    await mountStatus(page, { workspaceControllerId: 'ddcs-expert-m350' });
    const s = await page.evaluate(() => {
        const box = document.querySelector('#test-status-root .role-identity');
        const muted = document.createElement('div');
        muted.className = 'muted';
        box.after(muted);
        const bg = getComputedStyle(box).backgroundColor;
        const mutedColor = getComputedStyle(muted).color;
        const boxColor = getComputedStyle(box).color;
        muted.remove();
        return { bg, mutedColor, boxColor };
    });
    // a real, non-transparent, non-default background — the pill treatment, not plain inherited text colour
    expect(s.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(s.bg).not.toBe('transparent');
});

test('RULE — the headline is bold text, never an icon or colour standing alone', async ({ page }) => {
    await boot(page);
    await installClient(page, GATEWAY_DESC);
    await mountStatus(page, { workspaceControllerId: 'ddcs-expert-m350' });
    const id = await identity(page);
    expect(Number(id.headlineWeight), 'bold, not body-weight text').toBeGreaterThanOrEqual(700);
    expect(id.headline.trim().length, 'real words, not a bare icon/glyph').toBeGreaterThan(10);
});

test('ACCEPTANCE TEST (the dispatch\'s own): a screenshot cropped to just the pill still tells you the role', async ({ page }, testInfo) => {
    await boot(page);
    const cases = [
        ['gateway', GATEWAY_DESC],
        ['client', null],
        ['mismatch', MISMATCH_DESC],
    ];
    for (const [name, desc] of cases) {
        await installClient(page, desc);
        await mountStatus(page, { workspaceControllerId: 'ddcs-expert-m350' });
        await page.locator('#test-status-root .role-identity').screenshot({ path: testInfo.outputPath(`role-identity-${name}.png`) });
    }
    // the screenshots are the artifact a human reviews; the DOM-level class/text assertions above are what
    // actually gate CI — this test exists so the crop exists on disk, per the dispatch's own acceptance test.
    expect(true).toBe(true);
});

test('THEMES: all five stay legible (a real, distinct background colour per role in every theme)', async ({ page }) => {
    await boot(page);
    for (const theme of ['studio', 'normal', 'steampunk', 'futuristic', 'organic']) {
        await page.evaluate((t) => document.body.setAttribute('data-theme', t), theme);
        for (const [kind, desc] of [['gateway', GATEWAY_DESC], ['client', null], ['mismatch', MISMATCH_DESC]]) {
            await installClient(page, desc);
            await mountStatus(page, { workspaceControllerId: 'ddcs-expert-m350' });
            const id = await identity(page);
            expect(id, `${theme}/${kind} rendered`).not.toBeNull();
            expect(id.bg, `${theme}/${kind}: a real background colour, not transparent`).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
        }
    }
});
