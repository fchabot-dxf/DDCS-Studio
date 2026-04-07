// verification/src/checks.js
// Rule implementations for DDCS M350 checks. Keep each check pure and
// return an array of offense objects so the caller can aggregate results.
// Note: only POSITIVE sign before a variable is considered invalid (e.g., X+#1). Negative
// forms (X-#1) are common in community macros and are allowed.
const FORBIDDEN_INLINE_RE = /([XYZAB])\+#(\d+)/i;
const HEADER_VERSION_RE = /DDCS M350 V10\.0/;

export function checkForbiddenInline(lines) {
  const offenses = [];
  lines.forEach(({ line, text }) => {
    const m = text.match(FORBIDDEN_INLINE_RE);
    if (m) {
      offenses.push({
        ruleId: 'FORBIDDEN_INLINE_POSITIVE_SIGN',
        severity: 'error',
        line,
        match: m[0],
        context: text.trim(),
        suggestion: 'Avoid a positive sign before a variable; use precomputed positive var (e.g., X#8) or negative var (e.g., X#7) as appropriate.'
      });
    }
  });
  return offenses;
}

export function checkHeaderVersion(lines) {
  const offenses = [];
  const joined = lines.map(l => l.text).join('\n');
  if (!HEADER_VERSION_RE.test(joined)) {
    offenses.push({
      ruleId: 'HEADER_VERSION',
      severity: 'warning',
      line: 1,
      match: null,
      context: 'Missing `DDCS M350 V10.0` header',
      suggestion: 'Include `( DDCS M350 V10.0 Compliant )` in the header comments'
    });
  }
  return offenses;
}
