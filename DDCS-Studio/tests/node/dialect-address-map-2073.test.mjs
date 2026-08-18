import { test, expect } from './support/harness.mjs';

/**
 * dialect-address-map-2073 — THE JS macro#↔param# SEAM, pinned (browser-free tier).
 *
 * t2067 shipped because the `−500` that turns a macro number into a `setting` index was written in multiple
 * places with nothing forcing them to agree. Stage 2 fixed + pinned the Python side
 * (bridge/bridge-app/tests/test_address_map.py). This is the JS half:
 *   · `dialect.vars.wcsBase` = the MACRO base #805 the codegen emits (`#805 = #880` writes G54-X).
 *   · the dump-importer + the Python mapper read the PARAM base #305.
 * Nothing asserted `805 − 500 == 305` in JS — the exact t2067 shape, one axis un-pinned. This does, through the
 * ONE shared offset (`data/paramAddressing.js`, mirroring `Ops.PARAM_FILE_OFFSET`), and behaviourally (the real
 * `mapExpertWcs` must READ the derived slot, not a re-stated constant).
 *
 * The dump-importer↔Python OUTPUT parity is already pinned by tests/dump-import-golden.spec.js (same fixtures,
 * same numbers). This file pins the thing upstream of both: that the JS macro base and the JS/Python param base
 * are the same fact through the same offset.
 */

const OFFSET_CONTRACT = { uservar: 100, setting: 500, camsetting: 1000 };   // MUST equal Ops.PARAM_FILE_OFFSET (Python)

test('the JS offset map is the ONE offset, equal to the Python contract', async () => {
    const { PARAM_FILE_OFFSET, macroToParam } = await import('/data/paramAddressing.js');
    expect(PARAM_FILE_OFFSET, 'data/paramAddressing.js must match bridge ops.py Ops.PARAM_FILE_OFFSET — the seam t2067 broke crossed this language boundary').toEqual(OFFSET_CONTRACT);
    expect(macroToParam(805), 'macro #805 (G54-X) → setting param #305').toBe(305);
    expect(macroToParam(578), 'macro #578 (active WCS) → setting param #78').toBe(78);
    expect(macroToParam(1430, 'camsetting'), 'macro #1430 → camsetting #430').toBe(430);
    expect(macroToParam(150, 'uservar'), 'macro #150 → uservar #50').toBe(50);
});

test('Expert: dialect.vars MACRO base − offset === the PARAM base the dump-importer actually reads', async () => {
    const { getDialect } = await import('/wizards/dialects/index.js');
    const { macroToParam } = await import('/data/paramAddressing.js');
    const { mapExpertWcs } = await import('/data/dumpImport.js');

    const v = getDialect('ddcs-expert-m350').vars;
    expect(v.wcsBase, 'the Expert WCS macro base is #805 (what G-code addresses / codegen emits)').toBe(805);
    expect(v.activeWcs, 'the Expert active-WCS macro is #578').toBe(578);

    // the param slot the dump-importer reads must be EXACTLY macroBase − offset — proven behaviourally through the
    // real mapExpertWcs, not by re-deriving the number: plant a sentinel at the derived slot and read it back.
    const wcsParam = macroToParam(v.wcsBase);       // 805 − 500 = 305
    const activeParam = macroToParam(v.activeWcs);  // 578 − 500 = 78
    expect(wcsParam).toBe(305);
    expect(activeParam).toBe(78);

    const params = new Array(1000).fill(0);
    params[activeParam] = 1;          // active = G54
    params[wcsParam] = 50.13;         // G54-X at the DERIVED slot
    params[wcsParam + 1] = -665.70;
    params[wcsParam + 2] = -47.28;
    const w = mapExpertWcs(params);
    expect(w.active, 'active WCS read from macroToParam(#578)').toBe(1);
    expect(w.workOrigin, 'mapExpertWcs reads G54 from macroToParam(#805) = param #305 — if it read #805 raw this is all 0 (the t2067 bug)').toEqual({ x: 50.13, y: -665.70, z: -47.28 });
    expect(w.table.g54).toEqual([50.13, -665.70, -47.28]);
});

test('V4.1: the −500 seam does NOT apply — its WCS is the coord1 file, not a setting macro', async () => {
    const { getDialect } = await import('/wizards/dialects/index.js');
    const v = getDialect('ddcs-v41').vars;
    // V4.1 declares NO active-WCS macro var (activeWcs: null) — the active system is the coord1 enum (#16), and the
    // table is the coord1 file, read by mapCoordWcs. So macroToParam(#805) is meaningless for V4.1 and must not be
    // applied to it; this asserts the declaration that makes that explicit (guards against someone wiring V4.1 WCS
    // through the Expert −500 path, which would be the V4.1 version of t2067).
    expect(v.activeWcs, 'V4.1 has no macro active-WCS var — WCS comes from coord1 (pinned by dump-import-golden + pull-v41-wcs)').toBeNull();
});
