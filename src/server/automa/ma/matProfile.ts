import {BoardName} from '../../../common/boards/BoardName';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotMapProfile} from '../boards/MarsBotMapProfile';
import {VASTITAS_VENUS_TRACK} from '../boards/VastitasBorealisMarsBot';
import {GeneratedMat, matBase} from './matGenerator';

/**
 * The PROFILE a generated mat plays as — the shape every consumer of the static boards already reads
 * (`MarsBotMapProfile`), so the rest of the engine does not know whether the mat was printed or generated.
 *
 * - the tracks are the mat's;
 * - the Corporate Competition card is B14, the A&M module's «Corporate Competition · this game's set» — its helpers are
 *   the registry's, one per award of THIS game;
 * - the placement tiebreakers and the «+1 icon» bullet are the base map's (the map layer of stage 4 adds the set's);
 * - the Venus row follows the Microbe tag (Vastitas Nova's row when Microbe rides the science track).
 */
export function profileForMat(boardName: BoardName, mat: GeneratedMat): MarsBotMapProfile {
  const {profile: base} = matBase(boardName);
  return {
    boardName,
    tracks: mat.tracks,
    corporateCompetition: BonusCardId.B14_CORPORATE_COMPETITION_MA,
    placementTiebreakers: base.placementTiebreakers,
    tiebreakRewardBonus: base.tiebreakRewardBonus,
    venusTrack: mat.venusRow === 'microbe-on-science' ? VASTITAS_VENUS_TRACK : undefined,
  };
}
