import {CardType} from '../../../common/cards/CardType';
import {IProjectCard} from '../IProjectCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {IPlayer} from '../../IPlayer';
import {UnderworldExpansion} from '../../underworld/UnderworldExpansion';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
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
        description: 'You may discard 1 underground resource of your choice from the board. Then excavate an underground resource.',
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    // The discard is optional, so only the excavation gates the card (upstream e469b12244).
    return UnderworldExpansion.excavatableSpaces(player).length > 0;
  }

  /** The excavation prompt — cells excluded by `excavatableSpaces` are already excavated or not identified. */
  private excavate(player: IPlayer) {
    return createMarsSelectSpace(player, 'Select space to excavate',
      UnderworldExpansion.excavatableSpaces(player), {
        customReasoner: (space) => {
          if (space.excavator !== undefined) {
            return 'already-excavated';
          }
          if (space.undergroundResources === undefined) {
            return 'not-identified';
          }
          return undefined;
        },
      })
      .andThen((excavatedSpace) => {
        UnderworldExpansion.excavate(player, excavatedSpace);
        return undefined;
      });
  }

  public override bespokePlay(player: IPlayer) {
    const game = player.game;
    const identifiedSpaces = game.board.spaces.filter((space) => space.undergroundResources !== undefined);
    if (identifiedSpaces.length === 0) {
      player.defer(this.excavate(player));
      return undefined;
    }

    // Step 1 (optional): pick a token to remove — or keep them all. Cells without a token → 'not-identified'.
    player.defer(new OrOptions(
      createMarsSelectSpace(player, 'Select unclaimed resource token to remove', identifiedSpaces, {
        customReasoner: (space) => {
          if (space.undergroundResources === undefined) {
            return 'not-identified';
          }
          return undefined;
        },
      }).andThen((space) => {
        UnderworldExpansion.removeTokenFromSpace(game, space);
        return this.excavate(player);
      }),
      new SelectOption('Do not remove resource').andThen(() => this.excavate(player)),
    ));
    return undefined;
  }
}
