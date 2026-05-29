import {Message} from '../../common/logs/Message';
import {Space} from '../boards/Space';
import {InputResponse, isSelectSpaceResponse} from '../../common/inputs/InputResponse';
import {SelectSpaceModel} from '../../common/models/PlayerInputModel';
import {BasePlayerInput} from '../PlayerInput';
import {InputError} from './InputError';
import {toID} from '../../common/utils/utils';
import {PlacementIllegalSpace} from '../../common/inputs/PlacementIllegalReason';

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
    };
  }

  public process(input: InputResponse) {
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
