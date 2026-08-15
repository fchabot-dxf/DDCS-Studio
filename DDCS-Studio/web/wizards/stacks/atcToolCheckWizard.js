/**
 * wizards/stacks/atcToolCheckWizard.js — ATC Tool Breakage / Length Re-check — quick tap on the fixed setter that ABORTS if
 * the tool is broken, missing, or the wrong length (deviation beyond ± tolerance vs the stored value).
 *
 * REWRITTEN AS A BLOCK STACK: `atcToolCheckStack(params)` from granular atoms. Native across posts: probe
 * form, Z trigger read, the tool-table base, status-check folding and the confirm gate all come from the dialect.
 * Re-measures with the same convention as the Tool Length wizard (length = MachineZ − block height).
 */
import { newBlock } from '../../blocks/blockEmitter.js';
import { num } from '../ops/util.js';
import { srcVal, srcNote } from '../probeBlocks.js';
import { resolveActivePost } from '../dialects/index.js';
import { getActiveProfile } from '../../shared/js/profiles/controllerProfiles.js';

const getDialect = () => { try { return resolveActivePost(getActiveProfile().id); } catch (_) { return null; } };

/** The interpolated SUMMARY header comment — extracted to ONE format so the data-op twin's postInstantiate can RECOMPOSE it
 *  from the resolved params (the atcLengthHeaderComments precedent), keeping twin==built-in byte-identical for ALL scalars.
 *  Must reproduce the old inline text byte-for-byte (same num() + defaults as atcToolCheckStack). Returns a 1-element array. */
export function atcToolCheckHeaderComments(params = {}) {
    const tol = num(params.tolerance, 0.5), blockHeight = num(params.blockHeight, 50), safeZ = num(params.safeZ, 10);
    const fFast = num(params.f_fast, 300), fSlow = num(params.f_slow, 50);
    return [`Tolerance +/-${tol}mm | Block ${blockHeight}mm | Safe Z ${safeZ}mm | Fast ${fFast} | Slow ${fSlow}`];
}

