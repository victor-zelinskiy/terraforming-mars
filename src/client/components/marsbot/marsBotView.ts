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
import {BotMilestoneThreshold, MarsBotModel, MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {BotTokenKind, COLONY_CELL_PRICE_MC, DifficultyLevel, TrackAction} from '@/common/automa/AutomaTypes';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {MarsBotCorpCubeModel, MarsBotCubeType} from '@/common/automa/MarsBotCorpData';
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
  | {kind: 'colony', price?: number}
  | {kind: 'ma', which: 'milestone' | 'award'}
  /** A random-set mat's TOKEN cell (decision R8): gain 1 / 2 tokens of a kind (data — Dataminer, fighters — Aeronaut). */
  | {kind: 'token', token: BotTokenKind, count: 1 | 2};

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
  if (action.startsWith('token')) {
    const [cell, token] = action.split('_') as [string, BotTokenKind];
    return {kind: 'token', token, count: cell === 'token2' ? 2 : 1};
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
  case 'colony': return {kind: 'colony'};
  case 'colony5': return {kind: 'colony', price: COLONY_CELL_PRICE_MC}; // Amazonis: the A&M Pioneer cube as a cell
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
  case 'colony':
    return glyph.price === undefined ?
      {message: 'Place a colony', params: []} :
      {message: 'Place a colony and lose ${0} M€', params: [String(glyph.price)]};
  case 'ma': return {message: glyph.which === 'milestone' ? 'Claim a milestone' : 'Fund an award', params: []};
  case 'token':
    return glyph.token === 'data' ?
      {message: glyph.count === 2 ? 'Gain 2 data tokens' : 'Gain 1 data token', params: []} :
      {message: glyph.count === 2 ? 'Gain 2 fighter tokens' : 'Gain 1 fighter token', params: []};
  }
}

export type TrackCell = {
  index: number;
  action?: TrackAction;
  current: boolean;
  /** Regressed-from marker — this space's action won't fire again on re-advance. */
  regressed: boolean;
  /** A corporation cube seeded on this space (RB-B special cubes), if any. */
  cube?: {cubeType: MarsBotCubeType, spent: boolean};
  /** The milestones whose bot threshold is THIS cell (decision R6 — the server's `MarsBotModel.thresholds`). */
  thresholds?: ReadonlyArray<MilestoneName>;
};

/**
 * The renderable cell list of one track (position 0 is the start slot).
 * `cubes` are THIS track's corporation cubes (already filtered by the host) —
 * an empty list for every corporation that seeds none.
 */
export function trackCells(track: MarsBotTrackModel, cubes: ReadonlyArray<MarsBotCorpCubeModel> = [],
  thresholds: ReadonlyArray<BotMilestoneThreshold> = []): Array<TrackCell> {
  const cells: Array<TrackCell> = [];
  for (let i = 0; i <= track.maxPosition; i++) {
    const cube = cubes.find((c) => c.position === i);
    const marks = thresholds.filter((t) => t.cell === i).map((t) => t.milestone);
    cells.push({
      index: i,
      // The layout's empty slots are authored as `undefined`, but JSON
      // serialization ships them as `null` — normalize, or every "empty"
      // cell reads as an action and the glyph resolver crashes the render.
      action: track.layout[i] ?? undefined,
      current: track.position === i,
      regressed: track.regressed.includes(i),
      ...(cube !== undefined ? {cube: {cubeType: cube.cubeType, spent: cube.spent}} : {}),
      ...(marks.length > 0 ? {thresholds: marks} : {}),
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
