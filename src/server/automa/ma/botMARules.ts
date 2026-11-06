import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {MilestoneName} from '../../../common/ma/MilestoneName';
import {AwardName} from '../../../common/ma/AwardName';
import {BotAwardRule, BotMilestoneRule, TrackRef} from './BotMARule';

/**
 * THE REGISTRY — MarsBot's rule for every milestone and award, ONE row per name (docs/AUTOMA_DATA_AUDIT.md §22.2 is
 * the same table with the reasoning). `botMAInterpreter.ts` reads it for the value / target, the Corporate
 * Competition helper, the player-facing text, the mat demands and the reachability; nothing else in the engine keys a
 * bot rule by name.
 *
 * Sources: rulebook pp.8–9 (Tharsis) · Adding Expansions (RB-C) p.9 (the map reference cards B09–B13), pp.2–3 (Venus),
 * pp.13–16 (the Awards & Milestones module) · the fork's home rules for the fan maps, docs/AUTOMA_DATA_AUDIT.md
 * §17–§21, each with its official analog.
 */

const BUILDING: TrackRef = {role: 'building'};
const EVENT: TrackRef = {role: 'event'};
const POWER: TrackRef = {role: 'power'};
const EARTH: TrackRef = {role: 'earth'};
const VENUS: TrackRef = {role: 'venus'};
// What a criterion MEANS (decision R10): a tag-counting rule follows the TAG (it moves from mat to mat — RB-C p.8), a
// production-counting rule the printed BADGE; a role only where the original names the row itself.
const BUILDING_TAG: TrackRef = {tag: Tag.BUILDING};
const SPACE_TAG: TrackRef = {tag: Tag.SPACE};
const EVENT_TAG: TrackRef = {tag: Tag.EVENT};
const SCIENCE_TAG: TrackRef = {tag: Tag.SCIENCE};
const POWER_TAG: TrackRef = {tag: Tag.POWER};
const EARTH_TAG: TrackRef = {tag: Tag.EARTH};
const JOVIAN_TAG: TrackRef = {tag: Tag.JOVIAN};
const CITY_TAG: TrackRef = {tag: Tag.CITY};
const PLANT_TAG: TrackRef = {tag: Tag.PLANT};
const ANIMAL_TAG: TrackRef = {tag: Tag.ANIMAL};
const MICROBE_TAG: TrackRef = {tag: Tag.MICROBE};
const VENUS_TAG: TrackRef = {tag: Tag.VENUS};
const STEEL_BADGE: TrackRef = {production: Resource.STEEL};
const TITANIUM_BADGE: TrackRef = {production: Resource.TITANIUM};
const MC_BADGE: TrackRef = {production: Resource.MEGACREDITS};
const ENERGY_BADGE: TrackRef = {production: Resource.ENERGY};
const HEAT_BADGE: TrackRef = {production: Resource.HEAT};
const PLANT_BADGE: TrackRef = {production: Resource.PLANTS};

/** «As usual» — the bot honestly has the player's quantity where the player's milestone looks. */
const asUsualMilestone = (analog: string): BotMilestoneRule =>
  ({criterion: {kind: 'player'}, provenance: {source: 'home', analog}});

