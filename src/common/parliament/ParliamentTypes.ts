/*
 * TURMOIL REDUX — the shared vocabulary of the Mars Parliament (server +
 * client). Rulebook: docs/TURMOIL_REDUX_SPEC.md (§1 the rules, §0.1 the
 * project's own decisions); plan: docs/TURMOIL_REDUX_ITERATION0_PLAN.md.
 *
 * Nothing here is game state — these are the constants, the enumerations and
 * the pure helpers both sides agree on.
 */
import {PartyName} from '../turmoil/PartyName';
import {Resource} from '../Resource';
import {Tag} from '../cards/Tag';
import {CardResource} from '../CardResource';

/** The six Redux parties, in the BOARD's left-to-right order. */
export const REDUX_PARTIES = [
  PartyName.UNITY,
  PartyName.GREENS,
  PartyName.SCIENTISTS,
  PartyName.MARS,
  PartyName.INDUSTRIALISTS,
  PartyName.REDS,
] as const;
export type ReduxParty = typeof REDUX_PARTIES[number];

export function isReduxParty(party: PartyName): party is ReduxParty {
  return (REDUX_PARTIES as ReadonlyArray<PartyName>).includes(party);
}

/**
 * The Redux reading of a classic party name (rulebook p.13: «Kelvinists and
 * Greens are one and the same»). The ONE translation point every piece of
 * classic-Turmoil content goes through; nothing else may special-case it.
 */
export function normalizeReduxParty(party: PartyName): ReduxParty {
  if (party === PartyName.KELVINISTS) {
    return PartyName.GREENS;
  }
  if (isReduxParty(party)) {
    return party;
  }
  throw new Error(`Not a Redux party: ${party}`);
}

export const PARLIAMENT_DELEGATES_PER_PLAYER = 7;
export const PARLIAMENT_NEUTRAL_DELEGATES = 14;
/** M€ per delegate placed from the reserve once the lobby delegate is spent. */
export const PARLIAMENT_VOTE_COST = 5;
export const PARLIAMENT_VOTING_SLOTS = 3;
export const PARLIAMENT_MAX_POPULAR_SUPPORT = 3;
/**
 * WHAT «add up to `printed` neutral delegates to a party's Popular Support»
 * comes to RIGHT NOW — the one reading the promise (a prompt's forecast) and
 * the payout (`Parliament.addPopularSupport`) both stand on, produced by
 * `Parliament.popularSupportRoom`. `gained` is how many land (the area holds
 * `PARLIAMENT_MAX_POPULAR_SUPPORT`, the common supply may run out), and
 * `limit` NAMES what cut it short of `printed`: `area` — the area's ceiling
 * (judged first), `supply` — no neutral delegates left. Absent = nothing cut.
 */
export type SupportRoom = {
  current: number;
  gained: number;
  resulting: number;
  printed: number;
  limit?: 'area' | 'supply';
};

/**
 * THE ONE ARITHMETIC of a support area's room, over bare numbers: what the
 * area holds now, what the common supply holds now, what is printed. The live
 * table asks it through `Parliament.popularSupportRoom`; a PLAN that spends
 * the supply step by step BEFORE the table moves (Turmoil Redux TR31
 * Nationalist Movement — two neutral votes placed, then two areas paid from
 * what is left) asks it with its own running supply. One function, so the
 * forecast and the payout can never part by a second reading of «3 − current».
 */
export function supportRoomOf(current: number, supply: number, printed: number): SupportRoom {
  const area = Math.max(0, PARLIAMENT_MAX_POPULAR_SUPPORT - current);
  const left = Math.max(0, supply);
  const wanted = Math.max(0, printed);
  const gained = Math.min(wanted, area, left);
  const room: SupportRoom = {current, gained, resulting: current + gained, printed: wanted};
  if (gained < wanted) {
    room.limit = area <= left ? 'area' : 'supply';
  }
  return room;
}

