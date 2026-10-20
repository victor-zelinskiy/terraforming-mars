/*
 * THE TILE GRANT STEP (Turmoil Redux) — the ONE executor of a resolution's
 * `tileGrant` declaration (`common/parliament/tileGrant.ts`): the tile a law
 * grants the seats — Skyscrapers' tier for the winner and everyone at
 * influence 2+, Mars First Budget's city for every player. A card declares
 * the grant (WHO and WHERE) and the words of its prompt; this step is the same
 * for every one of them, so the next grant adds no code here.
 *
 * WHAT THE STEP FIXES:
 *  · WHO is ONE predicate (`tileGrantEligibility`) — the step pays by it, every
 *    client reading reads it. A seat the rule passes over is a NAMED skip of
 *    the rule, never «no influence».
 *  · WHERE is the ONE placement validator of the declaration's placement —
 *    `city-tier` (the seat's own cities on Mars) or `city` (the ordinary city
 *    rules; a cell with a placement cost is offered only when the seat can
 *    afford it NOW — after every earlier part of the enactment). The choice is
 *    SHOWN even with one candidate (invariant 3). Re-read by a reload's
 *    rebuild: nothing on the table moves while the phase waits for the answer.
 *  · NOWHERE TO GO → NOTHING, and it NAMES ITSELF (the placement's own reason,
 *    a journal line and a `skipped` record) — nothing substitutes for it.
 *  · THE TILE GOES THROUGH THE ENGINE: a tier through `Game.addCityTier` (the
 *    cell pays nothing again), a city through `Game.addCity` (the phase is
 *    `PARLIAMENT`: the cell's printed bonus, the ocean adjacency, the Ares
 *    toll, every card and party reaction to a city — the ruling Mars First
 *    included). The chairman quest never counts it (`QuestTracker.eligible`).
 *  · ONE record per seat: `kind: 'city'` with the cell (and, for a tier, the
 *    stack it became), or the skip — under `tileGrantStepKey(grant)`.
 *
 * MarsBot never runs this step (it asks): the bot's tile is paid by its own
 * primitives (`automa/BotTileGrant.ts`) under the same key and the same rule.
 */
import {TileType} from '../../../common/TileType';
import {ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {
  TILE_GRANT_NOT_ELIGIBLE_REASON, TileGrantDeclaration, tileGrantEligibility, tileGrantNoDestinationReason, tileGrantStepKey,
} from '../../../common/parliament/tileGrant';
import {ChoiceContextSource} from '../../../common/models/PlayerInputModel';
import {createMarsSelectSpace} from '../../boards/marsSelectSpaceHelper';
import {committedPlacement} from '../../inputs/placementContext';
import {Board} from '../../boards/Board';
import {PlacementType} from '../../boards/PlacementType';
import {EnactStep} from './IResolution';

/** The card's own words for its prompt — the title (journal text only) and the committed placement's sentence (English keys). */
export type TileGrantStepWords = {
  title: string;
  context: string;
};

/** The ONE placement validator of each destination — the candidate set the reason pipeline and the dossier read too. */
function placementTypeOf(grant: TileGrantDeclaration): PlacementType {
  switch (grant.placement) {
  case 'own-city': return 'city-tier';
  case 'any-legal': return 'city';
  }
}

/** THE SHARED TILE GRANT STEP of `resolution` — listed where the printed order puts the tile in `immediateSteps`. */
export function tileGrantStep(resolution: ResolutionId, grant: TileGrantDeclaration, words: TileGrantStepWords): EnactStep {
  // WHO asks — the same source on the placement, its dossier and every skip.
  const source: ChoiceContextSource = {kind: 'resolution', resolution};
  const placementType = placementTypeOf(grant);
  return {
    key: tileGrantStepKey(grant),
    run(ctx) {
      const player = ctx.player;
      const game = ctx.game;
      const eligibility = tileGrantEligibility(grant, {winner: ctx.winner?.id === player.id, influence: ctx.influence});
      if (eligibility === 'none') {
        // The rule passes the seat over — named as the rule, never as «no influence».
        game.log('${0} is below 2 influence and did not win the vote — no city tile from ${1}', (b) => b.player(player).resolution(resolution));
        ctx.report({kind: 'skipped', influence: ctx.influence, reason: TILE_GRANT_NOT_ELIGIBLE_REASON});
        return undefined;
      }
      const spaces = game.board.getAvailableSpacesForType(player, placementType);
      if (spaces.length === 0) {
        // Nowhere to go: the tile is named and skipped, nothing substitutes for it.
        switch (grant.placement) {
        case 'own-city':
          game.log('${0} has no city on Mars — the city tile from ${1} is skipped', (b) => b.player(player).resolution(resolution));
          break;
        case 'any-legal':
          game.log('${0} has no legal space for a city tile — the city tile from ${1} is skipped', (b) => b.player(player).resolution(resolution));
          break;
        }
        ctx.report({kind: 'skipped', influence: ctx.influence, reason: tileGrantNoDestinationReason(grant)});
        return undefined;
      }
      // THE STANDARD PLACEMENT PROMPT over the destination's own kind: the
      // console's board flow with the cell dossier, every other cell
      // explained, the resolution as the source (`placementContext.source` —
      // the plate, the dossier's chip, L3). The answer places the tile and
      // reports the cell + the stack it became.
      return createMarsSelectSpace(player, words.title, spaces, {
        placementType,
        tileType: TileType.CITY,
        placementContext: committedPlacement(words.context, source),
      }).andThen((space) => {
        switch (grant.placement) {
        case 'own-city':
          game.addCityTier(player, space);
          // A tier names the stack it became.
          ctx.report({kind: 'city', influence: ctx.influence, space: space.id, stackHeight: Board.tiersOf(space)});
          break;
        case 'any-legal':
          game.addCity(player, space);
          game.log('${0} placed the city tile from ${1}', (b) => b.player(player).resolution(resolution));
          // A new city has no stack to name — the record names its cell.
          ctx.report({kind: 'city', influence: ctx.influence, space: space.id});
          break;
        }
        return undefined;
      });
    },
  };
}
