import {CardName} from '../cards/CardName';
import {ColonyName} from '../colonies/ColonyName';
import {Color, ColorWithNeutral} from '../Color';
import {GlobalEventName} from '../turmoil/globalEvents/GlobalEventName';
import {PartyName} from '../turmoil/PartyName';
import {PolicyId} from '../turmoil/Types';
import {SpaceId} from '../Types';
import {Units} from '../Units';
import {twoWayDifference} from '../utils/utils';
import {AresGlobalParametersResponse} from './AresGlobalParametersResponse';
import {Payment} from './Payment';

function matches(response: any, fields: Array<string>) {
  return twoWayDifference(Object.keys(response), fields).length === 0;
}
export interface SelectOptionResponse {
  type: 'option',
}

export function isSelectOptionResponse(response: InputResponse): response is SelectOptionResponse {
  return response.type === 'option' && Object.keys(response).length === 1;
}

export interface OrOptionsResponse {
  type: 'or',
  index: number;
  response: InputResponse;
}

export function isOrOptionsResponse(response: InputResponse): response is OrOptionsResponse {
  return response.type === 'or' && matches(response, ['type', 'index', 'response']);
}

export interface AndOptionsResponse {
  type: 'and',
  responses: Array<InputResponse>;
}

export function isAndOptionsResponse(response: InputResponse): response is AndOptionsResponse {
  return response.type === 'and' && matches(response, ['type', 'responses']);
}

export interface SelectInitialCardsResponse {
  type: 'initialCards',
  responses: Array<InputResponse>;
}

export function isSelectInitialCardsResponse(response: InputResponse): response is SelectInitialCardsResponse {
  return response.type === 'initialCards' && matches(response, ['type', 'responses']);
}

export interface SelectCardResponse {
  type: 'card',
  cards: Array<CardName>;
}

export function isSelectCardResponse(response: InputResponse): response is SelectCardResponse {
  return response.type === 'card' && matches(response, ['type', 'cards']);
}

export interface SelectProjectCardToPlayResponse {
  type: 'projectCard',
  card: CardName;
  payment: Payment;
}

export function isSelectProjectCardToPlayResponse(response: InputResponse): response is SelectProjectCardToPlayResponse {
  return response.type === 'projectCard' && matches(response, ['type', 'card', 'payment']);
}

export interface SelectSpaceResponse {
  type: 'space',
  spaceId: SpaceId;
  /**
   * THE STAGED-PLACEMENT ADDRESS. A staged flow (console: «клетка — последний
   * обратимый шаг») picks the cell BEFORE the play/action batch is submitted,
   * so its space response travels as the batch's TAIL — and the first
   * `SelectSpace` the server surfaces is NOT always the placement the cell was
   * picked for: a threshold bonus can jump the queue (raising temperature past
   * 0°C defers a bonus ocean at `PLACE_OCEAN_TILE`, ahead of the card's own
   * `DEFAULT`-priority tile). An unaddressed space answer is indistinguishable
   * from an answer to that interloper — it was either consumed by the wrong
   * prompt (ocean vs ocean) or dropped as a stale divergence (land vs ocean).
   *
   * `stagedFor` names the card whose OWN placement this cell answers; the batch
   * replay (`server/inputs/deferredInputBatch.ts`) applies it ONLY to a
   * `SelectSpace` carrying the same `sourceCard` and PARKS it past everything
   * else. Absent on every non-staged response — the positional replay is
   * unchanged for them.
   */
  stagedFor?: CardName;
  /**
   * A MOVE (Turmoil Redux TR14 Re-settlement — a prompt carrying
   * `SelectSpaceModel.tileMove`): the cell the city LEAVES, `spaceId` being the
   * cell it comes to. ONE answer names both, so the server never holds a
   * «lifted, not placed» state — a move is never two prompts and never two
   * tails. Required by a move prompt, refused by every other.
   */
  movedFrom?: SpaceId;
}

export function isSelectSpaceResponse(response: InputResponse): response is SelectSpaceResponse {
  // Exactly these four key sets: a cell, a staged cell, a move, a staged move.
  return response.type === 'space' &&
    (matches(response, ['type', 'spaceId']) ||
      matches(response, ['type', 'spaceId', 'stagedFor']) ||
      matches(response, ['type', 'spaceId', 'movedFrom']) ||
      matches(response, ['type', 'spaceId', 'movedFrom', 'stagedFor']));
}

