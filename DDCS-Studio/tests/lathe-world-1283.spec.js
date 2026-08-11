import { test, expect } from '@playwright/test';

/**
 * t1283 — THE LATHE WORLD: the profile carve, the chuck, the turning tool, and a DRO that speaks diameter.
 *
 * THE CARVE IS ASSERTED AGAINST THE HAND-DERIVED PASS TRUTHS, not against itself: after facing removes its 3mm
 * allowance the bar is 3 SHORTER; after turning to Ø14 over 25 the profile steps at exactly those numbers; a Ø12
 * groove at Z−10 leaves Ø12 there and the full bar either side; a 15-deep centre drill opens a bore 15 deep and
 * leaves the outside alone.
 */
test.use({ viewport: { width: 1400, height: 950 } });

/**
 * t1313 — THIS SPEC DECLARES THE BAR IT TESTS. The stock modal made the WORKSPACE record the one bar in the chuck,
 * so an op's own `barDiameter` default no longer outranks it (that default WAS the parallel store the redesign
 * removed). Every hand-derived truth below is against a Ø20 bar, so the workspace is told to hold one — which is
 * what a turner would have done before running any of this.
 */
const setBar = (page, diameter = 20, stickOut = 60) => page.evaluate(async ({ d, so }) => {
    // built straight from the declared bar shape — NOT through latheSimStock, which now (correctly) prefers the
    // workspace bar and would therefore hand back the one already there instead of the one being asked for
    const { barStock } = await import('/data/stockShape.js');
    window.ddcsGetSettings().stock = barStock({ diameter: d, stickOut: so, allowance: 1 }, window.ddcsGetSettings().stock);
    try { window.ddcsSaveSettings && window.ddcsSaveSettings(); } catch (_) {}
}, { d: diameter, so: stickOut });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async () => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ name: 'Rig', kind: 'lathe', chuck: 'axis' }, false);
    });
    await setBar(page);   // t1313 — the workspace holds the Ø20 bar these truths are derived against
};

/** Run an op's real emitted program through the profile carve, exactly as the viz does. */
const carveOp = async (page, type, extra) => page.evaluate(async ({ t, x }) => {
    const uo = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitProgram } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const P = await import('/data/latheProfile.js');
    const S = await import('/viz/latheScene.js');
    const def = uo.listUserOps().find((d) => d.opType === t);
    const params = { ...uo.defaultParams(def), ...(x || {}) };
    const nc = String(emitProgram(builderOf(t)(params)));
    const bar = S.latheBarFrom(params, {});
    const prof = P.profileFromBar(bar);
    const cuts = (traceToolpath(nc).segments || []).filter((s) => !s.rapid && !s.probe);
    for (const s of cuts) {
        const onCentre = Math.abs(s.x1) < 0.001 && Math.abs(s.x2) < 0.001;
        if (onCentre) P.carveBore(prof, 1.5, Math.min(s.z1, s.z2));
        else P.carveSegment(prof, s, Number(params.width) || 0);
    }
    const at = (z) => { const i = Math.round((z - prof.z0) / prof.step); return { rOut: prof.rOut[i], rIn: prof.rIn[i] }; };
    return { stats: P.profileStats(prof), bar, at: { f0: at(0), fm1: at(-1), fm5: at(-5), fm13: at(-13), fm26: at(-26), fm40: at(-40) },
             cuts: cuts.length };
}, { t: type, x: extra });

test('FACING SHORTENS THE BAR — by exactly the allowance it removes', async ({ page }) => {
    await boot(page);
    const r = await carveOp(page, 'user_lathe_facing');
    // the bar starts 60 of stick-out plus its 3mm of raw end; facing takes that 3 off
    expect(r.bar.allowance, 'the drawn bar holds the material facing removes').toBe(3);
    expect(r.stats.zEnd, 'the finished face is at Z0 — the raw end is gone').toBeCloseTo(0, 1);
    expect(r.stats.length, 'so the bar is 3 shorter than it started').toBeCloseTo(60, 1);
    // …and just INSIDE the new face it is still the full bar: facing shortens, it does not taper. (Sampled a
    // millimetre in, because the plane the last pass cut THROUGH is by definition where material stops.)
    expect(r.at.fm1.rOut, 'and just inside the new face it is still full diameter').toBeCloseTo(10, 1);
});

