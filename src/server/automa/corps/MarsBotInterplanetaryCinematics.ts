import {Tag} from '../../../common/cards/Tag';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {MarsBotCorp} from './MarsBotCorp';
import {TrackPayout, payForTrackAdvance} from './MarsBotTrackPayout';

const INFO = marsBotCorpInfo(MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS);

/** The printed payout: 2 M€ per advance of the building or event track. */
const PAYOUT: TrackPayout = {
  tracks: [Tag.BUILDING, Tag.EVENT],
  mc: 2,
  original: INFO.original,
  corpName: 'Interplanetary Cinematics',
  countStat: 'icTrackAdvances',
  mcStat: 'icMc',
  logTemplate: (tag) => tag === Tag.BUILDING ?
    '${0} gained ${1} M€ from its corporation ${2} for advancing the building track' :
    '${0} gained ${1} M€ from its corporation ${2} for advancing the event track',
};

/**
 * MarsBot Interplanetary Cinematics — official card C04:
 *
 *   STARTING TAGS  event, event
 *   SETUP          Replace the trackers for the building track and event
 *                  track with white cubes as a reminder for this
 *                  corporation's effect.
 *   EFFECT         When MarsBot advances the building or event tracks,
 *                  including the starting tags, MarsBot gains 2 MC.
 *
 * The SETUP box changes NOTHING — it swaps a component for a reminder, and
 * the digital table needs no reminder token to remember. It is still modeled,
 * as data (`info.whiteMarkerTracks`), because the player reading the bot's mat
 * deserves the same cue the physical table gets: those two markers are painted
 * white with the effect named beside them.
 *
 * The EFFECT is per ADVANCE, not per tag: an advance that cascades along its
 * own track (`advance` icons — the event track prints four) pays for every
 * step it takes, and a tag that cannot advance (a maxed track — the official
 * Failed Action) pays nothing, because the framework only dispatches after a
 * successful step. «Including the starting tags» needs no special case: the
 * corporation is seated before its starting tags resolve, so the two printed
 * event tags run through the very same hook. The payout itself is shared with
 * C09 Teractor (`MarsBotTrackPayout`) — same sentence, different tracks.
 */
export const MarsBotInterplanetaryCinematics: MarsBotCorp = {
  info: INFO,

  onTrackAdvance(game: IGame, trackIndex: number): void {
    payForTrackAdvance(game, trackIndex, PAYOUT);
  },
};
