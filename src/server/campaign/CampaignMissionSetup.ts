// Campaign mode — the mission-side setup logic, co-located so every campaign
// branch in Game/Player/SelectInitialCards is one predicate call away from
// this file (docs/CAMPAIGN_MODE_ARCHITECTURE.md §6).
//
// Everything here is a no-op for ordinary games: every entry point starts
// from `campaignContractOf(game) === undefined` ⇒ ordinary behavior.

import * as constants from '../../common/constants';
import {CardName} from '../../common/cards/CardName';
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

/** The still-unplayed LINEAGE part of the queue (the established company). */
function unplayedLineage(player: IPlayer): Array<ICorporationCard> {
  const played = playedCorporationNames(player);
  const out: Array<ICorporationCard> = [];
  for (const name of campaignLineageOf(player)) {
    if (played.has(name)) {
      continue;
    }
    const corp = newCorporationCard(name);
    if (corp === undefined) {
      throw new Error(`Campaign lineage corporation ${name} cannot be instantiated`);
    }
    out.push(corp);
  }
  return out;
}

/** The freshly PICKED corporation, when it still owes its merge press. */
export function campaignMergePending(player: IPlayer): ICorporationCard | undefined {
  const picked = player.pickedCorporationCard;
  if (picked === undefined || playedCorporationNames(player).has(picked.name)) {
    return undefined;
  }
  // Mission 1 has no lineage: the pick IS the base — no merge stage exists.
  return campaignLineageOf(player).length > 0 ? picked : undefined;
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
 * silently does everything (the player must SEE what happens in what order):
 *   1. «КОРПОРАЦИЯ» — this press: the established company deploys (the whole
 *      lineage, base first; mission 1: the picked corp IS the base). The base
 *      buys the starting hand; its payment is its own deferred beat.
 *   2. «СЛИЯНИЕ» (missions 2–3) — a deferred prompt of its own
 *      (`corporationMerge`): the NEW corporation is played ON TOP, its
 *      starting M€ / effects applying at THAT press.
 *   3. «НАСЛЕДИЕ» (when cards were carried) — a deferred prompt of its own
 *      (`campaignLegacy`), queued BACK_OF_THE_LINE so the merge's own effects
 *      resolve first: the carried cards join the hand and deal to the dock.
 * The ONE research release at the end drains the whole chain in order and
 * completes the barrier only after the last stage is answered.
 */
export function runCampaignDeploymentChain(player: IPlayer, options?: {deferCardPayment?: boolean}): void {
  const lineage = unplayedLineage(player);
  for (const corp of lineage) {
    const isBase = player.playedCards.filter(isICorporationCard).length === 0;
    player.playCorporationCard(corp, {
      deferCardPayment: isBase ? options?.deferCardPayment : false,
      holdResearchRelease: true,
    });
  }
  const picked = player.pickedCorporationCard;
  if (picked !== undefined && !playedCorporationNames(player).has(picked.name)) {
    if (campaignLineageOf(player).length === 0) {
      // Mission 1: the pick IS the base — the ordinary single-corp deployment.
      player.playCorporationCard(picked, {
        deferCardPayment: options?.deferCardPayment,
        holdResearchRelease: true,
      });
    } else {
      player.defer(() => campaignMergeInput(player));
    }
  }
  deferCampaignLegacy(player);
  player.game.playerIsFinishedWithResearchPhase(player);
}

/**
 * «СЛИЯНИЕ» — the deliberate merge press (marker `corporationMerge`).
 * Idempotent: answered-then-reloaded re-entries find the pick already in the
 * tableau and dissolve into nothing.
 *
 * The merge follows the MERGER PRELUDE'S OWN RULE, just without the card:
 * play the corporation (gaining its starting M€ / effects), THEN pay 42 M€ —
 * the same `Merger.mergerCost` through the same `SelectPaymentDeferred`, so
 * the fee is its own visible payment press right at this stage. Affordability
 * is guaranteed by the selection-time budget (`campaignStartingBudget`
 * subtracts the fee before the hand purchase is allowed).
 */
export function campaignMergeInput(player: IPlayer): PlayerInput | undefined {
  const picked = campaignMergePending(player);
  if (picked === undefined) {
    return undefined;
  }
  return new SelectCard<ICorporationCard>(
    'Merge the new corporation', 'Merge', [picked], {min: 1, max: 1})
    .markStartGamePrompt({kind: 'corporationMerge'})
    .andThen(() => {
      player.playCorporationCard(picked, {holdResearchRelease: true});
      deferMergePayment(player);
      return undefined;
    });
}

/** The Merger-rule fee — deferred AFTER the merged corp's own effects (both
 *  ride Priority.DEFAULT, in defer order), BEFORE the legacy stage (which
 *  sits at BACK_OF_THE_LINE). The serialized `campaignMergeFeePaid` flag is
 *  what survives a reload landing between the merge answer and the payment
 *  (the deferred queue itself is never serialized). */
function deferMergePayment(player: IPlayer): void {
  player.game.defer(new SelectPaymentDeferred(player, Merger.mergerCost, {title: 'Select how to pay for Merger'}))
    .andThen(() => {
      player.campaignMergeFeePaid = true;
    });
}

/** The merge fee is still owed: the pick is merged, the 42 M€ are not paid. */
export function campaignMergeFeePending(player: IPlayer): boolean {
  const picked = player.pickedCorporationCard;
  return picked !== undefined && campaignLineageOf(player).length > 0 &&
    playedCorporationNames(player).has(picked.name) &&
    player.campaignMergeFeePaid !== true;
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
  const lineage = unplayedLineage(player);
  const picked = player.pickedCorporationCard;
  const baseOwed = lineage.length > 0 ||
    (picked !== undefined && campaignLineageOf(player).length === 0 && !playedCorporationNames(player).has(picked.name));
  if (baseOwed) {
    const subject = lineage[0] ?? picked;
    if (subject === undefined) {
      return undefined;
    }
    return new SelectCard<ICorporationCard>(
      'Play your corporation', 'Play', [subject], {min: 1, max: 1})
      .markStartGamePrompt({kind: 'corporationPlay'})
      .andThen(() => {
        runCampaignDeploymentChain(player, {deferCardPayment: true});
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
        deferCampaignLegacy(player);
        player.game.playerIsFinishedWithResearchPhase(player);
        return undefined;
      });
  }
  if (campaignMergeFeePending(player)) {
    // Reload landed between the merge answer and its fee (the deferred queue
    // is not serialized). The recovery keeps the merge stage's ONE client
    // shape: the same marked SelectCard — its press now only completes the
    // merge (charges the fee through the real payment deferred, then the
    // tail of the chain). The corp is NOT replayed (already on the tableau).
    const merged = player.pickedCorporationCard;
    if (merged !== undefined) {
      return new SelectCard<ICorporationCard>(
        'Merge the new corporation', 'Merge', [merged], {min: 1, max: 1})
        .markStartGamePrompt({kind: 'corporationMerge'})
        .andThen(() => {
          deferMergePayment(player);
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
  // Missions 2–3: the new pick merges by the Merger prelude's own rule —
  // «Then pay 42 M€». The fee participates in affordability, so the hand
  // purchase can never promise money the merge press will owe.
  if (newCorporation !== undefined && campaignLineageOf(player).length > 0) {
    megaCredits -= Merger.mergerCost;
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
  // The premium arrival: the owner's own reveal (fullscreen batch → the hand
  // dock) through the standard drawn-cards system — clearly marked as CARRIED
  // (the `campaign` source), presented after the deployment's own beats.
  player.enqueueCardDrawReveal(cards, {type: 'campaign'});
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
