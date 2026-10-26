import {Tag} from '../../../common/cards/Tag';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {IPlayer} from '../../IPlayer';
import {ICard, AgendaStepContext} from '../ICard';
import {ActiveCorporationCard} from '../corporation/CorporationCard';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {Priority} from '../../deferredActions/Priority';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {AgendaWalkModel} from '../../../common/models/ActionPreviewModel';
import {EffectForecastContext} from '../EffectForecastContext';
import {agendaStepMeta, askResourceOnAgendaStep, reactionStep} from '../../parliament/AgendaStepReactions';
import {ARWIND_FIGHTER_VALUE} from '../../../common/constants';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** «Add 1 fighter to ANY card» — the action's and the Career step's one count. */
export const ARWIND_FIGHTERS_PER_STEP = 1;

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
 *  2. «WHENEVER YOU ADVANCE YOUR AGENDA MARKER 1 STEP» — PER STEP: a walk of N steps asks N questions, in order, each
 *     after its step's own bonus (`ICard.onAgendaStep` — the ONE call inside `ChairmanSeat.walkAgenda`). All four
 *     engines of the track: a card's walk (TR04 …), the chairman's quest, the sitting's winner step, a law's seat
 *     step (RX39). A step the end of the track refuses is not taken and asks nothing; a step whose rating a law
 *     vetoed (RX42) WAS taken and asks. MarsBot never holds the card (no twin) — the walk calls no hook for it.
 *  3. THE QUESTION is `parliament/AgendaStepReactions`' shared step: a holder of fighters on the player's own table
 *     (`AddResourcesToCard.getCards`), never applied silently, marked with the step that asked (`agendaStepPrompt`).
 *     A walk the PARLIAMENT runs records the question (`pendingActions` `card-reaction`) so a reload re-asks it.
 *  4. «FIGHTERS HERE» — the payment unit `arwindFighters` (`Spendable`): fighters ON THIS CARD, a PRINTED Space tag
 *     only (no standard project, no bill), a flat 4 M€ each, spent off this card (`Player.pay`). The other fighter
 *     holders keep their own uses. PROTECTED in the opening payment mix (TR29 Spaceship Recycling spends a fighter
 *     from ANY of the player's cards — the owner's decision 7).
 *  5. THE PRE-SELECT — a card played from the hand that walks the track (TR04, TR12, TR37, TR42, TR73, TR76…) has its
 *     questions collected inside the play's composer: `agendaStepForecast` hands one `asks` fact per step of the
 *     walk, each carrying the SAME prompt the live hook defers (`reactionStep` — one builder), addressed to the
 *     corporation; the batch lands the answers on their prompts in order.
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

  /** Rule 2 — every step of the walk asks where the fighter goes (rule 3). */
  public onAgendaStep(player: IPlayer, step: AgendaStepContext): void {
    askResourceOnAgendaStep(player, this, step, CardResource.FIGHTER, ARWIND_FIGHTERS_PER_STEP);
  }

  /**
   * Rule 5 — the walk of the card being PLAYED, read before the press (`walk` — the walker's own `agendaWalkForecast`):
   * one question per step it will take, each the live hook's own prompt (`reactionStep`), the card about to enter
   * play counted as a holder.
   */
  public agendaStepForecast(cardOwner: IPlayer, playedCard: ICard, walk: AgendaWalkModel, _ctx: EffectForecastContext): ReadonlyArray<EffectForecastFact> {
    const source = forecast.sourceOf(this, cardOwner, 'agenda-step');
    const facts: Array<EffectForecastFact> = [];
    walk.steps.forEach((taken, i) => {
      const step: AgendaStepContext = {
        to: taken.to,
        ...(taken.kind === 'influence' ? {} : {bonus: taken.kind}),
        index: i + 1,
        of: walk.steps.length,
        cause: {reason: 'card', card: playedCard.name},
      };
      const question = reactionStep(cardOwner, this, CardResource.FIGHTER, ARWIND_FIGHTERS_PER_STEP, agendaStepMeta(this.name, step), {cardBeingPlayed: playedCard});
      if (question.getCards().length === 0) {
        // Unreachable while the corporation holds fighters itself — and never a mutation from a forecast.
        return;
      }
      const prompt = question.execute();
      facts.push(forecast.asks(source,
        [{direction: 'gain', icon: actionPreviews.cardResourceIcon(CardResource.FIGHTER), amount: ARWIND_FIGHTERS_PER_STEP}],
        [],
        'Agenda step',
        {
          id: `agenda-step-${i}`, sequence: Priority.GAIN_RESOURCE_OR_PRODUCTION, timing: 'after-card',
          ...(prompt !== undefined ? {preselect: forecast.tableQuestion(this, cardOwner, prompt)} : {}),
        }));
    });
    return facts;
  }
}
