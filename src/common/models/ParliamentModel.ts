import {Color} from '../Color';
import {SpaceId} from '../Types';
import {CardName} from '../cards/CardName';
import {Tag} from '../cards/Tag';
import {CardResource} from '../CardResource';
import {ColonyName} from '../colonies/ColonyName';
import {ColonyLedgerEntryModel} from './ColonyBonusLedgerModel';
import {Resource} from '../Resource';
import type {EffectForecast} from './EffectForecastModel';
import {ResolutionCountByCard, ResolutionCountByResource, ResolutionCountMetricModel, ResolutionCountModel} from '../parliament/resolutionCounts';
import type {CardResourceDestination} from '../parliament/influenceScaling';
import {ParameterMoveId} from '../parliament/parameterMove';
import {EventSource} from '../events/EventSource';
import {ColonyTrackMove} from '../parliament/colonyTrackAdvance';
import {TileType} from '../TileType';
import {PartyName} from '../turmoil/PartyName';
import {Message} from '../logs/Message';
import {PlayerInputType} from '../input/PlayerInputType';
import type {EventTrigger} from '../events/GameEvent';
import {ActionEffect} from './ActionPreviewModel';
import type {ActionFutilityVerdict} from './ActionFutilityModel';
import type {SelectProjectCardToPlayModel} from './PlayerInputModel';
import {BotParliamentMode, ParliamentPhaseStep, PartyActionId, QuestDefinition, ReduxParty, ResolutionId, ResolutionInstanceId, AgendaAdvanceReason, AgendaAdvanceStep, DelegateOwner, DelegatePlace, StandardMoves} from '../parliament/ParliamentTypes';

/** One delegate on a resolution, in placement order (`seq` is global and monotonic). */
export type ParliamentVoteModel = {
  owner: Color | 'neutral';
  seq: number;
};

export type ParliamentSlotModel = {
  instance: ResolutionInstanceId;
  resolution: ResolutionId;
  party: ReduxParty;
  votes: ReadonlyArray<ParliamentVoteModel>;
  totalVotes: number;
  /** The player who would win this resolution if it were enacted now (rulebook p.8). */
  leader?: Color | 'neutral';
  /** True for the resolution that would be enacted if the generation ended now. */
  isWinning: boolean;
  /** 1 = closest to the ENACTED slot — wins every tie among the three. */
  tiePriority: number;
  /** Delegates the VIEWER has on this card (the party-effect / requirement threshold). */
  viewerVotes: number;
  /**
   * WHAT THE TABLE ANSWERS to the resolution's WORLD MOVE, for the viewer
   * (PL-052): a card that pays on any player's raise (Aphrodite on Gas
   * Export's Venus) — the forecast engine's own facts, the same the
   * composers' «Сработает» row reads; the inspector's world block prints them.
   * Viewer-only; absent when nothing reacts or the law moves no scale.
   */
  worldForecast?: EffectForecast;
  /**
   * The seats first by rating NOW — what a RATING-VETOING candidate (RX42) would bind «as if enacted this moment»
   * (the same live reading the enacted law carries). Absent for every other candidate.
   */
  trVetoIfEnacted?: RatingVetoModel;
};

/**
 * WHO IS UNDER A RATING VETO (Turmoil Redux RX42 UNMI Veto) — read LIVE by the server at every model build from the
 * whole table (`ratingLeaders`: every seat first by terraform rating, MarsBot included in the comparison — a tie at
 * the top is every one of them), each with its rating. Every client surface that says «under the veto» / «the
 * highest rating now» reads THIS and counts nothing itself (invariant 2). A seat outside the law's `restriction`
 * aspect (MarsBot under `'none'`) may lead the comparison without being bound — `ParliamentPlayerModel.restriction`.
 */
export type RatingVetoModel = {
  leaders: ReadonlyArray<{color: Color, tr: number}>;
};

export type ParliamentEnactedModel = {
  instance: ResolutionInstanceId;
  resolution: ResolutionId;
  party: ReduxParty;
  /** The seats first by rating NOW, while the enacted law vetoes a rating (RX42); absent for every other law. */
  trVeto?: RatingVetoModel;
};

export type ParliamentQuestModel = {
  definition: QuestDefinition;
  /** 'starter' for the printed first-generation quest, else the resolution it belongs to. */
  source: 'starter' | ResolutionId;
  generation: number;
  progress: Readonly<Record<string, number>>; // keyed by Color
  completedBy?: Color;
  /**
   * Can MARSBOT reach this quest by its ordinary play (`botQuestPath.ts` —
   * a space city never, a card resource only with an area that holds it)?
   * Present only when a bot seat holds delegates (`'politics'`); the quest
   * block prints «unreachable for the bot» on `false`, never a silent 0/N.
   */
  botReachable?: boolean;
};