test('OD TURNING STEPS THE PROFILE — at exactly the hand-derived diameter and length', async ({ page }) => {
    await boot(page);
    const r = await carveOp(page, 'user_lathe_odturn');
    // Ø14 over 25mm: the turned length sits at radius 7, and beyond it the bar is untouched at radius 10
    expect(r.at.fm5.rOut, 'inside the turned length the bar is at the finished radius').toBeCloseTo(7, 2);
    expect(r.at.fm13.rOut, 'all the way along it').toBeCloseTo(7, 2);
    expect(r.at.fm26.rOut, 'and past the shoulder it is still the raw bar').toBeCloseTo(10, 2);
    expect(r.stats.minDia, 'the smallest diameter left is the one on the drawing').toBeCloseTo(14, 1);
    expect(r.stats.maxDia, 'and the largest is still the bar').toBeCloseTo(20, 1);
});

test('PARTING OPENS ITS GROOVE — at the blade Z, as wide as the blade, and nowhere else', async ({ page }) => {
    await boot(page);
    const r = await carveOp(page, 'user_lathe_parting');
    // the default groove: Ø12 at a face of Z−10 with a 3mm blade → the slot spans Z−13…−10
    expect(r.at.fm13.rOut, 'the groove is cut to its diameter').toBeCloseTo(6, 2);
    expect(r.at.fm5.rOut, 'the bar ahead of it is untouched').toBeCloseTo(10, 2);
    expect(r.at.fm26.rOut, 'and so is the bar behind it').toBeCloseTo(10, 2);
    expect(r.stats.minDia, 'the smallest thing left is the groove floor').toBeCloseTo(12, 1);
});

test('CENTRE DRILLING OPENS A BORE — down the middle, without touching the outside', async ({ page }) => {
    await boot(page);
    const r = await carveOp(page, 'user_lathe_centerdrill');
    expect(r.at.f0.rIn, 'there is a hole at the face').toBeGreaterThan(0);
    expect(r.at.fm5.rIn, 'and it runs into the part').toBeGreaterThan(0);
    expect(r.at.fm26.rIn, 'but stops at the declared depth — 15 deep, so nothing at 26').toBe(0);
    expect(r.at.fm5.rOut, 'and the outside diameter is untouched: a drill is not a turning tool').toBeCloseTo(10, 2);
});

test('THE PROFILE MODEL ITSELF — a cut removes what it passed through, and says when it cut air', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const P = await import('/data/latheProfile.js');
        const p = P.profileFromBar({ diameter: 20, stickOut: 30, allowance: 0 });
        const first = P.carveSegment(p, { x1: 7, z1: 0, x2: 7, z2: -10 });      // a turning pass
        const again = P.carveSegment(p, { x1: 9, z1: 0, x2: 9, z2: -10 });      // …a bigger radius: cuts AIR
        const taper = P.carveSegment(p, { x1: 7, z1: -10, x2: 9, z2: -20 });    // a taper down the bar
        const at = (z) => p.rOut[Math.round((z - p.z0) / p.step)];
        return { first, again, taper, r0: at(-5), r15: at(-15), r25: at(-25) };
    });
    expect(r.first, 'the first pass removes material').toBeGreaterThan(0);
    expect(r.again, 'a pass at a BIGGER radius removes nothing — it swings through air, and says so').toBe(0);
    expect(r.r0, 'the turned length is at the pass radius').toBeCloseTo(7, 2);
    // the taper's radius is interpolated ALONG the move: half way between 7 and 9 at its midpoint
    expect(r.r15, 'a taper removes the right amount at each Z, not a step').toBeCloseTo(8, 1);
    expect(r.r25, 'and past the cut the bar is untouched').toBeCloseTo(10, 2);
});

test('THE DRO SPEAKS DIAMETER on a lathe — and the frame stays radius underneath', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const D = await import('/viz/latheDro.js');
        const L = await import('/data/lathe.js');
        return {
            lathe: { label: D.droAxisLabel('x'), shown: D.droValue('x', 7), z: D.droValue('z', -12.5), y: D.droAxisLabel('z') },
            radiusOf: L.radiusOf(14),
        };
    });
    // the X readout is a DIAMETER, marked as one — 7 on the machine is Ø14 to the operator
    expect(r.lathe.label, 'the X row is marked as a diameter').toMatch(/Ø/);
    expect(r.lathe.shown, 'and shows twice the radius the machine is at').toBe(14);
    expect(r.lathe.z, 'Z is untouched — it was never a radius').toBe(-12.5);
    expect(r.lathe.y, 'and so is its label').toBe('Z');
    // …and the model's ONE conversion is still the only halving: this is a display, not a second frame
    expect(r.radiusOf, 'radiusOf remains the one converter').toBe(7);
});

