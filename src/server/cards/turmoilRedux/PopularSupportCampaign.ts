import {IPlayer} from '../../IPlayer';
import {ActionPreview, NeutralRallyModel} from '../../../common/models/ActionPreviewModel';
import {ReduxParty} from '../../../common/parliament/ParliamentTypes';
import {Priority} from '../../deferredActions/Priority';
import {stepsForBehavior} from '../../models/actionPreview';
import {applyRally, rallyPlan, RallyPrint} from '../../parliament/RallyNeutralDelegates';
import {PreludeCard, StaticPreludeProperties} from '../prelude/PreludeCard';
import * as actionPreviews from '../actionPreviews';

/** «Add 3 neutral delegates» — the printed count of every campaign; the area (3) and the common supply decide how many land. */
export const CAMPAIGN_SUPPORT = 3;

/** ONE party's area, no vote, no recount: the rally's print for a campaign. */
export const CAMPAIGN_SUPPORT_PRINT: RallyPrint = {perResolution: 0, perArea: CAMPAIGN_SUPPORT, recount: false};

/**
 * THE PRELUDE CAMPAIGNS of Turmoil Redux — TRP2 Unity Campaign and its five sisters on the preludes sheet (TRP3 Mars
 * First · TRP4 Reds · TRP5 Greens · TRP6 Scientists · TRP7 Industrialists): an opening of the card's own (declared as
 * `behavior` — resources, a colony, a city, a draw, production) and then the ONE printed line «Add 3 neutral delegates
 * to <party>'s Popular Support Area». The line is the class; this base carries it, the card file declares the rest.
 *
 * RULE READINGS (rulebook v1.0, p.9 «Popular Support», p.11 step 5, p.13; pinned by the cards' specs):
 *  1. THE DELEGATES GO INTO THE AREA, NEVER ONTO A RESOLUTION — even with the party's resolution up for a vote right
 *     now. The area is where neutral delegates WAIT: they move onto a resolution only «when new resolution cards get
 *     added to the Voting area» (p.9), i.e. at the refresh of the sitting (step 5: «check if the three NEWLY ADDED
 *     cards belong to parties that have neutral delegates in their Popular Support areas»). A card standing in the
 *     area is not newly added; the engine's one mover is the refresh (`ParliamentPhase` → `moveSupportToSlot`). The
 *     sister cards print the same split: TR31 names «each resolution AND each Popular Support Area» as two places,
 *     TR03 puts its 3 neutrals in the area of the very party it has just voted for.
 *  2. The area holds at most 3 (p.9 «discard the excess»): as many land as the area and the common supply (14 −
 *     the neutral cubes in use) take — the shared payout `payPopularSupport` judges both, in that order (TR03 / TR31
 *     pay through it): fewer than 3 is the journal's «(3/3)», none is a NAMED skip (`effect-skipped`), and the
 *     forecast names the ceiling (`limit`) before the press. At the start of a game every area is empty (setup,
 *     p.12): all three land.
 *  3. The ruling party is no exception: its area fills all the same and waits for the party's NEXT card, which the
 *     refresh can deal only once the party no longer holds the ENACTED slot.
 *  4. THE PRINTED ORDER: the opening first, the support last — deferred at `BACK_OF_THE_LINE`, so a colony or a
 *     city the opening asks for (and every bonus that placement sets off) resolves before the cubes leave the
 *     supply, and the rally's record rides the response to the LAST of those answers. Rules-neutral (nothing in the
 *     opening touches a neutral delegate); it is the order the player reads and the console plays.
 *  5. The delegates are NEUTRAL: no «send N delegates» quest counts them, they grant nobody a party's effect, move
 *     no Agenda marker and pay no recount (TR31's M€ is TR31's own line).
 *  6. MarsBot is never dealt a Prelude.
 */
export abstract class PopularSupportCampaign extends PreludeCard {
  /** The party whose Popular Support Area the card fills. */
  public readonly campaignParty: ReduxParty;

  constructor(properties: StaticPreludeProperties & {campaignParty: ReduxParty}) {
    const {campaignParty, ...prelude} = properties;
    super(prelude);
    this.campaignParty = campaignParty;
  }

  /** The support this play would add — the ONE plan the preview reads and the play applies (`undefined` off the Mars Parliament). */
  public campaignSupportPlan(player: IPlayer): NeutralRallyModel | undefined {
    const parliament = player.game.parliament;
    return parliament === undefined ? undefined : rallyPlan(parliament, [this.campaignParty], CAMPAIGN_SUPPORT_PRINT);
  }

  /** Rule 4: the support, queued BEHIND everything the opening asks — the plan read at the moment it is applied. */
  public override bespokePlay(player: IPlayer) {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      // Never dealt outside the Mars Parliament (the manifest is the deck gate): no area to fill, nothing to skip.
      return undefined;
    }
    player.defer(() => {
      applyRally(player, parliament, rallyPlan(parliament, [this.campaignParty], CAMPAIGN_SUPPORT_PRINT), {kind: 'card', card: this.name});
      return undefined;
    }, Priority.BACK_OF_THE_LINE);
    return undefined;
  }

  /**
   * The play read BEFORE the press, in print order: the opening's chips (the behavior's own) and the support's
   * («+3 [neutral] · in Popular Support»), then the steps — the opening's own (a colony pick, a city) and the
   * rally's SHOW step carrying the plan (the area's `current → resulting`, a named zero when it is full).
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const plan = this.campaignSupportPlan(player);
    const steps = stepsForBehavior(player, this, this.behavior ?? {});
    if (plan === undefined) {
      return actionPreviews.playPreview(this, player, [], steps);
    }
    return actionPreviews.playPreview(this, player, actionPreviews.rallyEffects(player, plan), [...steps, actionPreviews.rallyStep(plan)]);
  }
}
