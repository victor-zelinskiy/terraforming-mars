import {BonusCardId} from './AutomaTypes';

/**
 * Display data for the MarsBot bonus cards — the printed, PUBLIC card faces
 * (rulebook + Adding Expansions). Names and rule summaries are English i18n
 * source strings; the client translates them. The POC ships the base set +
 * the Venus Next / Colonies replacements; the rest of the enum (map-specific
 * Corporate Competition, Turmoil, corp-specific) is listed for completeness
 * so a future module widening never shows a bare id.
 */
export type BonusCardInfo = {
  name: string;
  /** One-sentence rule summary (English i18n source). */
  text: string;
};

export const BONUS_CARD_INFO: Readonly<Record<BonusCardId, BonusCardInfo>> = {
  [BonusCardId.B01_METEOR_SHOWER]: {
    name: 'Meteor Shower',
    text: 'You lose up to 5 plants. If it removed 3 or more (or your plants were protected), the card is destroyed.',
  },
  [BonusCardId.B02_INVASIVE_SPECIES]: {
    name: 'Invasive Species',
    text: 'MarsBot gains 5 M€ (2 M€ and a floater with Venus or Colonies), and you remove the highest-scoring resource cube from one of your cards.',
  },
  [BonusCardId.B03_RESEARCH_AND_DEVELOPMENT]: {
    name: 'Research and Development',
    text: 'MarsBot draws and resolves the top card of the project deck.',
  },
  [BonusCardId.B04_OVERACHIEVEMENT]: {
    name: 'Overachievement',
    text: 'MarsBot claims a milestone for free (from generation 6 it may fund an award instead). If it succeeds, the card is destroyed; otherwise it gains 5 M€.',
  },
  [BonusCardId.B05_EXPEDITED_CONSTRUCTION]: {
    name: 'Expedited Construction',
    text: 'MarsBot places a city adjacent to at least 2 greeneries or oceans. If it succeeds, the card is destroyed.',
  },
  [BonusCardId.B06_LOBBYISTS]: {
    name: 'Lobbyists',
    text: 'MarsBot performs the first possible: raise the temperature near a bonus, place a greenery near an oxygen bonus, place an ocean next to 2 oceans, or advance the furthest Martian parameter.',
  },
  [BonusCardId.B07_LOCAL_NEURAL_INSTANCE]: {
    name: 'Local Neural Instance',
    text: 'MarsBot places the Neural Instance tile away from the edge with all neighbors empty. At game end it scores 1 VP per adjacent space you do not occupy.',
  },
  [BonusCardId.B08_CORPORATE_COMPETITION]: {
    name: 'Corporate Competition',
    text: 'With 5+ M€, MarsBot pushes the award race it is closest to being ahead on, then loses 5 M€.',
  },
  [BonusCardId.B09_CORPORATE_COMPETITION_HELLAS]: {
    name: 'Corporate Competition (Hellas)',
    text: 'With 5+ M€, MarsBot pushes the Hellas award race it is closest to being ahead on, then loses 5 M€.',
  },
  [BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM]: {
    name: 'Corporate Competition (Elysium)',
    text: 'With 5+ M€, MarsBot pushes the Elysium award race it is closest to being ahead on, then loses 5 M€.',
  },
  [BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA]: {
    name: 'Corporate Competition (Utopia Planitia)',
    text: 'The Utopia Planitia version of Corporate Competition.',
  },
  [BonusCardId.B12_CORPORATE_COMPETITION_CIMMERIA]: {
    name: 'Corporate Competition (Terra Cimmeria)',
    text: 'The Terra Cimmeria version of Corporate Competition.',
  },
  [BonusCardId.B13_CORPORATE_COMPETITION_BOREALIS]: {
    name: 'Corporate Competition (Vastitas Borealis)',
    text: 'The Vastitas Borealis version of Corporate Competition.',
  },
  [BonusCardId.B14_CORPORATE_COMPETITION_MA]: {
    name: 'Corporate Competition (Milestones & Awards)',
    text: 'The Milestones & Awards module version of Corporate Competition.',
  },
  [BonusCardId.B15_LOBBYISTS_VENUS]: {
    name: 'Lobbyists (Venus)',
    text: 'As Lobbyists, but the third option raises Venus toward its next bonus instead of placing an ocean (the card is not destroyed for it).',
  },
  [BonusCardId.B16_GOVERNMENT_INTERVENTION]: {
    name: 'Government Intervention',
    text: 'World Government Terraforming: MarsBot advances the furthest Martian parameter (Venus on even generations or when a parameter is complete) with no TR or bonuses. Returns to the action deck every generation.',
  },
  [BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES]: {
    name: 'Expedited Construction (Colonies)',
    text: 'MarsBot places a city adjacent to at least 2 greeneries or oceans (destroyed on success); with at most 1 colony it builds a colony instead.',
  },
  [BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD]: {
    name: 'Outer System Foothold',
    text: 'MarsBot builds a colony and adds 2 resources to that storage area, then thins its bonus deck by discarding the top card unresolved.',
  },
  [BonusCardId.B19_SHIPPING_LINES]: {
    name: 'Shipping Lines',
    text: 'MarsBot trades with the colony whose tracker is furthest along. Recurs into the action deck from generation 2.',
  },
  [BonusCardId.B20_EXTENDED_SHIPPING_LINES]: {
    name: 'Extended Shipping Lines',
    text: 'A second Shipping Lines — joins the action deck once MarsBot unlocks its second trade fleet.',
  },
  [BonusCardId.B21_PARTY_POLITICS]: {
    name: 'Party Politics',
    text: 'The Turmoil bonus card (outside the POC scope).',
  },
  [BonusCardId.B22_SETTLERS]: {name: 'Settlers', text: 'Arcadian Communities: MarsBot claims a non-reserved area with one of its player markers, preferring the space beside the most ocean-reserved ones. Recurs into the action deck every generation.'},
  [BonusCardId.B23_RAPID_SPROUTING]: {name: 'Rapid Sprouting', text: 'Ecoline: a plant grows on the corporation card, or the grown plant becomes a greenery raising oxygen 1 step. Recurs into the action deck every generation.'},
  [BonusCardId.B24_SUPPLY_AND_DEMAND]: {name: 'Supply and Demand', text: 'Factorum: MarsBot takes 3 M€ off the Factorum card, or everything left on it; an empty card advances the power track instead. Recurs into the action deck every generation.'},
  [BonusCardId.B25_DO_IT_RIGHT]: {name: 'Do It Right', text: 'Inventrix: MarsBot pushes the first global parameter that is 1-2 steps from a bonus, or places an ocean next to 2 oceans — otherwise nothing. Recurs into the action deck every generation.'},
  [BonusCardId.B26_VENUSIAN_LOBBY]: {name: 'Venusian Lobby', text: 'Morning Star Inc.: MarsBot raises Venus and advances its Venus track, then pushes whichever Martian parameter is furthest from done.'},
  [BonusCardId.B27_BUILD_BUILD_BUILD]: {name: 'Build Build Build', text: 'Philares: MarsBot builds a city beside one of the opponent\'s greeneries, or a special tile from its played pile beside one of their cities — paying M€ either way; otherwise it takes 3 M€ and goes back into the bonus deck.'},
  [BonusCardId.B28_DIVERSIFICATION]: {name: 'Diversification', text: 'Robinson Industries: MarsBot advances its least-advanced track, then loses 4 M€ if it can afford it. Recurs into the action deck every generation.'},
  [BonusCardId.B29_GRAY_EMINENCE]: {name: 'Gray Eminence', text: 'A corporation-specific bonus card (outside the POC scope).'},
  [BonusCardId.B30_INTERFACE_HYPERLINK]: {name: 'Interface Hyperlink', text: 'Tycho Magnetics: MarsBot draws as many project cards as its space on the power track (at least 2), plays the best 2 of them and discards the rest. Destroyed afterwards.'},
  [BonusCardId.B31_GOVERNMENT_SUBSIDY]: {name: 'Government Subsidy', text: 'UNMI: MarsBot raises its TR 1 step.'},
  [BonusCardId.B32_INVESTORS]: {name: 'Investors', text: 'Utopia Invest: on an even generation MarsBot advances its weakest track and pulls its strongest one back; otherwise it gains M€ equal to the space number of its weakest track. Recurs into the action deck every generation.'},
};

