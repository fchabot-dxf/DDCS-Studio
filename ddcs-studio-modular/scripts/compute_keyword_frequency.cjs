// Node script (CommonJS): compute_keyword_frequency.cjs
// Usage: node scripts/compute_keyword_frequency.cjs
// Outputs JSON with top keywords and phrases to stdout

const fs = require('fs');
const path = require('path');

function readFileSafe(p) {
    try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

// Collect text sources
const repoRoot = path.resolve(__dirname, '..');
const candidates = [
    path.join(repoRoot, '..', 'Variables-ENG 01-04-2025.csv'),
    path.join(repoRoot, '..', 'default_vars.js'),
    path.join(repoRoot, 'default_vars.js'),
    path.join(repoRoot, '..', 'ddcs-studio-modular', 'default_vars.js'),
];

let lines = [];
for (const p of candidates) {
    const txt = readFileSafe(p);
    if (!txt) continue;

    // If it's a CSV file (by extension), parse by lines
    if (path.extname(p).toLowerCase() === '.csv') {
        txt.split(/\r?\n/).forEach(l => lines.push({src: p, text: l}));
        continue;
    }

    // If it's a .js with CSV-like data, pull lines that look like CSV rows: starting with number or "#"
    txt.split(/\r?\n/).forEach(l => {
        const t = l.trim();
        if (!t) return;
        // Accept lines that start with a number or quoted number and comma (e.g., 595,B,...) or starting with quotes
        if (/^\s*\d+\s*,/.test(t) || /^\s*"?\d+"?\s*,/.test(t)) {
            lines.push({src: p, text: t});
        }
    });
}

// Simple CSV split that respects quoted commas
function splitCSVLine(line) {
    return line.split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/).map(s => s.replace(/^\s*"?|"?\s*$/g, ''));
}

// Extract description (col index 2) and notes (3)
let texts = [];
for (const l of lines) {
    const parts = splitCSVLine(l.text);
    if (parts.length >= 3) {
        const desc = parts[2] || '';
        const notes = parts[3] || '';
        if (desc && desc.trim()) texts.push(desc.trim());
        if (notes && notes.trim()) texts.push(notes.trim());
    }
}

if (texts.length === 0) {
    console.error('No description text found in candidate files.');
    process.exit(2);
}

// Normalization & tokenization
const stopWords = new Set([
    'the','and','for','with','that','this','from','are','was','were','is','in','on','of','to','by','as','it','be','or','an','a','may','used','use','per','if','not','also','when','which','can','only','will','such','these','have','has'
]);
// Exclude existing filters
const excluded = new Set(['user','system','hasdesc','probe','g31','wcs','axisrange','input','output','function','key']);

function tokenize(s) {
    // Lowercase
    s = s.toLowerCase();
    // replace / with space, keep letters and spaces (split hyphenated into words)
    s = s.replace(/[\"'()\[\]{}<>:;./\\?@#$%^&*_+=~`|,]/g, ' ');
    // replace numbers with space
    s = s.replace(/\d+/g, ' ');
    // collapse whitespace
    s = s.replace(/\s+/g, ' ').trim();
    if (!s) return [];
    const toks = s.split(' ').filter(t => t.length >= 3 && !stopWords.has(t) && !excluded.has(t));
    return toks;
}

const wordCounts = new Map();
const phraseCounts = new Map();

for (const t of texts) {
    const toks = tokenize(t);
    // count words
    for (const w of toks) {
        wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
    }
    // count 2-word and 3-word contiguous phrases
    for (let n = 2; n <= 3; n++) {
        for (let i = 0; i + n <= toks.length; i++) {
            const ph = toks.slice(i, i + n).join(' ');
            phraseCounts.set(ph, (phraseCounts.get(ph) || 0) + 1);
        }
    }
}

function topN(map, n) {
    return Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,n);
}

const topWords = topN(wordCounts, 50); // get more to later filter if needed
const topPhrases = topN(phraseCounts, 20);

// We'll return top 15 keywords but exclude anything that is obviously numeric or short
const keywords = topWords.slice(0, 50).map(([k,c])=>({keyword:k,count:c})).filter(x => !excluded.has(x.keyword)).slice(0,15);
const phrases = topPhrases.slice(0,3).map(([p,c])=>({phrase:p,count:c}));

// Build labels and match rules
const outKeywords = keywords.map(k => {
    const label = k.keyword.split(' ').map(w => w[0].toUpperCase()+w.slice(1)).join(' ');
    return { keyword: k.keyword, count: k.count, label: label, match: `description includes '${k.keyword}'` };
});

const out = { keywords: outKeywords, phrases };
console.log(JSON.stringify(out, null, 2));

// Also write to a file for convenience
try {
    fs.writeFileSync(path.join(repoRoot, 'keyword_frequency.json'), JSON.stringify(out, null, 2), 'utf8');
} catch (e) {
    // ignore
}

process.exit(0);
