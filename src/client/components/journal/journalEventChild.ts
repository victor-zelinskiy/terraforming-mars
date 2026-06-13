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
 * chain into premium journal child rows — each reading as `source → impact` so a
 * consequence never loses where it came from. No Vue / DOM / i18n: icons are
 * keys for `iconClassFor`, labels are English i18n keys. Unit-testable.
 *
 * Effect-triggered / copied-action markers FOLD their child impacts into one row
 * (e.g. "Pets · Victor → +1 animal"); a plain gain whose source is the action
 * itself drops the redundant source chip (the root already names it).
 */

export type JournalImpactChip = {
  /** Icon key for `iconClassFor` (resource / card-resource / 'tr' / 'cards' / global param). */
  icon: string;
  /** Pre-formatted signed amount, e.g. '+2', '−2'. */
  text: string;
  /** A production delta (rendered with a production frame). */
  production?: boolean;
};

export type JournalChildSource =
  | {kind: 'card'; card: CardName}      // interactive card / corp / standard-project chip
  | {kind: 'label'; label: string}      // semantic source (i18n key): Cell bonus, Ocean bonus, …
  | {kind: 'none'};                      // the action's own result — no redundant chip

export type JournalChildVM = {
  source: JournalChildSource;
  /** Recipient, only when it differs from the root actor. */
  player?: Color;
  chips: ReadonlyArray<JournalImpactChip>;
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
    chips.push({icon: 'megacredits', text: `−${impact.megacreditsSaved}`});
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

function sourceToChild(source: EventSource | undefined, rootSource: EventSource | undefined): JournalChildSource {
  if (source === undefined) {
    return {kind: 'none'};
  }
  // The action's own result — the root header already names the source.
  if (rootSource !== undefined && sourceKey(source) === sourceKey(rootSource)) {
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
  case 'production':
    return {kind: 'label', label: 'Production'};
  case 'globalParameter':
    return {kind: 'label', label: paramLabel(source.parameter)};
  case 'milestone':
  case 'award':
  case 'colony':
  case 'globalEvent':
  case 'party':
    return {kind: 'label', label: source.name};
  default:
    return {kind: 'none'};
  }
}

const MARKER_TYPES = new Set(['effect-triggered', 'copied-action']);

/**
 * Build the child rows for a correlation chain. `events` are the GameEvents
 * whose `correlationId` === `rootId` (the root action event included).
 */
export function buildEventChildren(events: ReadonlyArray<GameEvent>, rootId: number, rootPlayer: Color | undefined): Array<JournalChildVM> {
  const byId = new Map<number, GameEvent>();
  for (const e of events) {
    byId.set(e.id, e);
  }
  const rootSource = byId.get(rootId)?.source;
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

  const rows: Array<JournalChildVM> = [];
  for (const e of events) {
    if (e.id === rootId || consumed.has(e.id) || e.type === 'action' || e.type === 'payment') {
      continue;
    }
    if (e.type === 'copied-action') {
      const chips = [...impactChips(e.impact), ...(foldedChips.get(e.id) ?? [])];
      rows.push({source: sourceToChild(e.source, rootSource), player: recipient(e), chips, copiedCard: e.target?.card});
      continue;
    }
    if (e.type === 'effect-triggered') {
      const chips = [...impactChips(e.impact), ...(foldedChips.get(e.id) ?? [])];
      if (chips.length === 0) {
        continue;
      }
      rows.push({source: sourceToChild(e.source, rootSource), player: recipient(e), chips});
      continue;
    }
    if (e.type === 'tile-placed') {
      rows.push({
        source: {kind: 'label', label: 'Placement'},
        player: recipient(e),
        chips: [],
        space: e.space,
        tileLabel: e.tile !== undefined ? tileTypeToString[e.tile] : undefined,
      });
      continue;
    }
    const chips = impactChips(e.impact);
    if (chips.length === 0) {
      continue;
    }
    rows.push({source: sourceToChild(e.source, rootSource), player: recipient(e), chips});
  }
  return rows;
}
