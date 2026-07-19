/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
 */
/**
 * Premium Milestones / Awards CONFIRMATION — the PURE view-model.
 *
 * Claiming a milestone / funding an award is a strategic, irreversible
 * commitment, so both the desktop confirm modal (`MaConfirmContent`) and the
 * console-native decision screen (`ConsoleMaConfirm`) render DATA built here:
 *
 *  - the mechanic truth ("a milestone grants 5 VP immediately" vs "an award
 *    scores at game end"),
 *  - the viewer's progress (milestone threshold meter) / the live award RACE
 *    (viewer vs rivals, leader / tie state),
 *  - the M€ economy delta (before → after, free-sponsorship aware),
 *  - the slot economics (taken X / 3, how many remain AFTER this action).
 *
 * Keeping the derivation pure (no Vue / DOM / i18n strings beyond keys)
 * makes the whole matrix unit-testable without a DOM, exactly like
 * `consoleMaModel.ts`. The confirm surfaces re-derive this view on EVERY
 * playerView commit, so a stale modal (another player claimed the slot while
 * it was open) honestly re-renders as blocked instead of submitting a dead
 * action.
 */
import {Color} from '@/common/Color';
import {maDisplayName, MaKind} from '@/client/components/ma/maArt';

/** The common shape of ClaimedMilestoneModel / FundedAwardModel. */
export type MaConfirmSource = {
  name: string,
  playerName: string | undefined,
  color: Color | undefined,
  scores: ReadonlyArray<{color: Color, score: number, claimable?: boolean}>,
  threshold?: number,
  description?: string,
};

export type MaConfirmRaceRow = {
  color: Color,
  name: string,
  score: number,
  /** (Co-)leads the race — only meaningful once someone scores > 0. */
  leader: boolean,
  viewer: boolean,
};

export type MaRaceTone = 'lead' | 'tie' | 'behind' | 'empty';

export type MaConfirmView = {
  kind: MaKind,
  /** Raw name — the i18n key AND the art-slug source. */
  name: string,
  /** Numeric variant suffix stripped (Terraformer26 → Terraformer). */
  displayName: string,
  description: string,
  /** Effective price (0 in the free-sponsorship flow). */
  cost: number,
  free: boolean,
  mcBefore: number,
  mcAfter: number,
  /** Milestone progress (threshold meter). */
  threshold?: number,
  myScore: number,
  thresholdMet: boolean,
  /** Slot economics for the category. */
  takenCount: number,
  maxSlots: number,
  /** Open slots remaining AFTER this claim/fund resolves. */
  openAfter: number,
  /** Who already took the OTHER slots (display order = model order). */
  takenBy: ReadonlyArray<{maName: string, name: string, color: Color}>,
  /** The award race, viewer first, then rivals by score (desc). */
  race: ReadonlyArray<MaConfirmRaceRow>,
  leaderScore: number,
  raceTone: MaRaceTone,
  /** The target has ALREADY been taken (stale modal — block the CTA). */
  takenByOther: {name: string, color: Color} | undefined,
};

export type MaConfirmBuildOptions = {
  myColor: Color,
  myMegacredits: number,
  /** The effective price of THIS action (0 when `free`). */
  cost: number,
  /** Vitor-style free sponsorship — never blocks on M€. */
  free: boolean,
  maxSlots: number,
  /** Player-name lookup by colour ('' degrades gracefully). */
  playerName: (color: Color) => string,
  /** Manifest rule-text fallback (the server per-game text wins). */
  describe: (name: string) => string,
};

export function buildMaConfirm(
  kind: MaKind,
  source: MaConfirmSource,
  all: ReadonlyArray<MaConfirmSource>,
  opts: MaConfirmBuildOptions,
): MaConfirmView {
  const isTaken = (m: MaConfirmSource) => m.playerName !== undefined && m.playerName !== '';
  const takenCount = all.filter(isTaken).length;
  const mine = source.scores.find((s) => s.color === opts.myColor);
  const myScore = mine?.score ?? 0;
  const leaderScore = source.scores.reduce((max, s) => Math.max(max, s.score), 0);
  const leaders = source.scores.filter((s) => s.score === leaderScore && s.score > 0);
  const thresholdMet = mine?.claimable === true ||
    (source.threshold !== undefined && myScore >= source.threshold);

  // Viewer first (their progress is the anchor), rivals by score desc.
  const rows: Array<MaConfirmRaceRow> = [...source.scores]
    .sort((a, b) => (b.score - a.score) || (a.color === opts.myColor ? -1 : b.color === opts.myColor ? 1 : 0))
    .map((s) => ({
      color: s.color,
      name: opts.playerName(s.color),
      score: s.score,
      leader: s.score === leaderScore && s.score > 0,
      viewer: s.color === opts.myColor,
    }));
  const viewerRow = rows.find((r) => r.viewer);
  const race = viewerRow === undefined ? rows : [viewerRow, ...rows.filter((r) => !r.viewer)];

  let raceTone: MaRaceTone = 'empty';
  if (leaders.length > 0) {
    const iLead = leaders.some((s) => s.color === opts.myColor);
    raceTone = iLead ? (leaders.length > 1 ? 'tie' : 'lead') : 'behind';
  }

  const description = source.description !== undefined && source.description !== '' ?
    source.description : opts.describe(source.name);
  const cost = opts.free ? 0 : opts.cost;
  const taken = isTaken(source);

  return {
    kind,
    name: source.name,
    displayName: maDisplayName(source.name),
    description,
    cost,
    free: opts.free,
    mcBefore: opts.myMegacredits,
    mcAfter: opts.myMegacredits - cost,
    threshold: source.threshold,
    myScore,
    thresholdMet,
    takenCount,
    maxSlots: opts.maxSlots,
    openAfter: Math.max(0, opts.maxSlots - takenCount - (taken ? 0 : 1)),
    takenBy: all.filter(isTaken).map((m) => ({
      maName: maDisplayName(m.name),
      // Resolve through the caller's lookup (localizes the Automa seat) —
      // the model's raw playerName is the canonical server name.
      name: m.color !== undefined ? opts.playerName(m.color) : (m.playerName ?? ''),
      // isTaken guarantees playerName; color rides along (fallback = viewer-safe neutral).
      color: m.color ?? opts.myColor,
    })),
    race,
    leaderScore,
    raceTone,
    takenByOther: taken && source.color !== undefined ?
      {name: opts.playerName(source.color), color: source.color} : undefined,
  };
}