/** WHY a player holds a party's effect — every reason stands on its own. */
export type PartyAccessModel = {
  party: ReduxParty;
  ruling: boolean;
  /** Own delegates on the party's resolution (≥ `effectDelegates` grants the effect; ≥ PARTY_EFFECT_DELEGATES the requirement). */
  delegates: number;
  /**
   * THE SEAT'S OWN THRESHOLD of the delegates road — the printed two, or what
   * a card of theirs lowered it to (TR36 Council Seat: 1). The ONE number every
   * client surface draws its places and chooses its phrases by; a fixture
   * written before the field reads the printed default through the client's
   * `effectDelegatesOf` (the `enactment` → `seatEnacts` pattern). The card
   * REQUIREMENT is never this number (FAQ p.19).
   */
  effectDelegates?: number;
  /** The card that lowered the threshold — named by the surfaces that explain it (absent at the printed default). */
  effectDelegatesBy?: CardName;
  byDelegates: boolean;
  /**
   * THE ALLIANCE ROAD (TR62 Tharsis Alliance): this party's effect AND its card
   * requirement are the seat's because the PARTNER party `via` stands by its
   * printed road right now (`road`: it rules, or two of the seat's own
   * delegates on its resolution) — the card that made the pair in `source`.
   * Empty / absent while no alliance holds. Read on the client by ONE helper
   * (`accessRoadOf` — guard `parliamentAccessRoadGuard`).
   */
  allied?: ReadonlyArray<PartyAllianceRoadModel>;
  /**
   * THE PAIRS this party is in for the seat (standing, holding or not): the
   * partner and the card. What a dormant alliance still shows (the badge on
   * the seal, the second line of a requirement's reason).
   */
  alliances?: ReadonlyArray<PartyAllianceModel>;
  /** Card-granted access (a future Septem Tribus) — effect only, never the requirement. */
  granted: ReadonlyArray<string>;
  hasEffect: boolean;
  satisfiesRequirement: boolean;
};

/** One alliance a seat's table declares for a party: the partner party and the card (TR62). */
export type PartyAllianceModel = {partner: ReduxParty; source: CardName};

/** One alliance that HOLDS: the partner stands by its printed road (`ruling` / `delegates`). */
export type PartyAllianceRoadModel = {via: ReduxParty; source: CardName; road: 'ruling' | 'delegates'};

/**
 * ONE row of a seat's colony ledger: the tile, its printed colony bonus and
 * the seat's cubes on it (see `ParliamentPlayerModel.colonyBonuses`). The
 * shape lives in `ColonyBonusLedgerModel.ts` — a CARD paying «all your colony
 * bonuses» reads the same rows outside the Parliament.
 */
export type {ColonyLedgerEntryModel};

export type ParliamentPlayerModel = {
  color: Color;
  /**
   * The seat HOLDS DELEGATES (aspect `delegates`): a row in the seat zone,
   * a lobby / reserve / cubes on the cards, a marker on the Agenda track.
   * False for a MarsBot seat under `BotParliamentMode` `'none'`; true under
   * `'politics'`.
   */
  participates: boolean;
  /**
   * The seat IS PAID by an enacted law (aspect `enactment`) — the reader of
   * every payout surface (the ledger, the yields, the standing, the effects
   * strip): false for a MarsBot seat in EVERY mode (decision D3), true for a
   * human. Absent on a fixture written before the field — read it through
   * {@link seatEnacts}, never bare.
   */
  enactment?: boolean;
  /**
   * The seat PERFORMS THE DEED an enacted law grants the seats (aspect
   * `seat-grant`, decision D11) — the tile (`tileGrant`) and the step of the
   * Career (`agendaGrant`): true for a human and for a MarsBot seat under
   * `'politics'`: the bot's column then carries the deed's row (a tile, a
   * step) and still no payout. Absent on a fixture written before the field —
   * read it through {@link seatTakesSeatGrant}, never bare.
   */
  seatGrant?: boolean;
  /**
   * The seat is BOUND by a standing law's RESTRICTION (aspect `restriction`, RX42 UNMI Veto — decision Р3): true for a
   * human and for a MarsBot seat under `'politics'`; false for a bot under `'none'`, which may still lead the rating
   * comparison without being bound. Absent on a fixture written before the field — read it through
   * {@link seatRestricted}, never bare.
   */
  restriction?: boolean;
  lobby: boolean;
  reserve: number;
  onResolutions: number;
  chairman: boolean;
  agenda: number;
  influence: number;
  /**
   * WHAT the influence BEYOND THE AGENDA TRACK is made of — one entry per
   * giver («Паллада +1»), in the order it was given. Present only for a
   * participating seat that HAS such a bonus: the Information zone lists the
   * sources of a number the player can otherwise only take on faith, and a
   * seat whose influence is the track's alone prints no «bonuses 0» line.
   * `source` is a NAME (a card's, a colony's) the client translates; an entry
   * without one is a nameless bonus (an older save).
   */
  influenceSources?: ReadonlyArray<{amount: number, source?: string}>;
  /**
   * WHO lifts this seat's PARTY requirements on cards right now — Backroom Deal TR70 while armed (`oneShot`), The
   * Deimos Group TR83 while on the table (standing) — the very source the requirement reads
   * (`IPlayer.partyRequirementWaiver`). The Parliament's own roads (`access`) never read it: a requirement is the
   * card's. The party plaque says «requirement lifted — <source>»; a standing one silences the vote's «unlocks the
   * requirement». Absent when nothing lifts them.
   */
  partyRequirementWaiver?: {source: EventSource, oneShot: boolean};
  /**
   * The seat's COUNTS for every counted term a resolution of the catalog
   * declares (`resolutionCounts.ts`) — the number and the cards, read from
   * the tableau by the server. Absent for a seat outside the parliament.
   */
  counts?: ReadonlyArray<ResolutionCountModel>;
  /**
   * The seat's PRODUCTIONS a SEQUENTIAL effect of the catalog divides
   * («1 card for every 3 steps of heat production you have» — Climate
   * Research). Only the resources some declaration names; absent for a seat
   * outside the parliament. Every surface computes the second half of a
   * chained effect from THIS number, so the estimate and the payout stand on
   * the same reading.
   */
  production?: Readonly<Partial<Record<Resource, number>>>;
  /**
   * THE SEAT'S SUPPLY a LEVY of the catalog takes from (the Budgets' «lose 10
   * M€» — `resolutionLevy.ts`): only the resources some declaration names;
   * absent for a seat outside the parliament. The vote panel's net line and
   * the stand read the seat's shortfall from THIS number — the same supply
   * the levy step will read at the enactment.
   */
  stock?: Readonly<Partial<Record<Resource, number>>>;
  /**
   * THE SEAT'S COLONY LEDGER — every colony tile the seat has a cube on, in
   * the table's order, with the tile's PRINTED colony bonus as a grant
   * (`ColonyTradeGrantModel` — the trade manifest's own shape) and its printed
   * description (the colony's English key). Present only while some
   * resolution of the catalog pays «all your colony bonuses» (Colonial
   * Affairs); every surface reads THIS list — the client never derives it
   * from the colonies model (the server's rule of what a colony bonus is).
   */
  colonyBonuses?: ReadonlyArray<ColonyLedgerEntryModel>;
  /**
   * THE SEAT'S HAND SIZE a LEVEL part of the catalog tops up (Joint
   * Research's «draw until you have 6 + influence in hand»): present only
   * while some declaration reads the hand; absent for a seat outside the
   * parliament. Every surface computes the top-up from THIS number — the
   * same count the step will read (cards withheld in a pending intake are
   * not in it, exactly as the step sees the hand).
   */
  hand?: number;
  /**
   * EVERY CARD-RESOURCE UNIT LANDS for this seat — MarsBot under 'politics' (D16): it holds no tableau, and a
   * law's animals / microbes / floaters / data become M€ under the hood, so «no card can hold …» is never its
   * reading. Absent for every human seat (the holder law reads their tableau).
   */
  everyUnitLands?: true;
  /**
   * The seat holds NO party effect — MarsBot (RB-C p.6: it ignores the ruling party's policy): no party answers its
   * tile, no party effect is its. Absent for every human seat (the server's `party-effects` aspect).
   */
  noPartyEffects?: true;
  access: ReadonlyArray<PartyAccessModel>;
  partyActionUses: Partial<Record<PartyName, number>>;
  resolutionActionUses: number;
};

