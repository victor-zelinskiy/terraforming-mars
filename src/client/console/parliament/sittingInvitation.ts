/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SITTING'S INVITATION PLATE — WHAT IT STATES (P51 · ledger FG, the owner 2026-11-03: «плашка приглашения на
 * заседание ВСЕГДА показывает, какая резолюция победила и какой игрок — победитель, премиум и лаконично»).
 *
 * The plate keeps its ask «Заседание» (R-35 — the noun once, under the «ПАРЛАМЕНТ» kicker) and adds TWO FACTS under
 * it, the same pair the verdict and the results card read (the glossary's own words): the resolution
 * «ПРИНИМАЕТСЯ · [emblem] <name>» (before the enactment — «ПРИНЯТА» once the sitting has enacted it) and the player
 * «ПОБЕДИТЕЛЬ ГОЛОСОВАНИЯ · ● <seat>». Nothing is derived: the facts are the server's, read in a fixed order —
 *   1. the live sitting's summary (`phase.summary.winner` — filled from the first step on);
 *   2. the live sitting's bare winner (`phase.winner` — an instance; the resolution read off the table it still
 *      stands on);
 *   3. no winner decided yet — the vote's own FORECAST (`slots[].isWinning` + its `leader`, the band's overview
 *      reading): the verb then says so («Побеждает»), never «принимается»;
 *   4. no live sitting — the last finished one (`lastPhase.winner`).
 * `undefined` when nothing is up for a vote — the plate then says «Заседание» alone, as it did.
 *
 * PURE: no Vue, no DOM, no translation (English KEYS out) — spec'd under the server runner
 * (`tests/console/sittingInvitation.spec.ts`).
 */
import {Color} from '@/common/Color';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';

export type SittingInvitationFacts = {
  resolution: ResolutionId;
  party: ReduxParty;
  /** The resolution line's verb (an English key): «Being enacted» · «Enacted» · the forecast's «Leading the vote». */
  resolutionKey: 'Being enacted' | 'Enacted' | 'Leading the vote';
  /** The winner of the vote — a seat, the neutral player, or none yet (a forecast with no delegate on the card). */
  winner: Color | 'neutral' | undefined;
  /** The facts are the vote's standing, not the sitting's verdict. */
  forecast: boolean;
  /** How a tie was broken — the band's own two words (`parliamentBand.verdictLine`). */
  tieKey?: 'Tie broken by the slot order' | 'Tie broken by the earlier delegate';
};

function tieKeyOf(tieBreak: 'slot-priority' | 'earlier-delegate' | undefined): SittingInvitationFacts['tieKey'] {
  if (tieBreak === undefined) {
    return undefined;
  }
  return tieBreak === 'slot-priority' ? 'Tie broken by the slot order' : 'Tie broken by the earlier delegate';
}

export function sittingInvitationFacts(parliament: ParliamentModel | undefined): SittingInvitationFacts | undefined {
  if (parliament === undefined) {
    return undefined;
  }
  const phase = parliament.phase;
  if (phase !== undefined) {
    // The glossary's verb: «принимается» while the sitting runs, «принята» once it is over (the seat still to close it).
    const enacted = phase.step === 'done' || phase.step === 'adjourn';
    const summary = phase.summary?.winner;
    if (summary !== undefined) {
      const out: SittingInvitationFacts = {
        resolution: summary.resolution,
        party: summary.party,
        resolutionKey: enacted ? 'Enacted' : 'Being enacted',
        winner: summary.player ?? 'neutral',
        forecast: false,
      };
      const tieKey = tieKeyOf(summary.tieBreak);
      if (tieKey !== undefined) {
        out.tieKey = tieKey;
      }
      return out;
    }
    const bare = phase.winner;
    if (bare !== undefined) {
      const slot = parliament.slots.find((s) => s.instance === bare.instance);
      const card = slot ?? (parliament.enacted?.instance === bare.instance ? parliament.enacted : undefined);
      if (card !== undefined) {
        return {
          resolution: card.resolution,
          party: card.party,
          resolutionKey: enacted ? 'Enacted' : 'Being enacted',
          winner: bare.player ?? 'neutral',
          forecast: false,
        };
      }
    }
    const leading = parliament.slots.find((s) => s.isWinning);
    if (leading !== undefined) {
      return {resolution: leading.resolution, party: leading.party, resolutionKey: 'Leading the vote', winner: leading.leader, forecast: true};
    }
    return undefined;
  }
  const last = parliament.lastPhase?.winner;
  if (last !== undefined) {
    const out: SittingInvitationFacts = {
      resolution: last.resolution,
      party: last.party,
      resolutionKey: 'Enacted',
      winner: last.player ?? 'neutral',
      forecast: false,
    };
    const tieKey = tieKeyOf(last.tieBreak);
    if (tieKey !== undefined) {
      out.tieKey = tieKey;
    }
    return out;
  }
  return undefined;
}
