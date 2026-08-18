import {AndOptions} from '../inputs/AndOptions';
import {OrOptions} from '../inputs/OrOptions';
import {SelectCard} from '../inputs/SelectCard';
import {DeferredAction} from '../deferredActions/DeferredAction';
import {Priority} from '../deferredActions/Priority';
import {IPlayer} from '../IPlayer';
import {GainResources} from '../inputs/GainResources';
import {message} from '../logs/MessageBuilder';
import {targetVictoryPoints} from '../cards/actionPreviews';

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

    // No wild bonus → just the base standard resources. Marked so the premium
    // client renders the resource-tile picker instead of the legacy form.
    if (this.wildResource === false) {
      return this.selectStandardResources(base)
        .markVenusBonusPrompt({kind: 'standard', baseCount: base});
    }

    // Final-step (30%) bonus with a wild resource but NO card that can host it:
    // the wild can ONLY be a standard resource, so grant base + 1 standard. Still
    // marked 'final' (empty wildCardTargets) so the premium modal shows the final
    // layout with the "resource on a card" tab DISABLED (+ a reason tooltip) — the
    // player must NEVER silently lose the wild just because they have no card.
    if (resourceCards.length === 0) {
      return this.selectStandardResources(base + 1)
        .markVenusBonusPrompt({kind: 'final', baseCount: base, wildCardTargets: []});
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
    // WHAT THE WILD IS WORTH, per candidate — the SAME authoritative reading
    // every other target picker gets (`actionPreviews.targetVictoryPoints`
    // evaluates each card's own `victoryPoints` descriptor, `per` arithmetic
    // included). A card whose points this resource never moves is ABSENT from
    // the box, and a prompt where NO candidate scores carries no key at all:
    // the marker never states a zero it does not mean. The prompt the server
    // asks — and the response it accepts — are byte-identical to before.
    const wildCardVp = targetVictoryPoints(this.player, resourceCards, 1);
    return wild.markVenusBonusPrompt({
      kind: 'final',
      baseCount: base,
      wildCardTargets: resourceCards.map((c) => c.name),
      ...(wildCardVp === undefined ? {} : {wildCardVp}),
    });
  }
}
