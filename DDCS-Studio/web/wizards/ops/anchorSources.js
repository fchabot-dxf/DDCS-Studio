/**
 * wizards/ops/anchorSources.js — t2573 (BACKLOG #61, the t2571 assessment's own build): TWO small, general,
 * DECLARED primitives — not `diag_aim_handle`'s private helpers, but the shared vocabulary any anchor field
 * can opt into. t2571 traced `diagAim`'s own inputs to exactly these two shapes already existing informally
 * elsewhere in the codebase (live stock dims, already read at panelTypes.js's own resolution layer for every
 * declared anchor kind; an enum→sign convention, already baked into `canvasWidgets.js`'s own `probeVector`
 * gesture) — this file PROMOTES both to a reusable, declarable form.
 *
 * `resolveAnchorCoord` is proven general THIS SAME TURN by a second, independent consumer — `point_handle`'s
 * own ax/ay (`panelTypes.js`) — not just `diag_aim_handle`'s.
 */

// A CLOSED vocabulary (not a formula language): the live physical stock's own width/height and their halves.
// A handle NAMES one of these tokens, it never writes an expression — the same shape as picking an enum value.
const STOCK_TOKENS = {
    stockW: (stock) => stock.w,
    stockH: (stock) => stock.h,
    stockHalfW: (stock) => stock.w / 2,
    stockHalfH: (stock) => stock.h / 2,
};

/** `raw`: a NUMBER (t2679 amendment 3 — `point_handle`/`rect_handle`'s own `ax`/`ay` is a SEARCHABLE VALUE
 *  FIELD, `anchorValueField.js`: type a number, it commits AS a number), OR a STRING naming either (a) an
 *  EXISTING bound form param of THIS def — the field's own primary offer, checked against live `params` — or
 *  (b) one of STOCK_TOKENS' own keys (legacy, `diag_aim_handle`'s t2573 authored strings; the searchable
 *  field no longer OFFERS these — amendment 3 dropped the stock/setup worlds from the search entirely — but
 *  still resolves one if hand-authored/inherited), or (c) a plain numeric STRING (the pre-redesign field
 *  shape, still supported byte-identical). ⛔ A MARKER id is deliberately NOT resolved here — that tier needs
 *  `def.opType`/live sim-starts, context this function doesn't carry; see `panelTypes.js`'s own
 *  `markerAnchorCoord` (right before both call sites), which is tried FIRST and falls through to this
 *  function unchanged. `stock`: {w,h}. `params`: the op's own LIVE resolved params (only the form-param tier
 *  reads it). `fallback`: used when `raw` is empty/an unrecognised name. Backward-compatible by construction:
 *  every anchor literal authored before t2679 is a plain numeric STRING, which still resolves via `Number()`
 *  at the bottom, byte-identical — only a recognised NAME (a live param, or a stock token) activates the
 *  tiers above it. */
export function resolveAnchorCoord(raw, stock, fallback = 0, params) {
    if (raw == null || raw === '') return fallback;
    if (typeof raw === 'number') return raw;
    if (params && Object.prototype.hasOwnProperty.call(params, raw)) {
        const v = Number(params[raw]);
        if (Number.isFinite(v)) return v;
    }
    const tok = STOCK_TOKENS[raw];
    if (tok) return tok(stock || { w: 0, h: 0 });
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}

/** The declared enum→signed-number convention `canvasWidgets.js`'s own `probeVector` gesture already bakes in
 *  internally (`dir === 'neg' ? -1 : 1`), promoted to a reusable, declarable shape: read `fieldParam`'s CURRENT
 *  value out of `params` — `posValue` (default 'pos') maps to `signWhenPos` (default −1), anything else maps to
 *  its negation. A missing `fieldParam` resolves to the POSITIVE convention (1), never a "no sign" default. */
export function resolveEnumSign(fieldParam, params, posValue, signWhenPos) {
    const pos = (posValue == null || posValue === '') ? 'pos' : posValue;
    const swp = Number.isFinite(signWhenPos) ? signWhenPos : -1;
    if (!fieldParam) return 1;
    return ((params || {})[fieldParam] === pos) ? swp : -swp;
}
