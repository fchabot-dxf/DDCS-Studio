import { registerFormReproductionSuite } from './support/formReproduction.js';

/**
 * WIZARDS-AS-DATA — the arc's payoff (t2299). drill's `uiChildren` tree (blocks/dataOps/drillData.js,
 * `drillDataStack`) is declared to reproduce `#wiz_drill`'s hardcoded shell (index.html:326-433)
 * structurally — same section order, same field order, same PATTERN-group grouping (grid/circle/rect/
 * line), same "no section wrapper" treatment for HOLE Ø/PECK. This pins that structure as a regression
 * tripwire, independent of whether/when `hasTreeLayout()` ever flips drill's live render path (it does
 * not today — the tree has no `split_*` node, confirmed in the header comment above `drillDataStack`).
 *
 * Three things get asserted on an axis independent of "it rendered without throwing" (the green-test-
 * over-a-dead-path failure this project has hit twice, [[green-tests-over-a-dead-ui-path]]):
 *   1. STRUCTURE — the tree's own explicitly-placed field order matches the shell's, exactly.
 *   2. THE ORPHAN NET — formWidgets.js's own "fallback safety" (t1561) auto-appends any bound param the
 *      tree never placed. drill's bindings include 9 params with NO shell-visible equivalent (x0/y0/
 *      entryX/entryY/material: twin-only, no shell field ever existed; stockDatum/stockW/stockH/stockZ:
 *      formHidden, invisible either way). Left unasserted, a NEW binding added later that the tree
 *      forgets to place would silently join this same fallback and never be noticed. Pinning the exact
 *      set turns that into a red test instead.
 *   3. WORDING — usage blurb, section titles and the code-preview tag are compared against the LIVE
 *      shell's own rendered text (opened for real via `window.openWiz('drill')`), not a hand-copied
 *      string, so this test can't drift out of sync with the shell the way a copied fact would.
 *
 * Per-field LABEL text is deliberately NOT compared byte-for-byte against the shell's bespoke old
 * wording ("HOLE COUNT" vs the binding's own `label: 'Count'`) — DRILL_BINDING_SPECS' labels are the
 * one already-established convention shared by every other consumer of these bindings (macro/token
 * docs, the flat-mode form), and rewriting 20+ of them to match one shell's historical wording is a
 * separate, broader change than this turn's own scope. Filed, not fixed — same pattern as the d_tool /
 * `count` decisions already logged in drillDataStack's own header comment.
 *
 * t2373 — REFACTORED onto tests/support/formReproduction.js (extracted alongside pocket-form-
 * reproduction-2301.spec.js, structurally near-identical to it). Same EXPECTED_ORDER, same
 * EXPECTED_ORPHANS, same three axes, same strictness as before the extraction — nothing softened.
 */

const EXPECTED_ORDER = [
  // PATTERN section — geometryGroup
  'pattern', 'skip', 'originX', 'originY', 'offZ',
  'stockAttach', 'pathDatum',   // path_anchor: re-parented, hidden rows (order fixed by formWidgets.js's own loop)
  'wcs',
  // gridGroup
  'cols', 'rows', 'dx', 'dy',
  // circleGroup ('count' declared once here — shared with line, see drillDataStack's header comment)
  'dia', 'count', 'startAngle',
  // rectGroup
  'w', 'h', 'nx', 'ny',
  // lineGroup
  'spacing', 'angle',
  // TOOL section
  'toolNum', 'rpm',
  // HOLE Ø / PECK — no section wrapper (the shell's own METHOD label is unconditionally hidden, t2297)
  'holeDia',
  'peck',
  // DEPTH & FEED section
  'depth', 'clearance', 'feed',
];

// Twin-only bindings with no shell-visible equivalent — caught by formWidgets.js's own orphan fallback
// rather than placed by the tree. See the file header above for why each one is legitimately here.
const EXPECTED_ORPHANS = ['x0', 'y0', 'entryX', 'entryY', 'material', 'stockDatum', 'stockW', 'stockH', 'stockZ'].sort();

registerFormReproductionSuite({
  wizardLabel: 'drill',
  dataModule: '/blocks/dataOps/drillData.js',
  defFactory: 'drillDataDef',
  shellOpenArg: 'drill',
  shellId: 'wiz_drill',
  expectedOrder: EXPECTED_ORDER,
  expectedOrphans: EXPECTED_ORPHANS,
  refStackModule: '/wizards/drillWizard.js',
  refStackExport: 'drillStack',
  dataOptypeExport: 'DRILL_DATA_OPTYPE',
  registerExplicitly: true,
  defaultsExport: 'DRILL_DEFAULTS',
  editParam: 'depth',
  editValue: '17.5',
  expectedBeforeValue: 5,   // DRILL_DEFAULTS.depth
});
