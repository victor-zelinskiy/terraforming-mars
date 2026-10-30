import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {PartyName} from '../../../common/turmoil/PartyName';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

/**
 * The bespoke half of the requirement (the plate's footnote «*»): the OTHER seats that have passed this generation, in
 * generation order — MarsBot among them once its action deck ran out (rulebook p.5). The reason's reading; the gate
 * stays upstream's (the player's own pass never meets this card — a seat that passed takes no more turns).
 */
function othersPassed(player: IPlayer): Array<IPlayer> {
  const passed = player.game.getPassedPlayers();
  return player.game.playersInGenerationOrder.filter((p) => p !== player && passed.includes(p.color));
}

export class RedAppeasement extends Card {
  // «This counts as passing» — `bespokePlay` below. The preview's `passes` and the hand's verdict read it (class CT).
  public readonly playCountsAsPass = true;

  constructor() {
    super({
      name: CardName.RED_APPEASEMENT,
      type: CardType.EVENT,
      cost: 0,
      requirements: {party: PartyName.REDS},

      behavior: {
        production: {megacredits: 2},
      },

      metadata: {
        cardNumber: 'P80',
        // The print's «*» beside the Reds' plate points at the requirement's bespoke half; the face draws it from this
        // flag (`premiumCardViewModel` → the requirement bar) and the full sentence lives in `description`, the hand's
        // reason and the information panel.
        requirementFootnote: true,
        infoText: [
          {kind: 'note', text: 'Playable only while no other player has passed this generation.'},
          {text: 'Increase your M€ production 2 steps.', tokens: ['production(']},
          {text: 'This counts as passing: you get no more turns this generation.', tokens: ['text']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.megacredits(2)).text('PASS').asterix();
        }),
        description: 'Requires that Reds are ruling or that you have 2 delegates there, and that no other player has passed. ' +
          'Increase your M€ production 2 steps. This counts as passing: you get no more turns this generation.',
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    return player.game.getPassedPlayers().length === 0;
  }

  public override bespokePlay(player: IPlayer) {
    player.pass();
    return undefined;
  }

  // The hand's «why can't I play this»: the party half is the requirement's own reason; the bespoke half NAMES who has
  // passed — the generic «unmet conditions» would hide the one fact the player needs.
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    const passed = othersPassed(player);
    if (passed.length === 0) {
      return undefined;
    }
    return {type: 'rule', message: 'Already passed this generation: ${0}', params: [passed.map((p) => p.name).join(', ')]};
  }

  // The production chip comes from `behavior`; the RESULT the behavior cannot show — the play IS the pass — is the
  // structural `passes` mark, read by the composer as the pass confirm's own reading (class CT).
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [], [], {passes: this.playCountsAsPass});
  }
}
