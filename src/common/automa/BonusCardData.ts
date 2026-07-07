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
    text: 'The Hellas-map version of Corporate Competition.',
  },
  [BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM]: {
    name: 'Corporate Competition (Elysium)',
    text: 'The Elysium-map version of Corporate Competition.',
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
  [BonusCardId.B22_SETTLERS]: {name: 'Settlers', text: 'A corporation-specific bonus card (outside the POC scope).'},
  [BonusCardId.B23_RAPID_SPROUTING]: {name: 'Rapid Sprouting', text: 'A corporation-specific bonus card (outside the POC scope).'},
  [BonusCardId.B24_SUPPLY_AND_DEMAND]: {name: 'Supply and Demand', text: 'A corporation-specific bonus card (outside the POC scope).'},
  [BonusCardId.B25_DO_IT_RIGHT]: {name: 'Do It Right', text: 'A corporation-specific bonus card (outside the POC scope).'},
  [BonusCardId.B26_VENUSIAN_LOBBY]: {name: 'Venusian Lobby', text: 'A corporation-specific bonus card (outside the POC scope).'},
  [BonusCardId.B27_BUILD_BUILD_BUILD]: {name: 'Build Build Build', text: 'A corporation-specific bonus card (outside the POC scope).'},
  [BonusCardId.B28_DIVERSIFICATION]: {name: 'Diversification', text: 'A corporation-specific bonus card (outside the POC scope).'},
  [BonusCardId.B29_GRAY_EMINENCE]: {name: 'Gray Eminence', text: 'A corporation-specific bonus card (outside the POC scope).'},
  [BonusCardId.B30_INTERFACE_HYPERLINK]: {name: 'Interface Hyperlink', text: 'A corporation-specific bonus card (outside the POC scope).'},
  [BonusCardId.B31_GOVERNMENT_SUBSIDY]: {name: 'Government Subsidy', text: 'A corporation-specific bonus card (outside the POC scope).'},
  [BonusCardId.B32_INVESTORS]: {name: 'Investors', text: 'A corporation-specific bonus card (outside the POC scope).'},
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
        {icon: 'megacredits', text: 'Then it pays ${0} M€', params: ['5']},
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
  default:
    return {
      name,
      lines: [{text: bonusCardInfo(id).text}],
      fate: FATE_DISCARD,
    };
  }
}
