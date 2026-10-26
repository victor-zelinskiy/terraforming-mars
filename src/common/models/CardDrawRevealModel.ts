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
  /**
   * Turmoil Redux: the Agenda track's card step (the chairman quest / the political phase / a card advanced a marker).
   * `step` — the track step whose bonus drew it (absent on a batch from before the field existed): one walk can cross
   * several card steps, and each batch is parked and presented on its OWN node.
   */
  | {type: 'agenda', step?: number}
  /**
   * Turmoil Redux: a CARD answered a CHANGE OF POWER at the sitting's enactment (TR62 Tharsis Alliance — «draw a card
   * when either of those parties becomes ruling»): `party` is the new ruling party. Its one honest presentation is the
   * TAIL of the enactment tact — the card leaves the project deck for the hand dock once the seals have changed places
   * (`console/parliament/rulingChangeDraw.ts`), never before the enactment and never as a reveal over the sitting.
   */
  | {type: 'ruling-change', cardName: CardName, party: PartyName}
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
 * ONE SEGMENT of an intake batch — the cards ONE source dealt into it, in the
 * server's dealing order («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР», 2026-10-26).
 *
 * A batch is everything one press drew for its recipient under ONE action
 * root (see `CardDrawRevealModel.actionId`); its segments remember WHY each
 * run of cards came: the played card's own draw, the Olympus Conference that
 * answered its science tag, the cell the tile landed on, a colony's printed
 * bonus (per cube — `count` grows while the same source keeps dealing). The
 * console reads them to start every run from its own place and to name the
 * causes in one line; `Σ count === cards.length` by construction (guarded).
 * The order is the deferred queue's — the order of the rules — and is never
 * re-sorted anywhere.
 */
export type CardIntakeSegment = {
  source?: CardDrawRevealSource;
  count: number;
  /**
   * The TRADE WAVE of a trade-tagged colony segment (the former
   * `tradeSegments` role): the console launches an income run from the
   * «ТОРГОВАТЬ» cell and a bonus run from the «БОНУС» cell. Absent off a trade.
   */
  role?: ColonyTradeRevealRole;
  /** THIS segment's conditional search (see the batch-level twins below) — a search merged beside other draws. */
  sequence?: ReadonlyArray<CardDrawRevealStep>;
  search?: DrawSearchModel;
  exhausted?: true;
};

/**
 * WHAT SEALED THE BATCH (R6 — «the seal is read, not waited for»): the
 * mandatory answer the recipient owes before the rule may deal the next card
 * of the same action. The console shows the next card's place face-down under
 * a seal that names this condition (the settlement table's grammar, now the
 * fork's), and turns the card in place once the answer has been given.
 */
export type CardIntakePendingAnswer = {
  /** `discard` — a card must leave the hand first (Pluto's pair, Mars University's exchange); `question` — a table question stands. */
  kind: 'discard' | 'question';
  /** The CARD that asks, when a card does. */
  card?: CardName;
  /** The COLONY whose pair asks (Pluto), with its «n of k». */
  colony?: ColonyName;
  ordinal?: {index: number, total: number};
};

/**
 * One batch of cards a player drew via an in-game EFFECT (card effect, tile
 * bonus, …) — NOT via research / draft / buy / keep-some choices, which the
 * player already sees through their own selection prompt.
 *
 * ⭐ THE LAW OF THE FORK — «ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» (2026-10-26). Every
 * card ONE press drew for its recipient — by any number of effects, at any
 * depth of hooks, from the board and from cards — is ONE batch with ONE take,
 * until a MANDATORY input of that recipient stood between two draws (the
 * seal). The server merges by `actionId` (the recipient + the root of the
 * causal chain, `EventRecorder.rootId`), never by a name or a source type;
 * the `segments` keep the causes. Contract: `docs/claude/console/
 * card-intake-one-batch.md`.
 *
 * Lives only on the owner's PlayerViewModel (next to cardsInHand), so it is
 * never sent to other players. The server queue that backs this is transient
 * (not serialized to the database) so stale reveals never resurface after a
 * refresh / reconnect.
 */
