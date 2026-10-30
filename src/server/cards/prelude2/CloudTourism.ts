import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {ActionCard} from '../ActionCard';
import {CardResource} from '../../../common/CardResource';
import {Resource} from '../../../common/Resource';
import {ActionEffect, ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

/** One side of the pair as the card counts it: the tag, its count, the wild tags dealt to it, this card's own tag on it. */
type PairSide = {tag: Tag, count: number, wild: number, self: number};

export class CloudTourism extends ActionCard {
  constructor() {
    super({
      name: CardName.CLOUD_TOURISM,
      type: CardType.ACTIVE,
      tags: [Tag.JOVIAN, Tag.VENUS],
      cost: 11,
      victoryPoints: {resourcesHere: {}, per: 3},
      resourceType: CardResource.FLOATER,

      action: {
        addResources: 1,
      },

      metadata: {
        cardNumber: 'P69',
        description: 'Increase your M€ production 1 step for each pair of Earth and Venus tags you have, this card included.',
        infoText: [
          {text: 'Increase your M€ production 1 step for each pair of Earth and Venus tags you have, this card included.', tokens: ['production(megacredits', 'production(']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.action('Add 1 floater to this card.', (eb) => {
            eb.empty().startAction.resource(CardResource.FLOATER);
          }).br;
          b.production((pb) => {
            pb.megacredits(1).slash().tag(Tag.EARTH).tag(Tag.VENUS);
          });
        }),
      },
    });
  }

  // THE ONE COUNT of the pairs — `bespokePlay`, `countedPlayForecast` and `cardPlayPreview` all read it, so the
  // play, the hand plate and the composer's «ПОЧЕМУ» cannot say two numbers. Read-only.
  private pairCount(player: IPlayer): {earth: PairSide, venus: PairSide, pairs: number} {
    // This does its own calculation because player.tags isn't robust enough at the moment
    const earth: PairSide = {tag: Tag.EARTH, count: player.tags.count(Tag.EARTH, 'raw'), wild: 0, self: 0};
    // The +1 is "including this"
    const venus: PairSide = {tag: Tag.VENUS, count: player.tags.count(Tag.VENUS, 'raw') + 1, wild: 0, self: 1};
    if (player.tableau.has(CardName.EARTH_EMBASSY)) {
      earth.count += player.tags.count(Tag.MOON, 'raw');
    }
    // Not 'raw': a wild tag that is not printed (the Turmoil Redux Scientists'
    // party effect) is a wild tag too. The counts above stay 'raw', so each
    // wild tag is distributed exactly once, here — to the SMALLER side, Venus
    // on a tie.
    let wildTags = player.tags.count(Tag.WILD);
    while (wildTags > 0) {
      const side = earth.count < venus.count ? earth : venus;
      side.count++;
      side.wild++;
      wildTags--;
    }
    return {earth, venus, pairs: Math.min(earth.count, venus.count)};
  }

  public override bespokePlay(player: IPlayer) {
    player.production.add(Resource.MEGACREDITS, this.pairCount(player).pairs, {log: true});
    return undefined;
  }

  // The COUNTED play — the raise with what it counted, as a SET (`ActionEffectBasis.set`): each side with its own
  // number, the wild tags dealt to it and this card's own Venus tag. Venus always holds this card's tag, so a zero
  // is always the Earth side's: named in words.
  public countedPlayForecast(player: IPlayer): ReadonlyArray<ActionEffect> {
    const {earth, venus, pairs} = this.pairCount(player);
    return [actionPreviews.counted(
      actionPreviews.productionChange(player, Resource.MEGACREDITS, pairs),
      actionPreviews.tagSetBasis([earth, venus], pairs, 'No Earth tags'),
    )];
  }

  // The on-play preview: the M€ production raise is a FIXED, computable result — shown before the press. No choice,
  // so no steps.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, this.countedPlayForecast(player));
  }
}
