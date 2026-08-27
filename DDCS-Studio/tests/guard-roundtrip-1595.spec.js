import { test, expect } from '@playwright/test';
import { waitReady } from './_boot.js';

/**
 * t1595 — THE CANVAS CAN CARRY A STRUCTURAL FORK.
 *
 * A `guard` holds ONE ARM of a structural fork and is unwrapped or dropped at build by its `when` predicate. The
 * Blockly bridge could hold neither half of that: `isWrap` had no 'guard', so `recToJson` wrote every guard CHILDLESS
 * and discarded the arm inside it, and the guard declared no fields, so its predicate could not round-trip either.
 * Measured on Corner: 1157 blocks handed to the canvas, 98 back, 371 guards down to 30 — and the reproject wrote
 * that loss into the live program. It is why forking any guarded wizard was refused (t1593).
 *
 *   guard now declares  whenparam · whenis · whentype   (three fields, because the type is DECLARED, never inferred)
 *   guard now renders   a DO mouth holding its arm
 *
 * ⚠ WHY THE NUMERIC SWEEP IN fork-parity-1593 CANNOT SEE THIS. That spec moves every numeric value off its default
 * and compares emitted G-code byte for byte — and it passed for 18 twins while every one of the other 14 was losing
 * arms. A guard chooses an ARM, and arms are selected by STRUCTURAL params. So the probe that actually closes this
 * flips the structural params and asks the same byte-identity question. If any arm was dropped or damaged on the way
 * through the canvas, some flip diverges.
 */

// ⚠ Rendering a guard's arms means Corner now puts 1852 Blockly blocks on the canvas instead of 111 — measured
// ~2.6s to build and ~5.1s to settle, alone. Under the suite's six workers those numbers stretch. t2233 —
// every readiness wait below goes through waitReady() (tests/_boot.js), which disables waitForFunction's own
// timeout so the test's own test.setTimeout() is the sole authority — no more per-file guess that has to stay
// ahead of the config's 5s actionTimeout default (the previous 60000ms literals here were exactly that guess).
// This spec opens the two largest wizards in the registry, fourteen times.

// t1718 made the comment above's load-sensitivity gate-readable via a per-spec retry; t1724 retired that in
// favor of a config-level policy (playwright.config.js's `retries`) — a fixed list of "these specs get
// retries" goes stale every run as the starved population shifts (measured at t1719).

const boot = async (page) => {
    await page.goto('/', { timeout: 60000 });
    // t2351 — the app's own declared "everything is wired" signal (t1279), not a hand-picked global subset —
    // see wizard-face-1599's own boot() for the full trace of why this class of wait was silently racy.
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await waitReady(page, () => !!window.__blkws);
};

/** Open a wizard to customize, and wait for the CANVAS TO SETTLE rather than for a fixed number of milliseconds —
 *  a 2.2s sleep that was ample for a 111-block corner is a coin flip for an 1852-block one on a loaded machine. */
const customize = async (page, opType) => {
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.evaluate((x) => window.ddcsEditWizardDef(x), opType);
    await waitReady(page, () => {
        const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op');
        return !!(op && (op.children || []).length) && window.__blkws.getAllBlocks().length > 0;
    });
    let last = -1;
    for (let i = 0; i < 120; i++) {                       // block count stops changing → the reproject has landed
        const n = await page.evaluate(() => window.__blkws.getAllBlocks().length);
        if (n === last && n > 0) return n;
        last = n;
        await page.waitForTimeout(250);
    }
    return last;
};

