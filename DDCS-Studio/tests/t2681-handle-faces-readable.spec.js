import { test, expect } from '@playwright/test';

/**
 * t2681 — THE FACES, MADE READABLE, for owner review. The owner approved t2679's search dropdown but
 * rejected the raw block faces themselves. This spec exists SOLELY to produce the real screenshots the
 * dispatch's own bar asks for: "a screenshot of both handle faces where a machinist can read them."
 *
 * TWO states per block, so the reviewer sees the mechanism, not just one snapshot:
 *  - point_handle in its DEFAULT (literal-anchor) state — every essential field visible, human-labeled.
 *  - point_handle with `relToRow` set — proves ax/ay genuinely DISAPPEAR (they're inert then), not just relabeled.
 *  - rect_handle in its DEFAULT state — the owner's own named example, now five words instead of fifteen.
 *  - rect_handle with `cornerParam` set — proves the enabler REVEALS on demand, not permanently gone.
 */
test.use({ viewport: { width: 2200, height: 1000 } });

const inBlocks = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.waitForTimeout(300);
};

async function loadAndShoot(page, stack, blockType, path) {
    await page.evaluate(async (s) => {
        const SB = await import('/blocks/blockly/stackBridge.js');
        const ws = window.__blkws;
        ws.clear();
        SB.stackToWorkspace(s, ws);
    }, stack);
    await page.waitForTimeout(400);
    await page.evaluate((t) => { const ws = window.__blkws; const blk = ws.getAllBlocks(false).find((b) => b.type === t); ws.centerOnBlock(blk.id, true); }, blockType);
    await page.waitForTimeout(600);
    const raw = await page.evaluate((t) => {
        const ws = window.__blkws;
        const blk = ws.getAllBlocks(false).find((b) => b.type === t);
        const r = blk.getSvgRoot().getBoundingClientRect();
        return { x: r.x - 24, y: r.y - 24, width: r.width + 48, height: r.height + 48 };
    }, blockType);
    const x = Math.max(52, raw.x), y = Math.max(0, raw.y);
    const width = Math.min(2200 - x, raw.width - (x - raw.x));
    const height = Math.min(1000 - y, raw.height - (y - raw.y));
    await page.screenshot({ path, clip: { x, y, width, height } });
}

test('t2681 face screenshots: point_handle (default + relToRow states), rect_handle (default + cornerParam states)', async ({ page }) => {
    await inBlocks(page);

    const phDefault = [{ type: 'feature_canvas', params: {}, children: [
        { type: 'point_handle', params: { fx: 'px', fy: 'py', ax: 40, ay: 60, relToRow: '', label: 'pos' } },
    ] }];
    await loadAndShoot(page, phDefault, 'point_handle', 'verification/t2681-point-handle-face-default.png');

    const phRelTo = [{ type: 'feature_canvas', params: {}, children: [
        { type: 'point_handle', params: { fx: 'px', fy: 'py', ax: 40, ay: 60, relToRow: 'wall1', label: 'pos' } },
    ] }];
    await loadAndShoot(page, phRelTo, 'point_handle', 'verification/t2681-point-handle-face-relto.png');

    const rhDefault = [{ type: 'feature_canvas', params: {}, children: [
        { type: 'rect_handle', params: { field: 'boxw', fieldH: 'boxh', ax: 0, ay: 0, cornerParam: '', label: 'W×H' } },
    ] }];
    await loadAndShoot(page, rhDefault, 'rect_handle', 'verification/t2681-rect-handle-face-default.png');

    const rhCorner = [{ type: 'feature_canvas', params: {}, children: [
        { type: 'rect_handle', params: { field: 'boxw', fieldH: 'boxh', ax: 0, ay: 0, cornerParam: 'stockAttach', label: 'W×H' } },
    ] }];
    await loadAndShoot(page, rhCorner, 'rect_handle', 'verification/t2681-rect-handle-face-corner-revealed.png');

    // non-decorative: confirm what the screenshots show, not just that they were taken.
    const r = await page.evaluate(() => {
        const rh = window.__blkws.getAllBlocks(false).find((b) => b.type === 'rect_handle');
        return { face: rh.toString(), sxVisible: rh.getField('SX').isVisible(), cornerVisible: rh.getField('CORNERPARAM').isVisible() };
    });
    expect(r.face, 'the last shot (cornerParam set) reads in human words').toContain('corner from');
    expect(r.cornerVisible, 'cornerParam is revealed once set').toBe(true);
    expect(r.sxVisible, 'sx stays hidden regardless -- no reveal path, per the owner\'s own explicit list').toBe(false);
});
