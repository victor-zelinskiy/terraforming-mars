import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {ActivePreludeCard} from '../prelude2/ActivePreludeCard';
import {CardRenderer} from '../render/CardRenderer';

/** «Add 1 mech OR fighter resource to ANY card» — the printed kinds, in print order. */
export const AEROSPACE_COMPANY_KINDS: ReadonlyArray<CardResource> = [CardResource.MECH, CardResource.FIGHTER];

/**
 * TRP8 — AEROSPACE COMPANY («Аэрокосмическая компания»), the SECOND of the Turmoil Redux PRELUDES and the first one in
 * premium scope with an ACTION (upstream's `ActivePreludeCard`, `prelude2/` — no such card had stood on the console's
 * table before) and the first of the set's preludes with TAGS. Its own art and printed lore, both keyed TRP8 («Rest
 * assured that all lethal military androids have been taught to read…» — «Daniel Jakobi» on the art's edge is the
 * artist's credit, not the face).
 *
 * SCAN READING — the magenta PRELUDE plate; two tags in the corner, SPACE (the yellow star) and BUILDING (the brown
 * house); no cost, no requirement, no VP. ONE action frame: «→ [mech]* OR [fighter]*», each star the printed «to ANY
 * card»; the parenthesised text is the rule: «(Action: Add 1 mech or fighter resource to ANY card.)». Nothing else is
 * printed — the play itself lays the card down with its two tags and does nothing more. The purple diamond at the
 * left edge is the module itself; a Prelude is dealt only beside the Prelude expansion (`compatibility: 'prelude'` —
 * TRP1 / TR82's precedent), so Valley Trust's fallback deck never sees it.
 *
 * NOTHING NEW IS BUILT — the action is ONE declaration over a LIST of kinds: `addResourcesToAnyCard` with
 * `type: [MECH, FIGHTER]` (the DSL's `AddResource.type` takes the list — Medical Database's form). The shared step
 * (`AddResourcesToCard`) asks ONE pick over the UNION of the mech and fighter holders (tableau order, each once), the
 * marker names the kinds (`cardResources`) and every candidate's own (`cardResourceByCard`), and the unit's kind is
 * the CHOSEN card's — «mech or fighter?» is never a question before «where?».
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/AerospaceCompany.spec.ts):
 *  1. Printed: a PRELUDE (`ActivePreludeCard`), Space + Building, no play behavior, `compatibility: 'prelude'`.
 *  2. The play lays the card down: the two tags count, nothing is added, nothing is asked — a Prelude without a play
 *     effect is always playable (no gate → it never «burns»). Proteus beside it reads its tags like any prelude's.
 *  3. The action is available ⇔ the owner has a holder of mechs OR fighters (`mustHaveCard`): an ACTION that would do
 *     nothing is unavailable WITH the reason «No card to add the resource to», never a press that does nothing.
 *  4. The action asks ONE `SelectCard` over the union — even with one candidate (`autoSelect: false`, the Executor's
 *     law for «ANY card»); +1 of the CHOSEN card's kind (a mech on EVA Mechs, a fighter on Mars Army Ships). Own
 *     cards only (`getResourceCards`); Self-replicating Robots never (`robotCards` is not declared).
 *  5. The preview IS the execution (`declarative`): one chip «+1 mech / fighter to a card» (`ActionEffect.icons`), the
 *     pick as the same `AddResourcesToCard` asked twice.
 *  6. The card holds nothing: no `resourceType`, never its own candidate. The resource it adds belongs to the holder
 *     and obeys the holder's rules (EVA Mechs' space discount, Arwind's fighters, Mars Army Ships' delegates).
 *  7. Nothing to serialize beyond the card on the table and the generation's action flag; MarsBot is never dealt one.
 */
export class AerospaceCompany extends ActivePreludeCard {
  constructor() {
    super({
      name: CardName.AEROSPACE_COMPANY,
      tags: [Tag.SPACE, Tag.BUILDING],

      action: {
        addResourcesToAnyCard: {type: AEROSPACE_COMPANY_KINDS, count: 1, mustHaveCard: true},
      },

      metadata: {
        cardNumber: 'TRP8',
        infoText: [
          // The printed rule runs past the caption clamp in RU.
          {kind: 'action-short', text: 'A mech or a fighter to any card', tokens: ['res-mech', 'res-fighter']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.action('Add 1 mech or fighter resource to ANY card.', (eb) => {
            eb.empty().startAction.resource(CardResource.MECH).asterix().or().resource(CardResource.FIGHTER).asterix();
          });
        }),
      },
    });
  }
}
