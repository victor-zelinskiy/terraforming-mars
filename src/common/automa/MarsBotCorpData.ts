import {CardName} from '../cards/CardName';
import {Tag} from '../cards/Tag';
import {BonusCardId, MARSBOT_MAX_TRACK_POSITION, MARS_BOT_CORP_IDS, MarsBotCorpId, MarsBotCubeType} from './AutomaTypes';
import {BonusCardEffectLine} from './BonusCardData';

export {MARS_BOT_CORP_IDS, MarsBotCorpId} from './AutomaTypes';
export type {MarsBotCubeType} from './AutomaTypes';

/**
 * MarsBot corporations (Automa expansion, Rule Book B "Adding Corporations").
 *
 * A MarsBot corporation is its OWN game entity — never the human corporation
 * with tweaked numbers. The `original` reference is exactly the four official
 * links to the human card: identity (name/logo), art, lore, and the
 * corporation-selection collision rule ("If the same corporation was selected
 * as the one you're playing, select another" — RB-B Setup 1). No human
 * gameplay field (starting M€, first action, human tags, discounts) ever
 * leaks through it. The id enum lives in `AutomaTypes.ts` (official card
 * numbers C01–C46, the `BonusCardId` convention).
 */

/**
 * A resource physically stored ON the MarsBot corporation card (Ecoline's
 * plant, Spire's science, Mining Guild's M€ bank). Its own union — plants and
 * M€ are not `CardResource`s in this engine, and the bot's corp storage is not
 * a card-resource pool.
 */
export type MarsBotCorpResource = 'plant' | 'science' | 'megacredits';

/**
 * How the bot picks (and protects) cards in the research draft — RB-B "Draft
 * Priority". Data, not behavior: the server's draft resolver interprets it,
 * the client only labels it.
 * - `tags`: priority tag chain ("a > b"); the Wildcard tag never matches
 *   (RB-B p.2).
 * - `mostExpensive` / `mostTags`: the RB-B special cases (Credicor / Spire).
 * - `leastAdvancedTrack`: Aridor's rule — re-evaluated each generation.
 */
export type MarsBotDraftPriority =
  | {type: 'tags', tags: ReadonlyArray<Tag>}
  | {type: 'mostExpensive'}
  | {type: 'mostTags'}
  | {type: 'leastAdvancedTrack'};

/**
 * A cube this corporation seeds during setup (RB-B «Special Cubes on the
 * MarsBot Player Mat»). The track is named by its identity TAG — the printed
 * cards say «the building track», «the Earth track», and a tag survives a
 * board whose track ORDER differs; the server resolves it through
 * `board.getTrackIndexForTag`.
 */
export type MarsBotTrackCube = {
  readonly tag: Tag;
  readonly position: number;
  readonly cubeType: MarsBotCubeType;
};

/** One kicker box of the printed MarsBot corporation card (RB-B anatomy). */
export type MarsBotCorpSection = {
  kind: 'draftPriority' | 'setup' | 'effect' | 'beforeActionPhase' | 'roundStart';
  lines: ReadonlyArray<BonusCardEffectLine>;
};

/**
 * The full printed definition of one MarsBot corporation — everything both
 * sides need to KNOW (the server adds behavior on top in
 * `src/server/automa/corps/`). Only the boxes the physical card actually
 * prints exist here — no fake defaults (RB-B anatomy: "Not all corporations
 * use all fields").
 */