/**
 * Cancel a PENDING, not-yet-committed placement (a `SelectSpace` whose
 * `placementContext.cancellable === true`). The server discards the placement
 * WITHOUT applying its cost/effects and returns the player to the action menu
 * (the action is not counted). Only valid on a cancellable placement prompt.
 */
export interface CancelResponse {
  type: 'cancel',
}

export function isCancelResponse(response: InputResponse): response is CancelResponse {
  return response.type === 'cancel' && Object.keys(response).length === 1;
}

export interface SelectPlayerResponse {
  type: 'player',
  player: ColorWithNeutral;
}

export function isSelectPlayerResponse(response: InputResponse): response is SelectPlayerResponse {
  return response.type === 'player' && matches(response, ['type', 'player']);
}

export interface SelectPartyResponse {
  type: 'party',
  partyName: PartyName;
  /**
   * THE STAGED-VOTE ADDRESS — the `party` twin of `SelectSpaceResponse.stagedFor`.
   * A card that places a delegate by being PLAYED (Turmoil Redux TR03) has its
   * resolution picked BEFORE the play batch is submitted, so the party answer
   * travels as the batch's TAIL — and the first `SelectParty` the server raises
   * is not always that card's: the chairman's seat is a `SelectParty` too
   * (`votePrompt.source === 'chairman-seat'`), and a positional «Greens» there
   * would choose which resolution GIVES UP a delegate.
   *
   * `stagedFor` names the card whose own delegate grant this answers; the batch
   * replay applies it ONLY to a grant prompt whose `choiceContext.source.card`
   * is that card and PARKS it past everything else. Absent on every other party
   * answer (the vote, a colony's grant, the seat) — those replay as before.
   */
  stagedFor?: CardName;
}

export function isSelectPartyResponse(response: InputResponse): response is SelectPartyResponse {
  return response.type === 'party' &&
    (matches(response, ['type', 'partyName']) || matches(response, ['type', 'partyName', 'stagedFor']));
}

export interface SelectDelegateResponse {
  type: 'delegate',
  player: ColorWithNeutral;
}

export function isSelectDelegateResponse(response: InputResponse): response is SelectDelegateResponse {
  return response.type === 'delegate' && matches(response, ['type', 'player']);
}

export interface SelectAmountResponse {
  type: 'amount',
  amount: number;
}

export function isSelectAmountResponse(response: InputResponse): response is SelectAmountResponse {
  return response.type === 'amount' && matches(response, ['type', 'amount']);
}

/**
 * The answer to a colony pick — in ONE of four forms:
 *  · `colonyName` — a colony tile (every colony pick);
 *  · `fleetDock` — a CARD the trade fleet is sent to instead of a colony
 *    (Turmoil Redux TR06 Water Hauling and its sisters). Valid only on a
 *    trade's destination pick, and only for a dock its `fleetDocks` marker
 *    lists as available (`SelectColonyModel.fleetDocks`);
 *  · `colonyName` + `stagedFor` — THE STAGED-COLONY ADDRESS, the `colony`
 *    twin of `SelectSpaceResponse.stagedFor` / `SelectPartyResponse.stagedFor`.
 *    A card that picks a colony track by being PLAYED (Turmoil Redux TR07
 *    Colony Sponsors) has its tile chosen BEFORE the play batch is submitted,
 *    so the answer travels as the batch's TAIL — and the first `SelectColony`
 *    the server raises is not always that card's (a build, a trade, Aridor's
 *    pick). `stagedFor` names the card whose own pick this answers; the batch
 *    replay applies it ONLY to a colony prompt whose `choiceContext.source.card`
 *    is that card and PARKS it past everything else. A dock is never staged:
 *    `fleetDock` beside `stagedFor` is not an answer;
 *  · `colonyName` + `replaces` (+ `stagedFor`) — THE REPLACEMENT: ONE question,
 *    ONE answer naming BOTH tiles (Turmoil Redux TR10 Fringe Colony).
 *    `colonyName` is the reserve tile that ENTERS, `replaces` the tile in play
 *    that LEAVES and whose slot it takes. Valid only on a pick whose roster
 *    marker is `{kind: 'replace'}` (`SelectColonyModel.rosterChange`) — there
 *    it is the ONLY valid form, and `replaces` must be a tile the marker lists
 *    as able to leave. Two prompts («remove», then «add») would leave a table
 *    with a hole between them; this form has no such state. A dock is never a
 *    replacement: `replaces` beside `fleetDock` is not an answer.
 */
