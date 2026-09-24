import {IPlayer} from '../IPlayer';
import {SelectCard} from '../inputs/SelectCard';
import {ChoiceContextSource, SelectCardModel} from '../../common/models/PlayerInputModel';
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
import {cardResourceIcon, targetVictoryPoints} from '../cards/actionPreviews';

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
}

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
    const min = this.options.min;
    if (min) {
      cards = cards.filter((c) => c.resourceCount >= min);
    }
    return cards;
  }

  public execute() {
    const cards = this.getCards();
    if (cards.length === 0) {
      return undefined;
    }

    const qty = this.options.count ?? 1;
    if (qty === 0) {
      return undefined;
    }

    // Apply instantly on a single match ONLY when the caller allows it
    // (default). The "add to ANY card" behavior passes autoSelect:false so the
    // player ALWAYS confirms WHERE the resource goes — even with one candidate —
    // instead of it being applied silently behind the board.
    if (cards.length === 1 && this.options.autoSelect !== false) {
      this.addResource(cards[0], qty);
      return undefined;
    }

    return this.buildSelectCard(cards)
      .andThen(([card]) => {
        this.addResource(card, qty);
        return undefined;
      });
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
      message('Select card to add ${0} ${1}', (b) => b.number(qty).string(this.resourceType || 'resources')));
    const kinds = this.resourceTypes;
    const select = new SelectCard(title, buttonLabel, cards)
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

  private addResource(card: ICard, qty: number) {
    const autoLog = this.options.log !== false;
    this.player.addResourceTo(card, {qty, log: autoLog, from: this.options.from});
    this.cb(card);
  }
}
