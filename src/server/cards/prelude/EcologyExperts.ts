import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {IPlayer} from '../../IPlayer';
import {PreludeCard} from './PreludeCard';
import {PlayProjectCard} from '../../deferredActions/PlayProjectCard';
import {CardRenderer} from '../render/CardRenderer';

export class EcologyExperts extends PreludeCard {
  constructor() {
    super({
      name: CardName.ECOLOGY_EXPERTS,
      tags: [Tag.PLANT, Tag.MICROBE],
      // The card it plays IGNORES its global requirements — a waiver by KIND
      // (TR49 class), spent by that very play.
      globalParameterRequirementBonus: {waive: true, nextCardOnly: true},

      behavior: {
        production: {plants: 1},
      },

      metadata: {

        infoText: [

          {text: 'Increase your plant production 1 step.', tokens: ['production(']},

          {text: 'Play a card from your hand, ignoring its global requirements.', tokens: ['ignore_global_requirements']},

        ],
        cardNumber: 'P10',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.plants(1)).br.br;
          b.projectRequirements();
        }),
        description: 'Increase your plant production 1 step. PLAY A CARD FROM HAND, IGNORING GLOBAL REQUIREMENTS.',
      },
    });
  }
  // bespokeCanPlay (NOT a full canPlay override) so the base still ANDs the
  // requirement + `canExecute(behavior)` checks — that keeps the unplayable-reason
  // mirror (`unplayableReasons`) honest. The behavior here is only `production:
  // {plants: 1}` (always executable), so this is behavior-identical to the old
  // full override while conforming to the reason-consistency invariant.
  /**
   * ORDER DEPENDENCY (co-located with the `bespokeCanPlay` below): the half of
   * this card that can fail is «play a card from your hand» — so what it lacks
   * is a legally playable PROJECT, and another prelude's draw MAY supply one.
   * `possible`, never `guaranteed`: an unseen card is not a promise.
   */
  public readonly preludeNeeds = 'playableCard' as const;

  public override bespokeCanPlay(player: IPlayer) {
    // NOTE: If the player has production-based benefits from this prelude (like )
    // The waiver this card arms, named for the length of the question.
    player.temporaryGlobalRequirementWaiver = this.name;
    player.production.plants++;
    if (player.playedCards.has(CardName.MANUTECH)) {
      player.plants++;
    }
    try {
      return player.getPlayableCards().length > 0;
    } finally {
      player.temporaryGlobalRequirementWaiver = undefined;
      player.production.plants--;
      if (player.playedCards.has(CardName.MANUTECH)) {
        player.plants--;
      }
    }
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(new PlayProjectCard(player));
    return undefined;
  }
}
