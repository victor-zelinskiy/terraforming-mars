/*
 * THE SECOND EXIT PASS OF A REFUSED RATING — A CARD'S STANDING SKIP (P57
 * Preservation Program: «skip the first TR you gain in each generation's
 * action phase»): the forecast twin of the skip inside the ONE rating funnel
 * (`Player.increaseTerraformRating`), run at the exit of the SAME six preview
 * doors the law's veto pass (`vetoedRating.ts`) stands in, RIGHT AFTER it —
 * the funnel's own order: the law refuses a whole event first (no
 * `trThisGeneration`, the card's flag untouched), the card's skip eats ONE
 * step of the first event the law let through.
 *
 * What it does to a preview, branch by branch:
 *  1. it is LIVE only while the funnel would skip — the flag armed, the game in
 *     the ACTION phase, no rating gained in this generation's action phase yet
 *     (`ratingSkipArmed`); otherwise the preview comes back untouched;
 *  2. the FIRST rating chip of the branch the law did not strike (explicit or
 *     `implied`; a NET restatement is no event) is SPLIT: `[amount − 1]` gained
 *     + `[1]` struck under the card's mark (`VetoedRatingMark.card`) — one
 *     chip struck whole when it promised a single step. The ONE chip renderer
 *     draws the strike; a partial hit is two chips, never a second renderer;
 *  3. a branch whose chips print no rating but whose placement steps seat a
 *     rating-paying tile (an ocean, a greenery) gets the struck implied chip of
 *     that tile's first rating event — unless the law's pass already stated
 *     those as chips (they were judged in 2);
 *  4. a NET restatement after the split reads the net less the skipped step.
 *
 * The forecast engine reads the mark like the law's: a struck chip makes NO
 * rating grant (no Greens' M€, no any-player reactor); the law's own fact
 * counts only the LAW's marks (`vetoedStepsOf`), and the card states its own
 * skipped fact (`skippedRatingFacts`).
 *
 * READ-ONLY: a projection over the chips, nothing queued, nothing written.
 */
import {IPlayer} from '../IPlayer';
import {ActionEffect, ActionPreview, ActionPreviewBranch, ActionPreviewStep, VetoedRatingMark} from '../../common/models/ActionPreviewModel';
import {ActionFutilityVerdict} from '../../common/models/ActionFutilityModel';
import {NET_PHASE} from '../cards/actionPreviews';
import {tileRatingEvents, vetoingLaw} from './vetoedRating';
import {tileKindOfStep} from './divertedTerraforming';
import {RATING_SKIP_CARD, RATING_SKIP_REASON, ratingSkipArmed} from '../cards/prelude2/preservationProgramSkip';

export {RATING_SKIP_CARD, RATING_SKIP_FORECAST_TITLE, RATING_SKIP_LABEL, RATING_SKIP_REASON, ratingSkipArmed} from '../cards/prelude2/preservationProgramSkip';

/** The card's mark on a struck chip — one step, always. */
export function skippedRatingMark(steps: number = 1): VetoedRatingMark {
  return {card: RATING_SKIP_CARD, steps};
}

/**
 * THE SEAT'S STANDING MARK for the rail (`PlayerModel.ratingSkip`): `armed` while the flag stands (in ANY phase —
 * the next rating gained in the action phase will be skipped), `spent` once this generation's skip was eaten (the
 * card in the tableau, the flag down). Undefined without the card.
 */
export function ratingSkipMarkOf(player: IPlayer): 'armed' | 'spent' | undefined {
  if (!player.tableau.has(RATING_SKIP_CARD)) {
    return undefined;
  }
  return player.preservationProgram === true ? 'armed' : 'spent';
}

/** The rating steps every chip of `effects` struck under the CARD's mark promised, summed. */
export function skippedStepsOf(effects: ReadonlyArray<ActionEffect>): number {
  return effects.reduce((sum, e) => sum + (e.vetoed?.card !== undefined ? e.vetoed.steps : 0), 0);
}

