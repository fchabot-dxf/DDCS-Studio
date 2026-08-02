import { test, expect } from '@playwright/test';

/**
 * t1512 — THE SCREENSHOTS the act was dispatched with: the CAM field table carrying the NEW list, a packed wide
 * bearing-0 slot, and its macro head. Driven through the real UI, not composed from module calls — the point is to see
 * what an operator sees.
 *
 * ── ⚠ t1528 — TWO THINGS WERE WRONG WITH THESE ARTEFACTS, and both were invisible because nobody compares a PNG ────
 *
 * 1. SHOT 3 WAS SHOT 2. It scrolled the window and screenshot again, but the shot surface is a `position:fixed;
 *    inset:0; overflow:auto` overlay — scrolling the window does nothing to it — so `3-macro-walk.png` was
 *    BYTE-IDENTICAL to `2-macro-head.png` and had never shown a walk. Found with `cmp`. It is the real sim now (see
 *    below): a wrong label on a verification artefact is worse than a missing one, because a reviewer reading
 *    "macro-walk" concludes the walk was checked.
 *
 * 2. THE COMMITTED PNGs WERE **STALE, NOT NONDETERMINISTIC**, which is the opposite of what their behaviour looked
 *    like. They kept turning up dirty after any suite run, so the working assumption was font/AA/frame-timing noise.
 *    Measured instead of assumed: two consecutive runs produce BYTE-IDENTICAL files, and diffing the macro this shot
 *    renders against the revision the PNG was committed at (5bcb19fa) names the change to the line — the declared
 *    Depth default went `=5` to `=4` when t1516 gave the slot its own seeds, and nobody re-ran the shot. So the
 *    committed image had been advertising a default the code no longer emits. Refreshed here, and worth the note:
 *    a screenshot that drifts from its subject is the same defect class as a comment that does.
 */
test.use({ viewport: { width: 1500, height: 1000 } });

// NOT `test-results/` — Playwright wipes that directory at the start of every run, so a shot captured for a reviewer
// disappears the next time anyone runs the suite. `verification/` is where this repo keeps things meant to be looked at.
const SHOTS = 'verification/t1512-cam-pack';

