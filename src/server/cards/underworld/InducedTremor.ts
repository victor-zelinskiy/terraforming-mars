import {CardType} from '../../../common/cards/CardType';
import {IProjectCard} from '../IProjectCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {IPlayer} from '../../IPlayer';
import {UnderworldExpansion} from '../../underworld/UnderworldExpansion';
import {cancelled} from '../Options';
import {createMarsSelectSpace} from '../../boards/marsSelectSpaceHelper';


export class InducedTremor extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.INDUCED_TREMOR,
      cost: 5,

      metadata: {
        cardNumber: 'U070',
        renderData: CardRenderer.builder((b) => {
          b.undergroundResources(1, {cancelled}).asterix().excavate();
        }),
        // TODO(kberg) make discard optional
        description: 'Discard 1 underground resource from the board. Then excavate an underground resource.',
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    return player.game.board.spaces.some((space) => space.undergroundResources !== undefined) &&
      UnderworldExpansion.excavatableSpaces(player).length > 0;
  }

  public override bespokePlay(player: IPlayer) {
    const game = player.game;
    const identifiedSpaces = game.board.spaces.filter((space) => space.undergroundResources !== undefined);
    // Step 1: pick a token to remove. Cells without a token → 'not-identified'.
    player.defer(createMarsSelectSpace(player, 'Select unclaimed resource token to remove', identifiedSpaces, {
      customReasoner: (space) => {
        if (space.undergroundResources === undefined) {
          return 'not-identified';
        }
        return undefined;
      },
    }).andThen((space) => {
      UnderworldExpansion.removeTokenFromSpace(game, space);
      // Step 2: pick a space to excavate. Cells excluded by excavatableSpaces
      // are either already-excavated or not-identified per UnderworldExpansion rules.
      return createMarsSelectSpace(player, 'Select space to excavate',
        UnderworldExpansion.excavatableSpaces(player), {
          customReasoner: (space2) => {
            if (space2.excavator !== undefined) {
              return 'already-excavated';
            }
            if (space2.undergroundResources === undefined) {
              return 'not-identified';
            }
            return undefined;
          },
        })
        .andThen((excavatedSpace) => {
          UnderworldExpansion.excavate(player, excavatedSpace);
          return undefined;
        });
    }));

    return undefined;
  }
}
