import { test, expect } from '@playwright/test';

// Universal CAM U1 — the DECLARE classifier. exposable = (atom role === 'value') AND (not under a coordinate-transforming
// fold). The role is DECLARED data (atomRoles.js, the author's val()/num() choice made explicit); the fold-blocking is read
// from the op STACK STRUCTURE (exposeClassifier.js). NOTHING re-reads the emit output at runtime — the emit-probe below is a
// dev-time GUARD, not the runtime oracle.

test('U1 classifier: feed/coord/Z expose; a num()-consumed drill feed + an under-stepdown + an under-rotate X bake-only', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { userOpFromStack } = await import('/blocks/userOps.js');
        const { classifyExposable } = await import('/data/exposeClassifier.js');
        const mk = (opType, stack, bindings) => classifyExposable(userOpFromStack(opType, opType, stack, bindings));

        // (a) FLAT — a Feed atom + a Move cut, no fold. flatten: user_root(0), feed(1), move(2).
        const flat = mk('u1_flat', [{ type: 'user_root', params: {}, children: [
            { type: 'feed', params: { rate: 200 } },
            { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 500 } },
        ] }], [
            { param: 'frate', blockIndex: 1, key: 'rate' },
            { param: 'mx', blockIndex: 2, key: 'x' },
            { param: 'mz', blockIndex: 2, key: 'z' },
            { param: 'mfeed', blockIndex: 2, key: 'feed' },
        ]);

        // (b) DRILL — every key runs num() (a JS peck loop) → all bake-only. flatten: user_root(0), drill(1).
        const drill = mk('u1_drill', [{ type: 'user_root', params: {}, children: [
            { type: 'drill', params: { x: 0, y: 0, depth: 5, peck: 5, feed: 100 } },
        ] }], [
            { param: 'dfeed', blockIndex: 1, key: 'feed' },
            { param: 'dx', blockIndex: 1, key: 'x' },
        ]);

        // (c) UNDER STEPDOWN — a value Move sits under a depth fold; its coords are re-emitted per level, a #var can't ride.
        //     flatten: user_root(0), stepdown(1), move(2). sto = the fold's OWN driver (geometry); smx/smfeed = value-but-blocked.
        const step = mk('u1_step', [{ type: 'user_root', params: {}, children: [
            { type: 'stepdown', params: { to: 5, by: 1 }, children: [
                { type: 'move', params: { mode: 'cut', x: 10, z: -1, feed: 500 } },
            ] },
        ] }], [
            { param: 'sto', blockIndex: 1, key: 'to' },
            { param: 'smx', blockIndex: 2, key: 'x' },
            { param: 'smfeed', blockIndex: 2, key: 'feed' },
        ]);

        // (d) UNDER ROTATE — the same Move.x, this time beneath a rotate fold. rotateProgram's numeric regex drops on X#n.
        //     flatten: user_root(0), rotate(1), move(2).
        const rot = mk('u1_rot', [{ type: 'user_root', params: {}, children: [
            { type: 'rotate', params: { angle: 45, pivotX: 0, pivotY: 0 }, children: [
                { type: 'move', params: { mode: 'cut', x: 10, y: 5, feed: 300 } },
            ] },
        ] }], [
            { param: 'rmx', blockIndex: 2, key: 'x' },
        ]);

        // (e) SAFETY fail-closed — a guarded/bindingSpecs def has frozen blockIndex over a PRUNED stack (not def.template),
        //     so the classifier can't trust the index → it must expose NOTHING rather than risk a mis-aligned false-negative.
        const guarded = classifyExposable({ ...userOpFromStack('u1_guard', 'u1_guard', [{ type: 'user_root', params: {}, children: [
            { type: 'move', params: { mode: 'cut', x: 10, feed: 500 } },
        ] }], [
            { param: 'gx', blockIndex: 1, key: 'x' },
            { param: 'gfeed', blockIndex: 1, key: 'feed' },
        ]), bindingSpecs: [{}] });

        return { flat, drill, step, rot, guarded };
    });

    // (a) feed rate + coordinate X + plunge Z + cut feed — all role='value', no fold → EXPOSABLE
    expect(r.flat.frate).toMatchObject({ exposable: true, role: 'value' });
    expect(r.flat.mx).toMatchObject({ exposable: true, role: 'value' });
    expect(r.flat.mz).toMatchObject({ exposable: true, role: 'value' });
    expect(r.flat.mfeed).toMatchObject({ exposable: true, role: 'value' });

    // (b) a drill feed is num()-consumed (geometry) → BAKE-ONLY, even though it emits an F word
    expect(r.drill.dfeed).toMatchObject({ exposable: false, role: 'geometry' });
    expect(r.drill.dx).toMatchObject({ exposable: false, role: 'geometry' });

    // (c) the stepdown's OWN driver is geometry; a VALUE move under it is fold-blocked (role stays 'value', exposable false)
    expect(r.step.sto).toMatchObject({ exposable: false });
    expect(r.step.smx, 'value coord under a depth fold → bake-only').toMatchObject({ exposable: false, role: 'value' });
    expect(r.step.smx.reason).toContain('fold');
    expect(r.step.smfeed).toMatchObject({ exposable: false, role: 'value' });

    // (d) a value X under a rotate fold → bake-only (the transform would silently drop the #var)
    expect(r.rot.rmx, 'value X under a rotate fold → bake-only').toMatchObject({ exposable: false, role: 'value' });
    expect(r.rot.rmx.reason).toContain('fold');

    // (e) fail-closed — every binding of a guarded/bindingSpecs def is bake-only (even move.x/feed that would expose flat)
    expect(r.guarded.gx, 'guarded def exposes nothing').toMatchObject({ exposable: false });
    expect(r.guarded.gfeed).toMatchObject({ exposable: false });
    expect(r.guarded.gx.reason).toContain('bindingSpecs');
});

