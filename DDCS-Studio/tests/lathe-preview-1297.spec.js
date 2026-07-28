import { test, expect } from '@playwright/test';

/**
 * t1297 — THE MAIN PREVIEW IS THE LATHE'S TOO. The user lives in the main editor preview, and it drew a toolpath and
 * a tool in empty air: the bar was a WIZARD-level declaration, so the workspace's global stock stayed a mill's box.
 * And the scene was lettered with a mill's axes — ±Y floating in the vertical, which on a lathe is the RADIUS.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page, kind) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async (k) => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ kind: k, chuck: 'axis' }, false);
    }, kind);
};

const openPreview = async (page) => { await page.click('#view-toggle'); await page.waitForTimeout(1400); };

/** What the scene is actually lettered with, and where each label lands on screen. */
const labels = (page) => page.evaluate(() => {
    const v = window.__ddcsLastViz, out = {};
    for (const k in v._gridLabels) {
        const s = v._gridLabels[k], p = s.position.clone().project(v.camera);
        out[k] = { text: s.__text, ndcX: +p.x.toFixed(2), ndcY: +p.y.toFixed(2) };
    }
    return { labels: out, kind: v._labelKind };
});

test('A LATHE WORKSPACE HOLDS A BAR — the main preview shows the workpiece, not empty air', async ({ page }) => {
    await boot(page, 'mill');                                    // …and it becomes a lathe while we watch
    const before = await page.evaluate(() => ({ ...window.ddcsGetSettings().stock }));
    expect(before.shape, 'a fresh workspace starts with a mill box').not.toBe('cylinder');
    await page.evaluate(async () => { const M = await import('/data/workspaceMachine.js'); M.setMachine({ kind: 'lathe', chuck: 'axis' }, false); });
    await openPreview(page);
    const r = await page.evaluate(() => {
        const s = window.ddcsGetSettings().stock, v = window.__ddcsLastViz;
        return { s, drawn: v._stock && { shape: v._stock.shape, axis: v._stock.axis, z: v._stock.z } };
    });
    // THE WORKSPACE'S OWN STOCK IS THE BAR — the same shape the wizards declare, built by the same function
    expect(r.s.shape).toBe('cylinder');
    expect(r.s.axis, 'lying along the bed, not across the machine').toBe('z');
    expect(r.s.origin, 'with the FINISHED FACE as the datum').toBe('finished-face');
    expect(r.s.diameter, 'the declared default bar — never a diameter invented from the box it replaced').toBe(25);
    expect(r.s.z, 'stick-out plus the raw end ahead of the face').toBe(61);
    // …and that is what the preview draws
    expect(r.drawn, 'the scene has the bar').toEqual({ shape: 'cylinder', axis: 'z', z: 61 });
});

test('A BAR THE USER ALREADY HAS IS NEVER RETYPED', async ({ page }) => {
    await boot(page, 'lathe');
    const r = await page.evaluate(async () => {
        const S = window.ddcsGetSettings();
        S.stock = { ...S.stock, shape: 'cylinder', axis: 'z', origin: 'finished-face', diameter: 40, x: 40, y: 40, z: 90 };
        const wrote = window.ddcsApplyLatheStock();                       // the switch fires again — a second time, and a third
        return { wrote, d: window.ddcsGetSettings().stock.diameter, z: window.ddcsGetSettings().stock.z };
    });
    expect(r.wrote, 'a workspace that already holds a bar is left alone').toBe(false);
    expect(r.d, 'their 40mm bar stays 40mm').toBe(40);
    expect(r.z, 'and their stick-out stays theirs').toBe(90);
});

test('THE LABELS SPEAK THE LATHE FRAME — a bed across the screen, a radius up it, and no Y at all', async ({ page }) => {
    await boot(page, 'lathe');
    await openPreview(page);
    const r = await labels(page);
    const texts = Object.values(r.labels).map((l) => l.text);
    expect(r.kind).toBe('lathe');
    // NO Y. Not greyed, not renamed — a lathe does not have the axis, so the scene does not letter one.
    expect(texts.join(' '), 'the one axis the machine does not have is absent').not.toMatch(/Y/);
    expect(texts, 'the cross-slide is named for what it measures').toContain('+X (radius)');
    expect(texts).toContain('+Z'); expect(texts).toContain('-Z');
    // THE BED RUNS ACROSS THE SCREEN: its two ends sit at the same height and differ horizontally…
    expect(r.labels.yp.ndcY, 'both ends of the bed are level with each other').toBeCloseTo(r.labels.yn.ndcY, 2);
    expect(Math.abs(r.labels.yp.ndcX - r.labels.yn.ndcX), 'and apart along the screen').toBeGreaterThan(0.5);
    // …with the RADIUS above them, which is where the user was told +Y was
    expect(r.labels.xp.ndcY, 'the radius runs up the screen').toBeGreaterThan(r.labels.yp.ndcY);
});

test('A MILL SCENE IS LETTERED EXACTLY AS BEFORE', async ({ page }) => {
    await boot(page, 'mill');
    await openPreview(page);
    const r = await labels(page);
    expect(r.kind).toBe('mill');
    expect(Object.values(r.labels).map((l) => l.text).sort()).toEqual(['+X', '+Y', '-X', '-Y'].sort());
});

test('SWITCHING KIND RE-LETTERS THE SCENE — both ways, in the one live viz', async ({ page }) => {
    await boot(page, 'mill');
    await openPreview(page);
    expect((await labels(page)).kind).toBe('mill');
    await page.evaluate(async () => { const M = await import('/data/workspaceMachine.js'); M.setMachine({ kind: 'lathe', chuck: 'axis' }, false); });
    await page.waitForTimeout(900);
    const l = await labels(page);
    expect(l.kind, 'the labels are rebuilt, not stamped once at construction').toBe('lathe');
    expect(Object.values(l.labels).map((x) => x.text).join(' ')).not.toMatch(/Y/);
    await page.evaluate(async () => { const M = await import('/data/workspaceMachine.js'); M.setMachine({ kind: 'mill' }, false); });
    await page.waitForTimeout(900);
    expect((await labels(page)).kind, 'and back').toBe('mill');
});
