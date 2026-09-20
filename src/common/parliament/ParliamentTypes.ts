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
/** Own delegates on a party's resolution that grant its effect AND satisfy its card requirement. */
export const PARTY_EFFECT_DELEGATES = 2;
export const PARLIAMENT_AGENDA_STEPS = 12;

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
  | {kind: 'tile', tile: 'greenery' | 'city' | 'cityOrSpecial' | 'spaceCity'}
  | {kind: 'colony'}
  | {kind: 'tr'}
  | {kind: 'cardResource', resource: CardResource}
  | {kind: 'delegates'}
  | {kind: 'cardsPlayed', cardType: 'automated' | 'active'};

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
 * How MarsBot takes part in the parliament. Iteration 0 ships ONE mode:
 * the bot keeps its ordinary turns and stays out of politics entirely —
 * no delegates, no votes, no party effects, no quests, no prompts. A later
 * iteration replaces it with the bot's own political rules through the
 * same adapter (`server/parliament/BotParliamentPolicy.ts`).
 */
export type BotParliamentMode = 'none';

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