/** A chip that promises a rating GAIN the funnel will see — explicit or implied, not refused, not a NET line. */
function isLiveRatingGain(effect: ActionEffect): boolean {
  return effect.icon === 'tr' && effect.direction === 'gain' && effect.amount > 0 && effect.diverted === undefined &&
    effect.vetoed === undefined && !(effect.implied === true && effect.phase === NET_PHASE);
}

/**
 * SPLIT a rating chip into its gained remainder and its one struck step — the shape every surface reads (the card's
 * own preview builds it through here too: played in the action phase with nothing gained yet, its +5 is «+4» and «1»).
 */
export function splitSkippedRating(chip: ActionEffect): Array<ActionEffect> {
  const struck: ActionEffect = {...chip, amount: 1, vetoed: skippedRatingMark()};
  delete struck.current;
  delete struck.resulting;
  if (chip.amount <= 1) {
    return [{...chip, vetoed: skippedRatingMark()}];
  }
  const gained: ActionEffect = {...chip, amount: chip.amount - 1};
  if (chip.current !== undefined && chip.resulting !== undefined) {
    gained.resulting = chip.resulting - 1;
  }
  return [gained, struck];
}

/** The first rating event a branch's placement steps pay — the tile's own (an ocean's 1, a greenery's oxygen). */
function firstStepRating(player: IPlayer, steps: ReadonlyArray<ActionPreviewStep>): ActionEffect | undefined {
  for (const step of steps) {
    const kind = tileKindOfStep(step);
    if (kind === undefined || step.kind !== 'boardPlacement') {
      continue;
    }
    const events = tileRatingEvents(player, kind);
    if (events.length > 0) {
      return {direction: 'gain', icon: 'tr', amount: 1, implied: true, vetoed: skippedRatingMark()};
    }
  }
  return undefined;
}

/** THE PASS over one branch's chips (the core every door calls). A new array comes back; nothing is mutated. */
export function skipEffects(player: IPlayer, effects: ReadonlyArray<ActionEffect>, steps: ReadonlyArray<ActionPreviewStep> = []): Array<ActionEffect> {
  if (!ratingSkipArmed(player)) {
    return [...effects];
  }
  const out: Array<ActionEffect> = [];
  let skipped = false;
  for (const effect of effects) {
    if (!skipped && isLiveRatingGain(effect)) {
      out.push(...splitSkippedRating(effect));
      skipped = true;
      continue;
    }
    // 4. A NET restatement after the split reads the net the skipped step leaves.
    if (skipped && effect.icon === 'tr' && effect.direction === 'gain' && effect.implied === true && effect.phase === NET_PHASE) {
      if (effect.amount - 1 > 0) {
        out.push({...effect, amount: effect.amount - 1});
      }
      continue;
    }
    out.push(effect);
  }
  // 3. No printed rating — a seated tile's own. The law's pass already stated them as chips when it stood.
  if (!skipped && vetoingLaw(player) === undefined) {
    const chip = firstStepRating(player, steps);
    if (chip !== undefined) {
      out.push(chip);
    }
  }
  return out;
}

/** The pass over a whole preview — every branch on its own (a branch is one path of the funnel). */
export function withSkippedRating(player: IPlayer, preview: ActionPreview): ActionPreview {
  if (!ratingSkipArmed(player)) {
    return preview;
  }
  return {
    ...preview,
    branches: preview.branches.map((branch): ActionPreviewBranch => ({...branch, effects: skipEffects(player, branch.effects, branch.steps)})),
  };
}

/**
 * THE «NO EFFECT» VERDICT OF A SKIPPED RATING: an action whose WHOLE result is ONE rating step the card's standing
 * effect will eat (the UNMI corporation's «3 M€ → +1 TR» while the skip is armed). Undefined otherwise.
 */
export function ratingSkipFutility(player: IPlayer): ActionFutilityVerdict | undefined {
  return ratingSkipArmed(player) ? {kind: 'rating-skipped', reason: RATING_SKIP_REASON} : undefined;
}
