import {BoardName} from '../../../common/boards/BoardName';
import {Tag} from '../../../common/cards/Tag';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotMapProfile, tiebreakerById} from '../boards/MarsBotMapProfile';
import {marsBotOf} from '../AutomaUtil';
import {placementRegion} from './placementRegions';
import {VASTITAS_VENUS_TRACK} from '../boards/VastitasBorealisMarsBot';
import {GeneratedMat, matBase} from './matGenerator';

/**
 * The PROFILE a generated mat plays as — the shape every consumer of the static boards already reads
 * (`MarsBotMapProfile`), so the rest of the engine does not know whether the mat was printed or generated.
 *
 * - the tracks are the mat's;
 * - the Corporate Competition card is B14, the A&M module's «Corporate Competition · this game's set» — its helpers are
 *   the registry's, one per award of THIS game;
 * - the placement tiebreakers and the «+1 icon» bullets are the SET's (the map layer — `MatPlacement`), rebuilt from
 *   their stable ids; a version-1 mat (no placement) plays the base map's;
 * - the Venus row follows the Microbe tag (Vastitas Nova's row when Microbe rides the science track) — a map with a
 *   Venus row of its OWN (Amazonis Planitia's 16-cell row) builds it for the mat's Microbe track (`venusTrackFor`).
 */
export function profileForMat(boardName: BoardName, mat: GeneratedMat): MarsBotMapProfile {
  const {profile: base} = matBase(boardName);
  const placement = mat.placement;
  return {
    boardName,
    tracks: mat.tracks,
    corporateCompetition: BonusCardId.B14_CORPORATE_COMPETITION_MA,
    placementTiebreakers: placement === undefined ? base.placementTiebreakers : placement.steps.map((id) => tiebreakerById(id)),
    tiebreakRewardBonus: placement === undefined ? base.tiebreakRewardBonus : (game, space) => {
      const bot = marsBotOf(game);
      return placement.iconBonus.filter((region) => placementRegion(region, game, bot)(space)).length;
    },
    venusTrack: base.venusTrackFor !== undefined ?
      base.venusTrackFor(Math.max(0, mat.tracks.findIndex((t) => t.tags.includes(Tag.MICROBE)))) :
      mat.venusRow === 'microbe-on-science' ? VASTITAS_VENUS_TRACK : undefined,
  };
}
