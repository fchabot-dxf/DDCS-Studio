import { test, expect } from '@playwright/test';

/**
 * t1526 — THE SCREENSHOTS: the angled macro head BEFORE and AFTER, and the path it still walks.
 *
 * ⚠ THE "BEFORE" IS GENERATED, NOT REMEMBERED, and that is what makes it trustworthy. It is the emitted macro with
 * the hoist REVERSED — each frame-origin register substituted back into every word that reads it and the assignment
 * removed — which is exactly the inverse `raster-origin-hoist-1526` PROOF 1 uses to show the two walk identically.
 * A screenshot of a text file captured before the change could only say what someone saved; this says what the two
 * renderings ARE, and it cannot go stale.
 *
 * ⚠ AND THE INVERSE WAS CHECKED AGAINST THE REAL PREVIOUS EMIT, not assumed: the generated BEFORE is
 * CHARACTER-FOR-CHARACTER what `git show HEAD:` of this arm emitted for this op (run in node against a checkout of
 * the previous revision, which a browser spec cannot import — the same limitation, and the same answer, as t1514
 * PROOF 7's byte sweep).
 *
 * ⚠ THE NUMBERS ON THE SHOT ARE THE WHOLE MACRO — guards, field reads and all — where `raster-origin-hoist-1526`'s
 * header quotes the ATOM BODY alone. Both are measured; they are different denominators and neither is the other.
 *
 *   1  the macro head, before → after, with the measurement on it
 *   2  the WALKED SIM of the hoisted macro against the slot AS DRAWN — the tool still goes where it went
 */
test.use({ viewport: { width: 1900, height: 1100 } });

// NOT `test-results/` — Playwright wipes that at the start of every run. `verification/` is for things meant to be seen.
const SHOTS = 'verification/t1526-origin-hoist';

const OP = { ax: 5, ay: 10, bx: 45, by: 33, width: 12, toolDia: 6, stepoverPct: 40, depth: 4, stepdown: 1.5,
             entry: 'plunge', rampAngle: 3, feed: 2000, plunge: 150, clearance: 5 };

