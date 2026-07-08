import {Message} from '../../common/logs/Message';
import {BasePlayerInput} from '../PlayerInput';
import {IPlayer} from '../IPlayer';
import {InputResponse, isSelectPlayerResponse} from '../../common/inputs/InputResponse';
import {SelectPlayerModel} from '../../common/models/PlayerInputModel';
import {InputError} from './InputError';
import {ALL_RESOURCES, Resource} from '../../common/Resource';
import {computeTargetImpact} from './targetImpact';

export type SelectPlayerOptions = {
  icon?: string,
  amount?: number,
  scope?: 'stock' | 'production',
  // Informational targets shown DISABLED (greyed, non-selectable) with a reason.
  // Not validated/submittable — purely so the picker can explain "this player is
  // relevant but unavailable right now".
  disabled?: ReadonlyArray<{player: IPlayer, reason: string | Message}>,
};

export class SelectPlayer extends BasePlayerInput<IPlayer> {
  constructor(
    public players: ReadonlyArray<IPlayer>,
    title: string | Message,
    buttonLabel: string = 'Save',
    // OPTIONAL premium-UI hint for the action applied to the chosen player
    // (see SelectPlayerModel). Cosmetic — omit for a bare picker.
    public options?: SelectPlayerOptions,
  ) {
    super('player', title);
    this.buttonLabel = buttonLabel;
  }

  public override toModel(): SelectPlayerModel {
    const icon = this.options?.icon;
    const amount = this.options?.amount;
    const scope = this.options?.scope ?? 'stock';
    // The SERVER computes the concrete `current → resulting` per target (correct
    // for a MarsBot too — its production hit regresses a track, its stock loss
    // drains M€) so the picker renders truth, never client-derived numbers. Only
    // when the effect is a known resource attack (a resource icon + amount).
    const isResourceIcon = icon !== undefined && (ALL_RESOURCES as ReadonlyArray<string>).includes(icon);
    const targetImpacts = (isResourceIcon && amount !== undefined) ?
      this.players.map((player) => computeTargetImpact(player, icon as Resource, amount, scope)) :
      undefined;
    return {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'player',
      players: this.players.map((player) => player.color),
      icon: this.options?.icon,
      amount: this.options?.amount,
      scope: this.options?.scope,
      disabledPlayers: this.options?.disabled?.map((d) => ({color: d.player.color, reason: d.reason})),
      targetImpacts,
    };
  }

  public process(input: InputResponse) {
    if (!isSelectPlayerResponse(input)) {
      throw new InputError('Not a valid SelectPlayerResponse');
    }
    const foundPlayer = this.players.find((player) => player.color === input.player);
    if (foundPlayer === undefined) {
      throw new InputError('Player not available');
    }
    return this.cb(foundPlayer);
  }
}
