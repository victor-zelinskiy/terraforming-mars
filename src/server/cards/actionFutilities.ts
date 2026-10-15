/*
 * THE BUILDERS OF «NO EFFECT» — what a card file uses to state, beside its own `action()` / `canAct()`, when its action
 * would change nothing (`ICard.actionFutility`, the co-located hook of a BESPOKE action; a declarative action is read by
 * `models/actionFutility.ts` itself). The verdicts only — never the rescues: whether a Whales owner, a reacting card or
 * a still-live award turns the action back into a useful one is decided ONCE, by the engine, for every card alike.
 *
 * Read-only and light (no heavy imports: card files import this), the same arithmetic the engine runs — a raise stops
 * at its ceiling (`parameterRoom`), an ocean needs a tile left (`canAddOcean`).
 */
import {IPlayer} from '../IPlayer';
import {CardResource} from '../../common/CardResource';
import {parameterRoom} from '../../common/parliament/parameterMove';
import {
  ActionBranchFutility, ActionFutility, ActionFutilityVerdict, FutileParameter,
} from '../../common/models/ActionFutilityModel';

/** The tile / meta-line reason of a step at a maxed parameter (i18n keys). */
const PARAMETER_MAXED_REASON: Readonly<Record<FutileParameter, string>> = {
  temperature: 'The temperature is at its maximum',
  oxygen: 'Oxygen is at its maximum',
  oceans: 'Oceans are at their maximum',
  venus: 'Venus is at its maximum',
};

/**
 * A step of `parameter` would not move it — the verdict, or `undefined` while it still has room. (One step is enough
 * to ask: a raise of N steps moves the parameter iff a raise of one does.)
 */
export function parameterMaxed(player: IPlayer, parameter: FutileParameter): ActionFutilityVerdict | undefined {
  const game = player.game;
  const atLimit = parameter === 'oceans' ?
    !game.canAddOcean() :
    parameterRoom({parameter, steps: 1}, {
      oxygenLevel: game.getOxygenLevel(),
      temperature: game.getTemperature(),
      oceans: game.board.getOceanSpaces().length,
      venusScaleLevel: game.getVenusScaleLevel(),
    }).atLimit;
  return atLimit ? {kind: 'parameter-maxed', parameter, reason: PARAMETER_MAXED_REASON[parameter]} : undefined;
}

/** The counted gain comes to nothing right now. */
export function zeroYield(): ActionFutilityVerdict {
  return {kind: 'zero-yield', reason: 'Gives nothing right now'};
}

/** «Add to any card» with no card to take it. */
export function noTarget(): ActionFutilityVerdict {
  return {kind: 'no-target', reason: 'No card to receive the resource'};
}

/** A resource onto a card whose points no longer grow (the engine still asks the table whether anything counts it). */
export function vpCapped(resource: CardResource): ActionFutilityVerdict {
  return {kind: 'vp-capped', resource, reason: 'The card already scores its points'};
}

/** One branch as the card states it: can the player take it now, and — if it changes nothing — why. */
export type BranchFutilityClaim = {available: boolean, verdict?: ActionFutilityVerdict};

/**
 * The action's verdict from its branches, in `ActionPreview.branches` order: futile as a WHOLE only when every branch
 * the player can take now is futile (a dead branch neither helps nor hurts); `undefined` when no branch is futile —
 * there is nothing to say.
 */
export function futilityOfBranches(claims: ReadonlyArray<BranchFutilityClaim>): ActionFutility | undefined {
  if (!claims.some((c) => c.verdict !== undefined)) {
    return undefined;
  }
  const live = claims.filter((c) => c.available);
  const whole = live.length > 0 && live.every((c) => c.verdict !== undefined) ? live[0].verdict : undefined;
  const branches: ReadonlyArray<ActionBranchFutility> | undefined = claims.length > 1 ?
    claims.map((c): ActionBranchFutility => c.verdict !== undefined ? {futile: true, verdict: c.verdict} : {futile: false}) :
    undefined;
  return {
    ...(whole !== undefined ? {verdict: whole} : {}),
    ...(branches !== undefined ? {branches} : {}),
  };
}

/** A single-branch action: its verdict, or nothing to say. */
export function futilityOf(verdict: ActionFutilityVerdict | undefined): ActionFutility | undefined {
  return verdict === undefined ? undefined : {verdict};
}
