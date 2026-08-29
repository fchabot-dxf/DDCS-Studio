import { registerFormReproductionSuite } from './support/formReproduction.js';

/**
 * WIZARDS-AS-DATA — t2301/t2403: pocket's own form reproduction, ratcheted.
 *
 * t2301 built this spec in TREE mode (`renderUiTree` over `pocketDataStack`'s own `field_ref`/`grid_container`/
 * `section` uiChildren) and it passed — but it was testing a path pocket's own LIVE render never takes.
 * `hasTreeLayout()` (userOpView.js) only recognizes `split_horizontal`/`split_vertical` nodes as "tree mode";
 * pocket's uiChildren uses `section`/`grid_container`/`field_ref` instead, which that check does not
 * recognize, so `hasTreeLayout(pocketDataDef().template)` is FALSE and pocket's real render goes through
 * `renderOpForm` (FLAT mode, driven by each binding's own `section:` value) — the SAME mechanism WCS/ATC/comm
 * use, not the tree walker this spec exercised. LIVE-CONFIRMED at t2381 (`window.openWiz('user_pocket_data')`)
 * and again this turn: pocket's entire hand-authored uiChildren tree (including its own `usage_text`/
 * `code_preview` nodes) is DEAD DATA for the live render — `renderOpForm` never reads `uiChildren` at all,
 * tree or not.
 *
 * FIXED t2403: `entryX`/`entryY` (declared inline in `POCKET_BINDING_SPECS`, no shared deriver) and `toolNum`
 * (the shared `TOOL_BINDING_SPECS`, deliberately unsectioned there — see deriveBindings.js's own comment)
 * carried no `section:` at all, so they rendered UNBOXED, outside every `.form-sec`. Sectioned `entryX`/
 * `entryY` → `GEOMETRY` (matching every other placement field already in that array) and `toolNum` → `TOOL &
 * CUT` locally at the spread site (`TOOL_BINDING_SPECS.map((b) => ({...b, section:'TOOL & CUT'}))`), the same
 * precedent contourData.js/tapData.js/boreData.js already set for the same shared-spec gap. All 39 bindings
 * now render boxed — confirmed live, zero orphans.
 *
 * THIS SPEC now covers the LIVE path (`mode: 'flat'`) so the class cannot recur: `EXPECTED_ORDER` is pocket's
 * own real, full flat-render field order (hand-captured live, not derived from the declaration — the engine's
 * own non-vacuity contract), `EXPECTED_ORPHANS` is `[]` (flat mode has no orphan concept — every bound field
 * lands in a section box or a bare row, never falls out of the tree).
 *
 * SECTION-TITLE DIVERGENCE, left AS-IS, deliberately: pocket's own bindings use the CANONICAL vocabulary
 * (GEOMETRY/TOOL & CUT — every OTHER field in `POCKET_BINDING_SPECS` already did before this turn), so the
 * live chrome reads "GEOMETRY" / "TOOL & CUT" — but the shell's own hardcoded section labels (index.html)
 * read "SHAPE" / "TOOL" / "TOOL & STEPOVER" / "DEPTH & FEED". Resectioning pocket to the shell's own 4 names
 * (the comm/t2401 harmonization shape) was NOT this turn's own dispatched scope (fixing the 3-field boxing
 * gap + the spec's own blind spot was) — `expectedSectionTitles`/`expectedShellSectionTitles` pin BOTH sides
 * as their own independent truths (the t2399 shape) rather than asserting a false equality or silently
 * dropping the chrome check.
 */

const EXPECTED_ORDER = [
    'wcs', 'originX', 'originY', 'stockAttach', 'pathDatum', 'stockDatum', 'stockW', 'stockH', 'stockZ', 'offZ',
    'shape', 'w', 'h', 'dia', 'sides', 'entryX', 'entryY', 'strategy', 'direction', 'stepoverPct',
    'entry', 'rampAngle', 'helixDia', 'helixPitch', 'restTool', 'restDia', 'restStepover', 'toolDia',
    'wallOffset', 'feed', 'material', 'depth', 'stepdown', 'passes', 'confirmEvery', 'plunge', 'clearance',
    'rpm', 'toolNum',
];

registerFormReproductionSuite({
    wizardLabel: 'pocket',
    dataModule: '/blocks/dataOps/pocketData.js',
    defFactory: 'pocketDataDef',
    shellOpenArg: 'pocket',
    shellId: 'wiz_pocket',
    mode: 'flat',
    expectedOrder: EXPECTED_ORDER,
    expectedOrphans: [],
    expectedSectionTitles: ['GEOMETRY', 'TOOL & CUT'],
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
