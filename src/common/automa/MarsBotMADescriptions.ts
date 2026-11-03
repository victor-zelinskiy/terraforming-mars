import {MilestoneName} from '../ma/MilestoneName';
import {AwardName} from '../ma/AwardName';

/** MarsBot-specific descriptions for how milestones are evaluated. */
export const MARSBOT_MILESTONE_DESCRIPTIONS: Partial<Record<MilestoneName, string>> = {
  // Tharsis
  'Terraformer': 'TR \u2265 35',
  'Mayor': '3+ city tiles on board',
  'Gardener': '3+ greenery tiles on board',
  'Builder': 'Building track \u2265 8',
  'Planner': 'All tracks \u2265 4 (except Venus)',
  // Hellas
  'Diversifier': 'All tracks \u2265 3 (7 of 8 with Venus)',
  'Tactician': '35+ MC',
  'Energizer': 'Energy track \u2265 6',
  'Polar Explorer': '3+ tiles on the two bottom rows',
  'Rim Settler': 'Jovian + Science track \u2265 6',
  // Elysium (the fork ships Tycoon10 on this board, not the classic 15-card Tycoon)
  'Generalist': 'All tracks \u2265 2 (except Venus)',
  'Specialist': 'Any track \u2265 10 (Venus included)',
  'Ecologist': 'Bio track \u2265 4',
  'Tycoon10': '10 green/blue cards in played pile',
  'Tycoon': '15 green/blue cards in played pile',
  'Legend': '5 red cards in played pile',
  // Utopia Planitia (the fork's canonical names for the board's slots:
  // Specialist → Land Specialist, Trader → Tradesman, Metallurgist → Smith)
  'Land Specialist': '3+ bonus cards destroyed',
  // Tradesman and Smith also stand on the fan-made Vastitas Borealis, whose
  // pairs differ — the rule is by ROLE (power / earth / venus), so the words are.
  'Tradesman': 'Power, Earth and Venus tracks all \u2265 2',
  'Smith': 'Building + Space tracks combined \u2265 7',
  'Pioneer': '3+ colonies (unchanged)',
  // Terra Cimmeria — the board the Automa material means is TERRA_CIMMERIA_NOVA
  // (Coast Guard → Coastguard, Forester → C. Forester, Financier → Fundraiser)
  'Planetologist': 'Jovian/Earth + Venus tracks combined \u2265 5',
  'Architect': 'City/Science track \u2265 6',
  'Coastguard': 'Tiles adjacent to ocean (unchanged)',
  'C. Forester': 'Bio track \u2265 10',
  'Fundraiser': 'Event track \u2265 10',
  // Vastitas Borealis \u2014 the official board is VASTITAS_BOREALIS_NOVA (RB-C p.11)
  'Agronomist': 'Animal/Plant track \u2265 4',
  'V. Spacefarer': 'Space track \u2265 5',
  'Geologist': 'Tiles on or next to volcanic areas (unchanged)',
  'Engineer': 'Jovian/Earth + City/Energy tracks combined \u2265 10',
  'Farmer': 'Microbe/Science OR Animal/Plant track \u2265 6',
  // Vastitas Borealis, the fan map (the fork's own rules — docs/AUTOMA_DATA_AUDIT.md §17.2)
  'V. Electrician': 'Power track \u2265 4',
  'Irrigator': 'Tiles adjacent to oceans (unchanged)',
  'Capitalist': '64 M\u20ac (unchanged)',
  // Amazonis Planitia, the fan map (docs/AUTOMA_DATA_AUDIT.md §18.2)
  'Colonizer': '4 colonies (unchanged) \u2014 three colony cells on the board',
  // (Forester — the modular entry below, «Bio track ≥ 6» — is this board's official rule too)
  'Minimalist': 'At most 2 cards left in the action deck',
  'Terran': 'Earth track \u2265 6',
  'Tropicalist': 'Tiles in the equatorial rows (unchanged)',
  // The OLD (fan) Terra Cimmeria (docs/AUTOMA_DATA_AUDIT.md §19.2)
  'T. Collector': 'Sets of green, blue and red cards in the played pile (unchanged)',
  'Firestarter': 'Earth (heat) track ≥ 8',
  'Terra Pioneer': 'Tiles owned on Mars (unchanged)',
  'T. Spacefarer': 'Space track ≥ 6',
  'Gambler': 'Awards it funded (unchanged)',
  // Modular
  'Briber': '20+ MC (loses 12 MC on claim)',
  'Builder7': 'Building track \u2265 7',
  'Forester': 'Bio track \u2265 6',
  'Hydrologist': '4 oceans placed',
  'Landshaper': '1+ city, 1+ greenery, Building track \u2265 5',
  'Legend4': '4 red cards in played pile',
  'Merchant': 'All tracks \u2265 2 (except Venus)',
  'Metallurgist': 'Building + Space tracks \u2265 9',
  'Philantropist': '5 cards with non-negative VP',
  'Producer': 'Any 3 tracks (except Venus) \u2265 16',
  'Researcher': 'Science track \u2265 4',
  'Spacefarer4': 'Space track \u2265 4',
  'Tactician4': '30+ MC',
  'Terran5': 'Earth track \u2265 5',
  'Thawer': 'Raised temperature 5+ times',
};

