/**
 * wizards/ops/comment.js — COMMENT (Mark Up): an annotation block → a G-code comment `( … )`.
 *
 * Tinkercad's "Mark Up" category. Documents/teaches a program inline; survives export as a real comment.
 *
 * t2289 — `hidden: true`: no longer a DRAGGABLE toolbox entry (the `hidden` flag `buildToolbox`/the palette
 * search already respect, same mechanism `safetraverse` uses — t903). A human's own path to "comment on a
 * block" is now the native Blockly comment bubble (right-click → Add Comment, any block — see
 * blockEmitter.js's applyAttachedComments + stackBridge.js's toRecord/recToJson for how that text became real,
 * model-carried, EMITTING program content this turn — BACKLOG #26). The TYPE stays fully registered — never
 * remove it — for load-compatibility (a `.ddcs`/`.nc` in the wild may already contain one) and because it is
 * genuinely load-bearing: dozens of wizards (`newBlock('comment')` throughout `wizards/stacks/*.js`,
 * `wizards/lathe/*.js`) construct one programmatically as a generated-body marker line, and several
 * `dataOps/*.js` files pattern-match a comment's OWN TEXT to find/replace structural markers inside a
 * regenerated op body (e.g. `atcTestData.js`, `commData.js`, `cornerData.js`) — none of that reads the
 * toolbox at all, so hiding the palette entry cannot touch it. Sequenced deliberately AFTER attached notes
 * were confirmed emitting (this same turn) — removing the palette entry first would have left a window with
 * no way to add a comment at all.
 */
export const commentBlock = {
    type: 'comment', label: 'Comment', kind: 'leaf', category: 'Mark Up', hidden: true,
    defaults: { text: 'note' },
    fields: ['text'],
    emit: (p) => [`( ${String(p.text ?? '').replace(/[()]/g, '')} )`],   // strip parens so the comment can't break the file
};
