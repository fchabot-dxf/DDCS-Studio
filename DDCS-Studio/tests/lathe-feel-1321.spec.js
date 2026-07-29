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

test('THE BLADE WIDTH IS DRAGGABLE — the far wall writes the field, and the emit follows (t1321 user)', async ({ page }) => {
    // USER, live: the groove width had NO handle at all — form-only. (Checked before building: the parting canvas
    // carried a face handle and a stop-Ø handle, and nothing for the kerf. Missing, not broken.)
    await boot(page, { kind: 'lathe', chuck: 'axis' });
    const r = await page.evaluate(async () => {
        const C = await import('/viz/latheProfileCanvas.js');
        const bar = { diameter: 20, stickOut: 60, allowance: 1 };
        const wrote = [];
        const spec = C.partProfileSpec(bar, { kind: 'groove', zFace: -10, width: 3, floorDiameter: 12 }, (patch) => wrote.push(patch));
        const h = spec.handles.find((x) => x.id === C.PART_WIDTH_HANDLE_ID);
        // drag the far wall further from the face: the kerf widens to 5
        spec.onDrag(C.PART_WIDTH_HANDLE_ID, { x: -15, y: 10 });
        // …and dragging it must not move the face — handles are independent
        const faceMoved = wrote.some((p) => 'zFace' in p);
        // clamped: a zero-width parting tool is not a tool
        spec.onDrag(C.PART_WIDTH_HANDLE_ID, { x: -10, y: 10 });
        return { label: h && h.label, value: h && h.value, wrote, faceMoved };
    });
    expect(r.label, 'the label speaks the truth: the slot IS the blade').toBe('blade');
    expect(r.value, 'and it shows the width it is holding').toBe(3);
    expect(r.wrote[0], 'dragging the far wall writes the blade width').toEqual({ width: 5 });
    expect(r.faceMoved, 'and never the face — handles are independent').toBe(false);
    expect(r.wrote[1].width, 'clamped to a real blade').toBeGreaterThan(0);
    // THE CHAIN REACHES THE EMIT: the width is #144, and the program follows the field
    const emit = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const def = uo.listUserOps().find((d) => d.opType === 'user_lathe_parting');
        const p = uo.defaultParams(def);
        const at = (w) => String(emitProgram(builderOf('user_lathe_parting')({ ...p, width: w })))
            .split(String.fromCharCode(10)).find((l) => l.startsWith('#144='));
        return { three: at(3), five: at(5) };
    });
    expect(emit.three).toMatch(/^#144=3\b/);
    expect(emit.five, 'the emitted kerf is the dragged number').toMatch(/^#144=5\b/);
});

test('THE STOCK IS SCOPED PER KIND — a mill gets its box back, and the bar survives untouched (t1321 user)', async ({ page }) => {
    // USER, live: switching back to a mill still showed the lathe world, because the BAR was written into the one
    // workspace stock slot. The stock is a fact about the WORK, and the work differs between the two machines.
    await boot(page, { kind: 'mill' });
    const millBox = await page.evaluate(() => ({ ...window.ddcsGetSettings().stock }));
    expect(millBox.shape, 'a mill starts with its box').toMatch(/boss|pocket/);
    // …to a lathe, and give the bar a size the user would notice
    await page.evaluate(async () => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ kind: 'lathe', chuck: 'axis' }, false);
        await new Promise((r) => setTimeout(r, 200));
        const { barStock } = await import('/data/stockShape.js');
        window.ddcsGetSettings().stock = barStock({ diameter: 33, stickOut: 70, allowance: 2 }, window.ddcsGetSettings().stock);
        window.ddcsSaveSettings && window.ddcsSaveSettings();
    });
    await page.waitForTimeout(300);
    // …back to the mill: the box returns, and the lathe furniture goes with the bar
    await page.evaluate(async () => { const M = await import('/data/workspaceMachine.js'); M.setMachine({ kind: 'mill' }, false); });
    await page.waitForTimeout(600);
    await page.click('#view-toggle');
    await page.waitForTimeout(1300);
    const back = await page.evaluate(() => {
        const v = window.__ddcsLastViz, s = window.ddcsGetSettings().stock;
        return { shape: s.shape, x: s.x, y: s.y, z: s.z, chuck: !!v._latheChuck, tool: v._simTool && v._simTool.type };
    });
    expect(back.shape, 'the mill has its own box again').toBe(millBox.shape);
    expect([back.x, back.y, back.z], 'exactly the one it had').toEqual([millBox.x, millBox.y, millBox.z]);
    expect(back.chuck, 'and no chuck in a mill scene').toBe(false);
    expect(back.tool, 'nor a turning tool').not.toBe('turning');
    // …and NOTHING WAS DESTROYED: back on the lathe, the bar is exactly as it was left
    await page.evaluate(async () => { const M = await import('/data/workspaceMachine.js'); M.setMachine({ kind: 'lathe', chuck: 'axis' }, false); });
    await page.waitForTimeout(500);
    const bar = await page.evaluate(() => ({ ...window.ddcsGetSettings().stock }));
    expect(bar.diameter, 'the declared bar came back untouched').toBe(33);
    expect(bar.z, 'stick-out and raw end included').toBe(72);
    expect(bar.origin).toBe('finished-face');
});

/**
 * t1325 (advisor amendment — probed as passing today, pinned so it stays that way).
 *
 * THE WCS TABLE IS SHARED ACROSS KINDS, deliberately: one controller, one G54 table. The lathe view greys Y rather
 * than owning a second table. The per-kind stock PARKING added at t1321 is machinery that swaps what a kind switch
 * carries — so this asserts, byte-identically, that it never grows to swallow the WCS with it. No behaviour change;
 * this is a fence around one, placed next to the machinery it fences.
 */
test('THE KIND SWITCH LEAVES THE WCS TABLE ALONE — mill → lathe → mill, byte-identical', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    const r = await page.evaluate(async () => {
        const wm = await import('/data/workspaceMachine.js');
        const S = window.ddcsGetSettings();
        S.machine = { ...(S.machine || {}), wcs: { active: 2, table: [
            { n: 1, x: -10.5, y: -20.25, z: -3 },
            { n: 2, x: 100, y: 55.125, z: -42.75 },
        ] } };
        const snap = () => JSON.stringify(window.ddcsGetSettings().machine.wcs);
        const before = snap();
        wm.setMachine({ ...wm.getMachine(), kind: 'lathe' });
        window.dispatchEvent(new Event('ddcs:settings-changed'));
        await new Promise((res) => setTimeout(res, 250));
        const asLathe = snap();
        wm.setMachine({ ...wm.getMachine(), kind: 'mill' });
        window.dispatchEvent(new Event('ddcs:settings-changed'));
        await new Promise((res) => setTimeout(res, 250));
        return { before, asLathe, after: snap() };
    });
    // ONE CONTROLLER, ONE G54 TABLE — the offsets a lathe uses are the offsets a mill uses; the kind changes the VIEW
    // (Y greys out), never the stored table.
    expect(r.asLathe, 'switching to lathe leaves the WCS table untouched').toBe(r.before);
    expect(r.after, 'and switching back leaves it untouched again — nothing was parked, swapped or defaulted').toBe(r.before);
});
