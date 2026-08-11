/**
 * wizards/stacks/textWizard.js — text / label engraving generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: `textStack(params)` = Program Start → Step Down ▸ Fill Text → Program End, where
 * Fill Text (ops/fillText.js) pocket-fills the inflated glyph ribbons (textGeometry.js) at each Z level. The
 * single-stroke-font layout + ribbon inflation now live in textGeometry.js (shared, no module cycle). Pure
 * G0/G1 engraving — dialect-agnostic, so it emits identically on every post; the Step Down / framing route
 * through the active dialect like every other cutting wizard.
 */
import { newBlock } from '../../blocks/blockEmitter.js';
import { makePlace } from '../../blocks/programFraming.js';
import { textBBox } from '../textWizard.js';

function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }

/** Text params → its engraving block stack (the one source of truth for both displays). */
export function textStack(params = {}) {
    const depth = num(params.depth, 0.4);
    const stepdown = num(params.stepdown, depth) || depth;   // engraving is usually one pass
    const tool = Math.max(0.1, num(params.toolDia, 1.5));
    const clr = num(params.clearance, 4);

    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };

    // STATIC comment text (no param interpolation): the text/tool/stroke/depth all live in the executable Fill Text /
    // Step Down atoms (the single source of truth), so a forked/data-def label can't drift → byte-identical, dumb data-def.
    C('Text engraving - DDCS Studio');
    C('engrave fill');

    const ps = newBlock('progstart');
    ps.params = { ...ps.params, rpm: num(params.rpm, ps.params.rpm), dir: params.dir || ps.params.dir, clearance: clr };
    S.push(ps);

    const ft = newBlock('filltext');
    ft.params = {
        ...ft.params,
        text: params.text == null ? 'TEXT' : String(params.text), font: params.font || 'single-stroke',
        height: num(params.height, 12), width: num(params.width, 1), slant: num(params.slant, 0), rotation: num(params.rotation, 0),
        spacing: num(params.spacing, 1.2), lineSpacing: num(params.lineSpacing, 1.6), align: params.align || 'left',
        x: num(params.x, 0), y: num(params.y, 0), strokeWidth: num(params.strokeWidth, 2.5),
        toolDia: tool, stepoverPct: num(params.stepoverPct, 50),
        z: 'z', feed: num(params.feed, 400), plunge: num(params.plunge, 120), clearance: clr,
        // t764 — {SN} dynamic-serial fields: inert unless the text carries the token, but must reach the filltext leaf
        // (the emit source) so the wizard's serial #var / digits / increment route through the real path.
        snSlot: num(params.snSlot, 490), snWidth: num(params.snWidth, 6), snIncrement: num(params.snIncrement, 1),
        dateStamp: params.dateStamp || '',
    };
    const sd = newBlock('stepdown');
    sd.params = { ...sd.params, to: depth, by: stepdown };
    sd.children = [ft];
    S.push(makePlace(params, textBBox(params), sd));   // opt-in placement: stays at x/y unless you attach to a corner

    S.push(newBlock('progend'));
    return S;
}
