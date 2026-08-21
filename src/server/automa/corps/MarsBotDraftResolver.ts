import {Tag} from '../../../common/cards/Tag';
import {MarsBotDraftPriority} from '../../../common/automa/MarsBotCorpData';
import {IProjectCard} from '../../cards/IProjectCard';
import {MarsBotBoard} from '../MarsBotBoard';
import {AutomaResolver} from '../AutomaResolver';

/** Shuffles in place. The game injects the seeded rng shuffle; tests inject a fixed order. */
export type Shuffler = <T>(items: Array<T>) => void;

export type DraftPickResult = {
  card: IProjectCard;
  /** How many cards tied for best — 1 means the priority decided outright. */
  tiedCount: number;
};

export type DraftDiscardResult = {
  kept: Array<IProjectCard>;
  discarded: Array<IProjectCard>;
  /**
   * The priority CHANGED the outcome: the first card in shuffled order was
   * protected, so a different card left than the corpless rule (discard the
   * shuffled-first card) would have discarded.
   */
  protectionChangedOutcome: boolean;
};

/**
 * Interprets a MarsBot corporation's Draft Priority (Rule Book B, "Draft
 * Priority" + "Special Cases", p.2) — both the per-hand PICK and the
 * post-draft DISCARD protection:
 *
 *  - PICK: "if exactly 1 card matches the Draft Priority, give that card to
 *    MarsBot. If multiple cards match equally, select one of them randomly.
 *    If none of them match, select one of the cards randomly." Tag priorities
 *    compare per-tag counts lexicographically ("a card having the first and
 *    the second tag is a better match than a card having just the first tag,
 *    but a card having the first tag twice is an even better one"); the
 *    Wildcard tag never matches a priority TAG (RB-B p.2).
 *  - DISCARD: "Shuffle the cards MarsBot drafted, then reveal the top card.
 *    If it doesn't [match] the Draft Priority, place it in the general
 *    discard pile. If it does, set it aside, and check the next card. Repeat
 *    until a card is discarded or all 4 have been checked." — at most one
 *    card leaves; a priority that protects everything loses nothing (RB-B
 *    Credicor/Spire: "In the unlikely case that all 4 ... it discards
 *    nothing" → the action deck can hold 5 cards).
 *
 * TAG COUNTING (`mostTags`, Spire): "the card with the highest number of
 * tags" counts the PRINTED top-right tag row — `AutomaResolver.printedTags`,
 * this fork's one canonical printed-tag source. That includes the event tag
 * (printed last on event cards) and the Wild tag: both are printed icons the
 * bot genuinely resolves (wild advances the least-advanced track), so pick,
 * protection and the resolution the bot later performs all count the same
 * row. RB-B's wildcard exclusion is explicitly scoped to matching "the Draft
 * Priority tag(s)" of TAG-chain priorities, not to Spire's count.
 */
export class MarsBotDraftResolver {
  constructor(
    private readonly board: MarsBotBoard,
    private readonly shuffler: Shuffler,
  ) {}

  /** The card MarsBot takes from a passed hand. */
  public pickCard(hand: ReadonlyArray<IProjectCard>, priority: MarsBotDraftPriority): DraftPickResult {
    if (hand.length === 0) {
      throw new Error('MarsBot cannot draft from an empty hand');
    }
    return this.pickByScore(hand, this.scorerOf(priority));
  }

  /**
   * «Highest score wins, ties resolve at random» over an ARBITRARY printed
   * priority chain — the machinery a Draft Priority uses, exposed because a
   * bonus card prints the very same shape without being a draft rule at all
   * (B30 Interface Hyperlink: «select … using the following priorities:
   * 1. Science tag. 2. Most expensive. 3. Most tags. 4. Random»). Scores are
   * compared entry by entry, so entry 0 decides unless tied, and «Random» is
   * the injected seeded shuffle rather than a score of its own.
   *
   * Deliberately NOT a new `MarsBotDraftPriority`: that union is the set of
   * priorities printed in a corporation's DRAFT PRIORITY plate, and a bonus
   * card's own selection rule does not belong in it.
   */
  public pickByScore(items: ReadonlyArray<IProjectCard>, scorer: (card: IProjectCard) => ReadonlyArray<number>): DraftPickResult {
    if (items.length === 0) {
      throw new Error('MarsBot cannot pick from an empty set');
    }
    return this.pickBest(items, scorer);
  }

