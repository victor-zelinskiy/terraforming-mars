import {IPlayer} from '../IPlayer';
import {SelectCard} from '../inputs/SelectCard';
import {SelectOption} from '../inputs/SelectOption';
import {OrOptions} from '../inputs/OrOptions';
import {skip} from '../inputs/optionMetadata';
import {ChoiceContextSource, OrOptionsModel, SelectCardModel} from '../../common/models/PlayerInputModel';
import {CardResource} from '../../common/CardResource';
import {CardName} from '../../common/cards/CardName';
import {ICard} from '../cards/ICard';
import {Tag} from '../../common/cards/Tag';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {Message} from '../../common/logs/Message';
import {message} from '../logs/MessageBuilder';
import {From} from '../logs/From';
// Runtime-only calls (safe circular import: actionPreviews imports this class
// at top level, these two are late-bound function reads at prompt-build time).
import {cardResourceIcon, SKIP_REASON, skippedAddToCard, targetVictoryPoints} from '../cards/actionPreviews';
import {recordSkippedEffect} from './skippedEffect';
import {Space} from '../boards/Space';
import {SpaceId} from '../../common/Types';
import {TilePayoutCause} from '../../common/models/CardAdjacencyPayoutModel';
import {ActionEffect} from '../../common/models/ActionPreviewModel';
import {payTileToCard} from '../cards/tilePayout';

/**
 * THE KINDS a pick spans, as a LIST — one kind is the list of one (every
 * caller before Medical Database), several kinds are a step whose units
 * follow their cards («data or microbe»), and `undefined` («any resource»)
 * stays undefined. The ONE normalisation every caller's argument goes
 * through, shared with the distribution step (`AddResourcesToCards`).
 */
export function cardResourceKinds(resourceType: CardResource | ReadonlyArray<CardResource> | undefined): ReadonlyArray<CardResource> | undefined {
  if (resourceType === undefined) {
    return undefined;
  }
  return typeof resourceType === 'string' ? [resourceType] : resourceType;
}

/**
 * Does `card` hold one of `kinds` — its own storage rule, the WARE wildcard
 * included (`Player.getResourceCards`'s law, over a list)? `undefined` kinds =
 * any holder.
 */
export function holdsOneOf(card: ICard, kinds: ReadonlyArray<CardResource> | undefined): boolean {
  if (card.resourceType === undefined) {
    return false;
  }
  return kinds === undefined || kinds.includes(card.resourceType) || card.resourceType === CardResource.WARE;
}

/**
 * THE KIND A HOLDER TAKES — the card's own storage rule, never the step's
 * list: a microbe holder takes microbes whatever else the step could add, and
 * a WARE holder takes its own wildcard (its state holds a counter, not a
 * kind — the journal names the card's resource). The one reading of «which
 * unit landed» for the marker's per-card map and the outcome record.
 */
export function holderResourceOf(card: ICard): CardResource | undefined {
  return card.resourceType;
}

/** The per-candidate map of the marker: each holder's own kind, as an icon key. */
export function holderResourceIcons(cards: ReadonlyArray<ICard>): Partial<Record<CardName, string>> {
  const out: Partial<Record<CardName, string>> = {};
  for (const card of cards) {
    const resource = holderResourceOf(card);
    if (resource !== undefined) {
      out[card.name] = cardResourceIcon(resource);
    }
  }
  return out;
}

