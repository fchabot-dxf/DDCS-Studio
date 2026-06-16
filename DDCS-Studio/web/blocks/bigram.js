/**
 * blocks/bigram.js — a tiny generic bigram (first-order Markov) suggester, SHARED by the Blocks next-block
 * strip/float and the Studio editor's next-word box.
 *
 * Counts "token A is followed by B" across recorded sequences (persisted to localStorage so it learns habits
 * over sessions), blended with a curated cold-start seed. Learned counts are weighted higher so the user's own
 * patterns win. Callers parameterise the vocabulary: Blocks records block-TYPE sequences, the editor records
 * G-code WORD sequences. See suggest.js (blocks) and ui/editorAutocomplete.js (g-code words).
 */
export function makeBigram({ seed = {}, storageKey, learnWeight = 3, exclude = [] } = {}) {
    const skip = new Set(exclude);
    let learned = load();
    function load() { try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (_) { return {}; } }
    function save() { try { localStorage.setItem(storageKey, JSON.stringify(learned)); } catch (_) { /* quota */ } }

    // Learn adjacent A→B transitions from a token sequence. Deduped by signature so a repeated identical sequence
    // (e.g. the same program re-emitting many change events on a param edit) doesn't over-count one sample.
    let lastSig = '';
    function record(seq) {
        const s = (seq || []).filter(Boolean);
        const sig = s.join('>');
        if (sig === lastSig) return;
        lastSig = sig;
        let changed = false;
        for (let i = 0; i < s.length - 1; i++) {
            const a = s[i], b = s[i + 1];
            (learned[a] || (learned[a] = {}))[b] = (learned[a][b] || 0) + 1;
            changed = true;
        }
        if (changed) save();
    }

    // Most-likely next tokens after `type`. `valid` (optional Set) restricts allowed tokens.
    function suggestNext(type, n = 5, valid = null) {
        if (!type) return [];
        const score = {};
        const sd = seed[type] || [];
        sd.forEach((t, i) => { score[t] = (score[t] || 0) + (sd.length - i); });   // rank → weight
        const lr = learned[type] || {};
        for (const t in lr) score[t] = (score[t] || 0) + lr[t] * learnWeight;       // learned weighted higher
        return Object.entries(score)
            .filter(([t]) => t !== type && !skip.has(t) && (!valid || valid.has(t)))
            .sort((a, b) => b[1] - a[1])
            .slice(0, n)
            .map(([t]) => t);
    }

    function _reset() { learned = {}; lastSig = ''; save(); }
    return { suggestNext, record, _reset };
}
