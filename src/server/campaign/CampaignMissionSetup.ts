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

/**
 * Plays the whole campaign corporation sequence in acquisition order.
 * The research-phase release is HELD until the last corporation so the
 * deferred queue (each corp's own effects + the base corp's card payment)
 * drains once, in order — never mid-lineage.
 */
export function playCampaignCorporations(player: IPlayer, options?: {deferCardPayment?: boolean}): void {
  const queue = campaignCorporationQueue(player);
  for (const corp of queue) {
    const isBase = player.playedCards.filter(isICorporationCard).length === 0;
    player.playCorporationCard(corp, {
      deferCardPayment: isBase ? options?.deferCardPayment : false,
      holdResearchRelease: true,
    });
  }
  player.game.playerIsFinishedWithResearchPhase(player);
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
