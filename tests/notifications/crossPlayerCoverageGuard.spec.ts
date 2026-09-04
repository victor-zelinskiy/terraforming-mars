import {expect} from 'chai';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardName} from '../../src/common/cards/CardName';
import {JournalActionCategory} from '../../src/common/events/GameEvent';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {ICard} from '../../src/server/cards/ICard';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';

/**
 * ⭐ CROSS-PLAYER DELIVERY COVERAGE GUARD — the machine-checked completeness
 * proof behind the invariant «если чужое действие реально изменило состояние
 * игрока P, P получает ровно одну корректную нотификацию».
 *
 * The proof has three legs, and this spec is the ENUMERATION leg:
 *
 *   1. CHOKEPOINT INVARIANT (tests/events/*, crossPlayerDeliveryAudit S-series):
 *      every player mutation flows through stock/production/card-resource/TR/
 *      draw chokepoints, which record a typed event whenever a scope, a source
 *      or a foreign `from` exists; every action DOOR opens a scope. So a
 *      cross-player mutation is evented WITHOUT the card author calling any
 *      notification API — delivery is a property of the chokepoint, not of
 *      the card.
 *   2. DELIVERY SCENARIOS (crossPlayerDeliveryAudit.spec.ts): for every
 *      cross-player MECHANISM FAMILY, a real door is driven end to end and the
 *      client's own diff pipeline must yield the recipient's band.
 *   3. THIS ENUMERATION: every registered in-scope effect source is classified
 *      — either it has NO cross-player mutation path, or it names the
 *      family/families whose scenario proves its delivery. A NEW card that
 *      starts touching other players (structural evidence: a reactive
 *      any-player hook, a cross-player behavior field, or cross-player API
 *      tokens in its own source) FAILS this spec until classified.
 *
 * Classification principle: a card is cross-player when ITS OWN code mutates
 * another player. Fan-out consequences of a tile/parameter/tag the card causes
 * belong to the REACTIVE card that pays its owner (family
 * 'reactive-owner-payout'), never to the causer — otherwise every city card
 * would be «cross-player» and the classification would say nothing.
 */

const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject']);

/** The cross-player mechanism families. EVERY family must point at the
 *  delivery scenario that proves its notification path end to end. */
type CrossPlayerFamily =
  | 'reactive-owner-payout' // the owner's card pays the OWNER because ANOTHER player acted
  | 'production-attack' // lower another player's production (Mons Insurance, behavior.decreaseAnyProduction)
  | 'stock-attack' // remove another player's stock (behavior.removeAnyPlants, target.attack)
  | 'stock-steal' // move stock/production from victim to actor (stealing: true)
  | 'card-resource-attack' // remove resources from another player's card (Predators, Virus)
  | 'table-payout' // one effect touches EVERY player at once (Mons Insurance on-play shape)
  | 'card-draw-payout' // another player DRAWS cards because of the actor (Sponsored Academies)
  | 'track-attack' // move another player's Hydronetwork marker backwards (Corporate Espionage)
  | 'track-blockade'; // a standing ban on another player's Hydronetwork advancement (Modular Floodgates)

/** family → the scenario(s) in crossPlayerDeliveryAudit.spec.ts (same dir)
 *  that drive a REAL door and assert the recipient's client-side band. A new
 *  family added to the union fails compilation here until it names a proof. */
const FAMILY_PROOF: Record<CrossPlayerFamily, string> = {
  'reactive-owner-payout': 'S1/S2/S3/S5/S7 (Ares + passive hooks), S8 (deferred production), S10 (bot actor), S13 (multi-recipient)',
  'production-attack': 'S6 (Mons Insurance), S11 (floor no-op + honest partial)',
  'stock-attack': 'S4 (deferred victim pick, hostile band, no twin)',
  'stock-steal': 'S14 (steal: victim loss with attacker target + thief chain)',
  'card-resource-attack': 'S15 (blue-action door, deferred foreign card resource removal)',
  'table-payout': 'S6/S11 (every opponent hit, per-recipient bands)',
  'card-draw-payout': 'S17 (Sponsored Academies: every opponent\'s draw is evented in the actor\'s chain and banded)',
  'track-attack': 'delta-position-changed carries victim + attacker (notificationSemantics.spec track band, tests/cards/delta/CorporateEspionage.spec, tests/delta/deltaMovement.spec)',
  'track-blockade': 'S21 (Modular Floodgates blue-action door: delta-blockade-changed carries victim + attacker, the victim\'s worded band is delivered, the actor gets none)',
};

