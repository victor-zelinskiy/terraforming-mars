import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {MarsBotTrackRole} from '../../../common/automa/AutomaTypes';
import {PilePredicateId, PileAmountId} from './pilePredicates';
import {PlacementRegionId} from './placementRegions';
import {CalibrationLawId} from './calibration';

/**
 * THE BOT RULE OF ONE MILESTONE / AWARD — one declarative description per NAME, from which the interpreter
 * (`botMAInterpreter.ts`) derives everything that used to be four hand-kept tables: the bot's VALUE (and, for a
 * milestone, its target), its Corporate Competition HELPER, the TEXT the player reads, what the rule DEMANDS of a
 * mat (the random-set generator, docs/claude/marsbot-dynamic-ma-framework.md §3) and whether it is REACHABLE in a
 * configuration. The registry is `botMARules.ts`; adding a milestone / award name = one row there + its spec.
 *
 * A TRACK is addressed by what the rule MEANS (decision R10): by a TAG («the track the Jovian tag rides»), by a
 * printed PRODUCTION badge («the track with the energy badge»), and by its ROLE only where the original names the
 * row itself (Tradesman's «[Jovian/Energy], [Earth/City], [Venus]», Banker's «building and event»). On the ten
 * static boards a role and a badge always coincide; a tag moves from board to board (RB-C p.8), which is exactly why
 * a tag-counting criterion must follow the tag.
 */
export type TrackRef =
  | {readonly role: MarsBotTrackRole}
  | {readonly tag: Tag}
  | {readonly production: Resource};

/** A track SET: named refs, every track but Venus («martian»), or every track the mat has («all»). */
export type TrackSet = ReadonlyArray<TrackRef> | 'martian' | 'all';

/**
 * How many of the lowest positions an «every track» reading may ignore. `'venus'` = one when Venus Next is on —
 * Diversifier's «7 of the eight tracks» / Visionary's «2nd lowest if playing with Venus» (RB-C pp.2, 15).
 */
export type DropRule = number | 'venus';

/**
 * A pure counter the bot keeps outside its tracks and its tiles. Each is a FACT of `AutomaState` (or the player
 * model) the interpreter only reads.
 */
export type BotCounterId =
  | 'floaters' // Venus Next: the bot's floater pool (Hoverlord, RB-C p.2)
  | 'destroyedBonusCards' // Utopia Planitia's Specialist: the bot's permanently destroyed bonus cards (B11)
  | 'smallActionDeck' // Amazonis' Minimalist (home): 1 while at most 2 cards are left in the action deck, else 0
  | 'cities' // the bot's REAL city tiles on Mars (Landshaper's «owns 1+ city», RB-C p.13)
  | 'greeneries' // the bot's REAL greenery tiles (Landshaper's «owns 1+ greenery»)
  | 'tokens:data' // the bot's DATA tokens off its token cells (Dataminer — decision R8, Hoverlord's shape)
  | 'tokens:fighter'; // the bot's FIGHTER tokens off its token cells (Aeronaut — decision R8)

export type BotCriterion =
  /** One track's position, `× times ÷ div` (floored) `+ plus`. */
  | {readonly kind: 'track', readonly track: TrackRef, readonly plus?: number, readonly times?: number, readonly div?: number}
  /**
   * A reading over a SET of tracks. `sum` / `max` / `min` (with `drop` — the least-advanced positions it may
   * ignore) / `countAtLeast` (how many reach `at`) / `sumTop` (the `top` most-advanced, summed — Producer's «any three
   * tracks combined»). The result is `× times` then `+ plus`. A named ref the mat does not
   * have reads 0 (Venus without Venus Next — the honest answer for a criterion that names a track nobody has).
   */
  | {readonly kind: 'tracks', readonly op: 'sum' | 'max' | 'min' | 'countAtLeast' | 'sumTop', readonly of: TrackSet,
     readonly drop?: DropRule, readonly at?: number, readonly top?: number, readonly times?: number, readonly plus?: number,
     /** A named ref the mat does not have: read as 0 (default — the honest reading of a printed sheet) or left out of the set. */
     readonly missing?: 'zero' | 'leave-out'}
  /** The bot's M€, `÷ per` (floored). */
  | {readonly kind: 'megacredits', readonly per?: number}
  /**
   * MarsBot's PLAYED PILE — it has no tableau, so every «cards in play» criterion reads the pile. `count` = cards
   * matching a predicate; `sum` = a per-card amount summed; `minOf` = the weakest of several counts (complete sets).
   */
  | {readonly kind: 'pile', readonly count: PilePredicateId, readonly plus?: number}
  | {readonly kind: 'pile', readonly sum: PileAmountId, readonly plus?: number}
  | {readonly kind: 'pile', readonly minOf: ReadonlyArray<PilePredicateId>, readonly plus?: number}
  /** «As usual» — the PLAYER's own metric read on the bot, because it honestly has that quantity where it looks. */
  | {readonly kind: 'player'}
  /** The bot's terraform rating `+ plus` (Benefactor's evaluation-only −15). */
  | {readonly kind: 'rating', readonly plus?: number}
  /** A bot counter (`BotCounterId`). */
  | {readonly kind: 'counter', readonly counter: BotCounterId}
  /**
   * Several conditions at once (Landshaper: «1+ city AND 1+ greenery AND the building track at 5»). The value is the
   * number of parts met — the player's own scale when the human milestone counts its parts the same way.
   */
  | {readonly kind: 'allOf', readonly of: ReadonlyArray<{readonly criterion: BotCriterion, readonly target: number}>}
  /** THE ONE honest zero (decision R5): the bot owns nothing this counts, and the reason is said in words. */
  | {readonly kind: 'zero', readonly reasonKey: string};

