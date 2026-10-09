/*
 * @console-shared LIVE — console native stands on this file.
 *
 * ЛЕНТА ЧТЕНИЯ («Заседание v5», docs/claude/prompts/parliament-gaps-v5.md §1–2) —
 * the PURE half of the middle zone's upper strip.
 *
 * THE CONTRACT. The middle zone is a BAND and a BODY, and that is its only
 * anatomy in every mode. The band is a strip of FIXED height at the top of the
 * zone: it exists always (the overview too), it never disappears, it never
 * changes height, and only its CONTENT crossfades — exactly like the crumb's
 * tail. The body below it is the row of parties by default and changes only
 * twice a sitting (an embedded step the player works in, the results panel).
 *
 * WHAT THE BAND SAYS. One question: «why is what I see on the table happening
 * right now». It therefore never repeats what an object on screen already says
 * itself — the enacted card prints its own effect in the government, each tile
 * carries its own support word, the Agenda marker shows its own step. The band
 * names the REASON and the objects the reason is about:
 *
 *   обзор      · which resolution is enacted as things stand, and who would be
 *                the winner of the vote;
 *   вердикт    · the winner of the vote BY NAME and that they take an Agenda
 *                step — said BEFORE the marker moves (without it the player is
 *                simply moved along a track for no stated reason);
 *   повестка   · what the step gave: the influence level reached, or the bonus;
 *   поддержка  · the rule of the wave now playing — first the parties nobody
 *                spoke for, then the unenacted resolutions;
 *   принятие   · the resolution now in force and the party that rules by it;
 *   награда    · the WHOLE payout formula, while the chips fly to the rail;
 *   обновление · popular support becoming votes;
 *   итоги      · the generation's results, as the heading of the panel below.
 *
 * FORM. A quiet tracked-caps KICKER, then the content: chips, seats, numbers,
 * icons. No prose, no wrapping. On a narrow profile the kicker yields first,
 * then the secondary chips, in a strict order (`flex-basis: 0` + `min-width` +
 * `max-width: max-content` — never shrink weights); a cut is an ellipsis in the
 * member's OWN box, never by an ancestor.
 *
 * PURE: reads the server's own records (the phase summary, the recorded
 * outcomes, the vote's standing) and the director's published beat; decides
 * nothing about the game, touches no DOM. Spec: `tests/console/parliamentBand.spec.ts`.
 */
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import type {WinnerRewardGlyph} from './winnerRewardModel';
import {ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';
import {ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {InfluenceYield, levelTakesAway} from '@/common/parliament/influenceScaling';
import {LevyReading} from '@/common/parliament/resolutionLevy';
import {ParameterMoveId} from '@/common/parliament/parameterMove';
import {ColonyTrackMoveChip} from './colonyTrackModel';
import {SittingRewardStep, SittingStage} from './consoleSittingFlow';
import {SupportStatus} from './supportScene';

/** The beat of the enactment the director is playing ('' at rest) — `sittingMotion.beat`. */
export type BandBeat = '' | 'agenda' | 'support' | 'enact';

/** ONE member of the line. Everything is data: the component binds it, the model orders it. */
export type BandChip =
  /** A short label — an i18n key, never a sentence. */
  | {kind: 'label', key: string, tone?: 'quiet' | 'accent'}
  /** A resolution: its party's emblem and its printed name. */
  | {kind: 'resolution', resolution: ResolutionId, party: ReduxParty}
  /** A party: its emblem and its name. */
  | {kind: 'party', party: ReduxParty}
  /** A seat: its cube and its name. */
  | {kind: 'player', player: Color | 'neutral'}
  /** A count under its own word («Делегаты 5»); `id` names the chip for a scene that is born on it (the rally's coin). */
  | {kind: 'count', key: string, amount: number, id?: string}
  /**
   * The Agenda step's own gift: the influence level it sets (the GLYPH with the level in one disc — parliament
   * law 14, never a bare numeral), or the bonus it hands over.
   */
  | {kind: 'agenda', to: number, level?: number, bonus?: 'tr' | 'card'}
  /** The payout formula — the reward's reading, printed whole (with the LEVY a budget takes first, when there is one). */
  | {kind: 'yield', yields: ReadonlyArray<InfluenceYield>, levy?: LevyReading}
  /** The ruling party's answer to a step of the payout. */
  | {kind: 'reaction', party: ReduxParty, resource?: string, amount?: number}
  /** A part that paid nothing: what, how much it would have paid, and why — never a silent loss. */
  | {kind: 'skip', id: string, title: string, reason: string, amount?: number, unit?: string, units?: ReadonlyArray<string>}
  /** The winner's part: a tile waiting behind the door to the board, the colony built in the sitting's own step, or the parameter the winner's own step raises. */
  | {kind: 'tile', tile: WinnerRewardGlyph}
  /**
   * A TILE GRANTED BY THRESHOLD (Skyscrapers): the viewer's own standing — theirs by the vote or the
   * influence line, the destinations it may land on, the stack once it did. The band component draws it
   * from the reading it computes; a viewer whose record is a SKIP reads the skip chip instead.
   */
  | {kind: 'grant', tile: 'city'}
  /**
   * THE WORLD'S OWN MOVE (Gas Export): what the law did to the PLANET — the
   * parameter, where it stood, where it landed, and the fact that nobody was
   * credited for it. It belongs to no seat, so it is the same chip for every
   * viewer; a move that could not happen names its reason instead.
   */
  | {kind: 'world', parameter: ParameterMoveId, before: number, after: number, steps: number, unrewarded: boolean, skipped?: string}
  /**
   * THE COLONY TABLE'S OWN MOVE (Unity Budget): what the law did to EVERY colony track — the declared
   * steps, and each tile with its marker before and after (a tile at the end of its track is named, never
   * dropped). It belongs to no seat, so it is the same chip for every viewer; a table with no tile at all
   * names its reason instead.
   */
  | {kind: 'tracks', steps: number, tiles: ReadonlyArray<ColonyTrackMoveChip>, skipped?: string}
  /** The seats the phase is still waiting for. */
  | {kind: 'awaiting', seats: ReadonlyArray<Color>}
  /**
   * A PARTY'S POPULAR SUPPORT LEAVING (TR12 Party Sanctions): the party's emblem, the neutral cube and the
   * count that returns to the common supply («[emblem] [cube] −3») — the server's own `current − resulting`.
   */
  | {kind: 'supportDelta', party: ReduxParty, amount: number};

/** THE LINE: one kicker, one ordered set of chips, and the identity its crossfade is keyed on. */
export type BandLine = {
  /** The beat's quiet kicker (an i18n key). */
  kicker: string;
  /** The line's identity — the crossfade fires exactly when this changes. */
  key: string;
  chips: ReadonlyArray<BandChip>;
  /** Past the commit boundary the accent turns amber (the console's own pre-/post-commit grammar). */
  committed: boolean;
  /**
   * THE LINE IS THE WHOLE READING OF A RESOLUTION THAT PAYS NOTHING. The director dwells on it (a page
   * whose entire content is a reading must be readable — v4's own finding, and the band is where that
   * reading lives now); the marker is published on the band so the beat can wait for it.
   */
  quiet?: 'passive' | 'action';
};

/**
 * ONE WORD OF STATE beside the reward's kicker. A payout is «эта выплата»
 * then «получено»; a CUT is «эта потеря» then «отнято» — thanking the
 * player for a loss is the one thing this slot must never do.
 */
export type BandRewardState = 'This payout' | 'Received' | 'This loss' | 'Taken';

/**
 * THIS SEAT'S OWN PART IS A CUT: every reading of it TAKES (Plant Ban). Read
 * off the DECLARATION the readings carry, never off a record's sign — the band
 * states the line before the first chip has left.
 */
export function bandRewardTakes(yields: ReadonlyArray<InfluenceYield>): boolean {
  return yields.length > 0 && yields.every((y) => levelTakesAway(y.effect));
}


/** The reward's reading, as DATA — the one thing the band cannot derive from the summary alone. */
export type BandRewardReading = {
  yields: ReadonlyArray<InfluenceYield>;
  /** THE LEVY a budget takes FIRST — the viewer's own reading (recorded once the seat's record is in). */
  levy?: LevyReading;
  reactions: ReadonlyArray<{party: ReduxParty, resource?: string, amount?: number}>;
  skips: ReadonlyArray<{id: string, title: string, reason: string, amount?: number, unit?: string, units?: ReadonlyArray<string>}>;
  /** The winner's part: the tile still to be placed, the colony still to be built (`colony`), or the parameter the winner's step raises. */
  tile?: WinnerRewardGlyph;
  /** A tile granted by threshold (Skyscrapers): the viewer's own tier — pending, or placed (never a skip: the skip chip says that). */
  grant?: 'city';
  /** The WORLD's own part of the enactment — the planet's moves, in the server's order. */
  world?: ReadonlyArray<{parameter: ParameterMoveId, before: number, after: number, steps: number, unrewarded: boolean, skipped?: string}>;
  /** The COLONY TABLE's own part of the enactment (Unity Budget) — every track's move, in the server's order. */
  tracks?: {steps: number, tiles: ReadonlyArray<ColonyTrackMoveChip>, skipped?: string};
  /** Nothing is paid to this seat: what remains instead (the passive that now stands / the action to take). */
  quiet?: {kicker: string, kind: 'passive' | 'action'};
  /** One word of state beside the kicker: «эта выплата» until every chip has landed, «получено» after — or the CUT's own pair. */
  state?: BandRewardState;
  /** The effects are asking ANOTHER seat. */
  waitingFor?: Color;
  /**
   * THE WINNER'S PART IS ANOTHER SEAT'S, and this seat has no part of its own on the line (a skip at
   * most): the line is the WINNER'S reward, led by the tile, and never calls itself «ваша награда»
   * (docs/TURMOIL_REDUX_MARSBOT.md §8.6 — a bot's win draws the spectator no reward of theirs; the
   * same law for a human winner's spectator who was paid nothing).
   */
  winnerElsewhere?: boolean;
};

/** What the OVERVIEW's line reads off the table when no sitting stands. */
export type BandStanding = {
  /** The resolution that would be enacted as things stand. */
  resolution?: {resolution: ResolutionId, party: ReduxParty};
  /** …and who would be the winner of the vote on it. */
  player?: Color | 'neutral';
  /** Delegates on that resolution — zero means nobody has voted at all. */
  votes: number;
};

/**
 * THE RENEWAL'S CUE — the journal event the director is PLAYING right now
 * (`sittingMotion.renewal`), so the band says what is happening on the table
 * at this moment: which card leaves, that the discard turns over, which card
 * was revealed and why it goes back, which card is dealt, whose support
 * becomes votes, which slot stays empty, whose delegate enters the lobby.
 */
export type BandRenewalCue = {
  /** The event's index in the journal — a new index is a new line. */
  index: number;
  kind: 'leave' | 'reshuffle' | 'reject' | 'deal' | 'support' | 'empty' | 'lobby' | 'card-effect';
  resolution?: ResolutionId;
  party?: ReduxParty;
  reason?: 'party-in-area' | 'party-enacted';
  count?: number;
  player?: Color;
  /** `leave`: the delegates that go home first, per owner. */
  returned?: ReadonlyArray<{owner: Color | 'neutral', count: number}>;
  /** `card-effect`: the card that answered the leave and the resource it collected (`count` of them). */
  card?: CardName;
  resource?: CardResource;
};

export type BandSitting = {
  stage: SittingStage;
  rewardStep: SittingRewardStep;
  /** The director's own beat inside the enactment ('' at rest). */
  beat: BandBeat;
  /** …and the wave of the support beat now playing. */
  supportWave: '' | SupportStatus;
  /** The renewal event now playing (undefined between events / at rest). */
  renewal?: BandRenewalCue;
  generation: number;
  awaiting: ReadonlyArray<Color>;
  summary?: ParliamentPhaseSummaryModel;
  reward: BandRewardReading;
};

/**
 * «ПРЕДСЕДАТЕЛЬСТВО» — the chairman-quest flow's own reading. The band is the
 * ONLY reading this flow has (the body stays the overview: the objects the
 * beats move — the quest block, the chair, the Agenda marker — are all on the
 * table already, and a panel over them would cover the very things that fly).
 * It names the REASON of the beat that is playing, never what an object says
 * itself: the quest block prints its own condition and its own «✓ Выполнено»,
 * so the line says who closed it and WHAT IT PAYS — the office, then the step.
 */
export type BandQuest = {
  /** The director's beat ('' before it starts). */
  beat: '' | 'task' | 'seat' | 'agenda' | 'done';
  /** The seat that closed the quest. */
  player?: Color;
  /** The office as it stood at the open (undefined = the seat was empty) — named while it changes hands. */
  seatWas?: Color;
  /** The Agenda move the answer produced, once the server has answered. */
  move?: {from: number, to: number, bonus?: 'tr' | 'card'};
};

/**
 * «КАРЬЕРА» — a card's WALK of the Agenda track (TR04) shown as the outcome of
 * its play: the seat whose marker walks and the steps it has LANDED on so
 * far, each with what it set or paid. The chips grow one landing at a time —
 * a step's chip appears when the cube has touched the step, never as a batch.
 */
export type BandWalk = {
  player: Color;
  landed: ReadonlyArray<{to: number, bonus?: 'tr' | 'card', level?: number}>;
};

/**
 * «САНКЦИИ» — the SUPPORT-AREA mode (TR12): the stage's own word, the plaque under the cursor and what the
 * press would send back to the common supply (or why that area is refused). Cyan until A, amber after it.
 */
export type BandSupport = {
  stage: string;
  party: ReduxParty | undefined;
  leaving: number;
  available: boolean;
  reason?: string;
  committed: boolean;
};

/**
 * «ДЕЛЕГАТЫ» — a card's RALLY of neutral delegates (TR31) shown as the outcome of its play: the votes LANDED so
 * far (a resolution chip each), the areas READ so far (a party chip each — with its named zero when it took
 * none), and — once the recount has begun — the count of neutral delegates in use, growing one mark at a time.
 * The chips grow one touchdown at a time, never as a batch; the number ticks in place.
 */
export type BandRally = {
  votes: ReadonlyArray<{resolution: ResolutionId, party: ReduxParty}>;
  support: ReadonlyArray<{party: ReduxParty, gained: number, limit?: 'area' | 'supply'}>;
  /** The recount's number so far; `undefined` before the recount begins. */
  counted: number | undefined;
};

/** The count chip's id — the coin is born on this chip's counter (`[data-parl-count-id]`). */
export const RALLY_COUNT_CHIP_ID = 'rally';

export type BandContext = {
  /** `undefined` outside a live sitting the viewer takes part in — the overview's line. */
  sitting?: BandSitting;
  /** `undefined` outside the chairman-quest flow — it outranks the overview, never the sitting (they cannot coexist). */
  quest?: BandQuest;
  /** `undefined` outside a card's walk — it outranks the overview and the quest (a walk is never live during either). */
  walk?: BandWalk;
  /** `undefined` outside a card's rally of neutral delegates (TR31) — it outranks the overview exactly as the walk does. */
  rally?: BandRally;
  /** `undefined` outside the support-area mode — a walk that follows it in the same flow outranks it (the walk is the beat on the table then). */
  support?: BandSupport;
  standing: BandStanding;
};

/** The support wave's own rule — the ONE statement of what is being paid and to whom. */
function supportRuleKey(wave: '' | SupportStatus): string {
  return wave === 'lost' ? 'Unenacted resolutions' : 'Not in the vote';
}

/**
 * THE LINE for the zone's current beat. Never `undefined`: the band exists in
 * every mode, so an empty table still reads «ОБЗОР · делегатов на столе нет».
 */
export function parliamentBandLine(ctx: BandContext): BandLine {
  const sitting = ctx.sitting;
  if (sitting === undefined) {
    if (ctx.walk !== undefined) {
      return walkLine(ctx.walk);
    }
    if (ctx.rally !== undefined) {
      return rallyLine(ctx.rally);
    }
    if (ctx.support !== undefined) {
      return supportLine(ctx.support);
    }
    return ctx.quest === undefined ? overviewLine(ctx.standing) : questLine(ctx.quest);
  }
  switch (sitting.stage) {
  case 'verdict':
    return verdictLine(sitting);
  case 'enact':
    return enactLine(sitting);
  case 'reward':
    return rewardLine(sitting);
  case 'renewal':
    return renewalLine(sitting);
  case 'results':
    return resultsLine(sitting);
  }
}

/**
 * КАРЬЕРА — a card's walk: the seat's cube, then one chip per LANDED step in
 * the walk's order — an influence step as the glyph with its level, a paying
 * step with its bonus. Past the commit throughout (the play is made; the
 * record is the answer). The line's key stands for the WHOLE walk (PL-119): a
 * landing grows one chip, which enters by itself (the band keys it on its
 * step), while the chips already read stand still — a key that grew per step
 * re-crossfaded the unchanged line on every landing.
 */
function walkLine(walk: BandWalk): BandLine {
  const chips: Array<BandChip> = [{kind: 'player', player: walk.player}];
  for (const step of walk.landed) {
    chips.push({kind: 'agenda', to: step.to, ...(step.level === undefined ? {} : {level: step.level}), ...(step.bonus === undefined ? {} : {bonus: step.bonus})});
  }
  return {kicker: 'Agenda track', key: `walk:${walk.player}`, chips, committed: true};
}

/**
 * ДЕЛЕГАТЫ — a card's rally of neutral delegates (TR31): the neutral player's cube, then one resolution chip
 * per LANDED vote, one party chip per READ area (its named zero in the quiet register when it took none),
 * and the recount's number once it has begun. The key grows with every touchdown and read — never with the
 * recount's ticks (fourteen crossfades would be a flicker: the number ticks in place on its own key).
 */
function rallyLine(rally: BandRally): BandLine {
  const chips: Array<BandChip> = [{kind: 'player', player: 'neutral'}];
  for (const vote of rally.votes) {
    chips.push({kind: 'resolution', resolution: vote.resolution, party: vote.party});
  }
  for (const area of rally.support) {
    chips.push({kind: 'party', party: area.party});
    if (area.gained <= 0) {
      chips.push({kind: 'label', key: area.limit === 'supply' ? 'no neutral delegates left' : 'area is full', tone: 'quiet'});
    }
  }
  if (rally.counted !== undefined) {
    chips.push({kind: 'count', key: 'in use', amount: rally.counted, id: RALLY_COUNT_CHIP_ID});
  }
  const key = `rally:${rally.votes.map((v) => v.resolution).join(',')}:${rally.support.map((s) => s.party).join(',')}:${rally.counted === undefined ? '' : 'count'}`;
  return {kicker: 'Neutral delegates', key, chips, committed: true};
}

/**
 * САНКЦИИ — the support-area mode: the plaque under the cursor and the cubes the press sends back to the
 * common supply («[emblem] [cube] −3»), or the plaque's own refusal in the quiet register. The key follows
 * the cursor (one crossfade per plaque) and the commit (cyan → amber), and stands still between them.
 */
function supportLine(support: BandSupport): BandLine {
  const chips: Array<BandChip> = [];
  const party = support.party;
  if (party !== undefined) {
    if (support.available && support.leaving > 0) {
      chips.push({kind: 'supportDelta', party, amount: support.leaving});
    } else {
      chips.push({kind: 'party', party});
      chips.push({kind: 'label', key: support.reason ?? 'The support area is empty', tone: 'quiet'});
    }
  }
  return {
    kicker: support.stage,
    key: `support:${party ?? ''}:${support.available ? support.leaving : 'x'}:${support.committed ? 'c' : 'o'}`,
    chips,
    committed: support.committed,
  };
}

/**
 * ЗАДАНИЕ · ПРЕДСЕДАТЕЛЬСТВО · ПОВЕСТКА — one line per beat of the
 * chairmanship flow. Past the commit throughout: the quest is closed and the
 * answer is on its way before the first beat even plays.
 */
function questLine(quest: BandQuest): BandLine {
  const chips: Array<BandChip> = [];
  const player = quest.player;
  if (quest.beat === 'agenda' || quest.beat === 'done') {
    const move = quest.move;
    if (move === undefined) {
      chips.push({kind: 'label', key: 'end of the track', tone: 'quiet'});
      return {kicker: 'Agenda track', key: 'quest:agenda:end', chips, committed: true};
    }
    if (player !== undefined) {
      chips.push({kind: 'player', player});
    }
    chips.push({kind: 'agenda', to: move.to, bonus: move.bonus});
    return {kicker: 'Agenda track', key: `quest:agenda:${player ?? ''}:${move.to}`, chips, committed: true};
  }
  if (quest.beat === 'seat') {
    if (player !== undefined) {
      chips.push({kind: 'player', player});
    }
    if (quest.seatWas !== undefined && quest.seatWas !== player) {
      // The outgoing delegate's own fact — where it GOES, not what was lost.
      chips.push({kind: 'label', key: 'The delegate returns to the reserve', tone: 'quiet'});
      chips.push({kind: 'player', player: quest.seatWas});
    }
    return {kicker: 'Chairmanship', key: `quest:seat:${quest.seatWas ?? ''}:${player ?? ''}`, chips, committed: true};
  }
  // ЗАДАНИЕ — who closed it, and what the closing pays (the block's own foot
  // reads «ВЫПОЛНИЛ · игрок» from here on and no longer states the reward).
  chips.push({kind: 'label', key: 'Completed', tone: 'quiet'});
  if (player !== undefined) {
    chips.push({kind: 'player', player});
  }
  chips.push({kind: 'label', key: 'Chairmanship'});
  return {kicker: 'Quest', key: `quest:task:${player ?? ''}`, chips, committed: true};
}

/** ОБЗОР — what is enacted as things stand, and who would win it. */
function overviewLine(standing: BandStanding): BandLine {
  const chips: Array<BandChip> = [];
  if (standing.resolution === undefined) {
    chips.push({kind: 'label', key: 'No resolution is up for a vote', tone: 'quiet'});
    return {kicker: 'Parliament overview', key: 'overview:none', chips, committed: false};
  }
  chips.push({kind: 'label', key: 'Winning', tone: 'quiet'});
  chips.push({kind: 'resolution', resolution: standing.resolution.resolution, party: standing.resolution.party});
  if (standing.player === undefined) {
    // An untouched vote is honest about itself: the slot order alone stands it up, and nobody wins anything.
    chips.push({kind: 'label', key: 'No delegates on the table', tone: 'quiet'});
  } else {
    chips.push({kind: 'label', key: 'Winning player', tone: 'quiet'});
    chips.push({kind: 'player', player: standing.player});
  }
  return {
    kicker: 'Parliament overview',
    key: `overview:${standing.resolution.resolution}:${standing.player ?? ''}:${standing.votes}`,
    chips,
    committed: false,
  };
}

/** ВЕРДИКТ — the winner of the vote by name, and the Agenda step they take (said BEFORE the marker moves). */
function verdictLine(sitting: BandSitting): BandLine {
  const summary = sitting.summary;
  const chips: Array<BandChip> = [];
  if (summary === undefined) {
    chips.push({kind: 'label', key: 'No resolution is up for a vote', tone: 'quiet'});
    return {kicker: 'Verdict', key: 'verdict:none', chips, committed: false};
  }
  chips.push({kind: 'resolution', resolution: summary.winner.resolution, party: summary.winner.party});
  chips.push({kind: 'count', key: 'Delegates', amount: summary.winner.votes});
  chips.push({kind: 'label', key: 'Winning player', tone: 'quiet'});
  chips.push({kind: 'player', player: summary.winner.player ?? 'neutral'});
  // WHY THE MARKER IS ABOUT TO MOVE, said BEFORE it does — the one line v4 was missing. It is the RULE
  // («the winner of the vote advances one step»), not the recorded move: at gate 1 the server has not run
  // the Agenda step yet, so a chip conditioned on `summary.agenda` would be absent exactly where it is
  // needed. The neutral player advances nothing, and then nothing is claimed.
  const winner = summary.winner.player;
  if (winner !== undefined && winner !== 'neutral') {
    chips.push({kind: 'label', key: 'Agenda step', tone: 'quiet'});
  }
  if (summary.winner.tieBreak !== undefined) {
    chips.push({kind: 'label', key: summary.winner.tieBreak === 'slot-priority' ?
      'Tie broken by the slot order' : 'Tie broken by the earlier delegate', tone: 'quiet'});
  }
  if (sitting.awaiting.length > 0 && sitting.rewardStep === 'gate') {
    chips.push({kind: 'awaiting', seats: sitting.awaiting});
  }
  return {kicker: 'Verdict', key: `verdict:${summary.winner.instance}:${sitting.rewardStep}`, chips, committed: false};
}

/** ПОВЕСТКА · ПОДДЕРЖКА · ПРИНЯТИЕ — one line per beat of the enactment; at rest, the law that now stands. */
function enactLine(sitting: BandSitting): BandLine {
  const summary = sitting.summary;
  const chips: Array<BandChip> = [];
  if (summary === undefined) {
    return {kicker: 'Enactment', key: 'enact:none', chips, committed: true};
  }
  if (sitting.beat === 'agenda' && summary.agenda !== undefined) {
    const move = summary.agenda;
    chips.push({kind: 'player', player: move.player});
    chips.push({kind: 'agenda', to: move.to, bonus: move.bonus});
    return {kicker: 'Agenda track', key: `agenda:${move.player}:${move.to}`, chips, committed: true};
  }
  if (sitting.beat === 'support') {
    chips.push({kind: 'label', key: supportRuleKey(sitting.supportWave)});
    chips.push({kind: 'label', key: 'gain a neutral delegate', tone: 'quiet'});
    return {kicker: 'Popular support', key: `support:${sitting.supportWave}`, chips, committed: true};
  }
  chips.push({kind: 'resolution', resolution: summary.enacted.resolution, party: summary.enacted.party});
  chips.push({kind: 'label', key: 'Ruling party', tone: 'quiet'});
  chips.push({kind: 'party', party: summary.enacted.party});
  return {kicker: 'Enactment', key: `enact:${summary.enacted.instance}`, chips, committed: true};
}

/** НАГРАДА — the payout formula whole, while the chips fly to the rail. */
function rewardLine(sitting: BandSitting): BandLine {
  const reward = sitting.reward;
  const chips: Array<BandChip> = [];
  if (reward.yields.length > 0) {
    chips.push({kind: 'yield', yields: reward.yields, ...(reward.levy === undefined ? {} : {levy: reward.levy})});
  }
  for (const reaction of reward.reactions) {
    chips.push({kind: 'reaction', ...reaction});
  }
  if (reward.tile !== undefined) {
    chips.push({kind: 'tile', tile: reward.tile});
  }
  if (reward.grant !== undefined) {
    chips.push({kind: 'grant', tile: reward.grant});
  }
  // THE PLANET, after the seat's own part — the card's own order («каждому M€;
  // затем кислород и Венера»), which the journal keeps too.
  for (const move of reward.world ?? []) {
    chips.push({kind: 'world', ...move});
  }
  // …AND THE COLONY TABLE, in the same place of the card's order («каждому M€; затем все треки колоний»).
  if (reward.tracks !== undefined) {
    chips.push({kind: 'tracks', ...reward.tracks});
  }
  for (const skip of reward.skips) {
    chips.push({kind: 'skip', ...skip});
  }
  if (reward.yields.length === 0 && reward.quiet !== undefined) {
    // THE QUIET REWARD: nothing is paid to this seat — what remains instead. The card's own wording is NOT
    // repeated: the enacted resolution prints its standing effect in the government, one tier up.
    chips.push({kind: 'label', key: reward.quiet.kicker});
    if (reward.quiet.kind === 'action') {
      chips.push({kind: 'label', key: 'Available in Card actions', tone: 'quiet'});
    }
  }
  if (reward.waitingFor !== undefined) {
    chips.push({kind: 'awaiting', seats: [reward.waitingFor]});
  } else if (chips.length === 0) {
    chips.push({kind: 'label', key: 'Your record is in', tone: 'quiet'});
  }
  if (sitting.awaiting.length > 0 && sitting.rewardStep === 'gate') {
    chips.push({kind: 'awaiting', seats: sitting.awaiting});
  }
  // THE WINNER'S LINE: another seat's part is the only reward here — the tile leads, the seat's own
  // skips follow it (a skipped part still names itself — never a silent loss).
  const winnersLine = reward.winnerElsewhere === true && reward.tile !== undefined;
  if (winnersLine) {
    const tileAt = chips.findIndex((chip) => chip.kind === 'tile');
    if (tileAt > 0) {
      const [tileChip] = chips.splice(tileAt, 1);
      chips.unshift(tileChip);
    }
  }
  return {
    // A CUT IS NOT A REWARD, and the line that carries it may not call itself one: the same slot
    // names what LEAVES («Что вы теряете»), decided by the DECLARATION the readings carry.
    kicker: winnersLine ? 'Reward for the winner of the vote' : bandRewardTakes(reward.yields) ? 'What you lose' : 'Your reward',
    key: `reward:${sitting.rewardStep}:${reward.state ?? ''}:${reward.yields.length}:${reward.skips.length}:${(reward.world ?? []).length}:${reward.tracks?.tiles.length ?? ''}:${reward.grant ?? ''}:${winnersLine ? 'winner' : ''}`,
    chips,
    committed: true,
    ...(reward.yields.length === 0 && reward.quiet !== undefined ? {quiet: reward.quiet.kind} : {}),
  };
}

/**
 * ОБНОВЛЕНИЕ — the renewal's own rule («popular support becomes votes»), and
 * WHAT IS HAPPENING ON THE TABLE at this moment: the journal event the
 * director is playing. The reason and the objects only — the card that
 * leaves, the pile that turns over, the card refused and why, the card dealt,
 * the party whose stock seats, the slot that stays empty and why, the seat
 * whose delegate returns. Never prose, never what an object says itself (the
 * empty slot prints its own reason on the table; the line names the fact).
 */
function renewalLine(sitting: BandSitting): BandLine {
  const cue = sitting.renewal;
  const chips: Array<BandChip> = [];
  if (cue === undefined) {
    chips.push({kind: 'label', key: 'Popular support becomes votes'});
    return {kicker: 'Renewal', key: 'renewal', chips, committed: true};
  }
  switch (cue.kind) {
  case 'leave':
    chips.push({kind: 'label', key: 'Leaves the table', tone: 'quiet'});
    if (cue.resolution !== undefined && cue.party !== undefined) {
      chips.push({kind: 'resolution', resolution: cue.resolution, party: cue.party});
    }
    if ((cue.returned?.length ?? 0) > 0) {
      chips.push({kind: 'label', key: 'delegates go home', tone: 'quiet'});
      for (const entry of cue.returned ?? []) {
        chips.push({kind: 'player', player: entry.owner});
      }
    }
    break;
  case 'reshuffle':
    chips.push({kind: 'label', key: 'The deck is empty'});
    chips.push({kind: 'label', key: 'the discard is reshuffled into a new deck', tone: 'quiet'});
    break;
  case 'reject':
    chips.push({kind: 'label', key: 'Revealed', tone: 'quiet'});
    if (cue.resolution !== undefined && cue.party !== undefined) {
      chips.push({kind: 'resolution', resolution: cue.resolution, party: cue.party});
    }
    chips.push({kind: 'label', key: cue.reason === 'party-enacted' ? 'its party rules — back to the discard' : 'its party is already on the table — back to the discard'});
    break;
  case 'deal':
    chips.push({kind: 'label', key: 'Dealt', tone: 'quiet'});
    if (cue.resolution !== undefined && cue.party !== undefined) {
      chips.push({kind: 'resolution', resolution: cue.resolution, party: cue.party});
    }
    break;
  case 'support':
    if (cue.party !== undefined) {
      chips.push({kind: 'party', party: cue.party});
    }
    chips.push({kind: 'label', key: 'Popular support becomes votes'});
    if (cue.count !== undefined) {
      chips.push({kind: 'count', key: 'Delegates', amount: cue.count});
    }
    break;
  case 'empty':
    chips.push({kind: 'label', key: 'Empty slot'});
    chips.push({kind: 'label', key: 'The deck has no resolution of another party', tone: 'quiet'});
    break;
  case 'lobby':
    chips.push({kind: 'label', key: 'A free delegate enters the lobby', tone: 'quiet'});
    if (cue.player !== undefined) {
      chips.push({kind: 'player', player: cue.player});
    }
    break;
  case 'card-effect':
    // A CARD ANSWERED THE LEAVE (TR02 Political Science): whose card, what it collected (the resource's
    // own word — «Данные 2»), and the card by name (a card name is an i18n key of its own). The rule it
    // answers is on the card; the line names the fact.
    if (cue.player !== undefined) {
      chips.push({kind: 'player', player: cue.player});
    }
    if (cue.resource !== undefined && cue.count !== undefined) {
      chips.push({kind: 'count', key: cue.resource, amount: cue.count});
    }
    if (cue.card !== undefined) {
      chips.push({kind: 'label', key: cue.card});
    }
    break;
  }
  return {kicker: 'Renewal', key: `renewal:${cue.index}:${cue.kind}`, chips, committed: true};
}

/** ИТОГИ — the generation's number, as the heading of the panel that stands below. */
function resultsLine(sitting: BandSitting): BandLine {
  const chips: Array<BandChip> = [{kind: 'count', key: 'Generation', amount: sitting.generation}];
  if (sitting.awaiting.length > 0 && sitting.rewardStep === 'gate') {
    chips.push({kind: 'awaiting', seats: sitting.awaiting});
  }
  return {kicker: 'Results', key: `results:${sitting.generation}:${sitting.rewardStep}`, chips, committed: true};
}
