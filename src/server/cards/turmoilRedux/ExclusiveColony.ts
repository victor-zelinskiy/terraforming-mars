import {IProjectCard} from '../IProjectCard';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {BuildColony, NO_COLONY_TO_BUILD_ON_REASON} from '../../deferredActions/BuildColony';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

/**
 * The live prompt's title — mirrored by the staged preview. It names BOTH
 * lifted rules (the colony grid lights a tile at its limit and a tile the
 * player already stands on; the stage prints this title as its action line).
 */
export const EXCLUSIVE_COLONY_TITLE = 'Select where to build the colony — a tile with 3 colonies or with your own colony is allowed';

/**
 * TR25 — EXCLUSIVE COLONY («Эксклюзивная колония»), a Turmoil Redux PROJECT
 * card — the set's first build of a colony BEYOND THE 3-COLONY LIMIT.
 *
 * A green (AUTOMATED) card: «Requires Unity to be ruling or that you have 2
 * delegates there. Place a colony on any colony tile, EVEN IF YOU ALREADY HAVE
 * A COLONY THERE, OR IT HAS 3 COLONIES. THIS IGNORES THE 3-COLONY LIMIT. (You
 * gain the colony tile's placement bonus.)» The tile is chosen in the colony
 * grid hosted by the hand, the play is committed on the tile's stage, and the
 * answer rides the play batch as its ADDRESSED `colony` tail (the staged
 * colony door of TR07, whole). The card defers the shared step `BuildColony`
 * with the door's two flags and holds no `SelectColony`, no `addColony` and no
 * comparison of a cube count with the limit of its own: the limit is a rule of
 * the build's DOOR (`Colonies.buildBlockedReason {ignoreLimit}`), and «beyond
 * the limit» is arithmetic over the cubes (`common/colonies/colonyBerths.ts`,
 * docs/TURMOIL_REDUX_EXCLUSIVE_COLONY.md). Nothing is serialized for it.
 *
 * SCAN READING — cost 10; ONE tag in the corner: the yellow star on dark
 * (Space). The orange MIN plate beside the cost holds Unity's emblem: the
 * REQUIREMENT (`{party: UNITY}`), not a tag. The graphic is one row: «[colony]*»
 * — the black triangle with a dome (the colony symbol) and an asterisk, as on
 * Research Colony. No VP. The grey ▲ at the bottom left is the Colonies symbol
 * (`compatibility: 'colonies'` in the manifest); the purple Turmoil hexagon
 * below it is the module itself (never `compatibility: 'turmoil'`, see TR02).
 * NO flavour line is printed: the lore is INVENTED for the art and the
 * mechanic (docs/claude/turmoil-redux-invented-lore.md — «Fully booked? Not
 * for members.»).
 *
 * WHAT THE TABLETOP TILE PRINTS (…/Colonies/Vesta.png): the build bonus stands
 * in the FIRST THREE cells of the track and the cubes stand ON those cells; the
 * fourth cell prints nothing — which is why the card spells the bonus out in
 * brackets. The rulebook v1.0 does not mention the card.
 *
 * RULE READINGS (the card's text + the tile + the engine — pinned by
 * tests/cards/turmoilRedux/ExclusiveColony.spec.ts):
 *  1. The requirement is Unity's plate (`{party: UNITY}` — the class of TR15).
 *  2. IT IS AN ORDINARY BUILD of a colony — `Colony.addColony`: the journal
 *     line, the build bonus, «the marker never sits below the colonies», every
 *     `onColonyAddedByAnyPlayer` reactor, the bot's corporation, the chairman's
 *     «build colonies» quest, Leavitt's Science tag. None of it is programmed
 *     here.
 *  3. EXACTLY TWO RULES ARE LIFTED — «you already have a colony here» and
 *     «the tile has 3 colonies». NOT lifted: an inactive tile, the TR a build
 *     bonus costs under the Reds (Europa's ocean; Leavitt + Pharmacy Union), a
 *     tile of the reserve.
 *  4. THE LIMIT IS LIFTED FOR THIS BUILD, NOT FOR THE TILE: afterwards the
 *     tile is at its limit for everybody (4 ≥ 3) — the builder, Research
 *     Colony, the standard project, Colony Contest and MarsBot included.
 *     Played onto a tile with 0–2 colonies it is an ordinary build (possibly a
 *     second one of the player's own), and the tile's limit stays three.
 *  5. THE FOURTH COLONY'S BUILD BONUS IS THE TILE'S (the card's brackets): the
 *     berth read clamped to the last printed cell (`buildBenefitAt`) — the same
 *     number on every uniform tile, 2 VP on Titania (5 / 3 / 2).
 *  6. THE TRACK: the marker's floor is the number of colonies (4) — after a
 *     trade and for `decreaseTrack` alike; a marker that stood lower is lifted
 *     by the build. THE PHYSICAL LIMIT no card lifts: a cube needs a cell and
 *     the marker keeps one of its own (`NO_FREE_TRACK_CELL_REASON`) —
 *     unreachable with one card (4 ≤ 6), written and named anyway.
 *  7. The owners' bonus of a trade is paid PER CUBE: four cubes, four payouts.
 *  8. Every count of colonies reads the cubes (+1, as from any build).
 *  9. A tile carrying colonies does not leave the game (TR10) — unchanged.
 * 10. MarsBot never plays the card and never builds beyond the limit
 *     (`botBuildColony` reads `isFull`); its cube beside a fourth human one is
 *     paid its storage on every trade as before.
 * 11. UNPLAYABLE — ONE reason, in order: the requirement → nowhere to build
 *     («No colony available to build on»). In the door every refused tile is
 *     named by ITS OWN reason.
 * 12. A SINGLE candidate is still CHOSEN by a press (no auto-select).
 * 13. THE JOURNAL names the lifted rule: a build into a berth beyond the
 *     printed ones writes «… beyond the 3-colony limit» instead of the
 *     ordinary line (the writer's, `Colony.addColony`).
 * 14. Four cubes survive a save / load; no field is added, old saves are
 *     untouched.
 *
 * SISTERS: the twelve declarative builders (Mining Colony and its family) keep
 * the follow-up prompt of v1 — the shared step has its read-only twin now, so
 * moving one of them to the staged door is a line in its file, not a mechanism.
 */
