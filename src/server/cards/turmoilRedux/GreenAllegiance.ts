import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {ActionPreview, AgendaWalkModel} from '../../../common/models/ActionPreviewModel';
import {ResolutionCountMetricModel, thresholdBreakdown} from '../../../common/parliament/resolutionCounts';
import {ChairmanSeat} from '../../parliament/quests/ChairmanSeat';
import * as actionPreviews from '../actionPreviews';

/** The printed «OVER 20» — the threshold the sets are counted above. */
export const GREEN_ALLEGIANCE_OVER = 20;
/** The printed «[TR 5]» — the size of one set. */
export const GREEN_ALLEGIANCE_STEP = 5;

/**
 * THE ONE READING of how far this card walks: the player's terraform rating
 * against «complete sets of 5 over 20», by the threshold family's one writer
 * (`thresholdBreakdown` → `thresholdSets`, the division RX13 Generous Funding
 * counts its sets with). The play and the preview read this same breakdown;
 * nothing here divides.
 */
export function greenAllegianceSteps(player: IPlayer): ResolutionCountMetricModel {
  return thresholdBreakdown('terraformRating', player.terraformRating, GREEN_ALLEGIANCE_OVER, GREEN_ALLEGIANCE_STEP);
}

/**
 * TR42 — GREEN ALLEGIANCE («Верность Зелёным»), a Turmoil Redux PROJECT card:
 * the walk of TR04 / TR37 with its length COUNTED instead of printed — the
 * threshold count of RX13 Generous Funding («each complete set of 5 TR over
 * 15») read over another threshold and paid in Agenda steps.
 *
 * «Requires the Greens to be ruling or that you have 2 delegates there.
 * Advance your Agenda marker 1 step for every set of 5 TR that you have over
 * 20. (And collect bonuses from each step.)» Cost 2, an Earth tag, green, no
 * VP. The card is ONE reading of the family's breakdown and ONE call of the
 * ONE walk (`ChairmanSeat.walkAgenda`) — not a line of dividing or walking
 * logic lives here.
 *
 * SCAN READING — cost 2; one tag in the corner (the blue planet: Earth). The
 * orange MIN box beside the cost holds the GREENS' emblem — the REQUIREMENT
 * (`{party: GREENS}`, the set's fifth Greens plate after TR38–TR41), never a
 * tag. The graphic is one row: the starred square (one Agenda step, TR04's
 * unit) «/» the TR badge carrying the set's size 5 (the face of RX13's
 * counted object), «OVER 20» under the badge. No VP badge. Only the module's
 * icon at the bottom left: no `compatibility`. Printed lore: «It ain't easy
 * being green.» (`lore_texts.json` «TR42»); the artist is printed «Unknown».
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/GreenAllegiance.spec.ts):
 *  1. The REQUIREMENT is the Greens' plate — ruling (the starting rule
 *     included) or 2 of the player's OWN delegates on their resolution —
 *     checked at the PLAY only; TR36 Council Seat lowers an effect's
 *     threshold, never a requirement's.
 *  2. N = `thresholdSets(TR, 20, 5)` — the complete sets of 5 TR ABOVE 20:
 *     TR 14 → 0, 20 → 0, 24 → 0, 25 → 1, 29 → 1, 30 → 2, 35 → 3, 45 → 5,
 *     60 → 8. The rating is the engine's whole `terraformRating`. The
 *     breakdown is RX13's model (`value · over · step · sets · toNext`,
 *     `toNext` ≥ 1).
 *  3. N is read ONCE, before the walk: the walk's own TR steps add no set
 *     (TR 29 from step 1 → ② TR → 30, and no second step).
 *  4. The walk is `walkAgenda(…, N, {reason: 'card', card})` SYNCHRONOUSLY in
 *     `bespokePlay` (the play's answer carries the record — TR04 rule 2); each
 *     step's bonus before the next; the track's end cuts honestly, its line
 *     once, the preview naming «N of M · end of the track».
 *  5. ZERO sets is a LEGAL play (the owner's decision 3, 2026-10-10): the
 *     cost paid, the card in the tableau, its Earth tag counted; no record,
 *     no event — and ONE journal line with the breakdown («… has no complete
 *     set of 5 TR over 20 (TR 23) — the marker stays»), the class of RX13's
 *     zero line. A computed zero named BEFORE the press is not a loss: no
 *     `recordSkippedEffect`. With sets, the breakdown line stands BEFORE the
 *     walk's step lines.
 *  6. A walked TR is an ORDINARY TR (the Greens' +2 M€, the chairman quest
 *     counts it); a quest it closes stands AFTER the walk (TR04 rule 7);
 *     influence is re-read on every step by whoever reads it.
 *  7. The Earth tag: Earth discounts apply (Teractor → cost 0, still
 *     playable); Point Luna draws; the table's answer to the play flies
 *     (PL-124).
 *  8. The PREVIEW (`cardPlayPreview`) carries the walk WITH its breakdown
 *     (`AgendaWalkModel.basis`): `printed = N`, `walked` cut by the track,
 *     the chips of each step; at zero no walk chip at all and the breakdown
 *     still there (the composer's «Маркер Карьеры не двинется: …» row).
 *  9. A one-shot AUTOMATED play. 10. Save / load adds nothing (the record
 *     already serializes). 11. MarsBot never plays it (the bot's deck is
 *     tags). 12. A rival sees the walk (the tier's watcher) and the play's
 *     notification with «Открыть Парламент» (the TR31 / TR37 class).
 */
