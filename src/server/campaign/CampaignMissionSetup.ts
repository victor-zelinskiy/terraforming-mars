// Campaign mode — the mission-side setup logic, co-located so every campaign
// branch in Game/Player/SelectInitialCards is one predicate call away from
// this file (docs/CAMPAIGN_MODE_ARCHITECTURE.md §6).
//
// Everything here is a no-op for ordinary games: every entry point starts
// from `campaignContractOf(game) === undefined` ⇒ ordinary behavior.

import * as constants from '../../common/constants';
import {CardName} from '../../common/cards/CardName';
import {Resource} from '../../common/Resource';
import {CampaignGameContract, CampaignGrant} from '../game/GameOptions';
import {ICorporationCard, isICorporationCard} from '../cards/corporation/ICorporationCard';
import {IProjectCard} from '../cards/IProjectCard';
import {newCorporationCard, newProjectCard} from '../createCard';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {ProjectDeck} from '../cards/Deck';
import {VictoryPointsBreakdownBuilder} from '../game/VictoryPointsBreakdownBuilder';
import {PlayerInput} from '../PlayerInput';
import {Priority} from '../deferredActions/Priority';
import {SelectCard} from '../inputs/SelectCard';
import {SelectOption} from '../inputs/SelectOption';
import {SelectPaymentDeferred} from '../deferredActions/SelectPaymentDeferred';
import {Merger} from '../cards/promo/Merger';
import {message} from '../logs/MessageBuilder';

export function campaignContractOf(game: IGame): CampaignGameContract | undefined {
  return game.gameOptions.campaign;
}

/** The player's public campaign grant, keyed by the immutable seat index. */
export function campaignGrantFor(player: IPlayer): CampaignGrant | undefined {
  const contract = campaignContractOf(player.game);
  if (contract === undefined || player.campaignSeat === undefined) {
    return undefined;
  }
  return contract.grants.find((g) => g.seat === player.campaignSeat);
}

export function campaignLineageOf(player: IPlayer): ReadonlyArray<CardName> {
  return campaignGrantFor(player)?.corporations ?? [];
}

/**
 * Does this player still CHOOSE a new corporation this mission?
 * Missions 1–3: yes (mission 1 has an empty lineage — the ordinary flow).
 * The final mission: no — the player deploys the accumulated lineage («Штаб»).
 */
export function campaignPicksNewCorporation(player: IPlayer): boolean {
  const contract = campaignContractOf(player.game);
  if (contract === undefined || player.isMarsBot) {
    return false;
  }
  return contract.final !== true;
}

/** True for a human seat of a FINAL campaign mission: no corp step is dealt or shown. */
export function campaignSelectionSkipsCorpStep(player: IPlayer): boolean {
  const contract = campaignContractOf(player.game);
  return contract?.final === true && !player.isMarsBot && campaignGrantFor(player) !== undefined;
}

/**
 * How many corporations this player is expected to end setup with.
 * Ordinary games: 1. Campaign: lineage + (1 when a new corp is picked).
 */
export function expectedCorporationCount(player: IPlayer): number {
  const contract = campaignContractOf(player.game);
  if (contract === undefined || player.isMarsBot) {
    return 1;
  }
  return campaignLineageOf(player).length + (contract.final === true ? 0 : 1);
}

/** Has this player completed the initial-cards selection (campaign-aware)? */
export function initialSelectionDoneOf(player: IPlayer): boolean {
  return player.initialCardSelectionDone === true || player.pickedCorporationCard !== undefined;
}

function playedCorporationNames(player: IPlayer): Set<CardName> {
  return new Set(player.playedCards.filter(isICorporationCard).map((c) => c.name));
}

/**
 * The ordered queue of corporations still to play: unplayed lineage first (in
 * acquisition order), then the freshly picked corporation. Idempotent by
 * construction — a corp already in the tableau (crash mid-sequence + reload)
 * is skipped, so re-running the sequence can never double-play one.
 */