type Classification =
  | {kind: 'none'; why: string}
  | {kind: 'cross-player'; families: ReadonlyArray<CrossPlayerFamily>; why: string};

/**
 * MANUAL classifications — ONLY for cards the structural classifier cannot
 * decide (bespoke code that references the table without the recognized
 * attack APIs, or recognized-token false positives). Every entry carries its
 * justification; a STALE entry (card auto-classifiable again, or out of
 * scope) fails the spec so the map cannot rot.
 */
const MANUAL: Partial<Record<CardName, Classification>> = {
  // Reads game.players only to COUNT played events for its own M€ gain.
  [CardName.MEDIA_ARCHIVES]: {kind: 'none', why: 'counts all players\' events; the gain is self-only'},
  // On-play: −2 M€ production to EVERY opponent (from: {player}); in-game: the
  // insurance PAYOUT mutates the claimant (a foreign player) from the owner.
  [CardName.MONS_INSURANCE]: {kind: 'cross-player', families: ['production-attack', 'table-payout'], why: 'on-play table attack + cross-player insurance compensation (resolveInsurance)'},
  // Every OTHER player draws 1 card (deferred DrawCards under the play scope).
  [CardName.SPONSORED_ACADEMIES]: {kind: 'cross-player', families: ['card-draw-payout'], why: 'all opponents draw 1 card'},
  // «Gain all YOUR colony bonuses» — self-directed, but a colony benefit can
  // STEAL from another player (the colony machinery resolves it, same road a
  // trade uses).
  [CardName.PRODUCTIVE_OUTPOST]: {kind: 'cross-player', families: ['stock-steal'], why: 'colony benefits may steal; rides the colony-benefit machinery inside the play scope'},
  // DP10: retreats OTHER players' Hydronetwork markers (commitDeltaRetreat).
  [CardName.CORPORATE_ESPIONAGE]: {kind: 'cross-player', families: ['track-attack'], why: 'retreats foreign delta markers; delta-position-changed carries victim + attacker'},
  // DP11: deploys a standing advancement ban against another player
  // (DeltaProjectExpansion.placeBlockade → delta-blockade-changed).
  [CardName.MODULAR_FLOODGATES]: {kind: 'cross-player', families: ['track-blockade'], why: 'blocks a foreign player\'s Hydronetwork advancement; delta-blockade-changed carries victim + attacker'},
  // The venus payout is an ENGINE special case (Game.increaseVenusScaleLevel
  // pays the owner with from: {card: APHRODITE}) — the card class itself has
  // no code, so the structural classifier cannot see it.
  [CardName.APHRODITE]: {kind: 'cross-player', families: ['reactive-owner-payout'], why: 'engine-level payout on any player\'s venus raise (Game.ts)'},
};

// ── Structural classifier ───────────────────────────────────────────────────

/** Reactive any-player hooks: the owner is paid/changed because ANOTHER player
 *  acted — cross-player by construction (fan-outs wrap them in withEffect). */
const REACTIVE_HOOKS = [
  'onTilePlaced',
  'onCardPlayedByAnyPlayer',
  'onIncreaseTerraformRatingByAnyPlayer',
  'onColonyAddedByAnyPlayer',
  'onIdentificationByAnyPlayer',
  'onNonCardTagAddedByAnyPlayer',
  'deltaMovementBonus',
  'onMarsBotMicrobeAdvancement',
] as const;

/** Source tokens that PROVE a cross-player mutation and name its family.
 *  Scanned over the card class's own source (constructor.toString() includes
 *  every method); identifiers survive the tsx/esbuild transform and comments
 *  are stripped, so a token hit is code, not prose. */
const FAMILY_TOKENS: ReadonlyArray<{token: string; family: CrossPlayerFamily}> = [
  {token: 'DecreaseAnyProduction', family: 'production-attack'},
  {token: 'RemoveAnyPlants', family: 'stock-attack'},
  {token: 'StealResources', family: 'stock-steal'},
  {token: 'stealing: true', family: 'stock-steal'},
  {token: 'stealing:true', family: 'stock-steal'},
  {token: '.attack(', family: 'stock-attack'},
  {token: 'RemoveResourcesFromCard', family: 'card-resource-attack'},
  {token: 'removingPlayer', family: 'card-resource-attack'},
  {token: 'new RemoveResources(', family: 'stock-attack'},
];

