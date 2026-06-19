import {AndOptions} from '../inputs/AndOptions';
import {OrOptions} from '../inputs/OrOptions';
import {SelectCard} from '../inputs/SelectCard';
import {DeferredAction} from '../deferredActions/DeferredAction';
import {Priority} from '../deferredActions/Priority';
import {IPlayer} from '../IPlayer';
import {GainResources} from '../inputs/GainResources';
import {message} from '../logs/MessageBuilder';

export class GrantVenusAltTrackBonusDeferred extends DeferredAction {
  constructor(
    player: IPlayer,
    public standardResourceCount: number,
    public wildResource: boolean,
  ) {
    super(player, Priority.GAIN_RESOURCE_OR_PRODUCTION);
  }

  private selectStandardResources(count: number) {
    return new GainResources(
      this.player,
      count,
      message('Gain ${0} resource(s) for your Venus track bonus.', (b) => b.number(count)),
    );
  }

  public execute() {
    const resourceCards = this.player.getResourceCards(undefined);
    const base = this.standardResourceCount;

    // No wild bonus (or nowhere to put a wild card-resource) → just the base
    // standard resources. Marked so the premium client renders the resource-tile
    // picker instead of the legacy numeric-distribution form.
    if (this.wildResource === false || resourceCards.length === 0) {
      return this.selectStandardResources(base)
        .markVenusBonusPrompt({kind: 'standard', baseCount: base});
    }

    // Final-step (30%) bonus: the base standard resources PLUS one wild resource
    // that can either go on a card or be another standard resource. Modelled as a
    // SINGLE OrOptions (no andThen chain) so the premium modal collects every
    // choice and submits ONE response:
    //   branch 0 = add the wild to a card  + the base standard resources;
    //   branch 1 = the base standard resources + 1 (the wild folded in as standard).
    // Semantically identical to the legacy OrOptions→andThen flow.
    const onCard = new AndOptions(
      new SelectCard('Add resource to card', 'Add resource', resourceCards)
        .andThen(([card]) => {
          this.player.addResourceTo(card, {qty: 1, log: true});
          return undefined;
        }),
      this.selectStandardResources(base),
    );
    const standardWild = this.selectStandardResources(base + 1);

    const wild = new OrOptions(onCard, standardWild);
    wild.title = base > 0 ?
      message(
        'Choose your wild resource bonus, after which you will gain ${0} more distinct standard resources.',
        (b) => b.number(base)) :
      'Choose your wild resource bonus.';
    return wild.markVenusBonusPrompt({
      kind: 'final',
      baseCount: base,
      wildCardTargets: resourceCards.map((c) => c.name),
    });
  }
}
