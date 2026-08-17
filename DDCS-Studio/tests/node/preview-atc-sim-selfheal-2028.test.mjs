import { test, expect } from './support/harness.mjs';
import { registerUserOp, simIntentFromStack } from '../../web/blocks/userOps.js';
import { atcChangeDataDef } from '../../web/blocks/dataOps/atcChangeData.js';
import { atcTableDataDef } from '../../web/blocks/dataOps/atcTableData.js';
import { atcTestDataDef } from '../../web/blocks/dataOps/atcTestData.js';
import { atcWarmupDataDef } from '../../web/blocks/dataOps/atcWarmupData.js';
import { atcCheckDataDef } from '../../web/blocks/dataOps/atcCheckData.js';
import { atcLengthDataDef } from '../../web/blocks/dataOps/atcLengthData.js';

/**
 * t2028 — THE TIER-1 "collapse", ATC's stale positional `def.sim` (PREVIEW-AS-DATA.md Tier-1 #10). A DIFFERENT
 * repair shape from contour_data's boundary collapse (a missing SELF-HEAL write-back, not a duplicated
 * formula): `userOpFromStack`'s 6th positional arg sets `def.sim` in its OWN vocabulary
 * (`forceMachine`/`showMagazine`/`toolMachineFrame`), but every ATC stack embeds its OWN `sim` block in a
 * DIFFERENT key vocabulary (`machine`/`magazine`/`toolMachine`) which `resolveSimMeta`/`simIntentFromStack`
 * ALWAYS prefers when present — confirmed live (real mismatch, not a survey guess): `atc_change_data`'s
 * positional arg says `forceMachine:true`; its stack's own sim block never sets `machine` at all (relies on
 * `toolMachine` implying it elsewhere, per the file's own t646 comment) — `simIntentFromStack` correctly
 * resolves `forceMachine:false`, but pre-fix `def.sim` stayed frozen at the stale `true` forever, because
 * (unlike `def.panel`, which already self-corrects one line above) nothing wrote the resolved value back.
 *
 * The fix mirrors `def.panel = resolvePanelMeta(def)` exactly: `def.sim = sim.intent` right after
 * `resolveSimMeta` computes it (`userOps.js`, `registerUserOp`). Not a new declaration — `simIntentFromStack`
 * already normalises the stack block into the SAME shape the positional arg uses, so this is a straight
 * write-back, not a new vocabulary (Fork 1 stays void).
 */

test('atc_change_data: def.sim self-heals to the STACK\'s own resolved intent, not the stale positional literal', () => {
    const def = atcChangeDataDef();
    const stale = def.sim;   // { forceMachine: true, ... } — what userOpFromStack set from the raw positional arg
    const registered = registerUserOp(def);
    // THE CONCRETE, LIVE MISMATCH: the positional arg claims forceMachine:true; the stack's own sim block never
    // sets `machine` at all, so the resolved truth is forceMachine:false — the exact gap this fix closes.
    expect(stale.forceMachine, 'sanity: the raw positional arg really did claim forceMachine:true').toBe(true);
    expect(registered.sim.forceMachine, 'def.sim now reflects what the stack (and thus the renderer) actually resolves').toBe(false);
    expect(registered.sim).toEqual(simIntentFromStack(registered.template));
});

test('atc_table_data: the SAME stale-positional shape, independently confirmed', () => {
    const def = atcTableDataDef();
    const stale = def.sim;
    const registered = registerUserOp(def);
    expect(stale.forceMachine, 'sanity: same positional claim as atc_change_data').toBe(true);
    expect(registered.sim.forceMachine, 'self-healed the same way').toBe(false);
    expect(registered.sim).toEqual(simIntentFromStack(registered.template));
});

test('every ATC op\'s registered def.sim equals its OWN stack\'s resolved intent — swept, not hand-picked', () => {
    const defs = [atcChangeDataDef(), atcTableDataDef(), atcTestDataDef(), atcWarmupDataDef(), atcCheckDataDef(), atcLengthDataDef()];
    const wrong = [];
    for (const raw of defs) {
        const registered = registerUserOp(raw);
        const wantFromStack = simIntentFromStack(registered.template);
        if (wantFromStack === null || wantFromStack === undefined) continue;   // this op declares no stack sim block — def.sim's own fallback shape doesn't apply here
        if (JSON.stringify(registered.sim) !== JSON.stringify(wantFromStack)) {
            wrong.push(`${registered.opType}: def.sim=${JSON.stringify(registered.sim)} != stack-resolved=${JSON.stringify(wantFromStack)}`);
        }
    }
    expect(wrong, wrong.join('\n')).toEqual([]);
});