export type MarsBotCorpInfo = {
  id: MarsBotCorpId;
  /** Official printed card number — doubles as the enum value. */
  cardNumber: string;
  /** The original human corporation: identity, art, lore, collision mapping. */
  original: CardName;
  /**
   * Starting tags printed on the corp card. Resolved at setup "as if they are
   * shown on a card revealed during play" (RB-B Setup 4) — i.e. each advances
   * its MarsBot track once, which IS how the bot owns tags from then on.
   */
  startingTags: ReadonlyArray<Tag>;
  draftPriority?: MarsBotDraftPriority;
  /** The resource this corporation stores on its own card, if any. */
  resource?: MarsBotCorpResource;
  /** Corporation-specific bonus cards this corp brings into play (RB-B Setup 5
   *  returns all others to the box). */
  corpBonusCards: ReadonlyArray<BonusCardId>;
  /**
   * A M€ BANK on the corporation card (C06): setup stocks it with `size`, and
   * every M€ the bot gains is taken FROM it instead of the supply; emptying it
   * refills it and advances the track named by `trackTag` — which is also the
   * card's own off-switch (a track at its end stops the whole effect).
   */
  mcBank?: {size: number, trackTag: Tag};
  /**
   * A setup box that SEEDS the bonus deck with project cards (C07): reveal
   * project cards until `count` of them carry `tag`, then shuffle everything
   * revealed into the bonus deck. From then on a bonus-deck draw can yield a
   * project card, which is resolved as one.
   */
  bonusDeckSeed?: {tag: Tag, count: number};
  /** Cubes seeded onto MarsBot's tracks during setup (RB-B special cubes). */
  trackCubes?: ReadonlyArray<MarsBotTrackCube>;
  /**
   * What each cube colour DOES, as the printed effect box states it (EN i18n
   * keys). The track view reads it so a cube on the board explains itself
   * without opening the corporation card.
   */
  cubeLegend?: Partial<Record<MarsBotCubeType, string>>;
  /**
   * Tracks whose MARKER the setup box replaces with a white cube «as a
   * reminder for this corporation's effect» (C04). Pure presentation — the
   * marker is still the bot's position; the reminder is what the track view
   * paints, with `markerLegend` naming the effect it reminds of.
   */
  whiteMarkerTracks?: ReadonlyArray<Tag>;
  /** EN i18n key explaining what the white markers remind of. */
  markerLegend?: string;
  /** The printed rule boxes, in printed order (display data; EN i18n keys). */
  sections: ReadonlyArray<MarsBotCorpSection>;
};

/**
 * Printed card data, transcribed from the official cards (owner-verified
 * scans; см. docs/AUTOMA_DATA_AUDIT.md §10):
 *  - C01 Credicor, C02 Ecoline — MarsBot corporation cards C01/C02;
 *  - C45 Spire — MarsBot corporation card C45 (starting tag: Earth);
 *  - RB-B p.2 "Special Cases" gives Credicor/Spire their draft rules verbatim.
 */
/**
 * C13's setup box: «Place silver resource cube on every space of the building
 * track starting with space #4» — every space to the end of the track.
 */
const CHEUNG_SILVER_CUBES: ReadonlyArray<MarsBotTrackCube> =
  Array.from({length: MARSBOT_MAX_TRACK_POSITION - 3}, (_, i) => ({
    tag: Tag.BUILDING,
    position: i + 4,
    cubeType: 'credit' as const,
  }));

