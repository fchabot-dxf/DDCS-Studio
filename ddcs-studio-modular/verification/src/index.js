// verification/src/index.js
// Entry point for the M350 verifier. Exposes a small, synchronous API
// used by tests, CLI, and the bundled standalone verifier.
// Keep this module ESM so it can be imported by build tooling.
import { splitLines, stripComments } from './parser.js';
import { checkForbiddenInline, checkHeaderVersion } from './checks.js';

export function validateGcode(gcode) {
  const rawLines = splitLines(gcode || '');
  // Preprocess: strip comments for syntax checks but keep original text for context
  const strippedLines = rawLines.map(({ line, text }) => ({ line, text: stripComments(text) }));

  const offenses = [];
  offenses.push(...checkForbiddenInline(strippedLines));
  offenses.push(...checkHeaderVersion(rawLines));

  return { passed: offenses.length === 0, offenses };
}

// Convenience: validate and return formatted text report
export function formatReport(report) {
  if (report.passed) return 'PASS: No issues found.';
  let out = `FAIL: ${report.offenses.length} issue(s) found:\n`;
  report.offenses.forEach(o => {
    out += ` - [${o.severity}] ${o.ruleId} @ L${o.line}: ${o.context} (${o.suggestion})\n`;
  });
  return out;
}
