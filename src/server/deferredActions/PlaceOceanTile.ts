import {IPlayer} from '../IPlayer';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {PlacementType} from '../boards/PlacementType';
import {Space} from '../boards/Space';
import {CardName} from '../../common/cards/CardName';
import {Message} from '../../common/logs/Message';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';
import {AutomaTilePlacer} from '../automa/AutomaTilePlacer';
import {PlacementIllegalReason} from '../../common/inputs/PlacementIllegalReason';
import {PlacementContext} from '../../common/models/PlayerInputModel';
import {TileType} from '../../common/TileType';

type Options = {
  title?: string | Message,
  on?: PlacementType,
  spaces?: Array<Space>,
  /** For Icy Impactors */
  creditedPlayer?: IPlayer,
  // Card-specific per-cell reason for cells excluded by a custom `spaces`
  // filter (e.g. PolderTech's "ocean must be adjacent to a greenery").
  customReasoner?: (space: Space) => PlacementIllegalReason | undefined,
  // Cancellability (pay-on-commit Aquifer standard project).
  placementContext?: PlacementContext,
  onCancel?: () => void,
  // The card that asks (so the preview can include its own space-dependent effect).
  sourceCard?: CardName,
};

export class PlaceOceanTile extends DeferredAction<Space | undefined> {
  private creditedPlayer: IPlayer;
  constructor(
    player: IPlayer,
    private options: Options = {}) {
    super(player, Priority.PLACE_OCEAN_TILE);
    this.creditedPlayer = this.options.creditedPlayer ?? this.player;
  }

  public execute() {
    if (!this.player.game.canAddOcean()) {
      const whales = this.creditedPlayer.tableau.get(CardName.WHALES);
      if (whales !== undefined) {
        this.player.addResourceTo(whales, {qty: 1, log: true});
        const input = this.cb(undefined);
        this.player?.defer(input);
      }
      return undefined;
    }

    let title = this.options.title ?? this.getTitle('ocean');
    let availableSpaces: ReadonlyArray<Space> = [];
    let placementType: PlacementType | undefined;
    if (this.options.spaces !== undefined) {
      availableSpaces = this.options.spaces;
      placementType = this.options.on;
    } else {
      const on = this.options?.on || 'ocean';
      availableSpaces = this.player.game.board.getAvailableSpacesForType(this.player, on);
      title = this.options?.title ?? this.getTitle(on);
      placementType = on;
    }

    // MarsBot cannot answer a SelectSpace (Icy Impactors: «first player chooses
    // where you must place it» with the bot as first player froze the game on
    // this prompt). The bot picks via its standard placement tiebreakers and
    // the ocean lands for the credited player in the same response.
    if (this.player.isMarsBot) {
      if (availableSpaces.length === 0) {
        this.player.defer(this.cb(undefined));
        return undefined;
      }
      const space = AutomaTilePlacer.breakTie(this.player.game, availableSpaces);
      this.player.game.log('${0} chose where ${1} must place an ocean', (b) =>
        b.player(this.player).player(this.creditedPlayer));
      this.creditedPlayer.game.addOcean(this.creditedPlayer, space);
      this.creditedPlayer.defer(this.cb(space));
      return undefined;
    }

    return createMarsSelectSpace(this.player, title, availableSpaces, {
      placementType,
      // An ocean can be placed `on: 'land'` (not just an ocean-reserved cell) —
      // `placementType` carries the eligibility kind, `tileType` the tile, so
      // the preview always reads the ocean parameter + TR bump.
      tileType: TileType.OCEAN,
      sourceCard: this.options.sourceCard,
      customReasoner: this.options.customReasoner,
      placementContext: this.options.placementContext,
      onCancel: this.options.onCancel,
    })
      .andThen((space) => {
        this.creditedPlayer.game.addOcean(this.creditedPlayer, space);
        this.creditedPlayer.defer(this.cb(space));
        return undefined;
      });
  }

  private getTitle(type: PlacementType) {
    switch (type) {
    case 'ocean': return 'Select space for ocean tile';
    case 'land': return 'Select a land space to place an ocean tile';
    // case '': return 'Select space reserved for ocean to place greenery tile';
    default: throw new Error('unhandled type; ' + type);
    }
  }
}
