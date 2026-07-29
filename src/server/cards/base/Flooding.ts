import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {SelectPlayer} from '../../inputs/SelectPlayer';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {CardName} from '../../../common/cards/CardName';
import {TileType} from '../../../common/TileType';
import {Resource} from '../../../common/Resource';
import {PlaceOceanTile} from '../../deferredActions/PlaceOceanTile';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';
import {skip} from '../../inputs/optionMetadata';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {Space} from '../../boards/Space';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import * as actionPreviews from '../actionPreviews';
import * as placementPreviews from '../placementPreviews';

export class Flooding extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.FLOODING,
      cost: 7,
      tr: {oceans: 1},
      victoryPoints: -1,

      metadata: {
        cardNumber: '188',
        renderData: CardRenderer.builder((b) => {
          b.oceans(1).nbsp.minus().megacredits(4, {all}).asterix();
        }),
        description: 'Place an ocean tile. IF THERE ARE TILES ADJACENT TO THIS OCEAN TILE, YOU MAY REMOVE 4 M€ FROM THE OWNER OF ONE OF THOSE TILES.',
        infoText: [
          {text: 'Place an ocean tile.', tokens: ['oceans', 'tile-ocean']},
          {text: 'If there are tiles adjacent to this ocean tile, you may remove 4 M€ from the owner of one of those tiles.', tokens: ['megacredits']},
        ],
      },
    });
  }

  // The ocean placement (and the placement-dependent M€ removal that follows) is
  // bespoke — surface a note so the play modal isn't mute about the board step.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    // The tile is a plain OCEAN — the card's own name is not the tile's. The
    // adjacent-opponent attack is a SEPARATE follow-up, not a placement rule,
    // so it keeps its own note instead of bloating the placement line.
    return actionPreviews.placementPreview(this, player, {
      tile: TileType.OCEAN,
      steps: player.game.isSoloMode() ? [] : [actionPreviews.noteStep('generic', 'An adjacent opponent may lose 4 M€')],
    });
  }

  /**
   * The owners of the adjacent tiles this ocean could take 4 M€ from — the SINGLE
   * derivation shared by `bespokePlay` and the read-only `placementPreview`, so
   * the panel can never name a different set than the follow-up prompt offers.
   */
  private adjacentOpponents(player: IPlayer, space: Space): ReadonlyArray<IPlayer> {
    const adjacentPlayers: Set<IPlayer> = new Set();
    player.game.board.getAdjacentSpaces(space).forEach((adjacent) => {
      if (adjacent.player !== undefined && adjacent.player !== player && adjacent.tile !== undefined) {
        adjacentPlayers.add(adjacent.player);
      }
    });
    return Array.from(adjacentPlayers);
  }

  /**
   * The card's whole point-of-decision: WHERE the ocean goes decides WHO can be
   * hit for 4 M€. Without this the placement panel showed a plain ocean and the
   * attack surfaced only as a prompt after the tile was already down.
   */
  public placementPreview(player: IPlayer, space: Space): ReadonlyArray<BoardFact> {
    // Solo has no opponent to remove M€ from — `bespokePlay` skips the follow-up
    // entirely, so there is nothing to promise here.
    if (player.game.isSoloMode()) {
      return [];
    }
    const targets = this.adjacentOpponents(player, space);
    if (targets.length === 0) {
      return [placementPreviews.noEffectHere(this, 'No opponent tile is adjacent',
        {description: 'No adjacent tile belongs to another player, so no M€ can be removed.'})];
    }
    const facts: Array<BoardFact> = targets.map((target) => placementPreviews.gain(
      this,
      {icon: 'megacredits', amount: 4, direction: 'cost'},
      'May lose 4 M€',
      {
        id: `card-${this.name}-attack-${target.color}`,
        description: 'After placing, you may remove 4 M€ from the owner of one adjacent tile.',
        recipient: {kind: 'player', color: target.color},
        severity: 'warning',
      }));
    if (targets.length > 1) {
      facts.unshift(placementPreviews.upcomingChoice(this,
        'You choose which adjacent player loses 4 M€',
        {id: `card-${this.name}-attack-choice`}));
    }
    return facts;
  }

  public override bespokePlay(player: IPlayer) {
    const game = player.game;
    if (player.game.isSoloMode()) {
      game.defer(new PlaceOceanTile(player, {sourceCard: this.name}));
      return undefined;
    }

    game.defer(new PlaceOceanTile(player, {sourceCard: this.name})).andThen((space) => {
      if (!space) {
        return;
      }
      const adjacentPlayers = this.adjacentOpponents(player, space);

      if (adjacentPlayers.length > 0) {
        return new OrOptions(
          new SelectPlayer(
            Array.from(adjacentPlayers),
            'Select adjacent player to remove 4 M€ from',
            'Remove credits',
            {icon: 'megacredits', amount: 4},
          ).andThen((target) => {
            target.attack(player, Resource.MEGACREDITS, 4, {log: true});
            return undefined;
          }),
          new SelectOption('Don\'t remove M€ from adjacent player').withMetadata(skip()));
      }
      return undefined;
    });
    return undefined;
  }
}
