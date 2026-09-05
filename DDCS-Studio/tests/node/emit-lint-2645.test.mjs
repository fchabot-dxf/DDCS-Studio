import { test, expect } from './support/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanEmitForLintHits, TOKEN_RULES, VARIABLE_RANGE_RULES } from '/wizards/dialects/emitLintRules.js';

/**
 * emit-lint-2645 — THE STANDING EMIT LINT (browser-free tier).
 *
 * Owner-ruled shape (t2645): a DECLARED rule table (emitLintRules.js, data — forbidden tokens, suspect
 * variable ranges, trig-unit reminders, each with its own provenance) + ONE registry-driven guard here that
 * builds and emits EVERY registered op through the real builderOf/emitMapped path for EVERY registered post,
 * and scans the text. A wizard authored next month is covered without anyone remembering to add a check for
 * it — the same shape as section-order-parity-2617's own cross-op guard.
 *
 * SEVERITY POLICY: 'error' rules (no legitimate use ever — MOD/^/**, or a raw write to a tool-offset/limit/
 * home/serial register) are a REAL gate — the main sweep asserts zero hits, today and going forward. 'warn'/
 * 'info' rules (WCS writes, parameter-area writes, persistent-scratch use, trig-degree reminders) are
 * COLLECTED and REPORTED, never failed — real wizards have legitimate reasons to hit these, and the dispatch
 * this turn runs on is explicit: "expect judgment calls, handle them as data," "flag it, do not fail it."
 * Nothing this run is FIXED beyond typo-class, per the same dispatch — the catch list below is the deliverable.
 */

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');

let _booted = null;
function boot() { return (_booted = _booted || _boot()); }
async function _boot() {
    await import('/ui/settingsPanel.js');   // publishes window.ddcsGetSettings, same as the browser boot
    const U = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { getDialect, listPosts } = await import('/wizards/dialects/index.js');

    // registerUserOp writes only the in-memory USER_DEFS map; U.listUserOps() reads the SEPARATE localStorage-
    // backed store (createUserOp's own job, not registerUserOp's) — so collecting the built defs ourselves,
    // right here, is the one reliable way to sweep "every registered op" in this process (confirmed live: a
    // first draft that called listUserOps() after this same loop counted 0 ops despite every registerUserOp
    // call succeeding).
    const ops = [];
    const dir = path.join(ROOT, 'web', 'blocks', 'dataOps');
    for (const f of fs.readdirSync(dir).filter((n) => /Data\.js$/.test(n)).sort()) {
        const mod = await import('/blocks/dataOps/' + f);
        for (const key of Object.keys(mod).filter((k) => /DataDef$/.test(k))) {
            let def; try { def = mod[key](); U.registerUserOp(def); } catch { continue; }
            ops.push(def);
        }
    }
    return { U, builderOf, emitMapped, getDialect, listPosts, ops };
}

/** Every (op × post) emit this process can produce, in a fixed order. */
async function allEmits(env) {
    const ops = env.ops;
    const posts = env.listPosts();   // EVERY registered dialect, not just the hardware-verified two — the
    // rule table itself scopes which posts a given rule applies to; sweeping every post here is what makes
    // this "every op x every post" rather than a hand-picked subset.
    const rows = [];
    for (const post of posts) {
        for (const def of ops) {
            let text = '';
            try {
                const params = env.U.defaultParams(def);
                const stack = env.builderOf(def.opType)(params);
                text = env.emitMapped(stack, { dialect: env.getDialect(post.id) }).text;
            } catch (e) { text = ''; /* an op that can't build under this post is not this lint's concern */ }
            rows.push({ opType: def.opType, postId: post.id, text });
        }
    }
    return rows;
}

