/**
 * tests/support/gatewaySend.js — t2225. ONE shared `clickBtn` for the Gateway Send flow, replacing four
 * hand-duplicated local closures (send-beacon-warning-2057, send-gate-wiring-1585, send-history-real-path-2065,
 * validation-divzero-not-syntax-1603) that had already diverged: 1585 alone had been edited to
 * `.trim().startsWith(t)` (t2113, "prefix, so the transport label may vary") while the other three stayed on
 * `.includes(t)` — because there was no single definition for a fix to travel through, t2113's own intent
 * never reached the other three call sites, and 1585's own edit broke a DIFFERENT call site in the SAME file
 * (`clickBtn('Use current Studio program')` against the real button text `"⬆ Use current Studio program"` —
 * a leading icon glyph `.startsWith()` can never match).
 *
 * `.includes(t)`, deliberately, not `.startsWith(t)`: every real call site across all four specs needs to find
 * a button by a NAME FRAGMENT regardless of a leading icon glyph (`⬆`, etc.) — `.startsWith()` cannot do that,
 * proven by the regression above. The sort-by-shortest-textContent tiebreak already disambiguates the one case
 * `.includes()` alone would not: `clickBtn('Send')` after a transport-specific button ("Send (tracked)" /
 * "Send (deliver-only)") has also rendered — the plain "Send" tab, being shorter, sorts first.
 */
export async function clickBtn(page, txt) {
    return page.evaluate((t) => {
        const hit = [...document.querySelectorAll('button')]
            .filter((e) => (e.textContent || '').includes(t))
            .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
        if (!hit) return false;
        hit.disabled = false;   // the CONNECTION contract only, never the gate
        hit.click();
        return true;
    }, txt);
}
