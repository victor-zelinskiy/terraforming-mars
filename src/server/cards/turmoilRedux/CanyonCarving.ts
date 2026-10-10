import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {TileType} from '../../../common/TileType';
import {CardRenderer} from '../render/CardRenderer';
import {
  MOVE_OCEAN_TILE_CONSTRAINT, MOVE_OCEAN_TILE_TITLE, MoveOceanTile, NO_SPACE_TO_MOVE_AN_OCEAN_REASON,
} from '../../deferredActions/MoveOceanTile';
import {movableOceans, oceanMoveDestinations, oceanMoveOffer, oceanMoveReasoner} from '../../boards/oceanMove';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

/**
 * TR39 — CANYON CARVING («Прорезание каньона»), a Turmoil Redux PROJECT card
 * — the project's SECOND tile move (after TR14's city) and the first move of a
 * tile NOBODY owns: any plain ocean on the board is lifted and landed on an
 * adjacent cell, the player gains TR for it and the new cell's bonuses. The
 * move itself is the engine's (`Game.moveOceanTile` — it pays the TR itself
 * and never touches the ocean parameter), the question the shared step's
 * (`MoveTile` under the ocean's rule, `MoveOceanTile`), «which ocean and
 * where» the ocean's one set (`boards/oceanMove.ts`) — this file holds the
 * card and nothing about cells.
 *
 * SCAN READING — cost 6, green (AUTOMATED); ONE tag in the corner: Building
 * (the brown disc with a house). The orange MIN plate beside the cost holds
 * the GREENS' emblem: the REQUIREMENT («Requires the Greens to be ruling or
 * that you have 2 delegates there»), never a tag. The VP badge prints 1 on a
 * Mars disc. The PLAY row, one line: «− [ocean tile] + [ocean tile]*» — the
 * asterisk the special placement rule. The small «TR39» tab is the card's
 * number. The purple Turmoil symbol at the bottom left is the module itself
 * (no `compatibility`). The scan prints NO flavour quote: the archive entry
 * («TR39» in `lore_texts.json` — «Nature took a million years to carve the
 * first canyon. We had a deadline.») is written for the fork, to the art and
 * the mechanics — the registry of such entries is
 * `docs/claude/turmoil-redux-invented-lore.md`. Art: Michael Burke.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/CanyonCarving.spec.ts and,
 * at the engine, tests/boards/oceanMove.spec.ts):
 *  1. The requirement is `{party: GREENS}` — the TR15 / TR38 class (emblem,
 *     named reason, the hand's counter; the starting rule counts; TR36 does
 *     not help). Checked at the play only.
 *  2. WHAT MAY MOVE — ANY plain ocean tile on the board: an ocean has no
 *     owner, so «any 1 ocean tile» is every one of them, whoever placed it —
 *     on an ocean reserve or on land (Artificial Lake, this card). An
 *     upgraded ocean (Ocean City / Farm / Sanctuary / New Holland) and a
 *     Wetlands only COUNT as an ocean and do not move (the removal's own
 *     reading, RX33) — listed disabled with their one reason, never hidden.
 *  3. WHERE — a cell ADJACENT to the ocean out of TWO families: an empty ocean
 *     reserve nobody else claimed, or land «not reserved at all» (Artificial
 *     Lake's reading: empty land or an unprotected Ares hazard at its own
 *     price — never Noctis, never the Nomads camp, never another player's
 *     claim; the player's own claim is fine; an ocean pays no hazard-adjacency
 *     penalty). A colony slot is neither. The card prints no «ignoring other
 *     placement restrictions», so the ordinary cell rules stand.
 *  4. PLAYABLE while AT LEAST ONE ocean may travel; else unplayable with ONE
 *     named reason («no ocean tile on the board has a free adjacent space» —
 *     a board without oceans included). A board that moved between the play
 *     and the step is a NAMED skip (`skippedOceanMove`).
 *  5. THE MOVE IS ONE FUNCTION — `Game.moveOceanTile`: lift (the cell is
 *     bare; its printed bonus is not returned and pays again to whoever takes
 *     it next; an ocean reserve accepts an ocean again, paying its TR again),
 *     land through `addTile` with `moved`, +1 TR explicitly, the record.
 *     NEVER `addOcean`: the ocean parameter does not change (the count is read
 *     off the board), so the nine-ocean gate does not apply — at 9 oceans the
 *     move is legal and pays its TR — and «Mars is terraformed», the global
 *     parameter hooks, the parameter record and the Ares ocean hazard never
 *     run. The TR is the CARD's in the score breakdown (the owner's decision).
 *  6. THE LANDING IS AN ORDINARY OCEAN PLACEMENT on the new cell: the printed
 *     bonus, M€ for the OTHER oceans beside it (the lifted one is gone — a
 *     destination beside the source never counts the source), the Ares
 *     cleanup price and the hazard bonus, Mars First's steel for a tile on
 *     Mars, the Greens' 2 M€ for the TR step, every card's `onTilePlaced`
 *     (Arctic Algae's plants to whoever holds it), the chairman quest's TR
 *     target (a quest's TILE targets know no ocean — nothing there).
 *  7. ADJACENCY VP RECOUNT BY THE BOARD: a Capital — the player's own or
 *     ANOTHER player's — beside the old cell loses one point, beside the new
 *     cell gains one, beside both keeps its score; a plain city (anyone's)
 *     and a greenery score nothing by an ocean.
 *  8. ONE event `tile-moved` with an OCEAN («tiles placed» does not grow), one
 *     log line naming the tile by its kind («moved an ocean tile · A → B»),
 *     the TR on its own line.
 *  9. Save / load: nothing new — the board holds the tiles; the move record is
 *     presentation only.
 * 10. MarsBot never plays the card; the bot is never a tile's owner here (an
 *     ocean has none); the bot's own ocean placements read the board after a
 *     move like after any placement.
 * 11. ONE QUESTION, ONE ANSWER: the state «the ocean is lifted, the cell is
 *     not chosen» never exists on the server; `{spaceId, movedFrom}` names
 *     both cells; a refusal leaves the board as it was.
 * 12. THE PREVIEW HYPOTHESIS (`'ocean-move'`): the ocean lifted off A AND
 *     standing on B — the facts of the departure (a Capital beside A, whoever
 *     owns it) and of the arrival (+1 TR for the move, the cell's bonus, the
 *     ocean adjacency, the parties, a Capital beside B) WITHOUT the ocean
 *     parameter's line and without «nobody loses TR» (here TR is gained).
 *
 * SISTERS: TR14 Re-settlement (a city of the player's own moves — the same
 * step, the same marker, the same scene); RX33 Water Export (an ocean LEAVES
 * the board — the same reading of «ocean tile»); Artificial Lake (an ocean on
 * land — the same land family).
 */
