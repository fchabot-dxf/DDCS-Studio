/**
 * tests/smoke.manifest.mjs — the FAST TIER (t1195 GATE-SPEEDUP).
 *
 * The full suite (603 spec files / ~1489 tests, ~15 min) is too slow to run on every worker pass. This is the declared
 * SMOKE tier: a small, STABLE set of BROAD-BREAKAGE detectors — one canonical spec per major subsystem — meant to catch
 * "did a change break the app widely" in ~1-2 min. It is NOT feature coverage: per pass the worker ALSO runs the specs
 * for the files it touched, and the FULL suite runs at the merge boundary. So this list stays small and rarely changes
 * (it tracks SUBSYSTEMS, not features) — a new feature does not need a new smoke entry; a new SUBSYSTEM might.
 *
 * Add here only a spec that is (a) fast, (b) stable (not load-flaky), (c) the best single canary for its subsystem.
 * The smoke config validates every entry EXISTS, so a rename/removal fails loudly instead of silently dropping coverage.
 *
 * COMPOSITION IS THE ADVISOR'S TO TUNE — this is a candidate; edit the list freely (it is inert data).
 */
export const SMOKE_SPECS = [
    // app shell / core views
    'blocks-render.spec.js',            // app boots + Blocks tab renders (Blockly mounts, wizard→blocks)
    'blocks-roundtrip.spec.js',         // the core wizard↔blocks round-trip (generate() IS the block stack)
    'macros-tabs.spec.js',              // Macros tab (M-codes / K-buttons / CAM packs sidebar)
    'blocks-theme.spec.js',             // theming / skin tokens apply
    // layout / responsive
    'mobile-layout.spec.js',            // responsive phone layout
    'header-responsive.spec.js',        // the header never clips / reflows
    // CAM
    'cam-build-mode.spec.js',           // the CAM builder (door-2 auto-import)
    'cam-slot-roundtrip-s43.spec.js',   // CAM slot ops ↔ blocks round-trip
    'cam-slot-sim.spec.js',             // CAM slot simulate (DDCS macro sim)
    // release integrity — t1311. A file-only check (no browser, ~2 ms) that the four version stamps agree. It is in
    // the FAST tier deliberately: the mistake it guards against happens at RELEASE time, which is exactly when nobody
    // is running the slow suite. bump-version.cjs is the one writer; this is what makes forgetting that impossible to
    // ship rather than merely against the rules.
    'version-sync-1311.spec.js',
    // persistence
    'backup-852.spec.js',               // the .ddcs workspace backup/restore
    'persistence-file-indicator.spec.js', // unsaved-to-file indicator + exit warning (t1193)
    // wizard emit / data-op twins
    'corner-data-emit.spec.js',         // the gated probe pilot's emit (representative wizard→G-code)
    'drill-as-data.spec.js',            // a milling data-op twin emit
    // editor / parser / sim
    'gcode-to-stack.spec.js',           // parser: .nc round-trips to ops
    'editor-sim-real-insert.spec.js',   // editor + sim integration
    'op-sim-starts-registry.spec.js',   // the sim-declaration registry (core sim)
    // probe + settings library
    'probe-wcs.spec.js',                // a probe routine core
    'wizard-restore-default.spec.js',   // the wizard/settings library (restore-to-factory)
    // t1241 E — TWO GATE BLIND SPOTS. Both are contract guards that no per-family filter matched, so a change could
    // pass every targeted run and still break them:
    'check-console.spec.js',            // zero boot errors — the NEW-FILE / 404 tripwire (a fresh web/ module 404s until the server reloads)
    'op-sim-context.spec.js',           // the op-type → declared-intent CONTRACT (missed when opSimContext.js itself was edited)
    // t1243 — the STALE-MODULE GHOST guard. Studio serves raw ES modules, so one cacheable header re-runs deleted code
    // on a normal reload; that cost five phantom bug reports in a single day. Cheap (4 tests, ~3s) and it belongs on
    // every run, because the failure it prevents makes EVERY other test's green meaningless in the browser.
    'module-cache-headers-1243.spec.js',
];
