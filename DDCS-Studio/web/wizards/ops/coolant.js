/** wizards/ops/coolant.js — COOLANT (Machine): flood (M8) / mist (M7) / off (M9). */
export const coolantBlock = {
    type: 'coolant', label: 'Coolant', kind: 'leaf', category: 'Spindle & Feed',
    help: "Turns coolant flood or mist on, or off. Modal — it stays on until this or Program End turns it off.",
    defaults: { flow: 'flood' },
    fields: ['flow'],          // select: flood / mist / off
    emit: (p) => [{ flood: 'M8   ( flood )', mist: 'M7   ( mist )', off: 'M9   ( coolant off )' }[p.flow] || 'M9   ( coolant off )'],
};
