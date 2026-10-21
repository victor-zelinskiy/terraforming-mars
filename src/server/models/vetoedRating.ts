/*
 * THE ONE EXIT PASS OF THE RATING VETO (Turmoil Redux — RX42 UNMI Veto: «the
 * player(s) with the highest terraform rating ignore any rating they would
 * gain»): the forecast twin of `ResolutionPassive.vetoRating`, run ONCE at
 * the exit of every preview door the diverting pass (RX35) stands in — the
 * card play, the blue action, the standard project, the two conversions'
 * option metadata, a colony's build bonus — RIGHT AFTER the implied-rating
 * pass (it reads what the seat is really promised: a scale step's own rating
 * is a chip by then) and never inside a card.
 *
 * What it does to a preview, branch by branch — THE FUNNEL'S OWN ORDER:
 *  1. a TILE the branch promises as a PLACEMENT STEP carries a rating the
 *     chips never printed (an ocean is one rating event; a greenery is two —
 *     the oxygen's, where the scale has room, and the Redux tile's own): the
 *     pass states them as IMPLIED rating chips, one per event, so they can be
 *     judged like every other — unless the branch already printed the tile as
 *     a chip (Water Hauling's «[океан] · [РТ]»), whose implied rating the
 *     rating pass already stated;
 *  2. the seat's rating is PROJECTED chip by chip against the highest rating
 *     among the other players: a rating chip (explicit or `implied`) met while
 *     the projection is at or above the others' highest is STRUCK
 *     (`ActionEffect.vetoed` — the law and the steps); one met below it is
 *     gained, and the projection moves up by it. So a seat one below the top
 *     with «+3 · +1» reads «+3» gained and «+1» struck — exactly what the
 *     funnel will do, event by event (decision Р2);
 *  3. an explicit rating chip after a struck one reads the pool where the
 *     struck steps did NOT move it (the implied-rating pass had added them);
 *     a NET restatement (TR47's closing line) reads the net the struck steps
 *     leave, and leaves the formula when nothing is left;
 *  4. nothing else is touched: a scale chip, a tile chip, a placement step —
 *     the planet moves, the cell is asked, the bonuses come. No «where» is
 *     pre-collected: nothing stands in the rating's place.
 *
 * The forecast engine reads the marks: a struck chip makes NO rating grant
 * (`grantOfEffect` — no Greens' M€, no any-player reactor), the Greens' own
 * fact subtracts what was struck, and the law's own fact reads the sum off
 * `ctx.vetoed` (`resolutionFacts`). The futility reader names the law where
 * the rating was the action's whole result (Р5).
 *
 * READ-ONLY: a projection over the chips, nothing queued, nothing written.
 */
import {IPlayer} from '../IPlayer';
import {ActionEffect, ActionPreview, ActionPreviewBranch, ActionPreviewStep, VetoedRatingMark} from '../../common/models/ActionPreviewModel';
import {ActionFutilityVerdict} from '../../common/models/ActionFutilityModel';
import {MAX_OXYGEN_LEVEL} from '../../common/constants';
import {REDUX_GREENERY_TILE_TR} from '../../common/parliament/winnerReward';
import {NET_PHASE} from '../cards/actionPreviews';
import {highestOtherRating, ratingVetoed, ratingVetoLaw} from '../parliament/ratingVetoGate';
import {ResolutionDefinition} from '../parliament/resolutions/IResolution';
import {UNMI_VETO_REASON} from '../parliament/resolutions/reds/UnmiVeto';
import {tileKindOfStep} from './divertedTerraforming';

/** The law whose veto may touch `player`'s rating (the seat is in its aspect) — the pass's gate, read once per door. */
export function vetoingLaw(player: IPlayer): ResolutionDefinition | undefined {
  return ratingVetoLaw(player);
}

/** The rating steps every struck chip of `effects` promised and the seat will not gain, summed (0 when nothing is struck). */
export function vetoedStepsOf(effects: ReadonlyArray<ActionEffect>): number {
  return effects.reduce((sum, e) => sum + (e.vetoed?.steps ?? 0), 0);
}

/** A chip that promises a rating GAIN the funnel will judge — explicit or implied; never a cost, never a replaced unit. */
function isRatingGain(effect: ActionEffect): boolean {
  return effect.icon === 'tr' && effect.direction === 'gain' && effect.amount > 0 && effect.diverted === undefined;
}

/** The rating EVENTS a placed tile pays, one entry per event, in the engine's order (an ocean: one; a greenery: the oxygen's, then the tile's). */
function tileRatingEvents(player: IPlayer, kind: 'greenery' | 'ocean'): Array<number> {
  if (kind === 'ocean') {
    return [1];
  }
  const oxygen = player.game.getOxygenLevel() < MAX_OXYGEN_LEVEL ? [1] : [];
  return player.game.parliament === undefined ? oxygen : [...oxygen, REDUX_GREENERY_TILE_TR];
}

