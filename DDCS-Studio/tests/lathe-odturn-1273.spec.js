import { test, expect } from '@playwright/test';

/**
 * t1273 — OD TURNING, the lathe family's FIRST INHERITOR. Every mechanism here was proven on the facing pilot; what
 * this spec checks is that OD *inherited* them rather than re-invented them, and that its own numbers are right.
 *
 * THE GROUND TRUTH IS HAND-DERIVED. A Ø20 bar turned down to Ø14, 1mm of radius per pass, leaving 0.5 for the
 * finish: roughing stops at radius 7.5 (the finished 7 plus the 0.5 allowance), and stepping out from there in 1mm
 * steps while still inside the 10mm bar radius gives 8.5 and 9.5. Cut outside-in, that is 9.5, 8.5, 7.5 — then the
 * finishing pass at 7.0. Every assertion below is anchored to that independently-known answer, never read back from
 * the code under test.
 *
 * THE DIAMETER LEAK is the failure this family exists to prevent: 14 written where 7 belongs is not a small error,
 * it is a tool that never touches the bar (or, at the start radius, one that starts inside it).
 */
test.use({ viewport: { width: 1280, height: 900 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
};

const CASE = { barDiameter: 20, targetDiameter: 14, depth: 25, doc: 1, finish: 0.5 };

test('THE RADII match hand-derived turning — Ø20 → Ø14, 1mm/pass, 0.5 left → 9.5, 8.5, 7.5 then finish 7', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (C) => {
        const O = await import('/wizards/lathe/odTurn.js');
        return {
            base: O.odPasses(C),
            noFinish: O.odPasses({ ...C, finish: 0 }),
            uneven: O.odPasses({ ...C, doc: 0.8 }),
            taper: O.odPasses({ ...C, kind: 'taper', endDiameter: 18 }),
            nothing: O.odPasses({ ...C, targetDiameter: 20 }),
        };
    }, CASE);
    expect(r.base.rough, 'the hand-derived roughing radii, outermost first').toEqual([9.5, 8.5, 7.5]);
    expect(r.base.finish, 'and the finishing pass at the finished radius — straight, so both ends agree').toEqual({ start: 7, end: 7 });
    expect(r.base.floor, 'roughing stops at the finished radius plus the allowance').toBe(7.5);
    // with nothing left for a finish pass the floor IS the target, and the last roughing pass lands on it
    expect(r.noFinish.rough, 'no allowance → roughing goes all the way to size').toEqual([9, 8, 7]);
    // THE LIGHT PASS FALLS FIRST — anchored on the floor, so every later pass is a full depth of cut
    expect(r.uneven.rough, 'an uneven depth of cut puts the light pass FIRST, through the skin').toEqual([9.9, 9.1, 8.3, 7.5]);
    expect(r.uneven.rough[r.uneven.rough.length - 1], 'and the last roughing pass still lands exactly on the floor').toBe(7.5);
    // A TAPER roughs to the SMALLER end — cutting to the big end's radius would gouge the tight end
    expect(r.taper.floor, 'the taper floor is the SMALLER finished radius plus the allowance').toBe(7.5);
    expect(r.taper.finish, 'and the finish pass runs from the face radius to the far-end radius').toEqual({ start: 7, end: 9 });
    // asking for the size the bar already is means there is nothing to rough — not one air pass
    expect(r.nothing.rough, 'nothing to remove → no roughing passes at all').toEqual([]);
});