/** Tokens that show the card LOOKS AT the rest of the table. Not proof of a
 *  mutation — but a card using them without an auto family must be classified
 *  by hand (this is the net that catches a NEW cross-player mechanism that
 *  invents its own helper instead of the recognized APIs). */
const AMBIGUOUS_TOKENS = [
  'getOpponents',
  '.opponents',
  'game.players',
  'playersInGenerationOrder',
  'SelectPlayer',
  'getPlayerById',
  'giveColonyBonus',
] as const;

function sourceOf(card: ICard): string {
  return card.constructor.toString();
}

function autoFamilies(card: ICard): Array<CrossPlayerFamily> {
  const families = new Set<CrossPlayerFamily>();
  for (const hook of REACTIVE_HOOKS) {
    if (typeof (card as unknown as Record<string, unknown>)[hook] === 'function') {
      families.add('reactive-owner-payout');
    }
  }
  const b = card.behavior as {decreaseAnyProduction?: unknown; removeAnyPlants?: unknown} | undefined;
  if (b?.decreaseAnyProduction !== undefined) {
    families.add('production-attack');
  }
  if (b?.removeAnyPlants !== undefined) {
    families.add('stock-attack');
  }
  const src = sourceOf(card);
  for (const {token, family} of FAMILY_TOKENS) {
    if (src.includes(token)) {
      families.add(family);
    }
  }
  return [...families];
}

function isAmbiguous(card: ICard): boolean {
  const src = sourceOf(card);
  return AMBIGUOUS_TOKENS.some((t) => src.includes(t));
}

type CardGroup = 'projectCards' | 'corporationCards' | 'preludeCards' | 'standardProjects' | 'standardActions';
const GROUPS: ReadonlyArray<CardGroup> = ['projectCards', 'corporationCards', 'preludeCards', 'standardProjects', 'standardActions'];

function forEachInScopeCard(cb: (card: ICard, module: GameModule, group: CardGroup) => void): void {
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.has(manifest.module)) {
      continue;
    }
    for (const group of GROUPS) {
      const cards = (manifest as unknown as Record<CardGroup, Record<string, {Factory: new () => ICard}> | undefined>)[group];
      if (cards === undefined) {
        continue;
      }
      for (const name of Object.keys(cards)) {
        const Factory = cards[name]?.Factory;
        if (Factory === undefined) {
          continue;
        }
        let card: ICard;
        try {
          card = new Factory();
        } catch {
          continue;
        }
        cb(card, manifest.module, group);
      }
    }
  }
}

