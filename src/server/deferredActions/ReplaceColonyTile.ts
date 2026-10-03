import {CanAffordOptions, IPlayer} from '../IPlayer';
import {IColony} from '../colonies/IColony';
import {ColoniesHandler} from '../colonies/ColoniesHandler';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {recordSkippedEffect} from './skippedEffect';
import {SelectColony} from '../inputs/SelectColony';
import type {SkippedEffect} from '../cards/actionPreviews';
import {ChoiceContextSource, SelectColonyModel} from '../../common/models/PlayerInputModel';
import {ColonyRosterBuild, ColonyRosterIncoming, ColonyRosterOutgoing} from '../../common/colonies/ColonyRoster';
import {ColonyName} from '../../common/colonies/ColonyName';

/** The prompt's title — an English i18n key (the journal text; the console reads the markers, never this). */
export const REPLACE_COLONY_TILE_TITLE = 'Select a colony tile to remove and a new colony tile to replace it';

/** The skip label — the effect a lost «remove a tile, replace it with a new one» is NAMED by. */
export const COLONY_TILE_LABEL = 'Colony tile';

/** The cause of the skip when every tile in play carries a colony or a fleet. */
export const NO_VACANT_COLONY_TILE_REASON = 'Every colony tile has a colony or a trade fleet on it';

/** The cause of the skip when the box holds no tile to bring in. */
export const NO_RESERVE_COLONY_TILE_REASON = 'No colony tile is left in the reserve';

/** The skip label of the colony the effect would have built on the new tile. */
export const COLONY_ON_NEW_TILE_LABEL = 'Colony on the new tile';

/**
 * What a lost «remove a colony tile and replace it» is NAMED by — the one
 * description the play preview's warning (`actionPreviews.colonyPickStep`) and
 * the after-the-fact record share. No magnitude: a tile is not an amount.
 */
export function skippedTileReplacement(reason: string = NO_VACANT_COLONY_TILE_REASON): {reason: string, skipped: SkippedEffect} {
  return {reason, skipped: {label: COLONY_TILE_LABEL}};
}

/** …and the colony «placed on it, if possible» that was not possible — `reason` is the build's own (`Colonies.buildBlockedReason`). */
export function skippedColonyOnNewTile(reason: string): {reason: string, skipped: SkippedEffect} {
  return {reason, skipped: {label: COLONY_ON_NEW_TILE_LABEL}};
}

type Offer = {
  /** EVERY tile in play, the table's order — `reason` on each that cannot leave. */
  outgoing: Array<ColonyRosterOutgoing>,
  /** The reserve — every tile of it may enter. */
  reserve: Array<IColony>,
  incoming: Array<ColonyRosterIncoming>,
};

/**
 * «REMOVE FROM PLAY A COLONY TILE THAT HAS NO COLONIES, TILES, OR TRADE FLEETS
 * ON IT. REPLACE IT WITH A NEW COLONY TILE OF YOUR CHOICE[, AND PLACE A COLONY
 * ON IT, IF POSSIBLE].» (Turmoil Redux TR10 Fringe Colony) — the shared step
 * any card that swaps a colony tile inherits.
 *
 * ONE QUESTION, ONE ANSWER. The prompt offers the RESERVE (the tiles that may
 * enter) and carries the roster marker `{kind: 'replace'}` with every tile in
 * play (`outgoing` — who may leave, the ONE reason on each who may not) and
 * the projection of every reserve tile (`incoming` — would it enter active,
 * would the colony land). The answer names BOTH tiles
 * (`{colonyName, replaces}`), and `ColoniesHandler.replaceColonyTile` swaps
 * them atomically: the table never has a hole in it, so no other prompt can
 * be asked between the removal and the arrival.
 *
 * WHO MAY LEAVE — a tile in play with no colony (anybody's, MarsBot's cube
 * included) and no trade fleet on it (`ColoniesHandler.colonyTileOccupiedReason`);
 * its activity and its track do not matter. A SINGLE candidate is still asked
 * (no auto-select: the player sees which tile goes).
 *
 * WHO MAY ENTER — any tile of the reserve (`game.discardedColonies`). The tile
 * just removed is not among them: it returns to the reserve only as the swap
 * happens.
 *
 * THE COLONY (`options.build`) — the player's own, on the new tile's first
 * berth, through the engine's `Colony.addColony` (the build bonus, every
 * «colony built» trigger, the parliament's quest). The target is fixed (the
 * tile just chosen), but SHOWN on every candidate before the press. «If
 * possible» is the build's ONE reason function (`Colonies.buildBlockedReason`):
 * a tile that enters inactive, or the TR of its build bonus that cannot be
 * afforded — then the swap still happens and the colony is a NAMED skip.
 *
 * NO CANDIDATE TO REMOVE (or an empty reserve) is a NAMED skip of the whole
 * effect and the card is still played.
 *
 * ONE PROMPT, BUILT ONCE, READ TWICE: `execute()` raises it and
 * `previewSelectColony()` describes it without touching anything.
 * `canAffordOptions` is the PREVIEW's: before the play the card is not paid
 * yet, so «can the TR be afforded» must fold the card's own price in; the live
 * step is built without it (the price is paid by then).
 *
 * Priority: `DEFAULT` — a card's own on-play input (the staged tail is
 * ADDRESSED for the prompts the same play may trigger first).
 */
