/**
 * blocks/dataOps/equivalence.js — the wizards-as-data EQUIVALENCE HARNESS (ROADMAP STRATEGIC #2 / Stage 4).
 *
 * Stage 4 expresses a built-in op as a pure DATA definition ({ template, bindings } consumed by instantiate, via
 * the federated user layer — see blocks/userOps.js + dataOps/drillData.js) and must PROVE the data form emits
 * byte-identical G-code to the hand-coded <name>Stack builder. This is that proof, factored out so every future
 * port (Stage 5) reuses it, and so a distribution-install can validate a community data-op claims-to-BE-X by the
 * same yardstick (MID #6's "distribution-install validation").
 *
 * emitEquivalence(builderA, builderB, sweep, settings): run EVERY param set in `sweep` through both builders, emit
 * each with the SAME settings (pin one dialect — emit output is dialect-dependent), and compare the `.text`. Block
 * ids never reach `.text` (they only tag the line→source map), so the comparison is deterministic across builds.
 *
 * Pure module — no DOM. Runs in the browser test context (where blockEmitter lives).
 */
import { emitMapped } from '../blockEmitter.js';

/**
 * Compare two stack-builders across a param sweep by emitted G-code.
 * @param {(p:object)=>object[]} builderA  e.g. the hand-coded drillStack
 * @param {(p:object)=>object[]} builderB  e.g. builderOf('user_drill_data') (the data-def, via instantiate)
 * @param {object[]} sweep                 param sets to test (each passed verbatim to BOTH builders)
 * @param {object} [settings]              emit settings ({ dialect?, profileId? }) — MUST be identical for both sides
 * @returns {{ pass:boolean, count:number, diffs:Array<{i:number,params:object,a:string,b:string}>, firstDiff:object|null }}
 */
export function emitEquivalence(builderA, builderB, sweep, settings = {}) {
    const diffs = [];
    for (let i = 0; i < (sweep || []).length; i++) {
        const params = sweep[i];
        const a = emitMapped(builderA(params), settings).text;
        const b = emitMapped(builderB(params), settings).text;
        if (a !== b) diffs.push({ i, params, a, b });
    }
    return { pass: diffs.length === 0, count: (sweep || []).length, diffs, firstDiff: diffs[0] || null };
}