export function atcToolCheckStack(params = {}) {
    const d = getDialect();
    const toolBase = (d && d.vars && d.vars.toolTable) || 1430;                       // tool-length table base (Expert/DM500 #1430, V4.1 #1560)
    const curTool = '#' + ((d && d.vars && d.vars.atc && d.vars.atc.currentTool) || 1300);
    // t1894 — REFUSE, DON'T GUESS. Same finding + ruling as atcLengthWizard.js's own note (WORK-LOG t1890/t1892/
    // t1894): `curTool` above silently falls back to Expert's #1300 when `vars.atc.currentTool` is unmapped
    // (V4.1/DM500) — confirmed live to reach the preview AND an error message. The measurement (touch-off +
    // length calc) stays register-independent and still runs; only the table LOOKUP/COMPARE, which needs to know
    // which slot to read, is refused.
    const hasCurrentTool = !!(d && d.vars && d.vars.atc && d.vars.atc.currentTool);
    const blockHeight = num(params.blockHeight, 50), safeZ = num(params.safeZ, 10), maxDist = num(params.maxDist, 100);
    const retract = num(params.retract, 3), fFast = num(params.f_fast, 300), fSlow = num(params.f_slow, 50);
    const port = num(params.port, 2), level = num(params.level, 0), tol = num(params.tolerance, 0.5);
    const src = params.sources || {};

    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };
    const A = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; S.push(b); };
    const IF = (l, o, r, g) => { const b = newBlock('ifgoto'); b.params = { lhs: l, op: o, rhs: r, goto: g }; S.push(b); };
    const GO = (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    const DM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; S.push(b); };
    const CF = (msg, cancel) => { const b = newBlock('confirm'); b.params = { msg, cancel }; S.push(b); };
    const PR = (to, feed) => { const b = newBlock('probe'); b.params = { axis: 'Z', to, feed, port: '#5', level }; S.push(b); };
    // t640 — probe-MISS safety (a missed tool-setter re-check writes a WRONG length). ST captures the pre-probe DRO (V4.1/DM500;
    // [] on Expert); CK carries dir '-' + seek '#7' (negative plunge) → the DRO-compare branches to the no-contact fault (LB 1).
    const ST = () => { const b = newBlock('probestart'); b.params = { axis: 'Z' }; S.push(b); };
    const CK = (goto) => { const b = newBlock('probecheck'); b.params = { axis: 'Z', goto, dir: '-', seek: '#7', eps: 0.05 }; S.push(b); };
    const RD = (v) => { const b = newBlock('proberead'); b.params = { axis: 'Z', var: v }; S.push(b); };
    const MV = (axis, v) => { const b = newBlock('move'); b.params = { mode: 'rapid', [axis.toLowerCase()]: v }; S.push(b); };
    const MSG = (text) => { const b = newBlock('message'); b.params = { text }; S.push(b); };
    const END = () => S.push(newBlock('endprogram'));

    C('ATC | Tool Breakage / Length Re-check');
    const [hdr] = atcToolCheckHeaderComments(params);   // ONE format, shared with the twin's postInstantiate recompose
    C(hdr);
    C('Aborts if the tool is broken, missing, or the wrong length. Compares to tool table.');
    C('=== CONFIGURATION ===');
    A('#1', maxDist, 'Max search distance'); A('#2', retract, 'Retract');
    A('#3', fFast, 'Fast approach'); A('#4', fSlow, 'Slow touch');
    A('#5', srcVal(src.setterPort, port), srcNote(src.setterPort, 'Setter port'));
    A('#6', srcVal(src.blockHeight, blockHeight), srcNote(src.blockHeight, 'Tool setter block height'));
    A('#19', safeZ, 'Safe Z'); A('#20', tol, 'Tolerance'); A('#21', '[0-#20]', 'Negative tolerance');
    A('#7', '[0-#1]', 'Negative plunge'); A('#10', '#2', 'Positive retract');

    C('Confirm Start');
    CF('Hover tool over the setter. Press Enter', 2);
    DM('inc');
    C('Fast probe down');
    ST(); PR('#7', '#3'); CK(1); MV('Z', '#10');
    C('Slow precision touch');
    ST(); PR('#7', '#4'); CK(1);
    DM('abs');
    C('Measure + compare to the stored tool length');
    RD('#51');                                // machine Z trigger
    A('#52', '[#51-#6]', 'Measured length = MachineZ - block height');
    if (hasCurrentTool) {
        A('#53', curTool, 'Current tool number');
        IF('#53', '<', '1', 3);
        A('#54', `[${toolBase}+#53-1]`, 'Tool table address');
        A('#55', '#[#54]', 'Expected stored length');
        A('#56', '[#52-#55]', 'Deviation');
        IF('#56', '>', '#20', 4);
        IF('#56', '<', '#21', 4);
        C('Tool OK');
        MV('Z', '#19');                           // retract to safe Z
        MSG('Tool OK - length deviation #56 mm');
        GO(2);
    } else {
        // t1894 — the honest refusal (same reused ⚠-prefixed convention as atcLengthWizard.js's own note — see
        // there for why a G-code comment, not a DOM banner, is the right medium for "the point a user gets G-code").
        C('⚠ REFUSED - Studio has no current-tool register mapped for this controller');
        C('  (UNMAPPED, not unsupported - Studio does not know which register holds the');
        C('  current tool number here, so it cannot look up a stored length to compare).');
        MV('Z', '#19');                           // retract to safe Z
        MSG('Measured #52 mm - NOT compared: no current-tool register mapped on this controller');
        GO(2);
    }

    C('=== FAULT HANDLERS ===');
    LB(1); DM('abs'); A('#1505', '1', 'FAULT: no contact - tool broken or missing'); GO(2);
    if (hasCurrentTool) {
        LB(3); DM('abs'); A('#1505', '1', 'ERROR: no tool number set - check #1300'); GO(2);
        LB(4); DM('abs'); MV('Z', '#19'); A('#1505', '1', 'FAULT: length off by #56 mm - broken or wrong tool'); GO(2);
    }
    LB(2); END();
    return S;
}
