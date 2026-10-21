/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SCORE CELL'S SHARE LEDGER — «every point comes from its own cause»
 * (TR55, docs/claude/console/score-cell.md).
 *
 * The rail's VP cell is a counter like every other one, and it obeys the
 * PHYSICAL CAUSALITY law: it changes on the TOUCHDOWN of a «±N VP» token born
 * on the source that produced the points (the printed VP badge of a card that
 * just landed, a tile, a milestone, an award), or — when the source has no
 * body on this screen — with its cause NAMED beside the cell. It never moves
 * in the frame the view applies.
 *
 *   SEED   — in the apply block (the transport's `seedRewardHolds` for the
 *            viewer's own submit, `App.update` for a poll / WS frame), LAST,
 *            after every other seeder: the server's two breakdowns are
 *            attributed (`common/game/vpAttribution.ts` — a difference, never a
 *            recount), the rating is the TR cell's own business, and what
 *            another writer already holds in THIS block (a card resource's
 *            points — `railReward`, a city payout's) is netted out. Each share
 *            a HOST has claimed is held (`panelRewardHold.vp` / `vpLoss` — the
 *            ONE victory-point hold, through the VP token's spec); every other
 *            share ticks with the view and is NAMED (`vpShareState.reason`).
 *   FLY    — the host that claimed it flies it when its own scene has shown
 *            the cause (`flyVpShares` — the shared transfer language; the cell
 *            ticks on the touchdown, a loss on the departure).
 *   RELEASE— every ending of a host releases what it did not fly (and names
 *            it); a share that waits past `VP_SHARE_CEILING_MS` is released by
 *            the ledger itself, named — a hold is never unbounded.
 *
 * MASKS: the private score (`shouldMaskOwnPassiveVp`) seeds NOTHING — no
 * hold, no token, no named cause — a flight to a masked cell would tell the
 * number it hides; the mask's own lift mounts the cell quietly as before.
 * Reduced motion holds nothing and flies nothing: every share is named.
 */
import {reactive} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Phase} from '@/common/Phase';
import {VpShare, VpSource, vpAttribution, vpCardReadsBoard, vpSourceKey} from '@/common/game/vpAttribution';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {shouldMaskOwnPassiveVp} from '@/client/components/overview/privateScoreState';
import {ResourceTransferSpec, TransferEndLike, vpTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  beginPanelRewardHold, onCardResourceLanded, registerPanelVpKeeper, releasePanelRewardHold, runResourceTransfers,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';

/** The longest a share may wait for its host's flight — past it the ledger releases it, named. */
export const VP_SHARE_CEILING_MS = 20000;

/**
 * A HOST's claim: «the shares this matches are mine to fly». Registered at the
 * host's arm (before the response that pays), dropped by its every ending.
 * `rank` orders two claims that match one share (a card's own play outranks a
 * tile scene of the same response); equal ranks — the later claim wins.
 */
export type VpClaim = {
  owner: string, rank: number, match: VpShareMatch, seq: number, releaseOnLanding: boolean,
  /** Told (after the seed's block) that shares were held for it — a host whose scene is already over flies them now. */
  onSeeded?: () => void,
};

/** Is this share the host's to show? `after` is the server's breakdown the share was read from (its mechanics). */
export type VpShareMatch = (share: VpShare, after: VictoryPointsBreakdown) => boolean;

export type HeldVpShare = {
  id: number, owner: string, share: VpShare, spec: ResourceTransferSpec, since: number, flying: boolean,
  /** A CARD share released on the touchdown of a card-resource token onto that card (the token brings the points). */
  releaseOnLanding: boolean,
};

/** One named cause beside the cell (a share with no body, or a host that could not fly it). */
export type VpReasonLine = {source: VpSource, points: number};

export const vpShareState = reactive({
  /** The shares held right now — the cell reads «total − held» until each token lands. */
  held: [] as Array<HeldVpShare>,
  /** The causes the cell names (a toast beside it), bumped by `seq` — the panel shows each once. */
  reason: undefined as {seq: number, lines: Array<VpReasonLine>} | undefined,
  /** The last seed, named (the e2e probe and the dev trace): what was held, ticked, netted, and what disagreed. */
  last: undefined as undefined | {held: Array<string>, ticked: Array<string>, netted: Array<string>, mismatches: Array<string>},
  /** Every share that flew, with its owner — the e2e probe's witness («the cell moved on ITS token»). */
  flown: [] as Array<string>,
});

const claims = new Map<string, VpClaim>();
let claimSeq = 0;
let heldSeq = 0;
let reasonSeq = 0;
let ceilingTimer: number | undefined;

/**
 * What other writers hold for the NEXT seed, by source key (signed points). Written by the writers' own seeders —
 * all of them in an apply block, some (a remote placement's payout) ahead of the transport's `seedRewardHolds` in
 * the same response — and CONSUMED by `seedVpShares`, which empties it.
 */
let blockNotes = new Map<string, number>();

// The cell's hold survives a scene's belt-and-braces clear: the ledger re-asserts what it holds.
registerPanelVpKeeper(() => {
  let gain = 0;
  let loss = 0;
  for (const h of vpShareState.held) {
    if (h.share.points > 0) {
      gain += h.share.points;
    } else {
      loss -= h.share.points;
    }
  }
  return {gain, loss};
});

// A CARD RESOURCE that lands on its card brings that card's points with it: a share claimed «on landing» ticks on the
// touchdown of the first gain token onto its card (the contact beat — a degraded landing included, never early).
onCardResourceLanded((spec) => {
  if (spec.direction === 'loss' || spec.targetCard === undefined) {
    return;
  }
  const card = spec.targetCard;
  for (const entry of [...vpShareState.held]) {
    if (entry.releaseOnLanding && !entry.flying && entry.share.source.kind === 'card' && entry.share.source.card === card) {
      dropHeld(entry);
    }
  }
});

// A held share keeps the FEED only (never the foreground): the cell's story is a member, not a gate.
registerAnimationHoldSupplier('vp-shares', () => vpShareState.held.length > 0, {
  scope: 'notification-only',
  diagnose: () => vpShareState.held.map((h) => `${h.owner} · ${vpSourceKey(h.share.source)} ${h.share.points}${h.flying ? ' (flying)' : ''}`),
  expire: () => releaseAllVpShares('ceiling'),
});

// ── claims ──────────────────────────────────────────────────────────────────

/**
 * THE BOARD'S SHARES — what a tile scene may show: a city's cell, the greenery tiles' own points, and a card whose
 * row READS THE BOARD (`vpCardReadsBoard` — the server's mechanics: cities, oceans, adjacency, a per-tile penalty).
 * A card counting its resources or its tags is never a tile's doing.
 */
export const isBoardVpShare: VpShareMatch = (share, after) =>
  share.source.kind === 'city' || share.source.kind === 'greenery' ||
  (share.source.kind === 'card' && vpCardReadsBoard(after, share.source.card));

/** A host claims the shares `match` accepts (at its arm). Re-claiming an owner replaces its claim. */
export function claimVpShares(
  owner: string, match: VpShareMatch, rank = 0,
  opts: {releaseOnLanding?: boolean, onSeeded?: () => void} = {},
): void {
  claims.set(owner, {owner, rank, match, seq: ++claimSeq, releaseOnLanding: opts.releaseOnLanding === true, ...(opts.onSeeded !== undefined ? {onSeeded: opts.onSeeded} : {})});
}

/** The host's claim ends (its every ending) — what it already holds stays its own to fly or release. */
export function dropVpClaim(owner: string): void {
  claims.delete(owner);
}

/** Is a claim of `owner` standing? */
export function vpClaimStanding(owner: string): boolean {
  return claims.has(owner);
}

// ── the apply block ─────────────────────────────────────────────────────────

/**
 * Another writer holds `points` of `source` for this response (a card
 * resource's derived points — `railReward`, a city payout's — the share is
 * theirs already; the ledger nets it out, never holds it twice).
 */
export function noteVpHeldElsewhere(source: VpSource, points: number): void {
  if (points === 0) {
    return;
  }
  const key = vpSourceKey(source);
  blockNotes.set(key, (blockNotes.get(key) ?? 0) + points);
}

/** The claim a share belongs to (highest rank, then the latest), or undefined. */
function claimFor(share: VpShare, after: VictoryPointsBreakdown): VpClaim | undefined {
  let best: VpClaim | undefined;
  for (const claim of claims.values()) {
    if (!claim.match(share, after)) {
      continue;
    }
    if (best === undefined || claim.rank > best.rank || (claim.rank === best.rank && claim.seq > best.seq)) {
      best = claim;
    }
  }
  return best;
}

/** «card:X +2» — a share in the trace's words. */
function describe(share: VpShare): string {
  return `${vpSourceKey(share.source)} ${share.points > 0 ? '+' : ''}${share.points}`;
}

/**
 * SEED — the apply block's LAST seeder (same synchronous block as the view
 * apply, or the cell flushes the new total for a frame). Pure reads of the two
 * views; holds only what a standing claim will fly.
 */
export function seedVpShares(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  const notes = blockNotes;
  blockNotes = new Map();
  const was = before?.thisPlayer?.victoryPointsBreakdown;
  const now = after?.thisPlayer?.victoryPointsBreakdown;
  if (was === undefined || now === undefined || before?.id !== after?.id || before?.thisPlayer?.color !== after?.thisPlayer?.color) {
    return;
  }
  if (after?.game?.phase === Phase.END) {
    return; // the final scoring owns the number — its reveal is its own story
  }
  if (shouldMaskOwnPassiveVp(true)) {
    return; // the private score: nothing flies, nothing is named — the mask tells nothing
  }
  const trace = {held: [] as Array<string>, ticked: [] as Array<string>, netted: [] as Array<string>, mismatches: [] as Array<string>};
  const reasons: Array<VpReasonLine> = [];
  const reduced = consoleReducedMotionActive();
  // Equal totals can still hide a move (−3 here, +3 there): attributed, the cell shows it as two causes.
  const shares = vpAttribution(was, now).filter((s) => s.source.kind !== 'rating');
  if (shares.length === 0 && notes.size === 0) {
    return;
  }
  const seen = new Set<string>();
  const seededFor = new Set<VpClaim>();
  for (const share of shares) {
    const key = vpSourceKey(share.source);
    seen.add(key);
    // NET what another writer holds in this block — its own token will tick it.
    const noted = notes.get(key) ?? 0;
    let points = share.points;
    if (noted !== 0) {
      if (Math.sign(noted) !== Math.sign(points) || Math.abs(noted) > Math.abs(points)) {
        trace.mismatches.push(`${key}: held elsewhere ${noted}, the score moved ${points}`);
      }
      points -= noted;
      trace.netted.push(`${key} ${noted > 0 ? '+' : ''}${noted}`);
      if (points === 0 || Math.sign(points) !== Math.sign(share.points)) {
        continue;
      }
    }
    const residual: VpShare = {source: share.source, points};
    const claim = reduced ? undefined : claimFor(residual, now);
    if (claim === undefined) {
      // NO BODY on this screen for it: it ticks with the view — and says why.
      reasons.push({source: residual.source, points});
      trace.ticked.push(describe(residual));
      continue;
    }
    const spec = vpTransferSpec(points);
    beginPanelRewardHold([spec]);
    vpShareState.held.push({id: ++heldSeq, owner: claim.owner, share: residual, spec, since: Date.now(), flying: false, releaseOnLanding: claim.releaseOnLanding});
    seededFor.add(claim);
    trace.held.push(`${claim.owner} · ${describe(residual)}`);
  }
  for (const [key, noted] of notes) {
    if (!seen.has(key)) {
      trace.mismatches.push(`${key}: held elsewhere ${noted}, the score did not move it`);
    }
  }
  if (reasons.length > 0) {
    nameCauses(reasons);
  }
  vpShareState.last = trace;
  if (trace.mismatches.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(`[score-cell] the score's own change disagrees with a writer's hold — ${trace.mismatches.join('; ')}`);
  }
  armCeiling();
  // A host that asked to be told: after the seed's block (the view is applied by then), never inside it.
  for (const claim of seededFor) {
    if (claim.onSeeded !== undefined) {
      void Promise.resolve().then(claim.onSeeded);
    }
  }
}

/** Name causes beside the cell (one toast per batch, the panel reads it once by `seq`). */
function nameCauses(lines: ReadonlyArray<VpReasonLine>): void {
  if (lines.length === 0 || shouldMaskOwnPassiveVp(true)) {
    return;
  }
  vpShareState.reason = {seq: ++reasonSeq, lines: [...lines]};
}

// ── hosts: read / fly / release ─────────────────────────────────────────────

/** The shares `owner` holds (optionally narrowed), not yet in the air. */
export function vpSharesHeldBy(owner: string, filter?: (share: VpShare) => boolean): ReadonlyArray<HeldVpShare> {
  return vpShareState.held.filter((h) => h.owner === owner && !h.flying && (filter?.(h.share) ?? true));
}

/** Does `owner` hold anything still to fly? */
export function holdsVpShares(owner: string, filter?: (share: VpShare) => boolean): boolean {
  return vpSharesHeldBy(owner, filter).length > 0;
}

function dropHeld(entry: HeldVpShare): boolean {
  const index = vpShareState.held.indexOf(entry);
  if (index === -1) {
    return false;
  }
  vpShareState.held.splice(index, 1);
  releasePanelRewardHold(entry.spec);
  return true;
}

/**
 * RELEASE — the cell ticks now by what `owner` still holds (narrowed by
 * `filter`). `named` (default true) puts the causes beside the cell: a host
 * that could not show its token never lets the number move unexplained. A
 * share released on its OWN resource token's touchdown (a card resource that
 * brings the points with it) passes `named: false` — that touchdown IS the cause.
 */
export function releaseVpShares(owner: string, opts: {filter?: (share: VpShare) => boolean, named?: boolean, why?: string} = {}): number {
  const mine = vpShareState.held.filter((h) => h.owner === owner && !h.flying && (opts.filter?.(h.share) ?? true));
  const lines: Array<VpReasonLine> = [];
  for (const entry of mine) {
    if (dropHeld(entry)) {
      lines.push({source: entry.share.source, points: entry.share.points});
    }
  }
  if (opts.named !== false) {
    nameCauses(lines);
  }
  if (mine.length > 0 && opts.why !== undefined && process.env.NODE_ENV !== 'production') {
    console.warn(`[score-cell] ${owner}: ${mine.map((h) => describe(h.share)).join(', ')} ticked without a token — ${opts.why}`);
  }
  return mine.length;
}

/** Release EVERY share (the ceiling, a game switch) — named. */
export function releaseAllVpShares(why: string): void {
  const owners = new Set(vpShareState.held.map((h) => h.owner));
  for (const owner of owners) {
    releaseVpShares(owner, {why});
  }
  // A share mid-flight is the transfer's own business; the ceiling releases it too.
  for (const entry of [...vpShareState.held]) {
    dropHeld(entry);
  }
}

/**
 * FLY — the host's scene has SHOWN the cause: each held share of `owner`
 * (narrowed by `filter`) is born on `originOf(share)` — a measured node of the
 * source (the printed VP badge, a tile's cell, a milestone's line), never a
 * synthetic point — and flies the shared transfer language to the VP cell's
 * ink; the cell ticks on the touchdown (a loss on its departure). A share with
 * no origin is released now and named. Resolves at the touchdowns.
 */
export async function flyVpShares(
  owner: string,
  originOf: (share: VpShare) => TransferEndLike | undefined,
  opts: {filter?: (share: VpShare) => boolean, fromBoard?: boolean, pace?: number, inSurface?: boolean} = {},
): Promise<'landed' | 'degraded' | 'none'> {
  const mine = vpSharesHeldBy(owner, opts.filter);
  if (mine.length === 0) {
    return 'none';
  }
  const flying: Array<HeldVpShare> = [];
  const origins: Array<TransferEndLike> = [];
  const orphans: Array<VpReasonLine> = [];
  for (const entry of mine) {
    const origin = originOf(entry.share);
    if (origin === undefined) {
      dropHeld(entry);
      orphans.push({source: entry.share.source, points: entry.share.points});
    } else {
      entry.flying = true;
      flying.push(entry);
      origins.push(origin);
    }
  }
  nameCauses(orphans);
  if (flying.length === 0) {
    return 'degraded';
  }
  let degraded = orphans.length > 0;
  const bySpec = new Map(flying.map((entry) => [entry.spec, entry]));
  await runResourceTransfers({
    specs: flying.map((entry) => entry.spec),
    source: {},
    origins,
    arrival: 'auto',
    ...(opts.fromBoard === true ? {fromBoard: true} : {}),
    ...(opts.pace !== undefined ? {pace: opts.pace} : {}),
    ...(opts.inSurface === true ? {inSurface: true} : {}),
    onArrive: (spec) => {
      const entry = bySpec.get(spec);
      if (entry !== undefined && dropHeld(entry)) {
        vpShareState.flown = [...vpShareState.flown.slice(-15), `${owner} · ${describe(entry.share)}`];
      }
    },
    onDegrade: () => {
      degraded = true;
    },
  });
  // A token the stage lost is released by the run's own `onArrive`; belt-and-braces for anything left.
  for (const entry of flying) {
    dropHeld(entry);
  }
  return degraded ? 'degraded' : 'landed';
}

// ── the ceiling ─────────────────────────────────────────────────────────────

function armCeiling(): void {
  if (ceilingTimer !== undefined || vpShareState.held.length === 0 || typeof window === 'undefined') {
    return;
  }
  ceilingTimer = window.setTimeout(() => {
    ceilingTimer = undefined;
    const now = Date.now();
    const stale = vpShareState.held.filter((h) => !h.flying && now - h.since >= VP_SHARE_CEILING_MS);
    const owners = new Set(stale.map((h) => h.owner));
    for (const owner of owners) {
      releaseVpShares(owner, {filter: (share) => stale.some((h) => h.owner === owner && h.share === share), why: 'the host never flew it (ceiling)'});
    }
    armCeiling();
  }, VP_SHARE_CEILING_MS);
}

/** Test seam: forget every claim and hold (the panel's holds are the transfer module's own to reset). */
export function resetVpShareLedgerForTests(): void {
  claims.clear();
  for (const entry of [...vpShareState.held]) {
    dropHeld(entry);
  }
  vpShareState.held = [];
  vpShareState.reason = undefined;
  vpShareState.last = undefined;
  vpShareState.flown = [];
  blockNotes = new Map();
  if (ceilingTimer !== undefined) {
    window.clearTimeout(ceilingTimer);
    ceilingTimer = undefined;
  }
}
