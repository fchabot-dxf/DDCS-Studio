import { test, expect } from '@playwright/test';

/**
 * t1321 — TWO USER-LIVE REPORTS about how the lathe FEELS.
 *
 *  1. ORBITING WAS WEIRD since the roll: the camera framed the bed horizontal, but `up` only swapped to the
 *     cross-slide while the view stayed clear of it — so mid-drag it snapped back to the mill's meridian, and the
 *     scene corkscrewed. Declared per kind now, at the seam that already owns the kind's framing.
 *  2. THE TOOL COMES FROM THE SIDE on their flat-bed machine, at centre height — not down from the top. That is a
 *     MACHINE FACT, so it rides the workspace record beside the chuck, and FRONT is the default.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page, machine) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async (m) => { const M = await import('/data/workspaceMachine.js'); M.setMachine(m, false); }, machine);
    await page.click('#view-toggle');
    await page.waitForTimeout(1400);
};
const cam = (page) => page.evaluate(() => {
    const v = window.__ddcsLastViz, c = v.camera;
    return { up: [+c.up.x.toFixed(2), +c.up.y.toFixed(2), +c.up.z.toFixed(2)],
             pos: [+c.position.x.toFixed(1), +c.position.y.toFixed(1), +c.position.z.toFixed(1)],
             target: [+v.target.x.toFixed(1), +v.target.y.toFixed(1)], theta: +v.theta.toFixed(3), phi: +v.phi.toFixed(3) };
});
const drag = async (page, dx, dy) => {
    const b = await page.evaluate(() => { const r = window.__ddcsLastViz.renderer.domElement.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.move(b.x, b.y); await page.mouse.down();
    await page.mouse.move(b.x + dx, b.y + dy, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(250);
};

test('ORBIT ON A LATHE — up never moves, and left-right walks AROUND the bar', async ({ page }) => {
    await boot(page, { kind: 'lathe', chuck: 'axis' });
    const a = await cam(page);
    expect(a.up, 'up is the cross-slide').toEqual([1, 0, 0]);
    expect(a.target, 'and the orbit turns around the bar centreline, not the mill floor origin').toEqual([0, 0]);
    await drag(page, 160, 0);
    const b = await cam(page);
    // THE CORKSCREW WAS THE UP SNAPPING MID-DRAG. It does not move now, at any angle.
    expect(b.up, 'up is unchanged by a horizontal drag').toEqual(a.up);
    expect(b.theta, 'which changed the azimuth around the bar axis').not.toBe(a.theta);
    expect(b.phi, 'and nothing else').toBe(a.phi);
    // …the camera really did walk AROUND the bar: it stays the same distance out, on the same slice of the bed
    expect(Math.hypot(b.pos[0], b.pos[1]), 'same radius from the centreline').toBeCloseTo(Math.hypot(a.pos[0], a.pos[1]), 0);
    expect(b.pos[2], 'and the same place along the bed').toBeCloseTo(a.pos[2], 0);
    await drag(page, 0, 90);
    const c = await cam(page);
    expect(c.up, 'a vertical drag leaves up alone too').toEqual(a.up);
    expect(c.phi, 'it swings the eye along the bed').not.toBe(b.phi);
});

test('A MILL ORBITS EXACTLY AS IT DID — its up is the meridian and follows the drag', async ({ page }) => {
    await boot(page, { kind: 'mill' });
    const a = await cam(page);
    expect(a.up[0], 'the mill up is NOT the lathe roll').toBeLessThan(0.9);
    expect(a.up[2], 'it leans on Z, as it always has').toBeGreaterThan(0.5);
    await drag(page, 160, 0);
    const b = await cam(page);
    expect(b.up, 'and it still tracks the meridian through a drag — untouched behaviour').not.toEqual(a.up);
    expect(b.theta).not.toBe(a.theta);
});

test('THE TOOLPOST IS A MACHINE FACT — front by default, and it travels', async ({ page }) => {
    await boot(page, { kind: 'lathe', chuck: 'axis' });
    const r = await page.evaluate(async () => {
        const M = await import('/data/workspaceMachine.js');
        const B = await import('/data/backup.js');
        const before = M.toolPostSide();
        M.setMachine({ ...M.getMachine(), toolPost: 'top' }, false);
        const obj = await B.buildBackup();
        M.setMachine({ ...M.getMachine(), toolPost: 'front' }, false);
        await B.restoreBackup(obj);
        return { before, inFile: (obj.stores.machine || {}).toolPost, after: M.toolPostSide(), posts: M.TOOL_POSTS };
    });
    expect(r.before, 'a flat-bed toolpost at centre height is the default — the user ruling').toBe('front');
    expect(r.posts).toEqual(['front', 'top']);
    expect(r.inFile, 'it rides the machine record into the .ddcs, like the chuck').toBe('top');
    expect(r.after, 'and comes back with the file').toBe('top');
});

test('THE 3D HANGS THE TOOL AT THE DECLARED SIDE — and the EMIT never notices', async ({ page }) => {
    const emitFor = (page) => page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const def = uo.listUserOps().find((d) => d.opType === 'user_lathe_odturn');
        window.ddcsLoadBlockStack(builderOf('user_lathe_odturn')(uo.defaultParams(def)));
        return String(emitProgram(builderOf('user_lathe_odturn')(uo.defaultParams(def))));
    });
    await boot(page, { kind: 'lathe', chuck: 'axis', toolPost: 'front' });
    const frontEmit = await emitFor(page);
    // built through the viz's own lathe-tool builder, which is what a run uses
    const front = await page.evaluate(() => { const v = window.__ddcsLastViz; v._buildLatheTool({ type: 'turning', dia: 6 }); return { rotZ: +v._animTool.rotation.z.toFixed(3), post: window.ddcsToolPost() }; });
    await boot(page, { kind: 'lathe', chuck: 'axis', toolPost: 'top' });
    const topEmit = await emitFor(page);
    const top = await page.evaluate(() => { const v = window.__ddcsLastViz; v._buildLatheTool({ type: 'turning', dia: 6 }); return { rotZ: +v._animTool.rotation.z.toFixed(3), post: window.ddcsToolPost() }; });
    expect(front.post).toBe('front'); expect(top.post).toBe('top');
    expect(front.rotZ, 'the front post reaches in from the side, as authored').toBe(0);
    expect(top.rotZ, 'a top post is the same holder brought over the bar').toBeCloseTo(Math.PI / 2, 3);
    // THE EMIT IS UNTOUCHED: X is the radius wherever the post sits. A toolpost that changed the G-code would be a
    // machine fact leaking into the part.
    expect(topEmit, 'byte-identical program on either machine').toBe(frontEmit);
});
