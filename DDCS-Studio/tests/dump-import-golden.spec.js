import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { readF64, parseEng, byNameIndices, controllerFromParamCount, mapExpertGeometry, mapExpertWcs, mapByNameGeometry, mapCoordWcs, mapSpindle, parseDm500ByName } from '../web/data/dumpImport.js';

/**
 * CROSS-LANGUAGE GOLDEN (t666). The Studio JS dump mapper (data/dumpImport.js) must reproduce the EXACT values the
 * gateway's Python mapper pins (bridge/bridge-app/tests/test_pull_geometry.py) — same fixtures, same numbers — so the
 * two can never drift. Pure Node (no browser): reads the repo dump fixtures + runs the JS mapper.
 */
const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'bridge', 'controllers');
const bytes = (p) => readFileSync(join(repo, p));
const text = (p) => readFileSync(join(repo, p), 'utf8');
const EXPERT_SETTING = 'expert-m350/assets/capture/20260610T163337Z/SYSDISK/setting';
const EXPERT_ENG = 'expert-m350/assets/capture/20260610T163337Z/SYSDISK/eng';
const V41_SETTING = 'v4.1/assets/setting';
const V41_ENG = 'v4.1/assets/firmware/ddcs v4.1/ddcsv4(2025-04-04)/ddcsv4(2025-04-04)/ddcsv4/eng';
const V41_COORD1 = 'v4.1/assets/system-backup/current/coord1';
const DM500_SETTING = 'dm500/setting';
const DM500_ENG = 'dm500/install/eng';

test('Expert-M350 geometry == the Python goldens (756 / 776 / feeds 2000/150)', () => {
    const p = readF64(bytes(EXPERT_SETTING));
    expect(p.length, '1000 params').toBe(1000);
    expect(controllerFromParamCount(p.length)).toBe('ddcs-expert-m350');
    const g = mapExpertGeometry(p);
    expect(g.travel.x).toBe(756.0);
    expect(g.travel.y).toBe(776.0);
    expect(g.travel.z).toBeNull();
    expect(g.homeDir.x).toBe(1);
    expect(g.homeDir.y).toBe(-1);
    expect(g.homeEdge).toEqual({ x: 'min', y: 'max', z: 'max' });
    expect(g.homeEdgeConflict).toEqual({ x: false, y: false, z: false });
    expect(g.homingFeeds.speed.x).toBe(2000.0);
    expect(g.homingFeeds.precision).toBe(150.0);
    const w = mapExpertWcs(p);
    expect(w.active).toBe(1);
});

test('V4.1 geometry BY NAME == the Python goldens (indices + travel 3830/3900/800 + feeds 5000/5000/1500 + soft-limits DISABLED)', () => {
    const p = readF64(bytes(V41_SETTING));
    const engText = text(V41_ENG);
    expect(p.length, '1500 params').toBe(1500);
    expect(controllerFromParamCount(p.length)).toBe('ddcs-v41');
    // by-name index resolution
    const gi = byNameIndices(parseEng(engText));
    expect(gi.softNeg).toEqual({ x: 235, y: 236, z: 237 });
    expect(gi.softPos).toEqual({ x: 240, y: 241, z: 242 });
    expect(gi.enable).toBe(234);
    expect(gi.seek).toEqual({ x: 204, y: 205, z: 206 });
    // geometry values
    const g = mapByNameGeometry(p, engText, true);
    expect(g.travel).toEqual({ x: 3830.0, y: 3900.0, z: 800.0 });
    expect(g.homeDir).toEqual({ x: -1, y: -1, z: -1 });
    expect(g.homeEdge).toEqual({ x: 'max', y: 'max', z: 'max' });
    expect(g.softLimits.xMin).toBe(-3830.0);
    expect(g.softLimits.xMax).toBe(0.0);
    expect(g.homeEdgeConflict.x).toBe(true);
    expect(g.homeEdgeConflict.y).toBe(false);
    expect(g.homingFeeds.speed).toEqual({ x: 5000.0, y: 5000.0, z: 1500.0 });
    expect(g.homingFeeds.precision).toBe(50.0);
    expect(g.softLimitEnabled).toBe(false);
    expect(g.machZero).toBeNull();
});