const CORP_INFO: Readonly<Record<MarsBotCorpId, MarsBotCorpInfo>> = {
  [MarsBotCorpId.C01_CREDICOR]: {
    id: MarsBotCorpId.C01_CREDICOR,
    cardNumber: 'C01',
    original: CardName.CREDICOR,
    startingTags: [],
    draftPriority: {type: 'mostExpensive'},
    corpBonusCards: [],
    sections: [
      {kind: 'draftPriority', lines: [{text: 'Most expensive'}]},
      {kind: 'effect', lines: [
        {icon: 'megacredits', text: 'When resolving a card with a cost of 20 M€ or more, MarsBot gains ${0} M€', params: ['4']},
      ]},
    ],
  },
  [MarsBotCorpId.C02_ECOLINE]: {
    id: MarsBotCorpId.C02_ECOLINE,
    cardNumber: 'C02',
    original: CardName.ECOLINE,
    startingTags: [],
    resource: 'plant',
    corpBonusCards: [BonusCardId.B23_RAPID_SPROUTING],
    sections: [
      {kind: 'beforeActionPhase', lines: [
        {icon: 'deck', text: 'Add Rapid Sprouting to MarsBot\'s action deck'},
        {icon: 'plants', text: 'Rapid Sprouting grows a plant on this card, then turns it into a greenery and an oxygen step', muted: true},
      ]},
    ],
  },
  [MarsBotCorpId.C03_HELION]: {
    id: MarsBotCorpId.C03_HELION,
    cardNumber: 'C03',
    original: CardName.HELION,
    startingTags: [],
    corpBonusCards: [],
    // SETUP box, verbatim: a WHITE cube on the building track space #6, the
    // space track #9, the science track #10, the power track #5 and #9, the
    // plant track #11; a BLACK cube on the Earth track #3, #6, #9, #12, #13,
    // #14. Every white cube sits on a printed TEMPERATURE space (verified
    // against the Tharsis layout) — which is what the effect replaces.
    trackCubes: [
      {tag: Tag.BUILDING, position: 6, cubeType: 'white'},
      {tag: Tag.SPACE, position: 9, cubeType: 'white'},
      {tag: Tag.SCIENCE, position: 10, cubeType: 'white'},
      {tag: Tag.POWER, position: 5, cubeType: 'white'},
      {tag: Tag.POWER, position: 9, cubeType: 'white'},
      {tag: Tag.PLANT, position: 11, cubeType: 'white'},
      {tag: Tag.EARTH, position: 3, cubeType: 'black'},
      {tag: Tag.EARTH, position: 6, cubeType: 'black'},
      {tag: Tag.EARTH, position: 9, cubeType: 'black'},
      {tag: Tag.EARTH, position: 12, cubeType: 'black'},
      {tag: Tag.EARTH, position: 13, cubeType: 'black'},
      {tag: Tag.EARTH, position: 14, cubeType: 'black'},
    ],
    cubeLegend: {
      white: 'Instead of raising the temperature, MarsBot draws and resolves a card',
      black: 'MarsBot raises the temperature 1 step',
    },
    sections: [
      {kind: 'setup', lines: [
        {icon: 'cube-white', text: 'A white cube on the building ${0}, space ${1}, science ${2}, power ${3} and ${4}, plant ${5} track spaces', params: ['6', '9', '10', '5', '9', '11']},
        {icon: 'cube-black', text: 'A black cube on the Earth track spaces ${0}', params: ['3, 6, 9, 12, 13, 14']},
      ]},
      {kind: 'effect', lines: [
        {icon: 'cards', text: 'Advancing onto a white cube: instead of raising the temperature, MarsBot draws and resolves a card from the project deck'},
        {icon: 'temperature', text: 'Advancing onto a black cube: MarsBot raises the temperature 1 step'},
      ]},
    ],
  },
  [MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS]: {
    id: MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS,
    cardNumber: 'C04',
    original: CardName.INTERPLANETARY_CINEMATICS,
    // The printed starting tags: TWO event tags (RB-B Setup 4 resolves them
    // like a revealed card's tags — and the effect below counts them, which
    // is what «including the starting tags» means).
    startingTags: [Tag.EVENT, Tag.EVENT],
    corpBonusCards: [],
    // SETUP: «Replace the trackers for the building track and event track
    // with white cubes as a reminder for this corporation's effect» — a
    // REMINDER, no game effect of its own.
    whiteMarkerTracks: [Tag.BUILDING, Tag.EVENT],
    markerLegend: 'Advancing this track pays MarsBot 2 M€',
    sections: [
      {kind: 'setup', lines: [
        {icon: 'cube-white', text: 'The building and event track markers become white cubes — a reminder of the effect below', muted: true},
      ]},
      {kind: 'effect', lines: [
        {icon: 'megacredits', text: 'Each time MarsBot advances the building or event track — the starting tags included — it gains ${0} M€', params: ['2']},
      ]},
    ],
  },
  [MarsBotCorpId.C05_INVENTRIX]: {
    id: MarsBotCorpId.C05_INVENTRIX,
    cardNumber: 'C05',
    original: CardName.INVENTRIX,
    startingTags: [],
    corpBonusCards: [BonusCardId.B25_DO_IT_RIGHT],
    sections: [
      // SETUP: «Destroy Lobbyists from the bonus deck» — B25 is that card
      // without its self-destruction, so the original leaves the game.
      {kind: 'setup', lines: [
        {icon: 'deck', text: 'Lobbyists is destroyed — it never comes up in this game'},
      ]},
      {kind: 'effect', lines: [
        {icon: 'megacredits', text: 'When resolving a card with a requirement, MarsBot gains ${0} M€', params: ['2']},
      ]},
      {kind: 'beforeActionPhase', lines: [
        {icon: 'deck', text: 'Add Do It Right to MarsBot\'s action deck'},
        {icon: 'temperature', text: 'Do It Right pushes the first global parameter that is 1-2 steps from a bonus, or does nothing', muted: true},
      ]},
    ],
  },
  [MarsBotCorpId.C06_MINING_GUILD]: {
    id: MarsBotCorpId.C06_MINING_GUILD,
    cardNumber: 'C06',
    original: CardName.MINING_GUILD,
    startingTags: [Tag.BUILDING, Tag.BUILDING],
    resource: 'megacredits',
    mcBank: {size: 10, trackTag: Tag.BUILDING},
    corpBonusCards: [],
    sections: [
      {kind: 'setup', lines: [
        {icon: 'megacredits', text: 'Place ${0} M€ on this card', params: ['10']},
      ]},
      {kind: 'effect', lines: [
        {icon: 'megacredits', text: 'While the building track is not at its end, every M€ MarsBot gains is taken from this card instead'},
        {icon: 'deck', text: 'When the card empties: put ${0} M€ back on it and advance the building track', params: ['10']},
      ]},
    ],
  },
  [MarsBotCorpId.C07_PHOBOLOG]: {
    id: MarsBotCorpId.C07_PHOBOLOG,
    cardNumber: 'C07',
    original: CardName.PHOBOLOG,
    startingTags: [Tag.SPACE],
    corpBonusCards: [],
    // SETUP: «Reveal cards from the project deck until you've revealed 2 cards
    // with a space tag. Shuffle these cards into the bonus deck.»
    bonusDeckSeed: {tag: Tag.SPACE, count: 2},
    // SETUP: «Place a white cube on the space track on spaces #7, #10, #13, #15.»
    trackCubes: [
      {tag: Tag.SPACE, position: 7, cubeType: 'white'},
      {tag: Tag.SPACE, position: 10, cubeType: 'white'},
      {tag: Tag.SPACE, position: 13, cubeType: 'white'},
      {tag: Tag.SPACE, position: 15, cubeType: 'white'},
    ],
    cubeLegend: {
      white: 'Advancing onto it: MarsBot draws and resolves a card from the bonus deck',
    },
    sections: [
      {kind: 'setup', lines: [
        {icon: 'deck', text: 'Reveal project cards until ${0} of them carry a space tag — all of them are shuffled into the bonus deck', params: ['2']},
        {icon: 'cube-white', text: 'A white cube on the space track spaces ${0}', params: ['7, 10, 13, 15']},
      ]},
      {kind: 'effect', lines: [
        {icon: 'cards', text: 'Advancing onto a white cube: MarsBot draws and resolves a card from the bonus deck'},
      ]},
    ],
  },
  [MarsBotCorpId.C08_SATURN_SYSTEMS]: {
    id: MarsBotCorpId.C08_SATURN_SYSTEMS,
    cardNumber: 'C08',
    original: CardName.SATURN_SYSTEMS,
    startingTags: [Tag.JOVIAN, Tag.SPACE, Tag.SPACE, Tag.SPACE],
    draftPriority: {type: 'tags', tags: [Tag.JOVIAN, Tag.SPACE]},
    corpBonusCards: [],
    sections: [
      {kind: 'draftPriority', lines: [{text: 'Jovian, then space'}]},
      {kind: 'effect', lines: [
        {icon: 'cards', text: 'Every Jovian tag at the table advances the event track — a human playing a Jovian card, MarsBot resolving a Jovian tag, the starting tag on this card included'},
      ]},
    ],
  },
  [MarsBotCorpId.C09_TERACTOR]: {
    id: MarsBotCorpId.C09_TERACTOR,
    cardNumber: 'C09',
    original: CardName.TERACTOR,
    startingTags: [],
    draftPriority: {type: 'tags', tags: [Tag.EARTH]},
    corpBonusCards: [],
    // SETUP: «Replace the tracker for the Earth track with a white cube as a
    // reminder for this corporation's effect» — the C04 reminder primitive,
    // and the same legend sentence, because it is the same promise.
    whiteMarkerTracks: [Tag.EARTH],
    markerLegend: 'Advancing this track pays MarsBot 2 M€',
    sections: [
      {kind: 'draftPriority', lines: [{text: 'Earth'}]},
      {kind: 'setup', lines: [
        {icon: 'megacredits', text: 'MarsBot gains ${0} M€', params: ['25']},
        {icon: 'cube-white', text: 'The Earth track marker becomes a white cube — a reminder of the effect below', muted: true},
      ]},
      {kind: 'effect', lines: [
        {icon: 'megacredits', text: 'Each time MarsBot advances the Earth track it gains ${0} M€', params: ['2']},
      ]},
    ],
  },
  [MarsBotCorpId.C10_THARSIS_REPUBLIC]: {
    id: MarsBotCorpId.C10_THARSIS_REPUBLIC,
    cardNumber: 'C10',
    original: CardName.THARSIS_REPUBLIC,
    startingTags: [],
    draftPriority: {type: 'tags', tags: [Tag.CITY]},
    corpBonusCards: [],
    sections: [
      {kind: 'draftPriority', lines: [{text: 'City'}]},
      {kind: 'setup', lines: [
        {icon: 'city', text: 'MarsBot places a city tile'},
      ]},
      {kind: 'effect', lines: [
        {icon: 'megacredits', text: 'A city tile a human places pays MarsBot ${0} M€', params: ['2']},
        {icon: 'city', text: 'A city tile MarsBot places advances the event track'},
        {text: 'Both already apply during setup', muted: true},
      ]},
    ],
  },
  [MarsBotCorpId.C11_THORGATE]: {
    id: MarsBotCorpId.C11_THORGATE,
    cardNumber: 'C11',
    original: CardName.THORGATE,
    startingTags: [Tag.POWER],
    draftPriority: {type: 'tags', tags: [Tag.POWER]},
    corpBonusCards: [],
    // SETUP: «Place a white cube on the power track on spaces #4, #6, #8, #10.»
    trackCubes: [
      {tag: Tag.POWER, position: 4, cubeType: 'white'},
      {tag: Tag.POWER, position: 6, cubeType: 'white'},
      {tag: Tag.POWER, position: 8, cubeType: 'white'},
      {tag: Tag.POWER, position: 10, cubeType: 'white'},
    ],
    cubeLegend: {
      white: 'Advancing onto it: MarsBot resolves a card by its FIRST tag only, then raises the temperature 1 step',
    },
    sections: [
      {kind: 'draftPriority', lines: [{text: 'Power'}]},
      {kind: 'setup', lines: [
        {icon: 'megacredits', text: 'MarsBot gains ${0} M€', params: ['10']},
        {icon: 'cube-white', text: 'A white cube on the power track spaces ${0}', params: ['4, 6, 8, 10']},
      ]},
      {kind: 'effect', lines: [
        {icon: 'cards', text: 'Advancing onto a white cube: MarsBot draws a card and resolves ONLY its first tag'},
        {icon: 'temperature', text: 'Then MarsBot raises the temperature 1 step'},
      ]},
    ],
  },
  [MarsBotCorpId.C12_UNMI]: {
    id: MarsBotCorpId.C12_UNMI,
    cardNumber: 'C12',
    original: CardName.UNITED_NATIONS_MARS_INITIATIVE,
    startingTags: [],
    corpBonusCards: [BonusCardId.B31_GOVERNMENT_SUBSIDY],
    sections: [
      {kind: 'setup', lines: [
        {icon: 'deck', text: 'Shuffle Government Subsidy into the bonus deck'},
        {icon: 'deck', text: 'Generation 1 gets NO bonus card in the action deck', muted: true},
      ]},
      {kind: 'beforeActionPhase', lines: [
        {icon: 'deck', text: 'From generation 2 on, one EXTRA bonus card joins the action deck every generation'},
      ]},
    ],
  },
  [MarsBotCorpId.C13_CHEUNG_SHING_MARS]: {
    id: MarsBotCorpId.C13_CHEUNG_SHING_MARS,
    cardNumber: 'C13',
    original: CardName.CHEUNG_SHING_MARS,
    startingTags: [Tag.BUILDING],
    draftPriority: {type: 'tags', tags: [Tag.BUILDING]},
    corpBonusCards: [],
    trackCubes: CHEUNG_SILVER_CUBES,
    cubeLegend: {
      credit: 'Advancing onto it: MarsBot takes it as 5 M€',
    },
    sections: [
      {kind: 'draftPriority', lines: [{text: 'Building'}]},
      {kind: 'setup', lines: [
        {icon: 'cube-credit', text: 'A silver resource cube on every building track space from ${0} on', params: ['#4']},
      ]},
      {kind: 'effect', lines: [
        {icon: 'megacredits', text: 'Advancing onto a silver cube: MarsBot takes it as ${0} M€', params: ['5']},
      ]},
    ],
  },
  [MarsBotCorpId.C14_POINT_LUNA]: {
    id: MarsBotCorpId.C14_POINT_LUNA,
    cardNumber: 'C14',
    original: CardName.POINT_LUNA,
    startingTags: [Tag.SPACE],
    draftPriority: {type: 'tags', tags: [Tag.EARTH]},
    corpBonusCards: [],
    // SETUP box, verbatim: a WHITE cube on the Earth track spaces #1, #5, #9,
    // #13, #17; a BLACK cube on the Earth track spaces #3, #7, #11, #15 — the
    // two colours alternate up the whole track.
    trackCubes: [
      {tag: Tag.EARTH, position: 1, cubeType: 'white'},
      {tag: Tag.EARTH, position: 3, cubeType: 'black'},
      {tag: Tag.EARTH, position: 5, cubeType: 'white'},
      {tag: Tag.EARTH, position: 7, cubeType: 'black'},
      {tag: Tag.EARTH, position: 9, cubeType: 'white'},
      {tag: Tag.EARTH, position: 11, cubeType: 'black'},
      {tag: Tag.EARTH, position: 13, cubeType: 'white'},
      {tag: Tag.EARTH, position: 15, cubeType: 'black'},
      {tag: Tag.EARTH, position: 17, cubeType: 'white'},
    ],
    cubeLegend: {
      white: 'Advancing onto it: MarsBot advances its least-advanced track',
      black: 'Advancing onto it: MarsBot advances the space track',
    },
    sections: [
      {kind: 'draftPriority', lines: [{text: 'Earth'}]},
      {kind: 'setup', lines: [
        {icon: 'cube-white', text: 'A white cube on the Earth track spaces ${0}', params: ['1, 5, 9, 13, 17']},
        {icon: 'cube-black', text: 'A black cube on the Earth track spaces ${0}', params: ['3, 7, 11, 15']},
      ]},
      {kind: 'effect', lines: [
        {icon: 'cards', text: 'Advancing onto a white cube: MarsBot advances its least-advanced track (the topmost if tied)'},
        {icon: 'cards', text: 'Advancing onto a black cube: MarsBot advances the space track'},
      ]},
    ],
  },
  [MarsBotCorpId.C45_SPIRE]: {
    id: MarsBotCorpId.C45_SPIRE,
    cardNumber: 'C45',
    original: CardName.SPIRE,
    startingTags: [Tag.EARTH],
    draftPriority: {type: 'mostTags'},
    resource: 'science',
    corpBonusCards: [],
    sections: [
      {kind: 'draftPriority', lines: [{text: 'Most tags'}]},
      {kind: 'effect', lines: [
        {icon: 'science', text: 'When resolving a card with 2 or more tags, place a science resource on this card'},
      ]},
      {kind: 'beforeActionPhase', lines: [
        {icon: 'science', text: 'With ${0} or more science resources here, remove ${1} of them', params: ['10', '10']},
        {icon: 'city', text: 'MarsBot places a city tile and gains 1 TR'},
      ]},
    ],
  },
};