test('THE EMIT is a PARAMETRIC macro — a #var header, a controller-side loop, and X in RADIUS', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (C) => {
        const O = await import('/wizards/lathe/odTurn.js');
        const stack = O.odTurnStack(C);
        const assigns = stack.filter((b) => b.type === 'assign').map((b) => [b.params.var, String(b.params.value)]);
        const get = (v) => (assigns.find(([n]) => n === v) || [])[1];
        return {
            vars: O.OD_VARS,
            assigns,
            get: { bar: get(O.OD_VARS.xBar), target: get(O.OD_VARS.xTarget), end: get(O.OD_VARS.xEnd),
                   floor: get(O.OD_VARS.xFloor), zEnd: get(O.OD_VARS.zEnd), clear: get(O.OD_VARS.xClear),
                   dBar: get(O.OD_VARS.dBar), dTarget: get(O.OD_VARS.dTarget), dEnd: get(O.OD_VARS.dEnd) },
            labels: stack.filter((b) => b.type === 'label').map((b) => b.params.n),
            jumps: stack.filter((b) => b.type === 'ifgoto').map((b) => `${b.params.lhs}${b.params.op}${b.params.rhs}->${b.params.goto}`),
            moves: stack.filter((b) => b.type === 'move').length,
        };
    }, CASE);
    // THE HEADER SPEAKS DIAMETER — the number a person types, in the units they say it in…
    expect(r.get.dBar, 'the bar goes in as a DIAMETER').toBe('20');
    expect(r.get.dTarget, 'and so does the target — this is the socket the Ø field binds to').toBe('14');
    // a straight turn does not COPY the target to the far end, it REFERENCES it — one number, one place to change it
    expect(r.get.dEnd, 'the far end IS the target on a straight turn, and the macro says so').toBe(r.vars.dTarget);
    // …and every RADIUS is DERIVED from it by the controller. A baked radius here would round-trip wrong: editing
    // the block would read 7 back into a field labelled Ø and the next emit would halve it again.
    expect(r.get.bar, 'the bar radius is derived, not baked').toBe(`[${r.vars.dBar}/2]`);
    expect(r.get.target, 'and so is the target radius — one typed number, one halving, in front of the operator').toBe(`[${r.vars.dTarget}/2]`);
    expect(r.get.end, 'and the far end').toBe(`[${r.vars.dEnd}/2]`);
    expect(r.get.clear, 'the retract radius follows the bar, so a new bar moves it').toBe(`[${r.vars.xBar}+${r.vars.clearance}]`);
    // THE FLOOR IS DERIVED ON THE CONTROLLER, so retuning the allowance at the machine moves it
    expect(r.get.floor, 'the roughing floor is target + allowance, computed by the controller — not a baked number')
        .toBe(`[${r.vars.xTarget}+${r.vars.finish}]`);
    expect(r.get.zEnd, 'and the cut end is derived from the depth, so one number drives it').toBe(`[0-${r.vars.depth}]`);
    // the loop is real, and one of the jumps goes BACKWARD
    expect(r.labels.length, 'the macro carries jump targets').toBeGreaterThanOrEqual(4);
    expect(r.jumps.some((j) => j.endsWith('->' + (r.labels[1]))), 'the pass COUNT loops back on itself').toBe(true);
    expect(r.jumps.some((j) => j.endsWith('->' + (r.labels[2]))), 'and so does the roughing loop').toBe(true);
    // a zero depth of cut would spin the counting loop forever — the macro defends itself
    expect(r.jumps.some((j) => j.startsWith(`${r.vars.doc}>0`)), 'a zero depth of cut is guarded, not trusted').toBe(true);
    // NOT UNROLLED: three roughing passes must not mean three copies of the cut moves
    expect(r.moves, 'the move count is fixed — the passes come from the loop, not from repetition').toBeLessThan(12);
});

test('THE SIM RUNS THE LOOP — the resolved trace cuts at exactly the hand-derived radii, over the declared depth', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (C) => {
        const O = await import('/wizards/lathe/odTurn.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const nc = String(emitProgram(O.odTurnStack(C)));
        const t = traceToolpath(nc);
        const segs = (t.segments || []).map((s) => ({
            x1: s.x1, z1: s.z1, x2: s.x2, z2: s.z2, cutting: !s.rapid && !s.probe,
        }));
        return { nc, segs };
    }, CASE);
    const r3 = (n) => Math.round(n * 1000) / 1000;
    // THE PASSES: a cut that runs ALONG the bar (Z changes) is a turning pass; its X is the radius it cut at.
    const along = r.segs.filter((s) => s.cutting && Math.abs(s.z2 - s.z1) > 0.5);
    const radii = along.map((s) => r3(s.x1));
    expect(radii, 'the loop resolves to exactly the hand-derived radii — roughing then the finish pass')
        .toEqual([9.5, 8.5, 7.5, 7]);
    // …and each one runs the DECLARED length, from the face to 25 deep
    for (const s of along) {
        expect(r3(s.z2), 'every pass cuts to the declared depth').toBe(-25);
        expect(s.z1, 'and starts at or ahead of the finished face').toBeGreaterThanOrEqual(-0.001);
    }
    // THE DIAMETER LEAK, made visible: nothing cuts at the typed diameter — 14 is outside a 10mm-radius bar, so a
    // leak would silently produce a program that never touches the part.
    expect(radii.includes(14), 'no pass cuts at the DIAMETER — that tool would swing in air').toBe(false);
    expect(Math.max(...radii), 'every cutting radius is inside the bar').toBeLessThan(10);
});