export function campaignCorporationQueue(player: IPlayer): Array<ICorporationCard> {
  const played = playedCorporationNames(player);
  const queue: Array<ICorporationCard> = [];
  for (const name of campaignLineageOf(player)) {
    if (played.has(name)) {
      continue;
    }
    const corp = newCorporationCard(name);
    if (corp === undefined) {
      throw new Error(`Campaign lineage corporation ${name} cannot be instantiated`);
    }
    queue.push(corp);
  }
  const picked = player.pickedCorporationCard;
  if (picked !== undefined && !played.has(picked.name)) {
    queue.push(picked);
  }
  return queue;
}

/** The BASE corporation of this mission: lineage[0] (mission 1: the pick). */
function campaignBaseCorp(player: IPlayer): ICorporationCard | undefined {
  const lineage = campaignLineageOf(player);
  if (lineage.length > 0) {
    const corp = newCorporationCard(lineage[0]);
    if (corp === undefined) {
      throw new Error(`Campaign lineage corporation ${lineage[0]} cannot be instantiated`);
    }
    return corp;
  }
  return player.pickedCorporationCard;
}

/**
 * EVERY additional corporation of this mission, in deployment order:
 * lineage[1..] first (missions 3–4 re-deploy the whole company), then the
 * fresh pick (missions 2–3). EACH merges by its own «Слияние» press and
 * charges the Merger-rule fee — «каждая дополнительная корпорация каждую
 * миссию» (the D4 re-grant logic applies to the fee symmetrically: the
 * starting M€ re-arrive every mission, so the merge is re-executed too).
 */
export function campaignAdditionalCorps(player: IPlayer): Array<ICorporationCard> {
  const lineage = campaignLineageOf(player);
  if (lineage.length === 0) {
    return []; // mission 1: the pick is the base
  }
  const out: Array<ICorporationCard> = [];
  for (const name of lineage.slice(1)) {
    const corp = newCorporationCard(name);
    if (corp === undefined) {
      throw new Error(`Campaign lineage corporation ${name} cannot be instantiated`);
    }
    out.push(corp);
  }
  const picked = player.pickedCorporationCard;
  if (picked !== undefined) {
    out.push(picked);
  }
  return out;
}

/** The NEXT additional corporation still owing its merge press. */
export function campaignMergePending(player: IPlayer): ICorporationCard | undefined {
  const played = playedCorporationNames(player);
  return campaignAdditionalCorps(player).find((c) => !played.has(c.name));
}

/** Merger fees still owed: one per MERGED additional corp, minus those paid. */
export function campaignMergeFeesOwed(player: IPlayer): number {
  const played = playedCorporationNames(player);
  const merged = campaignAdditionalCorps(player).filter((c) => played.has(c.name)).length;
  return Math.max(0, merged - (player.campaignMergeFeesPaid ?? 0));
}

/** The comeback bonus still owed its own press (0 = none / already granted). */
export function campaignBonusPending(player: IPlayer): number {
  if (player.campaignBonusGranted === true) {
    return 0;
  }
  return campaignBonusMegaCredits(player);
}

/**
 * Any campaign deployment stage BEYOND the corp-count discriminator is still
 * owed (bonus / merge fees / legacy) — the recovery discriminators' one
 * campaign term (false for bots and outside campaigns by construction).
 */
export function campaignSetupExtrasOwed(player: IPlayer): boolean {
  if (campaignContractOf(player.game) === undefined || player.isMarsBot || player.campaignSeat === undefined) {
    return false;
  }
  return campaignBonusPending(player) > 0 || campaignMergeFeesOwed(player) > 0 ||
    campaignLegacyPending(player) > 0;
}

/** Carried cards that still owe their «Наследие» press. */
export function campaignLegacyPending(player: IPlayer): number {
  if (player.campaignCarriedGranted === true) {
    return 0;
  }
  return (player.campaignCarriedCards ?? []).length;
}

