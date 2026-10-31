import {IPlayer} from '../IPlayer';
import {Space} from '../boards/Space';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {PlacementType} from '../boards/PlacementType';
import {Message} from '../../common/logs/Message';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';
import {PlacementIllegalReason} from '../../common/inputs/PlacementIllegalReason';
import {PlacementContext} from '../../common/models/PlayerInputModel';
import {CardName} from '../../common/cards/CardName';
import {TileType} from '../../common/TileType';

export class PlaceCityTile extends DeferredAction<Space | undefined> {
  constructor(
    player: IPlayer,
    private options?: {
      on?: PlacementType,
      title?: string | Message,
      spaces?: ReadonlyArray<Space>,
      // Card-specific per-cell reason for cells excluded by a custom `spaces`
      // filter (e.g. UrbanizedArea's "2+ adjacent cities", LavaTube's volcanic).
      customReasoner?: (space: Space) => PlacementIllegalReason | undefined,
      // Cancellability of this placement (pay-on-commit standard projects pass a
      // cancellable marker + onCancel; cards leave it for the committed default).
      placementContext?: PlacementContext,
      onCancel?: () => void,
      // The card that asks (so the preview can include its own space-dependent effect).
      sourceCard?: CardName,
      // The cell's PRINTED bonus pays this many times (P74 Frontier Town: 3) — announced on the prompt
      // (`SelectSpace.printedBonusMultiplier` — the dossier's numbers) and to `addTile` (the ONE grant, the tile
      // language's record, the enacted law's repeat). Absent → 1.
      printedBonusMultiplier?: number,
    }) {
    super(player, Priority.DEFAULT);
  }

  public execute() {
    const type = this.options?.on || 'city';
    // The engine's set is re-derived on every read of the standing prompt (`SelectSpace.liveSpaces`); a card's own
    // pre-derived list keeps the generic occupancy rule.
    const custom = this.options?.spaces;
    const derive = custom === undefined ?
      () => this.player.game.board.getAvailableSpacesForType(this.player, type) : undefined;
    const spaces = custom ?? this.player.game.board.getAvailableSpacesForType(this.player, type);
    const title = this.options?.title ?? this.getTitle(type);

    if (spaces.length === 0) {
      this.cb(undefined);
      return undefined;
    }
    return createMarsSelectSpace(this.player, title, spaces, {
      placementType: type,
      liveSpaces: derive,
      // `type` is the eligibility kind (a city can go `on: 'isolated'` —
      // Research Outpost / Early Expedition); `tileType` names the tile, so the
      // preview shows the city's own scoring instead of nothing.
      tileType: TileType.CITY,
      sourceCard: this.options?.sourceCard,
      customReasoner: this.options?.customReasoner,
      placementContext: this.options?.placementContext,
      onCancel: this.options?.onCancel,
      printedBonusMultiplier: this.options?.printedBonusMultiplier,
    })
      .andThen((space) => {
        const multiplier = this.options?.printedBonusMultiplier;
        if (multiplier !== undefined && multiplier !== 1) {
          this.player.game.addTile(this.player, space, {tileType: TileType.CITY}, {printedBonusMultiplier: multiplier});
        } else {
          this.player.game.addCity(this.player, space);
        }
        this.cb(space);
        return undefined;
      });
  }

  private getTitle(type: PlacementType) {
    switch (type) {
    case 'city': return 'Select space for city tile';
    case 'isolated': return 'Select place next to no other tile for city';
    // case '': return 'Select space reserved for ocean to place greenery tile';
    default: throw new Error('unhandled type; ' + type);
    }
  }
}
