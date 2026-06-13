import {Message} from '../../common/logs/Message';
import {BasePlayerInput} from '../PlayerInput';
import {InputResponse, isSelectAmountResponse} from '../../common/inputs/InputResponse';
import {SelectAmountModel, AmountConversionModel} from '../../common/models/PlayerInputModel';
import {InputError} from './InputError';

export class SelectAmount extends BasePlayerInput<number> {
  public selected: number = -1;

  constructor(
    title: string | Message,
    buttonLabel: string = 'Save',
    public min: number,
    public max: number,
    public maxByDefault?: boolean,
    // OPTIONAL premium-UI hints for the modern stepper (see SelectAmountModel).
    // Purely cosmetic — backward-compatible, omit for a bare number stepper.
    // `conversion` marks a "spend X of FROM → receive X of TO" amount so the
    // client renders the rich conversion composition + live preview.
    public options?: {icon?: string, unit?: string, conversion?: AmountConversionModel},
  ) {
    super('amount', title);
    this.buttonLabel = buttonLabel;
  }

  public toModel(): SelectAmountModel {
    return {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'amount',
      max: this.max,
      min: this.min,
      maxByDefault: this.maxByDefault ?? false,
      icon: this.options?.icon,
      unit: this.options?.unit,
      conversion: this.options?.conversion,
    };
  }

  public process(input: InputResponse) {
    if (!isSelectAmountResponse(input)) {
      throw new InputError('Not a valid SelectAmountResponse');
    }
    if (isNaN(input.amount)) {
      throw new InputError('Amount is not a number');
    }
    if (input.amount > this.max) {
      throw new InputError('Amount provided too high (max ' + String(this.max) + ')');
    }
    if (input.amount < this.min) {
      throw new InputError('Amount provided too low (min ' + String(this.min) + ')');
    }
    this.selected = input.amount;
    return this.cb(input.amount);
  }
}