/**
 * IS THE SEAT PAID BY AN ENACTED LAW — the ONE reading of `enactment` every
 * payout surface gates on. A model from the server always carries the field;
 * a fixture written before it did not, and for those a seat that takes part
 * is a seat that is paid — exactly what `participates` meant then.
 */
export function seatEnacts(seat: Pick<ParliamentPlayerModel, 'participates' | 'enactment'>): boolean {
  return seat.enactment ?? seat.participates;
}

/** Is the seat BOUND by a standing law's restriction (RX42)? A fixture from before the field: a human is, a bot is not. */
export function seatRestricted(seat: Pick<ParliamentPlayerModel, 'participates' | 'enactment' | 'restriction'>): boolean {
  return seat.restriction ?? seatEnacts(seat);
}

/**
 * DOES THE SEAT PERFORM THE DEED A LAW GRANTS THE SEATS — a tile, a step of
 * the Career — the ONE reading of `seatGrant` (decision D11). An older
 * fixture's seat performs it exactly when it is paid (what the field meant
 * before the bot took a deed).
 */
export function seatTakesSeatGrant(seat: Pick<ParliamentPlayerModel, 'participates' | 'enactment' | 'seatGrant'>): boolean {
  return seat.seatGrant ?? seatEnacts(seat);
}

/** The viewer's own vote options — one projection per voting slot. */
export type VoteProjectionModel = {
  instance: ResolutionInstanceId;
  votesAfter: number;
  leaderAfter?: Color | 'neutral';
  /** The viewer would become (or stay) the card's leader. */
  viewerLeads: boolean;
  /** The card would become (or stay) the winning resolution. */
  becomesWinning: boolean;
  /** This delegate reaches the party-effect threshold. */
  unlocksEffect: boolean;
  unlocksRequirement: boolean;
  /**
   * THE ALLIANCE THIS DELEGATE OPENS (TR62): the delegate brings the card's
   * party to its PRINTED road for the viewer, and the viewer's table allies
   * that party with `party` — whose effect and cards become the viewer's with
   * it. Absent when nothing allied opens (no pair, or the ally is the viewer's
   * already by a road the requirement knows).
   */
  unlocksAlliance?: {party: ReduxParty; source: CardName};
  /** Ties resolved in the viewer's favour by an earlier delegate (rulebook p.8). */
  tieNote?: 'earlier-delegate' | 'slot-priority';
};

export type VoteOptionModel = {
  available: boolean;
  /** English i18n key naming the blocker ('' when available). */
  reason: string;
  source: 'lobby' | 'reserve' | 'none';
  cost: number;
  projections: ReadonlyArray<VoteProjectionModel>;
};

/**
 * What EVERY action of the Mars Parliament tells its viewer — a party's action
 * and the enacted resolution's action alike (Turmoil Redux): access, the uses
 * left this generation, the server's verdict with its reason, the result
 * chips. One shape, so the action menu's tile, the Parliament's plaque and
 * the composer read a party and a resolution by the same fields.
 */
export type ParliamentActionModel = {
  hasAccess: boolean;
  usesLeft: number;
  usesPerGeneration: number;
  available: boolean;
  reason: string | Message;
  /** Server-computed result chips (`current → resulting` where known). */
  preview: ReadonlyArray<ActionEffect>;
};

