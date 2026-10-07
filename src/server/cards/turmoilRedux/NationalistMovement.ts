import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Resource} from '../../../common/Resource';
import {PartyName} from '../../../common/turmoil/PartyName';
import {ReduxParty} from '../../../common/parliament/ParliamentTypes';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {applyRally, rallyPlan, RallyPrint} from '../../parliament/RallyNeutralDelegates';
import * as actionPreviews from '../actionPreviews';

/** The two parties the card names, in the PRINTED order (the Reds' emblem above Mars First's). */
export const NATIONALIST_MOVEMENT_PARTIES: ReadonlyArray<ReduxParty> = [PartyName.REDS, PartyName.MARS];
/** «1 neutral delegate to each … resolution … and to each of their Popular Support Areas». */
export const NATIONALIST_MOVEMENT_PRINT: RallyPrint = {perResolution: 1, perArea: 1};

/**
 * TR31 — NATIONALIST MOVEMENT («Националистическое движение»), a Turmoil
 * Redux PROJECT card — the set's FIRST card that places a NEUTRAL vote.
 *
 * «Requires the Reds to be ruling or that you have 2 delegates there. Add 1
 * neutral delegate to each Reds and Mars First resolution up for voting, and
 * to each of their Popular Support Areas as well. Then gain M€ equal to the
 * total number of neutral delegates in use. (Not in the reserve)» Cost 2, a
 * Mars tag, no VP.
 *
 * The card asks NOTHING — no resolution, no party, no target — and does three
 * things at once, two of which move the table's politics (two votes: the
 * winning resolution may change; two areas: the ceiling of three) and the
 * third of which is a NUMBER the player does not keep in their head (the
 * neutral delegates in use). So the card is ONE call of the shared step
 * `RallyNeutralDelegates` — a pure PLAN read before the press and applied by
 * the table's own writers — and on the console the play is an OUTCOME hosted
 * by the hand (TR04's form): the Parliament rises inside the hand's zone,
 * the cubes land one by one, the recount runs over the table, the coin is
 * born from the count.
 *
 * SCAN READING — cost 2; one tag in the corner (the red planet: Mars). The
 * orange MIN box beside the cost holds the Reds' emblem — the REQUIREMENT
 * (`{party: REDS}`, the set's second Reds plate after TR30), never a tag. The
 * graphic is one row: a NEUTRAL (dark) delegate with the two party emblems
 * (the Reds above Mars First) and an asterisk — «each of THESE parties'
 * resolution and area» — then «1 M€ / neutral delegate». The emblems are
 * carried by the text and the asterisk (no emblem item in the DSL). No VP
 * badge. The purple Turmoil symbol at the bottom left means «needs the
 * political engine» — for a card of THIS manifest that is the module itself
 * (`compatibility: 'turmoil'` is the upstream-adaptation marker and would
 * demand `politics: 'redux'`).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/NationalistMovement.spec.ts):
 *  1. The REQUIREMENT is the Reds' plate: the Reds rule, or 2 of the player's
 *     own delegates stand on the Reds' resolution. A party effect GRANTED by
 *     a card (Council Seat) is not a road (FAQ p.19). Checked at the play.
 *  2. The RECIPIENTS of votes are the Reds' and Mars First's resolutions
 *     standing IN THE VOTING AREA (`slotOf`) — one per party or none: the
 *     enacted card, the discard and the deck never. When the Reds rule by an
 *     enacted card their resolution is not up for a vote — a NAMED ZERO
 *     («no Reds resolution up for a vote»), never a skip and never a loss.
 *  3. ONE neutral delegate on each such resolution is the neutral player's
 *     vote: it never takes the card's lead while a player's cube stands
 *     there (nobody's access to the party moves), but the card may BECOME
 *     the winning one (more votes; equal votes go to the slot closer to
 *     ENACTED). The plan reads the verdict on a copy, cube by cube.
 *  4. ONE neutral delegate into the Popular Support Area of the Reds and of
 *     Mars First — resolution or not — up to the area's three; the excess is
 *     a named zero («the support area is full», as the sitting says).
 *  5. The PRINTED ORDER, the supply judged as it goes: the Reds' resolution →
 *     Mars First's resolution → the Reds' area → Mars First's area; an empty
 *     supply cuts whatever comes after («no neutral delegates left»). The
 *     supply is DERIVED: 14 − neutral votes − support.
 *  6. THEN the M€: the neutral delegates IN USE after the placement — the
 *     votes on all three slots (any party's) plus all six areas =
 *     `14 − neutralSupply()`, at most 14. An ordinary stock gain under the
 *     card, with its basis in the journal.
 *  7. Everything in ONE answer, no question: «Разыграть карту» is one POST,
 *     nothing is parked.
 *  8. The card's delegates are NEUTRAL: they count toward no «send N
 *     delegates» chairman quest, grant nobody a party's effect, move no
 *     Agenda marker. MarsBot never plays it (its deck is tags); the bot's own
 *     cubes are not neutral and are not counted.
 *  9. The JOURNAL is the play's root: a line per neutral vote (its
 *     resolution), the support lines (the sitting's own keys, the party as
 *     the subject), the M€ line WITH ITS BASIS. A rival's notification reads
 *     the same facts.
 * 10. SAVE / LOAD: everything lives in the Parliament's ledger; the rally's
 *     record (`lastRally`) is a presentation ring and is not serialized —
 *     a reload loses the animation, never a rule.
 *
 * SYNCHRONOUS (no `game.defer`), as TR04: the answer to the play's POST must
 * carry the rally's record, because the console plays that record as the
 * OUTCOME of this very play.
 */
