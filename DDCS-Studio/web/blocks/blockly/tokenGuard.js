/**
 * blocks/blockly/tokenGuard.js — REFUSE an ineligible live-value connection on the Blocks canvas (t1712, cycle
 * ACT 5, the fifth and final act of "MACHINE VARIABLES IN WIZARD BOXES"). Repaired t1714 (t1713 REPAIR): the
 * first version joined a block id and an input name with a raw NUL character as a Map-key separator, which
 * landed as literal NUL bytes in the SOURCE FILE ITSELF (not just at runtime) — git then read the file as
 * binary, so every future diff/review of it would show "Bin 0 -> N bytes" and hide the code completely. Fixed
 * by dropping the joined-string key for a nested Map (blockId -> inputName -> policy) — no separator character
 * at all, which also sidesteps the fact that a Blockly block id can itself contain almost any printable
 * character (observed live: "]$EK|w3lX6nNDnj=i-tq"), so no single-character separator was ever really safe.
 *
 * The twin form (formWidgets.js) and the legacy wizard form (surfacingView.js) both call wireTokenGuard, which
 * reads a binding's declared tokenEligible/tokenRefusal (tokenPolicyFor, wizards/ops/util.js) to accept or
 * refuse a typed token — ONE shared decision function, byte-identical refusal text on both surfaces. The
 * Blocks canvas has no per-field DOM node to wire a beforeinput listener onto: a plugged Variable reporter
 * block naming a token IS the attempt, and the moment worth checking is the instant it CONNECTS to a value
 * socket (Events.BLOCK_MOVE). tokenPolicyFor decides here too — same function, same refusal text, no third rule.
 *
 * CORRELATION — which binding governs a given (parentBlock, inputName)? Reuses the SAME identity-based
 * technique seedKnobExpose (blocks/opSession.js) already uses to seed the Blocks-tab EXPOSE knobs:
 * def.bindingSpecs (match/key), re-derived over a FRESH flattenBlocks() of THIS instance's live atom body —
 * NOT the frozen blockIndex a def.bindings entry alone carries. t1712 proved empirically (a live canvas probe,
 * corner inserted with its default param state) that the frozen blockIndex silently misindexes across corner's
 * own conditional/prune-gated sockets (cross1_x/cross1_y landed on the wrong block type): def.bindings[i].blockIndex
 * is resolved ONCE at registration against one canonical param state, not necessarily the state actually on the
 * canvas. def.bindingSpecs re-derives by IDENTITY every time, so it is immune to that drift — the same reason
 * devMode.js/opSession.js already prefer it over frozen bindings wherever prune state can vary. A def with no
 * bindingSpecs (a static, unguarded op) has no prune-drift risk, so its frozen blockIndex is safe as a fallback.
 *
 * No block.data tagging, no stackBridge.js/DURABLE_DATA_FIELDS involvement, no round-trip risk: the policy map
 * is rebuilt fresh from the LIVE workspace on every relevant connection, exactly like seedKnobExpose rebuilds
 * its own correlation fresh on every Blocks-tab load rather than trusting a stale carried value.
 */
import { getBlockly, FN } from './bridge.js';
import { workspaceToStack } from './stackBridge.js';
import { flattenBlocks, getUserDef } from '../userOps.js';
import { matches } from '../dataOps/deriveBindings.js';
import { tokenPolicyFor, isTokenAttempt } from '../../wizards/ops/util.js';
import { toast } from '../../ui/gateway/util.js';
import { sfx } from '../../ui/sound.js';   // t2125 — Blockly's own error-beep is muted; this is its replacement

/** The token-relevant specs for a def — identity-based (match/key) when available, else the frozen blockIndex
 *  (only safe for a def with no bindingSpecs — see module doc). Only specs actually declaring a token policy. */
