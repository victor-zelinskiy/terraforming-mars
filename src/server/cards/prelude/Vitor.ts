import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {CorporationCard} from '../corporation/CorporationCard';
import {ICard} from '../ICard';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {IAward} from '../../awards/IAward';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Resource} from '../../../common/Resource';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class Vitor extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.VITOR,
      tags: [Tag.EARTH],
      startingMegaCredits: 48, // It's 45 + 3 when this corp is played
      initialActionText: 'Fund an award for free',

      metadata: {
        cardNumber: 'R35',
        description: 'You start with 45 M€. As your first action, fund an award for free.',
        renderData: CardRenderer.builder((b) => {
          b.br.br;
          b.megacredits(45).nbsp.award();
          b.corpBox('effect', (ce) => {
            ce.effect('When you play a card with a NON-NEGATIVE VP icon, including this, gain 3 M€.', (eb) => {
              eb.vpIcon().asterix().startEffect.megacredits(3);
            });
          });
        }),
      },
    });
  }

  private selectAwardToFund(player: IPlayer, award: IAward): SelectOption {
    // The option title is the bare award NAME (not "Fund X award") so the
    // premium AwardsOverlay — and the shared findAwardOptionPath /
    // submitInnerActionResponse machinery — can map the option to its award and
    // submit it, exactly like the paid Fund-an-award action does.
    return new SelectOption(award.name).andThen(() => {
      player.game.fundAward(player, award);
      return undefined;
    });
  }

  public override initialAction(player: IPlayer) {
    const game = player.game;

    // Awards are disabled for 1 player games
    if (game.isSoloMode()) {
      return;
    }

    // markAwardFundingPrompt({free}) routes this to the modern AwardsOverlay in
    // its free-sponsorship mode instead of the generic option modal.
    const freeAward = new OrOptions()
      .setTitle('Select award to fund')
      .setButtonLabel('Confirm')
      .markAwardFundingPrompt({free: true});

    // If Vitor isn't going first and someone else funds awards, filter them out.
    const availableAwards = game.awards.filter((award) => !game.fundedAwards.map((fa) => fa.award).includes(award));
    freeAward.options = availableAwards.map((award) => this.selectAwardToFund(player, award));

    return freeAward;
  }

  public onCardPlayed(player: IPlayer, card: ICard) {
    const victoryPoints = card.metadata.victoryPoints;
    if (victoryPoints === undefined) {
      return;
    }
    if (typeof(victoryPoints) === 'number') {
      if (victoryPoints <= 0) {
        return;
      }
    } else {
      // victoryPoints type is CardRenderDynamicVictoryPoints
      if (victoryPoints.points <= 0) {
        return;
      }
    }

    player.stock.add(Resource.MEGACREDITS, 3, {log: true, from: {card: this}});
  }
}
