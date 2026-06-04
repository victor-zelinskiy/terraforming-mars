import {Message} from '../../common/logs/Message';
import {BasePlayerInput} from '../PlayerInput';
import {IColony} from '../colonies/IColony';
import {InputResponse, isSelectColonyResponse} from '../../common/inputs/InputResponse';
import {SelectColonyModel} from '../../common/models/PlayerInputModel';
import {coloniesToModel} from '../models/ModelUtils';
import {IPlayer} from '../IPlayer';
import {InputError} from './InputError';

export class SelectColony extends BasePlayerInput<IColony> {
  // When true, show just the tile, and none of the cubes on top.
  // Used for tiles that are not yet in the game, or for a clearer
  // visualziation when necesary.
  public showTileOnly = false;
  // "pick an existing in-game colony" (default) vs "add a new colony tile to
  // the game" (Aridor & co). The premium picker shows ALL game colonies for the
  // former (disabling the unpickable ones) and only the offered tiles for the
  // latter — see SelectColonyModel.purpose.
  public purpose: 'selectExistingColony' | 'addNewColonyToGame' = 'selectExistingColony';
  // Relevant-but-unpickable colonies shown DISABLED with a reason. Kept OUT of
  // `colonies` so `process()` rejects them for free.
  public disabledColonies: ReadonlyArray<{colony: IColony, reason: string | Message}> = [];

  constructor(
    title: string | Message,
    buttonLabel: string = 'Save',
    public colonies: Array<IColony>,
  ) {
    super('colony', title);
    this.buttonLabel = buttonLabel;
  }

  public toModel(player: IPlayer): SelectColonyModel {
    const model: SelectColonyModel = {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'colony',
      coloniesModel: coloniesToModel(player.game, this.colonies, this.showTileOnly),
      purpose: this.purpose,
    };
    if (this.disabledColonies.length > 0) {
      model.disabledColonies = this.disabledColonies.map((d) => ({name: d.colony.name, reason: d.reason}));
    }
    return model;
  }

  public process(input: InputResponse) {
    if (!isSelectColonyResponse(input)) {
      throw new InputError('Not a valid SelectColonyResponse');
    }
    if (input.colonyName === undefined) {
      throw new InputError('No colony selected');
    }
    const colony = this.colonies.find((c) => c.name === input.colonyName);
    if (colony === undefined) {
      throw new InputError(`Colony ${input.colonyName} not found`);
    }
    return this.cb(colony);
  }
}
