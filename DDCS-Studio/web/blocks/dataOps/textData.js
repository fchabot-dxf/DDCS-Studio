/**
 * blocks/dataOps/textData.js — the TEXT (engraving) built-in expressed as a pure DATA definition (Stage 5, port #5).
 *
 * Like slot, text needed NO new atom: fillText (kind:'fill') is already flat — its "region" is the text outline computed
 * internally from textGeometry, not a Region pill — so all geometry/cut params are flat sockets. Two REQUIRED source
 * touches made it byte-identical + safe (both north-star, not format extensions):
 *   • The two header comments were made STATIC (textWizard.js): they interpolated text/tool/stroke/depth, which a static
 *     template would freeze → a forked label would drift. The values live in the executable Fill Text / Step Down atoms
 *     (one source of truth), so static text gives RAW byte-identical with a dumb data-def. [[atc_warmup]]
 *   • fillText gained extent() (== textBBox) so the place fold's liveExtent tracks the text live — REQUIRED, else a
 *     stock-attach sweep with varied text diverges (instantiate freezes the placeOnStock snapshot at template defaults).
 *   • (separately, a runaway-row guard was added to scanlineFill so the value-glow can't freeze the tab on the
 *     childless filltext leaf — see clearing.js / [[glow-safety-childless-multiplier]].)
 *
 * FONT SEAM: `font` is a bound socket (strokeFont.js FONTS registry / getFont) — so a text-as-data op is forkable by font
 * and any registered/user-loaded font drops in. The default 'single-stroke' is byte-identical to the legacy emit.
 *
 * FRONTIERS held UNBOUND (divergence tripwires): `clearance` (fan-out → progstart + the filltext leaf) and `rpm`/`dir`
 * (progstart spindle params, supplied by settings — frozen at the template default; the sweep must not vary them).
 * NOTE: text has NO wcs block (engraving is dialect-agnostic) — so, unlike drill/surfacing/slot, there is no wcs binding.
 */
import { textStack } from '../../wizards/textWizard.js';
import { userOpFromStack } from '../userOps.js';

/** Author defaults — match textStack's num() fallbacks. optIn:true (text is an opt-in/absolute placement op — the seed
 *  must carry it). font 'single-stroke' = the built-in; stepdown defaults to depth (engraving is usually one pass). */
export const TEXT_DEFAULTS = {
    optIn: true,
    text: 'TEXT', font: 'single-stroke', height: 12, width: 1, slant: 0, spacing: 1.2, align: 'left', x: 0, y: 0,
    strokeWidth: 2.5, toolDia: 1.5, stepoverPct: 50, depth: 0.4, stepdown: 0.4, feed: 400, plunge: 120, clearance: 4,
    originX: 0, originY: 0, offZ: 0, stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0,
};

// Pre-order flatten of textStack's [comment, comment, progstart, placeonstock{ stepdown{ filltext } }, progend]:
//   0 comment · 1 comment · 2 progstart · 3 placeonstock · 4 stepdown · 5 filltext · 6 progend
export const TEXT_BINDINGS = [
    // placement scalars (block 3, placeonstock) — opt-in: originX/originY are the raw offset; stock-attach uses live extent
    { param: 'originX', blockIndex: 3, key: 'offX', type: 'number', default: TEXT_DEFAULTS.originX },
    { param: 'originY', blockIndex: 3, key: 'offY', type: 'number', default: TEXT_DEFAULTS.originY },
    { param: 'offZ', blockIndex: 3, key: 'offZ', type: 'number', default: TEXT_DEFAULTS.offZ },
    { param: 'stockAttach', blockIndex: 3, key: 'stockAttach', type: 'enum', default: TEXT_DEFAULTS.stockAttach },
    { param: 'pathDatum', blockIndex: 3, key: 'pathDatum', type: 'enum', default: TEXT_DEFAULTS.pathDatum },
    { param: 'stockDatum', blockIndex: 3, key: 'stockDatum', type: 'enum', default: TEXT_DEFAULTS.stockDatum },
    { param: 'stockW', blockIndex: 3, key: 'stockW', type: 'number', default: TEXT_DEFAULTS.stockW },
    { param: 'stockH', blockIndex: 3, key: 'stockH', type: 'number', default: TEXT_DEFAULTS.stockH },
    { param: 'stockZ', blockIndex: 3, key: 'stockZ', type: 'number', default: TEXT_DEFAULTS.stockZ },
    // depth pass (block 4, stepdown)
    { param: 'depth', blockIndex: 4, key: 'to', type: 'number', default: TEXT_DEFAULTS.depth },
    { param: 'stepdown', blockIndex: 4, key: 'by', type: 'number', default: TEXT_DEFAULTS.stepdown },
    // glyph geometry + cut (block 5, the filltext leaf)
    { param: 'text', blockIndex: 5, key: 'text', type: 'string', default: TEXT_DEFAULTS.text },
    { param: 'font', blockIndex: 5, key: 'font', type: 'enum', default: TEXT_DEFAULTS.font },
    { param: 'height', blockIndex: 5, key: 'height', type: 'number', default: TEXT_DEFAULTS.height },
    { param: 'width', blockIndex: 5, key: 'width', type: 'number', default: TEXT_DEFAULTS.width },
    { param: 'slant', blockIndex: 5, key: 'slant', type: 'number', default: TEXT_DEFAULTS.slant },
    { param: 'spacing', blockIndex: 5, key: 'spacing', type: 'number', default: TEXT_DEFAULTS.spacing },
    { param: 'align', blockIndex: 5, key: 'align', type: 'enum', default: TEXT_DEFAULTS.align },
    { param: 'x', blockIndex: 5, key: 'x', type: 'number', default: TEXT_DEFAULTS.x },
    { param: 'y', blockIndex: 5, key: 'y', type: 'number', default: TEXT_DEFAULTS.y },
    { param: 'strokeWidth', blockIndex: 5, key: 'strokeWidth', type: 'number', default: TEXT_DEFAULTS.strokeWidth },
    { param: 'toolDia', blockIndex: 5, key: 'toolDia', type: 'number', default: TEXT_DEFAULTS.toolDia },
    { param: 'stepoverPct', blockIndex: 5, key: 'stepoverPct', type: 'number', default: TEXT_DEFAULTS.stepoverPct },
    { param: 'feed', blockIndex: 5, key: 'feed', type: 'number', default: TEXT_DEFAULTS.feed },
    { param: 'plunge', blockIndex: 5, key: 'plunge', type: 'number', default: TEXT_DEFAULTS.plunge },
];

export const TEXT_DATA_OPTYPE = 'user_text_data';

/** Build the text-as-data def: a fresh { opType, label, template, bindings } ready for registerUserOp. */
export function textDataDef() {
    return userOpFromStack('text_data', 'Text (data)', textStack(TEXT_DEFAULTS), TEXT_BINDINGS, 'form2d');
}
