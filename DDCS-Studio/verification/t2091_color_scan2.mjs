// t2091 (P5c) — precise color-literal scan: strips comments/strings first (comment-aware, like the brace
// checker), then only matches color literals in LIVE CSS text, excluding custom-property NAMES (e.g.
// --dro-white must not count as a "white" colour use -- only its declared VALUE would).
import fs from 'node:fs';
const text = fs.readFileSync(new URL('../web/styles.css', import.meta.url), 'utf-8');

// Strip comments (comment-aware, same state machine as css-comment-brace-check.mjs) but KEEP newlines/line
// structure so line numbers still line up -- replace comment bodies with spaces of the same length.
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

const lines = stripped.split('\n');
const hexCounts = {};
const rgbEntries = [];
let namedWhite = 0, namedBlack = 0;
let alphaLeadingDot = 0, alphaLeadingZero = 0;
const threeDecimalAlphas = new Set();

// hex: must NOT be immediately preceded by a hyphen-connected identifier char forming a --custom-name
// (custom property names can't contain '#' anyway, so any '#XXXXXX' is always a real colour literal -- the
// risk was only for the bare-keyword white/black, which CAN appear inside --dro-white style names).
const hexRe = /#([0-9a-fA-F]{3,8})\b/g;
const rgbRe = /rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*(?:,\s*([0-9.]+)\s*)?\)/g;
// named white/black as a REAL value: preceded by ':' or ',' or '(' (with optional whitespace/!important
// context), not preceded by '-' (which would make it part of a --custom-name or a hyphenated word).
const namedColorRe = /(^|[:,(\s])(white|black)\b(?!-)/gi;

for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    let m;
    hexRe.lastIndex = 0;
    while ((m = hexRe.exec(line))) {
        const hex = m[1].toLowerCase();
        hexCounts[hex] = (hexCounts[hex] || 0) + 1;
    }
    rgbRe.lastIndex = 0;
    while ((m = rgbRe.exec(line))) {
        rgbEntries.push({ line: li + 1, r: +m[1], g: +m[2], b: +m[3], a: m[4] });
        if (m[4] !== undefined) {
            if (/^\./.test(m[4])) alphaLeadingDot++;
            else if (/^0\./.test(m[4])) alphaLeadingZero++;
            const decimals = (m[4].split('.')[1] || '').length;
            if (decimals >= 3) threeDecimalAlphas.add(`${m[4]} (line ${li + 1})`);
        }
    }
    namedColorRe.lastIndex = 0;
    while ((m = namedColorRe.exec(line))) {
        // exclude if immediately followed by a hyphen (part of a custom-property name like white-ish-foo,
        // though none exist; defensive) -- already excluded leading '-' via the negative lookbehind-ish
        // preceding-char check baked into the alternation set above.
        if (m[2].toLowerCase() === 'white') { namedWhite++; }
        else { namedBlack++; }
    }
}

console.log('=== HEX distinct:', Object.keys(hexCounts).length, ' total occurrences:', Object.values(hexCounts).reduce((a, b) => a + b, 0), ' used-once:', Object.values(hexCounts).filter(c => c === 1).length, '===');
console.log('=== named white (real CSS value uses):', namedWhite, ' named black:', namedBlack, '===');
console.log('=== fff:', hexCounts['fff'] || 0, ' ffffff:', hexCounts['ffffff'] || 0, ' ===');
console.log('=== 000:', hexCounts['000'] || 0, ' 000000:', hexCounts['000000'] || 0, ' ===');
console.log('=== rgb(255,255,255) alpha entries:', rgbEntries.filter(e => e.r === 255 && e.g === 255 && e.b === 255).length, '===');
console.log('=== rgb(0,0,0) alpha entries:', rgbEntries.filter(e => e.r === 0 && e.g === 0 && e.b === 0).length, '===');
console.log('=== alpha leading-dot:', alphaLeadingDot, ' leading-zero:', alphaLeadingZero, '===');
console.log('=== 3+ decimal alphas:', [...threeDecimalAlphas].join(', ') || '(none)', '===');
