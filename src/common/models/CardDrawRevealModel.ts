import {CardModel} from './CardModel';
import {CardName} from '../cards/CardName';
import {CardType} from '../cards/CardType';
import {Tag} from '../cards/Tag';
import {CardResource} from '../CardResource';
import {ColonyName} from '../colonies/ColonyName';
import {GlobalParameter} from '../GlobalParameter';
import {SpaceId} from '../Types';
import {PartyName} from '../turmoil/PartyName';

/**
 * Which colony-trade mechanic produced a trade-tagged draw: the trade INCOME
 * (read off the track position) or the per-cube COLONY BONUS to an owner.
 * The console launches the two waves from different areas of the colony tile
 * (the «ТОРГОВАТЬ» value cell vs the «БОНУС» cell), so the split is carried
 * structurally instead of being re-derived client-side.
 */
export type ColonyTradeRevealRole = 'income' | 'bonus';

/**
 * The trade a colony-sourced draw belongs to. `tradeId` matches
 * `ColonyTradeManifestModel.tradeId`, letting the client bind the reveal
 * batch, the reward manifest and its own armed trade into ONE transaction.
 */
export type ColonyTradeRevealTag = {
  tradeId: string;
  role: ColonyTradeRevealRole;
};

/**
 * One contiguous run of same-role cards inside a (possibly merged)
 * trade-tagged batch, in card order. `Σ count === cards.length`. The trade
 * income draw always precedes the colony-bonus draws (deferred-queue
 * priority), so a merged Pluto batch reads `[{income, n}, {bonus, m}]`.
 */
export type ColonyTradeRevealSegment = {
  role: ColonyTradeRevealRole;
  count: number;
};

/**
 * Where a batch of drawn cards came from, used to give the player a
 * contextual subtitle in the "cards received" reveal modal. Attributed where
 * cheaply known (the behavior executor knows the card being played; a colony
 * bonus tags itself; tile bonuses tag themselves); otherwise omitted → generic
 * text. A `card` / `colony` source renders as a HOVERABLE chip (mini-card
 * popover) + click-to-fullscreen for a card.
 *
 * A `colony` source additionally carries the TRADE it belongs to (`trade`)
 * when the draw is a trade income / trade colony-bonus — the structural key
 * the console trade cinematic claims the batch by. A colony BUILD bonus draw
 * stays untagged.
 *
 * `globalParameter` is a scale-threshold reward (the Venus 8% "draw a card"
 * bonus — the only base global-parameter card draw). It names the scale so
 * the console can lift the card-bonus cover off that scale's marker (mirrors
 * how `tile` drives the board-cell lift cinematic).
 */
export type CardDrawRevealSource =
  | {type: 'card', cardName: CardName}
  /**
   * `via` — the CARD that paid this colony's bonus OUTSIDE a trade («gain all
   * your colony bonuses»: Habitat Science, Productive Outpost, Yvonne). The
   * batch is still the colony's (the planet names it), and `via` is the key
   * the workspace the card was pressed in claims it by. Never set together
   * with `trade`; absent for a trade's and a build's draw.
   */
  | {type: 'colony', colonyName: ColonyName, trade?: ColonyTradeRevealTag, via?: CardName}
  /**
   * A board-tile bonus draw. `spaceId` (when known) names the PAYING cell:
   * the placed cell for its own printed DRAW_CARD bonus, or the NEIGHBOURING
   * Ares tile for an adjacency draw (Restricted Area:ares) — the console
   * lifts the card-back cover off that exact hex. Absent on legacy paths.
   */
  | {type: 'tile', spaceId?: SpaceId}
  | {type: 'globalParameter', parameter: GlobalParameter}
  /** Campaign «Наследие проектов»: cards carried from the previous mission,
   *  granted FREE with the base corporation play. No workspace claim matches
   *  it, so it presents as its own reveal — clearly carried, never bought. */
  | {type: 'campaign'}
  /** Turmoil Redux: a PARTY ACTION drew them (the Reds' «draw 2, discard 2»). */
  | {type: 'party', party: PartyName}
  /** Turmoil Redux: the ENACTED RESOLUTION'S ACTION drew them (Open IP Trade's «a card per card discarded»). */
  | {type: 'resolution', resolution: string}
  /** Turmoil Redux: the Agenda track's card step (the chairman quest / the political phase advanced a marker). */
  | {type: 'agenda'}
  | {type: 'other'};

