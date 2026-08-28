import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {CorporationCard} from '../corporation/CorporationCard';
import {IActionCard} from '../ICard';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {SelectOption} from '../../inputs/SelectOption';
import {SelectCard} from '../../inputs/SelectCard';
import {OrOptions} from '../../inputs/OrOptions';
import {LogHelper} from '../../LogHelper';
import {Resource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {digit} from '../Options';
import {ICorporationCard} from '../corporation/ICorporationCard';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import {gainStock} from '../../inputs/optionMetadata';

export class Astrodrill extends CorporationCard implements ICorporationCard, IActionCard {
  constructor() {
    super({
      name: CardName.ASTRODRILL,
      tags: [Tag.SPACE],
      startingMegaCredits: 35,
      resourceType: CardResource.ASTEROID,

      behavior: {
        addResources: 3,
      },

      metadata: {
        cardNumber: 'R21',
        description: 'You start with 35 M€ and 3 asteroid resources.',
        // EACH PRINTED ROW DESCRIBES ITSELF — see the note on Titan Floating
        // Launch-pad, which had the identical fold. The first row genuinely
        // offers two outcomes (add an asteroid OR take a standard resource), so
        // its own «OR» is honest: it describes ONE printed row. What was wrong
        // was the second row carrying the whole card's sentence, and a curated
        // short covering all three branches at once.
        // …and each row now gets its OWN caption, targeted by `tokens`. With two
        // groups a caption can no longer land by the `blocks.length === 1`
        // accident that put a three-branch sentence on one variant.
        infoText: [
          {kind: 'action-short', text: 'An asteroid on any card, or a standard resource', tokens: ['wild']},
          {kind: 'action-short', text: 'Trade an asteroid for 3 titanium', tokens: ['titanium']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(35).nbsp.resource(CardResource.ASTEROID, {amount: 3, digit});
          b.corpBox('action', (ce) => {
            ce.vSpace(Size.LARGE);
            ce.action('Add an asteroid resource to ANY card OR gain any standard resource.', (eb) => {
              eb.empty().startAction.resource(CardResource.ASTEROID).asterix().slash().wild(1).or();
            });
            ce.vSpace();
            ce.action('Remove an asteroid resource from this card to gain 3 titanium.', (eb) => {
              eb.resource(CardResource.ASTEROID).startAction.titanium(3, {digit});
            });
          });
        }),
      },
    });
  }

  public canAct(): boolean {
    return true;
  }

  // Branch order MUST match action(): remove-asteroid (when one is here) pushed
  // first, add-asteroid second, gain-standard-resource third. action() always
  // returns an OrOptions (add + gain are always offered), so disable auto-resolve.
  public actionPreview(player: IPlayer) {
    const asteroidCards = player.getResourceCards(CardResource.ASTEROID);
    // action() ALWAYS builds a SelectCard for the target (even one candidate, this
    // card) — pre-collect it whenever there's a candidate; never auto-add silently.
    const pickTarget = asteroidCards.length >= 1;
    return actionPreviews.orBranches(this, [
      {
        available: this.resourceCount > 0,
        title: 'Remove 1 asteroid on this card to gain 3 titanium',
        effects: [actionPreviews.cardCost(this, 1), actionPreviews.stockGain(player, Resource.TITANIUM, 3)],
        unavailableReason: actionReason.noResourcesHere(),
      },
      {
        // Target card pre-collected via optionInput (always — even a single candidate).
        available: true,
        title: 'Add 1 asteroid to a card',
        effects: [actionPreviews.cardResourceGain(CardResource.ASTEROID, 1)],
        optionInput: pickTarget ? actionPreviews.cardInput(player, 'Select card to add 1 asteroid', 'Add asteroid', asteroidCards) : undefined,
        // On a card that scores per asteroid the resource moves VICTORY POINTS —
        // usually the reason one target beats another.
        vpBox: actionPreviews.targetVictoryPoints(player, asteroidCards, 1),
      },
      {
        available: true,
        title: 'Gain a standard resource',
        // WHICH standard resource is a real decision, and it is pre-collected —
        // the SAME OrOptions the live action builds (`standardResourceOptions`
        // is side-effect-free; every mutation lives in an `andThen` the preview
        // never calls), so the composer hosts it as an embedded step INSIDE the
        // workspace and the batch replays it byte-for-byte. Left undeclared it
        // arrived AFTER the confirm as a bare generic band — a screen the flow
        // promises the player will never see.
        steps: [actionPreviews.orOptionsStep(player, this.standardResourceOptions(player))],
      },
    ], {autoResolveSingle: false});
  }

  /**
   * The six standard-resource options — built WITHOUT side effects (the gains
   * live in `andThen`) so `actionPreview` and `action` can share one builder and
   * cannot drift. Each option carries premium metadata (icon + this player's own
   * `current → resulting`), which is also what the console's commit wave flies
   * into the rail once the choice is made.
   */
  private standardResourceOptions(player: IPlayer): OrOptions {
    const gain = (resource: Resource, title: string, label: string) =>
      new SelectOption(title, label)
        .withMetadata(gainStock(player, resource, 1))
        .andThen(() => {
          player.stock.add(resource, 1, {log: true});
          return undefined;
        });
    // TITLED, because the surface hosting it shows the title as the step's own
    // heading: untitled it fell back to the generic «ВЫБЕРИТЕ ВАРИАНТ», which is
    // what the WHOLE screen is already about. `Choose a resource` is an existing
    // key — the decision names itself in one word.
    return new OrOptions(
      gain(Resource.TITANIUM, 'Gain 1 titanium', 'Gain titanium'),
      gain(Resource.STEEL, 'Gain 1 steel', 'Gain steel'),
      gain(Resource.PLANTS, 'Gain 1 plant', 'Gain plant'),
      gain(Resource.ENERGY, 'Gain 1 energy', 'Gain energy'),
      gain(Resource.HEAT, 'Gain 1 heat', 'Gain heat'),
      gain(Resource.MEGACREDITS, 'Gain 1 M€', 'Gain M€'),
    ).setTitle('Choose a resource');
  }

  public action(player: IPlayer) {
    const asteroidCards = player.getResourceCards(CardResource.ASTEROID);
    const opts = [];

    const gainStandardResource = new SelectOption('Gain a standard resource', 'Gain')
      .andThen(() => this.standardResourceOptions(player));

    const addResource = new SelectCard(
      'Select card to add 1 asteroid',
      'Add asteroid',
      asteroidCards)
      .andThen(([card]) => {
        player.addResourceTo(card, {log: true});
        return undefined;
      });

    const spendResource = new SelectOption('Remove 1 asteroid on this card to gain 3 titanium', 'Remove asteroid').andThen(() => {
      // removeResourceFrom + stock.add (NOT raw `resourceCount--` / `titanium +=`) so
      // BOTH the asteroid spend AND the titanium gain are recorded as GameEvents and
      // show in the journal. log:false — LogHelper logs the single combined message.
      player.removeResourceFrom(this, 1, {log: false});
      player.stock.add(Resource.TITANIUM, 3);
      LogHelper.logRemoveResource(player, this, 1, 'gain 3 titanium');

      return undefined;
    });

    if (this.resourceCount > 0) {
      opts.push(spendResource);
    }
    // ALWAYS a SelectCard for the asteroid target — even a single candidate (this
    // card) — so the player SEES where it goes (no silent auto-add-to-self).
    opts.push(addResource);
    opts.push(gainStandardResource);

    return new OrOptions(...opts);
  }
}