/**
 * THE CAMPAIGN DEPLOYMENT CHAIN — stage 1 of the corp play press.
 *
 * The deployment is a SEQUENCE of deliberate presses, never one press that
 * silently does everything (the player must SEE what happens in what order).
 * The canonical order:
 *   1. «КОРПОРАЦИЯ» — this press: the BASE corporation plays (lineage[0];
 *      mission 1: the picked corp) and grants its starting resources.
 *   2. «БОНУС КАМПАНИИ» — its own press (`campaignBonus`): the comeback
 *      0/5/10/15 M€ arrive visibly, right after the base's resources.
 *   3. «СЛИЯНИЕ» ×N — one press per ADDITIONAL corporation (lineage[1..]
 *      then the fresh pick), each following the Merger prelude's own rule:
 *      the corporation plays (starting M€ / effects), THEN 42 M€ are paid —
 *      so the new corp's own resources can help pay its merge, exactly as
 *      the original Merger behaves. Missions 3–4 therefore charge the fee
 *      AGAIN for corporation №3.
 *   4. «ОПЛАТА» — the bought starting hand's payment
 *      (Priority.DISCARD_AND_DRAW — the first slot past DEFAULT): the hand
 *      was budgeted against the WHOLE merged stack, so the bill only arrives
 *      once every corporation's capital has assembled and every fee is paid.
 *   5. «НАСЛЕДИЕ» (when cards were carried) — BACK_OF_THE_LINE, free.
 * The ONE research release at the end drains the whole chain in order and
 * completes the barrier only after the last stage is answered.
 */
export function runCampaignDeploymentChain(player: IPlayer, options?: {deferCardPayment?: boolean}): void {
  const base = campaignBaseCorp(player);
  if (base !== undefined && !playedCorporationNames(player).has(base.name)) {
    player.playCorporationCard(base, {
      deferCardPayment: options?.deferCardPayment,
      cardPaymentPriority: Priority.DISCARD_AND_DRAW,
      holdResearchRelease: true,
    });
  }
  // DEFAULT priority, FIFO: bonus → the first merge; each merge press defers
  // the next one at answer time, so a merge's own effects and fee always
  // resolve before the next corporation joins.
  deferCampaignBonus(player);
  player.defer(() => campaignMergeInput(player));
  deferCampaignLegacy(player);
  player.game.playerIsFinishedWithResearchPhase(player);
}

/**
 * «БОНУС КАМПАНИИ» — the deliberate comeback-bonus press (marker
 * `campaignBonus`). Right after the base corporation's own resources; a seat
 * with no bonus has no stage.
 */
export function campaignBonusInput(player: IPlayer): PlayerInput | undefined {
  const amount = campaignBonusPending(player);
  if (amount === 0) {
    return undefined;
  }
  return new SelectOption(
    message('Receive the campaign bonus of ${0} M€', (b) => b.number(amount)),
    'Receive')
    .markStartGamePrompt({kind: 'campaignBonus', bonus: {megaCredits: amount}})
    .andThen(() => {
      grantCampaignBonus(player);
      return undefined;
    });
}

/** Grants the comeback bonus exactly once (serialized flag). */
export function grantCampaignBonus(player: IPlayer): void {
  const amount = campaignBonusPending(player);
  if (amount === 0) {
    return;
  }
  player.stock.add(Resource.MEGACREDITS, amount);
  player.campaignBonusGranted = true;
  player.game.log('${0} received a campaign bonus of ${1} M€', (b) => b.player(player).number(amount));
}

function deferCampaignBonus(player: IPlayer): void {
  if (campaignBonusPending(player) > 0) {
    player.defer(() => campaignBonusInput(player));
  }
}

