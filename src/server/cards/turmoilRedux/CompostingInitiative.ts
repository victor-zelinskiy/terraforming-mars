import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {AltSecondaryTag} from '../../../common/cards/render/AltSecondaryTag';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';
import {all, digit} from '../Options';

/** The printed action's price — microbes spent from THIS card. */
export const MICROBES_PER_ACTION = 2;
/** The printed action's reward — heat into the stock. */
export const HEAT_PER_ACTION = 6;

/**
 * TR45 — COMPOSTING INITIATIVE («Компостная инициатива»), a Turmoil Redux
 * PROJECT card: the Greens' seventh plate (TR38–TR43 before it), a microbe
 * holder whose play is COUNTED off the board — «1 microbe for each tile on
 * Mars», of ANY player — and whose action buys heat with them.
 *
 * «Requires the Greens to be ruling or that you have 2 delegates there. Add 1
 * microbe resource to this card for each tile on Mars. Action: Spend 2
 * microbes from here to gain 6 heat.» Cost 8, blue, Microbe + Building, no VP.
 *
 * The whole card is TWO LINES OF DECLARATION. The play's count is the census
 * of tiles on Mars (`common/boards/marsTileCensus.ts`, the `tiles` countable —
 * the shared layer this card brought): the number, its composition by kind,
 * what it names and does not count, and the cells the board peek lights are
 * ONE reading, read by the executor, the preview's basis, the journal's basis
 * and the hand's forecast plate alike. The action is the TR38 class
 * (`{spend: {resourcesHere}, stock}`) — the holder's role «2 → 6 heat» is
 * derived by `holderActionGood`. Nothing else lives here.
 *
 * SCAN READING — cost 8, blue (ACTIVE). Two tags in the corner, in this order:
 * the microbe (light green) and the Building roof (brown — TR14 / TR40's).
 * The orange MIN plate beside the cost holds the GREENS' emblem (the tree):
 * the REQUIREMENT (`{party: GREENS}`), never a tag. The upper field is the
 * ACTION: TWO microbe icons (two icons, not «2×»), the red arrow, the digit 6
 * and ONE heat icon. The lower field is the on-play row: «[microbe] / [a white
 * hex in the orange-red «any player» frame with a pink hex corner]» — «1
 * microbe per tile ON MARS (the corner, `AltSecondaryTag.MARS_TILE` — TR14's)
 * of ANY player (the frame, `{all}`)». No VP badge. Only the module's icon at
 * the bottom left (the purple diamond with the arrow): no `compatibility`.
 * Printed lore: «Fortunately, lots of people brought their stinky bin habit
 * from Earth.» (`lore_texts.json` «TR45»). The art credit «Helios, For All
 * Mankind» is the scan's caption, not part of the face.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/CompostingInitiative.spec.ts):
 *  1. The REQUIREMENT is the Greens' plate (the TR15 / TR38 / TR43 class): the
 *     Greens rule (the starting rule counts) or 2 of the player's OWN
 *     delegates stand on their resolution — checked at the play only; TR36
 *     lowers an EFFECT's threshold, never a requirement's.
 *  2. «A tile on Mars» is every PHYSICAL tile standing on a cell of the Mars
 *     grid, of ANY owner — the player's, a rival's, MarsBot's, the solo
 *     neutral's, an ownerless ocean. Counted: cities (the Capital, Red City),
 *     greeneries (Wetlands), oceans (Ocean Farm, Ocean Sanctuary), special
 *     tiles. A STACK of N tiers (Skyscrapers, RX20) is N tiles (the stack's own
 *     law); an UPGRADED ocean (Ocean City, Ocean Farm, Ocean Sanctuary, New
 *     Holland) is ONE tile (the owner's decision, 2026-10-12 — the engine
 *     keeps one, TR39 never moves it as an ocean). NOT counted, and NAMED
 *     before the press: off-board cells (Ganymede, Phobos, the Venus cities,
 *     TR27 Aurora Station, TR22 Nova City), Ares hazards («not really tiles»),
 *     neutral cubes (Martian Nature Wonders, Rey Skywalker); a marker with no
 *     tile (Land Claim, the nomads' camp) and the Moon count nothing.
 *  2-bis. TR44 forward: a city ON TOP of an ocean (the rulebook FAQ p.18) is
 *     two tiles on one cell — the census's `marsTilePiecesOn` takes it in one
 *     line (TR44's checklist carries the row).
 *  3. Counted ONCE, at the play: tiles placed later add nothing; on the table
 *     the card is an ordinary microbe holder.
 *  4. ZERO is a rule, not a loss (the TR23 class): no tile on Mars → +0
 *     microbes, the card is still playable, no warning, no skip event; the
 *     zero is NAMED before the press. Solo: the neutral cities and their
 *     greeneries count — N ≥ 4 from the first turn.
 *  5. The microbes are ORDINARY microbes of this card: «microbes to ANY card»
 *     land here (TR43, Vermin, the Scientists' action); never a payment unit.
 *  6. The ACTION is declarative: spend 2 microbes FROM HERE → +6 heat to the
 *     stock; once per generation; below 2 microbes the automatic reason «Not
 *     enough resources on this card» (with the count).
 *  7. REACTIONS are the engine's and nothing of them is programmed here: the
 *     Microbe tag wakes Decomposers (+1 microbe), TR38 Biological Simulations
 *     (+1 data) and Splice (its owner +2 M€; the PLAYER is asked «1 microbe on
 *     THIS card, or 2 M€» — the forecast names the question, the card may end
 *     on N + 1); the N microbes wake Topsoil Contract (+N M€ — the largest
 *     counted answer of the set); the Building tag lets steel pay.
 *  8. THE JOURNAL: «added 25 microbes to Composting Initiative — for 25 tiles
 *     on Mars» (the executor's `countedResourceBasis`).
 *  9. MarsBot never plays the card (its deck is tags); its tiles ARE counted.
 * 10. Save / load: nothing new — the microbe count and the action's
 *     once-per-generation flag serialize as on every holder.
 */
export class CompostingInitiative extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.COMPOSTING_INITIATIVE,
      type: CardType.ACTIVE,
      tags: [Tag.MICROBE, Tag.BUILDING],
      cost: 8,
      requirements: {party: PartyName.GREENS},
      resourceType: CardResource.MICROBE,

      // Rule 2 — the census: every physical tile on the Mars grid, of every owner.
      behavior: {
        addResources: {tiles: {where: 'onmars'}, all: true},
      },

      // Rule 6 — the TR38 class.
      action: {
        spend: {resourcesHere: MICROBES_PER_ACTION},
        stock: {heat: HEAT_PER_ACTION},
      },

      metadata: {
        cardNumber: 'TR45',
        infoText: [
          // The full rule is 42 (RU 57) — over the action browser's caption budget.
          {kind: 'action-short', text: 'Spend 2 microbes for 6 heat'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.action('Spend 2 microbes from here to gain 6 heat.', (eb) => {
            eb.resource(CardResource.MICROBE, MICROBES_PER_ACTION).startAction.heat(HEAT_PER_ACTION, {digit});
          }).br;
          b.resource(CardResource.MICROBE).slash().emptyTile('normal', {all, secondaryTag: AltSecondaryTag.MARS_TILE});
        }),
        description: 'Requires the Greens to be ruling or that you have 2 delegates there. Add 1 microbe resource to this card for each tile on Mars.',
      },
    });
  }
}
