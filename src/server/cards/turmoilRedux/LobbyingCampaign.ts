import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {Tag} from '../../../common/cards/Tag';
import {ActionPreview, AgendaWalkModel} from '../../../common/models/ActionPreviewModel';
import {Priority} from '../../deferredActions/Priority';
import {stepsForBehavior} from '../../models/actionPreview';
import {ChairmanSeat} from '../../parliament/quests/ChairmanSeat';
import {PreludeCard} from '../prelude/PreludeCard';
import {CardRenderer} from '../render/CardRenderer';
import * as actionPreviews from '../actionPreviews';

/** «Increase your M€ production 2 steps» — the printed production. */
export const LOBBYING_CAMPAIGN_PRODUCTION = 2;
/** «Add 2 delegates to a resolution» — the printed count; the reserve decides how many can go. */
export const LOBBYING_CAMPAIGN_DELEGATES = 2;
/** «Advance your Agenda marker 1 step» — the printed walk; the end of the track may cut it. */
export const LOBBYING_CAMPAIGN_STEPS = 1;

/**
 * TRP1 — LOBBYING CAMPAIGN («Лоббистская кампания»), the FIRST of the Turmoil Redux PRELUDES — the set's first card
 * of the type, in the manifest's `preludeCards` beside its projects and corporations. Its own art and its own printed
 * lore, both keyed TRP1 («Lobbying has an interesting role on a planet ruled by companies.»).
 *
 * SCAN READING — the magenta PRELUDE plate; ONE tag in the corner: the red planet, the MARS tag (the preludes sheet
 * settles that the corner discs are tags — TRP2 prints Jupiter, TRP5 a plant and a microbe, TRP6 two Science tags; read
 * as a bare art disc until TRP2, 2026-10-28); no cost, no requirement, no VP. The effect row, in print order: a brown
 * production plate with «2» on gold (M€ production +2) · two white delegate silhouettes (2 of the player's own
 * delegates) · ONE starred square (one step of the Agenda track, TR04's unit — `agendaStep(1)`). The parenthesised text
 * is the rule: «Increase your M€ production 2 steps. Add 2 delegates to a resolution. Advance your Agenda marker 1
 * step.» The purple Turmoil diamond at the left edge means «needs the political engine» — for a card of THIS manifest
 * that is the module itself; and a Prelude is dealt only beside the Prelude expansion (`compatibility: 'prelude'` —
 * TR82 Proteus' precedent, so Valley Trust's fallback prelude deck never sees a Redux card).
 *
 * THREE EXISTING ENGINES, ONE CARD — nothing new is built here:
 *  · the production is a plain declaration (`production: {megacredits: 2}`);
 *  · the delegates are the DSL's `turmoil.sendDelegates` on a Redux table — the Executor hands them to the ONE vote
 *    step (`PlaceDelegatesOnResolution`, two cubes onto ONE resolution of the voting area — `oneParty`, since
 *    `manyParties` is not declared), the preview's `delegateGrantFollowUp` names the vote the answer will raise
 *    (T03 Cultural Metropolis / TR83 The Deimos Group's class); the delegates leave the RESERVE and cost nothing;
 *  · the walk is the ONE walk (`ChairmanSeat.walkAgenda`, `{reason: 'card'}`) and its preview the ONE reading
 *    (`agendaWalkForecast` — the chips, the SHOW step, the hand's plate).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/LobbyingCampaign.spec.ts):
 *  1. THE PRINTED ORDER IS THE PLAYED ORDER: production, then the delegates, then the walk. The delegates ASK (the
 *     resolution is the player's choice), so the walk WAITS for that answer — it is deferred right behind the grant
 *     (the grant's own slot, `GAIN_RESOURCE_OR_PRODUCTION`, queued after it) instead of running inside `bespokePlay`
 *     like TR04 / TR37. Those cards are played from the HAND, whose hosted Parliament plays the walk off the play's
 *     own answer; a Prelude's walk is played by the Parliament the GRANT already opened (the vote is a scene step of
 *     the start, TR83's door), off the vote's answer — the record rides THAT response, after the cubes have landed.
 *     Where the grant asks nothing (rule 3) the walk runs in the play's own response.
 *  2. The two delegates go to ONE resolution of the VOTING AREA (never the enacted one), from the reserve, free —
 *     the grant's own law. With ONE delegate in the reserve the grant offers that one (`votePrompt.count` is what the
 *     reserve covers, `printed` the card's 2) — never «2 or nothing».
 *  3. An EMPTY reserve, or no resolution up for a vote, is a NAMED skip of the delegates (`PlaceDelegatesOnResolution`
 *     refuses by name); the production and the walk still come — a Prelude is never unplayable, and nothing is lost
 *     in silence. At the start of a game neither can happen (the setup seats three resolutions; the reserve is full).
 *  4. The walk is one step with its bonus: from the UNSEATED marker (position 0 — every player's at the start) the
 *     first step SEATS it on step 1 (+1 influence, rulebook p.8); from 11 it reaches the end; from 12 it walks none
 *     and logs «already at the end» once. The preview names a cut before the press (`walked < printed`).
 *  5. The TR of a walked step is an ordinary TR of the walker's own play: the ruling Greens' +2 M€ answers it, a
 *     chairman quest it closes stands AFTER the walk (its gate is deferred at `BACK_OF_THE_LINE`).
 *  6. MarsBot is never dealt a Prelude; the bot's own walks stay the quest's and the sitting's.
 */
