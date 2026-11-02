import {IProjectCard} from '../IProjectCard';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {Card} from '../Card';
import {Tag} from '../../../common/cards/Tag';
import {CardRenderer} from '../render/CardRenderer';
import {PreludesExpansion} from '../../preludes/PreludesExpansion';
import {IPlayer} from '../../IPlayer';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

/**
 * P91 · WG Project — POLITICAL (the chairman's office; the requirement reads `game.politics` through
 * `ChairmanRequirement`). «Draw 3 prelude cards and play 1 of them, discard the other 2» — the FIRST card that plays a
 * prelude in the middle of the game. The pick is the deck-pick family's own (`PreludesExpansion.selectPreludeToPlay`
 * marks it `deckPickPrompt {origin: 'prelude', mode: 'play'}` in the action phase, sourced by this card) — never the
 * start marker, which would raise the start workspace over the hand playing this card.
 */
export class WGProject extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 9,
      tags: [Tag.EARTH],
      name: CardName.WG_PROJECT,
      type: CardType.AUTOMATED,

      requirements: {chairman: true},

      metadata: {
        description: 'Requires that you are Chairman. Draw 3 prelude cards from the prelude deck and play 1 of them; discard the other 2.',
        infoText: [
          {text: 'Draw 3 prelude cards from the prelude deck and play 1 of them; discard the other 2.', tokens: ['prelude']},
        ],
        cardNumber: 'P91',
        renderData: CardRenderer.builder((b) => b.prelude().asterix()),
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    return player.game.preludeDeck.canDraw(3);
  }

  // The bespoke half of «can I play it»: the prelude deck (with its discard pile, which reshuffles) is short — named,
  // never the generic «unmet conditions».
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (player.game.preludeDeck.canDraw(3)) {
      return undefined;
    }
    return {type: 'rule', message: 'Fewer than 3 preludes left in the prelude deck'};
  }

  public override bespokePlay(player: IPlayer) {
    const game = player.game;
    const cards = game.preludeDeck.drawNOrThrow(game, 3);
    return PreludesExpansion.selectPreludeToPlay(player, cards, 'discard', 'add', {source: this});
  }

  // Nothing is computable before the reveal — the three preludes are hidden information until the play resolves (the
  // pick is a deck pick: never pre-collected). An honest note says exactly what confirming starts (Valley Trust's).
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [], [
      actionPreviews.noteStep('generic', 'After confirming, draw 3 Prelude cards and choose one to play; the other two are discarded.'),
    ]);
  }
}
