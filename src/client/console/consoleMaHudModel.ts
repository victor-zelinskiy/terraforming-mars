/**
 * The right STRATEGY RAIL's pure view-model — the Milestones / Awards HUD.
 *
 * A compact PROJECTION of the same authoritative sources every MA surface
 * reads (`game.milestones` / `game.awards` + the live waitingFor option set +
 * the server's `maCosts`): the rail re-derives NOTHING — it only shapes the
 * server facts for a glanceable, icon-first presentation. All derivation is
 * pure (no DOM, no Vue) so the whole state matrix — open / ready / offered /
 * taken / completed, leaders / seconds / ties / funder-vs-scorer — is
 * unit-testable.
 *
 * Distinctions the rail renders (and this model must therefore keep apart):
 *  - `ready` (a milestone's condition is met — the SERVER's claimable flag)
 *    vs `availableNow` (the claim/fund is OFFERED on this frame): met-but-
 *    blocked-by-turn must read as "yours, waiting", never as an error;
 *  - the award LEADER (top score group, ties included — the shared
 *    `awardLeaders` derivation) vs the SECOND place (the next distinct
 *    non-zero score group) vs the SPONSOR (who paid — funder ≠ scorer);
 *  - the zone's COMPLETED state (all MAX slots taken) — a different
 *    composition, not a longer list.
 */
import {Color} from '@/common/Color';
import {awardLeaders} from '@/common/models/awardDisplay';
import {ConsoleMaSource, maScoreGroups} from '@/client/components/console/consoleMaModel';

/** One score tier of an award race — every player tied at this score. */
export type MaHudGroup = {colors: ReadonlyArray<Color>, score: number};

export type MaHudItem = {
  /** The raw model name — the i18n-key source AND the art slug source. */
  name: string,
  /** Claimed / funded by (undefined = the slot race is still open here). */
  taken?: {color: Color},
  /**
   * Milestones only: the VIEWER's own progress. Absent when the server sent
   * no scores (nothing honest to print). `ready` is server-authoritative
   * (`claimable`), with the printed threshold as the degrade-only fallback;
   * `conditional` marks a milestone with no numeric threshold (the value
   * cell renders met / not-met instead of a count).
   */
  my?: {score: number, threshold?: number, ready: boolean, conditional: boolean},
  /** Awards only: the current top score group (ties → every co-leader). */
  leader?: MaHudGroup,
  /** Awards only: the next distinct non-zero score group below the leader. */
  second?: MaHudGroup,
  /**
   * Awards only: the `second` group is a REAL second place — it would score
   * the 2nd-place VP at game end. Mirrors `giveAwards`
   * (calculateVictoryPoints.ts): a 2nd place exists only when the 1st is
   * held by a SINGLE player (a tie for 1st awards no 2nd at all) and the
   * game has MORE than two players (in a duel only 1st place scores).
   * A `second` with `secondRanked: false` is presented as a plain chaser —
   * never a silver «II» the rules would not pay.
   */
  secondRanked?: boolean,
  /** The claim/fund is OFFERED right now (present in the waitingFor tree). */
  availableNow: boolean,
};

export type MaHudZone = {
  /** Every item in SERVER order — stable positions, stable identities. */
  items: ReadonlyArray<MaHudItem>,
  takenCount: number,
  maxSlots: number,
  slotsLeft: number,
  /** The slot tray: taken colours in item order, padded to `maxSlots`. */
  slots: ReadonlyArray<Color | undefined>,
  /** Open items offered right now (server-filtered). */
  actionable: number,
  /** The 3-slot race is over — the rail recomposes to the completed pose. */
  completed: boolean,
  /** The next claim/fund price (the server's own `maCosts` number). */
  cost: number,
};

export type MaHudZoneOptions = {
  myColor: Color,
  /** Names offered by the live claim/fund OrOptions (server-filtered). */
  availableNow: ReadonlySet<string>,
  /** MAX claimable/fundable slots (3). */
  maxSlots: number,
  /** The live next claim/fund price (`PlayerViewModel.maCosts`). */
  cost: number,
};

export function buildMaHudZone(
  kind: 'milestones' | 'awards',
  models: ReadonlyArray<ConsoleMaSource>,
  opts: MaHudZoneOptions,
): MaHudZone {
  const isTaken = (m: ConsoleMaSource) => m.playerName !== undefined && m.playerName !== '';
  const takenCount = models.filter(isTaken).length;
  const completed = takenCount >= opts.maxSlots;

  const items: Array<MaHudItem> = models.map((m) => {
    const taken = isTaken(m) && m.color !== undefined ? {color: m.color} : undefined;
    const item: MaHudItem = {
      name: m.name,
      taken,
      availableNow: taken === undefined && opts.availableNow.has(m.name),
    };
    if (kind === 'awards') {
      // The race runs to game END — the leader stays relevant after funding
      // (the funder is not necessarily the scorer), so the groups are computed
      // regardless of `taken`. `awardLeaders` is the ONE shared top-tier
      // derivation; the second tier reuses the same grouping rules
      // (`maScoreGroups` — one source for the HUD and the workspace cassette).
      const groups = maScoreGroups(m.scores);
      const leaders = awardLeaders(m.scores);
      item.leader = leaders.length > 0 ?
        {colors: leaders.map((l) => l.color), score: leaders[0].score} : undefined;
      item.second = groups.length > 1 ? groups[1] : undefined;
      // The rules' own 2nd-place gate (giveAwards): single leader AND >2
      // players. `m.scores` carries every seat, so its length IS the player
      // count for this award.
      item.secondRanked = item.second !== undefined &&
        leaders.length === 1 && m.scores.length > 2;
    } else if (taken === undefined && m.scores.length > 0) {
      // Milestones lock in on claim — progress matters only while open.
      const mine = m.scores.find((s) => s.color === opts.myColor);
      item.my = {
        score: mine?.score ?? 0,
        threshold: m.threshold,
        // SERVER-authoritative; the printed threshold is the degrade fallback
        // for a model that predates the flag (see consoleMaModel.myReady).
        ready: mine?.claimable ??
          (m.threshold !== undefined && (mine?.score ?? 0) >= m.threshold),
        conditional: m.threshold === undefined,
      };
    }
    return item;
  });

  const slots: Array<Color | undefined> = items
    .filter((it) => it.taken !== undefined)
    .map((it) => it.taken?.color);
  while (slots.length < opts.maxSlots) {
    slots.push(undefined);
  }

  return {
    items,
    takenCount,
    maxSlots: opts.maxSlots,
    slotsLeft: Math.max(0, opts.maxSlots - takenCount),
    slots: slots.slice(0, opts.maxSlots),
    actionable: items.filter((it) => it.taken === undefined && it.availableNow).length,
    completed,
    cost: opts.cost,
  };
}
