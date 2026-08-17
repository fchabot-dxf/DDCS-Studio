import { test, expect } from './support/harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STATUS_PERSISTENT as realStatusPersistent, beepPulseCount as realBeepPulseCount } from '../../web/wizards/stacks/communicationWizard.js';
import { STATUS_PERSISTENT as twinStatusPersistent, beepPulseCount as twinBeepPulseCount } from '../../web/blocks/dataOps/commData.js';

/**
 * t2051 — Tier 2's ATC/comm `-3000` magic number (PREVIEW-AS-DATA.md #17) and the beep pulse-count formula
 * (#18). Both were mislabelled "ATC" by the original survey from day one (they live in `comm_data`/
 * `communicationWizard.js`, not any ATC-prefixed file — corrected at t2040). `-3000` (meaning "persistent
 * status") was tested as a bare literal independently in 3 places: the real emit (`stacks/communicationWizard.js`'s
 * own `statusArm`), the twin's postInstantiate recompose (`commData.js`), and the preview-only mock screen
 * (`wizards/communicationWizard.js`). The beep pulse-count formula (`Math.round(dur/(cyc*2))`, feeding only a
 * "System Beep - N pulses of Xms" COMMENT string, not the real `BEEP()` call's own dur/cyc arguments) was
 * hand-typed twice, in the emit and the recompose.
 *
 * Collapsed the same way t2030 collapsed `fmtCtrl`/`fmtLine`: exported the ONE declared source
 * (`stacks/communicationWizard.js`) and made every consumer import it.
 */

test('beepPulseCount: commData.js\'s copy is REFERENCE-IDENTICAL to the real emit\'s own, not a re-typed copy', () => {
    expect(twinBeepPulseCount).toBe(realBeepPulseCount);
});

test('STATUS_PERSISTENT: commData.js re-exports the SAME constant the real emit compares against', () => {
    expect(twinStatusPersistent).toBe(realStatusPersistent);
    expect(realStatusPersistent).toBe(-3000);
});

test('beepPulseCount matches the real emit\'s comment text for a real pulsed-beep param sweep', () => {
    const CASES = [
        { dur: 500, cyc: 40 },
        { dur: 1000, cyc: 250 },
        { dur: 3000, cyc: 1 },
    ];
    for (const { dur, cyc } of CASES) {
        expect(realBeepPulseCount(dur, cyc)).toBe(Math.round(dur / (cyc * 2)));
    }
});

/**
 * The bare `-3000` literal is no longer independently re-derived in any of the three consumer sites — each now
 * reads the ONE declared `STATUS_PERSISTENT` export. A text check (not a runtime one, since a primitive's
 * "reference identity" can't distinguish a collapsed import from a coincidentally-matching re-typed literal the
 * way a function's identity can) — same technique architecture-map-1698/declared-key-coverage-1678 already use
 * for this codebase's other structural invariants.
 */
test('no bare -3000 literal remains at any of the 3 former independent comparison sites', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const files = [
        'web/wizards/stacks/communicationWizard.js',
        'web/blocks/dataOps/commData.js',
        'web/wizards/communicationWizard.js',
    ];
    for (const f of files) {
        const src = readFileSync(root + f, 'utf8');
        expect(src, `${f} must not compare against a bare -3000 literal`).not.toMatch(/===\s*-3000|-3000\s*===/);
        expect(src, `${f} must import STATUS_PERSISTENT`).toMatch(/STATUS_PERSISTENT/);
    }
});
