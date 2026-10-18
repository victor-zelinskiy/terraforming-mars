import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {SpaceId} from '@/common/Types';
import {Units} from '@/common/Units';
import {GlobalParameter} from '@/common/GlobalParameter';
import {tileTypeToString} from '@/common/TileType';
import {GameEvent} from '@/common/events/GameEvent';
import {DeckSearchFact, EventImpact, SkippedEffectFact} from '@/common/events/EventImpact';
import {DrawSearchModel} from '@/common/models/CardDrawRevealModel';
import {AdjacencyVpChange} from '@/common/boards/TileMove';
import {EventSource, ParliamentRule, sourceKey} from '@/common/events/EventSource';
import {resolutionName} from '@/client/parliament/ClientParliamentManifest';
import {GREENERY_TILE_TR_SOURCE_NAME} from '@/common/parliament/winnerReward';
import {DELEGATE_ICON, NEUTRAL_DELEGATE_ICON, influenceAtAgenda} from '@/common/parliament/ParliamentTypes';
import {PartyName} from '@/common/turmoil/PartyName';
import {TRADE_FLEET_ICON} from '@/common/colonies/tradeFleet';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyRosterChange} from '@/common/colonies/ColonyRoster';

/**
 * The NAME of a parliament-sourced event (Turmoil Redux), shared by the journal
 * row and the notification's cause line: a rule the player knows by its own
 * name speaks for itself — the greenery revision's TR is «Greenery tile», the
 * same word the TR breakdown and the placement dossier use — and everything
 * else the rulebook does reads as the institution.
 */
export function parliamentSourceLabel(source: {kind: 'parliament'; rule?: ParliamentRule}): string {
  switch (source.rule) {
  case 'greenery-tile':
    return GREENERY_TILE_TR_SOURCE_NAME;
  default:
    return 'Mars Parliament';
  }
}

/**
 * PURE formatter that turns the structured {@link GameEvent}s of ONE correlation
 * chain into premium journal child rows. The unit is ONE MEANINGFUL SOURCE
 * CONTRIBUTION, not one raw event: every delta sharing the same
 * `bucket + source + recipient + target` is MERGED into a single
 * `source → impact · impact` row (a payment's M€+titanium become one "Оплата"
 * row; a card's two production gains become one row). What is NEVER merged:
 * different RECIPIENTS (Nastya's bonus vs Victor's Pets stay separate rows) and
 * different semantic BUCKETS (a cell bonus vs an ocean bonus). EVERY row keeps
 * an explicit source (card chip / "Оплата" / "Бонус клетки" / …) — a row is
 * never source-less. No Vue / DOM / i18n: icons are keys for `iconClassFor`,
 * labels are English i18n keys. Unit-testable.
 */

export type JournalImpactChip = {
  /** Icon key for `iconClassFor` (resource / card-resource / 'tr' / 'cards' / global param). */
  icon: string;
  /** Pre-formatted signed amount, e.g. '+2', '−2'. */
  text: string;
  /** A production delta (rendered with a production frame). */
  production?: boolean;
  /** A discount / cost reduction (a SAVING, not a spend) — distinct tone. */
  saved?: boolean;
  /**
   * A NEUTRAL before → after readout (a global-parameter change,
   * "−28°→−26°") — never tinted positive/negative from its leading sign.
   */
  neutral?: boolean;
  /**
   * A COUNTED gain's reason (PL-195 — «+14 [микроб] · за 14 тайлов на Марсе», «+4 [data] · за 4 проданных патента»):
   * the event's own `basis`, carried by its chip so a card that sums pills keeps it as a pill of its own — never
   * merged into a plain gain of the same resource, never a bare number nobody can account for.
   */
  basis?: {count: number; unitKey: string};
};

export type JournalChildSource =
  | {kind: 'card'; card: CardName}      // interactive card / corp / standard-project chip
  | {kind: 'label'; label: string}      // semantic source (i18n key): Cell bonus, Ocean bonus, …
  | {kind: 'none'};                      // the action's own result — no redundant chip

/**
 * Semantic category of a child row — keeps unlike contributions in DISTINCT rows
 * (a cell bonus never merges with an ocean bonus) and drives the row's accent.
 */