/** A track the helper picks: one ref, or the least / most advanced of a set (ties → the set's printed order). */
export type HelperTrack =
  | TrackRef
  | {readonly pick: 'least' | 'most', readonly of: ReadonlyArray<TrackRef>};

export type BotHelper =
  /** «Advance the X track» — the ordinary tag-style advancement (landing action, chain, events, review). */
  | {readonly kind: 'advance', readonly track: HelperTrack}
  /**
   * «Advance the least-advanced track» (B28 Diversification's form — the board's own `getLeastAdvancedTrackIndex`,
   * topmost on ties; that track maxed ⇒ impossible) or «the most-advanced track that can still move» (Mogul, B12).
   */
  | {readonly kind: 'advanceExtreme', readonly which: 'least' | 'mostMovable'}
  /** «MarsBot places a greenery / city tile» — the ordinary bot pipeline; `restrict` is a HARD constraint. */
  | {readonly kind: 'greenery' | 'city', readonly restrict?: PlacementRegionId}
  /** «Reveal until a <matching> card, resolve it» (+ M€; `free` = does not cost the card's 5 M€ — Forecaster). */
  | {readonly kind: 'reveal', readonly predicate: PilePredicateId, readonly gainMegacredits?: number, readonly free?: boolean}
  /** «MarsBot raises its TR N steps» (Benefactor, B10). */
  | {readonly kind: 'raiseRating', readonly steps: number}
  /** «You must remove the highest-scoring animal / microbe cube» (Excentric, B09 — B02 Invasive Species' resolver). */
  | {readonly kind: 'cubeAttack'}
  /** The bot's ONE political door (`castBotVote`) — T. Politician (home). */
  | {readonly kind: 'delegate'}
  /** No helper — the card then tries the next funded award; the reason is said on the card face. */
  | {readonly kind: 'none', readonly reasonKey: string};

/** Where a rule comes from — an official sheet / page, or a HOME rule with its official analog. */
export type BotMAProvenance =
  | {readonly source: 'RB-A' | 'RB-C' | 'B08' | 'B09' | 'B10' | 'B11' | 'B12' | 'B13', readonly page?: number}
  | {readonly source: 'home', readonly analog: string, readonly law?: CalibrationLawId};

export type BotMilestoneRule = {
  readonly criterion: BotCriterion;
  /**
   * What the criterion must reach — a CONSTANT of the name (decision R3: never moved from game to game), or
   * `'printed'` = the milestone's own printed threshold (the played-pile family, whose bot metric IS the human's,
   * so the displayed normalization is the identity). Absent for the `player` / `zero` criteria.
   */
  readonly target?: number | 'printed';
  /** Fallback when `'printed'` meets a milestone with no numeric threshold — never a division by zero. */
  readonly printedFallback?: number;
  /**
   * What the bot PAYS when it claims (Briber: «Has 20 MC+, lose 12 MC», RB-C p.13) — on top of the free claim the
   * track action gives it.
   */
  readonly claimCost?: {readonly megacredits: number};
  /**
   * How the bot's progress is SHOWN when the human milestone prints no numeric threshold: `'flag'` = 1 when met,
   * else 0 — the very scale the human row uses (Merchant). Absent = the raw value (Briber shows M€ like the human).
   */
  readonly display?: 'flag';
  /**
   * A PAIRING the criterion's calibration assumes (the generator's topology layer): Planetologist's «Jovian/Earth +
   * Venus at 5» (B12) counts the Jovian tags only while Jovian rides the Earth track.
   */
  readonly pair?: readonly [Tag, Tag];
  /**
   * The criterion a RANDOM-SET game reads where it must differ from the printed sheet's (the generator's games only —
   * a fixed-row game keeps its sheet, decision R1). Tradesman names the Venus track (B11): on Utopia without Venus Next
   * that is the sheet's own answer, but a random set has no sheet, and a criterion naming a track nobody has would be
   * the zero the framework forbids — so it leaves the absent track out (Planner's «every track except Venus»).
   */
  readonly randomSetCriterion?: BotCriterion;
  readonly provenance: BotMAProvenance;
};

export type BotAwardRule = {
  readonly criterion: BotCriterion;
  readonly helper: BotHelper;
  readonly provenance: BotMAProvenance;
};
