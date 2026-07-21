/**
 * P26 — Milestones / Awards console-native screen: the PURE view-model.
 *
 * The premium `ConsoleMaScreen` renders DATA built here; the shell supplies
 * the live server models (`game.milestones` / `game.awards`), the option
 * availability set (the waitingFor tree IS the source of truth for "can act
 * right now") and the viewer context. Keeping the derivation pure makes the
 * whole state matrix (ready / short / blocked / taken / slots-exhausted /
 * award leadership) unit-testable without a DOM.
 *
 * DESIGN CONTRACT (the "no unavailability spam" rule): an item NEVER carries
 * a generic "Unavailable right now" line. Availability reads from the
 * progress metric + card state + CTA; `blocker` names a CONCRETE reason
 * (turn / money / mid-action / slots) and is surfaced ONLY in the focused
 * context strip. A milestone merely short of its threshold has NO blocker —
 * the "+N to the threshold" gap context explains it.
 */
import {Color} from '@/common/Color';
import {offTurnReason} from '@/client/console/offTurnReason';

export type ConsoleMaKind = 'milestones' | 'awards';

export type ConsoleMaScore = {color: Color, score: number, claimable?: boolean};

/** The common shape of ClaimedMilestoneModel / FundedAwardModel. */
export type ConsoleMaSource = {
  name: string,
  playerName: string | undefined,
  color: Color | undefined,
  scores: ReadonlyArray<ConsoleMaScore>,
  threshold?: number,
  description?: string,
};

export type ConsoleMaItem = {
  key: string,
  /** The milestone/award name — the i18n key AND the art-slug source. */
  name: string,
  kind: 'milestone' | 'award',
  /** Rule text (server per-game override first, manifest fallback). */
  description: string,
  scores: ReadonlyArray<ConsoleMaScore>,
  threshold?: number,
  myColor: Color,
  myScore: number,
  /** Milestone: the requirement is met (the SERVER claimable flag). */
  myReady: boolean,
  /** Award: the viewer currently (co-)leads the race. */
  myLead: boolean,
  leaderScore: number,
  /** Claim/fund price — absent once taken or when the slot race is closed. */
  cost?: number,
  /** The action is offered RIGHT NOW (present in the waitingFor tree). */
  available: boolean,
  /** i18n key naming the CONCRETE blocker ('' → the progress explains it). */
  blocker: string,
  takenBy?: {color: Color, name: string},
  /** All MAX slots went to OTHER entries — this race is closed for good. */
  slotsExhausted: boolean,
};

export type ConsoleMaBuildOptions = {
  myColor: Color,
  myTurn: boolean,
  /** The server is waiting on the viewer at all — their turn even when the free
   *  action menu is withheld by a mandatory sub-decision. Splits «завершите
   *  действие» from «не ваш ход». */
  awaitingInput: boolean,
  myMegacredits: number,
  /** Names offered by the live claim/fund OrOptions (server-filtered). */
  availableNow: ReadonlySet<string>,
  /** Manifest rule text lookup ('' degrades gracefully). */
  describe: (name: string) => string,
  /** MAX claimable/fundable slots (3). */
  maxSlots: number,
  /** The next claim/fund price (milestones: 8; awards: 8/14/20). */
  nextCost: number,
  /** Resolve a claimant colour to its DISPLAY label (a MarsBot reads «Бот», not
   *  the raw «MarsBot»). Optional — falls back to the raw model name. */
  resolveName?: (color: Color) => string,
};