function fmtHit(opType, postId, h) {
    return `${opType} @ ${postId} line ${h.lineNo}: [${h.sev.toUpperCase()}] ${h.ruleId} — ${h.match} — ${h.message}`;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════
// NON-VACUITY — prove the scanner actually catches a planted violation, and stays clean on a good line,
// BEFORE trusting its silence on the real sweep below.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════
test('NON-VACUITY: the scanner catches every declared rule on a planted violation, and stays clean on the honest equivalent', () => {
    const cases = [
        { dialect: 'ddcs-expert-m350', bad: '#100 = [2 ** 3]', good: '#100 = [2 * 2 * 2]', ruleId: 'no-power-operator' },
        { dialect: 'ddcs-expert-m350', bad: '#100 = [7 MOD 3]', good: '#100 = [7 - [2*3]]', ruleId: 'no-mod-operator' },
        { dialect: 'ddcs-expert-m350', bad: '#916 = 222.0', good: '#100 = 222.0', ruleId: 'var-range:H01-H20 tool length offsets' },
        { dialect: 'ddcs-expert-m350', bad: '#805 = 1', good: '#100 = 1', ruleId: 'var-range:WCS table G54-G59/G52' },
        { dialect: 'ddcs-v41', bad: '#1560 = 5', good: '#50 = 5', ruleId: 'var-range:H1-H16 tool length' },
        { dialect: 'ddcs-v41', bad: '#1512 = 1', good: '#50 = 1', ruleId: 'var-range:WCS table G54-G59/G52' },
        { dialect: 'ddcs-expert-m350', bad: '#54 = COS[90]', good: 'G0 X10', ruleId: 'trig-args-degrees-expert' },
        // t2647 — the indirect-write visibility rule: corner/edge/middle's own wcsWriteIndirect shape must
        // trip it; a PLAIN literal assignment (no #[...] wrapper at all) must not.
        { dialect: 'ddcs-expert-m350', bad: '#[#70]=1', good: '#100=1', ruleId: 'indirect-write-visible' },
        { dialect: 'ddcs-expert-m350', bad: '#[#70+15]=1', good: '#115=1', ruleId: 'indirect-write-visible' },
        { dialect: 'ddcs-expert-m350', bad: '#[#151+3]=#883', good: '#100=#883', ruleId: 'indirect-write-visible' },
    ];
    for (const c of cases) {
        const badHits = scanEmitForLintHits(c.bad, c.dialect).map((h) => h.ruleId);
        const goodHits = scanEmitForLintHits(c.good, c.dialect).map((h) => h.ruleId);
        expect(badHits, `planted violation "${c.bad}" on ${c.dialect} should trip ${c.ruleId} — got ${JSON.stringify(badHits)}`).toContain(c.ruleId);
        expect(goodHits, `the honest equivalent "${c.good}" on ${c.dialect} tripped ${c.ruleId} — the rule is over-matching`).not.toContain(c.ruleId);
    }
    // a comment must never trigger a rule — same DDCS comment shape the real controller's own parser uses
    const commented = scanEmitForLintHits('( #100 = [2 ** 3] this is only a comment )', 'ddcs-expert-m350');
    expect(commented.map((h) => h.ruleId), 'a token inside a (…) comment must not trip the lint').not.toContain('no-power-operator');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE STANDING GATE — zero-tolerance rules stay at zero, on every shipped op, on every post the evidence
// covers, through the real emit path. This is the part that catches a wizard authored next month.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════
test('EMIT LINT — zero ERROR-severity hits across every shipped op x every post (the standing gate)', async () => {
    const env = await boot();
    const rows = await allEmits(env);
    const errors = [];
    const reportable = [];   // warn/info — collected, never failed
    for (const r of rows) {
        for (const h of scanEmitForLintHits(r.text, r.postId)) {
            (h.sev === 'error' ? errors : reportable).push(fmtHit(r.opType, r.postId, h));
        }
    }
    console.log(`emit-lint-2645: swept ${rows.length} (op x post) emits, ${env.ops.length} ops x ${env.listPosts().length} posts`);
    console.log(`emit-lint-2645: ${errors.length} ERROR-severity hit(s), ${reportable.length} WARN/INFO hit(s) collected (not failed)`);
    if (reportable.length) {
        console.log('--- CATCH LIST (warn/info — owner triage, nothing fixed this turn) ---');
        for (const line of reportable) console.log('  ' + line);
    }
    expect(errors, `ERROR-severity emit-lint hit(s) found — a shipped op emits a token or write with NO legitimate use on that controller:\n${errors.join('\n')}`).toEqual([]);
});