export type JournalChildBucket =
  | 'payment' | 'discount' | 'placement' | 'spaceBonus' | 'oceanBonus'
  | 'copied' | 'effect' | 'colony' | 'globalParameter' | 'production'
  | 'card' | 'system'
  /** An effect that could NOT apply (`effect-skipped`) — named, never summed. */
  | 'skipped'
  /** A conditional draw search (`deck-searched`, PL-033) — what the deck turned over, never summed. */
  | 'search'
  /** A requirement met ONLY thanks to a modifier (`requirement-eased`, TR49 class) — named, never summed. */
  | 'requirement';

/**
 * A CONDITIONAL DRAW SEARCH, read for its row (`deck-searched`, PL-033): the
 * rule (the server's ONE descriptor — the row draws it with the same
 * renderer as the reveal and the composer's chip), the counts, the
 * thrown-away cards by name in reveal order, and whether the deck ran out.
 */
export type JournalSearchRow = {
  rule?: DrawSearchModel;
  revealed: number;
  kept: number;
  discarded: ReadonlyArray<CardName>;
  exhausted: boolean;
};

export type JournalChildVM = {
  source: JournalChildSource;
  /** Recipient, only when it differs from the root actor. */
  player?: Color;
  chips: ReadonlyArray<JournalImpactChip>;
  /** Semantic bucket (theming + grouping). */
  bucket: JournalChildBucket;
  /** tile-placed extras. */
  space?: SpaceId;
  tileLabel?: string;
  /**
   * The COLONY TILE the tile was laid on (`EventImpact.colonyTile` — a hosted cell, TR22 Nova City). Such a cell is
   * not on the Mars board: the row names the colony tile and offers NO map locator.
   */
  colonyTile?: ColonyName;
  /** copied-action extra. */
  copiedCard?: CardName;
  /**
   * WHERE a political chip landed (Turmoil Redux): the RESOLUTION a delegate
   * was placed on (`delegates-placed`), or the PARTY whose Popular Support
   * took the neutral delegates, with what its area holds now
   * (`popular-support-gained`). Ids and enum values — the row names them
   * through the parliament manifest / the party's own key, never a log line.
   */
  political?:
    | {kind: 'resolution'; resolution: string}
    | {kind: 'support'; party: PartyName; total: number}
    /** A WALK of the Agenda track (`agenda-advanced`, TR04): from → to and the influence level the walk set. */
    | {kind: 'agenda'; from: number; to: number; level: number}
    /** A colony TILE's track moved by a card effect (`colony-track-moved`, TR07): the tile, 0-based before → after. */
    | {kind: 'colonyTrack'; colony: ColonyName; before: number; after: number}
    /** THE COLONY ROSTER changed (`colony-roster-changed`): a tile entered, left, or was replaced in its slot. */
    | {kind: 'colonyRoster'; change: ColonyRosterChange};
  /**
   * An effect that could NOT apply (`effect-skipped`): WHICH (`label`), WHY
   * (`reason`), and the magnitude lost as a chip of its own. Deliberately
   * OUTSIDE `chips`: nothing moved, so the pills that sum `chips` (the
   * notification's headline, its ownership clusters) must never count a lost
   * «+4» as a gain. `chips` stays empty on such a row.
   */
  skipped?: {label: string; reason: string; chip?: JournalImpactChip};
  /**
   * A conditional draw search (`deck-searched`, PL-033): «Вскрыто 6 · получено
   * 3 · сброшено 3 [Водоросли] [Муравьи] [Рыбы] — без меток [P][M][A]».
   * Deliberately OUTSIDE `chips` (like `skipped`): the kept cards are the
   * ordinary «+3 [cards]» row beside it, so a pill summing `chips` must never
   * count the search a second time. `chips` stays empty on such a row.
   */
  search?: JournalSearchRow;
  /**
   * WHY a card-resource amount is what it is, when a rule counted it
   * (`EventImpact.cardResources[].basis` — Arboretum's «+3 data · for 3
   * adjacent cities»), and the CARD the units landed on. Its own row, never
   * merged: the reason belongs to that one payout.
   */
  basis?: {count: number; unitKey: string; onCard?: CardName};
  /**
   * The CARD a card-resource change landed on, when it is not the card whose effect moved it (TR48's «+2 data on
   * ANY card», Predators eating another card's animal, a colony's floater …): «Суперкомпьютер → [data] +2 ·
   * [Марсианская перепись]». Without it the row read as the SOURCE card gaining the units — a rival's journal
   * said «Суперкомпьютер +2» about data that lay on the census (the TR48 walk). Its own row per target, never merged.
   */
  onCard?: CardName;
  /**
   * A REQUIREMENT MET ONLY THANKS TO A MODIFIER (`requirement-eased`, TR49 class): the modifier is the row's
   * source, the requirements it let through ride here — «[t°] 2 → −2» for a shift, the scale struck for a waiver —
   * with `oneShot` when the play spent it. Deliberately OUTSIDE `chips`: nothing moved, so no pill may sum it.
   */
  eased?: JournalEasedRow;
};

