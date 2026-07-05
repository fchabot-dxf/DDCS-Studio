/**
 * wizards/ops/structCtl.js — the STRUCTURAL-CONTROL blocks (t154, item d MINIMAL).
 *
 * A structural param (probeZFirst / travelApproach / wcs / syncA / corner / probeSeq) is a GUARD DRIVER, not a value
 * socket — it reshapes WHICH blocks survive pruneGuards. It has no assign socket to hang a value-knob on, so it needs its
 * own authoring control. corner's STRUCTURAL section is FILLED from CORNER_STRUCT_BINDINGS (the SAME source that renders the
 * runtime form), and these block DEFS mirror those bindings 1:1 — asserted EXACTLY by corner-structctl.spec so they can't
 * drift (the ONE-SOURCE guarantee via assertion). We hand-declare the defs here rather than import CORNER_STRUCT_BINDINGS,
 * because pulling cornerData.js into the PALETTE's early module load runs its eval-time cornerDataStack ahead of userOps.js's
 * init → a load-order crash. So: presence/values are DRIVEN from the bindings (in cornerData), options MATCH by assertion.
 *
 * A single generic block can't carry per-INSTANCE dropdown options (Blockly renders STATIC fields), so per-param sidesteps
 * that: a bool → a checkbox `value`; an enum → a dropdown `value` (options via def._options, read by bridge.optionsFor).
 * They EMIT NOTHING (authoring-only); the live-reprune hook (blocksApp) feeds their value into op.params → pruneGuards.
 */

/** `sc_<param-lowercase>` — the block type for a structural param's control. */
export const structCtlType = (param) => 'sc_' + String(param).toLowerCase();

// `help` (last arg) mirrors CORNER_STRUCT_BINDINGS[param].help 1:1 — the DECLARED help slot (1c). Hand-declared here
// (structCtl.js deliberately does NOT import corner data — the layering), with corner-structctl.spec asserting it
// matches, so the string can't drift (the one-source-via-assertion guarantee, same as label/options). bridge.jsonDef
// renders it as the block tooltip; a def with no help keeps the default "<label> (<category>)".
const bool = (param, label, dflt, help) => ({ type: structCtlType(param), label, help, category: 'Wizard UI', kind: 'structctl', structParam: param, defaults: { value: !!dflt }, fields: ['value'], _options: null, emit: () => [] });
const enu = (param, label, dflt, options, help) => ({ type: structCtlType(param), label, help, category: 'Wizard UI', kind: 'structctl', structParam: param, defaults: { value: dflt }, fields: ['value'], _options: options, emit: () => [] });

/** One control block per struct binding — MUST match CORNER_STRUCT_BINDINGS (param/options/label/help, asserted). Bool → checkbox; enum → dropdown. */
export const STRUCT_CTL_BLOCKS = [
    bool('probeZFirst', 'Probe Z First', false, 'Probe the top surface for Z before the two walls — anchors the sideways probes to a real measured Z instead of a jogged guess.'),
    enu('travelApproach', 'Travel', 'auto', [['Manual', 'manual'], ['Auto', 'auto']], 'Auto = the machine moves itself between the walls; Manual = you jog to each start and press Cycle Start (operator-in-the-loop).'),   // t328 human — DISPLAY order [Manual|Auto] (must mirror CORNER_STRUCT_BINDINGS: the 1:1 assert compares _options)
    enu('wcs', 'WCS', 'active', [['Active', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59']], 'Which work-coordinate register to store the found corner into — Active uses the currently-selected WCS; G54..G59 write that specific register.'),
    bool('syncA', 'Dual-Gantry Sync A', false, 'Dual-gantry: also write the found corner to the slave A-axis WCS, keeping a twin-motor gantry squared. A WCS write only — no extra motion.'),
    enu('corner', 'Corner', 'FL', [['Front-Left', 'FL'], ['Front-Right', 'FR'], ['Back-Left', 'BL'], ['Back-Right', 'BR']], 'Which corner of the stock you are probing — sets the two walls and their approach directions (Front-Left / Front-Right / Back-Left / Back-Right).'),
    enu('probeSeq', 'Probe Order', 'YX', [['Y then X', 'YX'], ['X then Y', 'XY']], 'Which wall to probe first — Y-wall then X-wall, or X then Y.'),
];

/** `sc_<param>` block type → the op param it drives (postInstantiate value-sync + the live-reprune gather). */
export const SC_PARAM = Object.fromEntries(STRUCT_CTL_BLOCKS.map((b) => [b.type, b.structParam]));

/** Is this a structural-control block type? (blocksApp change-listener + devMode knob-exclude.) */
export const isStructCtlType = (type) => typeof type === 'string' && Object.prototype.hasOwnProperty.call(SC_PARAM, type);