export const BOT_MILESTONE_RULES: Partial<Record<MilestoneName, BotMilestoneRule>> = {
  // ── Tharsis (rulebook pp.8–9) ──────────────────────────────────────────────
  'Builder': {criterion: {kind: 'track', track: BUILDING_TAG}, target: 8, provenance: {source: 'RB-A', page: 8}},
  // Space 4 on every track — except Venus (Adding Expansions p.2).
  'Planner': {criterion: {kind: 'tracks', op: 'min', of: 'martian'}, target: 4, provenance: {source: 'RB-A', page: 8}},
  // Real TR, real city / greenery tiles — the player metric (decision R4 for the TR).
  'Terraformer': asUsualMilestone('Tharsis: real TR'),
  'Terraformer29': asUsualMilestone('Tharsis: real TR (decision R4)'),
  'Mayor': asUsualMilestone('Tharsis: real city tiles'),
  'Gardener': asUsualMilestone('Tharsis: real greenery tiles'),
  // ── Hellas (B09) ───────────────────────────────────────────────────────────
  // «At least space 3 on every track» — 7 of 8 with Venus (one track substitutable).
  'Diversifier': {criterion: {kind: 'tracks', op: 'min', of: 'all', drop: 'venus'}, target: 3, provenance: {source: 'B09'}},
  'Tactician': {criterion: {kind: 'megacredits'}, target: 35, provenance: {source: 'B09'}},
  'Energizer': {criterion: {kind: 'track', track: ENERGY_BADGE}, target: 6, provenance: {source: 'B09'}},
  'Rim Settler': {criterion: {kind: 'track', track: JOVIAN_TAG}, target: 6, provenance: {source: 'B09'}},
  'Polar Explorer': {...asUsualMilestone('Hellas: real tiles in the polar rows'), placement: {mode: 'step-before-icons', step: 'polar-region'}},
  // ── Elysium (B10) ──────────────────────────────────────────────────────────
  // «At least space 2 on EVERY track (excl. [V])» — Planner's shape: Venus leaves the set entirely.
  'Generalist': {criterion: {kind: 'tracks', op: 'min', of: 'martian'}, target: 2, provenance: {source: 'B10'}},
  // «Any one track at space 10» — no exclusion printed, the Venus track is a candidate like the rest.
  'Specialist': {criterion: {kind: 'tracks', op: 'max', of: 'all'}, target: 10, provenance: {source: 'B10'}},
  'Ecologist': {criterion: {kind: 'track', track: PLANT_TAG}, target: 4, provenance: {source: 'B10'}},
  // «Unchanged (green/blue cards in MarsBot's played pile)» — the SAME metric as the human's, read in the bot's
  // container; the target is the milestone's own printed threshold, which makes the normalization the identity.
  'Tycoon': {criterion: {kind: 'pile', count: 'greenOrBlue'}, target: 'printed', printedFallback: 15, provenance: {source: 'B10'}},
  'Tycoon10': {criterion: {kind: 'pile', count: 'greenOrBlue'}, target: 'printed', printedFallback: 15, provenance: {source: 'RB-C', page: 14}},
  'Legend': {criterion: {kind: 'pile', count: 'event'}, target: 'printed', printedFallback: 5, provenance: {source: 'B10'}},
  'Legend4': {criterion: {kind: 'pile', count: 'event'}, target: 'printed', printedFallback: 5, provenance: {source: 'RB-C', page: 13}},
  // ── Utopia Planitia (B11) — the fork's canonical names for the board's slots ─
  // «3 or more MarsBot bonus cards are destroyed» — the bot's permanently DESTROYED pile.
  'Land Specialist': {criterion: {kind: 'counter', counter: 'destroyedBonusCards'}, target: 3, provenance: {source: 'B11'}},
  // «All 3 of [Jovian/Energy], [Earth/City], [Venus] at space 2» — the original NAMES the rows: by role.
  'Trader': {criterion: {kind: 'tracks', op: 'min', of: [POWER, EARTH, VENUS]}, target: 2, provenance: {source: 'B11'}},
  'Tradesman': {criterion: {kind: 'tracks', op: 'min', of: [POWER, EARTH, VENUS]}, target: 2,
    randomSetCriterion: {kind: 'tracks', op: 'min', of: [POWER, EARTH, VENUS], missing: 'leave-out'}, provenance: {source: 'B11'}},
  // «[Building] and [Space] combined 7» (the current rulebook; the board aid still prints the pre-errata 5).
  'Metallurgist': {criterion: {kind: 'tracks', op: 'sum', of: [STEEL_BADGE, TITANIUM_BADGE]}, target: 7, provenance: {source: 'B11'}},
  'Smith': {criterion: {kind: 'tracks', op: 'sum', of: [STEEL_BADGE, TITANIUM_BADGE]}, target: 7, provenance: {source: 'B11'}},
  'Researcher': {criterion: {kind: 'track', track: SCIENCE_TAG}, target: 4, provenance: {source: 'B11'}},
  // Real colonies — the bot's id is really on the tile (`AutomaColonies.botBuildColony`).
  'Pioneer': asUsualMilestone('Utopia Planitia: real colonies'),
  'Pioneer4': asUsualMilestone('Utopia Planitia: real colonies (the A&M Pioneer at 4)'),
  // ── Terra Cimmeria Nova (B12) ──────────────────────────────────────────────
  'Planetologist': {criterion: {kind: 'tracks', op: 'sum', of: [EARTH_TAG, VENUS_TAG]}, target: 5, pair: [Tag.JOVIAN, Tag.EARTH],
    provenance: {source: 'B12'}},
  'Architect': {criterion: {kind: 'track', track: CITY_TAG}, target: 6, provenance: {source: 'B12'}},
  'C. Forester': {criterion: {kind: 'track', track: PLANT_BADGE}, target: 10, provenance: {source: 'B12'}},
  'Fundraiser': {criterion: {kind: 'track', track: MC_BADGE}, target: 10, provenance: {source: 'B12'}},
  'Coastguard': asUsualMilestone('Terra Cimmeria Nova: real tiles beside real oceans («As usual», RB-C p.13)'),
  // ── Vastitas Borealis Nova (B13, RB-C p.11) ────────────────────────────────
  'Agronomist': {criterion: {kind: 'track', track: PLANT_TAG}, target: 4, provenance: {source: 'B13'}},
  'V. Spacefarer': {criterion: {kind: 'track', track: SPACE_TAG}, target: 5, provenance: {source: 'B13'}},
  'Engineer': {criterion: {kind: 'tracks', op: 'sum', of: [HEAT_BADGE, ENERGY_BADGE]}, target: 10, provenance: {source: 'B13'}},
  // «EITHER [Microbe/Science] OR [Animal/Plant] at 6» — the further of the two, never their sum.
  'Farmer': {criterion: {kind: 'tracks', op: 'max', of: [MICROBE_TAG, ANIMAL_TAG]}, target: 6, provenance: {source: 'B13'}},
  'Geologist': {...asUsualMilestone('Vastitas Borealis Nova: real tiles on / beside the volcanoes'), placement: {mode: 'icon-bonus', region: 'volcanicOrAdjacent'}},
  // ── Vastitas Borealis, the fan map (§17.2) ─────────────────────────────────
  'V. Electrician': {criterion: {kind: 'track', track: POWER_TAG}, target: 4,
    provenance: {source: 'home', analog: 'Researcher 4 ↔ 4 (B11)', law: 'tags-single'}},
  'Irrigator': asUsualMilestone('the Coastguard class at 4 («As usual», RB-C p.13)'),
  'Capitalist': asUsualMilestone('the bot\'s real M€'),
  // ── Amazonis Planitia, the fan map (§18.2) ─────────────────────────────────
  'Forester': {criterion: {kind: 'track', track: PLANT_BADGE}, target: 6, provenance: {source: 'RB-C', page: 13}},
  'Terran': {criterion: {kind: 'track', track: EARTH_TAG}, target: 6,
    provenance: {source: 'home', analog: 'Terran 5 ↔ space 5 (RB-C p.14), scaled to 6 tags', law: 'tags-single'}},
  // «Have no more than 2 cards in hand» — the bot's hand is its ACTION DECK of the generation; 0 / 1 because the
  // framework reads «met» as value ≥ target and this is the one «at most» criterion.
  'Minimalist': {criterion: {kind: 'counter', counter: 'smallActionDeck'}, target: 1,
    provenance: {source: 'home', analog: 'the action deck as the hand'}},
  'Colonizer': asUsualMilestone('the A&M Pioneer at 4 — real colonies; the cubes are the board\'s colony5 cells'),
  'Tropicalist': {...asUsualMilestone('real tiles in the equatorial rows'), placement: {mode: 'step-before-icons', step: 'equatorial-region'}},
  // ── The OLD (fan) Terra Cimmeria (§19.2) ───────────────────────────────────
  // «3 sets of automated, active and event cards» in the played pile — the weakest colour is the number of sets.
  'T. Collector': {criterion: {kind: 'pile', minOf: ['green', 'blue', 'event']}, target: 'printed', printedFallback: 3,
    provenance: {source: 'home', analog: 'Legend / Tycoon «As usual (… in played pile)»', law: 'pile'}},
  // «Have 20 heat» ↔ the heat-badged track at 8 — Fundraiser's calibration (12 M€ production ↔ space 8, p.13).
  'Firestarter': {criterion: {kind: 'track', track: HEAT_BADGE}, target: 8,
    provenance: {source: 'home', analog: 'Fundraiser 12 ↔ space 8 (RB-C p.13)', law: 'production-badge'}},
  'T. Spacefarer': {criterion: {kind: 'track', track: SPACE_TAG}, target: 6,
    provenance: {source: 'home', analog: 'Spacefarer 4 ↔ space 4 (RB-C p.14)', law: 'tags-single'}},
  'Terra Pioneer': asUsualMilestone('Landlord «As usual» — real tiles on Mars'),
  'Gambler': asUsualMilestone('the awards the bot really funded'),
  // ── Arabia Terra, the fan map (§21.2) ──────────────────────────────────────
  // «5 heat production» ↔ the POWER track at 5: the association the official Thermalist prints (heat ↔ energy).
  'Economizer': {criterion: {kind: 'track', track: ENERGY_BADGE}, target: 5,
    provenance: {source: 'home', analog: 'Thermalist heat ↔ the power track (RB-A); Energizer N ↔ N', law: 'production-badge'}},
  'Martian': {criterion: {kind: 'pile', sum: 'marsTags'}, target: 'printed', printedFallback: 4,
    provenance: {source: 'home', analog: 'Legend / Tycoon «As usual (… in played pile)»', law: 'pile'}},
  // ── The Awards & Milestones module (RB-C pp.13–14) — names no board carries ─
  // «Has 20 MC+, lose 12 MC»: the claim itself costs the 12 (`claimCost`); the row shows M€ like the human's.
  'Briber': {criterion: {kind: 'megacredits'}, target: 20, claimCost: {megacredits: 12}, provenance: {source: 'RB-C', page: 13}},
  'Builder7': {criterion: {kind: 'track', track: BUILDING_TAG}, target: 7, provenance: {source: 'RB-C', page: 13}},
  // «As usual (4 oceans placed) — track MarsBot's oceans separately»: the engine already does — the bot's own placements
  // are attributed to it in `globalParameterSteps` (Government Intervention's, under SOLAR, are not), which is what
  // the milestone reads.
  'Hydrologist': asUsualMilestone('RB-C p.13 «As usual (4 oceans placed)» — the bot\'s own placements, globalParameterSteps'),
  // «Owns 1+ city and 1+ greenery, and reached space 5 on the [building] track» — three parts, the human's own scale.
  'Landshaper': {criterion: {kind: 'allOf', of: [
    {criterion: {kind: 'counter', counter: 'cities'}, target: 1},
    {criterion: {kind: 'counter', counter: 'greeneries'}, target: 1},
    {criterion: {kind: 'track', track: BUILDING_TAG}, target: 5},
  ]}, target: 3, provenance: {source: 'RB-C', page: 13}},
  // «Reached space 2 on every track except [Venus]»; the human row is a 0 / 1 flag, so is the bot's.
  'Merchant': {criterion: {kind: 'tracks', op: 'min', of: 'martian'}, target: 2, display: 'flag', provenance: {source: 'RB-C', page: 13}},
  // «As usual (5 cards with non-negative VP in played pile)» — the milestone's own predicate on the pile.
  'Philantropist': {criterion: {kind: 'pile', count: 'philanthropic'}, target: 'printed', printedFallback: 5, provenance: {source: 'RB-C', page: 13}},
  // «Any three tracks (except [Venus]) combined at 16+».
  'Producer': {criterion: {kind: 'tracks', op: 'sumTop', top: 3, of: 'martian'}, target: 16, provenance: {source: 'RB-C', page: 14}},
  'Spacefarer4': {criterion: {kind: 'track', track: SPACE_TAG}, target: 4, provenance: {source: 'RB-C', page: 14}},
  // «3 cards costing 20 MC or more in MarsBot's played pile, BUT including events».
  'Sponsor': {criterion: {kind: 'pile', count: 'cost20plus'}, target: 'printed', printedFallback: 3, provenance: {source: 'RB-C', page: 14}},
  // «Tactician — Has 30 MC+» (RB-C p.14): the module's Tactician IS the 4-card one — its row stands in the module's
  // list of reduced twins (Builder 7, Spacefarer 4, Terran 5, Legend 4, Tycoon 10), beside Hellas' own 35 for 5 cards.
  // OFFICIAL, never the home «7 M€ a card» (28) it shipped with — the review of 2026-11-06.
  'Tactician4': {criterion: {kind: 'megacredits'}, target: 30, provenance: {source: 'RB-C', page: 14}},
  'Terran5': {criterion: {kind: 'track', track: EARTH_TAG}, target: 5, provenance: {source: 'RB-C', page: 14}},
  // «As usual (increased temperature 5 times) — track MarsBot's increases separately» — Hydrologist's reading.
  'Thawer': asUsualMilestone('RB-C p.14 «As usual (5 temperature raises)» — the bot\'s own raises, globalParameterSteps'),
  // ── Turmoil Redux (home) ───────────────────────────────────────────────────
  // The bot's Agenda marker walks the same track (the sitting's winner step, the chairman) — `agendaOf` reads it.
  'Activist': asUsualMilestone('Redux: the bot\'s own Agenda marker (Parliament.agendaOf)'),
  // DECISION R8: «resources on cards» the bot has no cards for → TOKEN cells on its mat (Hoverlord's floaters, RB-C p.2).
  'Dataminer': {criterion: {kind: 'counter', counter: 'tokens:data'}, target: 7,
    provenance: {source: 'home', analog: 'Hoverlord — 7 floaters off the floater cells (RB-C p.2)'}},
  'Aeronaut': {criterion: {kind: 'counter', counter: 'tokens:fighter'}, target: 4,
    provenance: {source: 'home', analog: 'Hoverlord — floaters off the floater cells (RB-C p.2)'}},
  // ── Venus Next ─────────────────────────────────────────────────────────────
  'Hoverlord': {criterion: {kind: 'counter', counter: 'floaters'}, target: 7, provenance: {source: 'RB-C', page: 2}},
  // ── Ares ───────────────────────────────────────────────────────────────────
  'Networker': asUsualMilestone('Ares: the bot is tallied in aresData like any player'),
  'Purifier': asUsualMilestone('Ares: the hazards the bot really removed (purifierCount)'),
};

