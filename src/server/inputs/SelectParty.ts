import {Message} from '../../common/logs/Message';
import {BasePlayerInput} from '../PlayerInput';
import {PartyName} from '../../common/turmoil/PartyName';
import {InputResponse, isSelectPartyResponse} from '../../common/inputs/InputResponse';
import {IPlayer} from '../IPlayer';
import {SelectPartyModel} from '../../common/models/PlayerInputModel';
import {InputError} from './InputError';

export class SelectParty extends BasePlayerInput<PartyName> {
  constructor(
    title: string | Message,
    buttonLabel: string = 'Send delegate',
    public parties: Array<PartyName>) {
    super('party', title);
    this.buttonLabel = buttonLabel;
  }

  public override toModel(player: IPlayer): SelectPartyModel {
    // A party prompt needs A political engine — classic Turmoil or the Mars
    // Parliament (Turmoil Redux). Neither → the prompt is a programming error.
    if (player.game.turmoil === undefined && player.game.parliament === undefined) {
      throw new InputError('This game is not set up for Turmoil.');
    }
    const model: SelectPartyModel = {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'party',
      parties: this.parties,
    };
    // The VOTE marker rides HERE, not in `ServerModel.getWaitingFor`: the vote
    // is one branch of the action menu, and central decoration only ever sees
    // the top-level prompt.
    if (this.votePrompt !== undefined) {
      model.votePrompt = this.votePrompt;
    }
    return model;
  }

  public process(input: InputResponse) {
    if (!isSelectPartyResponse(input)) {
      throw new InputError('Not a valid SelectPartyResponse');
    }
    if (input.partyName === undefined) {
      // TODO(kberg): prevent click unless party is selected.
      throw new InputError('No party selected');
    }
    if (!this.parties.includes(input.partyName)) {
      throw new InputError('Invalid party selected');
    }
    return this.cb(input.partyName);
  }
}