export function marsBotCorpInfo(id: MarsBotCorpId): MarsBotCorpInfo {
  return CORP_INFO[id];
}

/** The corp that owns a corporation-specific bonus card (B22–B32), if implemented. */
export function corpOwningBonusCard(id: BonusCardId): MarsBotCorpInfo | undefined {
  return MARS_BOT_CORP_IDS.map(marsBotCorpInfo).find((corp) => corp.corpBonusCards.includes(id));
}

/**
 * Per-corporation statistic counters, serialized with the bot and shipped to
 * the client as open information. Missing keys read as 0. The keys are a
 * closed vocabulary so the endgame insight layer works with STRUCTURED facts,
 * never display text:
 *
 * Shared draft counters (any corp with a draft priority):
 *  - draftPriorityPicks   — bot draft picks decided by the corp's priority;
 *  - draftPickTiesBroken  — picks where several cards tied and rng decided;
 *  - draftProtectionSaves — post-draft discards where the priority CHANGED the
 *                           discarded card (the shuffled-first card was saved);
 *  - draftNoDiscardRounds — the rare "all 4 equal → nothing discarded" case;
 *  - fiveCardDecks        — action decks that ended up with 5 cards because of it.
 *
 * Credicor: credicorTriggers / credicorMc (the ≥20 M€ effect).
 * Ecoline:  sproutingsPlayed / plantsAdded / plantsSpent / greeneries /
 *           oxygenSteps / plantsLostToOpponents.
 * Spire:    scienceAdded / scienceSpent / citiesPlaced / trGained /
 *           multiTagCards (cards with 2+ tags resolved).
 * Interplanetary Cinematics: icTrackAdvances (building/event advances that
 *           paid) / icMc (M€ paid by them).
 * Inventrix: inventrixTriggers / inventrixMc (the requirement effect),
 *           doItRightPlayed and its branch tally doItRightTemperature /
 *           doItRightGreeneries / doItRightOceans / doItRightNoEffect.
 * Saturn Systems: saturnEventAdvances (event-track advances the Jovian
 *           trigger produced) split into saturnFromHuman / saturnFromBot.
 * Point Luna: lunaWhiteCubes / lunaBlackCubes (cubes reached) and lunaSteps
 *           (track advances they produced).
 * Cheung Shing Mars: cheungCubesHit / cheungMc (the silver cubes it collected).
 * UNMI:     unmiExtraCards (extra bonus cards its Before-Action-Phase box put
 *           into the action deck), subsidyPlayed / subsidyTr (its own B31).
 * Thorgate: thorgateCubesHit / thorgateCardsDrawn (cards the cubes flipped) /
 *           thorgateTemperatureSteps (the raise that follows each one).
 * Tharsis Republic: tharsisHumanCities / tharsisMc (what human cities paid),
 *           tharsisBotCities (event-track advances its own cities produced).
 * Teractor: teractorAdvances (Earth-track advances that paid) / teractorMc
 *           (M€ paid by them; the 25 M€ setup gain is not counted here).
 * Phobolog: phobologSeeded (project cards shuffled into the bonus deck),
 *           phobologCubesHit, phobologBonusCards / phobologProjectCards (what
 *           those cubes actually drew).
 * Mining Guild: miningGuildBanked (M€ that flowed THROUGH the card) /
 *           miningGuildRefills (times it emptied = building-track advances).
 * Helion:   whiteCubesHit / blackCubesHit (cubes reached), helionCardsDrawn
 *           (white-cube draws), helionTemperatureSteps (black-cube raises),
 *           helionTemperatureReplaced (printed raises the white cube took over).
 */
