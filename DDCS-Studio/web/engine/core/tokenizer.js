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
            while (i < n && !isLetter(line[i])) {
                value += line[i];
                i += 1;
            }
            words.push({ letter, value: value.trim() });
        } else {
            i += 1;
        }
    }
    return words;
}
