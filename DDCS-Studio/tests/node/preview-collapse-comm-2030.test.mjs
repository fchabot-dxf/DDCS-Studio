import { test, expect } from './support/harness.mjs';
import { fmtCtrl as realFmtCtrl, fmtLine as realFmtLine } from '../../web/wizards/stacks/communicationWizard.js';
import { fmtCtrl as twinFmtCtrl, fmtLine as twinFmtLine } from '../../web/blocks/dataOps/commData.js';
import { CommunicationWizard } from '../../web/wizards/communicationWizard.js';

/**
 * t2030 — THE TIER-1 COLLAPSE, comm_data's message-formatting regex (PREVIEW-AS-DATA.md Tier-1 #9, the LAST
 * of the four parked at t2016/t2028). Three hand-typed copies of the SAME "format an operator message for
 * G-code embedding" fact: `stacks/communicationWizard.js`'s own `fmtCtrl`/`fmtLine` (the REAL emit —
 * `commStack` calls these directly), `commData.js`'s own byte-identical re-definition (fed into
 * `applyCommRecompose`'s postInstantiate sentinel-swap — a DIFFERENT construction mechanism, same real emit
 * need — `commData.js`'s own doc comment states it must stay "BYTE-IDENTICAL to commStack"), and
 * `communicationWizard.js`'s class methods (`formatMessageSingleLine` — LIVE, feeds only the preview mock
 * screen; `formatMessageForController` — CONFIRMED DEAD, zero callers anywhere in the app, removed as an
 * orphan rather than collapsed, since there was no call site to redirect).
 *
 * Consumer check done first, per t2016/t2028's own standing rule: `commData.js`'s copy feeds the SAME real
 * G-code the wizard's own `commStack` produces (unlike `contourWizard.js`'s bbox helper, which fed a
 * genuinely different NEED) — a true duplicate, collapsed. `escapeMessageForPreview`/`formatMessageForPreview`
 * (HTML-escaping + `<br/>` line breaks for the mock screen) compute a DIFFERENT fact with no emit equivalent —
 * correctly left untouched, out of scope.
 */

test('commData.js\'s fmtCtrl/fmtLine are REFERENCE-IDENTICAL to the real emit\'s own — not a re-typed copy that merely agrees', () => {
    // The strongest form of proof PREVIEW-AS-DATA.md itself names: "only the reference identity of the
    // function called can tell [a shared source] apart [from a hand-typed duplicate that currently agrees]."
    // A future author reverting the collapse (reintroducing a local const fmtCtrl/fmtLine in commData.js)
    // breaks this assertion immediately, even if their new copy's OUTPUT still happens to agree today.
    expect(twinFmtCtrl).toBe(realFmtCtrl);
    expect(twinFmtLine).toBe(realFmtLine);
});

test('communicationWizard.js\'s preview-only formatMessageSingleLine delegates to the SAME fmtLine, not its own copy', () => {
    const cw = new CommunicationWizard();
    const cases = ['line one\r\nline two', 'a\n\nb   c', '  leading and trailing  ', ''];
    for (const msg of cases) {
        expect(cw.formatMessageSingleLine(msg)).toBe(realFmtLine(msg));
    }
});

test('formatMessageForController is GONE — confirmed dead (zero callers) before removal, not merely renamed', () => {
    const cw = new CommunicationWizard();
    expect(typeof cw.formatMessageForController).toBe('undefined');
});

test('real messages format identically through BOTH construction paths (the wizard build vs. the twin\'s recompose)', () => {
    const CASES = [
        'Insert new tool\r\nthen press Cycle Start',
        'Line1\nLine2\nLine3',
        '   collapse   this    whitespace   ',
        'no line breaks at all',
        '',
    ];
    for (const msg of CASES) {
        expect(twinFmtCtrl(msg)).toBe(realFmtCtrl(msg));
        expect(twinFmtLine(msg)).toBe(realFmtLine(msg));
    }
});
