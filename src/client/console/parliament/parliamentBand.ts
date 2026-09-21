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
import {ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';
import {ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {InfluenceYield} from '@/common/parliament/influenceScaling';
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
  /** A count under its own word («Делегаты 5»). */
  | {kind: 'count', key: string, amount: number}
  /** The Agenda step's own gift: the influence level it sets, or the bonus it hands over. */
  | {kind: 'agenda', to: number, level?: number, bonus?: 'tr' | 'card'}
  /** The payout formula — the reward's reading, printed whole. */
  | {kind: 'yield', yields: ReadonlyArray<InfluenceYield>}
  /** The ruling party's answer to a step of the payout. */
  | {kind: 'reaction', party: ReduxParty, resource?: string, amount?: number}
  /** A part that paid nothing: what, how much it would have paid, and why — never a silent loss. */
  | {kind: 'skip', id: string, title: string, reason: string, amount?: number, unit?: string}
  /** The winner's tile, waiting behind the door to the board. */
  | {kind: 'tile', tile: 'ocean' | 'greenery'}
  /** The seats the phase is still waiting for. */
  | {kind: 'awaiting', seats: ReadonlyArray<Color>};

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

/** The reward's reading, as DATA — the one thing the band cannot derive from the summary alone. */
export type BandRewardReading = {
  yields: ReadonlyArray<InfluenceYield>;
  reactions: ReadonlyArray<{party: ReduxParty, resource?: string, amount?: number}>;
  skips: ReadonlyArray<{id: string, title: string, reason: string, amount?: number, unit?: string}>;
  /** The winner's tile is this seat's and still to be placed. */
  tile?: 'ocean' | 'greenery';
  /** Nothing is paid to this seat: what remains instead (the passive that now stands / the action to take). */
  quiet?: {kicker: string, kind: 'passive' | 'action'};
  /** One word of state beside the kicker: «эта выплата» until every chip has landed, «получено» after. */
  state?: 'This payout' | 'Received';
  /** The effects are asking ANOTHER seat. */
  waitingFor?: Color;
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

export type BandSitting = {
  stage: SittingStage;
  rewardStep: SittingRewardStep;
  /** The director's own beat inside the enactment ('' at rest). */
  beat: BandBeat;
  /** …and the wave of the support beat now playing. */
  supportWave: '' | SupportStatus;
  /** The results panel still waits behind the renewal's physical beats. */
  resultsHidden: boolean;
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

export type BandContext = {
  /** `undefined` outside a live sitting the viewer takes part in — the overview's line. */
  sitting?: BandSitting;
  /** `undefined` outside the chairman-quest flow — it outranks the overview, never the sitting (they cannot coexist). */
  quest?: BandQuest;
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
    return ctx.quest === undefined ? overviewLine(ctx.standing) : questLine(ctx.quest);
  }
  switch (sitting.stage) {
  case 'verdict':
    return verdictLine(sitting);
  case 'enact':
    return enactLine(sitting);
  case 'reward':
    return rewardLine(sitting);
  case 'results':
    return sitting.resultsHidden ? renewalLine(sitting) : resultsLine(sitting);
  }
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
      return {kicker: 'Agenda', key: 'quest:agenda:end', chips, committed: true};
    }
    if (player !== undefined) {
      chips.push({kind: 'player', player});
    }
    chips.push({kind: 'agenda', to: move.to, bonus: move.bonus});
    return {kicker: 'Agenda', key: `quest:agenda:${player ?? ''}:${move.to}`, chips, committed: true};
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
    return {kicker: 'Agenda', key: `agenda:${move.player}:${move.to}`, chips, committed: true};
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
    chips.push({kind: 'yield', yields: reward.yields});
  }
  for (const reaction of reward.reactions) {
    chips.push({kind: 'reaction', ...reaction});
  }
  if (reward.tile !== undefined) {
    chips.push({kind: 'tile', tile: reward.tile});
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
  return {
    kicker: 'Your reward',
    key: `reward:${sitting.rewardStep}:${reward.state ?? ''}:${reward.yields.length}:${reward.skips.length}`,
    chips,
    committed: true,
    ...(reward.yields.length === 0 && reward.quiet !== undefined ? {quiet: reward.quiet.kind} : {}),
  };
}

/** ОБНОВЛЕНИЕ — the renewal's own rule, while the table is dealt again. */
function renewalLine(sitting: BandSitting): BandLine {
  const summary = sitting.summary;
  if (summary === undefined || summary.final) {
    return {kicker: 'Results', key: 'renewal:final', chips: [{kind: 'label', key: 'The final generation', tone: 'quiet'}], committed: true};
  }
  return {kicker: 'Renewal', key: 'renewal', chips: [{kind: 'label', key: 'Popular support becomes votes'}], committed: true};
}

/** ИТОГИ — the generation's number, as the heading of the panel that stands below. */
function resultsLine(sitting: BandSitting): BandLine {
  const chips: Array<BandChip> = [{kind: 'count', key: 'Generation', amount: sitting.generation}];
  if (sitting.awaiting.length > 0 && sitting.rewardStep === 'gate') {
    chips.push({kind: 'awaiting', seats: sitting.awaiting});
  }
  return {kicker: 'Results', key: `results:${sitting.generation}:${sitting.rewardStep}`, chips, committed: true};
}
