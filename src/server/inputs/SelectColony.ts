import {Message} from '../../common/logs/Message';
import {BasePlayerInput, PlayerInput} from '../PlayerInput';
import {IColony} from '../colonies/IColony';
import {CardName} from '../../common/cards/CardName';
import {InputResponse, isCancelResponse, isSelectColonyResponse} from '../../common/inputs/InputResponse';
import {FleetDockOfferModel, SelectColonyModel} from '../../common/models/PlayerInputModel';
import {coloniesToModel} from '../models/ModelUtils';
import {IPlayer} from '../IPlayer';
import {InputError} from './InputError';
import {ColonyTrackMove} from '../../common/parliament/colonyTrackAdvance';
import {ColonyRosterPrompt} from '../../common/colonies/ColonyRoster';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ColonyTileSite} from '../../common/colonies/ColonyTileSite';
import {ColonyBuildSite} from '../../common/colonies/ColonyBuildSite';

export class SelectColony extends BasePlayerInput<IColony> {
  // When true, show just the tile, and none of the cubes on top.
  // Used for tiles that are not yet in the game, or for a clearer
  // visualziation when necesary.
  public showTileOnly = false;
  // "pick an existing in-game colony" (default) vs "add a new colony tile to
  // the game" (Aridor & co). The premium picker shows ALL game colonies for the
  // former (disabling the unpickable ones) and only the offered tiles for the
  // latter — see SelectColonyModel.purpose.
  public purpose: 'selectExistingColony' | 'addNewColonyToGame' = 'selectExistingColony';
  // Relevant-but-unpickable colonies shown DISABLED with a reason. Kept OUT of
  // `colonies` so `process()` rejects them for free.
  public disabledColonies: ReadonlyArray<{colony: IColony, reason: string | Message}> = [];

  /**
   * Optional cancel handler for a CANCELLABLE colony placement (pay-on-commit
   * Build-Colony standard project). When the client submits a `CancelResponse`
   * AND `placementContext.cancellable` is true, `process` invokes this instead of
   * building — nothing is spent, no colony is placed, the player returns to the
   * action menu. Absent → a cancel response is rejected (mandatory).
   */
  public onCancel?: () => void;

  /**
   * THE TRADE'S OTHER DESTINATIONS — the player's fleet-dock cards with the
   * server's verdict (`ColoniesHandler.tradeDestinationPick` fills both
   * fields; see `colonies/FleetDock.ts`). Published as the model's
   * `fleetDocks` marker, and answered with the second form of the colony
   * response (`{type: 'colony', fleetDock}`): the card must be listed here
   * as `available`, or the answer is rejected with the dock's own reason.
   * Empty on every pick that is not a trade's destination pick — a dock
   * answer to such a pick is rejected like any unknown colony.
   */
  public fleetDocks: ReadonlyArray<FleetDockOfferModel> = [];
  /** The handler of a dock answer — the twin of `cb` for the second response form. */
  public onFleetDock?: (card: CardName) => PlayerInput | undefined;

  /**
   * WHERE EACH CANDIDATE'S MARKER WOULD LAND — the pick moves the chosen
   * tile's track (TR07 Colony Sponsors: to its top; `MaximizeColonyTrack`).
   * Published as the model's `trackMoves` marker so the client draws the
   * projection instead of computing it. Empty on every other colony pick.
   */
  public trackMoves: ReadonlyArray<ColonyTrackMove> = [];

  /**
   * THIS PICK PLACES A TILE ON THE CHOSEN COLONY TILE (TR22 Nova City;
   * `PlaceCityOnColonyTile`). Published as the model's `tileSite` marker: the
   * tile, its hosted cell and the server's projection of the count and the
   * card's VP. Absent on every other colony pick.
   */
  public tileSite: ColonyTileSite | undefined = undefined;

  /**
   * THIS PICK CHANGES THE ROSTER — a tile enters the game, leaves it, or is
   * replaced in its slot (`ColonyRosterPrompt`: Aridor's catalog, the solo
   * setup trim, TR10's replacement). Published as the model's `rosterChange`
   * marker: who may leave (and why not), whether each entering tile wakes up
   * active, whether the colony the effect builds lands. Absent on every other
   * colony pick.
   */
  public rosterChange: ColonyRosterPrompt | undefined = undefined;

  /**
   * THIS PICK BUILDS A COLONY — where the cube lands on EACH candidate
   * (`BuildColony.prompt()`, the one construction of a build prompt).
   * Published as the model's `buildSites` marker: the berth, whether it lies
   * beyond the printed limit, the player's own cubes there. Empty on every
   * other colony pick.
   */
  public buildSites: ReadonlyArray<ColonyBuildSite> = [];
  /**
   * The handler of a REPLACEMENT answer (`{colonyName, replaces}`) — the twin
   * of `cb` for the fourth response form: `incoming` is one of `colonies` (the
   * reserve), `outgoing` a tile the marker lists as able to leave.
   */
  public onReplace?: (incoming: IColony, outgoing: ColonyName) => PlayerInput | undefined;