export type Options = {
  count?: number;
  restrictedTag?: Tag;
  // TODO(kberg): replace min with filter.
  min?: number;
  title?: string | Message;
  robotCards?: boolean;
  filter?(card: ICard): boolean;
  log?: boolean;
  /**
   * PREVIEW-ONLY: a card that is ABOUT to enter play but isn't on the tableau yet.
   * The play-card modal previews an on-play `addResourcesToAnyCard` BEFORE the card
   * is played, so `getResourceCards` (which reads the live tableau) can't see it —
   * yet the card itself is a valid target for its OWN floaters once played (Jovian
   * Lanterns / Atmo Collectors / Titan Floating Launch-pad hold floaters and "add to
   * ANY card"). When set, `getCards()` includes it (if it holds the matching resource
   * + passes the tag filter) so the modal offers the card itself. The LIVE path never
   * sets this — by the time the deferred runs, the card is already on the tableau, so
   * `getResourceCards` returns it and the `!cards.includes` guard avoids a duplicate.
   */
  cardBeingPlayed?: ICard;
  /**
   * When `false`, NEVER apply silently even if only ONE card matches — always
   * present the pick so the player explicitly confirms WHERE the resource goes
   * (rather than it happening behind the board). The "add to ANY card"
   * behavior (`addResourcesToAnyCard`) passes `false`, because that is a real
   * board-wide choice. Left `undefined` (or `true`) by bespoke callers that
   * target a FIXED card (e.g. Ants → itself, via `filter`), which keeps the
   * instant apply on a single match.
   */
  autoSelect?: boolean;
  /**
   * WHO caused this prompt — the card / corporation / colony whose effect is
   * handing out the resource. This helper is shared by ~30 callers, so it can
   * only learn that from them; without it the player is shown a card picker
   * with no way to tell which effect asked (see `docs/PROMPT_SOURCE_AUDIT.md`).
   * Named `cause` across every shared helper — see `inputs/choiceContext.ts`.
   */
  cause?: ChoiceContextSource;
  /**
   * The SOURCE the journal names for the addition («added 3 animals to Fish
   * from Aquifer Contest») — a cardless origin (a party, an enacted
   * resolution) has no card of its own to log through, so it says so here.
   */
  from?: From;
  /**
   * A «YOU MAY» addition (`AddResource.optional` — TR44's «you may also add 1
   * data to ANY card»): with a holder the pick is asked inside an OPTIONAL
   * CHOICE — the card pick beside a `skip`-marked decline — instead of a bare
   * pick; with no holder the addition is skipped by name, as always.
   */
  optional?: boolean;
  /**
   * THE CELL THE UNITS COME FROM, when the field pays (a cell's printed bonus,
   * an Ares tile's adjacency bonus, a survey) — carried on the marker
   * (`ResourceGainPromptMeta.fromSpace`) so the console lights it and plays the
   * answer's scene from it. The asker stays `cause`.
   */
  fromSpace?: SpaceId;
  /**
   * THE FIELD PAID THIS — the addition goes through the ONE writer of the
   * board scene's record (`cards/tilePayout.payTileToCard`), whatever card it
   * lands on: `space` is the placed cell (the scene's centre), `sender` the
   * cell that sent the units (default: the placed cell itself), `source` the
   * card whose effect paid (absent for a printed bonus). A target the player
   * CHOSE in the live pick is recorded `asked` — the record arrives with the
   * answer and the client plays it as that answer's scene. TR53 iteration
   * «ресурс на карту — один стандарт» (2026-10-15).
   */
  boardPayout?: {space: Space, cause: TilePayoutCause, sender?: Space, source?: CardName};
  /**
   * WHAT ELSE choosing a candidate gives (TR53: a draw when the card's resource
   * is not science) — read off EACH candidate by the card's own function and
   * published on the marker (`ResourceGainPromptMeta.extraByCard`), so the
   * target step, the composer and a live prompt print the same tail. Read-only:
   * the effect itself stays the caller's `andThen`.
   */
  extraByCard?(card: ICard): ReadonlyArray<ActionEffect> | undefined;
}

/** The near-miss reason of a holder SHORT of `min` («a card that already has a resource» — TR53). */
export const NO_RESOURCE_YET_REASON = 'No resource on this card yet';

/** The decline of an optional addition — the i18n key the plate and the row print (`${0}` = the resource's name). */
export const DECLINE_ADDITION_KEY = 'Do not add ${0}';

/**
 * `andThen` receives the card the resources landed on — a caller that
 * records WHERE its payout went (the parliament's outcome log) reads it;
 * every existing caller ignores the argument.
 */
