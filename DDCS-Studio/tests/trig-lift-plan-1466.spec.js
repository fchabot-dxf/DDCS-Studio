import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { TRIG_LIFT_PLAN, TRIG_FUNCTIONS, TRIG_RUN_ORDER, TRIG_NOT_GATED } from '../web/data/trigEvidence.js';

/**
 * t1466 — THE TRIG GATE'S LIFT PLAN, locked against the things it claims.
 *
 * ── WHY THESE LOCKS, AND NOT A DOCUMENT ─────────────────────────────────────────────────────────────────────────
 * A machine-visit plan is written once and read months later, on a day when nobody remembers writing it. Between
 * those two moments the boundaries it indexes can be reworded, renamed or removed, and a stale plan is worse than
 * none: it sends someone to the machine to settle a question that has already moved. So the plan is DATA
 * (`web/data/trigEvidence.js`) and every claim it makes about the codebase is asserted here — the same
 * self-red-ing shape t1431/t1464 use, pointed at a plan instead of at a walk.
 *
 * ── AND ONE LOCK IS A TRAP THAT ALREADY FIRED ───────────────────────────────────────────────────────────────────
 * `verify/HANDOFF.md` safety rule 1 — machine-learned, twice — says a `(...)` comment may carry no inner parens and
 * no square brackets, because the comment closes at the first `)` and the rest parses as code. V13_trig.nc, the one
 * macro that decides everything this plan is about, carried FIVE bracketed comment lines. A parse abort on its line
 * 5 would have read as "trig rejected" when the real cause was a comment: a FALSE NEGATIVE on the decider, at the
 * cost of a machine visit that learns nothing. V12/V14/V15 carried the same hazard and are queued for the same
 * visit. All four are fixed; this lock is what stops the next macro re-introducing it.
 */

const VERIFY = join('..', 'bridge', 'controllers', 'expert-m350', 'verify');
const web = (rel) => join('web', ...rel.split('/'));
const src = (rel) => readFileSync(web(rel), 'utf8');
const macro = (name) => readFileSync(join(VERIFY, name), 'utf8');

test('LOCK 1 — every lift-plan row still points at a declaration that exists', () => {
    const missing = [];
    for (const row of TRIG_LIFT_PLAN) {
        if (!existsSync(web(row.site))) { missing.push(`${row.id}: site ${row.site} is gone`); continue; }
        if (!src(row.site).includes(row.anchor)) missing.push(`${row.id}: ${row.site} no longer contains ${row.anchor}`);
        for (const k of row.keys || []) {
            if (!src(row.site).includes(`'${k}'`)) missing.push(`${row.id}: ${row.site} no longer declares key ${k}`);
        }
    }
    expect(missing, 'a lift-plan row has gone stale — update web/data/trigEvidence.js, do not delete the assert:\n'
        + missing.join('\n')).toEqual([]);
    expect(TRIG_LIFT_PLAN.length, 'six sites name the trig gate').toBe(6);
});

test('LOCK 2 — every GATED row still cites V13_trig.nc, and every NOT-GATED site still does not', () => {
    const gated = TRIG_LIFT_PLAN.filter((r) => r.kind === 'gated');
    expect(gated.length, 'four declared boundaries wait on the answer').toBe(4);
    for (const row of gated) {
        expect(src(row.site).includes('V13_trig.nc'), `${row.id} (${row.site}) must still name the decider — if this `
            + 'boundary stopped waiting on trig, its row has to come OFF the plan').toBe(true);
    }
    // ⚠ THE OTHER DIRECTION, which is what stops the visit being oversold: a boundary that is literal for reasons
    // that have nothing to do with the controller's maths must NOT drift onto the plan.
    for (const n of TRIG_NOT_GATED) {
        expect(TRIG_LIFT_PLAN.some((r) => r.site === n.site && r.decl === n.decl),
            `${n.decl} is declared NOT trig-gated and must not also be a lift row`).toBe(false);
    }
    expect(src('wizards/ops/slot.js').includes('SLOT_RASTER_GAP'), 'the named not-gated boundary still exists').toBe(true);
    expect(src('wizards/ops/slot.js').includes('V13_trig.nc'), 'SLOT_RASTER_GAP must NOT cite the decider — it is a '
        + 'boundary of the raster atom\'s declared axes, not of arithmetic').toBe(false);
});