test('THE RETRACT COMES OFF THE PART FIRST — +X, then +Z (the turning convention)', async ({ page }) => {
    await boot(page);
    const order = await page.evaluate(async (C) => {
        const O = await import('/wizards/lathe/odTurn.js');
        const stack = O.odTurnStack(C);
        const V = O.OD_VARS;
        // the roughing loop: the cut along the bar, then what happens next
        const i = stack.findIndex((b) => b.type === 'move' && b.params.mode === 'cut' && b.params.z === V.zEnd);
        return stack.slice(i, i + 3).map((b) => `${b.params.mode}:${b.params.x || ''}/${b.params.z || ''}`);
    }, CASE);
    expect(order[1], 'the first retract is in X, clear of the surface just cut').toMatch(/rapid:#126\//);
    expect(order[2], 'only THEN does it come back in Z — the other order drags the tool along the part').toMatch(/rapid:\/#130/);
});

test('A TAPER is one interpolated finishing pass — not a second code path', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (C) => {
        const O = await import('/wizards/lathe/odTurn.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const p = { ...C, kind: 'taper', endDiameter: 18 };
        const nc = String(emitProgram(O.odTurnStack(p)));
        const segs = (traceToolpath(nc).segments || []).filter((s) => !s.rapid && !s.probe && Math.abs(s.z2 - s.z1) > 0.5);
        const straight = O.odTurnStack(C).filter((b) => b.type === 'move').length;
        return {
            nc,
            last: segs[segs.length - 1],
            taperMoves: O.odTurnStack(p).filter((b) => b.type === 'move').length,
            taperVars: O.odTurnStack(p).filter((b) => b.type === 'assign').length,
            straightVars: O.odTurnStack(C).filter((b) => b.type === 'assign').length,
            straightMoves: straight,
        };
    }, CASE);
    const r3 = (n) => Math.round(n * 1000) / 1000;
    // the finishing pass moves in X *and* Z: through 7 AT THE FACE, out to 9 at 25 deep. That IS the taper.
    // t1291 — it now begins AHEAD of the face, on the cone extrapolated back to the approach height, so that the
    // line passes through the face at exactly the target radius. Asserting its start POINT (as this once did) tested
    // the approach rather than the part: the cone it cut used to land 0.46 fat at the face because the line started
    // beside the cone instead of on it.
    const t = (0 - r.last.z1) / (r.last.z2 - r.last.z1);          // where along the move the FACE plane falls
    const atFace = r.last.x1 + (r.last.x2 - r.last.x1) * t;
    expect(r3(atFace), 'the finish pass passes through the target radius AT the face').toBeCloseTo(7, 2);
    expect(r3(r.last.x2), 'and ends at the far-end radius — X interpolated across the travel').toBe(9);
    expect(r3(r.last.z2), 'over the declared depth').toBe(-25);
    // …and it really does start ahead of the face, which is what makes the line land on the cone
    expect(r.last.z1, 'the approach is ahead of the face, in air').toBeGreaterThan(0);
    // A TAPER IS DIFFERENT NUMBERS, and t1291 adds the cone-following roughing it needs in order not to gouge the
    // part. The MOVE count is unchanged — one cut per pass either way; what the taper adds is the ARITHMETIC that
    // says how far that cut may run. (The straight arm is byte-identical, asserted separately.)
    expect(r.taperMoves, 'the same moves — a taper does not add passes').toBe(r.straightMoves);
    expect(r.taperVars, 'what it adds is the crossing it has to work out').toBeGreaterThan(r.straightVars);
});

test('THE TWIN registers in the Lathe group, IDENTITY-FIRST, with bindings derived BY IDENTITY', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const D = await import('/blocks/dataOps/odTurnData.js');
        const def = uo.listUserOps().find((d) => d.opType === D.OD_DATA_OPTYPE);
        const built = def ? uo.instantiate(def, uo.defaultParams(def)) : null;
        return {
            found: !!def, group: def && def.group, label: def && def.label, panel: def && def.panel,
            sections: [...new Set([...D.OD_STRUCT_BINDINGS, ...D.OD_BINDING_SPECS].map((s) => s.section))],
            first: [...D.OD_STRUCT_BINDINGS, ...D.OD_BINDING_SPECS][0].param,
            matchedBy: D.OD_BINDING_SPECS.map((s) => s.match.var || s.match.type),
            targets: def && def.bindings.filter((b) => b.blockIndex != null).map((b) => b.blockIndex),
            builds: Array.isArray(built) && built.length > 0,
        };
    });
    expect(r.found, 'OD turning is a registered op, not just a stack builder').toBe(true);
    expect(r.group, 'and it lives in the Lathe group, beside facing').toBe('lathe');
    expect(r.label).toMatch(/OD Turn/);
    expect(r.panel, 'the 3D bar AND the half-profile — the pilot layout, since t1281').toBe('form3d+2d');
    // IDENTITY FIRST, and unlike facing this op HAS one: straight or taper decides what the other fields mean
    expect(r.sections[0], 'the op-defining choice leads the form').toBe('IDENTITY');
    expect(r.first, 'and it is the kind of turn').toBe('kind');
    expect(r.sections, 'then the geometry, then the cutting numbers').toEqual(['IDENTITY', 'GEOMETRY', 'TOOL & CUT']);
    // matched by WHAT THE BLOCK IS — a #var or a block type — never by a position in the stack
    expect(r.matchedBy.every((m) => /^#\d+$|^toolsel$/.test(m)), 'every binding is matched by identity').toBe(true);
    expect(new Set(r.targets).size, 'and each resolved to its OWN block').toBe(r.targets.length);
    expect(r.builds, 'the def instantiates into a real stack').toBe(true);
});

