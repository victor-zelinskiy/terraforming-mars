import {IProjectCard} from '../IProjectCard';
import {IActionCard, IHasCheckLoops} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {Resource} from '../../../common/Resource';
import {PartyName} from '../../../common/turmoil/PartyName';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {HolderActionGood} from '../../../common/cards/holderRole';
import {CardRenderer} from '../render/CardRenderer';
import {PlayerInput} from '../../PlayerInput';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {SelectCard} from '../../inputs/SelectCard';
import {cardSource, effectChoice} from '../../inputs/choiceContext';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {repeatableActionCards} from '../repeatableActions';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

/** Variant A — 1 energy buys 1 mech on ANY own holder (the TR09 / TR40 row, the TR56 / TR43 target). */
export const ENERGY_PER_MECH = 1;
/** Variant B — 1 mech off here buys the REPEAT of an already-used action of one of the player's cards. */
export const MECHS_PER_REPEAT = 1;
/** Variant A's prompt title (new — the row ends «to ANY card», unlike TR09 / TR40's «to this card»). */
export const CARGO_MECHS_ADD_TITLE = 'Pay 1 energy to add a mech resource to ANY card';
/** Variant B's prompt title — VIRON'S OWN KEY, word for word (the repeat family speaks one language). */
export const CARGO_MECHS_REPEAT_TITLE = 'Perform again an action from a played card';
/** B's reason when a mech is here but nothing of the player's was used this generation — Viron's key. */
export const CARGO_MECHS_NO_CANDIDATE = 'No other action card to copy';