function tokenSpecsFor(def) {
    if (Array.isArray(def.bindingSpecs) && def.bindingSpecs.length)
        return def.bindingSpecs.filter((s) => s && s.match && s.key && (s.tokenEligible || s.tokenRefusal));
    return (def.bindings || [])
        .filter((b) => b && b.blockIndex != null && b.key != null && (b.tokenEligible || b.tokenRefusal))
        .map((b) => ({ blockIndex: b.blockIndex, key: b.key, tokenEligible: b.tokenEligible, tokenRefusal: b.tokenRefusal }));
}

/** Every 'op' record anywhere in the current program stack (progstart/op/progend, a bare op, or an op nested
 *  under something else) -> a nested Map, blockId -> (inputName -> {tokenEligible, tokenRefusal}). flattenBlocks
 *  already descends through a user_root's uiChildren+children (and any other nested mouth), so this covers the
 *  wizard-authoring-chrome-plus-atoms shape a twin's 'op' wrapper carries exactly as it covers a plain atom body. */
function buildPolicyMap(ws) {
    const map = new Map();
    const collect = (rec) => {
        if (rec && rec.type === 'op' && rec.opType) {
            const def = getUserDef(rec.opType);
            if (def) {
                const flat = flattenBlocks(rec.children || []);
                for (const s of tokenSpecsFor(def)) {
                    const blk = s.match ? flat.find((r) => matches(r, s.match)) : flat[s.blockIndex];
                    if (blk && blk.id && (s.key in (blk.params || {}))) {
                        if (!map.has(blk.id)) map.set(blk.id, new Map());
                        map.get(blk.id).set(FN(s.key), { tokenEligible: s.tokenEligible, tokenRefusal: s.tokenRefusal });
                    }
                }
            }
        }
        for (const c of (rec && rec.children) || []) collect(c);
        for (const c of (rec && rec.uiChildren) || []) collect(c);
    };
    for (const rec of workspaceToStack(ws)) collect(rec);
    return map;
}

/** policyMap.get(parentId) -> .get(inputName), the one lookup the listener needs. */
function policyAt(policyMap, parentId, inputName) {
    const forBlock = policyMap.get(parentId);
    return forBlock ? forBlock.get(inputName) : undefined;
}

/** Is `block` a live-value attempt — a (non-shadow) Variable reporter naming a `#`/`[` token — worth policing at
 *  all? Mirrors isTokenAttempt's own shape so a plain literal or a non-token reporter never triggers a rebuild. */
function tokenAttemptOf(block) {
    if (!block || block.isShadow() || block.type !== 'variable') return null;
    const name = block.getFieldValue('NAME');
    return isTokenAttempt(name) ? name : null;
}

/** Install the REFUSE guard on a Blocks workspace: on every connection of a token-shaped Variable reporter into
 *  a value socket, look up the governing binding and, if tokenPolicyFor refuses, disconnect + toast the SAME
 *  declared refusal text the twin form and legacy wizard form show. Idempotent (safe to call once per ws). */
export function installTokenGuard(ws) {
    if (!ws || ws.__tokenGuardInstalled) return;
    ws.__tokenGuardInstalled = true;
    const B = getBlockly();
    ws.addChangeListener((e) => {
        if (e.type !== B.Events.BLOCK_MOVE || !e.newParentId || !e.newInputName || !e.blockId) return;
        const child = ws.getBlockById(e.blockId);
        const raw = tokenAttemptOf(child);
        if (raw == null) return;
        const policy = policyAt(buildPolicyMap(ws), e.newParentId, e.newInputName);
        if (!policy) return;
        const verdict = tokenPolicyFor(policy, raw);
        if (!verdict || verdict.eligible) return;
        child.unplug();
        toast(verdict.refusal, true);
        sfx('error');
        const parent = ws.getBlockById(e.newParentId);
        if (parent && parent.setHighlighted) {
            parent.setHighlighted(true);
            setTimeout(() => { try { parent.setHighlighted(false); } catch (_) { /* block may be gone by then */ } }, 1400);
        }
    });
}
