/**
 * wizards/ops/comment.js — COMMENT (Mark Up): an annotation block → a G-code comment `( … )`.
 *
 * Tinkercad's "Mark Up" category. Documents/teaches a program inline; survives export as a real comment.
 */
export const commentBlock = {
    type: 'comment', label: 'Comment', kind: 'leaf', category: 'Mark Up',
    defaults: { text: 'note' },
    fields: ['text'],
    emit: (p) => [`( ${String(p.text ?? '').replace(/[()]/g, '')} )`],   // strip parens so the comment can't break the file
};