/**
 * TR61 — CARGO MECHS («Грузовые мехи»), a Turmoil Redux PROJECT card: the
 * INDUSTRIALISTS' plate and the set's NINTH mech holder — and the FIFTH
 * CONSUMER of the repeat-action mechanism (Viron, Project Inspection, R&D
 * Funding RX26, the Hydronetwork's stage 7 before it): «1 energy → a mech onto
 * ANY card, OR 1 mech from here → perform an action of one of your cards a
 * SECOND time this generation». Nothing of the repeat lives in this file
 * beyond the price: the candidates are `repeatableActionCards` (the module's
 * four conditions), the prompt is Viron's `SelectCard` with the structural
 * `repeatActionPrompt` marker, the run is `withCopiedAction` — the console
 * routes the pick through the ONE repeat-pick bridge (`consoleRepeatPick`), so
 * the card is a fifth consumer, never a fifth interface.
 *
 * «Requires the Industrialists to be ruling or that you have 2 delegates
 * there. Action: Pay 1 energy to add a mech resource to ANY card, OR spend 1
 * mech from here to use an action on one of your cards a second time this
 * generation.» Cost 7, blue, Building, no VP, no play block.
 *
 * SCAN READING — a blue frame, cost 7; ONE tag in the corner, the building on
 * brown. The orange MIN plate beside the cost holds the INDUSTRIALISTS' emblem
 * — a REQUIREMENT (`{party: INDUSTRIALISTS}`), never a tag. Two action rows:
 * «[energy] → [mech]*» (the asterisk: onto ANY card) and «OR [mech] → [ACTION
 * plate]» — the printed «repeat an action» (`b.replayAction()`, the sprite
 * Project Inspection prints); the text: «(Action: Pay 1 energy to add a mech
 * resource to ANY card, OR spend 1 mech from here to use an action on one of
 * your cards a second time this generation.)». The bottom block: «(Requires
 * the Industrialists to be ruling or that you have 2 delegates there.)» — the
 * play does nothing else. No VP badge. Only the module's icon at the bottom
 * left: no `compatibility`. Printed lore: «"Too late! I'm forklift-certified!"»
 * (`lore_texts.json` «TR61»; the art: Ken Le Bras).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/CargoMechs.spec.ts):
 *  1. The REQUIREMENT is the Industrialists' plate (the TR15 class): they rule,
 *     or 2 of the player's OWN delegates stand on their resolution — checked at
 *     the PLAY only; the action works whoever rules later. TR36 Council Seat
 *     lowers an EFFECT's threshold, never a REQUIREMENT's.
 *  2. The PLAY does nothing (no `behavior`): the card enters as an EMPTY mech
 *     holder — A is how it fills (onto itself included).
 *  3. A — «1 energy → a mech onto ANY card»: the price is `energy` in stock;
 *     the target is any own mech holder, THIS CARD INCLUDED (`AddResourcesToCard`
 *     lists every holder of the kind — that is how B's fuel arrives), asked
 *     ALWAYS (`autoSelect: false` — invariant 3: one holder is still a
 *     question the player sees); without energy the reason is the class's
 *     `notEnoughEnergy`.
 *  4. B — «1 mech from here → repeat an action» is VIRON'S MECHANISM WORD FOR
 *     WORD: the candidates are `repeatableActionCards(player, this)` (not this
 *     card, has an action, not a loop trap, USED this generation AND can act
 *     now); the prompt is Viron's `SelectCard` title + verb, marked
 *     `repeatActionPrompt` (structural recognition — RX26's lesson); the mech
 *     leaves FIRST as the branch's price (its own journal line), then the copy
 *     runs INSIDE `withCopiedAction(player, this, card, …)` with Viron's log
 *     «used X action with Y». Both variants dead → the reasons come in the
 *     declared order, A's first (the energy — the one blocker the player can
 *     act on); B alone dead → «0 of 1 mech on this card» (PL-197) with a mech
 *     missing, else Viron's «No other action card to copy».
 *  5. The card never repeats ITSELF (the module's first condition, as Viron) —
 *     the loop «mech → repeat A → mech → …» is impossible by construction; the
 *     repeat itself is this blue card's once-a-generation action.
 *  6. THE LOOP GUARD: `Viron.canAct` → `repeatableActionCards(player, Viron)` →
 *     `CargoMechs.canAct` → `repeatableActionCards(player, CargoMechs)` →
 *     `Viron.canAct` → … recurses without end once both are used in one
 *     generation. This card implements `IHasCheckLoops` (`getCheckLoops`, the
 *     counter raised around EVERY read of the candidate list, in `try` /
 *     `finally` — Playwrights' pattern): the module excludes a card standing 2
 *     checks deep, and ONE counter on the pair terminates the mutual recursion
 *     at depth three (Viron needs none of its own — the spec drives both
 *     directions on one table).
 *  7. ATTRIBUTION: everything the copy produces is recorded under the
 *     `copied-action` scope — the chain «Cargo Mechs → the copied card → its
 *     gains» in the journal, the «Copied action» notification, Viron's statistics.
 *  8. PREVIEW = EXECUTION: `orBranches(this, [A, B])` — A carries the energy's
 *     stock cost, the mech's gain and the target step (`addToCardStep`, the
 *     same `AddResourcesToCard` the action defers); B carries the mech's price
 *     off this card and Viron's `selectCardStep(…, {repeatAction: true})`, the
 *     console's door into the repeat pick; a lone live variant auto-resolves
 *     (`OrOptions.reduce()`'s exemption).
 *  9. THE HOLDER'S ROLE (К-R1, a bespoke action declares its own): the mechs
 *     here buy a REPEAT — `{spend: 1, good: {kind: 'repeat'}}`, the ДОП.
 *     РЕСУРСЫ satellite's and the TR56 target step's reading of what a mech
 *     does on this card.
 * 10. Mechs from elsewhere land here like on any holder (TR56 Robotics Factory's
 *     address, TR29 / Vesta's «any card»); EVA / Construction Mechs never pay
 *     with these; Mech Sports never scores them. The Building tag lets
 *     Construction Mechs pay the PLAY in mechs (the `constructionMechs` unit).
 * 11. MarsBot never plays the card; save / load keeps the mech count and the
 *     used-action flag; the loop counter is TRANSIENT (never serialized).
 */
