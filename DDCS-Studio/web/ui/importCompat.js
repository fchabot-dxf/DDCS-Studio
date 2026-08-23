/**
 * ui/importCompat.js — THE CONFIRM-ON-IMPORT SUMMARY (t2196, amendment 3 from t2192).
 *
 * t2194 retired the standalone-file LIBRARY shelf in both managers (wizardManager.js's and projectManager.js's own)
 * because it misrepresented itself as a second container. Its ONE real value — seeing what a file was BEFORE it
 * became part of this workspace — had no replacement yet. This is that replacement, moved to where it actually
 * belongs: the moment of import itself, not a permanent shelf beside it.
 *
 * ONE declared summary, shared between BOTH managers and BOTH file kinds (.wiz wizards, .mjson projects) — the
 * spec's own list: name clash, wrong machine/axes, wrong dialect, missing #-variables, what it makes, provenance.
 * A kind that doesn't carry a given fact (a wizard has no `post`; a from-scratch wizard has no `forkedFrom`) just
 * omits that line — never invented, never guessed.
 *
 * TWO NEARLY-FREE CHECKS lead, because they PREVENT a bad import rather than merely reporting one after the file
 * already copied into the workspace: wrong machine/axes reuses ui/axisGating.js's own declared tables (the SAME
 * ones that greyed the op on the bar); wrong dialect reads the def's own `post` field where the kind declares one
 * (a .mjson project always does — data/programFile.js's serializeProject stamps it at save time; a .wiz wizard
 * never does — it is data-driven and post-gated live at RENDER time instead, so there is nothing to compare there).
 *
 * MISSING VARIABLES IS A LISTED FACT, NOT A VERDICT (human ruling, 2026-08-23): "my own workspace wouldn't know
 * either if I set them" — a workspace only ever knows a #-variable's NUMBER and whatever name a human typed beside
 * it, never what the number means on the machine that assigned it. A check that fires on ABSENCE (this workspace
 * has never heard of #510) and stays silent on COLLISION (this workspace's own #510 means something else entirely)
 * is worse than no check: it grants confidence exactly where it should not. So this never says "unknown" or "ok" —
 * it names the numbers used and asks the human to look, the same epistemic honesty as [[plan-text-is-not-evidence]].
 */
import { missingAxesFor, frameWhy } from './axisGating.js';
import { builtinTypeForTwin } from '../blocks/wizardLibrary.js';   // the declared twin→built-in bridge (t1049) — a stack entry's opType is a TWIN (e.g. 'user_pocket_data'), and axisGating's tables are keyed on the built-in family ('pocket')
import { getMachine } from '../data/workspaceMachine.js';
import { getActiveProfile, CONTROLLER_PROFILES } from '../shared/js/profiles/controllerProfiles.js';
import { resolveActivePost, DIALECTS } from '../wizards/dialects/index.js';

const VAR_RE = /#(\d{2,4})\b/g;

/** Every distinct #NNN referenced anywhere in the raw imported file TEXT, sorted. A plain regex over the raw JSON
 *  (before parsing) rather than a semantic walk of the def/stack shape — deliberately, since this is advisory text
 *  a human reads, not a gate anything acts on; a bit of over-matching costs nothing a verdict-based check couldn't
 *  afford, and a semantic walker would be new machinery for a fact that stays this cheap either way. */
export function scanVarRefs(rawText) {
    const set = new Set();
    VAR_RE.lastIndex = 0;
    let m;
    const text = String(rawText || '');
    while ((m = VAR_RE.exec(text))) set.add(Number(m[1]));
    return [...set].sort((a, b) => a - b);
}

/**
 * Every distinct op IDENTITY (`opType`, e.g. 'user_pocket_data') anywhere in a value — a plain recursive walk over
 * any object/array shape (a wizard's own single `file.opType`, or a project's whole nested op stack) rather than a
 * schema-specific reader, so a new nesting shape (a group, a sub-stack) is covered automatically instead of
 * silently unwalked. `opType` (the semantic identity), not `type` (a structural/atom-kind field like 'op'/'move') —
 * a stack entry's own shape declares that distinction (tests/backup-852.spec.js's own fixture: `{type:'op',
 * opType:'user_pocket_data'}`), and reading the wrong one would collect wrapper noise instead of real op identity.
 */