/** The name a «neutral delegates to Popular Support» effect goes by where it is lost — the forecast's and the record's one label. */
export const POPULAR_SUPPORT_LABEL = 'Popular support';
/** The name a «neutral delegate onto a resolution» effect (TR31) goes by where the empty supply cuts it — one label for the forecast and the record. */
export const NEUTRAL_VOTE_LABEL = 'Neutral delegate on a resolution';
/** WHY none landed, by what cut the number — the forecast's tail and the after-the-fact record state the same cause. */
export const SUPPORT_LIMIT_REASON: Readonly<Record<NonNullable<SupportRoom['limit']>, string>> = {
  area: 'The support area is full',
  supply: 'No neutral delegates left',
};
/** The chip icon of a neutral delegate (the dark figure) — and of a player's own. */
export const NEUTRAL_DELEGATE_ICON = 'neutral-delegate';
export const DELEGATE_ICON = 'delegate';
/**
 * Own delegates on a party's resolution (rulebook p.7) — TWO numbers that happen to coincide:
 *  · the threshold of the party's EFFECT BY DEFAULT — a card in the tableau may LOWER it for its
 *    owner (TR36 Council Seat: «you only need 1 delegate»), and every surface reads the viewer's
 *    own threshold off the model (`PartyAccess.effectDelegates`), never this constant;
 *  · the threshold of a party's CARD REQUIREMENT — ALWAYS this number: a card-lowered effect never
 *    satisfies a requirement (FAQ p.19), so `satisfiesRequirement`, the hand's reason and the
 *    vote's `unlocksRequirement` read the constant on purpose.
 */
export const PARTY_EFFECT_DELEGATES = 2;
export const PARLIAMENT_AGENDA_STEPS = 12;

/**
 * One step a WALK of the Agenda track took: the step the marker reached and
 * the bonus that step paid on the spot (none for an influence step — the level
 * is a reading of the position). A record of a walk lists every step in order
 * (`ParliamentAdvanceModel.steps`), because a card walks the marker several
 * steps at once and «collects bonuses from each step» (TR04).
 */
export type AgendaAdvanceStep = {to: number; bonus?: 'tr' | 'card'};

/**
 * The THREE ENGINES of the track — the sitting's winner step, the chairman
 * quest, and a card that prints «advance your Agenda marker N steps». One
 * walk function serves all three (`ChairmanSeat.walkAgenda`).
 */
export type AgendaAdvanceReason = 'quest' | 'phase' | 'card';

/** One step of the Agenda track: it either raises the base influence or pays an immediate bonus. */
export type AgendaStep =
  | {kind: 'influence', influence: number}
  | {kind: 'tr'}
  | {kind: 'card'};

/** The printed track, left to right (index 0 = the first step a marker can stand on). */
export const AGENDA_TRACK: ReadonlyArray<AgendaStep> = [
  {kind: 'influence', influence: 1},
  {kind: 'tr'},
  {kind: 'influence', influence: 2},
  {kind: 'tr'},
  {kind: 'influence', influence: 3},
  {kind: 'tr'},
  {kind: 'card'},
  {kind: 'influence', influence: 4},
  {kind: 'tr'},
  {kind: 'card'},
  {kind: 'tr'},
  {kind: 'influence', influence: 5},
];

/**
 * Base influence for a marker at `position` (0 = no marker on the track yet,
 * 1..12 = the step it stands on): the highest influence step reached so far.
 */
export function influenceAtAgenda(position: number): number {
  let influence = 0;
  for (let i = 0; i < Math.min(position, AGENDA_TRACK.length); i++) {
    const step = AGENDA_TRACK[i];
    if (step.kind === 'influence') {
      influence = step.influence;
    }
  }
  return influence;
}

/**
 * What a CHAIRMAN QUEST asks for. Progress is counted from the player's OWN
 * actions in the action phase (see `server/parliament/quests`); the goal
 * only names WHAT counts.
 */