export type PartyActionModel = ParliamentActionModel & {
  id: PartyActionId;
  party: ReduxParty;
};

/**
 * THE ENACTED RESOLUTION'S ACTION for the viewer (Open IP Trade's «discard any
 * number of cards; 3 M€ and a card for each») — the party action's twin, a
 * member of the same family. `hasAccess`: the viewer participates and the
 * enacted card has an action (a spectator, MarsBot and a table whose law has
 * no action all read `false`). Present only while a resolution with an
 * action stands enacted.
 */
export type ResolutionActionModel = ParliamentActionModel & {
  resolution: ResolutionId;
  party: ReduxParty;
  /**
   * THE ACTION WOULD CHANGE NOTHING right now — the server's proven verdict
   * (Live Experiments RX36: every card its waiver lets through is playable
   * without it). Information, never a block: the action stays available;
   * present only while it is.
   */
  futile?: ActionFutilityVerdict;
  /**
   * AN ACTION THAT PLAYS A CARD (Live Experiments RX36): the card pick it asks
   * after its bill, PROMISED — so the console can choose the card and compose
   * its play before the one commit. Present only while the action is available.
   */
  play?: ResolutionPlayModel;
};

/**
 * THE CARD PLAY A RESOLUTION ACTION PROMISES (Live Experiments RX36 — «pay
 * 6 M€ to play a card ignoring all global parameter requirements»): the live
 * `SelectProjectCardToPlay` the action raises after its bill, in its own shape
 * (the precollect contract — a preview is a promise of the live prompt's form).
 * Every hand card is listed: the ones the law lets through ENABLED, the rest
 * DISABLED with their reason; each card's requirement is read with the waiver
 * standing (`CardModel.requirementEasing` names the law, `decisive` where the
 * law is what lets it through).
 */
export type ResolutionPlayModel = {
  input: SelectProjectCardToPlayModel;
  /** The M€ the bill takes BEFORE the card is paid — the card's payment reads the rail less this. */
  reserve: number;
  /**
   * The bill raises a payment prompt of its own (Helion's heat, Luna's
   * titanium can pay it) — nothing is pre-collected then: the console takes
   * the live road (the bill stage, then the live pick).
   */
  billAsks: boolean;
};

/**
 * THE PENDING KEY of the winner's table answering its step of the Career (TR78 Arwind Inc.: «add 1 fighter to ANY
 * card») — the sitting waits on it between the `agenda` step and the support, published as the phase's `pending` so
 * every other seat reads who is answering what.
 */
export const AGENDA_REACTION_PENDING_KEY = 'agenda-reaction';

export type ParliamentPhasePendingModel = {
  player: Color;
  key: string;
  /**
   * WHAT the asked seat is answering — its live prompt's input type ('card' a
   * card pick, 'space' a placement, 'or' a choice, …). Lets every OTHER seat
   * read an honest «waiting for X to choose a card» without knowing the step.
   */
  input?: PlayerInputType;
};

/**
 * What ONE STEP of the enacted resolution's effect ACTUALLY did for one
 * player — the server's own record (`SerializedEnactOutcome`), never a
 * recomputation: the amount is the amount paid. A `skipped` outcome names
 * its reason (an English i18n key) — no silent loss.
 */
