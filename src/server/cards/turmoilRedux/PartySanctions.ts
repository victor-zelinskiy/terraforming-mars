import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {ChairmanSeat} from '../../parliament/quests/ChairmanSeat';
import {DiscardPopularSupport} from '../../parliament/DiscardPopularSupport';
import * as actionPreviews from '../actionPreviews';

/** «Advance your Agenda marker 1 step» — the printed walk; the end of the track may cut it. */
export const PARTY_SANCTIONS_STEPS = 1;

/**
 * TR12 — PARTY SANCTIONS («Партийные санкции»), the fifteenth Turmoil Redux
 * PROJECT card and the set's second EVENT.
 *
 * «Requires you to be Chairman. Discard all neutral delegates from ONE Popular
 * Support Area of your choice. Advance your Agenda marker 1 step.» Cost 2, no
 * tags, no VP. The first card that picks a PARTY'S SUPPORT AREA (not a
 * resolution) and the first that takes support AWAY — the shared step
 * `DiscardPopularSupport`; and the third engine of the Agenda walk after TR04
 * (`ChairmanSeat.walkAgenda`, N = 1). The file writes no `SelectParty` of its
 * own and computes no area: the step asks, the walk walks.
 *
 * SCAN READING — cost 2; the yellow disc with the down arrow in the corner is
 * the EVENT marker (`CardType.EVENT`), never a tag: `tags` is empty. The
 * orange MIN box beside the cost holds a seated figure — the CHAIRMAN, the
 * requirement (`{chairman: true}`, the existing kind). The graphic is one
 * row: «−ALL» · a NEUTRAL (dark) delegate with an asterisk («of ONE area of
 * your choice») · a gap · the starred square (`agendaStep(1)`, TR04's unit).
 * No VP badge. The purple Turmoil symbol at the bottom left means «needs the
 * political engine» — for a card of THIS manifest that is the module itself
 * (`compatibility: 'turmoil'` is the upstream-adaptation marker and would
 * demand `politics: 'redux'`). Lore: «"I AM the Senate!"».
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/PartySanctions.spec.ts):
 *  1. «Requires you to be Chairman» — the player's delegate holds the chair
 *     NOW (`politics.isChairman`, the facade), checked at the play only. The
 *     hand names who holds it instead («председатель сейчас: …» / «кресло
 *     свободно»).
 *  2. «Discard all neutral delegates from ONE Popular Support Area of your
 *     choice» — ONE party of the six; EVERY neutral delegate of its area goes
 *     back to the common supply. Neutral delegates standing ON RESOLUTIONS
 *     (votes) and every player's delegate are untouched.
 *  3. The candidates are the areas holding ≥ 1 neutral delegate; an EMPTY area
 *     is shown refused with its reason («Область пуста») — the pick would
 *     change nothing. The RULING party's area is an ordinary candidate when it
 *     holds a stock (TR03 can carry one into the government).
 *  4. With EVERY area empty (common early in a game) the card is still
 *     playable — the printed requirement is the chair alone — and the discard
 *     is a NAMED skip (`effect-skipped`); the Agenda step is taken anyway. The
 *     composer says so BEFORE the play and draws no door.
 *  5. «Advance your Agenda marker 1 step» is ONE walk of the track
 *     (`ChairmanSeat.walkAgenda`, `{reason: 'card'}`) with that step's bonus
 *     (influence / TR / a card); the end of the track is the walk's own named
 *     cut. The step's TR is an ordinary action-phase TR (the chairman quest
 *     counts it, the Greens' effect fires — TR04's rules 6–7).
 *  6. The order is the PRINTED one: the discard, then the step — both inside
 *     the answer to the play's ONE POST (the step's continuation, not a second
 *     deferral that could land on a later poll).
 *  7. The chairmanship stays where it is: the card does not spend it.
 *  8. MarsBot never plays it (the bot's deck is tags); its delegates are
 *     untouched (the common supply aside).
 */
export class PartySanctions extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.PARTY_SANCTIONS,
      type: CardType.EVENT,
      tags: [],
      cost: 2,
      requirements: {chairman: true},

      metadata: {
        cardNumber: 'TR12',
        infoText: [
          {text: 'Discard all neutral delegates from ONE Popular Support Area of your choice.', tokens: ['neutral-delegate']},
          {text: 'Advance your Agenda marker 1 step and collect its bonus.', tokens: ['agenda-step']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.minus().text('ALL', Size.LARGE, true).neutralDelegate(1).asterix().nbsp.nbsp.agendaStep(PARTY_SANCTIONS_STEPS);
        }),
        description: 'Requires you to be Chairman. Discard all neutral delegates from ONE Popular Support Area of your choice. Advance your Agenda marker 1 step.',
      },
    });
  }

  /** THE step `bespokePlay` defers — built once, asked by the preview (its twin) and queued by the play. */
  private sanction(player: IPlayer): DiscardPopularSupport {
    return new DiscardPopularSupport(player, {kind: 'card', card: this.name}, () => {
      const parliament = player.game.parliament;
      if (parliament !== undefined) {
        ChairmanSeat.walkAgenda(player, parliament, PARTY_SANCTIONS_STEPS, {reason: 'card', card: this.name});
      }
    });
  }

  public override bespokePlay(player: IPlayer) {
    if (player.game.parliament === undefined) {
      // Never dealt outside the Mars Parliament (the manifest is the deck gate); nothing to sanction.
      return undefined;
    }
    player.game.defer(this.sanction(player));
    return undefined;
  }

  /**
   * Read BEFORE the press, by the server: the walk's chips (the track «3 → 4»,
   * the step's bonus), then the two steps in the PRINTED order — the DOOR into
   * the Parliament's support-area mode (or the named skip when every area is
   * empty), and the walk's SHOW step. The discard's «N → 0» is not an
   * `effects` chip: it depends on the area, and reads per area in the
   * Parliament.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const walk = actionPreviews.agendaWalkModel(player, PARTY_SANCTIONS_STEPS);
    return actionPreviews.playPreview(this, player,
      actionPreviews.agendaWalkEffects(player, walk),
      [actionPreviews.supportDiscardStep(this, this.sanction(player)), actionPreviews.agendaWalkStep(walk)]);
  }
}
