/**
 * ui/gateway/state.js — THE CONNECTION-STATE CONTRACT (t1327).
 *
 * Every Gateway subtab answers the same question — "is there a machine on the other end?" — and before this each one
 * answered it differently, or not at all:
 *   · FILES kept its last successful listing on screen when the poll failed, with view and DELETE still armed. Those
 *     rows describe a controller that is not there; the delete would fire at whatever answers next.
 *   · SEND stayed fully armed with no gateway, so the failure arrived as an exception after the click.
 *   · TRACKING said IDLE while UNREACHABLE. Those are different facts: idle means "I asked and there is no job",
 *     unreachable means "I could not ask". Saying the calm one when the true one is unknown is the same class of
 *     mistake as the envelope check's cry-wolf, pointed the other way.
 *
 * So the states are DECLARED here, once, with what each tab may show in each — rather than every view inventing its
 * own answer and drifting from its neighbours.
 *
 * THE RULE THE CONTRACT ENCODES: stale data is never shown as live. A tab either has an answer from THIS state or it
 * says it does not have one. What survives an unreachable tick is only what belongs to THIS machine and needs no
 * gateway to be true (the Send tab's staged text — the operator's own program, which they can still prepare and
 * save while the machine is off).
 */

/** The connection states a subtab can be in. `reason` is what the UI says when it has to explain itself. */
export const GW_STATES = {
    unreachable: { id: 'unreachable', label: 'No gateway answering', why: 'Studio cannot reach a gateway, so nothing here is live.' },
    connected: { id: 'connected', label: 'Connected', why: '' },
};

/** THE one derivation: a descriptor means a machine answered. Nothing infers this from a dot colour or a stale row. */
export function gatewayState(desc) {
    return desc ? GW_STATES.connected : GW_STATES.unreachable;
}
export const isUnreachable = (desc) => gatewayState(desc).id === 'unreachable';

/**
 * WHAT EACH TAB DOES WHEN UNREACHABLE — declared per tab, so the sweep can assert it and a new tab has to say what
 * it means rather than defaulting to "keep whatever was there".
 *   clears  — the tab must show NO data rows in this state (a listing of a machine that is not there is a lie)
 *   keeps   — what legitimately survives, because it is not the machine's (named, so "keeps nothing" is explicit)
 *   arms    — false when its actions must be disabled; the reason rides the control
 */
export const TAB_CONTRACT = {
    status: { clears: false, keeps: 'the connection line itself — saying it is unreachable IS its job', arms: true },
    // t2241 — Merge deleted (was a permanent stub, never wired); Jobs folded into Send (BACKLOG amendment
    // 7/14). Send is genuinely MIXED now: the staged program (`clears: false`, below) is the operator's own
    // and survives; the merged queue+history LIST it now also shows is fetched data and independently clears
    // to empty on the same failed-poll path jobs/tracker/files always used (send.js's own onPoll, not this
    // boolean — the contract has no per-SECTION granularity, so this is documented here rather than modelled).
    send: { clears: false, keeps: 'the staged program text: it is the operator’s own, and preparing one needs no machine', arms: false,
        reason: 'No gateway answering — you can still stage and edit a program; sending needs a machine.' },
    tracker: { clears: true, keeps: '', arms: false, reason: '' },
    files: { clears: true, keeps: '', arms: false, reason: 'No gateway answering — the controller’s files cannot be listed.' },
    admin: { clears: false, keeps: 'the Service/daemon controls — they are how you FIX being unreachable', arms: true },
};

export const contractFor = (tabId) => TAB_CONTRACT[tabId] || null;

/**
 * The standard note a tab shows in place of data it does not have. One element, one wording, so "unreachable" reads
 * the same everywhere instead of six near-synonyms.
 */
export function stateNote(el, tabId) {
    const c = contractFor(tabId);
    const why = (c && c.reason) || GW_STATES.unreachable.why;
    return el('div', { class: 'muted gw-state-note', 'data-gw-state': 'unreachable' }, why);
}
