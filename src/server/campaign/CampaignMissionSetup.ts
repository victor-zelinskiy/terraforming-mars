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
import {contractRewardMode} from '../../common/campaign/CampaignGameContract';
import {campaignFinalePicksCorporation} from '../../common/campaign/CampaignTypes';
import {
  CampaignRewardMode,
  PlayerTender,
  TENDER_BROAD_PORTFOLIO_PROJECTS,
  TENDER_COMPENSATION_MC,
  TENDER_OPEN_CALL_PRELUDES,
  TENDER_RESTRUCTURING_CANDIDATES,
  tenderDef,
  tenderNameKey,
} from '../../common/campaign/tenders';
import {TenderResponse} from '../../common/inputs/InputResponse';
import {ICorporationCard, isICorporationCard} from '../cards/corporation/ICorporationCard';
import {IProjectCard} from '../cards/IProjectCard';
import {IPreludeCard} from '../cards/prelude/IPreludeCard';
import {newCorporationCard, newPrelude, newProjectCard} from '../createCard';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {PreludeDeck, ProjectDeck} from '../cards/Deck';
import {VictoryPointsBreakdownBuilder} from '../game/VictoryPointsBreakdownBuilder';
import {PlayerInput} from '../PlayerInput';
import {Priority} from '../deferredActions/Priority';
import {InputError} from '../inputs/InputError';
import {SelectCard} from '../inputs/SelectCard';
import {SelectOption} from '../inputs/SelectOption';
import {SelectPaymentDeferred} from '../deferredActions/SelectPaymentDeferred';
import {namedCardSource} from '../inputs/choiceContext';
import {Merger} from '../cards/promo/Merger';
import {message} from '../logs/MessageBuilder';

export function campaignContractOf(game: IGame): CampaignGameContract | undefined {
  return game.gameOptions.campaign;
}

/** The campaign's reward mode as the mission sees it (`titles` outside campaigns and on older contracts). */
export function campaignRewardModeOf(game: IGame): CampaignRewardMode {
  return contractRewardMode(campaignContractOf(game));
}

/** The player's public campaign grant, keyed by the immutable seat index. */
export function campaignGrantFor(player: IPlayer): CampaignGrant | undefined {
  const contract = campaignContractOf(player.game);
  if (contract === undefined || player.campaignSeat === undefined) {
    return undefined;
  }
  return contract.grants.find((g) => g.seat === player.campaignSeat);
}

/**
 * THE lineage this mission deploys — the contract's, or the one a
 * «Реструктуризация» rewrote (`campaignLineageOverride`, the one replaced
 * corporation swapped in place). Every deployment reader asks here.
 */
export function campaignLineageOf(player: IPlayer): ReadonlyArray<CardName> {
  return player.campaignLineageOverride ?? campaignGrantFor(player)?.corporations ?? [];
}

/**
 * Does this player still CHOOSE a new corporation this mission?
 * Every mission but the final: yes (mission 1 has an empty lineage — the ordinary flow).
 * The final mission: only when the lineage is still short of the finale's company of three
 * (`campaignFinalePicksCorporation` — the three-mission route); otherwise the player deploys the
 * accumulated lineage («Штаб») with no pick.
 */
export function campaignPicksNewCorporation(player: IPlayer): boolean {
  const contract = campaignContractOf(player.game);
  if (contract === undefined || player.isMarsBot) {
    return false;
  }
  return contract.final !== true || campaignFinalePicksCorporation(campaignLineageOf(player).length);
}

