import {PreludeCard} from '../prelude/PreludeCard';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';
import {IPlayer} from '../../IPlayer';
import {IGame} from '../../IGame';
import {Size} from '../../../common/cards/render/Size';
import {trackTop} from '../../../common/colonies/ColonyMetadata';
import {ColonyTrackMove} from '../../../common/parliament/colonyTrackAdvance';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {BuildColony} from '../../deferredActions/BuildColony';
import {message} from '../../logs/MessageBuilder';
import * as actionPreviews from '../actionPreviews';

/** The printed raise: every colony track in play, 2 steps. */
const RAISE_STEPS = 2;

/**
 * P48 · Early Colonization — «Raise all colony tracks 2 steps. Place a colony. Gain 3 energy.» The RULES ORDER is the
 * printed one and the engine's: `Card.play()` runs the declarative half first (the build is QUEUED — `Priority.
 * BUILD_COLONY` — and the 3 energy land), then `bespokePlay` raises every ACTIVE track at once; the placement prompt
 * is asked afterwards, over the raised tracks (it matters: `Colony.placeCube` lifts a track «up to the colony count»,
 * so raise → place and place → raise read apart on a low track).
 *
 * The raise is never mute: each move is RECORDED (`recordColonyTrackMoved` — the journal / notifications read it),
 * logged in ONE line, PROMISED before the press (`cardPlayPreview` — names, before → after, the top and the inactive
 * tiles named) and carried to the client ON THE PLACEMENT PROMPT ITSELF (`BuildColony.queuedFor` → `trackRaise`), so
 * the console plays the wave off the question, never off a diff of two views.
 */
export class EarlyColonization extends PreludeCard {
  constructor() {
    super({
      tags: [Tag.SPACE],
      name: CardName.EARLY_COLONIZATION,

      behavior: {
        colonies: {buildColony: {}},
        stock: {energy: 3},
      },

      metadata: {
        cardNumber: 'P48',
        description: 'Raise all colony tracks 2 steps. Place a colony. Gain 3 energy.',
        infoText: [
          {kind: 'remainder', text: 'All active colony tracks rise 2 steps (an inactive tile does not; a track stops at its top)', tokens: ['colony']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.colonyTile({all}).text('+2').br;
          b.text('RAISE ALL COLONY TRACKS 2 STEPS', Size.SMALL, true).br;
          b.colonies(1).energy(3);
        }),
      },
    });
  }

  /**
   * WHAT THE RAISE DOES RIGHT NOW — read-only, the one arithmetic the play and its preview share: one move per
   * ACTIVE tile in play (an inactive one is skipped by the rule), cut by the tile's own top (`trackTop` — the bound
   * `Colony.increaseTrack` clamps to); `before === after` where the marker already stands at the top.
   */
  public static raisePlan(game: IGame): Array<ColonyTrackMove> {
    return game.colonies
      .filter((colony) => colony.isActive)
      .map((colony) => ({
        colony: colony.name,
        before: colony.trackPosition,
        after: Math.min(colony.trackPosition + RAISE_STEPS, trackTop(colony.metadata)),
      }));
  }

  public override bespokePlay(player: IPlayer) {
    const game = player.game;
    const moves: Array<ColonyTrackMove> = [];
    for (const colony of game.colonies) {
      if (!colony.isActive) {
        continue;
      }
      const before = colony.trackPosition;
      colony.increaseTrack(RAISE_STEPS);
      const after = colony.trackPosition;
      moves.push({colony: colony.name, before, after});
      if (after !== before) {
        game.events.recordColonyTrackMoved(player, colony.name, before, after);
      }
    }
    game.log('${0} raised every active colony track ${1} steps with ${2}', (b) =>
      b.player(player).number(RAISE_STEPS).card(this));
    // No silent loss: a track already at its top keeps its marker — named, tile by tile.
    for (const move of moves) {
      if (move.after === move.before) {
        const colony = game.colonies.find((c) => c.name === move.colony);
        if (colony !== undefined) {
          game.log('${0} colony track is already at its top', (b) => b.colony(colony));
        }
      }
    }
    // The placement the declarative half queued asks over the raised tracks — and says what was raised.
    BuildColony.queuedFor(player, this.name)?.setTrackRaise(moves);
    return undefined;
  }

  // The raise is computable before the press: every active track named with its before → after, a track at its top
  // and an inactive tile named too (no silent loss); then the placement (chosen after the confirm), as the declarative
  // preview promises it; the 3 energy ride the behaviour's own chip.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const game = player.game;
    const plan = EarlyColonization.raisePlan(game);
    const rows = game.colonies.map((colony) => {
      const move = plan.find((m) => m.colony === colony.name);
      if (move === undefined) {
        return actionPreviews.noteStep('colony', message('${0} colony track: not active, it does not rise', (b) => b.colony(colony)));
      }
      if (move.after === move.before) {
        return actionPreviews.noteStep('colony', message('${0} colony track: already at its top', (b) => b.colony(colony)));
      }
      return actionPreviews.noteStep('colony', message('${0} colony track: ${1} → ${2}', (b) =>
        b.colony(colony).number(move.before + 1).number(move.after + 1)));
    });
    return actionPreviews.playPreview(this, player, [], [
      actionPreviews.noteStep('colony', message('All active colony tracks rise ${0} steps', (b) => b.number(RAISE_STEPS))),
      ...rows,
      {kind: 'boardPlacement', placementType: 'colony'},
    ]);
  }
}
