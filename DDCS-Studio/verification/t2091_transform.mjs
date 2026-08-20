// t2091 (P5c) — the invisible-half color-notation cleanup. Comment-aware AND exempt-zone-aware (comm-dialog,
// setup-sheet-page + its @media print block are never touched, regardless of what matches). Dry-run by
// default; pass --apply to write the result.
import fs from 'node:fs';

const filePath = new URL('../web/styles.css', import.meta.url);
const text = fs.readFileSync(filePath, 'utf-8');
const APPLY = process.argv.includes('--apply');
const CLUSTER_THRESHOLD = 4;

// ---- locate exempt zones by their own start/end markers, not hardcoded line numbers ----
function findExemptRanges(src) {
    const ranges = [];
    const commStart = src.indexOf('.comm-screen-wrap {');
    const commEndMarker = '.comm-beep-preview-btn {';
    const commEndIdx = src.indexOf(commEndMarker, commStart);
    const commEnd = src.indexOf('}', commEndIdx) + 1;
    if (commStart === -1 || commEndIdx === -1) throw new Error('comm-dialog exempt zone markers not found');
    ranges.push([commStart, commEnd]);

    const sheetStart = src.indexOf('.setup-sheet-page {');
    const printStart = src.indexOf('@media print {', sheetStart);
    const printEnd = src.indexOf('\n}', printStart) + 2;
    if (sheetStart === -1 || printStart === -1) throw new Error('setup-sheet-page exempt zone markers not found');
    ranges.push([sheetStart, printEnd]);

    return ranges;
}

function isExempt(idx, ranges) {
    return ranges.some(([s, e]) => idx >= s && idx < e);
}

// ---- comment-span detection (same state machine as css-comment-brace-check.mjs) ----
function findCommentSpans(src) {
    const spans = [];
    let inComment = false, start = -1;
    for (let i = 0; i < src.length; i++) {
        if (!inComment && src[i] === '/' && src[i + 1] === '*') { inComment = true; start = i; i++; continue; }
        if (inComment && src[i] === '*' && src[i + 1] === '/') { inComment = false; spans.push([start, i + 2]); i++; continue; }
    }
    return spans;
}

function isInComment(idx, spans) {
    return spans.some(([s, e]) => idx >= s && idx < e);
}

const exemptRanges = findExemptRanges(text);
const commentSpans = findCommentSpans(text);
const protectedFn = (idx) => isExempt(idx, exemptRanges) || isInComment(idx, commentSpans);

console.log('exempt zones (char offsets):', exemptRanges);
console.log('comment spans found:', commentSpans.length);

// ---- 1. Build the near-duplicate cluster map (6-digit hex only, comment/exempt aware for COUNTING too) ----
function stripProtected(src) {
    let out = '';
    for (let i = 0; i < src.length; i++) out += protectedFn(i) ? ' ' : src[i];
    return out;
}
const liveText = stripProtected(text);
const hexRe6 = /#([0-9a-fA-F]{6})\b/g;
const counts = {};
let m;
while ((m = hexRe6.exec(liveText))) { const h = m[1].toLowerCase(); counts[h] = (counts[h] || 0) + 1; }
const toRgb = (hex) => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
const dist = (a, b) => { const [r1, g1, b1] = toRgb(a), [r2, g2, b2] = toRgb(b); return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2); };
const hexesSorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
const visited = new Set();
const clusterMap = {}; // member -> canonical
const clusterReport = [];
for (const h of hexesSorted) {
    if (visited.has(h)) continue;
    const members = [];
    visited.add(h);
    for (const other of hexesSorted) {
        if (visited.has(other)) continue;
        if (dist(h, other) <= CLUSTER_THRESHOLD) { members.push(other); visited.add(other); }
    }
    if (members.length) {
        for (const mem of members) clusterMap[mem] = h;
        clusterReport.push({ canonical: h, count: counts[h], members: members.map((mem) => ({ hex: mem, count: counts[mem], d: dist(h, mem) })) });
    }
}
console.log(`\ncluster threshold: Euclidean RGB distance <= ${CLUSTER_THRESHOLD}`);
console.log(`clusters: ${clusterReport.length}, colours collapsed: ${clusterReport.reduce((s, c) => s + c.members.length, 0)}`);
for (const c of clusterReport) console.log(`  #${c.canonical}(×${c.count}) <- ` + c.members.map((mm) => `#${mm.hex}(×${mm.count},d=${mm.d.toFixed(2)})`).join(', '));

