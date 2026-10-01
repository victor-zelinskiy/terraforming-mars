import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {MaximizeColonyTrack} from '../../deferredActions/MaximizeColonyTrack';
import * as actionPreviews from '../actionPreviews';

/**
 * TR07 — COLONY SPONSORS («Спонсоры колоний»), the tenth Turmoil Redux PROJECT card.
 *
 * A green (AUTOMATED) card: «Requires that you have a colony in play. Choose
 * 1 colony track. Move its marker to the highest (right-most) position.» The
 * first card of the set to move a COLONY TRACK by being played — and the
 * fourth target of the staged play: the tile is chosen in the colony grid
 * hosted by the hand, the play is committed on the tile's stage, and the
 * answer rides the play batch as its ADDRESSED `colony` tail. The card defers
 * the shared step `MaximizeColonyTrack` and writes no `SelectColony` and no
 * `trackPosition` of its own (never Naomi's bare field write).
 *
 * SCAN READING — cost 5, one tag in the corner (the striped planet: Jovian).
 * The orange MIN box beside the cost holds the colony glyph (▲ with a dome):
 * the REQUIREMENT «you have a colony in play» (`{colonies: 1}`), not a tag.
 * No VP badge. The graphic is one row, large: «SET [colony tile] TO MAX» —
 * the pill is the printed COLONY TILE glyph (`b.colonyTile()`), never the
 * colony cube. The grey ▲ at the bottom left is the Colonies symbol
 * (`compatibility: 'colonies'` in the manifest); the purple Turmoil hexagon
 * below it is the module itself (never `compatibility: 'turmoil'`, see TR02).
 *
 * RULE READINGS (the card's text + the Colonies rules; the Redux rulebook does
 * not mention the card — pinned by tests/cards/turmoilRedux/ColonySponsors.spec.ts):
 *  1. «Requires that you have a colony in play» — at least ONE colony of the
 *     player's own (`ColoniesRequirement` counts the player's cubes); a
 *     rival's colony does not count.
 *  2. «Choose 1 colony track» — any colony TILE in play, whoever's cubes stand
 *     on it, a tile with a docked fleet included (the track does not depend on
 *     the fleet).
 *  3. Only an ACTIVE tile — an inactive one (Titan, Enceladus, Miranda before
 *     their card) has no marker on its track. DERIVED, not printed: every path
 *     of the engine reads it so (`Colony.endGeneration`, the RX29 world step,
 *     Market Manipulation). The inactive tile stands DISABLED with its reason.
 *  4. «Move its marker to the highest (right-most) position» — a SET, not
 *     «+N»: the position becomes the tile's last cell (`trackTop` — today 6 on
 *     every tile, read through one function); steps = top − current; a marker
 *     never moves down.
 *  5. A tile whose marker already stands at the top is DISABLED with its reason
 *     (the pick would change nothing). NO candidate at all (every active track
 *     at its top) — the card stays playable (its requirement is only a colony;
 *     the Jovian tag is worth something too) and the effect is a NAMED skip:
 *     the composer says so before the play, and no door is drawn.
 *  6. It is NOT a trade: the «trade N times» quest, Venus Trade Hub and the
 *     fleets are untouched. The next trade with the tile reads its income at
 *     the top (the Redux Pluto's refusal of the lower positions lifts by the
 *     colony's own rule), and that trade drops the track as always.
 *  7. The journal: the engine's own line «increased ${1} colony track ${2}
 *     step(s)» with the steps actually made, plus the typed
 *     `colony-track-moved` fact under the card's source (a rival reads
 *     «Трек колонии · Луна 3 → 7» in the play's chain).
 *  8. MarsBot never plays it (the bot's deck is tags); a track a player moved
 *     is read by the bot's trade as it stands.
 */
export class ColonySponsors extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.COLONY_SPONSORS,
      type: CardType.AUTOMATED,
      tags: [Tag.JOVIAN],
      cost: 5,
      requirements: {colonies: 1},

      metadata: {
        cardNumber: 'TR07',
        infoText: [
          {text: 'Move the marker of 1 colony track of your choice to its highest (right-most) position.', tokens: ['colony_tile']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.text('SET', Size.LARGE, true).colonyTile().text('TO MAX', Size.LARGE, true);
        }),
        description: 'Requires that you have a colony in play. Choose 1 colony track. Move its marker to the highest (right-most) position.',
      },
    });
  }

  /** THE step `bespokePlay` defers — built once, asked by the preview (its read-only twin) and queued by the play. */
  private step(player: IPlayer): MaximizeColonyTrack {
    return new MaximizeColonyTrack(player, {kind: 'card', card: this.name});
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(this.step(player));
    return undefined;
  }

  /**
   * One branch, no chips: the result depends on the tile («target-dependent
   * results are not guessed before a target exists»), so the branch carries
   * the DOOR — the tile is chosen in the colony grid, where each candidate
   * shows where its marker lands — or, with no tile to move, the named skip.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [], [actionPreviews.colonyPickStep(this, this.step(player))]);
  }
}