test('SHOTS — the packed wide slot in the real CAM builder', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // Seed a WIDE, bearing-0 slot op into the program, then open the CAM builder on it. The op is inserted through the
    // same authoring path the app uses, so the table below is the real seed rather than a fixture.
    const seeded = await page.evaluate(async () => {
        const { seedFromOp, camTypeOf, slotPackArm } = await import('/data/opCamMap.js');
        const params = { ax: 0, ay: 0, bx: 60, by: 0, width: 12, toolDia: 6, stepoverPct: 40, depth: 4,
                         stepdown: 1.5, entry: 'plunge', rampAngle: 3, feed: 2000, plunge: 150, clearance: 5 };
        const op = { opType: 'user_slot_data', params };
        const seed = seedFromOp(op);
        const angled = camTypeOf({ opType: 'user_slot_data', params: { ...params, bx: 0, by: 60 } });
        return {
            camType: (seed || {}).camType, arm: slotPackArm(params),
            // the REAL disposition, not just `bakeOnly`: a build-enum row (`entry`) is baked too, and labelling it live
            // would make the screenshot say the opposite of what the table says — the class of thing this act is about
            rows: (seed.fields || []).map((f) => ({ key: f.key, label: f.label, value: f.value, units: f.units || '',
                                                    baked: f.bakeOnly === true || f._branch === true || f.exposed === false,
                                                    why: f.bakeOnly ? 'BAKED — build-time geometry' : (f._branch ? 'BAKED — build-time pick' : 'LIVE #2600 knob') })),
            angledRefusal: angled.unsupported || '',
        };
    });
    expect(seeded.camType, 'the wide slot seeds the slot generator').toBe('slot');
    expect(seeded.arm, '…on the packed arm').toBe('atom');

    // ── SHOT 1: the FIELD TABLE, rendered as the operator reads it (live rows vs greyed baked rows) ──
    await page.evaluate((s) => {
        const w = document.createElement('div');
        w.id = 't1512shot';
        w.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#12161c;color:#dfe6ef;font:13px/1.5 system-ui,sans-serif;padding:24px;overflow:auto';
        const rows = s.rows.map((r) => `<tr style="${r.baked ? 'opacity:.55' : ''}">
            <td style="padding:5px 12px;border-bottom:1px solid #263040">${r.key}</td>
            <td style="padding:5px 12px;border-bottom:1px solid #263040">${r.label}</td>
            <td style="padding:5px 12px;border-bottom:1px solid #263040;text-align:right">${r.value}</td>
            <td style="padding:5px 12px;border-bottom:1px solid #263040;color:#8b98a9">${r.units}</td>
            <td style="padding:5px 12px;border-bottom:1px solid #263040;font-weight:600;color:${r.baked ? '#e0a458' : '#5fbf7f'}">${r.why}</td></tr>`).join('');
        w.innerHTML = `<h2 style="margin:0 0 4px">CAM slot — field table, packed arm (t1512)</h2>
            <div style="color:#8b98a9;margin-bottom:16px">A 12mm-wide slot, A(0,0) → B(60,0). Its clearing IS the parametric raster atom.</div>
            <table style="border-collapse:collapse;min-width:900px"><thead><tr style="text-align:left;color:#8b98a9">
            <th style="padding:5px 12px">key</th><th style="padding:5px 12px">label</th><th style="padding:5px 12px;text-align:right">value</th><th style="padding:5px 12px">units</th><th style="padding:5px 12px">disposition</th>
            </tr></thead><tbody>${rows}</tbody></table>
            <div style="margin-top:20px;padding:12px 16px;background:#1b222c;border-left:3px solid ${s.angledRefusal ? '#e0a458' : '#5fbf7f'};max-width:1100px">
            <b>An ANGLED wide slot</b><div style="margin-top:6px;color:#b9c4d1">${s.angledRefusal
                || 'PACKS, since t1514 (C5, the live-frame rotation). At t1512 this box carried a refusal — the atom could not turn a register origin, so an angled slot would have cut an axis-aligned channel. See verification/t1514-live-frame-rotation/.'}</div></div>`;
        document.body.appendChild(w);
    }, seeded);
    await page.screenshot({ path: `${SHOTS}/1-field-table.png`, fullPage: false });

    // ── SHOT 2 + 3: the packed slot's MACRO — the head (baked frame + the live reads + the guards) and the walk ──
    const macro = await page.evaluate(async () => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const OPV = { ax: 0, ay: 0, bx: 60, by: 0, width: 12, toolDia: 6, stepoverPct: 40, depth: 4,
                      stepdown: 1.5, entry: 'plunge', rampAngle: 3, feed: 2000, plunge: 150, clearance: 5 };
        const decl = { ax: { exposed: false, value: 0 }, ay: { exposed: false, value: 0 }, bx: { exposed: false, value: 60 },
                       by: { exposed: false, value: 0 }, rampAngle: { exposed: false, value: 3 }, entry: { exposed: false, value: 'plunge' } };
        const g = slotFromOp('slot', SLOT_ARM.atom, new Set(), 0, decl);
        // t1528 — the pendant mirrors, so shot 3 can actually WALK this macro (see below)
        const mirrors = {};
        for (const f of g.fields) if (f.idx != null) mirrors['#' + (f.idx + 1500)] = Number(OPV[f.key] != null ? OPV[f.key] : f.def);
        return { name: g.name, body: g.body, mirrors, op: OPV };
    });
    expect(macro.body, 'the macro head states the baked frame in the operator\'s terms').toMatch(/is BAKED, with the bearing/);
    await page.evaluate((m) => {
        const w = document.getElementById('t1512shot');
        const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const lines = m.body.split('\n');
        const colour = (l) => /^\(/.test(l.trim()) ? '#7f8c9b' : /^#1505|^N[0-9]|GOTO|^IF/.test(l.trim()) ? '#e0a458'
            : /^\s*G[01] |^\s*G0 /.test(l) ? '#7fd1a0' : /^#\d+=/.test(l.trim()) ? '#9ec5ff' : '#dfe6ef';
        w.innerHTML = `<h2 style="margin:0 0 4px">${esc(m.name)} — the packed macro (t1512)</h2>
            <div style="color:#8b98a9;margin-bottom:14px">${lines.length} lines. Blue = register assignment · green = motion · amber = guard/flow · grey = comment.</div>
            <pre style="margin:0;font:12px/1.45 ui-monospace,Consolas,monospace;white-space:pre">${lines.map((l) => `<span style="color:${colour(l)}">${esc(l) || ' '}</span>`).join('\n')}</pre>`;
    }, macro);
    await page.screenshot({ path: `${SHOTS}/2-macro-head.png`, clip: { x: 0, y: 0, width: 1500, height: 1000 } });

    /**
     * ── ⚠ t1528 — SHOT 3 BECOMES THE WALK IT HAS ALWAYS BEEN CALLED ───────────────────────────────────────────────
     *
     * It used to be `window.scrollTo(0, 620)` followed by a second screenshot — and it never moved, because the shot
     * surface is a `position:fixed; inset:0; overflow:auto` overlay: scrolling the WINDOW does nothing to it. So
     * `3-macro-walk.png` was BYTE-IDENTICAL to `2-macro-head.png` and had never once shown a walk. Found by `cmp`,
     * not by looking, which is the tell — a shot nobody compares is a caption nobody checks.
     *
     * This project treats a WRONG LABEL as a defect rather than a cosmetic (the same rule that gave t1404's collapse
     * guard its own message), and a verification artifact is the last place to leave one: a reviewer reading
     * "macro-walk" concludes the walk was checked. So it is the sim now, driven exactly as t1526's own walk shot
     * drives it — `traceToolpath`, the one toolpath source every preview in this app uses, with the pendant mirrors
     * prepended as plain assignments, which is what the controller holds when the operator has dialled them.
     *
     * The bearing-0 case is the point HERE: an axis-aligned packed slot's channel must lie along A→B with no angle
     * at all, which is what t1512 shipped and what t1514's rotation had to leave byte-identical.
     */
    const sim = await page.evaluate(async ({ body, mirrors }) => {
        const { traceToolpath } = await import('/engine/trace.js');
        const seed = Object.keys(mirrors).map((k) => `${k}=${mirrors[k]}`).join('\n');
        const res = traceToolpath(seed + '\n' + body, { traceStepCap: 400000 });
        const segs = (res.segments || []).map((s) => ({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, cut: !s.rapid }));
        return { segs, n: segs.length, cuts: segs.filter((s) => s.cut).length };
    }, { body: macro.body, mirrors: macro.mirrors });
    expect(sim.n, 'the engine really traced a path out of the packed macro').toBeGreaterThan(10);
    expect(sim.cuts, '…with cutting moves in it').toBeGreaterThan(4);
    /**
     * The bearing-0 claim, asserted and not merely drawn: NO DIAGONALS. Every cutting move changes X or Y, never
     * both — the passes run along the slot and the step-overs run across it.
     *
     * ⚠ My first cut of this asserted the stronger "every cutting move holds Y constant", which is FALSE and the
     * walk said so: the step-over between rows happens AT DEPTH (that is the whole point of the both-ways walk —
     * one plunge per level), so it is a G1, it cuts, and it moves in Y. The assertion was wrong, not the emit.
     */
    expect(sim.segs.filter((s) => s.cut).filter((s) => Math.abs(s.x1 - s.x2) > 1e-6 && Math.abs(s.y1 - s.y2) > 1e-6),
        'bearing 0: not one cutting move is diagonal — passes along, step-overs across, no angle anywhere').toEqual([]);

    await page.evaluate(({ sim: s, op }) => {
        const w = document.getElementById('t1512shot');
        const PAD = 40, SC = 12;
        const xs = s.segs.flatMap((g) => [g.x1, g.x2]), ys = s.segs.flatMap((g) => [g.y1, g.y2]);
        const minX = Math.min(...xs, op.ax, op.bx) - 10, maxX = Math.max(...xs, op.ax, op.bx) + 10;
        const minY = Math.min(...ys, op.ay, op.by) - 10, maxY = Math.max(...ys, op.ay, op.by) + 10;
        const W = (maxX - minX) * SC + PAD * 2, H = (maxY - minY) * SC + PAD * 2;
        const X = (v) => PAD + (v - minX) * SC, Y = (v) => H - PAD - (v - minY) * SC;
        const path = s.segs.map((g) => `<line x1="${X(g.x1)}" y1="${Y(g.y1)}" x2="${X(g.x2)}" y2="${Y(g.y2)}" stroke="${g.cut ? '#5fbf7f' : '#3d5570'}" stroke-width="${g.cut ? 2 : 1}" ${g.cut ? '' : 'stroke-dasharray="4 4"'}/>`).join('');
        const dx = op.bx - op.ax, dy = op.by - op.ay, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, hw = op.width / 2;
        const wall = (k) => `<line x1="${X(op.ax + nx * k)}" y1="${Y(op.ay + ny * k)}" x2="${X(op.bx + nx * k)}" y2="${Y(op.by + ny * k)}" stroke="#e0a458" stroke-width="1.5" stroke-dasharray="7 5"/>`;
        w.innerHTML = `<h2 style="margin:0 0 4px">THE WALKED SIM — the app's own engine trace of the packed bearing-0 macro (t1512)</h2>
            <div style="color:#8b98a9;margin-bottom:14px">${s.n} segments (${s.cuts} cutting). Green = cut · dashed blue = rapid ·
            <span style="color:#e0a458">amber dashed = the slot AS DRAWN</span> (A→B ± width/2). Wall to wall, layer by layer, on the line that was drawn — the atom clearing a channel that used to need its own emitter.
            <b>t1528:</b> this shot was a duplicate of the macro head until now (a scroll that never moved a fixed overlay); it is the walk it was always called.</div>
            <svg width="${W}" height="${H}" style="background:#0d1117;border:1px solid #263040">${path}${wall(hw)}${wall(-hw)}
            <circle cx="${X(op.ax)}" cy="${Y(op.ay)}" r="4" fill="#ff6b6b"/><text x="${X(op.ax) + 8}" y="${Y(op.ay) - 6}" fill="#ff6b6b" font-size="13">A</text>
            <circle cx="${X(op.bx)}" cy="${Y(op.by)}" r="4" fill="#ff6b6b"/><text x="${X(op.bx) + 8}" y="${Y(op.by) - 6}" fill="#ff6b6b" font-size="13">B</text></svg>`;
        window.scrollTo(0, 0);
    }, { sim, op: macro.op });
    await page.screenshot({ path: `${SHOTS}/3-macro-walk.png` });

    console.log('t1512 shots → ' + SHOTS + '  (1-field-table.png · 2-macro-head.png · 3-macro-walk.png)');
    console.log(`WALK: ${sim.n} segments (${sim.cuts} cutting)`);
    console.log('FIELD TABLE:\n' + seeded.rows.map((r) => `  ${r.baked ? 'BAKED' : 'live '}  ${r.key.padEnd(12)} ${String(r.value).padEnd(8)} ${r.label}`).join('\n'));
});
