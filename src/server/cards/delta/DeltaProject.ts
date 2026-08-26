import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IActionCard} from '../ICard';
import {PreludeCard} from '../prelude/PreludeCard';
import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {DeltaProjectExpansion, MAX_TRACK_POSITION} from '../../delta/DeltaProjectExpansion';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {notEnoughEnergy, ruleReason} from '../actionReasons';
import {DeltaProjectInput} from '../../delta/DeltaProjectInput';

export class DeltaProject extends PreludeCard implements IActionCard {
  constructor() {
    super({
      name: CardName.DELTA_PROJECT,

      metadata: {
        cardNumber: 'DP01',
        // The action browser's one-liner: the printed rule is 263 characters
        // and clamps on every profile (see tests/cards/actionCaption.spec.ts).
        infoText: [{kind: 'action-short', text: 'Spend energy to advance on the Hydronetwork'}],
        renderData: CardRenderer.builder((b) => {
          b.action('Spend any amount of energy to move that number of steps on the Hydronetwork track. Each step requires having all the matching tags in play up to that level; wild tags can replace missing ones. Gain resources next to your position.', (ab) => {
            ab.text('X').energy(1).startAction.text('X').plate('Hydronetwork');
          });
        }),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    // `deltaProjectData` is seeded by Game.newInstance only when Hydronetworks
    // is on — without it there is no track to advance, so answer false rather
    // than let `maxSteps` throw. `Player.getActions` gates the REAL advance
    // action on exactly the same condition.
    if (player.deltaProjectData === undefined) {
      return false;
    }
    return DeltaProjectExpansion.maxSteps(player) > 0;
  }

  /**
   * Why the advance is unavailable — co-located with the `canAct` above, and
   * checked in the SAME order, so the two can never drift apart. Every string
   * is an EXISTING key: the two track-specific ones are the console
   * Hydronetwork screen's own reasons (`client/components/hydronetwork/
   * hydroReasons.ts`), so the card and the screen say the same thing.
   */
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    const progress = player.deltaProjectData;
    if (progress === undefined) {
      return ruleReason('Not in this game');
    }
    if (progress.position >= MAX_TRACK_POSITION) {
      return ruleReason('You have reached the end of the Hydronetwork track.');
    }
    if (player.energy === 0) {
      return notEnoughEnergy();
    }
    // Energy is available, so what stops the advance is the tag path (or an
    // occupied VP slot) — the track's own rule, not an economic shortfall.
    return ruleReason('Required tag is missing — you have none');
  }

  public action(player: IPlayer): PlayerInput {
    const validSteps = DeltaProjectExpansion.getValidAdvanceSteps(player);

    return new DeltaProjectInput(
      validSteps,
    ).andThen((amount) => {
      DeltaProjectExpansion.advance(player, amount);
      return undefined;
    });
  }
}