test('A MILL DRO IS UNTOUCHED — the diameter reading is a lathe declaration, not a global', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async () => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ kind: 'mill' }, false);
    });
    const r = await page.evaluate(async () => {
        const D = await import('/viz/latheDro.js');
        return { label: D.droAxisLabel('x'), shown: D.droValue('x', 7) };
    });
    expect(r.label, 'a mill X is an X').toBe('X');
    expect(r.shown, 'and its number is the number').toBe(7);
});

// ── t1285 — THE TOOL AND THE CHUCK, asserted BOTH WAYS ──────────────────────────────────────────────────────────

/**
 * The standard this family earned: it is not enough that the lathe things are present — the MILL things must be
 * ABSENT, or "present" only means the scene got busier. And a mill workspace must be untouched in both directions.
 */
const sceneOf = async (page, kind, type) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async (k) => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ kind: k, chuck: 'axis' }, false);
    }, kind);
    await page.evaluate((t) => window.openWiz(t), type);
    await page.waitForTimeout(2000);
    return page.evaluate(() => {
        const v = window.__ddcsLastViz;
        if (!v) return null;
        const names = [];
        if (v._animTool) v._animTool.traverse((o) => { if (o.name) names.push(o.name); });
        return {
            toolType: v._simTool && v._simTool.type,
            toolParts: v._animTool ? v._animTool.children.length : -1,
            partNames: names,
            hasChuck: !!v._latheChuck,
            chuckParts: v._latheChuck ? v._latheChuck.children.length : 0,
            rotaryRig: !!v._rotaryFixture,
            stock: v._stock ? { shape: v._stock.shape, axis: v._stock.axis || null } : null,
            note: (document.querySelector('.pp-carve-note') || {}).textContent || '',
        };
    });
};

test('LATHE: the turning tool is there AND the mill spindle is NOT', async ({ page }) => {
    const s = await sceneOf(page, 'lathe', 'user_lathe_odturn');
    expect(s, 'the scene exists to be asserted about').not.toBeNull();
    // PRESENT: an insert on a holder, named as one everywhere the user can read it
    expect(s.toolType, 'the tool identity says turning — one owner, so the mesh and the header agree').toBe('turning');
    expect(s.toolParts, 'holder + insert, and nothing else').toBe(2);
    expect(s.note, 'the header names it too').toMatch(/turning tool \(insert\)/);
    // ABSENT: the mill's spindle assembly. Presence alone would only mean the scene got busier.
    expect(s.partNames.includes('spindle'), 'no mill spindle body').toBe(false);
    expect(s.partNames.includes('collet'), 'no collet').toBe(false);
    expect(s.note, 'and nothing calls it an endmill').not.toMatch(/endmill/);
    // THE CHUCK: a disc and three jaws, gripping the bar, with NO tailstock over the face
    expect(s.hasChuck, 'the bar is held').toBe(true);
    expect(s.chuckParts, 'a disc and three jaws — no tailstock, because a turner’s bar sticks out free').toBe(4);
    expect(s.rotaryRig, 'and the 4th-axis rig slot is untouched: two rigs, two questions').toBe(false);
});

test('LATHE: the centre drill declares its OWN tool — a bit on centre, not an insert', async ({ page }) => {
    const s = await sceneOf(page, 'lathe', 'user_lathe_centerdrill');
    // t1722 — 'centredrill' (British), matching LATHE_TOOL_KINDS' declared id (data/latheTools.js): unified a
    // real spelling split across 6 tool-KIND sites (this op's OWN opType, 'user_lathe_centerdrill', is a
    // separate, correctly-American-spelled identity, untouched).
    expect(s.toolType, 'the op declares what it puts against the work').toBe('centredrill');
    expect(s.note, 'and the header says so').toMatch(/centre drill/);
    expect(s.note, 'never a turning insert, which this op does not use').not.toMatch(/insert/);
    expect(s.hasChuck, 'the bar is still held').toBe(true);
});

