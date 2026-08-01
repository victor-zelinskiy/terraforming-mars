import {Tag} from '../../../common/cards/Tag';
import {RoboticWorkforceBase} from './RoboticWorkforceBase';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {IPlayer} from '../../IPlayer';
import {Priority} from '../../deferredActions/Priority';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class RoboticWorkforce extends RoboticWorkforceBase {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.ROBOTIC_WORKFORCE,
      tags: [Tag.SCIENCE],
      cost: 9,
      metadata: {
        cardNumber: '086',
        renderData: CardRenderer.builder((b) => {
          b.text('Copy A', Size.SMALL, true).nbsp;
          b.production((pb) => pb.tag(Tag.BUILDING));
        }),
        description: 'Duplicate only the production box of one of your building cards.',
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    return this.getPlayableBuildingCards(player).length > 0;
  }

  public override bespokePlay(player: IPlayer) {
    player.defer(
      this.selectBuildingCard(
        player,
        this.getPlayableBuildingCards(player),
        'Select builder card to copy',
      ),
      Priority.ROBOTIC_WORKFORCE,
    );
    return undefined;
  }

  // The on-play preview: the SAME card picker `bespokePlay` defers — the player
  // chooses WHICH building card's production to copy, as premium card tiles in the
  // play modal, instead of a follow-up prompt. (`selectBuildingCard` builds a
  // `SelectCard(title, 'Copy', cards)`, so the response lines up byte-for-byte.)
  //
  // `copyProductionBox` is what makes the pick INFORMED rather than blind: it
  // asks the read-only mirror of `selectBuildingCard`'s own copy order what each
  // candidate would actually produce, per card. Without it the client can only
  // say «choose one of these», which is exactly the "no hidden target" rule this
  // fork does not bend — the whole card IS the choice of which box to copy. Its
  // sibling `CyberiaSystems` (same base class, same mechanic) has always passed
  // it; this one silently did not.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const cards = this.getPlayableBuildingCards(player);
    const step = cards.length > 0 ?
      actionPreviews.selectCardStep(player, 'Select builder card to copy', 'Copy', cards, {copyProductionBox: true}) :
      undefined;
    return actionPreviews.playPreview(this, player, [], [step]);
  }
}