/**
 * «СЛИЯНИЕ» — the deliberate merge press (marker `corporationMerge`) for the
 * NEXT additional corporation. Idempotent: answered-then-reloaded re-entries
 * find the corp already in the tableau and dissolve into nothing.
 *
 * Each merge follows the MERGER PRELUDE'S OWN RULE, just without the card:
 * play the corporation (gaining its starting M€ / effects), THEN pay 42 M€ —
 * the same `Merger.mergerCost` through the same `SelectPaymentDeferred`, so
 * the fee lands right at this stage AND the merged corp's own capital can
 * pay it (the original Merger's load-bearing ordering). The answer defers
 * the NEXT merge press, so multi-corp missions chain naturally.
 */
export function campaignMergeInput(player: IPlayer): PlayerInput | undefined {
  const next = campaignMergePending(player);
  if (next === undefined) {
    return undefined;
  }
  return new SelectCard<ICorporationCard>(
    'Merge the new corporation', 'Merge', [next], {min: 1, max: 1})
    .markStartGamePrompt({kind: 'corporationMerge'})
    .andThen(() => {
      player.playCorporationCard(next, {holdResearchRelease: true});
      deferMergePayment(player);
      player.defer(() => campaignMergeInput(player));
      return undefined;
    });
}

/** ONE Merger-rule fee — deferred AFTER the merged corp's own effects (both
 *  ride Priority.DEFAULT, in defer order), BEFORE the next merge press (the
 *  answer defers it later in FIFO). The serialized `campaignMergeFeesPaid`
 *  COUNTER is what survives a reload landing between a merge answer and its
 *  payment (the deferred queue itself is never serialized). */
function deferMergePayment(player: IPlayer): void {
  player.game.defer(new SelectPaymentDeferred(player, Merger.mergerCost, {title: 'Select how to pay for Merger'}))
    .andThen(() => {
      player.campaignMergeFeesPaid = (player.campaignMergeFeesPaid ?? 0) + 1;
    });
}

/**
 * «НАСЛЕДИЕ» — the deliberate carried-cards press (marker `campaignLegacy`).
 * Its own deployment stage AFTER the starting-hand purchase: the press grants
 * the cards (free) and their reveal deals them into the hand dock.
 */
export function campaignLegacyInput(player: IPlayer): PlayerInput | undefined {
  const count = campaignLegacyPending(player);
  if (count === 0) {
    return undefined;
  }
  return new SelectOption(
    message('Receive ${0} project cards carried from the previous mission', (b) => b.number(count)),
    'Receive')
    .markStartGamePrompt({kind: 'campaignLegacy', legacy: {cards: count}})
    .andThen(() => {
      grantCarriedProjectCards(player);
      return undefined;
    });
}

function deferCampaignLegacy(player: IPlayer): void {
  if (campaignLegacyPending(player) > 0) {
    // BACK_OF_THE_LINE: the merge press defers the picked corp's own effects
    // at answer time — the legacy stage must come after them, never between.
    player.defer(() => campaignLegacyInput(player), Priority.BACK_OF_THE_LINE);
  }
}

/**
 * Reload recovery: WHICH deployment press is still owed. The deferred chain
 * is not serialized, so a reload mid-deployment reconstructs the next stage
 * from the tableau + the serialized carried/granted state. Undefined = the
 * whole chain is done.
 */
