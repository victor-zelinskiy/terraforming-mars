import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {SpaceId} from '@/common/Types';
import {Units} from '@/common/Units';
import {GlobalParameter} from '@/common/GlobalParameter';
import {tileTypeToString} from '@/common/TileType';
import {GameEvent} from '@/common/events/GameEvent';
import {EventImpact} from '@/common/events/EventImpact';
import {EventSource, sourceKey} from '@/common/events/EventSource';

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
  | 'card' | 'system';

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
  /** copied-action extra. */
  copiedCard?: CardName;
};

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
  if (impact.cardsDrawn !== undefined && impact.cardsDrawn !== 0) {
    chips.push({icon: 'cards', text: signed(impact.cardsDrawn)});
  }
  if (impact.globalParameter !== undefined && impact.globalParameter.steps !== 0) {
    chips.push({icon: impact.globalParameter.parameter, text: signed(impact.globalParameter.steps)});
  }
  return chips;
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
    return {kind: 'label', label: 'Production'};
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
  default:
    return {kind: 'none'};
  }
}

const MARKER_TYPES = new Set(['effect-triggered', 'copied-action']);

/** The semantic bucket a raw event belongs to (keeps unlike rows distinct). */
function bucketFor(e: GameEvent): JournalChildBucket {
  if (e.type === 'tile-placed') {
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
    if (e.id === rootId || e.parentId === undefined) {
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
    if (e.type === 'tile-placed') {
      // Each placed tile is its OWN row (never merged) — keyed by event id.
      push(`placement|${e.id}`, {
        source: {kind: 'label', label: 'Placement'},
        player, bucket,
        chips: [],
        space: e.space,
        tileLabel: e.tile !== undefined ? tileTypeToString[e.tile] : undefined,
      }, []);
      continue;
    }
    const chips = [...impactChips(e.impact), ...(foldedChips.get(e.id) ?? [])];
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

  return ordered.map((entry) => ({...entry.vm, chips: entry.chips}));
}
