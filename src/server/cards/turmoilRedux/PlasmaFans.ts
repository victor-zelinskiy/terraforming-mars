import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';

/** The play's own block — «Increase your heat production 3 steps» (the printed generation-1 chairman quest, closed by ONE play). */
export const HEAT_PRODUCTION_ON_PLAY = 3;
/** The action's price — 8 heat off the rail (Caretaker Contract's row, word for word). */
export const HEAT_PER_VENUS_STEP = 8;

/**
 * TR41 — PLASMA FANS («Плазменные вентиляторы»), a Turmoil Redux PROJECT
 * card: the set's FOURTH plate of the Greens (TR38, TR39, TR40) and its
 * SECOND Venus card (TR24 Venusian Census — `compatibility: 'venus'`). The
 * whole card is ONE DECLARATION of two classes that already live in the
 * engine: the PRICE is Caretaker Contract's («spend 8 heat» — `spend: {heat:
 * 8}`, the rail row the console pays off first) and the REWARD is
 * Thermophiles' («raise Venus 1 step» — `global: {venus: 1}`); the play is a
 * plain production block. So nothing of the card lives in this file: no
 * `canAct`, no `action()`, no reason of its own — the Venus ceiling (30 %)
 * refuses the action in `Executor.canExecute`, the heat in the automatic
 * «Not enough heat».
 *
 * «Requires the Greens to be ruling or that you have 2 delegates there.
 * Increase your heat production 3 steps. Action: Pay 8 heat to terraform
 * Venus 1 step.» Cost 8, blue, Venus, no VP.
 *
 * SCAN READING — cost 8, blue (ACTIVE); one tag in the corner: the blue disc
 * with the «V» (Venus). The orange MIN box beside the cost holds the GREENS'
 * emblem — a REQUIREMENT (`{party: GREENS}`), never a tag. One action row:
 * «8 [heat] → [the Venus gauge]» with the text «(Action: Pay 8 heat to
 * terraform Venus 1 step.)». The bottom block: the brown production box
 * with «3 [heat]» and «(Requires the Greens to be ruling or that you have 2
 * delegates there. Increase your heat production 3 steps.)». No VP badge.
 * Bottom left: the Venus Next icon (`compatibility: 'venus'` — rulebook p.8:
 * without Venus Next the card leaves the deck) and the module's own icon
 * (the module is the gate — never `compatibility: 'turmoil'`, see TR02).
 * Printed lore: «"You can't blow against the wind." Not with that attitude!»
 * (`lore_texts.json` «TR41»; the art: Metaversalarts).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/PlasmaFans.spec.ts):
 *  1. The REQUIREMENT is the Greens' plate — the Greens rule (the STARTING
 *     RULE counts: with nothing enacted the Greens rule in generation 1), or
 *     2 of the player's OWN delegates on their resolution — checked at the
 *     PLAY only (the TR15 class); the action works whoever rules later. TR36
 *     Council Seat lowers the EFFECT's threshold, never a REQUIREMENT's.
 *  2. The PLAY raises heat production by 3 (`behavior: {production: {heat:
 *     3}}`) and nothing else. With the Greens' effect at the moment of the
 *     play (ruling, 2 delegates, TR36's one) the Parliament raises M€
 *     production by the applied delta — ONE call of 3 (`PartyEffects` →
 *     `onProductionChanged`); without it, nothing. The play's forecast names
 *     «+3 M€ production · the Greens» before the press (`greens-production`).
 *     The printed generation-1 chairman quest («raise your heat production 3
 *     steps», `STARTER_QUEST`) is reported by the engine's production door
 *     and COMPLETED BY THIS ONE PLAY: progress 0 → 3, the office (`chairman`)
 *     and one Agenda step behind the `BACK_OF_THE_LINE` gate (TR04 rule 7 —
 *     after the landing, never over it). A quest another player already
 *     completed moves nothing. The play in the action phase, the player's own
 *     action, counts (rulebook p.9).
 *  3. THE ACTION: 8 heat → Venus +1 step (+2 %). Available iff heat ≥ 8 AND
 *     Venus < 30 % (both of the declaration's own gates). The heat is NEVER
 *     taken at the ceiling — `canAct` is false before any spend. Both dead →
 *     the card-level reasons come from the declaration in its own order: the
 *     heat («Not enough heat», with the count) FIRST — the one blocker the
 *     player can act on — then the parameter ceiling.
 *  4. The Venus step is an ORDINARY global-parameter step (`Game.
 *     increaseVenusScaleLevel`): +1 TR `{global: true}` (the «parameters»
 *     segment of the rating); crossing 8 % draws a card whose source is the
 *     SCALE (`{type: 'globalParameter', parameter: VENUS}` — the console
 *     lifts the cover off the 8 % marker); crossing 16 % pays one more TR
 *     (`venusTrackBonus` — the «cards & effects» segment); the Greens pay 2 M€
 *     per TR step gained — 2 for a plain step, 4 across 16 %; TR24 Venusian
 *     Census +2 data and Aphrodite +2 M€ in whosever tableau they stand
 *     (`onGlobalParameterRaised`); the Alt Venus Board pays its own bonus.
 *     Never in the Solar phase (the action lives in the action phase).
 *  5. The Venus tag is an ordinary tag (other cards' Venus-tag requirements,
 *     RX12's «play 2 Venus tags» quest, the Venus awards / milestones);
 *     `compatibility: 'venus'` — without Venus Next the card is not dealt.
 *  6. The standard HEAT CONVERSION (8 heat → +1 temperature) is untouched:
 *     the two 8-heat spends coexist, each with its own availability.
 *  7. Once per generation, as any blue card's action.
 *  8. Save / load: the used-action flag survives.
 *  9. MarsBot never plays the card.
 * 10. The journal: «−8 heat» (the price's own line), «Venus +1 step» / «+1
 *     TR», the Greens' answer as ITS line, the 8 % draw under the SCALE's
 *     source — all under the card's source.
 */
export class PlasmaFans extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.PLASMA_FANS,
      type: CardType.ACTIVE,
      tags: [Tag.VENUS],
      cost: 8,
      requirements: {party: PartyName.GREENS},

      behavior: {
        production: {heat: HEAT_PRODUCTION_ON_PLAY},
      },

      action: {
        spend: {heat: HEAT_PER_VENUS_STEP},
        global: {venus: 1},
      },

      metadata: {
        cardNumber: 'TR41',
        renderData: CardRenderer.builder((b) => {
          // The action row as the scan prints it — «8 [heat] → [Venus]» (Caretaker Contract's price, Thermophiles' reward);
          // then the play's own block, the production box with «3 [heat]», under the art.
          b.action('Pay 8 heat to terraform Venus 1 step.', (eb) => {
            eb.heat(HEAT_PER_VENUS_STEP).startAction.venus(1);
          }).br;
          b.production((pb) => pb.heat(HEAT_PRODUCTION_ON_PLAY));
        }),
        description: 'Requires the Greens to be ruling or that you have 2 delegates there. Increase your heat production 3 steps.',
      },
    });
  }
}