test('A STRAIGHT turn REFERENCES the target for its far end — one source, not a copy that can drift', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const D = await import('/blocks/dataOps/odTurnData.js');
        const O = await import('/wizards/lathe/odTurn.js');
        const grab = (stack) => {
            let hit = null;
            const walk = (bs) => (bs || []).forEach((b) => {
                if (b.type === 'assign' && b.params && b.params.var === O.OD_VARS.dEnd) hit = String(b.params.value);
                if (b.children) walk(b.children);
                if (b.uiChildren) walk(b.uiChildren);
            });
            walk(stack);
            return hit;
        };
        const mk = (kind) => JSON.parse(JSON.stringify([{ type: 'user_root', params: {}, children: O.odTurnStack({ kind, endDiameter: 18 }) }]));
        return {
            straight: grab(D.applyStraightEnd(mk('straight'), { kind: 'straight' })),
            taper: grab(D.applyStraightEnd(mk('taper'), { kind: 'taper' })),
            targetVar: O.OD_VARS.dTarget,
        };
    });
    expect(r.straight, 'a straight turn writes the REFERENCE — change the target at the machine and it stays straight')
        .toBe(r.targetVar);
    expect(r.taper, 'a taper keeps its own typed far-end diameter').toBe('18');
});

test('THE SHOULDER CORNER is ONE handle with TWO outputs — and the drag moves the EMIT, not just the pixel', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (C) => {
        const V = await import('/viz/latheProfileCanvas.js');
        const O = await import('/wizards/lathe/odTurn.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const bar = { diameter: C.barDiameter, stickOut: 60, allowance: 1 };
        const od = { kind: 'straight', targetDiameter: C.targetDiameter, endDiameter: C.targetDiameter, depth: C.depth };
        const read = () => {
            const nc = String(emitProgram(O.odTurnStack({ ...C, ...od })));
            const g = (v) => (nc.match(new RegExp('^' + v + '=([^ (]+)', 'm')) || [])[1];
            return { dTarget: g(O.OD_VARS.dTarget), depth: g(O.OD_VARS.depth), passes: O.odPasses({ ...C, ...od }).rough };
        };
        const before = read();
        const spec = V.odProfileSpec(bar, od, (patch) => Object.assign(od, patch));
        const h = spec.handles.find((x) => x.id === V.SHOULDER_HANDLE_ID);
        // ONE DIAGONAL DRAG: in toward the centreline (a smaller diameter) and further along the bar (a longer turn)
        spec.onDrag(V.SHOULDER_HANDLE_ID, { x: -40, y: 4 });
        const after = read();
        // …and the clamps: a target at the bar diameter cuts air; a turn of zero length is not a turn
        spec.onDrag(V.SHOULDER_HANDLE_ID, { x: 999, y: 999 });
        return { handleAt: { x: h.x, y: h.y }, teal: !!h.teal, handles: spec.handles.length, before, after, clamped: { ...od } };
    }, CASE);
    // the handle SITS on the shoulder corner: 25 along the bar, at the finished radius
    expect(r.handleAt, 'the grab point is the corner itself — where the turned surface meets the bar').toEqual({ x: -25, y: 7 });
    expect(r.teal, 'teal: it drives the emit (the declared convention)').toBe(true);
    expect(r.handles, 'a straight turn has ONE corner to define').toBe(1);
    // THE PROOF: re-read the EMIT. Ø8 at the corner, 40 along the bar — both from one grab.
    expect(r.before.dTarget, 'before: the typed target').toBe('14');
    expect(r.after.dTarget, 'the drag wrote the DIAMETER — X of the corner, in the units the field speaks').toBe('8');
    expect(r.after.depth, 'and the LENGTH — Z of the corner — from the SAME grab').toBe('40');
    // the passes follow, because the passes are derived from those numbers and nothing else
    expect(r.before.passes, 'the roughing passes before').toEqual([9.5, 8.5, 7.5]);
    expect(r.after.passes, 'and after: more to remove, so more passes, still landing on the floor').toEqual([9.5, 8.5, 7.5, 6.5, 5.5, 4.5]);
    // CLAMPED INSIDE THE BAR: dragging out past the stock cannot ask for a pass that never touches metal
    expect(r.clamped.targetDiameter, 'the target stops just inside the bar').toBeLessThan(20);
    expect(r.clamped.depth, 'and a turn always has some length').toBeGreaterThan(0);
});

