import {PlayerInput} from '../PlayerInput';
import {InputResponse, isAndOptionsResponse} from '../../common/inputs/InputResponse';
import {IPlayer} from '../IPlayer';
import {AndOptionsModel} from '../../common/models/PlayerInputModel';
import {OptionsInput} from './OptionsPlayerInput';
import {InputError} from './InputError';

export class AndOptions extends OptionsInput<undefined> {
  constructor(...options: Array<PlayerInput>) {
    super('and', '', options);
  }

  public toModel(player: IPlayer): AndOptionsModel {
    const model: AndOptionsModel = {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'and',
      options: this.options.map((option) => option.toModel(player)),
    };
    // A Turmoil Redux PARTY ACTION (the Industrialists' two-part shift) is one
    // branch of the action menu — nesting-safe marker on the input itself.
    if (this.partyActionPrompt !== undefined) {
      model.partyActionPrompt = this.partyActionPrompt;
    }
    if (this.resolutionActionPrompt !== undefined) {
      model.resolutionActionPrompt = this.resolutionActionPrompt;
    }
    // A DISTRIBUTION of a card resource over several cards (the shared
    // `AddResourcesToCards` step): the marker is the console's whole reading
    // of this `and` — the faces, the sum, the VP of every amount — and it must
    // survive nesting (a deferred distribution can ride an OR branch).
    if (this.cardResourceDistributionPrompt !== undefined) {
      model.cardResourceDistributionPrompt = this.cardResourceDistributionPrompt;
    }
    return model;
  }

  public process(input: InputResponse, player: IPlayer) {
    if (!isAndOptionsResponse(input)) {
      throw new InputError('Not a valid AndOptionsResponse');
    }
    if (input.responses.length !== this.options.length) {
      throw new InputError('Incorrect options provided');
    }
    for (let i = 0; i < input.responses.length; i++) {
      player.defer(this.options[i].process(input.responses[i], player));
    }
    return this.cb(undefined);
  }
}
