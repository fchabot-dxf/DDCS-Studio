import { test, expect } from './support/harness.mjs';

/**
 * t1275 — PARTING / GROOVING and CENTRE DRILLING, both inheritors. The mechanisms were proven on facing and OD; what
 * this file checks is that each op's own numbers are right and that it inherited rather than re-invented.
 *
 * HAND-DERIVED, one case each:
 *   GROOVE — a Ø20 bar grooved to Ø12 at Z−10 with a 3mm blade. The blade stops at radius 6 (Ø12 halved), and it sits
 *   at Z−13: the typed Z is the FACE of the feature, and the blade occupies its own width on the material side of it.
 *   Pecking 2 from a bar radius of 10: 8, 6 — landing exactly on the floor.
 *   DRILLING — depth 15 pecking 5 bottoms at −5, −10, −15, on the CENTRELINE (X0, never a radius).
 *
 * t2689 — TIER MIGRATION BATCH 2: moved browser→node. Two tests (`BOTH TWINS register…`, `BOTH SURVIVE THE .wiz
 * ROUND TRIP…`) query uo.listUserOps() for 'user_lathe_parting'/'user_lathe_centerdrill' — batch 1's own registry
 * bug applies here too: registerUserOp only populates USER_DEFS (getUserDef), not the separate readStore()-backed
 * store listUserOps() reads. boot() seeds both twins via createUserOp, fresh-if-missing per call (the .wiz round
 * trip test deletes+reimports one, and node's module state persists across tests in one process).
 */
test.use({ viewport: { width: 1280, height: 900 } });

const boot = async (page) => {
    const uo = await import('/blocks/userOps.js');
    const { partingDataDef, PART_DATA_OPTYPE } = await import('/blocks/dataOps/partingData.js');
    const { centerDrillDataDef, CDRILL_DATA_OPTYPE } = await import('/blocks/dataOps/centerDrillData.js');
    if (!uo.listUserOps().some((d) => d.opType === PART_DATA_OPTYPE)) uo.createUserOp(partingDataDef());
    if (!uo.listUserOps().some((d) => d.opType === CDRILL_DATA_OPTYPE)) uo.createUserOp(centerDrillDataDef());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
};

const GROOVE = { kind: 'groove', barDiameter: 20, targetDiameter: 12, zFace: -10, width: 3, peck: 0, feed: 40 };
const DRILL = { kind: 'peck', barDiameter: 20, depth: 15, peck: 5, feed: 60 };

// ── PARTING / GROOVING ──────────────────────────────────────────────────────────────────────────────────────────

test('THE GROOVE lands where the DRAWING says — the blade takes its kerf off the typed face, not the operator', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (G) => {
        const P = await import('/wizards/lathe/parting.js');
        return {
            floor: P.partFloorRadius(G),
            bladeZ: P.partBladeZ(G),
            steps: P.partSteps(G),
            pecked: P.partSteps({ ...G, peck: 2 }),
            uneven: P.partSteps({ ...G, peck: 3 }),
            partOff: P.partFloorRadius({ ...G, kind: 'part' }),
            spigot: P.partFloorRadius({ ...G, kind: 'part', spigotDiameter: 4 }),
        };
    }, GROOVE);
    expect(r.floor, 'a Ø12 groove bottoms at RADIUS 6 — 12 here would be a blade that never touches the bar').toBe(6);
    // THE KERF: the face is at −10, so a 3mm blade sits at −13 and leaves the finished face exactly where it was typed
    expect(r.bladeZ, 'the blade sits its own width on the material side of the typed face').toBe(-13);
    expect(r.steps, 'no peck → one continuous plunge, straight to the floor').toEqual([6]);
    expect(r.pecked, 'pecking 2 from a 10mm bar radius: 8, then 6 — landing exactly on size').toEqual([8, 6]);
    // an uneven peck must never overshoot: past the floor of a groove is INTO the part
    expect(r.uneven, 'the last advance is clamped to the floor, not stepped past it').toEqual([7, 6]);
    expect(r.partOff, 'a part-off with no spigot runs to the centreline').toBe(0);
    expect(r.spigot, 'and a declared spigot stops it at that radius, to snap off').toBe(2);
});