test('SHOTS — the angled macro head before and after the origin hoist', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    const m = await page.evaluate(async (op) => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const decl = {};
        for (const k of ['ax', 'ay', 'bx', 'by', 'rampAngle']) decl[k] = { exposed: false, value: op[k] };
        decl.entry = { exposed: false, value: op.entry };
        const g = slotFromOp('slot', SLOT_ARM.atom, new Set(), 0, decl);
        const after = g.body.split('\n');
        // the inverse of the act — substitute each hoisted register back and drop its assignment
        const HOIST = /^(#6[23])=(.+?)   \( frame origin /;
        const subs = [], before = [];
        for (const l of after) { const x = HOIST.exec(l); if (x) subs.push([x[1], x[2]]); else before.push(l); }
        const un = before.map((l) => subs.reduce((s, [reg, expr]) =>
            String(s).replace(new RegExp(reg + '(?![0-9])', 'g'), expr), l));
        const wordAt = (s, ax) => { const i = s.indexOf(' ' + ax); if (i < 0) return null;
            let j = i + 2, d = 0, o = ''; while (j < s.length) { const c = s[j];
                if (c === '[') d++; if (c === ']') d--; if (c === ' ' && d === 0) break; o += c; j++; } return o; };
        const stat = (lines) => {
            let words = 0, chars = 0, mult = 0, longest = 0;
            for (const l0 of lines) { const l = String(l0).replace(/\s*\(.*$/, '');
                if (!/^\s*G[01]\s/.test(l)) continue;
                for (const ax of ['X', 'Y']) { const w = wordAt(l, ax); if (w == null) continue;
                    words++; chars += w.length; mult += (w.match(/\*/g) || []).length; longest = Math.max(longest, w.length); } }
            const code = lines.map((l) => String(l).replace(/\s*\(.*$/, '').trimEnd()).filter(Boolean);
            return { words, chars, mult, longest, lines: lines.length,
                     codeChars: code.reduce((n, l) => n + l.length, 0),
                     codeMult: code.reduce((n, l) => n + (l.match(/\*/g) || []).length, 0) };
        };
        const mirrors = {};
        for (const f of g.fields) if (f.idx != null) mirrors['#' + (f.idx + 1500)] = Number(op[f.key] != null ? op[f.key] : f.def);
        return { name: g.name, before: un, after, statBefore: stat(un), statAfter: stat(after), subs: subs.length, mirrors, body: g.body };
    }, OP);

    expect(m.subs, 'the angled pack really hoists both origin axes').toBe(2);
    expect(m.statBefore.chars, 'the un-hoisted words are the long ones').toBeGreaterThan(m.statAfter.chars * 2);

    await page.evaluate((m) => {
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const colour = (l) => (/^\(/.test(l.trim()) ? '#7f8c9b'
            : /^#1505|^N[0-9]|GOTO|^IF/.test(l.trim()) ? '#e0a458'
            : /^\s*G[01] /.test(l) ? '#7fd1a0'
            : /^#6[23]=/.test(l.trim()) ? '#ffd479'
            : /^#\d+=/.test(l.trim()) ? '#9ec5ff' : '#dfe6ef');
        const pane = (title, lines, s, tone) => `<div style="flex:1;min-width:0">
            <div style="font:600 14px system-ui;color:${tone};margin-bottom:6px">${title}</div>
            <div style="color:#8b98a9;font:12px system-ui;margin-bottom:8px">
              ${s.lines} lines · <b>${s.chars}</b> chars in ${s.words} move words · longest word <b>${s.longest}</b> ·
              <b>${s.mult}</b> multiplies in the move words · ${s.codeChars} chars / ${s.codeMult} multiplies in the whole body</div>
            <pre style="margin:0;font:11px/1.4 ui-monospace,Consolas,monospace;white-space:pre;overflow-x:auto;background:#0d1117;border:1px solid #263040;padding:10px">${lines.map((l) => `<span style="color:${colour(l)}">${esc(l) || ' '}</span>`).join('\n')}</pre></div>`;
        const w = document.createElement('div');
        w.id = 't1526shot';
        w.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#12161c;color:#dfe6ef;font:13px/1.5 system-ui,sans-serif;padding:20px;overflow:auto';
        const b = m.statBefore, a = m.statAfter;
        const pc = (x, y) => `−${Math.round((1 - y / x) * 100)}%`;
        w.innerHTML = `<h2 style="margin:0 0 4px">${esc(m.name)} — the packed ANGLED macro, before and after the ORIGIN HOIST (t1526)</h2>
            <div style="color:#8b98a9;margin-bottom:14px;max-width:1500px">A 12mm slot, A(5,10) → B(45,33). On a rotated LIVE frame the origin is the pivot, so it printed in every move word — its own axis at coefficient 1 and, through <code>[I − R]</code>, the other axis's origin beside it. It is constant for the whole program, so it is read ONCE into the frame's own registers (<span style="color:#ffd479">#62 / #63</span>, already the atom's declared band — the act needs no new register).
            <b style="color:#7fd1a0">The geometry does not move</b>: the same ${a.words} move words, proven identical move-for-move by substituting the registers back.</div>
            <div style="display:flex;gap:12px;margin-bottom:14px;font:13px system-ui">
              <div style="padding:8px 14px;background:#1b222c;border-left:3px solid #7fd1a0">move-word characters <b>${b.chars} → ${a.chars}</b> <span style="color:#7fd1a0">${pc(b.chars, a.chars)}</span></div>
              <div style="padding:8px 14px;background:#1b222c;border-left:3px solid #7fd1a0">longest word <b>${b.longest} → ${a.longest}</b> <span style="color:#7fd1a0">${pc(b.longest, a.longest)}</span></div>
              <div style="padding:8px 14px;background:#1b222c;border-left:3px solid #7fd1a0">multiplies per move <b>${(b.mult / b.words).toFixed(1)} → ${(a.mult / a.words).toFixed(1)}</b> <span style="color:#7fd1a0">${pc(b.mult, a.mult)}</span></div>
              <div style="padding:8px 14px;background:#1b222c;border-left:3px solid #7fd1a0">whole body <b>${b.codeChars} → ${a.codeChars}</b> chars <span style="color:#7fd1a0">${pc(b.codeChars, a.codeChars)}</span></div>
            </div>
            <div style="display:flex;gap:16px;align-items:flex-start">
              ${pane('BEFORE — the origin rides every word', m.before, b, '#e0a458')}
              ${pane('AFTER — the origin is read once into #62 / #63', m.after, a, '#7fd1a0')}
            </div>`;
        document.body.appendChild(w);
        window.scrollTo(0, 0);
    }, m);
    await page.screenshot({ path: `${SHOTS}/1-macro-head-before-after.png`, fullPage: true });

    // ── SHOT 2: the WALKED SIM of the hoisted macro, against the slot AS DRAWN ─────────────────────────────────
    const sim = await page.evaluate(async ({ body, mirrors }) => {
        const { traceToolpath } = await import('/engine/trace.js');
        const seed = Object.keys(mirrors).map((k) => `${k}=${mirrors[k]}`).join('\n');
        const res = traceToolpath(seed + '\n' + body, { traceStepCap: 400000 });
        const segs = (res.segments || []).map((s) => ({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, cut: !s.rapid }));
        return { segs, n: segs.length, cuts: segs.filter((s) => s.cut).length };
    }, { body: m.body, mirrors: m.mirrors });
    expect(sim.n, 'the engine traces a path out of the HOISTED macro — the registers resolve').toBeGreaterThan(10);
    expect(sim.cuts, '…with cutting moves in it').toBeGreaterThan(4);

    await page.evaluate(({ sim: s, op }) => {
        const w = document.getElementById('t1526shot');
        const PAD = 40, SC = 15;
        const xs = s.segs.flatMap((g) => [g.x1, g.x2]), ys = s.segs.flatMap((g) => [g.y1, g.y2]);
        const minX = Math.min(...xs, op.ax, op.bx) - 10, maxX = Math.max(...xs, op.ax, op.bx) + 10;
        const minY = Math.min(...ys, op.ay, op.by) - 10, maxY = Math.max(...ys, op.ay, op.by) + 10;
        const W = (maxX - minX) * SC + PAD * 2, H = (maxY - minY) * SC + PAD * 2;
        const X = (v) => PAD + (v - minX) * SC, Y = (v) => H - PAD - (v - minY) * SC;
        const path = s.segs.map((g) => `<line x1="${X(g.x1)}" y1="${Y(g.y1)}" x2="${X(g.x2)}" y2="${Y(g.y2)}" stroke="${g.cut ? '#5fbf7f' : '#3d5570'}" stroke-width="${g.cut ? 2 : 1}" ${g.cut ? '' : 'stroke-dasharray="4 4"'}/>`).join('');
        const dx = op.bx - op.ax, dy = op.by - op.ay, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, hw = op.width / 2;
        const wall = (k) => `<line x1="${X(op.ax + nx * k)}" y1="${Y(op.ay + ny * k)}" x2="${X(op.bx + nx * k)}" y2="${Y(op.by + ny * k)}" stroke="#e0a458" stroke-width="1.5" stroke-dasharray="7 5"/>`;
        w.innerHTML = `<h2 style="margin:0 0 4px">THE WALKED SIM of the HOISTED macro — the app's own engine trace (t1526)</h2>
            <div style="color:#8b98a9;margin-bottom:14px">${s.n} segments (${s.cuts} cutting). Green = cut · dashed blue = rapid ·
            <span style="color:#e0a458">amber dashed = the slot AS DRAWN</span> (A→B ± width/2). The engine resolves the frame-origin registers exactly as the controller will, and the passes still lie ALONG the drawn channel — which is the point: the hoist changed how the words are written, not where the tool goes.</div>
            <svg width="${W}" height="${H}" style="background:#0d1117;border:1px solid #263040">${path}${wall(hw)}${wall(-hw)}
            <circle cx="${X(op.ax)}" cy="${Y(op.ay)}" r="4" fill="#ff6b6b"/><text x="${X(op.ax) + 8}" y="${Y(op.ay) - 6}" fill="#ff6b6b" font-size="13">A</text>
            <circle cx="${X(op.bx)}" cy="${Y(op.by)}" r="4" fill="#ff6b6b"/><text x="${X(op.bx) + 8}" y="${Y(op.by) - 6}" fill="#ff6b6b" font-size="13">B</text></svg>`;
        window.scrollTo(0, 0);
    }, { sim, op: OP });
    await page.screenshot({ path: `${SHOTS}/2-walked-sim.png` });

    console.log(`t1526 shots → ${SHOTS}  (1-macro-head-before-after.png · 2-walked-sim.png)`);
    console.log(`move words ${m.statBefore.chars} → ${m.statAfter.chars} chars · longest ${m.statBefore.longest} → ${m.statAfter.longest} · multiplies ${m.statBefore.mult} → ${m.statAfter.mult} · sim ${sim.n} segments (${sim.cuts} cutting)`);
});
