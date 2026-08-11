/**
 * DDCS Studio - ATC Tool Table Wizard — PUSH the tool table + magazine pockets to the controller.
 *
 * The controller's data files can't be written over SMB (it overwrites them from RAM), so "push" = a macro
 * the operator RUNS: a flat list of variable assignments (tool lengths #[toolTable+T-1], pocket XYZ
 * #1330/#1350/#1370+pocket-1) and M30. No motion. Reads its data from Settings → Tool table (library lengths +
 * magazine pockets) — the single source — so it's a VIEW over that data, not a second entry form. Built as a
 * block stack (Comment + Set#) so it round-trips to Blocks like every other wizard. Gated: pockets only emit on
 * a post with a mapped ATC model (caps.atc). Tool lengths + WCS writes are confirmed program-writable; pocket
 * (#1330) writes are UNVERIFIED — running this macro is itself the bench test (assignment is harmless either way).
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
// t1728 (gameplan step 1) — atcTableGuardKeys/atcTableStack MOVED to stacks/atcTableWizard.js (the twin's own builder
// dependency, kept importable+re-exported here unchanged for every other existing caller — pure move).
import { atcTableGuardKeys, atcTableStack } from './stacks/atcTableWizard.js';
export { atcTableGuardKeys, atcTableStack };

export class AtcTableWizard {
    generate(params) {
        recordOp('atc_table', params);
        return emitMapped(atcTableStack(params), activeDialectOpts()).text;
    }
}
