import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {CorporationCard} from '../corporation/CorporationCard';
import {SelectOption} from '../../inputs/SelectOption';
import {OrOptions} from '../../inputs/OrOptions';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {Resource} from '../../../common/Resource';
import {all} from '../Options';
import {message} from '../../logs/MessageBuilder';
import {addResourceToCard, chip} from '../../inputs/optionMetadata';
import {cardEffect} from '../../inputs/choiceContext';
import {ICard} from '../ICard';
import {GainResourcesDeferred} from '../../deferredActions/GainResourcesDeferred';

export class Splice extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.SPLICE,
      tags: [Tag.MICROBE],
      startingMegaCredits: 44,

      firstAction: {
        text: 'Draw a card with a microbe tag',
        drawCard: {count: 1, tag: Tag.MICROBE},
      },

      metadata: {
        cardNumber: 'R28',
        description: 'You start with 44 M€. As your first action, reveal cards until you have revealed a microbe tag. Take it and discard the rest.',
        renderData: CardRenderer.builder((b) => {
          b.megacredits(44).nbsp.cards(1, {secondaryTag: Tag.MICROBE});
          b.corpBox('effect', (ce) => {
            ce.vSpace(Size.LARGE);
            // Split into two described blocks (one per effect) for readability,
            // mirroring Carbon Nanosystems — each effect carries its own text.
            // The owner's 2 M€ is unconditional per microbe tag of ANY player, so
            // when the owner plays the tag they are also "THAT PLAYER" → 4 M€ total
            // (or 2 M€ + a microbe). The texts make that overlap explicit.
            ce.effect('When ANY player (incl. you) plays a microbe tag, THAT PLAYER gains 2 M€ or adds a microbe to THAT card.', (eb) => {
              eb.tag(Tag.MICROBE, {all}).startEffect;
              eb.megacredits(2, {all}).or().resource(CardResource.MICROBE, {all}).asterix();
            });
            ce.vSpace();
            ce.effect('You ALSO gain 2 M€ — so your own microbe tag gives you 4 M€ (or 2 M€ and a microbe).', (eb) => {
              eb.tag(Tag.MICROBE, {all}).startEffect;
              eb.megacredits(2);
            });
          });
        }),
      },
    });
  }

  public onCardPlayedByAnyPlayer(player: IPlayer, card: ICard, cardPlayer: IPlayer) {
    const game = player.game;
    const microbeTags = cardPlayer.tags.cardTagCount(card, Tag.MICROBE);
    if (microbeTags === 0) {
      return;
    }

    const gain = microbeTags * 2;

    // Splice owner gets 2M€ per microbe tag
    game.defer(new GainResourcesDeferred(player, Resource.MEGACREDITS, {count: gain, log: true, from: {card: this}}));

    const gainResource = new SelectOption('Add a microbe resource to this card', 'Add microbe')
      .withMetadata(addResourceToCard(CardResource.MICROBE))
      .andThen(() => {
        cardPlayer.addResourceTo(card);
        return undefined;
      });

    const gainMC = new SelectOption(
      message('Gain ${0} M€', (b) => b.number(gain)),
      'Gain M€')
      .withMetadata({kind: 'resourceGain', effects: [chip('gain', 'megacredits', gain)]})
      .andThen(() => {
        game.defer(new GainResourcesDeferred(cardPlayer, Resource.MEGACREDITS, {count: gain, log: true, from: {card: this}}));
        return undefined;
      });

    if (card.resourceType === CardResource.MICROBE) {
      // Card player chooses between 2 M€ and a microbe on card, if possible
      cardPlayer.defer(new OrOptions(gainResource, gainMC)
        .markChoiceContext(cardEffect(this, 'A microbe tag was played.', 'effect-choice')));
    } else {
      gainMC.cb(undefined);
    }
  }
}
