/**
 * CONSOLE MA INSPECT — the PURE view-model for the fullscreen X → «Осмотреть»
 * reader (`ConsoleMaInspect`).
 *
 * The dashboard card answers "can I act right now"; the fullscreen reader
 * answers the STRATEGIC question the mechanic actually poses, and ONLY that:
 *
 *  - AWARD  → the endgame SCORING RACE. An award is scored at game end for
 *    EVERY player by their metric count (1st = 5 VP, 2nd = 2 VP in 3+ player
 *    games). So the reader ranks all players leader→last, projects each one's
 *    endgame VP (engine-faithful tie/skip rules — see `projectAwardVp`), and
 *    shows relative bars. This is meaningful whether or not the award is
 *    funded (funding only decides WHETHER it scores, never WHO wins).
 *  - MILESTONE, unclaimed → the CLAIM RACE. A milestone is a one-shot claim
 *    (first to meet the threshold + pay grabs the 5 VP; nobody else scores it).
 *    So the reader ranks players by PROGRESS toward the threshold and flags who
 *    can claim now — a per-player VP projection would be a lie (only one player
 *    ever scores it).
 *  - MILESTONE, claimed → DONE. It is owned, +5 VP already banked, the race is
 *    over. A ranking is meaningless (the user's rule: "for an already-taken one
 *    it makes no sense"), so the reader shows only the owner + the locked state.
 *
 * Pure (no Vue / DOM / i18n beyond keys) so the whole matrix is unit-testable,
 * exactly like `consoleMaModel` / `maConfirmModel`.
 */
import {Color} from '@/common/Color';
import {maDisplayName} from '@/client/components/ma/maArt';
import {ConsoleMaItem} from '@/client/components/console/consoleMaModel';

export type MaInspectMode = 'award-standings' | 'milestone-race' | 'milestone-condition' | 'milestone-claimed';

// `name` is the already-RESOLVED display label (the caller maps it through
// participantDisplayName so a MarsBot reads «Бот», never a raw «MarsBot»).
export type MaInspectPlayer = {color: Color, name: string, isMarsBot?: boolean};

export type MaInspectRow = {
  color: Color,
  name: string,
  score: number,
  viewer: boolean,
  /** Competition rank (tied players share a rank, the next one skips). */
  rank: number,
  /** Shares the top score (only meaningful once someone scores > 0). */
  isLeader: boolean,
  /** 0..100 — award: score / topScore; milestone: score / threshold. */
  barPct: number,
  /** AWARD only: the projected endgame VP (5 / 2), else undefined. */
  projectedVp?: number,
  /** MILESTONE race only: the player currently meets the threshold. */
  canClaim?: boolean,
};

export type MaInspectSummary =
  | {tone: 'lead'}
  | {tone: 'tie-lead'}
  | {tone: 'behind', gap: number}
  | {tone: 'no-race'}
  | {tone: 'can-claim'}
  | {tone: 'progress', gap: number}
  | {tone: 'condition-met'}
  | {tone: 'condition-unmet'}
  | {tone: 'claimed-you'}
  | {tone: 'claimed-other', name: string, color: Color};

export type MaInspectView = {
  mode: MaInspectMode,
  kind: 'milestone' | 'award',
  name: string,
  displayName: string,
  description: string,
  threshold?: number,
  /** Ranked leader→last (EMPTY for a claimed milestone — no meaningful race). */
  rows: ReadonlyArray<MaInspectRow>,
  /** Funded-by (award) / claimed-by (milestone), when taken. */
  owner?: {color: Color, name: string},
  /** Award funded / milestone claimed. */
  taken: boolean,
  playersCount: number,
  /** VP for 1st / 2nd place (2nd is 0 in a 2-player game — no second place). */
  vpFirst: number,
  vpSecond: number,
  /** The viewer-perspective headline. */
  summary: MaInspectSummary,
};

/**
 * Engine-faithful award VP projection (mirrors `giveAwards` in
 * `calculateVictoryPoints.ts`): a SINGLE 1st gets 5 (and, in 3+ player games,
 * the next distinct group gets 2); a TIE for 1st gives every tied player 5 and
 * awards no 2nd place. A 0 score never places (a degenerate all-low endgame is
 * not a meaningful mid-game projection — "только уместную инфу"). Returns VP
 * per index, aligned to the sorted-desc scores.
 */
export function projectAwardVp(scoresDesc: ReadonlyArray<number>, playersCount: number): Array<number> {
  const vp = scoresDesc.map(() => 0);
  if (scoresDesc.length === 0 || scoresDesc[0] === 0) {
    return vp;
  }
  const top = scoresDesc[0];
  const firstIdx = scoresDesc.map((s, i) => ({s, i})).filter((e) => e.s === top).map((e) => e.i);
  if (firstIdx.length > 1) {
    // Tie for 1st → every tied player scores 5, no 2nd place is awarded.
    for (const i of firstIdx) {
      vp[i] = 5;
    }
    return vp;
  }
  // A single 1st place.
  vp[firstIdx[0]] = 5;
  // 2nd place exists only in 3+ player games (engine: remaining length > 1).
  if (playersCount >= 3) {
    const restIdx = scoresDesc.map((_s, i) => i).filter((i) => i !== firstIdx[0]);
    const secondScore = restIdx.reduce((max, i) => Math.max(max, scoresDesc[i]), 0);
    if (secondScore > 0) {
      for (const i of restIdx) {
        if (scoresDesc[i] === secondScore) {
          vp[i] = 2;
        }
      }
    }
  }
  return vp;
}

