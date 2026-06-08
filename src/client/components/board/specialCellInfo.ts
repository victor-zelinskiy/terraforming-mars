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