/**
 * ONE card as the deck actually turned it over during a CONDITIONAL search
 * ("reveal cards until you find two with a space tag" — Acquired Space
 * Agency), in the SERVER's reveal order.
 *
 * `matched` = it satisfied the search condition and went to the player's
 * hand; otherwise the deck discarded it. The client replays exactly this
 * sequence — it never re-derives or re-sorts the order.
 *
 * These names are ALREADY public: `Deck.drawByConditionOrThrow` logs
 * «Discarded ${0} cards ${1}» to the shared game log, so surfacing them to
 * the drawing player leaks nothing (and this model is self-only anyway).
 */
export type CardDrawRevealStep = {
  /** Serialized with the SAME options as `cards` so it renders identically. */
  card: CardModel;
  matched: boolean;
  /**
   * WHY a discarded card was thrown away, when the reason is a TAG IT CARRIES —
   * the search's `withoutTags` it was found holding (Red Tech Convention: «a
   * plant tag»), read by the SAME reader as the search itself
   * (`Tags.cardHasTag`). Absent on a matched card and on a card a POSITIVE
   * filter refused: «it lacks the Space tag» is the search's own rule, already
   * named by `CardDrawRevealModel.search`.
   */
  failedTags?: ReadonlyArray<Tag>;
};

/**
 * THE SEARCH'S RULE — ONE descriptor of a filtered draw («reveal until you find
 * N cards that …»), born on the server from the declaration that performs the
 * search (`Behavior.DrawCard` / `DrawOptions`, `deferredActions/drawSearch.ts`)
 * and read by every surface that names it: the composer's draw chip
 * (`ActionEffect.search`), the card's structured text, the reveal's summary and
 * its discard tray. No surface rebuilds the rule from a guess.
 *
 * Absent for a plain draw («draw N»): there is nothing to search for. A search
 * by an opaque predicate (`DrawOptions.include` — a bespoke card) has no
 * descriptor either: its rule is the card's own prose.
 */
export type DrawSearchModel = {
  /** How many MATCHING cards the search keeps. */
  count: number;
  /** Keep only cards WITH this tag. */
  tag?: Tag;
  /** Keep only cards of this type (Deep Space Operations — events). */
  type?: CardType;
  /** Keep only cards that collect this resource. */
  resource?: CardResource;
  /** Keep only cards with NONE of these tags (Red Tech Convention). In the printed rule's order. */
  withoutTags?: ReadonlyArray<Tag>;
};

/**
 * One batch of cards a player drew via an in-game EFFECT (card effect, tile
 * bonus, …) — NOT via research / draft / buy / keep-some choices, which the
 * player already sees through their own selection prompt.
 *
 * Lives only on the owner's PlayerViewModel (next to cardsInHand), so it is
 * never sent to other players. The server queue that backs this is transient
 * (not serialized to the database) so stale reveals never resurface after a
 * refresh / reconnect.
 */
export type CardDrawRevealModel = {
  /** Monotonic id, unique within a player; the client acks by this id. */
  id: number;
  source?: CardDrawRevealSource;
  /** Serialized with the SAME options as cardsInHand so they render identically. */
  cards: ReadonlyArray<CardModel>;
  /**
   * The conditional search's reveal sequence, in server order.
   *
   * Present ONLY when the search actually DISCARDED at least one card — a
   * plain "draw N" (and a search whose every reveal matched) leaves it
   * undefined, which is exactly the "no discard tray, plain draw visuals"
   * case. So the ordinary draw carries no extra payload at all.
   *
   * The matched steps' cards are the same ones listed in `cards`.
   */
  sequence?: ReadonlyArray<CardDrawRevealStep>;
  /**
   * The search's RULE (see `DrawSearchModel`), present on EVERY batch a
   * filtered search produced — also when nothing was discarded (the three
   * matches sat on top): the summary still names what was searched for.
   */
  search?: DrawSearchModel;
  /**
   * The search turned over every card the deck (and its reshuffled discard
   * pile) had left and found FEWER matches than it wanted: `cards` is all
   * there was. Named calmly by the summary — the rule working, not an error.
   */
  exhausted?: true;
  /**
   * Present ONLY on a trade-tagged batch (`source.trade` set): the same-role
   * runs of `cards`, in order. The server MERGES the income draw and the
   * trader's own colony-bonus draws of ONE trade into ONE batch (one reveal
   * modal, one acknowledgement), and these segments preserve which cards
   * belong to which wave so the client can launch them from the right area
   * of the colony tile.
   */
  tradeSegments?: ReadonlyArray<ColonyTradeRevealSegment>;
};