export function collectOpTypes(value, out = new Set()) {
    if (Array.isArray(value)) { for (const v of value) collectOpTypes(v, out); return [...out]; }
    if (value && typeof value === 'object') {
        if (typeof value.opType === 'string') out.add(value.opType);
        for (const k of Object.keys(value)) collectOpTypes(value[k], out);
    }
    return [...out];
}

/** An opType resolved to the key axisGating.js's OWN tables are keyed on — a twin (e.g. 'user_pocket_data') via
 *  the declared twin→built-in bridge, a genuine non-twin opType via the SAME bare-prefix convention axisGating
 *  itself uses internally, so a raw built-in family name passed straight through (older stacks, or a wizard's own
 *  `opensAs`, which is already a bare built-in id) still matches. */
function axisKey(opType) {
    const twin = builtinTypeForTwin(opType);
    return twin ? twin.type : String(opType || '').replace(/^user_/, '');
}

/** Axis/frame compatibility across one or more op identities — deduplicated, so a project whose stack repeats the
 *  same impossible op several times names the reason once, not once per op. */
export function axisCompatReasons(opTypes, machine = getMachine()) {
    const reasons = [];
    const seen = new Set();
    for (const raw of opTypes) {
        const t = axisKey(raw);
        const frame = frameWhy(t, machine);
        const missing = frame ? [] : missingAxesFor(t, machine);
        const why = frame || (missing.length ? `needs a ${missing.join(' and ')} axis — this workspace doesn't declare ${missing.length > 1 ? 'them' : 'one'}` : '');
        if (why && !seen.has(why)) { seen.add(why); reasons.push(why); }
    }
    return reasons;
}

/** The friendly dialect name for a profile/dialect id, or the raw id if this build doesn't recognise it. */
function dialectName(id) {
    const d = DIALECTS[id];
    return (d && d.name) || id;
}

/**
 * Build the plain-text confirm-on-import summary (dlgConfirm's `message` is textContent, not HTML — so this is
 * newline-joined plain text, matching every other summary in this codebase, e.g. data/backup.js's changeLabel).
 *
 * @param {object} facts
 * @param {string} facts.name           the file's own name/label, for the confirm's title
 * @param {string} [facts.existing]     label of the SAME-identity thing already in this workspace, if any (collision)
 * @param {string[]} [facts.opTypes]    op type(s) the import would place — drives the axis/frame check
 * @param {string} [facts.post]         the dialect/profile id the file declares itself for (projects only)
 * @param {string} [facts.rawText]      the raw imported file text — scanned for #-variable references
 * @param {string} [facts.whatItMakes]  a plain description of the op(s) this import produces
 * @param {string} [facts.provenance]   where this came from (a fork's source, or a project's authoring machine)
 * @returns {{title: string, body: string, hasWarning: boolean}}
 */
export function buildImportSummary({ name, existing, opTypes = [], post = null, rawText = '', whatItMakes = '', provenance = '' } = {}) {
    const lines = [];
    let hasWarning = false;
    if (existing) { lines.push(`⚠ Already in this workspace, as "${existing}" — importing REPLACES it.`); hasWarning = true; }

    for (const reason of axisCompatReasons(opTypes)) { lines.push(`⚠ Wrong machine — ${reason}.`); hasWarning = true; }

    if (post) {
        const active = resolveActivePost(getActiveProfile().id);
        if (active && active.id && active.id !== post) {
            lines.push(`⚠ Wrong dialect — saved for ${dialectName(post)}, this workspace runs ${active.name || active.id}.`);
            hasWarning = true;
        }
    }

    const vars = scanVarRefs(rawText);
    if (vars.length) lines.push(`ℹ Uses ${vars.map((v) => '#' + v).join(', ')} — check they mean what you expect on this machine.`);

    if (whatItMakes) lines.push(`Makes: ${whatItMakes}`);
    if (provenance) lines.push(`Provenance: ${provenance}`);

    return { title: `Import "${name}"?`, body: lines.join('\n'), hasWarning };
}

/** The friendly machine-profile name a .mjson project's `profile` field names, for its provenance line. */
export function profileName(profileId) {
    return (CONTROLLER_PROFILES[profileId] || {}).name || profileId || '';
}
