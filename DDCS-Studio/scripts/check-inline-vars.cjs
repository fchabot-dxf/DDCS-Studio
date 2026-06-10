const fs = require('fs');
const path = require('path');

const outFile = path.join(__dirname, '..', 'output', 'ddcs-studio-standalone.html');
const data = fs.readFileSync(outFile, 'utf8');

// Forbidden patterns: Axis letter immediately followed by a POSITIVE sign and then #digit (e.g., X+#1). Negative sign (X-#1) is allowed by community macros.
const forbiddenRegex = /[XYZAB]\+#\d/g;
const matches = [...data.matchAll(forbiddenRegex)];

if (matches.length === 0) {
  console.log('PASS: No forbidden inline AXIS+/-# patterns found in output.');
  process.exit(0);
} else {
  console.error('FAIL: Found forbidden inline axis+/-# patterns:');
  matches.forEach(m => {
    console.error(`  - Found '${m[0]}' at index ${m.index}`);
  });
  process.exit(2);
}