/** The real "Save wizard…" gesture, with waits that survive a loaded machine. */
const saveAs = async (page, name) => {
    await page.evaluate(() => window.ddcsSaveAsWizard());
    const field = page.locator('.blk-dev-savedlg .blk-dev-opname');
    await field.waitFor({ state: 'visible', timeout: 30000 });
    await field.fill(name, { timeout: 30000 });
    await page.click('.blk-dev-savedlg .blk-dev-save', { timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector('.blk-dev-savedlg'), null, { timeout: 30000 });
};

test('the canvas round-trips a guarded template LOSSLESSLY — every guard, every arm, every predicate', async ({ page }) => {
    test.setTimeout(300_000);
    page.on('dialog', (d) => d.accept());
    await boot(page);
    const guardedTwins = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        return U.listUserOps().map((d) => d.opType)
            .filter((t) => { const d = U.getUserDef(t); return d && U.flattenBlocks(d.template || []).some((b) => b && b.type === 'guard'); });
    });
    expect(guardedTwins.length, 'there are guarded twins to round-trip').toBeGreaterThanOrEqual(14);

    const rows = [];
    for (const t of guardedTwins) {
        await customize(page, t);
        rows.push(await page.evaluate(async (src) => {
            const U = await import('/blocks/userOps.js');
            const D = await import('/blocks/devMode.js');
            // what the canvas was HANDED (the same call editWizardDef makes) vs what came back through the reproject
            const want = D.wrapRecognizedForFork(U.getUserDef(src)).template;
            const op = window.ddcsGetBlockProgram().find((b) => b && b.type === 'op');
            const got = (op && op.children) || [];
            const guards = (x) => U.flattenBlocks(x).filter((b) => b && b.type === 'guard');
            // THE ARMS, which is what was actually being lost: the blocks a guard CONTAINS. Counting guards alone
            // missed five twins whose guards came back present and empty (t1593's own wrong first measure).
            const arms = (x) => U.flattenBlocks(x).reduce((n, b) => n + ((b && b.type === 'guard' && b.children) ? U.flattenBlocks(b.children).length : 0), 0);
            // …and the PREDICATES, in order — the half that had no fields to ride in at all
            const preds = (x) => guards(x).map((b) => {
                const w = b.params && b.params.when;
                return w ? `${w.param}=${JSON.stringify(w.is)}` : '(none)';
            }).join(',');
            return {
                opType: src,
                wantLen: U.flattenBlocks(want).length, gotLen: U.flattenBlocks(got).length,
                wantGuards: guards(want).length, gotGuards: guards(got).length,
                wantArms: arms(want), gotArms: arms(got),
                wantPreds: preds(want), gotPreds: preds(got),
            };
        }, t));
    }

    for (const r of rows) {
        expect(r.gotLen, `${r.opType}: no block is lost through the canvas`).toBe(r.wantLen);
        expect(r.gotGuards, `${r.opType}: every guard survives`).toBe(r.wantGuards);
        expect(r.gotArms, `${r.opType}: every block INSIDE a guard survives — the arms are the thing`).toBe(r.wantArms);
        // types included: `is` is compared through JSON, so a boolean that came back as the string "true", or the
        // number 1 as "1", fails here. whenOk compares with ===, so either would silently drop an arm at build.
        expect(r.gotPreds, `${r.opType}: every predicate survives WITH ITS TYPE`).toBe(r.wantPreds);
    }
    // the headline case, named individually so "green" is not the only evidence
    const corner = rows.find((r) => r.opType === 'user_corner_data');
    expect(corner.wantArms, 'corner really is the extreme case (it was 2956 arm blocks → one damaged arm)').toBeGreaterThan(2000);
});