test('MILL: unchanged in BOTH directions — no lathe furniture, and the mill’s own still there', async ({ page }) => {
    const s = await sceneOf(page, 'mill', 'user_pocket_data');
    expect(s, 'the mill scene exists').not.toBeNull();
    // the lathe things are ABSENT
    expect(s.hasChuck, 'no chuck on a mill').toBe(false);
    expect(s.toolType, 'and no turning tool').not.toBe('turning');
    expect(s.stock && s.stock.axis, 'the stock declares no bar axis').toBeFalsy();
    // …and the mill's OWN tool assembly is intact: this is the half that catches a fix which broke the other world
    expect(s.partNames.includes('spindle'), 'the mill keeps its spindle').toBe(true);
    expect(s.partNames.includes('collet'), 'and its collet').toBe(true);
});

// ── t1289 — THE KERF IS ONE-SIDED, and these asserts look where the two readings DISAGREE ───────────────────────

/**
 * The carve spread the blade width symmetrically around the cutting line, so every groove sat HALF A KERF
 * chuck-ward of where the machine cuts it. It survived a whole turn of testing because the existing spec sampled
 * the slot's MIDDLE — where a symmetric and a one-sided reading agree. The WALLS are the only place they differ.
 *
 * THE DECLARED MEANING settles it: the macro writes `#150 = [#143-#144]` — the face LESS the kerf — so the cutting
 * line is the slot's FAR wall and the blade occupies everything between it and the typed face.
 */
test('THE PARTING SLOT sits between the blade line and the typed face — asserted at both WALLS', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const P = await import('/wizards/lathe/parting.js');
        const L = await import('/data/latheProfile.js');
        const S = await import('/viz/latheScene.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const run = (params) => {
            const nc = String(emitProgram(P.partingStack(params)));
            const prof = L.profileFromBar(S.latheBarFrom(params, {}));
            for (const s of (traceToolpath(nc).segments || []).filter((x) => !x.rapid && !x.probe)) L.carveSegment(prof, s, params.width);
            return { at: (z) => prof.rOut[Math.round((z - prof.z0) / prof.step)], stats: L.profileStats(prof) };
        };
        const g = run({ kind: 'groove', barDiameter: 20, targetDiameter: 12, zFace: -10, width: 3, peck: 0 });
        const p = run({ kind: 'part', barDiameter: 20, spigotDiameter: 0, zFace: -20, width: 3, peck: 0 });
        // …and what the 2D DRAWS, from the same numbers
        const V = await import('/viz/latheProfileCanvas.js');
        const spec = V.partProfileSpec({ diameter: 20, stickOut: 60, allowance: 1 },
            { kind: 'groove', zFace: -10, floorDiameter: 12, width: 3 }, () => {});
        const band = spec.items.find((i) => i.kind === 'rect');
        const at = Object.fromEntries(spec.handles.map((h) => [h.id, h.x]));
        return {
            bladeZ: P.partBladeZ({ zFace: -10, width: 3 }),
            nearWall: g.at(-10.5), farWall: g.at(-14), mid: g.at(-11.5), pastFace: g.at(-9),
            stubEnd: p.stats.zEnd,
            band: { from: band.x, to: band.x + band.w }, handles: at,
        };
    });
    // the cutting line is the FAR wall: face −10 less a 3mm blade
    expect(r.bladeZ, 'the blade sits a kerf behind the typed face').toBe(-13);
    // ── THE TWO POINTS WHERE THE READINGS DISAGREE ──
    expect(r.nearWall, 'z −10.5 is INSIDE the slot: cut to the groove floor').toBeCloseTo(6, 2);
    expect(r.farWall, 'z −14 is BEYOND the blade: untouched bar').toBeCloseTo(10, 2);
    // …and the points where they agree, kept as the sanity floor
    expect(r.mid, 'the middle of the slot is cut either way').toBeCloseTo(6, 2);
    expect(r.pastFace, 'and nothing is removed ahead of the face').toBeCloseTo(10, 2);
    // A PART-OFF ENDS THE STUB ON THE BLADE LINE, not half a kerf past it
    expect(r.stubEnd, 'face −20 with a 3mm blade leaves a stub ending at −23').toBeCloseTo(-23, 2);
    // THE 2D READS THE SAME TRUTH — confirmed, not assumed
    expect(r.band.from, 'the drawn slot starts on the blade line').toBeCloseTo(-13, 3);
    expect(r.band.to, 'and ends on the typed face').toBeCloseTo(-10, 3);
    expect(r.handles.partPos, 'the face handle is on the face').toBeCloseTo(-10, 3);
    expect(r.handles.partFloor, 'and the floor handle on the blade line').toBeCloseTo(-13, 3);
});