test('LOCK 3 — one risky form per file: each split macro probes exactly ONE function', () => {
    const NAMES = Object.keys(TRIG_FUNCTIONS);
    for (const [fn, spec] of Object.entries(TRIG_FUNCTIONS)) {
        const text = macro(spec.test);
        // strip comments — the headers name the other functions on purpose, and only CODE can abort a parse
        const code = text.split('\n').filter((ln) => !ln.trim().startsWith('(')).join('\n');
        const probed = NAMES.filter((n) => new RegExp(`\\b${n}\\s*\\[`).test(code));
        expect(probed, `${spec.test} must probe ${fn} and nothing else — a syntax error aborts the WHOLE file, so a `
            + 'second function here can blind this one').toEqual([fn]);
        expect(code, `${spec.test} must report the value the plan expects`).toContain(String(spec.expect));
        expect(code.includes('G0 ') || code.includes('G1 ') || code.includes('G31'),
            `${spec.test} must contain NO motion`).toBe(false);
    }
});

test('LOCK 4 — the combined V13_trig.nc still probes all four, and the run order is complete', () => {
    const code = macro('V13_trig.nc').split('\n').filter((ln) => !ln.trim().startsWith('(')).join('\n');
    for (const fn of Object.keys(TRIG_FUNCTIONS)) {
        expect(new RegExp(`\\b${fn}\\s*\\[`).test(code), `V13_trig.nc must keep probing ${fn} — it is the one-run `
            + 'best case AND the only file whose abort can tell us whether an unknown function fails LOUD').toBe(true);
    }
    const expected = ['V13_trig.nc', ...Object.values(TRIG_FUNCTIONS).map((f) => f.test)].sort();
    expect([...TRIG_RUN_ORDER].sort(), 'the run order lists the combined file and every split file').toEqual(expected);
    expect(TRIG_RUN_ORDER[0], 'the combined file is run FIRST').toBe('V13_trig.nc');
    expect(TRIG_RUN_ORDER[1], 'then SQRT — the one three shipped boundaries wait on').toBe('V13c_sqrt.nc');
    for (const name of TRIG_RUN_ORDER) expect(existsSync(join(VERIFY, name)), `${name} exists`).toBe(true);
});

test('LOCK 5 — no verify macro carries a bracket or a nested paren inside a comment (safety rule 1)', () => {
    const offenders = [];
    for (const name of readdirSync(VERIFY).filter((f) => f.endsWith('.nc'))) {
        macro(name).split('\n').forEach((ln, i) => {
            for (const m of ln.matchAll(/\(([^)]*)/g)) {
                if (/[[\]()]/.test(m[1])) offenders.push(`${name}:${i + 1}  ${ln.trim().slice(0, 80)}`);
            }
        });
    }
    expect(offenders, 'a comment closes at the first ")" and the rest parses as code — so a bracketed comment can '
        + 'abort the whole file and be misread as the TEST failing. Rewrite it in prose:\n' + offenders.join('\n'))
        .toEqual([]);
});

test('LOCK 6 — the plan is honest about what a YES buys', () => {
    for (const row of TRIG_LIFT_PLAN) {
        expect(['gated', 'shipped-unconfirmed']).toContain(row.kind);
        expect(Object.keys(TRIG_FUNCTIONS).some((f) => row.needs.includes(f)), `${row.id} names a probed function`).toBe(true);
        expect(row.onYes.length, `${row.id} says what a YES changes`).toBeGreaterThan(20);
        expect(row.onNo.length, `${row.id} says what a NO means`).toBeGreaterThan(20);
        if (!row.lifts) expect((row.whyNotLift || '').length, `${row.id} is lifts:false and MUST say what else is in `
            + 'the way — an unexplained non-lift is how a visit gets oversold').toBeGreaterThan(20);
        // emit that already ships is never a "lift": there is no boundary behind it to remove.
        if (row.kind === 'shipped-unconfirmed') expect(row.lifts, `${row.id} ships already — a YES buys confidence, `
            + 'not capability').toBe(false);
    }
    expect(TRIG_LIFT_PLAN.filter((r) => r.lifts).map((r) => r.id).sort(),
        'exactly two rows lift a boundary outright, both on SQRT').toEqual(['raster-ramp', 'rest-walk']);
});