test('THE PARTING EMIT is parametric, speaks DIAMETER, and derives the kerf on the controller', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (G) => {
        const P = await import('/wizards/lathe/parting.js');
        const stack = P.partingStack({ ...G, peck: 2 });
        const a = stack.filter((b) => b.type === 'assign').map((b) => [b.params.var, String(b.params.value)]);
        const get = (v) => (a.find(([n]) => n === v) || [])[1];
        const V = P.PART_VARS;
        return {
            V,
            dBar: get(V.dBar), dFloor: get(V.dFloor), zFace: get(V.zFace), width: get(V.width),
            xBar: get(V.xBar), xFloor: get(V.xFloor), zCut: get(V.zCut),
            head: (stack.find((b) => b.type === 'comment') || { params: {} }).params.text,
            moves: stack.filter((b) => b.type === 'move').length,
            jumps: stack.filter((b) => b.type === 'ifgoto').length,
        };
    }, GROOVE);
    // the header speaks DIAMETER; every radius is the controller's arithmetic, in front of the operator
    expect(r.dBar, 'the bar goes in as a diameter').toBe('20');
    expect(r.dFloor, 'and so does the groove').toBe('12');
    expect(r.xFloor, 'the radius is derived from it — one typed number, one halving').toBe(`[${r.V.dFloor}/2]`);
    expect(r.xBar, 'and the bar radius likewise').toBe(`[${r.V.dBar}/2]`);
    // THE KERF OFFSET IS DERIVED TOO: change the blade at the machine and the blade position follows
    expect(r.zCut, 'the blade Z is the face less the kerf, worked out by the controller').toBe(`[${r.V.zFace}-${r.V.width}]`);
    expect(r.zFace, 'the FACE is what the operator typed').toBe('-10');
    expect(r.head, 'the header restates no size it cannot keep').not.toMatch(/[0-9]/);
    expect(r.moves, 'not unrolled — the pecks come from the loop').toBeLessThan(12);
    expect(r.jumps, 'and the loop is real').toBeGreaterThan(1);
});

test('THE SIM RUNS THE PARTING LOOP — the plunge reaches exactly the hand-derived radii, at the blade Z', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (G) => {
        const P = await import('/wizards/lathe/parting.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const run = (p) => {
            const nc = String(emitProgram(P.partingStack(p)));
            const segs = (traceToolpath(nc).segments || []).filter((s) => !s.rapid && !s.probe);
            return { nc, cuts: segs.map((s) => ({ x: Math.round(s.x2 * 1000) / 1000, z: Math.round(s.z2 * 1000) / 1000 })) };
        };
        return { pecked: run({ ...G, peck: 2 }), straight: run(G), part: run({ ...G, kind: 'part', peck: 0 }) };
    }, GROOVE);
    // PECKED: the blade reaches 8 then 6, both at Z−13, and never goes past the floor
    expect(r.pecked.cuts.map((c) => c.x), 'the executed loop reaches exactly the hand-derived radii').toEqual([8, 6]);
    r.pecked.cuts.forEach((c) => expect(c.z, 'every cut is at the blade Z — the face less the kerf').toBe(-13));
    expect(r.straight.cuts.map((c) => c.x), 'no peck → one plunge straight to the floor').toEqual([6]);
    // PART OFF runs to the centreline — the one case where reaching X0 is the point
    expect(r.part.cuts[r.part.cuts.length - 1].x, 'a part-off reaches the centreline').toBe(0);
    // THE DIAMETER LEAK: nothing plunges to 12 (the typed Ø) — that blade never touches a Ø20 bar
    expect(r.pecked.cuts.some((c) => c.x === 12), 'no cut goes to the DIAMETER').toBe(false);
});

// ── CENTRE DRILLING ─────────────────────────────────────────────────────────────────────────────────────────────

