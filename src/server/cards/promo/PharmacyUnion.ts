import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {CorporationCard} from '../corporation/CorporationCard';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {SelectOption} from '../../inputs/SelectOption';
import {OrOptions} from '../../inputs/OrOptions';
import {optionResult, trChip, chip, skip} from '../../inputs/optionMetadata';
import {cardEffect} from '../../inputs/choiceContext';
import {ICard} from '../ICard';
import {Priority} from '../../deferredActions/Priority';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {Resource} from '../../../common/Resource';
import {all, digit} from '../Options';
import {SerializedCard} from '../../SerializedCard';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class PharmacyUnion extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.PHARMACY_UNION,
      startingMegaCredits: 54,
      resourceType: CardResource.DISEASE,

      behavior: {
        drawCard: {count: 1, tag: Tag.SCIENCE},
      },

      metadata: {
        cardNumber: 'R39',
        infoText: [
          {kind: 'effect-short', text: 'Any microbe tag: add a disease, lose 4 M€', tokens: ['tag-microbe']},
          {kind: 'effect-short', text: 'Science tag: remove a disease for TR', tokens: ['tag-science']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.megacredits(54).cards(1, {secondaryTag: Tag.SCIENCE});
          // blank space after MC is on purpose
          b.text('(You start with 54 M€. Draw a Science card.)', Size.TINY, false, false);
          b.corpBox('effect', (ce) => {
            ce.vSpace(Size.LARGE);
            // Split into two described blocks (one per effect) for readability,
            // mirroring Carbon Nanosystems — each effect carries its own text.
            ce.effect('When ANY microbe tag is played, add a disease here and lose 4 M€ or as much as possible.', (eb) => {
              eb.tag(Tag.MICROBE, {all}).startEffect.resource(CardResource.DISEASE).megacredits(-4);
            });
            ce.vSpace();
            ce.effect('When you play a science tag, remove a disease here and gain 1 TR OR if there are no diseases here, you MAY put this card face down in your EVENTS PILE to gain 3 TR.', (eb) => {
              eb.tag(Tag.SCIENCE).startEffect.minus().resource(CardResource.DISEASE);
              eb.tr(1, {size: Size.SMALL}).slash().tr(3, {size: Size.SMALL, digit});
            });
          });
        }),
      },
    });
  }

  public isDisabled = false;

  public override get tags() {
    if (this.isDisabled) {
      return [];
    }
    return [Tag.MICROBE, Tag.MICROBE];
  }

  private logAddingDisease(player: IPlayer, count: number, megaCreditsLost: number) {
    if (count === 1) {
      player.game.log('${0} added a disease to ${1} and lost ${2} M€',
        (b) => b.player(player).card(this).number(megaCreditsLost));
    } else {
      player.game.log('${0} added ${3} diseases to ${1} and lost ${2} M€',
        (b) => b.player(player).card(this).number(megaCreditsLost).number(count));
    }
  }

  private addDisease(player: IPlayer, count: number) {
    const megaCreditsLost = Math.min(player.megaCredits, count * 4);
    player.addResourceTo(this, count);
    player.stock.deduct(Resource.MEGACREDITS, megaCreditsLost);
    this.logAddingDisease(player, count, megaCreditsLost);
  }

  public onCardPlayedByAnyPlayer(player: IPlayer, card: ICard, activePlayer: IPlayer): void {
    if (this.isDisabled) {
      return;
    }

    const game = player.game;

    const hasScienceTag = player.tags.cardHasTag(card, Tag.SCIENCE);
    const hasMicrobesTag = card.tags.includes(Tag.MICROBE);

    if (player === activePlayer && hasScienceTag) {
      // Edge case, let player pick order of resolution (see https://github.com/bafolts/terraforming-mars/issues/1286)
      if (hasMicrobesTag && this.resourceCount === 0) {
        // TODO (Lynesth): Modify this when https://github.com/bafolts/terraforming-mars/issues/1670 is fixed
        if (player.canAfford({cost: 0, tr: {tr: 3}})) {
          player.defer(() => {
            const chipCost = Math.min(player.megaCredits, 4);
            return new OrOptions(
              new SelectOption('Turn it face down to gain 3 TR and lose up to 4 M€')
                .withMetadata(optionResult({
                  effects: [trChip(3), chip('cost', 'megacredits', chipCost)],
                  tradeoff: 'Card is turned face down — its effect stops working',
                }))
                .andThen(() => {
                  this.disable(player);
                  const megaCreditsLost = Math.min(player.megaCredits, 4);
                  player.stock.deduct(Resource.MEGACREDITS, megaCreditsLost);
                  game.log('${0} turned ${1} face down to gain 3 TR and lost ${2} M€', (b) => b.player(player).card(this).number(megaCreditsLost));
                  return undefined;
                }),
              new SelectOption('Add a disease to it and lose up to 4 M€, then remove a disease to gain 1 TR')
                .withMetadata(optionResult({
                  effects: [trChip(1), chip('cost', 'megacredits', chipCost)],
                  description: 'A disease is added then removed (net 0 here)',
                }))
                .andThen(() => {
                  const megaCreditsLost = Math.min(player.megaCredits, 4);
                  player.increaseTerraformRating();
                  player.stock.deduct(Resource.MEGACREDITS, megaCreditsLost);
                  this.logAddingDisease(player, 1, megaCreditsLost);
                  game.log('${0} removed a disease from ${1} to gain 1 TR', (b) => b.player(player).card(this));
                  return undefined;
                }),
            )
              .setTitle('Choose the order of tag resolution for Pharmacy Union')
              .markChoiceContext(cardEffect(this, 'A microbe + science card was played with no diseases stored.', 'effect-choice'));
          }, Priority.PHARMACY_UNION);
          return undefined;
        }
      } else {
        const scienceTags = player.tags.cardTagCount(card, Tag.SCIENCE);
        this.onScienceTagAdded(player, scienceTags);
      }
    }

    if (hasMicrobesTag) {
      player.defer(() => {
        const microbeTagCount = card.tags.filter((cardTag) => cardTag === Tag.MICROBE).length;
        this.addDisease(player, microbeTagCount);
        return undefined;
      }, Priority.PHARMACY_UNION);
    }
  }

  public onNonCardTagAdded(player: IPlayer, tag: Tag) {
    if (tag === Tag.SCIENCE) {
      this.onScienceTagAdded(player, 1);
    }
  }

  /**
   * Mirrors `onCardPlayedByAnyPlayer` branch for branch, reading the same
   * predicates in the same order:
   *  - the OWNER's own science tag (never a foreign play): a stored disease is
   *    removed for 1 TR (or refused by an unaffordable Reds tax — `skipped`);
   *    with none stored the player is ASKED to turn the card face down for
   *    3 TR (or do nothing);
   *  - a microbe + science card with NO disease stored asks the ORDER question
   *    first (both outcomes carry the 4 M€ loss), and then nothing else;
   *  - ANY player's microbe tag adds one disease per PRINTED microbe tag and
   *    takes up to 4 M€ each — at `Priority.PHARMACY_UNION`, before the card's
   *    own choices;
   *  - the science half that stays silent under a firing microbe half is the
   *    honest «no» (the tag half of the card that will not fire).
   */
  public cardPlayedForecast(cardOwner: IPlayer, activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    if (this.isDisabled) {
      return [];
    }
    const source = forecast.sourceOf(this, cardOwner, 'card-played-by-any');
    // The two printed blocks share ONE live channel, so the channel plan
    // cannot tell them apart: the card DECLARES which block each fact belongs
    // to (#0 the microbe half, #1 the science half — the render order of the
    // corp box); the order question is both halves at once and stays
    // undeclared (the honest «эффект этой карты»).
    const microbeSource = {...source, printedEffect: 0};
    const scienceSource = {...source, printedEffect: 1};
    const recipient = forecast.recipientOf(activePlayer, cardOwner);
    const own = cardOwner.id === activePlayer.id;
    const hasScienceTag = cardOwner.tags.cardHasTag(card, Tag.SCIENCE);
    const hasMicrobesTag = card.tags.includes(Tag.MICROBE);
    const facts: Array<EffectForecastFact> = [];
    const mcLoss = (): number => Math.min(cardOwner.megaCredits, 4);

    let orderChoiceAsked = false;
    if (own && hasScienceTag) {
      if (hasMicrobesTag && this.resourceCount === 0) {
        if (cardOwner.canAfford({cost: 0, tr: {tr: 3}})) {
          orderChoiceAsked = true;
          facts.push(forecast.asks(source,
            [actionPreviews.trGain(cardOwner, 3), actionPreviews.stockCost(cardOwner, Resource.MEGACREDITS, mcLoss())],
            [{
              label: 'Add a disease to it and lose up to 4 M€, then remove a disease to gain 1 TR',
              effects: [actionPreviews.trGain(cardOwner, 1), actionPreviews.stockCost(cardOwner, Resource.MEGACREDITS, mcLoss())],
            }],
            'You play a card with both a microbe and a science tag',
            {id: 'order', sequence: Priority.PHARMACY_UNION, reasonTag: Tag.SCIENCE}));
        }
      } else {
        const scienceTags = cardOwner.tags.cardTagCount(card, Tag.SCIENCE);
        let stored = this.resourceCount;
        for (let i = 0; i < scienceTags; i++) {
          if (stored > 0) {
            if (cardOwner.canAfford({cost: 0, tr: {tr: 1}})) {
              facts.push(forecast.exact(scienceSource,
                [{...actionPreviews.cardCost(this, 1), current: stored, resulting: stored - 1}, actionPreviews.trGain(cardOwner, 1)],
                forecast.tagReason(Tag.SCIENCE),
                {id: `science-${i}`, reasonTag: Tag.SCIENCE, sequence: Priority.SUPERPOWER, timing: 'before-card-choices'}));
              stored--;
            } else {
              facts.push(forecast.skipped(scienceSource, [actionPreviews.trGain(cardOwner, 1)],
                'The Reds ruling party makes the TR step unaffordable', {id: `science-${i}`, reasonTag: Tag.SCIENCE}));
            }
            continue;
          }
          if (!cardOwner.canAfford({cost: 0, tr: {tr: 3}})) {
            facts.push(forecast.skipped(scienceSource, [actionPreviews.trGain(cardOwner, 3)],
              'The Reds ruling party makes the TR step unaffordable', {id: `science-${i}`, reasonTag: Tag.SCIENCE}));
            continue;
          }
          facts.push(forecast.asks(scienceSource,
            [actionPreviews.trGain(cardOwner, 3)],
            [{label: 'Do nothing', effects: []}],
            forecast.tagReason(Tag.SCIENCE),
            {id: `science-${i}`, reasonTag: Tag.SCIENCE, sequence: Priority.SUPERPOWER}));
        }
      }
    }

    if (hasMicrobesTag && !orderChoiceAsked) {
      const microbeTagCount = card.tags.filter((cardTag) => cardTag === Tag.MICROBE).length;
      const loss = Math.min(cardOwner.megaCredits, microbeTagCount * 4);
      facts.push(forecast.exact(microbeSource,
        [actionPreviews.cardGain(this, microbeTagCount), actionPreviews.stockCost(cardOwner, Resource.MEGACREDITS, loss)],
        forecast.anyPlayerTagReason(Tag.MICROBE),
        {id: 'microbe', reasonTag: Tag.MICROBE, recipient, sequence: Priority.PHARMACY_UNION, timing: 'before-card-choices'}));
      if (own && !hasScienceTag) {
        facts.push(forecast.no(scienceSource, 'The card has no science tag', {id: 'science-no', reasonTag: Tag.SCIENCE}));
      }
    }
    return facts;
  }

  /**
   * RB-B FAQ: MarsBot's corporation starting tag or a printed track/bonus
   * effect gave it a MICROBE advancement — «resolve your corporation's effect
   * as if a card with a microbe was played»: this card's owner adds a disease
   * and loses up to 4 M€ (the same deferred resolution the played-card path
   * uses; the science half is own-plays-only and stays out by rule).
   */
  public onMarsBotMicrobeAdvancement(cardOwner: IPlayer): void {
    if (this.isDisabled) {
      return;
    }
    cardOwner.defer(() => {
      this.addDisease(cardOwner, 1);
      return undefined;
    }, Priority.PHARMACY_UNION);
  }
  public onScienceTagAdded(player: IPlayer, count: number) {
    const game = player.game;
    for (let i = 0; i < count; i++) {
      player.defer(() => {
        if (this.isDisabled) {
          return;
        }

        if (this.resourceCount > 0) {
          if (player.canAfford({cost: 0, tr: {tr: 1}}) === false) {
            // TODO (Lynesth): Remove this when #1670 is fixed
            game.log('${0} cannot remove a disease from ${1} to gain 1 TR because of unaffordable Reds policy cost', (b) => b.player(player).card(this));
          } else {
            player.removeResourceFrom(this, 1);
            player.increaseTerraformRating();
            game.log('${0} removed a disease from ${1} to gain 1 TR', (b) => b.player(player).card(this));
          }
          return undefined;
        }

        if (player.canAfford({cost: 0, tr: {tr: 3}}) === false) {
          // TODO (Lynesth): Remove this when #1670 is fixed
          game.log('${0} cannot turn ${1} face down to gain 3 TR because of unaffordable Reds policy cost', (b) => b.player(player).card(this));
          return;
        }

        return new OrOptions(
          new SelectOption('Turn this card face down and gain 3 TR', 'Gain TR')
            .withMetadata(optionResult({
              effects: [trChip(3)],
              tradeoff: 'Card is turned face down — its effect stops working',
            }))
            .andThen(() => {
              this.disable(player);
              game.log('${0} turned ${1} face down to gain 3 TR', (b) => b.player(player).card(this));
              return undefined;
            }),
          new SelectOption('Do nothing', 'Do nothing').withMetadata(skip()),
        ).markChoiceContext(cardEffect(this, 'You played a science tag and there are no diseases left here.', 'optional-effect'));
      }, Priority.SUPERPOWER); // Make it a priority
    }
  }

  private disable(player: IPlayer) {
    player.playedCards.retagCard(this, () => {
      this.isDisabled = true;
    });
    player.increaseTerraformRating(3);
  }

  public serialize(serialized: SerializedCard) {
    serialized.isDisabled = this.isDisabled;
  }

  public deserialize(serialized: SerializedCard) {
    this.isDisabled = Boolean(serialized.isDisabled);
  }
}
