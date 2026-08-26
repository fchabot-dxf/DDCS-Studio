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
/**
 * t2291 (BACKLOG #22) — THE ONE declared "make text safe inside a G-code paren comment" rule, so `emit` below and
 * every OTHER site that interpolates text into `( … )` (atcInterpreter.js's inline tool-change header,
 * dialects/grbl.js's hmiToast, editorManager.js's exported-program title) share ONE implementation instead of
 * four independently hand-rolled ones — a `)` in the text closes the comment early and the remainder becomes
 * live G-code, on every one of those paths identically.
 *
 * MEASURED, not assumed (`bridge/controllers/COMMENT-CHARACTERS.md`, derived from 2,248 real vendor comments
 * across 3 DDCS controllers + 4,656 LinuxCNC ones): the governing constraint is NESTING, not the character set —
 * no vendor dialect ever nests parens, so stripping them is the correct, sufficient treatment. Do NOT extend
 * this to `[` `]` `#` (that document rules them OUT — they read as expressions/variables at the controller) or
 * to `%` (flagged context-dependent) without new, equally measured evidence.
 */
export const stripCommentParens = (text) => String(text ?? '').replace(/[()]/g, '');

export const commentBlock = {
    type: 'comment', label: 'Comment', kind: 'leaf', category: 'Mark Up', hidden: true,
    defaults: { text: 'note' },
    fields: ['text'],
    emit: (p) => [`( ${stripCommentParens(p.text)} )`],   // t2291 — the rule now lives in ONE place (stripCommentParens); this call's own OUTPUT is unchanged (same regex, same String(x ?? '') coercion) — a refactor to one source, not a behaviour change, per the owner's own ruling that this emitter stays as it is
};