test('THE SWEEP THAT CLOSES IT — flip every STRUCTURAL param on every guarded twin; source and fork emit BYTE-IDENTICALLY', async ({ page }) => {
    test.setTimeout(600_000);
    page.on('dialog', (d) => d.accept());
    await boot(page);
    const twins = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        return U.listUserOps().map((d) => d.opType)
            .filter((t) => { const d = U.getUserDef(t); return d && U.flattenBlocks(d.template || []).some((b) => b && b.type === 'guard'); });
    });

    const rows = [];
    for (let i = 0; i < twins.length; i++) {
        await customize(page, twins[i]);
        await saveAs(page, 'Gf' + i);
        rows.push(await page.evaluate(async ([src, n]) => {
            const U = await import('/blocks/userOps.js');
            const s = U.getUserDef(src), c = U.getUserDef('user_gf' + n);
            if (!c) return { opType: src, saved: false };
            const { emitProgram } = await import('/blocks/blockEmitter.js');
            // ── THE VALUES TO FLIP, FROM TWO SOURCES, BECAUSE EITHER ALONE LEAVES A HOLE ──────────────────────────
            // (1) EVERY `when.is` IN THE TEMPLATE. By definition each names a value some arm exists for, so sweeping
            //     them visits arms no declared option list mentions.
            // (2) EVERY STRUCTURAL BINDING through its own values. Needed because a guard may key on a DERIVED key —
            //     homing's `_runZ`, pocket's `_tooSmall` — that def.deriveGuards COMPUTES from a param with a
            //     different name. Source (1) alone left FIVE of the fourteen twins (atc change/table, homing,
            //     io_step, slot) with ZERO flips: their forks are all derived-keyed, so the sweep sailed past the
            //     wizards it was supposed to test hardest. Flipping `run_z` is what moves `_runZ`.
            const byParam = new Map();
            const add = (p, v) => { if (!byParam.has(p)) byParam.set(p, new Set()); byParam.get(p).add(JSON.stringify(v)); };
            for (const b of U.flattenBlocks(s.template || [])) {
                if (b && b.type === 'guard' && b.params && b.params.when) add(b.params.when.param, b.params.when.is);
            }
            for (const b of (s.bindings || [])) {
                if (!b || b.blockIndex != null) continue;                       // structural = drives the prune, not a socket
                if (b.type === 'bool') { add(b.param, true); add(b.param, false); }
                const opts = (b.widgetConfig && b.widgetConfig.options) || null;
                if (opts) for (const o of opts) add(b.param, Array.isArray(o) ? o[1] : o);
            }
            const settable = new Set((s.bindings || []).map((b) => b.param));
            const base = U.defaultParams(s);
            const flips = [], skipped = [];
            for (const [param, vals] of byParam) {
                if (!settable.has(param)) { skipped.push(param); continue; }   // a DERIVED guard key — computed, never set
                for (const v of vals) flips.push({ param, value: JSON.parse(v) });
            }
            const diffs = [], errors = [];
            for (const f of flips) {
                const P = { ...base, [f.param]: f.value };
                try {
                    const a = emitProgram(U.instantiate(s, P));
                    const b = emitProgram(U.instantiate(c, P));
                    if (a !== b) diffs.push(`${f.param}=${JSON.stringify(f.value)} (${a.split('\n').length} vs ${b.split('\n').length} lines)`);
                } catch (e) { errors.push(`${f.param}=${JSON.stringify(f.value)}: ${(e && e.message) || e}`); }
            }
            return { opType: src, saved: true, flips: flips.length, diffs, errors, skipped: [...new Set(skipped)] };
        }, [twins[i], i]));
    }

    let totalFlips = 0;
    for (const r of rows) {
        expect(r.saved, `${r.opType}: the fork saved`).toBe(true);
        expect(r.errors, `${r.opType}: no flip throws`).toEqual([]);
        expect(r.diffs, `${r.opType}: source and fork emit BYTE-IDENTICALLY under every structural flip`).toEqual([]);
        totalFlips += r.flips;
    }
    for (const r of rows) console.log(`${r.opType.padEnd(24)} flips=${String(r.flips).padStart(3)} derived-skipped=${(r.skipped || []).join(',') || '-'}`);
    console.log(`structural flips swept: ${totalFlips} across ${rows.length} twins`);

    // ⚠ NOT A SILENT CAP. A guard may key on a DERIVED key (pocket's `_tooSmall`, homing's `_runZ`) that def.deriveGuards
    // COMPUTES from other params — there is no param to set, so those forks are only exercised indirectly, by flipping
    // what they derive from. That is a weaker claim than the byte-identity above and it is named rather than hidden.
    const derived = [...new Set(rows.flatMap((r) => r.skipped || []))].sort();
    console.log(`derived guard keys NOT directly swept (${derived.length}): ${derived.join(', ')}`);

    // …and this is the sharp end of it: a twin whose structural forks are ENTIRELY derived-keyed gets no direct flip
    // at all. Pinned as an exact set, the way t1591 pinned the hidden-but-load-bearing blocks, so the list cannot grow
    // quietly and a twin cannot drop OUT of the sweep unnoticed by having its last settable structural param removed.
    const noDirect = rows.filter((r) => r.flips === 0).map((r) => r.opType).sort();
    expect(noDirect, 'the twins whose structural forks are ALL derived-keyed — exercised only indirectly').toEqual(['user_slot_data']);
    expect(totalFlips, 'the sweep is substantial, not a token flip or two').toBeGreaterThan(40);
});
