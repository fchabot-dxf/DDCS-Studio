import { registerFormReproductionSuite } from './support/formReproduction.js';

/**
 * WIZARDS-AS-DATA — t2301/t2403/t2627: pocket's own form reproduction, ratcheted again.
 *
 * t2301 built this spec in TREE mode over `pocketDataStack`'s own `field_ref`/`grid_container`/`section`
 * uiChildren and it passed — but it was testing a path pocket's own LIVE render never took: `hasTreeLayout()`
 * (userOpView.js) only recognizes `split_horizontal`/`split_vertical`, which that uiChildren never declared, so
 * the live render went through classic `renderOpForm` instead (`mode:'flat'`, t2381/t2403's own finding).
 *
 * t2627 (BACKLOG #71/#72) ACTIVATES it: `pocketDataStack` now wraps the same field_ref/grid_container content
 * in a `split_horizontal` (RIGHT: preview3d+feature_canvas, replacing the old bare `sim` node — t2511's own
 * adjacency mechanism, same substitution every other tree-mode op in this arc made), `section` nodes became
 * `group_box` (rule 20's own `groupBoxCountIn`/the cross-op section-order guard both key on that type
 * specifically), and the pre-existing ORPHAN SET (direction/entry/rampAngle/helixDia/helixPitch/confirmEvery/
 * restTool/restDia/restStepover/material/the stock-datum cluster/entryX/entryY/passes — 19 fields, never
 * placed in this tree since t2301) is now placed into the group whose other fields already establish its
 * conceptual home — see pocketData.js's own header comment above `pocketDataStack` for the per-field mapping.
 * Zero orphans, matching contour's/slot's own migrations. Switched back to `mode:'tree'` (the shared default,
 * dropped `mode:'flat'`) to test the REAL render path, mirroring contour's (t2621) and slot's (t2625) own
 * precedent exactly.
 *
 * NEW GROUP: REST MACHINING — a genuinely distinct concept (POCKET_STRUCT_BINDINGS' own `group:'rest'` tag)
 * with no shell equivalent at all (the shell never had UI for rest machining), so it is NOT in
 * `expectedShellSectionTitles` (still the shell's own real 4 names) but IS in `expectedSectionTitles` (the
 * tree's own 5 group_box titles) — the same "pin both sides as independent truths" shape t2399/t2403 already
 * established for this exact file, extended by one real group rather than smoothed into a false equality.
 *
 * `POCKET_BINDING_SPECS`' own `section:` values were reassigned from the old GEOMETRY/TOOL & CUT (G/T) split to
 * these same 5 tree-matching names at t2627 (pocketData.js's own header) — bookkeeping consistency only, since
 * this tree places every field_ref BY HAND, never by filtering on `.section`.
 */

const EXPECTED_ORDER = [
    // SHAPE
    'shape', 'strategy', 'originX', 'originY', 'offZ', 'w', 'h', 'dia', 'sides',
    'stockAttach', 'pathDatum', 'stockDatum', 'stockW', 'stockH', 'stockZ', 'entryX', 'entryY',
    // TOOL
    'toolNum', 'rpm',
    // TOOL & STEPOVER — direction LEADS (matching t800's own "strategy -> direction -> stepover" clearing-
    // cluster order, clearing-cluster-800.spec.js's own P6.1), even though it has no shell field of its own
    'direction', 'toolDia', 'stepoverPct', 'wallOffset',
    // DEPTH & FEED — 'passes' is withPassesField's own derived field
    'depth', 'stepdown', 'clearance', 'wcs', 'feed', 'plunge', 'passes', 'entry', 'rampAngle', 'helixDia', 'helixPitch', 'confirmEvery', 'material',
    // REST MACHINING
    'restTool', 'restDia', 'restStepover',
];

registerFormReproductionSuite({
    wizardLabel: 'pocket',
    dataModule: '/blocks/dataOps/pocketData.js',
    defFactory: 'pocketDataDef',
    shellOpenArg: 'pocket',
    shellId: 'wiz_pocket',
    expectedOrder: EXPECTED_ORDER,
    expectedOrphans: [],
    expectedSectionTitles: ['SHAPE', 'TOOL', 'TOOL & STEPOVER', 'DEPTH & FEED', 'REST MACHINING'],
    expectedShellSectionTitles: ['SHAPE', 'TOOL', 'TOOL & STEPOVER', 'DEPTH & FEED'],
    refStackModule: '/wizards/pocketWizard.js',
    refStackExport: 'pocketStack',
    dataOptypeExport: 'POCKET_DATA_OPTYPE',
    registerExplicitly: false,   // pocket_data is registered at app boot — no explicit registerUserOp needed (matches tests/pocket-data-emit.spec.js's own convention)
    baseParamsCustom: { shape: 'rect', w: 80, h: 60 },
    editParam: 'depth',
    editValue: '17.5',
    expectedBeforeValue: 4,   // POCKET_DEFAULTS.depth
});
