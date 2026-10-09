import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {ReduxParty, ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {CardRenderer} from '../render/CardRenderer';
import {Parliament} from '../../parliament/Parliament';
import {message} from '../../logs/MessageBuilder';
import * as actionPreviews from '../actionPreviews';

/** «You only need 1 delegate on a resolution to gain its party's effect.» — the card's one number. */
export const COUNCIL_SEAT_EFFECT_DELEGATES = 1;

/** The composer's row for a party this play opens: «Opens the X party effect now: your delegate stands on Y». */
export const COUNCIL_SEAT_OPENS_NOTE = 'Opens the ${0} party effect now: your delegate stands on ${1}';
/** …and for a play that opens nothing yet — the effect starts with the first cube, not with the card. */
export const COUNCIL_SEAT_NOTHING_NOTE = 'No party opens now — the effect starts with your first delegate on a resolution';
/** The journal's line per party the play opened (the effect's own area). */
export const COUNCIL_SEAT_HOLDS_LINE = '${0} holds the ${1} party effect: 1 delegate on ${2} (${3})';

/** A party the play opens: in the voting area, one of the player's own cubes on it, the effect not yet theirs. */
export type CouncilSeatOpening = {party: ReduxParty, resolution: ResolutionId};

/**
 * THE PARTIES THIS PLAY OPENS, read off the live table BEFORE the card lands
 * (the preview's rows and the journal's lines are the SAME list — one
 * predicate, read twice): a party of the voting area with at least ONE of
 * the player's delegates on its resolution whose effect is NOT yet theirs by
 * any road (ruling / the printed two / a grant / another lowering card).
 * Pure — mutates nothing.
 */
export function councilSeatOpenings(player: IPlayer, parliament: Parliament): Array<CouncilSeatOpening> {
  const out: Array<CouncilSeatOpening> = [];
  for (const slot of parliament.slots) {
    const definition = parliament.resolutionOf(slot.instance);
    const access = parliament.access(player, definition.party);
    if (!access.hasEffect && access.delegates >= COUNCIL_SEAT_EFFECT_DELEGATES) {
      out.push({party: definition.party, resolution: definition.id});
    }
  }
  return out;
}

/**
 * TR36 — COUNCIL SEAT («Место в совете»), a Turmoil Redux PROJECT card — the
 * set's FIRST card that changes THE LAW OF ACCESS rather than the table.
 *
 * «Requires the Reds to be ruling or that you have 2 delegates there. Effect:
 * You only need 1 delegate on a resolution to gain its party's effect.» Cost
 * 6, a Mars tag, blue, no action, no VP.
 *
 * The rulebook's road to a party's effect is «2 or more delegates on that
 * party's resolution» (p.7). For this card's owner that number is 1 — for
 * EVERY party of the voting area at once, live: the Parliament judges
 * `byDelegates` against the seat's OWN threshold (`Parliament.access`), and
 * the threshold is read off the tableau at every ask through the hook this
 * file declares (`partyEffectDelegates` — the influence hook's pattern). So
 * the card is a THRESHOLD and never a GRANT (D1 of the prompt): a grant
 * (`grantPartyEffect`, the Septem Tribus reserve) lives apart from the cubes
 * and leaves only by a revoke — to imitate «one is enough» with grants, every
 * placement, every refresh and every departure of a resolution would have to
 * rewrite them, a second state that drifts from the table. A threshold adds
 * no state, no save field and no revoke: the cube already standing opens the
 * effect the moment the card lands, the cube gone closes it.
 *
 * SCAN READING — cost 6; one tag in the corner (the red planet: Mars). The
 * orange MIN box beside the cost holds the REDS' emblem — the REQUIREMENT
 * (`{party: REDS}`, the set's seventh Reds plate after TR30–TR35), never a
 * tag. The effect row: a delegate silhouette, a colon, the purple wild «?»
 * with an asterisk — «(Effect: You only need 1 delegate on a resolution to
 * gain its party's effect.)». The bottom block: «(Requires the Reds to be
 * ruling or that you have 2 delegates there.)» and nothing else — the play
 * puts nothing on the table. No VP badge. Only the module's icon at the
 * bottom left (no ▲, no Venus icon): no `compatibility`. Printed lore:
 * «Chair man of the bored.» (`lore_texts.json` «TR36»; the art: Simon Urban).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/CouncilSeat.spec.ts):
 *  1. The REQUIREMENT is the Reds' plate — the Reds rule, or 2 of the player's
 *     OWN delegates on their resolution — checked at the PLAY only (the TR15
 *     class: the emblem in the MIN plate, the named reason «N of 2», the
 *     hand's counter). The card's own effect never helps a REQUIREMENT
 *     (rulebook FAQ p.19): not its own (it is already played), not TR30–TR35's
 *     in hand — with one delegate on the Reds' resolution a Reds card reads
 *     «1 of 2» and stays unplayable, while the Reds' EFFECT is the player's.
 *  2. The play puts NOTHING on the table — no resource, no delegate, no money.
 *     No `behavior`; the preview is this file's (rule 11).
 *  3. The owner's EFFECT THRESHOLD is 1 for EVERY party of the voting area at
 *     once: three resolutions with one cube each are three effects. It stacks
 *     with the ruling party (everyone's). Every other seat keeps 2.
 *  4. The REQUIREMENT is untouched: `satisfiesPartyRequirement` at one
 *     delegate is false; `partyRequirementStanding.required` is 2; the vote's
 *     `unlocksRequirement` fires at 2; the owner's `unlocksEffect` at 1.
 *  5. LIVE, both ways: played with a cube already standing → the effect at
 *     once (the party's action in the menu the same turn, the Scientists'
 *     wild tag in the next count); the refresh took the cube / the resolution
 *     left the table → no effect; no card in the tableau → no threshold.
 *  6. NOT A GRANT: `access().granted` stays `[]`, `grantedEffects` is never
 *     written, nothing new is serialized — the threshold is read off the
 *     tableau again after a load.
 *  7. Only the player's OWN delegates ON THE RESOLUTION count: the chairman's
 *     seat no, neutral cubes no, Popular Support no, the ENACTED card no (its
 *     party rules — the other road).
 *  8. The floor and the stacking: two lowering cards still read 1, never 0
 *     (`Parliament.effectDelegatesOf` clamps to [1, 2]); a grant and the
 *     threshold are an OR, as every road is.
 *  9. A party's ACTION is one use per generation per party whatever the road
 *     (the existing rule): a use with one delegate is a use.
 * 10. MarsBot never plays the card; the bot's seat (`participates` false for
 *     party effects) holds no effect at any threshold.
 * 11. THE JOURNAL of the play: one line per party whose effect THIS play
 *     opened (`councilSeatOpenings` — a cube standing, the effect not yet
 *     held by another road), under the card's own effect area; none opened →
 *     no line (nothing to say: the composer already said it in words).
 * 12. THE OWNER'S VOTE PROJECTIONS: a slot with 0 cubes — «unlocks the effect
 *     (1 delegate)» without a requirement chip; a slot going 1 → 2 — the
 *     requirement chip without an effect chip (the effect is theirs already).
 */
export class CouncilSeat extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.COUNCIL_SEAT,
      type: CardType.ACTIVE,
      tags: [Tag.MARS],
      cost: 6,
      requirements: {party: PartyName.REDS},

      metadata: {
        cardNumber: 'TR36',
        // The printed rule is 68 characters — over the browser's caption budget (52): one curated caption.
        infoText: [{kind: 'effect-short', text: 'A party effect from 1 delegate, not 2', tokens: ['delegates']}],
        renderData: CardRenderer.builder((b) => {
          // «[delegate] : [?]*» — one of your delegates, and the party's effect (any party's: the wild pill).
          b.effect('You only need 1 delegate on a resolution to gain its party\'s effect.', (eb) => {
            eb.delegates(1).startEffect.wild(1).asterix();
          });
        }),
        description: 'Requires the Reds to be ruling or that you have 2 delegates there.',
      },
    });
  }

  /** THE LAW OF ACCESS, lowered: one own delegate on a resolution gives its party's effect (read live by `Parliament.access`). */
  public readonly partyEffectDelegates = COUNCIL_SEAT_EFFECT_DELEGATES;

  /**
   * Rule 11 — the play changes NOTHING on the table; it only says which
   * parties it opened, by the same reading the composer showed, under the
   * card's own effect area. Read before the card is counted (whether the
   * tableau already holds it or not, the predicate reads the OTHER roads).
   */
  public override bespokePlay(player: IPlayer) {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      // Never dealt outside the Mars Parliament (the manifest is the deck gate): nothing to open.
      return undefined;
    }
    const openings = councilSeatOpenings(player, parliament);
    if (openings.length > 0) {
      player.game.events.withEffect(player, this, 'card-played', () => {
        for (const opening of openings) {
          player.game.log(COUNCIL_SEAT_HOLDS_LINE, (b) => b.player(player).partyName(opening.party).resolution(opening.resolution).card(this));
        }
      });
    }
    return undefined;
  }

  /**
   * The composer BEFORE the press: which parties open NOW (one row each,
   * with the resolution the cube stands on), or the honest «none yet» row.
   * The same `councilSeatOpenings` the play journals — there is no prompt
   * between them.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      return actionPreviews.playPreview(this, player);
    }
    const openings = councilSeatOpenings(player, parliament);
    const steps = openings.length === 0 ?
      [actionPreviews.noteStep('generic', COUNCIL_SEAT_NOTHING_NOTE)] :
      openings.map((opening) => actionPreviews.noteStep('generic',
        message(COUNCIL_SEAT_OPENS_NOTE, (b) => b.partyName(opening.party).resolution(opening.resolution))));
    return actionPreviews.playPreview(this, player, [], steps);
  }
}
