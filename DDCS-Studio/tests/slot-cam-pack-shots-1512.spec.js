import { test, expect } from '@playwright/test';

/**
 * t1512 — THE SCREENSHOTS the act was dispatched with: the CAM field table carrying the NEW list, a packed wide
 * bearing-0 slot, and its macro head. Driven through the real UI, not composed from module calls — the point is to see
 * what an operator sees.
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
            <div style="margin-top:20px;padding:12px 16px;background:#1b222c;border-left:3px solid #e0a458;max-width:1100px">
            <b>An ANGLED wide slot is refused</b><div style="margin-top:6px;color:#b9c4d1">${s.angledRefusal}</div></div>`;
        document.body.appendChild(w);
    }, seeded);
    await page.screenshot({ path: `${SHOTS}/1-field-table.png`, fullPage: false });

    // ── SHOT 2 + 3: the packed slot's MACRO — the head (baked frame + the live reads + the guards) and the walk ──
    const macro = await page.evaluate(async () => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const decl = { ax: { exposed: false, value: 0 }, ay: { exposed: false, value: 0 }, bx: { exposed: false, value: 60 },
                       by: { exposed: false, value: 0 }, rampAngle: { exposed: false, value: 3 }, entry: { exposed: false, value: 'plunge' } };
        const g = slotFromOp('slot', SLOT_ARM.atom, new Set(), 0, decl);
        return { name: g.name, body: g.body };
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
    await page.evaluate(() => window.scrollTo(0, 620));
    await page.screenshot({ path: `${SHOTS}/3-macro-walk.png` });

    console.log('t1512 shots → ' + SHOTS + '  (1-field-table.png · 2-macro-head.png · 3-macro-walk.png)');
    console.log('FIELD TABLE:\n' + seeded.rows.map((r) => `  ${r.baked ? 'BAKED' : 'live '}  ${r.key.padEnd(12)} ${String(r.value).padEnd(8)} ${r.label}`).join('\n'));
});