export type ParliamentEnactOutcomeModel = {
  /**
   * The seat the record belongs to — ABSENT on a WORLD record (`part: 'world'`):
   * the enactment moved the PLANET, which belongs to no player and is read the
   * same by every viewer.
   */
  player?: Color;
  step: string;
  /** `effect` — everyone's part · `world` — the table's own · `winner` — the winner's (absent on older saves). */
  part?: 'effect' | 'world' | 'winner';
  /** The scaled effect's id (`InfluenceScaledEffect.id`) when the amount came from influence. */
  effect?: string;
  /**
   * `cardResource` onto a card · `production` · `stock` into the supply · `cards`
   * drawn projects · `discard` a card thrown away (Pluto's second half) ·
   * `colonyBonus` a colony bonus paid through its own counter (a discount, a
   * loss, a science tag) · `ocean` / `greenery` the winner's tile · `colony`
   * the winner's colony built for free (Colony Contest — see `colony`) ·
   * `city` a CITY TIER built onto the seat's own city (Skyscrapers — see
   * `space` and `stackHeight`) · `globalParameter` a WORLD move of a global
   * parameter (see `parameter`; `amount` = the steps actually made, negative
   * for a lowering) · `colonyTrack` a WORLD move of EVERY colony track (see
   * `tracks`; `amount` = the steps declared) · `agenda` a seat's walk of the
   * Career track a law granted (see `walk`) · `skipped` · `reaction` the
   * RULING PARTY's answer to this step's own change.
   */
  kind: 'cardResource' | 'production' | 'stock' | 'cards' | 'discard' | 'colonyBonus' | 'ocean' | 'greenery' | 'colony' | 'city' | 'globalParameter' | 'colonyTrack' | 'tileRemoved' | 'agenda' | 'skipped' | 'reaction';
  /**
   * The COLONY whose printed bonus this record pays (Colonial Affairs) — the ledger row it belongs to;
   * for the `colony` kind, the tile the winner's cube landed on.
   */
  colony?: ColonyName;
  /** …how many times that bonus was paid in this one record (the resolution's multiplier k). */
  multiplier?: number;
  /** …and the seat's cubes on that tile when MORE THAN ONE (each pays in full — the amount is k × cubes × the printed quantity). */
  cubes?: number;
  /** `colonyBonus`: the tile's printed description of the bonus (the colony's own English key). */
  description?: string;
  /**
   * `reaction`: the answering party and what it answered (the Greens' M€
   * production for a heat-production raise, their M€ for the TR of the
   * winner's tile) — derived by the driver from the recorder's own events
   * inside the step, never re-stated by the resolution; `production` / `stock`
   * name the resource it paid, `amount` the sum inside the step, `before` /
   * `after` the value around it. The record shares the STEP of the change it
   * answered — a reading groups it under its cause by `step`.
   */
  party?: PartyName;
  trigger?: EventTrigger;
  /** `cardResource` (and its skip): the ONE kind of the units — absent when an effect over several kinds landed units of more than one (see `resources`, `cards[].resource`). */
  resource?: CardResource;
  /** `cardResource` of an effect over SEVERAL kinds («data or microbe»): the kinds in the declared order — the unit's name where `resource` cannot say it. */
  resources?: ReadonlyArray<CardResource>;
  /** `production` (and its skip): the standard resource whose production the effect raises. */
  production?: Resource;
  /**
   * `stock` (and its skip): the standard resource the effect adds to the
   * supply — or TAKES from it: a LEVY (the Budgets' «lose 10 M€») is a `stock`
   * record with a NEGATIVE `amount`, never a skip.
   */
  stock?: Resource;
  amount?: number;
  /** A LEVY: what was OWED beside `amount` (what was taken) — above `−amount` exactly when the seat was short (see `reason`). */
  owed?: number;
  /** `cardResource`: the ONE card the whole amount landed on (absent when spread over several — see `cards`). */
  card?: CardName;
  /**
   * `cardResource`: WHERE the units landed, card by card — every reader's list; one recipient is a list of one.
   * `resource` is the kind THAT card took (its own storage rule) — the unit's kind where the effect spans several.
   * An `each-counted` payout (see `onto`) freezes what the card held BEFORE and what the unit did to its points.
   */
  cards?: ReadonlyArray<{card: CardName; amount: number; resource?: CardResource; before?: number; vp?: {from: number; to: number}}>;
  /** `cardResource` (and its skip): the payout asked NOBODY — one unit onto EVERY counted card, each of its own kind (Sponsored Projects). */
  onto?: CardResourceDestination;
  space?: SpaceId;
  /** `city`: the cell's stack AFTER the tier landed («a stack of 2») — frozen, never re-read from a later board. */
  stackHeight?: number;
  reason?: string;
  influence?: number;
  /** A counted term (B) at the enactment, and the cards it counted — frozen, never re-read from a later tableau. */
  count?: number;
  counted?: ReadonlyArray<CardName>;
  /** …and what each of those cards contributed (a TAG count: a two-power-tag card is 2). */
  countedUnits?: ReadonlyArray<number>;
  /** A count over SEVERAL tags: each tag's own total («Venus 1 · Jovian 2»). */
  countedByTag?: ReadonlyArray<{tag: Tag; count: number}>;
  /** A BOARD count: the CELLS counted at the enactment (a tile has no card — `counted` is empty, this list explains the number). */
  countedSpaces?: ReadonlyArray<SpaceId>;
  /** A BOARD count of the `tiers` measure: each counted cell's stack height (aligned with `countedSpaces`) — how «4 from 3 cells» explains itself. */
  countedTiers?: ReadonlyArray<number>;
  /** A THRESHOLD count: the BREAKDOWN of the metric at the enactment (no list — the value, the threshold, the step and the sets explain the number). */
  countedMetric?: ResolutionCountMetricModel;
  /** A PRODUCTION count: each resource's own steps at the enactment («steel 2 · titanium 1 · energy 3») — frozen, never re-read. */
  countedByResource?: ReadonlyArray<ResolutionCountByResource>;
  /** A COLONIES count: the tiles the counted cubes stood on at the enactment (a name per cube) — frozen, never re-read from a later table. */
  countedColonies?: ReadonlyArray<ColonyName>;
  /** A HOLDERS count: every counted card with the kind it held and how many at the enactment («Fish 2 · Dirigibles 1») — frozen, never re-read. */
  countedByCard?: ReadonlyArray<ResolutionCountByCard>;
  /** The formula's sum before the cap (above `amount` exactly when the cap bit). */
  uncapped?: number;
  /** `production` / `stock`: the value before and after. */
  before?: number;
  after?: number;
  /**
   * A SEQUENTIAL amount: the player TOTAL it was divided from, before and
   * after the earlier effect moved it («heat production 4 → 6 → 2 cards»).
   * The server's own reading — never recomputed from today's production.
   */
  total?: {before: number; after: number};
  /**
   * A LEVEL effect (Joint Research's «until you have 6 + influence in hand»):
   * the TARGET the seat was brought up to, beside `total` (the hand before
   * and after) and `amount` (the difference owed). Recorded, never recomputed.
   */
  target?: number;
  /** `cards`: how many actually left the deck (below `amount` only when the deck ran out). */
  drawn?: number;
  /** A card draw handed over as a mandatory intake — the intake's id. */
  intake?: number;
  /** A winner tile, a winner's STEP, or a WORLD move: the global parameter that moved, before and after (equal at the limit). */
  parameter?: {id: ParameterMoveId; before: number; after: number};
  /** `colonyTrack` (and its skip): every colony tile in play with its marker before and after — equal at the end of the track. */
  tracks?: ReadonlyArray<ColonyTrackMove>;
  /** `globalParameter` of a WORLD move: nobody was credited with a terraform rating for this move. */
  unrewarded?: boolean;
  /**
   * `globalParameter` of the WINNER's own step (Mohole Contest): the terraform
   * rating the step paid the winner — measured around the engine's call, so a
   * card hook that adds to it is counted honestly. Absent on a world move
   * (which credits nobody) and on a skip.
   */
  tr?: number;
  /**
   * `agenda` (Reds Budget): the seat's own WALK of the Career track the law
   * granted — from, to and every step with its bonus, in order. The sitting's
   * scene plays these records seat by seat (never `lastAdvance`, one per game);
   * `tr` the rating it paid, `drawn` the cards a card step dealt,
   * `megacredits` what MarsBot took instead of a card (1 M€ each).
   */
  walk?: {from: number; to: number; steps: ReadonlyArray<AgendaAdvanceStep>};
  megacredits?: number;
  /**
   * `tileRemoved` (Water Export): the tile that LEFT the cell `space` names —
   * frozen with the record (the cell may carry a new tile by the time it is read).
   */
  tile?: TileType;
  /**
   * `tileRemoved`: WHO CHOSE the cell — the first player the printed rule
   * names (the nearest human when that seat was MarsBot). A fact of the
   * choice, never the record's owner: `player` stays absent on a world record.
   */
  actor?: Color;
};

