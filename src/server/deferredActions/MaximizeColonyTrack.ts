import {IPlayer} from '../IPlayer';
import {IColony} from '../colonies/IColony';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {recordSkippedEffect} from './skippedEffect';
import {SelectColony} from '../inputs/SelectColony';
import {LogHelper} from '../LogHelper';
import type {SkippedEffect} from '../cards/actionPreviews';
import {ChoiceContextSource, SelectColonyModel} from '../../common/models/PlayerInputModel';
import {ColonyTrackMove} from '../../common/parliament/colonyTrackAdvance';
import {trackTop} from '../../common/colonies/ColonyMetadata';

/** The prompt's title — an English i18n key (the journal text; the console reads the markers, never this). */
export const MAXIMIZE_COLONY_TRACK_TITLE = 'Select a colony track to move to its highest position';

/** The ONE reason a tile whose marker already stands at its top is shown disabled (and a 0-step answer is skipped). */
export const COLONY_TRACK_AT_TOP_REASON = 'The colony marker is already at its highest position';

/** The ONE reason an inactive tile (Titan, Enceladus, Miranda before their card) is shown disabled — it has no live track. */
export const COLONY_NOT_ACTIVE_REASON = 'This colony is not active yet';

/** The skip label — the effect a lost «move the marker to the top» is NAMED by. */
export const COLONY_TRACK_LABEL = 'Colony track';

/** The cause of the skip when no tile can move at all. */
export const EVERY_COLONY_TRACK_AT_TOP_REASON = 'Every colony track is at its highest position';

/**
 * What a lost «move the chosen colony's marker to its top» is NAMED by — the
 * one description the play preview's warning (`actionPreviews.colonyPickStep`)
 * and the after-the-fact record share. No magnitude: the steps are the chosen
 * tile's, and there is no tile.
 */
export function skippedColonyTrack(reason: string = EVERY_COLONY_TRACK_AT_TOP_REASON): {reason: string, skipped: SkippedEffect} {
  return {reason, skipped: {label: COLONY_TRACK_LABEL}};
}

/** A tile is a candidate when its track is live (active) and has room above the marker. */
function isCandidate(colony: IColony): boolean {
  return colony.isActive && colony.trackPosition < trackTop(colony.metadata);
}

/**
 * «CHOOSE 1 COLONY TRACK. MOVE ITS MARKER TO THE HIGHEST (RIGHT-MOST)
 * POSITION.» (Turmoil Redux TR07 Colony Sponsors) — the shared step any card
 * that sets a chosen tile's track inherits.
 *
 * WHO IS ASKED ABOUT WHAT:
 *  · any colony TILE in play, whoever's cubes stand on it (a tile with a
 *    docked fleet too — the track does not depend on the fleet);
 *  · only an ACTIVE tile — an inactive one (Titan, Enceladus, Miranda before
 *    their card) has no marker on its track: every path of the engine reads it
 *    so (`Colony.endGeneration`, the RX29 world step, Market Manipulation). It
 *    is SHOWN disabled with its reason, never hidden;
 *  · a tile already at its top is SHOWN disabled too — the pick would change
 *    nothing («Маркер уже на максимуме»).
 *
 * IT IS A SET, NOT «+N»: the marker goes to `trackTop(tile)` — the last
 * printed cell of THAT tile — and the steps are `top − current`. A marker
 * never moves down. NO candidate at all is a NAMED skip (`recordSkippedEffect`)
 * and the card is still played: the requirement is only a colony of one's own.
 *
 * NOT A TRADE: no fleet moves, no income is paid, no «trade N times» quest
 * counts. The NEXT trade with the tile reads its income at the top, and that
 * trade then drops the track to the colonies built, as always.
 *
 * ONE PROMPT, BUILT ONCE, READ TWICE: `execute()` raises it and
 * `previewSelectColony()` describes it without touching anything — the play
 * preview's staged door (`actionPreviews.colonyPickStep`) shows the very prompt
 * the commit will ask, with the `trackMoves` projection of every candidate.
 *
 * Priority: `DEFAULT` — a card's own on-play input (an effect the same play
 * triggers can be asked first; the staged tail is ADDRESSED for exactly that,
 * `deferredInputBatch`).
 */
export class MaximizeColonyTrack extends DeferredAction<undefined> {
  constructor(
    player: IPlayer,
    /** The giver — the card being played (the prompt's `choiceContext.source`, the staged tail's address). */
    public readonly cause: ChoiceContextSource,
  ) {
    super(player, Priority.DEFAULT);
  }

  /** The candidates and the disabled tiles with their ONE reason each, in the table's order. */
  private offer(): {candidates: Array<IColony>, disabled: Array<{colony: IColony, reason: string}>} {
    const candidates: Array<IColony> = [];
    const disabled: Array<{colony: IColony, reason: string}> = [];
    for (const colony of this.player.game.colonies) {
      if (isCandidate(colony)) {
        candidates.push(colony);
      } else {
        disabled.push({colony, reason: colony.isActive ? COLONY_TRACK_AT_TOP_REASON : COLONY_NOT_ACTIVE_REASON});
      }
    }
    return {candidates, disabled};
  }

  /** The marked prompt, without its answer — the one construction both the live ask and its read-only twin use. */
  private prompt(candidates: Array<IColony>, disabled: Array<{colony: IColony, reason: string}>): SelectColony {
    const select = new SelectColony(MAXIMIZE_COLONY_TRACK_TITLE, 'Select', candidates);
    select.disabledColonies = disabled;
    select.trackMoves = candidates.map((colony): ColonyTrackMove => ({
      colony: colony.name,
      before: colony.trackPosition,
      after: trackTop(colony.metadata),
    }));
    select.markChoiceContext({source: this.cause, mode: 'effect-choice'});
    return select;
  }

  /**
   * READ-ONLY: the `SelectColonyModel` the live path WOULD raise — the same
   * title, candidates, disabled tiles, `trackMoves` projection and giver — or
   * `undefined` exactly where `execute()` records the skip (no candidate).
   * Nothing is mutated, logged or queued. `choiceContext` is decorated
   * centrally on a live prompt (`ServerModel.getWaitingFor`), so it is attached
   * here by hand.
   */
  public previewSelectColony(): SelectColonyModel | undefined {
    const {candidates, disabled} = this.offer();
    if (candidates.length === 0) {
      return undefined;
    }
    const select = this.prompt(candidates, disabled);
    const model = select.toModel(this.player);
    model.choiceContext = select.choiceContext;
    return model;
  }

  public execute(): SelectColony | undefined {
    const player = this.player;
    const {candidates, disabled} = this.offer();
    if (candidates.length === 0) {
      const lost = skippedColonyTrack();
      recordSkippedEffect(player, lost.reason, lost.skipped);
      return undefined;
    }
    return this.prompt(candidates, disabled).andThen((colony) => {
      // Re-read at the answer: the world may have moved between the question
      // and the answer (a reload, a sibling effect). Never a remembered number.
      const before = colony.trackPosition;
      const steps = trackTop(colony.metadata) - before;
      if (steps <= 0) {
        const lost = skippedColonyTrack(COLONY_TRACK_AT_TOP_REASON);
        recordSkippedEffect(player, lost.reason, lost.skipped);
        return undefined;
      }
      colony.increaseTrack(steps);
      LogHelper.logColonyTrackIncrease(player, colony, steps);
      player.game.events.recordColonyTrackMoved(player, colony.name, before, colony.trackPosition);
      return undefined;
    });
  }
}
