import {Color} from '../Color';
import {Message} from '../logs/Message';
import {SpaceId} from '../Types';
import {PlacementIllegalReason} from '../inputs/PlacementIllegalReason';

/**
 * BoardInformation — the shared, render-agnostic vocabulary for the premium
 * "the board explains itself" layer (hover inspector / active-placement preview
 * / confirm modal / journal). A {@link BoardFact} is ONE explainable statement
 * about a cell or about placing on it: WHAT it is, WHO receives an effect, WHEN
 * (immediate vs endgame), and WHY (the source / rule).
 *
 * 100% deterministic + read-only — the server {@link BoardInformationEngine}
 * derives facts WITHOUT mutating game state, mirroring the real grant/scoring
 * logic (`Game.grantPlacementBonuses`, `calculateVictoryPoints`,
 * `Board.computeAdditionalCosts`) so the preview never promises a bonus the
 * commit won't grant.
 *
 * Ares-readiness: the category union already names the future Ares fact kinds
 * (`ares-adjacency-bonus` / `tile-owner-benefit` / `hazard-*` / `ocean-upgrade`).
 * Those are NOT produced yet — Ares rules are out of scope — but a future Ares
 * adaptation adds facts into THIS model instead of inventing a new UI surface.
 */

/** Mirrors `src/server/boards/PlacementType.ts` (kept in common so models + client share it). */
export type BoardPlacementKind =
  'land' | 'ocean' | 'greenery' | 'city' | 'away-from-cities' | 'isolated' |
  'volcanic' | 'upgradeable-ocean' | 'upgradeable-ocean-new-holland';

/**
 * WHO receives a fact's effect. The single most important field — the UI groups
 * facts by recipient so a player NEVER confuses their own bonus with an
 * opponent's (greenery next to an opponent city scores VP for the OPPONENT).
 */
export type BoardFactRecipient =
  | {kind: 'current-player'}
  | {kind: 'player', color: Color}
  | {kind: 'tile-owner', color: Color}
  | {kind: 'neutral'}
  | {kind: 'nobody'};

/** WHEN the effect applies. `cost` = paid on placement; `endgame`/`future` = scoring. */
export type BoardFactTiming =
  'immediate' | 'on-confirm' | 'endgame' | 'future' | 'rule' | 'warning' | 'cost';

export type BoardFactSeverity =
  'info' | 'positive' | 'warning' | 'danger' | 'premium' | 'disabled';

export type BoardFactCategory =
  | 'cell-status'
  | 'printed-placement-bonus'
  | 'ocean-adjacency-bonus'
  // The placement's OWN immediate global-parameter / TR effect (greenery → +1 O₂/+1 TR,
  // ocean → +1 ocean/+1 TR). Deterministic per kind for the standard placements.
  | 'placement-effect'
  | 'city-greenery-scoring'
  | 'future-scoring'
  | 'map-special-zone'
  | 'restriction'
  | 'reserved-area'
  | 'tile-owner-benefit'
  | 'placement-cost'
  | 'placement-discount'
  | 'placement-penalty'
  | 'card-trigger'
  | 'corporation-trigger'
  | 'milestone-progress'
  // Ares-ready (categories declared; no facts produced until Ares is adapted):
  | 'ares-adjacency-bonus'
  | 'hazard-penalty'
  | 'hazard-cleanup'
  | 'ocean-upgrade';

export type BoardFactSource = {
  type:
    | 'board-cell' | 'adjacent-tile' | 'tile' | 'card' | 'corporation'
    | 'map-rule' | 'global-rule' | 'ares-placeholder';
  /** A space id / card name / rule key, when there's a concrete anchor. */
  id?: string;
  label?: string | Message;
  /** Owner of the source (e.g. the adjacent city's owner). */
  ownerColor?: Color;
};

/**
 * A resource delta rendered as a premium chip — same vocabulary as
 * `ActionEffect` (icon resolved via `iconClassFor`; the pseudo-keys `tr`/`cards`
 * render a styled badge). `current`/`resulting` drive a `N → M` preview when a
 * single pool is affected.
 */
export type BoardFactDelta = {
  icon: string;
  amount: number;
  direction: 'gain' | 'cost';
  current?: number;
  resulting?: number;
  /** Unit suffix for global parameters (`'%'` / `'°C'`). */
  unit?: string;
  /** When true the delta is a PRODUCTION change (rendered in a production frame). */
  production?: boolean;
};