/**
 * THE SITTING AS THIS SEAT STANDS IN IT. While the political phase runs it is
 * the phase itself (every seat alike); once its chain is over, a seat that has
 * not CLOSED it yet (the soft gates — `ParliamentModel.sitting`) still reads
 * its sitting here at `step: 'done'` with the finished summary, until its own
 * confirmation answers — the next generation already runs around it.
 */
export type ParliamentPhaseModel = {
  generation: number;
  final: boolean;
  step: ParliamentPhaseStep;
  winner?: {instance: ResolutionInstanceId; player?: Color | 'neutral'};
  pending?: ParliamentPhasePendingModel;
  /** The effect's outcomes recorded SO FAR (the enactment stage reads them live). */
  outcomes?: ReadonlyArray<ParliamentEnactOutcomeModel>;
  /**
   * THE SEATS THAT CLOSED THIS SITTING EARLY (the early confirmation — the chain waited on another seat and nothing
   * was asked of them): the sitting no longer holds them; a question the law asks one later comes as an ordinary
   * prompt. Absent when nobody has.
   */
  closed?: ReadonlyArray<Color>;
  /**
   * THE SEATS WHOSE PART OF THE LAW IS STILL AHEAD (a step of their plan not yet applied — it MAY ask): the waiting
   * page tells a seat «you may still be asked» or «your part is done». Read off the effects' own plan, never guessed.
   */
  ahead?: ReadonlyArray<Color>;
  /**
   * The sitting's summary SO FAR — the SAME shape a finished phase leaves in
   * `lastPhase` (and the history keeps), so the live sitting, the closing and
   * a later review read one form. Filled from the first step on.
   */
  summary?: ParliamentPhaseSummaryModel;
};

/**
 * THE SOFT GATES' RECORD on the wire — the seats that have not CLOSED the last
 * sitting yet (`SerializedSittingAcks`). A FACT for the results page's quiet
 * note and the probes, never an «ожидание»: nobody waits for these seats but
 * the barriers they belong to (the draft round, the research, the final
 * sitting). Absent when nobody owes it.
 */
export type ParliamentSittingAcksModel = {
  generation: number;
  seq: number;
  final: boolean;
  pending: ReadonlyArray<Color>;
};

/**
 * ONE PHYSICAL EVENT OF THE RENEWAL (`SerializedRenewalEvent`, players and
 * delegates named by colour) — the client's renewal beat plays these in this
 * exact order: a loser leaves (its delegates home first, per owner), the
 * discard turns over into a new deck, a revealed card is rejected, a card is
 * dealt into its slot, a party's support becomes votes on it, a slot stays
 * empty, a free delegate enters a lobby.
 */
export type ParliamentRenewalEventModel =
  | {kind: 'leave'; instance: ResolutionInstanceId; resolution: ResolutionId; party: ReduxParty; slot: number; returned: ReadonlyArray<{owner: Color | 'neutral'; count: number}>}
  | {kind: 'reshuffle'; size: number}
  | {kind: 'reject'; instance: ResolutionInstanceId; resolution: ResolutionId; party: ReduxParty; slot: number; reason: 'party-in-area' | 'party-enacted'}
  | {kind: 'deal'; instance: ResolutionInstanceId; resolution: ResolutionId; party: ReduxParty; slot: number; source: 'deck' | 'reshuffled'}
  | {kind: 'support'; party: ReduxParty; instance: ResolutionInstanceId; count: number}
  | {kind: 'empty'; slot: number}
  | {kind: 'lobby'; player: Color}
  /** A card of `player`'s tableau answered the `leave` before it (TR02): `count` `resource` landed on `card`. */
  | {kind: 'card-effect'; player: Color; card: CardName; resource: CardResource; count: number; instance: ResolutionInstanceId};

/**
 * What the LAST completed end-of-generation phase did — a summary the client
 * presents once (keyed by generation) and never reconstructs from the log.
 */
