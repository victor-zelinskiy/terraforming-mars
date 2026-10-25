import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionPreview, AgendaWalkModel} from '../../../common/models/ActionPreviewModel';
import {ChairmanSeat} from '../../parliament/quests/ChairmanSeat';
import * as actionPreviews from '../actionPreviews';

/** The printed «lead 2 resolutions at once» — the two delegate figures of the MIN plate. */
export const POLITICAL_ALLIANCE_RESOLUTIONS = 2;
/** «Advance your Agenda marker 1 step» — the printed walk; the end of the track may cut it. */
export const POLITICAL_ALLIANCE_STEPS = 1;

/**
 * TR73 — POLITICAL ALLIANCE («Политический союз»), the Turmoil Redux
 * REPLACEMENT of the classic X09 — the FIFTH of the set's seven replacements
 * to be authored, numbered by its REGISTRY row (`common/cards/
 * turmoilReduxReplacements.ts` — the third project row). Registered as
 * `Political Alliance:redux` (the plain name stays the classic card's); the
 * Redux manifest's `cardsToRemove` keeps the classic card out of every Redux
 * deck. Nothing of the requirement lives here: it is the facade's
 * `partiesLedBy` (`PartyLeadersRequirement`), read under Redux as «the leader
 * of a resolution in the voting area» (`Parliament.leaderOf`); the walk is the
 * ONE walk (`ChairmanSeat.walkAgenda`, the TR04 path).
 *
 * SCAN READING — cost 2; the yellow disc with the down arrow is the EVENT
 * marker, never a tag (`tags` empty). The orange MIN plate beside the cost
 * holds TWO delegate figures — «the leader on two resolutions» — the
 * requirement `{partyLeader: 2}` (the face prints the figure once per
 * resolution, `premiumCardViewModel` → `tally`). One row: the starred square,
 * the printed unit «one step of the Agenda track» (`agendaStep(1)`). No VP
 * badge. The scan's number box prints the placeholder «TR00» (all six project
 * replacements do) — the card is TR73, the third project row. Printed text:
 * «Requires that you have the highest number of delegates on 2 resolutions at
 * once. (Ties are broken by who put a delegate in first, and Neutral delegates
 * don't count.) Advance your Agenda marker 1 step.» The art (shironosov /
 * istockphoto, the handshake across the table) and the lore are the classic
 * X09's, borrowed through `reimplements` — the owner's quote «I think we can
 * both benefit from this arrangement.»; no `TR73` key.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/PoliticalAllianceRedux.spec.ts):
 *  1. «The highest number of delegates on a resolution» is the LEADER of that
 *     resolution in the VOTING AREA (rulebook p.8) — `Parliament.leaderOf`:
 *     most delegates; a tie goes to whoever put a delegate in FIRST (`seq`);
 *     NEUTRAL delegates never lead and never stand in the way (three neutrals
 *     and one of mine — I lead; only neutrals — no player leads). The enacted
 *     resolution is not in the voting area and never counts. MarsBot's cubes
 *     are an ordinary rival's. The card asks for two such resolutions AT ONCE
 *     — at the play, nothing is held.
 *  2. Unmet, the hand NAMES the standing (`PoliticalOps.leadershipStanding`):
 *     the resolutions led, and for every other one who leads it and how many
 *     delegates the player is short — a tie read honestly (a tie wins only
 *     when the player's first delegate is the earlier one).
 *  3. TR70 Backroom Deal waives PARTY requirements; this is not one — never waived.
 *  4. ON PLAY: the marker walks ONE step, SYNCHRONOUSLY (the answer carries the
 *     walk's record — the console plays it as the outcome of this very play),
 *     the step's bonus paid by the walk (a TR step's TR is an ordinary TR of
 *     the action phase; an influence step changes the level). The end of the
 *     track cuts honestly (`walked < printed`, named before the press).
 *  5. PREVIEW = EXECUTION — `agendaWalkForecast` is the walk the play makes.
 *  6. MarsBot never plays the card.  7. Save / load: an ordinary card.
 */
export class PoliticalAllianceRedux extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.POLITICAL_ALLIANCE_REDUX,
      type: CardType.EVENT,
      tags: [],
      cost: 2,
      // Rule 1 — the printed two delegate figures.
      requirements: {partyLeader: POLITICAL_ALLIANCE_RESOLUTIONS},

      metadata: {
        cardNumber: 'TR73',
        // The classic X09's art and lore — the same illustration and the same printed quote.
        reimplements: CardName.POLITICAL_ALLIANCE,
        infoText: [
          {text: 'Advance your Agenda marker 1 step and collect its bonus.', tokens: ['agenda-step']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.agendaStep(POLITICAL_ALLIANCE_STEPS);
        }),
        description: 'Requires that you have the highest number of delegates on 2 resolutions at once. (Ties are broken by who put a delegate in first, and Neutral delegates don\'t count.) Advance your Agenda marker 1 step.',
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      // Never dealt outside the Mars Parliament (the manifest is the deck gate); nothing to walk, nothing to skip.
      return undefined;
    }
    // Rule 4 — synchronous, the TR04 path.
    ChairmanSeat.walkAgenda(player, parliament, POLITICAL_ALLIANCE_STEPS, {reason: 'card', card: this.name});
    return undefined;
  }

  /** The walk this play would make — the ONE reading of the preview, the hand's plate and the inspector. */
  public agendaWalkForecast(player: IPlayer): AgendaWalkModel {
    return actionPreviews.agendaWalkModel(player, POLITICAL_ALLIANCE_STEPS);
  }

  public cardPlayPreview(player: IPlayer): ActionPreview {
    const walk = this.agendaWalkForecast(player);
    return actionPreviews.playPreview(this, player,
      actionPreviews.agendaWalkEffects(player, walk),
      [actionPreviews.agendaWalkStep(walk)]);
  }
}