  /**
   * The post-draft discard, with the corp's protection applied. `drafted` is
   * shuffled internally (seeded); at most one card is discarded.
   */
  public discardAfterDraft(drafted: ReadonlyArray<IProjectCard>, priority: MarsBotDraftPriority): DraftDiscardResult {
    const cards = [...drafted];
    this.shuffler(cards);
    const saved = this.savedFromDiscard(cards, priority);
    const discardable = cards.findIndex((card) => !saved.has(card));
    if (discardable === -1) {
      return {kept: cards, discarded: [], protectionChangedOutcome: false};
    }
    return {
      kept: cards.filter((_, index) => index !== discardable),
      discarded: [cards[discardable]],
      // Index 0 is what the corpless rule discards; a protected first card
      // means the priority genuinely redirected the loss.
      protectionChangedOutcome: discardable !== 0,
    };
  }

  /** The printed top-right tag row length — the fork's canonical "number of tags". */
  public static printedTagCount(card: IProjectCard): number {
    return AutomaResolver.printedTags(card).length;
  }

  private scorerOf(priority: MarsBotDraftPriority): (card: IProjectCard) => ReadonlyArray<number> {
    switch (priority.type) {
    case 'tags':
      return (card) => this.scoreByTags(card, priority.tags);
    case 'mostExpensive':
      return (card) => [card.cost];
    case 'mostTags':
      return (card) => [MarsBotDraftResolver.printedTagCount(card)];
    case 'leastAdvancedTrack':
      return (card) => this.scoreByTags(card, this.leastAdvancedTrackTags());
    }
  }

  /** The drafted cards the priority keeps out of the discard. */
  private savedFromDiscard(cards: ReadonlyArray<IProjectCard>, priority: MarsBotDraftPriority): ReadonlySet<IProjectCard> {
    switch (priority.type) {
    case 'tags':
      return new Set(cards.filter((card) => this.hasAnyTag(card, priority.tags)));
    case 'leastAdvancedTrack':
      // Reads the same tracks the picks used — they cannot have moved, tracks
      // only advance once MarsBot starts resolving cards (RB-B Aridor:
      // "Re-evaluate this priority at the beginning of the next generation only").
      return new Set(cards.filter((card) => this.hasAnyTag(card, this.leastAdvancedTrackTags())));
    case 'mostExpensive':
      return topScoring(cards, (card) => card.cost);
    case 'mostTags':
      return topScoring(cards, (card) => MarsBotDraftResolver.printedTagCount(card));
    }
  }

  /**
   * Highest score wins; ties resolve randomly via the injected (seeded)
   * shuffle. Scores compare entry by entry, so a tag chain's first tag
   * decides unless tied. Cards that all score alike are one big tie — which
   * is exactly how "if none of them match, select one randomly" falls out.
   */
  private pickBest(items: ReadonlyArray<IProjectCard>, scorer: (card: IProjectCard) => ReadonlyArray<number>): DraftPickResult {
    let best: ReadonlyArray<number> = [];
    let tied: Array<IProjectCard> = [];
    for (const item of items) {
      const score = scorer(item);
      const ranking = tied.length === 0 ? 1 : compareScores(score, best);
      if (ranking > 0) {
        best = score;
        tied = [item];
      } else if (ranking === 0) {
        tied.push(item);
      }
    }
    const tiedCount = tied.length;
    this.shuffler(tied);
    return {card: tied[0], tiedCount};
  }

  private leastAdvancedTrackTags(): ReadonlyArray<Tag> {
    return this.board.tracks[this.board.getLeastAdvancedTrackIndex()].definition.tags;
  }

  /**
   * Per-priority-tag printed counts, in priority order (compared
   * lexicographically). Priorities only list printed tags, and the Wildcard
   * tag never matches them (RB-B p.2).
   */
  private scoreByTags(card: IProjectCard, priorityTags: ReadonlyArray<Tag>): ReadonlyArray<number> {
    const printed = AutomaResolver.printedTags(card);
    return priorityTags.map((priorityTag) => printed.filter((tag) => tag === priorityTag).length);
  }

  private hasAnyTag(card: IProjectCard, priorityTags: ReadonlyArray<Tag>): boolean {
    const printed = AutomaResolver.printedTags(card);
    return priorityTags.some((tag) => printed.includes(tag));
  }
}

/** The items tied for the highest score — every item when they all score alike. */
function topScoring(items: ReadonlyArray<IProjectCard>, scorer: (card: IProjectCard) => number): ReadonlySet<IProjectCard> {
  const best = Math.max(...items.map(scorer));
  return new Set(items.filter((item) => scorer(item) === best));
}

/** Entry-by-entry score comparison: positive when `a` outranks `b`. */
function compareScores(a: ReadonlyArray<number>, b: ReadonlyArray<number>): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return 0;
}
