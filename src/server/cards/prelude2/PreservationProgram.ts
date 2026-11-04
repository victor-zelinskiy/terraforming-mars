import {PreludeCard} from '../prelude/PreludeCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {cancelled, digit} from '../Options';
import {Size} from '../../../common/cards/render/Size';
import {IPlayer} from '../../IPlayer';
import {Phase} from '../../../common/Phase';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';
import {splitSkippedRating} from '../../models/skippedRating';

export class PreservationProgram extends PreludeCard {
  constructor() {
    super({
      name: CardName.PRESERVATION_PROGRAM,

      tr: {tr: 5},

      metadata: {
        cardNumber: 'P57',
        // The effects explorer's one-liner (the printed rule overruns the caption budget); the face prints the struck TR.
        infoText: [{kind: 'effect-short', text: 'First TR in each action phase is skipped'}],
        renderData: CardRenderer.builder((b) => {
          b.effect('SKIP THE FIRST TR YOU GAIN IN EACH GENERATION\'S ACTION PHASE.', (eb) => {
            eb.empty().startEffect.tr(1, {size: Size.SMALL, cancelled});
          }).br;
          b.tr(5, {digit});
        }),
        description: 'Raise your TR 5 steps.',
      },
    });
  }

  /**
   * The +5 the play raises. Played in the ACTION phase before any rating gained in it this generation, the flag this
   * very play arms eats one step of it (upstream's intent, pinned by the spec: +4) — the preview says so with the
   * family's split («+4» and one struck step under this card's mark, `models/skippedRating.ts`); otherwise +5 whole.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const raise = actionPreviews.trGain(player, 5);
    const eats = player.game.phase === Phase.ACTION && player.trThisGeneration === 0;
    return actionPreviews.playPreview(this, player, eats ? splitSkippedRating(raise) : [raise]);
  }

  public override bespokePlay(player: IPlayer) {
    // If this card is played during the action phase, the player may
    // have already gained TR this generation and that prevents the effect
    // from being applied this generation.
    player.preservationProgram = player.trThisGeneration === 0;
    // This is executed now because if it were in `behavior` it would be
    // rewarded before the effect was put in place.
    player.increaseTerraformRating(5);
    return undefined;
  }
}