test('THE DRILL DEPTHS match hand-derived pecking — 15 deep at 5 a peck bottoms at −5, −10, −15', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (D) => {
        const C = await import('/wizards/lathe/centerDrill.js');
        return {
            base: C.drillDepths(D),
            straight: C.drillDepths({ ...D, kind: 'straight' }),
            uneven: C.drillDepths({ ...D, peck: 4 }),
            noPeck: C.drillDepths({ ...D, peck: 0 }),
        };
    }, DRILL);
    expect(r.base, 'the hand-derived case').toEqual([-5, -10, -15]);
    expect(r.straight, 'straight → one plunge to depth').toEqual([-15]);
    // an uneven peck never drills past depth — the last one lands exactly on size
    expect(r.uneven, 'the last peck is clamped to depth').toEqual([-4, -8, -12, -15]);
    expect(r.noPeck, 'a zero step is not "peck a little" — it is one plunge, which is a real answer').toEqual([-15]);
});

test('THE DRILL IS ON THE CENTRELINE — X0, the one lathe op with no radius', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (D) => {
        const C = await import('/wizards/lathe/centerDrill.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const nc = String(emitProgram(C.centerDrillStack(D)));
        const segs = (traceToolpath(nc).segments || []);
        const cuts = segs.filter((s) => !s.rapid && !s.probe);
        return {
            nc,
            bottoms: cuts.map((s) => Math.round(s.z2 * 1000) / 1000),
            xs: [...new Set(segs.map((s) => Math.round(s.x2 * 1000) / 1000))],
            head: nc.split(String.fromCharCode(10)).find((l) => /CENTRE DRILL/.test(l)) || '',
        };
    }, DRILL);
    // THE EXECUTED LOOP bottoms exactly where the hand-derivation says
    expect(r.bottoms, 'the peck loop resolves to the hand-derived bottoms').toEqual([-5, -10, -15]);
    // …and NOTHING ever leaves the centreline. An X here drills a circle instead of a hole.
    expect(r.xs, 'every move stays on centre — this op has no radius at all').toEqual([0]);
    expect(r.head, 'the header restates no size').not.toMatch(/[0-9]/);
});

test('THE PECK RETRACTS ALL THE WAY OUT — a chip-break twitch does not clear a lathe flute', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (D) => {
        const C = await import('/wizards/lathe/centerDrill.js');
        const V = C.CDRILL_VARS;
        const stack = C.centerDrillStack(D);
        const i = stack.findIndex((b) => b.type === 'move' && b.params.mode === 'cut' && b.params.z === V.zNow);
        return { after: stack.slice(i + 1, i + 3).map((b) => `${b.params.mode}:${b.params.z}`), safe: V.zSafe, now: V.zNow };
    }, DRILL);
    expect(r.after[0], 'the retract goes to the CLEAR height, not a nudge').toBe(`rapid:${r.safe}`);
    expect(r.after[1], 'and then returns to exactly where it left off').toBe(`rapid:${r.now}`);
});

// ── CITIZENSHIP: both ops inherit the pilot's mechanisms rather than re-inventing them ───────────────────────────

test('BOTH TWINS register in the Lathe group, IDENTITY-FIRST, bound by macro-var identity', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const P = await import('/blocks/dataOps/partingData.js');
        const C = await import('/blocks/dataOps/centerDrillData.js');
        const look = (mod, type) => {
            const def = uo.listUserOps().find((d) => d.opType === type);
            const specs = mod.PART_BINDING_SPECS || mod.CDRILL_BINDING_SPECS;
            const struct = mod.PART_STRUCT_BINDINGS || mod.CDRILL_STRUCT_BINDINGS;
            return {
                found: !!def, group: def && def.group, label: def && def.label, panel: def && def.panel,
                layout: def && def.layout && def.layout.kind,
                sections: [...new Set([...struct, ...specs].map((s) => s.section))],
                matchedBy: specs.map((s) => s.match.var || s.match.type),
                builds: Array.isArray(uo.instantiate(def, uo.defaultParams(def))),
            };
        };
        return { part: look(P, P.PART_DATA_OPTYPE), drill: look(C, C.CDRILL_DATA_OPTYPE) };
    });
    for (const [name, o] of Object.entries(r)) {
        expect(o.found, `${name} is a registered op`).toBe(true);
        expect(o.group, `${name} lives with the other lathe ops`).toBe('lathe');
        expect(o.panel, `${name} shows the 3D bar AND the profile beside the form`).toBe('form3d+2d');
        expect(o.layout, `${name} DECLARES the half-profile — the mill's XY layout means nothing to it`).toBe('lathe_profile');
        expect(o.sections, `${name} leads with the op-defining choice`).toEqual(['IDENTITY', 'GEOMETRY', 'TOOL & CUT']);
        expect(o.matchedBy.every((m) => /^#\d+$|^toolsel$/.test(m)), `${name} binds by identity, never by position`).toBe(true);
        expect(o.builds, `${name} instantiates into a real stack`).toBe(true);
    }
    expect(r.part.label).toMatch(/Part/);
    expect(r.drill.label).toMatch(/Centre Drill/);
});

