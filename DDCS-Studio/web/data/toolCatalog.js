/**
 * data/toolCatalog.js — the DECLARED tool catalog.
 *
 * A pure-data array of tool TEMPLATES the user ADDS individual tools from (Settings → Tool
 * library → "＋ Add from catalog"). This is NOT a seeded default table — nothing lands in the
 * user's library until they pick from it. One source, declare-not-infer.
 *
 * Each template is shaped like a normalizeTool() record MINUS `num` (the tool number is assigned
 * on ADD from the library's nextToolNum, not stored here). Extra catalog-only keys:
 *   - `category` ∈ flat|ball|tapered|vbit|surfacing|drill — the picker's grouping.
 *   - `unit` ∈ 'inch'|'mm' — the natural unit of the NAME + the picker's unit filter (flat/ball
 *      filter by it; tapered/vbit/surfacing/drill always show).
 *
 * STORAGE RULE: `dia` is ALWAYS mm-native (1/2" = 12.7 exactly), even for inch-named tools — the
 * display layer converts to the user's unit pref. Exact inch→mm: 1/8"=3.175, 1/4"=6.35,
 * 3/8"=9.525, 1/2"=12.7, 3/4"=19.05, 1"=25.4, 1.5"=38.1, 2"=50.8.
 *
 * Feeds/plunge are mm/min. rpm band 8–14k (bigger tool → lower rpm). Values are user-locked
 * starting points — per-tool editable in the table once added, so no number is precious. Tapered
 * bits store their TIP Ø as `dia` (taper geometry is a deferred loop item — no tipDia/taperAngle
 * fields yet); V-bits carry the included `angle`.
 */

