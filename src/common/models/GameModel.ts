import {GameOptionsModel} from './GameOptionsModel';
import {AresAdjacencyGrantModel} from './AresAdjacencyGrantModel';
import {TileMoveRecordModel} from '../boards/TileMove';
import {CardAdjacencyPayoutModel} from './CardAdjacencyPayoutModel';
import {ScaleStepRewardModel} from './ScaleStepRewardModel';
import {ParameterSwingModel} from './ParameterSwingModel';
import {MarsBotModel} from './MarsBotModel';
import {ColonyModel} from './ColonyModel';
import {Color} from '../Color';
import {TurmoilModel} from './TurmoilModel';
import {ParliamentModel} from './ParliamentModel';
import {ClaimedMilestoneModel} from './ClaimedMilestoneModel';
import {FundedAwardModel} from './FundedAwardModel';
import {Phase} from '../Phase';
import {AresData} from '../ares/AresData';
import {SpaceModel} from './SpaceModel';
import {MoonModel} from './MoonModel';
import {PathfindersModel} from './PathfindersModel';
import {SpectatorId} from '../Types';
import {ColonyName} from '../colonies/ColonyName';
import {GlobalParameter} from '../GlobalParameter';
import {Tag} from '../cards/Tag';
import {CardName} from '../cards/CardName';

// Game-level snapshot of an available standard project. Players see the
// full list in the Standard Projects overlay regardless of whose turn it
// is; the per-player playability check (canAfford + canAct + within
// action phase) happens against `playerView.waitingFor`.
export type StandardProjectModel = {
  name: CardName;
  cost: number; // base cost (before per-player discounts)
};

// Common data about a game not assocaited with a player (eg the temperature.)
export type GameModel = {
  aresData: AresData | undefined;
  /** Latest Ares adjacency payouts (presentation manifest for the console
   *  placement scenes; public facts — the log already names every payout). */
  aresAdjacencyGrants?: ReadonlyArray<AresAdjacencyGrantModel>;
  /** Latest TILE MOVES (Turmoil Redux TR14): the server's word that a removal
   *  on one cell and a landing on another are ONE relocation — the board's
   *  remote stage plays one tile carried across. Presentation only; each
   *  client consumes a record once by `seq`. See `TileMoveRecordModel`. */
  tileMoves?: ReadonlyArray<TileMoveRecordModel>;
  /** Latest PER-NEIGHBOUR CARD PAYOUTS (Turmoil Redux TR21 Arboretum): which
   *  neighbouring cities paid how many units onto which card — the board
   *  scene's script for the paid seat and every other viewer alike.
   *  Presentation only; consumed once by `seq`. See `CardAdjacencyPayoutModel`. */
  cardAdjacencyPayouts?: ReadonlyArray<CardAdjacencyPayoutModel>;
  /** Latest SCALE-STEP PAYOUTS (Turmoil Redux TR24 Venusian Census, Aphrodite):
   *  a card that answers «each time the scale is terraformed» paid its owner —
   *  the board scene's script (tokens born at the scale's marker) for the paid
   *  seat and every other viewer alike. Presentation only; consumed once by
   *  `seq`. See `ScaleStepRewardModel`. */
  scaleStepRewards?: ReadonlyArray<ScaleStepRewardModel>;
  /** Latest PARAMETER SWINGS (Turmoil Redux TR47 Ecological Experiment — «up
   *  and back»): the planet raised and lowered by one card, the record the
   *  board scene plays when both halves land in one response and the view's
   *  diff reads zero. Presentation only; consumed once by `seq`. See
   *  `ParameterSwingModel`. */
  parameterSwings?: ReadonlyArray<ParameterSwingModel>;
  awards: ReadonlyArray<FundedAwardModel>;
  colonies: ReadonlyArray<ColonyModel>;
  discardedColonies: ReadonlyArray<ColonyName>;
  deckSize: number;
  discardPileSize: number;
  expectedPurgeTimeMs: number;
  experimentalReset?: boolean;
  gameAge: number;
  gameOptions: GameOptionsModel;
  generation: number;
  globalsPerGeneration: ReadonlyArray<Partial<Record<GlobalParameter, number>>>,
  isSoloModeWin: boolean;
  /**
   * Correlation roots of causal chains that may STILL GROW (pending deferred
   * actions / pending prompts captured inside an action's scope). The client's
   * notification layer holds an event of such a chain in its PREPARED state
   * until the chain closes — the atomic-presentation contract. Optional so an
   * older server (or archived payloads) degrades to "present immediately".
   */
  openEventCorrelations?: ReadonlyArray<number>;
  lastSoloGeneration: number,
  milestones: ReadonlyArray<ClaimedMilestoneModel>;
  moon: MoonModel | undefined;
  name: string;
  oceans: number;
  oxygenLevel: number;
  passedPlayers: ReadonlyArray<Color>;
  /**
   * THE FINAL GREENERY PHASE stands — present from the loop's entry to the END, absent otherwise. `done` names
   * the seats that have finished their finale (placed all they could, or stopped); the seat being asked carries
   * `waitingForKind: 'finalgreenery'` on its own public model. The console's finale context (its right-panel
   * queue, its «waiting on …» stage) and the status strip read it — never a title, never the phase alone.
   */
  finalGreenery?: FinalGreeneryPhaseModel;
  pathfinders: PathfindersModel | undefined;
  /** MarsBot (Automa) public state. Undefined in ordinary games. */
  automa: MarsBotModel | undefined;
  phase: Phase;
  spaces: ReadonlyArray<SpaceModel>;
  spectatorId?: SpectatorId;
  // Static-ish list of standard projects available in this game (depends
  // on enabled expansions). Same source the server uses to populate the
  // SelectStandardProjectToPlay action option — exposed here so the
  // Standard Projects overlay can render even when it isn't the viewer's
  // turn.
  standardProjects: ReadonlyArray<StandardProjectModel>;
  step: number;
  tags: ReadonlyArray<Tag>;
  temperature: number;
  isTerraformed: boolean;
  turmoil: TurmoilModel | undefined;
  /** Turmoil Redux — the Mars Parliament. Undefined in every other game. Viewer projections ride the viewer's own model. */
  parliament: ParliamentModel | undefined;
  undoCount: number;
  venusScaleLevel: number;
  // Who claimed each global-parameter SCALE bonus (the premium reward zones on
  // the Venus/Oxygen/Temperature tracks). Keyed `<scale>-<step>` (e.g. `venus-8`,
  // `temperature--24`); value is the owner's colour, or 'neutral' when it was
  // taken via World Government and belongs to no one. Public to every client.
  scaleBonusClaims: Record<string, Color>;
}

/** The final greenery phase's public facts (see `GameModel.finalGreenery`). */
export type FinalGreeneryPhaseModel = {
  done: ReadonlyArray<Color>;
};