test('THE GROOVE HANDLES move the EMIT — the face along Z, the floor corner in diameter', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (G) => {
        const V = await import('/viz/latheProfileCanvas.js');
        const P = await import('/wizards/lathe/parting.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const bar = { diameter: G.barDiameter, stickOut: 60, allowance: 1 };
        const part = { kind: 'groove', zFace: G.zFace, floorDiameter: G.targetDiameter, width: G.width };
        const read = () => {
            const nc = String(emitProgram(P.partingStack({ ...G, zFace: part.zFace, targetDiameter: part.floorDiameter, width: part.width })));
            const g = (v) => (nc.match(new RegExp('^' + v + '=([^ (]+)', 'm')) || [])[1];
            return { zFace: g(P.PART_VARS.zFace), dFloor: g(P.PART_VARS.dFloor),
                     floorR: P.partFloorRadius({ ...G, targetDiameter: part.floorDiameter }),
                     bladeZ: P.partBladeZ({ ...G, zFace: part.zFace, width: part.width }) };
        };
        const before = read();
        const spec = V.partProfileSpec(bar, part, (patch) => Object.assign(part, patch));
        const at = Object.fromEntries(spec.handles.map((h) => [h.id, { x: h.x, y: h.y }]));
        spec.onDrag(V.PART_POS_HANDLE_ID, { x: -22, y: 10 });        // slide the feature along the bar
        const afterPos = read();
        spec.onDrag(V.PART_FLOOR_HANDLE_ID, { x: -25, y: 3 });       // …and take it deeper
        const afterFloor = read();
        // a PART-OFF has no floor to drag: it stops at the centre, always
        const partOff = V.partProfileSpec(bar, { kind: 'part', zFace: -10, width: 3 }, () => {});
        return { at, before, afterPos, afterFloor, partHandles: partOff.handles.map((h) => h.id) };
    }, GROOVE);
    // the handles sit on what they name: the FACE at the typed Z on the bar surface, the FLOOR at the blade's far side
    expect(r.at.partPos, 'the face handle is on the face, at the bar surface').toEqual({ x: -10, y: 10 });
    expect(r.at.partFloor, 'and the floor handle is at the bottom of the kerf').toEqual({ x: -13, y: 6 });
    expect(r.before.zFace, 'before: the typed face').toBe('-10');
    expect(r.afterPos.zFace, 'the drag moved the FEATURE along the bar — the emit followed').toBe('-22');
    expect(r.afterPos.bladeZ, 'and the blade followed it, still a kerf behind').toBe(-25);
    expect(r.afterFloor.dFloor, 'the floor drag wrote a DIAMETER, in the units the field speaks').toBe('6');
    expect(r.afterFloor.floorR, 'which is a radius of 3 to the machine — never the diameter').toBe(3);
    // t1321 (user) — the BLADE WIDTH is a real control on a part-off too: the kerf is the blade, and where the far
    // wall sits is a size you set. What stays absent is the FLOOR handle — a part-off cuts to the centre, and a
    // handle that always reads zero is a fake control. That was and is the point of this line.
    expect(r.partHandles, 'position and the blade — but no floor, which would always read zero')
        .toEqual(['partPos', 'partWidth']);
});