export function bonusCardInfo(id: BonusCardId): BonusCardInfo {
  return BONUS_CARD_INFO[id] ?? {name: id, text: ''};
}

// ─────────────────────────────────────────────────────────────────────────────
// Contextual card VIEW — what the card DOES in THIS game.
//
// The printed faces describe every expansion variant ("2 M€ and a floater with
// Venus or Colonies…"); the UI must never make the player resolve that
// themselves. `buildBonusCardView(id, ctx)` returns the ALREADY-RESOLVED
// structure for the current option set: icon-anchored effect lines + the
// card's FATE (destroyed / discarded / recurring), each honest about its
// condition. Texts are English i18n templates (translate with params).
// Wording is future-proof for multi-human games: "MarsBot's opponent", never
// a bare "you".
// ─────────────────────────────────────────────────────────────────────────────

/** The option subset that changes what a bonus card actually does. */
export type BonusCardContext = {
  venus: boolean;
  colonies: boolean;
};

/**
 * One icon-anchored effect line. `icon` is the shared icon-key vocabulary
 * (standard resources / global params / card resources) plus the MarsBot
 * extras the face renderer resolves itself: 'city' | 'greenery' | 'tile' |
 * 'milestone' | 'award' | 'vp' | 'cards' | 'tr' | 'deck' | 'colony' | 'trade'.
 */
