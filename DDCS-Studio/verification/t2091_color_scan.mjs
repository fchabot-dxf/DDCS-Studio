// t2091 (P5c) — scan every color literal in styles.css: hex (3/4/6/8), rgb()/rgba(), and the white/black
// keywords. Classifies notation forms and reports counts, for a precise picture before touching anything.
import fs from 'node:fs';
const text = fs.readFileSync(new URL('../web/styles.css', import.meta.url), 'utf-8');
const lines = text.split('\n');

const hexRe = /#([0-9a-fA-F]{3,8})\b/g;
const rgbRe = /rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*(?:,\s*([0-9.]+)\s*)?\)/g;
const namedWhiteRe = /\bwhite\b/gi;
const namedBlackRe = /\bblack\b/gi;

let hexCounts = {};
let rgbCounts = {};
let namedWhite = 0, namedBlack = 0;
let alphaLeadingDot = 0, alphaLeadingZero = 0;
let threeDecimalAlphas = new Set();

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
        const key = `${m[1]},${m[2]},${m[3]}` + (m[4] !== undefined ? `,${m[4]}` : '');
        rgbCounts[key] = (rgbCounts[key] || 0) + 1;
        if (m[4] !== undefined) {
            if (/^\./.test(m[4])) alphaLeadingDot++;
            else if (/^0\./.test(m[4])) alphaLeadingZero++;
            const decimals = (m[4].split('.')[1] || '').length;
            if (decimals >= 3) threeDecimalAlphas.add(m[4]);
        }
    }
    namedWhiteRe.lastIndex = 0;
    while ((m = namedWhiteRe.exec(line))) namedWhite++;
    namedBlackRe.lastIndex = 0;
    while ((m = namedBlackRe.exec(line))) namedBlack++;
}

console.log('=== HEX total distinct:', Object.keys(hexCounts).length, '===');
console.log('=== HEX total occurrences:', Object.values(hexCounts).reduce((a, b) => a + b, 0), '===');
console.log('=== HEX used exactly once:', Object.values(hexCounts).filter((c) => c === 1).length, '===');
console.log();
console.log('=== named white occurrences:', namedWhite, '===');
console.log('=== named black occurrences:', namedBlack, '===');
console.log();
console.log('=== white-ish hex forms (fff / ffffff) ===');
console.log('fff:', hexCounts['fff'] || 0, '  ffffff:', hexCounts['ffffff'] || 0);
console.log('=== black-ish hex forms (000 / 000000) ===');
console.log('000:', hexCounts['000'] || 0, '  000000:', hexCounts['000000'] || 0);
console.log();
console.log('=== rgb(255,255,255) family ===');
for (const [k, v] of Object.entries(rgbCounts)) if (k.startsWith('255,255,255')) console.log(' ', k, '×', v);
console.log('=== rgb(0,0,0) family ===');
for (const [k, v] of Object.entries(rgbCounts)) if (k.startsWith('0,0,0')) console.log(' ', k, '×', v);
console.log();
console.log('=== alpha notation: leading-dot (.5) vs leading-zero (0.5) ===');
console.log('leading-dot:', alphaLeadingDot, '  leading-zero:', alphaLeadingZero);
console.log();
console.log('=== three(+)-decimal alphas found (sample, up to 30) ===');
console.log([...threeDecimalAlphas].slice(0, 30).join(', '));
console.log('total distinct 3+decimal alphas:', threeDecimalAlphas.size);
