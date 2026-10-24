import {Message} from '../../common/logs/Message';
import {BasePlayerInput} from '../PlayerInput';
import {PartyName} from '../../common/turmoil/PartyName';
import {InputResponse, isSelectPartyResponse} from '../../common/inputs/InputResponse';
import {IPlayer} from '../IPlayer';
import {DelegatePromptMeta, SelectPartyModel} from '../../common/models/PlayerInputModel';
import {DelegateAddress} from '../../common/parliament/ParliamentTypes';
import {InputError} from './InputError';

/** One pickable figure — the place (a party's resolution or support area) and whose cube. */
export type DelegateTarget = DelegateAddress & {party: PartyName};

/**
 * «PICK ONE DELEGATE ON THE TABLE» (Turmoil Redux TR72 Banned Delegate:redux) — a PARTY question with an
 * address inside the party: the answer is `{type: 'party', partyName, delegate: {place, owner}}`, the
 * place named by its party (the voting area holds one resolution per party, every party has one support
 * area). It is a `party` prompt on purpose: the console's Parliament, the staged door's addressed tail
 * (`stagedFor` — `preselectAddress` reads `delegatePrompt` as a card's own question) and the batch replay
 * all speak `party` already; the marker (`delegatePrompt`, carried on every model this input writes) is
 * what tells it from a vote, a grant or a support-area pick.
 *
 * The candidates are `meta.targets` — exactly the rows the producer (`parliament/RemoveDelegate`)
 * projected; an answer naming anything else is refused (never a nearest match).
 */
export class SelectPartyDelegate extends BasePlayerInput<DelegateTarget> {
  constructor(
    title: string | Message,
    buttonLabel: string,
    meta: DelegatePromptMeta) {
    super('party', title);
    this.buttonLabel = buttonLabel;
    this.delegatePrompt = meta;
  }

  /** The parties of the pickable places — the model's `parties`, in the rows' order, each once. */
  public get parties(): Array<PartyName> {
    return [...new Set((this.delegatePrompt?.targets ?? []).map((target) => target.party))];
  }

  public override toModel(player: IPlayer): SelectPartyModel {
    if (player.game.parliament === undefined) {
      throw new InputError('This game is not set up for the Mars Parliament.');
    }
    const model: SelectPartyModel = {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'party',
      parties: this.parties,
    };
    if (this.delegatePrompt !== undefined) {
      model.delegatePrompt = this.delegatePrompt;
    }
    return model;
  }

  public process(input: InputResponse) {
    if (!isSelectPartyResponse(input)) {
      throw new InputError('Not a valid SelectPartyResponse');
    }
    const address = input.delegate;
    if (address === undefined) {
      throw new InputError('No delegate selected');
    }
    const target = (this.delegatePrompt?.targets ?? []).find((row) =>
      row.party === input.partyName && row.place === address.place && row.owner === address.owner);
    if (target === undefined) {
      throw new InputError('Invalid delegate selected');
    }
    return this.cb({party: target.party, place: target.place, owner: target.owner});
  }
}
