import { registerFormReproductionSuite } from './support/formReproduction.js';

/**
 * WIZARDS-AS-DATA — t2377 gave surfacing real `section:` metadata (reproduced via `mode:'flat'`, since
 * surfacing was flat-rendered live at the time — `hasTreeLayout()` never true for it, see drillData.js's own
 * t2511 comment for the primary source on that fact). t2545 (BACKLOG #71/#72, the section migration) moved
 * surfacing onto the declared `split_horizontal`/`group_box`/`field_ref` tree (mirroring drill), so it is now
 * genuinely tree-rendered live — switched to `mode:'tree'` (the shared default drill/pocket already use) to
 * test the REAL render path rather than silently keep exercising the now-bypassed flat one. EXPECTED_ORDER
 * and EXPECTED_ORPHANS are UNCHANGED from t2377: the four `group_box` folds place every field explicitly (see
 * surfacingData.js's own `surfacingFieldGroups`/`buildSurfacingTwinStack`), so there are still zero orphans —
 * same claim as flat mode's own "every bound field renders somewhere", now proven through the tree instead.
 *
 * EXPECTED_ORDER is hand-derived from index.html's own `#wiz_surfacing` shell (lines 745-791): AREA
 * (originX, originY, offZ, [hidden stock+jog fields], w, h) → TOOL (rpm — `sf_tool` in the shell is the
 * library picker, unbound; the twin's own toolNum binding is placed here too, matching drill's/pocket's/
 * contour's/slot's own toolNum-in-TOOL convention) → TOOL & STEPOVER (strategy, toolDia, stepoverPct) →
 * DEPTH & FEED (depth, stepdown, zMode, wcs, feed, plunge — clearance is the declared UNBOUND frontier, see
 * the file header). confirmEvery and the entry/rampAngle/helixDia/helixPitch cluster have no shell field at
 * all (twin-only, same orphan class contour/drill/pocket already carry) — confirmEvery placed right after
 * stepdown (matching contour's own placement), the entry cluster appended at the end of DEPTH & FEED.
 * entryX/entryY (also no shell field) sit in AREA, next to the other geometry fields.
 */

const EXPECTED_ORDER = [
  // AREA
  'originX', 'originY', 'offZ',
  'stockAttach', 'pathDatum', 'stockDatum', 'stockW', 'stockH', 'stockZ',   // path_anchor re-parented / formHidden
  'w', 'h',
  'entryX', 'entryY',   // no shell field — twin-only, placed beside the other AREA geometry fields
  // TOOL
  'toolNum', 'rpm',
  // TOOL & STEPOVER
  'strategy', 'toolDia', 'stepoverPct',
  // DEPTH & FEED — 'passes' is withPassesField's own derived field, spliced after stepdown
  'depth', 'stepdown', 'passes', 'confirmEvery', 'zMode', 'wcs', 'feed', 'plunge', 'entry', 'rampAngle', 'helixDia', 'helixPitch',
];

registerFormReproductionSuite({
  wizardLabel: 'surfacing',
  dataModule: '/blocks/dataOps/surfacingData.js',
  defFactory: 'surfacingDataDef',
  shellOpenArg: 'surfacing',
  shellId: 'wiz_surfacing',
  expectedOrder: EXPECTED_ORDER,
  expectedOrphans: [],   // flat mode has no orphan concept — every bound field renders somewhere
  refStackModule: '/wizards/surfacingWizard.js',
  refStackExport: 'surfacingStack',
  dataOptypeExport: 'SURFACING_DATA_OPTYPE',
  registerExplicitly: false,   // surfacing_data is registered at app boot (matches tests/node/surfacing-as-data.test.mjs's own convention)
  defaultsExport: 'SURFACING_DEFAULTS',
  editParam: 'depth',
  editValue: '17.5',
  expectedBeforeValue: 0.5,   // SURFACING_DEFAULTS.depth
});
