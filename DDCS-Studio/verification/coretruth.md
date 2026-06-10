# CoreTruth — DDCS M350 Verification

Controller: DDCS M350 V10.0

## Purpose
This document encodes authoritative rules for verifying generated G-code targeting the DDCS M350 controller.

## Rules (human + machine)
- Rule: FORBIDDEN_INLINE_POSITIVE_SIGN
  - Description: Axis letters must not be directly followed by a positive sign and variable (e.g., `X+#2`). Community macros use `X-#N` widely (negative sign before a variable is permitted).
  - Regex: /[XYZAB]\+#\d/ (fatal)
  - Suggestion: use precomputed variables (e.g., `X#10`) or negative signed variables (e.g., `X-#7`) where appropriate.

- Rule: HEADER_VERSION
  - Description: Header must contain `DDCS M350 V10.0` (the canonical version).
  - Regex: /DDCS M350 V10\.0/ (warning)
  - Suggestion: update header strings to `( DDCS M350 V10.0 Compliant )`.

## Variable mapping (reference)
- #7  = [0-#1]    Negative max probe distance
- #8  = #1        Positive max probe distance
- #9  = [0-#2]    Negative retract distance
- #10 = #2        Positive retract distance
- #11 = [0-#2*2]  Negative double retract
- #12 = [#2*2]    Positive double retract
- #13 = #6        Positive clearance
- #14 = [0-#6]    Negative clearance

## Examples
- Good: `G31 Y#8 F#3 P#5 L0 Q1`
- Bad:  `G31 Y+#1 F#3 P#5 L0 Q1`  (FORBIDDEN_INLINE_SIGN)


