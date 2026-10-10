/*
 * THE TILE REMOVAL STEP (Turmoil Redux) — the ONE executor of a resolution's
 * `tileRemoval` declaration (`common/parliament/tileRemoval.ts`): «If oceans
 * are not at maximum, the First Player removes 1 ocean tile from the board»
 * (Water Export, RX33). A card declares the tile and the executor; this step
 * is the same for every one of them, so the next law that takes a tile off
 * the board adds no code here.
 *
 * WHAT THE STEP FIXES:
 *  · A WORLD STEP THAT ASKS. The removal belongs to the TABLE (the ocean
 *    count is the planet's, the tile leaves for everybody) — so it runs ONCE
 *    per enactment, in `worldSteps`, attributed to nobody, its record without
 *    a seat. But the printed rule names an EXECUTOR by position, and that
 *    seat CHOOSES the cell: the driver hands the step the first player in
 *    generation order as the handle (`worldStepHandle` — the nearest human
 *    when that seat is MarsBot) and routes the prompt to it. The contract
 *    stands: the step MUTATES or ASKS — here it asks, and the answer removes.
 *  · THE ENGINE'S OWN REMOVAL: `Game.removeTile` on a cell from
 *    `board.getOceanSpaces({upgradedOceans: false})` — the very mutation and
 *    the very filter `RemoveOceanTile` (the Reds' party action, the Dry
 *    Deserts event) uses; an UPGRADED ocean (Ocean City, Ocean Farm…) is never
 *    offered, exactly as there. The journal line is the shared
 *    `logBoardTileAction` too. What is NOT reused is the deferred class itself:
 *    it swallows its own answer (no `andThen`) and returns `undefined` when
 *    nothing can be removed — the silence this step exists to replace.
 *  · TWO CONDITIONS, TWO REASONS, checked in the card's own order. «If oceans
 *    are not at maximum» is the CARD's clause — `game.canAddOcean()` false →
 *    a named skip (`OCEANS_AT_MAX_REASON`). Then the physical one: no plain
 *    ocean on the board (none placed, or every ocean upgraded) → a named skip
 *    (`NO_REMOVABLE_OCEAN_REASON`). Never one general «nothing happened», and
 *    never the engine's silent early return.
 *  · THE CHOICE IS ALWAYS SHOWN — one removable ocean is still a question
 *    (the console's invariant 3): the executor sees which tile leaves.
 *  · WHAT THE REMOVAL DOES is the engine's, not this step's: the ocean count
 *    is read off the board, so it drops by one on its own (a card requirement
 *    of «N oceans» fails again, the end of the game moves away); no terraform
 *    rating is taken from whoever placed the tile (a rating is never taken
 *    back); the cell's printed bonuses stay paid; the special tiles that score
 *    per adjacent ocean (Capital) recount at the end by the board as it
 *    stands. The record keeps the count before and after (`parameter`), the
 *    cell, the tile and WHO CHOSE (`actor`) — a fact of the choice, never the
 *    record's owner.
 *  · ONCE, at the enactment: the driver's world key (`world:<generation>:
 *    <instance>:oceanRemoval`) makes a reload inside the question rebuild the
 *    SAME prompt for the SAME seat and never remove a second tile.
 */
import {ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {
  NO_REMOVABLE_OCEAN_REASON, OCEANS_AT_MAX_REASON, TILE_REMOVAL_STEP_KEY, TileRemovalDeclaration,
} from '../../../common/parliament/tileRemoval';
import {ChoiceContextSource} from '../../../common/models/PlayerInputModel';
import {TileType} from '../../../common/TileType';
import {SelectSpace} from '../../inputs/SelectSpace';
import {committedPlacement} from '../../inputs/placementContext';
import {LogHelper} from '../../LogHelper';
import {EnactStep} from './IResolution';

/** THE SHARED TILE REMOVAL STEP of `resolution` — declared in a card's `worldSteps` beside its `tileRemoval`. */
export function tileRemovalStep(resolution: ResolutionId, _declaration: TileRemovalDeclaration): EnactStep {
  const source: ChoiceContextSource = {kind: 'resolution', resolution};
  return {
    key: TILE_REMOVAL_STEP_KEY,
    run(ctx) {
      const game = ctx.game;
      const board = game.board;
      const oceans = board.getOceanSpaces().length;
      // THE CARD'S OWN CLAUSE FIRST — «if oceans are not at maximum»: a full
      // sea is a rule of this resolution, not a limit of the removal (there is
      // plenty to remove), and it is NAMED.
      if (!game.canAddOcean()) {
        game.log('Oceans are at their maximum — ${0} removes none', (b) => b.resolution(resolution));
        ctx.report({kind: 'skipped', amount: 0, parameter: {id: 'oceans', before: oceans, after: oceans}, reason: OCEANS_AT_MAX_REASON});
        return undefined;
      }
      // THE PHYSICAL ONE SECOND — the engine's own filter: plain oceans only.
      // `RemoveOceanTile` would return `undefined` here and say nothing.
      const removable = board.getOceanSpaces({upgradedOceans: false});
      if (removable.length === 0) {
        game.log('No ocean tile can be removed — ${0} removes none', (b) => b.resolution(resolution));
        ctx.report({kind: 'skipped', amount: 0, parameter: {id: 'oceans', before: oceans, after: oceans}, reason: NO_REMOVABLE_OCEAN_REASON});
        return undefined;
      }
      // THE ASK — to the executor the driver handed in (the first player), the
      // cell to be REMOVED, the console told so by the server's own marker
      // (`placementEffect: 'remove'` arms the departure, never a landing), the
      // source plate naming the law through `placementContext.source`.
      const executor = ctx.player;
      const prompt = new SelectSpace('Select an ocean tile to remove from the board', removable);
      prompt.placementEffect = 'remove';
      // The KIND names the legal set for the board's own explainer (the plain
      // oceans) — without a kind the console draws no dossier for the pick.
      prompt.placementType = 'ocean-removal';
      prompt.tileType = TileType.OCEAN;
      prompt.placementContext = committedPlacement('The first player removes this ocean. The resolution is already enacted.', source);
      return prompt.andThen((space) => {
        const before = board.getOceanSpaces().length;
        // THE ENGINE'S REMOVAL — the same mutation the Reds' action makes.
        game.removeTile(space.id, executor);
        const after = board.getOceanSpaces().length;
        LogHelper.logBoardTileAction(executor, space, 'ocean tile', 'removed');
        game.log('${0}: the ocean count falls ${1} → ${2}; nobody loses TR for it', (b) =>
          b.resolution(resolution).number(before).number(after));
        ctx.report({kind: 'tileRemoved', space: space.id, tile: TileType.OCEAN, chosenBy: executor.id, amount: after - before, parameter: {id: 'oceans', before, after}});
        return undefined;
      });
    },
  };
}
