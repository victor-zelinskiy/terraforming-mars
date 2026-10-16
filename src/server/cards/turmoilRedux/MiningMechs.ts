import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';
import {digit} from '../Options';

/** The play's own block — «4 [mech]»: «Add 4 mech resources to this card». */
export const MECHS_ON_PLAY = 4;
/** The action's ONE price — «[mech] [mech] →», both variants pay it. */
export const MECHS_PER_STEP = 2;
/** The two variants' prompt titles (the `OrOptions` options when both are live). */
export const MINING_MECHS_STEEL_TITLE = 'Spend 2 mechs from here to increase your steel production 1 step';
export const MINING_MECHS_TITANIUM_TITLE = 'Spend 2 mechs from here to increase your titanium production 1 step';

/**
 * TR57 — MINING MECHS («Горные мехи»), a Turmoil Redux PROJECT card: the
 * Industrialists' fifth plate (TR54, TR55, TR56 before it) and the set's
 * EIGHTH mech holder — TR40 Forestry Mechs with one price and two goods. The
 * play stocks the card (4 mechs); the action turns 2 of them into one step of
 * steel OR titanium production. Both variants share the price, so they are
 * live together or dead together — the class's first `or` whose branches
 * differ ONLY in the good. The whole action is ONE DECLARATION of the Local
 * Shading class — `action: {or: {behaviors: [steel, titanium], autoSelect:
 * true}}` — so nothing of the action lives in this file: no `canAct`, no
 * `action()`, no reason of its own.
 *
 * «Requires the Industrialists to be ruling or that you have 2 delegates
 * there. Add 4 mech resources to this card. Action: Spend 2 mechs from here to
 * increase your steel or titanium production 1 step.» Cost 7, blue, Building,
 * no VP.
 *
 * SCAN READING — cost 7, blue (ACTIVE); ONE tag in the corner: the house on
 * brown (Building). The orange MIN box beside the cost holds the
 * INDUSTRIALISTS' emblem (the cog round the globe) — a REQUIREMENT (`{party:
 * INDUSTRIALISTS}`), never a tag. ONE action row: «[mech] [mech] → [steel in
 * the brown production box] OR [titanium in the brown production box]» — the
 * price printed ONCE, two outcomes after the arrow (Asteroid Rights' second
 * row is the face's model: one price, `.or()` between the goods); the text:
 * «(Action: Spend 2 mechs from here to increase your steel or titanium
 * production 1 step.)». The bottom block: «4 [mech]» and «(Requires the
 * Industrialists to be ruling or that you have 2 delegates there. Add 4 mech
 * resources to this card.)». No VP badge. Only the module's icon at the bottom
 * left (no ▲, no Venus icon): no `compatibility`. Printed lore: «The miners get
 * routinely caught playing Gacha games on their mechs.» (`lore_texts.json`
 * «TR57»; the art: Lumer_B).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/MiningMechs.spec.ts):
 *  1. The REQUIREMENT is the Industrialists' plate — they rule, or 2 of the
 *     player's OWN delegates on their resolution — checked at the PLAY only
 *     (the TR15 class); the action works whoever rules later. TR36 Council
 *     Seat lowers the EFFECT's threshold, never a REQUIREMENT's.
 *  2. The PLAY puts 4 mechs on THIS card (`behavior: {addResources: 4}` — a
 *     fixed self-target, the auto-select exemption), at once, and nothing
 *     else; the journal names the four.
 *  3. ONE action, two variants in the printed order: steel, then titanium —
 *     each 2 mechs off here → +1 step of its production. Both live → an
 *     `OrOptions` marked `effect-choice` with this card as its giver; they
 *     share the price, so they are never live apart; with 0–1 mech the action
 *     is unavailable and the card-level reason is ONE blocker with the count
 *     (rule 9 — the two variants' identical reasons collapse). Once per
 *     generation, as any blue card's action.
 *  4. Mechs from OTHER cards: TR56 Robotics Factory may put its 3 mechs HERE
 *     (this card is a mech holder in its address set), as every generic «mech
 *     to any card» may (Vesta, TR29's B); the mechs here are fuel for the
 *     action only — nobody's money (`mechs` / `constructionMechs` read EVA /
 *     Construction Mechs), nobody's VP (Mech Sports scores its own).
 *  5. The Building tag: Construction Mechs PAYS for this card with its mechs
 *     (the `constructionMechs` unit — never EVA's, no Space tag); the other
 *     answers to a Building tag are their own hooks (the forecast names them).
 *  6. The table's answer to the production step — the Industrialists' effect
 *     on a steel / titanium production gain, or any card that answers it — is
 *     what the server forecasts (`EffectForecast`), no number of this file's.
 *  7. Preview = execution: the declaration feeds the play preview, the action
 *     preview (two branches, one price chip each), the reasons and the
 *     forecast; the printed row splits by its «OR» into the two variants'
 *     prints.
 *  8. Futility: a production step is never futile — the action is never
 *     flagged as an action without effect.
 *  9. The «too few mechs» reason is the CLASS's (PL-197): «1 of 2 mechs on
 *     this card» — the count, the need and the resource named, from
 *     `actionReasons.resourcesHereShort`.
 * 10. MarsBot never plays the card; save / load — an ordinary card (the mech
 *     count and the used-action flag survive); the previews are pure.
 */
export class MiningMechs extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.MINING_MECHS,
      type: CardType.ACTIVE,
      tags: [Tag.BUILDING],
      cost: 7,
      requirements: {party: PartyName.INDUSTRIALISTS},
      resourceType: CardResource.MECH,

      behavior: {
        addResources: MECHS_ON_PLAY,
      },

      action: {
        or: {
          behaviors: [
            {
              spend: {resourcesHere: MECHS_PER_STEP},
              production: {steel: 1},
              title: MINING_MECHS_STEEL_TITLE,
            },
            {
              spend: {resourcesHere: MECHS_PER_STEP},
              production: {titanium: 1},
              title: MINING_MECHS_TITANIUM_TITLE,
            },
          ],
          autoSelect: true,
        },
      },

      metadata: {
        cardNumber: 'TR57',
        // The full rule is 79 (RU ≈ 95) — over the browser's caption budget (52); the short stands beside its own row.
        infoText: [{kind: 'action-short', text: 'Spend 2 mechs for 1 steel or titanium production', tokens: ['production(steel)']}],
        renderData: CardRenderer.builder((b) => {
          // The scan's one action row — «[mech] [mech] → [steel production] OR [titanium production]»: the price ONCE,
          // the two goods after the arrow (Asteroid Rights' row); then the play's own block, «4 [mech]», under the art.
          b.action('Spend 2 mechs from here to increase your steel or titanium production 1 step.', (eb) => {
            eb.resource(CardResource.MECH, MECHS_PER_STEP)
              .startAction.production((pb) => pb.steel(1))
              .or()
              .production((pb) => pb.titanium(1));
          }).br;
          b.resource(CardResource.MECH, {amount: MECHS_ON_PLAY, digit});
        }),
        description: 'Requires the Industrialists to be ruling or that you have 2 delegates there. Add 4 mech resources to this card.',
      },
    });
  }
}
