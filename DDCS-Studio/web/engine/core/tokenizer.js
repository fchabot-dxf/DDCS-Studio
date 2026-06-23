/**
 * engine/core/tokenizer.js — canonical G-code word tokenizer.
 *
 * Splits a (comment-stripped) line into { letter, value } words, where value
 * may be a number, a #ref, or a [bracketed expression]. This is THE single
 * tokenizer for the whole app — parser, simulator and execution engine all
 * import it. Do not re-implement it locally.
 */

/** @returns {{letter: string, value: string}[]} */
export function tokenizeWords(line) {
    const words = [];
    let i = 0;
    const n = line.length;
    const isLetter = (c) => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');

    while (i < n) {
        const ch = line[i];
        if (isLetter(ch)) {
            const letter = ch.toUpperCase();
            i += 1;
            let value = '';
            let depth = 0;
            // A letter only starts a NEW word at bracket depth 0. Inside [ … ] letters belong to the
            // expression — macro functions like COS/SIN/SQRT — so e.g. X[#1+[#3/2]*COS[#51]] stays one word.
            while (i < n && !(depth === 0 && isLetter(line[i]))) {
                const c = line[i];
                if (c === '[') depth += 1;
                else if (c === ']') depth = Math.max(0, depth - 1);
                value += c;
                i += 1;
            }
            words.push({ letter, value: value.trim() });
        } else {
            i += 1;
        }
    }
    return words;
}
