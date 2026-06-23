/*
 * Finish VERDICT system (Iteration 17 §2/§3/§17).
 *
 * Classifies HOW the game finished — photo finish / close / solid / wide / blowout /
 * comeback / late breakaway — from the margin (absolute + relative), player count and the
 * lead timeline, and produces a typed verdict the hero renders as a VISUAL banner (tier +
 * glyph + accent + a short rich-text line), not a flat sentence. PURE — no Vue / DOM /
 * i18n; the line is an i18n template + typed params (player colour + accented margin).
 */
import type {Color} from '@/common/Color';
import type {InsightContext, InsightParam} from '@/client/components/endgame/insightEngine';
import {marginClass} from '@/client/components/endgame/keyEpisodeEngine';

export type FinishVerdictType =
  | 'photo_finish'
  | 'close_finish'
  | 'solid_win'
  | 'large_win'
  | 'blowout'
  | 'comeback'
  | 'late_breakaway';

export type FinishVerdictLine = {key: string; params: ReadonlyArray<InsightParam>};

export type FinishVerdict = {
  type: FinishVerdictType;
  /** i18n KEY — the short, strong banner title. */
  titleKey: string;
  /** The one-line explanation (rich-text template + params). */
  line: FinishVerdictLine;
  /** A monochrome glyph (tinted via CSS by type). */
  glyph: string;
  /** Why this type was chosen (debug, §19). */
  reason: string;
};

const playerP = (name: string, color: Color): InsightParam => ({t: 'raw', v: name, term: {kind: 'player', color}});
const scoreP = (v: number | string): InsightParam => ({t: 'raw', v: String(v), term: {kind: 'score', accent: true}});

const GLYPH: Record<FinishVerdictType, string> = {
  photo_finish: '‖', close_finish: 'Ξ', solid_win: '✦', large_win: '↗',
  blowout: '♛', comeback: '⇄', late_breakaway: '↗',
};

/** Classify + compose the finish verdict for the hero banner. */
export function buildFinishVerdict(ctx: InsightContext): FinishVerdict | undefined {
  if (ctx.mode === 'solo' || ctx.runnerUp === undefined) {
    return undefined;
  }
  const w = ctx.winner;
  const margin = ctx.margin;
  const t = ctx.timeline;
  const cls = marginClass(margin);

  // A finish-line comeback: the winner trailed by a real gap, then took the lead very late.
  const lateLead = t?.winnerTookLeadGen !== undefined && t.winnerTookLeadGen >= ctx.generation - 1;
  if (lateLead && (t?.maxDeficit ?? 0) >= 5) {
    return {
      type: 'comeback', titleKey: 'A finish-line comeback', glyph: GLYPH.comeback,
      line: {key: 'By the final count the hidden points came out and swung the lead to ${0} after trailing.', params: [playerP(w.name, w.color)]},
      reason: `late lead (gen ${t?.winnerTookLeadGen}) after a ${t?.maxDeficit}-VP deficit`,
    };
  }
  // A late breakaway: it ran close, then the final count pulled the winner clear.
  if (!(t?.wireToWire ?? false) && margin >= 16 && t?.earlyGap !== undefined && t.earlyGap <= margin / 3) {
    return {
      type: 'late_breakaway', titleKey: 'A late breakaway', glyph: GLYPH.late_breakaway,
      line: {key: 'It ran close, then the final count sharply pulled ${0} clear: +${1} VP.', params: [playerP(w.name, w.color), scoreP(margin)]},
      reason: `close at 2/3 (gap ${t.earlyGap}) → +${margin} at the finish`,
    };
  }

  if (cls === 'tie' || margin <= 3) {
    return {
      type: 'photo_finish', titleKey: 'Photo finish', glyph: GLYPH.photo_finish,
      line: margin === 0 ?
        {key: 'Level on points — the title was settled on the M€ tiebreaker.', params: []} :
        {key: 'The game came down to a handful of points at the final count.', params: []},
      reason: `margin ${margin}`,
    };
  }
  if (margin <= 5) {
    return {
      type: 'close_finish', titleKey: 'A close finish', glyph: GLYPH.close_finish,
      line: {key: 'Just +${0} VP decided it — the details mattered.', params: [scoreP(margin)]},
      reason: `margin ${margin}`,
    };
  }
  if (cls === 'solid') {
    return {
      type: 'solid_win', titleKey: 'Solid win', glyph: GLYPH.solid_win,
      line: {key: 'The advantage for ${0} held and was sealed at the final count: +${1} VP.', params: [playerP(w.name, w.color), scoreP(margin)]},
      reason: `margin ${margin}`,
    };
  }
  if (cls === 'large') {
    return {
      type: 'large_win', titleKey: 'A wide finish', glyph: GLYPH.large_win,
      line: {key: 'The final count pulled the players far apart: the lead for ${0} reached +${1} VP.', params: [playerP(w.name, w.color), scoreP(margin)]},
      reason: `margin ${margin}`,
    };
  }
  return {
    type: 'blowout', titleKey: 'A runaway finish', glyph: GLYPH.blowout,
    line: {key: 'The lead for ${0} reached +${1} VP — no longer a fight over details, but a wide final gap.', params: [playerP(w.name, w.color), scoreP(margin)]},
    reason: `margin ${margin} (blowout)`,
  };
}
