import { registerFormReproductionSuite } from './support/formReproduction.js';

/**
 * WIZARDS-AS-DATA — t2375: the arc's SECOND `mode:'flat'` reproduction (slot), after contour in the same
 * turn. Slot is flat-rendered (no `split_*` node) like contour, but its own gap was the OPPOSITE shape: only
 * 2 of ~30 SLOT_BINDING_SPECS entries carried `section:` at all before this turn (both the stale 'GEOMETRY'
 * name) — "the metadata is MISSING," not wrong. See slotData.js's own header comment above SLOT_BINDING_SPECS
 * for the full account of the fix (the same array-reorder-plus-section mechanism contourData.js's own t2375
 * fix used, plus retiring the now-superseded t1500 TOOL_ANCHOR splice).
 *
 * t2625 (BACKLOG #71/#72) — MIGRATED onto the declared `split_horizontal`/`group_box`/`field_ref` tree
 * (slot's field-set-changing forks already resolved at the binding-declaration layer via `mergeBindingsByParam`
 * — see slotData.js's own new header comment above `SLOT_FIELDS0`). Switched to `mode:'tree'` (the shared
 * default) to test the REAL render path, mirroring contour's (t2621) own precedent exactly. EXPECTED_ORDER is
 * UNCHANGED from t2375: the four `group_box`es place every field explicitly (see slotData.js's own
 * `slotBySection`/tree declaration), so there are still zero orphans. `expectedFrontierSections` stays —
 * 'REPEAT (array)' is still a real shell section title with nothing bound in the twin (`pattern` frontier).
 *
 * EXPECTED_ORDER is hand-derived from index.html's own `#wiz_slot` shell (lines 642-716): ENDPOINTS (ax, ay,
 * bx, by, offX, offY, offZ — pathDatum/stockAttach re-parented behind the path_anchor picker; stockDatum/
 * stockW/stockH/stockZ formHidden) → TOOL (rpm — `sl_tool` in the shell is the library picker, unbound; the
 * twin's own toolNum binding is placed here too, matching drill's/pocket's own toolNum-in-TOOL convention) →
 * TOOL & WIDTH (width, toolDia, stepoverPct) → DEPTH & FEED (depth, stepdown, clearance, wcs, feed, plunge).
 * The shell's own REPEAT (array) section has NOTHING bound in the twin — `pattern` is a declared FRONTIER
 * (this def is the single-slot template; see the file's own top-of-file comment), so no REPEAT-section field
 * ever reaches the form. entryX/entryY and the entry/rampAngle/helixDia/helixPitch cluster have no shell field
 * at all (twin-only) — entryX/entryY placed in ENDPOINTS (closest conceptual fit), the entry cluster in
 * DEPTH & FEED (grouped with the other depth-descent fields).
 */

const EXPECTED_ORDER = [
  // ENDPOINTS
  'ax', 'ay', 'bx', 'by', 'originX', 'originY', 'offZ',
  'stockAttach', 'pathDatum', 'stockDatum', 'stockW', 'stockH', 'stockZ',   // path_anchor re-parented / formHidden
  'entryX', 'entryY',   // no shell field — twin-only, placed beside the other ENDPOINTS geometry fields
  // TOOL
  'toolNum', 'rpm',
  // TOOL & WIDTH
  'width', 'toolDia', 'stepoverPct',
  // DEPTH & FEED — 'passes' is withPassesField's own derived field, spliced after stepdown
  'depth', 'stepdown', 'passes', 'clearance', 'wcs', 'feed', 'plunge', 'entry', 'rampAngle', 'helixDia', 'helixPitch',
];

registerFormReproductionSuite({
  wizardLabel: 'slot',
  dataModule: '/blocks/dataOps/slotData.js',
  defFactory: 'slotDataDef',
  shellOpenArg: 'slot',
  shellId: 'wiz_slot',
  expectedOrder: EXPECTED_ORDER,
  expectedOrphans: [],   // flat mode has no orphan concept — every bound field renders somewhere
  expectedFrontierSections: ['REPEAT (array)'],   // pattern is a declared, unbound FRONTIER — no bound field ever carries this section
  refStackModule: '/wizards/slotWizard.js',
  refStackExport: 'slotStack',
  dataOptypeExport: 'SLOT_DATA_OPTYPE',
  registerExplicitly: false,   // slot_data is registered at app boot (matches tests/slot-as-data.spec.js's own convention)
  defaultsExport: 'SLOT_DEFAULTS',
  editParam: 'depth',
  editValue: '17.5',
  expectedBeforeValue: 4,   // SLOT_DEFAULTS.depth
});
