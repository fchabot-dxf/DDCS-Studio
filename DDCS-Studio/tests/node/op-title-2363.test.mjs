import { test, expect } from './support/harness.mjs';
import { builderOf, makeOp, registerOpLabel, removeOpLabel, _builderAtoms } from '../../web/blocks/opBuilders.js';
import { emitMapped, newBlock } from '../../web/blocks/blockEmitter.js';
import { registerUserOp } from '../../web/blocks/userOps.js';
import { cornerDataDef, CORNER_DATA_OPTYPE } from '../../web/blocks/dataOps/cornerData.js';

/**
 * t2363 — THE OP TITLE IS A MISSING DECLARATION. `opBuilders.js`'s makeOp already stamps a friendly, never-empty
 * `label` on every op container; blockEmitter.js's op-container branch used to throw it away. This file proves
 * the fix at the pure-emit level (no DOM needed — see harness.mjs's own header): a title line for every op,
 * a hand-pushed richer title WINS (never doubled), the two mistitled Mechanism-B ops (pocket/slot) get the
 * correct generic label ABOVE their own borrowed banner, and a paren-bearing user-op label can't break the line.
 */

const bare = (opType, params) => {
    const framed = builderOf(opType)(params || {});
    return framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
};
const op = (opType, params) => makeOp(opType, params, bare(opType, params));
const firstLines = (opC, n = 3) => emitMapped([opC]).text.split(/\r?\n/).filter((l) => l.trim()).slice(0, n);

test('a SILENT op (no hand-pushed title anywhere) now emits its own generic title line, first', () => {
    const lines = firstLines(op('contour', {}));
    expect(lines[0]).toBe('( Contour )');
});

test('a SILENT op with no built-in OP_LABELS entry falls back to a real friendly label, not the raw opType', () => {
    // wcs is one of the "silent six" the dispatch named.
    const lines = firstLines(op('wcs', {}));
    expect(lines[0]).toBe('( WCS )');
});

