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
import { cornerView } from './cornerView.js';
import { middleView } from './middleView.js';
import { circularView } from './circularView.js';
import { rotaryCenterView } from './rotaryCenterView.js';
import { rotaryClockView } from './rotaryClockView.js';
import { edgeView } from './edgeView.js';
import { alignmentView } from './alignmentView.js';
import { atcLengthView, atcWarmupView, atcChangeView, atcTestView, atcCheckView } from './atcViews.js';
import { drillView } from './drillView.js';
import { pocketView } from './pocketView.js';
import { slotView } from './slotView.js';
import { surfacingView } from './surfacingView.js';
import { textView } from './textView.js';

export const WIZARD_VIEWS = [
    commView,
    wcsView,
    cornerView,
    middleView,
    circularView,
    rotaryCenterView,
    rotaryClockView,
    edgeView,
    alignmentView,
    drillView,
    pocketView,
    slotView,
    surfacingView,
    textView,
    atcLengthView,
    atcCheckView,
    atcWarmupView,
    atcChangeView,
    atcTestView,
];

export const viewByType = new Map(WIZARD_VIEWS.map((v) => [v.type, v]));
