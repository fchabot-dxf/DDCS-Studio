import { test, expect } from './support/harness.mjs';

/**
 * t2527 (BACKLOG #71) — three form-render defects found while wiring handles for real (t2525), all in one
 * area, fixed together as one concern:
 *   1. formfield/param_field's own WIDGET dropdown committed 'tool-library'/'thread-preset', but
 *      formWidgets.js's real FORM_WIDGETS registry has always keyed these 'toolpick'/'threadpick' — a picker
 *      authored with either NEVER reached the real widget, silently degrading to a plain number input.
 *   2. rect_handle's own form row could show a generic SHARED_LABELS text instead of its declared anchor
 *      label when the merged real binding left its own label blank and had no SHARED_LABELS entry.
 *   3. An unresolved handle's own fail-visibly stub (t2525) produced a stray, uninformative extra form row
 *      beside the canvas's own correct red marker.
 * PLUS the general pattern question the dispatch asked to be answered, not just patched around:
 * resolveFormWidget's own not-found case (ANY unrecognized widget string, from ANY source) silently degrades
 * to a type-based default with no signal anywhere — confirmed real and general, not isolated to these two
 * strings; a loud (non-blocking) console.warn now marks that fallback whenever a widget WAS declared and
 * didn't resolve, distinguishing it from the normal, silent "no widget declared" case.
 *
 * TIER MIGRATION WORK PACKAGE B: split out of tests/handle-form-render-fixes-2527.spec.js — these are the
 * THREE tests in that 5-test file that never touch the DOM: pure module imports + plain-data assertions, and
 * (for the last one) the harness's own console-listener bridge. The other two — the real drag/drop/save/reload
 * gesture, and a test that builds+queries a constructed DOM tree (the node stub's querySelector/All always
 * return null/[] regardless of what was appended) — stay in tests/handle-form-render-fixes-2527-drive.spec.js.
 */

test('the widget-key mismatch: FORM_WIDGETS really does key these toolpick/threadpick, and bridge.js\'s own dropdown vocabulary now commits those exact values', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const { FORM_WIDGETS } = await import('/ui/formWidgets.js');
        const { fieldOptions } = await import('/blocks/blockly/bridge.js');
        const formfieldOpts = fieldOptions({ type: 'formfield', kind: 'formfield', defaults: {} }, 'widget');
        const paramFieldOpts = fieldOptions({ type: 'param_field', kind: 'param_field', defaults: {} }, 'widget');
        const findValue = (opts, label) => { const o = opts.find((x) => Array.isArray(x) ? x[0] === label : x === label); return Array.isArray(o) ? o[1] : o; };
        return {
            hasToolpickKey: typeof FORM_WIDGETS.toolpick === 'function',
            hasThreadpickKey: typeof FORM_WIDGETS.threadpick === 'function',
            hasOldHyphenKeys: ('tool-library' in FORM_WIDGETS) || ('thread-preset' in FORM_WIDGETS),
            formfieldToolValue: findValue(formfieldOpts, 'tool-library'),
            formfieldThreadValue: findValue(formfieldOpts, 'thread-preset'),
            paramFieldToolValue: findValue(paramFieldOpts, 'tool-library'),
        };
    });
    expect(r.hasToolpickKey, 'FORM_WIDGETS really does key the tool picker widget toolpick, not tool-library').toBe(true);
    expect(r.hasThreadpickKey).toBe(true);
    expect(r.hasOldHyphenKeys, 'no widget is ACTUALLY registered under the old hyphenated names -- confirms they were always unreachable').toBe(false);
    expect(r.formfieldToolValue, 'the dropdown option labelled "tool-library" now commits the value FORM_WIDGETS actually reads').toBe('toolpick');
    expect(r.formfieldThreadValue).toBe('threadpick');
    expect(r.paramFieldToolValue, 'param_field shares formfield\'s widget vocab -- same fix, same file').toBe('toolpick');
});

test('labelFor: SHARED_LABELS still wins for a handle-merged w/h param (no regression); a handle\'s own anchor.label fills in only when NEITHER an explicit label NOR SHARED_LABELS has one', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const { labelFor } = await import('/ui/formWidgets.js');
        return {
            // rect_handle merged onto a real 'w' param, no explicit label -- SHARED_LABELS.w = 'Width' must still win
            sharedLabelWins: labelFor({ param: 'w', anchor: { kind: 'rect', label: 'W×H' } }),
            sharedLabelWinsH: labelFor({ param: 'h', anchor: { kind: 'rect', label: 'W×H' } }),
            // a param with NO SHARED_LABELS entry and no explicit label -- anchor.label now fills the gap instead of the raw name
            anchorFillsGap: labelFor({ param: 'boxreach', anchor: { kind: 'length', label: 'reach' } }),
            // an explicit label still wins over everything, unchanged
            explicitWins: labelFor({ param: 'w', label: 'Custom', anchor: { kind: 'rect', label: 'W×H' } }),
            // no anchor at all (every built-in, every plain formfield) -- t2541 (BACKLOG #71): the DERIVED tier
            // now fills this gap too, a Title-Case split of the param name, never the bare identifier anymore
            plainRawFallback: labelFor({ param: 'someUnknownParam' }),
        };
    });
    expect(r.sharedLabelWins, 'no regression: the w-row keeps its own correct, DISTINCT "Width" label').toBe('Width');
    expect(r.sharedLabelWinsH, 'no regression: the h-row keeps its own correct, DISTINCT "Height" label').toBe('Height');
    expect(r.anchorFillsGap, "the handle's own declared intent now fills the gap instead of a raw, uninformative param name").toBe('reach');
    expect(r.explicitWins).toBe('Custom');
    expect(r.plainRawFallback, 't2541 -- the derived tier Title-Cases the bare param name instead of showing it raw').toBe('Some Unknown Param');
});

test('resolveFormWidget: the general pattern -- a declared-but-unrecognized widget string warns loudly (not silently); an undeclared widget stays silent (the normal case)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const warnings = [];
    page.on('console', (msg) => { if (msg.type() === 'warning') warnings.push(msg.text()); });
    await page.waitForFunction(() => true);
    await page.evaluate(async () => {
        const { resolveFormWidget } = await import('/ui/formWidgets.js');
        resolveFormWidget({ param: 'someParam', widget: 'this-key-does-not-exist', type: 'number' });
        resolveFormWidget({ param: 'plainNumber', type: 'number' });   // no widget declared at all -- must stay silent
        resolveFormWidget({ param: 'wired', widget: 'toolpick', type: 'number' });   // a REAL key -- must stay silent
    });
    await page.waitForTimeout(100);
    const matching = warnings.filter((w) => w.includes('someParam'));
    const falsePositives = warnings.filter((w) => w.includes('plainNumber') || w.includes('wired'));
    expect(matching.length, 'a declared-but-unrecognized widget string warns loudly').toBeGreaterThan(0);
    expect(matching[0]).toContain('this-key-does-not-exist');
    expect(falsePositives.length, 'no widget declared, or a REAL widget key, stays silent -- not a blanket warning on every call').toBe(0);
});