/** MarsBot-specific descriptions for how awards are scored. */
export const MARSBOT_AWARD_DESCRIPTIONS: Partial<Record<AwardName, string>> = {
  // Tharsis
  'Landlord': 'Total tiles on board',
  'Banker': 'Building + Event track',
  'Scientist': 'Science track',
  'Thermalist': 'Energy track + 5',
  'Miner': 'Space track + 5',
  // Hellas
  'Cultivator': 'Greenery owned (unchanged)',
  'Magnate': 'Green cards in played pile',
  'Space Baron': 'Space track',
  'Excentric': 'Every 5 MC = 1 resource',
  'Contractor': 'Building track',
  // Elysium
  'Celebrity': 'Cards costing 20+ MC (including events)',
  'Industrialist': 'Energy track + 5',
  'Desert Settler': 'Tiles on the four bottom rows (unchanged)',
  'Estate Dealer': 'Tiles adjacent to an ocean (unchanged)',
  'Benefactor': 'TR minus 15',
  // Terra Cimmeria
  'Electrician': 'Energy track',
  'Founder': 'Tiles next to special tiles (the Neural Instance counts for MarsBot only)',
  'Mogul': 'Most-advanced track \u00d7 2',
  'A. Zoologist': 'Bio track + 5',
  'Forecaster': 'Every 7 MC = 1 card with requirement',
  // Utopia Planitia
  'Edgedancer': 'Tiles on the board edge (unchanged)',
  'Investor': 'Earth/City track',
  'Botanist': 'Bio track minus 2',
  'Metropolist': 'Cities owned (unchanged)',
  'Incorporator': 'Cards costing 10 MC or less (including events)',
  // Vastitas Borealis — the official board is VASTITAS_BOREALIS_NOVA (RB-C p.11)
  'Traveller': 'Jovian/Earth track + 5',
  'Landscaper': 'Largest group of connected tiles (unchanged)',
  'Highlander': 'Tiles not next to an ocean (unchanged)',
  'Promoter': 'Event track',
  'Blacksmith': 'Building OR Space track (higher)',
  // Vastitas Borealis, the fan map (docs/AUTOMA_DATA_AUDIT.md §17.3) — Forecaster
  // and Edgedancer as above
  'Naturalist': 'Plant track + Earth (heat) track',
  'Voyager': 'Half the Jovian track',
  // Amazonis Planitia, the fan map (docs/AUTOMA_DATA_AUDIT.md §18.3) — Promoter and A. Zoologist as above
  'Curator': 'Most-advanced track',
  'A. Engineer': 'Production cards in the played pile',
  'Tourist': 'Empty areas beside its tiles (unchanged)',
  // The OLD (fan) Terra Cimmeria (docs/AUTOMA_DATA_AUDIT.md §19.3) — Incorporator as above
  'Biologist': 'Bio track + 5',
  'T. Politician': 'Delegates it placed (unchanged)',
  'Urbanist': 'VP of greeneries beside its cities (unchanged)',
  'Warmonger': 'Attack cards in the played pile',
  'Manufacturer': 'Building + Energy track',
  // Modular
  'Administrator': 'Cards without tags in played pile + 2',
  'Collector': 'Tracks at space 3+',
  'Politician': 'Always 5',
  'Visionary': 'Lowest track \u00d7 2 (2nd lowest with Venus)',
};
