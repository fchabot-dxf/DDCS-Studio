/**
 * blocks/blockly/theme.js — the DDCS Blockly theme. BLOCK colours stay semantic (one --cat signature colour
 * per category, so a block's colour = its category, matching the hand-rolled tab). The CHROME (canvas, toolbox,
 * flyout, scrollbar, grid, glow) follows the ACTIVE APP THEME — it reads the live CSS tokens off <body> so the
 * Blockly canvas matches whatever theme is selected (studio / normal / steampunk / futuristic / organic).
 * Paired with the `geras` renderer (classic/engineering look). Requires window.Blockly (the vendored UMD).
 *
 * One theme object per app-theme, cached (Blockly's registry rejects re-defining the same name). blocksApp
 * rebuilds + ws.setTheme() on the data-theme mutation, so switching theme re-skins the canvas live.
 */
const CAT = {
  shapes: '#3b82f6', move: '#14b8a6', toolpaths: '#22c55e', transforms: '#a855f7',
  // machine state/setup, split into granular semantic groups (each block declares its own category)
  spindlefeed: '#f97316', coordinates: '#0ea5e9', program: '#64748b', probing: '#e11d48', signals: '#8b5cf6',
  control: '#f59e0b', math: '#84cc16', variables: '#06b6d4', wizardui: '#d946ef', markup: '#94a3b8',
};

/** Read a CSS custom property off <body> (where data-theme lives), with a fallback. */
function tok(name, fallback) {
  try { const v = getComputedStyle(document.body).getPropertyValue(name).trim(); return v || fallback; } catch (_) { return fallback; }
}

const cache = {};

export function ddcsTheme(Blockly) {
  const app = (document.body && document.body.getAttribute('data-theme')) || 'default';
  if (cache[app]) return cache[app];

  const blockStyles = {};
  for (const k in CAT) blockStyles[k + '_style'] = { colourPrimary: CAT[k] };
  // native Blockly blocks (logic/loops/math/variables/text) → map onto our category colours
  Object.assign(blockStyles, {
    logic_blocks: { colourPrimary: CAT.control }, loop_blocks: { colourPrimary: CAT.control },
    math_blocks: { colourPrimary: CAT.math }, variable_blocks: { colourPrimary: CAT.variables },
    text_blocks: { colourPrimary: CAT.markup },
  });
  const categoryStyles = {};
  for (const k in CAT) categoryStyles[k + '_cat'] = { colour: CAT[k] };

  const accent = tok('--accent', '#2dd4bf');
  const theme = Blockly.Theme.defineTheme('ddcs-' + app, {
    base: Blockly.Themes.Classic,
    blockStyles, categoryStyles,
    // CHROME follows the app theme (fallbacks = the original dark scheme for themeless contexts):
    componentStyles: {
      workspaceBackgroundColour: tok('--bg', '#0d1117'),
      toolboxBackgroundColour: tok('--panel2', tok('--panel', '#161d28')),
      toolboxForegroundColour: tok('--text', '#cbd5e1'),
      flyoutBackgroundColour: tok('--panel2', tok('--panel', '#11171f')),
      flyoutForegroundColour: tok('--text-dim', '#8b97a6'),
      flyoutOpacity: 1,
      scrollbarColour: tok('--border', '#39465a'),
      insertionMarkerColour: accent, insertionMarkerOpacity: 0.4,
      markerColour: accent, cursorColour: accent,
      selectedGlowColour: accent, selectedGlowOpacity: 0.6,
    },
    fontStyle: { family: 'ui-sans-serif, system-ui, Segoe UI, sans-serif', size: 11 },
  });
  cache[app] = theme;
  return theme;
}
