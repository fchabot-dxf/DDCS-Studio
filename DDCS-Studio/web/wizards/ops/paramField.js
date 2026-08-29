/**
 * wizards/ops/paramField.js — the FORM-face pendant of a value binding (block-native params S5.1). The form analog of
 * `cam_field`, and a sibling of `formfield` — BUT a DEDICATED block, not a reuse of formfield (Fork B, confirmed t1105):
 * formfield's socket link is var-identity `match: { type:'assign', var }` (formField.js:7), which addresses an ASSIGN-var
 * data-op field; a def VALUE binding is `{ param, blockIndex, key }` (cleanBinding, userOps.js:111) — a (blockIndex,key)
 * socket. formfield cannot address a (blockIndex,key) socket, so the FORM face of a value binding needs its own block keyed
 * by `param`, symmetric with `cam_field`. One shared reader shape then serves both faces.
 *
 * Lives in a `param_group` in the user_root PRESENTATION mouth and EMITS NOTHING — metadata read at register time by
 * paramFieldsFromStack (the mirror of camFieldsFromStack / bindingsFromStack). Renders `param` as a READ-ONLY chip (the
 * routing key — a hand-edit dangles the binding), reusing the ddcs_camfield lock. S5.1 = schema + reader + materializer only;
 * the FORM RENDERER consuming these (ui/formWidgets.js — the widget registry) is a later slice.
 *
 * ── t2385 (BACKLOG #42 piece 1) — DYNAMIC, like its sibling formfield ────────────────────────────────────────────
 * Before this turn every field rendered always: a number row still showed `options` (dropdown-only), a dropdown row
 * still showed `nmin`/`nmax`/`nstep`/`units` (number-only) — half the boxes impossible to fill meaningfully for that
 * row's own widget. `dynamic: ['widget']` (`ddcs_dynfields`, blocks/blockly/bridge.js) now shows only the config
 * fields the EFFECTIVE widget actually uses. `widget: ''` means INHERIT (t1562 — derive from `type`, the SAME
 * convention `paramFieldsFromStack` below and `ui/formWidgets.js`'s own `resolveFormWidget` already honour) — so
 * `fieldsFor` resolves the widget the SAME way the render path will (`WIDGET_BY_TYPE`, one source, `blocks/userOps.js`),
 * never the raw (possibly empty) field.
 *
 * ⚠ t2385 — THE MECHANISM ITSELF WAS FIXED THIS SAME TURN, not just this block's own declaration: `ddcs_dynfields`
 * (bridge.js) used to hide fields via `getInput(FN(f)).setVisible(...)` — but `jsonDef()`'s own block-shape builder
 * packs every field of one message0 row into a SINGLE shared Blockly Input, so `getInput(FN(f))` could never find a
 * NAMED input for a bare inline field (text/dropdown/checkbox — everything but a true value-socket) and silently did
 * nothing. Confirmed live before this block's own `dynamic` was even written: a fresh `formfield` block already
 * declared `dynamic: ['bindMode','widget']` and its OWN header comment claimed it worked, but toggling its WIDGET
 * field via the real event pipeline changed NOTHING — `inputList.length === 1` for the whole block. Switched to
 * `Block.getField(name).setVisible(...)` (a strict superset — finds a field whether or not it has its own Input;
 * confirmed live the fix actually toggles `display:none` on the field's own SVG root) — this fixes formfield's own
 * pre-existing no-op at the same time it makes this block's `dynamic` real for the first time.
 *
 * ── Human labels (BACKLOG #42 piece 1, second half) ──────────────────────────────────────────────────────────────
 * The block face used to print raw storage keys (`dflt`, `nmin`, `nmax`, `nstep`) — `labels` (below) is a PER-DEF
 * map `jsonDef()` now consults (bridge.js) so the face reads `default`/`min`/`max`/`step` while the STORAGE key
 * (what `paramFieldsFromStack` reads, what round-trips) never changes. Scoped to THIS def only — NOT the shared,
 * bare-field-name `DESCRIPTIONS` map bridge.js already has (that one is reused verbatim by dozens of unrelated
 * blocks sharing a field name like `value`/`type`; widening it would relabel all of them, not just this one).
 */
