import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {Tag} from '../../../common/cards/Tag';
import {CardRenderer} from '../render/CardRenderer';
import {ActionPreview, AgendaWalkModel} from '../../../common/models/ActionPreviewModel';
import {ChairmanSeat} from '../../parliament/quests/ChairmanSeat';
import * as actionPreviews from '../actionPreviews';

/** «Advance your Agenda marker 3 steps» — the printed walk; the end of the track may cut it. */
export const POLITICAL_RECOGNITION_STEPS = 3;
/** «Requires that you have played 5 other cards with requirements» — the MIN plate's number. */
export const POLITICAL_RECOGNITION_REQUIRED = 5;

/**
 * TR68 — POLITICAL RECOGNITION («Политическое признание»), a Turmoil Redux
 * PROJECT card: the set's FOURTH card on the ONE walk of the Agenda track
 * (TR04 Minority Representation · TR37 Red Lawyers · TR42 Green Allegiance)
 * and the first to print the requirement «cards with requirements PLAYED».
 *
 * SCAN READING — a GREEN frame (AUTOMATED), cost 8. The gold MIN plate holds a
 * small card that carries its own gold plate, and «5»: the requirement
 * `{cardsWithRequirements: 5}` (the NEW kind `CARDS_WITH_REQUIREMENTS` — the
 * eight points of the TR02 path, its glyph `assets/misc/card-requirement.svg`).
 * The round white badge with a black «?» in the corner is the set's WILD tag
 * («counts as any tag of your choice when playing cards and actions», never
 * for awards — the rulebook's own words; the Scientists' effect grants an
 * «extra wild tag» in the same vocabulary): `tags: [Tag.WILD]`. No VP badge.
 * One row of three squares with a star — three steps of the Agenda track
 * (`agendaStep(3)`, TR04's own unit). The rule in words: «(Requires that you
 * have played 5 other cards with requirements. Advance your Agenda marker 3
 * steps. (And collect bonuses from each step.))». The quote: «Welcome to a
 * hell of your own making!». Only the module's icon at the bottom left: no
 * `compatibility`. Art: Igor Suka.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/PoliticalRecognition.spec.ts):
 *  1. «Played 5 other cards with requirements» counts the player's PLAYED
 *     cards with a non-empty `requirements` (`playedCardsWithRequirements` —
 *     the requirement's own file). EVENTS COUNT: the card says «played», not
 *     «in play» (the milestone's / award's word — Tactician and Forecaster
 *     keep their own semantics). «Other» excludes this card by name.
 *     Preludes and corporations print no requirement. Exactly 5 meets it.
 *  2. The requirement is a KIND of its own (the TR02 path): the reason «now
 *     4 of 5», the compact hand chip «[card] 4/5», the rule line and the
 *     premium plate's glyph — all from the one descriptor.
 *  3. «Advance 3 steps» is ONE call of the ONE walk
 *     (`ChairmanSeat.walkAgenda`), SYNCHRONOUS in `bespokePlay` (the play's
 *     answer must carry the record the console plays as the OUTCOME): each
 *     step's bonus on its own landing, in the order of the steps — influence
 *     read off the position, a TR before the next step is taken, a CARD step
 *     drawn in the middle of the walk (TR37's class). A marker off the track
 *     (0) is SEATED by the first step: 0 → 1, 2, 3.
 *  4. The end of the track cuts honestly: from 10 two steps, from 11 one,
 *     from 12 none (one journal line «already at the end»). The preview names
 *     the cut BEFORE the press («2 of 3 · end of the track», «0 of 3» at 12 —
 *     the composer's `agendaWalkNextRows`); the card is played either way (the
 *     cost is paid, the card lies on the table). A cut known before the press
 *     is not a loss: no `recordSkippedEffect` (TR42's computed zero, TR37's
 *     end of the track).
 *  5. The preview is TR04's: the track chip «1 → 4», a chip per bonus, the
 *     SHOW step `agendaWalk`; the hand's model reads the same walk
 *     (`CardModel.agendaWalk`, `ModelUtils`) — the co-located
 *     `agendaWalkForecast`.
 *  6. The WILD tag is the engine's: it counts as any tag when playing cards
 *     and actions (`Tags.count` default mode) and never for awards (`award`
 *     mode).
 *  7. Once played the card itself prints a requirement: it counts for
 *     Tactician / Forecaster and for another TR68's count.
 *  8. MarsBot never plays it (the bot's deck is tags); save / load adds
 *     nothing (the walk is instant); the previews are pure.
 *  9. The journal: the walk's lines (`agenda-advanced`, reason `card`) —
 *     TR04's, no line of its own.
 */
export class PoliticalRecognition extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.POLITICAL_RECOGNITION,
      type: CardType.AUTOMATED,
      tags: [Tag.WILD],
      cost: 8,
      requirements: {cardsWithRequirements: POLITICAL_RECOGNITION_REQUIRED},

      metadata: {
        cardNumber: 'TR68',
        infoText: [
          {text: 'Advance your Agenda marker 3 steps and collect the bonus of each step.', tokens: ['agenda-step']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.agendaStep(POLITICAL_RECOGNITION_STEPS);
        }),
        description: 'Requires that you have played 5 other cards with requirements. Advance your Agenda marker 3 steps. (And collect bonuses from each step.)',
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      // Never dealt outside the Mars Parliament (the manifest is the deck gate); nothing to walk, nothing to skip.
      return undefined;
    }
    ChairmanSeat.walkAgenda(player, parliament, POLITICAL_RECOGNITION_STEPS, {reason: 'card', card: this.name});
    return undefined;
  }

  /** The walk this play would make — the ONE reading of the preview, the hand's plate and the inspector. */
  public agendaWalkForecast(player: IPlayer): AgendaWalkModel {
    return actionPreviews.agendaWalkModel(player, POLITICAL_RECOGNITION_STEPS);
  }

  /**
   * The walk read BEFORE the press, by the server: the track chip («1 → 4»),
   * one chip per bonus the steps pay, the influence the walk changes — and
   * the SHOW step the console names its coming stage from (its cut at the
   * end of the track included).
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const walk = this.agendaWalkForecast(player);
    return actionPreviews.playPreview(this, player,
      actionPreviews.agendaWalkEffects(player, walk),
      [actionPreviews.agendaWalkStep(walk)]);
  }
}
