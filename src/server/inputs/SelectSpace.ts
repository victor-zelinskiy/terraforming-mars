import {Message} from '../../common/logs/Message';
import {Space} from '../boards/Space';
import {InputResponse, isCancelResponse, isSelectSpaceResponse} from '../../common/inputs/InputResponse';
import {SelectSpaceModel} from '../../common/models/PlayerInputModel';
import {BasePlayerInput} from '../PlayerInput';
import {InputError} from './InputError';
import {toID} from '../../common/utils/utils';
import {PlacementIllegalSpace} from '../../common/inputs/PlacementIllegalReason';
import {SpaceId} from '../../common/Types';
import {PlacementType} from '../boards/PlacementType';

export class SelectSpace extends BasePlayerInput<Space> {
  /**
   * Per-cell illegality reasons for cells NOT in `spaces` (the legal
   * targets). Optional — callers that don't compute these get the
   * default "no tooltip" UX on the client.
   *
   * The main board-placement deferred actions
   * (`PlaceTile` / `PlaceCityTile` / `PlaceOceanTile` / `PlaceGreeneryTile`)
   * fill this via `MarsBoard.computeIllegalReasons()`; smaller custom
   * SelectSpace paths (LandClaim, Eris, Mining, Moon, …) can stay
   * silent without breaking anything.
   */
  public illegalSpaces?: ReadonlyArray<PlacementIllegalSpace>;

  /**
   * Target spaces whose CURRENT tile will be REMOVED before the new tile is
   * placed on the same cell (KaguyaTech, LunarMineUrbanization — the "remove
   * your X, place a Y there regardless of placement rules" cards). The client
   * hides the doomed tile graphic and shows the placement bonus instead, so
   * the player reads what they GAIN rather than a tile that's about to vanish.
   *
   * Leave undefined for an OVERLAY placement (St. Joseph's cathedral over a
   * city) or any "pick an existing tile" prompt — there the base tile must
   * stay visible. Set via `createMarsSelectSpace({hideExistingTile: true})`
   * or assigned directly.
   */
  public hiddenTiles?: ReadonlyArray<SpaceId>;

  /**
   * The kind of placement this prompt represents (city / greenery / ocean / …).
   * Set by `createMarsSelectSpace`. Lets the client fetch a kind-accurate
   * {@link BoardPlacementPreview} (cost / gains / endgame VP / who-gets-what) for
   * the hovered cell. Absent on custom SelectSpace paths → the client falls back
   * to the kind-less cell info.
   */
  public placementType?: PlacementType;

  /**
   * Optional cancel handler for a CANCELLABLE placement (see `placementContext`).
   * When the client submits a `CancelResponse` AND this prompt is cancellable,
   * `process` invokes this instead of placing — the pay-on-commit standard
   * projects set it to flag the action as cancelled (no cost applied, the player
   * returns to the action menu). Absent → a cancel response is rejected.
   */
  public onCancel?: () => void;

  constructor(
    title: string | Message,
    public spaces: ReadonlyArray<Space>,
    illegalSpaces?: ReadonlyArray<PlacementIllegalSpace>) {
    super('space', title);
    if (spaces.length === 0) {
      throw new InputError('No available spaces');
    }
    this.illegalSpaces = illegalSpaces;
  }

  public override toModel(): SelectSpaceModel {
    return {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'space',
      spaces: this.spaces.map(toID),
      illegalSpaces: this.illegalSpaces,
      hiddenTiles: this.hiddenTiles,
      placementType: this.placementType,
    };
  }

  public process(input: InputResponse) {
    // Cancel a pending, not-yet-committed placement (pay-on-commit standard
    // projects). Only honoured when the placement declared itself cancellable
    // AND supplied a cancel handler; otherwise the placement is mandatory.
    if (isCancelResponse(input)) {
      if (this.placementContext?.cancellable === true && this.onCancel !== undefined) {
        this.onCancel();
        return undefined;
      }
      throw new InputError('This placement cannot be cancelled');
    }
    if (!isSelectSpaceResponse(input)) {
      throw new InputError('Not a valid SelectSpaceResponse');
    }
    const space = this.spaces.find((space) => space.id === input.spaceId);
    if (space === undefined) {
      throw new InputError('Space not available');
    }
    return this.cb(space);
  }
}
