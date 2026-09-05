import { test, expect } from './support/harness.mjs';
import { emitMapped } from '../../web/blocks/blockEmitter.js';

/**
 * t2635 (BACKLOG #71/#72 census, t2633) — emit()'s own transparent-container dispatch never learned
 * split_horizontal/split_vertical/group_box/grid_container/tab_group/tab_page: a block nested inside one of
 * these fell through to the GENERIC leaf dispatch (`def.emit(p, dx, dy, dialect)`), which passes `dx` — a
 * NUMBER — into the argument slot each of these blocks' own `emit: (params, children) => children || []`
 * expects to be the real children array. With dx===0 (the ordinary case) `dx || []` silently returns `[]`,
 * DROPPING the nested content from the program with no error at all — the exact failure this file proves
 * against, not just "the branch runs". With a nonzero dx, `dx || []` returns the number itself and the
 * `.map`/`.length` calls in emitMapped's own leaf tail THROW instead.
 *
 * `assign` (wizards/ops/assign.js, kind:'leaf') is the proof atom: its own `emit: (p) => [...]` reads only
 * `p` and ignores dx/dy/dialect entirely, so it emits a real, distinctive `#100=42` line regardless of where
 * or how deep it is nested — a clean signal for "did this line survive the walk at all".
 */

const ASSIGN = { type: 'assign', params: { var: '#100', value: '42', note: '' } };

test('a real atom nested in group_box survives emit (dx=0 — the silent-drop case)', () => {
    const block = { type: 'group_box', params: { title: 'X' }, children: [ASSIGN] };
    const text = emitMapped([block]).text;
    expect(text).toMatch(/#100=42/);
});

test('a real atom nested in grid_container survives emit', () => {
    const block = { type: 'grid_container', params: {}, children: [ASSIGN] };
    expect(emitMapped([block]).text).toMatch(/#100=42/);
});

test('a real atom nested in tab_group > tab_page survives emit', () => {
    const block = { type: 'tab_group', params: {}, children: [{ type: 'tab_page', params: { title: 'General' }, children: [ASSIGN] }] };
    expect(emitMapped([block]).text).toMatch(/#100=42/);
});

test('a real atom nested in split_horizontal (mouth-keyed {LEFT,RIGHT} children, not a plain array) survives emit', () => {
    const block = { type: 'split_horizontal', params: { ratio: '1:1' }, children: { LEFT: [ASSIGN], RIGHT: [] } };
    expect(emitMapped([block]).text).toMatch(/#100=42/);
});

test('a real atom nested in split_vertical survives emit', () => {
    const block = { type: 'split_vertical', params: { ratio: '1:1' }, children: { TOP: [], BOTTOM: [ASSIGN] } };
    expect(emitMapped([block]).text).toMatch(/#100=42/);
});

test('nested TWO deep (group_box inside split_horizontal, the corner-redivide composition shape) still survives', () => {
    const block = {
        type: 'split_horizontal', params: { ratio: '1:1' },
        children: { LEFT: [{ type: 'group_box', params: { title: 'Y' }, children: [ASSIGN] }], RIGHT: [] },
    };
    expect(emitMapped([block]).text).toMatch(/#100=42/);
});

test('a real atom nested in group_box still emits correctly under a NONZERO dx (the throw case, not just dx=0)', () => {
    // wizards/ops/array.js — a real, registered `kind:'container'` block: `def.points(p)` with
    // `pattern:'single'` returns ONE point at (x0,y0), and blockEmitter.js's own 'container' branch calls
    // `emit(c, dx + pt.x, dy + pt.y, ...)` per point — x0:5 makes dx a real nonzero number at the group_box.
    // Before the fix, `dx || []` (dx=5) returns the NUMBER 5, and emitMapped's own leaf tail calling
    // `lines.map(...)` on it throws `TypeError: lines.map is not a function` — this call not throwing IS part
    // of the proof, not just the assertion below.
    const block = {
        type: 'array', params: { pattern: 'single', x0: 5, y0: 0 },
        children: [{ type: 'group_box', params: { title: 'Z' }, children: [ASSIGN] }],
    };
    expect(emitMapped([block]).text).toMatch(/#100=42/);
});
