import { registerFormReproductionSuite } from './support/formReproduction.js';

/**
 * WIZARDS-AS-DATA — t2375: the arc's FIRST `mode:'flat'` reproduction (contour). Unlike drill/pocket (a
 * uiChildren TREE reproducing the shell's structure), contour is flat-rendered (no `split_*` node) — so what
 * has to reproduce the shell is CONTOUR_EXEC_BINDINGS' own array order + `section:` values, fixed this same
 * turn (see contourData.js's own header comment above CONTOUR_EXEC_BINDINGS for the full account: before this
 * turn the array declared ~25 bindings under `section: 'GEOMETRY'`/`'TOOL & CUT'` — a HARDCODED whitelist
 * `formWidgets.js`'s own SECTION_RANK recognizes, but the WRONG names relative to the shell's own SHAPE/
 * SIDE & TOOL/DEPTH & FEED — "the metadata exists and is WRONG").
 *
 * EXPECTED_ORDER is hand-derived from index.html's own `#wiz_contour` shell (lines 564-613): SHAPE (shape,
 * originX, originY, offZ, wcs, w, h — dia/sides hidden by their own `when` at the rect default; stockAttach/
 * pathDatum re-parented behind the path_anchor picker; stockDatum/stockW/stockH/stockZ formHidden) → SIDE &
 * TOOL (side, toolDia, rpm — `ct_tool` in the shell is the library picker, unbound; the twin's own toolNum
 * binding is placed here too, matching drill's/pocket's own toolNum-in-TOOL convention, but has no shell
 * counterpart) → DEPTH & FEED (depth, stepdown, feed, plunge — clearance is the declared UNBOUND frontier, see
 * the file header). confirmEvery/entry/rampAngle have NO shell field at all (twin-only, same orphan class
 * drill/pocket already carry) — placed in DEPTH & FEED, their closest conceptual home. entryX/entryY (also no
 * shell field) sit in SHAPE, next to the other geometry fields.
 */

const EXPECTED_ORDER = [
  // SHAPE
  'shape', 'originX', 'originY', 'offZ',
  'stockAttach', 'pathDatum', 'stockDatum', 'stockW', 'stockH', 'stockZ',   // path_anchor re-parented / formHidden
  'wcs', 'w', 'h', 'dia', 'sides',
  'entryX', 'entryY',   // no shell field — twin-only, placed beside the other SHAPE geometry fields
  // SIDE & TOOL
  'side', 'toolDia', 'toolNum', 'rpm',
  // DEPTH & FEED — 'passes' is withPassesField's own derived field, spliced after stepdown
  'depth', 'stepdown', 'passes', 'confirmEvery', 'entry', 'rampAngle', 'feed', 'plunge',
];

registerFormReproductionSuite({
  mode: 'flat',
  wizardLabel: 'contour',
  dataModule: '/blocks/dataOps/contourData.js',
  defFactory: 'contourDataDef',
  shellOpenArg: 'contour',
  shellId: 'wiz_contour',
  expectedOrder: EXPECTED_ORDER,
  expectedOrphans: [],   // flat mode has no orphan concept — every bound field renders somewhere
  refStackModule: '/wizards/contourWizard.js',
  refStackExport: 'contourStack',
  dataOptypeExport: 'CONTOUR_DATA_OPTYPE',
  registerExplicitly: false,   // contour_data is registered at app boot (matches tests/contour-data-emit.spec.js's own convention)
  defaultsExport: 'CONTOUR_DEFAULTS',
  editParam: 'depth',
  editValue: '17.5',
  expectedBeforeValue: 4,   // CONTOUR_DEFAULTS.depth
});