  constructor(
    title: string | Message,
    buttonLabel: string = 'Save',
    public colonies: Array<IColony>,
  ) {
    super('colony', title);
    this.buttonLabel = buttonLabel;
  }

  public toModel(player: IPlayer): SelectColonyModel {
    const model: SelectColonyModel = {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'colony',
      coloniesModel: coloniesToModel(player.game, this.colonies, this.showTileOnly),
      purpose: this.purpose,
    };
    if (this.disabledColonies.length > 0) {
      model.disabledColonies = this.disabledColonies.map((d) => ({name: d.colony.name, reason: d.reason}));
    }
    // The PLACEMENT marker rides the input's own toModel (never the central
    // decorator — a colony pick is routinely NESTED: a played card's effect,
    // a standard project's target step), exactly as `SelectSpace` carries it.
    // Without it the client cannot tell a CANCELLABLE pay-on-commit build
    // (Build Colony: nothing is spent until a colony is chosen) from a
    // mandatory one, so B could only ever minimize — the cancel branch the
    // server has always supported was unreachable.
    if (this.placementContext !== undefined) {
      model.placementContext = this.placementContext;
    }
    // The trade's card destinations ride the input's own toModel for the same
    // reason: the pick is nested in the trade action's AndOptions.
    if (this.fleetDocks.length > 0) {
      model.fleetDocks = this.fleetDocks;
    }
    // The track projection rides the input's own toModel too (nesting-safe).
    if (this.trackMoves.length > 0) {
      model.trackMoves = this.trackMoves;
    }
    // …and so does the roster marker (the staged twin reads this same model).
    if (this.rosterChange !== undefined) {
      model.rosterChange = this.rosterChange;
    }
    // …and the «a tile lands on the chosen colony tile» marker.
    if (this.tileSite !== undefined) {
      model.tileSite = this.tileSite;
    }
    // …and the «a colony is built on the chosen tile» marker (a build is
    // routinely nested too: the standard project's target step).
    if (this.buildSites.length > 0) {
      model.buildSites = this.buildSites;
    }
    return model;
  }

  /** The second response form: the fleet goes to a card. Refused BEFORE anything is paid. */
  private processFleetDock(card: CardName): PlayerInput | undefined {
    const offer = this.fleetDocks.find((dock) => dock.card === card);
    if (offer === undefined || this.onFleetDock === undefined) {
      throw new InputError(`Fleet dock ${card} not found`);
    }
    if (!offer.available) {
      const reason = typeof offer.reason === 'string' ? offer.reason : offer.reason?.message;
      throw new InputError(reason ?? `Fleet dock ${card} is not available`);
    }
    return this.onFleetDock(card);
  }

  public process(input: InputResponse) {
    if (isCancelResponse(input)) {
      if (this.placementContext?.cancellable === true && this.onCancel !== undefined) {
        this.onCancel();
        return undefined;
      }
      throw new InputError('This colony placement cannot be cancelled');
    }
    if (!isSelectColonyResponse(input)) {
      throw new InputError('Not a valid SelectColonyResponse');
    }
    if (input.fleetDock !== undefined) {
      return this.processFleetDock(input.fleetDock);
    }
    if (input.colonyName === undefined) {
      throw new InputError('No colony selected');
    }
    const colony = this.colonies.find((c) => c.name === input.colonyName);
    if (colony === undefined) {
      throw new InputError(`Colony ${input.colonyName} not found`);
    }
    // A REPLACEMENT is answered with both tiles and with nothing less; every
    // other pick refuses a `replaces` it never asked about.
    if (this.rosterChange?.kind === 'replace') {
      return this.processReplacement(colony, input.replaces);
    }
    if (input.replaces !== undefined) {
      throw new InputError('This colony pick does not replace a colony tile');
    }
    return this.cb(colony);
  }

  /** The fourth response form: `incoming` takes the slot of `replaces`. Refused BEFORE anything changes. */
  private processReplacement(incoming: IColony, replaces: ColonyName | undefined): PlayerInput | undefined {
    if (replaces === undefined) {
      throw new InputError('No colony tile to replace selected');
    }
    const outgoing = this.rosterChange?.outgoing?.find((tile) => tile.colony === replaces);
    if (outgoing === undefined || this.onReplace === undefined) {
      throw new InputError(`Colony ${replaces} cannot be replaced`);
    }
    if (outgoing.reason !== undefined) {
      throw new InputError(outgoing.reason);
    }
    return this.onReplace(incoming, replaces);
  }
}