export type SelectColonyResponse =
  | {type: 'colony', colonyName: ColonyName, fleetDock?: undefined, replaces?: ColonyName, stagedFor?: CardName}
  | {type: 'colony', fleetDock: CardName, colonyName?: undefined, replaces?: undefined, stagedFor?: undefined};

export function isSelectColonyResponse(response: InputResponse): response is SelectColonyResponse {
  // EXACTLY one shape — the same exact-key check a space answer uses
  // (`isSelectSpaceResponse`): a tile and a dock at once, neither, a dock with
  // an address or a dock with a replaced tile is not an answer.
  return response.type === 'colony' &&
    (matches(response, ['type', 'colonyName']) ||
      matches(response, ['type', 'colonyName', 'stagedFor']) ||
      matches(response, ['type', 'fleetDock']) ||
      matches(response, ['type', 'colonyName', 'replaces']) ||
      matches(response, ['type', 'colonyName', 'replaces', 'stagedFor']));
}

export interface SelectPaymentResponse {
  type: 'payment',
  payment: Payment;
}

export function isSelectPaymentResponse(response: InputResponse): response is SelectPaymentResponse {
  return response.type === 'payment' && matches(response, ['type', 'payment']);
}

export interface SelectProductionToLoseResponse {
  type: 'productionToLose',
  units: Units;
}

export function isSelectProductionToLoseResponse(response: InputResponse): response is SelectProductionToLoseResponse {
  return response.type === 'productionToLose' && matches(response, ['type', 'units']);
}

export interface ShiftAresGlobalParametersResponse {
  type: 'aresGlobalParameters',
  response: AresGlobalParametersResponse;
}

export function isShiftAresGlobalParametersResponse(response: InputResponse): response is ShiftAresGlobalParametersResponse {
  return response.type === 'aresGlobalParameters' && matches(response, ['type', 'response']);
}

// This applies to the input in AresGlobalParametersResponse.ts, which should
// probably move here.
export function isAresGlobalParametersResponse(obj: any): obj is AresGlobalParametersResponse {
  return matches(obj, ['lowOceanDelta', 'highOceanDelta', 'temperatureDelta', 'oxygenDelta']);
}

export interface SelectGlobalEventResponse {
  type: 'globalEvent',
  globalEventName: GlobalEventName;
}

export function isSelectGlobalEventResponse(response: InputResponse): response is SelectGlobalEventResponse {
  return response.type === 'globalEvent' && matches(response, ['type', 'globalEventName']);
}

export interface SelectPolicyResponse {
  type: 'policy',
  policyId: PolicyId;
}

export function isSelectPolicyResponse(response: InputResponse): response is SelectPolicyResponse {
  return response.type === 'policy' && matches(response, ['type', 'policyId']);
}

export interface SelectResourceResponse {
  type: 'resource',
  resource: keyof Units,
}

export function isSelectResourceResponse(response: InputResponse): response is SelectResourceResponse {
  return response.type === 'resource' && matches(response, ['type', 'resource']);
}

export interface SelectResourcesResponse {
  type: 'resources',
  units: Units,
}

export function isSelectResourcesResponse(response: InputResponse): response is SelectResourcesResponse {
  return response.type === 'resources' && matches(response, ['type', 'units']);
}

export interface SelectClaimedUndergroundTokenResponse {
  type: 'claimedUndergroundToken',
  selected: Array<number>;
}

export function isSelectClaimedUndergroundTokenResponse(response: InputResponse): response is SelectClaimedUndergroundTokenResponse {
  return response.type === 'claimedUndergroundToken' && matches(response, ['type', 'selected']);
}