export class NationalistMovement extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.NATIONALIST_MOVEMENT,
      type: CardType.AUTOMATED,
      tags: [Tag.MARS],
      cost: 2,
      requirements: {party: PartyName.REDS},

      metadata: {
        cardNumber: 'TR31',
        infoText: [
          {text: 'Add 1 neutral delegate to each Reds and Mars First resolution up for a vote. It is a vote: the card may become the winning one, but a neutral delegate never leads it while a player stands on it.', tokens: ['neutral-delegate']},
          {text: 'Add 1 neutral delegate to the Popular Support Area of the Reds and of Mars First (3 per area at most, supply permitting).', tokens: ['neutral-delegate']},
          {text: 'Gain 1 M€ per neutral delegate in use — on any resolution or in any Popular Support Area, not in the reserve.', tokens: ['megacredits']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.neutralDelegate(1).asterix().nbsp.nbsp.megacredits(1).slash().neutralDelegate(1);
        }),
        description: 'Requires the Reds to be ruling or that you have 2 delegates there. Add 1 neutral delegate to each Reds and Mars First resolution up for voting, and to each of their Popular Support Areas as well. Then gain M€ equal to the total number of neutral delegates in use. (Not in the reserve)',
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      // Never dealt outside the Mars Parliament (the manifest is the deck gate): nothing to rally, nothing to count.
      return undefined;
    }
    const plan = rallyPlan(parliament, NATIONALIST_MOVEMENT_PARTIES, NATIONALIST_MOVEMENT_PRINT);
    applyRally(player, parliament, plan, {kind: 'card', card: this.name});
    // «Then gain M€ equal to the total number of neutral delegates in use» — the card's own stock gain, with
    // its basis said out loud (a number the player did not count is a number that must name itself).
    if (plan.megacredits > 0) {
      player.stock.add(Resource.MEGACREDITS, plan.megacredits, {log: false, from: {card: this.name}});
    }
    player.game.log('${0} gains ${1} M€ — ${2} neutral delegate(s) in use', (b) => b.player(player).number(plan.megacredits).number(plan.megacredits));
    return undefined;
  }

  /**
   * The rally read BEFORE the press, by the server: the plan's chips (the
   * votes, the support, the M€ the hosted step delivers) and the SHOW step
   * carrying the whole plan — each resolution with its votes and the winner,
   * each area with its room, the count the M€ stands on. The same `rallyPlan`
   * the play calls, on the same table: there is no prompt between them.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      return actionPreviews.playPreview(this, player);
    }
    const plan = rallyPlan(parliament, NATIONALIST_MOVEMENT_PARTIES, NATIONALIST_MOVEMENT_PRINT);
    return actionPreviews.playPreview(this, player, actionPreviews.rallyEffects(player, plan), [actionPreviews.rallyStep(plan)]);
  }
}
