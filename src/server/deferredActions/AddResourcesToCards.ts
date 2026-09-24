/*
 * DISTRIBUTE N UNITS OF A CARD RESOURCE OVER THE PLAYER'S HOLDERS — the ONE
 * shared step of the family («add 1 floater to any card per …, each resource
 * can go on a different card»), used by the project cards that spread a
 * payout (Cyanobacteria, Communication Boom) and by the Turmoil Redux
 * resolutions that do (Cloud Development, Medical Database, and the
 * distributing cards after them). One mechanism, two SHAPES of one step,
 * decided here and nowhere else:
 *
 * THE KINDS ARE A LIST. The step takes one kind (every caller before Medical
 * Database — the list of one, byte-identical behaviour) or SEVERAL («add 1
 * data or microbe resource to any card…»): the holders are then the UNION of
 * the holders of each kind, in tableau order, each once; the player lays the
 * units out over them exactly as over one kind; and the KIND OF EVERY UNIT IS
 * ITS CARD'S — a microbe holder takes microbes, a data holder data, a WARE
 * holder its own wildcard (its state is a counter, not a kind — the journal
 * names the card's resource). «Data or microbe» is therefore never a second
 * question to the player: the choice is made by WHERE the unit is put, and
 * the placement handed back names the kind beside the card and the amount.
 * The marker carries the kind each holder takes (`cardResourceByCard`) and
 * the kinds in their declared order (`cardResources`), so the layout's
 * counters and the reading of every card show what would land on IT.
 *
 *  · there is something to DISTRIBUTE only with N ≥ 2 AND ≥ 2 holders: the
 *    step then asks the DISTRIBUTION prompt — an `AndOptions` of one
 *    `SelectAmount` (0…N) per holder, stamped with the structural
 *    `cardResourceDistributionPrompt` marker (the faces, the sum, the VP
 *    reading of every amount a card could take), which is what the console
 *    serves on the card-target chassis in LAYOUT mode. The marker is the
 *    detection; the title is for the journal;
 *  · otherwise (N = 1, or ONE holder — all N go there) the step asks the
 *    ordinary CARD PICK of the family, `AddResourcesToCard` with the caller's
 *    `autoSelect` — the same `resourceGainPrompt` reading every add-to-card
 *    pick carries. `autoSelect: false` is this fork's «to ANY card» law: a
 *    single holder is SHOWN and confirmed, never applied behind the board
 *    (the resolutions pass it; the legacy project callers keep the upstream
 *    instant apply until they are migrated).
 *
 * The answer is VALIDATED BEFORE anything is applied: a sum other than N is an
 * `InputError` — the prompt stands, no card has changed — never a thrown
 * `Error` and never a partial payout. The units land through `addResourceTo`
 * (the ordinary triggers, the journal line per card), and the callback fires
 * ONCE with WHERE they landed, so a caller that records its outcome (the
 * parliament's enactment log) reads the whole list from one place.
 *
 * RESUMABLE by construction: building the prompt changes nothing; a reload
 * re-runs the caller, which builds the same prompt over the same holders.
 */
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {CardResource} from '../../common/CardResource';
import {CardName} from '../../common/cards/CardName';
import {Message} from '../../common/logs/Message';
import {SelectAmount} from '../inputs/SelectAmount';
import {AndOptions} from '../inputs/AndOptions';
import {InputError} from '../inputs/InputError';
import {PlayerInput} from '../PlayerInput';
import {ChoiceContextSource} from '../../common/models/PlayerInputModel';
import {message} from '../logs/MessageBuilder';
import {From} from '../logs/From';
import {cardsToModel} from '../models/ModelUtils';
import {AddResourcesToCard, cardResourceKinds, holderResourceIcons, holderResourceOf, holdsOneOf} from './AddResourcesToCard';
// Runtime-only calls (safe circular import: actionPreviews imports the
// deferred actions at top level; these are late-bound reads at prompt time).
import {cardResourceIcon, distributionVictoryPoints} from '../cards/actionPreviews';

export type Options = {
  /**
   * When `false`, NEVER apply silently even if only ONE holder exists — the
   * pick is shown and confirmed (the «to ANY card» law). Left undefined by
   * the legacy project callers, which keep the upstream instant apply.
   */
  autoSelect?: boolean;
  /** WHO caused this step — see `inputs/choiceContext.ts`. */
  cause?: ChoiceContextSource;
  /** The SOURCE the journal names for each addition (a cardless origin says so here). */
  from?: From;
  /** The title of the ordinary CARD PICK shape (N = 1, or one holder). */
  pickTitle?: string | Message;
  /** The title of the DISTRIBUTION shape (N ≥ 2 over ≥ 2 holders). */
  distributeTitle?: string | Message;
  /** Default true: each landing logs its own line through `addResourceTo`. */
  log?: boolean;
};

/**
 * WHERE the units landed: one entry per card that received any (in holder
 * order), with the KIND that card took — its own storage rule (`holderResourceOf`),
 * which is the unit's kind where the step spans several.
 */
export type ResourcePlacement = {card: ICard, amount: number, resource: CardResource};

export class AddResourcesToCards extends DeferredAction<ReadonlyArray<ResourcePlacement>> {
  /** THE KINDS the step spreads — a list, one kind being the list of one (see the file comment). */
  public readonly resourceTypes: ReadonlyArray<CardResource>;