export class AddResourcesToCard extends DeferredAction<ICard> {
  /**
   * THE KINDS the pick spans — a list, one kind being the list of one
   * (Medical Database's «data or microbe»: the candidates are the holders of
   * EITHER, and each unit's kind is its card's). Undefined means any resource.
   */
  public readonly resourceTypes: ReadonlyArray<CardResource> | undefined;

  constructor(
    player: IPlayer,
    /** The card type(s) to add to — one, a list, or undefined for any resource. */
    resourceType: CardResource | ReadonlyArray<CardResource> | undefined,
    public options: Options = {},
  ) {
    super(player, Priority.GAIN_RESOURCE_OR_PRODUCTION);
    this.resourceTypes = cardResourceKinds(resourceType);
  }

  /** The ONE kind the pick spans when it spans exactly one (the ordinary pick); undefined for several kinds or any. */
  public get resourceType(): CardResource | undefined {
    return this.resourceTypes !== undefined && this.resourceTypes.length === 1 ? this.resourceTypes[0] : undefined;
  }

  public getCards(): Array<ICard> {
    const min = this.options.min;
    const cards = this.holders();
    return min ? cards.filter((c) => c.resourceCount >= min) : cards;
  }

  /**
   * THE NEAR MISSES of a `min` pick («a card that ALREADY has a resource» —
   * TR53 Frontier Labs): every holder the step would offer but for `min`,
   * shown DISABLED with its reason — never hidden (the TR52 law for a taking
   * step, here for an adding one). Empty without `min`.
   */
  public nearMisses(): Array<ICard> {
    const min = this.options.min;
    return min ? this.holders().filter((c) => c.resourceCount < min) : [];
  }

  /** Every holder the step would offer, `min` aside — the candidates and the near misses together. */
  private holders(): Array<ICard> {
    // The holders of ANY of the kinds, in tableau order, each once — the union
    // of `getResourceCards` over the list (the WARE wildcard included).
    const playedCards = this.player.getResourceCards().filter((card) => holdsOneOf(card, this.resourceTypes));
    const srrCards = this.player.getSelfReplicatingRobotsTargetCards().filter((card) => {
      return this.resourceTypes === undefined || (card.resourceType !== undefined && this.resourceTypes.includes(card.resourceType));
    });

    let cards = playedCards;

    // Include the card about to enter play (preview only — see Options.cardBeingPlayed):
    // it isn't on the tableau yet, but it WILL be a valid target for its own on-play
    // "add to any card". Match `getResourceCards`'s resource rule (exact type or the
    // WARE wildcard), and only if it isn't already present.
    const beingPlayed = this.options.cardBeingPlayed;
    if (beingPlayed !== undefined &&
        holdsOneOf(beingPlayed, this.resourceTypes) &&
        !cards.includes(beingPlayed)) {
      cards = [beingPlayed, ...cards];
    }

    if (this.options.robotCards === true) {
      cards = cards.concat(srrCards);
    }
    const restrictedTag = this.options.restrictedTag;
    if (restrictedTag !== undefined) {
      cards = cards.filter((card) => {
        return card.tags.includes(restrictedTag) || card.tags.includes(Tag.WILD);
      });
    }
    if (this.options.filter !== undefined) {
      cards = cards.filter(this.options.filter);
    }
    return cards;
  }

  public execute() {
    const qty = this.options.count ?? 1;
    if (qty === 0) {
      return undefined;
    }

    const cards = this.getCards();
    if (cards.length === 0) {
      // No silent loss: the preview warned before the commit; the record names it after.
      recordSkippedEffect(this.player, SKIP_REASON.noHolder, skippedAddToCard(this.resourceTypes, qty));
      return undefined;
    }

    // Apply instantly on a single match ONLY when the caller allows it
    // (default). The "add to ANY card" behavior passes autoSelect:false so the
    // player ALWAYS confirms WHERE the resource goes — even with one candidate —
    // instead of it being applied silently behind the board.
    if (cards.length === 1 && this.options.autoSelect !== false) {
      this.addResource(cards[0], qty, false);
      return undefined;
    }

    // A «YOU MAY» addition: the pick, and the decline beside it — one surface.
    if (this.options.optional === true) {
      return this.buildOptionalChoice(cards);
    }

    return this.buildSelectCard(cards)
      .andThen(([card]) => {
        this.addResource(card, qty, true);
        return undefined;
      });
  }

