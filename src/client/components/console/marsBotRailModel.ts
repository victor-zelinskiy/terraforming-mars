/*
 * marsBotRailModel — PURE, DOM-free model of the LEFT RAIL's dedicated
 * MarsBot presentation (the Information Workspace inspects the bot seat).
 *
 * The Automa participant has NO human economy: no production, no plant /
 * energy / heat stocks — its real state is the M€ supply (mirrored on the
 * bot seat's PublicPlayerModel), the floater stock, and the TAG TRACKS on
 * its printed board (tags on flipped cards push the matching tracker). The
 * rail therefore swaps its two zones for the bot:
 *
 *  - the six resource rows → the bot ECONOMY rows (M€ always; floaters when
 *    it holds any) — real values, no fake +0 production chips;
 *  - the МЕТКИ tag matrix → the TRACK list: one row per printed track with
 *    ALL of its mapped tags (a track can serve several — POWER+JOVIAN,
 *    EARTH+CITY, the bio track), the current position and a progress fill
 *    toward that track's own max (the Venus track is 12, not 18).
 *
 * Data is already public and server-authoritative (MarsBotModel mirrors the
 * physical table); this module only shapes it for the rail. Read-only.
 */

import {Tag} from '@/common/cards/Tag';
import {CardResource} from '@/common/CardResource';
import {MarsBotModel, MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {cardResourceCSS} from '@/client/components/common/cardResources';
import {additionalResourceMetricKey} from '@/client/components/additionalResources/additionalResources';

export type MarsBotRailEconomyRow = {
  /** Stable row key (also the v-for key). */
  key: string;
  /** Ready-to-render icon classes (resource_icon / card-resource family). */
  iconClass: string;
  value: number;
  /** AnimatedMetricValue key — shares the human families so the delta-chip
   *  language stays identical (scope = the bot seat's color). */
  metricKey: string;
};

export type MarsBotRailTrack = {
  /** Stable per-track key — the tag composition is fixed for the game. */
  key: string;
  /** EVERY tag the track serves, in printed order — never just the first. */
  tags: ReadonlyArray<Tag>;
  position: number;
  maxPosition: number;
  /** 0–100 integer for the progress fill width. */
  fillPercent: number;
  metricKey: string;
};

/** The bot's real economy — M€ supply first, floaters only once it holds any. */
export function marsBotRailEconomy(bot: PublicPlayerModel, automa: MarsBotModel): Array<MarsBotRailEconomyRow> {
  const rows: Array<MarsBotRailEconomyRow> = [
    {
      key: 'megacredits',
      iconClass: 'resource_icon resource_icon--megacredits',
      value: bot.megacredits,
      metricKey: 'megacredits.stock',
    },
  ];
  if (automa.floaters > 0) {
    rows.push({
      key: 'floaters',
      iconClass: `card-resource ${cardResourceCSS[CardResource.FLOATER]}`,
      value: automa.floaters,
      metricKey: additionalResourceMetricKey(CardResource.FLOATER),
    });
  }
  return rows;
}

function trackKey(track: MarsBotTrackModel, index: number): string {
  return `${index}:${track.tags[0] ?? 'track'}`;
}

/** The printed tracks in board order — positions clamp defensively so a
 *  malformed model can never draw an over-full bar. */
export function marsBotRailTracks(automa: MarsBotModel): Array<MarsBotRailTrack> {
  return automa.tracks.map((t, i) => {
    const max = Math.max(1, t.maxPosition);
    const position = Math.min(Math.max(0, t.position), max);
    return {
      key: trackKey(t, i),
      tags: t.tags,
      position,
      maxPosition: max,
      fillPercent: Math.round((position / max) * 100),
      metricKey: `bottrack.${trackKey(t, i)}`,
    };
  });
}
