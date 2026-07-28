import { test, expect } from '@playwright/test';

/**
 * t1271 — THE FACING PILOT'S REMAINING MECHANISMS: the twin, the library round trip, and axis gating.
 *
 * The pilot is gated on purpose: OD / parting / drilling inherit whatever is proven here, so each mechanism is
 * asserted on its own terms rather than "the wizard opens". The emit itself was proven in t1269 against hand-derived
 * passes; this file is about CITIZENSHIP — is facing a real op, does it survive being shared, and does the app tell
 * the truth about what this machine can run.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsSetMachine, null, { timeout: 15000 });
};

test('(2b) THE TWIN registers as a real op, in the Lathe group, with bindings derived BY IDENTITY', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const F = await import('/blocks/dataOps/facingData.js');
        const def = uo.listUserOps().find((d) => d.opType === F.FACING_DATA_OPTYPE);
        const built = def ? uo.instantiate(def, uo.defaultParams(def)) : null;
        return {
            found: !!def, group: def && def.group, label: def && def.label, panel: def && def.panel,
            params: def && def.bindings.map((b) => b.param),
            specs: F.FACING_BINDING_SPECS.map((s) => [s.param, s.match.var]),
            // the derived bindings must point at the CONFIG HEADER assigns, which is what makes the form and the
            // operator's on-machine edit the same numbers
            targets: def && def.bindings.map((b) => b.blockIndex),
            builds: Array.isArray(built) && built.length > 0,
        };
    });
    expect(r.found, 'facing is a registered op, not just a stack builder').toBe(true);
    expect(r.group, 'and it lives in the Lathe group').toBe('lathe');
    expect(r.label).toMatch(/Facing/);
    // t1281 — form3d+2d: the 3D BAR and the half-profile. It was form2d, and that is why a lathe wizard had no 3D
    // pane at all — the op could not show its bar because it never declared anywhere to draw one.
    expect(r.panel, 'the 3D bar AND the half-profile').toBe('form3d+2d');
    expect(r.params, 'the four numbers a turner actually sets').toEqual(['allowance', 'doc', 'xStart', 'feed']);
    // EVERY spec matched by WHAT THE BLOCK IS (its #var), never by an index — an index drifts when a line is added
    expect(r.specs.every(([, v]) => /^#\d+$/.test(v)), 'each binding is matched by its variable identity').toBe(true);
    expect(new Set(r.targets).size, 'and each resolved to its OWN block').toBe(r.targets.length);
    expect(r.builds, 'the def instantiates into a real stack').toBe(true);
});

test('(2b) THE FORM IS IDENTITY-FIRST — and facing’s honest identity is empty, so it does not invent one', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const F = await import('/blocks/dataOps/facingData.js');
        const sections = [...new Set(F.FACING_BINDING_SPECS.map((s) => s.section))];
        return { sections, first: F.FACING_BINDING_SPECS[0] };
    });
    // A facing pass has no corner, no direction, no order to choose. Rather than inventing a toggle to fill an
    // IDENTITY section, the form leads with what the turner actually decides: how much to remove.
    expect(r.sections, 'geometry then tool/cut — no invented identity section').toEqual(['GEOMETRY', 'TOOL & CUT']);
    expect(r.first.param, 'the first thing asked is what to remove').toBe('allowance');
});

test('(5) THE .wiz ROUND TRIP on the registered twin — export, WIPE, import, identical and byte-identical emit', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        const map = new Map();
        const fh = (n) => ({ kind: 'file', name: n, getFile: async () => new File([map.get(n)], n),
            createWritable: async () => ({ write: async (t) => map.set(n, t), close: async () => {} }), queryPermission: async () => 'granted' });
        window.__lib = map;
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
        const F = await import('/blocks/dataOps/facingData.js');
        const t = F.FACING_DATA_OPTYPE;

        const before = JSON.parse(JSON.stringify(uo.listUserOps().find((d) => d.opType === t)));
        const emitBefore = emitProgram(uo.instantiate(before, uo.defaultParams(before)));
        const w = await lf.writeLibraryFile('Facing', 'wiz', wl.exportWizard(t));

        uo.deleteUserOp(t);                                   // WIPE — the op is gone
        const gone = !uo.listUserOps().some((d) => d.opType === t);

        const entry = (await lf.listLibrary(['wiz'])).find((e) => e.name === w.name);
        wl.importWizard(entry.text);                          // …and back from the file
        const after = JSON.parse(JSON.stringify(uo.listUserOps().find((d) => d.opType === t)));
        const emitAfter = emitProgram(uo.instantiate(after, uo.defaultParams(after)));
        return { wrote: w.name, gone, before, after, same: String(emitBefore) === String(emitAfter) };
    });
    expect(r.wrote, 'ONE-NAME: the file is named after the wizard').toBe('Facing.wiz');
    expect(r.gone, 'the op really was wiped before the import').toBe(true);
    expect(r.after, 'the def came back IDENTICAL — a lathe op is a library citizen like any other').toEqual(r.before);
    expect(r.same, 'and it emits byte-identically: the shared file carries the RECIPE, not a snapshot').toBe(true);
});

test('(4) AXIS GATING — a lathe workspace greys the Y-needing mill ops, and says why', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const G = await import('/ui/axisGating.js');
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ kind: 'lathe' }, false);
        const lathe = {
            axes: [...G.declaredAxes()],
            pocket: G.missingAxesFor('pocket'),
            facing: G.missingAxesFor('user_lathe_facing'),
            why: G.axisWhy(G.missingAxesFor('pocket')),
            unknown: G.missingAxesFor('some_future_op'),
        };
        M.setMachine({ kind: 'mill' }, false);
        const mill = { axes: [...G.declaredAxes()], pocket: G.missingAxesFor('pocket'), facing: G.missingAxesFor('user_lathe_facing') };
        return { lathe, mill };
    });
    expect(r.lathe.axes, 'a lathe is X + Z: cross-slide and carriage').toEqual(['X', 'Z']);
    expect(r.lathe.pocket, 'pocketing needs the Y this machine does not have').toEqual(['Y']);
    expect(r.lathe.why, 'and the tooltip NAMES the axis and why we believe it is absent').toMatch(/needs a Y axis.*lathe workspace/i);
    expect(r.lathe.facing, 'the lathe ops stay live — they need exactly what a lathe has').toEqual([]);
    expect(r.lathe.unknown, 'an op with no declared need is never gated on a guess').toEqual([]);
    expect(r.mill.axes, 'a mill declares all three').toEqual(['X', 'Y', 'Z']);
    expect(r.mill.pocket, 'and pocketing is fine there').toEqual([]);
});

test('(4) THE GATING IS APPLIED AND REVERSIBLE — greyed, never hidden, and it comes back', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const G = await import('/ui/axisGating.js');
        const M = await import('/data/workspaceMachine.js');
        // two entries as the bar renders them
        const host = document.createElement('div');
        host.innerHTML = '<button data-optype="pocket" title="Pocket">Pocket</button>'
                       + '<button data-optype="user_lathe_facing" title="Facing">Facing</button>';
        document.body.appendChild(host);

        M.setMachine({ kind: 'lathe' }, false);
        G.applyAxisGating(host);
        const pocket = host.querySelector('[data-optype="pocket"]');
        const facing = host.querySelector('[data-optype="user_lathe_facing"]');
        const gated = {
            pocketGated: pocket.classList.contains('axis-gated'),
            pocketVisible: getComputedStyle(pocket).display !== 'none',   // GREY, not hidden
            pocketTitle: pocket.title,
            facingGated: facing.classList.contains('axis-gated'),
        };
        M.setMachine({ kind: 'mill' }, false);
        G.applyAxisGating(host);
        const restored = { pocketGated: pocket.classList.contains('axis-gated'), pocketTitle: pocket.title };
        host.remove();
        return { gated, restored };
    });
    expect(r.gated.pocketGated, 'the impossible op is greyed').toBe(true);
    expect(r.gated.pocketVisible, 'and STILL THERE — hiding would answer a question nobody asked').toBe(true);
    expect(r.gated.pocketTitle, 'the tooltip is the whole explanation').toMatch(/needs a Y axis/);
    expect(r.gated.facingGated, 'the lathe op is not greyed').toBe(false);
    expect(r.restored.pocketGated, 'switching back to a mill un-greys it').toBe(false);
    expect(r.restored.pocketTitle, 'and its own tooltip returns').toBe('Pocket');
});

test('(3) THE HALF-PROFILE CANVAS draws the MODEL — bar, centreline, datum, allowance', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const C = await import('/viz/latheProfileCanvas.js');
        const L = await import('/data/lathe.js');
        const bar = { diameter: 20, stickOut: 50, allowance: 3 };
        const spec = C.latheProfileSpec(bar, () => {});
        const prof = L.halfProfile(bar);
        // WHAT THE CANVAS CAN ACTUALLY DRAW. A first version of this spec invented `poly` and `band` item kinds;
        // FeatureCanvas renders circle/line/rect/hole and silently ignores anything else, so the pane came up EMPTY
        // the first time it was wired into a real wizard (t1273). The drawable set is asserted, not assumed.
        const DRAWABLE = ['circle', 'line', 'rect', 'hole'];
        return {
            kinds: spec.items.map((i) => i.kind),
            undrawable: spec.items.map((i) => i.kind).filter((k) => !DRAWABLE.includes(k)),
            profOutlineX: prof.outline.map((p) => p.x),
            datumX: spec.items.filter((i) => i.kind === 'line').map((i) => i.x1),
            band: spec.items.find((i) => i.kind === 'rect'),
            handle: spec.handles[0],
            stock: spec.stock,
            inverse: [C.canvasToZ(C.zToCanvas(-7.5)), C.canvasToZ(C.zToCanvas(3))],
        };
    });
    expect(r.undrawable, 'every drawn item is a kind FeatureCanvas actually renders — an invented kind is invisible').toEqual([]);
    expect(r.kinds, 'the centreline, the allowance, the datum').toEqual(['line', 'rect', 'line']);
    // THE BAR IS THE FRAME, and its height is a RADIUS — a diameter would draw the bar twice as tall
    expect(r.stock.h, 'the drawn bar is half its diameter high, because the picture is a HALF-profile').toBe(10);
    expect(Math.max(...r.profOutlineX), 'and that is exactly the outline radius the MODEL states').toBe(10);
    expect(r.stock.ox, 'the frame starts at the chuck end').toBe(-50);
    expect(r.stock.w, 'and runs to the raw face').toBe(53);
    expect(r.datumX[1], 'Z0 is where the finished face will be').toBe(0);
    expect(r.band.x, 'the allowance starts at the datum').toBe(0);
    expect(r.band.w, 'and is as wide as the material to remove').toBe(3);
    expect(r.band.h, 'and as tall as the bar RADIUS').toBe(10);
    expect(r.handle.id).toBe('faceLine');
    expect(r.handle.teal, 'TEAL: this handle drives the emit').toBe(true);
    expect(r.handle.x, 'and it sits on the raw end — what moves when you remove more or less').toBe(3);
    expect(r.inverse, 'the frame mapping is invertible, asserted not assumed').toEqual([-7.5, 3]);
});

test('(3) DRAGGING THE FACE LINE MOVES THE EMIT — the value, not just the pixel', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const C = await import('/viz/latheProfileCanvas.js');
        const F = await import('/wizards/lathe/facing.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const readAllowance = (nc) => (String(nc).match(/#111=([\d.]+)/) || [])[1];

        let allowance = 3;
        const before = emitProgram(F.facingStack({ barDiameter: 20, allowance, doc: 1 }));
        const spec = C.latheProfileSpec({ diameter: 20, stickOut: 50, allowance }, (a) => { allowance = a; });

        // THE DRAG: pull the face line out to Z 4.5 — "remove more"
        spec.onDrag('faceLine', { x: 4.5, y: 10 });
        const afterOut = emitProgram(F.facingStack({ barDiameter: 20, allowance, doc: 1 }));
        const movedOut = allowance;

        // …and push it PAST the finished face: that is not a smaller cut, it is cutting into the part
        spec.onDrag('faceLine', { x: -2, y: 10 });
        const clamped = allowance;

        // a drag on a DIFFERENT handle id must not touch the allowance
        allowance = 3;
        spec.onDrag('somethingElse', { x: 99, y: 0 });
        const untouched = allowance;

        return {
            beforeVar: readAllowance(before), afterVar: readAllowance(afterOut),
            movedOut, clamped, untouched,
            passesBefore: F.facingPasses({ allowance: 3, doc: 1 }),
            passesAfter: F.facingPasses({ allowance: movedOut, doc: 1 }),
        };
    });
    expect(r.movedOut, 'the drag wrote the allowance parameter').toBe(4.5);
    expect(r.beforeVar, 'the macro header before').toBe('3');
    expect(r.afterVar, 'THE EMIT FOLLOWED — the #var header carries the dragged value').toBe('4.5');
    // …and the program really is different work, not just a different number
    expect(r.passesBefore, 'three passes before').toEqual([2, 1, 0]);
    // t1275 — five after, now floor-anchored like OD: the 0.5 remainder is taken by the FIRST cut (4.5 → 4), through
    // the sawn end, and every later pass is a full 1mm. The drag still changed what the machine will do.
    expect(r.passesAfter, 'five after — the drag changed what the machine will do').toEqual([4, 3, 2, 1, 0]);
    expect(r.clamped, 'dragging past Z0 stops AT the finished face — it never cuts into the part').toBe(0);
    expect(r.untouched, 'and another handle does not write this parameter').toBe(3);
});

test('(2b) THE LATHE GROUP LEADS in a lathe workspace, and merely follows in a mill one', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const W = await import('/blocks/wizardLibrary.js');
        const M = await import('/data/workspaceMachine.js');
        const ids = () => W.getLibrary({ includeHidden: true }).groups.map((g) => g.id);
        M.setMachine({ kind: 'lathe' }, false);
        const lathe = ids();
        M.setMachine({ kind: 'mill' }, false);
        const mill = ids();
        const label = W.getLibrary({ includeHidden: true }).groups.find((g) => g.id === 'lathe');
        return { lathe, mill, label: label && label.label };
    });
    expect(r.lathe[0], 'a lathe workspace leads with Lathe — the first dropdown is where a person looks first').toBe('lathe');
    expect(r.mill.indexOf('lathe'), 'a mill workspace still HAS it, just not first — present, not hidden').toBeGreaterThan(0);
    expect(r.mill[0], 'and the mill bar opens as it always did').not.toBe('lathe');
    expect(r.label, 'the group is titled properly, not left as its id').toBe('Lathe');
});