export class CargoMechs extends Card implements IProjectCard, IActionCard, IHasCheckLoops {
  constructor() {
    super({
      name: CardName.CARGO_MECHS,
      type: CardType.ACTIVE,
      tags: [Tag.BUILDING],
      cost: 7,
      requirements: {party: PartyName.INDUSTRIALISTS},
      resourceType: CardResource.MECH,

      metadata: {
        cardNumber: 'TR61',
        // B's full rule is 95 characters (RU ≈ 110) — far over the browser's caption budget (52); the short names the
        // repeat in the words Project Inspection's block uses, with the printed ACTION plate as its token.
        infoText: [{kind: 'action-short', text: 'Spend 1 mech to repeat a used action', tokens: ['action-replay']}],
        renderData: CardRenderer.builder((b) => {
          // The two action rows as the scan prints them — «[energy] → [mech]*» / OR / «[mech] → [ACTION]» (each row
          // describes itself — the TFLP / DP11 contract; the asterisk is the «ANY card» of the first row).
          b.action('Pay 1 energy to add a mech resource to ANY card.', (eb) => {
            eb.energy(ENERGY_PER_MECH).startAction.resource(CardResource.MECH).asterix();
          }).br;
          b.or().br;
          b.action('Spend 1 mech from here to use an action on one of your cards a second time this generation.', (eb) => {
            eb.resource(CardResource.MECH, MECHS_PER_REPEAT).startAction.replayAction();
          });
        }),
        description: 'Requires the Industrialists to be ruling or that you have 2 delegates there.',
      },
    });
  }

  /** Rule 9 — the mechs here buy a REPEAT of a used action (К-R1: a bespoke action declares its good once, here). */
  public readonly holderActionGood: HolderActionGood = {spend: MECHS_PER_REPEAT, good: {kind: 'repeat'}};

  // Rule 6 — the loop guard (`IHasCheckLoops`): how deep this card currently stands in a candidate check.
  private checkLoops = 0;

  public getCheckLoops(): number {
    return this.checkLoops;
  }

  /** THE candidates of B — the module's one reading, counted as a check (rule 6). */
  private repeatCandidates(player: IPlayer) {
    this.checkLoops++;
    try {
      return repeatableActionCards(player, this);
    } finally {
      this.checkLoops--;
    }
  }

  /** THE mech target of A (rule 3) — the one construction the preview and the action both ask. */
  private mechTarget(player: IPlayer): AddResourcesToCard {
    return new AddResourcesToCard(player, CardResource.MECH, {count: 1, autoSelect: false, cause: cardSource(this)});
  }

  /** A is live: the energy is there, and a holder (this card at least) can take the mech. */
  private canAddMech(player: IPlayer): boolean {
    return player.energy >= ENERGY_PER_MECH && this.mechTarget(player).getCards().length > 0;
  }

  /** Why B is NOT live (rule 4's order: the mech here, then a candidate) — undefined when it is. */
  private repeatReason(player: IPlayer): UnplayableReason | undefined {
    if (this.resourceCount < MECHS_PER_REPEAT) {
      return reason.resourcesHereShort(CardResource.MECH, this.resourceCount, MECHS_PER_REPEAT);
    }
    if (this.repeatCandidates(player).length === 0) {
      return reason.ruleReason(CARGO_MECHS_NO_CANDIDATE);
    }
    return undefined;
  }

  public canAct(player: IPlayer): boolean {
    return this.canAddMech(player) || this.repeatReason(player) === undefined;
  }