export class LobbyingCampaign extends PreludeCard {
  constructor() {
    super({
      name: CardName.LOBBYING_CAMPAIGN,
      tags: [Tag.MARS],

      behavior: {
        production: {megacredits: LOBBYING_CAMPAIGN_PRODUCTION},
        turmoil: {sendDelegates: {count: LOBBYING_CAMPAIGN_DELEGATES}},
      },

      metadata: {
        cardNumber: 'TRP1',
        infoText: [
          {text: 'Add 2 delegates from your reserve to one resolution in the Voting Area.', tokens: ['delegates']},
          {text: 'Advance your Agenda marker 1 step and collect its bonus.', tokens: ['agenda-step']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.megacredits(LOBBYING_CAMPAIGN_PRODUCTION)).nbsp.delegates(LOBBYING_CAMPAIGN_DELEGATES).nbsp.agendaStep(LOBBYING_CAMPAIGN_STEPS);
        }),
        description: 'Increase your M€ production 2 steps. Add 2 delegates to a resolution. Advance your Agenda marker 1 step.',
      },
    });
  }

  /** Rule 1: the walk, queued BEHIND the grant the Executor has just deferred — the printed order, kept across the vote's answer. */
  public override bespokePlay(player: IPlayer) {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      // Never dealt outside the Mars Parliament (the manifest is the deck gate); nothing to walk, nothing to skip.
      return undefined;
    }
    player.defer(() => {
      ChairmanSeat.walkAgenda(player, parliament, LOBBYING_CAMPAIGN_STEPS, {reason: 'card', card: this.name});
      return undefined;
    }, Priority.GAIN_RESOURCE_OR_PRODUCTION);
    return undefined;
  }

  /** The walk this play would make — the ONE reading of the preview, the start queue's plate and the inspector. */
  public agendaWalkForecast(player: IPlayer): AgendaWalkModel {
    return actionPreviews.agendaWalkModel(player, LOBBYING_CAMPAIGN_STEPS);
  }

  /**
   * The play read BEFORE the press, in print order: the production chip (the behavior's own), the walk's chips (the
   * track, the step's bonus, the influence), then the steps — the delegates' live follow-up (or its named skip) and
   * the walk's SHOW step.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const walk = this.agendaWalkForecast(player);
    return actionPreviews.playPreview(this, player,
      actionPreviews.agendaWalkEffects(player, walk),
      [...stepsForBehavior(player, this, this.behavior ?? {}), actionPreviews.agendaWalkStep(walk)]);
  }
}
