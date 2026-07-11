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
    text: 'TEXT', font: 'single-stroke', height: 12, width: 1, slant: 0, rotation: 0, spacing: 1.2, lineSpacing: 1.6, align: 'left', x: 0, y: 0,
    strokeWidth: 2.5, toolDia: 1.5, stepoverPct: 50, depth: 0.4, stepdown: 0.4, feed: 400, plunge: 120, clearance: 4,
    originX: 0, originY: 0, offZ: 0, stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0,
};

const XY_DATUM_OPTIONS = [
    ['Follow stock datum', ''],
    ['Front Left', 'nn'],
    ['Front Center', 'cn'],
    ['Front Right', 'pn'],
    ['Center Left', 'nc'],
    ['Center', 'cc'],
    ['Center Right', 'pc'],
    ['Back Left', 'np'],
    ['Back Center', 'cp'],
    ['Back Right', 'pp'],
];

const STOCK_DATUM_OPTIONS = [
    ['Front Left / Top', 'nnp'],
    ['Front Center / Top', 'cnp'],
    ['Front Right / Top', 'pnp'],
    ['Center Left / Top', 'ncp'],
    ['Center / Top', 'ccp'],
    ['Center Right / Top', 'pcp'],
    ['Back Left / Top', 'npp'],
    ['Back Center / Top', 'cpp'],
    ['Back Right / Top', 'ppp'],
];

const ALIGN_OPTIONS = [
    ['Left', 'left'],
    ['Center', 'center'],
    ['Right', 'right'],
];

const FONT_OPTIONS = [
    ['Single-stroke (engraving)', 'single-stroke'],
];

// Pre-order flatten of textStack's [comment, comment, progstart, placeonstock{ stepdown{ filltext } }, progend]:
//   0 comment · 1 comment · 2 progstart · 3 placeonstock · 4 stepdown · 5 filltext · 6 progend
const TEXT_EXEC_BINDINGS = [
    // placement scalars (block 3, placeonstock) — opt-in: originX/originY are the raw offset; stock-attach uses live extent
    { param: 'originX', blockIndex: 3, key: 'offX', type: 'number', default: TEXT_DEFAULTS.originX },
    { param: 'originY', blockIndex: 3, key: 'offY', type: 'number', default: TEXT_DEFAULTS.originY },
    { param: 'offZ', blockIndex: 3, key: 'offZ', type: 'number', default: TEXT_DEFAULTS.offZ },
    {
        param: 'stockAttach', blockIndex: 3, key: 'stockAttach', type: 'enum', default: TEXT_DEFAULTS.stockAttach,
        widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS },
    },
    {
        param: 'pathDatum', blockIndex: 3, key: 'pathDatum', type: 'enum', default: TEXT_DEFAULTS.pathDatum,
        widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS },
    },
    {
        param: 'stockDatum', blockIndex: 3, key: 'stockDatum', type: 'enum', default: TEXT_DEFAULTS.stockDatum,
        widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS },
    },
    { param: 'stockW', blockIndex: 3, key: 'stockW', type: 'number', default: TEXT_DEFAULTS.stockW },
    { param: 'stockH', blockIndex: 3, key: 'stockH', type: 'number', default: TEXT_DEFAULTS.stockH },
    { param: 'stockZ', blockIndex: 3, key: 'stockZ', type: 'number', default: TEXT_DEFAULTS.stockZ },
    // depth pass (block 4, stepdown)
    { param: 'depth', blockIndex: 4, key: 'to', type: 'number', default: TEXT_DEFAULTS.depth },
    { param: 'stepdown', blockIndex: 4, key: 'by', type: 'number', default: TEXT_DEFAULTS.stepdown },
    // glyph geometry + cut (block 5, the filltext leaf)
    { param: 'text', blockIndex: 5, key: 'text', type: 'string', default: TEXT_DEFAULTS.text },
    {
        param: 'font', blockIndex: 5, key: 'font', type: 'enum', default: TEXT_DEFAULTS.font,
        widget: 'dropdown', widgetConfig: { options: FONT_OPTIONS },
    },
    { param: 'height', blockIndex: 5, key: 'height', type: 'number', default: TEXT_DEFAULTS.height },
    { param: 'width', blockIndex: 5, key: 'width', type: 'number', default: TEXT_DEFAULTS.width },
    { param: 'slant', blockIndex: 5, key: 'slant', type: 'number', default: TEXT_DEFAULTS.slant },
    { param: 'rotation', blockIndex: 5, key: 'rotation', type: 'number', default: TEXT_DEFAULTS.rotation },   // t708 — the label angle (deg, about the anchor); the ↻ preview handle writes it
    { param: 'spacing', blockIndex: 5, key: 'spacing', type: 'number', default: TEXT_DEFAULTS.spacing },
    { param: 'lineSpacing', blockIndex: 5, key: 'lineSpacing', type: 'number', default: TEXT_DEFAULTS.lineSpacing },   // t708 — multi-line pitch = height × this
    {
        param: 'align', blockIndex: 5, key: 'align', type: 'enum', default: TEXT_DEFAULTS.align,
        widget: 'dropdown', widgetConfig: { options: ALIGN_OPTIONS },
    },
    { param: 'x', blockIndex: 5, key: 'x', type: 'number', default: TEXT_DEFAULTS.x },
    { param: 'y', blockIndex: 5, key: 'y', type: 'number', default: TEXT_DEFAULTS.y },
    { param: 'strokeWidth', blockIndex: 5, key: 'strokeWidth', type: 'number', default: TEXT_DEFAULTS.strokeWidth },
    { param: 'toolDia', blockIndex: 5, key: 'toolDia', type: 'number', default: TEXT_DEFAULTS.toolDia },
    { param: 'stepoverPct', blockIndex: 5, key: 'stepoverPct', type: 'number', default: TEXT_DEFAULTS.stepoverPct },
    { param: 'feed', blockIndex: 5, key: 'feed', type: 'number', default: TEXT_DEFAULTS.feed },
    { param: 'plunge', blockIndex: 5, key: 'plunge', type: 'number', default: TEXT_DEFAULTS.plunge },
];

