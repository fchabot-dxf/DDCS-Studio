import { registerFormReproductionSuite } from './support/formReproduction.js';

/**
 * WIZARDS-AS-DATA — t2377 gave text real `section:` metadata (reproduced via `mode:'flat'`, since text was
 * flat-rendered live at the time — the fourth and last `mode:'flat'` reproduction, completing the mill family
 * alongside drill/pocket/contour/slot/surfacing). t2619 (BACKLOG #71/#72, the conversion-tier pair) converted
 * text's own hand-counted `blockIndex` bindings to identity-based `match:{type}` and moved it onto the declared
 * `split_horizontal`/`group_box`/`field_ref` tree — switched to `mode:'tree'` (the shared default drill/pocket/
 * surfacing already use) to test the REAL render path rather than silently keep exercising the now-bypassed
 * flat one, mirroring surfacing's own t2545 precedent exactly (see that file's own comment for the same
 * reasoning). EXPECTED_ORDER is UNCHANGED from t2377: the four `group_box`es place every field explicitly (see
 * textData.js's own `fieldsOf`/tree declaration), so there are still zero orphans — same claim as flat mode's
 * own "every bound field renders somewhere", now proven through the tree instead.
 *
 * EXPECTED_ORDER is hand-derived from index.html's own `#wiz_text` shell (lines 820-857): TEXT (text,
 * height, strokeWidth, width, slant, [hidden x/y], originX, originY, offZ, [hidden stock fields], spacing)
 * → TOOL (rpm — `tx_tool` in the shell is the library picker, unbound; the twin's own toolNum binding is
 * placed here too) → TOOL & FILL (toolDia, stepoverPct) → DEPTH & FEED (depth, stepdown, feed, plunge —
 * clearance is the declared UNBOUND frontier; text has NO wcs/zMode block at all, unlike surfacing/contour/
 * slot). `rpm` is ALSO a declared unbound frontier for TEXT SPECIFICALLY (see the file header — frozen at
 * the Settings default) — so unlike every other mill-family wizard, text's own TOOL section carries only
 * `toolNum`, never a form-visible rpm row; a real, pre-existing structural difference, not a gap this turn
 * introduces. font/rotation/lineSpacing/align/snSlot/snWidth/snIncrement have NO shell field at all — the
 * LARGEST orphan cluster of any mill-family wizard (7), appended to the end of TEXT in their own pre-
 * existing relative order. entryX/entryY (also no shell field) sit at the very end of TEXT.
 */

const EXPECTED_ORDER = [
  // TEXT
  'text', 'height', 'strokeWidth', 'width', 'slant',
  'x', 'y',   // hidden in the shell — position driven by the 2D drag handle, kept at the shell's own spot
  'originX', 'originY', 'offZ',
  'stockAttach', 'pathDatum', 'stockDatum', 'stockW', 'stockH', 'stockZ',   // path_anchor re-parented / formHidden
  'spacing',
  'font', 'rotation', 'lineSpacing', 'align', 'snSlot', 'snWidth', 'snIncrement',   // no shell field — twin-only
  'entryX', 'entryY',   // no shell field — twin-only, SHARED entryBindingsFor
  // TOOL — no `rpm` here: text holds it as a declared UNBOUND frontier (see the file header), unlike every
  // other mill-family wizard
  'toolNum',
  // TOOL & FILL
  'toolDia', 'stepoverPct',
  // DEPTH & FEED — 'passes' is withPassesField's own derived field, spliced after stepdown
  'depth', 'stepdown', 'passes', 'feed', 'plunge',
];

registerFormReproductionSuite({
  wizardLabel: 'text',
  dataModule: '/blocks/dataOps/textData.js',
  defFactory: 'textDataDef',
  shellOpenArg: 'text',
  shellId: 'wiz_text',
  expectedOrder: EXPECTED_ORDER,
  expectedOrphans: [],   // flat mode has no orphan concept — every bound field renders somewhere
  refStackModule: '/wizards/textWizard.js',
  refStackExport: 'textStack',
  dataOptypeExport: 'TEXT_DATA_OPTYPE',
  registerExplicitly: false,   // text_data is registered at app boot (matches tests/text-as-data.spec.js's own convention)
  defaultsExport: 'TEXT_DEFAULTS',
  editParam: 'depth',
  editValue: '17.5',
  expectedBeforeValue: 0.4,   // TEXT_DEFAULTS.depth
});