export const TOOL_CATALOG = [
    // --- FLAT endmills ---------------------------------------------------------------
    // imperial
    { category: 'flat', unit: 'inch', name: '1/8" Flat Endmill', type: 'endmill', dia: 3.175, flutes: 2, rpm: 14000, feed: 2500, plunge: 600 },
    { category: 'flat', unit: 'inch', name: '1/4" Flat Endmill', type: 'endmill', dia: 6.35,  flutes: 2, rpm: 12000, feed: 4000, plunge: 1000 },
    { category: 'flat', unit: 'inch', name: '3/8" Flat Endmill', type: 'endmill', dia: 9.525, flutes: 2, rpm: 11000, feed: 5000, plunge: 1250 },
    { category: 'flat', unit: 'inch', name: '1/2" Flat Endmill', type: 'endmill', dia: 12.7,  flutes: 2, rpm: 10000, feed: 6000, plunge: 1500 },
    { category: 'flat', unit: 'inch', name: '3/4" Flat Endmill', type: 'endmill', dia: 19.05, flutes: 2, rpm: 9000,  feed: 6000, plunge: 1500 },
    { category: 'flat', unit: 'inch', name: '1" Flat Endmill',   type: 'endmill', dia: 25.4,  flutes: 2, rpm: 8000,  feed: 6000, plunge: 1500 },
    // metric
    { category: 'flat', unit: 'mm', name: '3mm Flat Endmill',  type: 'endmill', dia: 3,  flutes: 2, rpm: 14000, feed: 2400, plunge: 600 },
    { category: 'flat', unit: 'mm', name: '6mm Flat Endmill',  type: 'endmill', dia: 6,  flutes: 2, rpm: 12000, feed: 3800, plunge: 950 },
    { category: 'flat', unit: 'mm', name: '8mm Flat Endmill',  type: 'endmill', dia: 8,  flutes: 2, rpm: 11000, feed: 4800, plunge: 1200 },
    { category: 'flat', unit: 'mm', name: '10mm Flat Endmill', type: 'endmill', dia: 10, flutes: 2, rpm: 10000, feed: 5500, plunge: 1400 },
    { category: 'flat', unit: 'mm', name: '12mm Flat Endmill', type: 'endmill', dia: 12, flutes: 2, rpm: 10000, feed: 6000, plunge: 1500 },

    // --- BALL nose -------------------------------------------------------------------
    // imperial
    { category: 'ball', unit: 'inch', name: '1/8" Ball Nose', type: 'ballnose', dia: 3.175, flutes: 2, rpm: 14000, feed: 2200, plunge: 550 },
    { category: 'ball', unit: 'inch', name: '1/4" Ball Nose', type: 'ballnose', dia: 6.35,  flutes: 2, rpm: 12000, feed: 3500, plunge: 900 },
    { category: 'ball', unit: 'inch', name: '3/8" Ball Nose', type: 'ballnose', dia: 9.525, flutes: 2, rpm: 11000, feed: 4200, plunge: 1050 },
    { category: 'ball', unit: 'inch', name: '1/2" Ball Nose', type: 'ballnose', dia: 12.7,  flutes: 2, rpm: 10000, feed: 5000, plunge: 1250 },
    // metric
    { category: 'ball', unit: 'mm', name: '3mm Ball Nose', type: 'ballnose', dia: 3, flutes: 2, rpm: 14000, feed: 2100, plunge: 500 },
    { category: 'ball', unit: 'mm', name: '6mm Ball Nose', type: 'ballnose', dia: 6, flutes: 2, rpm: 12000, feed: 3300, plunge: 800 },
    { category: 'ball', unit: 'mm', name: '8mm Ball Nose', type: 'ballnose', dia: 8, flutes: 2, rpm: 11000, feed: 4200, plunge: 1050 },

    // --- TAPERED ball (carving, 1/8" shank; dia = TIP Ø, taper noted in name) ---------
    { category: 'tapered', unit: 'mm', name: '0.25mm Tapered Ball (3.5°)', type: 'tapered', dia: 0.25, flutes: 2, rpm: 14000, feed: 1500, plunge: 300 },
    { category: 'tapered', unit: 'mm', name: '0.5mm Tapered Ball (3.5°)',  type: 'tapered', dia: 0.5,  flutes: 2, rpm: 14000, feed: 1800, plunge: 350 },
    { category: 'tapered', unit: 'mm', name: '1.0mm Tapered Ball (4.5°)',  type: 'tapered', dia: 1.0,  flutes: 2, rpm: 14000, feed: 2000, plunge: 400 },

    // --- V-BIT (carry the included angle) --------------------------------------------
    { category: 'vbit', unit: 'mm', name: '15° V-Bit', type: 'vbit', dia: 6.35, flutes: 1, rpm: 14000, feed: 1500, plunge: 400, angle: 15 },
    { category: 'vbit', unit: 'mm', name: '30° V-Bit', type: 'vbit', dia: 6.35, flutes: 1, rpm: 14000, feed: 1800, plunge: 450, angle: 30 },
    { category: 'vbit', unit: 'mm', name: '60° V-Bit', type: 'vbit', dia: 12.7, flutes: 1, rpm: 13000, feed: 2000, plunge: 500, angle: 60 },
    { category: 'vbit', unit: 'mm', name: '90° V-Bit', type: 'vbit', dia: 12.7, flutes: 1, rpm: 13000, feed: 2200, plunge: 550, angle: 90 },

    // --- SURFACING / slab (spoilboard) -----------------------------------------------
    { category: 'surfacing', unit: 'inch', name: '1" Surfacing',   type: 'surfacing', dia: 25.4, flutes: 1, rpm: 10000, feed: 3000, plunge: 800 },
    { category: 'surfacing', unit: 'inch', name: '1.5" Surfacing', type: 'surfacing', dia: 38.1, flutes: 1, rpm: 9000,  feed: 3000, plunge: 800 },
    { category: 'surfacing', unit: 'inch', name: '2" Surfacing',   type: 'surfacing', dia: 50.8, flutes: 1, rpm: 8000,  feed: 3000, plunge: 800 },

    // --- DRILL -----------------------------------------------------------------------
    { category: 'drill', unit: 'mm', name: '3mm Drill', type: 'drill', dia: 3, flutes: 2, rpm: 6000, feed: 300, plunge: 300 },
    { category: 'drill', unit: 'mm', name: '6mm Drill', type: 'drill', dia: 6, flutes: 2, rpm: 5000, feed: 250, plunge: 250 },
];

// Picker grouping order + display labels.
export const TOOL_CATALOG_GROUPS = [
    { key: 'flat',      label: 'Flat' },
    { key: 'ball',      label: 'Ball' },
    { key: 'tapered',   label: 'Tapered' },
    { key: 'vbit',      label: 'V-Bit' },
    { key: 'surfacing', label: 'Surfacing' },
    { key: 'drill',     label: 'Drill' },
];
