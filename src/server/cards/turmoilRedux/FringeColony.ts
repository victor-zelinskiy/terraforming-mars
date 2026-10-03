import {IProjectCard} from '../IProjectCard';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {ReplaceColonyTile} from '../../deferredActions/ReplaceColonyTile';
import * as actionPreviews from '../actionPreviews';

/**
 * TR10 — FRINGE COLONY («Окраинная колония»), a Turmoil Redux PROJECT card.
 *
 * A green (AUTOMATED) card: «This can only be played during generation 4 or
 * later. Remove from play a colony tile that has NO COLONIES, TILES, OR TRADE
 * FLEETS ON IT. Replace it with a new colony tile of your choice, and place a
 * colony on it, if possible.» The first card of the set to change the colony
 * ROSTER — which tiles are in the game — and the first to gate its play by the
 * generation. The card defers the shared step `ReplaceColonyTile` and writes
 * no `SelectColony` and no `game.colonies` of its own: the roster has ONE
 * writer (`ColoniesHandler.replaceColonyTile`, docs/COLONY_ROSTER_CEREMONY.md).
 *
 * SCAN READING — cost 24; two tags in the corner, in this order: the striped
 * planet (Jovian), the yellow star on dark (Space). The orange MIN plate
 * beside the cost holds the TEXT «GEN 4+»: the REQUIREMENT «generation 4 or
 * later» (`{generation: 4}`), not a tag. The VP badge prints 1 on a Mars disc
 * (the disc is the badge's background). The graphic is one row:
 * «− [colony tile]* + [colony tile]   [▲ colony]*». ⚠ The grey label «TR10»
 * beside the second asterisk (it reads «TRIO» at a glance) is the CARD NUMBER
 * — every card of the set carries its number badge in the corner of the effect
 * field — never a rule and never an icon. The grey ▲ at the bottom left is the
 * Colonies symbol (`compatibility: 'colonies'` in the manifest); the purple
 * Turmoil hexagon below it is the module itself (never
 * `compatibility: 'turmoil'`, see TR02). Flavour: «To boldly go where no
 * businessman has gone.» (`lore_texts.json` «TR10»).
 *
 * RULE READINGS (the card's text + the Colonies rules + the engine; the Redux
 * rulebook does not mention the card — pinned by
 * tests/cards/turmoilRedux/FringeColony.spec.ts):
 *  1. The requirement is the game's CLOCK: `game.generation >= 4`. Before the
 *     4th generation the card is unplayable, and the reason names the «now».
 *  2. WHO MAY LEAVE — a tile IN PLAY with no colony on it (anybody's, MarsBot's
 *     cube included) and no trade fleet (`visitor`). «TILES»: nothing in this
 *     fork is placed ON a colony tile, so the clause is empty today — ONE
 *     predicate (`ColoniesHandler.colonyTileOccupiedReason`) a future «on the
 *     tile» mechanic extends. Activity and the track do not matter (an inactive
 *     Titan is a lawful candidate); MarsBot's stock on its Shipping Board is on
 *     the bot's board, not on the tile.
 *  3. WHO MAY NOT stands DISABLED with ONE reason, in order: colonies first,
 *     the fleet second. Never hidden. A single candidate is still CHOSEN.
 *  4. WHAT ENTERS — any tile of the RESERVE (`game.discardedColonies`: the
 *     table's tiles not dealt into this game), never the tile just removed.
 *     It enters by the engine's rule: active when its class is, or when a card
 *     of its resource is in anybody's tableau; the track on its start.
 *  5. «REPLACE IT» — the new tile takes the removed tile's SLOT (the same
 *     index of `game.colonies`, no re-sort). The removed tile returns to the
 *     reserve as it lies in the box (the same after a save/load).
 *  6. «PLACE A COLONY ON IT, IF POSSIBLE» — the PLAYER's colony on the new
 *     tile's first berth, with the build bonus and every trigger
 *     (`Colony.addColony`). A fixed self-target, SHOWN on every candidate
 *     before the press. Impossible — by the build's ONE reason function: the
 *     tile enters inactive; the TR of its build bonus (Europa's ocean) cannot
 *     be afforded. Then the swap still happens and the colony is a NAMED skip.
 *  7. NO empty tile at all (or an empty reserve) — the card is still playable
 *     (the tags, the 1 VP) and the whole effect is a NAMED skip: the composer
 *     says so before the play, and no door is drawn.
 *  8. NOT a trade and NOT an additional tile: the number of tiles in play does
 *     not change; fleets, the other tracks and MarsBot's stock are untouched.
 *  9. The journal: one line «replaced the X colony tile with Y» + the typed
 *     `colony-roster-changed` fact under the card's source, then the build's
 *     own lines.
 * 10. MarsBot never plays it. At a MarsBot table a human does: the bot's cube
 *     is a colony (rule 2), and the order of `game.colonies` is kept (the bot
 *     counts its flip through the list).
 */
export class FringeColony extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.FRINGE_COLONY,
      type: CardType.AUTOMATED,
      tags: [Tag.JOVIAN, Tag.SPACE],
      cost: 24,
      requirements: {generation: 4},
      victoryPoints: 1,

      metadata: {
        cardNumber: 'TR10',
        infoText: [
          {text: 'Remove from play a colony tile that has no colonies, tiles or trade fleets on it.', tokens: ['colony_tile']},
          {text: 'Replace it with a new colony tile of your choice.', tokens: ['colony_tile']},
          {text: 'Place a colony on the new tile, if possible.', tokens: ['colonies']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.minus().colonyTile().asterix().plus().colonyTile().nbsp.colonies(1).asterix();
        }),
        description: 'This can only be played during generation 4 or later. Remove from play a colony tile that has NO COLONIES, TILES, OR TRADE FLEETS ON IT. Replace it with a new colony tile of your choice, and place a colony on it, if possible.',
      },
    });
  }

  /**
   * THE step `bespokePlay` defers — built once, asked by the preview (its
   * read-only twin) and queued by the play. The PREVIEW folds the card's
   * unpaid price into «can the TR of the build bonus be afforded»; the live
   * step is built without it (the price is paid by then).
   */
  private step(player: IPlayer, canAffordOptions?: CanAffordOptions): ReplaceColonyTile {
    return new ReplaceColonyTile(player, {kind: 'card', card: this.name}, {build: true, canAffordOptions});
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(this.step(player));
    return undefined;
  }

  /**
   * One branch, no chips: what the play does depends on the two tiles
   * («target-dependent results are not guessed before a target exists»), so
   * the branch carries the DOOR — the tiles are chosen in the colony
   * workspace, where every candidate shows what entering means — or, with
   * nothing to replace, the named skip.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [], [actionPreviews.colonyPickStep(this, this.step(player, player.affordOptionsForCard(this)))]);
  }
}
