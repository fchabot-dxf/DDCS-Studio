/**
 * views/index.js — the wizard view registry.
 *
 * Each view descriptor owns everything specific to one wizard:
 *   type      — string used by open(type) and the wiz_<type> panel convention
 *   panelId   — DOM id of the wizard's panel
 *   codeElId  — DOM id of the generated-code element (read by insert())
 *   large     — whether the wizard box gets the .large class
 *   inputIds  — DOM ids whose input/change events trigger update()
 *   onShow?   — sync hook right after the panel is made visible
 *   onOpen?   — post-open hook (SVG draw + animation kick-off)
 *   update    — read DOM → params → generate() → inject preview
 *   startAnim?— restart the wizard's SVG animator
 *
 * Adding a wizard = create a view module and list it here. WizardManager
 * stays generic.
 */
import { commView } from './commView.js';
import { wcsView } from './wcsView.js';
// Corner wizard retired 2026-07-02 (④) — REPLACED by the "Corner (data)" twin (user_corner_data, the generic user-op view).
// Circular wizard retired 2026-06-23 — superseded by Middle (circular + probe-both-axes).
// t1730 (gameplan step 2, Tier B) — middle/rotary_center/rotary_clock/edge/alignment/homing coded views RETIRED,
// same shape as corner: each already `opensAs` its "<type> (data)" twin (wizardLibrary.js), so no live UI path
// reached these anymore — only an old saved op carrying the raw legacy opType could, and that path now shows a
// clear "no longer editable here" toast (wizardManager.js's open()) instead of the coded panel. See WORK-LOG t1730.
import { atcLengthView, atcWarmupView, atcChangeView, atcTestView, atcCheckView, atcTableView } from './atcViews.js';
import { drillView } from './drillView.js';
import { pocketView } from './pocketView.js';
import { contourView } from './contourView.js';
import { slotView } from './slotView.js';
import { surfacingView } from './surfacingView.js';
import { textView } from './textView.js';

export const WIZARD_VIEWS = [
    commView,
    wcsView,
    drillView,
    pocketView,
    contourView,
    slotView,
    surfacingView,
    textView,
    atcLengthView,
    atcCheckView,
    atcWarmupView,
    atcChangeView,
    atcTestView,
    atcTableView,
];

export const viewByType = new Map(WIZARD_VIEWS.map((v) => [v.type, v]));