test('A TAPER adds the SECOND corner — each diameter on the corner it physically is', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (C) => {
        const V = await import('/viz/latheProfileCanvas.js');
        const bar = { diameter: C.barDiameter, stickOut: 60, allowance: 1 };
        const od = { kind: 'taper', targetDiameter: 14, endDiameter: 18, depth: 25 };
        const spec = V.odProfileSpec(bar, od, (patch) => Object.assign(od, patch));
        const ids = spec.handles.map((h) => h.id);
        const at = Object.fromEntries(spec.handles.map((h) => [h.id, { x: h.x, y: h.y }]));
        spec.onDrag(V.FACE_DIA_HANDLE_ID, { x: 0, y: 5 });      // the face corner: the target Ø only
        const afterFace = { ...od };
        spec.onDrag(V.SHOULDER_HANDLE_ID, { x: -30, y: 8 });    // the far corner: the far-end Ø AND the length
        return { ids, at, afterFace, afterShoulder: { ...od } };
    }, CASE);
    expect(r.ids, 'two corners, because a taper has two diameters').toEqual(['shoulder', 'faceDia']);
    // each handle sits at ITS OWN radius — the shoulder at the far end (9), the face corner at the target (7)
    expect(r.at.shoulder, 'the shoulder corner is the FAR end').toEqual({ x: -25, y: 9 });
    expect(r.at.faceDia, 'and the added corner is at the face').toEqual({ x: 0, y: 7 });
    expect(r.afterFace, 'the face corner writes the target Ø, and NOTHING else — it cannot change the length')
        .toEqual({ kind: 'taper', targetDiameter: 10, endDiameter: 18, depth: 25 });
    expect(r.afterShoulder.endDiameter, 'the far corner writes the FAR-end Ø').toBe(16);
    expect(r.afterShoulder.depth, 'and the length, from the same grab').toBe(30);
    expect(r.afterShoulder.targetDiameter, 'without touching the face diameter').toBe(10);
});

