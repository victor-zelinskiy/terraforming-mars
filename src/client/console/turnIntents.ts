/*
 * Turn-intent walkers for Console Mode (CONSOLE_MODE_CONCEPT.md §13) — PURE
 * functions over `playerView.waitingFor` implementing the SAME detection
 * contracts PlayerHome's dedicated buttons use (CLAUDE.md "Action UI
 * Rework": the option's presence in the server's action OR IS the source of
 * truth; submission payloads are byte-identical to the radio UI).
 *
 * Deliberately a standalone module (not an extraction from PlayerHome):
 * editing the 4160-line load-bearing PlayerHome to share ~150 lines is a
 * riskier diff than mirroring the documented contracts here; both follow
 * the same server titles, and the console coverage spec guards this copy.
 * Unit-tested with synthetic waitingFor trees
 * (tests/client/components/console/turnIntents.spec.ts).
 */

import {Message} from '@/common/logs/Message';
import {PlayerInputModel, OrOptionsModel, SelectOptionModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {InputResponse} from '@/common/inputs/InputResponse';

/** Plain English text of a `string | Message` prompt title. */
export function inputTitleText(title: string | Message | undefined): string | undefined {
  if (title === undefined) {
    return undefined;
  }
  return typeof title === 'string' ? title : title.message;
}

type Options = ReadonlyArray<PlayerInputModel>;

function childOptions(wf: PlayerInputModel): Options | undefined {
  if (wf.type === 'or' || wf.type === 'and') {
    return (wf as OrOptionsModel).options;
  }
  return undefined;
}

export type InnerOrMatch = {options: Options, path: ReadonlyArray<number>};

/** Find an OrOptions whose TITLE matches; returns its options + index path. */
export function findInnerActionPath(
  wf: PlayerInputModel | undefined,
  titlePredicate: (title: string | undefined) => boolean,
  pathSoFar: ReadonlyArray<number> = [],
): InnerOrMatch | undefined {
  if (!wf) {
    return undefined;
  }
  if (wf.type === 'or' && titlePredicate(inputTitleText(wf.title))) {
    return {options: (wf as OrOptionsModel).options, path: pathSoFar};
  }
  const options = childOptions(wf);
  if (options !== undefined) {
    for (let i = 0; i < options.length; i++) {
      const found = findInnerActionPath(options[i], titlePredicate, [...pathSoFar, i]);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

export function findMilestoneOptionPath(wf: PlayerInputModel | undefined): InnerOrMatch | undefined {
  // The server titles this OrOptions with a plain STRING (never a Message),
  // so the title match is i18n-mutation-proof — unlike the award one below.
  return findInnerActionPath(wf, (t) => t === 'Claim a milestone');
}

/**
 * ⚠️ The fund-award OrOptions title is a MESSAGE (`'Fund an award (${0} M€)'`
 * with the cost baked in) and i18n REWRITES `Message.message` in place on
 * first render — after any surface renders the action menu, the English
 * title-prefix match silently dies (the console-only "award reads blocked
 * for no reason" bug). Mirror the desktop contract exactly
 * (PlayerHome.findAwardOptionPath): title-prefix first, then the
 * translation-proof STRUCTURE fallback — an OrOptions whose options are all
 * SelectOptions titled with bare award names (leaf titles are plain strings,
 * never mutated).
 */
export function findAwardOptionPath(
  wf: PlayerInputModel | undefined,
  awardNames: ReadonlyArray<string> = [],
): InnerOrMatch | undefined {
  const byTitle = findInnerActionPath(wf, (t) => t !== undefined && t.toLowerCase().startsWith('fund an award'));
  if (byTitle !== undefined) {
    return byTitle;
  }
  if (awardNames.length === 0) {
    return undefined;
  }
  return findAwardOptionPathByStructure(wf, new Set(awardNames));
}

function findAwardOptionPathByStructure(
  wf: PlayerInputModel | undefined,
  awardNames: ReadonlySet<string>,
  pathSoFar: ReadonlyArray<number> = [],
): InnerOrMatch | undefined {
  if (!wf) {
    return undefined;
  }
  if (wf.type === 'or') {
    const opts = (wf as OrOptionsModel).options;
    if (opts.length > 0 && opts.every((o) => {
      if (o.type !== 'option') {
        return false;
      }
      const t = inputTitleText(o.title);
      return typeof t === 'string' && awardNames.has(t);
    })) {
      return {options: opts, path: pathSoFar};
    }
  }
  const options = childOptions(wf);
  if (options !== undefined) {
    for (let i = 0; i < options.length; i++) {
      const found = findAwardOptionPathByStructure(options[i], awardNames, [...pathSoFar, i]);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

/** Find a leaf SelectOption by exact title; returns its index path. */
export function findOptionPathByTitle(
  wf: PlayerInputModel | undefined,
  title: string,
  pathSoFar: ReadonlyArray<number> = [],
): ReadonlyArray<number> | undefined {
  if (!wf) {
    return undefined;
  }
  const options = childOptions(wf);
  if (options !== undefined) {
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (opt.type === 'option' && inputTitleText(opt.title) === title) {
        return [...pathSoFar, i];
      }
      const deeper = findOptionPathByTitle(opt, title, [...pathSoFar, i]);
      if (deeper) {
        return deeper;
      }
    }
  }
  return undefined;
}

export function findPassPath(wf: PlayerInputModel | undefined): ReadonlyArray<number> | undefined {
  return findOptionPathByTitle(wf, 'Pass for this generation');
}

export function findEndTurnPath(wf: PlayerInputModel | undefined): ReadonlyArray<number> | undefined {
  return findOptionPathByTitle(wf, 'End Turn');
}

export type ConvertHeatMatch = {path: ReadonlyArray<number>, option: SelectOptionModel};

export function findConvertHeatOption(
  wf: PlayerInputModel | undefined,
  pathSoFar: ReadonlyArray<number> = [],
): ConvertHeatMatch | undefined {
  if (!wf) {
    return undefined;
  }
  const options = childOptions(wf);
  if (options !== undefined) {
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const t = inputTitleText(opt.title);
      if (opt.type === 'option' && typeof t === 'string' && t.includes('heat into temperature')) {
        return {path: [...pathSoFar, i], option: opt as SelectOptionModel};
      }
      const deeper = findConvertHeatOption(opt, [...pathSoFar, i]);
      if (deeper) {
        return deeper;
      }
    }
  }
  return undefined;
}

export type ConvertPlantsMatch = {path: ReadonlyArray<number>, spacePrompt: PlayerInputModel};

function findConvertPlantsInner(
  wf: PlayerInputModel | undefined,
  pathSoFar: ReadonlyArray<number>,
  allowAnySpace: boolean,
): ConvertPlantsMatch | undefined {
  if (!wf) {
    return undefined;
  }
  const options = childOptions(wf);
  if (options !== undefined) {
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const t = inputTitleText(opt.title);
      if (opt.type === 'space') {
        if (typeof t === 'string' && t.includes('plants into greenery')) {
          return {path: [...pathSoFar, i], spacePrompt: opt};
        }
        if (allowAnySpace) {
          return {path: [...pathSoFar, i], spacePrompt: opt};
        }
      }
      const deeper = findConvertPlantsInner(opt, [...pathSoFar, i], allowAnySpace);
      if (deeper) {
        return deeper;
      }
    }
  }
  return undefined;
}

/** Two-pass (title, then any-space when the server flag confirms availability). */
export function findConvertPlantsOption(
  wf: PlayerInputModel | undefined,
  canConvertPlants: boolean,
): ConvertPlantsMatch | undefined {
  const byTitle = findConvertPlantsInner(wf, [], false);
  if (byTitle) {
    return byTitle;
  }
  return canConvertPlants ? findConvertPlantsInner(wf, [], true) : undefined;
}

export type ProjectCardMatch = {path: ReadonlyArray<number>, input: SelectProjectCardToPlayModel};

function findProjectCardByTitle(
  wf: PlayerInputModel | undefined,
  title: string,
  pathSoFar: ReadonlyArray<number> = [],
): ProjectCardMatch | undefined {
  if (!wf) {
    return undefined;
  }
  const options = childOptions(wf);
  if (options !== undefined) {
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (opt.type === 'projectCard' && inputTitleText(opt.title) === title) {
        return {path: [...pathSoFar, i], input: opt as SelectProjectCardToPlayModel};
      }
      const deeper = findProjectCardByTitle(opt, title, [...pathSoFar, i]);
      if (deeper) {
        return deeper;
      }
    }
  }
  return undefined;
}

export function findStandardProjectsAction(wf: PlayerInputModel | undefined): ProjectCardMatch | undefined {
  return findProjectCardByTitle(wf, 'Standard projects');
}

/**
 * "Play project card" — nested in the action menu, OR a TOP-LEVEL
 * `projectCard` prompt (mandatory play-from-hand → empty path, bare response).
 */
export function findPlayProjectCardAction(wf: PlayerInputModel | undefined): ProjectCardMatch | undefined {
  if (wf?.type === 'projectCard') {
    return {path: [], input: wf as SelectProjectCardToPlayModel};
  }
  return findProjectCardByTitle(wf, 'Play project card');
}

/**
 * The 'Perform an action from a played card' SelectCard — its `cards` list
 * is the server-filtered set of blue-card/corp actions activatable RIGHT
 * NOW (the same authoritative gate the desktop Actions overlay uses).
 */
export function findPerformActionCard(
  wf: PlayerInputModel | undefined,
  pathSoFar: ReadonlyArray<number> = [],
): {path: ReadonlyArray<number>, model: PlayerInputModel & {type: 'card'}} | undefined {
  if (!wf) {
    return undefined;
  }
  if (wf.type === 'card' && inputTitleText(wf.title) === 'Perform an action from a played card') {
    return {path: pathSoFar, model: wf};
  }
  const options = childOptions(wf);
  if (options !== undefined) {
    for (let i = 0; i < options.length; i++) {
      const found = findPerformActionCard(options[i], [...pathSoFar, i]);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

export function findSellPatentsAction(
  wf: PlayerInputModel | undefined,
  pathSoFar: ReadonlyArray<number> = [],
): {path: ReadonlyArray<number>} | undefined {
  if (!wf) {
    return undefined;
  }
  const options = childOptions(wf);
  if (options !== undefined) {
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (opt.type === 'card' && inputTitleText(opt.title) === 'Sell patents') {
        return {path: [...pathSoFar, i]};
      }
      const deeper = findSellPatentsAction(opt, [...pathSoFar, i]);
      if (deeper) {
        return deeper;
      }
    }
  }
  return undefined;
}

/**
 * The colony-trade AndOptions ('Trade with a colony tile') — shape:
 * [OrOptions('Pay trade fee'), SelectColony]. `colonies` = the tradeable
 * set (server-filtered); payment options + server-disabled payments ride
 * along for the reused trade-payment modal.
 */
export type TradeColonyContext = {
  path: ReadonlyArray<number>,
  paymentOptions: ReadonlyArray<SelectOptionModel>,
  disabledPayments: NonNullable<OrOptionsModel['disabledOptions']>,
  colonies: ReadonlyArray<string>,
};

export function findTradeColonyContext(
  wf: PlayerInputModel | undefined,
  pathSoFar: ReadonlyArray<number> = [],
): TradeColonyContext | undefined {
  if (!wf) {
    return undefined;
  }
  if (wf.type === 'and' && inputTitleText(wf.title) === 'Trade with a colony tile') {
    const children = childOptions(wf) ?? [];
    const payOr = children.find((c) => c.type === 'or') as OrOptionsModel | undefined;
    const selectColony = children.find((c) => c.type === 'colony');
    if (payOr === undefined || selectColony === undefined) {
      return undefined;
    }
    return {
      path: pathSoFar,
      paymentOptions: payOr.options.filter((o): o is SelectOptionModel => o.type === 'option'),
      disabledPayments: payOr.disabledOptions ?? [],
      colonies: (selectColony as PlayerInputModel & {type: 'colony'}).coloniesModel.map((c) => c.name),
    };
  }
  const options = childOptions(wf);
  if (options !== undefined) {
    for (let i = 0; i < options.length; i++) {
      const deeper = findTradeColonyContext(options[i], [...pathSoFar, i]);
      if (deeper) {
        return deeper;
      }
    }
  }
  return undefined;
}

/** The Hydronetwork (Delta Project) advance action in the action menu. */
export function findHydroActionPath(wf: PlayerInputModel | undefined): ReadonlyArray<number> | undefined {
  return findOptionPathByTitle(wf, 'Advance on the Delta Project track');
}

/** Wrap an inner response in one OR layer per path index (innermost first). */
export function wrapPath(path: ReadonlyArray<number>, inner: unknown): unknown {
  let response = inner;
  for (let i = path.length - 1; i >= 0; i--) {
    response = {type: 'or' as const, index: path[i], response};
  }
  return response;
}

/** `{type:'option'}` wrapped for a leaf option path. */
export function optionResponseForPath(path: ReadonlyArray<number>): InputResponse {
  return wrapPath(path, {type: 'option' as const}) as InputResponse;
}

// ---------------------------------------------------------------------------
// Turn Menu verbs (CONSOLE_MODE_CONCEPT.md §5) — everything the server offers
// RIGHT NOW, with availability + honest reasons, derived from the same tree.
// ---------------------------------------------------------------------------

export type TurnVerbId =
  | 'playCard' | 'standardProjects' | 'milestones' | 'awards'
  | 'convertPlants' | 'convertHeat' | 'sellPatents' | 'colonies' | 'hydro'
  | 'endTurn' | 'pass';

export type TurnVerb = {
  id: TurnVerbId,
  /** English i18n key for the row label. */
  label: string,
  available: boolean,
  /** English i18n key explaining an unavailable row ('' when available). */
  reason: string,
  /** Optional annotation (count of playable cards, etc.). */
  count?: number,
};

/** Is it this player's ACTION-MENU turn at all (any verb findable)? */
export function turnVerbs(view: PlayerViewModel): Array<TurnVerb> {
  const wf = view.waitingFor;
  const notYourTurn = 'Not your turn to take any actions';
  const off = (id: TurnVerbId, label: string, reason: string): TurnVerb => ({id, label, available: false, reason});
  const on = (id: TurnVerbId, label: string, count?: number): TurnVerb => ({id, label, available: true, reason: '', count});

  const verbs: Array<TurnVerb> = [];

  const play = findPlayProjectCardAction(wf);
  const playable = play?.input.cards.filter((c) => c.isDisabled !== true).length ?? 0;
  verbs.push(play !== undefined && playable > 0 ?
    on('playCard', 'Play project card', playable) :
    off('playCard', 'Play project card', play !== undefined ? 'No playable cards' : notYourTurn));

  const std = findStandardProjectsAction(wf);
  verbs.push(std !== undefined ?
    on('standardProjects', 'Standard Projects') :
    off('standardProjects', 'Standard Projects', notYourTurn));

  const milestones = findMilestoneOptionPath(wf);
  verbs.push(milestones !== undefined ?
    on('milestones', 'Claim a milestone', milestones.options.length) :
    off('milestones', 'Claim a milestone', 'No claimable milestones right now'));

  const awards = findAwardOptionPath(wf, view.game.awards.map((a) => a.name));
  verbs.push(awards !== undefined ?
    on('awards', 'Fund an award', awards.options.length) :
    off('awards', 'Fund an award', 'No fundable awards right now'));

  const heat = findConvertHeatOption(wf);
  verbs.push(heat !== undefined ?
    on('convertHeat', 'Convert heat') :
    off('convertHeat', 'Convert heat', 'Not enough heat'));

  const plants = findConvertPlantsOption(wf, view.thisPlayer.canConvertPlants === true);
  verbs.push(plants !== undefined ?
    on('convertPlants', 'Convert plants') :
    off('convertPlants', 'Convert plants', 'Not enough plants'));

  const sell = findSellPatentsAction(wf);
  verbs.push(sell !== undefined ?
    off('sellPatents', 'Sell patents', 'Available in desktop mode for now') :
    off('sellPatents', 'Sell patents', notYourTurn));

  if (view.game.colonies.length > 0) {
    verbs.push(off('colonies', 'Colonies', 'Available in desktop mode for now'));
  }
  if (view.game.gameOptions.expansions.deltaProject) {
    verbs.push(off('hydro', 'Hydronetwork', 'Available in desktop mode for now'));
  }

  const endTurn = findEndTurnPath(wf);
  if (endTurn !== undefined) {
    verbs.push(on('endTurn', 'End Turn'));
  }
  const pass = findPassPath(wf);
  verbs.push(pass !== undefined ?
    on('pass', 'Pass for this generation') :
    off('pass', 'Pass for this generation', notYourTurn));

  return verbs;
}

/** True when the action menu is live (≥1 verb available). */
export function hasTurn(view: PlayerViewModel): boolean {
  return turnVerbs(view).some((v) => v.available);
}
