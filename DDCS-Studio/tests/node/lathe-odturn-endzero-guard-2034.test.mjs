import { test, expect } from './support/harness.mjs';
import { odTurnDataDef } from '../../web/blocks/dataOps/odTurnData.js';
import { odProfileSpec } from '../../web/viz/latheProfileCanvas.js';
import { odPasses, OD_DEFAULTS } from '../../web/wizards/lathe/odTurn.js';
import { registerUserOp } from '../../web/blocks/userOps.js';
import { builderOf } from '../../web/blocks/opBuilders.js';
import { emitMapped } from '../../web/blocks/blockEmitter.js';
import { activeDialectOpts } from '../../web/wizards/previewEmit.js';

/**
 * t2034 — SETTLING Tier-2 #1 (`lathe_odturn`'s finished-shape formula, t2032's own ranking): is the missing
 * internal guard in `odPasses`/`odPassExtent` (`wizards/lathe/odTurn.js`) actually LIVE?
 *
 * VERDICT: NOT LIVE. Confirmed by driving the REAL registered builder end to end, not by reading alone.
 *
 * `odPasses` itself genuinely has no defence against `endDiameter <= 0` on a taper (test 1) — but it has
 * exactly ONE caller in the whole app (`odTurnStack`, confirmed by grep), and `odTurnStack` has exactly ONE
 * caller (`odTurnData.js`'s `rebuildOdTurn`, wired as `def.postInstantiate` — confirmed `def.build` is unset,
 * so `registerUserOp`'s own builder ALWAYS runs postInstantiate first). Unlike contour/comm/parting, OD-turn
 * has NO separate classic-wizard authoring path — the twin IS the only way to build this op — so the caller-
 * side guard in `rebuildOdTurn` is unconditionally exercised on every single build, not "one of several
 * paths." `endDiameter <= 0` (0, negative, '', null, undefined — every degenerate shape) resolves to the
 * TARGET diameter before it ever reaches `odPasses`, both for the real emit AND (independently, via its own
 * matching guard) the 2D preview — so the two AGREE for the exact input that worried t2032, not diverge.
 *
 * This file exists to KEEP that true: a regression guard against a future change (a new authoring path, a
 * dropped guard in a refactor) reopening exactly the shape of bug the parting-spigot fix closed for real.
 * `odPassExtent` is a separate, unrelated finding: zero callers anywhere in the app — the t1305 comment in
 * `odTurnStack` explains why (the taper roughing-extent clamp moved to a controller-side IF/GOTO; the JS
 * function it replaced was never removed) — named, not touched; this turn's scope is the guard, not dead code.
 */

test('odPasses itself has NO internal guard — the fact the caller-side guard exists to cover', () => {
    const bad = odPasses({ ...OD_DEFAULTS, kind: 'taper', targetDiameter: 20, endDiameter: 0 });
    expect(bad.finish.end, 'confirms the gap is real inside the declared function itself').toBe(0);
});

test('THE REAL EMIT never bakes a degenerate far-end diameter, for every shape of bad input', () => {
    const def = registerUserOp(odTurnDataDef());
    expect(typeof def.build, 'confirms postInstantiate (not def.build) is the live path').toBe('undefined');
    const build = builderOf(def.opType);
    for (const bad of [0, -5, '', null, undefined]) {
        const stack = build({ ...OD_DEFAULTS, kind: 'taper', targetDiameter: 20, endDiameter: bad });
        const text = emitMapped(stack, activeDialectOpts()).text;
        const dEndLine = text.split('\n').find((l) => l.includes('DIAMETER at the far end'));
        expect(dEndLine, `endDiameter=${JSON.stringify(bad)}`).toMatch(/#133=20\b/);
    }
});

test('THE PREVIEW agrees with the real emit for the same bad input — both fall back to the target, not a point', () => {
    const spec = odProfileSpec({ diameter: 40 }, { kind: 'taper', targetDiameter: 20, endDiameter: 0, depth: 25 });
    const finishedSurface = spec.items.find((i) => i.kind === 'line' && i.x1 === 0 && i.y1 > 0);
    expect(finishedSurface, 'the finished-surface line exists').toBeTruthy();
    // radiusOf(20) = 10 — both ends of the drawn line sit at the TARGET radius, i.e. a straight cut, matching
    // the real emit's own #133=20 fallback — not a cone collapsing to y=0 (a point).
    expect(finishedSurface.y1).toBe(10);
    expect(finishedSurface.y2).toBe(10);
});