  /**
   * THE OPTIONAL CHOICE of a «you may add» (`Options.optional`): the card pick
   * — the very `SelectCard` the mandatory path presents, its answer adding the
   * resource — beside ONE `skip`-marked decline («Do not add data»). The
   * shape the console's optional-choice law reads (`optionalChoice.ts`: a
   * choice whose one answer is a pick opens that pick directly, the refusal is
   * RT and a plate in the question line), and the shape the composer's
   * pre-collected step carries (`previewOptionalChoice`), so the promise and
   * the live prompt are one. A decline is the player's deliberate answer —
   * nothing is recorded as lost.
   */
  public buildOptionalChoice(cards: ReadonlyArray<ICard>): OrOptions {
    const qty = this.options.count ?? 1;
    const pick = this.buildSelectCard(cards).andThen(([card]) => {
      this.addResource(card, qty, true);
      return undefined;
    });
    const decline = new SelectOption(message(DECLINE_ADDITION_KEY, (b) => b.string(this.resourceType ?? 'resources')))
      .withMetadata(skip());
    const choice = new OrOptions(pick, decline);
    return this.options.cause === undefined ?
      choice :
      choice.markChoiceContext({source: this.options.cause, mode: 'optional-effect'});
  }

  /** READ-ONLY: the optional choice the live path WOULD present (`buildOptionalChoice`), or `undefined` with no holder. */
  public previewOptionalChoice(): OrOptionsModel | undefined {
    const cards = this.getCards();
    if (cards.length === 0) {
      return undefined;
    }
    return this.buildOptionalChoice(cards).toModel(this.player);
  }

  /**
   * Build the `SelectCard` the live path presents (shared with the read-only
   * preview so the two never drift). A forced single pick (one candidate, but
   * autoSelect disabled) reads as a CONFIRMATION ("add here"), not a choice
   * ("select a card …"). Plain string keys (no resource/number token) so the
   * Russian text stays correct — the resource type + count are clear from the
   * shown card + the button.
   */
  private buildSelectCard(cards: ReadonlyArray<ICard>): SelectCard<ICard> {
    const qty = this.options.count ?? 1;
    const single = cards.length === 1;
    const buttonLabel = qty === 1 ? 'Add resource' : 'Add resources';
    const title: string | Message = this.options.title ?? (single ?
      (qty === 1 ? 'Add resource to this card' : 'Add resources to this card') :
      // The resource NAMES itself after a dash, never inside the sentence: a noun substituted into «добавить 2 …»
      // cannot decline (RU printed «добавить 2 Данные» — the TR48 walk), a label after a dash needs no case.
      message('Select a card — ${1}: +${0}', (b) => b.number(qty).string(this.resourceType || 'resources')));
    const kinds = this.resourceTypes;
    // THE NEAR MISSES (a `min` pick): every holder short of it stands beside the candidates, DISABLED with its reason —
    // never hidden; the server never accepts one (they ride `disabledCards`, outside `cards`).
    const nearMisses = this.nearMisses();
    const disabled = nearMisses.length > 0 ? nearMisses.map((card) => ({card, reason: NO_RESOURCE_YET_REASON})) : undefined;
    const extraByCard = this.extraByCardOf(cards);
    const select = new SelectCard(title, buttonLabel, cards, disabled !== undefined ? {disabled} : undefined)
      // The premium target reading a LIVE pick otherwise has no channel for:
      // amount + resource icon + the per-candidate VP delta (the same producer
      // the composers' pre-collected steps use), so a deferred arrival — an
      // Ares adjacency bonus, a triggered gift — explains each candidate with
      // `resources current → resulting` and «ПО from → to», never a bare face.
      .markResourceGainPrompt({
        amount: qty,
        cardResource: this.resourceType !== undefined ? cardResourceIcon(this.resourceType) : undefined,
        // SEVERAL kinds (or any): the kinds in their declared order, and the
        // kind EACH candidate takes — its own storage rule — so every
        // candidate's reading names what would land on it, never one icon
        // for all of them.
        ...(kinds !== undefined && kinds.length > 1 ? {cardResources: kinds.map(cardResourceIcon)} : {}),
        ...(this.resourceType === undefined ? {cardResourceByCard: holderResourceIcons(cards)} : {}),
        vpBox: targetVictoryPoints(this.player, cards, qty),
        // The title is the step's OWN generic one (no caller's constraint) — a composer that already printed the rule
        // and the «+N on a card» chip must not print it a third time (`ConsolePlayedTargetStep`'s ask line).
        ...(this.options.title === undefined ? {genericTitle: true} : {}),
        // The cell the units come from, when the field pays — the console lights it and plays the answer from it.
        ...(this.options.fromSpace !== undefined ? {fromSpace: this.options.fromSpace} : {}),
        // The floor of a `min` pick — the near misses' «have / need» (TR53).
        ...(this.options.min ? {holdsAtLeast: this.options.min} : {}),
        // What else each candidate gives (TR53's draw for a non-science card) — the card's own chips, read by every host.
        ...(extraByCard !== undefined ? {extraByCard} : {}),
      });
    return this.options.cause === undefined ?
      select :
      select.markChoiceContext({source: this.options.cause, mode: 'reward'});
  }