// ---- 2. Apply substitutions char-range-safe: walk the text, only touch spans NOT protected ----
// We build the output by processing matches in order and only transforming those outside protected zones.
let result = text;
let stats = { hexNotation: 0, whiteKeyword: 0, alphaLeadingZero: 0, clustersCollapsed: 0, threeDecimalAlpha: 0 };

// helper: apply a regex replace ONLY on non-protected matches, using the ORIGINAL text's protected map
// (recomputed after each pass since indices shift -- so we do all passes on a working copy, checking
// protection via a FRESH scan of exempt/comment zones each time using markers, which are stable text, not
// offsets, so this is safe to run sequentially).
function replaceProtected(src, regex, transform, statKey) {
    const ranges = findExemptRanges(src);
    const spans = findCommentSpans(src);
    let out = '';
    let last = 0;
    let count = 0;
    regex.lastIndex = 0;
    let mm;
    while ((mm = regex.exec(src))) {
        const idx = mm.index;
        const protectedHere = ranges.some(([s, e]) => idx >= s && idx < e) || spans.some(([s, e]) => idx >= s && idx < e);
        out += src.slice(last, idx);
        if (protectedHere) {
            out += mm[0];
        } else {
            const replacement = transform(mm);
            if (replacement !== mm[0]) count++;
            out += replacement;
        }
        last = idx + mm[0].length;
    }
    out += src.slice(last);
    if (statKey) stats[statKey] = count;
    return out;
}

// (a) hex notation: #ffffff -> #fff, #000000 -> #000
result = replaceProtected(result, /#ffffff\b/g, () => '#fff', 'ff_notation');
result = replaceProtected(result, /#000000\b/g, () => '#000', '00_notation');

// (b) bare white keyword as a real CSS value (preceded by ':' or ',' or '(' or start, not part of a --name)
result = replaceProtected(result, /(:\s*)white(\s*!important)?\b/g, (mm) => mm[1] + '#fff' + (mm[2] || ''), 'whiteKeyword');

// (c) near-duplicate hex clusters: replace every MEMBER hex with its canonical
result = replaceProtected(result, /#([0-9a-fA-F]{6})\b/g, (mm) => {
    const h = mm[1].toLowerCase();
    if (clusterMap[h]) { stats.clustersCollapsed++; return '#' + clusterMap[h]; }
    return mm[0];
}, null);

// (d) alpha notation: leading-zero -> leading-dot, inside rgba(...) alpha position only.
// Match the whole rgba(...) call and rewrite just the alpha arg if it starts with "0."
result = replaceProtected(result, /rgba\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*(0\.[0-9]+)\s*\)/g, (mm) => {
    const alpha = mm[4];
    const newAlpha = alpha.replace(/^0\./, '.');
    stats.alphaLeadingZero++;
    return `rgba(${mm[1]}, ${mm[2]}, ${mm[3]}, ${newAlpha})`;
}, null);

// (e) the one 3+-decimal alpha: .045 -> .05 (rounds to the nearest sensible 2-decimal step; this specific
// value sits in a decorative HUD grid-line gradient where neighbouring stops use 2-decimal alphas)
result = replaceProtected(result, /\.045\b/g, () => { stats.threeDecimalAlpha++; return '.05'; }, null);

console.log('\n=== substitution stats ===');
console.log(JSON.stringify(stats, null, 2));

if (APPLY) {
    fs.writeFileSync(filePath, result, 'utf-8');
    console.log('\nWROTE', filePath.pathname);
} else {
    console.log('\nDRY RUN -- pass --apply to write changes');
}
