import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {IGame} from '../../IGame';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import * as constants from '../../../common/constants';
import {PartyHooks} from '../../turmoil/parties/PartyHooks';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {Card} from '../Card';
import {globalParameter} from '../../inputs/optionMetadata';
import {ActionPreview, ActionPreviewStep, ActionEffect} from '../../../common/models/ActionPreviewModel';
import {stepsForBehavior} from '../../models/actionPreview';
import * as actionPreviews from '../actionPreviews';

export class Atmoscoop extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.ATMOSCOOP,
      cost: 22,
      tags: [Tag.JOVIAN, Tag.SPACE],

      requirements: {tag: Tag.SCIENCE, count: 3},
      victoryPoints: 1,

      behavior: {
        addResourcesToAnyCard: {count: 2, type: CardResource.FLOATER},
      },

      metadata: {
        cardNumber: '217',
        description: 'Requires 3 science tags. Either raise the temperature 2 steps, or raise Venus 2 steps. Add 2 floaters to ANY card.',
        renderData: CardRenderer.builder((b) => {
          b.temperature(2).or(Size.SMALL).venus(2).br;
          b.resource(CardResource.FLOATER, 2).asterix();
        }),
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    if (PartyHooks.reds01PolicyInEffect(player)) {
      const cost = player.getCardCost(this);
      if (!player.canAfford({cost, titanium: true})) {
        return false;
      }
      // TODO(kberg): this is not correct, because the titanium can't be used for the reds cost.
      return player.canAfford({cost, tr: {temperature: 2}, titanium: true}) ||
        player.canAfford({cost, tr: {venus: 2}, titanium: true});
    }

    return true;
  }

  public override bespokePlay(player: IPlayer) {
    const game = player.game;
    if (this.temperatureIsMaxed(game) && this.venusIsMaxed(game)) {
      return undefined;
    }

    if (!this.temperatureIsMaxed(game) && this.venusIsMaxed(game)) {
      player.game.increaseTemperature(player, 2);
    } else if (this.temperatureIsMaxed(game) && !this.venusIsMaxed(game)) {
      player.game.increaseVenusScaleLevel(player, 2);
    } else {
      return this.buildParameterChoice(player);
    }
    return undefined;
  }

  // SIDE-EFFECT-FREE construction of the temperature-or-Venus OrOptions (the
  // parameter is raised in each option's `andThen`), shared by `bespokePlay` and
  // the read-only `cardPlayPreview` so the live prompt and the pre-collected modal
  // step can't drift.
  private buildParameterChoice(player: IPlayer): OrOptions {
    const game = player.game;
    const tempNow = game.getTemperature();
    const venusNow = game.getVenusScaleLevel();
    const increaseTemp = new SelectOption('Raise temperature 2 steps', 'Raise temperature')
      .withMetadata(globalParameter('temperature', 2, tempNow, Math.min(constants.MAX_TEMPERATURE, tempNow + 4), '°C'))
      .andThen(() => {
        game.increaseTemperature(player, 2);
        return undefined;
      });
    const increaseVenus = new SelectOption('Raise Venus 2 steps', 'Raise Venus')
      .withMetadata(globalParameter('venus', 2, venusNow, Math.min(constants.MAX_VENUS_SCALE, venusNow + 4), '%'))
      .andThen(() => {
        game.increaseVenusScaleLevel(player, 2);
        return undefined;
      });
    return new OrOptions(increaseTemp, increaseVenus)
      .setTitle('Choose global parameter to raise');
  }

  // The on-play preview: the temperature/Venus CHOICE (a rich OrOptions step with
  // current → resulting per option) when both are open, OR a fixed parameter chip
  // when only one is (the live play auto-raises it), PLUS the "+2 floaters to a
  // card" gain chip + target pick (reusing the generic behavior walker so a
  // no-eligible-card silent-loss warning is handled). The parameter choice defers
  // FIRST (DEFAULT) before the floater add (GAIN_RESOURCE_OR_PRODUCTION), so the
  // steps are ordered to match. Built read-only.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const game = player.game;
    const extra: Array<ActionEffect> = [];
    const steps: Array<ActionPreviewStep | undefined> = [];
    if (!this.temperatureIsMaxed(game) && !this.venusIsMaxed(game)) {
      steps.push(actionPreviews.orOptionsStep(player, this.buildParameterChoice(player)));
    } else if (!this.temperatureIsMaxed(game)) {
      extra.push(actionPreviews.globalGain(player, 'temperature', 2));
    } else if (!this.venusIsMaxed(game)) {
      extra.push(actionPreviews.globalGain(player, 'venus', 2));
    }
    for (const s of stepsForBehavior(player, this, this.behavior ?? {})) {
      steps.push(s);
    }
    return actionPreviews.playPreview(this, player, extra, steps);
  }

  private temperatureIsMaxed(game: IGame) {
    return game.getTemperature() === constants.MAX_TEMPERATURE;
  }

  private venusIsMaxed(game: IGame) {
    return game.getVenusScaleLevel() === constants.MAX_VENUS_SCALE;
  }
}