  constructor(
    player: IPlayer,
    resourceType: CardResource | ReadonlyArray<CardResource>,
    public count: number,
    public options: Options = {}) {
    super(player, Priority.GAIN_RESOURCE_OR_PRODUCTION);
    const kinds = cardResourceKinds(resourceType) ?? [];
    if (kinds.length === 0) {
      throw new Error('AddResourcesToCards needs at least one card resource kind');
    }
    this.resourceTypes = kinds;
  }

  /** The ONE kind the step spreads when it spreads exactly one (every caller before Medical Database); undefined over several. */
  public get resourceType(): CardResource | undefined {
    return this.resourceTypes.length === 1 ? this.resourceTypes[0] : undefined;
  }

  /**
   * The holders the step spreads over — the card's own storage rule
   * (`getResourceCards`'s law over the list: a holder of ANY of the kinds, the
   * WARE wildcard included), in tableau order, each once.
   */
  public getCards(): Array<ICard> {
    return this.player.getResourceCards().filter((card) => holdsOneOf(card, this.resourceTypes));
  }

  /** Is there something to DISTRIBUTE at all — N ≥ 2 over ≥ 2 holders? Else the family's ordinary pick. */
  public distributes(): boolean {
    return this.count >= 2 && this.getCards().length >= 2;
  }

  public execute(): PlayerInput | undefined {
    if (this.count <= 0) {
      return undefined;
    }
    const cards = this.getCards();
    if (cards.length === 0) {
      return undefined;
    }
    if (!this.distributes()) {
      // THE FAMILY'S ORDINARY PICK: one holder takes all N, or the one unit
      // goes to the chosen holder — the same `resourceGainPrompt` reading,
      // the same `autoSelect` law, the same source dock. The pick spans the
      // SAME list of kinds, so its candidates are these very holders.
      return new AddResourcesToCard(this.player, this.resourceTypes, {
        count: this.count,
        autoSelect: this.options.autoSelect,
        cause: this.options.cause,
        from: this.options.from,
        title: this.options.pickTitle,
        log: this.options.log,
      }).andThen((card) => {
        this.cb([placementOf(card, this.count)]);
        return undefined;
      }).execute();
    }
    return this.buildDistribution(cards);
  }

  /**
   * READ-ONLY: the distribution prompt the live path WOULD present over the
   * current holders (undefined when the step would not distribute) — the
   * shape a preview hosts, never a mutation.
   */
  public previewDistribution(): AndOptions | undefined {
    if (this.count <= 0 || !this.distributes()) {
      return undefined;
    }
    return this.buildDistribution(this.getCards());
  }

  private buildDistribution(cards: ReadonlyArray<ICard>): AndOptions {
    const map = new Map<CardName, number>();
    const options = cards.map((card) => {
      return new SelectAmount(card.name, '', 0, this.count)
        .andThen((amount) => {
          map.set(card.name, amount);
          return undefined;
        });
    });
    // A TITLE, always: `AndOptions` defaults to '' and this prompt once shipped
    // with a blank header over a column of bare card names — the player was
    // asked to distribute something without being told what, or how many.
    const one = this.resourceType;
    const and = new AndOptions(...options)
      .setTitle(this.options.distributeTitle ?? message('Distribute ${0} ${1}', (b) => b.number(this.count).string(one ?? 'resources')));
    // THE STRUCTURAL MARKER — the console's whole reading of this prompt. ONE
    // kind names itself; SEVERAL name the kinds in their order and the kind
    // EACH holder takes, so no counter ever wears an icon its card would not.
    and.markCardResourceDistribution({
      amount: this.count,
      ...(one !== undefined ? {cardResource: cardResourceIcon(one)} : {
        cardResources: this.resourceTypes.map(cardResourceIcon),
        cardResourceByCard: holderResourceIcons(cards),
      }),
      cards: cardsToModel(this.player, cards, {showResources: true}),
      vpByAmount: distributionVictoryPoints(this.player, cards, this.count),
    });
    if (this.options.cause !== undefined) {
      and.markChoiceContext({source: this.options.cause, mode: 'reward'});
    }
    return and.andThen(() => {
      // VALIDATE FIRST, apply after: a wrong sum refuses the answer and the
      // prompt stands with nothing changed — never a partial payout.
      const placements: Array<ResourcePlacement> = cards.map((card) => placementOf(card, map.get(card.name) ?? 0));
      const sum = placements.reduce((acc, p) => acc + p.amount, 0);
      if (sum !== this.count) {
        throw new InputError(`Expecting ${this.count} resources distributed, got ${sum}.`);
      }
      const landed = placements.filter((p) => p.amount > 0);
      for (const p of landed) {
        this.player.addResourceTo(p.card, {qty: p.amount, log: this.options.log !== false, from: this.options.from});
      }
      this.cb(landed);
      return undefined;
    });
  }
}

/** ONE placement: the card, the amount, and the kind THE CARD took (never the step's list). */
function placementOf(card: ICard, amount: number): ResourcePlacement {
  const resource = holderResourceOf(card);
  if (resource === undefined) {
    // Unreachable through `getCards` (every candidate holds something); named rather than guessed.
    throw new Error(`${card.name} holds no card resource`);
  }
  return {card, amount, resource};
}