export type ParliamentPhaseSummaryModel = {
  generation: number;
  final: boolean;
  /** The sitting's monotonic number — the client's «played once» key (absent on a save from before the sittings). */
  seq?: number;
  /** The journal group of the whole phase (`political-phase`) — the protocol's key (absent on older saves). */
  correlationId?: number;
  /** `slot` — the voting slot the winner stood in (0 = closest to ENACTED); absent on older saves. */
  winner: {instance: ResolutionInstanceId; resolution: ResolutionId; party: ReduxParty; votes: number; player?: Color | 'neutral'; tieBreak?: 'slot-priority' | 'earlier-delegate'; slot?: number};
  /**
   * The winner's step of the Career. `answer` — what the TABLE paid back on it (the ruling Greens' 2 M€ for its rating),
   * measured by the walk: ПОВЕСТКА tells it a beat after the step's chip, the record attached to the step.
   */
  agenda?: {player: Color; from: number; to: number; bonus?: 'tr' | 'card'; answer?: StandardMoves};
  /** The enacted resolution's effect as it was ACTUALLY applied, step by step (absent on older saves / no effect). */
  outcomes?: ReadonlyArray<ParliamentEnactOutcomeModel>;
  support: ReadonlyArray<{party: ReduxParty; gained: number; total: number; reason: 'absent' | 'lost' | 'lost-with-player-vote'}>;
  enacted: ParliamentEnactedModel;
  discardedEnacted?: ParliamentEnactedModel;
  /** The delegates that left the enacted card at the enactment, per owner — the client's return flights (absent on older saves). */
  returned?: ReadonlyArray<{owner: Color | 'neutral'; count: number}>;
  refreshed: ReadonlyArray<{instance: ResolutionInstanceId; resolution: ResolutionId; party: ReduxParty; neutralVotes: number}>;
  /** The losers the refresh discarded, in their slot order — the renewal beat flies them off the table (absent before the refresh / on older saves). */
  discarded?: ReadonlyArray<{instance: ResolutionInstanceId; resolution: ResolutionId; party: ReduxParty}>;
  lobbyRefilled: ReadonlyArray<Color>;
  /**
   * THE RENEWAL JOURNAL — every physical event of the refresh and the lobby
   * steps in the server's order; the ONLY thing the renewal beat plays.
   * Absent before the refresh, on the final sitting and on older saves (the
   * refreshed table is then shown without a beat).
   */
  renewal?: ReadonlyArray<ParliamentRenewalEventModel>;
  /**
   * THE CARDS' ANSWERS TO THE CHANGE OF POWER (TR62 / TR63 — `ICard.onRulingPartyChanged`), as the enactment
   * MEASURED them: the client presents them at the enactment's tail (a card off the deck, a rating token, the table's
   * answer). Absent when no card answered.
   */
  rulingAnswers?: ReadonlyArray<ParliamentRulingAnswerModel>;
  /**
   * THE CUBES THE SITTING PUT ON BANNERS (Septem Tribus:redux — `ICard.onResolutionWon`): whose cube, the party
   * of the won resolution, the card. The client plays ONE beat per entry at the enactment («куб на знамя»); a
   * cube that already stood is not here. Absent when none was placed.
   */
  bannerCubes?: ReadonlyArray<ParliamentBannerCubeModel>;
};

/** ONE cube a sitting put on a party's banner. */
export type ParliamentBannerCubeModel = {player: Color; party: ReduxParty; card: CardName};

/** ONE card's answer to a change of power: whose, which card, the party that came to power, what it measured. */
export type ParliamentRulingAnswerModel = {
  player: Color;
  card: CardName;
  party: ReduxParty;
  tr?: number;
  cards?: number;
  /** The standard stock the table paid back in the same call (the ruling Greens' M€ for the rating), by resource. */
  stock?: Partial<Record<string, number>>;
  /** The production the card raised (TR64 Promethean Alliance — `megacredits: 2`), by resource. */
  production?: Partial<Record<string, number>>;
};

/**
 * The LAST WALK of an Agenda marker — a mid-generation quest completion, the
 * political phase's winner step, or a card that walks the marker several steps
 * (TR04). The client plays it ONCE (`seq` is the key): the marker glides step
 * by step, each step's reward following its own landing (`steps`, in order).
 * `bonus` is the LAST step's — the one-step readers' field; a reader that can
 * meet a walk of more than one step reads `steps`.
 */
export type ParliamentAdvanceModel = {
  seq: number;
  player: Color;
  from: number;
  to: number;
  bonus?: 'tr' | 'card';
  steps: ReadonlyArray<AgendaAdvanceStep>;
  reason: AgendaAdvanceReason;
  /** The card that walked the marker (`reason: 'card'`). */
  card?: CardName;
  /**
   * The LAW that walked the marker (`reason: 'resolution'` — Reds Budget). A
   * law walks SEVERAL seats in one response, so this record (the last walk) is
   * never what the client plays — the sitting plays the phase's `agenda`
   * outcomes, seat by seat.
   */
  resolution?: ResolutionId;
  generation: number;
};

/**
 * ONE NEUTRAL VOTE a card placed (Turmoil Redux TR31 Nationalist Movement):
 * the resolution, the cube's placement number (its place on the ribbon), the
 * card's votes once it stands, and WHICH resolution is the winning one once
 * it stands — the marker moves on THIS touchdown, never before (`winnerAfter`
 * changing between two consecutive entries is the move).
 */
export type ParliamentRallyVoteModel = {
  instance: ResolutionInstanceId;
  resolution: ResolutionId;
  party: ReduxParty;
  seq: number;
  votes: number;
  winnerAfter: ResolutionInstanceId | undefined;
  /** The card won the vote by standing closer to ENACTED (its votes equal another's). */
  tieNote?: 'slot-priority';
};