export interface DeltaProjectInputResponse {
  type: 'deltaProject',
  amount: number;
  /**
   * The player CONSCIOUSLY declines the landed stage's target-bearing reward
   * (position 7's repeat pick / position 9's animal target) — the server then
   * defers no follow-up SelectCard for it. Absent = the reward resolves as
   * always (pre-collected in the same batch, or asked afterwards).
   */
  waiveReward?: boolean;
  /**
   * Steel spent 1:1 in place of energy for this advance (Delta Works). The
   * energy share is the remainder (`amount - steel`) — one linked value, so a
   * mix can never disagree with the cost. Omitted (never 0) when the whole
   * price is energy: the wire shape without the field stays byte-identical to
   * the pre-Delta-Works client, and the server re-validates the mix at commit.
   */
  steel?: number;
  /**
   * Modular Floodgates steel spent 1:1 in place of energy for this advance —
   * the same Delta Works substitution the `steel` share rides, drawn from the
   * CARD's own stored resources instead of the player's stock. Its own field
   * because it is its own SOURCE: the server deducts it from the card, never
   * from `player.steel`, and the console offers it as a separate, explicitly
   * chosen dial (a protected source is never auto-mixed). Omitted (never 0)
   * when unused — historical wire shapes stay byte-identical.
   */
  cardSteel?: number;
  /**
   * PER-POSITION conscious declines of target-bearing stage rewards along a
   * multi-reward traversal (Delta Surge — one path can hold BOTH the position
   * 7 repeat and the position 9 animals, each answered or declined on its
   * own). Omitted (never `[]`) when nothing is declined; `waiveReward` above
   * stays the landing-only shorthand — the server unions the two.
   */
  waivedSteps?: ReadonlyArray<number>;
  /**
   * THE DECLARED RESOURCE PLAN: pre-selected repeated actions, at the stage
   * where each will execute. The server re-validates the whole ORDERED
   * projection against these BEFORE any mutation (`deltaAdvancePlanVerdict`)
   * — a payment mix that starves a declared action refuses atomically, so
   * nothing is spent and the marker never moves. Omitted when no action is
   * pre-selected (the historical wire shapes stay byte-identical).
   */
  plannedActions?: ReadonlyArray<{position: number, card: CardName}>;
  /**
   * The declared CHOICE answers of the same plan (stages 1/2), by position —
   * the projection threads their guaranteed gains, so an early chosen gain
   * may honestly fund a later declared action. Omitted when none.
   */
  plannedChoices?: ReadonlyArray<{position: number, choice: number}>;
  /**
   * THE INVOCATION PLAN — every stage-level ask the player pre-answered, by
   * position, CONSUMED by the server's own reward resolution (never replayed
   * as a positional response stream). One entry per asking stage: the chosen
   * reward alternative (stages 1/2), the picked card (stage 7's repeated
   * action / stage 9's animal target), and — for a composed repeat — the
   * repeated action's OWN nested responses, fed to the prompts that action
   * raises when it runs. A missing / stale entry degrades to the ordinary
   * prompt for THAT stage alone (served embedded), never to a dropped plan.
   * Omitted when nothing was pre-answered (historical shapes byte-identical).
   */
  answers?: ReadonlyArray<DeltaStageAnswer>;
}

/** One pre-answered stage ask of a Hydronetwork advance (see `answers`). */
export interface DeltaStageAnswer {
  position: number;
  /** Choice stages (1/2): the picked alternative index. */
  rewardChoice?: number;
  /** Target stages (7/9): the picked card. */
  selectedCard?: CardName;
  /** Stage 7: the composed repeat's own nested responses, in the repeated
   *  action's defer order (byte-identical to a direct activation's batch). */
  repeatResponses?: ReadonlyArray<InputResponse>;
}

/**
 * A REWARD-ONLY stage claim (Dutch Mountains): which reached Hydronetwork
 * stage's reward to grant — no movement, no position change. The optional
 * `answer` is the SAME invocation-plan shape the move step carries (its
 * position must equal `position`); the reward resolver consumes it
 * identically, so a claimed reward and a landed reward share one contract.
 */
export interface DeltaStageRewardResponse {
  type: 'deltaStageReward',
  position: number;
  answer?: DeltaStageAnswer;
}

