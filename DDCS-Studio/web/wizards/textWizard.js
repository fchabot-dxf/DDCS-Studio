/**
 * wizards/textWizard.js — text / label engraving generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: `textStack(params)` = Program Start → Step Down ▸ Fill Text → Program End, where
 * Fill Text (ops/fillText.js) pocket-fills the inflated glyph ribbons (textGeometry.js) at each Z level. The
 * single-stroke-font layout + ribbon inflation now live in textGeometry.js (shared, no module cycle). Pure
 * G0/G1 engraving — dialect-agnostic, so it emits identically on every post; the Step Down / framing route
 * through the active dialect like every other cutting wizard.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { layoutText, textContours } from './textGeometry.js';

export { layoutText, textContours };   // back-compat for views/textView.js + the 2D schematic

function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }

/** Text params → its engraving block stack (the one source of truth for both displays). */
export function textStack(params = {}) {
    const depth = num(params.depth, 0.4);
    const stepdown = num(params.stepdown, depth) || depth;   // engraving is usually one pass
    const tool = Math.max(0.1, num(params.toolDia, 1.5));
    const clr = num(params.clearance, 4);
    const safeText = String(params.text == null ? '' : params.text).replace(/[()\n]/g, ' ');

    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };

    C(`Text "${safeText}" - DDCS Studio`);
    C(`engrave fill | tool Ø${tool} | stroke ${num(params.strokeWidth, 2.5)} | depth ${depth}`);

    const ps = newBlock('progstart');
    ps.params = { ...ps.params, rpm: num(params.rpm, ps.params.rpm), dir: params.dir || ps.params.dir, clearance: clr };
    S.push(ps);

    const ft = newBlock('filltext');
    ft.params = {
        ...ft.params,
        text: params.text == null ? 'TEXT' : String(params.text),
        height: num(params.height, 12), spacing: num(params.spacing, 1.2), align: params.align || 'left',
        x: num(params.x, 0), y: num(params.y, 0), strokeWidth: num(params.strokeWidth, 2.5),
        toolDia: tool, stepoverPct: num(params.stepoverPct, 50),
        z: 'z', feed: num(params.feed, 400), plunge: num(params.plunge, 120), clearance: clr,
    };
    const sd = newBlock('stepdown');
    sd.params = { ...sd.params, to: depth, by: stepdown };
    sd.children = [ft];
    S.push(sd);

    S.push(newBlock('progend'));
    return S;
}

export class TextWizard {
    generate(params) {
        recordOp('text', params);
        return emitMapped(textStack(params)).text;
    }
}