export type QuestGoal =
  | {kind: 'production', resource: Resource}
  | {kind: 'tag', tag: Tag}
  /**
   * A tile the player places. `special` is the printed SOLID BROWN HEX — a
   * special tile ON MARS, never a city (a city is its own goal), never a
   * greenery or an ocean, never a Moon tile or an Ares hazard.
   */
  | {kind: 'tile', tile: 'greenery' | 'city' | 'special' | 'spaceCity'}
  | {kind: 'colony'}
  | {kind: 'tr'}
  | {kind: 'cardResource', resource: CardResource}
  | {kind: 'delegates'}
  /**
   * Cards of a TYPE the player plays. An EVENT is a type here, never a tag:
   * the event tag is not printed in `card.tags` in this engine — it follows
   * from `CardType.EVENT` (`Tags.count`) — so a `{kind: 'tag', tag: EVENT}`
   * quest would sit at zero forever (Joint Research: «play 2 event cards»).
   */
  | {kind: 'cardsPlayed', cardType: 'automated' | 'active' | 'event'}
  /**
   * TRADES the player performs (Trade Industries: «trade 2 times» — the
   * footnote's black fleet-with-arrow glyph, decision Q-4). A trade is an
   * ACT of the seat's own turn — through the trade action, a card's action,
   * the Unity party's free trade — never the fleet count: «own N fleets»
   * would be the one quest about a STATE among eight about a deed, and a
   * fleet is rare enough that «gain 2 fleets in one generation» would sit at
   * zero forever. Reported by `Colony.trade` (the one door every trade goes
   * through), judged by the tracker's usual eligibility.
   */
  | {kind: 'trade'};

export type QuestDefinition = {
  goal: QuestGoal;
  count: number;
};

/** The printed quest of the empty ENACTED slot — generation 1 only (rulebook p.9). */
export const STARTER_QUEST: QuestDefinition = {goal: {kind: 'production', resource: Resource.HEAT}, count: 3};

/**
 * A resolution's stable identity — `RDX_<PARTY>_<N>` for the Redux catalog.
 * Never renamed once a save may carry it; a save naming an id the catalog no
 * longer knows fails to load EXPLICITLY (never a silent empty slot).
 */
export type ResolutionId = string;
/** One physical card of a resolution: `<id>#<copy>`, copies numbered from 0. */
export type ResolutionInstanceId = string;

/**
 * THE CATALOG CODE of a resolution — the printed identifier the face wears
 * in its corner stamp, the ART key (`assets/card-images/<code>.webp`) and the
 * search / debug key: the project cards' `metadata.cardNumber` twin, kept
 * apart from the internal id (a save key) and from the localized name.
 *
 * THE FAMILY: `RX##` — «RX» for the Redux resolutions (no project module
 * uses it: base `###`, promo `X##`, corporations `R##`, colonies `C##`,
 * prelude `P##`, turmoil `T##`, delta `DP##`, …), two digits = the
 * resolution's ORDINAL in the alphabetical list of the 48 official Turmoil
 * Redux resolutions (docs/TURMOIL_REDUX_SPEC.md §4 — Aquifer Contest is 01,
 * Architecture Award 02, Biodome Contest 03, … Water Export 48). Assigned by
 * hand in the definition, never derived from a deck or an array position;
 * the catalog refuses a duplicate. The never-dealt dev examples carry none.
 */
export type ResolutionCode = string;
export const RESOLUTION_CODE_PATTERN = /^RX\d{2}$/;

export function isResolutionCode(code: string | undefined): code is ResolutionCode {
  return code !== undefined && RESOLUTION_CODE_PATTERN.test(code);
}

export function resolutionInstanceId(id: ResolutionId, copy: number): ResolutionInstanceId {
  return `${id}#${copy}`;
}

export function resolutionIdOf(instance: ResolutionInstanceId): ResolutionId {
  const idx = instance.lastIndexOf('#');
  return idx < 0 ? instance : instance.substring(0, idx);
}

export type NeutralDelegate = 'NEUTRAL';