/** One requirement a modifier let through, as the journal's row reads it. */
export type JournalEasedRow = {
  kind: 'shift' | 'waive' | 'ally';
  steps?: number;
  oneShot: boolean;
  /** `ally` (TR62): the partner party whose printed road met the requirement. */
  via?: PartyName;
  /** A global parameter's scale — or (TR70) the PARTY whose requirement was lifted (its emblem is the row's icon). */
  requirements: ReadonlyArray<{parameter?: GlobalParameter; party?: PartyName; printed: number; effective: number | 'waived' | 'allied'; max: boolean}>;
};

/** The colony TILE's own glyph as a chip icon (`iconClassFor` → the printed pill). */
export const COLONY_TILE_ICON = 'colony-tile';

const UNIT_KEYS: ReadonlyArray<keyof Units> = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

function signed(n: number): string {
  // Use a real minus sign for negatives (premium typography).
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

function paramLabel(p: GlobalParameter): string {
  switch (p) {
  case GlobalParameter.TEMPERATURE: return 'Temperature';
  case GlobalParameter.OXYGEN: return 'Oxygen';
  case GlobalParameter.OCEANS: return 'Oceans';
  case GlobalParameter.VENUS: return 'Venus';
  default: return 'Global parameter';
  }
}

/** Turn a factual impact into renderable chips. */
export function impactChips(impact: EventImpact): Array<JournalImpactChip> {
  const chips: Array<JournalImpactChip> = [];
  if (impact.megacreditsSaved !== undefined && impact.megacreditsSaved !== 0) {
    chips.push({icon: 'megacredits', text: `−${impact.megacreditsSaved}`, saved: true});
  }
  if (impact.stock !== undefined) {
    for (const k of UNIT_KEYS) {
      const v = impact.stock[k];
      if (v !== undefined && v !== 0) {
        chips.push({icon: k, text: signed(v)});
      }
    }
  }
  if (impact.production !== undefined) {
    for (const k of UNIT_KEYS) {
      const v = impact.production[k];
      if (v !== undefined && v !== 0) {
        chips.push({icon: k, text: signed(v), production: true});
      }
    }
  }
  if (impact.cardResources !== undefined) {
    for (const cr of impact.cardResources) {
      if (cr.amount !== 0) {
        chips.push({icon: cr.cardResource, text: signed(cr.amount)});
      }
    }
  }
  if (impact.tr !== undefined && impact.tr !== 0) {
    chips.push({icon: 'tr', text: signed(impact.tr)});
  }
  // Turmoil Redux: a delegate an effect placed on a resolution, neutral
  // delegates an effect added to a party's Popular Support.
  if (impact.delegates !== undefined && impact.delegates.count !== 0) {
    // A NEUTRAL vote a card placed (TR31) wears the dark figure, never the event player's colour: the cube is nobody's.
    chips.push({icon: impact.delegates.neutral === true ? NEUTRAL_DELEGATE_ICON : DELEGATE_ICON, text: signed(impact.delegates.count)});
  }
  if (impact.popularSupport !== undefined && impact.popularSupport.gained !== 0) {
    chips.push({icon: NEUTRAL_DELEGATE_ICON, text: signed(impact.popularSupport.gained)});
  }
  if (impact.cardsDrawn !== undefined && impact.cardsDrawn !== 0) {
    chips.push({icon: 'cards', text: signed(impact.cardsDrawn)});
  }
  if (impact.globalParameter !== undefined && impact.globalParameter.steps !== 0) {
    chips.push({icon: impact.globalParameter.parameter, text: signed(impact.globalParameter.steps)});
  }
  return chips;
}

/**
 * The card a card-resource change LANDED on, when it is not the event's source card — undefined when it landed on
 * the source itself (Supercomputer's data onto Supercomputer: the row's lead already names it) or names no card.
 */
function landedElsewhere(e: GameEvent): CardName | undefined {
  const moved = e.impact.cardResources?.find((cr) => cr.amount !== 0 && cr.target !== undefined);
  if (moved?.target === undefined) {
    return undefined;
  }
  const source = e.source?.kind === 'card' ? e.source.card : undefined;
  return moved.target === source ? undefined : moved.target as CardName;
}

/**
 * The display shape of a skipped effect (`effect-skipped`): its i18n label and
 * cause, and the magnitude it would have moved as a chip — a gain on the
 * player's own card reads «+4», a cost on someone else's pool «−3»; the row
 * draws it struck through. A production attack keeps its production frame.
 */
export function skippedRowOf(fact: SkippedEffectFact): {label: string; reason: string; chip?: JournalImpactChip} {
  const e = fact.effect;
  const chip: JournalImpactChip | undefined = e === undefined ? undefined : {
    icon: e.icon,
    text: e.direction === 'gain' ? `+${e.amount}` : `−${e.amount}`,
    ...(e.note === 'production' ? {production: true} : {}),
  };
  return {label: fact.label, reason: fact.reason, ...(chip === undefined ? {} : {chip})};
}

/** The display shape of a conditional draw search (`deck-searched`) — the server's fact as is, the exhaustion a plain boolean. */
export function searchRowOf(fact: DeckSearchFact): JournalSearchRow {
  return {
    ...(fact.rule === undefined ? {} : {rule: fact.rule}),
    revealed: fact.revealed,
    kept: fact.kept,
    discarded: [...fact.discarded],
    exhausted: fact.exhausted === true,
  };
}

/**
 * The search row's COUNTS as a reading (an English i18n key + its params —
 * printed through the one renderer, `console/readingText`, never by hand):
 * «Вскрыто 6 · получено 3 · сброшено 3» — the thrown-away names follow it;
 * a search that threw nothing away still says how many it turned over
 * («Вскрыто 2 · получено 2»).
 */
export function searchTallyReading(row: JournalSearchRow): {label: string; params: ReadonlyArray<string>} {
  return row.discarded.length > 0 ?
    {label: 'Turned over ${0} · received ${1} · thrown away ${2}', params: [String(row.revealed), String(row.kept), String(row.discarded.length)]} :
    {label: 'Turned over ${0} · received ${1}', params: [String(row.revealed), String(row.kept)]};
}

// Every event maps to an EXPLICIT source — the action's own results show the
// action card itself, payments read "Payment", bonuses get a semantic label —
// so a child row is never source-less.
function sourceToChild(source: EventSource | undefined): JournalChildSource {
  if (source === undefined) {
    return {kind: 'none'};
  }
  switch (source.kind) {
  case 'card':
  case 'corporation':
  case 'standardProject':
    return {kind: 'card', card: source.card};
  case 'spaceBonus':
    return {kind: 'label', label: 'Cell bonus'};
  case 'oceanBonus':
    return {kind: 'label', label: 'Ocean bonus'};
  case 'payment':
    return {kind: 'label', label: 'Payment'};
  case 'production':
    // The phase's three lines (TR61): the production values, the rating's M€, the energy turned into heat.
    return {kind: 'label', label: source.part === 'rating' ? 'Terraform rating' : source.part === 'conversion' ? 'Energy conversion' : 'Production'};
  case 'globalParameter':
    return {kind: 'label', label: paramLabel(source.parameter)};
  case 'colony':
    // A colony produces THREE kinds of benefit that all share `kind:'colony'`;
    // label them distinctly so a trade's REWARD and the colony-owner BONUS don't
    // both read as the bare colony name. The colony itself is named in the group
    // header ("traded with Europa"), so the rows say WHAT each gain is.
    if (source.benefit === 'trade') {
      return {kind: 'label', label: 'Trade income'};
    }
    if (source.benefit === 'colonyBonus') {
      return {kind: 'label', label: 'Colony bonus'};
    }
    // 'build' (a card built this colony — its group header is the CARD, not the
    // colony) or a legacy event with no role → show WHICH colony.
    return {kind: 'label', label: source.name};
  case 'milestone':
  case 'award':
  case 'globalEvent':
  case 'party':
    return {kind: 'label', label: source.name};
  // Turmoil Redux: an enacted resolution names itself; the parliament's own
  // rules read as the institution — except the one with a name of its own.
  case 'resolution':
    return {kind: 'label', label: resolutionName(source.id)};
  case 'parliament':
    return {kind: 'label', label: parliamentSourceLabel(source)};
  default:
    return {kind: 'none'};
  }
}

const MARKER_TYPES = new Set(['effect-triggered', 'copied-action']);

/** The semantic bucket a raw event belongs to (keeps unlike rows distinct). */
function bucketFor(e: GameEvent): JournalChildBucket {
  if (e.type === 'effect-skipped') {
    return 'skipped';
  }
  if (e.type === 'deck-searched') {
    return 'search';
  }
  if (e.type === 'tile-placed' || e.type === 'tile-moved' || e.type === 'tile-removed') {
    return 'placement';
  }
  if (e.type === 'copied-action') {
    return 'copied';
  }
  if (e.type === 'effect-triggered') {
    return 'effect';
  }
  if (e.type === 'discount-applied') {
    return 'discount';
  }
  if (e.type === 'requirement-eased') {
    return 'requirement';
  }
  switch (e.source?.kind) {
  case 'payment': return 'payment';
  case 'spaceBonus': return 'spaceBonus';
  case 'oceanBonus': return 'oceanBonus';
  case 'colony': return 'colony';
  case 'globalParameter': return 'globalParameter';
  case 'production': return 'production';
  case 'card':
  case 'corporation':
  case 'standardProject': return 'card';
  default: return 'system';
  }
}

/**
 * Identity used for merging — `sourceKey` PLUS any sub-role that must keep two
 * same-source contributions in DISTINCT rows (a colony's trade reward vs its
 * colony-owner bonus share `sourceKey` 'colony:Europa' but are different gains).
 */
function sourceDiscriminator(source: EventSource | undefined): string {
  if (source?.kind === 'colony' && source.benefit !== undefined) {
    return `${sourceKey(source)}#${source.benefit}`;
  }
  return sourceKey(source);
}

/** The CARD heading the chain (a card / corp / standard project root), if any. */
function rootCardOf(events: ReadonlyArray<GameEvent>, rootId: number): CardName | undefined {
  const root = events.find((e) => e.id === rootId);
  const s = root?.source;
  if (s !== undefined && (s.kind === 'card' || s.kind === 'corporation' || s.kind === 'standardProject')) {
    return s.card;
  }
  return undefined;
}

/**
 * The display PRIORITY tier of a child row — GAINS read first, the cost reads
 * last, so the player sees what they GOT before what they paid:
 *   0 — what the ACTION ITSELF produced (the root card's own result + the tile
 *       it placed): the most direct "what I got";
 *   1 — INDIRECT gains from other effects (bonuses, other cards, colony income);
 *   2 — discounts (cost reductions — a saving, but cost-related so after gains);
 *   3 — payment + any net LOSS (what was spent / lost);
 *   4 — an effect that could NOT apply (nothing moved) — the closing note.
 * A stable sort within a tier preserves the chronological story.
 */
function childTier(vm: JournalChildVM, rootCard: CardName | undefined): number {
  if (vm.bucket === 'skipped') {
    return 4;
  }
  if (vm.bucket === 'payment') {
    return 3;
  }
  const meaningful = vm.chips.filter((c) => c.saved !== true);
  const allNegative = meaningful.length > 0 && meaningful.every((c) => c.text.startsWith('−'));
  if (allNegative) {
    return 3; // a net loss → grouped with the cost, last
  }
  if (vm.bucket === 'discount') {
    return 2;
  }
  if (vm.space !== undefined) {
    return 0; // a placed tile is the action's own direct result
  }
  if (vm.source.kind === 'none') {
    return 0; // the action's bare own result
  }
  if (vm.source.kind === 'card' && rootCard !== undefined && vm.source.card === rootCard) {
    return 0; // the root card crediting itself
  }
  return 1; // an indirect gain from another source
}

/**
 * Build the GROUPED child rows for a correlation chain. `events` are the
 * GameEvents whose `correlationId` === `rootId` (the root action event included).
 * Deltas sharing `bucket + source + recipient + target` collapse to ONE row;
 * different recipients / buckets stay separate. First-occurrence order (the
 * chronological story of the action) is preserved.
 */
export function buildEventChildren(events: ReadonlyArray<GameEvent>, rootId: number, rootPlayer: Color | undefined): Array<JournalChildVM> {
  const byId = new Map<number, GameEvent>();
  for (const e of events) {
    byId.set(e.id, e);
  }
  const recipient = (e: GameEvent): Color | undefined => (e.player !== undefined && e.player !== rootPlayer ? e.player : undefined);

  // Fold each impact event parented to a marker into that marker's chips.
  const foldedChips = new Map<number, Array<JournalImpactChip>>();
  const consumed = new Set<number>();
  for (const e of events) {
    // A MARKER never folds into a marker: an effect that answers ANOTHER effect (Topsoil Contract paying for the
    // microbe Decomposers just took — a chain of triggers inside one play) is its OWN contribution. Folded, it took
    // its children with it: the marker carried no chips of its own, the children it had collected were never read,
    // and the rival's card summed «+14 M€» for a play that paid 15 (TR45, 2026-10-12).
    if (e.id === rootId || e.parentId === undefined || MARKER_TYPES.has(e.type)) {
      continue;
    }
    // …and a COUNTED card-resource gain never folds either: its reason («for 3 patents sold» — TR46 answering the
    // sale from inside its effect scope) is a row of its own, under the same source. Folded into the marker, the
    // number reached the journal and the rival without the reason it was counted by.
    if (e.type === 'card-resource-changed' && e.impact.cardResources?.some((cr) => cr.basis !== undefined) === true) {
      continue;
    }
    // …and a SEARCH never folds (PL-033): it carries no chip, so folded into an effect's marker (Faraday's «draw a
    // card with that tag») it would vanish without a trace — it is a row of its own under the effect's source.
    if (e.type === 'deck-searched') {
      continue;
    }
    const parent = byId.get(e.parentId);
    if (parent !== undefined && MARKER_TYPES.has(parent.type)) {
      const arr = foldedChips.get(e.parentId) ?? [];
      arr.push(...impactChips(e.impact));
      foldedChips.set(e.parentId, arr);
      consumed.add(e.id);
    }
  }

  // Merge by group key into ONE row per meaningful source contribution, keeping
  // first-occurrence order. A growing `chips` array lives on each entry.
  type Entry = {vm: JournalChildVM; chips: Array<JournalImpactChip>};
  const ordered: Array<Entry> = [];
  const byKey = new Map<string, Entry>();
  const push = (key: string, vm: JournalChildVM, chips: ReadonlyArray<JournalImpactChip>): void => {
    const existing = byKey.get(key);
    if (existing === undefined) {
      const entry: Entry = {vm, chips: [...chips]};
      byKey.set(key, entry);
      ordered.push(entry);
    } else {
      existing.chips.push(...chips);
    }
  };

  for (const e of events) {
    if (e.id === rootId || consumed.has(e.id) || e.type === 'action' || e.type === 'payment') {
      continue;
    }
    const bucket = bucketFor(e);
    const player = recipient(e);
    // THE CAPITALS' RECOUNT (PL-041 / PL-141): a Capital one adjacent ocean poorer or richer by this placement,
    // removal or move is ITS OWNER's row — the fact the event carries, never a number the journal derives from
    // the board.
    const pushCapitalRecount = (key: string, changes: ReadonlyArray<AdjacencyVpChange> | undefined): void => {
      for (const change of changes ?? []) {
        const delta = change.after - change.before;
        push(`${key}-capital|${e.id}|${change.space}`, {
          source: {kind: 'label', label: delta < 0 ? 'Capital loses an adjacent ocean' : 'Capital gains an adjacent ocean'},
          player: change.player, bucket,
          chips: [],
          space: change.space,
        }, [{icon: 'vp', text: signed(delta)}]);
      }
    };
    if (e.type === 'tile-placed') {
      // Each placed tile is its OWN row (never merged) — keyed by event id.
      push(`placement|${e.id}`, {
        source: {kind: 'label', label: 'Placement'},
        player, bucket,
        chips: [],
        space: e.space,
        tileLabel: e.tile !== undefined ? tileTypeToString[e.tile] : undefined,
        ...(e.impact.colonyTile !== undefined ? {colonyTile: e.impact.colonyTile} : {}),
      }, []);
      pushCapitalRecount('placement', e.impact.adjacencyVp);
      continue;
    }
    if (e.type === 'tile-removed') {
      // A REMOVAL (the Reds' action, RX33, Kaguya Tech) is its own row: the tile that left and the cell it left.
      push(`removal|${e.id}`, {
        source: {kind: 'label', label: 'Tile removal'},
        player, bucket,
        chips: [],
        space: e.space,
        tileLabel: e.tile !== undefined ? tileTypeToString[e.tile] : undefined,
      }, []);
      pushCapitalRecount('removal', e.impact.adjacencyVp);
      continue;
    }
    if (e.type === 'tile-moved') {
      // A MOVE (TR14 Re-settlement) is its own row too: the tile that travelled and the cell it CAME TO. Nothing was
      // placed (`tilesPlaced` did not grow) — the row says so by its label; what the new cell paid follows as the
      // ordinary reward rows.
      push(`move|${e.id}`, {
        source: {kind: 'label', label: 'Tile relocation'},
        player, bucket,
        chips: [],
        space: e.space,
        tileLabel: e.tile !== undefined ? tileTypeToString[e.tile] : undefined,
      }, []);
      pushCapitalRecount('move', e.impact.tileMove?.adjacencyVp);
      continue;
    }
    if (e.type === 'effect-skipped' && e.impact.skipped !== undefined) {
      // Each skipped effect is its OWN row (never merged — two lost effects are
      // two statements), keyed by event id; its magnitude rides `skipped.chip`.
      push(`skipped|${e.id}`, {source: sourceToChild(e.source), player, bucket, chips: [], skipped: skippedRowOf(e.impact.skipped)}, []);
      continue;
    }
    if (e.type === 'requirement-eased' && e.impact.requirementEased !== undefined) {
      // A REQUIREMENT MET THANKS TO A MODIFIER (TR49 class) is its OWN row under the play, the modifier as its source:
      // «Особая разработка · ТРЕБОВАНИЕ [t°] 2 → −2 · один розыгрыш». Never summed (nothing moved).
      const fact = e.impact.requirementEased;
      push(`eased|${e.id}`, {source: sourceToChild(e.source), player, bucket, chips: [], eased: {
        kind: fact.kind,
        ...(fact.steps !== undefined ? {steps: fact.steps} : {}),
        ...(fact.via !== undefined ? {via: fact.via} : {}),
        oneShot: fact.oneShot,
        requirements: fact.requirements.map((r) => ({
          ...(r.parameter !== undefined ? {parameter: r.parameter} : {}),
          ...(r.party !== undefined ? {party: r.party} : {}),
          printed: r.printed, effective: r.effective, max: r.max,
        })),
      }}, []);
      continue;
    }
    if (e.type === 'deck-searched' && e.impact.deckSearch !== undefined) {
      // A SEARCH is its OWN row (PL-033), keyed by event id — two searches of one play (Planetary Alliance: a Jovian,
      // then a Venus card) are two statements. Its counts and names ride `search`, never `chips`: the kept cards
      // are the ordinary «+N [cards]» row beside it.
      push(`search|${e.id}`, {source: sourceToChild(e.source), player, bucket, chips: [], search: searchRowOf(e.impact.deckSearch)}, []);
      continue;
    }
    if ((e.type === 'delegates-placed' || e.type === 'neutral-delegates-placed') && e.impact.delegates !== undefined) {
      // Its OWN row (never merged into the card's other gains): the chip needs
      // its address — which resolution the delegate stands on. A NEUTRAL vote
      // a card placed (TR31) is the same row with the dark figure as its chip.
      push(`delegates|${e.id}`, {source: sourceToChild(e.source), player, bucket, chips: [],
        political: {kind: 'resolution', resolution: e.impact.delegates.resolution}}, impactChips(e.impact));
      continue;
    }
    if (e.type === 'agenda-advanced' && e.impact.agenda !== undefined) {
      // Its OWN row: the chip is the STEPS walked («+2» — a pill sums it like any gain), the political label the
      // POSITION fact («Карьера 1 → 3 · Влияние 2»); the steps' TR and card are their own chokepoint rows beside
      // it, never summed into this one.
      const agenda = e.impact.agenda;
      push(`agenda|${e.id}`, {source: sourceToChild(e.source), player, bucket, chips: [],
        political: {kind: 'agenda', from: agenda.from, to: agenda.to, level: influenceAtAgenda(agenda.to)}},
      [{icon: 'agenda', text: signed(agenda.to - agenda.from)}]);
      continue;
    }
    if (e.type === 'colony-track-moved' && e.impact.colonyTrackMove !== undefined) {
      // A COLONY TRACK MOVED BY A CARD (TR07 Colony Sponsors): its OWN row under the card — the chip is the
      // STEPS («+4», the printed colony-tile pill), the label the POSITION fact on the tile («Трек колонии ·
      // Луна 3 → 7», the tile's own 1-based readout). The track is nobody's stock, so nothing else says it.
      const move = e.impact.colonyTrackMove;
      push(`colonyTrack|${e.id}`, {source: sourceToChild(e.source), player, bucket, chips: [],
        political: {kind: 'colonyTrack', colony: move.colony, before: move.before, after: move.after}},
      [{icon: COLONY_TILE_ICON, text: signed(move.after - move.before)}]);
      continue;
    }
    if (e.type === 'colony-roster-changed' && e.impact.colonyRoster !== undefined) {
      // THE COLONY ROSTER CHANGED (Aridor, the solo trim, TR10 Fringe Colony): its OWN row under the giver. The
      // label names the tiles («− Церера · + Ио»); the chip is the NET count of tiles in play — «+1» for an
      // addition, «−1» for a removal, none for a replacement (the table keeps its size; a pill sums chips, and
      // «−1 +1» of one icon would read as nothing happening).
      const change = e.impact.colonyRoster;
      const net = change.kind === 'add' ? 1 : change.kind === 'remove' ? -1 : 0;
      push(`colonyRoster|${e.id}`, {source: sourceToChild(e.source), player, bucket, chips: [],
        political: {kind: 'colonyRoster', change}},
      net === 0 ? [] : [{icon: COLONY_TILE_ICON, text: signed(net)}]);
      continue;
    }
    if (e.type === 'fleet-docked') {
      // A TRADE FLEET WENT TO A CARD (a fleet dock — TR06 Water Hauling): its OWN row under the card. The
      // chip is the fleet that left the supply for the generation («−1» — it reads with the trade's cost, where
      // it belongs); the card it stands on is the row's source. The reward (an ocean, a TR step) is its own row.
      push(`fleet|${e.id}`, {source: sourceToChild(e.source), player, bucket, chips: []}, [{icon: TRADE_FLEET_ICON, text: '−1'}]);
      continue;
    }
    // …and its pair (TR12 Party Sanctions): the same row, the chip signed «−N», the area's total after it.
    if ((e.type === 'popular-support-gained' || e.type === 'popular-support-discarded') && e.impact.popularSupport !== undefined) {
      push(`support|${e.id}`, {source: sourceToChild(e.source), player, bucket, chips: [],
        political: {kind: 'support', party: e.impact.popularSupport.party, total: e.impact.popularSupport.total}}, impactChips(e.impact));
      continue;
    }
    // A card-resource payout a RULE counted (TR21: «for 3 adjacent cities») keeps its reason and its card on a row of its own.
    const counted = e.type === 'card-resource-changed' ? e.impact.cardResources?.find((cr) => cr.basis !== undefined) : undefined;
    if (counted?.basis !== undefined) {
      const reason = {count: counted.basis.count, unitKey: counted.basis.unitKey};
      push(`basis|${e.id}`, {source: sourceToChild(e.source), player, bucket, chips: [],
        basis: {...reason, onCard: counted.target}}, impactChips(e.impact).map((chip) => ({...chip, basis: reason})));
      continue;
    }
    const chips = [...impactChips(e.impact), ...(foldedChips.get(e.id) ?? [])];
    // A card resource that landed on ANOTHER card than its source: the row names where it went (see `onCard`).
    const landed = e.type === 'card-resource-changed' ? landedElsewhere(e) : undefined;
    if (landed !== undefined && chips.length > 0) {
      push(`onCard|${bucket}|${sourceDiscriminator(e.source)}|${e.player ?? ''}|${landed}`,
        {source: sourceToChild(e.source), player, bucket, chips: [], onCard: landed}, chips);
      continue;
    }
    if (e.type === 'copied-action') {
      // Distinct copied cards stay separate (the copied card is in the key).
      push(`copied|${sourceDiscriminator(e.source)}|${e.player ?? ''}|${e.target?.card ?? ''}`,
        {source: sourceToChild(e.source), player, bucket, chips: [], copiedCard: e.target?.card}, chips);
      continue;
    }
    if (chips.length === 0) {
      // A bare effect-triggered marker that did nothing leaves no row.
      continue;
    }
    // bucket + source identity + recipient + target → one merged contribution.
    push(`${bucket}|${sourceDiscriminator(e.source)}|${e.player ?? ''}|${e.target?.card ?? ''}`,
      {source: sourceToChild(e.source), player, bucket, chips: []}, chips);
  }

  // Resolve each row's final chips, then re-order GAINS → discounts → cost,
  // with a STABLE sort (chronological order preserved within a tier).
  const rootCard = rootCardOf(events, rootId);
  const rows = ordered.map((entry) => ({...entry.vm, chips: entry.chips}));
  return rows
    .map((vm, i) => ({vm, i, tier: childTier(vm, rootCard)}))
    .sort((a, b) => a.tier - b.tier || a.i - b.i)
    .map((d) => d.vm);
}
