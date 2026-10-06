import {IProjectCard} from '../IProjectCard';
import {IActionCard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {ActionEffect, ActionPreview} from '../../../common/models/ActionPreviewModel';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';
import * as actionPreviews from '../actionPreviews';

/** The fighters the action puts here — the declarative half (`action.addResources`). */
const ADDED = 1;
/** «If there are at least 2 fighters here, discard 2 of them» — the one printed 2, read twice. */
const DISCARDED = 2;
/** «…to gain 1 TR». */
const TR_GAINED = 1;

/** What ONE activation does, read off the card's count at its start (`EarthArmyContract.activationAt`). */
export type EarthArmyActivation = {
  /** The fighters on the card when the action starts. */
  before: number;
  /** …after its own +1 (the count the condition asks about). */
  added: number;
  /** The fighters discarded after the +1 — 0 or 2. */
  discarded: number;
  /** The TR those buy — 0 or 1. */
  tr: number;
};

/**
 * TR28 — EARTH ARMY CONTRACT («Контракт с армией Земли»), a blue card of Turmoil
 * Redux whose action is TWO BEATS ON ONE CARD: a fighter lands here, then — if
 * that makes two — two fighters leave for a TR. The set's first action whose
 * second half is CONDITIONAL on the first.
 *
 * SCAN READING — cost 8; the corner holds TWO tags, Earth (the planet) and Space
 * (the yellow star on black). The orange MIN box beside the cost holds Unity's
 * emblem (three linked rings): the REQUIREMENT `{party: PartyName.UNITY}`, never a
 * tag. The upper block is one ACTION row — the red arrow, «[fighter] , −2
 * [fighter] : [TR]» — with «(Action: Add 1 fighter to this card. Then, if there
 * are at least 2 fighters here, discard 2 of them to gain 1 TR.)»; the lower
 * block holds only «(Requires Unity to be ruling or that you have 2 delegates
 * there.)» — there is NO effect on play. No VP badge. Only the purple Turmoil
 * hexagon at the bottom left (the module itself — no ▲, no Venus icon): no
 * `compatibility`. The quote is printed: «Hundreds of years in the future and the
 * War Thunder forums are still going?!» The rulebook never names the card
 * (`pdftotext`, grep «army»). The printed rule's «Then,» is dropped from the
 * card's text: the structured-text law carries order by the sentences' own order
 * (`cardInformation.spec` refuses a sequencing connective) — the rule is unchanged.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/EarthArmyContract.spec.ts):
 *  1. The requirement is a condition of the PLAY: Unity rules, or two of the
 *     player's delegates stand on its resolution. Once played the action works
 *     whoever rules (TR15's reading of the party plate).
 *  2. The play does nothing but put the card down — a fighter holder at 0.
 *  3. The action is ONE sequence with no choice: +1 fighter here; then, if there
 *     are at least 2 here, exactly 2 are discarded and the player gains 1 TR. The
 *     discard is MANDATORY («discard», not «you may»). 0 → 1 (no TR); 1 → 2 → 0
 *     and a TR; 3 → 4 → 2 and a TR (two discarded, once).
 *  4. The action is ALWAYS available (a fighter can always be added) — once per
 *     generation, as any blue card's.
 *  5. The TR is the ordinary `increaseTerraformRating` under the card's source in
 *     the action phase: the chairman quest on TR counts it, the ruling Greens pay
 *     their 2 M€, `hasIncreasedTerraformRatingThisGeneration` opens the UNMI
 *     corporation's action, the score breakdown attributes the point to the card,
 *     every `onIncreaseTerraformRatingByAnyPlayer` hook fires. Turmoil Redux has
 *     no Reds tax (the Redux Reds are an action — TR26's reading).
 *  6. Fighters others put here count toward «at least 2» (the Redux Vesta puts
 *     «mechs, asteroids or fighters» on ANY card).
 *  7. Fighters here are worth nothing (no VP) and are spent on nothing but the
 *     card's own action. (The rulebook's milestone «Aeronaut» — «a combined 4
 *     fighter or mech resources across your cards», p.16 — would count them; it
 *     is not implemented in this engine: recorded, not built.)
 *  8. The order of events is the order of the icons: added → two discarded →
 *     TR — three records under the card's source, none twice.
 *  9. Save / load keeps the count (`resourceCount`); the action after a load
 *     reads it.
 * 10. MarsBot never plays the card.
 * 11. The journal: «${0} added ${1} ${2} to ${3}» (the declarative half's own
 *     line), «${0} discarded ${1} ${2} from ${3} to gain ${4} TR» — and the TR is
 *     written once, by its typed event (the plain-gain convention).
 *
 * ONE READING. The preview and the action read the count through ONE function,
 * `activationAt(count)`, at the same moment — before the action's own +1 — so the
 * composer can never promise a TR this activation will not give (0 fighters:
 * «+1» alone; ≥ 1: «+1, −2, +1 TR»). The executor DEFERS the declarative +1, so
 * the conditional half is queued behind it at the same priority: the printed
 * order is the executed order.
 */
export class EarthArmyContract extends ActionCard implements IProjectCard, IActionCard {
  constructor() {
    super({
      name: CardName.EARTH_ARMY_CONTRACT,
      type: CardType.ACTIVE,
      tags: [Tag.EARTH, Tag.SPACE],
      cost: 8,
      resourceType: CardResource.FIGHTER,
      requirements: {party: PartyName.UNITY},

      action: {
        addResources: ADDED,
      },

      metadata: {
        cardNumber: 'TR28',
        infoText: [
          // The printed rule runs far past the caption clamp in both languages.
          {kind: 'action-short', text: 'Add a fighter here; at 2, discard 2 for 1 TR', tokens: ['res-fighter']},
        ],
        renderData: CardRenderer.builder((b) => {
          // Three printed anchors in the result — the fighter that lands, the two that leave, the TR they buy:
          // the action commit's impulse and its tokens are measured off exactly these icons.
          b.action('Add 1 fighter to this card. If there are at least 2 fighters here, discard 2 of them to gain 1 TR.', (eb) => {
            eb.empty().startAction.resource(CardResource.FIGHTER).text(',')
              .minus().resource(CardResource.FIGHTER, {amount: DISCARDED, digit: true}).colon().tr(TR_GAINED);
          });
        }),
      },
    });
  }

  /**
   * THE ONE READING (rules 3, 6): what an activation does with `fightersHere` on
   * the card when it starts — asked by `actionPreview` and by the action itself,
   * both before the +1 lands.
   */
  public static activationAt(fightersHere: number): EarthArmyActivation {
    const added = fightersHere + ADDED;
    const converts = added >= DISCARDED;
    return {before: fightersHere, added, discarded: converts ? DISCARDED : 0, tr: converts ? TR_GAINED : 0};
  }

  public override bespokeAction(player: IPlayer) {
    const activation = EarthArmyContract.activationAt(this.resourceCount);
    if (activation.discarded > 0) {
      // The executor has DEFERRED the declarative +1; queued behind it at the same priority, the discard runs
      // on the count the +1 left (rule 8).
      player.defer(() => {
        this.discardForTr(player, activation);
        return undefined;
      });
    }
    return undefined;
  }

  /** Rule 3's second half: exactly two fighters off this card, then the TR they buy (rules 5, 11). */
  private discardForTr(player: IPlayer, activation: EarthArmyActivation): void {
    player.removeResourceFrom(this, activation.discarded, {log: false});
    player.game.log('${0} discarded ${1} ${2} from ${3} to gain ${4} TR', (b) =>
      b.player(player).number(activation.discarded).cardResource(CardResource.FIGHTER).card(this).number(activation.tr));
    player.increaseTerraformRating(activation.tr);
  }

  /**
   * The composer's chips in the PRINTED order — the fighter that lands (`c → c + 1`),
   * the two that leave (`c + 1 → c − 1`: the spend starts from the count the +1
   * left, never `c → c − 2`), the TR — or the +1 alone (rule 3).
   */
  public actionPreview(player: IPlayer): ActionPreview {
    const activation = EarthArmyContract.activationAt(this.resourceCount);
    const effects: Array<ActionEffect> = [actionPreviews.cardGain(this, ADDED)];
    if (activation.discarded > 0) {
      effects.push(actionPreviews.cardCost(this, activation.discarded, activation.added), actionPreviews.trGain(player, activation.tr));
    }
    return actionPreviews.singleBranch(this, player, [], effects);
  }
}
