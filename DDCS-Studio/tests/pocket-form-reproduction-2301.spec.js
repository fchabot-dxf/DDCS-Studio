import { registerFormReproductionSuite } from './support/formReproduction.js';

/**
 * WIZARDS-AS-DATA — the arc's SECOND `uiChildren` reproduction (t2301), after drill (t2299). Pocket's tree
 * (blocks/dataOps/pocketData.js, `pocketDataStack`) reproduces `#wiz_pocket`'s hardcoded shell (index.html:
 * 463-541) structurally — same section order, same field order, same per-shape grouping (rect w/h vs circle/
 * polygon dia+sides). Pinned here on the same three independent axes drill's own reproduction test uses
 * (structure+orphan set / live-shell wording / an edit reaching the real emit path), so this test compares
 * tree vs shell rather than tree vs a hardcoded list and cannot pass vacuously.
 *
 * Pocket was deliberately chosen over a second drill-shaped twin BECAUSE it has a real shape-type switch
 * (rect/circle/polygon/ellipse show different dimension fields) — but the gate found the dispatched mechanism
 * (guard/whenGuard) does not apply: POCKET_BINDING_SPECS already carries a per-FIELD `when` clause for every
 * shape-conditional param (the exact mechanism drill's own pattern-switch groups already used, t2299), so the
 * tree places rectDimGroup/circleDimGroup as plain always-present grid_containers and lets each field's own
 * binding-level `when` decide visibility — no guard/pruneGuards involvement, mirroring pocketData.js's own
 * header comment for the full account.
 *
 * t2373 — REFACTORED onto tests/support/formReproduction.js (extracted alongside drill-form-reproduction-
 * 2299.spec.js, structurally near-identical to it). Same EXPECTED_ORDER, same EXPECTED_ORPHANS, same three
 * axes, same strictness as before the extraction — nothing softened, including pocket's own real differences
 * from drill (no explicit registerUserOp call needed; baseParamsCustom instead of spreading POCKET_DEFAULTS).
 */

const EXPECTED_ORDER = [
  // SHAPE section — shapeGroup
  'shape', 'strategy', 'originX', 'originY', 'offZ',
  'stockAttach', 'pathDatum',   // path_anchor: re-parented, hidden rows (order fixed by formWidgets.js's own loop)
  // rectDimGroup
  'w', 'h',
  // circleDimGroup
  'dia', 'sides',
  // TOOL section
  'toolNum', 'rpm',
  // TOOL & STEPOVER section
  'toolDia', 'stepoverPct', 'wallOffset',
  // DEPTH & FEED section
  'depth', 'stepdown', 'clearance', 'wcs', 'feed', 'plunge',
];

// Bindings with no shell-visible equivalent at all — caught by formWidgets.js's own orphan fallback rather
// than placed by the tree. Confirmed by grepping index.html AND pocketView.js for every one of these ids —
// zero hits either place, not assumed. See pocketData.js's own header comment for the full account.
const EXPECTED_ORPHANS = [
  'stockDatum', 'stockW', 'stockH', 'stockZ',                        // formHidden, invisible either way
  'direction', 'entry', 'rampAngle', 'helixDia', 'helixPitch',       // DEPTH ENTRY cluster — no shell UI ever
  'restTool', 'restDia', 'restStepover',                              // REST MACHINING cluster — no shell UI ever
  'material',                                                         // feedsuggest — same orphan class as drill's
  'passes', 'confirmEvery', 'entryX', 'entryY',
].sort();

registerFormReproductionSuite({
  wizardLabel: 'pocket',
  dataModule: '/blocks/dataOps/pocketData.js',
  defFactory: 'pocketDataDef',
  shellOpenArg: 'pocket',
  shellId: 'wiz_pocket',
  expectedOrder: EXPECTED_ORDER,
  expectedOrphans: EXPECTED_ORPHANS,
  refStackModule: '/wizards/pocketWizard.js',
  refStackExport: 'pocketStack',
  dataOptypeExport: 'POCKET_DATA_OPTYPE',
  registerExplicitly: false,   // pocket_data is registered at app boot — no explicit registerUserOp needed (matches tests/pocket-data-emit.spec.js's own convention)
  baseParamsCustom: { shape: 'rect', w: 80, h: 60 },
  editParam: 'depth',
  editValue: '17.5',
  expectedBeforeValue: 4,   // POCKET_DEFAULTS.depth
});
