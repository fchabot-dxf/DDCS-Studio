import { test, expect } from '@playwright/test';

/**
 * BACKLOG #25 (owner-ruled, t2303) — the workspace-current header's `.wsm-state` badge used to OR two
 * different facts into one visual class: `dirty` (a file exists, this session changed something since) and
 * `!everSaved` (no file has EVER existed) both collapsed to `is-dirty`, even though the state TEXT right next
 * to it already correctly said three different things ("Unsaved changes" vs "Never saved to a file"). The
 * existing coverage (workspace-manager-1223/1231.spec.js) only ever asserted the TEXT, never the glyph, so
 * the disagreement between the words and the mark shipped unnoticed.
 *
 * This asserts the SHAPE, not just the class name — the owner's own ruling was "someone who cannot
 * distinguish the colours must still see two different marks", so colour alone proves nothing; a computed
 * style check of the `::before` glyph's background/border is what actually proves shape carries the meaning.
 * No-file (never saved) is the MORE urgent state (no portable copy exists anywhere) and gets the HOLLOW
 * RING; a stale-but-real file gets the milder FILLED dot; a clean save gets no glyph at all.
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function boot(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.openWorkspaceManager && window.ddcsFileSaveState && window.ddcsWorkspaceDirtyToFile);
    await page.evaluate(() => { window.__ddcsNoReload = true; });
    await page.waitForFunction(async () => {
        const sig = async () => {
            const { BACKUP_STORES } = await import('/data/backup.js');
            return JSON.stringify(BACKUP_STORES.map((s) => { try { return s.read(); } catch (_) { return null; } }));
        };
        const a = await sig();
        await new Promise((r) => setTimeout(r, 120));
        return a === await sig();
    }, null, { timeout: 15000 });
}

const glyphShape = async (page) => page.locator('#wsmCurrent .wsm-state').evaluate((el) => {
    const cs = getComputedStyle(el, '::before');
    return {
        className: el.className,
        text: el.textContent,
        display: cs.display,
        backgroundColor: cs.backgroundColor,
        borderWidth: cs.borderTopWidth,
        borderStyle: cs.borderTopStyle,
    };
});

test('NEVER SAVED: hollow ring — border present, transparent fill, distinct class from a stale file', async ({ page }) => {
    await boot(page);
    // no ddcsMarkWorkspaceSaved call at all — the boot-fresh default is never-saved
    await page.evaluate(() => window.openWorkspaceManager('save'));
    const cur = page.locator('#wsmCurrent');
    await expect(cur.locator('.wsm-state')).toHaveText('Never saved to a file');
    const g = await glyphShape(page);
    expect(g.className, 'the never-saved class, distinct from a stale-file class').toContain('is-never-saved');
    expect(g.className, 'and NOT the stale-file class').not.toContain('is-stale');
    expect(g.display, 'the ring is genuinely rendered, not hidden').not.toBe('none');
    expect(parseFloat(g.borderWidth), 'a hollow ring has a real border').toBeGreaterThan(0);
    expect(g.backgroundColor, 'the ring is hollow — transparent fill, not a filled dot').toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
});

test('STALE FILE (unsaved changes): filled dot — no border, an opaque fill, distinct from never-saved', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => { window.ddcsMarkWorkspaceSaved('m350-shop.ddcs'); });
    await page.evaluate(() => { localStorage.setItem('ddcs_tpl_zzz_wsm', JSON.stringify([{ n: 1 }])); });
    await page.evaluate(() => window.openWorkspaceManager('save'));
    const cur = page.locator('#wsmCurrent');
    await expect(cur.locator('.wsm-state')).toHaveText(/Unsaved changes/);
    const g = await glyphShape(page);
    expect(g.className, 'the stale-file class, distinct from never-saved').toContain('is-stale');
    expect(g.className, 'and NOT the never-saved class').not.toContain('is-never-saved');
    expect(g.display, 'the dot is genuinely rendered').not.toBe('none');
    expect(g.backgroundColor, 'a filled dot has an opaque fill, unlike the hollow ring').not.toMatch(/rgba\(0, 0, 0, 0\)|^transparent$/);
});

test('SAVED (clean): no glyph — the calm state carries no dot at all', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => { window.ddcsMarkWorkspaceSaved('m350-shop.ddcs'); });
    await page.evaluate(() => window.openWorkspaceManager('save'));
    const cur = page.locator('#wsmCurrent');
    await expect(cur.locator('.wsm-state')).toHaveText('Saved');
    const g = await glyphShape(page);
    expect(g.className, 'the saved class').toContain('is-saved');
    expect(g.display, 'no glyph for the clean state').toBe('none');
});