test('THE DRILL DEPTH HANDLE moves the EMIT, and never leaves the centreline', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (D) => {
        const V = await import('/viz/latheProfileCanvas.js');
        const C = await import('/wizards/lathe/centerDrill.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const drill = { depth: D.depth };
        const read = () => {
            const nc = String(emitProgram(C.centerDrillStack({ ...D, depth: drill.depth })));
            return { depth: (nc.match(new RegExp('^' + C.CDRILL_VARS.depth + '=([^ (]+)', 'm')) || [])[1],
                     bottoms: C.drillDepths({ ...D, depth: drill.depth }) };
        };
        const before = read();
        const spec = V.drillProfileSpec({ diameter: D.barDiameter, stickOut: 60, allowance: 1 }, drill, (patch) => Object.assign(drill, patch));
        const h = spec.handles[0];
        spec.onDrag(V.DRILL_DEPTH_HANDLE_ID, { x: -25, y: 4 });      // deeper — and the Y is ignored on purpose
        const after = read();
        spec.onDrag(V.DRILL_DEPTH_HANDLE_ID, { x: 50, y: 0 });       // …dragged back past the face
        return { h: { x: h.x, y: h.y, id: h.id }, count: spec.handles.length, before, after, clamped: drill.depth };
    }, DRILL);
    expect(r.h.y, 'the handle sits ON the centreline — this op has no radius to grab').toBe(0);
    expect(r.h.x, 'and at the bottom of the hole').toBe(-15);
    expect(r.count, 'one handle, because there is exactly one number to drag').toBe(1);
    expect(r.before.depth, 'before').toBe('15');
    expect(r.after.depth, 'the drag wrote the depth — the emit followed').toBe('25');
    expect(r.after.bottoms, 'and the peck loop re-derived from it').toEqual([-5, -10, -15, -20, -25]);
    expect(r.clamped, 'a hole of zero depth is not a hole').toBeGreaterThan(0);
});

test('BOTH SURVIVE THE .wiz ROUND TRIP — export, WIPE, import, identical and byte-identical emit', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const wl = await import('/blocks/wizardLibrary.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const strip = (d) => { const c = { ...d }; delete c.importNote; delete c.hooksReattached; return c; };
        const trip = (t) => {
            const before = strip(JSON.parse(JSON.stringify(uo.listUserOps().find((d) => d.opType === t))));
            const emitBefore = String(emitProgram(uo.instantiate(before, uo.defaultParams(before))));
            const text = wl.exportWizard(t);
            uo.deleteUserOp(t);
            const gone = !uo.listUserOps().some((d) => d.opType === t);
            wl.importWizard(text);
            const after = strip(JSON.parse(JSON.stringify(uo.listUserOps().find((d) => d.opType === t))));
            const emitAfter = String(emitProgram(uo.instantiate(after, uo.defaultParams(after))));
            // …compared as OBJECTS, not as JSON text: stringify is key-ORDER sensitive, and an imported def's keys
            // arrive in file order rather than the seed's. That is not drift in the wizard, it is drift in how the
            // question was asked (t1285 — adding a declared field to the file surfaced it).
            return { gone, before, after, sameEmit: emitBefore === emitAfter };
        };
        return { part: trip('user_lathe_parting'), drill: trip('user_lathe_centerdrill') };
    });
    for (const [name, o] of Object.entries(r)) {
        expect(o.gone, `${name} really was wiped before the import`).toBe(true);
        expect(o.after, `${name} came back identical — a library citizen like any other`).toEqual(o.before);
        expect(o.sameEmit, `${name} emits byte-identically: the file carries the recipe`).toBe(true);
    }
});

test('GATING IS INHERITED — and the drill is the one op in the app that needs a single axis', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const G = await import('/ui/axisGating.js');
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ kind: 'lathe' }, false);
        return {
            part: G.OP_AXIS_NEEDS.lathe_parting, drill: G.OP_AXIS_NEEDS.lathe_centerdrill,
            partMissing: G.missingAxesFor('user_lathe_parting'), drillMissing: G.missingAxesFor('user_lathe_centerdrill'),
            pocket: G.missingAxesFor('pocket'),
        };
    });
    expect(r.part, 'parting plunges in X at a Z').toEqual(['X', 'Z']);
    expect(r.drill, 'the drill only ever moves in Z — declaring an X it does not use would be a lie the gating repeats')
        .toEqual(['Z']);
    expect(r.partMissing, 'a lathe runs both').toEqual([]);
    expect(r.drillMissing).toEqual([]);
    expect(r.pocket, 'while the Y-needing mill ops stay greyed around them').toEqual(['Y']);
});
