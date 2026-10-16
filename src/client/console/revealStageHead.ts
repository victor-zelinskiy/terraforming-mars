/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE RECEIVED-CARDS HEAD — the words of ONE moment («вы получили карты»), in every host that presents it.
 *
 * The same event used to speak two dialects: inside a workspace one stage row (`ConsoleWsStageHead` — the sentence
 * and its live state as badges), outside one a FORM — a kicker «◈ ПОЛУЧЕНЫ КАРТЫ» over a title «Получены карты» (the
 * same words twice), a boilerplate subtitle «Карты добавлены из источника добора.», a source chip that never named
 * the cell it came from and a count chip pinned to the far edge of a 70 rem plate (TR57 «НАГРАДА ВНЕ WORKSPACE»).
 * Both hosts now render this ONE reading through the ONE head component; the only difference between them is what
 * the host already shows beside the cards — a workspace stands its source on stage, a scene has to NAME it.
 *
 * PURE: no DOM, no Vue, no translation (keys + params — the component translates).
 */
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';

export type RevealHeadHost = 'embedded' | 'scene';

/** The source as a badge reads it: a label key, a name (an i18n key, or a card / colony name) and the cell's glyphs. */
export type RevealSourceReading = {
  /** «Источник» · «Клетка» — the badge's caps word. */
  labelKey: string;
  /** What produced the cards: a card / colony name, a scale — an i18n key the host translates ('' = the glyphs say it). */
  nameKey: string;
  /** …or a name the host ALREADY translated (a party's action, a law — their readers live with the component). */
  nameText?: string;
  /** The PAYING CELL's printed bonuses, as resource-icon classes (`resource_icon--cards`) — the cell's own face. */
  icons: ReadonlyArray<string>;
  /** A card source opens on L3 (the inspection grammar: L3 = the source that produced the current object). */
  inspectable: boolean;
};

export type RevealHeadBadge =
  /** A SETTLEMENT TABLE's size — its places, constant from the first deal to the last turn. */
  | {kind: 'settlements', total: number}
  /** A filtered search states its whole outcome in its own tally (the component renders `ConsoleDrawSearchTally`). */
  | {kind: 'search'}
  /** «ПОЛУЧЕНО N» — only for more than one card: one card is the title's own singular. */
  | {kind: 'received', count: number}
  /** Where the cards came from — only where nothing on screen stands for it (the scene). */
  | {kind: 'source', reading: RevealSourceReading};

export type RevealStageHead = {
  /** The stage's ONE sentence (an i18n key) — never repeated by a kicker. */
  titleKey: string;
  badges: ReadonlyArray<RevealHeadBadge>;
};

export type RevealStageHeadInput = {
  host: RevealHeadHost;
  /** The batch's TOTAL cards (never the untaken remainder — the head cannot change mid-flow). */
  cards: number;
  search: boolean;
  /** A settlement table: its income sockets and its places. */
  table?: {income: number, total: number};
  source: CardDrawRevealSource | undefined;
  /** The paying cell's printed bonuses, when the source is a cell the board still shows (`game.spaces[].bonus`). */
  cellBonuses?: ReadonlyArray<SpaceBonus>;
  /** The host already STANDS the source card beside the cards (a workspace's hero / source seat). */
  sourceOnStage: boolean;
  /** A translated name for a source this module has no words of its own for (a party's action, a law). */
  fallbackName?: string;
};

/** A cell's printed bonus as the resource icon the rail and the chips already draw (none for what has no icon). */
const BONUS_ICON: Partial<Record<SpaceBonus, string>> = {
  [SpaceBonus.TITANIUM]: 'titanium',
  [SpaceBonus.STEEL]: 'steel',
  [SpaceBonus.PLANT]: 'plants',
  [SpaceBonus.DRAW_CARD]: 'cards',
  [SpaceBonus.HEAT]: 'heat',
  [SpaceBonus.MEGACREDITS]: 'megacredits',
  [SpaceBonus.ENERGY]: 'energy',
  [SpaceBonus.MICROBE]: 'microbes',
  [SpaceBonus.DATA]: 'data',
  [SpaceBonus.SCIENCE]: 'science',
  [SpaceBonus.DELEGATE]: 'delegate',
  [SpaceBonus.COLONY]: 'colony-tile',
};

export function cellBonusIcons(bonuses: ReadonlyArray<SpaceBonus>): Array<string> {
  return bonuses.map((b) => BONUS_ICON[b]).filter((icon): icon is string => icon !== undefined).map((icon) => `resource_icon--${icon}`);
}

/**
 * WHERE THE CARDS CAME FROM, as words a player reads from the couch. A cell is named by its own printed face (its
 * bonuses — the reward the player just saw lift off it), never by a template «Бонус клетки»; a card by its name (and
 * L3 opens it); a colony, a scale, a party, a law by their own names. `undefined` = nothing honest to say.
 */
export function revealSourceReading(source: CardDrawRevealSource | undefined, cellBonuses?: ReadonlyArray<SpaceBonus>, fallbackName?: string): RevealSourceReading | undefined {
  if (source === undefined) {
    return undefined;
  }
  switch (source.type) {
  case 'card':
    return {labelKey: 'Source', nameKey: source.cardName, icons: [], inspectable: true};
  case 'colony':
    return {labelKey: 'Source', nameKey: source.colonyName, icons: [], inspectable: false};
  case 'tile': {
    const icons = cellBonusIcons(cellBonuses ?? []);
    return icons.length > 0 ?
      {labelKey: 'Board cell', nameKey: '', icons, inspectable: false} :
      {labelKey: 'Source', nameKey: 'Tile bonus', icons: [], inspectable: false};
  }
  case 'globalParameter':
    return source.parameter === 'venus' ? {labelKey: 'Source', nameKey: 'Venus scale bonus', icons: [], inspectable: false} : undefined;
  case 'campaign':
    return {labelKey: 'Source', nameKey: 'Carried from the previous mission', icons: [], inspectable: false};
  default:
    // A party / a law name themselves through the component's own readers (they need translation helpers this pure
    // module does not own), handed in already translated.
    return fallbackName !== undefined && fallbackName !== '' ?
      {labelKey: 'Source', nameKey: '', nameText: fallbackName, icons: [], inspectable: false} : undefined;
  }
}

/** The head of a received batch, for its host. */
export function revealStageHead(o: RevealStageHeadInput): RevealStageHead {
  if (o.table !== undefined) {
    return {
      titleKey: o.table.income > 0 ? 'Trade income · a bonus card per settlement' : 'Owner bonus · one card per settlement',
      badges: [{kind: 'settlements', total: o.table.total}],
    };
  }
  const badges: Array<RevealHeadBadge> = [];
  if (o.host === 'scene' && !o.sourceOnStage) {
    const reading = revealSourceReading(o.source, o.cellBonuses, o.fallbackName);
    if (reading !== undefined) {
      badges.push({kind: 'source', reading});
    }
  }
  if (o.search) {
    badges.push({kind: 'search'});
  } else if (o.cards > 1) {
    badges.push({kind: 'received', count: o.cards});
  }
  return {titleKey: o.cards === 1 ? 'Card received' : 'Cards received', badges};
}