export class ExclusiveColony extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.EXCLUSIVE_COLONY,
      type: CardType.AUTOMATED,
      tags: [Tag.SPACE],
      cost: 10,
      requirements: {party: PartyName.UNITY},

      metadata: {
        cardNumber: 'TR25',
        infoText: [
          {text: 'Place a colony on any colony tile, EVEN IF YOU ALREADY HAVE A COLONY THERE, OR IT HAS 3 COLONIES. This ignores the 3-colony limit.', tokens: ['colonies']},
          {text: 'You gain the colony tile\'s placement bonus.'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.colonies(1).asterix();
        }),
        description: 'Requires Unity to be ruling or that you have 2 delegates there. Place a colony on any colony tile, EVEN IF YOU ALREADY HAVE A COLONY THERE, OR IT HAS 3 COLONIES. THIS IGNORES THE 3-COLONY LIMIT. (You gain the colony tile\'s placement bonus.)',
      },
    });
  }

  /**
   * THE step `bespokePlay` defers — built once, asked by the playability
   * check, the preview (its read-only twin) and queued by the play. The door's
   * two flags ARE the card's two printed clauses. The PREVIEW and the
   * playability check fold the card's unpaid price into «can the TR of the
   * build bonus be afforded»; the live step is built without it (the price is
   * paid by then).
   */
  private step(player: IPlayer, canAffordOptions?: CanAffordOptions): BuildColony {
    return new BuildColony(player, {
      allowDuplicate: true,
      ignoreLimit: true,
      title: EXCLUSIVE_COLONY_TITLE,
      cause: {kind: 'card', card: this.name},
      canAffordOptions,
    });
  }

  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions): boolean {
    return this.step(player, canAffordOptions).hasCandidate();
  }

  /** Rule 11 — ONE reason (the requirement's own comes first, from the card's requirement). */
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    return this.step(player, player.affordOptionsForCard(this)).hasCandidate() ?
      undefined :
      reason.targetReason(NO_COLONY_TO_BUILD_ON_REASON);
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(this.step(player));
    return undefined;
  }

  /**
   * One branch, no chips: where the colony lands — and therefore which build
   * bonus is paid — is the player's pick, so the branch carries the DOOR. The
   * tile is chosen in the colony grid, where every candidate wears the cube's
   * ghost in the berth it will take (the fourth, beyond the limit mark, on a
   * tile at its limit). The step's `buildSites` marker tells the forecast that
   * a colony is built («⚡ Сработает» for Poseidon).
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [], [actionPreviews.colonyPickStep(this, this.step(player, player.affordOptionsForCard(this)))]);
  }
}
