import {Tag} from '../../../common/cards/Tag';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {IPlayer} from '../../IPlayer';
import {ICard, AgendaWalkContext} from '../ICard';
import {ActiveCorporationCard} from '../corporation/CorporationCard';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {ActionEffect, AgendaWalkModel} from '../../../common/models/ActionPreviewModel';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastContext} from '../EffectForecastContext';
import {agendaWalkMeta, answerResourceOnAgendaWalk, askerAlone, reactionStep} from '../../parliament/AgendaWalkReactions';
import {ARWIND_FIGHTER_VALUE} from '../../../common/constants';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** «Add 1 fighter to ANY card» — the action's count, and the Career's count PER STEP. */
export const ARWIND_FIGHTERS_PER_STEP = 1;

/** The forecast fact's reason — ONE i18n key (RU in `effect_forecast.json`). */
const AGENDA_REASON = 'Agenda step';

/**
 * TR78 — ARWIND INC. («Arwind Inc.»), the FIRST of the eight NEW corporations of Turmoil Redux (not a replacement —
 * `common/cards/turmoilReduxCorporations.ts`, numbered TR78 by the order of the scan folder). Its own art and its own
 * printed lore, both keyed TR78; no `reimplements`.
 *
 * SCAN READING — the Space tag (the white star on black) in the corner; «38» + a titanium production box («You start
 * with 38 M€ and 1 titanium production»). The ACTION box: «→ [fighter]*» («Add a fighter resource to ANY card»). The
 * EFFECT box, ONE row of two halves: «[Agenda step] : [fighter]*» (whenever you advance your Agenda marker 1 step,
 * add 1 fighter to ANY card) and «[Space tag] : [fighter] = [4]» (when playing a Space tag, fighters HERE may be used
 * as payment, worth 4 M€ each). Printed lore: «Arwind doesn't just want to be a spaceship manufacturer…». No VP, no
 * first action. The purple Turmoil diamond at the bottom left is the module itself (no `compatibility`).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/ArwindInc.spec.ts):
 *  1. THE ACTION is the family's declaration (`addResourcesToAnyCard` — Celestic's): the target is ALWAYS a step, the
 *     corporation itself included (it holds fighters), so the action is always available and never applied silently.
 *  2. «WHENEVER YOU ADVANCE YOUR AGENDA MARKER 1 STEP» — PER STEP, answered PER WALK (the owner, 2026-10-28): a walk
 *     of N steps owes N fighters and asks ONE question — the family's layout over the holders (N ≥ 2, ≥ 2 holders)
 *     or its pick — never N questions in a row (`ICard.onAgendaWalked` — the ONE call inside `ChairmanSeat.walkAgenda`,
 *     after the last step's bonus). All four engines of the track: a card's walk (TR04 …), the chairman's quest, the
 *     sitting's winner step, a law's seat step (RX39). A step the end of the track refuses is not taken and owes
 *     nothing; a step whose rating a law vetoed (RX42) WAS taken and owes its fighter. MarsBot never holds the card
 *     (no twin) — the walk calls no hook for it.
 *  3. THE ASKER ALONE IS NO QUESTION (the owner, 2026-10-28): with no other fighter holder on the table the fighters
 *     land on the corporation at once — a fixed self-target (invariant 3's exemption), told by the console's reaction
 *     scene (the corporation rises, the fighters leave its printed effect and land in its capsule) — never a press on
 *     the one card the player could choose. A second holder makes it a question: `parliament/AgendaWalkReactions`'
 *     shared step, marked with the walk that asked (`agendaWalkPrompt`). A walk the PARLIAMENT runs records the
 *     question (`pendingActions` `card-reaction`) so a reload re-asks it.
 *  4. «FIGHTERS HERE» — the payment unit `arwindFighters` (`Spendable`): fighters ON THIS CARD, a PRINTED Space tag
 *     only (no standard project, no bill), a flat 4 M€ each, spent off this card (`Player.pay`). The other fighter
 *     holders keep their own uses. PROTECTED in the opening payment mix (TR29 Spaceship Recycling spends a fighter
 *     from ANY of the player's cards — the owner's decision 7).
 *  5. THE PRE-SELECT — a card played from the hand that walks the track (TR04, TR12, TR37, TR42, TR73, TR76…) has
 *     its ONE question collected inside the play's composer: `agendaWalkedForecast` hands ONE `asks` fact for the
 *     whole walk, carrying the SAME prompt the live hook defers (`reactionStep` — one builder: the layout with its
 *     LB/RB lanes, or the pick), addressed to the corporation; the batch lands the answer on its prompt. With the
 *     corporation alone the fact is `exact` — «+N [fighter] on this card» — and nothing is asked.
 */
