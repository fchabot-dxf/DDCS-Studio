import { test, expect } from './support/harness.mjs';

/**
 * O-WORD BALANCE on flow:'oword' posts (rs274/grbl) — t646 (polish item 5, from the t632 flag). The GOTO-skip idiom maps
 * ifGoto→`o<n> if`, label→`o<n> endif`. When a wizard's ifGoto FOLDS on a post with no equivalent (comm's confirm has no
 * cancel signal on rs274 → its cancel jump emits nothing) its matching `label` would leave an ORPHAN `o<n> endif` that the
 * LinuxCNC/grblHAL parser rejects. emitMapped's balanceOwords drops the orphans. This asserts the emitted program is
 * o-word BALANCED (every endif closes an if, no stragglers), incl. the o-number COLLISION case the old Set logic mishandled.
 */

// balance check: walk the o-words as a stack; return {balanced, maxDepth, endBalance}. balanced ⟺ every endif closed an
// open if of its number AND every if was closed.
function owordBalance(text) {
    const open = [];
    let orphanEndif = 0;
    for (const raw of text.split('\n')) {
        const s = raw.trim();
        let m = s.match(/^o(\d+)\s+if\b/);
        if (m) { open.push(m[1]); continue; }
        m = s.match(/^o(\d+)\s+endif$/);
        if (!m) continue;
        let k = -1;
        for (let j = open.length - 1; j >= 0; j--) if (open[j] === m[1]) { k = j; break; }
        if (k >= 0) open.splice(k, 1); else orphanEndif++;
    }
    return { balanced: orphanEndif === 0 && open.length === 0, orphanEndif, unclosedIf: open.length };
}

test('rs274: the comm popup (OK/Cancel + Binary) emits BALANCED o-words — no orphan endif', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { commStack } = await import('/wizards/communicationWizard.js');
        const { emitMapped, newBlock } = await import('/blocks/blockEmitter.js');
        const { getDialect } = await import('/wizards/dialects/index.js');
        const d = getDialect('rs274ngc');
        const mode1 = emitMapped(commStack({ type: 'popup', popupMode: 1, msg: 'Continue?' }), { dialect: d }).text;
        const mode3 = emitMapped(commStack({ type: 'popup', popupMode: 3, msg: 'A or B?' }), { dialect: d }).text;
        // COLLISION: a REAL o9 pair (ifgoto/label) SEQUENTIALLY followed by the comm popup (whose cancel label also uses 9)
        const ig = newBlock('ifgoto'); ig.params = { lhs: '#100', op: '>', rhs: '0', goto: 9 };
        const lb = newBlock('label'); lb.params = { n: 9 };
        const collide = emitMapped([ig, lb, ...commStack({ type: 'popup', popupMode: 1, msg: 'Continue?' })], { dialect: d }).text;
        return { mode1, mode3, collide };
    });
    expect(owordBalance(r.mode1).balanced, `mode1 balanced: ${JSON.stringify(owordBalance(r.mode1))}\n${r.mode1}`).toBe(true);
    expect(owordBalance(r.mode3).balanced, `mode3 balanced: ${JSON.stringify(owordBalance(r.mode3))}\n${r.mode3}`).toBe(true);
    // the collision stays balanced AND the REAL o9 pair survives (the orphan is what gets dropped)
    const cb = owordBalance(r.collide);
    expect(cb.balanced, `collision balanced: ${JSON.stringify(cb)}\n${r.collide}`).toBe(true);
    expect(r.collide, 'the real o9 if/endif pair survives the balance pass').toContain('o9 if [#100 le 0]');
    expect((r.collide.match(/^o9 endif$/gm) || []).length, 'exactly ONE o9 endif remains (the orphan comm cancel label dropped)').toBe(1);
});
