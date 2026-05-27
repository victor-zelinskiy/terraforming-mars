import {GameOptionsModel} from './GameOptionsModel';
import {ColonyModel} from './ColonyModel';
import {Color} from '../Color';
import {TurmoilModel} from './TurmoilModel';
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
  lastSoloGeneration: number,
  milestones: ReadonlyArray<ClaimedMilestoneModel>;
  moon: MoonModel | undefined;
  name: string;
  oceans: number;
  oxygenLevel: number;
  passedPlayers: ReadonlyArray<Color>;
  pathfinders: PathfindersModel | undefined;
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
  undoCount: number;
  venusScaleLevel: number;
}
