import { registerFormReproductionSuite } from './support/formReproduction.js';

/**
 * WIZARDS-AS-DATA — t2377: the arc's FOURTH and LAST `mode:'flat'` reproduction (text), completing the mill
 * family (drill, pocket, contour, slot, surfacing, text — all six now ratcheted). Text was flagged as the
 * hard one going in: ZERO of its bindings carried `section:` before this turn, AND its bindings assemble
 * from THREE sources at textData.js's own assembly line — `toolBindingsFor(stack)` + `TEXT_BINDINGS` +
 * `entryBindingsFor(stack)`, the first and third SHARED across every mill-family wizard via
 * `deriveBindings.js`. Per Rule 1b (AGENTS.md, added after t2371's own near-miss), `deriveBindings.js`
 * itself was NOT touched — `toolNum`'s and `entryX`/`entryY`'s own section values are overridden LOCALLY via
 * `.map()` inside `textDataDef()`'s own assembly, the exact technique t2375's contour fix and this same
 * turn's surfacing fix both already used successfully. See textData.js's own header comment above
 * TEXT_EXEC_BINDINGS for the full account.
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
  mode: 'flat',
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