// Wrapped-template indexes (user_root + param_group precede execution children).
const WRAP_PREFIX_COUNT = 4;   // user_root + panel + sim + param_group
export const TEXT_BINDINGS = TEXT_EXEC_BINDINGS.map((b) => ({ ...b, blockIndex: b.blockIndex + WRAP_PREFIX_COUNT }));

export const TEXT_DATA_OPTYPE = 'user_text_data';

/** Build the text-as-data def: a fresh { opType, label, template, bindings } ready for registerUserOp. */
export function textDataDef() {
    const exec = textStack(TEXT_DEFAULTS);
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },   // t708 text arc — the 3D engraving trace/carve AND the FeatureCanvas 2D real-letter layout (via filltext.previewGeometry: real letters + pos/rotation handles)
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            {
                type: 'param_group',
                params: { group: 'Text' },
                children: [],
            },
        ],
        children: exec,
    }];
    const def = userOpFromStack('text_data', 'Text (data)', stack, TEXT_BINDINGS, 'form3d+2d', null, 'mill_datawiz');
    // t708 — WIDTH-HONESTY note (the DECLARED status-hint seam: registerUserOp wires def.statusHint → getUserStatusHint):
    // a tool wider than the intended stroke can't cut thinner than itself, so the ACTUAL engraved letter width =
    // max(strokeWidth, toolDia). Surface it in the in-place status when the tool forces it wider than the stroke.
    def.statusHint = (p) => {
        const n = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);
        const sw = n(p.strokeWidth, 2.5), td = n(p.toolDia, 1.5);
        return td > sw ? ` · ⚠ engraved width ${td}mm (Ø${td} tool wider than the ${sw}mm stroke)` : '';
    };
    return def;
}
