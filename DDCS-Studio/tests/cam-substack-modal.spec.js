import { test, expect } from '@playwright/test';

const SCRATCH = 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad';

// Sub-stack S4 — the MODAL wires a forked op that CONTAINS an opunit through subStackToSlot. Today the modal routes any
// forked op WHOLE-OP universal (geometry baked). S4 detects an opunit-containing op and shows the PARTS grouped: the standard
// surfacing sub-unit's loop knobs stay LIVE (Expose-only), the custom loose atoms are exposed; Build keeps the surfacing a live
// WHILE loop alongside the exposed custom #vars.

test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });
    test('S4 modal: a forked surfacing op (opunit + loose feed/move) → Build CAM slot → parts grouped, surfacing LIVE, custom exposed → Build', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsGetBlockProgram);

        // fork a surfacing twin (wrap its exec atoms in an opunit) + add loose feed/move, register it, place it in the program
        await page.evaluate(async () => {
            const { wrapRecognizedForFork } = await import('/blocks/devMode.js');
            const { getUserDef, userOpFromStack, registerUserOp, flattenBlocks, defaultParams } = await import('/blocks/userOps.js');
            const surfDef = getUserDef('user_surfacing_data');
            const w = wrapRecognizedForFork(surfDef);
            const root = w.template.find((b) => b.type === 'user_root');
            const feedBlk = { type: 'feed', params: { rate: 300 } };
            const moveBlk = { type: 'move', params: { mode: 'cut', z: -2 } };
            root.children.push(feedBlk, moveBlk);
            const flat = flattenBlocks(w.template);
            const bindings = [
                { param: 'cfeed', blockIndex: flat.indexOf(feedBlk), key: 'rate', label: 'Cut feed', type: 'number', default: 300 },
                { param: 'cz', blockIndex: flat.indexOf(moveBlk), key: 'z', label: 'Plunge Z', type: 'number', default: -2 },
            ];
            const def = userOpFromStack('forked_surf', 'Forked Surface', w.template, bindings);
            registerUserOp(def);
            window.__op = { id: 'uop1', type: 'op', opType: def.opType, label: 'Forked Surface', params: defaultParams(def) };
            window.ddcsGetBlockProgram = () => [window.__op];
        });

        // open the CAM authoring modal via the op-card door (the same window.ddcsOpenCamAuthoring the ▸ Build CAM slot action calls)
        await page.evaluate(async () => { (await import('/ui/macrosApp.js')).initMacrosApp(); window.ddcsOpenCamAuthoring(window.__op); });
        await page.waitForSelector('.cam-auth-overlay .cbm-eb');

        const out = await page.evaluate(() => {
            const cell = (key, mode) => document.querySelector(`.cbm-eb[data-fkey="${key}"][data-mode="${mode}"]`);
            const partHdrs = [...document.querySelectorAll('#cbm_table tbody tr')].filter((tr) => tr.querySelector('td[colspan="4"]')).map((tr) => tr.textContent.trim());
            const camLabel = (document.querySelector('.cbm-op-group > div') || {}).textContent || '';
            const rowKeys = [...document.querySelectorAll('#cbm_table tr[data-fkey]')].map((tr) => tr.getAttribute('data-fkey'));
            const ebState = (k) => ({ expose: !!(cell(k, 'expose') && cell(k, 'expose').checked), exposeDisabled: !!(cell(k, 'expose') && cell(k, 'expose').disabled), bakeDisabled: !!(cell(k, 'bake') && cell(k, 'bake').disabled) });
            // the surfacing part's value cell must be read-only (a SPAN), not an editable input (subStackToSlot re-derives from the def)
            const valTag = (k) => { const td = document.querySelector(`#cbm_table tr[data-fkey="${k}"] td:nth-child(2)`); return td && td.firstElementChild ? td.firstElementChild.tagName : null; };
            return { partHdrs, camLabel, rowKeys, stepover: ebState('stepover'), cfeed: ebState('cfeed'), cz: ebState('cz'), stepoverValTag: valTag('stepover') };
        });

        await page.screenshot({ path: `${SCRATCH}/cam-substack-modal.png` });   // VIEWED (ACCEPT, gated to the advisor)

        // TWO part groups render (the standard surfacing sub-unit + the custom loose atoms)
        expect(out.partHdrs.length, 'two part sub-headers render (standard + custom)').toBe(2);
        expect(out.partHdrs.join(' | '), 'the standard part is labelled LIVE').toMatch(/live/i);
        expect(out.partHdrs.join(' | '), 'the custom part is labelled').toMatch(/custom atoms/i);
        expect(out.camLabel, 'the op is routed as sub-stack (not whole-op universal)').toMatch(/sub-stack/i);
        // the surfacing stepover is a LIVE generator knob: Expose enabled (not greyed) + checked, Bake disabled (baking would break the loop)
        expect(out.rowKeys, 'the surfacing stepover shows as a knob').toContain('stepover');
        expect(out.stepover, 'stepover = live knob → Expose enabled + checked, Bake disabled').toMatchObject({ expose: true, exposeDisabled: false, bakeDisabled: true });
        expect(out.stepoverValTag, 'a sub-stack part value is read-only (derived from the def), not a corruptible input').toBe('SPAN');
        // the custom feed/plunge are exposed
        expect(out.cfeed, 'the custom cut feed is exposed').toMatchObject({ expose: true, exposeDisabled: false });
        expect(out.cz, 'the custom plunge Z is exposed').toMatchObject({ expose: true, exposeDisabled: false });

        // Build → a slot where the surfacing stays a LIVE loop + the custom feed/Z ride #vars
        await page.click('[data-act="cbm-build"]');
        await page.waitForSelector('.cam-sim-overlay [data-cbm="ok"]');
        await page.click('.cam-sim-overlay [data-cbm="ok"]');
        await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
        const slotBody = await page.evaluate(() => {
            const pack = JSON.parse(localStorage.getItem('ddcs_campack') || '{"slots":[]}');
            return (pack.slots.slice(-1)[0] || {}).body || '';
        });
        expect(slotBody, 'the surfacing sub-unit stays a LIVE WHILE loop in the built slot').toMatch(/WHILE #\d+ LT #\d+ DO2/);
        expect(slotBody, 'the custom feed rides a #var').toMatch(/F#\d/);
        expect(slotBody, 'the custom plunge Z rides a #var').toMatch(/Z#\d/);
    });
});
