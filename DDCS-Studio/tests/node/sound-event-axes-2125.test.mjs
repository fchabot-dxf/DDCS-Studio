import { test, expect } from './support/harness.mjs';
import { EVENT, THEME, ACTION } from '../../web/ui/sound.js';

/**
 * SOUND-PLAN.md section 7 item 4 -- the definition-of-done test the plan explicitly asks for, to stop a
 * later "tidy-up" from re-collapsing arrives/delivered/failed onto a shared rhythm or pitch set (the exact
 * mistake an earlier draft made: a rearranged major triad the human could not tell apart inside one theme,
 * which is the only comparison that exists in real use). Asserts the structural facts that carry the
 * five-axis separation (notes / tempo / interval / register / length):
 *   - note counts 2 / 4 / 7 (the 'notes' axis)
 *   - fail.oct === -1 (the 'register' axis -- failed sits an octave down from everything else)
 *   - fail.steps contains 6, a tritone (the 'interval' axis -- the categorical dissonance marker)
 *
 * Run standalone:  node --import ./tests/node/support/register.mjs --test tests/node/sound-event-axes-2125.test.mjs
 */

test('t2125 -- EVENT note counts are 2/4/7, matching the note-count axis', () => {
    expect(EVENT.in.steps.length, 'arrives is 2 notes').toBe(2);
    expect(EVENT.done.steps.length, 'delivered is 4 notes').toBe(4);
    expect(EVENT.fail.steps.length, 'failed is 7 notes').toBe(7);
    expect(EVENT.in.rhy.length, 'arrives rhythm has 2 entries').toBe(2);
    expect(EVENT.done.rhy.length, 'delivered rhythm has 4 entries').toBe(4);
    expect(EVENT.fail.rhy.length, 'failed rhythm has 7 entries').toBe(7);
});

test('t2125 -- failed sits an octave down (the register axis)', () => {
    expect(EVENT.fail.oct, 'failed is the only event an octave below the others').toBe(-1);
    expect(EVENT.in.oct, 'arrives stays in the base register').toBe(0);
    expect(EVENT.done.oct, 'delivered stays in the base register').toBe(0);
});

test('t2125 -- failed carries a tritone (the interval axis -- dissonance is categorical, not a matter of degree)', () => {
    expect(EVENT.fail.steps.includes(6), 'a tritone (6 semitones) must be present in failed').toBe(true);
});

test('t2125 -- in/done/fail do not share a rhythm or a pitch set (would re-collapse the axes)', () => {
    const key = (ev) => JSON.stringify(ev.steps) + '|' + JSON.stringify(ev.rhy);
    const keys = new Set([key(EVENT.in), key(EVENT.done), key(EVENT.fail)]);
    expect(keys.size, 'in/done/fail must each have a distinct steps+rhythm shape').toBe(3);
});

test('t2125 -- all five themes are declared, and each carries a distinct base pitch', () => {
    const names = ['studio', 'futuristic', 'organic', 'steampunk', 'normal'];
    for (const n of names) expect(typeof THEME[n], `THEME.${n} must be declared`).toBe('object');
    const bases = new Set(names.map((n) => THEME[n].base));
    expect(bases.size, 'every theme must have its own base pitch').toBe(names.length);
});

test('t2129 (review) -- base pitches match SOUND-PLAN.md section 4 exactly, not just "five distinct values"', () => {
    // the test above only proved the five bases differ from each other -- it would stay green if `fail`
    // were stretched to 3s or `in` retuned to a third, since nothing here checked the ACTUAL numbers the
    // plan specifies. These are the exact figures the artifact's own source (and section 4) name.
    expect(THEME.studio.base).toBe(392);
    expect(THEME.futuristic.base).toBe(587);
    expect(THEME.organic.base).toBe(330);
    expect(THEME.steampunk.base).toBe(523);
    expect(THEME.normal.base).toBe(440);
});

test('t2125 -- COMMIT is a real, lighter, distinct EVENT (not a reuse of DONE)', () => {
    expect(EVENT.commit, 'commit must be declared').toBeTruthy();
    expect(EVENT.commit.rhy.reduce((s, r) => Math.max(s, r[0] + r[1]), 0),
        'commit must genuinely be SHORTER than done (an insert happens far more often than a job completes)')
        .toBeLessThan(EVENT.done.rhy.reduce((s, r) => Math.max(s, r[0] + r[1]), 0));
    expect(EVENT.done, "'done' must stay declared even though no ACTION currently uses it").toBeTruthy();
});

// t2129 (review) — these three tests used to loop a frozen 7-name literal instead of deriving from ACTION
// itself, so a brand-new entry (this file's own 'error', added the same commit) rendered a Settings row
// and a preview button and was covered by NOTHING here — silent and green. Classifying EVERY declared key
// by its own shape means a new action, or a typo inside one, is checked automatically, not by remembering
// to update a name list by hand.
const JOB_SAMPLE_ACTIONS = new Set(['job.arrived', 'job.delivered', 'job.failed']);   // the WHERE=gateway exceptions — see JOB-RULES.md §7

test('t2125/t2129 -- every declared ACTION is exactly one kind: voice, sample, or synth (never zero, never two)', () => {
    for (const [name, a] of Object.entries(ACTION)) {
        const kinds = ['voice', 'sample', 'synth'].filter((k) => a[k] !== undefined);
        expect(kinds.length, `${name} must declare exactly one of voice/sample/synth, got [${kinds.join(',')}]`).toBe(1);
    }
});

test('t2125 -- every UI/system action (not the 3 gateway job samples) is themed VOICE or a client-only synth', () => {
    for (const [name, a] of Object.entries(ACTION)) {
        if (JOB_SAMPLE_ACTIONS.has(name)) continue;   // the gateway-only samples, checked separately below
        expect(a.sample, `${name} must not carry a sample (only job.arrived/delivered/failed do)`).toBeUndefined();
        expect(typeof a.voice === 'string' || typeof a.synth === 'string', `${name} must be a themed voice or a synth`).toBe(true);
    }
});

test('t2125 -- job.arrived/delivered/failed (SOUND-PLAN.md section 5 correction) are LEARNED samples, never synthesized', () => {
    for (const name of JOB_SAMPLE_ACTIONS) {
        const a = ACTION[name];
        expect(a, `${name} must be declared`).toBeTruthy();
        expect(typeof a.sample, `${name} must carry a learned .wav sample, not a themed voice`).toBe('string');
        expect(a.sample.endsWith('.wav'), `${name}'s sample must be a WAV (PCM16 -- the only format winsound accepts)`).toBe(true);
        expect(a.voice, `${name} must not carry a voice (job sounds are unthemed)`).toBeUndefined();
    }
});

test('t2125 -- every declared voice action resolves to a real THEME voice name (click, or a declared EVENT key)', () => {
    for (const [name, a] of Object.entries(ACTION)) {
        if (typeof a.voice !== 'string') continue;   // sample/synth actions have nothing to resolve here
        const resolvable = a.voice === 'click' || !!EVENT[a.voice];
        expect(resolvable, `${a.voice} (from ${name}) must be 'click' or a declared EVENT key`).toBe(true);
    }
});
