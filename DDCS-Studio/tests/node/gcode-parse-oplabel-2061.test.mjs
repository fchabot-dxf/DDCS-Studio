import { test, expect } from './support/harness.mjs';
import { drillDataDef, DRILL_DEFAULTS } from '../../web/blocks/dataOps/drillData.js';
import { pocketDataDef, POCKET_DEFAULTS } from '../../web/blocks/dataOps/pocketData.js';
import { registerUserOp } from '../../web/blocks/userOps.js';
import { builderOf } from '../../web/blocks/opBuilders.js';
import { emitMapped } from '../../web/blocks/blockEmitter.js';
import { activeDialectOpts } from '../../web/wizards/previewEmit.js';

/**
 * t2061 — Tier 3's last parked item, collected. `opLabel()` (the beacon instrumenter's own comment-header
 * parser, `web/shared/js/instrument/gcode-parse.js`) used a single-level regex that matched the FIRST paren
 * pair it could complete — for a comment containing its OWN nested parens (Studio's OLD drill header,
 * "( ---- DRILL, parametric: 2 holes (grid) x peck · @work 52 ---- )"), that was the INNER "(grid)", not the
 * header — confirmed live at t2055, returning "grid" instead of the operation's actual name.
 *
 * t2305 UPDATE — drill's REAL header is no longer nested at all: the nested `(grid)` this test's own name
 * cited was ITSELF a live defect (a comment DDCS closes at the first `)`, "everything after it parsed as
 * G-code" — see holecycle.js's own t2305 comment), fixed at the EMITTER by replacing the nesting with `:`.
 *
 * t2649 (BACKLOG #78) — the beacon mechanism `opLabel`/`gcode-parse.js` served is REMOVED (owner-directed
 * 2026-09-04, never demonstrably ran end-to-end), and with it every production consumer of that module — it
 * had none besides the beacon instrumenter. `gcode-parse.js`'s own synthetic nested-paren/empty-comment unit
 * tests went with it (nothing left to unit-test). What survives here is the REAL regression this ticket
 * exists for: drill's real emitted header must stay a single, non-nested comment (the t2305 fix), asserted
 * directly against the emitted G-code text rather than through the retired parsing utility.
 */

test('drill\'s REAL emitted header, confirmed by execution: a clean, non-nested comment (t2305 fixed the nesting at the emitter)', () => {
    const def = registerUserOp(drillDataDef());
    const build = builderOf(def.opType);
    const params = { ...DRILL_DEFAULTS, pattern: 'grid', cols: 2, rows: 1, dx: 20 };
    const text = emitMapped(build(params), activeDialectOpts()).text;
    const headerLine = text.split(/\r?\n/).find((l) => /^\s*\(.*\)\s*$/.test(l));
    expect(headerLine, 'a real bare-comment header line exists in the real emit').toBeTruthy();
    expect(headerLine.trim(), 'the full header, no longer nested (t2305)')
        .toBe('( ---- DRILL, parametric: 2 holes: grid x peck · @work 52 ---- )');
    expect(headerLine).not.toContain('(grid)');
});

test('the CONTROL — pocket\'s own real header has no nested parens and is unaffected, byte-identical to before', () => {
    const def = registerUserOp(pocketDataDef());
    const build = builderOf(def.opType);
    const text = emitMapped(build({ ...POCKET_DEFAULTS }), activeDialectOpts()).text;
    const headerLine = text.split(/\r?\n/).find((l) => /^\s*\(.*\)\s*$/.test(l));
    expect(headerLine, 'a real bare-comment header line exists in the real emit').toBeTruthy();
    expect(headerLine.trim())
        .toBe('( ---- AREA CLEARING, parametric. Every var below speaks; change one and the loops re-derive. · @work 479 ---- )');
});