export function isDeltaStageRewardResponse(response: InputResponse): response is DeltaStageRewardResponse {
  if (response.type !== 'deltaStageReward') {
    return false;
  }
  const allowed = ['type', 'position', 'answer'];
  const keys = Object.keys(response);
  return keys.includes('position') && keys.every((k) => allowed.includes(k));
}

export function isDeltaProjectInputResponse(response: InputResponse): response is DeltaProjectInputResponse {
  if (response.type !== 'deltaProject') {
    return false;
  }
  // `amount` is required; the optional fields compose freely (each is
  // omitted when meaningless, so the historical shapes stay byte-identical).
  const allowed = ['type', 'amount', 'waiveReward', 'steel', 'cardSteel', 'waivedSteps', 'plannedActions', 'plannedChoices', 'answers'];
  const keys = Object.keys(response);
  return keys.includes('amount') && keys.every((k) => allowed.includes(k));
}

/**
 * Corporate Espionage (DP10): the chosen target and the owner's pre-answered
 * landing ask. `target` is REQUIRED exactly when the projection offered a
 * legal target and FORBIDDEN when it offered none — a mismatch against the
 * live projection refuses out loud (no silent retarget, no silent skip).
 * The `expected*From` positions pin the client's rendered prognosis: a
 * commit whose live positions moved refuses instead of resolving a move the
 * player never saw.
 */
export interface DeltaEspionageResponse {
  type: 'deltaEspionage',
  /** The attacked player. Absent ⇔ the projection had no legal target. */
  target?: Color;
  /** The target's position the client rendered (`from` of the shown `from → to`). */
  expectedTargetFrom?: number;
  /** The owner's position the client rendered. */
  expectedOwnerFrom?: number;
  /**
   * The owner's pre-answered ask of THEIR OWN landing stage (the same
   * invocation-plan shape every Hydronetwork door carries; its position must
   * equal the owner's destination). Never carries the target's choices —
   * those belong to the target.
   */
  ownerAnswer?: DeltaStageAnswer;
}

export function isDeltaEspionageResponse(response: InputResponse): response is DeltaEspionageResponse {
  if (response.type !== 'deltaEspionage') {
    return false;
  }
  const allowed = ['type', 'target', 'expectedTargetFrom', 'expectedOwnerFrom', 'ownerAnswer'];
  return Object.keys(response).every((k) => allowed.includes(k));
}

/**
 * Modular Floodgates (DP11), variant B: which opponent receives the blockade.
 * `target` is REQUIRED (the variant does not exist without a legal target —
 * unlike DP10 there is no owner half to fall back to). `expectedTargetFrom`
 * pins the client's rendered prognosis: a commit whose live position moved
 * refuses instead of blocking a marker the player never saw there.
 */
export interface DeltaBlockadeResponse {
  type: 'deltaBlockade',
  /** The blocked player. */
  target: Color;
  /** The target's position the client rendered (the blockade lands at +1). */
  expectedTargetFrom?: number;
}

export function isDeltaBlockadeResponse(response: InputResponse): response is DeltaBlockadeResponse {
  if (response.type !== 'deltaBlockade') {
    return false;
  }
  const allowed = ['type', 'target', 'expectedTargetFrom'];
  const keys = Object.keys(response);
  return keys.includes('target') && keys.every((k) => allowed.includes(k));
}

export type InputResponse =
  AndOptionsResponse |
  CancelResponse |
  OrOptionsResponse |
  SelectInitialCardsResponse |
  SelectAmountResponse |
  DeltaProjectInputResponse |
  DeltaEspionageResponse |
  DeltaBlockadeResponse |
  DeltaStageRewardResponse |
  SelectCardResponse |
  SelectColonyResponse |
  SelectDelegateResponse |
  SelectOptionResponse |
  SelectPartyResponse |
  SelectPaymentResponse |
  SelectPlayerResponse |
  SelectProductionToLoseResponse |
  SelectProjectCardToPlayResponse |
  SelectSpaceResponse |
  ShiftAresGlobalParametersResponse |
  SelectGlobalEventResponse |
  SelectPolicyResponse |
  SelectResourceResponse |
  SelectResourcesResponse |
  SelectClaimedUndergroundTokenResponse;