export type BoardFact = {
  id: string;
  category: BoardFactCategory;
  timing: BoardFactTiming;
  severity: BoardFactSeverity;
  recipient: BoardFactRecipient;
  title: string | Message;
  description?: string | Message;
  source?: BoardFactSource;
  delta?: BoardFactDelta;
  vp?: {from: number, to: number};
  sortOrder?: number;
  visibleIn?: ReadonlyArray<'hover' | 'placement-preview' | 'confirm-modal' | 'journal'>;
};

/** A light structured header for the hover inspector (what's physically on the cell). */
export type BoardCellStatus = {
  content: 'empty' | 'ocean' | 'city' | 'greenery' | 'special-tile' | 'hazard';
  ownerColor?: Color;
  /** Card name / tile label for a special tile or a city built by a card. */
  tileLabel?: string | Message;
  /** Land / Ocean reserve / Cove / Deflection Zone / Colony reserve. */
  spaceTypeLabel?: string | Message;
  /** Why the cell can never host a normal placement. */
  reserved?: 'noctis' | 'colony' | 'restricted' | 'nomad';
};

/** Hover info for a cell — no placement context (what IS here + the standing rules). */
export type BoardCellInfo = {
  space: SpaceId;
  status: BoardCellStatus;
  facts: ReadonlyArray<BoardFact>;
};

/**
 * The consequences of placing `kind` on `space` for `player`, grouped by intent
 * so the UI renders "Стоимость / Вы получите / Получит X / Конец игры / Риск /
 * Правило" blocks directly. `legal` mirrors the server's availability; an illegal
 * cell carries `illegalReason` (and the cost/warning facts that explain it).
 */
export type BoardPlacementPreview = {
  space: SpaceId;
  kind: BoardPlacementKind;
  legal: boolean;
  illegalReason?: PlacementIllegalReason;
  costFacts: ReadonlyArray<BoardFact>;
  immediateFacts: ReadonlyArray<BoardFact>;
  recipientFacts: ReadonlyArray<BoardFact>;
  warningFacts: ReadonlyArray<BoardFact>;
  futureScoringFacts: ReadonlyArray<BoardFact>;
  ruleFacts: ReadonlyArray<BoardFact>;
  cancellable?: boolean;
  cancelReason?: string | Message;
};

/**
 * Pure grouping of facts by RECIPIENT for the premium UI — the one place the
 * "who gets what" ordering lives (current player first, then each other player,
 * then neutral/nobody). Unit-testable (no Vue / DOM). The viewer's own color
 * collapses `{kind:'player'|'tile-owner', color===viewer}` into `current-player`
 * so a self-owned adjacent city reads as "Вы получите", not "Получит <вы>".
 */
export type BoardFactGroup = {
  /** Stable key for `v-for` / dedup. */
  key: string;
  recipient: BoardFactRecipient;
  facts: ReadonlyArray<BoardFact>;
};

export function groupFactsByRecipient(
  facts: ReadonlyArray<BoardFact>,
  viewerColor?: Color): ReadonlyArray<BoardFactGroup> {
  const order: Array<string> = [];
  const groups = new Map<string, BoardFactGroup>();
  for (const fact of facts) {
    const recipient = normalizeRecipient(fact.recipient, viewerColor);
    const key = recipientKey(recipient);
    let group = groups.get(key);
    if (group === undefined) {
      group = {key, recipient, facts: []};
      groups.set(key, group);
      order.push(key);
    }
    (group.facts as Array<BoardFact>).push(fact);
  }
  return order
    .map((key) => groups.get(key)!)
    .sort((a, b) => recipientRank(a.recipient) - recipientRank(b.recipient));
}

function normalizeRecipient(recipient: BoardFactRecipient, viewerColor?: Color): BoardFactRecipient {
  if (viewerColor !== undefined &&
      (recipient.kind === 'player' || recipient.kind === 'tile-owner') &&
      recipient.color === viewerColor) {
    return {kind: 'current-player'};
  }
  return recipient;
}

function recipientKey(recipient: BoardFactRecipient): string {
  switch (recipient.kind) {
  case 'player':
  case 'tile-owner':
    return `${recipient.kind}:${recipient.color}`;
  default:
    return recipient.kind;
  }
}

function recipientRank(recipient: BoardFactRecipient): number {
  switch (recipient.kind) {
  case 'current-player': return 0;
  case 'tile-owner': return 1;
  case 'player': return 2;
  case 'neutral': return 3;
  case 'nobody': return 4;
  }
}