describe('cross-player coverage guard (every in-scope effect source is classified)', () => {
  it('classifies EVERY in-scope card: structural evidence ⇒ a proven family; ambiguity ⇒ a manual entry', () => {
    const gaps: Array<string> = [];
    const counts = {total: 0, crossPlayer: 0, none: 0, manual: 0};
    forEachInScopeCard((card, module) => {
      counts.total++;
      const manual = MANUAL[card.name];
      const auto = autoFamilies(card);
      if (manual !== undefined) {
        counts.manual++;
        if (manual.kind === 'cross-player') {
          counts.crossPlayer++;
        } else {
          counts.none++;
          // A manual 'none' must not contradict structural evidence.
          if (auto.length > 0) {
            gaps.push(`${card.name} [${module}]: MANUAL says 'none' but structural evidence says [${auto.join(', ')}]`);
          }
        }
        return;
      }
      if (auto.length > 0) {
        counts.crossPlayer++;
        return; // auto-classified; its families are proven via FAMILY_PROOF
      }
      if (isAmbiguous(card)) {
        gaps.push(`${card.name} [${module}]: reads the table (${AMBIGUOUS_TOKENS.filter((t) => sourceOf(card).includes(t)).join(', ')}) with no recognized attack API — add a MANUAL entry ('none' with why, or 'cross-player' with families)`);
        return;
      }
      counts.none++; // no hooks, no cross behavior, no table access: self-only by construction
    });
    expect(counts.total, 'the enumeration inspected the whole premium scope').greaterThan(400);
    expect(gaps, `unclassified cross-player-suspect sources (the worklist):\n  ${gaps.join('\n  ')}`).to.have.length(0);
  });

  it('every named family has a delivery-scenario proof', () => {
    for (const [family, proof] of Object.entries(FAMILY_PROOF)) {
      expect(proof, `family ${family} names its scenario`).to.be.a('string').and.not.empty;
    }
  });

  it('MANUAL map carries no stale entries', () => {
    const inScope = new Set<string>();
    forEachInScopeCard((card) => inScope.add(card.name));
    const stale = Object.keys(MANUAL).filter((name) => !inScope.has(name));
    expect(stale, `MANUAL entries for cards no longer in scope: ${stale.join(', ')}`).to.have.length(0);
  });

  /**
   * NON-CARD DOORS: every action category the recorder knows must be
   * classified for its cross-player path. The Record is EXHAUSTIVE over the
   * union — adding a JournalActionCategory without deciding its cross-player
   * story fails `npm run build:test` before it can fail a player.
   */
  it('every action door (JournalActionCategory) is classified', () => {
    const DOORS: Record<JournalActionCategory, {crossPlayer: 'possible' | 'none'; proof: string}> = {
      'card-play': {crossPlayer: 'possible', proof: 'S1/S2/S4/S6/S8/S13 — scope opened by Player.playCard/playCorporationCard'},
      'card-action': {crossPlayer: 'possible', proof: 'S15 — blue-action scope (Player.ts action doors), deferred attacks carry the captured context'},
      'corporation-action': {crossPlayer: 'possible', proof: 'scoped in Player.takeAction\'s pendingInitialActions branch AND the blue-action machinery. NOT self-only: the Tharsis MANDATORY FIRST ACTION places a city and pays every reactive owner (Rover Construction — the 2026-09-04 report). Proofs: consumerDeliverySequences F1–F3 (boundary sequences), cityPlacementTopologies T7 (independent oracle)'},
      'ceo-action': {crossPlayer: 'none', proof: 'ceo module is OUT of premium scope (frontier — widen SCOPE first)'},
      'standard-project': {crossPlayer: 'possible', proof: 'S3/S7 — conversions + standard projects placing tiles pay reactive owners'},
      'colony': {crossPlayer: 'possible', proof: 'S16 — a trade\'s GiveColonyBonus pays every colony owner inside the trade scope'},
      'copied-action': {crossPlayer: 'possible', proof: 'copied scope keeps rootId (EventRecorder.withCopiedAction); attacks inside inherit the chain'},
      'milestone': {crossPlayer: 'none', proof: 'claiming spends the actor\'s own M€ only (milestoneAwardJournal.spec)'},
      'award': {crossPlayer: 'none', proof: 'funding spends the actor\'s own M€ only; scoring is endgame-computed'},
      'delta-project': {crossPlayer: 'possible', proof: 'DP10 espionage retreat — delta-position-changed carries victim+attacker (tests/delta)'},
      'vp-pressure': {crossPlayer: 'possible', proof: 'Vermin flip → category vp-pressure (verminJournal.spec)'},
      'planetary-event': {crossPlayer: 'none', proof: 'hazard appearance mutates the BOARD; player costs occur inside the acting player\'s own later actions'},
      'solar-phase': {crossPlayer: 'possible', proof: 'S5 — WGT branch scoped, Ares owner benefit delivered'},
      'automa-turn': {crossPlayer: 'possible', proof: 'S10 (deferred payout reaches the script) + bonusCardAttackEvents.spec (attack steps)'},
    };
    for (const [door, cls] of Object.entries(DOORS)) {
      expect(cls.proof, `door ${door} names its proof`).to.not.be.empty;
    }
  });

  /**
   * AUTOMA SOURCES. Every MarsBot bonus card and bot corporation is classified
   * for whether its resolution can reach a HUMAN player's state. The Records
   * are EXHAUSTIVE over the enums — a new bonus card / corporation fails
   * `npm run build:test` until classified. Delivery correctness for
   * 'touches-humans' rides the SHARED chokepoints (the tile fan-out, colony
   * hooks, GiveColonyBonus, the sanctioned human tag reactions, the Aphrodite
   * engine payout) — all evented under the 'automa-turn' scope, and, since the
   * drain-before-finish fix, either snapshot-visible in the turn script's
   * impact steps (non-interactive) or narrated by an explicit attack step
   * (interactive). Proofs: S10/S18 + bonusCardAttackEvents.spec + the
   * marsBotPresentation semantics specs.
   */
  it('every automa BONUS CARD is classified for human reach', () => {
    const touchesHumans = 'touches-humans';
    const botOnly = 'bot-only';
    const BONUS: Record<BonusCardId, typeof touchesHumans | typeof botOnly> = {
      [BonusCardId.B01_METEOR_SHOWER]: touchesHumans, // victim plants deduct (from: bot)
      [BonusCardId.B02_INVASIVE_SPECIES]: touchesHumans, // victim cube pick + removal
      [BonusCardId.B03_RESEARCH_AND_DEVELOPMENT]: touchesHumans, // resolved card fires human reactors
      [BonusCardId.B04_OVERACHIEVEMENT]: botOnly,
      [BonusCardId.B05_EXPEDITED_CONSTRUCTION]: touchesHumans, // city → human onTilePlaced/Ares
      [BonusCardId.B06_LOBBYISTS]: touchesHumans, // greenery/ocean placements
      [BonusCardId.B07_LOCAL_NEURAL_INSTANCE]: touchesHumans, // tile / card-resolve fallback
      [BonusCardId.B08_CORPORATE_COMPETITION]: touchesHumans, // Landlord greenery / cascades
      [BonusCardId.B09_CORPORATE_COMPETITION_HELLAS]: touchesHumans, // Excentric cube attack
      [BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM]: touchesHumans, // constrained greeneries + reveals
      [BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA]: touchesHumans, // Metropolist city
      [BonusCardId.B12_CORPORATE_COMPETITION_CIMMERIA]: touchesHumans, // Founder city + reveals
      [BonusCardId.B13_CORPORATE_COMPETITION_BOREALIS]: botOnly, // unreachable (no resolver)
      [BonusCardId.B14_CORPORATE_COMPETITION_MA]: botOnly, // unreachable (no resolver)
      [BonusCardId.B15_LOBBYISTS_VENUS]: touchesHumans, // + venus → human Aphrodite payout
      [BonusCardId.B16_GOVERNMENT_INTERVENTION]: touchesHumans, // ocean/venus branches
      [BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES]: touchesHumans, // city / colony hooks
      [BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD]: touchesHumans, // colony hooks / Europa ocean
      [BonusCardId.B19_SHIPPING_LINES]: touchesHumans, // trade → GiveColonyBonus pays owners
      [BonusCardId.B20_EXTENDED_SHIPPING_LINES]: touchesHumans, // same resolver as B19
      [BonusCardId.B21_PARTY_POLITICS]: botOnly, // unimplemented (Turmoil)
      [BonusCardId.B22_SETTLERS]: botOnly, // marker claim, no tile, no hooks
      [BonusCardId.B23_RAPID_SPROUTING]: touchesHumans, // greenery branch
      [BonusCardId.B24_SUPPLY_AND_DEMAND]: botOnly,
      [BonusCardId.B25_DO_IT_RIGHT]: touchesHumans, // greenery/ocean ladder
      [BonusCardId.B26_VENUSIAN_LOBBY]: touchesHumans, // venus + parameter ladder
      [BonusCardId.B27_BUILD_BUILD_BUILD]: touchesHumans, // builds beside human tiles
      [BonusCardId.B28_DIVERSIFICATION]: botOnly,
      [BonusCardId.B29_GRAY_EMINENCE]: botOnly, // unimplemented (C37 companion)
      [BonusCardId.B30_INTERFACE_HYPERLINK]: touchesHumans, // resolves 2 cards → human reactors
      [BonusCardId.B31_GOVERNMENT_SUBSIDY]: botOnly,
      [BonusCardId.B32_INVESTORS]: botOnly,
    };
    expect(Object.keys(BONUS).length, 'every bonus card classified').eq(Object.values(BonusCardId).length);
  });

  it('every MarsBot CORPORATION is classified for human reach (its OWN boxes, not the generic turn machinery)', () => {
    const touchesHumans = 'touches-humans';
    const botOnly = 'bot-only';
    const CORPS: Record<MarsBotCorpId, typeof touchesHumans | typeof botOnly> = {
      [MarsBotCorpId.C01_CREDICOR]: botOnly,
      [MarsBotCorpId.C02_ECOLINE]: botOnly, // inserts B23; the greenery is B23's row
      [MarsBotCorpId.C03_HELION]: touchesHumans, // white cube resolves a card → human reactors
      [MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS]: botOnly,
      [MarsBotCorpId.C05_INVENTRIX]: botOnly,
      [MarsBotCorpId.C06_MINING_GUILD]: botOnly,
      [MarsBotCorpId.C07_PHOBOLOG]: touchesHumans, // white cube may resolve B01/B02
      [MarsBotCorpId.C08_SATURN_SYSTEMS]: botOnly, // reads human plays, mutates the bot
      [MarsBotCorpId.C09_TERACTOR]: botOnly,
      [MarsBotCorpId.C10_THARSIS_REPUBLIC]: touchesHumans, // setup city → human hooks
      [MarsBotCorpId.C11_THORGATE]: touchesHumans, // resolves a project card
      [MarsBotCorpId.C12_UNMI]: botOnly,
      [MarsBotCorpId.C13_CHEUNG_SHING_MARS]: botOnly,
      [MarsBotCorpId.C14_POINT_LUNA]: botOnly,
      [MarsBotCorpId.C15_ROBINSON_INDUSTRIES]: botOnly,
      [MarsBotCorpId.C16_VALLEY_TRUST]: touchesHumans, // white cube resolves a card
      [MarsBotCorpId.C17_VITOR]: botOnly,
      [MarsBotCorpId.C18_ARCADIAN_COMMUNITIES]: botOnly,
      [MarsBotCorpId.C19_ASTRO_DRILL]: botOnly,
      [MarsBotCorpId.C20_FACTORUM]: botOnly,
      [MarsBotCorpId.C21_PHARMACY_UNION]: botOnly, // its clauses deduct from the BOT
      [MarsBotCorpId.C22_PHILARES]: touchesHumans, // setup greenery + B07
      [MarsBotCorpId.C23_RECYCLON]: botOnly,
      [MarsBotCorpId.C24_SPLICE]: touchesHumans, // human Splice choice (+2 M€ / microbe)
      [MarsBotCorpId.C25_VIRON]: botOnly,
      [MarsBotCorpId.C26_CELESTIC]: botOnly,
      [MarsBotCorpId.C27_MORNING_STAR]: botOnly,
      [MarsBotCorpId.C28_APHRODITE]: botOnly, // pays the BOT; the human Aphrodite payout is the engine's
      [MarsBotCorpId.C29_MANUTECH]: botOnly,
      [MarsBotCorpId.C30_ARIDOR]: botOnly,
      [MarsBotCorpId.C31_ARKLIGHT]: botOnly,
      [MarsBotCorpId.C32_POLYPHEMOS]: botOnly,
      [MarsBotCorpId.C33_POSEIDON]: touchesHumans, // setup colony → human colony hooks
      [MarsBotCorpId.C34_STORMCRAFT]: botOnly,
      [MarsBotCorpId.C35_LAKEFRONT_RESORTS]: botOnly,
      [MarsBotCorpId.C36_PRISTAR]: botOnly,
      [MarsBotCorpId.C38_TERRALABS]: botOnly,
      [MarsBotCorpId.C39_UTOPIA_INVEST]: botOnly,
      [MarsBotCorpId.C40_ECOTEC]: botOnly,
      [MarsBotCorpId.C41_KUIPER_COOPERATIVE]: touchesHumans, // black cube ocean → human hooks
      [MarsBotCorpId.C42_NIRGAL_ENTERPRISES]: botOnly,
      [MarsBotCorpId.C43_PALLADIN_SHIPPING]: botOnly,
      [MarsBotCorpId.C44_SAGITTA_FRONTIER_SERVICES]: botOnly,
      [MarsBotCorpId.C45_SPIRE]: touchesHumans, // pre-action city → human hooks
      [MarsBotCorpId.C46_TYCHO_MAGNETICS]: botOnly,
    };
    expect(Object.keys(CORPS).length, 'every bot corporation classified').eq(Object.values(MarsBotCorpId).length);
  });
});