export class GreenAllegiance extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.GREEN_ALLEGIANCE,
      type: CardType.AUTOMATED,
      tags: [Tag.EARTH],
      cost: 2,
      requirements: {party: PartyName.GREENS},

      metadata: {
        cardNumber: 'TR42',
        infoText: [
          {text: 'Advance your Agenda marker 1 step per complete set of 5 TR you have over 20 and collect the bonus of each step.', tokens: ['agenda-step']},
        ],
        renderData: CardRenderer.builder((b) => {
          // ONE rating badge carrying the set's size — the scan's «5» on the laurel; `digit` (the DSL's count form,
          // «5 [TR]»), never five badges: the default draws an amount up to 5 as that many icons, which reads «5 TR
          // per step» — the opposite of the rule.
          b.agendaStep(1).slash().tr(GREEN_ALLEGIANCE_STEP, {digit: true}).br;
          // A literal key (the locale greps it) — the spec pins it to `GREEN_ALLEGIANCE_OVER`.
          b.text('over 20', Size.SMALL, true);
        }),
        description: 'Requires the Greens to be ruling or that you have 2 delegates there. Advance your Agenda marker 1 step for every set of 5 TR that you have over 20. (And collect bonuses from each step.)',
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      // Never dealt outside the Mars Parliament (the manifest is the deck gate); nothing to walk, nothing to skip.
      return undefined;
    }
    const counted = greenAllegianceSteps(player);
    if (counted.sets <= 0) {
      player.game.log('${0} has no complete set of 5 TR over 20 (TR ${1}) — the Agenda marker stays', (b) =>
        b.player(player).number(counted.value));
      return undefined;
    }
    player.game.log('${0} has ${1} complete set(s) of 5 TR over 20 (TR ${2}) — ${3} Agenda step(s)', (b) =>
      b.player(player).number(counted.sets).number(counted.value).number(counted.sets));
    ChairmanSeat.walkAgenda(player, parliament, counted.sets, {reason: 'card', card: this.name});
    return undefined;
  }

  /**
   * The walk read BEFORE the press, by the server: the counted steps with
   * WHY they are this many (the breakdown rides the walk — the composer's
   * first «next» row and the track chip's note), the chips of each step's
   * bonus (the TR chip the forecast reads the Greens' «+2 M€» from) and the
   * SHOW step the console names its coming stage from. Zero sets: no walk
   * chip — the breakdown alone says why the marker stays.
   */
  /** The walk this play would make, WITH why it is this long — the ONE reading of the preview, the hand's plate and the inspector. */
  public agendaWalkForecast(player: IPlayer): AgendaWalkModel {
    const counted = greenAllegianceSteps(player);
    return actionPreviews.agendaWalkModel(player, counted.sets, counted);
  }

  public cardPlayPreview(player: IPlayer): ActionPreview {
    const walk = this.agendaWalkForecast(player);
    return actionPreviews.playPreview(this, player,
      actionPreviews.agendaWalkEffects(player, walk),
      [actionPreviews.agendaWalkStep(walk)]);
  }
}