/** ONE support area a card paid (TR31): the party, what landed and the room's reading (a cut NAMES its cause). */
export type ParliamentRallySupportModel = {
  party: ReduxParty;
  current: number;
  gained: number;
  resulting: number;
  printed: number;
  limit?: 'area' | 'supply';
};

/**
 * THE LAST RALLY OF NEUTRAL DELEGATES BY A CARD (Turmoil Redux TR31
 * Nationalist Movement — docs/TURMOIL_REDUX_NATIONALIST_MOVEMENT.md): what
 * the card put on the table, in the PRINTED order — the neutral votes (one
 * per resolution of the named parties up for a vote), the support areas
 * (one cube each, the area's ceiling and the supply judged as the phase
 * judges them), then the RECOUNT the M€ stands on. The client plays it ONCE
 * (`seq` is the key) and derives nothing from the counters' deltas: `counted`
 * is the FULL list of what the recount marks — every neutral cube in use
 * AFTER the rally, votes by slot in the table's order, then the six areas —
 * because by the time the scene runs the table may have moved on. A
 * presentation record: not serialized, lost on a reload (the table is not).
 */
export type ParliamentRallyModel = {
  seq: number;
  player: Color;
  card?: CardName;
  /** The resolution that was winning BEFORE the first cube landed (the marker's hold). */
  winnerBefore: ResolutionInstanceId | undefined;
  votes: ReadonlyArray<ParliamentRallyVoteModel>;
  /** The named parties whose resolution was NOT up for a vote — a named zero, nothing lost. */
  missing: ReadonlyArray<ReduxParty>;
  /** The named parties whose vote the EMPTY SUPPLY cut (a named skip). */
  votesCut: ReadonlyArray<{party: ReduxParty, instance: ResolutionInstanceId, resolution: ResolutionId}>;
  support: ReadonlyArray<ParliamentRallySupportModel>;
  counted: {
    votes: ReadonlyArray<{instance: ResolutionInstanceId, seqs: ReadonlyArray<number>}>;
    support: ReadonlyArray<{party: ReduxParty, count: number}>;
  };
  /** Neutral delegates IN USE (not in the reserve) before → after the rally. */
  inUse: {before: number, after: number};
  /** The M€ the recount paid — `inUse.after`. */
  megacredits: number;
  generation: number;
};

/**
 * THE LAST DELEGATE A CARD TOOK OFF THE TABLE (Turmoil Redux TR72 Banned Delegate:redux): the place it left —
 * a resolution (`instance`, and `vote` the very cube's `seq`, so the client lifts THAT figure off the ledger) or
 * a party's support area — whose it was and where it went. The client plays it ONCE (`seq` is the key) and
 * derives nothing from the counters' deltas. A presentation record: not serialized, lost on a reload (the
 * table is not).
 */
export type ParliamentDelegateRemovalModel = {
  seq: number;
  /** Whose effect it was (the card's player). */
  player: Color;
  card?: CardName;
  place: DelegatePlace;
  party: ReduxParty;
  instance?: ResolutionInstanceId;
  resolution?: ResolutionId;
  /** The `seq` of the vote that left the resolution (absent for a support cube — the area's cubes are a count). */
  vote?: number;
  owner: DelegateOwner;
  returnsTo: 'reserve' | 'supply';
  /** What the place holds after it (every vote on the resolution / the area's stock). */
  total: number;
  /**
   * AN EXCHANGE (Turmoil Redux TR74 Recruitment:redux): the card's player's own delegate that came from their reserve
   * and took the neutral figure's place on the same resolution — `vote` is its `seq` (the last on the bill). The
   * client plays it as the SECOND move of the same phrase: the neutral figure carried to the supply, then this one
   * set down from the reserve stack. `total` above already counts it.
   */
  exchange?: {vote: number};
  generation: number;
};

export type ParliamentModel = {
  slots: ReadonlyArray<ParliamentSlotModel>;
  enacted?: ParliamentEnactedModel;
  rulingParty: ReduxParty;
  chairman?: Color;
  quest?: ParliamentQuestModel;
  popularSupport: Readonly<Record<string, number>>; // keyed by ReduxParty
  players: ReadonlyArray<ParliamentPlayerModel>;
  deckSize: number;
  discardSize: number;
  neutralSupply: number;
  phase?: ParliamentPhaseModel;
  lastPhase?: ParliamentPhaseSummaryModel;
  /** The finished sittings, oldest first (the last 24 — the protocol's source; absent until the first). */
  phaseHistory?: ReadonlyArray<ParliamentPhaseSummaryModel>;
  /** Who has not closed the last sitting yet (the soft gates); absent when nobody owes it. */
  sitting?: ParliamentSittingAcksModel;
  lastAdvance?: ParliamentAdvanceModel;
  /** The last rally of neutral delegates by a card (TR31) — played once by `seq`; absent until the first, and after a reload. */
  lastRally?: ParliamentRallyModel;
  /** The last delegate a card removed (TR72) — played once by `seq`; absent until the first, and after a reload. */
  lastRemoval?: ParliamentDelegateRemovalModel;
  botMode: BotParliamentMode;
  /** Present on the viewer's own model only. */
  viewer?: {
    vote: VoteOptionModel;
    partyActions: ReadonlyArray<PartyActionModel>;
    /** The enacted resolution's action — absent while no enacted law has one (see {@link ResolutionActionModel}). */
    resolutionAction?: ResolutionActionModel;
  };
};