test('THE .wiz ROUND TRIP on the registered twin — export, WIPE, import, identical and byte-identical emit', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        const map = new Map();
        const fh = (n) => ({ kind: 'file', name: n, getFile: async () => new File([map.get(n)], n),
            createWritable: async () => ({ write: async (t) => map.set(n, t), close: async () => {} }), queryPermission: async () => 'granted' });
        window.showDirectoryPicker = async () => ({ kind: 'directory', name: 'Library',
            queryPermission: async () => 'granted', requestPermission: async () => 'granted',
            async *entries() { for (const n of [...map.keys()]) yield [n, fh(n)]; },
            getFileHandle: async (n, o) => { if (!map.has(n)) { if (!o || !o.create) throw new Error('nf'); map.set(n, ''); } return fh(n); },
            removeEntry: async (n) => { map.delete(n); } });
    });
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const wl = await import('/blocks/wizardLibrary.js');
        const lf = await import('/data/libraryFolder.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const D = await import('/blocks/dataOps/odTurnData.js');
        const t = D.OD_DATA_OPTYPE;
        const before = JSON.parse(JSON.stringify(uo.listUserOps().find((d) => d.opType === t)));
        const emitBefore = emitProgram(uo.instantiate(before, uo.defaultParams(before)));
        const w = await lf.writeLibraryFile('OD Turn', 'wiz', wl.exportWizard(t));
        uo.deleteUserOp(t);
        const gone = !uo.listUserOps().some((d) => d.opType === t);
        const entry = (await lf.listLibrary(['wiz'])).find((e) => e.name === w.name);
        wl.importWizard(entry.text);
        const after = JSON.parse(JSON.stringify(uo.listUserOps().find((d) => d.opType === t)));
        const emitAfter = emitProgram(uo.instantiate(after, uo.defaultParams(after)));
        // …the import REPORT (t1275) is not def data — it is what the import has to say about itself, so it is
        // compared separately rather than counted as drift in the wizard.
        const strip = (d) => { const c = { ...d }; delete c.importNote; delete c.hooksReattached; return c; };
        return { wrote: w.name, gone, before: strip(before), after: strip(after), same: String(emitBefore) === String(emitAfter) };
    });
    expect(r.wrote, 'ONE-NAME: the file is named after the wizard').toBe('OD Turn.wiz');
    expect(r.gone, 'the op really was wiped before the import').toBe(true);
    expect(r.after, 'the def came back IDENTICAL — the second lathe op is a library citizen too').toEqual(r.before);
    expect(r.same, 'and emits byte-identically: what travels is the RECIPE, not one set of numbers').toBe(true);
});

test('GATING IS INHERITED — OD turning needs X and Z, so no machine greys it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const G = await import('/ui/axisGating.js');
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ kind: 'lathe' }, false);
        const lathe = { od: G.missingAxesFor('user_lathe_odturn'), pocket: G.missingAxesFor('pocket') };
        M.setMachine({ kind: 'mill' }, false);
        const mill = { od: G.missingAxesFor('user_lathe_odturn') };
        return { needs: G.OP_AXIS_NEEDS.lathe_odturn, lathe, mill };
    });
    expect(r.needs, 'the requirement is DECLARED per op, not sniffed from one emit').toEqual(['X', 'Z']);
    expect(r.lathe.od, 'a lathe has exactly what it needs').toEqual([]);
    expect(r.lathe.pocket, 'while the Y-needing mill ops stay greyed around it').toEqual(['Y']);
    expect(r.mill.od, 'and a mill has X and Z too — gating asks what the machine CAN do, not what it IS').toEqual([]);
});

test('THE HEADER COMMENT RESTATES NO NUMBER — a comment is not a socket, so it cannot go stale', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (C) => {
        const O = await import('/wizards/lathe/odTurn.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const head = (p) => String(emitProgram(O.odTurnStack(p))).split(String.fromCharCode(10))
            .find((l) => /OD TURN/.test(l)) || '';
        return { base: head(C), moved: head({ ...C, targetDiameter: 4.7, depth: 38.86 }) };
    }, CASE);
    // dragging the shoulder changes the sizes; if the header restated them it would keep claiming the old ones —
    // the operator reads a header that contradicts the variables three lines down.
    expect(r.base, 'the header is the same sentence whatever the sizes are').toBe(r.moved);
    expect(r.base, 'and it carries no size of its own to go stale').not.toMatch(/\d/);
    expect(r.base, 'it says what the op is, and points at where the numbers live').toMatch(/#var/);
});

