import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {ChairmanSeat} from '../../parliament/quests/ChairmanSeat';
import * as actionPreviews from '../actionPreviews';

/** «Advance your Agenda marker 2 steps» — the printed walk; the end of the track may cut it. */
export const RED_LAWYERS_STEPS = 2;

/**
 * TR37 — RED LAWYERS («Юристы Красных»), a Turmoil Redux PROJECT card: TR04
 * Minority Representation WITHOUT THE CEILING — the card for which a CARD
 * step IN THE MIDDLE of a walk became reachable.
 *
 * «Requires the Reds to be ruling or that you have 2 delegates there. Advance
 * your Agenda marker 2 steps. (And collect bonuses from each step.)» Cost 5,
 * a Mars tag, green, no VP. The same printed walk as TR04, gated by the REDS'
 * plate instead of «no more than 1 Influence». TR04's ceiling kept its two
 * steps on 1–4 (an influence step and a TR step); this card walks from
 * ANYWHERE, so for the first time a walk may reach a CARD step before its last
 * (6 → ⑦ card → ⑧ influence 4; 9 → ⑩ card → ⑪ TR), a card step LAST (5 → ⑥ TR
 * → ⑦ card), and the END of the track (11 → one step and the line; 12 → no
 * step, the card played all the same). The card is ONE call of the ONE walk
 * (`ChairmanSeat.walkAgenda`) — not a line of walking logic lives here.
 *
 * SCAN READING — cost 5; one tag in the corner (the red planet: Mars). The
 * orange MIN box beside the cost holds the REDS' emblem — the REQUIREMENT
 * (`{party: REDS}`, the set's eighth Reds plate after TR30–TR36), never a
 * tag. The graphic is one row of two squares with a star: a SQUARE is a unit
 * of something, and the starred square is the printed unit «one step of the
 * Agenda track» (`agendaStep(2)`, TR04's own). No VP badge. Only the module's
 * icon at the bottom left (no ▲, no Venus icon): no `compatibility` — for a
 * card of THIS manifest the political engine is the module itself. Printed
 * lore: «Olympic champions of mental gymnastics.» (`lore_texts.json` «TR37»).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/RedLawyers.spec.ts):
 *  1. The REQUIREMENT is the Reds' plate — the Reds rule, or 2 of the player's
 *     OWN delegates on their resolution — checked at the PLAY only (the TR15
 *     class: the emblem in the MIN plate, the named reason «N of 2», the
 *     hand's counter). TR36 Council Seat lowers the EFFECT's threshold, never
 *     a REQUIREMENT's (FAQ p.19): with one delegate on the Reds' resolution
 *     and the Seat on the table this card still reads «1 of 2».
 *  2. The play IS the walk: `walkAgenda(…, 2, {reason: 'card', card})`
 *     SYNCHRONOUSLY in `bespokePlay`, never deferred — the answer to the play's
 *     POST carries the walk's record, because the console plays that record
 *     as the OUTCOME of this very play (TR04 1:1).
 *  3. NO CEILING — every kind of step is reachable, and a CARD step may come
 *     in the MIDDLE: from 6 the marker takes ⑦ (a card) and ⑧ (influence 4),
 *     and the card is DRAWN BEFORE the second step is taken («collect bonuses
 *     from each step» — `payStep` runs between the steps): the hand grows by
 *     one card of `source: {type: 'agenda'}`, the record reads
 *     `[{to: 7, bonus: 'card'}, {to: 8}]`. From 5: ⑥ TR, ⑦ card (the card step
 *     LAST). From 9: ⑩ card, ⑪ TR. From 3: ④ TR, ⑤ influence 3.
 *  4. The END of the track cuts honestly: from 11 the marker takes ONE step
 *     and «already at the end» is logged ONCE (a one-step record); from 12 it
 *     takes NONE — no record, no event, the line once — and the card is
 *     PLAYED all the same: the cost paid, the card in the tableau, its Mars
 *     tag counted (the event happened; the preview named «0 of 2 · end of the
 *     track» BEFORE the press). `canPlay` adds no check of its own.
 *  5. The TR of a walked step is an ORDINARY TR of the action phase: the
 *     ruling Greens' +2 M€, the enacted passive, `QuestTracker.report` — the
 *     walk runs inside the card's own play (TR04 rule 6).
 *  6. A chairman quest this TR closes stands AFTER the walk (its gate is
 *     deferred at `BACK_OF_THE_LINE`) — TR04 rule 7.
 *  7. The influence is re-read on every step by whoever reads it: after
 *     6 → 8 the player has influence 4 — the card computes nothing of its own.
 *  8. THE JOURNAL: one line per step, ONE `agenda-advanced` event, and the
 *     SOURCE is the card (no `parliament` wrapper) — the rival's notification
 *     says «played a card», the TR's provenance segment is the TRACK's.
 *  9. MarsBot never plays it (the bot's deck is tags); the bot's own walks (the
 *     winner step, the quest) stay one step — «a card is 1 M€» on a card step.
 * 10. Save / load adds nothing: the walk's record already serializes
 *     (`lastAdvance.steps`), the drawn card is an ordinary card in hand.
 * 11. The DRAWN card is one reveal batch of `source: {type: 'agenda'}` — the
 *     console parks it until the cover can lift off the very step the marker
 *     reached (`agendaWalkDirector` — the signal is the marker's LOCK on that
 *     step, never «the track has settled»).
 * 12. Two card steps in ONE walk are impossible (⑦ and ⑩ are not adjacent) —
 *     the spec invents none; a card step FIRST and a card step LAST are both
 *     pinned.
 */
export class RedLawyers extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.RED_LAWYERS,
      type: CardType.AUTOMATED,
      tags: [Tag.MARS],
      cost: 5,
      requirements: {party: PartyName.REDS},

      metadata: {
        cardNumber: 'TR37',
        infoText: [
          {text: 'Advance your Agenda marker 2 steps and collect the bonus of each step.', tokens: ['agenda-step']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.agendaStep(RED_LAWYERS_STEPS);
        }),
        description: 'Requires the Reds to be ruling or that you have 2 delegates there. Advance your Agenda marker 2 steps. (And collect bonuses from each step.)',
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      // Never dealt outside the Mars Parliament (the manifest is the deck gate); nothing to walk, nothing to skip.
      return undefined;
    }
    ChairmanSeat.walkAgenda(player, parliament, RED_LAWYERS_STEPS, {reason: 'card', card: this.name});
    return undefined;
  }

  /**
   * The walk read BEFORE the press, by the server: the track chip («6 → 8»),
   * one chip per bonus the steps pay (the card chip, the TR chip the effect
   * forecast reads the Greens' «+2 M€» from), the influence the walk changes
   * — and the SHOW step the console names its coming stage from. A cut at the
   * track's end is NAMED here («1 of 2 · end of the track»; «0 of 2» at 12).
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const walk = actionPreviews.agendaWalkModel(player, RED_LAWYERS_STEPS);
    return actionPreviews.playPreview(this, player,
      actionPreviews.agendaWalkEffects(player, walk),
      [actionPreviews.agendaWalkStep(walk)]);
  }
}
