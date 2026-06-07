import {SpaceId} from '@/common/Types';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceName} from '@/common/boards/SpaceName';

/**
 * Data-driven framework for special-cell info markers on Mars boards.
 *
 * Replaces the old "persistent text label on the planet" UX with a tiny
 * on-cell sci-fi info marker → hover → popup info panel pattern (closer to
 * the Asmodee Steam release). One entry per special cell that deserves a
 * marker; adding a new board's special cells is just appending entries.
 *
 * Visibility rule: a marker is rendered ONLY when both
 *   1. an entry exists for the cell's spaceId, AND
 *   2. the cell currently has no tile placed on it (`space.tileType === undefined`).
 *
 * The marker → panel direction is curated per entry (`placement`) so the
 * popup lands in the empty area near each cell. The overlay component
 * auto-flips to the opposite side if the preferred direction would clip
 * the viewport, so this preference is a HINT rather than a hard rule.
 */
export type PanelPlacement = 'top' | 'bottom' | 'left' | 'right';

export type SpecialCellInfo = {
  /** Stable id, used as the hover-state active key. */
  id: string;
  /** Optional board scope. Unset entries are global/off-board special cells. */
  boardName?: BoardName;
  /** Board space id the marker mounts on. */
  spaceId: SpaceId;
  /** Panel title (RU). Displayed uppercase by the panel CSS — write
   *  the natural-case form here. */
  title: string;
  /** Panel body text (RU). */
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
    title: 'Город Ночи',
    description: 'Здесь можно разместить только Город Ночи. Город Ночи размещается с помощью определённой карты проекта.',
    placement: 'bottom',
  },
  // ── Tharsis surface — Named mountains (volcano candidates) ─────────
  // Each volcanic mountain hex gets its own marker. The text reuses the
  // same "potential volcano spot, but any tile is allowed" framing, just
  // scoped to one mountain so the player gets a self-contained answer
  // on hover regardless of which mountain they pointed at.
  {
    id: 'tharsis_tholus',
    boardName: BoardName.THARSIS,
    spaceId: '09',
    title: 'Купол Фарсида',
    description: 'Купол Фарсида — гора на поверхности Марса. Это потенциальное место для вулкана, но на него можно разместить любую плитку.',
    placement: 'right',
  },
  {
    id: 'ascraeus_mons',
    boardName: BoardName.THARSIS,
    spaceId: '14',
    title: 'Гора Аскрийская',
    description: 'Гора Аскрийская — гора на поверхности Марса. Это потенциальное место для вулкана, но на неё можно разместить любую плитку.',
    placement: 'right',
  },
  {
    id: 'pavonis_mons',
    boardName: BoardName.THARSIS,
    spaceId: '21',
    title: 'Гора Павлина',
    description: 'Гора Павлина — гора на поверхности Марса. Это потенциальное место для вулкана, но на неё можно разместить любую плитку.',
    placement: 'right',
  },
  {
    id: 'arsia_mons',
    boardName: BoardName.THARSIS,
    spaceId: '29',
    title: 'Гора Арсия',
    description: 'Гора Арсия — гора на поверхности Марса. Это потенциальное место для вулкана, но на неё можно разместить любую плитку.',
    placement: 'right',
  },
  // ── Elysium surface — legacy map labels moved to hover markers ─────
  {
    id: 'hecatus_tholus',
    boardName: BoardName.ELYSIUM,
    spaceId: '08',
    title: 'Купол Гекаты',
    description: 'Купол Гекаты — гора на поверхности Марса. Это потенциальное место для вулкана, но на него можно разместить любую плитку.',
    placement: 'right',
  },
  {
    id: 'elysium_mons',
    boardName: BoardName.ELYSIUM,
    spaceId: '14',
    title: 'Гора Элизий',
    description: 'Гора Элизий — гора на поверхности Марса. Это потенциальное место для вулкана, но на неё можно разместить любую плитку.',
    placement: 'right',
  },
  {
    id: 'olympus_mons',
    boardName: BoardName.ELYSIUM,
    spaceId: '20',
    title: 'Гора Олимп',
    description: 'Гора Олимп — гора на поверхности Марса. Это потенциальное место для вулкана, но на неё можно разместить любую плитку.',
    placement: 'left',
  },
  {
    id: 'elysium_arsia_mons',
    boardName: BoardName.ELYSIUM,
    spaceId: '37',
    title: 'Гора Арсия',
    description: 'Гора Арсия — гора на поверхности Марса. Это потенциальное место для вулкана, но на неё можно разместить любую плитку.',
    placement: 'left',
  },
  // ── Outer (off-Mars) special cells ─────────────────────────────────
  {
    id: 'ganymede_colony',
    spaceId: SpaceName.GANYMEDE_COLONY, // '01'
    title: 'Колония на Ганимеде',
    description: 'Здесь можно разместить только Колонию на Ганимеде. Колония на Ганимеде размещается с помощью определённой карты проекта.',
    placement: 'right',
  },
  {
    id: 'phobos_space_haven',
    spaceId: SpaceName.PHOBOS_SPACE_HAVEN, // '02'
    title: 'Космопорт на Фобосе',
    description: 'Здесь можно разместить только Космопорт на Фобосе. Космопорт на Фобосе размещается с помощью определённой карты проекта.',
    placement: 'right',
  },
  {
    id: 'stanford_torus',
    spaceId: SpaceName.STANFORD_TORUS, // '69'
    title: 'Стэнфордский тор',
    description: 'Здесь можно разместить только Стэнфордский тор. Стэнфордский тор размещается с помощью определённой карты проекта.',
    placement: 'bottom',
  },
  {
    id: 'luna_metropolis',
    spaceId: SpaceName.LUNA_METROPOLIS, // '70'
    title: 'Лунный мегаполис',
    description: 'Здесь можно разместить только Лунный мегаполис. Лунный мегаполис размещается с помощью определённой карты проекта.',
    placement: 'left',
  },
  {
    id: 'dawn_city',
    spaceId: SpaceName.DAWN_CITY, // '71'
    title: 'Город рассвета',
    description: 'Здесь можно разместить только Город рассвета. Город рассвета размещается с помощью определённой карты проекта.',
    placement: 'bottom',
  },
  {
    id: 'stratopolis',
    spaceId: SpaceName.STRATOPOLIS, // '72'
    title: 'Стратополис',
    description: 'Здесь можно разместить только Стратополис. Стратополис размещается с помощью определённой карты проекта.',
    placement: 'left',
  },
  {
    id: 'maxwell_base',
    spaceId: SpaceName.MAXWELL_BASE, // '73'
    title: 'База Максвелла',
    description: 'Здесь можно разместить только Базу Максвелла. База Максвелла размещается с помощью определённой карты проекта.',
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
