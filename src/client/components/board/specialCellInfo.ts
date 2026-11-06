import {SpaceId} from '@/common/Types';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceName} from '@/common/boards/SpaceName';

/**
 * Data-driven framework for special-cell info markers on Mars boards.
 *
 * title / description are plain English strings — they pass through
 * translateText() in the overlay component so each locale renders its
 * own translation. Add the mapping to src/locales/<lang>/ui.json exactly
 * like any other UI string: "English text": "Translated text".
 */
export type PanelPlacement = 'top' | 'bottom' | 'left' | 'right';

export type SpecialCellInfo = {
  /** Stable id, used as the hover-state active key. */
  id: string;
  /** Optional board scope. Unset entries are global/off-board special cells. */
  boardName?: BoardName;
  /** Board space id the marker mounts on. */
  spaceId: SpaceId;
  /** Panel title — English, translated via translateText(). */
  title: string;
  /** Panel body text — English, translated via translateText(). */
  description: string;
  /** Preferred side the panel sits on relative to the marker. */
  placement: PanelPlacement;
};

export const SPECIAL_CELL_INFO: ReadonlyArray<SpecialCellInfo> = [
  // ── Tharsis surface — Noctis City ──────────────────────────────────
  {
    id: 'noctis_city',
    boardName: BoardName.THARSIS,
    spaceId: SpaceName.NOCTIS_CITY, // '31'
    title: 'Noctis City',
    description: 'Only the Noctis City tile can be placed here. Noctis City is placed using a specific project card.',
    placement: 'bottom',
  },
  // ── Tharsis surface — Named mountains (volcano candidates) ─────────
  {
    id: 'tharsis_tholus',
    boardName: BoardName.THARSIS,
    spaceId: '09',
    title: 'Tharsis Tholus',
    description: 'Tharsis Tholus is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  {
    id: 'ascraeus_mons',
    boardName: BoardName.THARSIS,
    spaceId: '14',
    title: 'Ascraeus Mons',
    description: 'Ascraeus Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  {
    id: 'pavonis_mons',
    boardName: BoardName.THARSIS,
    spaceId: '21',
    title: 'Pavonis Mons',
    description: 'Pavonis Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  {
    id: 'arsia_mons',
    boardName: BoardName.THARSIS,
    spaceId: '29',
    title: 'Arsia Mons',
    description: 'Arsia Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  // ── Elysium surface — legacy map labels moved to hover markers ─────
  {
    id: 'hecatus_tholus',
    boardName: BoardName.ELYSIUM,
    spaceId: '08',
    title: 'Hecatus Tholus',
    description: 'Hecatus Tholus is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  {
    id: 'elysium_mons',
    boardName: BoardName.ELYSIUM,
    spaceId: '14',
    title: 'Elysium Mons',
    description: 'Elysium Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  {
    id: 'olympus_mons',
    boardName: BoardName.ELYSIUM,
    spaceId: '20',
    title: 'Olympus Mons',
    description: 'Olympus Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'left',
  },
  {
    id: 'elysium_arsia_mons',
    boardName: BoardName.ELYSIUM,
    spaceId: '37',
    title: 'Arsia Mons',
    description: 'Arsia Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'left',
  },
  // ── Amazonis Planitia (the eleven-row board) — its five named volcanoes ──
  // The printed names (upstream's 27db80e67e baked them into the board picture, never taken) live here as markers:
  // E1 Hecates Tholus (33), H7 Olympus Mons (70 — two delegates), H9 Ascraeus Mons (72), J8 Pavonis Mons (80),
  // K7 Arsia Mons (87). Guard: tests/boards/amazonisPlanitiaCells.spec.ts.
  {
    id: 'amazonis_planitia_hecates_tholus',
    boardName: BoardName.AMAZONIS_PLANITIA,
    spaceId: '33',
    title: 'Hecates Tholus',
    description: 'Hecates Tholus is a volcano in the Elysium region. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  {
    id: 'amazonis_planitia_olympus_mons',
    boardName: BoardName.AMAZONIS_PLANITIA,
    spaceId: '70',
    title: 'Olympus Mons',
    description: 'Olympus Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'left',
  },
  {
    id: 'amazonis_planitia_ascraeus_mons',
    boardName: BoardName.AMAZONIS_PLANITIA,
    spaceId: '72',
    title: 'Ascraeus Mons',
    description: 'Ascraeus Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'left',
  },
  {
    id: 'amazonis_planitia_pavonis_mons',
    boardName: BoardName.AMAZONIS_PLANITIA,
    spaceId: '80',
    title: 'Pavonis Mons',
    description: 'Pavonis Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'left',
  },
  {
    id: 'amazonis_planitia_arsia_mons',
    boardName: BoardName.AMAZONIS_PLANITIA,
    spaceId: '87',
    title: 'Arsia Mons',
    description: 'Arsia Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'left',
  },
  // ── Terra Cimmeria Nova — named locations ──────────────────────────
  // All five legacy SVG text labels replaced by hover markers.
  // Space IDs derived from BoardBuilder row layout [5,6,7,8,9,8,7,6,5],
  // idOffset=3 (2 colony spaces + 1):
  //   y=0 → 03–07 | y=1 → 08–13 | y=2 → 14–20
  //   y=3 → 21–28 | y=4 → 29–37 | y=5 → 38–45
  {
    id: 'albor_tholius',
    boardName: BoardName.TERRA_CIMMERIA_NOVA,
    spaceId: '05', // y=0, volcanic(STEEL) — 3rd space in top row
    title: 'Albor Tholus',
    description: 'Albor Tholus is a shield volcano in the Elysium region. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'bottom',
  },
  {
    id: 'msl_curiosity',
    boardName: BoardName.TERRA_CIMMERIA_NOVA,
    spaceId: '16', // y=2, land(COLONY) — fixed, not shuffled
    title: 'MSL Curiosity landing site',
    description: 'Landing site of the Curiosity rover in Gale Crater. Placing a tile here costs 5 M€ and immediately grants one free colony.',
    placement: 'right',
  },
  {
    id: 'tyrrhenus_mons',
    boardName: BoardName.TERRA_CIMMERIA_NOVA,
    spaceId: '21', // y=3, volcanic(STEEL) — 1st space in row
    title: 'Tyrrhenus Mons',
    description: 'Tyrrhenus Mons is a shield volcano in the Mare Tyrrhenum region. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  {
    id: 'apollinaris_mons',
    boardName: BoardName.TERRA_CIMMERIA_NOVA,
    spaceId: '27', // y=3, volcanic(TITANIUM,TITANIUM) — 7th space in row
    title: 'Apollinaris Mons',
    description: 'Apollinaris Mons is an extinct shield volcano. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'left',
  },
  {
    id: 'hadriacus_mons',
    boardName: BoardName.TERRA_CIMMERIA_NOVA,
    spaceId: '38', // y=5, volcanic(DRAW_CARD,DRAW_CARD) — 1st space in row
    title: 'Hadriacus Mons',
    description: 'Hadriacus Mons is a shield volcano in the Mare Hadriacum region. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  // ── Amazonis Planitia — named locations ────────────────────────────
  // Legacy SVG text labels (Board.vue) replaced by hover markers. Names
  // map to the map's volcanic cells, whose ids are preserved through map
  // shuffling. Space IDs from the BoardBuilder row layout [5,6,7,8,9,8,7,6,5],
  // idOffset=3: y=0 → 03–07 | y=1 → 08–13 | y=2 → 14–20 | y=3 → 21–28 |
  //   y=4 → 29–37 | y=5 → 38–45 | y=6 → 46–52.
  {
    id: 'amazonis_albor_tholus',
    boardName: BoardName.AMAZONIS,
    spaceId: '09', // y=1, volcanic(MICROBE,MICROBE)
    title: 'Albor Tholus',
    description: 'Albor Tholus is a shield volcano in the Elysium region. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'top',
  },
  {
    id: 'amazonis_anseris_mons',
    boardName: BoardName.AMAZONIS,
    spaceId: '35', // y=4, volcanic(PLANT,PLANT)
    title: 'Anseris Mons',
    description: 'Anseris Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  {
    id: 'amazonis_pindus_mons',
    boardName: BoardName.AMAZONIS,
    spaceId: '43', // y=5, volcanic(DRAW_CARD)
    title: 'Pindus Mons',
    description: 'Pindus Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  {
    id: 'amazonis_ulysses_tholus',
    boardName: BoardName.AMAZONIS,
    spaceId: '49', // y=6, volcanic(HEAT,PLANT)
    title: 'Ulysses Tholus',
    description: 'Ulysses Tholus is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'bottom',
  },
  {
    // The map's one special cell: the RESTRICTED centre — nothing is ever placed here. The marker names the rule in
    // the dossier's own words (the engine's `restricted` fact), so the dead hex in the middle explains itself.
    id: 'amazonis_restricted',
    boardName: BoardName.AMAZONIS,
    spaceId: '33', // y=4, the centre — restricted(), fixed, not shuffled
    title: 'Restricted area',
    description: 'No tiles can ever be placed on this space.',
    placement: 'top',
  },
  // ── Hollandia — the Asteroid Deflection Zone ───────────────────────
  {
    // The map's one special REGION — twelve cells in the north-east, every one in the zone's violet. ONE marker names
    // the rule, in the dossier's own words (the engine's `deflection-zone` fact), on the wedge's central cell: y=2,
    // the middle of its three, which prints no bonus — the «i» covers nothing. Space IDs from the BoardBuilder row
    // layout [5,6,7,8,9,8,7,6,5], idOffset=3: the zone is 07 · 12–13 · 18–20 · 26–28 · 35–37.
    id: 'hollandia_deflection_zone',
    boardName: BoardName.HOLLANDIA,
    spaceId: '19',
    title: 'Deflection Zone',
    description: 'Protects you from plant destruction while ALL your tiles are inside this zone.',
    placement: 'bottom',
  },
  // ── Arabia Terra — named locations ─────────────────────────────────
  // The map's four volcanic cells, under the names the board itself printed: they were the last LEGACY SVG captions
  // left in `Board.vue` (hardcoded there, outside `LEGENDS`), replaced by hover markers like every other map's.
  // Each caption's dot fixed its cell: Tikhonarov the volcanic COVE on the eastern rim (its cove rule is the
  // dossier's), Ladon / Flaugergues the two of row 7, Charybdis the last cell of the bottom row. Space IDs from the
  // BoardBuilder row layout [5,6,7,8,9,8,7,6,5], idOffset=3: y=2 → 14–20 | y=7 → 53–58 | y=8 → 59–63.
  {
    id: 'arabia_tikhonarov',
    boardName: BoardName.ARABIA_TERRA,
    spaceId: '20', // y=2, cove(STEEL,TITANIUM) — volcanic
    title: 'Tikhonarov',
    description: 'Tikhonarov is a large crater in Arabia Terra. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'left',
  },
  {
    id: 'arabia_ladon',
    boardName: BoardName.ARABIA_TERRA,
    spaceId: '55', // y=7, volcanic(STEEL,DRAW_CARD)
    title: 'Ladon',
    description: 'Ladon is a basin cut by an ancient river valley. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'top',
  },
  {
    id: 'arabia_flaugergues',
    boardName: BoardName.ARABIA_TERRA,
    spaceId: '58', // y=7, volcanic(DRAW_CARD) — last space in row
    title: 'Flaugergues',
    description: 'Flaugergues is a crater in the southern highlands. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'left',
  },
  {
    id: 'arabia_charybdis',
    boardName: BoardName.ARABIA_TERRA,
    spaceId: '63', // y=8, volcanic(STEEL) — last space in row
    title: 'Charybdis',
    description: 'Charybdis is a long escarpment in the southern highlands. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'top',
  },
  // ── Vastitas Borealis — named locations ────────────────────────────
  {
    id: 'vastitas_elysium_mons',
    boardName: BoardName.VASTITAS_BOREALIS,
    spaceId: '07', // y=0, volcanic(TITANIUM,TITANIUM)
    title: 'Elysium Mons',
    description: 'Elysium Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  {
    id: 'vastitas_alba_fossae',
    boardName: BoardName.VASTITAS_BOREALIS,
    spaceId: '12', // y=1, volcanic(TITANIUM)
    title: 'Alba Fossae',
    description: 'Alba Fossae is a system of troughs on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  {
    id: 'vastitas_ceranius_fossae',
    boardName: BoardName.VASTITAS_BOREALIS,
    spaceId: '21', // y=3, volcanic(STEEL,TITANIUM)
    title: 'Ceranius Fossae',
    description: 'Ceranius Fossae is a system of troughs on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'left',
  },
  {
    id: 'vastitas_alba_mons',
    boardName: BoardName.VASTITAS_BOREALIS,
    spaceId: '22', // y=3, volcanic(STEEL,DRAW_CARD)
    title: 'Alba Mons',
    description: 'Alba Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'left',
  },
  {
    // The fan map's own North Pole — the same printed cell as the Nova board's (TEMPERATURE_4MC, fixed, not
    // shuffled), in the centre of this map inside a ring of four ocean reserves; the same words, so the source
    // plate and the hover name it the same way on both maps.
    id: 'vastitas_north_pole',
    boardName: BoardName.VASTITAS_BOREALIS,
    spaceId: SpaceName.VASTITAS_BOREALIS_NORTH_POLE, // '33' — y=4, land(TEMPERATURE_4MC)
    title: 'North Pole',
    description: 'Water ice under a layer of frozen carbon dioxide. Placing a tile here costs 4 M€ and raises the temperature 1 step.',
    placement: 'top',
  },
  // ── Hellas — the South Pole ────────────────────────────────────────
  // The map prints no named locations; its ONE special cell is the South Pole (land(OCEAN), fixed, not shuffled):
  // a tile here pays 6 M€ and places an ocean — free and empty once every ocean is down (`HellasBoard.spaceCosts`).
  // The same words as the two North Poles, so the source plate on the bill names the cell the same way.
  {
    id: 'hellas_south_pole',
    boardName: BoardName.HELLAS,
    spaceId: SpaceName.HELLAS_OCEAN_TILE, // '61' — y=8, land(OCEAN)
    title: 'South Pole',
    description: 'Water ice under a layer of frozen carbon dioxide. Placing a tile here costs 6 M€ and places an ocean; once every ocean is down, it is free and places nothing.',
    placement: 'top',
  },
  // ── Vastitas Borealis Nova — named locations ───────────────────────
  // The six legacy SVG text labels (Board.vue) replaced by hover markers, plus
  // the two cells whose printed bonus the table decides: the North Pole and the
  // Viking landing sites. Space IDs from the BoardBuilder row layout
  // [5,6,7,8,9,8,7,6,5], idOffset=3: y=0 → 03–07 | y=1 → 08–13 | y=3 → 21–28 |
  //   y=4 → 29–37 | y=6 → 46–52 | y=8 → 59–63.
  {
    id: 'vastitas_nova_hecates_tholus',
    boardName: BoardName.VASTITAS_BOREALIS_NOVA,
    spaceId: '05', // y=0, volcanic(STEEL)
    title: 'Hecates Tholus',
    description: 'Hecates Tholus is a volcano in the Elysium region. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'bottom',
  },
  {
    id: 'vastitas_nova_elysium_mons',
    boardName: BoardName.VASTITAS_BOREALIS_NOVA,
    spaceId: '13', // y=1, volcanic(DRAW_CARD)
    title: 'Elysium Mons',
    description: 'Elysium Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'left',
  },
  {
    id: 'vastitas_nova_alba_mons',
    boardName: BoardName.VASTITAS_BOREALIS_NOVA,
    spaceId: '21', // y=3, volcanic(STEEL,STEEL)
    title: 'Alba Mons',
    description: 'Alba Mons is a mountain on the surface of Mars. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  {
    id: 'vastitas_nova_viking_2',
    boardName: BoardName.VASTITAS_BOREALIS_NOVA,
    spaceId: '28', // y=3, land(DELEGATE) — last space in row
    title: 'Viking 2 landing site',
    description: 'Landing site of the Viking 2 lander in Utopia Planitia. Placing a tile here lets you add a delegate from your reserve for free (ignored without Turmoil).',
    placement: 'left',
  },
  {
    id: 'vastitas_nova_north_pole',
    boardName: BoardName.VASTITAS_BOREALIS_NOVA,
    spaceId: '33', // y=4, land(TEMPERATURE_4MC) — fixed, not shuffled
    title: 'North Pole',
    description: 'Water ice under a layer of frozen carbon dioxide. Placing a tile here costs 4 M€ and raises the temperature 1 step.',
    placement: 'top',
  },
  {
    id: 'vastitas_nova_uranius_tholus',
    boardName: BoardName.VASTITAS_BOREALIS_NOVA,
    spaceId: '46', // y=6, volcanic(TITANIUM)
    title: 'Uranius Tholus',
    description: 'Uranius Tholus is a volcano in the Tharsis region. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  {
    id: 'vastitas_nova_viking_1',
    boardName: BoardName.VASTITAS_BOREALIS_NOVA,
    spaceId: '59', // y=8, land(DELEGATE) — first space in row
    title: 'Viking 1 landing site',
    description: 'Landing site of the Viking 1 lander in Chryse Planitia. Placing a tile here lets you add a delegate from your reserve for free (ignored without Turmoil).',
    placement: 'top',
  },
  // ── Terra Cimmeria — named locations (same volcanoes as the Nova map) ─
  {
    id: 'terra_cimmeria_albor_tholus',
    boardName: BoardName.TERRA_CIMMERIA,
    spaceId: '05', // y=0, volcanic(STEEL)
    title: 'Albor Tholus',
    description: 'Albor Tholus is a shield volcano in the Elysium region. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'bottom',
  },
  {
    id: 'terra_cimmeria_tyrrhenus_mons',
    boardName: BoardName.TERRA_CIMMERIA,
    spaceId: '21', // y=3, volcanic(STEEL,STEEL)
    title: 'Tyrrhenus Mons',
    description: 'Tyrrhenus Mons is a shield volcano in the Mare Tyrrhenum region. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  {
    id: 'terra_cimmeria_apollinaris_mons',
    boardName: BoardName.TERRA_CIMMERIA,
    spaceId: '27', // y=3, volcanic(DRAW_CARD)
    title: 'Apollinaris Mons',
    description: 'Apollinaris Mons is an extinct shield volcano. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'left',
  },
  {
    id: 'terra_cimmeria_hadriacus_mons',
    boardName: BoardName.TERRA_CIMMERIA,
    spaceId: '38', // y=5, volcanic(DRAW_CARD,DRAW_CARD)
    title: 'Hadriacus Mons',
    description: 'Hadriacus Mons is a shield volcano in the Mare Hadriacum region. This is a potential volcano spot, but any tile may be placed here.',
    placement: 'right',
  },
  // ── Outer (off-Mars) special cells ─────────────────────────────────
  {
    id: 'ganymede_colony',
    spaceId: SpaceName.GANYMEDE_COLONY, // '01'
    title: 'Ganymede Colony',
    description: 'Only the Ganymede Colony tile can be placed here. Ganymede Colony is placed using a specific project card.',
    placement: 'right',
  },
  {
    id: 'phobos_space_haven',
    spaceId: SpaceName.PHOBOS_SPACE_HAVEN, // '02'
    title: 'Phobos Space Haven',
    description: 'Only the Phobos Space Haven tile can be placed here. Phobos Space Haven is placed using a specific project card.',
    placement: 'right',
  },
  {
    id: 'stanford_torus',
    spaceId: SpaceName.STANFORD_TORUS, // '69'
    title: 'Stanford Torus',
    description: 'Only the Stanford Torus tile can be placed here. Stanford Torus is placed using a specific project card.',
    placement: 'bottom',
  },
  {
    id: 'luna_metropolis',
    spaceId: SpaceName.LUNA_METROPOLIS, // '70'
    title: 'Luna Metropolis',
    description: 'Only the Luna Metropolis tile can be placed here. Luna Metropolis is placed using a specific project card.',
    placement: 'left',
  },
  {
    id: 'dawn_city',
    spaceId: SpaceName.DAWN_CITY, // '71'
    title: 'Dawn City',
    description: 'Only the Dawn City tile can be placed here. Dawn City is placed using a specific project card.',
    placement: 'bottom',
  },
  {
    id: 'stratopolis',
    spaceId: SpaceName.STRATOPOLIS, // '72'
    title: 'Stratopolis',
    description: 'Only the Stratopolis tile can be placed here. Stratopolis is placed using a specific project card.',
    placement: 'left',
  },
  {
    id: 'maxwell_base',
    spaceId: SpaceName.MAXWELL_BASE, // '73'
    title: 'Maxwell Base',
    description: 'Only the Maxwell Base tile can be placed here. Maxwell Base is placed using a specific project card.',
    placement: 'bottom',
  },
  // Turmoil Redux TR27 — the FIFTH cell of the Venus flank («next to the Venus track»), an ordinary drawn cell.
  {
    id: 'aurora_station',
    spaceId: SpaceName.AURORA_STATION, // '80'
    title: 'Aurora Station',
    description: 'Only the Aurora Station tile can be placed here. Aurora Station is placed using a specific project card.',
    placement: 'left',
  },
  // A HOSTED cell (`common/boards/hostedSpaces.ts`): its place is a colony tile, never the board — the entry gives
  // the cell its NAME for the readings that list counted cities (RX08's, the score explorer's), no board hover.
  {
    id: 'nova_city',
    spaceId: SpaceName.NOVA_CITY, // '79'
    title: 'Nova City',
    description: 'The Nova City tile lies on a colony tile. Nova City is placed using a specific project card.',
    placement: 'right',
  },
];

function spaceKey(spaceId: SpaceId, boardName?: BoardName): string {
  return `${boardName ?? '*'}:${spaceId}`;
}

const BY_SPACE_KEY: Readonly<Record<string, SpecialCellInfo>> = (() => {
  const m: Record<string, SpecialCellInfo> = {};
  for (const entry of SPECIAL_CELL_INFO) {
    m[spaceKey(entry.spaceId, entry.boardName)] = entry;
  }
  return m;
})();

const BY_ID: Readonly<Record<string, SpecialCellInfo>> = (() => {
  const m: Record<string, SpecialCellInfo> = {};
  for (const entry of SPECIAL_CELL_INFO) {
    m[entry.id] = entry;
  }
  return m;
})();

/** Lookup by hex spaceId. Returns undefined for ordinary cells. */
export function getSpecialCellInfo(spaceId: SpaceId, boardName?: BoardName): SpecialCellInfo | undefined {
  if (boardName !== undefined) {
    return BY_SPACE_KEY[spaceKey(spaceId, boardName)] ?? BY_SPACE_KEY[spaceKey(spaceId)];
  }
  return BY_SPACE_KEY[spaceKey(spaceId)];
}

/** Lookup by entry id (used by the overlay to render the active marker). */
export function getSpecialCellInfoById(id: string): SpecialCellInfo | undefined {
  return BY_ID[id];
}