export class ReplaceColonyTile extends DeferredAction<undefined> {
  constructor(
    player: IPlayer,
    /** The giver — the card being played (the prompt's `choiceContext.source`, the staged tail's address). */
    public readonly cause: ChoiceContextSource,
    private readonly options: {
      /** Does the effect also place the player's colony on the new tile, if possible? */
      build: boolean,
      canAffordOptions?: CanAffordOptions,
    },
  ) {
    super(player, Priority.DEFAULT);
  }

  /** What a colony on `tile`, entering now, would do — the build's own reason function. */
  private buildOn(tile: IColony, entersActive: boolean): ColonyRosterBuild {
    const reason = this.player.colonies.buildBlockedReason(tile, {active: entersActive, canAffordOptions: this.options.canAffordOptions});
    return reason === undefined ? {slot: tile.colonies.length} : {skipped: reason};
  }

  private offer(): Offer {
    const game = this.player.game;
    const outgoing = game.colonies.map((colony): ColonyRosterOutgoing => {
      const reason = ColoniesHandler.colonyTileOccupiedReason(colony);
      return reason === undefined ? {colony: colony.name} : {colony: colony.name, reason};
    });
    const reserve = [...game.discardedColonies];
    const incoming = reserve.map((tile): ColonyRosterIncoming => {
      const entersActive = ColoniesHandler.colonyTileWillEnterActive(tile, game);
      return this.options.build ?
        {colony: tile.name, entersActive, build: this.buildOn(tile, entersActive)} :
        {colony: tile.name, entersActive};
    });
    return {outgoing, reserve, incoming};
  }

  /** Why the effect cannot happen at all — `undefined` when there is a tile to remove and a tile to bring. */
  private static skipReason(offer: Offer): string | undefined {
    if (!offer.outgoing.some((tile) => tile.reason === undefined)) {
      return NO_VACANT_COLONY_TILE_REASON;
    }
    if (offer.reserve.length === 0) {
      return NO_RESERVE_COLONY_TILE_REASON;
    }
    return undefined;
  }

  /** The marked prompt, without its answer — the one construction both the live ask and its read-only twin use. */
  private prompt(offer: Offer): SelectColony {
    const select = new SelectColony(REPLACE_COLONY_TILE_TITLE, 'Replace colony tile', offer.reserve);
    // The reserve is shown as bare tiles (nothing stands on a tile in the box).
    select.showTileOnly = true;
    select.purpose = 'addNewColonyToGame';
    select.rosterChange = {kind: 'replace', outgoing: offer.outgoing, incoming: offer.incoming};
    select.markChoiceContext({source: this.cause, mode: 'effect-choice'});
    return select;
  }

  /**
   * READ-ONLY: the `SelectColonyModel` the live path WOULD raise — the same
   * title, reserve, roster marker and giver — or `undefined` exactly where
   * `execute()` records the skip. Nothing is mutated, logged or queued.
   * `choiceContext` is decorated centrally on a live prompt
   * (`ServerModel.getWaitingFor`), so it is attached here by hand.
   */
  public previewSelectColony(): SelectColonyModel | undefined {
    const offer = this.offer();
    if (ReplaceColonyTile.skipReason(offer) !== undefined) {
      return undefined;
    }
    const select = this.prompt(offer);
    const model = select.toModel(this.player);
    model.choiceContext = select.choiceContext;
    return model;
  }

  /** The named skip the preview promises where `previewSelectColony()` has no prompt — the cause `execute()` would record. */
  public previewSkip(): {reason: string, skipped: SkippedEffect} {
    return skippedTileReplacement(ReplaceColonyTile.skipReason(this.offer()));
  }

  public execute(): SelectColony | undefined {
    const player = this.player;
    const game = player.game;
    const offer = this.offer();
    const skip = ReplaceColonyTile.skipReason(offer);
    if (skip !== undefined) {
      const lost = skippedTileReplacement(skip);
      recordSkippedEffect(player, lost.reason, lost.skipped);
      return undefined;
    }
    const select = this.prompt(offer);
    select.onReplace = (incoming: IColony, replaces: ColonyName) => {
      // Re-read at the answer: the world may have moved between the question
      // and the answer (a reload, a sibling effect). Never a remembered verdict.
      const outgoing = game.colonies.find((colony) => colony.name === replaces);
      if (outgoing === undefined || !ColoniesHandler.colonyTileIsVacant(outgoing) || !game.discardedColonies.includes(incoming)) {
        const lost = skippedTileReplacement(outgoing === undefined ? NO_VACANT_COLONY_TILE_REASON :
          ColoniesHandler.colonyTileOccupiedReason(outgoing) ?? NO_RESERVE_COLONY_TILE_REASON);
        recordSkippedEffect(player, lost.reason, lost.skipped);
        return undefined;
      }
      ColoniesHandler.replaceColonyTile(game, player, outgoing, incoming);
      if (this.options.build) {
        // The tile is in play now: its own flag is the entry's verdict, and the
        // card is paid — the live build asks with no price folded in.
        const reason = player.colonies.buildBlockedReason(incoming);
        if (reason === undefined) {
          incoming.addColony(player);
        } else {
          const lost = skippedColonyOnNewTile(reason);
          recordSkippedEffect(player, lost.reason, lost.skipped);
        }
      }
      return undefined;
    };
    return select;
  }
}
