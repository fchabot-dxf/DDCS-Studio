/**
 * wizards/stacks/atcTableWizard.js — ATC Tool Table — PUSH the tool table + magazine pockets to the controller.
 *
 * The controller's data files can't be written over SMB (it overwrites them from RAM), so "push" = a macro
 * the operator RUNS: a flat list of variable assignments (tool lengths #[toolTable+T-1], pocket XYZ
 * #1330/#1350/#1370+pocket-1) and M30. No motion. Reads its data from Settings → Tool table (library lengths +
 * magazine pockets) — the single source — so it's a VIEW over that data, not a second entry form. Built as a
 * block stack (Comment + Set#) so it round-trips to Blocks like every other wizard. Gated: pockets only emit on
 * a post with a mapped ATC model (caps.atc). Tool lengths + WCS writes are confirmed program-writable; pocket
 * (#1330) writes are UNVERIFIED — running this macro is itself the bench test (assignment is harmless either way).
 */
import { newBlock } from '../../blocks/blockEmitter.js';
import { num } from '../ops/util.js';
import { resolveActivePost } from '../dialects/index.js';
import { getActiveProfile } from '../../shared/js/profiles/controllerProfiles.js';

const getDialect = () => { try { return resolveActivePost(getActiveProfile().id); } catch (_) { return null; } };

const CB = (text) => { const b = newBlock('comment'); b.params = { text }; return b; };
const AB = (v, value, note, cap) => { const b = newBlock('assign'); b.params = { var: v, value: String(value), note: note || '', ...(cap ? { cap } : {}) }; return b; };   // t640 — cap:'atc' folds ATC-register writes on a non-ATC post

// The TOOL-LENGTHS section (one assign per library tool with a length) — a per-row unroll from params.tools.
function lengthsSection(params, toolBase) {
    const tools = (Array.isArray(params.tools) ? params.tools : []).filter((t) => t && t.num != null && t.num !== '' && t.length !== '' && t.length != null && Number.isFinite(Number(t.length)));
    const S = [CB(`=== TOOL LENGTHS (table base #${toolBase}) ===`)];
    if (!tools.length) S.push(CB('(no tool lengths set in the library)'));
    tools.forEach((t) => { const n = parseInt(t.num, 10); S.push(AB(`#${toolBase + n - 1}`, Number(t.length), `T${n}${t.name ? ' ' + t.name : ''} length`)); });
    return S;
}
// The POCKET-POSITIONS section (X/Y/Z per magazine pocket) — a per-row unroll from params.magazine. Needs the post's ATC vars.
function pocketsSection(params, atc) {
    const mag = (Array.isArray(params.magazine) ? params.magazine : []).filter((p) => p && (p.x !== '' || p.y !== '' || p.z !== ''));
    const S = [CB(`=== POCKET POSITIONS (#${atc.pocketX}/#${atc.pocketY}/#${atc.pocketZ}) — UNVERIFIED: running this is the test ===`)];
    if (!mag.length) S.push(CB('(no pockets in the magazine)'));
    mag.forEach((p, i) => {
        const idx = num(p.pocket, i + 1);
        S.push(AB(`#${atc.pocketX + idx - 1}`, num(p.x, 0), `Pocket ${idx} X`, 'atc'));
        S.push(AB(`#${atc.pocketY + idx - 1}`, num(p.y, 0), `Pocket ${idx} Y`, 'atc'));
        S.push(AB(`#${atc.pocketZ + idx - 1}`, num(p.z, 0), `Pocket ${idx} Z`, 'atc'));
    });
    return S;
}

/** The DERIVED guard keys — the two include SECTIONS (lengths / pockets), the pockets fork split by whether the POST has a
 *  mapped ATC model (rows vs the "not available" note). ONE source with the concrete routing; the twin (E1) + the E0 prune
 *  read it. `_atc` (post-dependent) is why the pockets fork can't key on a single param. */
export function atcTableGuardKeys(params = {}) {
    const d = getDialect();
    const atc = !!(d && d.vars && d.vars.atc);
    const incP = params.includePockets !== false;
    return { _lengths: params.includeLengths !== false, _pockets: incP && atc, _pocketsNA: incP && !atc };
}

const HEADER = () => [
    CB('ATC | Write Tool Table to controller'),
    CB('RUN THIS ON THE CONTROLLER to apply the tool table + pockets — variable writes only, no motion.'),
    CB('Source: Settings → Tool table (library lengths + magazine pockets).'),
];

export function atcTableStack(params = {}, opts = {}) {
    const d = getDialect();
    const atc = d && d.vars && d.vars.atc;
    const toolBase = (d && d.vars && d.vars.toolTable) || 1430;
    const NA = () => CB('Pockets: not available on this controller (no mapped ATC model)');
    // t568 E0 — the data-op twin seam. superset:true carries BOTH include SECTIONS (lengths / pockets + the no-ATC note)
    // GUARDED by the derived _lengths/_pockets/_pocketsNA keys, so pruneGuards collapses to the chosen toggles → byte-identical
    // to the concrete build. Each section UNROLLS its rows from params.tools/magazine; the twin (E1) re-unrolls from LIVE settings.
    if (opts.superset) {
        const GUARD = (when, kids) => { const g = newBlock('guard'); g.params = { when }; g.children = kids; return g; };
        const pk = atc ? pocketsSection(params, atc) : [];   // the pockets rows exist only where the post maps an ATC model
        return [
            ...HEADER(),
            GUARD({ param: '_lengths', is: true }, lengthsSection(params, toolBase)),
            GUARD({ param: '_pockets', is: true }, pk),
            GUARD({ param: '_pocketsNA', is: true }, [NA()]),
            newBlock('endprogram'),
        ];
    }
    const k = atcTableGuardKeys(params);
    const S = [...HEADER()];
    if (k._lengths) S.push(...lengthsSection(params, toolBase));
    if (k._pockets) S.push(...pocketsSection(params, atc));
    else if (k._pocketsNA) S.push(NA());
    S.push(newBlock('endprogram'));
    return S;
}
