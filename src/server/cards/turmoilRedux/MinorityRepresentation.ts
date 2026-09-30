import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {ChairmanSeat} from '../../parliament/quests/ChairmanSeat';
import * as actionPreviews from '../actionPreviews';

/** «Advance your Agenda marker 2 steps» — the printed walk; the end of the track may cut it. */
export const MINORITY_REPRESENTATION_STEPS = 2;

/**
 * TR04 — MINORITY REPRESENTATION («Представительство меньшинств»), the eighth
 * Turmoil Redux PROJECT card and the set's first EVENT.
 *
 * «Requires that you have no more than 1 Influence. Advance your Agenda
 * marker 2 steps. (And collect bonuses from each step.)» Cost 6, no tags, no
 * VP. The THIRD ENGINE of the Agenda track after the sitting's winner step and
 * the chairman quest — and the first to move the marker MORE than one step:
 * the card is one call of the ONE walk (`ChairmanSeat.walkAgenda`), and the
 * walk is what plays on the console (the marker step by step, each step's
 * reward on its own landing, hosted by the hand the card was played from).
 *
 * SCAN READING — cost 6; the yellow disc with the down arrow in the corner is
 * the EVENT marker (`CardType.EVENT`), never a tag: `tags` is empty. The
 * orange MAX box beside the cost holds the influence badge and «max 1» — the
 * requirement (`{influence: 1, max}`), the first of its kind. The graphic is
 * one row of two squares with a star: a SQUARE is a unit of something, and
 * the starred square is the printed unit «one step of the Agenda track»
 * (`agendaStep(2)`). No VP badge. The purple Turmoil symbol at the bottom
 * left means «needs the political engine» — for a card of THIS manifest that
 * is the module itself (`compatibility: 'turmoil'` is the upstream-adaptation
 * marker and would demand `politics: 'redux'`).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/MinorityRepresentation.spec.ts):
 *  1. «No more than 1 Influence» is the player's WHOLE influence
 *     (`Parliament.influence`: the track's level + every bonus + the
 *     tableau's hooks), never the marker's position. So the card opens on
 *     positions 0–2 without bonuses (level ≤ 1), closes from 3 (level 2), and
 *     a +1 bonus on position 1 closes it too. With the requirement met the two
 *     steps only ever land on steps 1–4 — an influence step and a TR step in
 *     some order; the card step and the end of the track are reachable by the
 *     WALK (a quest, the phase) but never by this card.
 *  2. «Advance 2 steps» is two CONSECUTIVE steps, each with its own bonus
 *     («collect bonuses from each step») — never a jump of +2 paying the last
 *     step's bonus. An influence step pays nothing on the spot (the level is
 *     read off the position); a TR step raises the rating BEFORE the next
 *     step is taken; a card step draws. The order of the bonuses is the order
 *     of the steps.
 *  3. The end of the track cuts honestly: from 11 the card walks ONE step and
 *     logs «already at the end» once; from 12 it walks none. Both are
 *     unreachable under the requirement (at 11 the influence is 4) — the walk
 *     itself is pinned by `tests/parliament/AgendaWalk.spec.ts`. The preview
 *     names a cut BEFORE the press (`walked < printed`); the card is played
 *     either way (the event happened, the cost was paid).
 *  4. A marker not yet on the track (position 0) is SEATED by the first step
 *     (rulebook p.8) — the walk's own behaviour: 0 → 1 (influence 1), 2 (TR).
 *  5. MarsBot never plays it (the bot's deck is tags); the bot's own walks
 *     (the winner step, the quest) stay one step, «a card is 1 M€».
 *  6. The TR of a walked step is an ORDINARY TR of the action phase: the
 *     ruling party's effect fires (the Greens' +2 M€), the enacted passive
 *     fires, and `QuestTracker.report({kind: 'tr'})` counts it — the walk runs
 *     inside the card's own play, which `QuestTracker.eligible` admits (it
 *     refuses only a `political-phase` root and a resolution's stack). By the
 *     rules (R p.9 — «only from your own actions») this is right, not a bug.
 *  7. A chairman quest this TR closes stands AFTER the walk: its gate is
 *     deferred at `BACK_OF_THE_LINE`, so the marker has finished walking when
 *     the announce plate rises.
 *  8. The influence is re-read on every step by whoever reads it: after 1 → 3
 *     the player has influence 2 and every resolution forecast recomputes on
 *     the ordinary refresh — the card computes nothing of its own.
 *
 * The walk is SYNCHRONOUS (no `game.defer`): the answer to the play's POST
 * must carry the walk's record, because the console plays that record as the
 * OUTCOME of this very play — a deferred walk would land on a later poll and
 * play into an empty stage.
 */
export class MinorityRepresentation extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.MINORITY_REPRESENTATION,
      type: CardType.EVENT,
      tags: [],
      cost: 6,
      requirements: {influence: 1, max: true},

      metadata: {
        cardNumber: 'TR04',
        infoText: [
          {text: 'Advance your Agenda marker 2 steps and collect the bonus of each step.', tokens: ['agenda-step']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.agendaStep(MINORITY_REPRESENTATION_STEPS);
        }),
        description: 'Requires that you have no more than 1 Influence. Advance your Agenda marker 2 steps. (And collect bonuses from each step.)',
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      // Never dealt outside the Mars Parliament (the manifest is the deck gate); nothing to walk, nothing to skip.
      return undefined;
    }
    ChairmanSeat.walkAgenda(player, parliament, MINORITY_REPRESENTATION_STEPS, {reason: 'card', card: this.name});
    return undefined;
  }

  /**
   * The walk read BEFORE the press, by the server: the track chip («1 → 3»),
   * one chip per bonus the steps pay (the TR chip is what the effect forecast
   * reads the Greens' «+2 M€» from), the influence the walk changes — and the
   * SHOW step the console names its coming stage from.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const walk = actionPreviews.agendaWalkModel(player, MINORITY_REPRESENTATION_STEPS);
    return actionPreviews.playPreview(this, player,
      actionPreviews.agendaWalkEffects(player, walk),
      [actionPreviews.agendaWalkStep(walk)]);
  }
}