export function buildConsoleMaItems(
  kind: ConsoleMaKind,
  models: ReadonlyArray<ConsoleMaSource>,
  opts: ConsoleMaBuildOptions,
): Array<ConsoleMaItem> {
  const isTaken = (m: ConsoleMaSource) => m.playerName !== undefined && m.playerName !== '';
  const takenCount = models.filter(isTaken).length;
  const itemKind = kind === 'milestones' ? 'milestone' as const : 'award' as const;

  return models.map((m) => {
    const taken = isTaken(m);
    const slotsExhausted = !taken && takenCount >= opts.maxSlots;
    const mine = m.scores.find((s) => s.color === opts.myColor);
    const myScore = mine?.score ?? 0;
    const leaderScore = m.scores.reduce((max, s) => Math.max(max, s.score), 0);
    const myReady = itemKind === 'milestone' &&
      (mine?.claimable === true || (m.threshold !== undefined && myScore >= m.threshold));
    const myLead = itemKind === 'award' && m.scores.length > 0 && myScore >= leaderScore && myScore > 0;
    const available = !taken && opts.availableNow.has(m.name);

    let blocker = '';
    if (!taken && !available) {
      if (slotsExhausted) {
        blocker = 'All slots are taken';
      } else if (itemKind === 'milestone' && !myReady) {
        blocker = ''; // the progress metric / gap context explains it
      } else if (!opts.myTurn) {
        blocker = offTurnReason(opts.awaitingInput);
      } else if (opts.myMegacredits < opts.nextCost) {
        blocker = 'Not enough M€';
      } else {
        blocker = 'Finish your current action first';
      }
    }

    // The server's per-game text wins (Terraformer varies under Turmoil);
    // an absent OR empty payload falls back to the static manifest.
    const description = m.description !== undefined && m.description !== '' ?
      m.description : opts.describe(m.name);

    return {
      key: m.name,
      name: m.name,
      kind: itemKind,
      description,
      scores: m.scores,
      threshold: m.threshold,
      myColor: opts.myColor,
      myScore,
      myReady,
      myLead,
      leaderScore,
      cost: taken || slotsExhausted ? undefined : opts.nextCost,
      available,
      blocker,
      takenBy: taken && m.color !== undefined ?
        {color: m.color, name: (opts.resolveName?.(m.color) || m.playerName) ?? ''} : undefined,
      slotsExhausted,
    };
  });
}

/** The focused-item context strip (ONE line, never per-card spam). */
export type ConsoleMaFocusContext =
  | {tone: 'owner', kind: 'milestone' | 'award', color: Color, name: string}
  | {tone: 'ready', key: string}
  | {tone: 'gap', gap: number}
  | {tone: 'blocked', key: string}
  | {tone: 'none'};

export function consoleMaFocusContext(item: ConsoleMaItem | undefined): ConsoleMaFocusContext {
  if (item === undefined) {
    return {tone: 'none'};
  }
  if (item.takenBy !== undefined) {
    return {tone: 'owner', kind: item.kind, color: item.takenBy.color, name: item.takenBy.name};
  }
  if (item.available) {
    return {tone: 'ready', key: item.kind === 'milestone' ? 'Threshold reached — claim now' : 'Ready to fund now'};
  }
  if (item.blocker !== '') {
    return {tone: 'blocked', key: item.blocker};
  }
  if (item.kind === 'milestone' && !item.myReady && item.threshold !== undefined && item.scores.length > 0) {
    return {tone: 'gap', gap: Math.max(0, item.threshold - item.myScore)};
  }
  return {tone: 'none'};
}

/** The honest notice for an A-press on a non-available item. */
export function consoleMaPressNotice(item: ConsoleMaItem): string {
  if (item.takenBy !== undefined) {
    return item.kind === 'milestone' ? 'Already claimed' : 'Already funded';
  }
  if (item.blocker !== '') {
    return item.blocker;
  }
  return 'Threshold not reached yet';
}

/**
 * D-pad navigation over a row-major CSS grid (2 columns). Every card is
 * focusable (taken/blocked items still show their context); an odd list's
 * last card spans both columns, so a down-step past the end clamps to it.
 */
export function stepGrid(index: number, dir: 'up' | 'down' | 'left' | 'right', count: number, cols: number): number {
  if (count <= 0) {
    return 0;
  }
  const i = Math.min(Math.max(index, 0), count - 1);
  switch (dir) {
  case 'right':
    return i % cols < cols - 1 && i + 1 < count ? i + 1 : i;
  case 'left':
    return i % cols > 0 ? i - 1 : i;
  case 'down':
    if (i + cols < count) {
      return i + cols;
    }
    // step into the (possibly spanning) last row when we are not in it
    return Math.floor(i / cols) < Math.floor((count - 1) / cols) ? count - 1 : i;
  case 'up':
    return i - cols >= 0 ? i - cols : i;
  default:
    return i;
  }
}