test('THE .wiz GATE RULED — a known op gets THIS APP’s behaviour back; a stranger is NAMED, never silently lost', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const wl = await import('/blocks/wizardLibrary.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const O = await import('/wizards/lathe/odTurn.js');
        const D = await import('/blocks/dataOps/odTurnData.js');
        const t = D.OD_DATA_OPTYPE;

        const text = wl.exportWizard(t);
        const manifest = JSON.parse(text).op.hooks || [];
        uo.deleteUserOp(t);                                  // WIPE the op — the app still KNOWS the type
        const back = wl.importWizard(text);
        // the ruled behaviour: switch to taper, then back to straight, and the far end must follow the target again
        // …through the BUILDER, which is the path the emit actually takes — instantiate() alone skips postInstantiate,
        // so calling it directly would have "proved" the hook while never running it.
        const { builderOf } = await import('/blocks/opBuilders.js');
        const build = builderOf(t);
        const farEnd = (params) => {
            const nc = String(emitProgram(build({ ...uo.defaultParams(back), ...params })));
            return (nc.match(new RegExp('^' + O.OD_VARS.dEnd + '=([^ (]+)', 'm')) || [])[1];
        };
        const taper = farEnd({ kind: 'taper', endDiameter: 18 });
        const straightAgain = farEnd({ kind: 'straight', endDiameter: 18 });

        // …and a STRANGER: the same file under an opType this build has never heard of
        const foreign = JSON.parse(text); foreign.op.opType = 'user_someone_elses_op';
        const alien = wl.importWizard(JSON.stringify(foreign));
        return { manifest, reattached: back.hooksReattached, note: back.importNote, taper, straightAgain,
                 alienNote: alien && alien.importNote, alienReattached: alien && alien.hooksReattached };
    });
    expect(r.manifest, 'the FILE names the code it cannot carry — that is what lets the import be honest').toContain('postInstantiate');
    expect(r.reattached, 'a known opType gets this app’s own behaviour back').toContain('postInstantiate');
    expect(r.taper, 'the imported op still tapers').toBe('18');
    expect(r.straightAgain, 'AND the taper→straight restore works — the behaviour really came back, not just the data')
        .toBe('#132');
    expect(r.note, 'and the import says where the behaviour came from').toMatch(/carries data, not code/i);
    // the stranger: nothing to re-attach, and the report NAMES what is missing rather than staying quiet
    expect(r.alienReattached, 'a foreign opType has no local behaviour to restore').toEqual([]);
    expect(r.alienNote, 'so the import names the loss').toMatch(/postInstantiate/);
    expect(r.alienNote, 'and says the op runs on its data alone').toMatch(/data alone/i);
});

// ── t1291 — THE TAPER'S ROUGHING FOLLOWS THE CONE ───────────────────────────────────────────────────────────────

/**
 * Every roughing pass used to run the FULL length at radii counted from the face floor. On a cone that removes the
 * cone: for a fat far end (Ø8 at the face, Ø16 deep) the whole length came out flat at the floor radius and the
 * finish pass then cut air — a gouged part on a real machine, not a sim artefact. And the inverted cone was
 * under-roughed the same way, leaving 4.5mm RADIAL for one finishing pass.
 *
 * The crossing where the finished surface reaches a given radius is a pure ratio, so the controller computes it with
 * no trig; which SIDE of it to cut is decided by which end is fat.
 */
// t1293 — THROUGH THE PATH THE UI ACTUALLY RESOLVES. These asserts used to call the stack builder directly, which is
// the copy the app does NOT run: the wizard emits through the TWIN, and the twin's template is a snapshot of the
// defaults. That is how a fix could pass its own tests and leave the shipped program gouging a cone. Everything here
// goes through builderOf now — the same resolution openWiz uses.
const carveTaper = (page, p) => page.evaluate(async (params) => {
    const uo = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const L = await import('/data/latheProfile.js');
    const S = await import('/viz/latheScene.js');
    const { emitProgram } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const def = uo.listUserOps().find((d) => d.opType === 'user_lathe_odturn');
    const nc = String(emitProgram(builderOf('user_lathe_odturn')({ ...uo.defaultParams(def), ...params })));
    const prof = L.profileFromBar(S.latheBarFrom(params, {}));
    for (const s of (traceToolpath(nc).segments || []).filter((x) => !x.rapid && !x.probe)) L.carveSegment(prof, s, 0);
    const at = (z) => +prof.rOut[Math.round((z - prof.z0) / prof.step)].toFixed(2);
    return { r: [at(-0.3), at(-12.5), at(-24.7)], nc };
}, p);

test('A FAT FAR END is roughed to the cone, not through it', async ({ page }) => {
    await boot(page);
    const r = await carveTaper(page, { kind: 'taper', barDiameter: 20, targetDiameter: 8, endDiameter: 16, depth: 25, doc: 1, finish: 0.5 });
    // the cone runs r 4 → 8 over 25mm; these three points are where a full-length roughing pass showed 4.5 flat
    expect(r.r[0], 'just inside the face the finished radius is the target').toBeCloseTo(4, 1);
    expect(r.r[1], 'halfway along it is halfway between the two').toBeCloseTo(6, 1);
    expect(r.r[2], 'and at the far end it is the far-end radius').toBeCloseTo(8, 1);
});

test('A FAT FACE is the same rule mirrored — the cut comes in at the crossing and runs deep', async ({ page }) => {
    await boot(page);
    const r = await carveTaper(page, { kind: 'taper', barDiameter: 20, targetDiameter: 16, endDiameter: 8, depth: 25, doc: 1, finish: 0.5 });
    expect(r.r[0], 'the face keeps its own (larger) radius').toBeCloseTo(8, 1);
    expect(r.r[1], 'the middle is the middle either way').toBeCloseTo(6, 1);
    expect(r.r[2], 'and the far end is the thin one').toBeCloseTo(4, 1);
});

