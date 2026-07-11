/**
 * blocks/dataOps/wizardOptions.js — SHARED enum-option lists for the mill data-op twins (t720 P1).
 *
 * The WCS + placement-datum + pattern/strategy option sets are IDENTICAL across the mill family, yet each twin used to
 * copy them inline (and drill/bore/surfacing simply OMITTED them → empty dropdowns). ONE declaration here, imported by
 * every twin's bindings, so a dropdown can never render empty for lack of a copy, and the labels never drift. Inert data
 * (declare-never-infer); the VALUES are the socket/emit values, so binding to them stays byte-identical.
 *
 * (contour/slot/text/pocket still carry local copies of the same lists — a follow-up consolidation; harmless, identical.)
 */

/** Work-coordinate system: 'active' emits nothing; G54–G59 emit the code. */
export const WCS_OPTIONS = [
    ['Active', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59'],
];

/** An XY datum corner (path datum / stock-attach corner). '' = follow the stock datum. Values = the 2-char datum code. */
export const XY_DATUM_OPTIONS = [
    ['Follow stock datum', ''], ['Front Left', 'nn'], ['Front Center', 'cn'], ['Front Right', 'pn'],
    ['Center Left', 'nc'], ['Center', 'cc'], ['Center Right', 'pc'], ['Back Left', 'np'], ['Back Center', 'cp'], ['Back Right', 'pp'],
];

/** The stock's own datum corner (3-char code incl. the Z face). Default 'nnp' (front-left / top). */
export const STOCK_DATUM_OPTIONS = [
    ['Front Left / Top', 'nnp'], ['Front Center / Top', 'cnp'], ['Front Right / Top', 'pnp'],
    ['Center Left / Top', 'ncp'], ['Center / Top', 'ccp'], ['Center Right / Top', 'pcp'],
    ['Back Left / Top', 'npp'], ['Back Center / Top', 'cpp'], ['Back Right / Top', 'ppp'],
];

/** Drill / Bore hole pattern. Values = the patternPoints kind. */
export const DRILL_PATTERN_OPTIONS = [
    ['Grid', 'grid'], ['Bolt circle', 'circle'], ['Rectangle (perimeter)', 'rect'], ['Line', 'line'],
];

/** Surfacing raster strategy. Values = the surfacing socket value (the form's 'raster' maps to 'parallel'). */
export const SURFACING_STRATEGY_OPTIONS = [
    ['Parallel (raster)', 'parallel'], ['Concentric', 'concentric'],
];
