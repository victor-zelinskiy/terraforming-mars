/*
 * Pure, view-independent helpers for a MarsBot turn — shared by the turn
 * archive, the review model and the console card-inspect. No Vue / DOM here;
 * the server authored the turn, the client only presents it.
 *
 * (Formerly the head of `marsBotTheaterModel.ts` — the timed "theater step"
 * machinery it used to hold is gone with the row-by-row theater; the «Разбор
 * хода» review reads the raw `MarsBotTurn.steps` directly.)
 */
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {ViewModel} from '@/common/models/PlayerModel';

/** The bot participant of the view, if any. */
export function marsBotOfView(view: ViewModel | undefined): {color: Color, name: string} | undefined {
  const bot = view?.players.find((p) => p.isMarsBot === true);
  return bot !== undefined ? {color: bot.color, name: bot.name} : undefined;
}

/** The dedup/replay key of a turn (unique per game session). */
export function turnDedupeKey(turn: MarsBotTurn, botColor: Color | ''): string {
  return `${botColor}:${turn.generation}:${turn.id}`;
}

/**
 * The FULL automa track models (tags + layout + maxPosition) — captured once
 * per view so an ARCHIVED turn can be reviewed later (e.g. from the journal)
 * without holding on to the whole ViewModel. The layout is static (only the
 * live `position` moves), so a snapshot is enough to render the review's
 * mini-scales + composite track capsules.
 */
export function tracksOfView(view: ViewModel | undefined): ReadonlyArray<MarsBotTrackModel> {
  return view?.game.automa?.tracks ?? [];
}

/** The identity tags of the automa tracks (index → tag). */
export function trackTagsOfView(view: ViewModel | undefined): Array<Tag | undefined> {
  return tracksOfView(view).map((t) => t.tags[0]);
}

/** The identity tag of a track index, resolved from captured track tags. */
export function tagOfTrack(trackTags: ReadonlyArray<Tag | undefined>, trackIndex: number | undefined): Tag | undefined {
  if (trackIndex === undefined) {
    return undefined;
  }
  return trackTags[trackIndex];
}

/**
 * Every PROJECT card the turn shows: reveal steps + CARD tokens riding any
 * step's log line (an R&D draw-and-resolve reveals a second card as a log
 * line). Ordered, deduped — feeds the "X = Осмотреть карту" fullscreen
 * browser.
 */
export function turnCardNames(turn: MarsBotTurn): Array<CardName> {
  const out: Array<CardName> = [];
  const push = (name: CardName) => {
    if (!out.includes(name)) {
      out.push(name);
    }
  };
  for (const step of turn.steps) {
    if (step.kind === 'reveal' && step.card.kind === 'project') {
      push(step.card.name);
    }
    const message = 'message' in step ? step.message : undefined;
    for (const d of message?.data ?? []) {
      if (d.type === LogMessageDataType.CARD) {
        push(d.value as CardName);
      }
    }
  }
  return out;
}
