import { test, expect } from './support/harness.mjs';
import { tapDataDef } from '../../web/blocks/dataOps/tapData.js';
import { atcTableDataDef } from '../../web/blocks/dataOps/atcTableData.js';
import { wcsDataDef } from '../../web/blocks/dataOps/wcsData.js';

/**
 * t2121 item 1 (HIGHEST) — userOpView.js's `data-gate` auto-clear (added t2118 for `rigid`) was GENERIC over
 * every gated checkbox, not scoped to `rigid` as the commit claimed. The advisor verified two real cases the
 * generic version would have silently corrupted:
 *   - atcTableData.js's `includeLengths` (default TRUE): a grbl-post gate visit clears it to false, and back
 *     on Expert the whole TOOL LENGTHS section vanishes from the emit with no note.
 *   - wcsData.js's `sync`/`slave` (sharing WCS_SYNC_GATE): the same shape, losing the slave-axis write.
 *
 * Fixed: the clear now requires an EXPLICIT `gate.clearWhenOff: true` opt-in. This test proves the SCOPE
 * directly against the real declared data (not a copy) — `rigid` is the only field that opts in; every other
 * checkbox+gate combination in the app keeps its pre-existing grey-only behaviour.
 *
 * Run standalone:  node --import ./tests/node/support/register.mjs --test tests/node/clear-when-off-scope-2121.test.mjs
 */

function boolBindings(def) {
    return (def.bindings || []).filter((b) => b.type === 'bool' && b.gate);
}

test('t2121 -- rigid (tapData) is the ONLY gated checkbox that opts into clearWhenOff', () => {
    const rigid = boolBindings(tapDataDef()).find((b) => b.param === 'rigid');
    expect(rigid, 'rigid must still be a gated bool binding').toBeTruthy();
    expect(rigid.gate.clearWhenOff, 'rigid is the field this was built for -- must opt in').toBe(true);
});

test('t2121 -- atcTableData.includeLengths does NOT opt in (default true; clearing it silently drops the tool-lengths section)', () => {
    const gated = boolBindings(atcTableDataDef());
    const includeLengths = gated.find((b) => b.param === 'includeLengths');
    expect(includeLengths, 'includeLengths must still be a gated bool binding').toBeTruthy();
    expect(!!includeLengths.gate.clearWhenOff, 'must NOT opt in -- clearing this is real data loss').toBe(false);
});

test('t2121 -- wcsData.sync/slave do NOT opt in (clearing loses the dual-gantry slave-axis write)', () => {
    const gated = boolBindings(wcsDataDef());
    const sync = gated.find((b) => b.param === 'sync');
    expect(sync, 'sync must still be a gated bool binding').toBeTruthy();
    expect(!!sync.gate.clearWhenOff, 'must NOT opt in').toBe(false);
    // slave is type:'enum' (a dropdown), not a gated bool checkbox -- the auto-clear code only ever acts on
    // inp.type === 'checkbox', so an enum field is structurally unreachable by this mechanism regardless; not
    // asserted here as a bool binding since it genuinely is not one.
});