// ── t1289 — THE SPIN, with the two traps that beat it twice written in as the spec ──────────────────────────────

/**
 * TRAP ONE — WHAT SAYS "RUNNING". Not a repaint (the run-button refresh fires on every re-render) and not
 * `engine.running` (a static route TRACE raises that, which is precisely why the bar span while idle). The engine
 * declares `playing`, raised only between a real run and its end, and pushes it to consumers.
 *
 * TRAP TWO — WHICH VIZ. Only the ACTIVE panel's instance turns its bar; a hidden panel's viz is a stale object
 * nobody is looking at. The live one is published, so this asserts about the scene a person can actually see.
 */
test('THE BAR IS STILL WHEN IDLE AND TURNS WHEN IT RUNS — before play, mid-play, after stop, after the end', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.openWiz('user_lathe_odturn'));
    await page.waitForTimeout(1600);
    const look = () => page.evaluate(() => {
        const v = window.__ddcsActiveViz;
        return v && v._partGroup ? { z: +v._partGroup.rotation.z.toFixed(3), spin: !!v._latheSpin } : null;
    });
    const running = () => page.evaluate(() => !!(window.__ddcsActiveViz && document.querySelector('.pp-run.on')));
    const toggle = async () => { await page.locator('.pp-run').first().click(); await page.waitForTimeout(600); };

    // the preview auto-plays on open, so bring it to a KNOWN idle first — that is the state being asserted
    if (await running()) await toggle();
    const idleA = await look();
    await page.waitForTimeout(700);
    const idleB = await look();
    expect(idleA, 'the lathe scene exists').not.toBeNull();
    expect(idleB.z, 'IDLE: a bar that turns while nothing runs is a lie about the machine').toBe(idleA.z);
    expect(idleB.spin, 'and the spin is not merely invisible — it is off').toBe(false);

    // RUNNING: it turns, and keeps turning
    await toggle();
    const runA = await look();
    await page.waitForTimeout(700);
    const runB = await look();
    expect(runB.spin, 'a real run raises the declared signal').toBe(true);
    expect(runB.z, 'and the work turns while it cuts').toBeGreaterThan(runA.z);

    // STOPPED: still again, immediately
    await toggle();
    await page.waitForTimeout(300);
    const stopA = await look();
    await page.waitForTimeout(700);
    const stopB = await look();
    expect(stopB.spin, 'stopping lowers it').toBe(false);
    expect(stopB.z, 'and the bar is still').toBe(stopA.z);
});

test('A TRACE IS NOT A RUN — the signal the bar reads cannot be raised by re-drawing the route', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
        const seen = [];
        const eng = new GcodeExecutionEngine({ onPlayState: (p) => seen.push(p) });
        // a TRACE walks the whole program — and sets `running` on the way, which is the trap
        eng.trace('G90\nG0 X0 Z0\nG1 X5 F100\nM30\n');
        const afterTrace = { playing: !!eng.playing, running: !!eng.running, events: seen.slice() };
        return { afterTrace };
    });
    expect(r.afterTrace.playing, 'a trace never claims to be playing').toBe(false);
    expect(r.afterTrace.events.length, 'and it emits no start/stop at all — nothing to mislead a consumer').toBe(0);
});

test('A HIDDEN PANEL DOES NOT TURN ITS BAR — the answer cannot outlive the panel that gave it', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.openWiz('user_lathe_odturn'));
    await page.waitForTimeout(1500);
    const r = await page.evaluate(async () => {
        const v = window.__ddcsActiveViz;
        const before = !!(v && v._latheSpin);
        // close the wizard: its panel deactivates, and a deactivated panel is not the one on screen
        const wm = window.ddcsStudio && window.ddcsStudio.wizardManager;
        if (wm && wm.close) wm.close(); else document.querySelector('#wiz_user_cancel, .wiz-cancel, [data-wiz="cancel"]')?.click();
        await new Promise((r2) => setTimeout(r2, 500));
        // a frame has to run for the loop to notice its canvas is gone — that is the guard doing its job
        await new Promise((r2) => requestAnimationFrame(() => requestAnimationFrame(r2)));
        return { before, after: !!(v && v._latheSpin), attached: !!(v && v.renderer && v.renderer.domElement.isConnected) };
    });
    expect(r.after, 'a panel that left the screen stops turning its bar').toBe(false);
});
