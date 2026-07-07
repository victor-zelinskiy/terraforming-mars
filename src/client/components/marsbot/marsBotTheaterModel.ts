/*
 * MarsBot turn theater — the PURE model (unit-tested under the server runner).
 *
 * Turns the server-authored `MarsBotTurn` script into the ordered, timed view
 * steps both theater surfaces (desktop overlay / console band) replay. The
 * server resolves the turn instantly and authoritatively; the client's ONLY
 * job here is pacing + presentation — no bot rules are re-derived.
 *
 * Durations are `standard`-preset base milliseconds — the controller runs
 * them through `motionMs()` so the whole choreography follows the motion
 * system. A long turn (bonus-card chains) is compressed to `MAX_TURN_MS`
 * rather than truncated: every step still shows, faster.
 */
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';
import {LogMessage} from '@/common/logs/LogMessage';
import {BonusCardId, TrackAction} from '@/common/automa/AutomaTypes';
import {FailedActionReason, MarsBotAttack, MarsBotImpact, MarsBotTurn, MarsBotTurnStep} from '@/common/automa/MarsBotTurn';
import {ViewModel} from '@/common/models/PlayerModel';

/** The intro beat: MarsBot "thinking" before the reveal (the owner's 800–1500ms). */
export const THINKING_MS = 1100;
export const REVEAL_MS = 1600;
export const TAG_MS = 750;
export const ADVANCE_MS = 750;
export const FAILED_MS = 1500;
export const LOG_MS = 1050;
export const PASS_MS = 1300;
/** A direct attack (who was hit + the outcome) — the beat the victim must not miss. */
export const ATTACK_MS = 1700;
/** One "turn results" line (a participant's before → after changes). */
export const IMPACT_MS = 1500;
/** The whole turn (sum of steps) is compressed to fit this, never truncated. */
export const MAX_TURN_MS = 14000;
/** Compression floor — steps stay readable even in a monster bonus chain. */
export const MIN_STEP_MS = 360;
/** Reduced motion: one calm readable beat per step, no long choreography. */
export const REDUCED_STEP_MS = 420;

export type TheaterStep =
  | {kind: 'thinking', durationMs: number}
  | {kind: 'pass', durationMs: number, message?: LogMessage}
  | {kind: 'reveal', durationMs: number, card: {kind: 'project', name: CardName} | {kind: 'bonus', id: BonusCardId}}
  | {kind: 'tag', durationMs: number, tag: Tag, targetTag?: Tag, ignored: boolean}
  | {kind: 'advance', durationMs: number, trackTag?: Tag, from: number, to: number, action?: TrackAction}
  | {kind: 'failed', durationMs: number, reason: FailedActionReason, mc: number, message?: LogMessage}
  | {kind: 'attack', durationMs: number, attack: MarsBotAttack}
  | {kind: 'log', durationMs: number, message: LogMessage}
  | {kind: 'impact', durationMs: number, impact: MarsBotImpact};

/** The bot participant of the view, if any. */
export function marsBotOfView(view: ViewModel | undefined): {color: Color, name: string} | undefined {
  const bot = view?.players.find((p) => p.isMarsBot === true);
  return bot !== undefined ? {color: bot.color, name: bot.name} : undefined;
}

/** The dedup/replay key of a turn (unique per game session). */
export function turnDedupeKey(turn: MarsBotTurn, botColor: Color | ''): string {
  return `${botColor}:${turn.generation}:${turn.id}`;
}

/** The identity tag of a track index, resolved from the view's automa model. */
function tagOfTrack(view: ViewModel, trackIndex: number | undefined): Tag | undefined {
  if (trackIndex === undefined) {
    return undefined;
  }
  return view.game.automa?.tracks[trackIndex]?.tags[0];
}

function baseStep(view: ViewModel, step: MarsBotTurnStep): TheaterStep {
  switch (step.kind) {
  case 'pass':
    return {kind: 'pass', durationMs: PASS_MS, message: step.message};
  case 'reveal':
    return {kind: 'reveal', durationMs: REVEAL_MS, card: step.card};
  case 'tag':
    return {
      kind: 'tag',
      durationMs: TAG_MS,
      tag: step.tag,
      targetTag: tagOfTrack(view, step.trackIndex),
      ignored: step.trackIndex === undefined,
    };
  case 'advance':
    return {
      kind: 'advance',
      durationMs: ADVANCE_MS,
      trackTag: tagOfTrack(view, step.trackIndex),
      from: step.from,
      to: step.to,
      ...(step.action !== undefined ? {action: step.action} : {}),
    };
  case 'failed':
    return {kind: 'failed', durationMs: FAILED_MS, reason: step.reason, mc: step.mc, message: step.message};
  case 'attack':
    return {kind: 'attack', durationMs: ATTACK_MS, attack: step.attack};
  case 'log':
    return {kind: 'log', durationMs: LOG_MS, message: step.message};
  case 'impact':
    return {kind: 'impact', durationMs: IMPACT_MS, impact: step.impact};
  }
}

/**
 * Build the timed view steps of one turn. `view` is the INCOMING view (its
 * automa model resolves track indices to tags). Compresses a long chain to
 * `MAX_TURN_MS` (floor `MIN_STEP_MS` per step); reduced motion flattens every
 * step to one short readable beat.
 */
export function buildTheaterSteps(turn: MarsBotTurn, view: ViewModel, reducedMotion: boolean): Array<TheaterStep> {
  const steps: Array<TheaterStep> = [{kind: 'thinking', durationMs: THINKING_MS}];
  for (const step of turn.steps) {
    steps.push(baseStep(view, step));
  }
  if (reducedMotion) {
    return steps.map((s) => ({...s, durationMs: REDUCED_STEP_MS}));
  }
  const total = steps.reduce((sum, s) => sum + s.durationMs, 0);
  if (total > MAX_TURN_MS) {
    const scale = MAX_TURN_MS / total;
    return steps.map((s) => ({...s, durationMs: Math.max(MIN_STEP_MS, Math.round(s.durationMs * scale))}));
  }
  return steps;
}

/** Total scripted duration (base ms, before the motion-speed preset). */
export function theaterTotalMs(steps: ReadonlyArray<TheaterStep>): number {
  return steps.reduce((sum, s) => sum + s.durationMs, 0);
}