test('V4.1 WCS from coord1 == the Python golden (G54 = -300.29 / -116.06 / 1547.268 at block 1)', () => {
    const coord = readF64(bytes(V41_COORD1));
    const p = readF64(bytes(V41_SETTING));
    expect(coord.length, '54 f64').toBe(54);
    const w = mapCoordWcs(coord, p[16]);
    expect(w.table.g54).toEqual([-300.29, -116.06, 1547.268]);
    expect(w.table.g55).toEqual([0.0, 0.0, 0.0]);
    expect(w.table.g59).toEqual([0.0, 0.0, 0.0]);
    expect(w.active).toBe(1);
    expect(w.workOrigin).toEqual({ x: -300.29, y: -116.06, z: 1547.268 });
    expect(mapCoordWcs(null, 0), 'no coord1 → WCS N/A').toBeNull();
});

test('DM500 — the setting is CRACKED (t2073): self-describing [f32][name] records → GROUNDED envelope (±400 / Z ±20)', () => {
    const buf = bytes(DM500_SETTING);
    const p = readF64(buf);
    const engText = text(DM500_ENG);
    expect(p.length, '21250 f64 slots').toBe(21250);
    expect(controllerFromParamCount(p.length)).toBe('ddcs-v3-dm500');
    // the DM500 eng carries the SAME soft-limit / home-direction labels → the V4.1 by-name resolver finds them
    const gi = byNameIndices(parseEng(engText));
    expect(gi.softNeg).toEqual({ x: 375, y: 376, z: 377 });
    expect(gi.softPos).toEqual({ x: 379, y: 380, z: 381 });
    expect(gi.enable).toBe(374);
    expect(gi.homeDir).toEqual({ x: 64, y: 65, z: 66 });
    // "Home speed" ≠ "Home search speed" → the seek regex is honestly unresolved (a follow-up name), but the
    // ENVELOPE grounds regardless.
    expect(gi.seek).toEqual({ x: null, y: null, z: null });

    // t2073 — the CRACK: values are the little-endian float32 stored right before each eng name in the setting
    // bytes (NOT setting[#idx] f64, which is garbage). parseDm500ByName → sparse index→value array that
    // mapByNameGeometry consumes exactly like a flat setting, so the SAME by-name path grounds it.
    const dm = parseDm500ByName(buf, engText);
    expect(dm[375], 'soft-limit X-- read from the [f32][name] record').toBe(-400);
    expect(dm[379], 'soft-limit X++').toBe(400);
    expect(dm[16], 'active coordinate system = G54').toBe(1);
    const g = mapByNameGeometry(dm, engText, true);
    expect(g.travel).toEqual({ x: 400, y: 400, z: 20 });
    expect(g.softLimits).toEqual({ xMin: -400, xMax: 400, yMin: -400, yMax: 400, zMin: -20, zMax: 20 });
    expect(g.softLimitEnabled, '#374 enable soft-limit = 0 in this capture').toBe(false);
    expect(g.rapidRate, '#80 G0 speed').toBe(3000);
    expect(g._grounded).toBe(true);
});

test('SPINDLE (t780) — interface + mapping axis BY NAME through EACH eng own enums (V4.1 #188/#189 · Expert #79/#80); DM500 N/A', () => {
    // V4.1 — #188 "Spindle interface type" = Analog(0); #189 "Spindle mapping axis" = A axis(3)
    const sp41 = mapSpindle(readF64(bytes(V41_SETTING)), text(V41_ENG));
    expect(sp41.interface).toBe('analog');
    expect(sp41.interfaceRaw).toBe(0);
    expect(sp41.mappingAxis).toBe('A');
    expect(sp41.mappingAxisRaw).toBe(3);
    expect(sp41.mappingAxisLabel).toBe('A axis');           // V4.1's OWN enum label
    expect(sp41._idx).toEqual({ interface: 188, mappingAxis: 189 });
    // Expert — #79 Analog(0); #80 "4th-axis"(3) → normalized to A via its OWN enum (a DIFFERENT label, never cross-applied)
    const spX = mapSpindle(readF64(bytes(EXPERT_SETTING)), text(EXPERT_ENG));
    expect(spX.interface).toBe('analog');
    expect(spX.mappingAxis).toBe('A');
    expect(spX.mappingAxisRaw).toBe(3);
    expect(spX.mappingAxisLabel).toBe('4th-axis');          // Expert's OWN enum
    expect(spX._idx).toEqual({ interface: 79, mappingAxis: 80 });
    // DM500 — no PUL/DIR interface or spindle-axis mapping in the eng → honest N/A
    expect(mapSpindle(readF64(bytes(DM500_SETTING)), text(DM500_ENG)), 'DM500 has no spindle-axis surface').toBeNull();
});
