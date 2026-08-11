/**
 * wizards/textWizard.js — text / label engraving generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: `textStack(params)` = Program Start → Step Down ▸ Fill Text → Program End, where
 * Fill Text (ops/fillText.js) pocket-fills the inflated glyph ribbons (textGeometry.js) at each Z level. The
 * single-stroke-font layout + ribbon inflation now live in textGeometry.js (shared, no module cycle). Pure
 * G0/G1 engraving — dialect-agnostic, so it emits identically on every post; the Step Down / framing route
 * through the active dialect like every other cutting wizard.
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { layoutText, textContours } from './textGeometry.js';

export { layoutText, textContours };   // back-compat for views/textView.js + the 2D schematic

/** The laid-out text's bounding box — used by PlaceOnStock (when you attach a label to a stock corner) + the view. */
export function textBBox(params = {}) {
    const b = layoutText(params).bbox;
    return { minX: b.x0, maxX: b.x1, minY: b.y0, maxY: b.y1 };
}

// t1728 (gameplan step 1) — textStack MOVED to stacks/textWizard.js (the twin's own builder dependency, kept
// importable+re-exported here unchanged for every other existing caller — pure move). textStack calls textBBox
// (staying here, SCREEN-ONLY per views/textView.js), so the new file imports it back from this one.
import { textStack } from './stacks/textWizard.js';
export { textStack };

export class TextWizard {
    generate(params) {
        recordOp('text', params);
        return emitMapped(textStack(params), activeDialectOpts()).text;
    }
}