  /**
   * READ-ONLY: the `SelectCardModel` the live path WOULD present, or `undefined`
   * when the resource auto-applies (single candidate + autoSelect not false) or
   * there are no candidate cards. Used by the action-preview builder to host the
   * card-target picker INSIDE the confirmation modal — no mutation.
   */
  public previewSelectCard(): SelectCardModel | undefined {
    const cards = this.getCards();
    if (cards.length === 0) {
      return undefined;
    }
    if (cards.length === 1 && this.options.autoSelect !== false) {
      return undefined;
    }
    return this.buildSelectCard(cards).toModel(this.player);
  }

  /** The per-candidate tail of the pick (`Options.extraByCard`), only the candidates it names; undefined when none. */
  private extraByCardOf(cards: ReadonlyArray<ICard>): Partial<Record<CardName, ReadonlyArray<ActionEffect>>> | undefined {
    const read = this.options.extraByCard;
    if (read === undefined) {
      return undefined;
    }
    const out: Partial<Record<CardName, ReadonlyArray<ActionEffect>>> = {};
    let any = false;
    for (const card of cards) {
      const extra = read(card);
      if (extra !== undefined && extra.length > 0) {
        out[card.name] = extra;
        any = true;
      }
    }
    return any ? out : undefined;
  }

  /**
   * THE ONE ADDITION — `asked` when the card is the player's answer to the
   * live pick. A FIELD payout (`Options.boardPayout`) goes through the board
   * scene's one writer, so the record names the cell that sent the units and
   * the client plays it; everything else is the plain addition it always was.
   */
  private addResource(card: ICard, qty: number, asked: boolean) {
    const autoLog = this.options.log !== false;
    const board = this.options.boardPayout;
    const resource = holderResourceOf(card);
    if (board !== undefined && resource !== undefined) {
      const sender = board.sender;
      payTileToCard(this.player, board.source, board.space, card, resource, qty, {
        cause: board.cause,
        ...(sender !== undefined && sender.id !== board.space.id ? {neighbours: [{spaceId: sender.id, units: qty}]} : {}),
        ...(asked ? {asked: true} : {}),
      }, {log: autoLog, from: this.options.from});
    } else {
      this.player.addResourceTo(card, {qty, log: autoLog, from: this.options.from});
    }
    this.cb(card);
  }
}
