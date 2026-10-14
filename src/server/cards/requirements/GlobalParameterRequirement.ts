import {IPlayer} from '../../IPlayer';
import {InequalityRequirement} from './InequalityRequirement';
import {GlobalParameter} from '../../../common/GlobalParameter';
import {CardName} from '../../../common/cards/CardName';
import {IProjectCard} from '../IProjectCard';
import {CardResource} from '../../../common/CardResource';


/**
 * Defines the class of requirements that compare against global parameters. Subclasses define
 * important attributes of how each global paramter functions (e.g. `OxygenRequirement`.)
 *
 * For the most part, this is not much different than `InequalityRequirement` but the
 * Pathfinders card Think Tank adds most of the complexity.
 */
export abstract class GlobalParameterRequirement extends InequalityRequirement {
  protected scale: number = 1;
  protected abstract parameter: GlobalParameter;

  /** The parameter this requirement compares against, for structural consumers (reason engines). */
  public get globalParameter(): GlobalParameter {
    return this.parameter;
  }

  /**
   * The printed bound adjusted by the player's CURRENT requirement bonus
   * (Adaptation Technology, Inventrix, an armed Special Design, policies,
   * Underworld tokens — everything `getGlobalParameterRequirementBonus` sums),
   * in the parameter's own units. A max bound stretches UP, a min bound
   * relaxes DOWN — the same directions `getScore` folds the bonus in, just
   * expressed on the threshold side so a UI can print it next to the raw
   * parameter value.
   *
   * `'waived'` when the player IGNORES the requirement (TR49 / Ecology
   * Experts — `IPlayer.globalRequirementWaiver`): there is no bound left to
   * print, and a number would be a lie.
   */
  public effectiveThreshold(player: IPlayer): number | 'waived' {
    if (player.globalRequirementWaiver(this.parameter) !== undefined) {
      return 'waived';
    }
    return this.thresholdWithBonus(player.getGlobalParameterRequirementBonus(this.parameter));
  }

  /** The printed bound moved by `steps` requirement steps (MIN relaxes down, MAX stretches up). */
  public thresholdWithBonus(steps: number): number {
    const bonusUnits = steps * this.scale;
    return this.max ? this.count + bonusUnits : this.count - bonusUnits;
  }

  /** Whether `value` (the scale, in its own units) meets the printed bound moved by `steps`. */
  public meetsWithBonus(value: number, steps: number): boolean {
    const bound = this.thresholdWithBonus(steps);
    return this.max ? value <= bound : value >= bound;
  }

  public abstract getGlobalValue(player: IPlayer): number;

  public override satisfies(player: IPlayer, card: IProjectCard): boolean {
    // An IGNORED requirement is met — before the Think Tank / Aeron bridge,
    // which therefore spends nothing on it.
    if (player.globalRequirementWaiver(this.parameter) !== undefined) {
      return true;
    }
    if (super.satisfies(player, card)) {
      return true;
    }
    const aeronGenomicsResources = (card.resourceType === CardResource.ANIMAL) ?
      (player.tableau.get(CardName.AERON_GENOMICS)?.resourceCount ?? 0):
      0;
    const thinkTankResources = player.tableau.get(CardName.THINK_TANK)?.resourceCount ?? 0;
    const sum = aeronGenomicsResources + thinkTankResources;
    if (sum > 0) {
      const distance = this.distance(player);
      if (distance <= sum) {
        card.additionalProjectCosts = card.additionalProjectCosts ?? {};
        const animals = Math.min(distance, aeronGenomicsResources);
        const data = Math.min(distance - aeronGenomicsResources, thinkTankResources);
        if (animals > 0) {
          card.additionalProjectCosts.aeronGenomicsResources = animals;
        }
        if (data > 0) {
          card.additionalProjectCosts.thinkTankResources = data;
        }
        return true;
      }
    }
    return false;
  }

  public getScore(player: IPlayer): number {
    const playerRequirementsBonus = player.getGlobalParameterRequirementBonus(this.parameter) * this.scale;

    const level = this.getGlobalValue(player);

    if (this.max) {
      return level - playerRequirementsBonus;
    } else {
      return level + playerRequirementsBonus;
    }
  }

  public distance(player: IPlayer): number {
    return Math.floor(Math.abs(this.getScore(player) - this.count) / this.scale);
  }
}
