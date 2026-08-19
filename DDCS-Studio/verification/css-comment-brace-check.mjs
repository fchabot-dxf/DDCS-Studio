// Comment-aware brace-depth balance PLUS comment-delimiter balance, for any CSS file.
// Two independent failure classes, both silent to the naked eye and to each other:
//   1. Brace balance: an unmatched { or } outside a comment (the original t2069-era check).
//   2. Comment-delimiter balance: a `*/` embedded mid-sentence inside a comment's own intended
//      text (e.g. "sv-*/bv-*" meant as "sv-* / bv-*") closes the comment EARLY -- a real parser
//      sees it correctly (comments don't nest), so brace counting alone can stay balanced while
//      the comment closed in the wrong place and dumped prose as live CSS. First bit t2069,
//      bit again identically at t2083 (P4d) -- caught only by getComputedStyle diffing both
//      times, never by the brace check, because a stray `*/` doesn't necessarily unbalance
//      braces, it only breaks comment boundaries.
// Heuristic for (2): a DELIBERATE comment terminator almost always has whitespace/newline (or
// another `*`) on both sides ("...text. */\n" or "*/" alone on its own line). An ACCIDENTAL one
// is glued to word characters on BOTH sides with no space (a hyphen/letter/digit immediately
// before the `*` and immediately after the `/`) -- that shape is what actually bit both times.
// Usage: node verification/css-comment-brace-check.mjs [path-to-css]
import fs from 'node:fs';

const path = process.argv[2] || new URL('../web/styles.css', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const text = fs.readFileSync(path, 'utf-8');

let depth = 0;
let inComment = false;
let inString = null; // ' or "
const suspects = [];
let line = 1;

const isWordChar = (c) => c !== undefined && /[A-Za-z0-9_-]/.test(c);

for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\n') line++;

    if (inComment) {
        if (c === '*' && text[i + 1] === '/') {
            const before = text[i - 1];
            const after = text[i + 2];
            if (isWordChar(before) && isWordChar(after)) {
                suspects.push({ line, context: text.slice(Math.max(0, i - 20), i + 22).replace(/\n/g, '\\n') });
            }
            inComment = false;
            i++; // consume the '/'
        }
        continue;
    }
    if (inString) {
        if (c === '\\') { i++; continue; }
        if (c === inString) inString = null;
        continue;
    }
    if (c === '/' && text[i + 1] === '*') { inComment = true; i++; continue; }
    if (c === '"' || c === "'") { inString = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
}

console.log(`file: ${path}`);
console.log(`final brace depth: ${depth} (expect 0)`);
console.log(`comment-delimiter suspects: ${suspects.length}`);
for (const s of suspects) {
    console.log(`  line ${s.line}: ...${s.context}...`);
}
if (depth !== 0 || suspects.length) process.exitCode = 1;