/** True for a human seat of a FINAL campaign mission that deploys a full company: no corp step is dealt or shown. */
export function campaignSelectionSkipsCorpStep(player: IPlayer): boolean {
  const contract = campaignContractOf(player.game);
  return contract?.final === true && !player.isMarsBot && campaignGrantFor(player) !== undefined &&
    !campaignFinalePicksCorporation(campaignLineageOf(player).length);
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
  return campaignLineageOf(player).length + (campaignPicksNewCorporation(player) ? 1 : 0);
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
    campaignLegacyPending(player) > 0 || tenderCompensationPending(player).tenders > 0;
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
 *   6. «КОМПЕНСАЦИЯ» (the «Тендеры» mode, when tenders were left unexecuted)
 *      — BACK_OF_THE_LINE after the legacy: the Committee buys them back,
 *      3 M€ each, in front of the player.
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
  deferTenderCompensation(player);
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
  player.game.defer(new SelectPaymentDeferred(player, Merger.mergerCost, {title: 'Select how to pay for Merger', cause: namedCardSource(CardName.MERGER)}))
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
        deferTenderCompensation(player);
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
        deferTenderCompensation(player);
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
          deferTenderCompensation(player);
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
        deferTenderCompensation(player);
        player.game.playerIsFinishedWithResearchPhase(player);
        return undefined;
      });
  }
  const compensation = tenderCompensationPending(player);
  if (compensation.tenders > 0) {
    return tenderCompensationInput(player, () => player.game.playerIsFinishedWithResearchPhase(player));
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
  // «Субсидия на исследования»: the starting hand's price per card, after every executed copy.
  cardCost -= player.campaignStartingHandDiscount;
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

// ─────────────────────────────────────────────────────────────────────────────
// «ТЕНДЕРЫ» (docs/CAMPAIGN_CONCESSIONS_DESIGN.md) — the finale's start.
//
// Every tender of the START window is EXECUTED from the finale's initial
// selection («НАСЛЕДИЕ › ТЕНДЕРЫ»), through a `tender` answer on the very
// `initialCards` prompt: the effect lands on the player's deal in place — the
// `SelectCard` steps hold the dealt arrays by reference — and the selection is
// served again. A tender unexecuted when the selection completes is bought
// back by the «КОМПЕНСАЦИЯ» press of the deployment chain.
// ─────────────────────────────────────────────────────────────────────────────

/** The tenders this player brought into the mission (the finale of a «Тендеры» campaign; empty elsewhere). */
export function campaignTendersOf(player: IPlayer): ReadonlyArray<PlayerTender> {
  return player.campaignTenders ?? [];
}

/** A tender of the START window may be executed only while the finale's initial selection stands. */
export function campaignTenderWindowOpen(player: IPlayer): boolean {
  const contract = campaignContractOf(player.game);
  return contract !== undefined && contract.final === true && contractRewardMode(contract) === 'tenders' &&
    !player.isMarsBot && player.campaignSeat !== undefined && player.initialCardSelectionDone !== true;
}

/** How many preludes this player picks at the start: 2, plus one per executed «Дополнительный пролог». */
export function campaignPreludePickCount(player: IPlayer): number {
  return 2 + Math.max(0, player.campaignPreludePickBonus);
}

function redealInPlace<T extends IProjectCard>(
  game: IGame,
  dealt: Array<T>,
  keep: ReadonlySet<CardName>,
  draw: (count: number) => Array<T>,
  discard: (cards: Array<T>) => void,
): void {
  const kept = dealt.filter((c) => keep.has(c.name));
  const gone = dealt.filter((c) => !keep.has(c.name));
  // Draw FIRST, discard after: a redeal never hands the same card straight back.
  const fresh = draw(gone.length);
  discard(gone);
  dealt.splice(0, dealt.length, ...kept, ...fresh);
  void game;
}

function keepSetOf(response: TenderResponse, dealt: ReadonlyArray<{name: CardName}>, keepMax: number): Set<CardName> {
  const keep = response.keep ?? [];
  if (keep.length > keepMax) {
    throw new InputError(`This tender keeps at most ${keepMax} card(s)`);
  }
  const names = new Set(dealt.map((c) => c.name));
  for (const name of keep) {
    if (!names.has(name)) {
      throw new InputError(`Card ${name} is not in your deal`);
    }
  }
  return new Set(keep);
}

/**
 * EXECUTE one held tender of the START window. Refuses by name: an unknown
 * instance, a tender already executed, a window that is closed, a prelude
 * tender without the Prelude expansion, a keep that is not in the deal.
 * Idempotent per instance (a second execution is refused, never doubled).
 */
export function executeTender(player: IPlayer, response: TenderResponse): void {
  if (!campaignTenderWindowOpen(player)) {
    throw new InputError('Tenders can be executed only while the finale\'s starting selection stands');
  }
  const tender = campaignTendersOf(player).find((t) => t.instance === response.instance);
  if (tender === undefined) {
    throw new InputError('You hold no such tender');
  }
  if (tender.status !== 'held') {
    throw new InputError('This tender was already executed');
  }
  const def = tenderDef(tender.id);
  if (def.window !== 'start') {
    throw new InputError('This tender is realized on the carryover step, not at the start');
  }
  const game = player.game;
  if (def.needsPreludes && game.gameOptions.preludeExtension !== true) {
    throw new InputError('This tender needs the Prelude expansion');
  }
  const drawPreludes = (n: number) => game.preludeDeck.drawN(game, n);
  const drawProjects = (n: number) => game.projectDeck.drawN(game, n);
  switch (tender.id) {
  case 'additionalPrelude':
    if (player.dealtPreludeCards.length < campaignPreludePickCount(player) + 1) {
      throw new InputError('Not enough preludes were dealt for an additional pick');
    }
    player.campaignPreludePickBonus++;
    break;
  case 'openCall':
    player.dealtPreludeCards.push(...drawPreludes(TENDER_OPEN_CALL_PRELUDES));
    break;
  case 'broadPortfolio':
    player.dealtProjectCards.push(...drawProjects(TENDER_BROAD_PORTFOLIO_PROJECTS));
    break;
  case 'researchSubsidy':
    player.campaignStartingHandDiscount++;
    break;
  case 'preludeReview': {
    const keep = keepSetOf(response, player.dealtPreludeCards, 1);
    redealInPlace<IPreludeCard>(game, player.dealtPreludeCards, keep, drawPreludes, (cards) => game.preludeDeck.discard(...cards));
    break;
  }
  case 'projectReview': {
    const keep = keepSetOf(response, player.dealtProjectCards, 1);
    redealInPlace<IProjectCard>(game, player.dealtProjectCards, keep, drawProjects, (cards) => game.projectDeck.discard(...cards));
    break;
  }
  case 'gamble':
    redealInPlace<IPreludeCard>(game, player.dealtPreludeCards, new Set(), drawPreludes, (cards) => game.preludeDeck.discard(...cards));
    redealInPlace<IProjectCard>(game, player.dealtProjectCards, new Set(), drawProjects, (cards) => game.projectDeck.discard(...cards));
    break;
  case 'restructuring':
    executeRestructuring(player, tender, response);
    return; // its own status handling: the deal keeps the tender held until the choice
  case 'programExtension':
  case 'extendedLegacy':
    throw new InputError('This tender is realized on the carryover step');
  default:
    throw new InputError(`Unknown tender ${tender.id}`);
  }
  tender.status = 'executed';
  game.log('${0} executed the tender ${1}', (b) => b.player(player).string(tenderNameKey(tender.id)));
}

/**
 * «РЕСТРУКТУРИЗАЦИЯ» — two answers on one tender. The first DEALS the
 * candidates (the tender stays held, its `offer` names them); the second takes
 * one of them in place of a lineage corporation (`campaignLineageOverride`)
 * or declines — either way the candidates not taken go back to the deck. It
 * works whether or not the finale drafts a corporation of its own: the
 * override rewrites the LINEAGE, the draft's pick stays the draft's.
 */
function executeRestructuring(player: IPlayer, tender: PlayerTender, response: TenderResponse): void {
  const game = player.game;
  if (tender.offer === undefined) {
    if (response.take !== undefined || response.replace !== undefined || response.decline === true) {
      throw new InputError('Deal the candidates first');
    }
    const dealt = game.corporationDeck.drawN(game, TENDER_RESTRUCTURING_CANDIDATES);
    if (dealt.length === 0) {
      throw new InputError('No corporation is left to deal');
    }
    tender.offer = dealt.map((c) => c.name);
    game.log('${0} opened a restructuring: ${1} corporations dealt', (b) => b.player(player).number(dealt.length));
    return;
  }
  const offer = tender.offer;
  const letGo = (names: ReadonlyArray<CardName>) => {
    for (const name of names) {
      const card = newCorporationCard(name);
      if (card !== undefined) {
        game.corporationDeck.discard(card);
      }
    }
  };
  if (response.decline === true) {
    tender.offer = undefined;
    letGo(offer);
    game.log('${0} declined the restructuring', (b) => b.player(player));
    return;
  }
  const take = response.take;
  const replace = response.replace;
  if (take === undefined || !offer.includes(take)) {
    throw new InputError('Take one of the dealt corporations');
  }
  const lineage = campaignLineageOf(player);
  if (replace === undefined || !lineage.includes(replace)) {
    throw new InputError('Name the lineage corporation it replaces');
  }
  player.campaignLineageOverride = lineage.map((name) => (name === replace ? take : name));
  tender.offer = undefined;
  tender.status = 'executed';
  letGo(offer.filter((name) => name !== take));
  game.log('${0} restructured: ${1} replaces ${2}', (b) => b.player(player).cardName(take).cardName(replace));
}

/** The tenders still held once the selection is over — what the compensation press buys back. */
export function tenderCompensationPending(player: IPlayer): {tenders: number, megaCredits: number} {
  if (player.campaignTendersCompensated === true || player.initialCardSelectionDone !== true) {
    return {tenders: 0, megaCredits: 0};
  }
  const held = campaignTendersOf(player).filter((t) => t.status === 'held').length;
  return {tenders: held, megaCredits: held * TENDER_COMPENSATION_MC};
}

/**
 * «КОМПЕНСАЦИЯ» — the deliberate buy-back press (marker `tenderCompensation`):
 * the Committee pays `TENDER_COMPENSATION_MC` per tender left unexecuted, in
 * front of the player, as the last stage of the deployment.
 */
export function tenderCompensationInput(player: IPlayer, after?: () => void): PlayerInput | undefined {
  const pending = tenderCompensationPending(player);
  if (pending.tenders === 0) {
    return undefined;
  }
  return new SelectOption(
    message('Receive ${0} M€ for ${1} unexecuted tender(s)', (b) => b.number(pending.megaCredits).number(pending.tenders)),
    'Receive')
    .markStartGamePrompt({kind: 'tenderCompensation', compensation: pending})
    .andThen(() => {
      grantTenderCompensation(player);
      after?.();
      return undefined;
    });
}

/** Buys every held tender back exactly once (serialized flag). */
export function grantTenderCompensation(player: IPlayer): void {
  const pending = tenderCompensationPending(player);
  if (pending.tenders === 0) {
    return;
  }
  for (const tender of campaignTendersOf(player)) {
    if (tender.status === 'held') {
      tender.status = 'cashed';
      // A restructuring left with its candidates dealt gives them back to the deck — nothing leaks out of the pool.
      for (const name of tender.offer ?? []) {
        const card = newCorporationCard(name);
        if (card !== undefined) {
          player.game.corporationDeck.discard(card);
        }
      }
      tender.offer = undefined;
    }
  }
  player.campaignTendersCompensated = true;
  player.stock.add(Resource.MEGACREDITS, pending.megaCredits);
  player.game.log('${0} received ${1} M€ for ${2} unexecuted tender(s)', (b) => b.player(player).number(pending.megaCredits).number(pending.tenders));
}

function deferTenderCompensation(player: IPlayer): void {
  if (tenderCompensationPending(player).tenders > 0) {
    // After the legacy press, same lane: the last thing the deployment says.
    player.defer(() => tenderCompensationInput(player), Priority.BACK_OF_THE_LINE);
  }
}

/**
 * «Продление программы»: a carried prelude leaves the prelude deck BEFORE any
 * deal — the single instance enters the game only through
 * `grantCarriedPreludes`, so a second copy can never be dealt or reshuffled in.
 */
export function reserveCarriedPreludes(preludeDeck: PreludeDeck, players: ReadonlyArray<IPlayer>): void {
  for (const player of players) {
    for (const name of player.campaignCarriedPreludes ?? []) {
      const idx = preludeDeck.drawPile.findIndex((c) => c.name === name);
      if (idx === -1) {
        throw new Error(`Carried prelude ${name} is not available in this mission's prelude deck`);
      }
      preludeDeck.drawPile.splice(idx, 1);
    }
  }
}

/**
 * Hands the carried preludes to the player's prelude hand exactly once — at
 * the end of the initial selection, beside the preludes just picked, so the
 * prelude phase plays them all in the player's order.
 */
export function grantCarriedPreludes(player: IPlayer): void {
  const names = player.campaignCarriedPreludes ?? [];
  if (names.length === 0 || player.campaignCarriedPreludesGranted === true) {
    return;
  }
  for (const name of names) {
    const card = newPrelude(name);
    if (card === undefined) {
      throw new Error(`Carried prelude ${name} cannot be instantiated`);
    }
    player.preludeCardsInHand.push(card);
  }
  player.campaignCarriedPreludesGranted = true;
  player.game.log('${0} carries ${1} prelude(s) from the previous mission', (b) => b.player(player).number(names.length));
}

/**
 * Campaign «Титулы» as a VP category — FINAL missions only (approved D2/D8),
 * the `titles` reward mode only (a «Тендеры» campaign scores no titles).
 * Every seat of a final mission materializes the field (0 included) so the
 * category renders consistently; ordinary games and missions 1–3 never touch
 * it, keeping their wire shape byte-identical.
 */
export function calculateCampaignTitleVictoryPoints(player: IPlayer, builder: VictoryPointsBreakdownBuilder): void {
  const contract = campaignContractOf(player.game);
  if (contract === undefined || contract.final !== true || contractRewardMode(contract) !== 'titles') {
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
