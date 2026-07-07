/*
 * Pure view helpers for the MarsBot (Automa) participant UI — shared by the
 * desktop sidebar panel / board overlay AND the console info-mode sections so
 * the two presentations can never diverge. No Vue / DOM here; labels are
 * English i18n keys the components translate.
 *
 * Everything reads the SERVER model (`MarsBotModel`) — the client never
 * re-derives bot rules.
 */
import {CardModel} from '@/common/models/CardModel';
import {MarsBotModel, MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {DifficultyLevel, TrackAction} from '@/common/automa/AutomaTypes';
import {Tag} from '@/common/cards/Tag';

export const DIFFICULTY_LABEL: Readonly<Record<DifficultyLevel, string>> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  brutal: 'Brutal',
};

/** A renderable descriptor of one printed track-action icon. */
export type TrackActionGlyph =
  | {kind: 'advance'}
  | {kind: 'tr', steps: number}
  | {kind: 'tag', trackIndex: number}
  | {kind: 'param', icon: 'temperature' | 'ocean' | 'venus', count: 1 | 2}
  | {kind: 'tile', tile: 'greenery' | 'city'}
  | {kind: 'floater', count: 1 | 2}
  | {kind: 'ma', which: 'milestone' | 'award'};

export function trackActionGlyph(action: TrackAction): TrackActionGlyph {
  if (action === 'advance') {
    return {kind: 'advance'};
  }
  if (action.startsWith('tag_')) {
    return {kind: 'tag', trackIndex: Number(action.substring(4))};
  }
  if (/^tr\d$/.test(action)) {
    return {kind: 'tr', steps: Number(action.substring(2))};
  }
  switch (action) {
  case 'temperature': return {kind: 'param', icon: 'temperature', count: 1};
  case 'temperature2': return {kind: 'param', icon: 'temperature', count: 2};
  case 'ocean': return {kind: 'param', icon: 'ocean', count: 1};
  case 'venus': return {kind: 'param', icon: 'venus', count: 1};
  case 'venus2': return {kind: 'param', icon: 'venus', count: 2};
  case 'greenery': return {kind: 'tile', tile: 'greenery'};
  case 'city': return {kind: 'tile', tile: 'city'};
  case 'floater': return {kind: 'floater', count: 1};
  case 'floater2': return {kind: 'floater', count: 2};
  case 'milestone': return {kind: 'ma', which: 'milestone'};
  case 'award': return {kind: 'ma', which: 'award'};
  default: return {kind: 'advance'};
  }
}

/**
 * Short description of a track action — an English i18n TEMPLATE + params
 * (translate with `translateTextWithParams`; the exact-match i18n can't take
 * an interpolated string). Used by track-cell tooltips and the theater lines.
 */
export function trackActionLabel(action: TrackAction): {message: string, params: Array<string>} {
  const glyph = trackActionGlyph(action);
  switch (glyph.kind) {
  case 'advance': return {message: 'Advance this tracker again', params: []};
  case 'tr': return {message: 'Gain ${0} TR', params: [String(glyph.steps)]};
  case 'tag': return {message: 'Advance another track', params: []};
  case 'param':
    if (glyph.icon === 'temperature') {
      return {message: glyph.count === 2 ? 'Raise the temperature 2 steps' : 'Raise the temperature 1 step', params: []};
    }
    if (glyph.icon === 'venus') {
      return {message: glyph.count === 2 ? 'Raise Venus 2 steps' : 'Raise Venus 1 step', params: []};
    }
    return {message: 'Place an ocean', params: []};
  case 'tile': return {message: glyph.tile === 'greenery' ? 'Place a greenery' : 'Place a city', params: []};
  case 'floater': return {message: glyph.count === 2 ? 'Gain 2 floaters' : 'Gain 1 floater', params: []};
  case 'ma': return {message: glyph.which === 'milestone' ? 'Claim a milestone' : 'Fund an award', params: []};
  }
}

export type TrackCell = {
  index: number;
  action?: TrackAction;
  current: boolean;
  /** Regressed-from marker — this space's action won't fire again on re-advance. */
  regressed: boolean;
};

/** The renderable cell list of one track (position 0 is the start slot). */
export function trackCells(track: MarsBotTrackModel): Array<TrackCell> {
  const cells: Array<TrackCell> = [];
  for (let i = 0; i <= track.maxPosition; i++) {
    cells.push({
      index: i,
      action: track.layout[i],
      current: track.position === i,
      regressed: track.regressed.includes(i),
    });
  }
  return cells;
}

/** The track's identity tag (the first mapped tag — Wild never maps). */
export function trackTag(track: MarsBotTrackModel): Tag | undefined {
  return track.tags[0];
}

/**
 * MarsBot's played project pile as minimal CardModels — lets the premium
 * played-cards board (and the fullscreen viewer) render the bot's tableau
 * through the SAME components as a human tableau. All names are public.
 */
export function botTableauCards(automa: MarsBotModel): Array<CardModel> {
  return automa.playedPile.map((name) => ({name}));
}