export type CardDrawRevealModel = {
  /** Monotonic id, unique within a player; the client acks by this id. */
  id: number;
  /**
   * THE ACTION ROOT this batch belongs to — the `correlationId` of the root
   * action's chain (a card play, a blue-card action, a standard project, a
   * trade, a sitting of the parliament, …). The merge key. `undefined` for a
   * draw made outside any action scope: such a batch merges with nothing (the
   * coverage guard lists the producers that still deal that way).
   */
  actionId?: number;
  /** The FIRST segment's source — the batch's root cause (where it presents, R7). */
  source?: CardDrawRevealSource;
  /**
   * The runs of `cards` by cause, in dealing order (`Σ count === cards.length`).
   * Always present; a plain one-source draw is one segment.
   */
  segments: ReadonlyArray<CardIntakeSegment>;
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
   * SEALED — closed to further merging: a mandatory input of the recipient
   * stands (or stood) between this batch and the next draw of the same action
   * (R3). The next draw of the same `actionId` opens a NEW batch; the client
   * glues it to the sealed place `pendingAnswer` announced.
   */
  sealed?: true;
  /** What sealed it, when the rule names it (R6) — absent on a batch sealed by the recipient's ordinary answer. */
  pendingAnswer?: CardIntakePendingAnswer;
  /**
   * Cards of this batch the RULES already discarded, with no question asked — a mandatory discard that met a hand
   * holding no other card (`DiscardCards`: hand ≤ min). Pluto's «draw 1, then discard 1» on an empty hand draws the
   * card and throws it away at once (colony polish 1, К-5): the batch must still SHOW it (no silent loss), and must
   * never offer to TAKE it — it is not in the hand any more. Absent when nothing was auto-discarded.
   */
  autoDiscarded?: ReadonlyArray<CardName>;
};

/** The batch under the law's own name — `CardDrawRevealModel` is the historical spelling of the same type. */
export type CardIntakeBatchModel = CardDrawRevealModel;

/**
 * WHAT A READER NEEDS to ask «is this batch mine / parked?» — the root cause
 * and the causes: a server model, a client store entry or a bare `{source}`.
 * A claim answers for the batch when ANY segment is its (`intakeBatchSources`);
 * a park holds the batch by its ROOT (`source`).
 */
export type CardIntakeBatchRef = {
  source?: CardDrawRevealSource;
  segments?: ReadonlyArray<{source?: CardDrawRevealSource}>;
};

/** Every cause of a batch, in dealing order — the root alone when the segments are not known. */
export function intakeBatchSources(batch: CardIntakeBatchRef): ReadonlyArray<CardDrawRevealSource | undefined> {
  return batch.segments !== undefined && batch.segments.length > 0 ? batch.segments.map((s) => s.source) : [batch.source];
}

/** `Σ segments.count` — the honesty guard's left-hand side (must equal `cards.length`). */
export function intakeSegmentTotal(segments: ReadonlyArray<{count: number}>): number {
  return segments.reduce((n, s) => n + s.count, 0);
}

/**
 * The trade waves of a batch, for the colony-trade cinematic: the segments
 * that carry a trade `role`, or `undefined` when none does (a batch off a
 * trade — the readers' historical «no trade segments»). A trade-rooted batch
 * can carry a role-less segment too (a card's passive answering the trade):
 * it is read as income by `tradeRoleForIndex`.
 */
export function tradeSegmentsOf(segments: ReadonlyArray<{role?: ColonyTradeRevealRole, count: number}> | undefined): ReadonlyArray<ColonyTradeRevealSegment> | undefined {
  if (segments === undefined || !segments.some((s) => s.role !== undefined)) {
    return undefined;
  }
  return segments.map((s) => ({role: s.role ?? 'income', count: s.count}));
}
