import {Message} from '../../common/logs/Message';
import {PlayerInput} from '../PlayerInput';
import {BasePlayerInput} from '../PlayerInput';
import {InputResponse, isSelectOptionResponse} from '../../common/inputs/InputResponse';
import {SelectOptionModel, OptionMetadata} from '../../common/models/PlayerInputModel';
import {Warning} from '../../common/cards/Warning';
import {InputError} from './InputError';

export class SelectOption extends BasePlayerInput<undefined> {
  public warnings: ReadonlyArray<Warning> | undefined = undefined;
  // Optional structured UI metadata for the premium client (icon / player
  // target / impact preview). Backward-compatible: undefined → text fallback.
  public metadata: OptionMetadata | undefined = undefined;
  constructor(
    title: string | Message,
    buttonLabel: string = 'Confirm',
    warnings: ReadonlyArray<Warning> | undefined = undefined,
  ) {
    super('option', title);
    this.buttonLabel = buttonLabel;
    this.warnings = warnings;
  }

  /** Attach premium-render metadata (chainable). */
  public withMetadata(metadata: OptionMetadata): this {
    this.metadata = metadata;
    return this;
  }

  public override toModel(): SelectOptionModel {
    const model: SelectOptionModel = {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'option',
      warnings: this.warnings,
      metadata: this.metadata,
    };
    // The COLONY-BONUS COLLECT marker travels HERE, not in
    // `ServerModel.getWaitingFor`: that decorator only ever touches the
    // TOP-LEVEL prompt, and this option can be nested (an OrOptions branch),
    // exactly like the discard / deck-pick markers.
    if (this.colonyBonusPrompt !== undefined) {
      model.colonyBonusPrompt = this.colonyBonusPrompt;
    }
    return model;
  }
  public process(response: InputResponse): PlayerInput | undefined {
    if (!isSelectOptionResponse(response)) {
      throw new InputError('Not a valid SelectOptionResponse');
    }
    return this.cb(undefined);
  }
}
