import { test, expect } from '@playwright/test';

/**
 * t1514 (C5) — THE SCREENSHOTS the act was dispatched with, and the payoff is the first one: an ANGLED wide slot,
 * PACKED. t1510 measured this exact shape emitting a clean axis-aligned channel with its 30° silently gone, and
 * t1512 had to refuse it at the gate. It packs now, and the sim is the proof an operator can see.
 *
 *   1  the field table for an ANGLED packed slot — the live knobs, the greyed baked frame, no refusal beneath it
 *   2  the macro head — the baked bearing/length, the #2600 reads, and the cross-terms in the first move
 *   3  the WALKED SIM — the app's own execution-engine trace of that macro, drawn against the slot it was drawn as
 */
test.use({ viewport: { width: 1500, height: 1000 } });

// NOT `test-results/` — Playwright wipes it at the start of every run. `verification/` is for things meant to be seen.
const SHOTS = 'verification/t1514-live-frame-rotation';

const OP = { ax: 5, ay: 10, bx: 45, by: 33, width: 12, toolDia: 6, stepoverPct: 40, depth: 4, stepdown: 1.5,
             entry: 'plunge', rampAngle: 3, feed: 2000, plunge: 150, clearance: 5 };

test('SHOTS — an ANGLED wide slot, packed, and the path it really walks', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    const seeded = await page.evaluate(async (op) => {
        const { seedFromOp, camTypeOf, slotPackArm } = await import('/data/opCamMap.js');
        const { slotRasterParams } = await import('/wizards/ops/slot.js');
        const { slotLeafParams } = await import('/wizards/slotWizard.js');
        const gate = camTypeOf({ opType: 'user_slot_data', params: op });
        const seed = seedFromOp({ opType: 'user_slot_data', params: op });
        return {
            camType: (seed || {}).camType, arm: slotPackArm(op), refusal: gate.unsupported || '',
            bearing: slotRasterParams(slotLeafParams(op)).bearing,
            length: slotRasterParams(slotLeafParams(op)).w,
            rows: (seed.fields || []).map((f) => ({ key: f.key, label: f.label, value: f.value, units: f.units || '',
                baked: f.bakeOnly === true || f._branch === true || f.exposed === false,
                why: f.bakeOnly ? 'BAKED — build-time geometry' : (f._branch ? 'BAKED — build-time pick' : 'LIVE #2600 knob') })),
        };
    }, OP);
    expect(seeded.camType, 'the ANGLED wide slot seeds the slot generator').toBe('slot');
    expect(seeded.arm, '…on the PACKED arm — this is what C5 bought').toBe('atom');
    expect(seeded.refusal, '…with no refusal at all').toBe('');
    expect(seeded.bearing, 'and it really is angled').toBeGreaterThan(5);

    // ── SHOT 1: the field table an operator reads ──────────────────────────────────────────────────────────────
    await page.evaluate((s) => {
        const w = document.createElement('div');
        w.id = 't1514shot';
        w.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#12161c;color:#dfe6ef;font:13px/1.5 system-ui,sans-serif;padding:24px;overflow:auto';
        const rows = s.rows.map((r) => `<tr style="${r.baked ? 'opacity:.55' : ''}">
            <td style="padding:5px 12px;border-bottom:1px solid #263040">${r.key}</td>
            <td style="padding:5px 12px;border-bottom:1px solid #263040">${r.label}</td>
            <td style="padding:5px 12px;border-bottom:1px solid #263040;text-align:right">${r.value}</td>
            <td style="padding:5px 12px;border-bottom:1px solid #263040;color:#8b98a9">${r.units}</td>
            <td style="padding:5px 12px;border-bottom:1px solid #263040;font-weight:600;color:${r.baked ? '#e0a458' : '#5fbf7f'}">${r.why}</td></tr>`).join('');
        w.innerHTML = `<h2 style="margin:0 0 4px">CAM slot — field table, packed arm at a BEARING (t1514, C5)</h2>
            <div style="color:#8b98a9;margin-bottom:16px">A 12mm-wide slot, A(5,10) → B(45,33): bearing ${s.bearing.toFixed(3)}°, length ${s.length.toFixed(3)}mm.
            Until C5 this shape was REFUSED at the gate — the atom dropped the angle and cut an axis-aligned channel (t1510).</div>
            <table style="border-collapse:collapse;min-width:900px"><thead><tr style="text-align:left;color:#8b98a9">
            <th style="padding:5px 12px">key</th><th style="padding:5px 12px">label</th><th style="padding:5px 12px;text-align:right">value</th><th style="padding:5px 12px">units</th><th style="padding:5px 12px">disposition</th>
            </tr></thead><tbody>${rows}</tbody></table>
            <div style="margin-top:20px;padding:12px 16px;background:#1b222c;border-left:3px solid #5fbf7f;max-width:1100px">
            <b style="color:#5fbf7f">PACKS — no refusal.</b><div style="margin-top:6px;color:#b9c4d1">The clearing IS the parametric raster atom, turned to the slot's own bearing. The four endpoints bake with the bearing and length they derive (ATAN/SQRT are not available on this controller); every other value is a pendant knob.</div></div>`;
        document.body.appendChild(w);
    }, seeded);
    await page.screenshot({ path: `${SHOTS}/1-angled-packs.png` });

    // ── SHOT 2: the macro head — the baked frame, the #2600 reads, and the first rotated move ──────────────────
    const macro = await page.evaluate(async (op) => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const decl = {};
        for (const k of ['ax', 'ay', 'bx', 'by', 'rampAngle']) decl[k] = { exposed: false, value: op[k] };
        decl.entry = { exposed: false, value: op.entry };
        const g = slotFromOp('slot', SLOT_ARM.atom, new Set(), 0, decl);
        const mirrors = {};
        for (const f of g.fields) if (f.idx != null) mirrors['#' + (f.idx + 1500)] = Number(op[f.key] != null ? op[f.key] : f.def);
        return { name: g.name, body: g.body, mirrors };
    }, OP);
    expect(macro.body, 'the macro head states the baked bearing and length').toMatch(/is BAKED, with the bearing/);
    await page.evaluate((m) => {
        const w = document.getElementById('t1514shot');
        const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const lines = m.body.split('\n');
        const colour = (l) => /^\(/.test(l.trim()) ? '#7f8c9b' : /^#1505|^N[0-9]|GOTO|^IF/.test(l.trim()) ? '#e0a458'
            : /^\s*G[01] |^\s*G0 /.test(l) ? '#7fd1a0' : /^#\d+=/.test(l.trim()) ? '#9ec5ff' : '#dfe6ef';
        w.innerHTML = `<h2 style="margin:0 0 4px">${esc(m.name)} — the packed ANGLED macro (t1514)</h2>
            <div style="color:#8b98a9;margin-bottom:14px">${lines.length} lines. Blue = register assignment · green = motion · amber = guard/flow · grey = comment.
            Every motion word carries CROSS-TERMS: the frame-origin registers and the row register, each multiplied by a BUILD-TIME cosine.
            <b>t1526:</b> the origin is READ ONCE into #62/#63 at the top — it used to ride every word as a full expression (see verification/t1526-origin-hoist/1-macro-head-before-after.png).</div>
            <pre style="margin:0;font:12px/1.45 ui-monospace,Consolas,monospace;white-space:pre">${lines.map((l) => `<span style="color:${colour(l)}">${esc(l) || ' '}</span>`).join('\n')}</pre>`;
        window.scrollTo(0, 0);
    }, macro);
    await page.screenshot({ path: `${SHOTS}/2-macro-head.png` });

    /**
     * ── SHOT 3: THE WALKED SIM, through the APP'S OWN engine ───────────────────────────────────────────────────
     *
     * `traceToolpath` is the one toolpath source every preview in this app uses — it resolves #vars, follows the
     * IF/GOTO loops and returns the route the execution engine really takes. The pendant mirrors are prepended as
     * plain assignments, which is exactly what the controller holds when the operator has dialled them.
     *
     * Drawn against the slot AS DRAWN (A→B with its width), so the shot answers the question t1510 raised: does the
     * channel lie on the line the operator drew, or beside it?
     */
    const sim = await page.evaluate(async ({ m, op }) => {
        const { traceToolpath } = await import('/engine/trace.js');
        const seed = Object.keys(m.mirrors).map((k) => `${k}=${m.mirrors[k]}`).join('\n');
        const res = traceToolpath(seed + '\n' + m.body, { traceStepCap: 400000 });
        const segs = (res.segments || []).map((s) => ({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, cut: !s.rapid }));
        return { segs, n: segs.length, cuts: segs.filter((s) => s.cut).length,
                 stats: res.stats || null, bounds: res.bounds || null };
    }, { m: macro, op: OP });
    expect(sim.n, 'the engine really traced a path out of the parametric macro').toBeGreaterThan(10);
    expect(sim.cuts, '…with cutting moves in it').toBeGreaterThan(4);

    await page.evaluate(({ sim: s, op }) => {
        const w = document.getElementById('t1514shot');
        const PAD = 40, SC = 15;
        const xs = s.segs.flatMap((g) => [g.x1, g.x2]), ys = s.segs.flatMap((g) => [g.y1, g.y2]);
        const minX = Math.min(...xs, op.ax, op.bx) - 10, maxX = Math.max(...xs, op.ax, op.bx) + 10;
        const minY = Math.min(...ys, op.ay, op.by) - 10, maxY = Math.max(...ys, op.ay, op.by) + 10;
        const W = (maxX - minX) * SC + PAD * 2, H = (maxY - minY) * SC + PAD * 2;
        const X = (v) => PAD + (v - minX) * SC, Y = (v) => H - PAD - (v - minY) * SC;
        const path = s.segs.map((g) => `<line x1="${X(g.x1)}" y1="${Y(g.y1)}" x2="${X(g.x2)}" y2="${Y(g.y2)}" stroke="${g.cut ? '#5fbf7f' : '#3d5570'}" stroke-width="${g.cut ? 2 : 1}" ${g.cut ? '' : 'stroke-dasharray="4 4"'}/>`).join('');
        // the slot AS DRAWN: the A→B centreline and its two walls
        const dx = op.bx - op.ax, dy = op.by - op.ay, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, hw = op.width / 2;
        const wall = (k) => `<line x1="${X(op.ax + nx * k)}" y1="${Y(op.ay + ny * k)}" x2="${X(op.bx + nx * k)}" y2="${Y(op.by + ny * k)}" stroke="#e0a458" stroke-width="1.5" stroke-dasharray="7 5"/>`;
        w.innerHTML = `<h2 style="margin:0 0 4px">THE WALKED SIM — the app's own engine trace of the packed ANGLED macro (t1514)</h2>
            <div style="color:#8b98a9;margin-bottom:14px">${s.n} segments (${s.cuts} cutting). Green = cut · dashed blue = rapid ·
            <span style="color:#e0a458">amber dashed = the slot AS DRAWN</span> (A→B ± width/2). The passes lie ALONG the drawn channel — before C5 this same macro walked an axis-aligned channel through the rotated origin.</div>
            <svg width="${W}" height="${H}" style="background:#0d1117;border:1px solid #263040">${path}${wall(hw)}${wall(-hw)}
            <circle cx="${X(op.ax)}" cy="${Y(op.ay)}" r="4" fill="#ff6b6b"/><text x="${X(op.ax) + 8}" y="${Y(op.ay) - 6}" fill="#ff6b6b" font-size="13">A</text>
            <circle cx="${X(op.bx)}" cy="${Y(op.by)}" r="4" fill="#ff6b6b"/><text x="${X(op.bx) + 8}" y="${Y(op.by) - 6}" fill="#ff6b6b" font-size="13">B</text></svg>`;
        window.scrollTo(0, 0);
    }, { sim, op: OP });
    await page.screenshot({ path: `${SHOTS}/3-walked-sim.png` });

    console.log(`t1514 shots → ${SHOTS}  (1-angled-packs.png · 2-macro-head.png · 3-walked-sim.png)`);
    console.log(`bearing ${seeded.bearing.toFixed(3)}° · length ${seeded.length.toFixed(3)}mm · sim ${sim.n} segments (${sim.cuts} cutting)`);
});
