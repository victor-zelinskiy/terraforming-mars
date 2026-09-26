/*
 * THE COLONY TRACK STEP (Turmoil Redux) — the ONE executor of a resolution's
 * `trackAdvance` declaration (`common/parliament/colonyTrackAdvance.ts`):
 * «Advance each colony track 2 steps» (Unity Budget, RX29). A card declares
 * the steps; this step is the same for every one of them, so the next law
 * that moves the colony table adds no code here.
 *
 * WHAT THE STEP FIXES:
 *  · A WORLD STEP, NEVER A SEAT'S. The track is the TILE's — the tiles with
 *    nobody's cube on them and the bot's alike advance, ONCE per enactment,
 *    whoever won and even when the neutral player did. Listed in
 *    `worldSteps` (the driver runs it once, attributes it to nobody, records
 *    it with no player); listed in `immediateSteps` it would run once PER
 *    SEAT and move every track 2 × N steps — the rules error the guard exists
 *    to refuse.
 *  · EVERY TILE IN PLAY, through the engine's own move: `Colony.increaseTrack`
 *    — the very clamp the end of the generation and a trade use, so a track
 *    can never pass `MAX_COLONY_TRACK_POSITION`. An INACTIVE tile (Miranda
 *    before an animal card, a tile «back in the box») has no live track: the
 *    end of the generation does not move it (`Colony.endGeneration`) and
 *    neither does this step — it is not in the record.
 *  · THE END OF THE TRACK IS NAMED, per tile: the record keeps every tile's
 *    marker BEFORE and AFTER (`tracks`), so a track that stood at its end
 *    reads «at its maximum» (before === after) and a track one short of it
 *    reads its honest single step — never a pretence of two, never a silent
 *    early return. The room is the shared arithmetic (`colonyTrackRoom`) the
 *    vote reading and the stand print, so the sentence and the move agree.
 *  · ONE record per enactment (`kind: 'colonyTrack'`, `amount` = the declared
 *    steps, `tracks` = the list) — the whole table is one movement, not N
 *    payouts; a table with no tile in play at all is a NAMED skip.
 *  · ONCE, at the enactment: the driver's world key (`world:<generation>:
 *    <instance>:colonyTracks`) makes a reload move nothing twice; the step
 *    mutates and never asks (IResolution.ts).
 */
import {ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {
  COLONY_TRACK_STEP_KEY, ColonyTrackAdvance, ColonyTrackMove, colonyTrackRoom, NO_COLONY_TRACK_REASON,
} from '../../../common/parliament/colonyTrackAdvance';
import {EnactStep} from './IResolution';

/** THE SHARED COLONY TRACK STEP of `resolution` — declared in a card's `worldSteps` beside its `trackAdvance`. */
export function colonyTrackStep(resolution: ResolutionId, advance: ColonyTrackAdvance): EnactStep {
  return {
    key: COLONY_TRACK_STEP_KEY,
    run(ctx) {
      const game = ctx.game;
      // The tiles with a LIVE track — exactly the ones the end of the generation advances.
      const tiles = game.colonies.filter((colony) => colony.isActive);
      if (tiles.length === 0) {
        game.log('No colony tile is in play — ${0} advances no track', (b) => b.resolution(resolution));
        ctx.report({kind: 'skipped', amount: advance.steps, tracks: [], reason: NO_COLONY_TRACK_REASON});
        return undefined;
      }
      const tracks: Array<ColonyTrackMove> = tiles.map((colony) => {
        const before = colony.trackPosition;
        const room = colonyTrackRoom(advance, before);
        if (room.moves) {
          // The engine's own move — the same clamp a trade and the end of the generation use.
          colony.increaseTrack(room.applied);
          game.log('${0} advanced the ${1} colony track ${2} step(s) (${3} → ${4})', (b) =>
            b.resolution(resolution).colony(colony).number(room.applied).number(before).number(colony.trackPosition));
        } else {
          // THE END OF THE TRACK, NAMED: the marker stood there already; nothing pretends to have moved.
          game.log('The ${0} colony track is at its maximum — ${1} does not advance it', (b) =>
            b.colony(colony).resolution(resolution));
        }
        return {colony: colony.name, before, after: colony.trackPosition};
      });
      ctx.report({kind: 'colonyTrack', amount: advance.steps, tracks});
      return undefined;
    },
  };
}
