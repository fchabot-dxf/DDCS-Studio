import { registerFormReproductionSuite } from './support/formReproduction.js';

/**
 * WIZARDS-AS-DATA — t2377: the arc's THIRD `mode:'flat'` reproduction (surfacing), after contour+slot at
 * t2375. Surfacing is the t2375-slot shape: only `wcs` and `zMode` carried `section:` at all before this
 * turn (both the stale, non-existent `'COORDINATES'` name) — mostly ABSENCE, not mismatch. See
 * surfacingData.js's own header comment above SURFACING_BINDING_SPECS for the full fix account.
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
  mode: 'flat',
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