export function campaignSetupResumeInput(player: IPlayer): PlayerInput | undefined {
  const base = campaignBaseCorp(player);
  if (base !== undefined && !playedCorporationNames(player).has(base.name)) {
    return new SelectCard<ICorporationCard>(
      'Play your corporation', 'Play', [base], {min: 1, max: 1})
      .markStartGamePrompt({kind: 'corporationPlay'})
      .andThen(() => {
        runCampaignDeploymentChain(player, {deferCardPayment: true});
        return undefined;
      });
  }
  const bonusAmount = campaignBonusPending(player);
  if (bonusAmount > 0) {
    // Recovery re-enters OUTSIDE a drain — the tail of the chain rides the
    // answer (an input's andThen may only be set once, so the recovery
    // builds its own prompt rather than chaining onto campaignBonusInput).
    return new SelectOption(
      message('Receive the campaign bonus of ${0} M€', (b) => b.number(bonusAmount)),
      'Receive')
      .markStartGamePrompt({kind: 'campaignBonus', bonus: {megaCredits: bonusAmount}})
      .andThen(() => {
        grantCampaignBonus(player);
        player.defer(() => campaignMergeInput(player));
        deferCampaignLegacy(player);
        player.game.playerIsFinishedWithResearchPhase(player);
        return undefined;
      });
  }
  const merge = campaignMergePending(player);
  if (merge !== undefined) {
    return new SelectCard<ICorporationCard>(
      'Merge the new corporation', 'Merge', [merge], {min: 1, max: 1})
      .markStartGamePrompt({kind: 'corporationMerge'})
      .andThen(() => {
        player.playCorporationCard(merge, {holdResearchRelease: true});
        deferMergePayment(player);
        player.defer(() => campaignMergeInput(player));
        deferCampaignLegacy(player);
        player.game.playerIsFinishedWithResearchPhase(player);
        return undefined;
      });
  }
  if (campaignMergeFeesOwed(player) > 0) {
    // Reload landed between a merge answer and its fee (the deferred queue
    // is not serialized). The recovery keeps the merge stage's ONE client
    // shape: the same marked SelectCard on the LAST merged corp — its press
    // now only completes the merge (charges every owed fee through the real
    // payment deferred, then the tail). No corp is replayed.
    const played = playedCorporationNames(player);
    const merged = campaignAdditionalCorps(player).filter((c) => played.has(c.name));
    const subject = merged[merged.length - 1];
    if (subject !== undefined) {
      return new SelectCard<ICorporationCard>(
        'Merge the new corporation', 'Merge', [subject], {min: 1, max: 1})
        .markStartGamePrompt({kind: 'corporationMerge'})
        .andThen(() => {
          for (let i = campaignMergeFeesOwed(player); i > 0; i--) {
            deferMergePayment(player);
          }
          deferCampaignLegacy(player);
          player.game.playerIsFinishedWithResearchPhase(player);
          return undefined;
        });
    }
  }
  const legacyCount = campaignLegacyPending(player);
  if (legacyCount > 0) {
    // Recovery re-enters OUTSIDE a drain — the release rides the answer.
    return new SelectOption(
      message('Receive ${0} project cards carried from the previous mission', (b) => b.number(legacyCount)),
      'Receive')
      .markStartGamePrompt({kind: 'campaignLegacy', legacy: {cards: legacyCount}})
      .andThen(() => {
        grantCarriedProjectCards(player);
        player.game.playerIsFinishedWithResearchPhase(player);
        return undefined;
      });
  }
  return undefined;
}

/**
 * The starting budget the initial-cards affordability check must use for a
 * campaign human: every lineage corporation re-grants its starting M€ (D4),
 * plus the new pick's, plus the one-shot comeback bonus. Card cost stacks the
 * way `playCorporationCardScoped` stacks it (each corp writes its delta).
 */
export function campaignStartingBudget(player: IPlayer, newCorporation: ICorporationCard | undefined): {megaCredits: number, cardCost: number} {
  const grant = campaignGrantFor(player);
  let megaCredits = grant?.bonusMegaCredits ?? 0;
  let cardCost = constants.CARD_COST;
  const corps: Array<ICorporationCard> = [];
  for (const name of campaignLineageOf(player)) {
    const corp = newCorporationCard(name);
    if (corp !== undefined) {
      corps.push(corp);
    }
  }
  if (newCorporation !== undefined) {
    corps.push(newCorporation);
  }
  for (const corp of corps) {
    megaCredits += corp.startingMegaCredits;
    if (corp.cardCost !== undefined) {
      cardCost += corp.cardCost - constants.CARD_COST;
    }
  }
  // EVERY additional corporation merges by the Merger prelude's own rule —
  // «Then pay 42 M€» — EVERY mission (missions 3–4 charge for corp №3 too).
  // The fees participate in affordability, so the hand purchase can never
  // promise money the merge presses will owe.
  if (corps.length > 1) {
    megaCredits -= Merger.mergerCost * (corps.length - 1);
  }
  return {megaCredits, cardCost: Math.max(cardCost, 0)};
}

