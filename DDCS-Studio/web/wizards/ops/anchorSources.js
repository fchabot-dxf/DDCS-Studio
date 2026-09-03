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

/** `raw`: a literal numeric string (e.g. '40') OR one of STOCK_TOKENS' own keys. `stock`: {w,h}. `fallback`:
 *  used when `raw` is empty/unrecognised/non-numeric. Backward-compatible by construction: every anchor literal
 *  authored before this turn is a plain numeric string, which still resolves via `Number()`, byte-identical —
 *  only a NEW token string activates the stock lookup. */
export function resolveAnchorCoord(raw, stock, fallback = 0) {
    if (raw == null || raw === '') return fallback;
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