test('U1 emit-probe (dev-time guard): each declared role matches the real emit — value rides a #var through, geometry coerces it away', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const { paramRole } = await import('/data/atomRoles.js');

        const TOKEN = '#7777';   // a distinctive #var — never a default → its presence in the emit is unambiguous
        // Emit ONE atom (via the real emit path — dialect resolved inside emitMapped) with TOKEN injected at `key`.
        const emitKey = (type, key) => {
            const params = { ...(BLOCKS[type].defaults || {}), [key]: TOKEN };
            const stack = [{ type: 'user_root', params: {}, children: [{ type, params }] }];
            return emitMapped(stack, activeDialectOpts()).text;
        };

        // (type, key, expected role) — a spread across val() atoms and the num()-loop kernels.
        const PROBE = [
            ['move', 'x', 'value'], ['move', 'feed', 'value'], ['move', 'z', 'value'],
            ['feed', 'rate', 'value'],
            ['arc', 'x', 'value'], ['arc', 'i', 'value'],
            ['spindle', 'rpm', 'value'],
            ['probe', 'to', 'value'], ['probe', 'level', 'geometry'],
            ['drill', 'x', 'geometry'], ['drill', 'feed', 'geometry'], ['drill', 'depth', 'geometry'],
            ['bore', 'holeDia', 'geometry'], ['bore', 'feed', 'geometry'],
            ['line', 'x0', 'geometry'], ['line', 'feed', 'geometry'],
            ['dwell', 'sec', 'geometry'],
        ];
        return PROBE.map(([type, key, role]) => ({
            type, key, role,
            declared: paramRole(type, key),           // the DECLARED role (atomRoles.js)
            rode: emitKey(type, key).includes(TOKEN), // did the #var actually survive the emit?
        }));
    });

    for (const p of r) {
        // 1) the declared role matches our expectation (the table is what we think it is)
        expect(p.declared, `${p.type}.${p.key} declared role`).toBe(p.role);
        // 2) THE GUARD: emit behavior matches the declaration — value ⇒ the #var rode through; geometry ⇒ it was coerced away
        if (p.role === 'value') expect(p.rode, `${p.type}.${p.key} (value) must ride the #var into the emit`).toBe(true);
        else expect(p.rode, `${p.type}.${p.key} (geometry) must NOT leak the #var into the emit`).toBe(false);
    }
});
