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
