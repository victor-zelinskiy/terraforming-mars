import {IPlayer} from '../IPlayer';
import {SelectSpace} from '../inputs/SelectSpace';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {LogHelper} from '../LogHelper';
import {Space} from '../boards/Space';
import {Message} from '../../common/logs/Message';
import {TileType} from '../../common/TileType';
import {ChoiceContextSource} from '../../common/models/PlayerInputModel';
import {NO_REMOVABLE_OCEAN_REASON} from '../../common/parliament/tileRemoval';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';
import {committedPlacement} from '../inputs/placementContext';
import {recordSkippedEffect} from './skippedEffect';
import type {SkippedEffect} from '../cards/actionPreviews';

/**
 * AN OCEAN LEAVES THE BOARD — the ONE step of every ocean removal: the Reds'
 * party action and the Dry Deserts event (classic Turmoil), Water Export's
 * world step (Turmoil Redux RX33 — the first honest form, whose prompt this
 * file now builds), and a card that lowers the planet (TR47 Ecological
 * Experiment — «decrease each Mars global parameter … remove any ocean you
 * like»).
 *
 * WHAT THE STEP FIXES (the RX33 contract, `docs/TURMOIL_REDUX_WATER_EXPORT.md` §6):
 *  · THE LEGAL SET is the engine's own filter — every PLAIN ocean on the
 *    board, whoever placed it, an ocean reserve's or Artificial Lake's, the
 *    ocean lying UNDER an ordinary city included (TR44 — only the water leaves,
 *    `Game.removeTile` → `liftOcean`); an upgraded ocean (Ocean City, Ocean
 *    Farm…) is never offered, and the per-cell reason says why
 *    (`'ocean-removal'` — `requires-ocean-tile` / `occupied`).
 *  · THE MARKERS the console reads: `placementEffect: 'remove'` (no landing
 *    hero — the departure is a board event every viewer sees alike),
 *    `placementType: 'ocean-removal'` (the dossier's kind), `tileType: OCEAN`,
 *    and a committed `placementContext` naming WHO asks (`source` — the card,
 *    the resolution, the party) with the reason the pick cannot be taken back.
 *  · THE CHOICE IS ALWAYS SHOWN — one removable ocean is still a question
 *    (invariant 3): the player sees which tile leaves, and what it uncovers.
 *  · NOTHING TO REMOVE is a NAMED skip (`recordSkippedEffect` with the family's
 *    own reason), never the silent `undefined` this class used to return.
 *  · THE REMOVAL is the engine's (`Game.removeTile` with the actor: the
 *    `tile-removed` event, the Capitals' recount); the shared log line names
 *    the tile; the caller's `andThen` receives the cell (or `undefined` when
 *    nothing could be removed).
 */

/** The prompt's default title — the RX33 wording, one key for every asker. */
export const REMOVE_OCEAN_TITLE = 'Select an ocean tile to remove from the board';
/** The committed plate's default sentence — why the pick cannot be taken back. */
export const REMOVE_OCEAN_COMMITTED_REASON = 'The ocean leaves the board. The action is already underway.';
/** The skipped effect's name — the removal that had no ocean to take. */
export const SKIPPED_OCEAN_REMOVAL_LABEL = 'Remove an ocean tile';

/** WHAT an ocean removal loses when no plain ocean stands — ONE description for the record and the preview. */
export function skippedOceanRemoval(): SkippedEffect {
  return {label: SKIPPED_OCEAN_REMOVAL_LABEL, effect: {direction: 'cost', icon: 'oceans', amount: 1}};
}

export type OceanRemovalOptions = {
  title?: string | Message;
  /** WHO asks — the card / resolution / party the dossier's source plate names. */
  source?: ChoiceContextSource;
  /** Why the pick cannot be taken back (the committed plate's own sentence). */
  reason?: string | Message;
};

/** The ocean count before and after the removal — what the caller reports. */
export type OceanRemovalCounts = {before: number, after: number};

/**
 * THE ONE PROMPT of an ocean removal — the plain oceans, the markers, the
 * engine's removal in its answer, then the caller's own word (`onRemoved`).
 * The caller checks that there IS something to remove first (the deferred
 * action below does; a resolution step names its own skip).
 */
export function oceanRemovalPrompt(
  player: IPlayer,
  options: OceanRemovalOptions & {onRemoved: (space: Space, counts: OceanRemovalCounts) => void},
): SelectSpace {
  const game = player.game;
  const removable = game.board.getOceanSpaces({upgradedOceans: false});
  return createMarsSelectSpace(player, options.title ?? REMOVE_OCEAN_TITLE, removable, {
    placementType: 'ocean-removal',
    tileType: TileType.OCEAN,
    placementEffect: 'remove',
    placementContext: committedPlacement(options.reason ?? REMOVE_OCEAN_COMMITTED_REASON, options.source),
  }).andThen((space) => {
    const before = game.board.getOceanSpaces().length;
    game.removeTile(space.id, player);
    const after = game.board.getOceanSpaces().length;
    LogHelper.logBoardTileAction(player, space, 'ocean tile', 'removed');
    options.onRemoved(space, {before, after});
    return undefined;
  });
}

export class RemoveOceanTile extends DeferredAction<Space | undefined> {
  private readonly options: OceanRemovalOptions;

  constructor(player: IPlayer, options: string | OceanRemovalOptions = {}) {
    super(player, Priority.DEFAULT);
    this.options = typeof options === 'string' ? {title: options} : options;
  }

  public execute() {
    const removable = this.player.game.board.getOceanSpaces({upgradedOceans: false});
    if (removable.length === 0) {
      // NO SILENT LOSS: the step that owns the effect names it — the journal row, the rival's notification.
      recordSkippedEffect(this.player, NO_REMOVABLE_OCEAN_REASON, skippedOceanRemoval());
      this.continueWith(undefined);
      return undefined;
    }
    return oceanRemovalPrompt(this.player, {
      ...this.options,
      onRemoved: (space) => this.continueWith(space),
    });
  }

  /** The caller's word on the empty answer / the cell — a callback typed `void` may still return a value; only an input is deferred. */
  private continueWith(space: Space | undefined): void {
    const next = this.cb(space);
    this.player.defer(typeof next === 'object' && next !== null ? next : undefined);
  }
}