test('A STRAIGHT TURN IS UNTOUCHED — the taper is numbers, not a second program', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const O = await import('/wizards/lathe/odTurn.js');
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const def = uo.listUserOps().find((d) => d.opType === 'user_lathe_odturn');
        const nc = String(emitProgram(builderOf('user_lathe_odturn')({ ...uo.defaultParams(def), targetDiameter: 14, depth: 25, doc: 1, finish: 0.5 })));
        return { nc, V: O.OD_VARS,
                 lines: nc.split(String.fromCharCode(10)).filter((l) => l.trim()).length,
                 cuts: (nc.match(/^G1 /gm) || []).length };
    });
    // none of the taper machinery appears in a straight program: no crossing, no extrapolated start, no extra labels
    expect(r.nc.includes(r.V.zCross), 'no crossing variable').toBe(false);
    expect(r.nc.includes(r.V.xStartFin), 'no extrapolated finish start').toBe(false);
    expect(r.nc, 'and no extra jump targets').not.toMatch(/N6[45]\b/);
    // …and the shape the earlier turns pinned is exactly as it was: one cut per roughing pass plus the finish
    expect(r.cuts, 'the same cutting moves as before').toBe(2);
});

test('FACING WITH NO DEPTH PER PASS TAKES ONE SKIM — the comment and the emit finally agree', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const F = await import('/wizards/lathe/facing.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const run = (doc) => {
            const nc = String(emitProgram(F.facingStack({ barDiameter: 20, allowance: 3, doc })));
            const cuts = (traceToolpath(nc).segments || []).filter((s) => !s.rapid && !s.probe);
            return { n: cuts.length, zs: [...new Set(cuts.map((c) => Math.round(c.z2 * 100) / 100))], nc };
        };
        return { zero: run(0), one: run(1), passes: F.facingPasses({ allowance: 3, doc: 0 }) };
    });
    // it USED TO EMIT NOTHING: a program with 3mm of material and a zero step silently cut air
    expect(r.zero.n, 'one skim, not silence').toBe(1);
    expect(r.zero.zs, 'and it lands on the face, which is what the macro says it does').toEqual([0]);
    expect(r.zero.nc, 'the emitted comment says the same thing the emit now does').toMatch(/one skim at the face/i);
    expect(r.passes, 'and the pass list agrees with both').toEqual([0]);
    // …the ordinary case is untouched
    expect(r.one.zs, 'a real depth of cut still steps down to the face').toEqual([2, 1, 0]);
});

test('ONE EMIT SOURCE — the twin and the stack builder cannot disagree, because the twin IS the stack builder', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const O = await import('/wizards/lathe/odTurn.js');
        const def = uo.listUserOps().find((d) => d.opType === 'user_lathe_odturn');
        const build = builderOf('user_lathe_odturn');
        const cases = [
            { kind: 'straight', targetDiameter: 14, depth: 25, doc: 1, finish: 0.5 },
            { kind: 'taper', targetDiameter: 8, endDiameter: 16, depth: 25, doc: 1, finish: 0.5 },
            { kind: 'taper', targetDiameter: 16, endDiameter: 8, depth: 30, doc: 1.5, finish: 0.25 },
        ];
        return cases.map((c) => {
            const viaTwin = String(emitProgram(build({ ...uo.defaultParams(def), ...c })));
            const viaStack = String(emitProgram(O.odTurnStack({ ...O.OD_DEFAULTS, ...c })));
            // the twin wraps the macro, so compare the MACRO LINES both produce — the cutting program itself
            const macro = (nc) => nc.split(String.fromCharCode(10)).filter((l) => /^(G0|G1|#1[23]|IF|N6|GOTO)/.test(l.trim())).join('|');
            return { kind: c.kind, same: macro(viaTwin) === macro(viaStack) };
        });
    });
    // THE DEFECT THIS GUARDS: a build-time branch in the stack builder never reached the twin's snapshot, so the
    // wizard shipped the pre-fix program while the stack builder's own tests passed. If these two ever differ again,
    // one of them is a copy nobody is running.
    for (const c of r) expect(c.same, `${c.kind}: the twin emits what the builder emits`).toBe(true);
});