/**
 * The one-shot comeback bonus (0 when none). Applied by
 * `playCorporationCardScoped` together with the base corporation's starting
 * M€ — before the starting-hand purchase, so it participates in affordability.
 */
export function campaignBonusMegaCredits(player: IPlayer): number {
  return campaignGrantFor(player)?.bonusMegaCredits ?? 0;
}

/**
 * Removes each player's carried project cards from the mission's project deck
 * BEFORE any deal (the reservation of §2.12): the carried instance enters the
 * game only through `grantCarriedProjectCards`, so a second copy can never be
 * dealt, drawn or reshuffled in. Throws loudly when a carried card is not in
 * the deck — launch validation must have caught unavailability earlier.
 */
export function reserveCarriedProjectCards(projectDeck: ProjectDeck, players: ReadonlyArray<IPlayer>): void {
  for (const player of players) {
    for (const name of player.campaignCarriedCards ?? []) {
      const idx = projectDeck.drawPile.findIndex((c) => c.name === name);
      if (idx === -1) {
        throw new Error(`Carried project card ${name} is not available in this mission's project deck`);
      }
      projectDeck.drawPile.splice(idx, 1);
    }
  }
}

/**
 * Grants the carried project cards to the owner's hand, free of charge,
 * exactly once (serialized flag). Called from the base-corporation play,
 * AFTER the starting-hand purchase accounting — the carried cards are never
 * counted into `cardsBought`.
 */
export function grantCarriedProjectCards(player: IPlayer): void {
  const names = player.campaignCarriedCards ?? [];
  if (names.length === 0 || player.campaignCarriedGranted === true) {
    return;
  }
  const cards: Array<IProjectCard> = [];
  for (const name of names) {
    const card = newProjectCard(name);
    if (card === undefined) {
      throw new Error(`Carried project card ${name} cannot be instantiated`);
    }
    cards.push(card);
  }
  player.cardsInHand.push(...cards);
  player.campaignCarriedGranted = true;
  // NO reveal batch: the owner already sees these cards FACE UP in the
  // deployment queue's «НАСЛЕДИЕ» row (the self model carries them from the
  // first frame), and the press flies them into the hand dock exactly like
  // the bought projects — one premium language, minus the payment.
  // Count publicly, names privately — carried card identities are owner-only.
  player.game.log('${0} received ${1} project cards carried from the previous mission', (b) => b.player(player).number(cards.length));
}

/**
 * Campaign «Титулы» as a VP category — FINAL missions only (approved D2/D8).
 * Every seat of a final mission materializes the field (0 included) so the
 * category renders consistently; ordinary games and missions 1–3 never touch
 * it, keeping their wire shape byte-identical.
 */
export function calculateCampaignTitleVictoryPoints(player: IPlayer, builder: VictoryPointsBreakdownBuilder): void {
  const contract = campaignContractOf(player.game);
  if (contract === undefined || contract.final !== true) {
    return;
  }
  const grant = campaignGrantFor(player);
  if (grant === undefined) {
    return;
  }
  builder.setVictoryPoints('titles', 0);
  const details: Array<{title: string, missionSlot: number, points: number}> = [];
  for (const entry of grant.titlePoints) {
    builder.setVictoryPoints('titles', entry.titlePoints);
    details.push({title: entry.title, missionSlot: entry.missionSlot, points: entry.titlePoints});
  }
  if (details.length > 0) {
    builder.setTitleDetails(details);
  }
}
