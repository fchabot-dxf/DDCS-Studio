import { test, expect } from './support/harness.mjs';
import { droWorkShift } from '../../web/viz/latheDro.js';
import { barFromSettings } from '../../web/viz/latheProfileCanvas.js';
import { applyLatheWorkspaceStock } from '../../web/viz/latheScene.js';
import { isLatheBar, roundBlankStock, barStock } from '../../web/data/stockShape.js';
import { setMachine } from '../../web/data/workspaceMachine.js';

/**
 * t2051 — Tier 2's "4 lathe-bar predicates, co-extensive only by accident" item, from PREVIEW-AS-DATA.md §B.
 * `gcodeViz3d.js` (shape/axis/origin), `latheScene.js` (same 3 fields, ×2), `latheDro.js` (shape/axis/DATUM — a
 * different third field), and `latheProfileCanvas.js` (shape ALONE, the weakest) each independently re-derived
 * "is this stock a lathe bar" instead of calling data/stockShape.js's own already-declared `isLatheBar` (t1313),
 * which nobody but its own file was using. All four now call it.
 *
 * This was not just hygiene: `latheProfileCanvas.js`'s `shape`-alone check and `latheDro.js`'s `datum`-based check
 * both accept a Z-AXIS ROUND BLANK (shape:'cylinder', axis:'z', but origin left undefined — a real, reachable
 * stock shape per `data/stockShape.js`'s own `roundBlankStock`, e.g. a workspace switched to lathe without its
 * stock re-configured through the bar editor) as if it were a genuine lathe bar. `gcodeViz3d.js`/`latheScene.js`
 * correctly do not. These tests reproduce that exact divergence and confirm the collapsed predicate closes it.
 */

const ROUND_BLANK_ON_Z = roundBlankStock(40, 30, 'z');   // shape:cylinder, axis:'z', origin:undefined, datum:'ccp'
const REAL_BAR = barStock({ diameter: 25, stickOut: 60, allowance: 2 });   // shape:cylinder, axis:'z', origin:'finished-face', datum:'ccp'

test('the round blank and the real bar are told apart by isLatheBar itself (the sanity check the rest build on)', () => {
    expect(isLatheBar(ROUND_BLANK_ON_Z), 'a Z-axis round blank is NOT a lathe bar (no finished-face origin)').toBe(false);
    expect(isLatheBar(REAL_BAR), 'a stock built through barStock() IS a lathe bar').toBe(true);
});

test('droWorkShift: a Z-axis round blank gets no DRO shift — THE BUG datum-checking used to miss', () => {
    // Before t2051, droWorkShift checked shape/axis/datum only — never origin — so this exact stock (real,
    // reachable via roundBlankStock, which also defaults a round blank's datum to 'ccp') passed its old
    // `isBar` test and got a false half-diameter shift applied to a workpiece that is not a bar at all.
    expect(droWorkShift(ROUND_BLANK_ON_Z, true)).toEqual({ x: 0, y: 0 });
    // A genuine bar still gets its real shift (unchanged behaviour, the case the function exists for).
    const shift = droWorkShift(REAL_BAR, true);
    expect(shift.x).toBeCloseTo(REAL_BAR.x / 2, 6);
    expect(shift.y).toBeCloseTo(REAL_BAR.y / 2, 6);
});

test('droWorkShift: not a lathe workspace -> no shift regardless of stock shape', () => {
    expect(droWorkShift(REAL_BAR, false)).toEqual({ x: 0, y: 0 });
});

test('barFromSettings: a Z-axis round blank does NOT donate its diameter/z as bar dimensions — falls back instead', () => {
    const realGet = globalThis.window.ddcsGetSettings;
    globalThis.window.ddcsGetSettings = () => ({ stock: ROUND_BLANK_ON_Z });
    try {
        const bar = barFromSettings({ diameter: 20, stickOut: 60, allowance: 1 });
        // Before t2051 this read the round blank's 40mm diameter as the bar's — a picture reading a fact off
        // the wrong stock. The fallback default (20) must win instead, since this is not a bar.
        expect(bar.diameter, 'ignores the round blank, uses the op default').toBe(20);
    } finally {
        globalThis.window.ddcsGetSettings = realGet;
    }
});

test('barFromSettings: a genuine bar still donates its real diameter (unchanged behaviour)', () => {
    const realGet = globalThis.window.ddcsGetSettings;
    globalThis.window.ddcsGetSettings = () => ({ stock: REAL_BAR });
    try {
        const bar = barFromSettings({ diameter: 20, stickOut: 60, allowance: 1 });
        expect(bar.diameter, 'reads the real bar\'s own diameter, not the op default').toBe(25);
    } finally {
        globalThis.window.ddcsGetSettings = realGet;
    }
});

test('applyLatheWorkspaceStock: an existing genuine bar is left untouched — "already a bar" still fires correctly', () => {
    const realGet = globalThis.window.ddcsGetSettings;
    const settings = { stock: { ...REAL_BAR } };
    globalThis.window.ddcsGetSettings = () => settings;
    setMachine({ kind: 'lathe' }, false);
    try {
        const wrote = applyLatheWorkspaceStock();
        expect(wrote, 'a real bar is not rewritten').toBe(false);
        expect(settings.stock.diameter).toBe(REAL_BAR.diameter);
    } finally {
        globalThis.window.ddcsGetSettings = realGet;
        setMachine({ kind: 'mill' });
    }
});