  /** Rule 4 — both dead: the reasons in the declared order, A's first (the energy is the blocker the player can act on). */
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.canAct(player)) {
      return undefined;
    }
    return player.energy < ENERGY_PER_MECH ? reason.notEnoughEnergy() : this.repeatReason(player);
  }

  /**
   * The action: A when its price is covered, B when its reason is clear. One
   * live option IS the action (the batch replay folds it); two are an
   * `OrOptions` marked with this card as its giver; none — nothing (`canAct`
   * already said so).
   */
  public action(player: IPlayer): PlayerInput | undefined {
    const options: Array<SelectOption> = [];
    if (this.canAddMech(player)) {
      options.push(new SelectOption(CARGO_MECHS_ADD_TITLE, 'Add resource').andThen(() => {
        // The price leaves first, the mech lands after — the target is asked always (rule 3).
        player.stock.deduct(Resource.ENERGY, ENERGY_PER_MECH, {log: true, from: {card: this}});
        player.game.defer(this.mechTarget(player));
        return undefined;
      }));
    }
    if (this.repeatReason(player) === undefined) {
      options.push(new SelectOption(CARGO_MECHS_REPEAT_TITLE, 'Take action').andThen(() => this.repeatPrompt(player)));
    }
    if (options.length === 0) {
      return undefined;
    }
    if (options.length === 1) {
      return options[0].cb(undefined);
    }
    return new OrOptions(...options).markChoiceContext(effectChoice(this));
  }

  /** Rule 4 — Viron's prompt, Viron's run; the mech is the branch's PRICE and leaves before the copy. */
  private repeatPrompt(player: IPlayer): PlayerInput {
    return new SelectCard(CARGO_MECHS_REPEAT_TITLE, 'Take action', this.repeatCandidates(player))
      .markRepeatActionPrompt()
      .andThen(([card]) => {
        // CHECK → PAY → RUN in one handler: a mech gone between the ask and the answer means no copy and no charge
        // («paid and did nothing» is impossible by construction — the TR34 census discipline).
        if (this.resourceCount < MECHS_PER_REPEAT) {
          return undefined;
        }
        player.removeResourceFrom(this, MECHS_PER_REPEAT);
        // Analytics: the `copied-action` scope attributes the copied card's impact to CARGO MECHS (the chain
        // «Cargo Mechs → the copied card → its gains»); Viron's «used X action with Y» log heads the group.
        const events = player.game?.events;
        const run = () => {
          player.game.log('${0} used ${1} action with ${2}', (b) => b.player(player).card(card).card(this));
          return card.action(player);
        };
        return events !== undefined ? events.withCopiedAction(player, this, card, run) : run();
      });
  }

  /**
   * Rule 8 — the preview mirrors the action: A's stock price, the mech's gain
   * and ITS target step; B's mech price off this card and Viron's repeat step
   * (the console's door into the repeat pick). A refused variant is SHOWN beside
   * the live one with its reason, never hidden.
   */
  public actionPreview(player: IPlayer): ActionPreview {
    const addLive = this.canAddMech(player);
    const repeatWhy = this.repeatReason(player);
    const candidates = repeatWhy === undefined ? this.repeatCandidates(player) : [];
    return actionPreviews.orBranches(this, [
      {
        available: addLive,
        title: CARGO_MECHS_ADD_TITLE,
        effects: [
          actionPreviews.stockCost(player, Resource.ENERGY, ENERGY_PER_MECH),
          actionPreviews.cardResourceGain(CardResource.MECH, 1),
        ],
        steps: addLive ? [actionPreviews.addToCardStep(player, CardResource.MECH, {count: 1, cause: cardSource(this)})] : [],
        unavailableReason: reason.notEnoughEnergy(),
      },
      {
        available: repeatWhy === undefined,
        title: CARGO_MECHS_REPEAT_TITLE,
        effects: [actionPreviews.cardCost(this, MECHS_PER_REPEAT)],
        steps: candidates.length > 0 ?
          [actionPreviews.selectCardStep(player, CARGO_MECHS_REPEAT_TITLE, 'Take action', candidates, {repeatAction: true})] :
          [],
        unavailableReason: repeatWhy,
      },
    ]);
  }
}
