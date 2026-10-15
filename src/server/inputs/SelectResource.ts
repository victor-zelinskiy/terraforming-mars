import {Message} from '../../common/logs/Message';
import {Units} from '../../common/Units';
import {BasePlayerInput} from '../PlayerInput';
import {SelectResourceModel} from '../../common/models/PlayerInputModel';
import {InputResponse, isSelectResourceResponse} from '../../common/inputs/InputResponse';
import {InputError} from './InputError';

export class SelectResource extends BasePlayerInput<keyof Units> {
  public selected: keyof Units = 'megacredits';
  /**
   * How many of the chosen resource the player GAINS — the console's palette prints it on every tile («+N») with the
   * viewer's own `current → resulting`; the title states it in words only, and a title is never parsed. Absent for a
   * prompt whose number is not one gain (a discard, a steal).
   */
  public gainAmount: number | undefined = undefined;

  constructor(
    public override title: string | Message,
    public include: ReadonlyArray<keyof Units> = Units.keys,
    public override buttonLabel: string = 'Select',
  ) {
    super('resource', title);
  }

  /** Mark the prompt as a GAIN of `amount` of the chosen resource (serialized here — nesting-safe). */
  public withGainAmount(amount: number): this {
    this.gainAmount = amount;
    return this;
  }

  public override toModel(): SelectResourceModel {
    return {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'resource',
      include: this.include,
      ...(this.gainAmount !== undefined ? {amount: this.gainAmount} : {}),
    };
  }

  public process(input: InputResponse) {
    if (!isSelectResourceResponse(input)) {
      throw new InputError('Not a valid SelectResourceResponse');
    }
    if (!this.include.includes(input.resource)) {
      throw new InputError('Not a valid unit');
    }
    this.selected = input.resource;
    return this.cb(input.resource);
  }
}
