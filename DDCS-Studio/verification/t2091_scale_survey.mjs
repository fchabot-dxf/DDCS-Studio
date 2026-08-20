// t2091 (P5c) — REPORT-ONLY survey for the future spacing/type scale decisions (explicitly out of scope to
// implement this turn). Comment-aware. Counts every integer-px spacing value (padding/margin/gap) and every
// distinct font-size across styles.css.
import fs from 'node:fs';
const text = fs.readFileSync(new URL('../web/styles.css', import.meta.url), 'utf-8');
let stripped = '';
let inComment = false;
for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inComment) {
        if (c === '*' && text[i + 1] === '/') { inComment = false; stripped += '  '; i++; continue; }
        stripped += (c === '\n') ? '\n' : ' ';
        continue;
    }
    if (c === '/' && text[i + 1] === '*') { inComment = true; stripped += '  '; i++; continue; }
    stripped += c;
}

// spacing: padding/margin/gap declarations, individual px values within them
const spacingRe = /\b(padding|margin|gap|padding-top|padding-bottom|padding-left|padding-right|margin-top|margin-bottom|margin-left|margin-right|row-gap|column-gap)\s*:\s*([^;{}]+);/g;
const pxValueRe = /(-?\d+(?:\.\d+)?)px/g;
const spacingCounts = {};
let m;
while ((m = spacingRe.exec(stripped))) {
    const value = m[2];
    let pm;
    pxValueRe.lastIndex = 0;
    while ((pm = pxValueRe.exec(value))) {
        const n = pm[1];
        spacingCounts[n] = (spacingCounts[n] || 0) + 1;
    }
}

// font-size: distinct values
const fontSizeRe = /font-size\s*:\s*([^;{}]+);/g;
const fontSizeCounts = {};
while ((m = fontSizeRe.exec(stripped))) {
    const v = m[1].trim();
    fontSizeCounts[v] = (fontSizeCounts[v] || 0) + 1;
}

console.log('=== SPACING (integer px values used in padding/margin/gap) ===');
const spacingSorted = Object.entries(spacingCounts).sort((a, b) => +a[0] - +b[0]);
for (const [px, count] of spacingSorted) console.log(`  ${px}px: ${count} declarations`);
console.log(`distinct spacing values: ${spacingSorted.length}, total declarations: ${Object.values(spacingCounts).reduce((a, b) => a + b, 0)}`);

console.log('\n=== FONT-SIZE (distinct declared values) ===');
const fontSizeSorted = Object.entries(fontSizeCounts).sort((a, b) => b[1] - a[1]);
for (const [v, count] of fontSizeSorted) console.log(`  ${v}: ${count}`);
console.log(`distinct font-size values: ${fontSizeSorted.length}, total declarations: ${Object.values(fontSizeCounts).reduce((a, b) => a + b, 0)}`);