/**
 * THE RATINGS THE PLACEMENT STEPS CARRY, as implied chips — one per event —
 * for the tiles the chips did not already print (a tile chip's own implied
 * rating was stated by the rating pass).
 */
function stepRatingChips(player: IPlayer, effects: ReadonlyArray<ActionEffect>, steps: ReadonlyArray<ActionPreviewStep>): Array<ActionEffect> {
  const printed: Record<'greenery' | 'ocean', number> = {greenery: 0, ocean: 0};
  for (const effect of effects) {
    if (effect.direction === 'gain' && effect.diverted === undefined && (effect.icon === 'oceans' || effect.icon === 'greenery')) {
      printed[effect.icon === 'oceans' ? 'ocean' : 'greenery'] += effect.amount;
    }
  }
  const out: Array<ActionEffect> = [];
  for (const step of steps) {
    const kind = tileKindOfStep(step);
    if (kind === undefined || step.kind !== 'boardPlacement') {
      continue;
    }
    const count = step.count ?? 1;
    const beyond = Math.max(0, count - printed[kind]);
    printed[kind] = Math.max(0, printed[kind] - count);
    for (let i = 0; i < beyond; i++) {
      for (const amount of tileRatingEvents(player, kind)) {
        out.push({direction: 'gain', icon: 'tr', amount, implied: true});
      }
    }
  }
  return out;
}

/**
 * THE PASS over one branch's chips and steps (the core every door calls):
 * the placement steps' ratings stated, the seat's rating projected against
 * the others' highest, every rating chip the funnel would refuse STRUCK, the
 * pool readings after a struck chip rebased. A new array comes back; nothing
 * of the input is mutated.
 */
export function vetoEffects(player: IPlayer, effects: ReadonlyArray<ActionEffect>, steps: ReadonlyArray<ActionPreviewStep> = []): Array<ActionEffect> {
  const law = vetoingLaw(player);
  if (law === undefined) {
    return [...effects];
  }
  const others = highestOtherRating(player);
  let projected = player.terraformRating;
  let struckAhead = 0;
  const out: Array<ActionEffect> = [];
  const judge = (effect: ActionEffect): void => {
    // 3. The pool reading after a struck chip: the struck steps never moved it.
    const chip: ActionEffect = struckAhead > 0 && effect.current !== undefined && effect.resulting !== undefined ?
      {...effect, current: effect.current - struckAhead, resulting: effect.resulting - struckAhead} :
      effect;
    // 2. First by rating at this point of the sequence → the whole event is refused.
    if (projected >= others) {
      const mark: VetoedRatingMark = {resolution: law.id, steps: effect.amount};
      out.push({...chip, vetoed: mark});
      struckAhead += effect.amount;
      return;
    }
    projected += effect.amount;
    out.push(chip);
  };
  // 1. The tiles the steps promise — their ratings judged after the play's own chips (the cell is asked, then the
  //    tile pays), and before a closing NET line restates the whole.
  let stepChips: Array<ActionEffect> | undefined = stepRatingChips(player, effects, steps);
  const judgeSteps = (): void => {
    for (const chip of stepChips ?? []) {
      judge(chip);
    }
    stepChips = undefined;
  };
  for (const effect of effects) {
    if (!isRatingGain(effect)) {
      out.push(effect);
      continue;
    }
    // 3. A NET restatement (TR47's closing line) is no event: it reads the net the struck steps leave, or leaves.
    if (effect.implied === true && effect.phase === NET_PHASE) {
      judgeSteps();
      const net = effect.amount - struckAhead;
      if (net > 0) {
        out.push({...effect, amount: net});
      }
      continue;
    }
    judge(effect);
  }
  judgeSteps();
  return out;
}

/** The pass over a whole preview — every branch on its own projection (a branch is one path of the funnel). */
export function withVetoedRating(player: IPlayer, preview: ActionPreview): ActionPreview {
  if (vetoingLaw(player) === undefined) {
    return preview;
  }
  return {
    ...preview,
    branches: preview.branches.map((branch): ActionPreviewBranch => ({...branch, effects: vetoEffects(player, branch.effects, branch.steps)})),
  };
}

/**
 * THE «NO EFFECT» VERDICT OF A VETOED RATING (Р5): an action whose WHOLE
 * result is a rating the seat — first by rating right now — will not gain
 * (the UNMI corporation's «3 M€ → +1 TR», a card printing `tr` alone). A step
 * of a scale is never this: the scale moves. Undefined while the seat is not
 * first by rating (its rating is gained).
 */
export function ratingVetoFutility(player: IPlayer): ActionFutilityVerdict | undefined {
  return ratingVetoed(player) ? {kind: 'rating-vetoed', reason: UNMI_VETO_REASON} : undefined;
}