export type BonusCardEffectLine = {
  icon?: string;
  /** English i18n template; params substituted after translation. */
  text: string;
  params?: ReadonlyArray<string>;
  /** A secondary, quieter clarification line. */
  muted?: boolean;
};

/** What happens to the card after it resolves — the player-facing FATE. */
export type BonusCardFate = {
  kind: 'discard' | 'destroyOnSuccess' | 'alwaysDestroy' | 'recurring' | 'conditional';
  /** English i18n template explaining the fate honestly (incl. the else-branch). */
  text: string;
  params?: ReadonlyArray<string>;
};

export type BonusCardView = {
  name: string;
  lines: ReadonlyArray<BonusCardEffectLine>;
  fate: BonusCardFate;
};

const FATE_DISCARD: BonusCardFate = {kind: 'discard', text: 'Then it goes to the bonus discard and may return after a reshuffle'};

export function buildBonusCardView(id: BonusCardId, ctx: BonusCardContext): BonusCardView {
  const name = bonusCardInfo(id).name;
  switch (id) {
  case BonusCardId.B01_METEOR_SHOWER:
    return {
      name,
      lines: [
        {icon: 'plants', text: 'MarsBot\'s opponent loses up to ${0} plants', params: ['5']},
      ],
      fate: {kind: 'conditional', text: 'Destroyed if it removed 3+ plants or they were protected; discarded otherwise'},
    };
  case BonusCardId.B02_INVASIVE_SPECIES:
    return {
      name,
      lines: ctx.venus || ctx.colonies ? [
        {icon: 'megacredits', text: 'MarsBot gains ${0} M€', params: ['2']},
        {icon: 'floater', text: 'MarsBot gains 1 floater'},
        {icon: 'animal', text: 'The opponent removes their most valuable animal or microbe', muted: false},
      ] : [
        {icon: 'megacredits', text: 'MarsBot gains ${0} M€', params: ['5']},
        {icon: 'animal', text: 'The opponent removes their most valuable animal or microbe'},
      ],
      fate: FATE_DISCARD,
    };
  case BonusCardId.B03_RESEARCH_AND_DEVELOPMENT:
    return {
      name,
      lines: [{icon: 'cards', text: 'MarsBot draws the top project card and resolves it like a normal turn'}],
      fate: FATE_DISCARD,
    };
  case BonusCardId.B04_OVERACHIEVEMENT:
    return {
      name,
      lines: [
        {icon: 'milestone', text: 'MarsBot claims a milestone for free'},
        {icon: 'award', text: 'From generation 6 it may fund an award instead', muted: true},
        {icon: 'megacredits', text: 'If neither is possible, it gains ${0} M€ instead', params: ['5'], muted: true},
      ],
      fate: {kind: 'destroyOnSuccess', text: 'Destroyed if it claimed or funded; discarded otherwise'},
    };
  case BonusCardId.B05_EXPEDITED_CONSTRUCTION:
    return {
      name,
      lines: [{icon: 'city', text: 'MarsBot places a city adjacent to at least 2 greeneries or oceans'}],
      fate: {kind: 'destroyOnSuccess', text: 'Destroyed if the city was placed; discarded if no legal space exists'},
    };
  case BonusCardId.B06_LOBBYISTS:
  case BonusCardId.B15_LOBBYISTS_VENUS:
    return {
      name,
      lines: [
        {text: 'MarsBot performs the FIRST possible option:'},
        {icon: 'temperature', text: 'Raise the temperature toward a bonus step (within 2 steps)'},
        {icon: 'greenery', text: 'Place a greenery when within 2 steps of an oxygen bonus'},
        id === BonusCardId.B15_LOBBYISTS_VENUS ?
          {icon: 'venus', text: 'Raise Venus toward its next bonus (within 2 steps)'} :
          {icon: 'ocean', text: 'Place an ocean next to at least 2 oceans'},
        {icon: 'tr', text: 'Otherwise: advance the furthest Martian parameter', muted: true},
      ],
      fate: id === BonusCardId.B15_LOBBYISTS_VENUS ?
        {kind: 'conditional', text: 'Destroyed after options 1–2; the Venus option and the fallback discard it'} :
        {kind: 'conditional', text: 'Destroyed after options 1–3; the fallback discards it'},
    };
  case BonusCardId.B07_LOCAL_NEURAL_INSTANCE:
    return {
      name,
      lines: [
        {icon: 'neural', text: 'MarsBot places the Neural Instance tile away from the map edge, all neighbors empty'},
        {icon: 'vp', text: 'At game end it scores 1 VP per adjacent space its opponent does not occupy'},
        {icon: 'cards', text: 'If no legal space exists, it draws and resolves a project card instead', muted: true},
      ],
      fate: {kind: 'alwaysDestroy', text: 'Destroyed after resolving — it never returns'},
    };
  case BonusCardId.B08_CORPORATE_COMPETITION:
    return {
      name,
      lines: [
        {icon: 'award', text: 'With 5+ M€: MarsBot pushes the award race it is closest to leading'},
        {icon: 'tile', text: 'Landlord places a greenery; Banker, Scientist, Thermalist and Miner advance a track', muted: true},
        ...(ctx.venus ? [{icon: 'venus', text: 'Venuphile advances the Venus track', muted: true}] : []),
        {icon: 'megacredits', text: 'Then it pays ${0} M€', params: ['5']},
        {icon: 'deck', text: 'With no funded award it can help, it draws another bonus card instead', muted: true},
      ],
      fate: FATE_DISCARD,
    };
  case BonusCardId.B09_CORPORATE_COMPETITION_HELLAS:
    // The Hellas face (Adding Expansions p.12): same card, its own helper list.
    return {
      name,
      lines: [
        {icon: 'award', text: 'With 5+ M€: MarsBot pushes the award race it is closest to leading'},
        {icon: 'greenery', text: 'Cultivator places a greenery and raises oxygen 1 step', muted: true},
        {icon: 'cards', text: 'Magnate reveals project cards until a green one and resolves it', muted: true},
        {icon: 'tile', text: 'Space Baron advances the space track; Contractor the building track', muted: true},
        {icon: 'animal', text: 'Excentric makes the opponent lose their most valuable animal or microbe', muted: true},
        ...(ctx.venus ? [{icon: 'venus', text: 'Venuphile advances the Venus track', muted: true}] : []),
        {icon: 'megacredits', text: 'Then it pays ${0} M€', params: ['5']},
        {icon: 'deck', text: 'With no funded award it can help, it draws another bonus card instead', muted: true},
      ],
      fate: FATE_DISCARD,
    };
  case BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM:
    // The Elysium face (B10): same card, its own helper list. The two greenery
    // helpers are CONSTRAINED — a helper with no legal space is impossible,
    // and the card moves on to the next funded award instead of placing
    // somewhere the constraint forbids.
    return {
      name,
      lines: [
        {icon: 'award', text: 'With 5+ M€: MarsBot pushes the award race it is closest to leading'},
        {icon: 'cards', text: 'Celebrity reveals project cards until one costs 20+ M€ and resolves it', muted: true},
        {icon: 'energy', text: 'Industrialist advances the power track', muted: true},
        {icon: 'greenery', text: 'Desert Settler places a greenery in the southern region and raises oxygen 1 step', muted: true},
        {icon: 'greenery', text: 'Estate Dealer places a greenery adjacent to an ocean and raises oxygen 1 step', muted: true},
        {icon: 'tr', text: 'Benefactor raises the MarsBot TR 2 steps', muted: true},
        ...(ctx.venus ? [{icon: 'venus', text: 'Venuphile advances the Venus track', muted: true}] : []),
        {icon: 'megacredits', text: 'Then it pays ${0} M€', params: ['5']},
        {icon: 'deck', text: 'With no funded award it can help, it draws another bonus card instead', muted: true},
      ],
      fate: FATE_DISCARD,
    };
  case BonusCardId.B16_GOVERNMENT_INTERVENTION:
    return {
      name,
      lines: [
        {icon: 'tr', text: 'World government terraforming: advances the furthest Martian parameter'},
        {icon: 'venus', text: 'On even generations (or when a parameter is complete) it raises Venus instead'},
        {text: 'No TR, no placement bonuses — the parameter simply moves', muted: true},
      ],
      fate: {kind: 'recurring', text: 'Returns to the action deck every generation'},
    };
  case BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES:
    return {
      name,
      lines: [
        {icon: 'city', text: 'MarsBot places a city adjacent to at least 2 greeneries or oceans'},
        {icon: 'colony', text: 'With at most 1 colony it builds a colony instead', muted: true},
      ],
      fate: {kind: 'destroyOnSuccess', text: 'Destroyed if the city was placed; building a colony discards it'},
    };
  case BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD:
    return {
      name,
      lines: [
        {icon: 'colony', text: 'MarsBot builds a colony and adds 2 resources to that storage area'},
        {icon: 'deck', text: 'Then it thins the bonus deck: the top card is discarded unresolved', muted: true},
      ],
      fate: FATE_DISCARD,
    };
  case BonusCardId.B19_SHIPPING_LINES:
  case BonusCardId.B20_EXTENDED_SHIPPING_LINES:
    return {
      name,
      lines: [
        {icon: 'trade', text: 'MarsBot trades with the colony whose tracker is furthest along'},
        id === BonusCardId.B20_EXTENDED_SHIPPING_LINES ?
          {text: 'Joins the deck once MarsBot unlocks its second trade fleet', muted: true} :
          {text: 'Joins the deck from generation 2', muted: true},
      ],
      fate: {kind: 'recurring', text: 'Returns to the action deck every generation'},
    };
  case BonusCardId.B25_DO_IT_RIGHT:
    // Inventrix's corporation-specific card (official B25): Lobbyists' own
    // a/b/c ladder, without the self-destruction and with a dead fallback.
    return {
      name,
      lines: [
        {text: 'MarsBot performs the FIRST possible option:'},
        {icon: 'temperature', text: 'Raise the temperature toward a bonus step (within 2 steps)'},
        {icon: 'greenery', text: 'Place a greenery when within 2 steps of an oxygen bonus'},
        {icon: 'ocean', text: 'Place an ocean next to at least 2 oceans'},
        {text: 'Otherwise: no effect', muted: true},
      ],
      fate: {kind: 'recurring', text: 'At the beginning of every generation it is shuffled back into MarsBot\'s action deck'},
    };
  case BonusCardId.B30_INTERFACE_HYPERLINK:
    // Tycho Magnetics' corporation-specific card (official B30). The DRAW is
    // the bot's own space on the power track, which is exactly what that
    // corporation's draft priority spends the whole game raising — so the
    // card's size is a fact about the mat, not a number the player can read
    // off the face.
    return {
      name,
      lines: [
        {icon: 'cards', text: 'MarsBot draws as many project cards as its space on the power track (at least ${0})', params: ['2']},
        {icon: 'cards', text: 'It keeps ${0}: a science tag first, then the most expensive, then the most tags, then at random', params: ['2']},
        {icon: 'deck', text: 'The kept cards are played as usual; the rest go to the project discard', muted: true},
      ],
      fate: {kind: 'alwaysDestroy', text: 'Destroyed after resolving — it never returns'},
    };
  case BonusCardId.B31_GOVERNMENT_SUBSIDY:
    // UNMI's corporation-specific card (official B31): one printed line.
    return {
      name,
      lines: [
        {icon: 'tr', text: 'MarsBot raises its TR ${0} step', params: ['1']},
      ],
      fate: FATE_DISCARD,
    };
  case BonusCardId.B32_INVESTORS:
    // Utopia Invest's corporation-specific card (official B32). Which half
    // resolves is decided by the GENERATION, so both are stated — the player
    // must be able to read next generation's move off this card too.
    return {
      name,
      lines: [
        {icon: 'cards', text: 'Even generation: MarsBot advances its least-advanced track (the topmost if tied)'},
        {icon: 'cards', text: 'and pulls its most-advanced track (the topmost if tied) back one space'},
        {icon: 'megacredits', text: 'Odd generation instead: it gains M€ equal to the space number its least-advanced track stands on'},
      ],
      fate: {kind: 'recurring', text: 'At the beginning of every generation it is shuffled back into MarsBot\'s action deck'},
    };
  case BonusCardId.B28_DIVERSIFICATION:
    // Robinson Industries' corporation-specific card (official B28). The two
    // printed sentences are INDEPENDENT: the advance always happens, the
    // payment only when the bot can cover it in full.
    return {
      name,
      lines: [
        {icon: 'cards', text: 'MarsBot advances its least-advanced track (the topmost if tied)'},
        {icon: 'megacredits', text: 'Then it loses ${0} M€ — only when it has that much', params: ['4']},
      ],
      fate: {kind: 'recurring', text: 'At the beginning of every generation it is shuffled back into MarsBot\'s action deck'},
    };
  case BonusCardId.B22_SETTLERS:
    // Arcadian Communities' corporation-specific card (official B22).
    return {
      name,
      lines: [
        {icon: 'tile', text: 'MarsBot claims a non-reserved area with one of its player markers'},
        {icon: 'ocean', text: 'Tied areas: the one beside the most ocean-reserved spaces wins, before the card flip'},
        {icon: 'megacredits', text: 'Only MarsBot may build there — and doing so pays it ${0} M€', params: ['3'], muted: true},
      ],
      fate: {kind: 'recurring', text: 'At the beginning of every generation it is shuffled back into MarsBot\'s action deck'},
    };
  case BonusCardId.B24_SUPPLY_AND_DEMAND:
    // Factorum's corporation-specific card (official B24). The take is
    // PARTIAL («or as much as possible»), and the fallback needs a take of
    // exactly zero — which is why both lines are stated, not just the first.
    return {
      name,
      lines: [
        {icon: 'megacredits', text: 'MarsBot takes ${0} M€ off the Factorum card — or everything left on it', params: ['3']},
        {icon: 'energy', text: 'Only if the card was completely empty: the power track advances instead'},
      ],
      fate: {kind: 'recurring', text: 'At the beginning of every generation it is shuffled back into MarsBot\'s action deck'},
    };
  case BonusCardId.B27_BUILD_BUILD_BUILD:
    // Philares' corporation-specific card (official B27): an a/b/c ladder that
    // deliberately builds AGAINST the opponent's tiles — every branch that
    // lands creates a new border, which is what the corporation feeds on.
    return {
      name,
      lines: [
        {text: 'MarsBot performs the FIRST possible option:'},
        {icon: 'city', text: 'Place a city next to one of the opponent\'s greeneries, then pay ${0} M€', params: ['5']},
        {icon: 'tile', text: 'Place a special tile from its played pile next to one of their cities — that card is destroyed and it pays ${0} M€', params: ['3']},
        {icon: 'megacredits', text: 'Otherwise: MarsBot gains ${0} M€', params: ['3'], muted: true},
      ],
      fate: {kind: 'conditional', text: 'Options 1–2 discard it; the fallback shuffles it back into the bonus deck'},
    };
  case BonusCardId.B26_VENUSIAN_LOBBY:
    // Morning Star Inc.'s corporation-specific card (official B26). Two
    // sentences, both unconditional: Venus first (the corporation's own
    // planet, and its track is where its cubes wait), then Mars.
    return {
      name,
      lines: [
        {icon: 'venus', text: 'MarsBot raises Venus ${0} step and advances its Venus track', params: ['1']},
        {icon: 'temperature', text: 'Then it pushes whichever Martian parameter is furthest from done — oxygen, an ocean, or the temperature'},
      ],
      fate: {kind: 'discard', text: 'It goes to the discard afterwards'},
    };
  case BonusCardId.B23_RAPID_SPROUTING:
    // Ecoline's corporation-specific card (official B23).
    return {
      name,
      lines: [
        {icon: 'plants', text: 'No plant on the Ecoline corporation card: a plant grows there'},
        {icon: 'greenery', text: 'A plant is there: remove it — MarsBot places a greenery, raising oxygen 1 step'},
      ],
      fate: {kind: 'recurring', text: 'At the beginning of every generation it is shuffled back into MarsBot\'s action deck'},
    };
  default:
    return {
      name,
      lines: [{text: bonusCardInfo(id).text}],
      fate: FATE_DISCARD,
    };
  }
}
