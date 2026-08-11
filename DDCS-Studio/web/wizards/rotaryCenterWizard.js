/**
 * DDCS Studio - Rotary Centreline Wizard (4th-axis setup) — A-axis centreline + radius of a cylinder on a
 * horizontal 4th axis. Sets Y0 on the centreline, Z0 on the centreline OR the OD top.
 *
 * REWRITTEN AS A BLOCK STACK: `rotaryCenterStack(params)` from granular, dialect-aware atoms. Native across
 * posts: probe form, status-check folding, the Y/Z DRO reads (Read Machine), the WCS writes (Set WCS Offset)
 * and the confirm/reposition gates all come from the active dialect.
 *
 *   known — enter the blank diameter; probe top + ±Y. Yc = midpoint of flanks; Zc = top − R. 3 touches.
 *   fit   — no diameter: probe 3 points on the Y-Z circle and solve centre + R. ADVANCED — verify on machine.
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { opSimStarts } from '../viz/opSimStarts.js';
// t1728 (gameplan step 1) — rotaryCenterHeaderComments/rotaryCenterStack MOVED to stacks/rotaryCenterWizard.js (the twin's
// own builder dependency, kept importable+re-exported here unchanged for every other existing caller — pure move).
import { rotaryCenterHeaderComments, rotaryCenterStack } from './stacks/rotaryCenterWizard.js';
export { rotaryCenterHeaderComments, rotaryCenterStack };

export class RotaryCenterWizard {
    generate(params) {
        recordOp('rotary_center', params);
        return emitMapped(rotaryCenterStack(params), activeDialectOpts()).text;
    }

    /** Preview start (stock frame): above the cylinder top, centred, ready to probe down. */
    inferStart(params, stock) {
        return this.inferStarts(params, stock)[0];
    }

    // Per-pass preview starts → the shared sim-start registry (viz/opSimStarts.js, BUILT_IN.rotary_center). Moved verbatim.
    inferStarts(params, stock) { return opSimStarts('rotary_center', params, stock); }
}
