import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {CardName} from '../../../common/cards/CardName';
import {TileType} from '../../../common/TileType';
import {Resource} from '../../../common/Resource';
import {PlaceOceanTile} from '../../deferredActions/PlaceOceanTile';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';
import {disabledPlayerTarget, removeResourceFromPlayer, skip} from '../../inputs/optionMetadata';
import {attackEffect} from '../../inputs/choiceContext';
import {AutomaTargeting} from '../../automa/AutomaTargeting';
import {message} from '../../logs/MessageBuilder';
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
      // Mirrors `PlaceOceanTile.execute`: skip when oceans are maxed (the play
      // then produces no placement prompt), else the plain ocean-reserved set.
      staged: {
        spaces: () => player.game.canAddOcean() ?
          player.game.board.getAvailableSpacesForType(player, 'ocean') : [],
        placementType: 'ocean',
      },
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

  /** Up to 4 M€, but never more than the target effectively holds (a MarsBot's
   *  stock reads through its M€-supply proxy) — the one honest number the
   *  prompt row, the attack itself and the dossier all state. */
  private removableFrom(target: IPlayer): number {
    return Math.min(4, AutomaTargeting.attackableStock(target, Resource.MEGACREDITS));
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
    // Preview ↔ follow-up honesty: the prompt only offers owners with M€, so
    // the dossier promises exactly those — and states the skip when none has any.
    const attackable = targets.filter((target) => this.removableFrom(target) > 0);
    if (attackable.length === 0) {
      return [placementPreviews.noEffectHere(this, 'Adjacent opponents have no M€',
        {description: 'The owners of the adjacent tiles have no M€, so nothing can be removed.'})];
    }
    const facts: Array<BoardFact> = attackable.map((target) => {
      const qty = this.removableFrom(target);
      return placementPreviews.gain(
        this,
        {icon: 'megacredits', amount: qty, direction: 'cost'},
        qty === 4 ? 'May lose 4 M€' : message('May lose ${0} M€', (b) => b.number(qty)),
        {
          id: `card-${this.name}-attack-${target.color}`,
          description: 'After placing, you may remove 4 M€ from the owner of one adjacent tile.',
          recipient: {kind: 'player', color: target.color},
          severity: 'warning',
        });
    });
    if (attackable.length > 1) {
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
      if (adjacentPlayers.length === 0) {
        return undefined;
      }
      // The premium attack shape (the StealResources / RemoveAnyPlants
      // standard): one FLAT leaf option per victim with the target's
      // current → resulting, the deliberate skip, broke owners as greyed
      // targets with a reason, and the choiceContext marker that routes the
      // console to the one-press decision screen. A nested SelectPlayer here
      // rendered as a context-less two-step wizard.
      const attackable = adjacentPlayers.filter((target) => this.removableFrom(target) > 0);
      if (attackable.length === 0) {
        // Nobody adjacent holds any M€ — a silent no-op, like the shared
        // removal helpers: the placement dossier already said so before the
        // tile went down, and a prompt whose every row is dead is modal spam.
        return undefined;
      }
      const removalOptions = attackable.map((target) => {
        const qty = this.removableFrom(target);
        return new SelectOption(
          message('Remove ${0} M€ from ${1}', (b) => b.number(qty).player(target)),
          'Remove credits')
          .withMetadata(removeResourceFromPlayer(target, Resource.MEGACREDITS, qty,
            AutomaTargeting.attackableStock(target, Resource.MEGACREDITS)))
          .andThen(() => {
            target.attack(player, Resource.MEGACREDITS, qty, {log: true});
            return undefined;
          });
      });
      const disabled = adjacentPlayers
        .filter((target) => !attackable.includes(target))
        .map((target) => disabledPlayerTarget(target, 'megacredits', 'No M€ to remove'));
      return new OrOptions(
        ...removalOptions,
        new SelectOption('Don\'t remove M€ from adjacent player').withMetadata(skip()))
        .setTitle('Select adjacent player to remove 4 M€ from')
        .setDisabledOptions(disabled)
        .markChoiceContext(attackEffect(this, 'An ocean tile was placed next to an opponent\'s tile.'));
    });
    return undefined;
  }
}