export class ArwindInc extends ActiveCorporationCard {
  constructor() {
    super({
      name: CardName.ARWIND_INC,
      tags: [Tag.SPACE],
      startingMegaCredits: 38,
      resourceType: CardResource.FIGHTER,

      behavior: {
        production: {titanium: 1},
      },

      action: {
        addResourcesToAnyCard: {
          type: CardResource.FIGHTER,
          count: ARWIND_FIGHTERS_PER_STEP,
        },
      },

      metadata: {
        cardNumber: 'TR78',
        description: 'You start with 38 M€ and 1 titanium production.',
        infoText: [
          {kind: 'effect-short', text: 'Agenda step: 1 fighter onto any card', tokens: ['(agenda-step,res-fighter)']},
          {kind: 'effect-short', text: 'Space tag: fighters here pay 4 M€ each', tokens: ['(tag-space,res-fighter,megacredits)']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(38).nbsp.production((pb) => pb.titanium(1));
          b.corpBox('action', (ce) => {
            ce.vSpace(Size.LARGE);
            ce.action('Add a fighter resource to ANY card.', (eb) => {
              eb.empty().startAction.resource(CardResource.FIGHTER).asterix();
            });
            ce.vSpace();
            ce.effect('Whenever you advance your Agenda marker 1 step, add 1 fighter to ANY card.', (eb) => {
              eb.agendaStep(1).startEffect.resource(CardResource.FIGHTER).asterix();
            });
            ce.vSpace();
            // `.equals().megacredits(4)` is LOAD-BEARING: `effectExtraction.ts` reads `valueAsPayment = equals ∧
            // cardResource ∧ megacredits` — without it the effect classifies as «or gain M€» (EVA Mechs' precedent).
            ce.effect('When playing a Space tag, fighters here may be used as payment, and are worth 4 M€ each.', (eb) => {
              eb.tag(Tag.SPACE).startEffect.resource(CardResource.FIGHTER).equals().megacredits(ARWIND_FIGHTER_VALUE);
            });
          });
        }),
      },
    });
  }

  /** Rules 2 · 3 — the walk owes a fighter per step: landed here when nobody else can hold one, else ONE question. */
  public onAgendaWalked(player: IPlayer, walk: AgendaWalkContext): void {
    answerResourceOnAgendaWalk(player, this, walk, CardResource.FIGHTER, ARWIND_FIGHTERS_PER_STEP);
  }

  /**
   * Rule 5 — the walk of the card being PLAYED, read before the press (`walk` — the walker's own `agendaWalkForecast`):
   * ONE fact for the whole walk. The corporation alone: `exact` («+N on this card» — the engine stamps the host). A
   * second holder: `asks`, carrying the live hook's own prompt (`reactionStep` — the layout or the pick), the card
   * about to enter play counted as a holder.
   */
  public agendaWalkedForecast(cardOwner: IPlayer, playedCard: ICard, walk: AgendaWalkModel, _ctx: EffectForecastContext): ReadonlyArray<EffectForecastFact> {
    const count = walk.steps.length * ARWIND_FIGHTERS_PER_STEP;
    if (count <= 0) {
      return [];
    }
    const source = forecast.sourceOf(this, cardOwner, 'agenda-step');
    const context: AgendaWalkContext = {
      from: walk.from,
      to: walk.to,
      steps: walk.steps.map((taken) => ({to: taken.to, ...(taken.kind === 'influence' ? {} : {bonus: taken.kind})})),
      cause: {reason: 'card', card: playedCard.name},
    };
    const question = reactionStep(cardOwner, this, CardResource.FIGHTER, count, agendaWalkMeta(this.name, context), {cardBeingPlayed: playedCard});
    const holders = question.getCards();
    const chip: ActionEffect = {direction: 'gain', icon: actionPreviews.cardResourceIcon(CardResource.FIGHTER), amount: count};
    if (holders.length === 0) {
      // Unreachable while the corporation holds fighters itself — named rather than guessed, never a mutation.
      return [forecast.skipped(source, [chip], actionPreviews.SKIP_REASON.noHolder, {id: 'agenda-walk'})];
    }
    if (askerAlone(this, holders)) {
      // Rule 3: the fighters land here with the walk — «on this card» is the engine's host vocabulary.
      return [forecast.exact(source, [{...chip, note: 'on this card'}], AGENDA_REASON, {id: 'agenda-walk'})];
    }
    const prompt = question.previewPrompt();
    return [forecast.asks(source, [chip], [], AGENDA_REASON, {
      id: 'agenda-walk',
      ...forecast.AFTER_CARD_GAIN,
      ...(prompt !== undefined ? {preselect: forecast.tableQuestion(this, cardOwner, prompt)} : {}),
    })];
  }
}