test('a HAND-PUSHED, richer title (corner) WINS — the generic label is not also emitted, no doubling', () => {
    const lines = firstLines(op('corner', {}), 6);
    // corner's own first line is its own rich banner (cornerWizard.js's mkC/hdr1) — never the bare "( Corner Probe )".
    expect(lines[0]).not.toBe('( Corner Probe )');
    expect(lines[0]).toMatch(/^\( Corner /);
    // and the generic label never appears anywhere as its OWN separate line either — it was suppressed, not just reordered.
    expect(lines).not.toContain('( Corner Probe )');
});

test('a HAND-PUSHED title BURIED TWO WRAPPERS DEEP (corner as its real user_corner_data TWIN — user_root > section > comment) still WINS, no doubling', () => {
    // The exact shape that broke first: builderOf('user_corner_data')(params) self-wraps in `user_root`, whose
    // own EXECUTION mouth's first child is a `section` (also transparent-at-emit), then an `sc_corner` struct-
    // control block (authoring-only, structCtl.js's own `emit: () => []`) BEFORE the real comment — three
    // layers deep, none of them `children[0].type`, none of them a plain "does line 0 look like a comment"
    // check either (both were tried and both broke a different case — see blockEmitter.js's own account).
    // Found live via a 4-pixel screenshot diff on this exact op's own G-code line-count readout
    // (screenshot-baselines-1792.spec.js).
    const def = registerUserOp(cornerDataDef());
    const atoms = _builderAtoms(CORNER_DATA_OPTYPE, {});
    expect(atoms[0] && atoms[0].type, 'sanity: the wrapper IS still user_root at children[0] — the bug is real if this ever changes').toBe('user_root');
    const opC = makeOp(CORNER_DATA_OPTYPE, {}, atoms);
    const lines = firstLines(opC, 3);
    expect(lines[0]).toMatch(/^\( Corner \|/);   // corner's own rich banner, unchanged
    expect(lines).not.toContain(`( ${def.label} )`);   // the generic label never sneaks in as a SEPARATE line
});

test('a HAND-PUSHED title (homing) WINS the same way', () => {
    const lines = firstLines(op('homing', { axes: ['Z'] }), 4);
    expect(lines[0]).toMatch(/^\( HOMING/);
    expect(lines).not.toContain('( Homing )');
});

test('MECHANISM B — pocket: the generic label now sits ABOVE its own borrowed "DRILL" banner (an improvement, not a lie)', () => {
    // The too-small arm (pocket == tool size, degenerates to a single centre plunge) is what borrows
    // holecycle's DRILL banner (surveyed at holecycle.js:508); force it.
    const lines = firstLines(op('pocket', { w: 6, h: 6, toolDia: 6, depth: 1 }), 4);
    expect(lines[0], 'the correct generic label leads').toBe('( Pocket )');
    expect(lines.some((l) => /DRILL/.test(l)), 'the pre-existing (mistitled) banner is still there, just no longer alone').toBe(true);
});

test('MECHANISM B — slot: the generic label now sits ABOVE its own borrowed "AREA CLEARING" banner', () => {
    // Wide enough relative to the tool to ride the raster arm (slotStackRidesRaster) rather than the literal kernel.
    const lines = firstLines(op('slot', { ax: 0, ay: 0, bx: 30, by: 0, width: 14, toolDia: 6, depth: 2 }), 4);
    expect(lines[0], 'the correct generic label leads').toBe('( Slot )');
    expect(lines.some((l) => /AREA CLEARING/.test(l)), 'the pre-existing borrowed banner is still there too').toBe(true);
});

test('THE HAZARD — a paren-bearing user-op label is sanitized at the emit seam, never nests', () => {
    // registerOpLabel is exactly what userOps.js:1031 (registerUserOp) calls with the AUTHOR'S OWN free-text
    // def.label — the real path a custom-wizard name reaches USER_LABELS through. A user can type anything,
    // parens included; DDCS comments cannot nest (bridge/controllers/COMMENT-CHARACTERS.md §1), so the emit
    // seam (not the authoring UI) is where this must be caught.
    const opType = 'user_t2363_paren_test';
    registerOpLabel(opType, 'Weird (label) name');
    try {
        const opC = makeOp(opType, {}, [newBlock('progstart')]);   // any non-empty children — the label is what's under test
        const line = emitMapped([opC]).text.split(/\r?\n/)[0];
        expect(line, 'parens stripped, not nested — the DDCS "comments cannot nest" rule').toBe('( Weird label name )');
        expect(line.match(/\(/g).length, 'exactly one opening paren').toBe(1);
        expect(line.match(/\)/g).length, 'exactly one closing paren').toBe(1);
    } finally {
        removeOpLabel(opType);
    }
});

test('a WRAPPER op with no real declared label (multi_step, the import-time grouping wrapper) stays SILENT — no `( multi_step )` lie', () => {
    // Found live via the .nc round-trip Playwright spec (op-title-realsymptom-2363.spec.js): programModel.js's
    // groupConsecutiveOps wraps several real ops in ONE multi_step container on reimport; multi_step has no
    // OP_LABELS/USER_LABELS entry, so makeOp's own label falls back to the raw opType string 'multi_step' —
    // titling that literally would be a NEW, worse lie than the silence it replaced.
    const inner = op('contour', {});
    const wrapper = makeOp('multi_step', { steps: 1 }, [inner]);
    const lines = emitMapped([wrapper]).text.split(/\r?\n/).filter((l) => l.trim());
    expect(lines[0], 'the wrapper itself emits no title — the FIRST line is the real inner op\'s own title').toBe('( Contour )');
    expect(lines).not.toContain('( multi_step )');
});

test('an op with NO children emits nothing at all — no title over an empty op', () => {
    const opC = makeOp('contour', {}, []);
    expect(emitMapped([opC]).text.trim()).toBe('');
});
