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
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
import { resolveActivePost } from './dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';

const getDialect = () => { try { return resolveActivePost(getActiveProfile().id); } catch (_) { return null; } };

export function atcTableStack(params = {}) {
    const d = getDialect();
    const S = [];
    const C = (text) => { const b = newBlock('comment'); b.params = { text }; S.push(b); };
    const A = (v, value, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(value), note: note || '' }; S.push(b); };
    const END = () => S.push(newBlock('endprogram'));

    const atc = d && d.vars && d.vars.atc;
    const toolBase = (d && d.vars && d.vars.toolTable) || 1430;
    const tools = (Array.isArray(params.tools) ? params.tools : []).filter((t) => t && t.num != null && t.num !== '' && t.length !== '' && t.length != null && Number.isFinite(Number(t.length)));
    const mag = (Array.isArray(params.magazine) ? params.magazine : []).filter((p) => p && (p.x !== '' || p.y !== '' || p.z !== ''));
    const doLengths = params.includeLengths !== false;
    const doPockets = params.includePockets !== false && !!atc;

    C('ATC | Write Tool Table to controller');
    C('RUN THIS ON THE CONTROLLER to apply the tool table + pockets — variable writes only, no motion.');
    C('Source: Settings → Tool table (library lengths + magazine pockets).');

    if (doLengths) {
        C(`=== TOOL LENGTHS (table base #${toolBase}) ===`);
        if (!tools.length) C('(no tool lengths set in the library)');
        tools.forEach((t) => { const n = parseInt(t.num, 10); A(`#${toolBase + n - 1}`, Number(t.length), `T${n}${t.name ? ' ' + t.name : ''} length`); });
    }
    if (doPockets) {
        C(`=== POCKET POSITIONS (#${atc.pocketX}/#${atc.pocketY}/#${atc.pocketZ}) — UNVERIFIED: running this is the test ===`);
        if (!mag.length) C('(no pockets in the magazine)');
        mag.forEach((p, i) => {
            const idx = num(p.pocket, i + 1);
            A(`#${atc.pocketX + idx - 1}`, num(p.x, 0), `Pocket ${idx} X`);
            A(`#${atc.pocketY + idx - 1}`, num(p.y, 0), `Pocket ${idx} Y`);
            A(`#${atc.pocketZ + idx - 1}`, num(p.z, 0), `Pocket ${idx} Z`);
        });
    } else if (params.includePockets !== false && !atc) {
        C('Pockets: not available on this controller (no mapped ATC model)');
    }
    END();
    return S;
}

export class AtcTableWizard {
    generate(params) {
        recordOp('atc_table', params);
        return emitMapped(atcTableStack(params)).text;
    }
}