export type MarsBotCorpStats = Partial<Record<string, number>>;

/** The public per-corp model the client receives (open table information). */
/** A seeded cube as the client sees it (open table information). */
export type MarsBotCorpCubeModel = {
  trackIndex: number;
  position: number;
  cubeType: MarsBotCubeType;
  /** Already triggered — the physical cube is spent and never re-arms. */
  spent: boolean;
};

export type MarsBotCorpModel = {
  id: MarsBotCorpId;
  /** Original human corporation — identity/art/lore resolve through it. */
  original: CardName;
  startingTags: ReadonlyArray<Tag>;
  resource?: MarsBotCorpResource;
  /** Resources currently ON the corporation card (Ecoline plant, Spire science). */
  resources: number;
  /** Cubes this corporation seeded on the bot's tracks (empty for most corps). */
  cubes: ReadonlyArray<MarsBotCorpCubeModel>;
  /** Track indexes whose marker the setup box paints white (C04 reminder);
   *  absent for every corporation that paints none. */
  whiteMarkerTracks?: ReadonlyArray<number>;
  stats: MarsBotCorpStats;
};

// ─────────────────────────────────────────────────────────────────────────────
// Display view — the client's render feed (mirrors `buildBonusCardView`).
// ─────────────────────────────────────────────────────────────────────────────

/** Kicker labels, EN i18n keys (RB-B anatomy names). */
export const CORP_SECTION_LABEL: Readonly<Record<MarsBotCorpSection['kind'], string>> = {
  draftPriority: 'Draft priority',
  setup: 'Corporation setup',
  effect: 'Corporation effect',
  beforeActionPhase: 'Before action phase',
  roundStart: 'Round start',
};

export type MarsBotCorpView = {
  id: MarsBotCorpId;
  cardNumber: string;
  original: CardName;
  startingTags: ReadonlyArray<Tag>;
  resource?: MarsBotCorpResource;
  sections: ReadonlyArray<MarsBotCorpSection>;
};

export function buildMarsBotCorpView(id: MarsBotCorpId): MarsBotCorpView {
  const info = marsBotCorpInfo(id);
  return {
    id: info.id,
    cardNumber: info.cardNumber,
    original: info.original,
    startingTags: info.startingTags,
    resource: info.resource,
    sections: info.sections,
  };
}
