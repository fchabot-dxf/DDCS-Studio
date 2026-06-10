// verification/src/parser.js
// Simple G-code helpers. Keep logic small so bundling remains tiny.
export function splitLines(gcode) {
  const lines = String(gcode || '').split(/\r?\n/);
  return lines.map((text, idx) => ({ line: idx + 1, text }));
}

export function stripComments(text) {
  // Remove parentheses comments: ( ... ) - used before regex checks
  return text.replace(/\([^)]*\)/g, '').trim();
}