import { WIDGET_BY_TYPE } from '../../blocks/userOps.js';

export const paramFieldBlock = {
    type: 'param_field', label: 'form field', category: 'Wizard Inputs', kind: 'param_field',
    help: 'One wizard FORM field for a value binding: the form label, widget, type, default, and (for a number widget) the min/max/step/units. `param` is the def value-binding it declares (read-only routing key). Metadata only — emits no G-code.',
    // t2385 — BOTH watched: `fieldsFor` resolves the EFFECTIVE widget from `widget` (explicit) OR `type` (the
    // t1562 inherit-when-empty fallback) — live-caught before shipping: with only 'widget' watched, changing
    // `type` alone (leaving widget at '') never re-ran `apply()`, so an inherited row's own visibility went
    // stale the moment its type changed (e.g. number -> enum should reveal `options`, hide `nmin`/etc, and
    // silently didn't). `ddcs_dynfields`'s own onChange only re-checks fields NAMED in `dynamic`.
    dynamic: ['widget', 'type'],
    defaults: {
        param: '',        // which def value-binding this row is (matches binding.param) — the ROUTING KEY, read-only chip
        label: '',        // the form label (empty = inherit binding.label / the param name)
        widget: '',       // the form widget registry key (number/slider/dropdown/…); EMPTY = inherit, i.e. derive from `type` (t1562)
        type: 'number',   // the value type (number/int/enum/bool/string)
        dflt: '',         // the form default (empty = inherit binding.default)
        section: '', help: '',
        options: '',      // dropdown/segmented option list
        nmin: '', nmax: '', nstep: '', units: '',   // number-widget config
    },
    allFields: ['param', 'label', 'widget', 'type', 'dflt', 'section', 'help', 'options', 'nmin', 'nmax', 'nstep', 'units'],
    // t2385 — the block face shows human words for the storage keys named in BACKLOG #42 ("default/min/max/step");
    // every other field keeps its own name (already plain English or a short established term — `param`/`widget`/
    // `type`/`section`/`help`/`options`/`units` need no translation).
    labels: { dflt: 'default', nmin: 'min', nmax: 'max', nstep: 'step' },
    // t2387 (BACKLOG #42 pieces 4+5) — the "wall of boxes" the whole backlog entry exists to shrink: `help`,
    // `nmin`/`nmax`/`nstep` and `units` used to render unconditionally whenever `fieldsFor` made them widget-
    // applicable. `enablers` (read generically by `ddcs_dynfields`, bridge.js) hides each GROUP until either a
    // field in it already holds a value (a hand-authored/loaded def) or the canvas's own "Block options…" popup
    // (blocksApp.js) reveals it — SHOWN = NON-EMPTY, no new stored state (the group's own field values ARE the
    // truth; nothing new is serialized).
    enablers: [
        { label: 'help text', fields: ['help'] },
        { label: 'limits (min/max/step)', fields: ['nmin', 'nmax', 'nstep'] },
        { label: 'units', fields: ['units'] },
    ],
    fieldsFor(p) {
        // t1562 — the SAME inherit-then-derive-from-type resolution paramFieldsFromStack/resolveFormWidget use:
        // an explicit widget wins; an empty one derives from `type` (WIDGET_BY_TYPE, one source, blocks/userOps.js).
        const explicit = p && p.widget;
        const type = (p && p.type) || 'number';
        const effective = explicit || WIDGET_BY_TYPE[type] || 'number';
        const f = ['param', 'label', 'widget', 'type', 'dflt', 'section', 'help'];
        if (effective === 'dropdown' || effective === 'segmented') f.push('options');
        else if (effective === 'number' || effective === 'slider') f.push('nmin', 'nmax', 'nstep', 'units');
        return f;
    },
    fields: ['param', 'label', 'widget', 'type', 'dflt', 'section', 'help', 'options', 'nmin', 'nmax', 'nstep', 'units'],
    emit: () => [],   // metadata only — read at register by paramFieldsFromStack; produces no G-code
};
