/**
 * data/latheTools.js — THE LATHE TOOL RECORD (t1325). Declarations only: no UI, no emit.
 *
 * ONE TABLE, PER-KIND ROWS — the stock-modal pattern applied to tools. A mill workspace's tool library is exactly
 * what it has always been (asserted unchanged, both ways); a LATHE workspace's table speaks lathe, because a turning
 * insert has nothing a flute count or a plunge feed can describe. What changes per kind is a handful of QUICK FACTS,
 * declared here once, so the table, the wizard prefills, the CAM rows and the 3D all read the same list instead of
 * four hand-written copies of "a parting tool has a blade width".
 *
 * ── THE UNIT IS A FACT ABOUT THE TOOL ────────────────────────────────────────────────────────────────────────────
 * A turner owns the inserts they own: an imperial blade in a metric shop is normal, not a mode the machine is in. So
 * the unit rides the TOOL — its quick facts are stored in the unit the tool is SOLD in, and the label carries that
 * unit everywhere the number surfaces (the form annotation, the CAM row label). Consumers convert exactly ONCE, in
 * the macro header (×25.4 for an inch tool), and the emitted program is metric throughout.
 *
 * NEVER G20/G21. A modal unit switch rescales EVERY word after it — feeds, arcs, the clearance, an unrelated axis in
 * the same block — so one imperial blade would silently reinterpret the whole program. Converting the ONE number the
 * tool contributes, at the top, is the containable version of the same intent.
 *
 * NOT the same key as TOOL_CATALOG's `unit`, which means "the natural unit of this template's NAME" and drives the
 * mill catalog picker's filter. That one never reaches a tool record (normalizeTool drops it); this one is stored.
 *
 * ── WHAT v1 DOES NOT DO, stated rather than implied ──────────────────────────────────────────────────────────────
 *   · no .tool library export (a file format is its own turn)
 *   · no form-tool carving (the carve stays point-insert — see where the profile is consumed)
 *   · no lead-angle honesty gating: the lead angle is RECORDED and drawn, but nothing yet refuses a cut whose
 *     approach the insert's angle cannot physically reach. Recording it first is what makes that check possible.
 */

/** A quick fact: one number a tool of this kind carries, with the label and unit it is spoken in. */
const fact = (key, label, unit, dflt, hint) => ({ key, label, unit, default: dflt, hint });

/**
 * THE KINDS. Each declares the quick facts that make a tool of that kind usable — nothing more. `profile` names the
 * STARTER silhouette (viz/toolProfiles.js) prefilled on a new tool of this kind and then dragged into the real grind.
 */
export const LATHE_TOOL_KINDS = {
    turning: {
        id: 'turning', label: 'Turning', profile: 'turning',
        why: 'The general OD/facing insert. Its lead angle is what decides which approaches it can physically reach.',
        facts: [
            // 93° is the common turning/facing insert (a DCMT/DCGT-style holder) — the value a turner recognises.
            fact('leadAngle', 'Lead angle', '°', 93, 'The angle between the insert edge and the bar. 93° is the common OD/facing holder.'),
            fact('noseRadius', 'Nose R', 'mm', 0.4, 'The insert tip radius — it rounds every internal corner the tool cuts.'),
        ],
    },
    parting: {
        id: 'parting', label: 'Parting / grooving', profile: 'parting',
        why: 'A blade, not a point: the width IS the cut, so it is the number every parting op needs.',
        facts: [fact('bladeWidth', 'Blade width', 'mm', 3, 'The kerf this blade cuts — a parting op takes its groove width from here.')],
    },
    centredrill: {
        id: 'centredrill', label: 'Centre drill', profile: 'centredrill',
        why: 'Starts a hole on the centreline so a drill cannot walk.',
        facts: [fact('dia', 'Ø', 'mm', 3, 'The pilot diameter it cuts.')],
    },
    drill: {
        id: 'drill', label: 'Drill', profile: 'drill',
        why: 'Held on the centreline in the tailstock or the turret; it bores along Z.',
        facts: [fact('dia', 'Ø', 'mm', 6, 'The drill diameter.')],
    },
};

/** Kind ids in table order. */
export const LATHE_TOOL_KIND_IDS = Object.keys(LATHE_TOOL_KINDS);

/** The kinds a machine of this shape offers. A mill workspace declares NO kinds — its table is the mill table,
 *  unchanged, which is the property this turn must not break. */
export function toolKindsFor(machineKind) {
    return machineKind === 'lathe' ? LATHE_TOOL_KIND_IDS : [];
}

/** Every quick-fact key across every kind — the columns a lathe table can show, and the keys normalizeTool keeps. */
export const LATHE_FACT_KEYS = Array.from(new Set(
    LATHE_TOOL_KIND_IDS.flatMap((k) => LATHE_TOOL_KINDS[k].facts.map((f) => f.key))));

/** The facts of one kind (empty for an unknown/mill kind — never a throw: a table renders what it has). */
export const factsOf = (kind) => (LATHE_TOOL_KINDS[kind] ? LATHE_TOOL_KINDS[kind].facts : []);

/** One fact's declaration, by kind + key. */
export const factOf = (kind, key) => factsOf(kind).find((f) => f.key === key) || null;

// ── UNITS ────────────────────────────────────────────────────────────────────────────────────────────────────────
export const TOOL_UNITS = ['mm', 'inch'];
export const MM_PER_INCH = 25.4;
/** The tool's declared unit, defaulted. A record with no unit is metric — which is every tool that exists today, so
 *  adding this field changes no stored number. */
export const unitOf = (tool) => ((tool && tool.unit === 'inch') ? 'inch' : 'mm');
/** A fact's value in MM, whatever unit the tool is spoken in. THE one conversion — call it, never re-type 25.4.
 *  An angle is not a length: a lead angle is 93° in either unit, so only length-unit facts convert. */
export function factMm(tool, kind, key) {
    const f = factOf(kind, key);
    const v = Number(tool && tool[key]);
    if (!Number.isFinite(v)) return null;
    if (!f || f.unit === '°') return v;
    return unitOf(tool) === 'inch' ? v * MM_PER_INCH : v;
}
/** The label a number surfaces under, carrying its unit: "Blade width [in]". The unit is part of the NAME of the
 *  value, not a setting somewhere else — that is what stops an inch blade reading as 3mm on a pendant. */
export function factLabel(tool, kind, key) {
    const f = factOf(kind, key);
    if (!f) return key;
    const u = f.unit === '°' ? '°' : (unitOf(tool) === 'inch' ? 'in' : 'mm');
    return f.label + ' [' + u + ']';
}
/** The macro-header line that lands a tool fact in a #var, converted ONCE. `expr` is emitted, not a JS number, so
 *  the arithmetic is visible in the program the operator reads. */
export function factHeaderLine(tool, kind, key, varName) {
    const f = factOf(kind, key);
    const v = Number(tool && tool[key]);
    if (!f || !Number.isFinite(v)) return null;
    const inch = unitOf(tool) === 'inch' && f.unit !== '°';
    return inch
        ? `${varName}=[${v} * ${MM_PER_INCH}]   ;${f.label} — ${v} in, converted here (never G20/G21)`
        : `${varName}=${v}   ;${f.label} [${f.unit}]`;
}