export class CanyonCarving extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.CANYON_CARVING,
      type: CardType.AUTOMATED,
      tags: [Tag.BUILDING],
      cost: 6,
      requirements: {party: PartyName.GREENS},
      victoryPoints: 1,

      metadata: {
        cardNumber: 'TR39',
        // ONE block for the whole move — the row is one row; the TR and the cell's bonuses are the move's own bracket.
        infoText: [{text: 'Move an ocean 1 space: +1 TR, its cell\'s bonuses', tokens: ['oceans']}],
        renderData: CardRenderer.builder((b) => {
          b.minus().oceans(1).plus().oceans(1).asterix();
        }),
        description: 'Requires the Greens to be ruling or that you have 2 delegates there. Remove any 1 ocean tile from the board and place it in an adjacent space that\'s reserved for ocean or not reserved at all. (You gain TR for this, and the placement bonus of that space, including adjacency bonuses.)',
      },
    });
  }

  /** Rule 4 — playable while at least one ocean may travel (the unpaid card's price folded in). */
  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions): boolean {
    return movableOceans(player, canAffordOptions).length > 0;
  }

  /** Rule 4 — ONE reason: no plain ocean with a free cell beside it (no ocean at all reads the same). */
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (movableOceans(player).length === 0) {
      return reason.placementReason(NO_SPACE_TO_MOVE_AN_OCEAN_REASON);
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    // The step's `cause` is the prompt's `sourceCard` — the dossier's source and
    // the address of the staged tail (docs/TILE_PLAY_STAGED_COMMIT.md §9-quater).
    player.game.defer(new MoveOceanTile(player, {kind: 'card', card: this.name}));
    return undefined;
  }

  /**
   * The staged play: the SAME offer the live step raises (`oceanMoveOffer`),
   * with the unpaid card's price folded in — its destinations, its per-ocean
   * reach, its per-cell reason. The staged pick is two cells of one decision
   * (`staged.move`); the play's one POST carries `{spaceId, movedFrom}`.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.placementPreview(this, player, {
      tile: TileType.OCEAN,
      constraint: MOVE_OCEAN_TILE_CONSTRAINT,
      staged: {
        title: MOVE_OCEAN_TILE_TITLE,
        spaces: (canAffordOptions) => oceanMoveDestinations(oceanMoveOffer(player, canAffordOptions)),
        placementType: 'ocean-move',
        reasoner: oceanMoveReasoner(player, oceanMoveOffer(player)),
        move: (canAffordOptions) => oceanMoveOffer(player, canAffordOptions),
      },
    });
  }
}