/** «As usual» awards — the bot's real board presence, read by the human's own evaluator. */
const asUsualAward = (analog: string, helper: BotAwardRule['helper']): BotAwardRule =>
  ({criterion: {kind: 'player'}, helper, provenance: {source: 'home', analog}});

export const BOT_AWARD_RULES: Partial<Record<AwardName, BotAwardRule>> = {
  // ── Tharsis (rulebook p.9 · B08 helpers, rulebook p.7) ─────────────────────
  'Landlord': {criterion: {kind: 'player'}, helper: {kind: 'greenery'}, provenance: {source: 'RB-A', page: 9}},
  'Banker': {criterion: {kind: 'tracks', op: 'sum', of: [BUILDING, EVENT]},
    helper: {kind: 'advance', track: {pick: 'least', of: [BUILDING, EVENT]}}, provenance: {source: 'RB-A', page: 9}},
  'Scientist': {criterion: {kind: 'track', track: SCIENCE_TAG}, helper: {kind: 'advance', track: SCIENCE_TAG}, provenance: {source: 'RB-A', page: 9}},
  'Thermalist': {criterion: {kind: 'track', track: ENERGY_BADGE, plus: 5}, helper: {kind: 'advance', track: ENERGY_BADGE}, provenance: {source: 'RB-A', page: 9}},
  'Miner': {criterion: {kind: 'track', track: TITANIUM_BADGE, plus: 5}, helper: {kind: 'advance', track: TITANIUM_BADGE}, provenance: {source: 'RB-A', page: 9}},
  // ── Hellas (B09) ───────────────────────────────────────────────────────────
  'Cultivator': {criterion: {kind: 'player'}, helper: {kind: 'greenery'}, provenance: {source: 'B09'}},
  // «Unchanged (green cards in MarsBot's played pile)».
  'Magnate': {criterion: {kind: 'pile', count: 'green'}, helper: {kind: 'reveal', predicate: 'green'}, provenance: {source: 'B09'}},
  'Space Baron': {criterion: {kind: 'track', track: SPACE_TAG}, helper: {kind: 'advance', track: SPACE_TAG}, provenance: {source: 'B09'}},
  'Excentric': {criterion: {kind: 'megacredits', per: 5}, helper: {kind: 'cubeAttack'}, provenance: {source: 'B09'}},
  'Contractor': {criterion: {kind: 'track', track: BUILDING_TAG}, helper: {kind: 'advance', track: BUILDING_TAG}, provenance: {source: 'B09'}},
  // ── Elysium (B10) ──────────────────────────────────────────────────────────
  // «As usual, but MarsBot INCLUDES EVENTS» — the pile, red cards counted, 20 exactly included.
  'Celebrity': {criterion: {kind: 'pile', count: 'cost20plus'}, helper: {kind: 'reveal', predicate: 'cost20plus'}, provenance: {source: 'B10'}},
  'Industrialist': {criterion: {kind: 'track', track: ENERGY_BADGE, plus: 5}, helper: {kind: 'advance', track: ENERGY_BADGE}, provenance: {source: 'B10'}},
  'Desert Settler': {criterion: {kind: 'player'}, helper: {kind: 'greenery', restrict: 'southern'}, provenance: {source: 'B10'}, placement: {mode: 'step-after-icons', step: 'southern-region'}},
  'Estate Dealer': {criterion: {kind: 'player'}, helper: {kind: 'greenery', restrict: 'oceanAdjacent'}, provenance: {source: 'B10'}},
  // «Reduce MarsBot's TR by 15 FOR THE PURPOSE OF THIS AWARD» — evaluation only, the real TR untouched.
  'Benefactor': {criterion: {kind: 'rating', plus: -15}, helper: {kind: 'raiseRating', steps: 2}, provenance: {source: 'B10'}},
  // ── Utopia Planitia (B11) ──────────────────────────────────────────────────
  // The board's «Suburban» slot — real edge tiles; the helper's edge is the award's own predicate.
  'Edgedancer': {criterion: {kind: 'player'}, helper: {kind: 'greenery', restrict: 'edge'}, provenance: {source: 'B11'}, placement: {mode: 'icon-bonus', region: 'edge'}},
  'Investor': {criterion: {kind: 'track', track: EARTH_TAG}, helper: {kind: 'advance', track: EARTH_TAG}, provenance: {source: 'B11'}},
  'Botanist': {criterion: {kind: 'track', track: PLANT_BADGE, plus: -2}, helper: {kind: 'advance', track: PLANT_BADGE}, provenance: {source: 'B11'}},
  'Incorporator': {criterion: {kind: 'pile', count: 'cost10minus'}, helper: {kind: 'reveal', predicate: 'cost10minus'}, provenance: {source: 'B11'}},
  'Metropolist': {criterion: {kind: 'player'}, helper: {kind: 'city'}, provenance: {source: 'B11'}},
  // ── Terra Cimmeria Nova (B12) ──────────────────────────────────────────────
  'Electrician': {criterion: {kind: 'track', track: POWER_TAG}, helper: {kind: 'advance', track: POWER_TAG}, provenance: {source: 'B12'}},
  // «Unchanged» for the bot (its asymmetry is on the HUMAN side — `AutomaMAEvaluation.humanAwardScore`).
  'Founder': {criterion: {kind: 'player'}, helper: {kind: 'city', restrict: 'specialTileAdjacent'}, provenance: {source: 'B12'}, placement: {mode: 'icon-bonus', region: 'specialTileAdjacent'}},
  // «The most-advanced track's space number doubled.»
  'Mogul': {criterion: {kind: 'tracks', op: 'max', of: 'all', times: 2},
    helper: {kind: 'advanceExtreme', which: 'mostMovable'}, provenance: {source: 'B12'}},
  'A. Zoologist': {criterion: {kind: 'track', track: ANIMAL_TAG, plus: 5}, helper: {kind: 'advance', track: ANIMAL_TAG}, provenance: {source: 'B12'}},
  // «Every 7 MC counts as 1 card with requirement»; the helper PAYS 5 M€ and does not cost the card's 5.
  'Forecaster': {criterion: {kind: 'megacredits', per: 7},
    helper: {kind: 'reveal', predicate: 'hasRequirement', gainMegacredits: 5, free: true}, provenance: {source: 'B12'}},
  // ── Vastitas Borealis Nova (B13, RB-C p.11) ────────────────────────────────
  'Traveller': {criterion: {kind: 'tracks', op: 'max', of: [JOVIAN_TAG, EARTH_TAG], plus: 5},
    helper: {kind: 'advance', track: {pick: 'most', of: [JOVIAN_TAG, EARTH_TAG]}}, provenance: {source: 'B13'}},
  'Landscaper': {criterion: {kind: 'player'}, helper: {kind: 'greenery'}, provenance: {source: 'B13'}},
  'Highlander': {criterion: {kind: 'player'}, helper: {kind: 'greenery', restrict: 'notOceanAdjacent'}, provenance: {source: 'B13'}, placement: {mode: 'lower-oceans'}},
  'Promoter': {criterion: {kind: 'track', track: EVENT_TAG}, helper: {kind: 'advance', track: EVENT_TAG}, provenance: {source: 'B13'}},
  // «[Building] OR [Space], whichever is more-advanced» — the further of the two; the helper pushes the further.
  'Blacksmith': {criterion: {kind: 'tracks', op: 'max', of: [STEEL_BADGE, TITANIUM_BADGE]},
    helper: {kind: 'advance', track: {pick: 'most', of: [STEEL_BADGE, TITANIUM_BADGE]}}, provenance: {source: 'B13'}},
  // ── Vastitas Borealis, the fan map (BF1, §17.3 / §17.6) ────────────────────
  // OFFICIAL criterion (RB-C p.15): «Lowest track space (2nd lowest with Venus) doubled»; the helper lifts the floor.
  'Visionary': {criterion: {kind: 'tracks', op: 'min', of: 'all', drop: 'venus', times: 2},
    // «Advance the least advanced track, excluding the Venus track» (RB-C p.16) — the track the criterion drops.
    helper: {kind: 'advanceExtreme', which: 'least', excluding: 'venus'}, provenance: {source: 'RB-C', page: 15}},
  'Naturalist': {criterion: {kind: 'tracks', op: 'sum', of: [PLANT_BADGE, HEAT_BADGE]},
    helper: {kind: 'advance', track: {pick: 'least', of: [HEAT_BADGE, PLANT_BADGE]}},
    provenance: {source: 'home', analog: 'Manufacturer / Banker — the sum of two badge tracks (RB-C p.15)', law: 'production-sum'}},
  // «Most Jovian tags» ↔ HALF the Jovian track (Rim Settler: 3 tags ↔ space 6, a 2:1 ratio).
  'Voyager': {criterion: {kind: 'track', track: JOVIAN_TAG, div: 2}, helper: {kind: 'advance', track: JOVIAN_TAG},
    provenance: {source: 'home', analog: 'Rim Settler 3 tags ↔ space 6 (B09)', law: 'tags-paired'}},
  // ── Amazonis Planitia, the fan map (BF2, §18.3 / §18.6) ────────────────────
  'Curator': {criterion: {kind: 'tracks', op: 'max', of: 'all'}, helper: {kind: 'advanceExtreme', which: 'mostMovable'},
    provenance: {source: 'home', analog: 'Mogul without the doubling (B12)'}},
  'A. Engineer': {criterion: {kind: 'pile', count: 'altersProduction'}, helper: {kind: 'reveal', predicate: 'altersProduction'},
    provenance: {source: 'home', analog: 'Magnate «As usual (… in played pile)» (B09)', law: 'pile'}},
  'Tourist': {...asUsualAward('real tiles and their real empty neighbours', {kind: 'city', restrict: 'allNeighboursEmpty'}), placement: {mode: 'step-after-icons', step: 'empty-neighbours'}},
  // ── The OLD (fan) Terra Cimmeria (BF3, §19.3 / §19.6) ──────────────────────
  'Biologist': {criterion: {kind: 'track', track: PLANT_TAG, plus: 5}, helper: {kind: 'advance', track: PLANT_TAG}, provenance: {source: 'RB-C', page: 14}},
  'Warmonger': {criterion: {kind: 'pile', count: 'warmonger'}, helper: {kind: 'reveal', predicate: 'warmonger'},
    provenance: {source: 'home', analog: 'Magnate «As usual (… in played pile)» (B09)', law: 'pile'}},
  'T. Politician': asUsualAward('the delegates the bot really placed', {kind: 'delegate'}),
  'Urbanist': {...asUsualAward('the VP of greeneries beside its real cities', {kind: 'greenery', restrict: 'ownCityAdjacent'}), placement: {mode: 'step-before-icons', step: 'own-city'}},
  // ── Arabia Terra, the fan map (BF4, §21.3 / §21.6) ─────────────────────────
  'Zoologist': {criterion: {kind: 'track', track: ANIMAL_TAG, plus: 5}, helper: {kind: 'advance', track: ANIMAL_TAG}, provenance: {source: 'RB-C', page: 15}},
  'A. Manufacturer': {criterion: {kind: 'pile', count: 'blue'}, helper: {kind: 'reveal', predicate: 'blue'},
    provenance: {source: 'home', analog: 'Magnate «As usual (blue and green cards in played pile)» (RB-C p.15)', law: 'pile'}},
  // NO HELPER — the official Politician's line (p.16): a reveal-until for a handful of cards would burn the deck.
  'Cosmic Settler': {criterion: {kind: 'pile', count: 'cityOffMars'},
    helper: {kind: 'none', reasonKey: 'Only a card placing a city off Mars raises it — there is no action to take'},
    provenance: {source: 'home', analog: 'Magnate «As usual (… in played pile)»; no helper as Politician (RB-C p.16)', law: 'pile'}},
  // ── The Awards & Milestones module (RB-C pp.14–16) — names no board carries ─
  // «Cards without tags in MarsBot's played pile +2»; helper «reveal until a card without a tag, resolve it, and
  // MarsBot gains (an additional) 5 MC» — the card's 5 M€ is paid as usual, the 5 is gained on top.
  'Administrator': {criterion: {kind: 'pile', count: 'noTags', plus: 2},
    helper: {kind: 'reveal', predicate: 'noTags', gainMegacredits: 5}, provenance: {source: 'RB-C', page: 14}},
  // «Number of tracks that reached space 3»; helper «advance the least advanced track».
  'Collector': {criterion: {kind: 'tracks', op: 'countAtLeast', of: 'all', at: 3},
    helper: {kind: 'advanceExtreme', which: 'least'}, provenance: {source: 'RB-C', page: 14}},
  // «As usual (cities and colonies owned)»; helper «MarsBot places a city tile». (The module's colony cubes are the
  // generator's job — a random-set mat prints them as colony cells.)
  'Constructor': {criterion: {kind: 'player'}, helper: {kind: 'city'}, provenance: {source: 'RB-C', page: 14}},
  // «Sum of [building] and [power] tracks combined» — the original names the two rows (heat ↔ power: Thermalist's
  // association); helper «advance the [building] or [power], whichever is least advanced, building if tied».
  'Manufacturer': {criterion: {kind: 'tracks', op: 'sum', of: [BUILDING, POWER]},
    helper: {kind: 'advance', track: {pick: 'least', of: [BUILDING, POWER]}}, provenance: {source: 'RB-C', page: 15}},
  // «As usual (tiles owned on the edge of the board)»; helper «a greenery on the edge of the map» — the award's OWN
  // edge set (`Suburbian.onEdge`), never a second definition.
  'Suburbian': {criterion: {kind: 'player'}, helper: {kind: 'greenery', restrict: 'suburbianEdge'}, provenance: {source: 'RB-C', page: 15}, placement: {mode: 'icon-bonus', region: 'suburbianEdge'}},
  // ── Turmoil Redux (home) ───────────────────────────────────────────────────
  // The award twin of Activist — the bot's own Agenda marker. No door moves the bot's Agenda on demand (it walks when
  // the bot WINS a sitting), and the framework invents no Parliament mechanic.
  'Influencer': asUsualAward('Redux: the bot\'s own Agenda marker (Parliament.agendaOf)',
    {kind: 'none', reasonKey: 'Its Agenda marker moves only when it wins a sitting — there is no action to take'}),
  // «Cards with a party requirement, events included» — the award's own predicate on the pile; the reveal-until family.
  'Politologist': {criterion: {kind: 'pile', count: 'partyRequirement'}, helper: {kind: 'reveal', predicate: 'partyRequirement'},
    provenance: {source: 'home', analog: 'Celebrity «… in played pile, BUT including events» + its reveal helper (B10)', law: 'pile'}},
  // ── Venus Next: added to ALL versions of the card (Adding Expansions p.3) ──
  'Venuphile': {criterion: {kind: 'track', track: VENUS_TAG}, helper: {kind: 'advance', track: VENUS_TAG}, provenance: {source: 'RB-C', page: 3}},
  // ── Ares ───────────────────────────────────────────────────────────────────
  'Rugged': asUsualAward('Ares: real tiles beside hazards',
    {kind: 'none', reasonKey: 'MarsBot avoids the hazards — there is no action to take'}),
  // DECISION R5 — the ONE honest zero: the bot never owns a tile granting an adjacency bonus, so it scores 0 and has no
  // helper; the row and the card face say so in words.
  'Entrepreneur': {criterion: {kind: 'zero', reasonKey: 'MarsBot owns no tiles granting adjacency bonuses'},
    helper: {kind: 'none', reasonKey: 'MarsBot owns no tiles granting adjacency bonuses — there is no action to take'},
    provenance: {source: 'home', analog: 'the owner\'s decision R5 (2026-11-06): no custom rule'}},
};