export function buildMaInspect(
  item: ConsoleMaItem,
  players: ReadonlyArray<MaInspectPlayer>,
): MaInspectView {
  const kind = item.kind;
  const taken = item.takenBy !== undefined;
  const threshold = item.threshold;
  // A milestone with NO numeric threshold (Merchant "2 of each resource",
  // Briber, Minimalist "no more than 2 cards") is a CONDITION milestone — its
  // score is not a linear progress toward a target, so a progress bar / "+N to
  // threshold" would lie. It renders as a met / not-met list instead.
  const mode: MaInspectMode = kind === 'award' ? 'award-standings' :
    taken ? 'milestone-claimed' :
      threshold === undefined ? 'milestone-condition' : 'milestone-race';

  const scoreOf = (color: Color) => item.scores.find((s) => s.color === color);

  // Rows are built from the AUTHORITATIVE player list (so a player with no
  // score still appears in the race). Standings/progress sort by score; a
  // condition list sorts the players who already MEET it to the top.
  // The rows/owner carry the caller-resolved display names; resolve the owner
  // («claimed by …») the SAME way — by colour — so a MarsBot claimant reads «Бот».
  const nameOf = (c: Color): string => players.find((p) => p.color === c)?.name ?? '';
  const base = players.map((p) => {
    const s = scoreOf(p.color);
    return {color: p.color, name: p.name, score: s?.score ?? 0, claimable: s?.claimable === true, viewer: p.color === item.myColor};
  });
  const sorted = [...base].sort((a, b) => {
    if (mode === 'milestone-condition') {
      return (Number(b.claimable) - Number(a.claimable)) || (a.viewer ? -1 : b.viewer ? 1 : 0);
    }
    return (b.score - a.score) || (a.viewer ? -1 : b.viewer ? 1 : 0);
  });
  const topScore = sorted.length > 0 ? sorted[0].score : 0;
  const leaderCount = sorted.filter((r) => r.score === topScore && topScore > 0).length;
  const maxBar = Math.max(1, kind === 'milestone' && threshold !== undefined ? threshold : topScore);
  const vp = kind === 'award' ? projectAwardVp(sorted.map((r) => r.score), players.length) : undefined;

  const rows: Array<MaInspectRow> = sorted.map((r, i) => ({
    color: r.color,
    name: r.name,
    score: r.score,
    viewer: r.viewer,
    rank: 1 + sorted.filter((o) => o.score > r.score).length,
    isLeader: r.score === topScore && topScore > 0,
    barPct: Math.min(100, Math.round((r.score / maxBar) * 100)),
    projectedVp: vp !== undefined && vp[i] > 0 ? vp[i] : undefined,
    canClaim: kind === 'milestone' ? (r.claimable || (threshold !== undefined && r.score >= threshold)) : undefined,
  }));

  const viewer = rows.find((r) => r.viewer);
  const ownerName = item.takenBy !== undefined ? (nameOf(item.takenBy.color) || item.takenBy.name) : '';
  const summary = buildSummary(mode, item, viewer, topScore, leaderCount, threshold, ownerName);

  return {
    mode,
    kind,
    name: item.name,
    displayName: maDisplayName(item.name),
    description: item.description,
    threshold,
    rows: mode === 'milestone-claimed' ? [] : rows,
    owner: item.takenBy !== undefined ? {color: item.takenBy.color, name: ownerName} : undefined,
    taken,
    playersCount: players.length,
    vpFirst: 5,
    vpSecond: players.length >= 3 ? 2 : 0,
    summary,
  };
}

function buildSummary(
  mode: MaInspectMode,
  item: ConsoleMaItem,
  viewer: MaInspectRow | undefined,
  topScore: number,
  leaderCount: number,
  threshold: number | undefined,
  ownerName: string,
): MaInspectSummary {
  if (mode === 'milestone-claimed') {
    if (item.takenBy !== undefined && item.takenBy.color === item.myColor) {
      return {tone: 'claimed-you'};
    }
    return {tone: 'claimed-other', name: ownerName, color: item.takenBy?.color ?? item.myColor};
  }
  if (mode === 'milestone-condition') {
    return viewer?.canClaim === true ? {tone: 'condition-met'} : {tone: 'condition-unmet'};
  }
  if (mode === 'milestone-race') {
    if (viewer?.canClaim === true) {
      return {tone: 'can-claim'};
    }
    return {tone: 'progress', gap: Math.max(0, (threshold ?? 0) - (viewer?.score ?? 0))};
  }
  // award-standings
  if (topScore === 0) {
    return {tone: 'no-race'};
  }
  const myScore = viewer?.score ?? 0;
  if (myScore === topScore) {
    return leaderCount > 1 ? {tone: 'tie-lead'} : {tone: 'lead'};
  }
  return {tone: 'behind', gap: topScore - myScore};
}