/** The parliament's end-of-generation steps, in order (see ParliamentPhase). */
export type ParliamentPhaseStep =
  | 'winner' // determine the winning resolution + the winning player
  | 'assembly' // GATE 1 (v2: BEFORE anything changes): every participant confirms the verdict (one prompt each; the barrier is the per-seat key)
  | 'agenda' // advance the winner's Agenda marker (+ the step's bonus)
  | 'support' // popular support for the absent / non-winning parties
  | 'enact' // the winner takes the ENACTED slot (delegates return, old card discarded)
  | 'effects' // the enacted resolution's immediate effects, player by player
  | 'refresh' // discard the two losers, deal three fresh resolutions, seat the neutral votes
  | 'lobby' // every player's free delegate returns to the lobby
  | 'adjourn' // GATE 2: every participant confirms the refreshed area (in the final phase: right after the effects)
  | 'done';

/** The two GATES of the political phase — the steps that wait for every participant's confirmation. */
export type ParliamentPhaseStage = Extract<ParliamentPhaseStep, 'assembly' | 'adjourn'>;

/**
 * How MarsBot takes part in the parliament (docs/TURMOIL_REDUX_MARSBOT.md §9):
 *  - `'none'` — iteration 0's observer: the bot keeps its ordinary turns and
 *    stays out of politics entirely (no delegates, no votes, no party
 *    effects, no quests, no prompts). A save written under it keeps it — the
 *    mode is never migrated (decision D9);
 *  - `'politics'` — the bot is a SEAT at the table: it holds delegates and
 *    votes (Party Politics, Lobbying), it can be the winning player (the
 *    Agenda step, the winner's reward — its own primitives) and it can
 *    complete the chairman quest by its ordinary play; an enacted law never
 *    pays it, never charges it, it holds no party effect and is never asked.
 * The seam is `server/parliament/BotParliamentPolicy.ts`, asked by ASPECT.
 */
export type BotParliamentMode = 'none' | 'politics';
export const BOT_PARLIAMENT_MODES: ReadonlyArray<BotParliamentMode> = ['none', 'politics'];

/**
 * THE ASPECTS OF TAKING PART — every place that asks «does this seat …?» names
 * WHICH part of the parliament it means, and the policy answers per aspect
 * (a human is in every aspect; the bot's answer is its mode's):
 *  - `delegates`     holds delegates: the lobby, the reserve, the ledger, the
 *                    vote, the Agenda marker and the influence it reads, the
 *                    seat row of the model;
 *  - `winner-reward` may be the WINNING PLAYER of a vote: the Agenda step of
 *                    the sitting and the winner's part of the enactment;
 *  - `enactment`     is PAID by an enacted law and charged by it: the seat
 *                    loop of the effects step, the passives, the discounts,
 *                    the value/tag bonuses, the law's action, every payout
 *                    reading of the model and the forecasts;
 *  - `party-effects` holds a party's effect (the ruling party's, two
 *                    delegates', a card's grant) and its actions;
 *  - `quest`         progresses the chairman quest by its own actions;
 *  - `prompts`       is ASKED: the sitting's gates, an asking step, the
 *                    quest gate, the seat pick.
 */
export const PARLIAMENT_ASPECTS = ['delegates', 'winner-reward', 'enactment', 'party-effects', 'quest', 'prompts'] as const;
export type ParliamentAspect = typeof PARLIAMENT_ASPECTS[number];

export const PARTY_ACTION_IDS = ['unity-trade', 'scientists-lab', 'industrialists-shift', 'reds-recycle'] as const;
export type PartyActionId = typeof PARTY_ACTION_IDS[number];

/** Which party owns each action (one action per party at most). */
export const PARTY_ACTION_OWNER: Readonly<Record<PartyActionId, ReduxParty>> = {
  'unity-trade': PartyName.UNITY,
  'scientists-lab': PartyName.SCIENTISTS,
  'industrialists-shift': PartyName.INDUSTRIALISTS,
  'reds-recycle': PartyName.REDS,
};

export function partyActionOf(party: ReduxParty): PartyActionId | undefined {
  for (const id of PARTY_ACTION_IDS) {
    if (PARTY_ACTION_OWNER[id] === party) {
      return id;
    }
  }
  return undefined;
}
