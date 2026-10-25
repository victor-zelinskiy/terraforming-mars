/**
 * FIXTURE GENERATOR — phase 4 of docs/E2E_ARCHITECTURE_REWORK.md.
 *
 * Fixtures are GENERATED, never hand-written: each one is built by the REAL
 * engine (testGame + the same `player.process(...)` answers the client
 * submits, then honest TestingUtils state setters — the same toolbox 11 000
 * server specs stand on) and dumped via `game.serialize()`. A spec then boots
 * it through POST /api/dev/load-game, which rides `Game.deserialize` — the
 * exact path every real save rides — so schema drift fails loudly in the
 * loader, and `tests/console/e2eFixturesLoad.spec.ts` fails it even earlier,
 * in seconds, with the deserializer's own message.
 *
 * A fixture is an ENGINE-VALID state, not necessarily a play-reachable one
 * (setTemperature is a setter, not a rules replay) — exactly like the unit
 * suite's arranged states. Specs that test RULES still exercise them live
 * from the fixture onward; fixtures only remove the O(game) UI walk.
 *
 * Regenerate:  npm run e2e:fixtures
 * (Deterministic: seeded shuffle via TestGame's seeded rng default. Commit
 * the JSON diffs — the guard loads every fixture against the CURRENT
 * deserializer on every server-suite run.)
 */
// FIRST: the same bootstrap the mocha server runner uses — fake DB +
// globalInitialize — so engine modules load in the same order they test in.
import '../../testing/setup';
import * as fs from 'fs';
import * as path from 'path';
import {testGame, TestGameOptions} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {addCity, addGreenery, addOcean, maxOutOceans, runAllActions, setOxygenLevel, setTemperature, setVenusScaleLevel} from '../../TestingUtils';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {AICentral} from '../../../src/server/cards/base/AICentral';
import {Research} from '../../../src/server/cards/base/Research';
import {Tag} from '../../../src/common/cards/Tag';
import {Trees} from '../../../src/server/cards/base/Trees';
import {Fish} from '../../../src/server/cards/base/Fish';
import {IGame} from '../../../src/server/IGame';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {SelectInitialCards} from '../../../src/server/inputs/SelectInitialCards';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../../src/common/constants';
import {toName} from '../../../src/common/utils/utils';
import {CardName} from '../../../src/common/cards/CardName';
import {GlobalParameter} from '../../../src/common/GlobalParameter';
import {AdaptedLichen} from '../../../src/server/cards/base/AdaptedLichen';
import {NuclearZone} from '../../../src/server/cards/base/NuclearZone';
import {AresHazards} from '../../../src/server/ares/AresHazards';
import {TileType} from '../../../src/common/TileType';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {RegolithEaters} from '../../../src/server/cards/base/RegolithEaters';
import {IoMiningIndustries} from '../../../src/server/cards/base/IoMiningIndustries';
import {Pets} from '../../../src/server/cards/base/Pets';
import {SolarPower} from '../../../src/server/cards/base/SolarPower';
import {DeltaSurge} from '../../../src/server/cards/delta/DeltaSurge';
import {MiningExpedition} from '../../../src/server/cards/base/MiningExpedition';
import {ElectroCatapult} from '../../../src/server/cards/base/ElectroCatapult';
import {WaterSplittingPlant} from '../../../src/server/cards/base/WaterSplittingPlant';
import {AquiferPumping} from '../../../src/server/cards/base/AquiferPumping';
import {RestrictedArea} from '../../../src/server/cards/base/RestrictedArea';
import {Ants} from '../../../src/server/cards/base/Ants';
import {actionFutility} from '../../../src/server/models/actionFutility';
import {IActionCard, ICard, isIActionCard} from '../../../src/server/cards/ICard';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {SpaceMirrors} from '../../../src/server/cards/base/SpaceMirrors';
import {ShipmentToEarth} from '../../../src/server/cards/promo/ShipmentToEarth';
import {RedTourismWave} from '../../../src/server/cards/turmoil/RedTourismWave';
import {Sponsors} from '../../../src/server/cards/base/Sponsors';
import {Cartel} from '../../../src/server/cards/base/Cartel';
import {CarbonNanosystems} from '../../../src/server/cards/promo/CarbonNanosystems';
import {OlympusConference} from '../../../src/server/cards/base/OlympusConference';
import {RoverConstruction} from '../../../src/server/cards/base/RoverConstruction';
import {EarthCatapult} from '../../../src/server/cards/base/EarthCatapult';
import {Decomposers} from '../../../src/server/cards/base/Decomposers';
import {ViralEnhancers} from '../../../src/server/cards/base/ViralEnhancers';
import {MeatIndustry} from '../../../src/server/cards/promo/MeatIndustry';
import {Livestock} from '../../../src/server/cards/base/Livestock';
import {GeologicalSurvey} from '../../../src/server/cards/ares/GeologicalSurvey';
import {ArtificialPhotosynthesis} from '../../../src/server/cards/base/ArtificialPhotosynthesis';
import {NitriteReducingBacteria} from '../../../src/server/cards/base/NitriteReducingBacteria';
import {SecurityFleet} from '../../../src/server/cards/base/SecurityFleet';
import {Insulation} from '../../../src/server/cards/base/Insulation';
import {IndenturedWorkers} from '../../../src/server/cards/base/IndenturedWorkers';
import {Resource} from '../../../src/common/Resource';
import {ChairmanSeat} from '../../../src/server/parliament/quests/ChairmanSeat';
import {Birds} from '../../../src/server/cards/base/Birds';
import {Predators} from '../../../src/server/cards/base/Predators';
import {SmallAnimals} from '../../../src/server/cards/base/SmallAnimals';
import {AQUIFER_CONTEST_ID} from '../../../src/server/parliament/resolutions/greens/AquiferContest';
import {ARCHITECTURE_AWARD_ID} from '../../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {DEVELOPMENT_CRAZE_ID} from '../../../src/server/parliament/resolutions/marsFirst/DevelopmentCraze';
import {FORESTRY_SUPPORT_ID} from '../../../src/server/parliament/resolutions/greens/ForestrySupport';
import {CENTRAL_POWER_GRID_ID} from '../../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {resolutionCount} from '../../../src/server/parliament/resolutions/ResolutionCounts';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {CLIMATE_RESEARCH_ID} from '../../../src/server/parliament/resolutions/greens/ClimateResearch';
import {BIODOME_CONTEST_ID} from '../../../src/server/parliament/resolutions/greens/BiodomeContest';
import {DEV_ACTION_RESOLUTION_ID, DEV_PASSIVE_RESOLUTION_ID} from '../../../src/server/parliament/resolutions/ResolutionCatalog';
import {CLOUD_DEVELOPMENT_ID} from '../../../src/server/parliament/resolutions/unity/CloudDevelopment';
import {GAS_EXPORT_ID} from '../../../src/server/parliament/resolutions/reds/GasExport';
import {HEAT_CAPTURE_ID} from '../../../src/server/parliament/resolutions/reds/HeatCapture';
import {DIVERTED_RESEARCH_ID} from '../../../src/server/parliament/resolutions/reds/DivertedResearch';
import {UNMI_VETO_ID} from '../../../src/server/parliament/resolutions/reds/UnmiVeto';
import {LIVE_EXPERIMENTS_ID} from '../../../src/server/parliament/resolutions/scientists/LiveExperiments';
import {MANUFACTURING_RUN_ID} from '../../../src/server/parliament/resolutions/industrialists/ManufacturingRun';
import {TitanShuttles} from '../../../src/server/cards/colonies/TitanShuttles';
import {Grass} from '../../../src/server/cards/base/Grass';
import {MartianMediaCenter} from '../../../src/server/cards/turmoil/MartianMediaCenter';
import {Supercomputer} from '../../../src/server/cards/turmoilRedux/Supercomputer';
import {MOHOLE_CONTEST_ID} from '../../../src/server/parliament/resolutions/greens/MoholeContest';
import {OPEN_IP_TRADE_ID} from '../../../src/server/parliament/resolutions/scientists/OpenIpTrade';
import {RD_FUNDING_ID} from '../../../src/server/parliament/resolutions/scientists/RdFunding';
import {TRADE_INDUSTRIES_ID, tradeIndustriesPrice} from '../../../src/server/parliament/resolutions/unity/TradeIndustries';
import {URBAN_DEVELOPMENT_ID, urbanDevelopmentCards} from '../../../src/server/parliament/resolutions/marsFirst/UrbanDevelopment';
import {repeatableActionCards} from '../../../src/server/cards/repeatableActions';
import {ParliamentHandler} from '../../../src/server/parliament/ParliamentHandler';
import {INDUSTRIALIST_BUDGET_ID} from '../../../src/server/parliament/resolutions/industrialists/IndustrialistBudget';
import {SCIENTISTS_BUDGET_ID} from '../../../src/server/parliament/resolutions/scientists/ScientistsBudget';
import {JOINT_RESEARCH_ID} from '../../../src/server/parliament/resolutions/scientists/JointResearch';
import {PLANT_BAN_ID} from '../../../src/server/parliament/resolutions/reds/PlantBan';
import {JOVIAN_TAX_RIGHTS_ID} from '../../../src/server/parliament/resolutions/unity/JovianTaxRights';
import {MEDICAL_DATABASE_ID} from '../../../src/server/parliament/resolutions/scientists/MedicalDatabase';
import {METAL_RESEARCH_ID} from '../../../src/server/parliament/resolutions/industrialists/MetalResearch';
import {MIGRATION_FUNDING_ID} from '../../../src/server/parliament/resolutions/marsFirst/MigrationFunding';
import {SKYSCRAPERS_ID} from '../../../src/server/parliament/resolutions/marsFirst/Skyscrapers';
import {MARS_FIRST_BUDGET_ID} from '../../../src/server/parliament/resolutions/marsFirst/MarsFirstBudget';
import {REDS_BUDGET_ID} from '../../../src/server/parliament/resolutions/reds/RedsBudget';
import {SPONSORED_PROJECTS_ID} from '../../../src/server/parliament/resolutions/scientists/SponsoredProjects';
import {TAX_BREAKS_ID} from '../../../src/server/parliament/resolutions/industrialists/TaxBreaks';
import {MarsArmyShips} from '../../../src/server/cards/turmoilRedux/MarsArmyShips';
import {Satellites} from '../../../src/server/cards/base/Satellites';
import {Asteroid} from '../../../src/server/cards/base/Asteroid';
import {MartianRoads} from '../../../src/server/cards/turmoilRedux/MartianRoads';
import {Board} from '../../../src/server/boards/Board';
import {GHGProducingBacteria} from '../../../src/server/cards/base/GHGProducingBacteria';
import {NobelPrize} from '../../../src/server/cards/prelude2/NobelPrize';
import {NuclearPower} from '../../../src/server/cards/base/NuclearPower';
import {MirandaResort} from '../../../src/server/cards/base/MirandaResort';
import {WATER_EXPORT_ID} from '../../../src/server/parliament/resolutions/reds/WaterExport';
import {COLONIZATION_FUNDING_ID} from '../../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {GENEROUS_FUNDING_ID} from '../../../src/server/parliament/resolutions/greens/GenerousFunding';
import {SpaceName} from '../../../src/common/boards/SpaceName';
import {COLONIAL_AFFAIRS_ID} from '../../../src/server/parliament/resolutions/unity/ColonialAffairs';
import {COLONY_CONTEST_ID} from '../../../src/server/parliament/resolutions/unity/ColonyContest';
import {UNITY_BUDGET_ID} from '../../../src/server/parliament/resolutions/unity/UnityBudget';
import {GREENS_BUDGET_ID} from '../../../src/server/parliament/resolutions/greens/GreensBudget';
import {CardResource} from '../../../src/common/CardResource';
import {IColony} from '../../../src/server/colonies/IColony';
import {Luna} from '../../../src/server/colonies/Luna';
import {Titan} from '../../../src/server/colonies/Titan';
import {Europa} from '../../../src/server/colonies/Europa';
import {Callisto} from '../../../src/server/colonies/Callisto';
import {Miranda} from '../../../src/server/colonies/Miranda';
import {Ceres} from '../../../src/server/colonies/Ceres';
import {Io} from '../../../src/server/colonies/Io';
import {LunaGovernor} from '../../../src/server/cards/colonies/LunaGovernor';
import {Pluto} from '../../../src/server/colonies/Pluto';
import {VenusRedux} from '../../../src/server/colonies/VenusRedux';
import {Vesta} from '../../../src/server/colonies/Vesta';
import {AsteroidHollowing} from '../../../src/server/cards/promo/AsteroidHollowing';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {AndOptions} from '../../../src/server/inputs/AndOptions';
import {Dirigibles} from '../../../src/server/cards/venusNext/Dirigibles';
import {IchtiologyGrant} from '../../../src/server/cards/turmoilRedux/IchtiologyGrant';
import {RoboticsFactory} from '../../../src/server/cards/turmoilRedux/RoboticsFactory';
import {MiningMechs} from '../../../src/server/cards/turmoilRedux/MiningMechs';
import {CivilianSpacefighters} from '../../../src/server/cards/turmoilRedux/CivilianSpacefighters';
import {DevelopmentCenter} from '../../../src/server/cards/base/DevelopmentCenter';
import {Ironworks} from '../../../src/server/cards/base/Ironworks';
import {EarthOffice} from '../../../src/server/cards/base/EarthOffice';
import {AdvancedAlloys} from '../../../src/server/cards/base/AdvancedAlloys';
import {ArcticAlgae} from '../../../src/server/cards/base/ArcticAlgae';
import {SpaceStation} from '../../../src/server/cards/base/SpaceStation';
import {Comet} from '../../../src/server/cards/base/Comet';
import {BigAsteroid} from '../../../src/server/cards/base/BigAsteroid';
import {ReprocessingPlant} from '../../../src/server/cards/turmoilRedux/ReprocessingPlant';
import {CompostingInitiative} from '../../../src/server/cards/turmoilRedux/CompostingInitiative';
import {ResearchStartups} from '../../../src/server/cards/turmoilRedux/ResearchStartups';
import {MartianFiber} from '../../../src/server/cards/turmoilRedux/MartianFiber';
import {FrontierLabs} from '../../../src/server/cards/turmoilRedux/FrontierLabs';
import {ExpeditionMechs} from '../../../src/server/cards/turmoilRedux/ExpeditionMechs';
import {InfluentialDiscovery} from '../../../src/server/cards/turmoilRedux/InfluentialDiscovery';
import {ScientificBreakthrough} from '../../../src/server/cards/turmoilRedux/ScientificBreakthrough';
import {SearchForLife} from '../../../src/server/cards/base/SearchForLife';
import {MarsUniversity} from '../../../src/server/cards/base/MarsUniversity';
import {ConstructionMechs} from '../../../src/server/cards/turmoilRedux/ConstructionMechs';
import {MarsArmyMechs} from '../../../src/server/cards/turmoilRedux/MarsArmyMechs';
import {AutomatedConvoys} from '../../../src/server/cards/turmoilRedux/AutomatedConvoys';
import {ForestryMechs} from '../../../src/server/cards/turmoilRedux/ForestryMechs';
import {CargoMechs} from '../../../src/server/cards/turmoilRedux/CargoMechs';
import {FloatingBiodomes} from '../../../src/server/cards/turmoilRedux/FloatingBiodomes';
import {VectorComputations} from '../../../src/server/cards/turmoilRedux/VectorComputations';
import {Mine} from '../../../src/server/cards/base/Mine';
import {AdaptationTechnology} from '../../../src/server/cards/base/AdaptationTechnology';
import {MartianRails} from '../../../src/server/cards/base/MartianRails';
import {TopsoilContract} from '../../../src/server/cards/promo/TopsoilContract';
import {Counter} from '../../../src/server/behavior/Counter';
import {BiologicalSimulations} from '../../../src/server/cards/turmoilRedux/BiologicalSimulations';
import {SponsoredAcademies} from '../../../src/server/cards/venusNext/SponsoredAcademies';
import {Algae} from '../../../src/server/cards/base/Algae';
import {Lichen} from '../../../src/server/cards/base/Lichen';
import {KelpFarming} from '../../../src/server/cards/base/KelpFarming';
import {AerialMappers} from '../../../src/server/cards/venusNext/AerialMappers';
import {CaretakerContract} from '../../../src/server/cards/base/CaretakerContract';
import {HabitatScience} from '../../../src/server/cards/turmoilRedux/HabitatScience';
import {JovianLanterns} from '../../../src/server/cards/colonies/JovianLanterns';
import {AtmoCollectors} from '../../../src/server/cards/colonies/AtmoCollectors';
import {FloaterPrototypes} from '../../../src/server/cards/colonies/FloaterPrototypes';
import {ImportedNutrients} from '../../../src/server/cards/promo/ImportedNutrients';
import {HeatTrappers} from '../../../src/server/cards/base/HeatTrappers';
import {AsteroidRights} from '../../../src/server/cards/promo/AsteroidRights';
import {PublicPlans} from '../../../src/server/cards/promo/PublicPlans';
import {AsteroidMiningConsortium} from '../../../src/server/cards/base/AsteroidMiningConsortium';
import {AcquiredCompany} from '../../../src/server/cards/base/AcquiredCompany';
import {InvestmentLoan} from '../../../src/server/cards/base/InvestmentLoan';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {answerStandingGates, endGenerationThroughParliament, passToParliament, quietResolutionOf, seatResolution, seatEnacted} from '../../parliament/parliamentArrange';
import {REDUX_PARTIES} from '../../../src/common/parliament/ParliamentTypes';
import {ResolutionId, resolutionInstanceId} from '../../../src/common/parliament/ParliamentTypes';
import {Space} from '../../../src/server/boards/Space';
import {ArtificialLake} from '../../../src/server/cards/base/ArtificialLake';
import {DomedCrater} from '../../../src/server/cards/base/DomedCrater';
import {SpaceElevator} from '../../../src/server/cards/base/SpaceElevator';
import {SoilFactory} from '../../../src/server/cards/base/SoilFactory';
import {TropicalResort} from '../../../src/server/cards/base/TropicalResort';
import {NoctisFarming} from '../../../src/server/cards/base/NoctisFarming';
import {PhysicsComplex} from '../../../src/server/cards/base/PhysicsComplex';
import {BiomassCombustors} from '../../../src/server/cards/base/BiomassCombustors';
import {PowerPlant} from '../../../src/server/cards/base/PowerPlant';
import {StrategicShift} from '../../../src/server/cards/turmoilRedux/StrategicShift';
import {newCorporationCard, newPrelude, newProjectCard} from '../../../src/server/createCard';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {CardType} from '../../../src/common/cards/CardType';
import {FusionPower} from '../../../src/server/cards/base/FusionPower';
import {GeothermalPower} from '../../../src/server/cards/base/GeothermalPower';
import {HE3FusionPlant} from '../../../src/server/cards/moon/HE3FusionPlant';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {PoliticalScience} from '../../../src/server/cards/turmoilRedux/PoliticalScience';
import {PoliticalDonation} from '../../../src/server/cards/turmoilRedux/PoliticalDonation';
import {Mangrove} from '../../../src/server/cards/base/Mangrove';
import {MinorityRepresentation} from '../../../src/server/cards/turmoilRedux/MinorityRepresentation';
import {NATIONALIST_MOVEMENT_PARTIES, NATIONALIST_MOVEMENT_PRINT, NationalistMovement} from '../../../src/server/cards/turmoilRedux/NationalistMovement';
import {RedTechConvention} from '../../../src/server/cards/turmoilRedux/RedTechConvention';
import {Payment} from '../../../src/common/inputs/Payment';
import {rallyPlan} from '../../../src/server/parliament/RallyNeutralDelegates';
import {WaterHauling} from '../../../src/server/cards/turmoilRedux/WaterHauling';
import {UnmiLiner} from '../../../src/server/cards/turmoilRedux/UnmiLiner';
import {EarthArmyContract} from '../../../src/server/cards/turmoilRedux/EarthArmyContract';
import {SpaceshipRecycling} from '../../../src/server/cards/turmoilRedux/SpaceshipRecycling';
import {FormulaZero} from '../../../src/server/cards/turmoilRedux/FormulaZero';
import {MechSports} from '../../../src/server/cards/turmoilRedux/MechSports';
import {BribedCommittee} from '../../../src/server/cards/base/BribedCommittee';
import {TerraformingGanymede} from '../../../src/server/cards/base/TerraformingGanymede';
import {MagneticFieldDome} from '../../../src/server/cards/base/MagneticFieldDome';
import {AuroraStation} from '../../../src/server/cards/turmoilRedux/AuroraStation';
import {FloatingHabs} from '../../../src/server/cards/venusNext/FloatingHabs';
import {ColonySponsors} from '../../../src/server/cards/turmoilRedux/ColonySponsors';
import {FringeColony} from '../../../src/server/cards/turmoilRedux/FringeColony';
import {PoliticalThinkTank} from '../../../src/server/cards/turmoilRedux/PoliticalThinkTank';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {VenusianCensus} from '../../../src/server/cards/turmoilRedux/VenusianCensus';
import {ReSettlement} from '../../../src/server/cards/turmoilRedux/ReSettlement';
import {CanyonCarving} from '../../../src/server/cards/turmoilRedux/CanyonCarving';
import {EcologicalExperiment} from '../../../src/server/cards/turmoilRedux/EcologicalExperiment';
import {EnceladeanIncubator} from '../../../src/server/cards/turmoilRedux/EnceladeanIncubator';
import {Capital} from '../../../src/server/cards/base/Capital';
import {OceanCity} from '../../../src/server/cards/ares/OceanCity';
import {AquaticResearchStation} from '../../../src/server/cards/turmoilRedux/AquaticResearchStation';
import {hasPlainOcean, isPlainOceanTop} from '../../../src/server/boards/cellPieces';
import {marsTileCensus} from '../../../src/common/boards/marsTileCensus';
import {oceanMoveOffer} from '../../../src/server/boards/oceanMove';
import {Arboretum} from '../../../src/server/cards/turmoilRedux/Arboretum';
import {RedMuseum, museumBlockers} from '../../../src/server/cards/turmoilRedux/RedMuseum';
import {NovaCity} from '../../../src/server/cards/turmoilRedux/NovaCity';
import {ExclusiveColony} from '../../../src/server/cards/turmoilRedux/ExclusiveColony';
import {Enceladus} from '../../../src/server/colonies/Enceladus';
import {JupiterFloatingStation} from '../../../src/server/cards/colonies/JupiterFloatingStation';
import {GanymedeColony} from '../../../src/server/cards/base/GanymedeColony';
import {Game} from '../../../src/server/Game';
import {adjacentCityTiers} from '../../../src/server/boards/cityStack';
import {cityMoveOffer} from '../../../src/server/boards/cityMove';
import {SpaceBonus} from '../../../src/common/boards/SpaceBonus';
import {SpaceId} from '../../../src/common/Types';
import {PartySanctions} from '../../../src/server/cards/turmoilRedux/PartySanctions';
import {BannedDelegateRedux} from '../../../src/server/cards/turmoilRedux/BannedDelegateRedux';
import {hasPartyRequirement} from '../../../src/server/cards/requirements/partyRequirementCards';
import {TransNeptuneProbe} from '../../../src/server/cards/base/TransNeptuneProbe';
import {testAutomaGame, testAutomaMultiplayerGame} from '../../automa/AutomaTestGame';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {Phase} from '../../../src/common/Phase';
import {IPlayer} from '../../../src/server/IPlayer';
import {AutomaState} from '../../../src/server/automa/AutomaState';
import {lobbyingTrigger} from '../../../src/server/automa/LobbyMandate';
import {botQuestReachable} from '../../../src/common/parliament/botQuestPath';
import {botQuestTableOf} from '../../../src/server/automa/BotQuestEvents';
import {armedPlayEffectsOf} from '../../../src/server/cards/armedPlayEffects';
import {RestrictedAreaAres} from '../../../src/server/cards/ares/RestrictedAreaAres';

const OUT_DIR = __dirname;

/**
 * A solo base+corpera game answered through the REAL start flow: initial
 * cards → the corporationPlay press → the corporationPay press — the same
 * three submits the client makes, so the serialized state carries a played
 * corporation, paid-for cards and a live action phase.
 */
function answerStartFlow(game: IGame, players: ReadonlyArray<TestPlayer>): void {
  const corps = new Map<TestPlayer, CardName>();
  // The research phase asks every seat at once; the start presses then come
  // per seat. Loop until nobody holds a start-flow prompt — the same answers
  // the client submits, in whatever order the engine asks.
  for (let guard = 0; guard < 40; guard++) {
    let acted = false;
    for (const player of players) {
      const wf = player.getWaitingFor();
      if (wf instanceof SelectInitialCards) {
        const corp = toName(player.dealtCorporationCards[0]);
        corps.set(player, corp);
        player.process({type: 'initialCards', responses: [
          {type: 'card', cards: [corp]},
          {type: 'card', cards: player.dealtProjectCards.slice(0, 2).map(toName)},
        ]});
        runAllActions(game);
        acted = true;
        continue;
      }
      const kind = player.getWaitingFor()?.startGamePrompt?.kind;
      if (kind === 'corporationPlay') {
        player.process({type: 'card', cards: [corps.get(player)!]});
        runAllActions(game);
        acted = true;
      } else if (kind === 'corporationPay') {
        player.process({type: 'option'});
        runAllActions(game);
        acted = true;
      }
    }
    if (!acted) {
      return;
    }
  }
  throw new Error('the start flow never settled in 40 rounds');
}

/**
 * A solo table at its first action. `options` ride into `testGame` — a CALM corporation (`customCorporationsList`
 * + `startingCorporations: 1`: the list goes on top of the corporation deck, the one seat draws it) keeps a scene
 * about the card alone: the seeded deal once handed X87's table Interplanetary Cinematics, whose event trigger
 * answered every play with «+2» the spec had to explain away.
 */
function soloActionPhase(options: Partial<TestGameOptions> = {}): {game: IGame, player: TestPlayer} {
  const [game, player] = testGame(1, {skipInitialCardSelection: false, ...options});
  const wf = player.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [player]);
  return {game, player};
}

/** `FIXTURES=a,b npm run e2e:fixtures` regenerates ONLY the named fixtures (the rest stay as checked in). */
const ONLY = (process.env.FIXTURES ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '');

function write(name: string, game: IGame): void {
  if (ONLY.length > 0 && !ONLY.includes(name)) {
    console.log(`${name}: skipped (FIXTURES=${ONLY.join(',')})`);
    return;
  }
  const serialized = game.serialize();
  const file = path.join(OUT_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(serialized, null, 1) + '\n');
  console.log(`${name}: phase=${serialized.phase} gen=${serialized.generation} → ${path.relative(process.cwd(), file)}`);
}

// ── venus-trade: the REDUX VENUS trade that carries three things at once —
//    a CARD-TARGET reward (1 floater, TWO holders → a real pick), the seat's
//    own settlement (the owner bonus «draw 1, then discard 1» — a mandatory
//    hand step ahead of the reward pick) and the FIXED Venus step crossing
//    8 % (the board's bonus draw, a `globalParameter` batch queued in front
//    of the colony's own). One state, the whole 2026-09-28 report: the
//    pre-selected target must never be asked again, the chip must land on a
//    standing card before the owner bonus takes the stage, and the 8 % card
//    must present on the board AFTER the workspace leaves, never over it. ──
{
  const [game, player] = testGame(1, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true,
  });
  answerStartFlow(game, [player]);
  const venus = new VenusRedux();
  game.colonies = [venus, new Luna(), new Europa(), new Callisto()];
  venus.colonies.push(player.id);
  venus.trackPosition = 2; // the 3rd cell: 1 floater
  player.playedCards.push(new Dirigibles(), new AtmoCollectors());
  setVenusScaleLevel(game, 6); // the trade's step crosses 8 %
  player.megaCredits = 80;
  runAllActions(game);
  write('venus-trade', game);
}

// ── vesta-trade: the REDUX VESTA trade — «add N mechs, asteroids OR fighters
//    to any card»: the seat holds TWO kinds (Asteroid Hollowing, Security
//    Fleet), so the reward is a real PICK whose CARD decides the kind that
//    lands (never a «which kind?» question, never the first of the tile's
//    list); the marker stands on the 5th cell (2 units). The tile the
//    2026-09-29 journey reads: the three-icon unit on the cell, the chip
//    flying as the chosen card's own kind, the server holding it. ──
{
  const [game, player] = testGame(1, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
  });
  answerStartFlow(game, [player]);
  const vesta = new Vesta();
  game.colonies = [vesta, new Luna(), new Europa(), new Callisto()];
  vesta.trackPosition = 4; // the 5th cell: 2 units of ONE kind
  player.playedCards.push(new AsteroidHollowing(), new SecurityFleet());
  player.megaCredits = 80;
  runAllActions(game);
  write('vesta-trade', game);
}

// ── pluto-settlements-*: the COLONY POLISH iteration 1 table (docs/claude/prompts/
//    colony-polish-iteration-1-pluto-settlements.md) — a player with SEVERAL settlements on Pluto, whose owner
//    bonus pays «draw 1, then discard 1» PER SETTLEMENT, each in full before the next card is drawn. A calm
//    corporation (CrediCor), Pluto first among four open tiles, the trader's fleet free, 30 M€ (the 9 M€ fee),
//    a hand of THREE (the discard is a real question every cycle). The track stands one cell ABOVE the cubes,
//    so the trade pays income cards AND the closing reset glides one cell (PL-007's beat is on the route).
//      -2      the viewer trades, two settlements (track 3: 2 income cards → reset to 2);
//      -3      the viewer trades, three settlements (track 4: 3 income cards → reset to 3);
//      -foreign RED is on the move with a free fleet and 30 M€; BLUE (seat 0, the viewer) owns two settlements
//               and a hand of three — red's trade owes blue a DETACHED delivery (two cycles behind the reset);
//      -empty-hand the foreign table with blue's hand EMPTY: each cycle draws one card into a hand of one, so
//               the server discards it without asking (DiscardCards' «≤ 1 card» edge) — twice. ──
function plutoSettlementsTable(name: string, spec: {cubes: number, track: number, foreign?: boolean, hand?: number}): void {
  const [game, blue, red] = testGame(spec.foreign === true ? 2 : 1, {
    skipInitialCardSelection: false, coloniesExtension: true,
    customCorporationsList: spec.foreign === true ? [CardName.CREDICOR, CardName.CREDICOR] : [CardName.CREDICOR],
    startingCorporations: 1,
  });
  answerStartFlow(game, spec.foreign === true ? [blue, red] : [blue]);
  // (A SOLO opening still owes its colony REMOVAL pick — the venus-trade precedent: it stays pending, the loader
  // re-primes it over the table laid below and the spec answers it with `keepColony: 'Pluto'`.)
  const pluto = new Pluto();
  const others = [new Luna(), new Europa(), new Callisto()];
  for (const colony of [pluto, ...others]) {
    colony.isActive = true;
  }
  game.colonies = [pluto, ...others];
  for (let i = 0; i < spec.cubes; i++) {
    pluto.colonies.push(blue.id);
  }
  pluto.trackPosition = spec.track;
  const hand = spec.hand ?? 3;
  while (blue.cardsInHand.length < hand) {
    blue.cardsInHand.push(game.projectDeck.drawOrThrow(game));
  }
  blue.cardsInHand.length = hand;
  blue.megaCredits = 30;
  if (spec.foreign === true) {
    red.megaCredits = 30;
    // Blue's turn is handed over before blue acted (no pass): red is on the move with the action menu.
    blue.clearWaitingFor();
    game.playerIsFinishedTakingActions();
  }
  runAllActions(game);
  const trader = spec.foreign === true ? red : blue;
  const opening = trader.getWaitingFor();
  if (pluto.colonies.length !== spec.cubes || pluto.trackPosition !== spec.track || blue.cardsInHand.length !== hand ||
      game.activePlayer.id !== trader.id ||
      !(spec.foreign === true ? opening instanceof OrOptions : opening instanceof SelectColony) ||
      trader.colonies.getFleetSize() - trader.colonies.usedTradeFleets < 1) {
    throw new Error(`the ${name} fixture expected ${spec.cubes} of blue's cubes on Pluto at track ${spec.track}, blue's hand of ${hand} and ${trader.color} on the move with a free fleet — got cubes=${pluto.colonies.length} track=${pluto.trackPosition} hand=${blue.cardsInHand.length} active=${game.activePlayer.color} wf=${trader.getWaitingFor()?.constructor.name}`);
  }
  write(name, game);
}
plutoSettlementsTable('pluto-settlements-2', {cubes: 2, track: 3});
plutoSettlementsTable('pluto-settlements-3', {cubes: 3, track: 4});
// Colony polish 2 (the owner's 4K report of 2026-10-21 — «на экране торговли на Плутоне очень плохая компоновка»):
//   -2-wide  the viewer trades, two settlements, the track at 4 (3 income cards + 2 places = FIVE objects — the frame
//            the owner photographed: the row wrapped 4 + 1 and cropped under the head);
//   -3-wide  three settlements, the track at 6 (4 income cards + 3 places = SEVEN objects — the widest table Pluto pays).
plutoSettlementsTable('pluto-settlements-2-wide', {cubes: 2, track: 4});
plutoSettlementsTable('pluto-settlements-3-wide', {cubes: 3, track: 6});
plutoSettlementsTable('pluto-settlements-foreign', {cubes: 2, track: 3, foreign: true});
plutoSettlementsTable('pluto-settlements-empty-hand', {cubes: 2, track: 3, foreign: true, hand: 0});

// ── play-scale-card: a solo action phase with a card in hand that RAISES A
//    GLOBAL PARAMETER on play and has no target/placement follow-up
//    (MiningExpedition: oxygen +1, +2 steel; its removeAnyPlants finds no
//    opponent in solo). Playing it seeds the board-beat park (a parameter
//    moved while the play's hand workspace covered the board), which is the
//    exact trigger of the 2026-09-11 «workspace hung 30s, board-beat-park
//    degraded» report — the workspace must still conclude promptly. ──
{
  const {game, player} = soloActionPhase();
  player.megaCredits = 40;
  player.cardsInHand.push(new MiningExpedition());
  runAllActions(game);
  write('play-scale-card', game);
}

// ── solo-actions: a plain playable board — the general workhorse (canary,
//    any spec whose subject starts at «my turn, money in hand»). ──
{
  const {game, player} = soloActionPhase();
  player.megaCredits = 80;
  player.steel = 5;
  player.titanium = 3;
  player.plants = 4;
  player.drawCard(4);
  runAllActions(game);
  write('solo-actions', game);
}

// ── rail-reward-action: a solo action phase with TWO plain resource-paying
//    blue actions in the tableau — Electro Catapult (spend 1 plant / 1 steel
//    → +7 M€: a STOCK reward with a choice) and Space Mirrors (7 M€ → +1
//    energy production: a PRODUCTION reward). The ACTION COMMIT's reward
//    wave lands on the rail's own rows; the probe reads where. ──
{
  const {game, player} = soloActionPhase();
  player.megaCredits = 40;
  player.steel = 5;
  player.plants = 4;
  player.playedCards.push(new ElectroCatapult(), new SpaceMirrors());
  runAllActions(game);
  write('rail-reward-action', game);
}

// ── price-fold-bot / price-fold-bot-second: «ПОВЕРХНОСТЬ НЕ СКЛАДЫВАЕТСЯ ПОД СВОИМ ЖЕТОНОМ» (T09, the flights' second
//    iteration — the bench of `console-action-price-fold`). The OWNER'S table, not the fast solo one: SOLO AGAINST
//    MARSBOT (base, CrediCor — no first action), blue on the move with Electro Catapult · Space Mirrors · Caretaker
//    Contract on the table, 40 M€, 5 steel, 8 plants, 16 heat; the bot's action deck opens with B01 Meteor Shower
//    (5 plants off blue — the very row the catapult's price leaves).
//      · `price-fold-bot` — blue's FIRST action of the turn: the answer carries the action alone;
//      · `price-fold-bot-second` — blue has taken one action this turn, so the catapult ENDS it: the bot's turn is due
//        and the server's scheduler (`BotTurnScheduler`, on in every e2e worker server) answers with the bot ACTIVE
//        (a broadcast before the POST answer) and plays the Meteor Shower ≈ 2 s later — inside the commit's flight. ──
for (const name of ['price-fold-bot', 'price-fold-bot-second'] as const) {
  const pinned = [CardName.CREDICOR];
  const [game, human] = testAutomaGame({startingCorporations: 1, keepInitialCardSelection: true, customCorporationsList: [...pinned]});
  assignPinnedCorporations(name, [human], pinned);
  if (!(human.getWaitingFor() instanceof SelectInitialCards)) {
    throw new Error(`${name}: expected SelectInitialCards, got ${human.getWaitingFor()?.constructor.name}`);
  }
  answerStartFlow(game, [human]);
  human.playedCards.push(new ElectroCatapult(), new SpaceMirrors(), new CaretakerContract());
  human.megaCredits = 40;
  human.steel = 5;
  human.plants = 8;
  human.heat = 16;
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error(`${name}: not an automa game`);
  }
  automa.actionDeck = [{kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}];
  if (name === 'price-fold-bot-second') {
    // One action already taken this turn (the loader re-primes the menu from the counter): the next one ends the turn.
    human.actionsTakenThisRound = 1;
  }
  runAllActions(game);
  if (game.phase !== Phase.ACTION || game.activePlayer.id !== human.id || !(human.getWaitingFor() instanceof OrOptions)) {
    throw new Error(`${name}: expected blue on the move with the action menu — got phase=${game.phase} active=${game.activePlayer.color} wf=${human.getWaitingFor()?.constructor.name}`);
  }
  write(name, game);
}

// ── futile-only / futile-mixed: ACTIONS THAT CHANGE NOTHING (the owner's iteration of 2026-10-15 — «действия, которые
//    фактически не имеют смысла»). A solo action phase on a FINISHED planet — +8 °C, 14 % oxygen, every ocean placed —
//    Teractor (no standard-project rebate, no first action), an empty hand (nothing playable — the RT count is the card
//    actions alone), 8 heat (the heat conversion is offered and changes nothing), no plants. Three card actions, each
//    proven futile by the server: Water Splitting Plant (3 energy → an oxygen step at its maximum), Search For Life
//    (its science already scores its points) and Aquifer Pumping (an ocean with every ocean placed).
//      · `futile-only` — those three and nothing else: the pass reads ONE quiet line, the RT badge goes white, the
//        Action Center's «можно выполнить» too; the asteroid and aquifer projects are futile on the std-projects screen.
//      · `futile-mixed` — beside them, Restricted Area (2 M€ → a card: useful), GHG Producing Bacteria with 2 microbes
//        (the temperature branch futile, the add branch useful — the card stays useful) and Space Elevator with no
//        steel (blocked): the futile band sinks under the blocked card. ──
function futileFixture(name: string, mixed: boolean): void {
  const {game, player} = soloActionPhase({customCorporationsList: [CardName.TERACTOR], startingCorporations: 1});
  setTemperature(game, MAX_TEMPERATURE);
  setOxygenLevel(game, MAX_OXYGEN_LEVEL);
  maxOutOceans(player);
  runAllActions(game);
  player.cardsInHand.length = 0;
  const search = new SearchForLife();
  search.resourceCount = 1;
  if (mixed) {
    const ghg = new GHGProducingBacteria();
    ghg.resourceCount = 2;
    player.playedCards.push(new RestrictedArea(), ghg, new SpaceElevator());
  }
  player.playedCards.push(new WaterSplittingPlant(), search, new AquiferPumping());
  player.megaCredits = 40;
  player.steel = 0;
  player.titanium = 0;
  player.plants = 0;
  player.energy = 3;
  player.heat = 8;
  runAllActions(game);
  const acting = (n: CardName) => player.playedCards.get(n) as (ICard & IActionCard) | undefined;
  const futile = [CardName.WATER_SPLITTING_PLANT, CardName.SEARCH_FOR_LIFE, CardName.AQUIFER_PUMPING];
  const verdicts = futile.map((n) => {
    const card = acting(n);
    return card !== undefined && card.canAct(player) && actionFutility(player, card)?.verdict !== undefined;
  });
  const ghg = acting(CardName.GHG_PRODUCING_BACTERIA);
  const useful = mixed ? [CardName.RESTRICTED_AREA, CardName.GHG_PRODUCING_BACTERIA].map((n) => {
    const card = acting(n);
    return card !== undefined && card.canAct(player) && actionFutility(player, card)?.verdict === undefined;
  }) : [];
  const elevator = acting(CardName.SPACE_ELEVATOR);
  if (verdicts.includes(false) || useful.includes(false) || game.canAddOcean() || player.cardsInHand.length !== 0 ||
      (mixed && (ghg === undefined || actionFutility(player, ghg)?.branches?.some((b) => b.futile) !== true || elevator?.canAct(player) !== false)) ||
      !player.playedCards.has(CardName.TERACTOR)) {
    throw new Error(`the ${name} fixture expected three futile card actions${mixed ? ', two useful ones (GHG with its spend branch futile) and a blocked Space Elevator' : ''}, every ocean placed, an empty hand and Teractor — got futile=${verdicts} useful=${useful} oceans=${!game.canAddOcean()} hand=${player.cardsInHand.length}`);
  }
  write(name, game);
}
futileFixture('futile-only', false);
futileFixture('futile-mixed', true);

// ── vp-threshold: A RESOURCE SHORT OF THE NEXT POINT IS NOT «NO EFFECT» (the owner's check of 2026-10-15). A solo
//    action phase, Teractor, an empty hand: Ants (1 VP per 2 microbes) with NO microbe, placed first so the cursor
//    opens on it, and GHG Producing Bacteria with 2 microbes — the donor Ants takes from. Ants' action lands a microbe
//    and moves no point (0 → 0): the composer reads a NEUTRAL VP chip «до следующего ещё 1», never «no effect» and
//    never the amber «value already at maximum». ──
{
  const {game, player} = soloActionPhase({customCorporationsList: [CardName.TERACTOR], startingCorporations: 1});
  player.cardsInHand.length = 0;
  const ants = new Ants();
  const donor = new GHGProducingBacteria();
  donor.resourceCount = 2;
  player.playedCards.push(ants, donor);
  player.megaCredits = 30;
  runAllActions(game);
  const acting = (n: CardName) => player.playedCards.get(n) as (ICard & IActionCard) | undefined;
  const antsCard = acting(CardName.ANTS);
  if (antsCard === undefined || !antsCard.canAct(player) || antsCard.resourceCount !== 0 ||
      actionFutility(player, antsCard) !== undefined || player.cardsInHand.length !== 0) {
    throw new Error(`the vp-threshold fixture expected Ants with no microbe, able to act and NOT futile, an empty hand — got ants=${antsCard?.resourceCount} act=${antsCard?.canAct(player)} hand=${player.cardsInHand.length}`);
  }
  write('vp-threshold', game);
}

// ── shipment-to-earth: X87 SHIPMENT TO EARTH — the first EVENT whose effect takes TWO resources OFF THE RAIL
//    (docs/claude/prompts/promo-x87-shipment-to-earth.md § 2 B3 — the shipment beat before the lift). A solo
//    action phase with the card in hand, 5 plants and 4 steel (3 + 3 leave; both rows stay above zero so the tick
//    is a number, never an empty row), 30 M€ (the printed 17 — no discount card in the tableau), no titanium and
//    no heat (one payment path), TWO plain Earth tags in the tableau (Sponsors, Cartel — no trigger of their own:
//    the card pays +4 M€ and nothing else answers), CrediCor (no trigger, no discount). The «short» variant of the
//    spec arranges the serialized steel down to 2 at boot. ──
{
  const {game, player} = soloActionPhase({customCorporationsList: [CardName.CREDICOR], startingCorporations: 1});
  player.megaCredits = 30;
  player.plants = 5;
  player.steel = 4;
  player.titanium = 0;
  player.heat = 0;
  player.cardsInHand.push(new ShipmentToEarth());
  player.playedCards.push(new Sponsors(), new Cartel());
  runAllActions(game);
  const card = player.cardsInHand.find((c) => c.name === CardName.SHIPMENT_TO_EARTH);
  if (card === undefined || !player.canPlay(card) || player.tags.count(Tag.EARTH) !== 2 || player.getCardCost(card) !== 17 ||
      !player.playedCards.has(CardName.CREDICOR)) {
    throw new Error(`the shipment-to-earth fixture expected the card playable at 17 with two Earth tags and CrediCor — got card=${card !== undefined} playable=${card !== undefined && player.canPlay(card)} earth=${player.tags.count(Tag.EARTH)} cost=${card === undefined ? '?' : player.getCardCost(card)} corp=${player.playedCards.corporations().map((c) => c.name).join(',')}`);
  }
  write('shipment-to-earth', game);
}

// ── two-player-pre-endgame: a 2p table, every dial but oxygen maxed, the
//    first seat holding the plants — the endgame family's whole arrangement
//    (the harness's drive() converges from here in a few raises instead of
//    playing the game over hundreds of API rounds). ──
{
  const [game, p1, p2] = testGame(2, {skipInitialCardSelection: false});
  answerStartFlow(game, [p1, p2]);
  setTemperature(game, MAX_TEMPERATURE);
  maxOutOceans(p1);
  setOxygenLevel(game, MAX_OXYGEN_LEVEL - 1);
  p1.megaCredits = 80;
  p1.plants = 16;
  p2.megaCredits = 40;
  p2.plants = 8;
  p1.drawCard(2);
  p2.drawCard(2);
  runAllActions(game);
  write('two-player-pre-endgame', game);
}

// ── finale-rich-5p / finale-rich-2p (TR69 «ФИНАЛ — ЭТО ЦЕРЕМОНИЯ»): the pre-endgame state of the two-player fixture
//    on a SATURATED table — generation 10, every seat with its own corporation, a spread of ratings, cities and
//    greeneries on Mars, claimed milestones and funded awards, VP cards with resources (animals, microbes), a printed
//    VP card and a printed PENALTY (Nuclear Zone) — so the final scoring reveals EVERY base category (TR · milestones
//    · awards · greenery · cities · cards · penalties) and the winner is NOT the viewed seat (the ranking moves).
//    The first seat (the viewer) holds the plants: `journeyToEndgame` converges from here in a few raises. ──
function finaleRichFixture(name: string, seats: 2 | 5): void {
  const corps = [CardName.TERACTOR, CardName.SATURN_SYSTEMS, CardName.THARSIS_REPUBLIC, CardName.ECOLINE, CardName.MINING_GUILD]
    .slice(0, seats);
  const [game, ...players] = testGame(seats, {skipInitialCardSelection: false, customCorporationsList: corps, startingCorporations: 1});
  answerStartFlow(game, players);
  game.generation = 10;
  // The board: cities and greeneries per seat (placed before the dials are set — a greenery raises the oxygen).
  const tiles: ReadonlyArray<[cities: number, greeneries: number]> = seats === 2 ? [[2, 3], [3, 4]] : [[1, 2], [2, 3], [3, 4], [1, 3], [2, 1]];
  players.forEach((p, i) => {
    for (let c = 0; c < tiles[i][0]; c++) {
      addCity(p);
    }
    for (let g = 0; g < tiles[i][1]; g++) {
      addGreenery(p);
    }
  });
  setTemperature(game, MAX_TEMPERATURE);
  maxOutOceans(players[0]);
  setOxygenLevel(game, MAX_OXYGEN_LEVEL - 1);
  // VP cards: animals / microbes with their stores, a printed VP card, and the printed PENALTY.
  const birds = new Birds();
  birds.resourceCount = 4;
  const fish = new Fish();
  fish.resourceCount = 3;
  const pets = new Pets();
  pets.resourceCount = 6;
  const ants = new Ants();
  ants.resourceCount = 6;
  const tardigrades = new Tardigrades();
  tardigrades.resourceCount = 8;
  const small = new SmallAnimals();
  small.resourceCount = 4;
  const tables: ReadonlyArray<ReadonlyArray<ICard>> = seats === 2 ?
    [[birds, new Trees(), ants], [fish, pets, new NuclearZone(), tardigrades]] :
    [[birds, new Trees()], [fish, ants], [pets, tardigrades, new NuclearZone()], [small], []];
  players.forEach((p, i) => {
    for (const card of tables[i]) {
      p.playedCards.push(card as IProjectCard);
    }
  });
  // Milestones and awards — spread across the table.
  game.claimedMilestones.push({player: players[1], milestone: game.milestones[0]});
  game.claimedMilestones.push({player: players[seats - 1], milestone: game.milestones[1]});
  game.fundedAwards.push({player: players[0], award: game.awards[0]});
  game.fundedAwards.push({player: players[1], award: game.awards[1]});
  // Ratings last (the placements above moved them): the winner is a seat the viewer is NOT.
  const ratings = seats === 2 ? [41, 44] : [36, 39, 42, 33, 30];
  players.forEach((p, i) => p.setTerraformRating(ratings[i]));
  players[0].megaCredits = 80;
  players[0].plants = 16;
  players.slice(1).forEach((p) => {
    p.megaCredits = 30;
    p.plants = 0;
  });
  players.forEach((p) => p.drawCard(2));
  runAllActions(game);
  if (game.claimedMilestones.length !== 2 || game.fundedAwards.length !== 2 || game.generation !== 10 ||
      game.getOxygenLevel() !== MAX_OXYGEN_LEVEL - 1 || game.board.getOceanSpaces().length !== 9) {
    throw new Error(`${name}: expected a saturated pre-endgame table — ms=${game.claimedMilestones.length} aw=${game.fundedAwards.length} gen=${game.generation} oxygen=${game.getOxygenLevel()}`);
  }
  write(name, game);
}
finaleRichFixture('finale-rich-5p', 5);
finaleRichFixture('finale-rich-2p', 2);

// ── solo-pre-endgame: every dial but oxygen maxed, oxygen ONE step short,
//    plants in stock — one greenery ends the game. For the endgame family:
//    seal, ceremony, final scoring, rematch. ──
{
  const {game, player} = soloActionPhase();
  setTemperature(game, MAX_TEMPERATURE);
  maxOutOceans(player);
  setOxygenLevel(game, MAX_OXYGEN_LEVEL - 1);
  player.megaCredits = 60;
  player.plants = 16;
  player.drawCard(2);
  runAllActions(game);
  write('solo-pre-endgame', game);
}

// ── staged-interposer: the INTERLEAVED-PLACEMENT class (docs/
//    TILE_PLAY_STAGED_COMMIT.md) — temperature at −4°C, «Nuclear Zone» in
//    hand, money for the play. Playing it staged raises the temperature past
//    0°C, which defers the BONUS OCEAN ahead of the card's own tile: the
//    staged cell must PARK behind it and auto-land after, never be dropped
//    and re-asked. For console-staged-play.spec.ts. ──
{
  const {game, player} = soloActionPhase();
  setTemperature(game, -4);
  player.megaCredits = 60;
  player.cardsInHand.push(new NuclearZone());
  runAllActions(game);
  write('staged-interposer', game);
}

// ── staged-hazard: build OVER an Ares hazard from the staged flow — the cell
//    the player picks already carries a dust storm (priced by the dossier:
//    8 M€ cleanup). The regression this pins: a standing hazard on the pinned
//    cell was read as staleness and the placement was re-asked («поверх
//    опасной зоны только со второго раза»). Ares game, ONE hazard placed
//    deterministically, «Nuclear Zone» in hand. ──
{
  const [game, player] = testGame(1, {skipInitialCardSelection: false, aresExtension: true, aresHazards: false});
  const wf = player.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [player]);
  AresHazards.putHazardAt(game, game.board.getAvailableSpacesOnLand(player)[0], TileType.DUST_STORM_MILD);
  player.megaCredits = 60;
  player.cardsInHand.push(new NuclearZone());
  runAllActions(game);
  write('staged-hazard', game);
}

// ── hydro-terminal: a solo delta game on the THRESHOLD of the finish slots —
//    position 5, ALL NINE row tags in the tableau (the path check runs rows
//    1–9 whatever the current position — REAL cards, a fake would not
//    deserialize) and energy in stock, the generation's advance unused:
//    «К дальнему» reaches the 5 VP slot in ONE multi-step move, and the
//    terminal ceremony → summary → close chain is the whole remaining flow.
//    For the finale-wedge family (console-hydro-terminal-landing.spec.ts). ──
{
  const [game, player] = testGame(1, {skipInitialCardSelection: false, deltaProjectExpansion: true});
  const wf = player.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [player]);
  // building+power / plant / science+microbe / jovian+space / earth+animal —
  // rows 1–9 covered without leaning on the (seed-dealt) corporation.
  player.playedCards.push(new SolarPower(), new AdaptedLichen(), new RegolithEaters(),
    new IoMiningIndustries(), new Pets());
  player.deltaProjectData!.position = 5;
  player.energy = 12;
  player.megaCredits = 60;
  player.drawCard(2);
  runAllActions(game);
  write('hydro-terminal', game);
}

// ── hydro-terminal-surge: the FIELD SHAPE of the 2026-09-10 wedge — a
//    Delta-Surge traversal whose FINAL leg is the animal stage. Position 7,
//    energy for exactly TWO steps (so «К дальнему» is 9, deterministically),
//    the row tags as above, Pets as the stage-9 holder, and Delta Surge
//    played — the walk crosses 8 and LANDS on 9 with the presented-card
//    payout: the terminal PRESENTING leg whose exit-wait deadlocked the
//    whole flow («Маркер движется по треку» over a finished walk). ──
{
  const [game, player] = testGame(1, {skipInitialCardSelection: false, deltaProjectExpansion: true});
  const wf = player.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [player]);
  player.playedCards.push(new SolarPower(), new AdaptedLichen(), new RegolithEaters(),
    new IoMiningIndustries(), new Pets(), new DeltaSurge());
  player.deltaProjectData!.position = 7;
  player.energy = 2;
  player.megaCredits = 60;
  player.drawCard(2);
  runAllActions(game);
  write('hydro-terminal-surge', game);
}

// ── effect-forecast: a 2p table arranged so every reading of the EFFECT
//    FORECAST (docs/claude/console/effect-forecast.md) is on screen from one
//    hand — the first seat (blue) is Manutech with a table of triggers, the
//    second (red) holds Pharmacy Union as the FOREIGN reactor.
//      · Geological Survey (science) → Carbon Nanosystems +1 graphene (exact),
//        Olympus Conference with ONE science stored → the question, Earth
//        Catapult's −2 in the payment head;
//      · Nitrite Reducing Bacteria (microbe) → Decomposers' microbe, Viral
//        Enhancers' question, and RED's Pharmacy Union taking a disease and
//        losing 4 M€ — four chips, the opponent's two in red;
//      · Artificial Photosynthesis («ИЛИ») → Manutech's branch-tied reactions
//        drawn INSIDE the option cards;
//      · Security Fleet → no reaction at all (a space tag nobody answers, no
//        production for Manutech), only the discount (R3 without a row);
//      · Livestock's ACTION → Meat Industry's +2 M€ on the action screen;
//      · Insulation (printed 2, Earth Catapult −2 → 0) and Indentured Workers
//        (printed 0) → the FREE payment composition («ЦЕНА 2 → 0 · −2 ·
//        БЕСПЛАТНО» / «ЦЕНА 0 · БЕСПЛАТНО»); blue has 1 heat production so
//        Insulation is playable.
//    Ares for Geological Survey; promo / Venus for the corporations. ──
{
  // The corporations are the scenario's reactors — dealt DETERMINISTICALLY:
  // the custom list goes on top of the corporation deck and each seat draws
  // ONE, so blue takes Manutech and red Pharmacy Union (the start flow answers
  // with the first dealt corporation of each seat).
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, aresExtension: true, aresHazards: false,
    promoCardsOption: true, venusNextExtension: true,
    customCorporationsList: [CardName.MANUTECH, CardName.PHARMACY_UNION],
    startingCorporations: 1,
  });
  const wf = p1.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [p1, p2]);
  const corpsOf = (p: TestPlayer) => p.playedCards.corporations().map(toName);
  if (!corpsOf(p1).includes(CardName.MANUTECH) || !corpsOf(p2).includes(CardName.PHARMACY_UNION)) {
    throw new Error(`the forecast fixture's corporations were not dealt as intended: ` +
      `${p1.playedCards.corporations().map(toName).join(',')} / ${p2.playedCards.corporations().map(toName).join(',')}`);
  }
  const olympus = new OlympusConference();
  olympus.resourceCount = 1;
  p1.playedCards.push(new CarbonNanosystems(), olympus, new RoverConstruction(), new EarthCatapult(),
    new Decomposers(), new ViralEnhancers(), new MeatIndustry(), new Livestock());
  p1.cardsInHand.push(new GeologicalSurvey(), new ArtificialPhotosynthesis(), new NitriteReducingBacteria(), new SecurityFleet(),
    new Insulation(), new IndenturedWorkers());
  p1.megaCredits = 60;
  p2.megaCredits = 30;
  // Insulation's own gate: it decreases heat production, so blue needs one
  // step of it (Manutech answers the raise with 1 heat — a real table state).
  p1.production.add(Resource.HEAT, 1);
  runAllActions(game);
  write('effect-forecast', game);
}

// ── eva-mechs: TR09 EVA Mechs — the first Turmoil Redux PROJECT card, and the
//    card that introduces the `Mech` card resource + the `mechs` payment unit
//    (docs/TURMOIL_REDUX_EVA_MECHS.md). A 2p table whose first seat holds
//    EVA Mechs with TWO mechs stored, exactly ONE energy (the action's price —
//    one activation, then «Not enough energy»), Trans-Neptune Probe in hand
//    (Science + Space, cost 6, no requirement, no follow-up: the plainest
//    Space play there is) and only 3 M€ — SHORT of the probe without a mech,
//    so the payment panel's mech lane is load-bearing, not decorative. No
//    titanium: the mech is the lone alternative, so the compact block IS the
//    editor (inline pills). The console e2e drives the action (→ 3 mechs in
//    the capsule) and the play (→ 1 mech + 1 M€ = 6, the mech leaves the card).
//    A plain base+corpera table: the card is pushed into the tableau, so the
//    expansion gate (a deck matter) is not what this fixture exercises.
//    (Every table's deal is its OWN seeded rng — `Game.newInstance(seed = 0)`
//    — so this block's position changes nobody else's fixture.) ──
{
  const [game, p1, p2] = testGame(2, {skipInitialCardSelection: false});
  answerStartFlow(game, [p1, p2]);
  const eva = new EvaMechs();
  eva.resourceCount = 2;
  p1.playedCards.push(eva);
  p1.cardsInHand.push(new TransNeptuneProbe());
  p1.energy = 1;
  p1.megaCredits = 3;
  p1.titanium = 0;
  p1.steel = 0;
  p2.megaCredits = 30;
  runAllActions(game);
  write('eva-mechs', game);
}

// ── variant-tiles: the VARIANT CHOICE of a card action whose ONE printed row
//    the server splits into SEVERAL branches (the owner's 4K photo of
//    2026-10-13: «Сбор атмосферы» drew the whole «аэростат → 2 титан / 3
//    энергия / 4 тепло» row on every one of its three option tiles). Blue
//    holds Atmo Collectors with TWO floaters (the spend variants are live —
//    the first press of the action does not empty the card) and Asteroid
//    Rights with ONE asteroid (its second printed row carries an INTERIOR OR:
//    «астероид → производство M€ ИЛИ 2 титан» — two branches off one row);
//    0 titanium, 2 energy, 6 heat and 20 M€ so every reading is a plain
//    «0 → 2» / «2 → 5» / «6 → 10». A base+corpera table; the cards are pushed
//    into the tableau, so no expansion gate is exercised. ──
{
  const [game, p1, p2] = testGame(2, {skipInitialCardSelection: false});
  answerStartFlow(game, [p1, p2]);
  const atmo = new AtmoCollectors();
  atmo.resourceCount = 2;
  const rights = new AsteroidRights();
  rights.resourceCount = 1;
  p1.playedCards.push(atmo, rights);
  p1.megaCredits = 20;
  p1.titanium = 0;
  p1.energy = 2;
  p1.heat = 6;
  p2.megaCredits = 30;
  runAllActions(game);
  write('variant-tiles', game);
}

// ── public-plans: X77 Public Plans in blue's hand beside five plain cards —
//    «reveal any number of OTHER cards from your hand, +1 M€ each»: the play
//    composer's pre-select is a MULTI pick in the hand album (the card being
//    played is no candidate — the rules say OTHER — and the pick offers
//    «select all»). 30 M€ so the play is affordable; CALM corporations on both
//    seats (the seeded deal once handed blue Interplanetary Cinematics, whose
//    event trigger answered the play with «+2» the spec had to explain away). ──
{
  const [game, p1, p2] = testGame(2, {skipInitialCardSelection: false, customCorporationsList: [CardName.TERACTOR, CardName.THORGATE], startingCorporations: 1});
  answerStartFlow(game, [p1, p2]);
  p1.cardsInHand.push(new PublicPlans(), new AcquiredCompany(), new RoverConstruction(), new InvestmentLoan(), new Lichen(), new Algae());
  p1.megaCredits = 30;
  p2.megaCredits = 30;
  runAllActions(game);
  write('public-plans', game);
}

// ── player-pick: a PLAYER TARGET pick of a play — Asteroid Mining Consortium
//    («decrease ANY titanium production 1 step, raise your own») on a three-seat
//    table where every seat produces titanium (blue 3, red 2, green 6): the
//    composer's target row opens the list of players with their «3 → 2»
//    readings (the owner's TV photo of 2026-10-14: three empty slabs). ──
{
  const [game, p1, p2, p3] = testGame(3, {skipInitialCardSelection: false, customCorporationsList: [CardName.TERACTOR, CardName.THORGATE, CardName.TERACTOR], startingCorporations: 1});
  answerStartFlow(game, [p1, p2, p3]);
  p1.cardsInHand.push(new AsteroidMiningConsortium(), new Lichen(), new Algae());
  p1.production.add(Resource.TITANIUM, 3);
  p2.production.add(Resource.TITANIUM, 2);
  p3.production.add(Resource.TITANIUM, 6);
  p1.megaCredits = 30;
  p2.megaCredits = 30;
  p3.megaCredits = 30;
  runAllActions(game);
  write('player-pick', game);
}

// ═══════════════════════ THE MARS PARLIAMENT (Turmoil Redux) ═══════════════════════
//
// ONE BUILDER for every parliament fixture (the sitting rework, Э1): a 2-seat
// Redux table through the real start flow, the resolution SEATED (never
// assumed from the deal — `parliamentArrange`), the votes, the Agenda and the
// rest of the table arranged by the spec, then DRIVEN to the requested stop
// (the SOFT GATES — docs/claude/console/parliament-soft-gates.md: the sitting
// runs in ONE chain, stopping only at the law's own asks, and ends in ONE
// confirmation per seat, a prompt of the SEAT):
//   vote      — the action phase, the vote up (the browse layer, the vote mode);
//   pass      — ONE PASS AWAY: every seat but blue (the seat the dev loader
//               opens) has passed, blue holds its action menu — its pass is the
//               spec's own opening press (`passOnScreen`), and the WHOLE sitting
//               rides that one response, which the client receives from the
//               table as it stood (the walk plays from the verdict, every hold
//               seeded). The fixtures of this stop keep their historical
//               `-assembly` file names (the table, not the moment, is the name);
//   effects   — every seat passed: the enacted resolution's FIRST ask stands (or
//               the sitting is over, for a card that asks nothing);
//   close     — the asks answered with the plainest legal answers (a pick:
//               every card of a take / the first candidate; a placement: a
//               quiet cell; a choice: the first branch): the sitting is over,
//               every seat holds its confirmation «Закрыть заседание» and the
//               next generation already runs around it (`-adjourn` file names);
//   done      — the confirmations answered, research answered with empty picks:
//               generation 2's action phase, the sitting in `lastPhase` and in
//               the history.
// The dev loader opens the FIRST seat of the generation order: blue (p1) in
// generation 1, the seat that opened generation 2 in a `done` fixture.

/** `seats` is EVERY seat in generation order; `p1` / `p2` are its first two, named for the two-seat tables most fixtures are. */
type ParliamentTable = {game: IGame; p1: TestPlayer; p2: TestPlayer; seats: ReadonlyArray<TestPlayer>; parliament: Parliament};

type ParliamentStop = 'vote' | 'pass' | 'effects' | 'close' | 'done';

/**
 * ONE PASS AWAY (the `pass` stop): every seat but the first of the generation order passes; that seat — the one the
 * dev loader opens — holds its action menu, and its pass is the spec's. Refuses a table that did not get there.
 */
function passAllButViewer(game: IGame, name: string): void {
  const viewer = viewerOf(game);
  for (const seat of game.playersInGenerationOrder.filter((p) => p !== viewer)) {
    if (seat.getWaitingFor() !== undefined) {
      seat.clearWaitingFor();
    }
    game.playerHasPassed(seat);
    game.playerIsFinishedTakingActions();
  }
  expectOnePassAway(game, name);
  void viewer;
}

/** The table stands ONE PASS AWAY from its sitting: the action phase, the viewer's menu up, every other human seat passed. */
function expectOnePassAway(game: IGame, name: string): void {
  const viewer = viewerOf(game);
  const others = game.playersInGenerationOrder.filter((p) => p !== viewer);
  const menu = viewer.getWaitingFor();
  if (game.phase !== Phase.ACTION || game.parliament?.phase !== undefined || !(menu instanceof OrOptions) ||
      // MarsBot passes on its own turn (an EMPTY deck): the human's pass hands it that turn.
      others.some((seat) => seat.isMarsBot !== true && !game.hasPassedThisActionPhase(seat))) {
    throw new Error(`${name}: expected the table one pass away from the sitting, got ${game.phase} / ${game.parliament?.phase?.step ?? 'no sitting'} / ${menu?.type ?? 'no menu'}`);
  }
}

/** The seat the dev loader opens: the first HUMAN of the generation order (a bot may lead it — PL-764). */
function viewerOf(game: IGame): IPlayer {
  const viewer = game.playersInGenerationOrder.find((p) => p.isMarsBot !== true);
  if (viewer === undefined) {
    throw new Error('a table without a human seat');
  }
  return viewer;
}

/** The viewer's own pass (a dry run of the `pass` stop): the whole sitting runs in it. */
function passTheViewer(game: IGame): void {
  const viewer = viewerOf(game);
  viewer.clearWaitingFor();
  game.playerHasPassed(viewer);
  game.playerIsFinishedTakingActions();
}

/** The M€ a seat's production phase pays it (TR + M€ production) — a `pass` fixture sets the money AT the sitting net of it. */
function productionIncomeOf(player: TestPlayer): number {
  return player.terraformRating + player.production.megacredits;
}

type ParliamentFixtureSpec = {
  /** The contested card, seated in `slot` (0 by default — closest to the government). */
  resolution?: ResolutionId;
  slot?: number;
  /** Lobby votes on the contested card, by seat index (0 = blue, 1 = red, …). */
  votes?: ReadonlyArray<number>;
  /** The Agenda step per seat, in seat order; `undefined` leaves the start. */
  agenda?: ReadonlyArray<number | undefined>;
  /** M€ per seat, in seat order; 40 for the first, 30 for every other unless said otherwise. */
  megacredits?: ReadonlyArray<number>;
  /** The rest of the table: tableau, production, the globals, other votes, a seat's pass. */
  arrange?: (table: ParliamentTable) => void;
  stopAt: ParliamentStop;
  /**
   * The table AFTER the sitting closed — for a fixture whose subject is the
   * generation the law now stands in (a card action already spent this
   * generation, a production already taken). `arrange` cannot say it: the
   * generation boundary is what clears `actionsThisGeneration`.
   */
  after?: (table: ParliamentTable) => void;
  /** Refuse the fixture unless the reached state is the one it promises (the name tells the reader what to expect). */
  expect?: (table: ParliamentTable) => void;
  /** The game's options beyond the Redux table (a VENUS game for a card that exists only with Venus Next). */
  options?: Partial<TestGameOptions>;
  /** How many seats sit at the table (2 unless the fixture is ABOUT the number of seats). */
  players?: number;
};

/**
 * THE CORPORATIONS OF A PARLIAMENT TABLE ARE PINNED, never dealt.
 *
 * A seat's corporation is a fact several fixtures build their arithmetic on
 * (Central Power Grid counts POWER tags — ThorGate's is one; Metal Research
 * reads the titanium value — PhoboLog's is +1). The seed-0 shuffle only ever
 * promised «the same deal for the same DECK», and the corporation deck grows
 * with every module the fork ships: on 2026-09-29 the shuffle handed red
 * ThorGate instead of Aridor and the powergrid-recap builder's own `expect`
 * refused the table (count 5, not 4) — and because every builder runs its
 * checks before the `FIXTURES=` write-skip, one drifted table stops the whole
 * generator. `customCorporationsList` puts the named cards ON TOP of the deck,
 * so with `startingCorporations: 1` and exactly one name per seat the SET
 * dealt to the table is guaranteed — but `Deck.shuffle(cardsOnTop)` shuffles
 * that set among itself with the game's rng, whose state depends on the size
 * of the project deck shuffled just before, so WHICH seat draws which is not
 * a promise either. `reduxTable` therefore fixes the assignment itself: it
 * hands each seat the dealt card its position names (a swap between hands,
 * never a card the deck did not deal). The list below is exactly what every
 * checked-in fixture already carries (blue Teractor, red Aridor; the five- and
 * six-seat tables continue with ThorGate, Arklight, Tharsis Republic,
 * Poseidon). A spec whose table needs others passes its own list through
 * `options` (the Venus tables below).
 */
const REDUX_TABLE_CORPORATIONS: ReadonlyArray<CardName> = [
  CardName.TERACTOR, CardName.ARIDOR, CardName.THORGATE, CardName.ARKLIGHT, CardName.THARSIS_REPUBLIC, CardName.POSEIDON,
];
/**
 * The FREE-STANDING tables (`parliament-chairman-quest`, `parliament-seat`, `parliament-dense` — built on `testGame`,
 * not on `reduxTable`) are PINNED to corporations with NO first action. Left to the deal they moved with the deck:
 * TR37 grew it by one card and Inventrix's pending first action landed on the VIEWER, whose start workspace then
 * stood over the Parliament (`console-parliament-chairman-quest`: «first bad hit: con-start__frame»). A table
 * that is not about a first action must not depend on who was dealt one.
 */
const NO_FIRST_ACTION_CORPORATIONS: ReadonlyArray<CardName> = [
  CardName.TERACTOR, CardName.THORGATE, CardName.ARKLIGHT, CardName.HELION, CardName.MINING_GUILD,
];
/** The VENUS tables (Cloud Development, Gas Export) were dealt UNMI / PhoboLog — kept, so their fixtures do not move. */
const VENUS_TABLE_CORPORATIONS: ReadonlyArray<CardName> = [
  CardName.UNITED_NATIONS_MARS_INITIATIVE, CardName.PHOBOLOG, CardName.THORGATE, CardName.ARKLIGHT, CardName.THARSIS_REPUBLIC, CardName.POSEIDON,
];

/**
 * The deck dealt the pinned SET; the assignment is the table's own — each
 * seat takes the dealt card its position names (a swap between hands).
 */
function assignPinnedCorporations(name: string, seats: ReadonlyArray<TestPlayer>, pinned: ReadonlyArray<CardName>): void {
  const dealt = seats.flatMap((seat) => seat.dealtCorporationCards);
  seats.forEach((seat, i) => {
    const card = dealt.find((c) => c.name === pinned[i]);
    if (card === undefined) {
      throw new Error(`${name}: the deck did not deal ${pinned[i]} (dealt: ${dealt.map(toName).join(', ')})`);
    }
    seat.dealtCorporationCards.splice(0, seat.dealtCorporationCards.length, card);
  });
}

function reduxTable(name: string, options: Partial<TestGameOptions> = {}, count = 2): ParliamentTable {
  // Exactly one pinned name per seat: the set on top of the deck IS the deal.
  const pinned = (options.customCorporationsList ?? REDUX_TABLE_CORPORATIONS).slice(0, count);
  if (pinned.length !== count) {
    throw new Error(`${name}: ${count} seats need ${count} pinned corporations, got ${pinned.join(', ')}`);
  }
  const [game, ...seats] = testGame(count, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
    ...options,
    customCorporationsList: [...pinned],
  });
  assignPinnedCorporations(name, seats, pinned);
  const [p1, p2] = seats;
  if (!(p1.getWaitingFor() instanceof SelectInitialCards)) {
    throw new Error(`${name}: expected SelectInitialCards, got ${p1.getWaitingFor()?.constructor.name}`);
  }
  answerStartFlow(game, seats);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error(`the ${name} fixture has no voting area`);
  }
  return {game, p1, p2, seats, parliament};
}

/** A quiet cell for a placement the builder answers itself — no printed bonus, no neighbour — so a landing stays legible on screen. */
function quietCellOf(game: IGame, ask: SelectSpace): Space {
  return ask.spaces.find((s) => s.bonus.length === 0 && !game.board.getAdjacentSpaces(s).some((a) => a.tile !== undefined)) ?? ask.spaces[0];
}

/** Answer the enacted resolution's asks with the plainest legal answer until a gate stands or the phase is over. */
function answerEffects(game: IGame, name: string): void {
  for (let round = 0; round < 12; round++) {
    let answered = false;
    for (const player of game.playersInGenerationOrder) {
      const wf = player.getWaitingFor();
      if (wf === undefined || wf.parliamentPhasePrompt !== undefined) {
        continue;
      }
      if (wf instanceof SelectCard) {
        const cards = wf.externalDrawPrompt !== undefined ? wf.cards.map((c) => c.name) : [wf.cards[0].name];
        player.process({type: 'card', cards});
      } else if (wf instanceof SelectSpace) {
        player.process({type: 'space', spaceId: quietCellOf(game, wf).id});
      } else if (wf instanceof SelectColony) {
        // The winner's free colony (Colony Contest): the first tile the ordinary rules allow.
        player.process({type: 'colony', colonyName: wf.colonies[0].name});
      } else if (wf instanceof OrOptions) {
        player.process({type: 'or', index: 0, response: {type: 'option'}});
      } else if (wf instanceof AndOptions && wf.cardResourceDistributionPrompt !== undefined) {
        // The shared DISTRIBUTION (one amount per holder, the sum exactly N): the plainest complete layout — everything onto the first holder.
        const amount = wf.cardResourceDistributionPrompt.amount;
        player.process({type: 'and', responses: wf.options.map((_, n) => ({type: 'amount', amount: n === 0 ? amount : 0}))});
      } else {
        throw new Error(`${name}: the builder cannot answer a "${wf.type}" prompt of ${player.color}`);
      }
      runAllActions(game);
      answered = true;
    }
    if (!answered) {
      return;
    }
  }
  throw new Error(`${name}: the effects did not settle in 12 rounds`);
}

function parliamentFixture(name: string, spec: ParliamentFixtureSpec): ParliamentTable {
  const table = reduxTable(name, spec.options, spec.players);
  const {game, seats, parliament} = table;
  const slot = spec.slot ?? 0;
  if (spec.resolution !== undefined) {
    seatResolution(parliament, slot, spec.resolution);
  }
  for (const seat of spec.votes ?? []) {
    parliament.placeVote(seats[seat], parliament.slots[slot], 'lobby');
  }
  spec.agenda?.forEach((step, i) => {
    if (step !== undefined) {
      parliament.agenda.set(seats[i].id, step);
    }
  });
  const money = spec.megacredits ?? [40, 30];
  seats.forEach((player, i) => {
    player.megaCredits = money[i] ?? 30;
  });
  spec.arrange?.(table);
  runAllActions(game);
  if (spec.stopAt === 'pass') {
    passAllButViewer(game, name);
  } else if (spec.stopAt !== 'vote') {
    passToParliament(game);
  }
  if (spec.stopAt === 'close' || spec.stopAt === 'done') {
    answerEffects(game, name);
    if (parliament.phase !== undefined || parliament.sittingAcks === undefined) {
      throw new Error(`${name}: expected the sitting's confirmations, got ${parliament.phase?.step ?? (parliament.sittingAcks === undefined ? 'no record' : '?')}`);
    }
  }
  if (spec.stopAt === 'done') {
    answerStandingGates(game);
    if (parliament.phase !== undefined || parliament.sittingAcks !== undefined) {
      throw new Error(`${name}: the sitting did not close (step ${parliament.phase?.step ?? 'a confirmation owed'})`);
    }
    for (const player of seats) {
      if (player.getWaitingFor() instanceof SelectCard) {
        player.process({type: 'card', cards: []});
      }
    }
    runAllActions(game);
    if (parliament.lastPhase === undefined || parliament.enacted === undefined) {
      throw new Error(`${name}: no completed political phase`);
    }
  }
  spec.after?.(table);
  runAllActions(game);
  spec.expect?.(table);
  write(name, game);
  return table;
}

/** The winner of a sitting must be the seat the dev loader opens in a `done` fixture — the seat that opens generation 2. */
function expectViewerOpensGeneration({game}: ParliamentTable, seat: TestPlayer, name: string): void {
  if (game.playersInGenerationOrder[0].id !== seat.id) {
    throw new Error(`the ${name} fixture expected ${seat.color} to open generation 2 (the seat the loader opens)`);
  }
}

// ── parliament: a 2p Turmoil Redux table in its first action phase, the
//    Parliament workspace's whole browse layer on screen from one wheel press
//    (docs/TURMOIL_REDUX_ITERATION0_PLAN.md):
//      · three real resolutions of distinct parties in the voting area — the
//        Industrialists' and Mars First's first, the Greens' third — the
//        Greens ruling (the ENACTED slot empty), the starter chairman quest;
//      · red already placed its free delegate on the FIRST slot — a vote
//        blue can contest (a leader to read, a tie to break);
//      · blue holds the free lobby delegate AND enough M€ for a second, paid
//        vote; a plant-production card in hand (the Greens' passive fires on
//        the raise);
//      · blue also holds two delegates on the second slot — a party effect
//        held BY DELEGATES, so the parties row and the inspector have a real
//        «your effect» to show.
//    Colonies on (a Redux requirement). ──
parliamentFixture('parliament', {
  stopAt: 'vote',
  arrange: ({p1, p2, parliament}) => {
    // Slots 0 and 1 hold parties that do NOT rule (the Greens rule by the
    // starting rule), so the vote's «1 of 2» access and the effect held by
    // delegates both read a real threshold; the Greens card stands third.
    seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    parliament.placeVote(p2, parliament.slots[0], 'lobby');
    parliament.placeVote(p1, parliament.slots[1], 'reserve');
    parliament.placeVote(p1, parliament.slots[1], 'reserve');
    p1.cardsInHand.push(new ArtificialPhotosynthesis());
  },
});

// ── parliament-paid: the PAID vote with a real BILL. Blue's free delegate
//    already stands on the FIRST slot beside red's (one of the two the party
//    effect needs — the next delegate there unlocks it and takes the lead),
//    so blue's next vote comes from the RESERVE; blue can pay heat as M€
//    (the Helion rule), so the bill is a real payment PROMPT the vote step
//    hosts (a plain M€ bill auto-settles server-side). Blue also holds two
//    delegates on the second slot (an effect held by delegates), so both the
//    «1 of 2» and the «yours» plaque states are on screen. ──
parliamentFixture('parliament-paid', {
  stopAt: 'vote',
  arrange: ({p1, p2, parliament}) => {
    seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    parliament.placeVote(p2, parliament.slots[0], 'lobby');
    parliament.placeVote(p1, parliament.slots[0], 'lobby');
    parliament.placeVote(p1, parliament.slots[1], 'reserve');
    parliament.placeVote(p1, parliament.slots[1], 'reserve');
    p1.heat = 9;
    p1.canUseHeatAsMegaCredits = true;
  },
});

// ── parliament-actions: the four PARTY ACTIONS on one seat, each with a real
//    target — blue holds every action party's effect by CARD GRANT (the
//    workspace's action tiles are all live), an energy production to shift
//    (Industrialists), Tardigrades in the tableau to feed (Scientists), a
//    tagged hand to recycle (Reds) and a trade fleet for the Unity trade. ──
parliamentFixture('parliament-actions', {
  stopAt: 'vote',
  arrange: ({p1, parliament}) => {
    for (const party of [PartyName.UNITY, PartyName.SCIENTISTS, PartyName.INDUSTRIALISTS, PartyName.REDS] as const) {
      parliament.grantPartyEffect(p1, party, 'Fixture');
    }
    p1.production.add(Resource.ENERGY, 1);
    p1.playedCards.push(new Tardigrades(), new AICentral());
    p1.cardsInHand.push(new Trees(), new Fish(), new AdaptedLichen());
  },
});

// ── RX01 · AQUIFER CONTEST — the first real resolution — stands in the FIRST
//    voting slot with blue's free delegate already on it (blue leads → blue
//    would win: the «if you win» forecast has a real step to name), blue at
//    Agenda step 2 (influence 1; winning → step 3 = 2) and holding Fish + Pets
//    (two animal holders, so the payout has a real choice and the VP readings
//    differ per card), red at step 5 (influence 3) holding Birds. ──
const aquiferTable = (stopAt: ParliamentStop, expect?: (table: ParliamentTable) => void): ParliamentFixtureSpec => ({
  resolution: AQUIFER_CONTEST_ID,
  votes: [0],
  agenda: [2, 5],
  stopAt,
  arrange: ({p1, p2}) => {
    p1.playedCards.push(new Fish(), new Pets());
    p2.playedCards.push(new Birds());
  },
  expect,
});
// The overview, the vote mode and the fullscreen inspector read the influence-scaled payout from this table.
parliamentFixture('parliament-aquifer-vote', aquiferTable('vote'));
// The sitting has just convened: the verdict is known, the table untouched, the ASSEMBLY gate stands for both seats.
parliamentFixture('parliament-aquifer-assembly', aquiferTable('pass'));
// …the SAME gate with SIX animal holders in blue's tableau: the recipient picker stands on six candidates —
// the Deck's «picker on 6» composition (docs/TURMOIL_REDUX_PARLIAMENT_FINISH.md § Э8).
parliamentFixture('parliament-aquifer-assembly-six', {
  ...aquiferTable('pass'),
  arrange: ({p1, p2}) => {
    p1.playedCards.push(new Fish(), new Pets(), new Birds(), new Livestock(), new Predators(), new SmallAnimals());
    p2.playedCards.push(new Birds());
  },
});
// The political phase STOPPED INSIDE the payout: Aquifer Contest won with
// blue's delegate, blue's Agenda advanced to step 3 (influence 2) and the
// phase asks BLUE where its 2 animals go (Fish or Pets); the winner's ocean
// and red's payout (step 5 = 3 animals onto Birds) follow. The Parliament's
// enactment stage, the shared picker with the resolution source and the
// standard ocean placement all boot from here.
parliamentFixture('parliament-aquifer-enact', aquiferTable('effects', ({p1}) => {
  const pick = p1.getWaitingFor();
  if (!(pick instanceof SelectCard) || pick.resourceGainPrompt?.amount !== 2) {
    throw new Error(`the parliament-aquifer-enact fixture expected blue's 2-animal pick, got ${pick?.constructor.name}`);
  }
}));
// Every payout made (blue's animals, the winner's ocean, red's animals), the area refreshed: the ADJOURN gate stands for both seats.
parliamentFixture('parliament-aquifer-adjourn', aquiferTable('close', ({parliament, p1}) => {
  const outcomes = (parliament.phase?.summary ?? parliament.lastPhase)?.outcomes ?? [];
  if (!outcomes.some((o) => o.player === p1.id && o.kind === 'ocean') || !outcomes.some((o) => o.player === p1.id && o.kind === 'reaction')) {
    throw new Error(`the parliament-aquifer-adjourn fixture expected blue's ocean and the Greens' answer to it, got ${JSON.stringify(outcomes)}`);
  }
}));

// ── parliament-recap: generation 2 has just begun — the FIRST political phase
//    ran at the end of generation 1 (blue's two delegates carried the second
//    slot — a card that asks nothing — the winner is enacted, blue stepped
//    onto the Agenda, the losers' parties gained popular support, the refresh
//    dealt the fresh area) and the server's summary of it waits in `lastPhase`
//    for the workspace's results scene. Both seats answered the research phase. ──
parliamentFixture('parliament-recap', {
  stopAt: 'done',
  arrange: ({p1, p2, parliament}) => {
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    parliament.placeVote(p2, parliament.slots[0], 'lobby');
    parliament.placeVote(p1, parliament.slots[1], 'reserve');
    parliament.placeVote(p1, parliament.slots[1], 'reserve');
  },
});

// ── RX02 · ARCHITECTURE AWARD (a counted term + influence, max 5) — the vote:
//    the card in the FIRST voting slot with blue's free delegate on it. Blue:
//    Agenda step 4 (influence 2; winning → step 5 = 3), M€ production 3, and a
//    tableau that makes the filter READ — Artificial Lake counts (building + a
//    positive VP icon), Physics Complex counts too (a variable icon at 0 VP
//    right now), Mine does not (a building card with NO VP icon), Biomass
//    Combustors does not (a negative icon): B = 2 → «2 + 2 → +4» now and
//    «2 + 3 → +5 · max» if blue wins (the forecast reaches the cap). Red:
//    Agenda step 5 (influence 3), four counted cards (B 4 + I 3 = 7 → +5 max). ──
parliamentFixture('parliament-architecture-vote', {
  resolution: ARCHITECTURE_AWARD_ID,
  votes: [0],
  agenda: [4, 5],
  stopAt: 'vote',
  arrange: ({p1, p2}) => {
    p1.playedCards.push(new ArtificialLake(), new Mine(), new BiomassCombustors(), new PhysicsComplex());
    p2.playedCards.push(new SpaceElevator(), new SoilFactory(), new TropicalResort(), new NoctisFarming(), new DomedCrater());
    p1.production.override({megacredits: 3});
    p2.production.override({megacredits: 1});
  },
});

// ── RX02 — the sitting: RED's delegate wins Architecture Award (Agenda 4 → 5 =
//    influence 3) from the MIDDLE slot (its move to the government is a real
//    journey) and every seat is paid by its own tableau and influence: red
//    B 3 + I 3 = 6 → +5 M€ production, capped (production 3 → 8); blue
//    B 1 + I 0 → +1 (1 → 2). Red is the VIEWER of the `done` fixture (the
//    first seat in generation 2's order). ──
const architectureTable = (stopAt: ParliamentStop, expect?: (table: ParliamentTable) => void): ParliamentFixtureSpec => ({
  resolution: ARCHITECTURE_AWARD_ID,
  slot: 1,
  votes: [1],
  agenda: [undefined, 4],
  stopAt,
  arrange: ({p1, p2}) => {
    p2.playedCards.push(new ArtificialLake(), new DomedCrater(), new SpaceElevator(), new Mine());
    p1.playedCards.push(new SoilFactory(), new BiomassCombustors());
    p2.production.override({megacredits: 3});
    p1.production.override({megacredits: 1});
  },
  expect,
});
parliamentFixture('parliament-architecture-assembly', architectureTable('pass'));
parliamentFixture('parliament-architecture-adjourn', architectureTable('close'));
// ── «Итоги: честность» — the SUPPORT STOCK. The same table, except that UNITY has been collecting
//    neutral delegates for two generations already, and every Unity card lies at the BOTTOM of the deck:
//    the refresh (three slots, drawn from the top) deals other parties first, so it never deals Unity a
//    card and takes them away — after this sitting it holds 2 older delegates plus the 1 this support
//    step grants. WITHOUT such a party the results panel's support row is all fresh, and the probe's
//    «свежие отличимы от ранее накопленных» would have nothing to compare — it would pass on an empty
//    claim. (Until the deck held Unity cards the premise was «Unity has no resolution at all»; the
//    catalog grew and the fixture silently stopped proving it — so the deck is now ARRANGED, never
//    assumed.) ──
const supportStockTable = (): ParliamentFixtureSpec => {
  const base = architectureTable('pass');
  return {
    ...base,
    arrange: (table) => {
      base.arrange?.(table);
      table.parliament.popularSupport.set(PartyName.UNITY, 2);
      const parliament = table.parliament;
      const unity = parliament.deck.filter((instance) => parliament.resolutionOf(instance).party === PartyName.UNITY);
      parliament.deck = [...parliament.deck.filter((instance) => !unity.includes(instance)), ...unity];
    },
    expect: ({parliament}) => {
      if (parliament.popularSupportOf(PartyName.UNITY) !== 2) {
        throw new Error(`the parliament-support-stock fixture expected Unity to hold 2 neutral delegates before the sitting, got ${parliament.popularSupportOf(PartyName.UNITY)}`);
      }
      const others = parliament.deck.findIndex((instance) => parliament.resolutionOf(instance).party === PartyName.UNITY);
      if (others !== -1 && others < 6) {
        throw new Error(`the parliament-support-stock fixture expected at least six non-Unity cards above the first Unity card, got ${others}`);
      }
    },
  };
};
parliamentFixture('parliament-support-stock', supportStockTable());
// ── «ОБНОВЛЕНИЕ» · scenario 2 (the owner's own frames): an EMPTY DECK and an empty discard, so the two losers
//    are the whole pool the renewal can draw from — they leave, the discard turns over into a new deck, both
//    are dealt straight back, the third slot stays empty. Red wins Architecture Award from the middle slot with
//    TWO delegates; BLUE's free delegate stands on the Greens' loser (scenario 6: it goes home BEFORE that card
//    leaves). The support step pays the losers' parties (Greens +2 — a player voted there, Industrialists +1),
//    and the deal moves those cubes onto the re-dealt cards. Architecture asks nothing, so ONE A plays the
//    whole walk: enactment → reward → RENEWAL → results. ──
parliamentFixture('parliament-renewal-assembly', {
  ...architectureTable('pass'),
  arrange: (table) => {
    architectureTable('pass').arrange?.(table);
    const {parliament, p1, p2} = table;
    parliament.placeVote(p2, parliament.slots[1], 'reserve');
    let greens = parliament.slots.findIndex((s) => parliament.resolutionOf(s.instance).party === PartyName.GREENS);
    if (greens < 0) {
      // THE DEAL IS NOT ASSUMED: the deck grows with every card shipped, and the seeded deal stopped putting a
      // Greens card beside the winner once the Reds had two. Seat one (pool-consistent) in the slot the winner
      // does not hold — WHICH Greens card the loser is, the e2e never reads.
      seatResolution(parliament, 0, AQUIFER_CONTEST_ID);
      greens = 0;
    }
    parliament.placeVote(p1, parliament.slots[greens], 'lobby');
    parliament.deck = [];
    parliament.discard = [];
  },
  expect: ({parliament, p2}) => {
    const winner = parliament.winner();
    if (winner?.player !== p2.id || parliament.deck.length !== 0 || parliament.discard.length !== 0) {
      throw new Error(`the parliament-renewal-assembly fixture expected red to win on an empty deck, got ${JSON.stringify(winner)} deck=${parliament.deck.length} discard=${parliament.discard.length}`);
    }
  },
});
// ── TR02 POLITICAL SCIENCE · «ОБНОВЛЕНИЕ» with a CARD THAT ANSWERS A LEAVE: blue holds Political Science (0 data) in
//    the tableau; TWO of blue's delegates (the free one and one from the reserve) stand on the Greens' loser; red wins
//    Architecture Award from the middle slot with THREE (against the Greens' two — a tie would go to the CLOSER slot,
//    the Greens', whose winner's ocean asks). The deck and the discard stay as dealt (the deal is not the subject).
//    ONE A plays the walk: both blue cubes fly home, the data token rises over blue's reserve, the journal carries
//    `card-effect` count 2 right after the Greens' leave. ──
parliamentFixture('political-science-assembly', {
  ...architectureTable('pass'),
  arrange: (table) => {
    architectureTable('pass').arrange?.(table);
    const {parliament, p1, p2} = table;
    p1.playedCards.push(new PoliticalScience());
    parliament.placeVote(p2, parliament.slots[1], 'reserve');
    parliament.placeVote(p2, parliament.slots[1], 'reserve');
    let greens = parliament.slots.findIndex((s) => parliament.resolutionOf(s.instance).party === PartyName.GREENS);
    if (greens < 0) {
      // THE DEAL IS NOT ASSUMED (the renewal fixture's own precaution): seat a Greens card in the slot the winner does not hold.
      seatResolution(parliament, 0, AQUIFER_CONTEST_ID);
      greens = 0;
    }
    parliament.placeVote(p1, parliament.slots[greens], 'lobby');
    parliament.placeVote(p1, parliament.slots[greens], 'reserve');
  },
  expect: ({parliament, p1, p2}) => {
    const winner = parliament.winner();
    const card = p1.playedCards.get(CardName.POLITICAL_SCIENCE);
    const greens = parliament.slots.find((s) => parliament.resolutionOf(s.instance).party === PartyName.GREENS);
    if (winner?.player !== p2.id || winner.instance !== parliament.slots[1].instance || greens === undefined || parliament.votesOf(p1, greens) !== 2 ||
        card === undefined || card.resourceCount !== 0) {
      throw new Error(`the political-science-assembly fixture expected red to win the middle slot with blue's two delegates on the Greens' loser and 0 data, got ${JSON.stringify(winner)} blue-on-greens=${greens === undefined ? '-' : parliament.votesOf(p1, greens)} data=${card?.resourceCount}`);
    }
  },
});
// ── political-donation (TR03): the STAGED VOTE — the vote's third door. Blue's first action phase with
//    «Политическое пожертвование» in hand, 20 M€, the free delegate in the lobby and a full reserve (the
//    card's delegate leaves the RESERVE — the lobby's cube must still stand after the play). The voting
//    area is pinned: the Industrialists' card first, Mars First's second, the Greens' third (the Greens
//    rule by the starting rule, so slots 0 and 1 read a real «1 of 2»).
//    SYNTHETIC, for the frame «предел области»: Mars First's area already holds 2 neutral delegates —
//    no sitting has been held yet, so no engine path put them there; the ledger stays whole (the supply
//    is 14 − 2). Slot 0 then promises «0 → 3», slot 1 «2 → 3 · +1 из 3 · предел области». ──
parliamentFixture('political-donation', {
  stopAt: 'vote',
  megacredits: [20, 30],
  arrange: ({p1, parliament}) => {
    seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 2, AQUIFER_CONTEST_ID);
    parliament.popularSupport.set(PartyName.MARS, 2);
    p1.cardsInHand.push(new PoliticalDonation());
  },
  expect: ({game, parliament, p1}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.POLITICAL_DONATION);
    const parties = parliament.slots.map((s) => parliament.resolutionOf(s.instance).party);
    if (card === undefined || !p1.canPlay(card) || !parliament.lobby.has(p1.id) || parliament.reserve(p1) < 2 ||
        parties[0] !== PartyName.INDUSTRIALISTS || parties[1] !== PartyName.MARS ||
        parliament.popularSupportOf(PartyName.INDUSTRIALISTS) !== 0 || parliament.popularSupportOf(PartyName.MARS) !== 2) {
      throw new Error(`the political-donation fixture expected a playable card, the lobby cube, a reserve of 2+, slots [Industrialists, Mars First] with support 0 / 2 — got playable=${card !== undefined && p1.canPlay(card)} lobby=${parliament.lobby.has(p1.id)} reserve=${parliament.reserve(p1)} parties=${parties.join(',')} support=${parliament.popularSupportOf(PartyName.INDUSTRIALISTS)}/${parliament.popularSupportOf(PartyName.MARS)}`);
    }
    parliament.assertLedger(game);
  },
});
// ── TR04 · MINORITY REPRESENTATION — the card's WALK of the Agenda track as the
//    OUTCOME of its play (docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md): blue's
//    action phase, the card in hand, 10 M€, blue's marker on step 1 (influence
//    1 — the card's «max 1» is met), RED's marker on step 3 — the step blue's
//    walk ENDS on, so the cube lands BESIDE a rival's, never on top of it. The
//    Greens rule BY A CARD — Generous Funding, enacted — whose chairman quest is
//    «raise your TR 3 steps»: blue stands at 2 of 3, so the walked TR CLOSES it
//    and its gate's plate may rise only AFTER the walk has settled (B5); the
//    Greens still answer the walked TR with their +2 M€. The voting area holds
//    three real resolutions of the three OTHER parties (never a second Greens
//    card while the Greens rule by a card). ──
parliamentFixture('minority-representation', {
  stopAt: 'vote',
  megacredits: [10, 30],
  agenda: [1, 3],
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, GENEROUS_FUNDING_ID);
    seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 2, COLONIZATION_FUNDING_ID);
    parliament.quest = {definition: {goal: {kind: 'tr'}, count: 3}, source: GENEROUS_FUNDING_ID, generation: game.generation, progress: new Map([[p1.id, 2]])};
    p1.cardsInHand.push(new MinorityRepresentation());
  },
  expect: ({game, parliament, p1, p2}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.MINORITY_REPRESENTATION);
    const parties = parliament.slots.map((s) => parliament.resolutionOf(s.instance).party);
    if (card === undefined || !p1.canPlay(card) || parliament.agendaOf(p1) !== 1 || parliament.agendaOf(p2) !== 3 ||
        parliament.influence(p1) !== 1 || parliament.rulingParty() !== PartyName.GREENS || parties.includes(PartyName.GREENS) ||
        parliament.quest?.source !== GENEROUS_FUNDING_ID || parliament.quest.completedBy !== undefined || parliament.questProgressOf(p1) !== 2) {
      throw new Error(`the minority-representation fixture expected a playable card, blue on step 1 (influence 1), red on step 3, the Greens ruling by Generous Funding with blue at 2 of 3 on its quest — got playable=${card !== undefined && p1.canPlay(card)} agenda=${parliament.agendaOf(p1)}/${parliament.agendaOf(p2)} influence=${parliament.influence(p1)} ruling=${parliament.rulingParty()} parties=${parties.join(',')} quest=${parliament.quest?.source}:${parliament.questProgressOf(p1)}`);
    }
    parliament.assertLedger(game);
  },
});
// ── TR37 · RED LAWYERS — TR04's printed walk WITHOUT the influence ceiling: the card for which a CARD step in the
//    MIDDLE of a walk became reachable (docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md §7 — the gap this closes).
//    Blue's action phase, the card in hand (off the real deck), 10 M€; the Greens rule BY THE STARTING RULE (so the
//    walked TR of the `tr-first` table is answered with their +2 M€ — PL-002's reproduction); slot 0 — a quiet Reds
//    card with TWO of blue's cubes (the requirement's «2 delegates» road, so the rule stands whoever rules), slots
//    1–2 quiet Scientists / Mars First cards; red's cube on Mars First; red's marker on 3. Three tables, one per
//    reading of the walk: 6 → ⑦ CARD → ⑧ influence 4 (the card step in the MIDDLE), 5 → ⑥ TR → ⑦ CARD (the card step
//    LAST, the Greens' answer to the TR), 11 → ⑫ (one step and the line — the end of the track). The corporations
//    are PINNED to two without a first action (the TR24 trap: red's Aridor would hold its own prompt and the
//    rival's table could never be opened). The dry run checks the walk's record on a copy. ──
function redLawyersFixture(name: string, from: number, steps: ReadonlyArray<{to: number, bonus?: 'tr' | 'card'}>): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [10, 30],
    agenda: [from, 3],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, p2, parliament}) => {
      seatResolution(parliament, 0, quietResolutionOf(PartyName.REDS));
      seatResolution(parliament, 1, quietResolutionOf(PartyName.SCIENTISTS));
      seatResolution(parliament, 2, quietResolutionOf(PartyName.MARS));
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.placeVote(p2, parliament.slots[2], 'reserve');
      moveToDeckTop(game, CardName.RED_LAWYERS);
      p1.cardsInHand.push(game.projectDeck.drawPile.pop() as IProjectCard);
    },
    expect: ({game, parliament, p1, p2}) => {
      const card = p1.cardsInHand.find((c) => c.name === CardName.RED_LAWYERS);
      const parties = parliament.slots.map((s) => parliament.resolutionOf(s.instance).party);
      // THE DRY RUN — the play for real, on a copy: the record the console will play, step by step.
      const copy = Game.deserialize(structuredClone(game.serialize()));
      const blue = copy.getPlayerById(p1.id);
      const lawyers = blue.cardsInHand.find((c) => c.name === CardName.RED_LAWYERS) as IProjectCard;
      blue.playCard(lawyers);
      runAllActions(copy);
      const walked = copy.parliament!.lastAdvance;
      const facts = {
        playable: card !== undefined && p1.canPlay(card),
        agenda: `${parliament.agendaOf(p1)}/${parliament.agendaOf(p2)}`,
        ruling: parliament.rulingParty(),
        parties: parties.join(','),
        redsCubes: parliament.slots[0].votes.filter((v) => v.owner === p1.id).length,
        requirement: parliament.satisfiesPartyRequirement(p1, PartyName.REDS),
        steps: JSON.stringify(walked?.steps ?? []),
        reason: walked?.reason ?? 'none',
        hand: blue.cardsInHand.length - (p1.cardsInHand.length - 1),
      };
      const expected = {
        playable: true, agenda: `${from}/3`, ruling: PartyName.GREENS, parties: [PartyName.REDS, PartyName.SCIENTISTS, PartyName.MARS].join(','),
        redsCubes: 2, requirement: true, steps: JSON.stringify(steps), reason: steps.length > 0 ? 'card' : 'none',
        hand: steps.filter((s) => s.bonus === 'card').length,
      };
      if (JSON.stringify(facts) !== JSON.stringify(expected)) {
        throw new Error(`the ${name} fixture expected a playable card on a table whose walk is ${JSON.stringify(expected)} — got ${JSON.stringify(facts)}`);
      }
      parliament.assertLedger(game);
    },
  });
}
redLawyersFixture('red-lawyers', 6, [{to: 7, bonus: 'card'}, {to: 8}]);
redLawyersFixture('red-lawyers-tr-first', 5, [{to: 6, bonus: 'tr'}, {to: 7, bonus: 'card'}]);
redLawyersFixture('red-lawyers-end', 11, [{to: 12}]);

// ── TR68 · POLITICAL RECOGNITION — TR04's walk at THREE steps behind the NEW requirement «5 other cards with
//    requirements PLAYED» (events included). Red Lawyers' table (blue's action phase, the Greens ruling by the starting
//    rule — the walked TR is answered with their +2 M€; quiet resolutions; red's marker on 3; the corporations pinned
//    to two without a first action), the card in hand off the real deck, 30 M€. Blue's PLAYED cards with a requirement
//    are real cards moved off the deck onto the table — four automated plant cards and ONE EVENT (Ice Cap Melting:
//    «played», never «in play»). Three tables: 6 → ⑦ CARD → ⑧ influence 4 → ⑨ TR (the card step in the middle);
//    `-short` — the same table with four cards on it (the hand reads «[card] 4/5»); `-end` — 11 → ⑫ (one of three,
//    named before the press). ──
const POLITICAL_RECOGNITION_TABLE: ReadonlyArray<CardName> = [
  CardName.ALGAE, CardName.KELP_FARMING, CardName.LICHEN, CardName.ARCTIC_ALGAE, CardName.ICE_CAP_MELTING,
];
function politicalRecognitionFixture(name: string, from: number, played: number, steps: ReadonlyArray<{to: number, bonus?: 'tr' | 'card'}>): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [30, 30],
    agenda: [from, 3],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, p2, parliament}) => {
      seatResolution(parliament, 0, quietResolutionOf(PartyName.REDS));
      seatResolution(parliament, 1, quietResolutionOf(PartyName.SCIENTISTS));
      seatResolution(parliament, 2, quietResolutionOf(PartyName.MARS));
      parliament.placeVote(p2, parliament.slots[2], 'reserve');
      // The event LAST, so the short table (four cards) is four automated cards and the full one has its event.
      for (const card of POLITICAL_RECOGNITION_TABLE.slice(0, played)) {
        moveToDeckTop(game, card);
        p1.playedCards.push(game.projectDeck.drawPile.pop() as IProjectCard);
      }
      moveToDeckTop(game, CardName.POLITICAL_RECOGNITION);
      p1.cardsInHand.push(game.projectDeck.drawPile.pop() as IProjectCard);
    },
    expect: ({game, parliament, p1, p2}) => {
      const card = p1.cardsInHand.find((c) => c.name === CardName.POLITICAL_RECOGNITION);
      const counted = [...p1.playedCards].filter((c) => c.requirements.length > 0);
      const facts: Record<string, unknown> = {
        playable: card !== undefined && p1.canPlay(card),
        counted: counted.length,
        events: counted.filter((c) => c.type === CardType.EVENT).length,
        agenda: `${parliament.agendaOf(p1)}/${parliament.agendaOf(p2)}`,
        ruling: parliament.rulingParty(),
      };
      const expected: Record<string, unknown> = {
        playable: played >= 5, counted: played, events: played >= 5 ? 1 : 0, agenda: `${from}/3`, ruling: PartyName.GREENS,
      };
      if (played >= 5) {
        // THE DRY RUN — the play for real, on a copy: the record the console will play, step by step.
        const copy = Game.deserialize(structuredClone(game.serialize()));
        const blue = copy.getPlayerById(p1.id);
        blue.playCard(blue.cardsInHand.find((c) => c.name === CardName.POLITICAL_RECOGNITION) as IProjectCard);
        runAllActions(copy);
        facts.steps = JSON.stringify(copy.parliament!.lastAdvance?.steps ?? []);
        expected.steps = JSON.stringify(steps);
      }
      if (JSON.stringify(facts) !== JSON.stringify(expected)) {
        throw new Error(`the ${name} fixture expected ${JSON.stringify(expected)} — got ${JSON.stringify(facts)}`);
      }
      parliament.assertLedger(game);
    },
  });
}
politicalRecognitionFixture('political-recognition', 6, 5, [{to: 7, bonus: 'card'}, {to: 8}, {to: 9, bonus: 'tr'}]);
politicalRecognitionFixture('political-recognition-short', 6, 4, []);
politicalRecognitionFixture('political-recognition-end', 11, 5, [{to: 12}]);

// TR38 BIOLOGICAL SIMULATIONS — the set's first Greens' plate: a data holder with a TWO-TAG trigger and an action that
// buys PLANT PRODUCTION. Blue's action phase, the Greens ruling by the STARTING RULE (nothing enacted — generation 1),
// TR38 on blue's table with 2 data, Tardigrades (a microbe tag) in hand, 30 M€. Two classes the card carries first:
//   (A) the TABLE'S ANSWER TO A PLAY flies — Tardigrades' microbe tag wakes the holder: «+1 data» from the printed tag
//       into TR38's capsule, the holder emerging from its strip (К-S1);
//   (B) a PRODUCTION answer after an action — the action's plant step on the rail, the Greens' «+1 M€ production» a
//       beat AFTER its touchdown (the first e2e of the production-answer class).
// Red sits at a pinned corporation with no first action (Teractor / Thorgate — the second client's wheel must open).
parliamentFixture('biological-simulations', {
  stopAt: 'vote',
  megacredits: [30, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, parliament}) => {
    seatResolution(parliament, 0, quietResolutionOf(PartyName.GREENS));
    seatResolution(parliament, 1, quietResolutionOf(PartyName.SCIENTISTS));
    seatResolution(parliament, 2, quietResolutionOf(PartyName.MARS));
    moveToDeckTop(game, CardName.BIOLOGICAL_SIMULATIONS);
    const simulations = game.projectDeck.drawPile.pop() as IProjectCard;
    simulations.resourceCount = 2;
    p1.playedCards.push(simulations);
    moveToDeckTop(game, CardName.TARDIGRADES);
    p1.cardsInHand.push(game.projectDeck.drawPile.pop() as IProjectCard);
  },
  expect: ({game, parliament, p1}) => {
    const simulations = p1.playedCards.get(CardName.BIOLOGICAL_SIMULATIONS) as (IProjectCard & {canAct(p: IPlayer): boolean}) | undefined;
    const tardigrades = p1.cardsInHand.find((c) => c.name === CardName.TARDIGRADES);
    if (parliament.rulingParty() !== PartyName.GREENS || !parliament.hasPartyEffect(p1, PartyName.GREENS) ||
        simulations === undefined || simulations.resourceCount !== 2 || !simulations.canAct(p1) ||
        tardigrades === undefined || !p1.canPlay(tardigrades)) {
      throw new Error(`the biological-simulations fixture expected the Greens ruling by the starting rule, TR38 on blue's table with 2 data and able to act, Tardigrades playable — got ruling=${parliament.rulingParty()} data=${simulations?.resourceCount} tardigrades=${tardigrades !== undefined && p1.canPlay(tardigrades)}`);
    }
    parliament.assertLedger(game);
  },
});
// ── TR41 · PLASMA FANS — A SCALE STEP FROM A CARD ACTION (docs/claude/turmoil-redux-cards-progress.md § TR41): the
//    FIRST card action of the fork whose reward is a GLOBAL PARAMETER step through the «Действия карт» workspace. Blue's
//    action phase, the Greens ruling by the STARTING RULE (nothing enacted — generation 1), «Плазменные вентиляторы» on
//    blue's table (its action unused), 8 heat on the rail — the price, and not a unit more — Venus at 6 % (the 8 % card
//    bonus is ONE step ahead, so the action's step crosses it: the cover lifts off the marker AFTER the workspace leaves),
//    TR24 Venusian Census on blue's table with 1 data (the step pays it 2 off the marker's rim), 20 M€. RED sits at
//    APHRODITE — a corporation with no first action whose effect answers the SAME step with 2 M€ on red's own screen.
//    The whole route of the card: the price off the rail into the printed heat icon, the impulse into the printed Venus
//    gauge, the workspace's leave, the scale's story on a board the player can see (the marker 6 → 8, the TR chip, the
//    Greens a beat after, the census tokens, the cover last). ──
parliamentFixture('plasma-fans', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {venusNextExtension: true, customCorporationsList: [CardName.TERACTOR, CardName.APHRODITE]},
  arrange: ({game, p1, parliament}) => {
    seatResolution(parliament, 0, quietResolutionOf(PartyName.GREENS));
    seatResolution(parliament, 1, quietResolutionOf(PartyName.SCIENTISTS));
    seatResolution(parliament, 2, quietResolutionOf(PartyName.MARS));
    moveToDeckTop(game, CardName.PLASMA_FANS);
    p1.playedCards.push(game.projectDeck.drawPile.pop() as IProjectCard);
    moveToDeckTop(game, CardName.VENUSIAN_CENSUS);
    const census = game.projectDeck.drawPile.pop() as VenusianCensus;
    census.resourceCount = 1;
    p1.playedCards.push(census);
    p1.heat = 8;
    setVenusScaleLevel(game, 6);
  },
  expect: ({game, parliament, p1, p2}) => {
    const fans = p1.playedCards.get(CardName.PLASMA_FANS) as (IProjectCard & {canAct(p: IPlayer): boolean}) | undefined;
    const census = p1.playedCards.get(CardName.VENUSIAN_CENSUS);
    if (parliament.rulingParty() !== PartyName.GREENS || !parliament.hasPartyEffect(p1, PartyName.GREENS) ||
        fans === undefined || !fans.canAct(p1) || p1.heat !== 8 || game.getVenusScaleLevel() !== 6 ||
        census === undefined || census.resourceCount !== 1 || p2.playedCards.corporations()[0]?.name !== CardName.APHRODITE) {
      throw new Error(`the plasma-fans fixture expected the Greens ruling by the starting rule, TR41 on blue's table able to act, 8 heat, Venus 6 %, the census with 1 data, red at Aphrodite — got ruling=${parliament.rulingParty()} fans=${fans !== undefined && fans.canAct(p1)} heat=${p1.heat} venus=${game.getVenusScaleLevel()} census=${census?.resourceCount} red=${p2.playedCards.corporations()[0]?.name}`);
    }
    parliament.assertLedger(game);
  },
});
// ── TR41 · PLASMA FANS — THE PLAY THAT CLOSES THE PRINTED GENERATION-1 QUEST: blue's action phase with «Плазменные
//    вентиляторы» in hand, 20 M€, the Greens ruling by the STARTING RULE (the plate's requirement AND the table's answer:
//    +3 heat production → +3 M€ production), the starter quest «raise your heat production 3 steps» at 0 / 3 and NOBODY
//    in the chairman's office — ONE play completes it: the gate after the landing, the office, the Agenda step. Red at
//    Aphrodite (no first action). ──
parliamentFixture('plasma-fans-play', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {venusNextExtension: true, customCorporationsList: [CardName.TERACTOR, CardName.APHRODITE]},
  arrange: ({game, p1, parliament}) => {
    seatResolution(parliament, 0, quietResolutionOf(PartyName.GREENS));
    seatResolution(parliament, 1, quietResolutionOf(PartyName.SCIENTISTS));
    seatResolution(parliament, 2, quietResolutionOf(PartyName.MARS));
    moveToDeckTop(game, CardName.PLASMA_FANS);
    p1.cardsInHand.push(game.projectDeck.drawPile.pop() as IProjectCard);
  },
  expect: ({game, parliament, p1}) => {
    const fans = p1.cardsInHand.find((c) => c.name === CardName.PLASMA_FANS);
    const quest = parliament.quest;
    if (parliament.rulingParty() !== PartyName.GREENS || !parliament.hasPartyEffect(p1, PartyName.GREENS) ||
        fans === undefined || !p1.canPlay(fans) || p1.production.heat !== 0 ||
        quest === undefined || quest.source !== 'starter' || quest.completedBy !== undefined || parliament.questProgressOf(p1) !== 0 ||
        parliament.chairman !== undefined) {
      throw new Error(`the plasma-fans-play fixture expected the Greens ruling by the starting rule, TR41 playable from blue's hand, no heat production, the starter quest open at 0 / 3 and no chairman — got ruling=${parliament.rulingParty()} fans=${fans !== undefined && p1.canPlay(fans)} heatProd=${p1.production.heat} quest=${quest?.source}/${parliament.questProgressOf(p1)}/${quest?.completedBy} chairman=${parliament.chairman}`);
    }
    parliament.assertLedger(game);
  },
});
// ── TR42 · GREEN ALLEGIANCE — A WALK OF COUNTED LENGTH (docs/claude/turmoil-redux-cards-progress.md § TR42): blue's
//    action phase with «Верность Зелёным» in hand, 10 M€, the Greens ruling by the STARTING RULE (the plate's requirement
//    and the answer to every walked TR: +2 M€), quiet Greens / Scientists / Mars First cards up for the vote. The walk's
//    length is the number of complete sets of 5 TR blue has over 20 — read from blue's rating, which the fixture sets:
//    TR 33 on step 1 → ② TR, ③ influence 2 (two sets, two to the third); `-zero` TR 23 → no set: the play lands as an
//    ordinary play, the zero NAMED; `-long` TR 45 on step 0 → the longest walk of the set (five steps, two TR answers).
//    Red sits at TERACTOR (its Earth discount is red's own — blue pays the printed 2), blue at Thorgate, both without a
//    first action. The dry run plays the card for real on a copy: the record the console will play, step by step. ──
function greenAllegianceFixture(name: string, rating: number, from: number, steps: ReadonlyArray<{to: number, bonus?: 'tr' | 'card'}>): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [10, 30],
    agenda: [from, 3],
    options: {customCorporationsList: [CardName.THORGATE, CardName.TERACTOR]},
    arrange: ({game, p1, parliament}) => {
      seatResolution(parliament, 0, quietResolutionOf(PartyName.GREENS));
      seatResolution(parliament, 1, quietResolutionOf(PartyName.SCIENTISTS));
      seatResolution(parliament, 2, quietResolutionOf(PartyName.MARS));
      p1.setTerraformRating(rating);
      moveToDeckTop(game, CardName.GREEN_ALLEGIANCE);
      p1.cardsInHand.push(game.projectDeck.drawPile.pop() as IProjectCard);
    },
    expect: ({game, parliament, p1, p2}) => {
      const card = p1.cardsInHand.find((c) => c.name === CardName.GREEN_ALLEGIANCE);
      const copy = Game.deserialize(structuredClone(game.serialize()));
      const blue = copy.getPlayerById(p1.id);
      blue.playCard(blue.cardsInHand.find((c) => c.name === CardName.GREEN_ALLEGIANCE) as IProjectCard);
      runAllActions(copy);
      const walked = copy.parliament!.lastAdvance;
      const facts = {
        playable: card !== undefined && p1.canPlay(card),
        cost: card === undefined ? -1 : p1.getCardCost(card),
        rating: p1.terraformRating,
        agenda: `${parliament.agendaOf(p1)}/${parliament.agendaOf(p2)}`,
        ruling: parliament.rulingParty(),
        greens: parliament.hasPartyEffect(p1, PartyName.GREENS),
        red: p2.playedCards.corporations()[0]?.name,
        steps: JSON.stringify(walked?.steps ?? []),
        reason: walked?.reason ?? 'none',
      };
      const expected = {
        playable: true, cost: 2, rating, agenda: `${from}/3`, ruling: PartyName.GREENS, greens: true, red: CardName.TERACTOR,
        steps: JSON.stringify(steps), reason: steps.length > 0 ? 'card' : 'none',
      };
      if (JSON.stringify(facts) !== JSON.stringify(expected)) {
        throw new Error(`the ${name} fixture expected ${JSON.stringify(expected)} — got ${JSON.stringify(facts)}`);
      }
      parliament.assertLedger(game);
    },
  });
}
greenAllegianceFixture('green-allegiance', 33, 1, [{to: 2, bonus: 'tr'}, {to: 3}]);
greenAllegianceFixture('green-allegiance-zero', 23, 1, []);
greenAllegianceFixture('green-allegiance-long', 45, 0, [{to: 1}, {to: 2, bonus: 'tr'}, {to: 3}, {to: 4, bonus: 'tr'}, {to: 5}]);
// ── TR44 · AQUATIC RESEARCH STATION — TWO TILES ON ONE CELL (`common/boards/cellPieces.ts`): the STAND the picture is
//    judged on — blue's city OVER an ocean beside every neighbour it must be told from. Blue's action phase, the Greens
//    ruling by the STARTING RULE (nothing enacted — generation 1), Ares ON (an Ocean City needs the module). Tharsis,
//    arranged, never dealt:
//      · 33 — blue's TR44 city ON TOP OF a plain ocean (two pieces: the city, the water under it — `covers`);
//      · 32 — red's OCEAN CITY, the composite (ONE tile that counts as both), beside 33: the contrast at arm's length;
//      · 34 — a plain ocean beside 33; 43 — an empty ocean reserve;
//      · 42 — a plain city of blue's (land beside 33); 24 — a Skyscrapers STACK of two (the counter, the seam) beside 33.
//    Red sits at a pinned corporation with no first action (Teractor / Thorgate). The engine's reading of the stand is
//    asserted below, so a board change fails HERE, by name. ──
const AQUATIC_STAND = {afloat: '33', composite: '32', ocean: '34', reserve: '43', city: '42', stack: '24'} as const;
parliamentFixture('aquatic-research-station-twins', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {aresExtension: true, aresHazards: false, customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, p2, parliament}) => {
    seatResolution(parliament, 0, quietResolutionOf(PartyName.GREENS));
    seatResolution(parliament, 1, quietResolutionOf(PartyName.SCIENTISTS));
    seatResolution(parliament, 2, quietResolutionOf(PartyName.MARS));
    const cell = (id: string) => game.board.getSpaceOrThrow(id as SpaceId);
    cell(AQUATIC_STAND.ocean).tile = {tileType: TileType.OCEAN};
    cell(AQUATIC_STAND.ocean).player = undefined;
    // Blue's city over the water — the engine's own writer, so the cell is exactly what a play leaves.
    cell(AQUATIC_STAND.afloat).tile = {tileType: TileType.OCEAN};
    cell(AQUATIC_STAND.afloat).player = undefined;
    p1.playedCards.push(new AquaticResearchStation());
    game.addTile(p1, cell(AQUATIC_STAND.afloat), {tileType: TileType.CITY, card: CardName.AQUATIC_RESEARCH_STATION}, {overOcean: true});
    // Red's Ocean City — the composite, through the same writer (the ocean under it is recorded, never a piece).
    cell(AQUATIC_STAND.composite).tile = {tileType: TileType.OCEAN};
    cell(AQUATIC_STAND.composite).player = undefined;
    p2.playedCards.push(new OceanCity());
    game.addTile(p2, cell(AQUATIC_STAND.composite), {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY});
    game.simpleAddTile(p1, cell(AQUATIC_STAND.city), {tileType: TileType.CITY});
    game.simpleAddTile(p1, cell(AQUATIC_STAND.stack), {tileType: TileType.CITY});
    cell(AQUATIC_STAND.stack).stackHeight = 2;
    runAllActions(game);
    p1.megaCredits = 20;
  },
  expect: ({game, p1, p2}) => {
    const cell = (id: string) => game.board.getSpaceOrThrow(id as SpaceId);
    const afloat = cell(AQUATIC_STAND.afloat);
    const composite = cell(AQUATIC_STAND.composite);
    const facts = {
      afloat: [afloat.tile?.tileType, afloat.tile?.covers?.tileType, afloat.player?.color, hasPlainOcean(afloat), isPlainOceanTop(afloat), marsTileCensus([afloat]).total],
      composite: [composite.tile?.tileType, composite.player?.color, hasPlainOcean(composite), marsTileCensus([composite]).total],
      oceans: game.board.getOceanSpaces().map((s) => s.id),
      stack: cell(AQUATIC_STAND.stack).stackHeight,
      cities: game.board.countCities(p1),
    };
    const expected = {
      afloat: [TileType.CITY, TileType.OCEAN, p1.color, true, false, 2],
      composite: [TileType.OCEAN_CITY, p2.color, false, 1],
      oceans: [AQUATIC_STAND.composite, AQUATIC_STAND.afloat, AQUATIC_STAND.ocean],
      stack: 2,
      cities: 4,
    };
    if (JSON.stringify(facts) !== JSON.stringify(expected)) {
      throw new Error(`the aquatic-research-station-twins fixture expected ${JSON.stringify(expected)} — got ${JSON.stringify(facts)}`);
    }
  },
});
// ── TR44 · AQUATIC RESEARCH STATION — THE PLAY, THE MOVE OUT FROM UNDER, THE ACTION. Blue's action phase, the Greens
//    ruling by the STARTING RULE (nothing enacted — generation 1), Tharsis arranged, never dealt:
//      · `aquatic-research-station`        — the card in hand, 20 M€, 0 steel; three plain oceans (33 = the target
//                                             O1, 34 = O2 beside it — it pays +2, 43 = O3 beside O2 only); blue's
//                                             greenery on 42 beside O1 (the city will score it); 32 an EMPTY reserve
//                                             beside O1, 24 free land beside O1 (the refusals' witnesses);
//      · `aquatic-research-station-canyon` — blue's TR44 city ALREADY on O1 (the engine's own writer), Canyon Carving
//                                             in hand (the Greens' plate again), 32 the empty reserve beside O1 the
//                                             ocean may move to, 34 a plain ocean;
//      · `aquatic-research-station-action` — TR44 on blue's table with 1 animal, its action unused; data holders:
//                                             Supercomputer (0 data), Martian Census (2 data).
//    Red sits at a pinned corporation with no first action (Teractor / Thorgate — the second client watches). ──
const AQUATIC_SITE = {target: '33', payer: '34', third: '43', greenery: '42', reserve: '32', land: '24'} as const;
function aquaticFixture(name: string, at: 'hand' | 'placed' | 'table'): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [20, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, parliament}) => {
      seatResolution(parliament, 0, quietResolutionOf(PartyName.GREENS));
      seatResolution(parliament, 1, quietResolutionOf(PartyName.SCIENTISTS));
      seatResolution(parliament, 2, quietResolutionOf(PartyName.MARS));
      const cell = (id: string) => game.board.getSpaceOrThrow(id as SpaceId);
      for (const id of at === 'placed' ? [AQUATIC_SITE.target, AQUATIC_SITE.payer] : [AQUATIC_SITE.target, AQUATIC_SITE.payer, AQUATIC_SITE.third]) {
        cell(id).tile = {tileType: TileType.OCEAN};
        cell(id).player = undefined;
      }
      if (at === 'hand') {
        game.simpleAddTile(p1, cell(AQUATIC_SITE.greenery), {tileType: TileType.GREENERY});
        p1.cardsInHand.push(new AquaticResearchStation());
      } else if (at === 'placed') {
        p1.playedCards.push(new AquaticResearchStation());
        game.addTile(p1, cell(AQUATIC_SITE.target), {tileType: TileType.CITY, card: CardName.AQUATIC_RESEARCH_STATION}, {overOcean: true});
        p1.cardsInHand.push(new CanyonCarving());
      } else {
        const card = new AquaticResearchStation();
        card.resourceCount = 1;
        p1.playedCards.push(card, new Supercomputer());
        const census = new MartianCensus();
        census.resourceCount = 2;
        p1.playedCards.push(census);
      }
      runAllActions(game);
      p1.megaCredits = 20;
      p1.steel = 0;
    },
    expect: ({game, p1}) => {
      const cell = (id: string) => game.board.getSpaceOrThrow(id as SpaceId);
      const adjacent = (a: string, b: string) => game.board.getAdjacentSpaces(cell(a)).some((s) => s.id === b);
      const facts = {
        adjacent: [adjacent(AQUATIC_SITE.target, AQUATIC_SITE.payer), adjacent(AQUATIC_SITE.target, AQUATIC_SITE.greenery), adjacent(AQUATIC_SITE.target, AQUATIC_SITE.reserve),
          adjacent(AQUATIC_SITE.target, AQUATIC_SITE.land), adjacent(AQUATIC_SITE.target, AQUATIC_SITE.third)],
        oceans: game.board.getOceanSpaces().map((s) => s.id),
        legal: at === 'hand' ? game.board.getAvailableSpacesForType(p1, 'city-over-ocean').map((s) => s.id) : [],
        reserve: cell(AQUATIC_SITE.reserve).tile?.tileType,
        target: [cell(AQUATIC_SITE.target).tile?.tileType, cell(AQUATIC_SITE.target).tile?.covers?.tileType],
        // The deal is real (the rest of the hand varies; the corporation sits on the table) — only OUR cards are read.
        hand: p1.cardsInHand.filter((c) => c.name === CardName.AQUATIC_RESEARCH_STATION || c.name === CardName.CANYON_CARVING).map((c) => c.name),
        table: p1.playedCards.asArray()
          .filter((c) => [CardName.AQUATIC_RESEARCH_STATION, CardName.SUPERCOMPUTER, CardName.MARTIAN_CENSUS].includes(c.name))
          .map((c) => `${c.name}:${c.resourceCount}`),
        money: [p1.megaCredits, p1.steel],
      };
      const expected = {
        adjacent: [true, true, true, true, false],
        oceans: at === 'placed' ? [AQUATIC_SITE.target, AQUATIC_SITE.payer] : [AQUATIC_SITE.target, AQUATIC_SITE.payer, AQUATIC_SITE.third],
        legal: at === 'hand' ? [AQUATIC_SITE.target, AQUATIC_SITE.payer, AQUATIC_SITE.third] : [],
        reserve: undefined,
        target: at === 'placed' ? [TileType.CITY, TileType.OCEAN] : [TileType.OCEAN, undefined],
        hand: at === 'hand' ? [CardName.AQUATIC_RESEARCH_STATION] : at === 'placed' ? [CardName.CANYON_CARVING] : [],
        table: at === 'table' ? [`${CardName.AQUATIC_RESEARCH_STATION}:1`, `${CardName.SUPERCOMPUTER}:0`, `${CardName.MARTIAN_CENSUS}:2`] :
          at === 'placed' ? [`${CardName.AQUATIC_RESEARCH_STATION}:0`] : [],
        money: [20, 0],
      };
      if (JSON.stringify(facts) !== JSON.stringify(expected)) {
        throw new Error(`the ${name} fixture expected ${JSON.stringify(expected)} — got ${JSON.stringify(facts)}`);
      }
    },
  });
}
aquaticFixture('aquatic-research-station', 'hand');
aquaticFixture('aquatic-research-station-canyon', 'placed');
aquaticFixture('aquatic-research-station-action', 'table');

// ── TR47 · ECOLOGICAL EXPERIMENT — «UP AND BACK» (docs/TURMOIL_REDUX_ECOLOGICAL_EXPERIMENT.md): blue's action phase with
//    the card in hand, 20 M€ (the card costs 18), the SCIENTISTS enacted (the card's requirement is their plate), TR48
//    Supercomputer on blue's table with 0 data (the ONE holder the 3 data go onto — shown, never auto-selected). The board is
//    ARRANGED on Tharsis, never dealt; red sits at a pinned corporation with no first action (the second client watches
//    the planet go up and come back). The fixtures differ by where the planet stands:
//      · `ecological-experiment`           — −12 °C · 4 % · three plain oceans on reserves printing DIFFERENT bonuses
//                                             (28: two plants · 04: two steel · 07: nothing): the raise crosses no threshold,
//                                             the card's own ocean is the fourth, the fall asks WHICH ocean leaves
//                                             (every plain ocean — the fresh one too) and lowers the two scales in its answer;
//      · `ecological-experiment-max`       — +6 °C · 13 % · eight oceans: every parameter reaches its MAXIMUM on the raise,
//                                             so the fall touches nothing and names all three — the swing in ONE response;
//      · `ecological-experiment-cascade`   — −2 °C · 7 % · five oceans: the raise reaches 0 °C (a bonus ocean, asked live
//                                             BEFORE the card's own ocean lands) and 8 % (a temperature step) — the cascade
//                                             the composer forecasts; the fall then asks the removal among seven oceans;
//      · `ecological-experiment-under-city` — −12 °C · 4 % · blue's TR44 station OVER the ocean on 33 beside a plain ocean
//                                             on 34: the removal offers the water UNDER the city too, and the city stays.
//    The ids are the e2e spec's own constants (`tests/e2e/console-ecological-experiment.spec.ts`); the engine's reading of
//    the arrangement is asserted below, so a board change fails HERE, by name. ──
const ECOLOGICAL_SITE = {plants: '28', steel: '04', bare: '07', card: '06', cards: '13', titanium: '63', station: '33', beside: '34'} as const;
function ecologicalFixture(name: string, stand: 'plain' | 'max' | 'cascade' | 'under-city'): void {
  const planet = {
    'plain': {temperature: -12, oxygen: 4, oceans: [ECOLOGICAL_SITE.plants, ECOLOGICAL_SITE.steel, ECOLOGICAL_SITE.bare]},
    'max': {temperature: 6, oxygen: 13, oceans: [ECOLOGICAL_SITE.plants, ECOLOGICAL_SITE.steel, ECOLOGICAL_SITE.bare, ECOLOGICAL_SITE.card, ECOLOGICAL_SITE.cards, '32', '33', '34']},
    'cascade': {temperature: -2, oxygen: 7, oceans: [ECOLOGICAL_SITE.plants, ECOLOGICAL_SITE.steel, ECOLOGICAL_SITE.bare, ECOLOGICAL_SITE.card, ECOLOGICAL_SITE.titanium]},
    'under-city': {temperature: -12, oxygen: 4, oceans: [ECOLOGICAL_SITE.station, ECOLOGICAL_SITE.beside]},
  }[stand];
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [20, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, parliament}) => {
      seatEnacted(parliament, quietResolutionOf(PartyName.SCIENTISTS));
      const cell = (id: string) => game.board.getSpaceOrThrow(id as SpaceId);
      for (const id of planet.oceans) {
        cell(id).tile = {tileType: TileType.OCEAN};
        cell(id).player = undefined;
      }
      setTemperature(game, planet.temperature);
      setOxygenLevel(game, planet.oxygen);
      if (stand === 'under-city') {
        p1.playedCards.push(new AquaticResearchStation());
        game.addTile(p1, cell(ECOLOGICAL_SITE.station), {tileType: TileType.CITY, card: CardName.AQUATIC_RESEARCH_STATION}, {overOcean: true});
      }
      const holder = new Supercomputer();
      holder.resourceCount = 0;
      p1.playedCards.push(holder);
      p1.cardsInHand.push(new EcologicalExperiment());
      runAllActions(game);
      p1.megaCredits = 20;
      p1.steel = 0;
    },
    expect: ({game, p1, parliament}) => {
      const card = p1.cardsInHand.find((c) => c.name === CardName.ECOLOGICAL_EXPERIMENT);
      const cell = (id: string) => game.board.getSpaceOrThrow(id as SpaceId);
      const facts = {
        playable: card !== undefined && p1.canPlay(card) !== false,
        ruling: parliament.rulingParty(),
        temperature: game.getTemperature(),
        oxygen: game.getOxygenLevel(),
        oceans: game.board.getOceanSpaces().map((s) => s.id).sort(),
        plain: game.board.getOceanSpaces({upgradedOceans: false}).map((s) => s.id).sort(),
        bonuses: stand === 'plain' ? [cell(ECOLOGICAL_SITE.plants).bonus.join(','), cell(ECOLOGICAL_SITE.steel).bonus.join(','), cell(ECOLOGICAL_SITE.bare).bonus.join(',')] : [],
        station: stand === 'under-city' ? [cell(ECOLOGICAL_SITE.station).tile?.tileType, cell(ECOLOGICAL_SITE.station).tile?.covers?.tileType] : [],
        holders: p1.playedCards.asArray().filter((c) => c.name === CardName.SUPERCOMPUTER).map((c) => `${c.name}:${c.resourceCount}`),
        money: [p1.megaCredits, p1.steel],
      };
      const expected = {
        playable: true,
        ruling: PartyName.SCIENTISTS,
        temperature: planet.temperature,
        oxygen: planet.oxygen,
        oceans: [...planet.oceans].sort(),
        plain: [...planet.oceans].sort(),
        bonuses: stand === 'plain' ? [`${SpaceBonus.PLANT},${SpaceBonus.PLANT}`, `${SpaceBonus.STEEL},${SpaceBonus.STEEL}`, ''] : [],
        station: stand === 'under-city' ? [TileType.CITY, TileType.OCEAN] : [],
        holders: [`${CardName.SUPERCOMPUTER}:0`],
        money: [20, 0],
      };
      if (JSON.stringify(facts) !== JSON.stringify(expected)) {
        throw new Error(`the ${name} fixture expected ${JSON.stringify(expected)} — got ${JSON.stringify(facts)}`);
      }
      parliament.assertLedger(game);
    },
  });
}
ecologicalFixture('ecological-experiment', 'plain');
ecologicalFixture('ecological-experiment-max', 'max');
ecologicalFixture('ecological-experiment-cascade', 'cascade');
ecologicalFixture('ecological-experiment-under-city', 'under-city');
// ── TR67 · ENCELADEAN INCUBATOR («Инкубатор Энцелада») + «КЛЕТКА — ОДНО ДОСЬЕ»: blue's action phase, «Инкубатор» in
//    hand, 30 M€, the Industrialists ruling (a quiet passive — no money rides the ocean's rating). The board is ARRANGED
//    on Tharsis around the centre, every KIND of cell the column reads within a few steps of each other:
//      · blue's CITY on 40 between blue's two greeneries 39 · 41 — the city scores 2 (the ring lights both gold);
//      · red's CITY on 48 and blue's GREENERY on 47 between the two cities — the greenery feeds blue's city AND red's;
//      · an OCEAN on 32 (beside 31 · 40 · 41 · 33) — the empty land 31 [2 plants] pays +2 M€ beside it; the reserves 33 · 34
//        are the incubator's ocean cells with the money;
//      · a CAPITAL on 50 (placed BY ITS CARD — the source chip, X opens it) beside an ocean on 43 — +1 VP for it;
//      · a Decomposers on the table (the microbes' one holder — still a question).
//    Variants: `bare` — no microbe holder (the named skip); `max` — nine oceans (the warning before the press).
const INCUBATOR_STAND = {city: '40', greenA: '39', greenB: '41', rivalCity: '48', between: '47', ocean: '32', capital: '50', capitalOcean: '43', land: '31'} as const;
function incubatorFixture(name: string, stand: 'cells' | 'bare' | 'max'): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [30, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, p2, parliament}) => {
      seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
      const cell = (id: string) => game.board.getSpaceOrThrow(id as SpaceId);
      for (const id of [INCUBATOR_STAND.ocean, INCUBATOR_STAND.capitalOcean]) {
        cell(id).tile = {tileType: TileType.OCEAN};
        cell(id).player = undefined;
      }
      addCity(p2, INCUBATOR_STAND.rivalCity as SpaceId);
      addCity(p1, INCUBATOR_STAND.city as SpaceId);
      addGreenery(p1, INCUBATOR_STAND.greenA as SpaceId);
      addGreenery(p1, INCUBATOR_STAND.greenB as SpaceId);
      addGreenery(p1, INCUBATOR_STAND.between as SpaceId);
      game.simpleAddTile(p1, cell(INCUBATOR_STAND.capital), {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
      p1.playedCards.push(new Capital());
      if (stand === 'max') {
        maxOutOceans(p1);
      }
      if (stand !== 'bare') {
        p1.playedCards.push(new Decomposers());
      }
      p1.cardsInHand.push(new EnceladeanIncubator());
      runAllActions(game);
      p1.megaCredits = 30;
      p1.titanium = 0;
      p1.steel = 0;
    },
    expect: ({game, p1, parliament}) => {
      const card = p1.cardsInHand.find((c) => c.name === CardName.ENCELADEAN_INCUBATOR);
      const cell = (id: string) => game.board.getSpaceOrThrow(id as SpaceId);
      const facts = {
        playable: card !== undefined && p1.canPlay(card) !== false,
        oceans: stand === 'max' ? 9 : game.board.getOceanSpaces().length,
        city: [cell(INCUBATOR_STAND.city).tile?.tileType, cell(INCUBATOR_STAND.city).player?.id === p1.id],
        rival: cell(INCUBATOR_STAND.rivalCity).player?.id !== p1.id && cell(INCUBATOR_STAND.rivalCity).tile?.tileType === TileType.CITY,
        capital: [cell(INCUBATOR_STAND.capital).tile?.tileType, cell(INCUBATOR_STAND.capital).tile?.card],
        holders: p1.playedCards.asArray().filter((c) => c.name === CardName.DECOMPOSERS).length,
        money: p1.megaCredits,
      };
      const expected = {
        playable: true,
        oceans: stand === 'max' ? game.board.getOceanSpaces().length : 2,
        city: [TileType.CITY, true],
        rival: true,
        capital: [TileType.CAPITAL, CardName.CAPITAL],
        holders: stand === 'bare' ? 0 : 1,
        money: 30,
      };
      if (JSON.stringify(facts) !== JSON.stringify(expected) || (stand === 'max' && game.board.getOceanSpaces().length !== 9)) {
        throw new Error(`the ${name} fixture expected ${JSON.stringify(expected)} — got ${JSON.stringify(facts)}`);
      }
      parliament.assertLedger(game);
    },
  });
}
incubatorFixture('enceladean-incubator', 'cells');
incubatorFixture('enceladean-incubator-bare', 'bare');
incubatorFixture('enceladean-incubator-max', 'max');
// ── TR39 · CANYON CARVING — AN OCEAN MOVES (docs/TURMOIL_REDUX_RE_SETTLEMENT.md §2.6: the contract of a move on a tile
//    NOBODY owns): blue's action phase with «Прорезание каньона» in hand, 20 M€, the Greens ruling by the STARTING RULE
//    (nothing enacted — generation 1). The board is ARRANGED on Tharsis, never dealt:
//      · the ocean O₁ on 33 — an ocean RESERVE with two plants printed; it may move;
//      · beside it the empty reserve B₁ (34, two plants printed) and the plant land B₂ (42), which touches ANOTHER
//        ocean O₂ (43, never beside O₁) — a landing that pays a printed plant AND one other ocean's 2 M€, while the
//        lifted ocean beside it pays nothing;
//      · RED'S CAPITAL on 24 — beside O₁ and beside NEITHER B: red scores its one adjacent ocean today and loses it by
//        the move (the rival's loss is NAMED in the dossier); the cell is also the occupied neighbour;
//      · O₂ has free cells of its own, so the source level offers TWO oceans — the cursor lands on the first.
//    Red sits at a pinned corporation with no first action (Teractor / Thorgate — the second client watches the move).
//    The ids are the e2e spec's own constants (`tests/e2e/console-canyon-carving.spec.ts`); the engine's reading of the
//    arrangement is asserted below, so a board change fails HERE, by name. ──
const CANYON_CARVING_SITE = {ocean: '33', reserve: '34', land: '42', other: '43', capital: '24'} as const;
parliamentFixture('canyon-carving', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, p2, parliament}) => {
    seatResolution(parliament, 0, quietResolutionOf(PartyName.GREENS));
    seatResolution(parliament, 1, quietResolutionOf(PartyName.SCIENTISTS));
    seatResolution(parliament, 2, quietResolutionOf(PartyName.MARS));
    const cell = (id: string) => game.board.getSpaceOrThrow(id as SpaceId);
    for (const id of [CANYON_CARVING_SITE.ocean, CANYON_CARVING_SITE.other]) {
      cell(id).tile = {tileType: TileType.OCEAN};
      cell(id).player = undefined;
    }
    p2.playedCards.push(new Capital());
    cell(CANYON_CARVING_SITE.capital).tile = {tileType: TileType.CAPITAL, card: CardName.CAPITAL};
    cell(CANYON_CARVING_SITE.capital).player = p2;
    p1.cardsInHand.push(new CanyonCarving());
  },
  expect: ({game, parliament, p1, p2}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.CANYON_CARVING);
    const offer = oceanMoveOffer(p1);
    const source = offer.sources.find((s) => s.from.id === CANYON_CARVING_SITE.ocean);
    const cell = (id: string) => game.board.getSpaceOrThrow(id as SpaceId);
    const adjacent = (a: string, b: string) => game.board.getAdjacentSpaces(cell(a)).some((s) => s.id === b);
    const facts = {
      playable: card !== undefined && p1.canPlay(card) !== false,
      ruling: parliament.rulingParty(),
      sources: offer.sources.map((s) => s.from.id).join(','),
      reach: source?.to.map((s) => s.id).join(',') ?? '',
      disabled: offer.disabledSources.length,
      landBonus: cell(CANYON_CARVING_SITE.land).bonus.join(','),
      reserveBonus: cell(CANYON_CARVING_SITE.reserve).bonus.join(','),
      otherBesideLand: adjacent(CANYON_CARVING_SITE.other, CANYON_CARVING_SITE.land),
      otherBesideOcean: adjacent(CANYON_CARVING_SITE.other, CANYON_CARVING_SITE.ocean),
      capitalBesideOcean: adjacent(CANYON_CARVING_SITE.capital, CANYON_CARVING_SITE.ocean),
      capitalBesideLand: adjacent(CANYON_CARVING_SITE.capital, CANYON_CARVING_SITE.land),
      capitalBesideReserve: adjacent(CANYON_CARVING_SITE.capital, CANYON_CARVING_SITE.reserve),
      redCardVp: p2.getVictoryPoints().victoryPoints,
      oceans: game.board.getOceanSpaces().length,
      money: p1.megaCredits,
    };
    if (!facts.playable || facts.ruling !== PartyName.GREENS || facts.sources !== `${CANYON_CARVING_SITE.ocean},${CANYON_CARVING_SITE.other}` ||
        source === undefined || !source.to.some((s) => s.id === CANYON_CARVING_SITE.reserve) || !source.to.some((s) => s.id === CANYON_CARVING_SITE.land) ||
        source.to.some((s) => s.id === CANYON_CARVING_SITE.capital) || facts.disabled !== 0 ||
        facts.landBonus !== String(SpaceBonus.PLANT) || facts.reserveBonus !== `${SpaceBonus.PLANT},${SpaceBonus.PLANT}` ||
        !facts.otherBesideLand || facts.otherBesideOcean || !facts.capitalBesideOcean || facts.capitalBesideLand || facts.capitalBesideReserve ||
        facts.redCardVp !== 1 || facts.oceans !== 2 || facts.money < 6) {
      throw new Error(`the canyon-carving fixture expected a playable card under the Greens' starting rule, TWO plain oceans (${CANYON_CARVING_SITE.ocean}, ${CANYON_CARVING_SITE.other}) with ${CANYON_CARVING_SITE.ocean} reaching ${CANYON_CARVING_SITE.reserve} and ${CANYON_CARVING_SITE.land} but not the Capital's cell, red's Capital beside ${CANYON_CARVING_SITE.ocean} only (1 VP), O₂ beside ${CANYON_CARVING_SITE.land} only — got ${JSON.stringify(facts)}`);
    }
    parliament.assertLedger(game);
  },
});

// ── TR31 · NATIONALIST MOVEMENT — a card's RALLY of neutral delegates as the OUTCOME of its play
//    (docs/TURMOIL_REDUX_NATIONALIST_MOVEMENT.md): blue's action phase, the card in hand, 12 M€; the
//    Industrialists rule QUIETLY by Central Power Grid (an enacted card, so the Reds' card may stand in the
//    area); slot 0 — Heat Capture (the Reds): 2 cubes of blue's + 1 neutral (= 3; the requirement's «2
//    delegates» road); slot 1 — Architecture Award (Mars First): 1 cube of red's + 2 neutral (= 3); slot 2 —
//    Aquifer Contest (the Greens): 2 cubes of red's + 2 neutral (= 4, THE WINNER). Support: the Reds 1, Mars
//    First 3 (FULL), Unity 2 → 11 in use, a supply of 3. The plan: HC 3 → 4 (a tie with AC at 4 → slot 0:
//    it BECOMES the winner), AA 3 → 4, the Reds 1 → 2, Mars First +0 · the area is full, 14 in use, +14 M€,
//    the supply 0. The dry run checks the plan. ──
type RallyTableSpec = {reds: 'area' | 'ruling', unity: number};
function rallyTable(name: string, spec: RallyTableSpec) {
  return {
    stopAt: 'vote' as const,
    megacredits: [12, 30],
    // The corporations PINNED to two without a first action (TR30's choice): red's Aridor would hold a mandatory
    // «choose a colony tile» on its page, and the rival's table could never be opened to watch the cubes arrive.
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({p1, p2, parliament}: ParliamentTable) => {
      if (spec.reds === 'ruling') {
        // The Reds rule by their ENACTED card: no Reds resolution is up for a vote; the Industrialists' stands in slot 0.
        seatEnacted(parliament, HEAT_CAPTURE_ID);
        seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
      } else {
        seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
        seatResolution(parliament, 0, HEAT_CAPTURE_ID);
      }
      seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
      seatResolution(parliament, 2, AQUIFER_CONTEST_ID);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.placeVote(p2, parliament.slots[1], 'lobby');
      parliament.addNeutralVote(parliament.slots[1]);
      parliament.addNeutralVote(parliament.slots[1]);
      parliament.placeVote(p2, parliament.slots[2], 'reserve');
      parliament.placeVote(p2, parliament.slots[2], 'reserve');
      parliament.addNeutralVote(parliament.slots[2]);
      parliament.addNeutralVote(parliament.slots[2]);
      parliament.popularSupport.set(PartyName.REDS, 1);
      parliament.popularSupport.set(PartyName.MARS, 3);
      parliament.popularSupport.set(PartyName.UNITY, spec.unity);
      p1.cardsInHand.push(new NationalistMovement());
    },
    expect: ({game, parliament, p1}: ParliamentTable) => {
      const card = p1.cardsInHand.find((c) => c.name === CardName.NATIONALIST_MOVEMENT);
      const plan = rallyPlan(parliament, NATIONALIST_MOVEMENT_PARTIES, NATIONALIST_MOVEMENT_PRINT);
      const facts = {
        playable: card !== undefined && p1.canPlay(card),
        ruling: parliament.rulingParty(),
        parties: parliament.partiesInVotingArea().join(','),
        winner: parliament.slotIndexOf(parliament.winner()?.instance ?? ''),
        votes: parliament.slots.map((s) => s.votes.length).join(','),
        supply: parliament.neutralSupply(),
        plan: JSON.stringify({
          votes: plan.votes.map((v) => [v.party, v.placed, v.votesAfter, v.winningAfter, v.tieNote ?? null]),
          missing: plan.missing,
          support: plan.support.map((s) => [s.party, s.gained, s.limit ?? null]),
          inUse: plan.inUse, megacredits: plan.megacredits,
        }),
      };
      const expected = spec.reds === 'ruling' ? {
        ruling: PartyName.REDS, parties: [PartyName.INDUSTRIALISTS, PartyName.MARS, PartyName.GREENS].join(','), supply: 3 + 2 - spec.unity,
        plan: JSON.stringify({
          votes: [[PartyName.MARS, true, 4, true, 'slot-priority']], missing: [PartyName.REDS],
          support: [[PartyName.REDS, 1, null], [PartyName.MARS, 0, 'area']], inUse: {before: 9 + spec.unity, after: 11 + spec.unity}, megacredits: 11 + spec.unity,
        }),
      } : {
        ruling: PartyName.INDUSTRIALISTS, parties: [PartyName.REDS, PartyName.MARS, PartyName.GREENS].join(','), supply: 3 + 2 - spec.unity,
        plan: JSON.stringify({
          votes: [[PartyName.REDS, true, 4, true, 'slot-priority'], [PartyName.MARS, true, 4, false, null]], missing: [],
          support: spec.unity >= 3 ? [[PartyName.REDS, 0, 'supply'], [PartyName.MARS, 0, 'area']] : [[PartyName.REDS, 1, null], [PartyName.MARS, 0, 'area']],
          inUse: {before: 9 + spec.unity, after: 14}, megacredits: 14,
        }),
      };
      if (!facts.playable || facts.ruling !== expected.ruling || facts.parties !== expected.parties || facts.winner !== 2 || facts.votes !== '3,3,4' ||
          facts.supply !== expected.supply || facts.plan !== expected.plan) {
        throw new Error(`the ${name} fixture expected a playable card on the table of the rally's plan — got ${JSON.stringify(facts)}, expected ${JSON.stringify(expected)}`);
      }
      parliament.assertLedger(game);
    },
  };
}
parliamentFixture('nationalist-movement', rallyTable('nationalist-movement', {reds: 'area', unity: 2}));
// …the SHORT SUPPLY: Unity's area holds 3 → 12 in use, a supply of 2 — both votes land, both areas read a named zero
// (the Reds' by the supply, Mars First's by its ceiling), 14 in use, +14 M€ (the composer and the pose say one thing).
parliamentFixture('nationalist-movement-short-supply', rallyTable('nationalist-movement-short-supply', {reds: 'area', unity: 3}));
// …and THE REDS RULING by their enacted card: no Reds resolution is up for a vote (a named zero, never a skip) — the
// card is playable by the ruling road, Mars First's card takes the vote (3 → 4, the tie to slot 1), both areas pay as
// before, 13 in use, +13 M€.
parliamentFixture('nationalist-movement-reds-rule', rallyTable('nationalist-movement-reds-rule', {reds: 'ruling', unity: 2}));

// ── TR36 · COUNCIL SEAT — THE LAW OF ACCESS, lowered by a card (docs/TURMOIL_REDUX_COUNCIL_SEAT.md): blue's action phase
//    with «Место в совете» in hand and 20 M€, the Greens ruling by the starting rule (ENACTED empty). The voting area, by
//    PARTY (the ids are read off the wire by the spec — never pinned here):
//      · slot 0 — the Reds' quiet card with TWO of blue's cubes: the card's REQUIREMENT by delegates (and a party whose
//        effect blue holds by the printed road already — the play opens nothing there);
//      · slot 1 — the Scientists' quiet card with ONE of blue's cubes: the lowered law's subject — «1/2 · не доступен»
//        before the play, «1/1 · эффект ваш» after it, the Scientists' action in the menu the same turn;
//      · slot 2 — Mars First's quiet card with RED's cube only: blue's «0/1» after the play, the vote's edge.
//    Tardigrades (0 microbes) on blue's table, so the Scientists' action has a holder and is OFFERED once the effect opens.
//    Red keeps its lobby cube for the second client (its own rows read the printed ▢▢). A DRY RUN on a copy plays the
//    card, so a rule change fails HERE, by name. ──
parliamentFixture('council-seat', {
  stopAt: 'vote',
  megacredits: [20, 30],
  // Red's console must open on the BOARD (the second client reads its own rows there): Aridor's pending first
  // action would stand in front of it (the TR24 trap) — blue keeps the table's Teractor, red takes ThorGate.
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, p2, parliament}) => {
    seatResolution(parliament, 0, quietResolutionOf(PartyName.REDS));
    seatResolution(parliament, 1, quietResolutionOf(PartyName.SCIENTISTS));
    seatResolution(parliament, 2, quietResolutionOf(PartyName.MARS));
    parliament.placeVote(p1, parliament.slots[0], 'reserve');
    parliament.placeVote(p1, parliament.slots[0], 'reserve');
    parliament.placeVote(p1, parliament.slots[1], 'reserve');
    parliament.placeVote(p2, parliament.slots[2], 'reserve');
    moveToDeckTop(game, CardName.TARDIGRADES);
    p1.playedCards.push(game.projectDeck.drawPile.pop() as IProjectCard);
    moveToDeckTop(game, CardName.COUNCIL_SEAT);
    p1.cardsInHand.push(game.projectDeck.drawPile.pop() as IProjectCard);
  },
  expect: ({game, parliament, p1, p2}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.COUNCIL_SEAT);
    const parties = parliament.slots.map((s) => parliament.resolutionOf(s.instance).party);
    const before = ([PartyName.REDS, PartyName.SCIENTISTS, PartyName.MARS] as const).map((p) => parliament.access(p1, p).hasEffect);
    // THE DRY RUN — the play for real, on a copy: the Scientists open, the Reds were held already, Mars First has no cube.
    const copy = Game.deserialize(structuredClone(game.serialize()));
    const blue = copy.getPlayerById(p1.id);
    const seat = blue.cardsInHand.find((c) => c.name === CardName.COUNCIL_SEAT) as IProjectCard;
    blue.playCard(seat);
    runAllActions(copy);
    const cp = copy.parliament!;
    const after = ([PartyName.REDS, PartyName.SCIENTISTS, PartyName.MARS] as const).map((p) => cp.access(blue, p).hasEffect);
    const facts = {
      playable: card !== undefined && p1.canPlay(card),
      ruling: parliament.rulingParty(),
      enactedEmpty: parliament.enacted === undefined,
      parties: parties.join(','),
      blueVotes: parliament.slots.map((s) => parliament.votesOf(p1, s)).join(','),
      redVotes: parliament.slots.map((s) => parliament.votesOf(p2, s)).join(','),
      holder: p1.tableau.has(CardName.TARDIGRADES),
      lobby: parliament.lobby.has(p1.id) && parliament.lobby.has(p2.id),
      before: before.join(','),
      after: after.join(','),
      threshold: cp.effectDelegatesOf(blue).count,
      requirementScientists: cp.satisfiesPartyRequirement(blue, PartyName.SCIENTISTS),
      scientistsAction: ParliamentHandler.partyActionOptions(blue).some((o) => (o as {partyActionPrompt?: {party: PartyName}}).partyActionPrompt?.party === PartyName.SCIENTISTS),
      money: p1.megaCredits,
    };
    if (!facts.playable || facts.ruling !== PartyName.GREENS || !facts.enactedEmpty ||
        facts.parties !== [PartyName.REDS, PartyName.SCIENTISTS, PartyName.MARS].join(',') ||
        facts.blueVotes !== '2,1,0' || facts.redVotes !== '0,0,1' || !facts.holder || !facts.lobby ||
        facts.before !== 'true,false,false' || facts.after !== 'true,true,false' || facts.threshold !== 1 ||
        facts.requirementScientists || !facts.scientistsAction || facts.money < 6) {
      throw new Error(`the council-seat fixture expected a playable card, the Greens ruling by the starting rule, [Reds · Scientists · Mars First] with blue 2/1/0 and red 0/0/1, a data holder, both lobby cubes, and a dry run opening the Scientists alone at threshold 1 with their action offered and the requirement still unmet — got ${JSON.stringify(facts)}`);
    }
    parliament.assertLedger(game);
  },
});

// ── TR32 · RED TECH CONVENTION — the draw's NEGATIVE filter: blue's action phase with the card in hand and 10 M€, the
//    REDS RULING by their enacted Heat Capture (the requirement's ruling road), the corporations pinned (Teractor /
//    Thorgate — no first action on red's page, so red's console opens). The project deck's TOP is stacked BY NAME after
//    the deal (the deal draws from the top), turned over first → last:
//      Algae ✗ (plant) → Research ✓ → Ants ✗ (microbe) → Fish ✗ (animal) → Mining Area ✓ → Comet ✓
//    — six turned over, three kept, three thrown away, each for ITS tag. The `-clean-top` variant stacks the three clean
//    cards on top: nothing thrown away, the family's plain language, the rule still named. A DRY RUN on a copy plays the
//    card, so a rule change fails HERE. ──
const RED_TECH_JOURNEY = [CardName.ALGAE, CardName.RESEARCH, CardName.ANTS, CardName.FISH, CardName.MINING_AREA, CardName.COMET] as const;
const RED_TECH_CLEAN_TOP = [CardName.RESEARCH, CardName.MINING_AREA, CardName.COMET] as const;
/** Stack the deck so `topFirst[0]` is turned over first (the top of the draw pile is its END). */
function stackDeckTop(game: IGame, topFirst: ReadonlyArray<CardName>): void {
  for (const name of [...topFirst].reverse()) {
    moveToDeckTop(game, name);
  }
}
function redTechConvention(name: string, topFirst: ReadonlyArray<CardName>, expected: {hand: ReadonlyArray<CardName>, discard: ReadonlyArray<CardName>}): ParliamentFixtureSpec {
  return {
    stopAt: 'vote',
    megacredits: [10, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, parliament}) => {
      seatEnacted(parliament, HEAT_CAPTURE_ID);
      seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
      seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
      seatResolution(parliament, 2, AQUIFER_CONTEST_ID);
      p1.cardsInHand.push(new RedTechConvention());
      stackDeckTop(game, topFirst);
    },
    expect: ({game, parliament, p1}) => {
      const card = p1.cardsInHand.find((c) => c.name === CardName.RED_TECH_CONVENTION);
      const top = game.projectDeck.drawPile.slice(-topFirst.length).map((c) => c.name).reverse();
      // THE DRY RUN — the real play on a copy.
      const copy = Game.deserialize(structuredClone(game.serialize()));
      const blue = copy.getPlayerById(p1.id);
      const hand = new Set(blue.cardsInHand.map((c) => c.name));
      const discardBefore = copy.projectDeck.discardPile.length;
      blue.playCard(blue.cardsInHand.find((c) => c.name === CardName.RED_TECH_CONVENTION)!, Payment.of({megacredits: 5}));
      runAllActions(copy);
      const facts = {
        playable: card !== undefined && p1.canPlay(card) !== false,
        ruling: parliament.rulingParty(),
        top: top.join(','),
        drawn: blue.cardsInHand.filter((c) => !hand.has(c.name)).map((c) => c.name).join(','),
        discarded: copy.projectDeck.discardPile.slice(discardBefore).map((c) => c.name).join(','),
        mc: blue.megaCredits,
        sequence: (blue.cardDrawReveals[0]?.sequence ?? []).length,
      };
      if (!facts.playable || facts.ruling !== PartyName.REDS || facts.top !== topFirst.join(',') || facts.drawn !== expected.hand.join(',') ||
          facts.discarded !== expected.discard.join(',') || facts.mc !== 5 || facts.sequence !== (expected.discard.length > 0 ? topFirst.length : 0)) {
        throw new Error(`the ${name} fixture expected the Reds ruling, the card playable and the search to keep ${expected.hand.join(',')} / throw away ${expected.discard.join(',')} — got ${JSON.stringify(facts)}`);
      }
      parliament.assertLedger(game);
    },
  };
}
parliamentFixture('red-tech-convention', redTechConvention('red-tech-convention', RED_TECH_JOURNEY,
  {hand: [CardName.RESEARCH, CardName.MINING_AREA, CardName.COMET], discard: [CardName.ALGAE, CardName.ANTS, CardName.FISH]}));
parliamentFixture('red-tech-convention-clean-top', redTechConvention('red-tech-convention-clean-top', RED_TECH_CLEAN_TOP,
  {hand: [CardName.RESEARCH, CardName.MINING_AREA, CardName.COMET], discard: []}));
// …and the NEIGHBOURS of the class, on the SAME build-independent table (no Red Tech Convention in it — so the JSON boots
// the build BEFORE the class too: the A/B of TR32's surfaces on the cards that were already there):
//   · TR05 Vector Computations on blue's table with 4 data — its action searches for a SPACE card: Algae ✗ → Comet ✓;
//   · Aqueduct Systems in hand (a blue city beside an ocean) — the play searches for 3 BUILDING cards:
//     Algae ✗ → Comet ✗ → Mining Area ✓ → Research ✗ → Steelworks ✓ → Domed Crater ✓.
const RED_TECH_NEIGHBOURS_TOP = [CardName.ALGAE, CardName.COMET, CardName.MINING_AREA, CardName.RESEARCH, CardName.STEELWORKS, CardName.DOMED_CRATER] as const;
parliamentFixture('red-tech-convention-neighbours', {
  stopAt: 'vote',
  megacredits: [30, 30],
  // Promo in the deck: Aqueduct Systems is a promo card.
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE], promoCardsOption: true},
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, HEAT_CAPTURE_ID);
    seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 2, AQUIFER_CONTEST_ID);
    // A blue city beside an ocean tile — Aqueduct Systems' requirement.
    const ocean = game.board.getAvailableSpacesForOcean(p1).find((s) => game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.LAND && a.tile === undefined && a.bonus.length === 0))!;
    ocean.tile = {tileType: TileType.OCEAN};
    const site = game.board.getAdjacentSpaces(ocean).find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined && a.bonus.length === 0)!;
    site.tile = {tileType: TileType.CITY};
    site.player = p1;
    moveToDeckTop(game, CardName.VECTOR_COMPUTATIONS);
    const vector = game.projectDeck.drawPile.pop() as IProjectCard;
    vector.resourceCount = 4;
    p1.playedCards.push(vector);
    moveToDeckTop(game, CardName.AQUEDUCT_SYSTEMS);
    p1.cardsInHand.push(game.projectDeck.drawPile.pop() as IProjectCard);
    stackDeckTop(game, RED_TECH_NEIGHBOURS_TOP);
  },
  expect: ({game, parliament, p1}) => {
    const aqueduct = p1.cardsInHand.find((c) => c.name === CardName.AQUEDUCT_SYSTEMS);
    const vector = p1.playedCards.get(CardName.VECTOR_COMPUTATIONS);
    const top = game.projectDeck.drawPile.slice(-RED_TECH_NEIGHBOURS_TOP.length).map((c) => c.name).reverse().join(',');
    if (aqueduct === undefined || !p1.canPlay(aqueduct) || vector === undefined || vector.resourceCount !== 4 || !(vector as IProjectCard & {canAct(p: IPlayer): boolean}).canAct(p1) ||
        top !== RED_TECH_NEIGHBOURS_TOP.join(',')) {
      throw new Error(`the red-tech-convention-neighbours fixture expected Aqueduct Systems playable, Vector Computations able to act with 4 data and the stacked top — got aqueduct=${aqueduct !== undefined && p1.canPlay(aqueduct)} data=${vector?.resourceCount} top=${top}`);
    }
    parliament.assertLedger(game);
  },
});
// ── TR06 · WATER HAULING — a trade whose destination is a CARD (docs/TURMOIL_REDUX_WATER_HAULING.md):
//    blue's action phase with the card in its tableau and the card's own extra fleet (TWO free
//    fleets — the dock and a colony in one generation, each with its own fee), 6 energy (two fees) and
//    nothing else to pay with (the energy path is the fee, the M€ and titanium paths stand
//    refused with their reasons). SIX colonies open (the fullest grid the column stands beside), the oceans far from 9. A QUIET
//    government (the Industrialists by Central Power Grid) — the ocean's TR triggers nothing the
//    probe would have to account for. ──
parliamentFixture('water-hauling', {
  stopAt: 'vote',
  megacredits: [0, 30],
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
    // SIX colony tiles: the docks column has to stand beside the fullest in-game grid (3 × 2).
    game.colonies = [new Luna(), new Europa(), new Callisto(), new Ceres(), new Io(), new Miranda()];
    p1.playedCards.push(new WaterHauling());
    p1.colonies.increaseFleetSize();
    p1.energy = 6;
    p1.titanium = 0;
    p1.heat = 0;
  },
  expect: ({game, p1, parliament}) => {
    const dock = p1.playedCards.get(CardName.WATER_HAULING);
    if (dock === undefined || p1.colonies.getFleetSize() !== 2 || p1.colonies.freeTradeFleets() !== 2 ||
        p1.colonies.potentialTradeCount() < 2 || !game.canAddOcean() || parliament.rulingParty() !== PartyName.INDUSTRIALISTS) {
      throw new Error(`the water-hauling fixture expected the dock in the tableau, two free fleets, trades on offer, room for an ocean and the Industrialists ruling — got dock=${dock !== undefined} fleets=${p1.colonies.getFleetSize()}/${p1.colonies.freeTradeFleets()} trades=${p1.colonies.potentialTradeCount()} oceans=${game.board.getOceanSpaces().length} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});
// ── TR26 · UNMI LINER — the SECOND fleet dock, whose reward lands ON THE RAIL (+1 TR), and the first table
//    with TWO docks in one tableau (docs/TURMOIL_REDUX_WATER_HAULING.md §9): blue's action phase with «UNMI
//    Liner» AND «Water Hauling» played (the liner first — the column's tableau order), THREE free fleets (both
//    docks and a colony in one generation, each trade with its own fee), 9 energy (three fees) and nothing else
//    to pay with. SIX colonies open (the fullest grid the column stands beside), the oceans far from 9. THE
//    GREENS RULE (a fresh Redux table's own starting government): every TR step pays 2 M€ — the table's answer
//    the stage names before the press and the scene shows AFTER the rating has landed. The chairman quest is
//    one nothing on this journey can close (a quest's gate would be a second story over the trade's own). ──
parliamentFixture('unmi-liner', {
  stopAt: 'vote',
  megacredits: [20, 30],
  arrange: ({game, p1, parliament}) => {
    game.colonies = [new Luna(), new Europa(), new Callisto(), new Ceres(), new Io(), new Miranda()];
    p1.playedCards.push(new UnmiLiner());
    p1.playedCards.push(new WaterHauling());
    p1.colonies.setFleetSize(3);
    p1.energy = 9;
    p1.titanium = 0;
    p1.heat = 0;
    parliament.quest = {definition: {goal: {kind: 'trade'}, count: 9}, source: 'starter', generation: game.generation, progress: new Map()};
  },
  expect: ({game, p1, parliament}) => {
    const liner = p1.playedCards.get(CardName.UNMI_LINER);
    const hauling = p1.playedCards.get(CardName.WATER_HAULING);
    if (liner === undefined || hauling === undefined || p1.colonies.getFleetSize() !== 3 || p1.colonies.freeTradeFleets() !== 3 ||
        p1.colonies.potentialTradeCount() !== 3 || !game.canAddOcean() || parliament.rulingParty() !== PartyName.GREENS ||
        !parliament.hasPartyEffect(p1, PartyName.GREENS) || p1.megaCredits !== 20) {
      throw new Error(`the unmi-liner fixture expected both docks in the tableau, three free fleets, three trades on offer, room for an ocean, 20 M€ and the Greens ruling with their effect — got liner=${liner !== undefined} hauling=${hauling !== undefined} fleets=${p1.colonies.getFleetSize()}/${p1.colonies.freeTradeFleets()} trades=${p1.colonies.potentialTradeCount()} oceans=${game.board.getOceanSpaces().length} mc=${p1.megaCredits} ruling=${parliament.rulingParty()} greens=${parliament.hasPartyEffect(p1, PartyName.GREENS)}`);
    }
    parliament.assertLedger(game);
  },
});
// ── TR27 · AURORA STATION — the THIRD fleet dock, the first whose reward ASKS (docs/TURMOIL_REDUX_WATER_HAULING.md
//    §10): a Venus Next table at blue's action phase with «Aurora Station» played (its city standing on its own cell,
//    the fifth of the Venus flank) and «Floating Habs» beside it (1 floater — a second Venus floater holder, so the
//    target is a CHOICE and each choice moves a card's points: Habs 1 → 3 and the station 0 → 2 both cross «1 / 2»).
//    ONE free fleet (the card gives none), 3 energy (one fee) and nothing else to pay with. SIX colonies open (the
//    fullest grid the column stands beside). A QUIET government (the Industrialists by Central Power Grid): the
//    reward's production step answers nothing the probe would have to account for. Red is the second client. ──
parliamentFixture('aurora-station', {
  stopAt: 'vote',
  options: {venusNextExtension: true},
  megacredits: [0, 30],
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
    game.colonies = [new Luna(), new Europa(), new Callisto(), new Ceres(), new Io(), new Miranda()];
    const aurora = new AuroraStation();
    p1.playedCards.push(aurora);
    game.addTile(p1, game.board.getSpaceOrThrow(SpaceName.AURORA_STATION), {tileType: TileType.CITY, card: CardName.AURORA_STATION});
    const habs = new FloatingHabs();
    habs.resourceCount = 1;
    p1.playedCards.push(habs);
    p1.energy = 3;
    p1.titanium = 0;
    p1.heat = 0;
    parliament.quest = {definition: {goal: {kind: 'trade'}, count: 9}, source: 'starter', generation: game.generation, progress: new Map()};
    // Unity's road for a play from the hand (the spec's third journey moves the card back into it): two of blue's
    // delegates on a quiet Unity resolution in the voting area.
    seatResolution(parliament, 0, quietResolutionOf(PartyName.UNITY));
    parliament.placeVote(p1, parliament.slots[0], 'reserve');
    parliament.placeVote(p1, parliament.slots[0], 'lobby');
  },
  expect: ({game, p1, parliament}) => {
    const aurora = p1.playedCards.get(CardName.AURORA_STATION);
    const habs = p1.playedCards.get(CardName.FLOATING_HABS);
    const city = game.board.getSpaceOrThrow(SpaceName.AURORA_STATION);
    if (aurora === undefined || habs === undefined || habs.resourceCount !== 1 || aurora.resourceCount !== 0 ||
        city.tile?.tileType !== TileType.CITY || city.player?.id !== p1.id || p1.colonies.freeTradeFleets() !== 1 ||
        p1.energy !== 3 || parliament.rulingParty() !== PartyName.INDUSTRIALISTS || !parliament.access(p1, PartyName.UNITY).satisfiesRequirement) {
      throw new Error(`the aurora-station fixture expected the station (0 floaters) with its city and Floating Habs (1 floater), one free fleet, 3 energy and the Industrialists ruling — got aurora=${aurora?.resourceCount} habs=${habs?.resourceCount} city=${city.tile?.tileType}/${city.player?.id} fleets=${p1.colonies.freeTradeFleets()} energy=${p1.energy} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});
// ── TR28 · EARTH ARMY CONTRACT — the set's first action of TWO BEATS ON ONE CARD (+1 fighter here; at two, −2 for
//    1 TR — docs/claude/console/workspace-band.md § ACTION COMMIT): blue's action phase with the card played and ONE
//    fighter on it (the action converts), 20 M€, THE GREENS RULE (a fresh Redux table's own government): the TR step
//    pays 2 M€ — the table's answer the composer names before the press and the rail shows after the TR has landed.
//    The chairman quest is one nothing on this journey can close (a quest's gate would be a second story over the
//    action's own). Red is the second client. ──
parliamentFixture('earth-army-contract', {
  stopAt: 'vote',
  megacredits: [20, 30],
  arrange: ({game, p1, parliament}) => {
    const card = new EarthArmyContract();
    card.resourceCount = 1;
    p1.playedCards.push(card);
    p1.heat = 0;
    p1.titanium = 0;
    parliament.quest = {definition: {goal: {kind: 'trade'}, count: 9}, source: 'starter', generation: game.generation, progress: new Map()};
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.playedCards.get(CardName.EARTH_ARMY_CONTRACT);
    if (card === undefined || card.resourceCount !== 1 || p1.megaCredits !== 20 || parliament.rulingParty() !== PartyName.GREENS ||
        !parliament.hasPartyEffect(p1, PartyName.GREENS)) {
      throw new Error(`the earth-army-contract fixture expected the card with ONE fighter, 20 M€ and the Greens ruling with their effect — got card=${card?.resourceCount} mc=${p1.megaCredits} ruling=${parliament.rulingParty()} greens=${parliament.hasPartyEffect(p1, PartyName.GREENS)}`);
    }
    parliament.assertLedger(game);
  },
});
// ── PL-001 FOR PLAYS — A CARD PLAY'S DIRECT TR IS A REWARD (docs/claude/console/workspace-band.md § РОЗЫГРЫШ
//    КАРТЫ): blue's action phase with three TR plays in hand — Bribed Committee (an EVENT: +2 TR, the token is born on
//    the face-down pile), Terraforming Ganymede (a face: +1 TR for its own Jovian tag, born on the printed TR) and
//    Magnetic Field Dome (a production wave first, then +1 TR) — 60 M€, no titanium / heat (one payment path each),
//    2 energy production (the Dome's requirement), THE GREENS RULE (every TR step pays 2 M€ — the table's answer the
//    rail shows after the TR has landed). A chairman quest nothing on the journey can close. Red is the second client. ──
parliamentFixture('play-tr-reward', {
  stopAt: 'vote',
  megacredits: [60, 30],
  arrange: ({game, p1, parliament}) => {
    p1.cardsInHand.push(new BribedCommittee(), new TerraformingGanymede(), new MagneticFieldDome());
    p1.heat = 0;
    p1.titanium = 0;
    p1.production.add(Resource.ENERGY, 2);
    parliament.quest = {definition: {goal: {kind: 'trade'}, count: 9}, source: 'starter', generation: game.generation, progress: new Map()};
  },
  expect: ({game, p1, parliament}) => {
    const names = [CardName.BRIBED_COMMITTEE, CardName.TERRAFORMING_GANYMEDE, CardName.MAGNETIC_FIELD_DOME];
    const playable = names.every((name) => {
      const card = p1.cardsInHand.find((c) => c.name === name);
      return card !== undefined && p1.canPlay(card);
    });
    if (!playable || p1.megaCredits !== 60 || parliament.rulingParty() !== PartyName.GREENS || !parliament.hasPartyEffect(p1, PartyName.GREENS)) {
      throw new Error(`the play-tr-reward fixture expected three playable TR cards, 60 M€ and the Greens ruling with their effect — got playable=${playable} mc=${p1.megaCredits} ruling=${parliament.rulingParty()} greens=${parliament.hasPartyEffect(p1, PartyName.GREENS)}`);
    }
    parliament.assertLedger(game);
  },
});
// ── TR29 · SPACESHIP RECYCLING — ONE price taken from a card the player CHOOSES, TWO outcomes (docs/claude/console/
//    workspace-band.md § ACTION COMMIT — «a spend is a departure from its real source»): blue's action phase with the
//    card played and TWO fighters on it, Formula Zero with ONE fighter (a source that costs a VP), EVA Mechs with ONE
//    mech and Mech Sports with NONE (two mech holders — the target is a CHOICE, Mech Sports' VP moves), no titanium. A
//    QUIET government (the Industrialists by Central Power Grid) — nothing at the table answers the action. A chairman
//    quest nothing on the journey can close. Red is the second client. ──
parliamentFixture('spaceship-recycling', {
  stopAt: 'vote',
  megacredits: [10, 30],
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
    const recycling = new SpaceshipRecycling();
    recycling.resourceCount = 2;
    const formula = new FormulaZero();
    formula.resourceCount = 1;
    const eva = new EvaMechs();
    eva.resourceCount = 1;
    const sports = new MechSports();
    sports.resourceCount = 0;
    p1.playedCards.push(recycling, formula, eva, sports);
    p1.titanium = 0;
    p1.heat = 0;
    parliament.quest = {definition: {goal: {kind: 'trade'}, count: 9}, source: 'starter', generation: game.generation, progress: new Map()};
  },
  expect: ({game, p1, parliament}) => {
    const count = (name: CardName) => p1.playedCards.get(name)?.resourceCount;
    const card = p1.playedCards.get(CardName.SPACESHIP_RECYCLING) as SpaceshipRecycling | undefined;
    if (count(CardName.SPACESHIP_RECYCLING) !== 2 || count(CardName.FORMULA_ZERO) !== 1 || count(CardName.EVA_MECHS) !== 1 ||
        count(CardName.MECH_SPORTS) !== 0 || p1.titanium !== 0 || card === undefined || !card.canAct(p1)) {
      throw new Error(`the spaceship-recycling fixture expected TR29 ×2 · Formula Zero ×1 · EVA Mechs ×1 · Mech Sports ×0, no titanium and the action open — got ${[CardName.SPACESHIP_RECYCLING, CardName.FORMULA_ZERO, CardName.EVA_MECHS, CardName.MECH_SPORTS].map(count).join('/')} ti=${p1.titanium}`);
    }
    parliament.assertLedger(game);
  },
});
// ── AERIAL MAPPERS — the polish remediation iteration № 1 (docs/claude/prompts/polish-remediation-iteration-1.md):
//    ONE Venus table for the owner's two P0 classes. Blue's action phase with «Карта ветров» (Aerial Mappers, ONE
//    floater — both printed rows open: spend one to draw, add one to ANY card) and Dirigibles (TWO floaters — a second
//    holder, so the «add to ANY card» target is a real pick; and the floaters pay 3 M€ each for a Venus card) in the
//    tableau, Caretaker Contract (8 heat → 1 TR: a price off the rail with no rail result — the loss-only chain of
//    PL-142) beside them, 8 heat; Venus Governor (cost 4, requires 2 Venus tags — exactly the two holders) in hand
//    with 3 M€ — SHORT by one: the opening mix is one floater (3) + 1 M€, the price taken OFF THE SATELLITE. A quiet
//    government (the Industrialists by Central Power Grid). The Venus tables' corporations. Red is the second seat. ──
parliamentFixture('aerial-mappers', {
  stopAt: 'vote',
  megacredits: [3, 30],
  options: {venusNextExtension: true, customCorporationsList: [...VENUS_TABLE_CORPORATIONS]},
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
    const mappers = new AerialMappers();
    mappers.resourceCount = 1;
    const dirigibles = new Dirigibles();
    dirigibles.resourceCount = 2;
    p1.playedCards.push(mappers, dirigibles, new CaretakerContract());
    moveToDeckTop(game, CardName.VENUS_GOVERNOR);
    p1.cardsInHand.push(game.projectDeck.drawPile.pop()!);
    p1.heat = 8;
    p1.titanium = 0;
    p1.steel = 0;
  },
  expect: ({game, p1, parliament}) => {
    const count = (name: CardName) => p1.playedCards.get(name)?.resourceCount;
    const mappers = p1.playedCards.get(CardName.AERIAL_MAPPERS) as AerialMappers | undefined;
    const caretaker = p1.playedCards.get(CardName.CARETAKER_CONTRACT) as CaretakerContract | undefined;
    const governor = p1.cardsInHand.find((c) => c.name === CardName.VENUS_GOVERNOR);
    if (count(CardName.AERIAL_MAPPERS) !== 1 || count(CardName.DIRIGIBLES) !== 2 || p1.megaCredits !== 3 || p1.heat !== 8 ||
        mappers === undefined || !mappers.canAct(p1) || caretaker === undefined || !caretaker.canAct(p1) ||
        governor === undefined || !p1.canPlay(governor) || parliament.rulingParty() !== PartyName.INDUSTRIALISTS) {
      throw new Error(`the aerial-mappers fixture expected Aerial Mappers ×1 and Dirigibles ×2 with both actions open, Caretaker Contract open on 8 heat, Venus Governor playable on 3 M€ + a floater, the Industrialists ruling — got mappers=${count(CardName.AERIAL_MAPPERS)} dirigibles=${count(CardName.DIRIGIBLES)} mc=${p1.megaCredits} heat=${p1.heat} governor=${governor !== undefined && p1.canPlay(governor)} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});
// ── TR43 · ICHTIOLOGY GRANT — the set's first PLAY whose `or` branch holds a CARD TARGET (two pre-selects in one batch:
//    the variant, then the holder) and the first card the pre-select law (docs/claude/action-prompt-audit.md § CLASS 8)
//    carries end to end. Blue's action phase, the Greens ruling by the STARTING RULE (nothing enacted — generation 1),
//    THREE oceans on the board (red's — «each ocean in play», whoever placed it), the card in hand with 20 M€. The
//    holder sets the three fixtures differ by:
//      · `ichtiology-grant`      — Pets (animals) AND Tardigrades (microbes): the «ИЛИ» row of two, the target step in
//                                   the chosen variant's zone; TR38 Biological Simulations with 2 data answers the play's
//                                   microbe AND animal tags with ONE «+2 data»;
//      · `ichtiology-grant-one`  — Pets only: the microbe variant greyed with its reason, the animal target at once;
//      · `ichtiology-grant-none` — no holder of either kind: the card STILL plays (`OrBehavior.optional`) — the production
//                                   stands, both variants greyed, the skip named.
//    Red sits at a pinned corporation with no first action (Teractor / Thorgate — the second client's wheel must open). ──
function ichtiologyFixture(name: string, holders: {pets: boolean, tardigrades: boolean, simulations: boolean}): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [20, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({p1, p2, parliament}) => {
      seatResolution(parliament, 0, quietResolutionOf(PartyName.GREENS));
      seatResolution(parliament, 1, quietResolutionOf(PartyName.SCIENTISTS));
      seatResolution(parliament, 2, quietResolutionOf(PartyName.MARS));
      for (let i = 0; i < 3; i++) {
        addOcean(p2);
      }
      p1.megaCredits = 20;
      if (holders.pets) {
        p1.playedCards.push(new Pets());
      }
      if (holders.tardigrades) {
        p1.playedCards.push(new Tardigrades());
      }
      if (holders.simulations) {
        const simulations = new BiologicalSimulations();
        simulations.resourceCount = 2;
        p1.playedCards.push(simulations);
      }
      p1.cardsInHand.push(new IchtiologyGrant());
    },
    expect: ({game, p1, parliament}) => {
      const card = p1.cardsInHand.find((c) => c.name === CardName.ICHTIOLOGY_GRANT);
      const oceans = game.board.getOceanSpaces({upgradedOceans: true, wetlands: true}).length;
      if (card === undefined || !p1.canPlay(card) || parliament.rulingParty() !== PartyName.GREENS || oceans !== 3 ||
          (p1.playedCards.get(CardName.PETS) !== undefined) !== holders.pets ||
          (p1.playedCards.get(CardName.TARDIGRADES) !== undefined) !== holders.tardigrades) {
        throw new Error(`the ${name} fixture expected TR43 playable, the Greens ruling by the starting rule, 3 oceans and the holders ${JSON.stringify(holders)} — got playable=${card !== undefined && p1.canPlay(card)} ruling=${parliament.rulingParty()} oceans=${oceans}`);
      }
      parliament.assertLedger(game);
    },
  });
}
ichtiologyFixture('ichtiology-grant', {pets: true, tardigrades: true, simulations: true});
ichtiologyFixture('ichtiology-grant-one', {pets: true, tardigrades: false, simulations: false});
ichtiologyFixture('ichtiology-grant-none', {pets: false, tardigrades: false, simulations: false});
// ── TR45 · COMPOSTING INITIATIVE — «1 microbe for each tile on Mars», of ANY player: the play COUNTED off the board
//    (the census — `common/boards/marsTileCensus.ts`) and the owner's accent «how many, and why, before the play».
//    Blue's action phase, the Greens ruling by the STARTING RULE (nothing enacted — generation 1). The fixtures differ
//    by what stands on the board and where the card is:
//      · `composting-initiative`        — the card in hand, 20 M€ + 2 steel (the Building tag lets steel pay), Topsoil
//                                          Contract and Decomposers on blue's table; the board: blue — a city, a STACK
//                                          of 2, three greeneries; red — a city, two greeneries, a Nuclear Zone; four
//                                          oceans; a city on Ganymede (OFF Mars). → 14 = cities 4 · greeneries 5 ·
//                                          oceans 4 · special 1, Ganymede named and not counted;
//      · `composting-initiative-zero`   — the card in hand on an EMPTY board: «+0», playable, the zero named;
//      · `composting-initiative-action` — the card on blue's table with 3 microbes, its action unused.
//    Red sits at a pinned corporation with no first action (Teractor / Thorgate — the second client's wheel must open). ──
function compostingFixture(name: string, board: 'fourteen' | 'empty', at: 'hand' | 'table'): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [20, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, p2, parliament}) => {
      seatResolution(parliament, 0, quietResolutionOf(PartyName.GREENS));
      seatResolution(parliament, 1, quietResolutionOf(PartyName.SCIENTISTS));
      seatResolution(parliament, 2, quietResolutionOf(PartyName.MARS));
      if (board === 'fourteen') {
        const stack = addCity(p1);
        stack.stackHeight = 2;
        addCity(p1, game.board.getAvailableSpacesForCity(p1).find((space) => space !== stack)!.id);
        for (let i = 0; i < 3; i++) {
          addGreenery(p1);
        }
        addCity(p2);
        addGreenery(p2);
        addGreenery(p2);
        game.simpleAddTile(p2, game.board.getAvailableSpacesOnLand(p2)[0], {tileType: TileType.NUCLEAR_ZONE});
        for (let i = 0; i < 4; i++) {
          addOcean(p2);
        }
        addCity(p2, SpaceName.GANYMEDE_COLONY);
      }
      p1.megaCredits = 20;
      p1.steel = 2;
      const card = new CompostingInitiative();
      if (at === 'table') {
        card.resourceCount = 3;
        p1.playedCards.push(card);
      } else {
        p1.playedCards.push(new TopsoilContract(), new Decomposers());
        p1.cardsInHand.push(card);
      }
    },
    expect: ({game, p1, parliament}) => {
      const counter = new Counter(p1, new CompostingInitiative());
      const tiles = counter.count({tiles: {where: 'onmars'}, all: true});
      const card = at === 'hand' ? p1.cardsInHand.find((c) => c.name === CardName.COMPOSTING_INITIATIVE) : p1.playedCards.get(CardName.COMPOSTING_INITIATIVE);
      const live = card !== undefined && (at === 'hand' ? p1.canPlay(card as IProjectCard) : (card as IProjectCard & {canAct(p: IPlayer): boolean}).canAct(p1));
      const expected = board === 'fourteen' ? 14 : 0;
      if (!live || parliament.rulingParty() !== PartyName.GREENS || tiles !== expected) {
        throw new Error(`the ${name} fixture expected TR45 live (${at}), the Greens ruling by the starting rule and ${expected} tiles on Mars — got live=${live} ruling=${parliament.rulingParty()} tiles=${tiles}`);
      }
      parliament.assertLedger(game);
    },
  });
}
compostingFixture('composting-initiative', 'fourteen', 'hand');
compostingFixture('composting-initiative-zero', 'empty', 'hand');
compostingFixture('composting-initiative-action', 'fourteen', 'table');
// ── TR46 · RESEARCH STARTUPS — the table ANSWERS the patent sale («+1 data here per card sold», `onPatentsSold`) and an
//    action of variable size («all data → as many cards off the deck → keep 1»). Blue's action phase, the SCIENTISTS
//    enacted (the card's requirement is their plate), Martian Fiber on blue's table (the answer to the answer: +1 M€ per
//    data). The fixtures differ by where the card is:
//      · `research-startups`        — the card in hand, 20 M€ + 2 steel (the Building tag lets steel pay) — the play;
//      · `research-startups-sale`   — the card on blue's table with 2 data and a hand of six — the sale's summary at
//                                      0 / 1 / 4 picks and the terminal paying the data into the card;
//      · `research-startups-action` — the card on blue's table with 5 data, its action unused — «5 → 0», five cards
//                                      off the deck, keep 1.
//    The hand is SET, never assumed from the deal (Martian Rails · Adaptation Technology beside the card; six cards off the
//    deck for the sale).
//    Red sits at a pinned corporation with no first action (Teractor / Thorgate — the second client's wheel must open). ──
function researchStartupsFixture(name: string, at: 'hand' | 'sale' | 'action'): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [20, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, parliament}) => {
      seatEnacted(parliament, quietResolutionOf(PartyName.SCIENTISTS));
      p1.megaCredits = 20;
      p1.steel = 2;
      p1.playedCards.push(new MartianFiber());
      const card = new ResearchStartups();
      if (at === 'hand') {
        p1.cardsInHand = [new MartianRails(), new AdaptationTechnology(), card];
        return;
      }
      card.resourceCount = at === 'sale' ? 2 : 5;
      p1.playedCards.push(card);
      if (at === 'sale') {
        p1.cardsInHand = game.projectDeck.drawN(game, 6);
      } else {
        p1.cardsInHand = [new MartianRails(), new AdaptationTechnology()];
      }
    },
    expect: ({game, p1, parliament}) => {
      const card = at === 'hand' ? p1.cardsInHand.find((c) => c.name === CardName.RESEARCH_STARTUPS) : p1.playedCards.get(CardName.RESEARCH_STARTUPS);
      const live = card !== undefined && (at === 'hand' ? p1.canPlay(card as IProjectCard) : at === 'sale' ? true : (card as IProjectCard & {canAct(p: IPlayer): boolean}).canAct(p1));
      const hand = at === 'sale' ? 6 : at === 'hand' ? 3 : 2;
      if (!live || parliament.rulingParty() !== PartyName.SCIENTISTS || p1.cardsInHand.length !== hand ||
          p1.cardsInHand.some((c) => c.name === CardName.RESEARCH_STARTUPS) !== (at === 'hand')) {
        throw new Error(`the ${name} fixture expected TR46 live (${at}), the Scientists ruling and a hand of ${hand} — got live=${live} ruling=${parliament.rulingParty()} hand=${p1.cardsInHand.map((c) => c.name).join(', ')}`);
      }
      parliament.assertLedger(game);
    },
  });
}
researchStartupsFixture('research-startups', 'hand');
researchStartupsFixture('research-startups-sale', 'sale');
researchStartupsFixture('research-startups-action', 'action');
// ── TR48 · SUPERCOMPUTER — the third card-bound payment unit (`supercomputerData`: the data here pay 2 M€ for a
//    Science card) and «+2 data on ANY card». Blue's action phase, the SCIENTISTS enacted (the card's requirement is
//    their plate). The fixtures differ by what is asked:
//      · `supercomputer`        — the card in hand, 1 energy production, 15 M€, TR05 Vector Computations on blue's
//                                  table (the Science tag's answer: +2 data on it, no prompt) — the play;
//      · `supercomputer-pay`    — the card on blue's table with 4 data, 4 M€ + 2 steel; a hand of TR46 Research
//                                  Startups (8, Science + Building — the data and the steel on one panel) and Mine
//                                  (4, Building — no data lane) — the unit;
//      · `supercomputer-action` — the card on blue's table with 0 data beside four OTHER data holders of four meanings
//                                  (TR15 Martian Census 1 — a delegate per 3; TR46 2 — a look; TR38 0 — an action at
//                                  2; Martian Fiber 0 — VP per 2, and +1 M€ per data on ANY card) — «where do the 2 go».
//    Red sits at a pinned corporation with no first action (Teractor / Thorgate — the second client's wheel must open). ──
function supercomputerFixture(name: string, at: 'hand' | 'pay' | 'action'): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [15, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({p1, parliament}) => {
      seatEnacted(parliament, quietResolutionOf(PartyName.SCIENTISTS));
      const card = new Supercomputer();
      if (at === 'hand') {
        p1.megaCredits = 15;
        p1.production.override({energy: 1});
        p1.playedCards.push(new VectorComputations());
        p1.cardsInHand = [new MartianRails(), card];
        return;
      }
      p1.playedCards.push(card);
      if (at === 'pay') {
        card.resourceCount = 4;
        p1.megaCredits = 4;
        p1.steel = 2;
        p1.cardsInHand = [new ResearchStartups(), new Mine()];
        return;
      }
      card.resourceCount = 0;
      p1.megaCredits = 15;
      const census = new MartianCensus();
      census.resourceCount = 1;
      const startups = new ResearchStartups();
      startups.resourceCount = 2;
      p1.playedCards.push(census, startups, new BiologicalSimulations(), new MartianFiber());
      p1.cardsInHand = [new MartianRails()];
    },
    expect: ({game, p1, parliament}) => {
      const inHand = p1.cardsInHand.find((c) => c.name === CardName.SUPERCOMPUTER);
      const onTable = p1.playedCards.get(CardName.SUPERCOMPUTER) as (IProjectCard & {canAct(p: IPlayer): boolean}) | undefined;
      const startups = p1.cardsInHand.find((c) => c.name === CardName.RESEARCH_STARTUPS);
      const live = at === 'hand' ? inHand !== undefined && p1.canPlay(inHand) :
        at === 'pay' ? onTable !== undefined && startups !== undefined && p1.canPlay(startups) && p1.megaCredits < 8 :
          onTable !== undefined && onTable.canAct(p1);
      if (!live || parliament.rulingParty() !== PartyName.SCIENTISTS) {
        throw new Error(`the ${name} fixture expected TR48 live (${at}) and the Scientists ruling — got live=${live} ruling=${parliament.rulingParty()} hand=${p1.cardsInHand.map((c) => c.name).join(', ')}`);
      }
      parliament.assertLedger(game);
    },
  });
}
supercomputerFixture('supercomputer', 'hand');
supercomputerFixture('supercomputer-pay', 'pay');
supercomputerFixture('supercomputer-action', 'action');
// ── TR50 · EXPEDITION MECHS — the set's SEVENTH mech holder (TR40 with another B: «1 mech off here → a card off the
//    deck»). Blue's action phase, the SCIENTISTS enacted (the card's requirement is their plate). The fixtures differ by
//    what is asked:
//      · `expedition-mechs`        — the card in hand; 2 M€ + 1 steel; Construction Mechs (1 mech, 5 M€ on a Building
//                                     card) and Supercomputer (1 data, 2 M€ on a Science card) on blue's table — the
//                                     play's FOUR payment lanes on one panel (Science + Building);
//      · `expedition-mechs-action` — the card on blue's table with 1 mech and blue at 1 energy: both variants live —
//                                     the two tiles of one card, B «the mech → a card into the hand»;
//      · `expedition-mechs-family` — every mech holder of the set on blue's table with its own count (EVA 2 · TR17 1 ·
//                                     Mech Sports 3 · Mars Army Mechs 1 · Automated Convoys 1 · Forestry Mechs 2 ·
//                                     TR50 1) and Spaceship Recycling with 1 fighter — the satellite's roles and
//                                     TR29's «a mech on ANY card» over SEVEN candidates.
//    Red sits at a pinned corporation with no first action (Teractor / Thorgate — the second client's wheel must open). ──
const EXPEDITION_FAMILY: ReadonlyArray<[CardName, number]> = [
  [CardName.EVA_MECHS, 2], [CardName.CONSTRUCTION_MECHS, 1], [CardName.MECH_SPORTS, 3], [CardName.MARS_ARMY_MECHS, 1],
  [CardName.AUTOMATED_CONVOYS, 1], [CardName.FORESTRY_MECHS, 2], [CardName.EXPEDITION_MECHS, 1],
];
function expeditionMechsFixture(name: string, at: 'hand' | 'action' | 'family'): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [15, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({p1, parliament}) => {
      seatEnacted(parliament, quietResolutionOf(PartyName.SCIENTISTS));
      const card = new ExpeditionMechs();
      if (at === 'hand') {
        p1.megaCredits = 2;
        p1.steel = 1;
        const construction = new ConstructionMechs();
        construction.resourceCount = 1;
        const supercomputer = new Supercomputer();
        supercomputer.resourceCount = 1;
        p1.playedCards.push(construction, supercomputer);
        p1.cardsInHand = [new MartianRails(), card];
        return;
      }
      if (at === 'action') {
        card.resourceCount = 1;
        p1.energy = 1;
        p1.playedCards.push(card);
        p1.cardsInHand = [new MartianRails()];
        return;
      }
      const holders: Record<string, IProjectCard> = {
        [CardName.EVA_MECHS]: new EvaMechs(), [CardName.CONSTRUCTION_MECHS]: new ConstructionMechs(),
        [CardName.MECH_SPORTS]: new MechSports(), [CardName.MARS_ARMY_MECHS]: new MarsArmyMechs(),
        [CardName.AUTOMATED_CONVOYS]: new AutomatedConvoys(), [CardName.FORESTRY_MECHS]: new ForestryMechs(),
        [CardName.EXPEDITION_MECHS]: card,
      };
      for (const [holder, count] of EXPEDITION_FAMILY) {
        holders[holder].resourceCount = count;
        p1.playedCards.push(holders[holder]);
      }
      const recycling = new SpaceshipRecycling();
      recycling.resourceCount = 1;
      p1.playedCards.push(recycling);
      p1.energy = 0;
      p1.titanium = 0;
      p1.cardsInHand = [new MartianRails()];
    },
    expect: ({game, p1, parliament}) => {
      const onTable = p1.playedCards.get(CardName.EXPEDITION_MECHS) as (IProjectCard & {canAct(p: IPlayer): boolean}) | undefined;
      const recycling = p1.playedCards.get(CardName.SPACESHIP_RECYCLING) as (IProjectCard & {canAct(p: IPlayer): boolean}) | undefined;
      const inHand = p1.cardsInHand.find((c) => c.name === CardName.EXPEDITION_MECHS);
      const live = at === 'hand' ? inHand !== undefined && p1.canPlay(inHand) && p1.megaCredits < 5 :
        at === 'action' ? onTable !== undefined && onTable.canAct(p1) && onTable.resourceCount === 1 && p1.energy === 1 :
          recycling !== undefined && recycling.canAct(p1) && EXPEDITION_FAMILY.every(([holder, count]) => p1.playedCards.get(holder)?.resourceCount === count);
      if (!live || parliament.rulingParty() !== PartyName.SCIENTISTS) {
        throw new Error(`the ${name} fixture expected TR50 live (${at}) and the Scientists ruling — got live=${live} ruling=${parliament.rulingParty()} hand=${p1.cardsInHand.map((c) => c.name).join(', ')}`);
      }
      parliament.assertLedger(game);
    },
  });
}
expeditionMechsFixture('expedition-mechs', 'hand');
expeditionMechsFixture('expedition-mechs-action', 'action');
expeditionMechsFixture('expedition-mechs-family', 'family');
// ── TR51 · INFLUENTIAL DISCOVERY — «1 science OR 6 data to ANY card» (TR43's optional `or` as the whole card) and the
//    stand of the choice-grammar iteration (docs/claude/prompts/project-tr51-influential-discovery.md): the comparison
//    «1 science against 6 data» whose both ends depend on the table. Blue's action phase, the SCIENTISTS enacted (the
//    card's plate), the card in hand with 20 M€. The fixtures differ by the table:
//      · `influential-discovery`        — Physics Complex (0 science, 2 VP each) and Search for Life (0 — «0 → 1» is
//                                          its 3 VP) as the science holders; TR15 Martian Census (1 data — 6 more reach
//                                          its 3-data delegate twice) and TR48 Supercomputer (0 — 2 M€ each on a Science
//                                          card) as the data holders, and Martian Fiber (a data holder itself — +1 M€
//                                          per data added to ANY card);
//      · `influential-discovery-askers` — the table's QUESTIONS the Science tag wakes: Olympus Conference with 1
//                                          science (it asks «remove one to draw, or add one»), Mars University (it asks
//                                          «discard a card to draw one») and a second card in hand to discard; one data
//                                          holder (Supercomputer) so the card's own choice stands too;
//      · `influential-discovery-none`   — no holder of either kind: the card STILL plays (`OrBehavior.optional`), both
//                                          variants greyed, the loss named once.
//    Red sits at a pinned corporation with no first action (Teractor / Thorgate — the second client's wheel must open). ──
function influentialDiscoveryFixture(name: string, table: 'both' | 'askers' | 'none'): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [20, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({p1, parliament}) => {
      seatEnacted(parliament, quietResolutionOf(PartyName.SCIENTISTS));
      p1.megaCredits = 20;
      if (table === 'both') {
        const census = new MartianCensus();
        census.resourceCount = 1;
        p1.playedCards.push(new PhysicsComplex(), new SearchForLife(), census, new Supercomputer(), new MartianFiber());
      } else if (table === 'askers') {
        const olympus = new OlympusConference();
        olympus.resourceCount = 1;
        p1.playedCards.push(olympus, new MarsUniversity(), new Supercomputer());
      }
      p1.cardsInHand = table === 'askers' ? [new MartianRails(), new InfluentialDiscovery()] : [new InfluentialDiscovery()];
    },
    expect: ({game, p1, parliament}) => {
      const card = p1.cardsInHand.find((c) => c.name === CardName.INFLUENTIAL_DISCOVERY);
      const holders = p1.playedCards.asArray().filter((c) => c.resourceType === CardResource.SCIENCE || c.resourceType === CardResource.DATA).length;
      const expected = table === 'both' ? 5 : table === 'askers' ? 2 : 0;
      if (card === undefined || !p1.canPlay(card) || parliament.rulingParty() !== PartyName.SCIENTISTS || holders !== expected) {
        throw new Error(`the ${name} fixture expected TR51 playable, the Scientists ruling and ${expected} holders — got playable=${card !== undefined && p1.canPlay(card)} ruling=${parliament.rulingParty()} holders=${holders}`);
      }
      parliament.assertLedger(game);
    },
  });
}
influentialDiscoveryFixture('influential-discovery', 'both');
influentialDiscoveryFixture('influential-discovery-askers', 'askers');
influentialDiscoveryFixture('influential-discovery-none', 'none');
// ── TR52 · SCIENTIFIC BREAKTHROUGH — «remove 2 data from ANY player's card (mandatory) → search 2 Science cards» and the
//    stand of the DISCARD iteration (docs/claude/prompts/project-tr52-scientific-breakthrough.md). Blue's action phase,
//    the SCIENTISTS enacted (the card's plate), 20 M€. The data holders: blue's TR46 Research Startups (2 data — a
//    candidate of its own), red's TR15 Martian Census (3 data — the journey's target) and TR48 Supercomputer (1 data —
//    DISABLED: «2 data from a card»). The project deck's TOP is stacked BY NAME after the deal:
//      · `scientific-breakthrough`         — Algae ✗ → Comet ✗ → Fish ✗ → Research ✓ → Physics Complex ✓ (three thrown away);
//      · `scientific-breakthrough-clean`   — Research ✓ → Physics Complex ✓ (nothing thrown away: no discard pile at all);
//      · `scientific-breakthrough-actions` — TR05 Vector Computations with 4 data on blue's table (no TR52 in hand): its
//                                            action searches ONE Space card — Algae ✗ → Fish ✗ → Comet ✓ (the «Действия
//                                            карт» host of the same scene).
//    Red sits at a pinned corporation with no first action (Teractor / Thorgate — the second client's wheel opens). A DRY
//    RUN on a copy plays the card / the action, so a rule change fails HERE. ──
const SCIENTIFIC_JOURNEY = [CardName.ALGAE, CardName.COMET, CardName.FISH, CardName.RESEARCH, CardName.PHYSICS_COMPLEX] as const;
const SCIENTIFIC_CLEAN_TOP = [CardName.RESEARCH, CardName.PHYSICS_COMPLEX] as const;
const SCIENTIFIC_ACTIONS_TOP = [CardName.ALGAE, CardName.FISH, CardName.COMET] as const;
function scientificBreakthroughFixture(name: string, variant: 'journey' | 'clean' | 'actions'): void {
  const top = variant === 'journey' ? SCIENTIFIC_JOURNEY : variant === 'clean' ? SCIENTIFIC_CLEAN_TOP : SCIENTIFIC_ACTIONS_TOP;
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [20, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, p2, parliament}) => {
      seatEnacted(parliament, quietResolutionOf(PartyName.SCIENTISTS));
      p1.megaCredits = 20;
      if (variant === 'actions') {
        moveToDeckTop(game, CardName.VECTOR_COMPUTATIONS);
        const vector = game.projectDeck.drawPile.pop() as IProjectCard;
        vector.resourceCount = 4;
        p1.playedCards.push(vector);
        p1.cardsInHand = [];
      } else {
        const startups = new ResearchStartups();
        startups.resourceCount = 2;
        p1.playedCards.push(startups);
        const census = new MartianCensus();
        census.resourceCount = 3;
        const supercomputer = new Supercomputer();
        supercomputer.resourceCount = 1;
        p2.playedCards.push(census, supercomputer);
        p1.cardsInHand = [new ScientificBreakthrough()];
      }
      stackDeckTop(game, top);
    },
    expect: ({game, p1, p2, parliament}) => {
      const deckTop = game.projectDeck.drawPile.slice(-top.length).map((c) => c.name).reverse().join(',');
      const copy = Game.deserialize(structuredClone(game.serialize()));
      const blue = copy.getPlayerById(p1.id);
      const discardBefore = copy.projectDeck.discardPile.length;
      if (variant === 'actions') {
        const vector = p1.playedCards.get(CardName.VECTOR_COMPUTATIONS) as (IProjectCard & {canAct(p: IPlayer): boolean}) | undefined;
        const live = vector !== undefined && vector.canAct(p1) && vector.resourceCount === 4;
        const dry = blue.playedCards.get(CardName.VECTOR_COMPUTATIONS) as IProjectCard & {action(p: IPlayer): unknown};
        dry.action(blue);
        runAllActions(copy);
        const facts = {
          live,
          top: deckTop,
          drawn: blue.cardsInHand.map((c) => c.name).join(','),
          discarded: copy.projectDeck.discardPile.slice(discardBefore).map((c) => c.name).join(','),
          ruling: parliament.rulingParty(),
        };
        if (!facts.live || facts.top !== top.join(',') || facts.drawn !== CardName.COMET || facts.discarded !== [CardName.ALGAE, CardName.FISH].join(',') || facts.ruling !== PartyName.SCIENTISTS) {
          throw new Error(`the ${name} fixture expected TR05 able to act with 4 data and its search to keep Comet / throw away Algae, Fish — got ${JSON.stringify(facts)}`);
        }
        parliament.assertLedger(game);
        return;
      }
      const card = p1.cardsInHand.find((c) => c.name === CardName.SCIENTIFIC_BREAKTHROUGH);
      blue.playCard(blue.cardsInHand.find((c) => c.name === CardName.SCIENTIFIC_BREAKTHROUGH)!, Payment.of({megacredits: 6}));
      runAllActions(copy);
      const pick = blue.getWaitingFor() as SelectCard<IProjectCard> | undefined;
      const candidates = pick?.cards.map((c) => c.name).join(',') ?? '';
      const disabled = pick?.config.disabled?.map((d) => `${d.card.name}:${d.reason}`).join(',') ?? '';
      blue.process({type: 'card', cards: [CardName.MARTIAN_CENSUS]});
      runAllActions(copy);
      const facts = {
        playable: card !== undefined && p1.canPlay(card) !== false,
        ruling: parliament.rulingParty(),
        top: deckTop,
        candidates,
        disabled,
        census: (copy.getPlayerById(p2.id).playedCards.get(CardName.MARTIAN_CENSUS) as IProjectCard | undefined)?.resourceCount,
        drawn: blue.cardsInHand.map((c) => c.name).join(','),
        discarded: copy.projectDeck.discardPile.slice(discardBefore).map((c) => c.name).join(','),
        mc: blue.megaCredits,
      };
      const thrown = variant === 'journey' ? [CardName.ALGAE, CardName.COMET, CardName.FISH].join(',') : '';
      if (!facts.playable || facts.ruling !== PartyName.SCIENTISTS || facts.top !== top.join(',') ||
          facts.candidates !== [CardName.RESEARCH_STARTUPS, CardName.MARTIAN_CENSUS].join(',') ||
          facts.disabled !== `${CardName.SUPERCOMPUTER}:Not enough resources on this card` || facts.census !== 1 ||
          facts.drawn !== [CardName.RESEARCH, CardName.PHYSICS_COMPLEX].join(',') || facts.discarded !== thrown || facts.mc !== 14) {
        throw new Error(`the ${name} fixture expected TR52 playable under the Scientists, two candidates (Research Startups, Martian Census) and Supercomputer disabled, the search keeping Research + Physics Complex — got ${JSON.stringify(facts)}`);
      }
      parliament.assertLedger(game);
    },
  });
}
scientificBreakthroughFixture('scientific-breakthrough', 'journey');
scientificBreakthroughFixture('scientific-breakthrough-clean', 'clean');
scientificBreakthroughFixture('scientific-breakthrough-actions', 'actions');

// ── TR49 CUTTING-EDGE DESIGN — the ONE-PLAY class (docs/claude/prompts/project-tr49-cutting-edge-design.md). Blue's action
//    phase, the SCIENTISTS enacted (the card's plate), red at a pinned corporation with no first action:
//      · `cutting-edge-design`        — −20 °C / 2 % O₂, 60 M€; the hand: TR49 (playable), Lake Marineris (0 °C — short),
//                                       Grass (−16 °C — short), Comet (no requirement — the play that would SPEND the
//                                       waiver on nothing), Special Design (the sister: ±2);
//      · `special-design-armed`       — Special Design ARMED (on the table, `lastCardPlayed`), −18 °C: Lake Marineris
//                                       still short (0 → −4), Grass playable ONLY thanks to it (−16 → −20), Comet needs
//                                       nothing and would spend it;
//      · `indentured-workers-armed`   — Indentured Workers ARMED: Comet 21 → 13 M€, the discount named.
//    A DRY RUN on a copy proves every verdict the e2e reads. ──
function cuttingEdgeFixture(name: string, variant: 'journey' | 'special-design' | 'indentured'): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [60, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1}) => {
      seatEnacted(game.parliament!, quietResolutionOf(PartyName.SCIENTISTS));
      p1.megaCredits = 60;
      setTemperature(game, variant === 'journey' ? -20 : -18);
      setOxygenLevel(game, 2);
      const take = (card: CardName): IProjectCard => {
        moveToDeckTop(game, card);
        return game.projectDeck.drawOrThrow(game);
      };
      const hand = variant === 'journey' ?
        [CardName.CUTTING_EDGE_DESIGN, CardName.LAKE_MARINERIS, CardName.GRASS, CardName.COMET, CardName.SPECIAL_DESIGN] :
        variant === 'special-design' ?
          [CardName.LAKE_MARINERIS, CardName.GRASS, CardName.COMET] :
          [CardName.COMET, CardName.LAKE_MARINERIS];
      p1.cardsInHand = hand.map(take);
      if (variant !== 'journey') {
        const armer = take(variant === 'special-design' ? CardName.SPECIAL_DESIGN : CardName.INDENTURED_WORKERS);
        p1.playedCards.push(armer);
        p1.lastCardPlayed = armer.name;
      }
    },
    expect: ({p1}) => {
      const can = (n: CardName) => {
        const card = p1.cardsInHand.find((c) => c.name === n);
        return card !== undefined && p1.canPlay(card);
      };
      const facts = {
        tr49: can(CardName.CUTTING_EDGE_DESIGN),
        lake: can(CardName.LAKE_MARINERIS),
        grass: can(CardName.GRASS),
        comet: can(CardName.COMET),
        armed: armedPlayEffectsOf(p1).map((e) => e.effect.kind).join(','),
        cometCost: p1.cardsInHand.find((c) => c.name === CardName.COMET) === undefined ? -1 : p1.getCardCost(p1.cardsInHand.find((c) => c.name === CardName.COMET)!),
      };
      const ok = variant === 'journey' ?
        facts.tr49 && !facts.lake && !facts.grass && facts.comet && facts.armed === '' :
        variant === 'special-design' ?
          !facts.lake && facts.grass && facts.comet && facts.armed === 'requirementShift' :
          facts.comet && facts.cometCost === 13 && facts.armed === 'discount';
      if (!ok) {
        throw new Error(`the ${name} fixture expected the ${variant} verdicts — got ${JSON.stringify(facts)}`);
      }
    },
  });
}
cuttingEdgeFixture('cutting-edge-design', 'journey');
cuttingEdgeFixture('special-design-armed', 'special-design');
cuttingEdgeFixture('indentured-workers-armed', 'indentured');
// ── TR70 BACKROOM DEAL — the one-play class's FOURTH kind (docs/claude/prompts/project-tr70-backroom-deal.md). Red's
//    action phase, the REDS enacted (Mars First and the Scientists out of power, nobody's delegates anywhere):
//      · `backroom-deal`        — −30 °C, 60 M€; the hand: TR70 (playable — no requirement), Martian Census (Mars
//                                 First's plate — refused), Cutting-Edge Design (the Scientists' plate — refused), Lake
//                                 Marineris (0 °C — refused by a GLOBAL requirement the party waiver must never touch),
//                                 Comet (21 M€, no requirement — the discount's whole 10);
//      · `backroom-deal-armed`  — TR70 on the table as `lastCardPlayed` (both effects armed): Martian Census playable at
//                                 0 M€ (the party waiver + the discount floored), Cutting-Edge Design playable, Comet
//                                 21 → 11, Lake Marineris still refused.
//    A DRY RUN on a copy proves every verdict the e2e reads. ──
function backroomDealFixture(name: string, variant: 'journey' | 'armed'): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [60, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1}) => {
      seatEnacted(game.parliament!, quietResolutionOf(PartyName.REDS));
      p1.megaCredits = 60;
      setTemperature(game, -30);
      setOxygenLevel(game, 2);
      const take = (card: CardName): IProjectCard => {
        moveToDeckTop(game, card);
        return game.projectDeck.drawOrThrow(game);
      };
      const hand = variant === 'journey' ?
        [CardName.BACKROOM_DEAL, CardName.MARTIAN_CENSUS, CardName.CUTTING_EDGE_DESIGN, CardName.LAKE_MARINERIS, CardName.COMET] :
        [CardName.MARTIAN_CENSUS, CardName.CUTTING_EDGE_DESIGN, CardName.LAKE_MARINERIS, CardName.COMET];
      p1.cardsInHand = hand.map(take);
      if (variant === 'armed') {
        const armer = take(CardName.BACKROOM_DEAL);
        p1.playedCards.push(armer);
        p1.lastCardPlayed = armer.name;
      }
    },
    expect: ({p1}) => {
      const card = (n: CardName) => p1.cardsInHand.find((c) => c.name === n);
      const can = (n: CardName) => {
        const c = card(n);
        return c !== undefined && p1.canPlay(c);
      };
      const cost = (n: CardName) => {
        const c = card(n);
        return c === undefined ? -1 : p1.getCardCost(c);
      };
      const facts = {
        deal: can(CardName.BACKROOM_DEAL), census: can(CardName.MARTIAN_CENSUS), ced: can(CardName.CUTTING_EDGE_DESIGN),
        lake: can(CardName.LAKE_MARINERIS), comet: can(CardName.COMET),
        censusCost: cost(CardName.MARTIAN_CENSUS), cometCost: cost(CardName.COMET),
        armed: armedPlayEffectsOf(p1).map((e) => e.effect.kind).join(','),
      };
      const ok = variant === 'journey' ?
        facts.deal && !facts.census && !facts.ced && !facts.lake && facts.comet && facts.cometCost === 21 && facts.armed === '' :
        facts.census && facts.censusCost === 0 && facts.ced && !facts.lake && facts.comet && facts.cometCost === 11 && facts.armed === 'partyWaiver,discount';
      if (!ok) {
        throw new Error(`the ${name} fixture expected the ${variant} verdicts — got ${JSON.stringify(facts)}`);
      }
    },
  });
}
backroomDealFixture('backroom-deal', 'journey');
backroomDealFixture('backroom-deal-armed', 'armed');

// ── «МАРС ТЕРРАФОРМИРОВАН» (TR70's iteration — the terraformed SCENE, `terraformedScene.ts`): a two-seat base table in
//    the action phase ONE OCEAN from the finished planet — the temperature and the oxygen at their maximum, eight oceans
//    on 04 · 06 · 28 · 32 · 33 · 34 · 43 · 44, so the LAST one lands on 07 (no bonus — the lowest free id, which is what an API
//    drive answers: the scene over a clean board), on 13 (two cards — a reveal standing when the scene arms; the e2e walks the
//    cursor there) or on 45 (a plant); the viewer rich enough for a standard aquifer.
//      · `terraformed-brink`        — the viewer (the first seat) on the move: the e2e places the ninth ocean from the page, or an API
//                                     drive answers the viewer's own prompt (the scene off a view the page did not press for);
//      · `terraformed-brink-rival`  — the viewer passed, the second seat on the move: the API drives it — the viewer watches a RIVAL
//                                     finish the planet. ──
function terraformedBrinkFixture(name: string, viewerActs: boolean): void {
  const [game, viewer, rival] = testGame(2, {skipInitialCardSelection: false}); // the first seat is BLUE, the second RED
  if (!(viewer.getWaitingFor() instanceof SelectInitialCards)) {
    throw new Error(`${name}: expected SelectInitialCards, got ${viewer.getWaitingFor()?.constructor.name}`);
  }
  answerStartFlow(game, [viewer, rival]);
  setTemperature(game, MAX_TEMPERATURE);
  setOxygenLevel(game, MAX_OXYGEN_LEVEL);
  for (const id of ['04', '06', '28', '32', '33', '34', '43', '44']) {
    addOcean(viewer, id as SpaceId);
  }
  viewer.megaCredits = 60;
  rival.megaCredits = 60;
  viewer.plants = 8; // a final greenery's worth — the finale's prompt stands after the passes (PL-290's measure)
  rival.plants = 0;
  runAllActions(game);
  if (!viewerActs) {
    viewer.pass();
    game.playerIsFinishedTakingActions(); // the turn passes to the rival
    runAllActions(game);
  }
  const m = {temp: game.getTemperature(), oxy: game.getOxygenLevel(), oceans: game.board.getOceanSpaces().length, terraformed: game.marsIsTerraformed(), active: game.activePlayer.color};
  if (m.temp !== MAX_TEMPERATURE || m.oxy !== MAX_OXYGEN_LEVEL || m.oceans !== 8 || m.terraformed || m.active !== (viewerActs ? viewer.color : rival.color)) {
    throw new Error(`the ${name} fixture expected the brink (two scales maxed, eight oceans, ${viewerActs ? 'the viewer' : 'the rival'} on the move) — got ${JSON.stringify(m)}`);
  }
  write(name, game);
}
terraformedBrinkFixture('terraformed-brink', true);
terraformedBrinkFixture('terraformed-brink-rival', false);
// The one-play class's STANDING half (the owner's question of 2026-10-15): SEVERAL modifiers at once — Inventrix (±2,
// the corporation) + Adaptation Technology (±2, on the table) + Special Design ARMED (±2, one play) = ±6 at −20 °C. Grass
// (≥ −16) is met ONLY thanks to them (≥ −28), Lake Marineris (≥ 0 → ≥ −12) is still short, Archaebacteria (≤ −18) is met
// ANYWAY (its cassette stays printed — quiet), Comet prints no requirement.
parliamentFixture('standing-modifiers', {
  stopAt: 'vote',
  megacredits: [60, 30],
  options: {customCorporationsList: [CardName.INVENTRIX, CardName.THORGATE]},
  arrange: ({game, p1}) => {
    seatEnacted(game.parliament!, quietResolutionOf(PartyName.SCIENTISTS));
    p1.megaCredits = 60;
    setTemperature(game, -20);
    setOxygenLevel(game, 2);
    const take = (card: CardName): IProjectCard => {
      moveToDeckTop(game, card);
      return game.projectDeck.drawOrThrow(game);
    };
    p1.cardsInHand = [CardName.GRASS, CardName.LAKE_MARINERIS, CardName.ARCHAEBACTERIA, CardName.COMET].map(take);
    p1.playedCards.push(take(CardName.ADAPTATION_TECHNOLOGY));
    const armer = take(CardName.SPECIAL_DESIGN);
    p1.playedCards.push(armer);
    p1.lastCardPlayed = armer.name;
  },
  expect: ({p1}) => {
    const can = (n: CardName) => {
      const card = p1.cardsInHand.find((c) => c.name === n);
      return card !== undefined && p1.canPlay(card);
    };
    const facts = {
      inventrix: p1.playedCards.corporations().some((c) => c.name === CardName.INVENTRIX),
      steps: p1.getGlobalParameterRequirementBonus(GlobalParameter.TEMPERATURE),
      grass: can(CardName.GRASS), lake: can(CardName.LAKE_MARINERIS), archae: can(CardName.ARCHAEBACTERIA),
      armed: armedPlayEffectsOf(p1).map((e) => e.effect.kind).join(','),
    };
    if (!facts.inventrix || facts.steps !== 6 || !facts.grass || facts.lake || !facts.archae || facts.armed !== 'requirementShift') {
      throw new Error(`the standing-modifiers fixture expected Inventrix + AT + an armed Special Design (±6) — got ${JSON.stringify(facts)}`);
    }
  },
});
// ── SPONSORED ACADEMIES — the owner's report of 2026-10-11 («the discard picked in the composer comes back as a separate
//    prompt»), the pre-select law's regression stand. Blue's action phase with Sponsored Academies + three cards in hand
//    (Algae, Lichen, Kelp Farming — none playable for less than the hand's 20 M€ matters: the hand is the DISCARD's
//    candidate set), a quiet government (the Industrialists by Central Power Grid), the Venus tables' corporations. Red is
//    the second seat — its external draw of 1 is the play's last beat. ──
parliamentFixture('sponsored-academies', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {venusNextExtension: true, customCorporationsList: [...VENUS_TABLE_CORPORATIONS]},
  arrange: ({p1, parliament}) => {
    seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
    p1.cardsInHand.push(new SponsoredAcademies(), new Algae(), new Lichen(), new KelpFarming());
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.SPONSORED_ACADEMIES);
    if (card === undefined || !p1.canPlay(card) || p1.cardsInHand.length < 4 || parliament.rulingParty() !== PartyName.INDUSTRIALISTS) {
      throw new Error(`the sponsored-academies fixture expected the card playable with three more cards in hand and the Industrialists ruling — got playable=${card !== undefined && p1.canPlay(card)} hand=${p1.cardsInHand.length} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});
// ── TR07 · COLONY SPONSORS — the STAGED COLONY, the staged play's fourth target
//    (docs/TURMOIL_REDUX_COLONY_SPONSORS.md): blue's action phase with the card in hand and 10 M€, a colony of
//    blue's OWN on Luna (the card's requirement) and Luna's marker on cell 3 (index 2) — the move «3 → 7 · +4».
//    Ceres stands at its TOP (disabled: «Маркер уже на максимуме»); Titan is INACTIVE (disabled: «Эта колония ещё
//    не активна») — SYNTHETIC, set explicitly: no floater card is in play, so the rule would leave it inactive
//    anyway, but the frame must never depend on the deal. Europa (red's cube) and Io are further candidates — a
//    rival's tile is a track like any other. A QUIET government (the Industrialists by Central Power Grid). ──
parliamentFixture('colony-sponsors', {
  stopAt: 'vote',
  megacredits: [10, 30],
  arrange: ({game, p1, p2, parliament}) => {
    seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
    const luna = new Luna();
    const ceres = new Ceres();
    const titan = new Titan();
    const europa = new Europa();
    const io = new Io();
    game.colonies = [luna, ceres, titan, europa, io];
    luna.colonies.push(p1.id);
    luna.trackPosition = 2;
    ceres.trackPosition = 6;
    titan.isActive = false;
    europa.colonies.push(p2.id);
    europa.trackPosition = 1;
    io.trackPosition = 1;
    p1.cardsInHand.push(new ColonySponsors());
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.COLONY_SPONSORS);
    const track = (name: ColonyName) => game.colonies.find((c) => c.name === name);
    if (card === undefined || !p1.canPlay(card) || p1.megaCredits !== 10 || track(ColonyName.LUNA)?.trackPosition !== 2 ||
        !track(ColonyName.LUNA)?.colonies.includes(p1.id) || track(ColonyName.CERES)?.trackPosition !== 6 ||
        track(ColonyName.TITAN)?.isActive !== false || parliament.rulingParty() !== PartyName.INDUSTRIALISTS) {
      throw new Error(`the colony-sponsors fixture expected a playable card, 10 M€, Luna at 2 with blue's colony, Ceres at its top, Titan inactive and the Industrialists ruling — got playable=${card !== undefined && p1.canPlay(card)} mc=${p1.megaCredits} luna=${track(ColonyName.LUNA)?.trackPosition} ceres=${track(ColonyName.CERES)?.trackPosition} titan=${track(ColonyName.TITAN)?.isActive} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});
// ── TR10 · FRINGE COLONY — the COLONY ROSTER's first card (docs/COLONY_ROSTER_CEREMONY.md,
//    docs/TURMOIL_REDUX_FRINGE_COLONY.md): blue's action phase in GENERATION 4 with the card in hand and 30 M€.
//    In play: Ceres and Europa EMPTY (the candidates to leave), Io with RED's colony («На плитке есть колонии»),
//    Callisto with RED's fleet («На плитке стоит торговый флот»). The reserve is what a load rebuilds — every
//    pool tile not in play: Luna (active by its class — the colony lands) and Titan (inactive: no floater card is
//    in play — SYNTHETIC only in that nobody may hold one; asserted below). A QUIET government. ──
parliamentFixture('fringe-colony', {
  stopAt: 'vote',
  megacredits: [30, 30],
  arrange: ({game, p1, p2, parliament}) => {
    seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
    const ceres = new Ceres();
    const io = new Io();
    const callisto = new Callisto();
    const europa = new Europa();
    game.colonies = [ceres, io, callisto, europa];
    io.colonies.push(p2.id);
    callisto.visitor = p2.id;
    p2.colonies.usedTradeFleets = 1;
    game.generation = 4;
    p1.cardsInHand.push(new FringeColony());
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.FRINGE_COLONY);
    const tile = (name: ColonyName) => game.colonies.find((c) => c.name === name);
    const floaterHolder = game.players.some((p) => [...p.tableau].some((c) => c.resourceType === CardResource.FLOATER));
    if (card === undefined || !p1.canPlay(card) || game.generation < 4 || p1.megaCredits !== 30 ||
        tile(ColonyName.CERES)?.colonies.length !== 0 || tile(ColonyName.IO)?.colonies.length !== 1 ||
        tile(ColonyName.CALLISTO)?.visitor === undefined || tile(ColonyName.LUNA) !== undefined || tile(ColonyName.TITAN) !== undefined ||
        floaterHolder || parliament.rulingParty() !== PartyName.INDUSTRIALISTS) {
      throw new Error(`the fringe-colony fixture expected a playable card in generation 4+, 30 M€, Ceres empty, Io with a colony, Callisto with a fleet, Luna and Titan out of play, no floater card and the Industrialists ruling — got playable=${card !== undefined && p1.canPlay(card)} gen=${game.generation} mc=${p1.megaCredits} ceres=${tile(ColonyName.CERES)?.colonies.length} io=${tile(ColonyName.IO)?.colonies.length} callisto=${tile(ColonyName.CALLISTO)?.visitor} floater=${floaterHolder} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});
/**
 * Move THE card of this name to the top of the project deck — out of wherever the deal left it (the draw pile,
 * the discard, a hand, a dealt / draft pool): the game keeps ONE instance of every card, so a fixture that wants
 * a set card on top takes the game's own copy instead of pushing a second.
 */
function moveToDeckTop(game: IGame, name: CardName): void {
  const pools: Array<Array<IProjectCard>> = [game.projectDeck.drawPile, game.projectDeck.discardPile];
  for (const player of game.players) {
    pools.push(player.cardsInHand, player.dealtProjectCards, player.draftedCards, player.draftHand);
  }
  let card: IProjectCard | undefined;
  for (const pool of pools) {
    const i = pool.findIndex((c) => c.name === name);
    if (i !== -1) {
      card = pool.splice(i, 1)[0];
    }
  }
  if (card === undefined) {
    throw new Error(`moveToDeckTop: ${name} is nowhere in the game`);
  }
  game.projectDeck.drawPile.push(card);
}

// ── TR13 · POLITICAL THINK TANK — the third deck check and the first that KEEPS the revealed card: blue's action
//    phase with the card in its tableau (its action unused) and 12 M€. The deck's TOP is pinned AFTER the deal (the
//    deal draws from the top; `customProjectCards` would deal the card into a hand and `Deck.shuffle(cardsOnTop)`
//    reorders the top — memory e2e-fixture-generator-powergrid-break):
//      · `political-think-tank` — Martian Census on top (TR15 — requires Mars First, the set's first card with a
//        party requirement): a MATCH, from the Redux deck's own pool (the card is MOVED to the top, never copied);
//      · `political-think-tank-miss` — Imported GHG on top (no party requirement): a MISS. Pinned by NAME, never
//        «the dealt top card»: every card the set ships re-deals the seeded deck (TR12 put Martian Census on top and
//        the miss read as a match), so the arrangement may not depend on the deal.
//    A quiet government (the Industrialists by Central Power Grid), as every recent Redux card table. ──
for (const variant of ['match', 'miss'] as const) {
  const name = variant === 'match' ? 'political-think-tank' : 'political-think-tank-miss';
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [12, 30],
    arrange: ({game, p1, parliament}) => {
      seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
      p1.playedCards.push(new PoliticalThinkTank());
      moveToDeckTop(game, variant === 'match' ? CardName.MARTIAN_CENSUS : CardName.IMPORTED_GHG);
    },
    expect: ({game, p1}) => {
      const card = p1.tableau.get(CardName.POLITICAL_THINK_TANK);
      const top = game.projectDeck.drawPile[game.projectDeck.drawPile.length - 1];
      const matchOk = variant === 'match' ? top?.name === CardName.MARTIAN_CENSUS : top !== undefined && !hasPartyRequirement(top);
      if (card === undefined || p1.actionsThisGeneration.has(CardName.POLITICAL_THINK_TANK) || p1.megaCredits !== 12 || !matchOk) {
        throw new Error(`the ${name} fixture expected the card in blue's tableau (unused), 12 M€ and the ${variant} top — got card=${card !== undefined} used=${p1.actionsThisGeneration.has(CardName.POLITICAL_THINK_TANK)} mc=${p1.megaCredits} top=${top?.name}`);
      }
    },
  });
}

// ── TR15 · MARTIAN CENSUS — the STAGED ACTION VOTE (the vote's fourth door: a blue card's ACTION places the
//    delegate). Blue's action phase with «Марсианская перепись» in its tableau holding 3 data (branch B is live),
//    its action unused, the free delegate in the lobby and a full reserve (the card's delegate leaves the RESERVE —
//    the lobby's cube must still stand after the commit). The voting area is pinned as TR03's: the Industrialists'
//    card first, Mars First's second, the Greens' third (the Greens rule by the starting rule). The card is the
//    game's own copy, taken out of wherever the deal put it. ──
parliamentFixture('martian-census', {
  stopAt: 'vote',
  megacredits: [20, 30],
  arrange: ({game, p1, parliament}) => {
    seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 2, AQUIFER_CONTEST_ID);
    moveToDeckTop(game, CardName.MARTIAN_CENSUS);
    const census = game.projectDeck.drawPile.pop() as MartianCensus;
    census.resourceCount = 3;
    p1.playedCards.push(census);
  },
  expect: ({game, parliament, p1}) => {
    const card = p1.tableau.get(CardName.MARTIAN_CENSUS);
    const parties = parliament.slots.map((s) => parliament.resolutionOf(s.instance).party);
    if (card === undefined || card.resourceCount !== 3 || p1.actionsThisGeneration.has(CardName.MARTIAN_CENSUS) ||
        !parliament.lobby.has(p1.id) || parliament.reserve(p1) < 2 ||
        parties[0] !== PartyName.INDUSTRIALISTS || parties[1] !== PartyName.MARS || parties[2] !== PartyName.GREENS) {
      throw new Error(`the martian-census fixture expected the card in blue's tableau with 3 data (unused), the lobby cube, a reserve of 2+, slots [Industrialists, Mars First, Greens] — got card=${card?.resourceCount} used=${p1.actionsThisGeneration.has(CardName.MARTIAN_CENSUS)} lobby=${parliament.lobby.has(p1.id)} reserve=${parliament.reserve(p1)} parties=${parties.join(',')}`);
    }
    parliament.assertLedger(game);
  },
});

// ── TR14 · RE-SETTLEMENT — a city MOVES to a neighbouring cell (docs/TURMOIL_REDUX_RE_SETTLEMENT.md): blue's action
//    phase with «Переселение» in hand, 20 M€ and Mars First's access BY DELEGATES (two of blue's on its resolution —
//    the Greens rule by the starting rule). The board is ARRANGED on Tharsis, never dealt:
//      · city X (blue, cell 16) with ONE greenery beside it (cell 17 — 1 VP) and free land around: it may move;
//      · the cell B beside it (24): a printed PLANT, a real OCEAN next to it (33) and TWO greeneries next to it (17, 25)
//        — one move that pays a cell bonus and the ocean's 2 M€ and reads «ПО города 1 → 2» in the dossier;
//      · city Y (blue, cell 62) with every land neighbour built over (red's greeneries on 56 / 57 / 61): it has nowhere
//        to go — offered DISABLED with its own reason, never hidden;
//      · red owns tiles on the field — the second client watches the move from there.
//    The ids are the e2e spec's own constants (`tests/e2e/console-re-settlement.spec.ts`); the engine's reading of the
//    arrangement is asserted below, so a board change fails HERE, by name. ──
const RE_SETTLEMENT_SITE = {x: '16', b: '24', ocean: '33', groves: ['17', '25'], y: '62', wall: ['56', '57', '61']} as const;
parliamentFixture('re-settlement', {
  stopAt: 'vote',
  megacredits: [20, 30],
  arrange: ({game, p1, p2, parliament}) => {
    seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 2, AQUIFER_CONTEST_ID);
    parliament.placeVote(p1, parliament.slots[1], 'reserve');
    parliament.placeVote(p1, parliament.slots[1], 'reserve');
    const cell = (id: string) => game.board.getSpaceOrThrow(id as SpaceId);
    for (const id of [RE_SETTLEMENT_SITE.x, RE_SETTLEMENT_SITE.y]) {
      cell(id).tile = {tileType: TileType.CITY};
      cell(id).player = p1;
    }
    for (const id of RE_SETTLEMENT_SITE.groves) {
      cell(id).tile = {tileType: TileType.GREENERY};
      cell(id).player = p1;
    }
    for (const id of RE_SETTLEMENT_SITE.wall) {
      cell(id).tile = {tileType: TileType.GREENERY};
      cell(id).player = p2;
    }
    cell(RE_SETTLEMENT_SITE.ocean).tile = {tileType: TileType.OCEAN};
    p1.cardsInHand.push(new ReSettlement());
  },
  expect: ({game, parliament, p1}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.RE_SETTLEMENT);
    const offer = cityMoveOffer(p1);
    const source = offer.sources[0];
    const b = game.board.getSpaceOrThrow(RE_SETTLEMENT_SITE.b as SpaceId);
    const groves = (id: string) => game.board.getAdjacentSpaces(game.board.getSpaceOrThrow(id as SpaceId)).filter(Board.isGreenerySpace).length;
    const facts = {
      playable: card !== undefined && p1.canPlay(card) !== false,
      sources: offer.sources.map((s) => s.from.id).join(','),
      destinations: source?.to.map((s) => s.id).join(',') ?? '',
      disabled: offer.disabledSources.map((d) => `${d.space.id}:${d.reason}`).join(','),
      bonus: b.bonus.join(','),
      ocean: game.board.getAdjacentSpaces(b).some((s) => s.tile?.tileType === TileType.OCEAN),
      grovesAtX: groves(RE_SETTLEMENT_SITE.x),
      grovesAtB: groves(RE_SETTLEMENT_SITE.b),
      money: p1.megaCredits,
    };
    if (!facts.playable || facts.sources !== RE_SETTLEMENT_SITE.x || source.to.length < 2 || !source.to.some((s) => s.id === RE_SETTLEMENT_SITE.b) ||
        facts.disabled !== `${RE_SETTLEMENT_SITE.y}:no-space-to-move` || b.bonus.length !== 1 || b.bonus[0] !== SpaceBonus.PLANT || !facts.ocean ||
        facts.grovesAtX !== 1 || facts.grovesAtB !== 2 || facts.money < 7) {
      throw new Error(`the re-settlement fixture expected a playable card, ONE movable city (${RE_SETTLEMENT_SITE.x}) reaching ${RE_SETTLEMENT_SITE.b} and at least one more cell, the city on ${RE_SETTLEMENT_SITE.y} disabled «no-space-to-move», a plant on ${RE_SETTLEMENT_SITE.b} beside an ocean, 1 → 2 greeneries — got ${JSON.stringify(facts)}`);
    }
    parliament.assertLedger(game);
  },
});

// ── TR21 · ARBORETUM — a card reward THE CELL DECIDES (docs/TURMOIL_REDUX_ARBORETUM.md): blue's action phase with
//    «Дендрарий» in hand, 30 M€ and Mars First's access BY DELEGATES (two of blue's on its resolution — the Greens rule
//    by the starting rule). Blue's tableau: Vector Computations (2 data) and Martian Fiber (0 data, +1 M€ per data) —
//    TWO data holders, so the composer's target step is a real choice. The board is ARRANGED on Tharsis, never dealt:
//      · the RICH cell G (17, no printed bonus) beside THREE city cells: blue's own (16), red's (11) and red's STACK
//        of two (24) — 1 + 1 + 2 = 4 data, Martian Fiber +4 M€;
//      · the QUIET cell Z (48), legal through blue's greenery on 54 and beside no city at all — «no adjacent cities».
//    The ids are the e2e spec's own constants (`tests/e2e/console-arboretum.spec.ts`); the engine's reading is
//    asserted below — and a DRY RUN on a deserialized copy plays the card into G, so a rule change fails HERE. ──
const ARBORETUM_SITE = {g: '17', own: '16', foreign: '11', stack: '24', z: '48', grove: '54'} as const;
parliamentFixture('arboretum', {
  stopAt: 'vote',
  megacredits: [30, 30],
  arrange: ({game, p1, p2, parliament}) => {
    seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 2, AQUIFER_CONTEST_ID);
    parliament.placeVote(p1, parliament.slots[1], 'reserve');
    parliament.placeVote(p1, parliament.slots[1], 'reserve');
    const cell = (id: string) => game.board.getSpaceOrThrow(id as SpaceId);
    cell(ARBORETUM_SITE.own).tile = {tileType: TileType.CITY};
    cell(ARBORETUM_SITE.own).player = p1;
    for (const id of [ARBORETUM_SITE.foreign, ARBORETUM_SITE.stack]) {
      cell(id).tile = {tileType: TileType.CITY};
      cell(id).player = p2;
    }
    cell(ARBORETUM_SITE.stack).stackHeight = 2;
    cell(ARBORETUM_SITE.grove).tile = {tileType: TileType.GREENERY};
    cell(ARBORETUM_SITE.grove).player = p1;
    moveToDeckTop(game, CardName.VECTOR_COMPUTATIONS);
    const vector = game.projectDeck.drawPile.pop() as IProjectCard;
    vector.resourceCount = 2;
    moveToDeckTop(game, CardName.MARTIAN_FIBER);
    const fiber = game.projectDeck.drawPile.pop() as IProjectCard;
    p1.playedCards.push(vector, fiber);
    moveToDeckTop(game, CardName.ARBORETUM);
    p1.cardsInHand.push(game.projectDeck.drawPile.pop() as Arboretum);
  },
  expect: ({game, parliament, p1}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.ARBORETUM);
    const legal = game.board.getAvailableSpacesForGreenery(p1).map((s) => s.id);
    const tiers = (id: string) => adjacentCityTiers(game.board, game.board.getSpaceOrThrow(id as SpaceId));
    // THE DRY RUN — the real play on a copy: the target, then the rich cell.
    const copy = Game.deserialize(structuredClone(game.serialize()));
    const blue = copy.getPlayerById(p1.id);
    const before = {mc: blue.megaCredits, oxygen: copy.getOxygenLevel()};
    blue.playCard(blue.cardsInHand.find((c) => c.name === CardName.ARBORETUM)!);
    runAllActions(copy);
    const pick = blue.getWaitingFor();
    const holders = pick instanceof SelectCard ? pick.cards.map((c) => c.name).join(',') : `no pick (${pick?.type})`;
    if (pick instanceof SelectCard) {
      blue.process({type: 'card', cards: [CardName.VECTOR_COMPUTATIONS]});
      runAllActions(copy);
    }
    const ask = blue.getWaitingFor();
    if (ask instanceof SelectSpace) {
      blue.process({type: 'space', spaceId: ARBORETUM_SITE.g as SpaceId});
      runAllActions(copy);
    }
    const facts = {
      playable: card !== undefined && p1.canPlay(card) !== false,
      legalG: legal.includes(ARBORETUM_SITE.g as SpaceId),
      legalZ: legal.includes(ARBORETUM_SITE.z as SpaceId),
      tiersG: tiers(ARBORETUM_SITE.g),
      tiersZ: tiers(ARBORETUM_SITE.z),
      holders,
      data: blue.tableau.get(CardName.VECTOR_COMPUTATIONS)?.resourceCount,
      mc: blue.megaCredits - before.mc,
      oxygen: copy.getOxygenLevel() - before.oxygen,
      reactions: copy.cardAdjacencyPayouts.at(-1)?.reactions,
    };
    if (!facts.playable || !facts.legalG || !facts.legalZ || facts.tiersG !== 4 || facts.tiersZ !== 0 ||
        facts.holders !== `${CardName.VECTOR_COMPUTATIONS},${CardName.MARTIAN_FIBER}` || facts.data !== 6 || facts.oxygen !== 1 ||
        facts.reactions?.megacredits !== 4) {
      throw new Error(`the arboretum fixture expected a playable card, G (${ARBORETUM_SITE.g}) legal beside 4 city tiers, Z (${ARBORETUM_SITE.z}) legal beside none, two holders, and a dry run landing 2 → 6 data with +4 M€ — got ${JSON.stringify(facts)}`);
    }
    parliament.assertLedger(game);
  },
});

// ── TR30 · RED MUSEUM — a tile trigger THE CELL DECIDES, the scene «ТАЙЛ ПЛАТИТ» (cards/tilePayout.ts): blue's action
//    phase, 40 M€ (the City standard project costs 25), «Красный музей» (0 data) and Martian Fiber (0 data, +1 M€ per
//    data) on the table, Nuclear Zone in hand; a quiet government (the Greens rule by the starting rule). The board is
//    ARRANGED on Tharsis, never dealt:
//      · the CLEAN cell C (17, no printed bonus) — no greenery and no ocean beside it: +2 data;
//      · the cell A (50, no printed bonus) beside an OCEAN TILE on 43 — the dossier's named NO, the city pays nothing;
//      · the cell N (47, no printed bonus) — clean, the special tile's cell (Nuclear Zone);
//      · a greenery of red's on 61 — the cell 62 beside it is the dossier's «beside a greenery».
//    The ids are the e2e spec's own constants (`tests/e2e/console-red-museum.spec.ts`); a DRY RUN on a deserialized copy
//    lands the three placements, so a rule change fails HERE. ──
const RED_MUSEUM_SITE = {clean: '17', besideOcean: '50', ocean: '43', special: '47', grove: '61', besideGrove: '62'} as const;
parliamentFixture('red-museum', {
  stopAt: 'vote',
  megacredits: [40, 30],
  // Red's first move must be its OWN choice — Aridor's pending corporation action would stand in front of it (the TR24
  // trap): blue keeps the table's Teractor, red takes ThorGate.
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, p2, parliament}) => {
    seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 2, AQUIFER_CONTEST_ID);
    const cell = (id: string) => game.board.getSpaceOrThrow(id as SpaceId);
    cell(RED_MUSEUM_SITE.ocean).tile = {tileType: TileType.OCEAN};
    cell(RED_MUSEUM_SITE.grove).tile = {tileType: TileType.GREENERY};
    cell(RED_MUSEUM_SITE.grove).player = p2;
    moveToDeckTop(game, CardName.RED_MUSEUM);
    const museum = game.projectDeck.drawPile.pop() as RedMuseum;
    moveToDeckTop(game, CardName.MARTIAN_FIBER);
    const fiber = game.projectDeck.drawPile.pop() as IProjectCard;
    p1.playedCards.push(museum, fiber);
    moveToDeckTop(game, CardName.NUCLEAR_ZONE);
    p1.cardsInHand.push(game.projectDeck.drawPile.pop() as NuclearZone);
  },
  expect: ({game, parliament, p1}) => {
    const cityCells = game.board.getAvailableSpacesForCity(p1).map((s) => s.id);
    const blockers = (id: string) => museumBlockers(game.board, game.board.getSpaceOrThrow(id as SpaceId));
    // THE DRY RUN — the three placements for real, on a copy.
    const copy = Game.deserialize(structuredClone(game.serialize()));
    const blue = copy.getPlayerById(p1.id);
    const museum = blue.tableau.get(CardName.RED_MUSEUM);
    const at = (id: string) => copy.board.getSpaceOrThrow(id as SpaceId);
    const mc = blue.megaCredits;
    copy.addCity(blue, at(RED_MUSEUM_SITE.clean));
    runAllActions(copy);
    const afterClean = {data: museum?.resourceCount, mc: blue.megaCredits - mc, record: copy.cardAdjacencyPayouts.at(-1)};
    copy.addTile(blue, at(RED_MUSEUM_SITE.special), {tileType: TileType.NUCLEAR_ZONE});
    runAllActions(copy);
    const afterSpecial = museum?.resourceCount;
    copy.addCity(blue, at(RED_MUSEUM_SITE.besideOcean));
    runAllActions(copy);
    const facts = {
      nuclearZoneInHand: p1.cardsInHand.some((c) => c.name === CardName.NUCLEAR_ZONE),
      onTable: [CardName.RED_MUSEUM, CardName.MARTIAN_FIBER].every((n) => p1.tableau.has(n)),
      legalClean: cityCells.includes(RED_MUSEUM_SITE.clean as SpaceId),
      legalBesideOcean: cityCells.includes(RED_MUSEUM_SITE.besideOcean as SpaceId),
      clean: blockers(RED_MUSEUM_SITE.clean),
      besideOcean: blockers(RED_MUSEUM_SITE.besideOcean),
      besideGrove: blockers(RED_MUSEUM_SITE.besideGrove),
      special: blockers(RED_MUSEUM_SITE.special),
      afterClean: {data: afterClean.data, mc: afterClean.mc, cause: afterClean.record?.cause, reactions: afterClean.record?.reactions},
      afterSpecial,
      afterBesideOcean: museum?.resourceCount,
    };
    if (!facts.nuclearZoneInHand || !facts.onTable || !facts.legalClean || !facts.legalBesideOcean ||
        facts.clean.oceans + facts.clean.greeneries !== 0 || facts.besideOcean.oceans !== 1 || facts.besideGrove.greeneries !== 1 ||
        facts.special.oceans + facts.special.greeneries !== 0 ||
        facts.afterClean.data !== 2 || facts.afterClean.cause !== 'tile-placed' || facts.afterClean.reactions?.megacredits !== 2 ||
        facts.afterSpecial !== 4 || facts.afterBesideOcean !== 4) {
      throw new Error(`the red-museum fixture expected the museum and Martian Fiber on the table, Nuclear Zone in hand, C (${RED_MUSEUM_SITE.clean}) and N (${RED_MUSEUM_SITE.special}) clean, A (${RED_MUSEUM_SITE.besideOcean}) beside one ocean, 62 beside one greenery, and a dry run landing 0 → 2 → 4 → 4 with +2 M€ — got ${JSON.stringify(facts)}`);
    }
    parliament.assertLedger(game);
  },
});

// ── THE «TILE PAYS A CARD» CLASS, A RIVAL'S CITY (PL-034 — TR15 Martian Census and Pets answer ANOTHER seat's city):
//    red on the move with 40 M€ (the City standard project costs 25), blue's tableau holds Martian Census (2 data),
//    Pets (1 animal) and Martian Fiber (0) — two records of ONE city, both blue's. No museum: the same JSON boots the
//    build BEFORE the class too (the A/B of PL-034). The clean cell 17 (the red-museum fixture's own). ──
const RIVAL_SITE = {clean: '17'} as const;
parliamentFixture('census-pets-rival', {
  stopAt: 'vote',
  megacredits: [20, 40],
  // Red's first move must be its OWN choice (Aridor's pending corporation action would stand in front of it).
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, parliament}) => {
    seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 2, AQUIFER_CONTEST_ID);
    moveToDeckTop(game, CardName.MARTIAN_CENSUS);
    const census = game.projectDeck.drawPile.pop() as IProjectCard;
    census.resourceCount = 2;
    moveToDeckTop(game, CardName.PETS);
    const pets = game.projectDeck.drawPile.pop() as IProjectCard;
    pets.resourceCount = 1;
    moveToDeckTop(game, CardName.MARTIAN_FIBER);
    const fiber = game.projectDeck.drawPile.pop() as IProjectCard;
    p1.playedCards.push(census, pets, fiber);
    p1.clearWaitingFor();
    game.playerIsFinishedTakingActions();
  },
  expect: ({game, p1, p2, parliament}) => {
    const count = (name: CardName) => p1.tableau.get(name)?.resourceCount;
    // THE DRY RUN — red's city on the clean cell, for real, on a copy: both of blue's cards answer it.
    const copy = Game.deserialize(structuredClone(game.serialize()));
    const red = copy.getPlayerById(p2.id);
    copy.addCity(red, copy.board.getSpaceOrThrow(RIVAL_SITE.clean as SpaceId));
    runAllActions(copy);
    const blue = copy.getPlayerById(p1.id);
    const records = copy.cardAdjacencyPayouts.map((r) => `${r.card}:${r.color}:${r.cause}:${r.amount}`).join(',');
    const facts = {
      census: count(CardName.MARTIAN_CENSUS), pets: count(CardName.PETS), fiber: count(CardName.MARTIAN_FIBER),
      active: game.activePlayer.id === p2.id, menu: p2.getWaitingFor() instanceof OrOptions, red: p2.megaCredits,
      legal: game.board.getAvailableSpacesForCity(p2).some((s) => s.id === RIVAL_SITE.clean),
      after: {census: blue.tableau.get(CardName.MARTIAN_CENSUS)?.resourceCount, pets: blue.tableau.get(CardName.PETS)?.resourceCount},
      records,
    };
    if (facts.census !== 2 || facts.pets !== 1 || facts.fiber !== 0 || !facts.active || !facts.menu || facts.red !== 40 || !facts.legal ||
        facts.after.census !== 3 || facts.after.pets !== 2 ||
        records !== `${CardName.MARTIAN_CENSUS}:${p1.color}:tile-placed:1,${CardName.PETS}:${p1.color}:tile-placed:1`) {
      throw new Error(`the census-pets-rival fixture expected blue's census 2 / Pets 1 / Fiber 0, red on the move with the menu and 40 M€, ${RIVAL_SITE.clean} legal for red's city, and a dry run of red's city paying blue twice (census 3, Pets 2, two blue records) — got ${JSON.stringify(facts)}`);
    }
    parliament.assertLedger(game);
  },
});

// ── TR22 · NOVA CITY — a city laid ON A COLONY TILE, the staged colony door's third mode
//    (docs/TURMOIL_REDUX_NOVA_CITY.md): blue's action phase with the card in hand and 30 M€, Unity's access by TWO
//    of blue's delegates on its resolution (Colonization Funding in slot 0 — the requirement's second road), a QUIET
//    government (the Industrialists by Central Power Grid). «Ganymede Colony» already stands for blue (a space city
//    of its own: the count reads «1 → 2», the card's VP 4) and Pets is in the tableau (the placement's trigger: +1
//    animal after the contact). The table is the seat's coexistence matrix: Luna — blue's colony AND red's FLEET;
//    Ceres — three colonies; Titan — INACTIVE (a lawful place; SYNTHETIC: set explicitly, no floater card is in
//    play); Europa and Io — plain. ──
parliamentFixture('nova-city', {
  stopAt: 'vote',
  megacredits: [30, 30],
  arrange: ({game, p1, p2, parliament}) => {
    seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 0, COLONIZATION_FUNDING_ID);
    parliament.placeVote(p1, parliament.slots[0], 'reserve');
    parliament.placeVote(p1, parliament.slots[0], 'lobby');
    const luna = new Luna();
    const ceres = new Ceres();
    const titan = new Titan();
    const europa = new Europa();
    const io = new Io();
    game.colonies = [luna, ceres, titan, europa, io];
    luna.colonies.push(p1.id);
    luna.visitor = p2.id;
    ceres.colonies.push(p2.id, p1.id, p2.id);
    titan.isActive = false;
    // A space city of blue's own, placed before the play: «Космические города 1 → 2».
    const ganymede = new GanymedeColony();
    p1.playedCards.push(ganymede, new Pets());
    game.simpleAddTile(p1, game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY), {tileType: TileType.CITY, card: CardName.GANYMEDE_COLONY});
    p1.cardsInHand.push(new NovaCity());
  },
  expect: ({game, p1, p2, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.NOVA_CITY);
    const tile = (name: ColonyName) => game.colonies.find((c) => c.name === name);
    const cell = game.board.spaces.find((s) => s.id === SpaceName.NOVA_CITY);
    if (card === undefined || !p1.canPlay(card) || p1.megaCredits !== 30 || cell === undefined || cell.tile !== undefined ||
        game.board.getCitiesOffMars(p1).length !== 1 || tile(ColonyName.LUNA)?.visitor !== p2.id ||
        tile(ColonyName.CERES)?.colonies.length !== 3 || tile(ColonyName.TITAN)?.isActive !== false ||
        parliament.rulingParty() !== PartyName.INDUSTRIALISTS) {
      throw new Error(`the nova-city fixture expected a playable card (Unity's access by two delegates), 30 M€, the hosted cell empty, one space city of blue's own, red's fleet on Luna, three colonies on Ceres, Titan inactive and the Industrialists ruling — got playable=${card !== undefined && p1.canPlay(card)} mc=${p1.megaCredits} cell=${cell === undefined ? 'missing' : (cell.tile === undefined ? 'empty' : 'taken')} spaceCities=${game.board.getCitiesOffMars(p1).length} lunaFleet=${tile(ColonyName.LUNA)?.visitor} ceres=${tile(ColonyName.CERES)?.colonies.length} titan=${tile(ColonyName.TITAN)?.isActive} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});

// ── TR25 · EXCLUSIVE COLONY — a colony BEYOND THE 3-COLONY LIMIT, the staged colony door's build mode
//    (docs/TURMOIL_REDUX_EXCLUSIVE_COLONY.md): blue's action phase with the card in hand and 30 M€, Unity's access
//    by TWO of blue's delegates on its resolution (Colonization Funding in slot 0), a QUIET government (the
//    Industrialists by Central Power Grid). The table holds BOTH lifted rules on one tile and every refusal the
//    door still makes: Luna — at its printed limit with red ×2 and blue ×1, the marker on the third cell (the
//    build lifts it to the fourth); Titan — active, one cube of blue's, and TWO floater holders in blue's tableau
//    (a second own colony UNDER the limit whose build bonus asks for a card); Ceres — red's FLEET; Enceladus —
//    INACTIVE by itself (no microbe holder is in play: the one tile the door refuses); Io — plain. SYNTHETIC:
//    the cubes and Titan's activity are set directly (no build was played to put them there). ──
parliamentFixture('exclusive-colony', {
  stopAt: 'vote',
  megacredits: [30, 30],
  arrange: ({game, p1, p2, parliament}) => {
    seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 0, COLONIZATION_FUNDING_ID);
    parliament.placeVote(p1, parliament.slots[0], 'reserve');
    parliament.placeVote(p1, parliament.slots[0], 'lobby');
    const luna = new Luna();
    const ceres = new Ceres();
    const titan = new Titan();
    const enceladus = new Enceladus();
    const io = new Io();
    game.colonies = [luna, ceres, titan, enceladus, io];
    luna.colonies.push(p2.id, p2.id, p1.id);
    luna.trackPosition = 3;
    titan.isActive = true;
    titan.colonies.push(p1.id);
    ceres.visitor = p2.id;
    enceladus.isActive = false;
    p1.playedCards.push(new Dirigibles(), new JupiterFloatingStation());
    p1.cardsInHand.push(new ExclusiveColony());
  },
  expect: ({game, p1, p2, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.EXCLUSIVE_COLONY);
    const tile = (name: ColonyName) => game.colonies.find((c) => c.name === name);
    const luna = tile(ColonyName.LUNA);
    const titan = tile(ColonyName.TITAN);
    // THE DRY RUN — the real play on a copy: the fourth cube on Luna, its bonus, its marker.
    const copy = Game.deserialize(structuredClone(game.serialize()));
    const blue = copy.getPlayerById(p1.id);
    const production = blue.production.megacredits;
    blue.playCard(blue.cardsInHand.find((c) => c.name === CardName.EXCLUSIVE_COLONY)!);
    runAllActions(copy);
    const pick = blue.getWaitingFor();
    const offered = pick instanceof SelectColony ? pick.colonies.map((c) => c.name).join(',') : `no pick (${pick?.type})`;
    if (pick instanceof SelectColony) {
      blue.process({type: 'colony', colonyName: ColonyName.LUNA});
      runAllActions(copy);
    }
    const built = copy.colonies.find((c) => c.name === ColonyName.LUNA);
    const facts = {
      playable: card !== undefined && p1.canPlay(card) !== false,
      mc: p1.megaCredits,
      luna: luna?.colonies.map((id) => (id === p1.id ? 'blue' : 'red')).join(','),
      lunaTrack: luna?.trackPosition,
      titan: titan?.colonies.length,
      titanActive: titan?.isActive,
      ceresFleet: tile(ColonyName.CERES)?.visitor === p2.id,
      enceladusActive: tile(ColonyName.ENCELADUS)?.isActive,
      holders: p1.getResourceCards(CardResource.FLOATER).length,
      offered,
      builtCubes: built?.colonies.length,
      builtTrack: built?.trackPosition,
      production: blue.production.megacredits - production,
      ruling: parliament.rulingParty(),
    };
    if (!facts.playable || facts.mc !== 30 || facts.luna !== 'red,red,blue' || facts.lunaTrack !== 3 || facts.titan !== 1 ||
        facts.titanActive !== true || !facts.ceresFleet || facts.enceladusActive !== false || facts.holders !== 2 ||
        facts.offered !== `${ColonyName.LUNA},${ColonyName.CERES},${ColonyName.TITAN},${ColonyName.IO}` ||
        facts.builtCubes !== 4 || facts.builtTrack !== 4 || facts.production !== 2 || facts.ruling !== PartyName.INDUSTRIALISTS) {
      throw new Error(`the exclusive-colony fixture expected a playable card, 30 M€, Luna red,red,blue on cell 3, Titan active with one cube and two floater holders, red's fleet on Ceres, Enceladus inactive, the door offering Luna · Ceres · Titan · Io, and a dry run landing the fourth cube (marker 4, +2 M€ production) — got ${JSON.stringify(facts)}`);
    }
    parliament.assertLedger(game);
  },
});

// ── TR12 · PARTY SANCTIONS — the SUPPORT-AREA mode, the staged party pick of an AREA
//    (docs/TURMOIL_REDUX_PARTY_SANCTIONS.md): blue's action phase with the card in hand and 10 M€, blue IN THE
//    CHAIR (the card's requirement), blue's Agenda marker on step 3 — the card's one step lands on step 4, a TR step.
//    A QUIET government (the Industrialists by Central Power Grid) and three resolutions of the other parties.
//    SYNTHETIC, for the frames «3 → 0» and «Область пуста»: Mars First's support area holds 3 neutral delegates,
//    the Scientists' 1, every other area 0 — no sitting has been held yet, so no engine path put them there (the
//    TR03 fixture's precedent); the ledger stays whole (the supply is 14 − 4). The card is the game's own copy. ──
parliamentFixture('party-sanctions', {
  stopAt: 'vote',
  megacredits: [10, 30],
  agenda: [3, 1],
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 1, AQUIFER_CONTEST_ID);
    seatResolution(parliament, 2, COLONIZATION_FUNDING_ID);
    for (const party of REDUX_PARTIES) {
      parliament.popularSupport.set(party, 0);
    }
    parliament.popularSupport.set(PartyName.MARS, 3);
    parliament.popularSupport.set(PartyName.SCIENTISTS, 1);
    parliament.chairman = p1.id;
    moveToDeckTop(game, CardName.PARTY_SANCTIONS);
    p1.cardsInHand.push(game.projectDeck.drawPile.pop() as PartySanctions);
  },
  expect: ({game, parliament, p1}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.PARTY_SANCTIONS);
    if (card === undefined || !p1.canPlay(card) || !parliament.isChairman(p1) || parliament.agendaOf(p1) !== 3 ||
        parliament.popularSupportOf(PartyName.MARS) !== 3 || parliament.popularSupportOf(PartyName.SCIENTISTS) !== 1 ||
        parliament.totalPopularSupport() !== 4 || parliament.rulingParty() !== PartyName.INDUSTRIALISTS) {
      throw new Error(`the party-sanctions fixture expected a playable card, blue in the chair on Agenda step 3, support Mars First 3 · Scientists 1 and the Industrialists ruling — got playable=${card !== undefined && p1.canPlay(card)} chair=${parliament.chairman} agenda=${parliament.agendaOf(p1)} support=${parliament.popularSupportOf(PartyName.MARS)}/${parliament.popularSupportOf(PartyName.SCIENTISTS)}/${parliament.totalPopularSupport()} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});

// ── TR72 · BANNED DELEGATE:redux — the DELEGATE mode, the staged party pick of ONE FIGURE
//    (docs/TURMOIL_REDUX_BANNED_DELEGATE.md): blue's action phase with the card in hand and 10 M€, blue IN THE CHAIR
//    (the card's requirement). A QUIET government (the Industrialists by Central Power Grid) and three resolutions:
//    Mars First (Architecture Award) — blue, red, red: red leads 2–1, and taking red's LATEST hands the lead to blue
//    (1–1, blue's figure came first); the Greens (Aquifer Contest) — two neutral votes; Unity (Colonization Funding) —
//    blue ×2 (blue holds Unity's effect by delegates). SYNTHETIC support for the area stops: the Scientists hold 2,
//    the Reds 1 (no sitting has been held yet — the TR03 / TR12 fixtures' precedent); the ledger stays whole.
//    `-locked`: red holds the chair (the card refused with the chair's reason). `-empty`: blue in the chair over an
//    EMPTY table (no vote, no support — the card refused with «no delegates»). The card is the game's own copy. ──
function bannedDelegateFixture(name: string, chair: 'p1' | 'p2', table: 'full' | 'empty'): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [10, 30],
    arrange: ({game, p1, p2, parliament}) => {
      seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
      seatResolution(parliament, 1, AQUIFER_CONTEST_ID);
      seatResolution(parliament, 2, COLONIZATION_FUNDING_ID);
      for (const party of REDUX_PARTIES) {
        parliament.popularSupport.set(party, 0);
      }
      if (table === 'full') {
        const [mars, greens, unity] = parliament.slots;
        parliament.placeVote(p1, mars, 'lobby');
        parliament.placeVote(p2, mars, 'lobby');
        parliament.placeVote(p2, mars, 'reserve');
        parliament.addNeutralVote(greens);
        parliament.addNeutralVote(greens);
        parliament.placeVote(p1, unity, 'reserve');
        parliament.placeVote(p1, unity, 'reserve');
        parliament.popularSupport.set(PartyName.SCIENTISTS, 2);
        parliament.popularSupport.set(PartyName.REDS, 1);
      }
      parliament.chairman = chair === 'p1' ? p1.id : p2.id;
      moveToDeckTop(game, CardName.BANNED_DELEGATE_REDUX);
      p1.cardsInHand.push(game.projectDeck.drawPile.pop() as BannedDelegateRedux);
    },
    expect: ({game, parliament, p1, p2}) => {
      const card = p1.cardsInHand.find((c) => c.name === CardName.BANNED_DELEGATE_REDUX);
      const playable = card !== undefined && p1.canPlay(card);
      const wantPlayable = chair === 'p1' && table === 'full';
      const [mars] = parliament.slots;
      const facts = {
        playable,
        chair: parliament.chairman === p1.id ? 'p1' : parliament.chairman === p2.id ? 'p2' : 'none',
        ruling: parliament.rulingParty(),
        mars: mars.votes.map((v) => v.owner === p1.id ? 'blue' : v.owner === p2.id ? 'red' : 'neutral').join(','),
        support: parliament.totalPopularSupport(),
      };
      const wantMars = table === 'full' ? 'blue,red,red' : '';
      if (playable !== wantPlayable || facts.chair !== chair || facts.ruling !== PartyName.INDUSTRIALISTS || facts.mars !== wantMars ||
          facts.support !== (table === 'full' ? 3 : 0)) {
        throw new Error(`the ${name} fixture expected playable=${wantPlayable}, the chair ${chair}, the Industrialists ruling, Mars First «${wantMars}» — got ${JSON.stringify(facts)}`);
      }
      parliament.assertLedger(game);
    },
  });
}
bannedDelegateFixture('banned-delegate', 'p1', 'full');
bannedDelegateFixture('banned-delegate-locked', 'p2', 'full');
bannedDelegateFixture('banned-delegate-empty', 'p1', 'empty');

// ── TR23 · HABITAT SCIENCE — «THE LEDGER PAYS» (docs/TURMOIL_REDUX_HABITAT_SCIENCE.md): blue's action phase with the
//    card IN ITS TABLEAU holding 4 data (the action live, unused) and a colony on each of four tiles whose printed
//    bonuses are the four shapes of a payout — Luna (2 M€: a plain gain), Titan (1 floater onto a card: a TARGET,
//    one holder in the tableau — Dirigibles — so the «no auto-select» step is the single-candidate one), Miranda
//    (1 card: a take) and Pluto («take 1, then discard 1»: a take and a discard). Red holds a colony on Luna too
//    (never paid). The ledger's order is the engine's: Luna · Miranda · Pluto · Titan — Titan stands SECOND on the
//    table and is paid LAST (its target waits behind Pluto's discard). A hand of three, so the discard is a
//    question. A quiet government (the Industrialists by Central Power Grid); the card is a fresh copy. ──
parliamentFixture('habitat-science', {
  stopAt: 'vote',
  megacredits: [20, 30],
  arrange: ({game, p1, p2, parliament}) => {
    seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
    const luna = new Luna();
    const titan = new Titan();
    const miranda = new Miranda();
    const pluto = new Pluto();
    for (const colony of [luna, titan, miranda, pluto]) {
      colony.isActive = true;
    }
    game.colonies = [luna, titan, miranda, pluto];
    luna.colonies.push(p1.id, p2.id);
    titan.colonies.push(p1.id);
    miranda.colonies.push(p1.id);
    pluto.colonies.push(p1.id);
    const card = new HabitatScience();
    card.resourceCount = 4;
    p1.playedCards.push(card, new Dirigibles());
    // A hand to discard FROM: with a single card Pluto's discard decides itself and asks nothing.
    while (p1.cardsInHand.length < 3) {
      p1.cardsInHand.push(game.projectDeck.drawOrThrow(game));
    }
    p1.cardsInHand.length = 3;
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.playedCards.get(CardName.HABITAT_SCIENCE) as HabitatScience | undefined;
    const ledger = card === undefined ? [] : (card.actionPreview(p1).branches[0].colonyBonuses?.entries ?? []).map((e) => e.colony);
    if (card === undefined || card.resourceCount !== 4 || !card.canAct(p1) || p1.megaCredits !== 20 || p1.cardsInHand.length !== 3 ||
        ledger.join(',') !== [ColonyName.LUNA, ColonyName.MIRANDA, ColonyName.PLUTO, ColonyName.TITAN].join(',') ||
        game.colonies.length !== 4 || parliament.rulingParty() !== PartyName.INDUSTRIALISTS) {
      throw new Error(`the habitat-science fixture expected the card in play with 4 data and a live action, 20 M€, a hand of 3, the ledger Luna · Miranda · Pluto · Titan and the Industrialists ruling — got data=${card?.resourceCount} canAct=${card?.canAct(p1)} mc=${p1.megaCredits} hand=${p1.cardsInHand.length} ledger=${ledger.join(' · ')} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});

// ── TR24 · VENUSIAN CENSUS — «THE SCALE STEP PAYS» (docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md): a Redux + VENUS NEXT
//    table. Blue holds «Венерианская перепись» in its tableau with 1 data (the satellite's data cell stands) and
//    Spin-Inducing Asteroid in hand with 20 M€; Venus at 8 % — the 8 % card bonus is behind, and neither raise of the
//    journey reaches 16 % (8 → 10 by red's «Air Scrapping», 10 → 14 by blue's asteroid): no threshold cover in this
//    fixture (the 8 % pairing is pinned by the drain's unit). RED IS ON THE MOVE with 30 M€ — blue's turn was handed
//    over before blue acted (no pass), so red's standard project and «End Turn» bring blue's turn back with its two
//    actions. A quiet government (the Industrialists by Central Power Grid). Both cards are the game's own copies. ──
parliamentFixture('venusian-census', {
  stopAt: 'vote',
  megacredits: [20, 30],
  // The Venus tables' own pair (UNMI / PhoboLog): red's first move must be its OWN choice — Aridor's pending
  // corporation action would stand in front of it.
  options: {venusNextExtension: true, customCorporationsList: [...VENUS_TABLE_CORPORATIONS]},
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
    moveToDeckTop(game, CardName.VENUSIAN_CENSUS);
    const census = game.projectDeck.drawPile.pop() as VenusianCensus;
    census.resourceCount = 1;
    p1.playedCards.push(census);
    moveToDeckTop(game, CardName.SPIN_INDUCING_ASTEROID);
    p1.cardsInHand.push(game.projectDeck.drawPile.pop()!);
    setVenusScaleLevel(game, 8);
    p1.clearWaitingFor();
    game.playerIsFinishedTakingActions();
  },
  expect: ({game, p1, p2, parliament}) => {
    const census = p1.tableau.get(CardName.VENUSIAN_CENSUS);
    const asteroid = p1.cardsInHand.find((c) => c.name === CardName.SPIN_INDUCING_ASTEROID);
    if (census === undefined || census.resourceCount !== 1 || asteroid === undefined || p1.megaCredits !== 20 ||
        game.getVenusScaleLevel() !== 8 || game.activePlayer.id !== p2.id || !(p2.getWaitingFor() instanceof OrOptions) ||
        p2.megaCredits !== 30 || parliament.rulingParty() !== PartyName.INDUSTRIALISTS) {
      throw new Error(`the venusian-census fixture expected the census with 1 data in blue's tableau, the asteroid in blue's hand, 20 M€, Venus 8 %, red on the move with the action menu and 30 M€, the Industrialists ruling — got census=${census?.resourceCount} asteroid=${asteroid !== undefined} mc=${p1.megaCredits} venus=${game.getVenusScaleLevel()} active=${game.activePlayer.color} red=${p2.getWaitingFor()?.constructor.name}/${p2.megaCredits} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});

// Generation 2 has just begun: the results scene moves the card from its voting
// slot into the government and flies red's production gain from the card to the rail.
parliamentFixture('parliament-architecture-recap', architectureTable('done', (table) => {
  const {parliament, p2} = table;
  const outcomes = parliament.lastPhase?.outcomes ?? [];
  const red = outcomes.find((o) => o.player === p2.id);
  if (parliament.enacted !== resolutionInstanceId(ARCHITECTURE_AWARD_ID, 0) || red?.kind !== 'production' || red.amount !== 5 || red.uncapped !== 6) {
    throw new Error(`the parliament-architecture-recap fixture expected red's capped +5, got ${JSON.stringify(outcomes)}`);
  }
  expectViewerOpensGeneration(table, p2, 'parliament-architecture-recap');
}));

// ── RX04 · CENTRAL POWER GRID (a TAG count + influence, max 5) — the vote: the
//    card in the FIRST voting slot with blue's free delegate on it. Blue:
//    Agenda step 4 (influence 2; winning → step 5 = 3), M€ production 3, and a
//    tableau that makes the TAG rule read — HE3 Fusion Plant prints TWO power
//    tags, Biomass Combustors counts too (a power tag with a −1 VP icon: the
//    icon plays no part), Artificial Photosynthesis does not (it raises energy
//    PRODUCTION and prints no power tag): P = 3 → «3 + 1 → +4» now and
//    «3 + 2 → +5 · max» if blue wins (the forecast reaches the cap). Red:
//    Agenda step 5 (influence 3), two power tags. ──
const powerGridVote = (blueAgenda: number): ParliamentFixtureSpec => ({
  resolution: CENTRAL_POWER_GRID_ID,
  votes: [0],
  agenda: [blueAgenda, 5],
  stopAt: 'vote',
  arrange: ({p1, p2}) => {
    p1.playedCards.push(new HE3FusionPlant(), new BiomassCombustors(), new ArtificialPhotosynthesis());
    p2.playedCards.push(new PowerPlant(), new FusionPower(), new Mine());
    p1.production.override({megacredits: 3});
    p2.production.override({megacredits: 1});
  },
  expect: ({p1}) => {
    const count = resolutionCount(p1, 'powerTags');
    if (count.count !== 3 || count.cards.length !== 2) {
      throw new Error(`the parliament-powergrid-vote fixture expected P=3 from 2 cards, got ${JSON.stringify(count)}`);
    }
  },
});
parliamentFixture('parliament-powergrid-vote', powerGridVote(2));
// …the same table with blue at the END of the Agenda track (step 12 = influence 5):
// P 3 + I 5 = 8 → +5, the maximum already — a win moves nothing, so the vote panel prints NO suffix.
parliamentFixture('parliament-powergrid-vote-cap', powerGridVote(12));

// ── RX04 — the sitting: RED's delegate wins Central Power Grid (Agenda 4 → 5 =
//    influence 3) from the middle slot and every seat is paid by its own power
//    tags and influence: red P 4 (one card worth two) + I 3 = 7 → +5 M€
//    production, capped (production 3 → 8); blue P 1 + I 0 → +1 (1 → 2). Red
//    is the VIEWER of the `done` fixture. ──
const powerGridTable = (stopAt: ParliamentStop, expect?: (table: ParliamentTable) => void): ParliamentFixtureSpec => ({
  resolution: CENTRAL_POWER_GRID_ID,
  slot: 1,
  votes: [1],
  agenda: [undefined, 4],
  stopAt,
  arrange: ({p1, p2}) => {
    p2.playedCards.push(new HE3FusionPlant(), new PowerPlant(), new GeothermalPower(), new Mine());
    p1.playedCards.push(new FusionPower(), new ArtificialPhotosynthesis());
    p2.production.override({megacredits: 3});
    p1.production.override({megacredits: 1});
  },
  expect,
});
parliamentFixture('parliament-powergrid-assembly', powerGridTable('pass'));
parliamentFixture('parliament-powergrid-adjourn', powerGridTable('close'));
parliamentFixture('parliament-powergrid-recap', powerGridTable('done', (table) => {
  const {parliament, p2} = table;
  const outcomes = parliament.lastPhase?.outcomes ?? [];
  const red = outcomes.find((o) => o.player === p2.id);
  if (parliament.enacted !== resolutionInstanceId(CENTRAL_POWER_GRID_ID, 0) || red?.kind !== 'production' || red.amount !== 5 || red.uncapped !== 7 || red.count !== 4) {
    throw new Error(`the parliament-powergrid-recap fixture expected red's capped +5 from P=4, got ${JSON.stringify(outcomes)}`);
  }
  if (JSON.stringify(red.countedUnits) !== JSON.stringify([2, 1, 1])) {
    throw new Error(`the parliament-powergrid-recap fixture expected the per-card contributions 2+1+1, got ${JSON.stringify(red.countedUnits)}`);
  }
  expectViewerOpensGeneration(table, p2, 'parliament-powergrid-recap');
}));

// ── RX08 · COLONIZATION FUNDING (Unity — «2 M€ production per SPACE CITY + 1 per influence, max 6»): the
//    first counter that reads the BOARD instead of the tableau. The vote: the card in the first voting slot
//    with blue's free delegate on it; blue at Agenda step 5 (influence 3) with TWO space cities — Ganymede
//    Colony and Phobos Space Haven, the base game's reserved areas — so 2 × 2 + 3 = 7 → +6, the maximum: the
//    panel reads ONE number with «max» and no win suffix (the next Agenda step is a TR step). Red: step 1
//    (influence 1), no space city → +1 by influence alone. The card's ONE e2e walks from this vote through
//    both passes into the sitting's reward stage. ──
const colonizationVote = (): ParliamentFixtureSpec => ({
  resolution: COLONIZATION_FUNDING_ID,
  votes: [0],
  agenda: [5, 1],
  stopAt: 'vote',
  arrange: ({p1, p2}) => {
    addCity(p1, SpaceName.GANYMEDE_COLONY);
    addCity(p1, SpaceName.PHOBOS_SPACE_HAVEN);
    p1.production.override({megacredits: 3});
    p2.production.override({megacredits: 1});
  },
  expect: ({p1, p2}) => {
    const count = resolutionCount(p1, 'spaceCities');
    if (count.count !== 2 || JSON.stringify(count.spaces) !== JSON.stringify([SpaceName.GANYMEDE_COLONY, SpaceName.PHOBOS_SPACE_HAVEN])) {
      throw new Error(`the parliament-colonization-vote fixture expected blue's two space cities, got ${JSON.stringify(count)}`);
    }
    if (resolutionCount(p2, 'spaceCities').count !== 0) {
      throw new Error('the parliament-colonization-vote fixture expected red without a space city');
    }
  },
});
parliamentFixture('parliament-colonization-vote', colonizationVote());

// ── RX21 · MIGRATION FUNDING (Mars First — «2 M€ per city on Mars + influence; each city in a stack counts
//    separately»): the first count paid by a QUANTITY the engine sums (the `tiers` measure). The vote: blue at
//    Agenda step 5 (influence 3) with THREE city cells on Mars, one of them a STACK of 2 — four cities →
//    (4 + 3) × 2 = 14: the panel reads «[city] 4 + [influence] 3 → +14» (no cap, no win suffix — the next step is a
//    TR step) and the fullscreen explains the four as «3 cells · a stack of 2». Red: step 1, one city → +4. The
//    card's ONE e2e walks from this vote through both passes into the sitting's reward stage. ──
/** A quiet city cell for `player` — no printed bonus, no tile or ocean beside it, not Noctis City — placed silently, outside any effect. */
function quietCity(game: IGame, player: TestPlayer): Space {
  const cell = game.board.getAvailableSpacesForCity(player).find((s) => s.bonus.length === 0 && s.id !== game.board.noctisCitySpaceId &&
    !game.board.getAdjacentSpaces(s).some((a) => a.tile !== undefined || a.spaceType === SpaceType.OCEAN));
  if (cell === undefined) {
    throw new Error(`no quiet city cell for ${player.color}`);
  }
  cell.tile = {tileType: TileType.CITY};
  cell.player = player;
  return cell;
}
parliamentFixture('parliament-migration-vote', {
  resolution: MIGRATION_FUNDING_ID,
  votes: [0],
  agenda: [5, 1],
  stopAt: 'vote',
  arrange: ({game, p1, p2}) => {
    quietCity(game, p1);
    quietCity(game, p1).stackHeight = 2;
    quietCity(game, p1);
    quietCity(game, p2);
  },
  expect: ({game, p1, p2}) => {
    const count = resolutionCount(p1, 'marsCityTiers');
    if (count.count !== 4 || count.spaces?.length !== 3 || JSON.stringify([...(count.tiers ?? [])].sort()) !== JSON.stringify([1, 1, 2])) {
      throw new Error(`the parliament-migration-vote fixture expected blue's four cities on three cells, got ${JSON.stringify(count)}`);
    }
    if (resolutionCount(p1, 'marsCities').count !== 3 || game.board.countCities(p1, 'onmars') !== 4) {
      throw new Error('the parliament-migration-vote fixture expected the destinations at 3 and the quantity at 4');
    }
    if (resolutionCount(p2, 'marsCityTiers').count !== 1) {
      throw new Error('the parliament-migration-vote fixture expected red with one city on Mars');
    }
  },
});

// ── RX13 · GENEROUS FUNDING (the Greens — «2 M€ per influence and per complete set of 5 TR over 15»): the first
//    counter that reads ONE PLAYER METRIC by threshold and step. The vote: the card in the first voting slot with
//    blue's free delegate on it; blue's rating is 24 — ONE complete set (nine over 15, four short of the second) —
//    at Agenda step 4 (influence 2): the panel reads «[TR] 24 → 1 set + [influence] 2 → +6» with the win suffix
//    «+2 · step 5» (an INFLUENCE step: the rating stands, the influence becomes 3 → +8 at the enactment). Red: TR 20
//    (one set) at step 1 (influence 1) → +4. The card's ONE e2e walks from this vote through both passes into the
//    sitting's reward stage: the +8 chip from the card's graphic onto the M€ cell of the rail. ──
const generousVote = (): ParliamentFixtureSpec => ({
  resolution: GENEROUS_FUNDING_ID,
  votes: [0],
  agenda: [4, 1],
  stopAt: 'vote',
  arrange: ({p1, p2}) => {
    p1.terraformRating = 24;
    p2.terraformRating = 20;
  },
  expect: ({p1, p2}) => {
    const count = resolutionCount(p1, 'terraformRatingSets');
    if (count.count !== 1 || count.metric?.value !== 24 || count.metric?.toNext !== 1) {
      throw new Error(`the parliament-generous-vote fixture expected blue at TR 24 = one set, one short of the next, got ${JSON.stringify(count)}`);
    }
    if (resolutionCount(p2, 'terraformRatingSets').count !== 1) {
      throw new Error('the parliament-generous-vote fixture expected red at TR 20 = one set');
    }
  },
});
parliamentFixture('parliament-generous-vote', generousVote());

// ── RX06 · CLOUD DEVELOPMENT (Unity — a VENUS game: the card exists only with Venus Next, and it is the
//    FOURTH party's first card). The card stands in the FIRST voting slot with blue's free delegate on it;
//    the generation-1 area is Unity / Mars First / the Industrialists, so the GREENS RULE BY THE STARTING
//    RULE AND HOLD NO CARD — the literal rule's window (rulebook p.8 / p.11): the support step pays them as
//    a party «not present on any card», and their plaque in the government keeps its sockets. Blue: Agenda
//    step 2 (influence 1; winning → step 3 = 2), Dirigibles (a Venus tag, holds floaters) + Jovian Lanterns
//    (a Jovian tag, holds floaters, 1 VP per 2 floaters — the STEPPED VP the rail reads per k):
//    N = 2 tags + 2 = 4 floaters over TWO holders → the shared DISTRIBUTION. Red: step 5 (influence 3),
//    Atmo Collectors alone (no tag) → N = 3 onto ONE holder → the family's ordinary pick. ──
const cloudTable = (stopAt: ParliamentStop, expect?: (table: ParliamentTable) => void): ParliamentFixtureSpec => ({
  options: {venusNextExtension: true, customCorporationsList: [...VENUS_TABLE_CORPORATIONS]},
  resolution: CLOUD_DEVELOPMENT_ID,
  votes: [0],
  agenda: [2, 5],
  stopAt,
  arrange: ({p1, p2, parliament}) => {
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 2, CENTRAL_POWER_GRID_ID);
    p1.playedCards.push(new Dirigibles(), new JovianLanterns());
    p2.playedCards.push(new AtmoCollectors());
  },
  expect: (table) => {
    const {parliament, p1, p2} = table;
    // Before the enactment the Greens rule by the starting rule and hold no card; past it, Unity rules BY THE CARD.
    const unityRules = stopAt === 'effects' || stopAt === 'close' || stopAt === 'done';
    if (unityRules ? parliament.rulingParty() !== PartyName.UNITY :
      (parliament.rulingParty() !== PartyName.GREENS || parliament.partiesInVotingArea().includes(PartyName.GREENS))) {
      throw new Error(`the parliament-cloud fixture (${stopAt}) expected ${unityRules ? 'Unity ruling by its card' : 'the Greens ruling by the starting rule with no card on the table'}, got ${parliament.rulingParty()}`);
    }
    const blue = resolutionCount(p1, 'venusJovianTags');
    const red = resolutionCount(p2, 'venusJovianTags');
    if (blue.count !== 2 || red.count !== 0) {
      throw new Error(`the parliament-cloud fixture expected blue's two tags and none for red (a corporation with a Venus/Jovian tag was dealt?), got ${blue.count} / ${red.count}`);
    }
    expect?.(table);
  },
});
// The vote: the face with its Venus dependency, the two-tag formula, blue's reading «2 tags + 1 → 3 (+1 if you win)».
parliamentFixture('parliament-cloud-vote', cloudTable('vote'));
// The sitting has just convened on a four-party table: the ASSEMBLY gate stands for both seats.
parliamentFixture('parliament-cloud-assembly', cloudTable('pass'));
// The political phase STOPPED INSIDE blue's LAYOUT: Cloud Development won with blue's delegate (Agenda 2 → 3 =
// influence 2), the phase asks BLUE to lay 4 floaters over Dirigibles and Jovian Lanterns; red's
// single-holder pick (3 floaters onto Atmo Collectors) follows.
parliamentFixture('parliament-cloud-enact', cloudTable('effects', ({p1}) => {
  const ask = p1.getWaitingFor();
  const meta = ask instanceof AndOptions ? ask.cardResourceDistributionPrompt : undefined;
  if (meta === undefined || meta.amount !== 4 || meta.cards.length !== 2) {
    throw new Error(`the parliament-cloud-enact fixture expected blue's 4-floater layout over two holders, got ${ask?.constructor.name} ${JSON.stringify(meta)}`);
  }
}));

// ── RX07 · COLONIAL AFFAIRS (Unity — «gain all your colony bonuses 2 times + 1/2 influence»): the first
//    resolution with a PLAN OF STEPS PER PLAYER and the first to host the hand's DISCARD as a step of the
//    sitting. The card stands in the first voting slot with blue's free delegate on it; the table is
//    ARRANGED (the dealt colonies are replaced): Luna (both seats — 2 M€ per cube), Titan (blue — a floater
//    onto a card; blue holds TWO holders, Atmo Collectors + Jovian Lanterns → the shared DISTRIBUTION),
//    Miranda (blue — its COLONY bonus is «draw 1 card»: ×k = ONE intake of k), Pluto (blue — «draw 1, then
//    discard 1» ×k: k PAIRS, the take and the hand's discard hosted by the sitting in turn). Blue: Agenda
//    step 4 (influence 2; winning → step 5 = influence 3 → k = 3): 6 M€ · 3 floaters · 3 cards · 3 pairs.
//    Red: Luna only, influence 0 → k = 2 → 4 M€ (a wave, no ask). Blue's hand is stocked so the discard
//    has an album to stand in. ──
const colonialTable = (stopAt: ParliamentStop, expect?: (table: ParliamentTable) => void): ParliamentFixtureSpec => ({
  resolution: COLONIAL_AFFAIRS_ID,
  votes: [0],
  agenda: [4, undefined],
  stopAt,
  arrange: ({game, p1, p2, parliament}) => {
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 2, CENTRAL_POWER_GRID_ID);
    const owned = (colony: IColony, owners: ReadonlyArray<TestPlayer>): IColony => {
      colony.isActive = true;
      colony.colonies = owners.map((p) => p.id);
      return colony;
    };
    game.colonies = [owned(new Luna(), [p1, p2]), owned(new Titan(), [p1]), owned(new Miranda(), [p1]), owned(new Pluto(), [p1])];
    p1.playedCards.push(new AtmoCollectors(), new JovianLanterns());
    p1.cardsInHand.push(new Insulation(), new SecurityFleet());
  },
  expect: (table) => {
    const {game, p1, p2} = table;
    const names = game.colonies.map((c) => c.name);
    if (JSON.stringify(names) !== JSON.stringify([ColonyName.LUNA, ColonyName.TITAN, ColonyName.MIRANDA, ColonyName.PLUTO])) {
      throw new Error(`the parliament-colonial fixture (${stopAt}) expected the four arranged tiles, got ${names.join(', ')}`);
    }
    const blueCubes = game.colonies.filter((c) => c.colonies.includes(p1.id)).length;
    const redCubes = game.colonies.filter((c) => c.colonies.includes(p2.id)).length;
    if (blueCubes !== 4 || redCubes !== 1) {
      throw new Error(`the parliament-colonial fixture (${stopAt}) expected blue on four tiles and red on Luna, got ${blueCubes} / ${redCubes}`);
    }
    if (p1.cardsInHand.length < 2) {
      throw new Error(`the parliament-colonial fixture (${stopAt}) expected blue to hold a hand for Pluto's discard, got ${p1.cardsInHand.length}`);
    }
    expect?.(table);
  },
});
// The vote: the face, the LEDGER in the vote panel (the multiplier by influence, a row per tile, «×4 if you win»).
parliamentFixture('parliament-colonial-vote', colonialTable('vote'));
// The sitting has just convened: the ASSEMBLY gate stands for both seats — the e2e walks the whole reward stage from here.
parliamentFixture('parliament-colonial-assembly', colonialTable('pass'));

// ── RX09 · COLONY CONTEST — the winner's FREE COLONY as the sitting's own step. Blue's delegate on the card, blue at
//    Agenda step 2 (the winner's step → 3 = influence 2: 2 titanium), red at step 1 (influence 1: 1 titanium). The
//    table: Luna (open, a quiet build bonus), TITAN (activated, open — the interactive bonus: 3 floaters onto one of
//    blue's TWO holders, Atmo Collectors / Jovian Lanterns → the recipient pick inside the colonies), EUROPA (open —
//    the build's ocean: the board chain), Callisto with red's cube. ──
const colonyContestTable = (stopAt: ParliamentStop): ParliamentFixtureSpec => ({
  resolution: COLONY_CONTEST_ID,
  votes: [0],
  agenda: [2, 1],
  stopAt,
  arrange: ({game, p1, p2}) => {
    const owned = (colony: IColony, owners: ReadonlyArray<TestPlayer>): IColony => {
      colony.isActive = true;
      colony.colonies = owners.map((p) => p.id);
      return colony;
    };
    game.colonies = [owned(new Luna(), []), owned(new Titan(), []), owned(new Europa(), []), owned(new Callisto(), [p2])];
    p1.playedCards.push(new AtmoCollectors(), new JovianLanterns());
  },
  expect: ({game, p1}) => {
    const names = game.colonies.map((c) => c.name);
    if (JSON.stringify(names) !== JSON.stringify([ColonyName.LUNA, ColonyName.TITAN, ColonyName.EUROPA, ColonyName.CALLISTO])) {
      throw new Error(`the parliament-colony fixture (${stopAt}) expected the four arranged tiles, got ${names.join(', ')}`);
    }
    if (game.colonies.some((c) => c.colonies.includes(p1.id))) {
      throw new Error(`the parliament-colony fixture (${stopAt}) expected blue on no tile yet`);
    }
    if (!p1.tableau.has(CardName.ATMO_COLLECTORS) || !p1.tableau.has(CardName.JOVIAN_LANTERNS)) {
      throw new Error(`the parliament-colony fixture (${stopAt}) expected two floater holders for Titan's recipient pick`);
    }
  },
});
parliamentFixture('parliament-colony-assembly', colonyContestTable('pass'));

// ── RX10 · DEVELOPMENT CRAZE (Mars First) — the first LIVE PASSIVE, ENACTED: the sitting is over, red (the seat
//    that opens generation 2 — the seat the loader opens) won it with the free delegate and holds 30 M€, enough for a
//    standard-project GREENERY on a cell with a printed bonus: the placement's bonuses are paid TWICE (the second
//    wave, the law's card, its inspector). A greenery, not a city — a city would also complete the card's own chairman
//    quest and draw Mars First's card. Blue at Agenda step 1, red at step 2 (a steel each at the enactment). ──
parliamentFixture('parliament-craze-enacted', {
  resolution: DEVELOPMENT_CRAZE_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  expect: (table) => {
    const {game, p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(DEVELOPMENT_CRAZE_ID, 0)) {
      throw new Error(`the parliament-craze-enacted fixture expected Development Craze enacted, got ${parliament.enacted}`);
    }
    if (p2.megaCredits < 23) {
      throw new Error(`the parliament-craze-enacted fixture expected red to afford a standard greenery, has ${p2.megaCredits} M€`);
    }
    const cell = game.board.getAvailableSpacesForGreenery(p2).find((s) => s.bonus.length > 0 && !game.board.getAdjacentSpaces(s).some((a) => a.tile !== undefined));
    if (cell === undefined) {
      throw new Error('the parliament-craze-enacted fixture expected a free greenery cell with a printed bonus and no tiled neighbour');
    }
    expectViewerOpensGeneration(table, p2, 'parliament-craze-enacted');
  },
});

// ── RX11 · FORESTRY SUPPORT (the Greens) — the law that INTRODUCES an adjacency bonus, ENACTED: the sitting is over,
//    red (the seat the loader opens) holds 30 M€ — a standard-project CITY (25) — and TWO of BLUE's greeneries stand
//    around one quiet legal cell: any owner's grove pays, exactly as any owner's ocean does. A city, not a greenery:
//    a greenery would also step the oxygen (a TR step the ruling Greens pay 2 M€ for) and advance the card's own
//    chairman quest — two other flows over the +4 M€ / +2 plants under test. The cell prints nothing and touches no
//    ocean, so the whole M€ movement past the price IS the law's. ──
parliamentFixture('parliament-forestry-enacted', {
  resolution: FORESTRY_SUPPORT_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  arrange: ({game, p1}) => {
    // A quiet LAND cell with two free land neighbours, itself printing nothing and touching no ocean/city.
    const quiet = (s: Space) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 0 &&
      game.board.getAdjacentSpaces(s).every((a) => a.tile === undefined);
    const cell = game.board.spaces.find((s) => quiet(s) &&
      game.board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.LAND && a.tile === undefined && a.bonus.length === 0).length >= 2);
    if (cell === undefined) {
      throw new Error('the parliament-forestry fixture found no quiet cell with two free land neighbours');
    }
    const groves = game.board.getAdjacentSpaces(cell)
      .filter((a) => a.spaceType === SpaceType.LAND && a.tile === undefined && a.bonus.length === 0).slice(0, 2);
    for (const grove of groves) {
      // `simpleAddTile`: the arrangement is the state the fixture declares, not a played placement.
      game.simpleAddTile(p1, grove, {tileType: TileType.GREENERY});
    }
  },
  expect: (table) => {
    const {game, p1, p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(FORESTRY_SUPPORT_ID, 0)) {
      throw new Error(`the parliament-forestry fixture expected Forestry Support enacted, got ${parliament.enacted}`);
    }
    if (p2.megaCredits < 25) {
      throw new Error(`the parliament-forestry fixture expected red to afford a standard city, has ${p2.megaCredits} M€`);
    }
    const target = game.board.getAvailableSpacesForCity(p2).find((s) => s.bonus.length === 0 &&
      game.board.getAdjacentSpaces(s).filter((a) => a.tile?.tileType === TileType.GREENERY).length === 2 &&
      game.board.getAdjacentSpaces(s).every((a) => a.tile === undefined || a.tile.tileType === TileType.GREENERY));
    if (target === undefined) {
      throw new Error('the parliament-forestry fixture expected a legal city cell with exactly two adjacent greeneries and nothing else around it');
    }
    if (game.board.greeneryAdjacencyBonus(target, {megacredits: 2, plants: 1}).megacredits !== 4) {
      throw new Error('the parliament-forestry fixture expected the two groves to pay 4 M€');
    }
    if (game.board.getAdjacentSpaces(target).some((a) => a.tile !== undefined && a.player !== p1)) {
      throw new Error('the parliament-forestry fixture expected BLUE to own both groves (any owner pays)');
    }
    expectViewerOpensGeneration(table, p2, 'parliament-forestry-enacted');
  },
});

// ── RX12 · GAS EXPORT (the Reds — «2 M€ per influence; oxygen −1, Venus +2, no TR for anybody»): the
//    first law that MOVES THE WORLD. A Venus table (the card exists nowhere else) with the card alone in
//    the first voting slot and blue's free delegate on it: blue at Agenda step 2 (winning → step 3 =
//    influence 2 → 4 M€), red at step 1 (influence 1 → 2 M€). The globals are SET where both moves have
//    room and neither crosses a Venus threshold: oxygen 5 %, Venus 10 % → 4 % / 14 %, so the e2e can read
//    the two markers travel and assert that not one TR chip flies for either.
const gasExportTable = (stopAt: ParliamentStop): ParliamentFixtureSpec => ({
  options: {venusNextExtension: true, customCorporationsList: [...VENUS_TABLE_CORPORATIONS]},
  resolution: GAS_EXPORT_ID,
  votes: [0],
  agenda: [2, 1],
  stopAt,
  arrange: ({game}) => {
    setOxygenLevel(game, 5);
    setVenusScaleLevel(game, 10);
  },
  expect: ({game, parliament}) => {
    if (game.getOxygenLevel() !== 5 || game.getVenusScaleLevel() !== 10) {
      throw new Error(`the parliament-gas fixture expected oxygen 5 % and Venus 10 %, got ${game.getOxygenLevel()} / ${game.getVenusScaleLevel()}`);
    }
    if (!parliament.slots.some((slot) => slot.instance.startsWith(GAS_EXPORT_ID))) {
      throw new Error('the parliament-gas fixture lost Gas Export out of the voting area');
    }
  },
});
// The sitting has just convened: the ASSEMBLY gate stands for both seats — the e2e walks the world beat from here.
parliamentFixture('parliament-gas-assembly', gasExportTable('pass'));

// ── RX29 · UNITY BUDGET (Unity — «lose 12 M€; M€ = Earth + Venus + Jovian tags + influence; every colony track +2»):
//    the FOURTH budget and the first law that moves the COLONY TABLE. The card alone in the first voting slot with
//    blue's free delegate on it: blue at Agenda step 2 (winning → step 3 = influence 2) with Luna Governor (2 Earth) +
//    Jovian Lanterns (1) → +5 after the levy of 12 (net −7); red at step 1 → +1. The TABLE is arranged so the wave shows
//    every case, and it is arranged BEFORE the generation ends: the generation's own step moves every active track +1
//    ahead of the sitting (`Colony.endGeneration`), so the arranged 1 · 3 · 4 · 6 stand at 2 · 4 · 5 · 6 when the law
//    reads them → 4 · 6 · 6 · 6: Luna two steps, Callisto two steps to the end, Ceres ONE honest step, Io at its
//    maximum (named, never moved). No cube on any tile: the track is the tile's.
const unityBudgetTable = (stopAt: ParliamentStop): ParliamentFixtureSpec => ({
  resolution: UNITY_BUDGET_ID,
  votes: [0],
  agenda: [2, 1],
  stopAt,
  arrange: ({game, p1}) => {
    const tile = (colony: IColony, track: number): IColony => {
      colony.isActive = true;
      colony.colonies = [];
      colony.trackPosition = track;
      return colony;
    };
    game.colonies = [tile(new Luna(), 1), tile(new Callisto(), 3), tile(new Ceres(), 4), tile(new Io(), 6)];
    p1.playedCards.push(new LunaGovernor(), new JovianLanterns());
  },
  expect: ({game, p1, parliament}) => {
    const positions = game.colonies.map((c) => `${c.name}:${c.trackPosition}`);
    // ONE PASS before the sitting the generation's own step has not run yet: the table stands as arranged.
    const expected = stopAt === 'pass' || stopAt === 'vote' ?
      [`${ColonyName.LUNA}:1`, `${ColonyName.CALLISTO}:3`, `${ColonyName.CERES}:4`, `${ColonyName.IO}:6`] :
      [`${ColonyName.LUNA}:2`, `${ColonyName.CALLISTO}:4`, `${ColonyName.CERES}:5`, `${ColonyName.IO}:6`];
    if (JSON.stringify(positions) !== JSON.stringify(expected)) {
      throw new Error(`the parliament-unity fixture (${stopAt}) expected the table at ${expected.join(', ')}, got ${positions.join(', ')}`);
    }
    if (!p1.tableau.has(CardName.LUNA_GOVERNOR) || !p1.tableau.has(CardName.JOVIAN_LANTERNS)) {
      throw new Error(`the parliament-unity fixture (${stopAt}) expected blue to hold Luna Governor and Jovian Lanterns`);
    }
    if (!parliament.slots.some((slot) => slot.instance.startsWith(UNITY_BUDGET_ID))) {
      throw new Error('the parliament-unity fixture lost Unity Budget out of the voting area');
    }
  },
});
// The sitting has just convened: the ASSEMBLY gate stands for both seats — the e2e walks the colony-table beat from here.
parliamentFixture('parliament-unity-assembly', unityBudgetTable('pass'));

// ── RX34 · GREENS BUDGET (the Greens — «lose 10 M€; M€ = plant + microbe + animal tags + influence; each player adds
//    2 animals to any card and 3 microbes to any card»): the FIFTH budget, and the first law that asks ONE seat TWO
//    questions in a row. The card alone in the first voting slot with blue's free delegate on it: blue at Agenda step 2
//    (influence 1; winning → step 3 = influence 2) holding Fish + Pets (two animal holders — the first pick is a real
//    choice), Tardigrades + GHG Producing Bacteria (two microbe holders — so is the second) and Trees (a plant tag that
//    holds nothing): animal 2 + microbe 2 + plant 1 = 5 → +7 after the levy of 10 (net −3); red at step 1 → +1, no
//    holder of either kind — both portions NAMED and forfeited, no question asked of it.
const greensBudgetTable = (stopAt: ParliamentStop): ParliamentFixtureSpec => ({
  resolution: GREENS_BUDGET_ID,
  votes: [0],
  agenda: [2, 1],
  stopAt,
  arrange: ({p1}) => {
    p1.playedCards.push(new Fish(), new Pets(), new Tardigrades(), new GHGProducingBacteria(), new Trees());
  },
  expect: ({p1, p2, parliament}) => {
    const count = resolutionCount(p1, 'plantMicrobeAnimalTags');
    if (count.count !== 5 || count.byTag?.map((entry) => entry.count).join(',') !== '1,2,2') {
      throw new Error(`the parliament-greens fixture (${stopAt}) expected blue at plant 1 · microbe 2 · animal 2 = 5, got ${JSON.stringify(count)}`);
    }
    if (p1.getResourceCards(CardResource.ANIMAL).length !== 2 || p1.getResourceCards(CardResource.MICROBE).length !== 2) {
      throw new Error(`the parliament-greens fixture (${stopAt}) expected blue to hold two animal holders and two microbe holders`);
    }
    if (p2.getResourceCards(CardResource.ANIMAL).length !== 0 || p2.getResourceCards(CardResource.MICROBE).length !== 0) {
      throw new Error(`the parliament-greens fixture (${stopAt}) expected red without a holder of either kind`);
    }
    if (!parliament.slots.some((slot) => slot.instance.startsWith(GREENS_BUDGET_ID))) {
      throw new Error('the parliament-greens fixture lost Greens Budget out of the voting area');
    }
  },
});
// The vote: the panel reads the net line, the three-tag breakdown and the two portions as rows of their own.
parliamentFixture('parliament-greens-vote', greensBudgetTable('vote'));
// The sitting has just convened: the ASSEMBLY gate stands for both seats — the e2e walks the two picks from here.
parliamentFixture('parliament-greens-assembly', greensBudgetTable('pass'));

// ── RX14 · HEAT CAPTURE (the Reds — «2 M€ per influence; temperature −2, nobody's TR; 3 M€ off a Building
//    tag while enacted»). Two moments of ONE journey:
//    · the ASSEMBLY — the card alone in the first voting slot with blue's free delegate on it (blue at Agenda
//      step 2 → influence 2 → 4 M€, red at step 1 → 2 M€), the temperature SET at −20 °C so the world step has
//      room and crosses no bonus threshold on the way down (−24 °C is the heat step, claimed on the way UP);
//    · ENACTED — the sitting is over, RED won it (the seat the loader opens in generation 2) and holds
//      «Nuclear Power» (10 M€, a Building tag) in hand: the play composer must read 10 → 7 with the law named.
// ── RX23 · MOHOLE CONTEST (the Greens — «3 heat per influence; the WINNER raises the temperature 2 steps»): the
//    first winner part that is a DIRECT STEP of a parameter, REWARDED (the winner's TR, the track's bonuses, the
//    0 °C ocean as the winner's own placement inside the sitting). The card alone in the first voting slot with
//    blue's free delegate on it (blue at Agenda step 2 → step 3 = influence 2 → 6 heat; red at step 1 → 3 heat),
//    the temperature SET at −4 °C so the winner's two steps reach 0 °C and the engine's ocean follows — the one
//    e2e walks the heat wave, the marker's glide with the TR chip, and the ocean placed without leaving the
//    sitting's flow. Oceans left: the fixture's default (none placed).
parliamentFixture('parliament-mohole-assembly', {
  resolution: MOHOLE_CONTEST_ID,
  votes: [0],
  agenda: [2, 1],
  stopAt: 'pass',
  arrange: ({game}) => {
    setTemperature(game, -4);
  },
  expect: ({game, parliament}) => {
    if (game.getTemperature() !== -4) {
      throw new Error(`the parliament-mohole fixture expected the temperature at −4 °C, got ${game.getTemperature()}`);
    }
    if (game.board.getOceanSpaces().length !== 0) {
      throw new Error('the parliament-mohole fixture expected no ocean on Mars yet');
    }
    if (!parliament.slots.some((slot) => slot.instance.startsWith(MOHOLE_CONTEST_ID))) {
      throw new Error('the parliament-mohole fixture lost Mohole Contest out of the voting area');
    }
  },
});

parliamentFixture('parliament-heat-assembly', {
  resolution: HEAT_CAPTURE_ID,
  votes: [0],
  agenda: [2, 1],
  stopAt: 'pass',
  arrange: ({game}) => {
    setTemperature(game, -20);
  },
  expect: ({game, parliament}) => {
    if (game.getTemperature() !== -20) {
      throw new Error(`the parliament-heat fixture expected the temperature at −20 °C, got ${game.getTemperature()}`);
    }
    if (!parliament.slots.some((slot) => slot.instance.startsWith(HEAT_CAPTURE_ID))) {
      throw new Error('the parliament-heat fixture lost Heat Capture out of the voting area');
    }
  },
});
parliamentFixture('parliament-heat-enacted', {
  resolution: HEAT_CAPTURE_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  arrange: ({game, p2}) => {
    setTemperature(game, -20);
    // The card the discount is read on: printed 10, a Building tag, no requirement, no question of its own.
    p2.cardsInHand.push(new NuclearPower());
  },
  expect: (table) => {
    const {p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(HEAT_CAPTURE_ID, 0)) {
      throw new Error(`the parliament-heat-enacted fixture expected Heat Capture enacted, got ${parliament.enacted}`);
    }
    if (!p2.cardsInHand.some((c) => c.name === CardName.NUCLEAR_POWER)) {
      throw new Error('the parliament-heat-enacted fixture expected red to hold Nuclear Power');
    }
    if (p2.megaCredits < 10) {
      throw new Error(`the parliament-heat-enacted fixture expected red to afford Nuclear Power even at its printed price, has ${p2.megaCredits} M€`);
    }
    if (p2.getCardCost(new NuclearPower()) !== 7) {
      throw new Error(`the parliament-heat-enacted fixture expected the law to price Nuclear Power at 7, got ${p2.getCardCost(new NuclearPower())}`);
    }
    expectViewerOpensGeneration(table, p2, 'parliament-heat-enacted');
  },
});

// ── RX35 · DIVERTED RESEARCH (the Reds — «1 data per influence; while enacted, every step of oxygen / temperature and
//    every greenery / ocean tile you would gain becomes 1 data») — ENACTED: the sitting is over, RED won it (the seat
//    the loader opens in generation 2) with 30 M€ and 8 heat, «Supercomputer» (a data holder) on its table, oxygen at
//    13 %: the heat conversion's mini-stage asks WHERE the data goes and the temperature never moves; the Asteroid
//    project reads «→ 1 [data]» and asks no cell. ──
parliamentFixture('parliament-diverted-enacted', {
  resolution: DIVERTED_RESEARCH_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  arrange: ({game, p2}) => {
    setOxygenLevel(game, 13);
    setTemperature(game, -20);
    p2.heat = 8;
    p2.playedCards.push(new Supercomputer());
    // The spec spends TWO of red's actions (the heat conversion, then the asteroid): a corporation's pending first
    // action (Aridor's colony tile) standing at boot would be answered by the board-home driver and cost the first.
    p2.pendingInitialActions = [];
  },
  expect: (table) => {
    const {game, p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(DIVERTED_RESEARCH_ID, 0)) {
      throw new Error(`the parliament-diverted-enacted fixture expected Diverted Research enacted, got ${parliament.enacted}`);
    }
    if (p2.pendingInitialActions.length > 0 || p2.actionsTakenThisRound !== 0) {
      throw new Error('the parliament-diverted-enacted fixture expected red to open generation 2 with both actions and no pending first action');
    }
    if (p2.playedCards.get(CardName.SUPERCOMPUTER) === undefined) {
      throw new Error('the parliament-diverted-enacted fixture expected red to hold Supercomputer on its table');
    }
    if (p2.heat < 8) {
      throw new Error(`the parliament-diverted-enacted fixture expected red to afford a heat conversion, has ${p2.heat} heat`);
    }
    if (p2.megaCredits < 14) {
      throw new Error(`the parliament-diverted-enacted fixture expected red to afford an asteroid, has ${p2.megaCredits} M€`);
    }
    if (game.getOxygenLevel() !== 13 || game.getTemperature() !== -20) {
      throw new Error(`the parliament-diverted-enacted fixture expected oxygen 13 % / −20 °C, got ${game.getOxygenLevel()} / ${game.getTemperature()}`);
    }
    expectViewerOpensGeneration(table, p2, 'parliament-diverted-enacted');
  },
});

// ── RX36 · LIVE EXPERIMENTS (the Scientists — «data by influence; ACTION: pay 6 M€ to play a card ignoring all global
//    parameter requirements»). ENACTED: red (the winner — the seat the loader opens in generation 2) at −30 °C with
//    20 M€ and three cards in hand, one per answer the law's pick gives:
//      · Grass (11 M€, «−16 °C or warmer») — the card the law OPENS (its global requirement waived — «благодаря закону»);
//      · Adapted Lichen (9 M€, no requirement) — playable anyway;
//      · Martian Media Center (Mars First's plate) — a PARTY requirement the law never waives: refused, with its reason.
//    20 − 6 = 14 left for the card, so every bill the stage can show is affordable; no data holder (the enactment's
//    share is named and forfeited — the data step asks nothing).
parliamentFixture('parliament-live-enacted', {
  resolution: LIVE_EXPERIMENTS_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  arrange: ({game, p2}) => {
    setTemperature(game, -30);
    p2.cardsInHand.push(new Grass(), new AdaptedLichen(), new MartianMediaCenter());
    // The spec spends red's action through the law: a corporation's pending first action standing at boot would be
    // answered by the board-home driver and cost it (PL-715).
    p2.pendingInitialActions = [];
  },
  after: ({p2}) => {
    p2.megaCredits = 20;
  },
  expect: (table) => {
    const {game, p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(LIVE_EXPERIMENTS_ID, 0)) {
      throw new Error(`the parliament-live-enacted fixture expected Live Experiments enacted, got ${parliament.enacted}`);
    }
    if (p2.pendingInitialActions.length > 0 || p2.actionsTakenThisRound !== 0) {
      throw new Error('the parliament-live-enacted fixture expected red to open generation 2 with both actions and no pending first action');
    }
    if (game.getTemperature() !== -30) {
      throw new Error(`the parliament-live-enacted fixture expected −30 °C, got ${game.getTemperature()}`);
    }
    for (const name of [CardName.GRASS, CardName.ADAPTED_LICHEN, CardName.MARTIAN_MEDIA_CENTER]) {
      if (!p2.cardsInHand.some((c) => c.name === name)) {
        throw new Error(`the parliament-live-enacted fixture expected red to hold ${name}`);
      }
    }
    if (p2.megaCredits !== 20) {
      throw new Error(`the parliament-live-enacted fixture expected red with 20 M€, has ${p2.megaCredits}`);
    }
    expectViewerOpensGeneration(table, p2, 'parliament-live-enacted');
  },
});

// ── …and THE BILL THAT ASKS (PL-727): the same table, but red pays like Helion (heat counts as M€, 5 heat in stock) —
//    the law's bill is a PAYMENT of its own, so nothing is pre-collectable: the stage reads its price and confirms,
//    the bill stands INSIDE the stage, and the card is asked LIVE after it — the hand album hosted in the same stage.
parliamentFixture('parliament-live-helion', {
  resolution: LIVE_EXPERIMENTS_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  arrange: ({game, p2}) => {
    setTemperature(game, -30);
    p2.cardsInHand.push(new Grass(), new AdaptedLichen(), new MartianMediaCenter());
    p2.pendingInitialActions = [];
  },
  after: ({p2}) => {
    p2.megaCredits = 20;
    p2.heat = 5;
    p2.canUseHeatAsMegaCredits = true;
  },
  expect: (table) => {
    const {game, p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(LIVE_EXPERIMENTS_ID, 0)) {
      throw new Error(`the parliament-live-helion fixture expected Live Experiments enacted, got ${parliament.enacted}`);
    }
    if (p2.pendingInitialActions.length > 0 || p2.actionsTakenThisRound !== 0) {
      throw new Error('the parliament-live-helion fixture expected red to open generation 2 with both actions and no pending first action');
    }
    if (game.getTemperature() !== -30 || !p2.canUseHeatAsMegaCredits || p2.heat !== 5 || p2.megaCredits !== 20) {
      throw new Error(`the parliament-live-helion fixture expected −30 °C, Helion's heat (5) and 20 M€ — got ${game.getTemperature()} °C, ${p2.heat} heat, ${p2.megaCredits} M€`);
    }
    for (const name of [CardName.GRASS, CardName.ADAPTED_LICHEN, CardName.MARTIAN_MEDIA_CENTER]) {
      if (!p2.cardsInHand.some((c) => c.name === name)) {
        throw new Error(`the parliament-live-helion fixture expected red to hold ${name}`);
      }
    }
    expectViewerOpensGeneration(table, p2, 'parliament-live-helion');
  },
});

// ── …and THE LAW'S PLAY KEEPS EVERY REVERSIBLE DOOR (the design rule of 2026-10-20): the same table, red holding a card
//    whose cell is the play's last reversible step (Mangrove — «+4 °C or warmer», opened by the law at −30 °C; its
//    greenery on an ocean area is a STAGED cell) and one whose delegate is (Political Donation — the staged vote).
//    40 M€: the law's 6 + either card, twice over (a B round trip sends nothing).
parliamentFixture('parliament-live-staged', {
  resolution: LIVE_EXPERIMENTS_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  arrange: ({game, p2}) => {
    setTemperature(game, -30);
    p2.cardsInHand.push(new Mangrove(), new PoliticalDonation());
    p2.pendingInitialActions = [];
  },
  after: ({p2}) => {
    p2.megaCredits = 40;
  },
  expect: (table) => {
    const {game, p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(LIVE_EXPERIMENTS_ID, 0)) {
      throw new Error(`the parliament-live-staged fixture expected Live Experiments enacted, got ${parliament.enacted}`);
    }
    if (p2.pendingInitialActions.length > 0 || p2.actionsTakenThisRound !== 0) {
      throw new Error('the parliament-live-staged fixture expected red to open generation 2 with both actions and no pending first action');
    }
    if (game.getTemperature() !== -30 || p2.megaCredits !== 40) {
      throw new Error(`the parliament-live-staged fixture expected −30 °C and 40 M€ — got ${game.getTemperature()} °C, ${p2.megaCredits} M€`);
    }
    for (const name of [CardName.MANGROVE, CardName.POLITICAL_DONATION]) {
      if (!p2.cardsInHand.some((c) => c.name === name)) {
        throw new Error(`the parliament-live-staged fixture expected red to hold ${name}`);
      }
    }
    expectViewerOpensGeneration(table, p2, 'parliament-live-staged');
  },
});

// ── …and the same door on THE BILL THAT ASKS (Helion's heat): the card is asked LIVE after the bill, in the hand
//    hosted by the law's stage — Mangrove's cell still a reversible door there (B back to the live composer).
parliamentFixture('parliament-live-helion-staged', {
  resolution: LIVE_EXPERIMENTS_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  arrange: ({game, p2}) => {
    setTemperature(game, -30);
    p2.cardsInHand.push(new Mangrove(), new Grass());
    p2.pendingInitialActions = [];
  },
  after: ({p2}) => {
    p2.megaCredits = 20;
    p2.heat = 5;
    p2.canUseHeatAsMegaCredits = true;
  },
  expect: (table) => {
    const {game, p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(LIVE_EXPERIMENTS_ID, 0)) {
      throw new Error(`the parliament-live-helion-staged fixture expected Live Experiments enacted, got ${parliament.enacted}`);
    }
    if (p2.pendingInitialActions.length > 0 || p2.actionsTakenThisRound !== 0) {
      throw new Error('the parliament-live-helion-staged fixture expected red to open generation 2 with both actions and no pending first action');
    }
    if (game.getTemperature() !== -30 || !p2.canUseHeatAsMegaCredits || p2.heat !== 5 || p2.megaCredits !== 20) {
      throw new Error(`the parliament-live-helion-staged fixture expected −30 °C, Helion's heat (5) and 20 M€ — got ${game.getTemperature()} °C, ${p2.heat} heat, ${p2.megaCredits} M€`);
    }
    if (!p2.cardsInHand.some((c) => c.name === CardName.MANGROVE)) {
      throw new Error('the parliament-live-helion-staged fixture expected red to hold Mangrove');
    }
    expectViewerOpensGeneration(table, p2, 'parliament-live-helion-staged');
  },
});

// ── RX37 · MANUFACTURING RUN (the Industrialists — «add 2 floaters OR 1 fighter OR 1 mech to one of your cards; twice a
//    generation, 3 times at influence 2+»). The law ENACTED: red won the sitting from Agenda 0, so it opens generation 2
//    at influence 1 — TWO uses, the third one influence away. Red holds a holder of EACH kind — Security Fleet (fighter,
//    1 VP each), Construction Mechs (mech), Titan Shuttles (floater, 1 VP) — so the law's stage reads three variants and
//    every target row is a real reading; no pending first action (the spec spends both of red's actions on the law).
parliamentFixture('parliament-manufacturing-enacted', {
  resolution: MANUFACTURING_RUN_ID,
  votes: [1],
  agenda: [1, 0],
  stopAt: 'done',
  arrange: ({p2}) => {
    p2.playedCards.push(new SecurityFleet(), new ConstructionMechs(), new TitanShuttles());
    p2.pendingInitialActions = [];
  },
  expect: (table) => {
    const {p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(MANUFACTURING_RUN_ID, 0)) {
      throw new Error(`the parliament-manufacturing-enacted fixture expected Manufacturing Run enacted, got ${parliament.enacted}`);
    }
    if (parliament.influence(p2) !== 1 || parliament.resolutionActionUsesLeft(p2) !== 2) {
      throw new Error(`the parliament-manufacturing-enacted fixture expected red at influence 1 with 2 uses, got ${parliament.influence(p2)} / ${parliament.resolutionActionUsesLeft(p2)}`);
    }
    if (p2.pendingInitialActions.length > 0 || p2.actionsTakenThisRound !== 0) {
      throw new Error('the parliament-manufacturing-enacted fixture expected red to open generation 2 with both actions and no pending first action');
    }
    for (const name of [CardName.SECURITY_FLEET, CardName.CONSTRUCTION_MECHS, CardName.TITAN_SHUTTLES]) {
      if (p2.playedCards.get(name)?.resourceCount !== 0) {
        throw new Error(`the parliament-manufacturing-enacted fixture expected red to hold an empty ${name}`);
      }
    }
    expectViewerOpensGeneration(table, p2, 'parliament-manufacturing-enacted');
  },
});

// ── RX33 · WATER EXPORT (the Reds — «2 M€ per influence; the FIRST PLAYER removes 1 ocean tile from the board;
//    3 M€ off an Earth / Venus / Jovian tag while enacted»). The first world step that ASKS. Two moments of ONE journey:
//    · the ASSEMBLY — the card alone in the first voting slot with blue's free delegate on it (blue at Agenda step 2
//      → influence 2 → 4 M€, red at step 1 → 2 M€), ONE ocean of red's on the board (a plain one, on a cell with a
//      bonus — the bonus stays paid); BLUE is the first player of the generation, so the removal is BLUE's question
//      and RED watches the tile leave over the poll;
//    · ENACTED — the sitting is over (the fixture answered blue's pick itself, the ocean is gone), RED won it (the
//      seat the loader opens in generation 2) and holds «Miranda Resort» (12 M€, a Jovian tag) in hand: the play
//      composer must read 12 → 9 with the law named.
parliamentFixture('parliament-water-assembly', {
  resolution: WATER_EXPORT_ID,
  votes: [0],
  agenda: [2, 1],
  stopAt: 'pass',
  arrange: ({p2}) => {
    addOcean(p2);
  },
  expect: ({game, p1, parliament}) => {
    if (game.board.getOceanSpaces().length !== 1 || game.board.getOceanSpaces({upgradedOceans: false}).length !== 1) {
      throw new Error(`the parliament-water fixture expected exactly one plain ocean on the board, got ${game.board.getOceanSpaces().length}`);
    }
    if (game.playersInGenerationOrder[0].id !== p1.id) {
      throw new Error('the parliament-water fixture expected BLUE to be the first player — the seat the printed rule names');
    }
    if (!parliament.slots.some((slot) => slot.instance.startsWith(WATER_EXPORT_ID))) {
      throw new Error('the parliament-water fixture lost Water Export out of the voting area');
    }
  },
});
parliamentFixture('parliament-water-enacted', {
  resolution: WATER_EXPORT_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  arrange: ({p2}) => {
    addOcean(p2);
    // The card the discount is read on: printed 12, a Jovian tag, no requirement, no question of its own.
    p2.cardsInHand.push(new MirandaResort());
  },
  expect: (table) => {
    const {game, p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(WATER_EXPORT_ID, 0)) {
      throw new Error(`the parliament-water-enacted fixture expected Water Export enacted, got ${parliament.enacted}`);
    }
    if (game.board.getOceanSpaces().length !== 0) {
      throw new Error('the parliament-water-enacted fixture expected the ocean to be gone (the fixture answers the first player\'s pick)');
    }
    if (!p2.cardsInHand.some((c) => c.name === CardName.MIRANDA_RESORT)) {
      throw new Error('the parliament-water-enacted fixture expected red to hold Miranda Resort');
    }
    if (p2.megaCredits < 12) {
      throw new Error(`the parliament-water-enacted fixture expected red to afford Miranda Resort even at its printed price, has ${p2.megaCredits} M€`);
    }
    if (p2.getCardCost(new MirandaResort()) !== 9) {
      throw new Error(`the parliament-water-enacted fixture expected the law to price Miranda Resort at 9, got ${p2.getCardCost(new MirandaResort())}`);
    }
    expectViewerOpensGeneration(table, p2, 'parliament-water-enacted');
  },
});

// ── RX24 · OPEN IP TRADE (the Scientists — the first resolution with an ACTION: «discard any number of cards; for
//    each, gain 3 M€ and draw a card»): the law ENACTED (red's delegate won the sitting; its cards by influence were
//    taken), generation 2 open on RED — the seat the loader opens — holding the action menu with a hand to pick from
//    (the start's own cards, three arranged, the enactment's draw): the action's tile stands in «Действия карт», its
//    pick on the real hand, the sale, the draw. ──
parliamentFixture('parliament-openip-enacted', {
  resolution: OPEN_IP_TRADE_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  arrange: ({p2}) => {
    p2.cardsInHand.push(new Trees(), new Fish(), new AdaptedLichen());
  },
  expect: (table) => {
    const {p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(OPEN_IP_TRADE_ID, 0)) {
      throw new Error(`the parliament-openip-enacted fixture expected Open IP Trade enacted, got ${parliament.enacted}`);
    }
    // The start flow's own hand + the three arranged + the enactment's draw: at least four to pick from.
    if (p2.cardsInHand.length < 4) {
      throw new Error(`the parliament-openip-enacted fixture expected red to hold at least 4 cards, holds ${p2.cardsInHand.length}`);
    }
    if (parliament.resolutionActionUsesLeft(p2) !== 1) {
      throw new Error('the parliament-openip-enacted fixture expected the action unspent');
    }
    expectViewerOpensGeneration(table, p2, 'parliament-openip-enacted');
  },
});

// ── RX28 · TRADE INDUSTRIES (Unity — the first PAID action: «pay 12 M€ to gain an extra trade fleet; titanium
//    accepted, 2 M€ off per influence»): the law ENACTED (red's delegate won the sitting), generation 2 open on RED —
//    the seat the loader opens — at influence 2 (the price reads 12 − 4 = 8), with titanium in the supply so the bill
//    offers the lane, one fleet, and the action unspent. ──
parliamentFixture('parliament-tradeind-enacted', {
  resolution: TRADE_INDUSTRIES_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  arrange: ({p2}) => {
    p2.titanium = 2;
  },
  expect: (table) => {
    const {p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(TRADE_INDUSTRIES_ID, 0)) {
      throw new Error(`the parliament-tradeind-enacted fixture expected Trade Industries enacted, got ${parliament.enacted}`);
    }
    const price = tradeIndustriesPrice(p2);
    if (price.price !== 8 || price.influence !== 2) {
      throw new Error(`the parliament-tradeind-enacted fixture expected red to pay 8 at influence 2, got ${JSON.stringify(price)}`);
    }
    if (p2.titanium < 1) {
      throw new Error('the parliament-tradeind-enacted fixture expected red to hold titanium (the bill must offer the lane)');
    }
    if (p2.colonies.getFleetSize() !== 1) {
      throw new Error(`the parliament-tradeind-enacted fixture expected one fleet, got ${p2.colonies.getFleetSize()}`);
    }
    if (parliament.resolutionActionUsesLeft(p2) !== 1) {
      throw new Error('the parliament-tradeind-enacted fixture expected the law action unspent');
    }
    if (!p2.canAfford({cost: price.price, titanium: true})) {
      throw new Error('the parliament-tradeind-enacted fixture expected red to afford the fleet');
    }
    expectViewerOpensGeneration(table, p2, 'parliament-tradeind-enacted');
  },
});

// ── RX30 · URBAN DEVELOPMENT (Mars First — the first law that answers A CARD BEING PLAYED: «after you play a
//    Building tag, draw a card»): the law ENACTED (red's delegate won the sitting), generation 2 open on RED — the
//    seat the loader opens — holding a MINE in hand: 4 M€, a Building tag, a production step and no question of its
//    own, so the whole card play is the law's answer and nothing else. ──
parliamentFixture('parliament-urban-enacted', {
  resolution: URBAN_DEVELOPMENT_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  arrange: ({p2}) => {
    p2.cardsInHand.push(new Mine());
  },
  expect: (table) => {
    const {p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(URBAN_DEVELOPMENT_ID, 0)) {
      throw new Error(`the parliament-urban-enacted fixture expected Urban Development enacted, got ${parliament.enacted}`);
    }
    if (!p2.cardsInHand.some((c) => c.name === CardName.MINE)) {
      throw new Error('the parliament-urban-enacted fixture expected red to hold the Mine');
    }
    if (p2.megaCredits < p2.getCardCost(new Mine())) {
      throw new Error(`the parliament-urban-enacted fixture expected red to afford the Mine, has ${p2.megaCredits} M€`);
    }
    if (urbanDevelopmentCards(p2, new Mine()) !== 1) {
      throw new Error('the parliament-urban-enacted fixture expected the Mine to be worth exactly one card');
    }
    expectViewerOpensGeneration(table, p2, 'parliament-urban-enacted');
  },
});

// ── RX26 · R&D FUNDING (the Scientists — the first law with NO enactment: «when taking actions you have
//    additional Science tags equal to your Influence» + «use an action on one of your cards a second time»):
//    the law ENACTED (red's delegate won the sitting), generation 2 open on RED — the seat the loader opens —
//    at influence 2, so the МЕТКИ zone reads the printed science count with a «+2» beside it and names the law;
//    and red's Tardigrades already carries a microbe from an action spent THIS generation, so the law's action
//    has exactly one honest candidate to repeat. ──
parliamentFixture('parliament-rdfunding-enacted', {
  resolution: RD_FUNDING_ID,
  votes: [1],
  agenda: [1, 3],
  stopAt: 'done',
  arrange: ({p2}) => {
    // Two printed science tags, so the zone shows a real count for the addition to stand beside.
    p2.playedCards.push(new Research());
  },
  after: ({game, p2}) => {
    // The repeat's candidate: an action USED in the generation that is now open
    // (the boundary the sitting just crossed is what cleared the previous one).
    const tardigrades = new Tardigrades();
    p2.playedCards.push(tardigrades);
    tardigrades.action(p2);
    runAllActions(game);
    p2.actionsThisGeneration.add(tardigrades.name);
  },
  expect: (table) => {
    const {p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(RD_FUNDING_ID, 0)) {
      throw new Error(`the parliament-rdfunding-enacted fixture expected R&D Funding enacted, got ${parliament.enacted}`);
    }
    const influence = parliament.influence(p2);
    if (influence < 1) {
      throw new Error(`the parliament-rdfunding-enacted fixture expected red to hold influence, has ${influence}`);
    }
    if (ParliamentHandler.tagBonus(p2, Tag.SCIENCE) !== influence) {
      throw new Error('the parliament-rdfunding-enacted fixture expected the science addition to equal the influence');
    }
    if (p2.tags.count(Tag.SCIENCE, 'raw') < 1) {
      throw new Error('the parliament-rdfunding-enacted fixture expected red to hold a PRINTED science tag too');
    }
    if (repeatableActionCards(p2).length !== 1) {
      throw new Error(`the parliament-rdfunding-enacted fixture expected exactly one action to repeat, got ${repeatableActionCards(p2).length}`);
    }
    if (parliament.resolutionActionUsesLeft(p2) !== 1) {
      throw new Error('the parliament-rdfunding-enacted fixture expected the law action unspent');
    }
    expectViewerOpensGeneration(table, p2, 'parliament-rdfunding-enacted');
  },
});

// ── RX15 · INDUSTRIALIST BUDGET (the Industrialists — the first BUDGET: «lose 10 M€; gain 1 M€ per step of
//    steel + titanium + energy production + influence; +4 M€ production»). Two moments of ONE journey, on one
//    table: blue's track is steel 2 · titanium 1 · energy 2 (5 steps) at Agenda step 4 (influence 2), red's is
//    empty at step 1.
//    · the VOTE — the card in the first voting slot with blue's free delegate on it: the panel reads the LEVY
//      first, «−10 → [steel] 2 + [titanium] 1 + [energy] 2 + [influence] 2 → +7 = −3», the win suffix «+1 · step
//      5» (an influence step), the flat «+4 M€ production» with its horizon; the fullscreen prints the levy row
//      and the breakdown by resource;
//    · the ASSEMBLY — RED's delegate wins (blue keeps influence 2, so the sitting pays blue exactly the vote's
//      numbers: −10, then +7, then +4 production — net −3), every seat passed, the assembly gate standing for
//      both. The production phase has paid the income before the sitting: blue holds 40 + 20 = 60 M€ at the levy.
function budgetTable(stopAt: 'vote' | 'pass'): ParliamentFixtureSpec {
  return {
    resolution: INDUSTRIALIST_BUDGET_ID,
    votes: [stopAt === 'vote' ? 0 : 1],
    agenda: [4, 1],
    stopAt,
    arrange: ({p1}) => {
      p1.production.add(Resource.STEEL, 2);
      p1.production.add(Resource.TITANIUM, 1);
      p1.production.add(Resource.ENERGY, 2);
    },
    expect: ({p1, p2, parliament}) => {
      const count = resolutionCount(p1, 'steelTitaniumEnergyProduction');
      if (count.count !== 5 || count.byResource?.map((entry) => entry.count).join(',') !== '2,1,2') {
        throw new Error(`the parliament-budget fixture expected blue at steel 2 · titanium 1 · energy 2 = 5 steps, got ${JSON.stringify(count)}`);
      }
      if (resolutionCount(p2, 'steelTitaniumEnergyProduction').count !== 0) {
        throw new Error('the parliament-budget fixture expected red without production steps');
      }
      if (p1.megaCredits < 10) {
        throw new Error(`the parliament-budget fixture expected blue to afford the whole levy, has ${p1.megaCredits} M€`);
      }
      if (!parliament.slots.some((slot) => slot.instance.startsWith(INDUSTRIALIST_BUDGET_ID))) {
        throw new Error('the parliament-budget fixture lost Industrialist Budget out of the voting area');
      }
    },
  };
}
parliamentFixture('parliament-budget-vote', budgetTable('vote'));
parliamentFixture('parliament-budget-assembly', budgetTable('pass'));
// …and the SAME vote at a FULL table — SIX seats, the worst case of the LEDGER OF OUTCOMES (the row of
// chips under the reading: six seats × two parts each, the levy netted into the first). Every seat is
// genuinely different, so the row has something to compare: Agenda steps 4 · 1 · 6 · 2 · 8 · 3 and
// production tracks from five steps down to none. One seat holds 4 M€ — less than the levy owes — so its
// chip reads the honest shortfall's net, and the panel's own warning has a seat to speak for.
parliamentFixture('parliament-budget-vote-six', {
  ...budgetTable('vote'),
  players: 6,
  agenda: [4, 1, 6, 2, 8, 3],
  megacredits: [40, 30, 25, 18, 12, 4],
  arrange: ({seats}) => {
    const [blue, , yellow, green, black] = seats;
    blue.production.add(Resource.STEEL, 2);
    blue.production.add(Resource.TITANIUM, 1);
    blue.production.add(Resource.ENERGY, 2);
    yellow.production.add(Resource.ENERGY, 3);
    green.production.add(Resource.STEEL, 1);
    black.production.add(Resource.TITANIUM, 2);
    black.production.add(Resource.ENERGY, 1);
  },
  expect: ({seats, parliament}) => {
    if (seats.length !== 6) {
      throw new Error(`the parliament-budget-vote-six fixture expected six seats, got ${seats.length}`);
    }
    const steps = seats.map((player) => resolutionCount(player, 'steelTitaniumEnergyProduction').count);
    if (new Set(steps).size < 4) {
      throw new Error(`the six-seat budget fixture needs seats that read DIFFERENTLY, got steps ${steps.join(',')}`);
    }
    if (!parliament.slots.some((slot) => slot.instance.startsWith(INDUSTRIALIST_BUDGET_ID))) {
      throw new Error('the six-seat budget fixture lost Industrialist Budget out of the voting area');
    }
  },
});

// ── RX27 · SCIENTISTS BUDGET (the SECOND budget — «−10 M€; 1 M€ per science tag + influence; each player draws 2»):
//    the card in the FIRST voting slot. Blue: Agenda step 4 (influence 2; winning → step 5 = 3), 40 M€, and a
//    tableau that makes the TAG rule read — Research prints TWO science tags, GHG Producing Bacteria one, Nobel
//    Prize a WILD tag that is none at an enactment: 3 tags. Red: Agenda step 1 (influence 1), no science tag.
//    Two moments:
//    · the VOTE — the panel prints the LEVY at the head of the M€ plate, «−10 → [science] 3 + [influence] 2
//      → +5 = −5» with the win suffix «+1 · step 5», and the 2 CARDS as a row of their own («the same for
//      every player» — no forecast, no influence cluster, never added to the money);
//    · the ASSEMBLY — RED's delegate wins (blue keeps influence 2, so the sitting pays blue exactly the vote's
//      numbers: −10, then +5, then the two cards to take), every seat passed, the assembly gate standing for both.
function scientistsBudgetTable(stopAt: 'vote' | 'pass'): ParliamentFixtureSpec {
  return {
    resolution: SCIENTISTS_BUDGET_ID,
    votes: [stopAt === 'vote' ? 0 : 1],
    agenda: [4, 1],
    stopAt,
    arrange: ({p1}) => {
      p1.playedCards.push(new Research(), new GHGProducingBacteria(), new NobelPrize());
    },
    expect: ({p1, p2, parliament}) => {
      const count = resolutionCount(p1, 'scienceTags');
      if (count.count !== 3 || count.cards.length !== 2) {
        throw new Error(`the parliament-scibudget fixture expected blue at 3 printed science tags from 2 cards, got ${JSON.stringify(count)}`);
      }
      if (resolutionCount(p2, 'scienceTags').count !== 0) {
        throw new Error('the parliament-scibudget fixture expected red without a science tag');
      }
      if (p1.megaCredits < 10) {
        throw new Error(`the parliament-scibudget fixture expected blue to afford the whole levy, has ${p1.megaCredits} M€`);
      }
      if (!parliament.slots.some((slot) => slot.instance.startsWith(SCIENTISTS_BUDGET_ID))) {
        throw new Error('the parliament-scibudget fixture lost Scientists Budget out of the voting area');
      }
    },
  };
}
parliamentFixture('parliament-scibudget-vote', scientistsBudgetTable('vote'));
parliamentFixture('parliament-scibudget-assembly', scientistsBudgetTable('pass'));

// ── RX17 · JOVIAN TAX RIGHTS (Unity — «titanium = influence; +1 M€ production per colony, max 5»): the SIXTH count —
//    the seat's CUBES on the colony tiles, the engine's own list. Blue: Agenda 5 (influence 3 — a win takes the marker
//    to step 6, still influence 3, so the panel prints no win suffix), Luna ×2 + Titan + Miranda = 4 cubes; red: Luna
//    alone, Agenda 1 (influence 1). Two moments:
//    · the VOTE — the panel reads TWO lines: «[influence] 3 → +3 titanium» and «[colony] 4 → +4 M€ production · max 5»
//      with its HORIZON («pays from the next generation») and NO influence input on the production line — influence is
//      not a term of it; the fullscreen names the tiles («Луна ×2 · Титан · Миранда»);
//    · the ASSEMBLY — RED's delegate wins (blue keeps influence 3, so the sitting pays blue exactly the vote's numbers:
//      +3 titanium into the supply, then +4 M€ production), every seat passed, the assembly gate standing for both.
function jovianTable(stopAt: 'vote' | 'pass'): ParliamentFixtureSpec {
  return {
    resolution: JOVIAN_TAX_RIGHTS_ID,
    votes: [stopAt === 'vote' ? 0 : 1],
    agenda: [5, 1],
    stopAt,
    arrange: ({game, p1, p2}) => {
      const owned = (colony: IColony, owners: ReadonlyArray<TestPlayer>): IColony => {
        colony.isActive = true;
        colony.colonies = owners.map((p) => p.id);
        return colony;
      };
      // Blue holds TWO cubes on Luna (red's between them — the count is by cube, the list groups them «×2»).
      game.colonies = [owned(new Luna(), [p1, p2, p1]), owned(new Titan(), [p1]), owned(new Miranda(), [p1]), owned(new Callisto(), [])];
    },
    expect: ({p1, p2, parliament}) => {
      const count = resolutionCount(p1, 'colonies');
      if (count.count !== 4 || count.colonies?.join(',') !== [ColonyName.LUNA, ColonyName.LUNA, ColonyName.TITAN, ColonyName.MIRANDA].join(',')) {
        throw new Error(`the parliament-jovian fixture (${stopAt}) expected blue's four cubes (Luna ×2 · Titan · Miranda), got ${JSON.stringify(count)}`);
      }
      if (resolutionCount(p2, 'colonies').count !== 1) {
        throw new Error(`the parliament-jovian fixture (${stopAt}) expected red on Luna alone`);
      }
      if (parliament.influence(p1) !== 3) {
        throw new Error(`the parliament-jovian fixture (${stopAt}) expected blue at influence 3, got ${parliament.influence(p1)}`);
      }
      if (!parliament.slots.some((slot) => slot.instance.startsWith(JOVIAN_TAX_RIGHTS_ID))) {
        throw new Error(`the parliament-jovian fixture (${stopAt}) lost Jovian Tax Rights out of the voting area`);
      }
    },
  };
}
parliamentFixture('parliament-jovian-vote', jovianTable('vote'));
parliamentFixture('parliament-jovian-assembly', jovianTable('pass'));

// ── RX18 · MEDICAL DATABASE (the Scientists — «1 data or microbe resource per science tag + influence, each on any
//    card»): the distributing family over TWO KINDS of unit — the recipients are the holders of data AND of microbes at
//    once, and each unit's kind is its card's. A plain Redux game holds no data holder (data lives in Pathfinders / the
//    Moon / Underworld), so blue's holders are two science-tagged MICROBE holders — GHG Producing Bacteria + Regolith
//    Eaters: 2 science tags at Agenda 2 (influence 1; winning → step 3 = influence 2) → N = 4 over TWO holders → the
//    shared DISTRIBUTION, its marker naming BOTH kinds (`cardResources`) and each holder's own (`cardResourceByCard`).
//    Red: Tardigrades alone (no tag) at Agenda 5 (influence 3) → N = 3 onto ONE holder → the family's ordinary pick.
//    The area: the Scientists / Mars First / the Industrialists — the Greens rule by the starting rule, no card. ──
const medicalTable = (stopAt: ParliamentStop, expect?: (table: ParliamentTable) => void): ParliamentFixtureSpec => ({
  resolution: MEDICAL_DATABASE_ID,
  votes: [0],
  agenda: [2, 5],
  stopAt,
  arrange: ({p1, p2, parliament}) => {
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 2, CENTRAL_POWER_GRID_ID);
    p1.playedCards.push(new GHGProducingBacteria(), new RegolithEaters());
    p2.playedCards.push(new Tardigrades());
  },
  expect: (table) => {
    const {p1, p2} = table;
    const blue = resolutionCount(p1, 'scienceTags');
    const red = resolutionCount(p2, 'scienceTags');
    if (blue.count !== 2 || red.count !== 0) {
      throw new Error(`the parliament-medical fixture (${stopAt}) expected blue's two science tags and none for red (a corporation with a science tag was dealt?), got ${blue.count} / ${red.count}`);
    }
    expect?.(table);
  },
});
// The vote: the face «[data] OR [microbe] / [science tag] + [influence]», blue's reading «2 tags + 1 → 3 (+1 if you win)»
// with the unit drawn as BOTH kinds joined by «or».
parliamentFixture('parliament-medical-vote', medicalTable('vote'));
// The political phase STOPPED INSIDE blue's LAYOUT: Medical Database won with blue's delegate (Agenda 2 → 3 = influence
// 2), the phase asks BLUE to lay 4 units over GHG Producing Bacteria and Regolith Eaters — both microbe holders, the
// marker still naming both kinds; red's single-holder pick (3 onto Tardigrades) follows.
parliamentFixture('parliament-medical-enact', medicalTable('effects', ({p1}) => {
  const ask = p1.getWaitingFor();
  const meta = ask instanceof AndOptions ? ask.cardResourceDistributionPrompt : undefined;
  if (meta === undefined || meta.amount !== 4 || meta.cards.length !== 2 || meta.cardResource !== undefined ||
      JSON.stringify(meta.cardResources) !== JSON.stringify(['data', 'microbe'])) {
    throw new Error(`the parliament-medical-enact fixture expected blue's 4-unit layout over two holders with both kinds on the marker, got ${ask?.constructor.name} ${JSON.stringify(meta)}`);
  }
}));

// ── RX19 · METAL RESEARCH (the Industrialists — «steel and titanium = influence; each unit of steel and titanium is
//    worth 1 M€ more while enacted»). Two moments of ONE journey, the new mechanic being the VALUE:
//    · the ASSEMBLY — the card alone in the first voting slot with blue's free delegate on it (blue at Agenda step 2 →
//      influence 2 → 2 steel + 2 titanium, red at step 1 → 1 + 1); blue holds a little steel and titanium so the rail's
//      value badges have rows to sit on: they must read «2» / «3» before the enactment and «3» / «4» the moment the law
//      stands, on the same screen, with no reload and no press;
//    · ENACTED — the sitting is over, RED won it (the seat the loader opens in generation 2) and holds «Nuclear Power»
//      (10 M€, a Building tag — steel is accepted) with steel in the supply: the play composer's steel row must read
//      «×3» and the price must stand at its printed 10 (a value is not a discount).
parliamentFixture('parliament-metal-assembly', {
  resolution: METAL_RESEARCH_ID,
  votes: [0],
  agenda: [2, 1],
  stopAt: 'pass',
  arrange: ({p1, p2}) => {
    p1.steel = 3;
    p1.titanium = 2;
    p2.steel = 2;
    p2.titanium = 1;
  },
  expect: ({p1, parliament}) => {
    if (!parliament.slots.some((slot) => slot.instance.startsWith(METAL_RESEARCH_ID))) {
      throw new Error('the parliament-metal fixture lost Metal Research out of the voting area');
    }
    if (p1.getSteelValue() !== 2 || p1.getTitaniumValue() !== 3) {
      throw new Error(`the parliament-metal-assembly fixture expected the base values before the enactment, got ${p1.getSteelValue()} / ${p1.getTitaniumValue()}`);
    }
  },
});
parliamentFixture('parliament-metal-enacted', {
  resolution: METAL_RESEARCH_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  arrange: ({p2}) => {
    // The card the value is read on: printed 10, a Building tag, no requirement, no question of its own.
    p2.cardsInHand.push(new NuclearPower());
    p2.steel = 4;
    p2.titanium = 2;
  },
  expect: (table) => {
    const {p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(METAL_RESEARCH_ID, 0)) {
      throw new Error(`the parliament-metal-enacted fixture expected Metal Research enacted, got ${parliament.enacted}`);
    }
    if (!p2.cardsInHand.some((c) => c.name === CardName.NUCLEAR_POWER)) {
      throw new Error('the parliament-metal-enacted fixture expected red to hold Nuclear Power');
    }
    if (p2.getSteelValue() !== 3 || p2.getTitaniumValue() !== 4) {
      throw new Error(`the parliament-metal-enacted fixture expected the law's 3 / 4, got ${p2.getSteelValue()} / ${p2.getTitaniumValue()}`);
    }
    if (p2.getCardCost(new NuclearPower()) !== 10) {
      throw new Error(`the parliament-metal-enacted fixture expected the printed 10 (a value is not a discount), got ${p2.getCardCost(new NuclearPower())}`);
    }
    if (p2.steel < 4) {
      throw new Error(`the parliament-metal-enacted fixture expected red to hold steel for the composer's row, has ${p2.steel}`);
    }
    expectViewerOpensGeneration(table, p2, 'parliament-metal-enacted');
  },
});

// ── RX20 · SKYSCRAPERS (Mars First — «the winner of the vote and every seat with influence ≥ 2 each gain a city tile,
//    placed on top of their own city on Mars»). The new mechanic is the CITY STACK and the tier's landing:
//    · ENACT — the sitting stands at the effects step with BLUE's tier prompt live: blue's delegate won the card (Agenda
//      2 → step 3 → influence 2), blue owns ONE city on Mars with ONE greenery beside it (the tier's preview promises
//      «1 → 2 tiers · 1 → 2 VP», the endgame breakdown two city contributions on one cell); red at Agenda 1 (influence
//      1, not the winner) is passed over BY THE RULE — its city is no candidate for anyone;
//    · STACKED — the sitting is over and both seats built a tier (red at Agenda 3 → influence 2): the board shows two
//      stacks of 2, blue's beside two greeneries — the stack's own look, on every profile, and the score breakdown.
/** A quiet land cell for a city with `greeneries` empty land neighbours (no printed bonus, no ocean or tile beside it). */
function stackSite(game: IGame, player: TestPlayer, greeneries: number, taken: ReadonlySet<string>): {city: Space, groves: Array<Space>} {
  for (const city of game.board.getAvailableSpacesForCity(player)) {
    if (city.bonus.length > 0 || taken.has(city.id) || city.id === game.board.noctisCitySpaceId) {
      continue;
    }
    const around = game.board.getAdjacentSpaces(city);
    if (around.some((a) => a.tile !== undefined || a.spaceType === SpaceType.OCEAN || taken.has(a.id))) {
      continue;
    }
    const groves = around.filter((a) => a.spaceType === SpaceType.LAND && a.bonus.length === 0).slice(0, greeneries);
    if (groves.length === greeneries) {
      return {city, groves};
    }
  }
  throw new Error(`no quiet site with ${greeneries} greenery neighbours for ${player.color}`);
}
function seatStackSites(game: IGame, p1: TestPlayer, p2: TestPlayer, blueGroves: number): void {
  const taken = new Set<string>();
  const blue = stackSite(game, p1, blueGroves, taken);
  blue.city.tile = {tileType: TileType.CITY};
  blue.city.player = p1;
  taken.add(blue.city.id);
  for (const grove of blue.groves) {
    grove.tile = {tileType: TileType.GREENERY};
    grove.player = p1;
    taken.add(grove.id);
  }
  for (const a of game.board.getAdjacentSpaces(blue.city)) {
    taken.add(a.id);
  }
  const red = stackSite(game, p2, 0, taken);
  red.city.tile = {tileType: TileType.CITY};
  red.city.player = p2;
}
parliamentFixture('parliament-skyscrapers-enact', {
  resolution: SKYSCRAPERS_ID,
  votes: [0],
  agenda: [2, 1],
  stopAt: 'effects',
  arrange: ({game, p1, p2}) => seatStackSites(game, p1, p2, 1),
  expect: ({game, p1, p2, parliament}) => {
    const ask = p1.getWaitingFor();
    if (!(ask instanceof SelectSpace) || ask.placementType !== 'city-tier' || ask.placementContext?.source?.resolution !== SKYSCRAPERS_ID) {
      throw new Error(`the parliament-skyscrapers-enact fixture expected blue's city-tier placement, got ${ask?.constructor.name}`);
    }
    if (ask.spaces.length !== 1 || game.board.countCities(p1) !== 1 || game.board.countCities(p2) !== 1) {
      throw new Error('the parliament-skyscrapers-enact fixture expected ONE city per seat and blue\'s one candidate');
    }
    if (game.board.getAdjacentSpaces(ask.spaces[0]).filter(Board.isGreenerySpace).length !== 1) {
      throw new Error('the parliament-skyscrapers-enact fixture expected one greenery beside blue\'s city');
    }
    if (parliament.phase?.step !== 'effects' || parliament.influence(p1) !== 2 || parliament.influence(p2) !== 1) {
      throw new Error(`the parliament-skyscrapers-enact fixture expected the effects step at influence 2 / 1, got ${parliament.phase?.step} · ${parliament.influence(p1)} / ${parliament.influence(p2)}`);
    }
  },
});
parliamentFixture('parliament-skyscrapers-stacked', {
  resolution: SKYSCRAPERS_ID,
  votes: [0],
  agenda: [2, 3],
  stopAt: 'done',
  arrange: ({game, p1, p2}) => seatStackSites(game, p1, p2, 2),
  expect: (table) => {
    const {game, p1, p2, parliament} = table;
    const stacks = game.board.spaces.filter((s) => (s.stackHeight ?? 1) > 1);
    if (stacks.length !== 2 || game.board.countCities(p1) !== 2 || game.board.countCities(p2) !== 2) {
      throw new Error(`the parliament-skyscrapers-stacked fixture expected two stacks of 2, got ${stacks.map((s) => `${s.id}:${s.stackHeight}`).join(',')}`);
    }
    const tiers = parliament.lastPhase?.outcomes?.filter((o) => o.kind === 'city') ?? [];
    if (tiers.length !== 2) {
      throw new Error(`the parliament-skyscrapers-stacked fixture expected two city records, got ${tiers.length}`);
    }
    if (p1.getVictoryPoints().city !== 4) {
      throw new Error(`the parliament-skyscrapers-stacked fixture expected blue's stack beside two greeneries to score 4, got ${p1.getVictoryPoints().city}`);
    }
    expectViewerOpensGeneration(table, p2, 'parliament-skyscrapers-stacked');
  },
});

// ── RX16 · JOINT RESEARCH — the first LEVEL: every seat draws UP TO 6 + influence
//    cards in hand. Blue at Agenda 4 (influence 2 → target 8) with FIVE cards in
//    hand (+3; winning → step 5 = influence 3 → target 9 → +4: the «+1 if you win ·
//    step 5» suffix); red at Agenda 1 with NINE cards — at or above every target it
//    can reach, so its zero names itself. The vote: blue's delegate leads it. The
//    sitting: RED's delegate wins it (red's step 1 → 2 keeps influence 1 → target 7,
//    hand 9 → nothing), so blue is paid exactly the vote's estimate. ──
/** Bring a seat's hand to exactly `n` cards — the extras to the discard, the missing ones off the top of the deck. */
function setHandTo(game: IGame, player: TestPlayer, n: number): void {
  while (player.cardsInHand.length > n) {
    const card = player.cardsInHand.pop();
    if (card !== undefined) {
      game.projectDeck.discard(card);
    }
  }
  while (player.cardsInHand.length < n) {
    player.cardsInHand.push(game.projectDeck.drawOrThrow(game));
  }
}
function researchTable(stopAt: 'vote' | 'pass' | 'effects', blueHand = 5): ParliamentFixtureSpec {
  return {
    resolution: JOINT_RESEARCH_ID,
    votes: [stopAt === 'vote' ? 0 : 1],
    agenda: [4, 1],
    stopAt,
    arrange: ({game, p1, p2}) => {
      setHandTo(game, p1, blueHand);
      setHandTo(game, p2, 9);
    },
    expect: ({p1, p2, parliament}) => {
      if (p1.cardsInHand.length !== blueHand) {
        throw new Error(`the parliament-research fixture expected blue with ${blueHand} cards in hand, got ${p1.cardsInHand.length}`);
      }
      if (p2.cardsInHand.length !== 9) {
        throw new Error(`the parliament-research fixture expected red with 9 cards in hand, got ${p2.cardsInHand.length}`);
      }
      if (stopAt === 'vote' && !parliament.slots.some((slot) => slot.instance.startsWith(JOINT_RESEARCH_ID))) {
        throw new Error('the parliament-research fixture lost Joint Research out of the voting area');
      }
      if (stopAt === 'effects') {
        // The political phase STOPPED INSIDE blue's mandatory TAKE: target 8 (6 + influence 2), hand 5, three cards owed and withheld.
        const ask = p1.getWaitingFor();
        if (!(ask instanceof SelectCard) || ask.externalDrawPrompt === undefined) {
          throw new Error(`the parliament-research-enact fixture expected blue's mandatory take, got ${ask?.constructor.name}`);
        }
        if (p1.cardsInHand.length !== 5 || p1.pendingCardIntakes.length !== 1 || p1.pendingCardIntakes[0].cards.length !== 3) {
          throw new Error(`the parliament-research-enact fixture expected hand 5 and three owed cards, got ${p1.cardsInHand.length} / ${JSON.stringify(p1.pendingCardIntakes.map((i) => i.cards.length))}`);
        }
        if (parliament.phase?.step !== 'effects') {
          throw new Error('the parliament-research-enact fixture expected the effects step');
        }
      }
    },
  };
}
parliamentFixture('parliament-research-vote', researchTable('vote'));
parliamentFixture('parliament-research-assembly', researchTable('pass'));
parliamentFixture('parliament-research-enact', researchTable('effects'));
// …and the VIEWER at its target: blue with NINE cards at target 8 — the sitting's reward beat reads the calm
// zero («up to 8 · 9 in hand → no draw needed») on the band, and nothing flies.
parliamentFixture('parliament-research-full', researchTable('pass', 9));

// ── RX25 · PLANT BAN — the LEVEL pointed DOWN: every seat is cut to 2 + influence
//    plants. Blue at Agenda 3 (influence 2 → limit 4) with SEVEN plants (−3 — the
//    panel has to say so BEFORE the vote, which is the only defence against this
//    law); red at Agenda 1 (influence 1 → limit 3) with TWO — already under its
//    limit, so its zero names itself. The vote: blue's delegate leads it. The
//    sitting: RED's delegate wins it, so blue keeps influence 2 and is cut by
//    exactly the number the vote panel promised. ──
function banTable(stopAt: 'vote' | 'pass'): ParliamentFixtureSpec {
  return {
    resolution: PLANT_BAN_ID,
    votes: [stopAt === 'vote' ? 0 : 1],
    agenda: [3, 1],
    stopAt,
    arrange: ({p1, p2}) => {
      p1.plants = 7;
      p2.plants = 2;
    },
    expect: ({p1, p2, parliament}) => {
      if (stopAt === 'vote') {
        if (p1.plants !== 7 || p2.plants !== 2) {
          throw new Error(`the parliament-ban-vote fixture expected 7 / 2 plants before the sitting, got ${p1.plants} / ${p2.plants}`);
        }
        if (!parliament.slots.some((slot) => slot.instance.startsWith(PLANT_BAN_ID))) {
          throw new Error('the parliament-ban-vote fixture lost Plant Ban out of the voting area');
        }
        return;
      }
      // ONE PASS AWAY: the plants are still untouched — the client's own walk is what plays the cut, and that walk
      // is the spec's subject.
      void parliament;
      if (p1.plants !== 7) {
        throw new Error(`the parliament-ban-assembly fixture expected blue to still hold 7 plants one pass before the sitting, got ${p1.plants}`);
      }
    },
  };
}
parliamentFixture('parliament-ban-vote', banTable('vote'));
parliamentFixture('parliament-ban-assembly', banTable('pass'));

// ── RX03 · BIODOME CONTEST — a 2-seat table with the card alone in the first
//    voting slot and blue's free delegate on it: blue at Agenda step 2
//    (influence 1 — winning → step 3 = influence 2 → 4 plants), red at step 5
//    (influence 3 → 6 plants), a few plants on both, the oxygen and the
//    temperature the scenario asks for. ──
const biodomeTable = (oxygen: number, temperature: number, stopAt: ParliamentStop, extra?: {arrange?: (table: ParliamentTable) => void; expect?: (table: ParliamentTable) => void}): ParliamentFixtureSpec => ({
  resolution: BIODOME_CONTEST_ID,
  votes: [0],
  agenda: [2, 5],
  stopAt,
  arrange: (table) => {
    const {game, p1, p2} = table;
    p1.plants = 3;
    p2.plants = 1;
    setOxygenLevel(game, oxygen);
    setTemperature(game, temperature);
    extra?.arrange?.(table);
  },
  expect: extra?.expect,
});
// The vote: blue leads it, oxygen 5 % (winning would place a greenery → 6 %,
// +2 TR), the plants read «+2 now, +4 if you win» for blue and «+6» for red.
parliamentFixture('parliament-biodome-vote', biodomeTable(5, -14, 'vote'));
// The sitting has just convened: the ASSEMBLY gate stands for both seats — the plants and the greenery are still to come.
parliamentFixture('parliament-biodome-assembly', biodomeTable(7, -2, 'pass'));
// The political phase STOPPED INSIDE blue's greenery placement: Biodome Contest
// won with blue's delegate (Agenda 2 → 3 = influence 2), blue's 4 plants already
// landed (3 → 7) and the winner's greenery is asked — oxygen 7 % → 8 % raises
// the temperature −2 → 0 °C, which grants a FREE OCEAN (a follow-up placement
// of its own). Red's 6 plants come after blue's placements.
parliamentFixture('parliament-biodome-enact', biodomeTable(7, -2, 'effects', {
  expect: ({p1, parliament}) => {
    const ask = p1.getWaitingFor();
    if (!(ask instanceof SelectSpace) || ask.placementContext?.source?.resolution !== BIODOME_CONTEST_ID || p1.plants !== 7) {
      throw new Error(`the parliament-biodome-enact fixture expected blue's greenery placement, got ${ask?.constructor.name} (plants ${p1.plants})`);
    }
    if (parliament.phase?.step !== 'effects') {
      throw new Error('the parliament-biodome-enact fixture expected the effects step');
    }
  },
}));
// The greenery placed (a quiet cell), the free ocean too, red paid: the ADJOURN gate stands for both seats.
parliamentFixture('parliament-biodome-adjourn', biodomeTable(7, -2, 'close', {
  expect: ({parliament, p1}) => {
    const outcomes = (parliament.phase?.summary ?? parliament.lastPhase)?.outcomes ?? [];
    if (!outcomes.some((o) => o.player === p1.id && o.kind === 'greenery')) {
      throw new Error(`the parliament-biodome-adjourn fixture expected blue's greenery, got ${JSON.stringify(outcomes)}`);
    }
  },
}));
// The same stop with OXYGEN AT ITS MAXIMUM — the greenery still lands and pays its own TR, oxygen does not move.
parliamentFixture('parliament-biodome-maxed', biodomeTable(MAX_OXYGEN_LEVEL, -10, 'effects', {
  expect: ({p1}) => {
    if (!(p1.getWaitingFor() instanceof SelectSpace)) {
      throw new Error('the parliament-biodome-maxed fixture expected the greenery placement of blue');
    }
  },
}));
// Generation 2 has just begun — the political phase ENACTED Biodome Contest won
// by RED (Agenda 4 → 5 = influence 3 → +6 plants, 1 → 7), red placed the
// winner's greenery on a quiet cell (oxygen 5 → 6 %), blue got +2 plants
// (influence 1). Red opens generation 2 (the viewer seat): the results scene
// moves the card into the government, flies red's plants from the card to the
// rail and names the greenery with its oxygen step.
parliamentFixture('parliament-biodome-recap', biodomeTable(5, -14, 'done', {
  arrange: ({p1, p2, parliament}) => {
    // RED wins it this time: blue's delegate goes back to the lobby, red's takes its place.
    parliament.slots[0].votes = [];
    parliament.lobby.add(p1.id);
    parliament.placeVote(p2, parliament.slots[0], 'lobby');
    parliament.agenda.set(p1.id, 1);
    parliament.agenda.set(p2.id, 4);
  },
  expect: (table) => {
    const {parliament, p2} = table;
    const outcomes = parliament.lastPhase?.outcomes ?? [];
    const redPlants = outcomes.find((o) => o.player === p2.id && o.step === 'plants');
    const greenery = outcomes.find((o) => o.player === p2.id && o.step === 'greenery' && o.kind !== 'reaction');
    if (redPlants?.kind !== 'stock' || redPlants.amount !== 6 || greenery?.kind !== 'greenery') {
      throw new Error(`the parliament-biodome-recap fixture expected the +6 plants and the greenery of red, got ${JSON.stringify(outcomes)}`);
    }
    expectViewerOpensGeneration(table, p2, 'parliament-biodome-recap');
  },
}));
// ONE PASS from the political phase, with NO LEGAL CELL for the winner's
// greenery — every land cell of Mars already holds red's tile. Red has passed;
// blue (who leads Biodome Contest) passes to end the generation: the plants
// reach everyone, the greenery is NAMED and skipped, and generation 2's
// results scene says so.
parliamentFixture('parliament-biodome-nocell', biodomeTable(5, -14, 'vote', {
  arrange: ({game, p1, p2}) => {
    for (const space of game.board.getSpaces(SpaceType.LAND)) {
      if (space.tile === undefined) {
        space.tile = {tileType: TileType.GREENERY};
        space.player = p2;
      }
    }
    if (game.board.getAvailableSpacesForType(p1, 'greenery').length !== 0) {
      throw new Error('the parliament-biodome-nocell fixture expected no legal greenery cell for blue');
    }
    game.playerHasPassed(p2);
  },
}));
// THE SAME table at the ASSEMBLY gate: the sitting's reward page reads the winner's greenery as a SKIP (no legal cell)
// before the record, and the record's own skip plate after it.
parliamentFixture('parliament-biodome-nocell-assembly', biodomeTable(5, -14, 'pass', {
  arrange: ({game, p1, p2}) => {
    for (const space of game.board.getSpaces(SpaceType.LAND)) {
      if (space.tile === undefined) {
        space.tile = {tileType: TileType.GREENERY};
        space.player = p2;
      }
    }
    if (game.board.getAvailableSpacesForType(p1, 'greenery').length !== 0) {
      throw new Error('the parliament-biodome-nocell-assembly fixture expected no legal greenery cell for blue');
    }
  },
}));
// ONE PASS from the political phase with Biodome Contest carried by NEUTRAL
// delegates only — nobody places the greenery, the plants still reach everyone.
// Red has passed; blue passes.
parliamentFixture('parliament-biodome-neutral', biodomeTable(5, -14, 'vote', {
  arrange: ({game, p1, p2, parliament}) => {
    parliament.slots[0].votes = [];
    parliament.lobby.add(p1.id);
    parliament.addNeutralVote(parliament.slots[0]);
    parliament.addNeutralVote(parliament.slots[0]);
    game.playerHasPassed(p2);
  },
}));

// ── RX05 · CLIMATE RESEARCH — a 2-seat table with the card alone in the first
//    voting slot and blue's free delegate on it: blue at Agenda step 3
//    (influence 2 — winning → step 4 keeps influence 2), red at step 1
//    (influence 1). Heat PRODUCTION is what the card reads, so it is what the
//    fixture arranges. ──
const climateTable = (blueHeat: number, redHeat: number, stopAt: ParliamentStop, extra?: {agenda?: [number | undefined, number | undefined]; arrange?: (table: ParliamentTable) => void; expect?: (table: ParliamentTable) => void}): ParliamentFixtureSpec => ({
  resolution: CLIMATE_RESEARCH_ID,
  votes: [0],
  agenda: extra?.agenda ?? [3, 1],
  stopAt,
  arrange: (table) => {
    table.p1.production.override({heat: blueHeat});
    table.p2.production.override({heat: redHeat});
    extra?.arrange?.(table);
  },
  expect: extra?.expect,
});
// The vote: +1 heat production per influence, THEN 1 card per full 3 steps of
// the heat production it leaves behind — blue leads it with heat production 4
// (influence 2 → 4 → 6 → 2 cards, and the ruling Greens would answer with +2
// M€ production), red sits at 1.
parliamentFixture('parliament-climate-vote', climateTable(4, 1, 'vote'));
// …the SAME table with blue one Agenda step back (step 2 = influence 1;
// winning → step 3 = influence 2): +1 heat production now (4 → 5 → 1 card)
// and, if blue wins, +2 (4 → 6 → 2 cards) — the vote panel's «+1 if you win ·
// step 3» suffix on BOTH links of the chain.
parliamentFixture('parliament-climate-vote-raise', climateTable(4, 1, 'vote', {agenda: [2, 1]}));
// …and blue one step SHORT OF A CARD STEP (step 6 = influence 3; winning → step 7 = the Agenda's CARD reward):
// the political phase pays the step's card with the summary — the sitting's enactment glide lands on a card step.
parliamentFixture('parliament-climate-cardstep', climateTable(4, 1, 'vote', {agenda: [6, 1]}));
// The sitting has just convened: the ASSEMBLY gate stands for both seats — the raise, the Greens' answer and the draw are still to come.
parliamentFixture('parliament-climate-assembly', climateTable(4, 2, 'pass'));
// The political phase STOPPED INSIDE blue's mandatory TAKE of the cards
// Climate Research drew. Blue's heat production was raised 4 → 6 (influence
// 2), the ruling Greens answered with +2 M€ production, and two project cards
// are owed — withheld from the hand until the take. Red's own half comes after blue's.
parliamentFixture('parliament-climate-enact', climateTable(4, 2, 'effects', {
  expect: ({p1, parliament}) => {
    const ask = p1.getWaitingFor();
    if (!(ask instanceof SelectCard) || ask.externalDrawPrompt === undefined) {
      throw new Error(`the parliament-climate-enact fixture expected blue's mandatory take, got ${ask?.constructor.name}`);
    }
    if (p1.production.heat !== 6 || p1.pendingCardIntakes.length !== 1 || p1.pendingCardIntakes[0].cards.length !== 2) {
      throw new Error(`the parliament-climate-enact fixture expected heat production 6 and two owed cards, got ${p1.production.heat} / ${JSON.stringify(p1.pendingCardIntakes.map((i) => i.cards.length))}`);
    }
    if (parliament.phase?.step !== 'effects') {
      throw new Error('the parliament-climate-enact fixture expected the effects step');
    }
  },
}));
// Both seats raised and both took their cards; the area refreshed: the ADJOURN
// gate stands for both seats, the Greens' answer recorded under each raise.
parliamentFixture('parliament-climate-adjourn', climateTable(4, 2, 'close', {
  expect: ({parliament, p1, p2}) => {
    const outcomes = (parliament.phase?.summary ?? parliament.lastPhase)?.outcomes ?? [];
    for (const seat of [p1, p2]) {
      if (!outcomes.some((o) => o.player === seat.id && o.kind === 'reaction' && o.step === 'heat-production')) {
        throw new Error(`the parliament-climate-adjourn fixture expected the Greens' answer for ${seat.color}, got ${JSON.stringify(outcomes)}`);
      }
    }
  },
}));
// The same stop with a BIG draw — heat production 17 + influence 2 = 19 → SIX
// cards owed at once. The take must show all six at a readable size inside the
// enactment stage; nothing is trimmed to fit.
parliamentFixture('parliament-climate-big', climateTable(17, 0, 'effects', {
  expect: ({p1}) => {
    const ask = p1.getWaitingFor();
    if (!(ask instanceof SelectCard) || ask.externalDrawPrompt?.remaining !== 6) {
      throw new Error(`the parliament-climate-big fixture expected six owed cards, got ${ask?.constructor.name}`);
    }
  },
}));
// Generation 2 has just begun — the political phase ENACTED Climate Research
// won by RED, both seats were raised and both took their cards. Red opens
// generation 2 (the seat the dev loader opens): the results scene moves the
// card into the government and names BOTH halves of every seat's result.
parliamentFixture('parliament-climate-recap', climateTable(4, 2, 'done', {
  arrange: ({p1, p2, parliament}) => {
    // RED wins it: blue's delegate goes back to the lobby, red's takes its place.
    parliament.slots[0].votes = [];
    parliament.lobby.add(p1.id);
    parliament.placeVote(p2, parliament.slots[0], 'lobby');
  },
  expect: (table) => {
    const {parliament, p1, p2} = table;
    const outcomes = parliament.lastPhase?.outcomes ?? [];
    const raise = outcomes.find((o) => o.player === p1.id && o.step === 'heat-production' && o.kind !== 'reaction');
    const draw = outcomes.find((o) => o.player === p1.id && o.step === 'draw');
    if (raise?.kind !== 'production' || raise.amount !== 2 || draw?.kind !== 'cards' || draw.amount !== 2) {
      throw new Error(`the parliament-climate-recap fixture expected blue's +2 heat production and 2 cards, got ${JSON.stringify(outcomes)}`);
    }
    if (outcomes.find((o) => o.player === p2.id && o.step === 'draw')?.kind !== 'cards') {
      throw new Error(`the parliament-climate-recap fixture expected red's own draw, got ${JSON.stringify(outcomes)}`);
    }
    expectViewerOpensGeneration(table, p2, 'parliament-climate-recap');
  },
}));


// ── parliament-dense: a crowded FIVE-seat Parliament in generation 2 (the
//    first political phase already ran, so a resolution is ENACTED and its own
//    chairman quest is open) — the composition's stress case. The VIEWER is the
//    first seat in GENERATION order (the dev loader opens that seat), so every
//    viewer-specific fact is arranged on that seat, not on «p1»:
//      · V1 and V2 hold the SAME number of delegates (a tie between
//        resolutions: V1 wins it, being closer to the government), both past
//        the ribbon's dense threshold;
//      · on V1 the viewer and a rival hold the same count (a tie between
//        players: the viewer's earlier first delegate leads);
//      · on V2 the NEUTRAL delegates are the majority while a player still
//        leads it (a neutral never wins a card a player stands on);
//      · the viewer spent the lobby delegate and cannot afford a paid one (no
//        vote — the reason is named), holds several party effects at once
//        (the ruling party · two delegates · card grants, one of them ON the
//        ruling party — two bases, one effect), one party action USED this
//        generation, one BLOCKED by its own rule and one available;
//      · Agenda markers spread across the track, a chairman seated, quest
//        progress for several seats. ──
{
  // PINNED, every one without a corporation first action (the free-standing tables' class — see
  // `NO_FIRST_ACTION_CORPORATIONS`): an unpinned deal moves with the deck, and TR37's one card put Aridor's and
  // Inventrix's pending first actions on two other seats.
  const pinned = NO_FIRST_ACTION_CORPORATIONS.slice(0, 5);
  const players = testGame(5, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1, customCorporationsList: [...pinned],
  });
  const game = players[0];
  const seats = players.slice(1) as Array<TestPlayer>;
  assignPinnedCorporations('parliament-dense', seats, pinned);
  if (!(seats[0].getWaitingFor() instanceof SelectInitialCards)) {
    throw new Error('parliament-dense: expected SelectInitialCards');
  }
  answerStartFlow(game, seats);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error('the parliament-dense fixture has no voting area');
  }
  // Generation 1: one delegate so the phase has a winner to enact.
  seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID); // a card that asks nothing: the phase runs to its end
  parliament.placeVote(seats[1], parliament.slots[1], 'lobby');
  runAllActions(game);
  endGenerationThroughParliament(game);
  for (const player of seats) {
    if (player.getWaitingFor() instanceof SelectCard) {
      player.process({type: 'card', cards: []});
    }
  }
  runAllActions(game);
  if (parliament.enacted === undefined || parliament.slots.length < 2) {
    throw new Error('parliament-dense: the first political phase did not enact a resolution and deal two fresh ones');
  }
  const [viewer, rival, lead2, minor, far] = game.playersInGenerationOrder as Array<TestPlayer>;
  const [v1, v2, v3] = parliament.slots;
  // V1: the viewer first (the player tie-breaker), then the rival — five each.
  parliament.placeVote(viewer, v1, 'lobby');
  parliament.placeVote(rival, v1, 'lobby');
  for (let i = 0; i < 4; i++) {
    parliament.placeVote(viewer, v1, 'reserve');
    parliament.placeVote(rival, v1, 'reserve');
  }
  // V2: one player leads a card the neutral delegates will hold the majority of.
  parliament.placeVote(lead2, v2, 'lobby');
  parliament.placeVote(minor, v2, 'lobby');
  for (let i = 0; i < 3; i++) {
    parliament.placeVote(lead2, v2, 'reserve');
  }
  // V3 — when the deck holds a third party beside the ruling one's: a clear leader.
  if (v3 !== undefined) {
    parliament.placeVote(far, v3, 'lobby');
    for (let i = 0; i < 3; i++) {
      parliament.placeVote(far, v3, 'reserve');
    }
    parliament.placeVote(minor, v3, 'reserve');
  }
  // Neutrals: V1 and V2 to ONE common total the supply can pay for.
  const supply = parliament.neutralSupply();
  const target = Math.floor((supply + v1.votes.length + v2.votes.length) / 2);
  if (target <= Math.max(v1.votes.length, v2.votes.length) || target <= 12) {
    throw new Error(`parliament-dense: the neutral supply (${supply}) cannot tie V1 (${v1.votes.length}) and V2 (${v2.votes.length}) past the dense threshold`);
  }
  for (const slot of [v1, v2]) {
    while (slot.votes.length < target) {
      if (parliament.addNeutralVote(slot) === undefined) {
        throw new Error('parliament-dense: the neutral supply ran out');
      }
    }
  }
  // The viewer's party effects: grants beside the ruling party and the V1 party
  // (one of them ON the ruling party — two bases, one effect).
  parliament.grantPartyEffect(viewer, PartyName.REDS, 'Septem Tribus');
  parliament.grantPartyEffect(viewer, PartyName.SCIENTISTS, 'Septem Tribus');
  parliament.grantPartyEffect(viewer, PartyName.INDUSTRIALISTS, 'Septem Tribus');
  parliament.grantPartyEffect(viewer, parliament.rulingParty(), 'Septem Tribus');
  parliament.recordPartyActionUse(viewer, PartyName.REDS);
  // Agenda, chairman, quest progress.
  parliament.agenda.set(viewer.id, 4);
  parliament.agenda.set(rival.id, 7);
  parliament.agenda.set(lead2.id, 1);
  parliament.agenda.set(far.id, 11);
  parliament.chairman = lead2.id;
  const quest = parliament.quest;
  if (quest !== undefined) {
    quest.progress.set(viewer.id, Math.max(0, quest.definition.count - 1));
    quest.progress.set(rival.id, 1);
  }
  // No free delegate and no money for a paid one.
  for (const player of seats) {
    player.megaCredits = 3;
  }
  parliament.assertLedger(game);
  runAllActions(game);
  write('parliament-dense', game);
}

// ── THE FAMILIES REHEARSAL (final polish D.1) — the dev examples that stand
//    for the catalog's next families: RDX_DEV_PASSIVE (an effect while enacted,
//    no immediate step) and RDX_DEV_ACTION (a card action while enacted). Seated
//    in the first slot with blue's delegate (blue wins), blue at Agenda step 2,
//    red at step 5 — the same table as Aquifer Contest, so the frames compare.
//    At the VOTE the face, the panel and the inspect read a card that pays
//    nothing at the enactment; at the ASSEMBLY gate the sitting's REWARD stage
//    has no wave to show and must still say what the player got. ──
const familyTable = (resolution: ResolutionId, stopAt: ParliamentStop): ParliamentFixtureSpec => ({
  resolution,
  votes: [0],
  agenda: [2, 5],
  stopAt,
  arrange: ({p1, p2}) => {
    p1.playedCards.push(new Fish(), new Pets());
    p2.playedCards.push(new Birds());
  },
  expect: ({game, parliament}) => {
    // At the vote — and one pass before the sitting — the card stands in the first slot; the pass (dry-run on a copy)
    // makes it the sitting's WINNER from that very slot.
    const seated = parliament.slots[0]?.instance;
    let won = stopAt === 'vote';
    if (!won) {
      const copy = Game.deserialize(structuredClone(game.serialize()));
      passTheViewer(copy);
      won = (copy.parliament?.phase?.summary ?? copy.parliament?.lastPhase)?.winner.instance === seated;
    }
    if (seated !== resolutionInstanceId(resolution, 0) || !won) {
      throw new Error(`the family fixture expected ${resolution} ${stopAt === 'vote' ? 'in the first slot' : 'winning from the first slot'}, got ${seated}`);
    }
  },
});
parliamentFixture('parliament-devpassive-vote', familyTable(DEV_PASSIVE_RESOLUTION_ID, 'vote'));
parliamentFixture('parliament-devpassive-assembly', familyTable(DEV_PASSIVE_RESOLUTION_ID, 'pass'));
parliamentFixture('parliament-devaction-vote', familyTable(DEV_ACTION_RESOLUTION_ID, 'vote'));
parliamentFixture('parliament-devaction-assembly', familyTable(DEV_ACTION_RESOLUTION_ID, 'pass'));

// ── parliament-seat: the viewer COMPLETED the chairman quest while every one
//    of their seven delegates stands on a resolution — the seat must be taken
//    from one of them (the mandatory `chairman-seat` pick). The quest reads as
//    finished, with its winner, while the pick stands. ──
{
  const pinned = NO_FIRST_ACTION_CORPORATIONS.slice(0, 2);
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1, customCorporationsList: [...pinned],
  });
  assignPinnedCorporations('parliament-seat', [p1, p2], pinned);
  if (!(p1.getWaitingFor() instanceof SelectInitialCards)) {
    throw new Error('parliament-seat: expected SelectInitialCards');
  }
  answerStartFlow(game, [p1, p2]);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error('the parliament-seat fixture has no voting area');
  }
  const [v1, v2, v3] = parliament.slots;
  parliament.placeVote(p1, v1, 'lobby');
  parliament.placeVote(p1, v1, 'reserve');
  parliament.placeVote(p1, v2, 'reserve');
  parliament.placeVote(p1, v2, 'reserve');
  parliament.placeVote(p1, v2, 'reserve');
  parliament.placeVote(p1, v3, 'reserve');
  parliament.placeVote(p1, v3, 'reserve');
  parliament.placeVote(p2, v3, 'lobby');
  const quest = parliament.quest;
  if (quest === undefined || parliament.addQuestProgress(p1, quest.definition.count) !== 'completed') {
    throw new Error('parliament-seat: the quest did not complete');
  }
  ChairmanSeat.onQuestCompleted(p1);
  p1.megaCredits = 40;
  runAllActions(game);
  // The GATE stands first (nothing of the quest is applied until it is
  // answered); answering it is what raises the delegate pick.
  const gate = p1.getWaitingFor();
  if (gate?.chairmanQuestPrompt === undefined) {
    throw new Error('parliament-seat: the chairman-quest gate did not stand');
  }
  p1.process({type: 'option'});
  runAllActions(game);
  if (!parliament.pendingActions.some((action) => action.kind === 'chairman-seat')) {
    throw new Error('parliament-seat: no pending chairman seat');
  }
  write('parliament-seat', game);
}

// ── parliament-chairman-quest: the viewer COMPLETED the chairman quest and
//    the server has applied NOTHING — the gate stands, the marker is on its
//    old step, the office is still RED's. Opening it is the whole flow
//    («ПРЕДСЕДАТЕЛЬСТВО»), and the Agenda step it pays is a TR one (step 2),
//    so the reward has a chip to fly. ──
{
  const pinned = NO_FIRST_ACTION_CORPORATIONS.slice(0, 2);
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1, customCorporationsList: [...pinned],
  });
  assignPinnedCorporations('parliament-chairman-quest', [p1, p2], pinned);
  if (!(p1.getWaitingFor() instanceof SelectInitialCards)) {
    throw new Error('parliament-chairman-quest: expected SelectInitialCards');
  }
  answerStartFlow(game, [p1, p2]);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error('the parliament-chairman-quest fixture has no voting area');
  }
  // The office is held by the OTHER seat, so the flow has a delegate to send
  // home; the marker stands one step below the track's first TR reward.
  parliament.chairman = p2.id;
  parliament.agenda.set(p1.id, 1);
  const quest = parliament.quest;
  if (quest === undefined || parliament.addQuestProgress(p1, quest.definition.count) !== 'completed') {
    throw new Error('parliament-chairman-quest: the quest did not complete');
  }
  ChairmanSeat.onQuestCompleted(p1);
  p1.megaCredits = 40;
  runAllActions(game);
  if (p1.getWaitingFor()?.chairmanQuestPrompt === undefined) {
    throw new Error('parliament-chairman-quest: the gate did not stand');
  }
  if (parliament.chairman !== p2.id || parliament.agendaOf(p1) !== 1) {
    throw new Error('parliament-chairman-quest: the server applied something before the answer');
  }
  write('parliament-chairman-quest', game);
}

// ── MARSBOT AT THE TABLE (docs/TURMOIL_REDUX_MARSBOT.md §8 — `console-parliament-bot.spec.ts`).
//    Four tables with the bot as a SEAT: it votes (D2), takes the winner's reward by declaration
//    (D4) and completes the chairman quest by its ordinary play (D5). The bot's turn IS its action
//    deck's top entry, so every scenario is forced by the fixture (`automa.actionDeck = [...]`),
//    never by a seed. The three MULTIPLAYER tables (blue · red · the bot) stand at RED's turn with
//    blue PASSED for the generation: the viewer holds no prompt (an out-of-band change reaches only
//    a promptless client), red has one action behind it (its resumed menu offers «End Turn» — the
//    ONE API press that hands the turn to the bot), and the generation goes on afterwards (red is
//    still in), so the table stays exactly as the bot left it while the probe reads it. ──
const BOT_TABLE_CORPORATIONS: ReadonlyArray<CardName> = [CardName.TERACTOR, CardName.THORGATE];

type BotTable = {game: IGame; humans: ReadonlyArray<TestPlayer>; bot: IPlayer; parliament: Parliament; automa: AutomaState};

function botTable(name: string, humans: 1 | 2): BotTable {
  // Teractor and Thorgate: neither has a corporation FIRST ACTION, so red's resumed menu is the ordinary one («End Turn» included) —
  // Aridor's pending first action restricts the menu to «Take first action | Pass» and the API press finds nothing to hand over with.
  const pinned = BOT_TABLE_CORPORATIONS.slice(0, humans);
  const options = {
    coloniesExtension: true, turmoilReduxExpansion: true, startingCorporations: 1,
    keepInitialCardSelection: true, customCorporationsList: [...pinned],
  };
  let game: IGame;
  let seats: ReadonlyArray<TestPlayer>;
  let bot: IPlayer;
  if (humans === 1) {
    const [g, h, b] = testAutomaGame(options);
    game = g;
    seats = [h];
    bot = b;
  } else {
    [game, seats, bot] = testAutomaMultiplayerGame(2, options);
  }
  assignPinnedCorporations(name, seats, pinned);
  if (!(seats[0].getWaitingFor() instanceof SelectInitialCards)) {
    throw new Error(`${name}: expected SelectInitialCards, got ${seats[0].getWaitingFor()?.constructor.name}`);
  }
  answerStartFlow(game, seats);
  // A colony pick on the way to the action phase (a table that removes a tile at the opening): the first tile.
  for (const seat of seats) {
    const wf = seat.getWaitingFor();
    if (wf instanceof SelectColony) {
      seat.process({type: 'colony', colonyName: wf.colonies[0].name});
      runAllActions(game);
    }
  }
  if (game.phase !== Phase.ACTION) {
    throw new Error(`${name}: expected the action phase, got ${game.phase}`);
  }
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error(`the ${name} fixture has no voting area`);
  }
  if (parliament.botMode !== 'politics' || !parliament.participates(bot, 'delegates')) {
    throw new Error(`${name}: the bot holds no delegates (mode ${parliament.botMode})`);
  }
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error(`${name}: not an automa game`);
  }
  for (const seat of seats) {
    seat.megaCredits = 40;
  }
  // THE LOBBYING MANDATE IS PINNED (D14): the bot's further delegates come from a hidden card drawn per generation,
  // and a scenario must never depend on that draw — none here; a scenario about lobbying pins its own.
  automa.lobbyMandate = {generation: game.generation, card: 0, sent: 0};
  return {game, humans: seats, bot, parliament, automa};
}

// ── finale-rich-bot: the finale's PODIUM with MarsBot in the race (TR69 «ФИНАЛ — ЭТО ЦЕРЕМОНИЯ»): two humans (Teractor,
//    Thorgate) + the bot (Credicor), a saturated generation-10 table one greenery from the end — three seats (the stack
//    podium), the bot a SEAT with its own corporation face. The bot leads the rating, so a corporation face of the bot's
//    own stands on the crest. For console-finale-podium.spec.ts (E). ──
{
  const name = 'finale-rich-bot';
  const pinned = BOT_TABLE_CORPORATIONS;
  const [game, seats, bot] = testAutomaMultiplayerGame(2, {
    startingCorporations: 1, keepInitialCardSelection: true, customCorporationsList: [...pinned],
  });
  assignPinnedCorporations(name, seats, pinned);
  answerStartFlow(game, seats);
  if (game.phase !== Phase.ACTION) {
    throw new Error(`${name}: expected the action phase, got ${game.phase}`);
  }
  game.generation = 10;
  const everyone: ReadonlyArray<IPlayer> = [...seats, bot];
  const tiles: ReadonlyArray<[cities: number, greeneries: number]> = [[2, 3], [1, 2], [2, 2]];
  everyone.forEach((p, i) => {
    for (let c = 0; c < tiles[i][0]; c++) {
      addCity(p);
    }
    for (let g = 0; g < tiles[i][1]; g++) {
      addGreenery(p);
    }
  });
  setTemperature(game, MAX_TEMPERATURE);
  maxOutOceans(seats[0]);
  setOxygenLevel(game, MAX_OXYGEN_LEVEL - 1);
  const birds = new Birds();
  birds.resourceCount = 4;
  seats[0].playedCards.push(birds);
  seats[1].playedCards.push(new Trees());
  game.claimedMilestones.push({player: seats[1], milestone: game.milestones[0]});
  game.fundedAwards.push({player: seats[0], award: game.awards[0]});
  seats[0].setTerraformRating(38);
  seats[1].setTerraformRating(35);
  bot.setTerraformRating(44);
  seats[0].megaCredits = 80;
  // A plant reserve the bot's own turn cannot eat (its action deck may remove plants from the richest human) — the
  // viewer must still own a final greenery when the finale opens.
  seats[0].plants = 30;
  seats[1].megaCredits = 30;
  seats[1].plants = 0;
  seats.forEach((p) => p.drawCard(2));
  runAllActions(game);
  if (game.automa === undefined || game.generation !== 10 || game.getOxygenLevel() !== MAX_OXYGEN_LEVEL - 1 ||
      game.board.getOceanSpaces().length !== 9) {
    throw new Error(`${name}: expected a saturated pre-endgame bot table — gen=${game.generation} oxygen=${game.getOxygenLevel()}`);
  }
  write(name, game);
}

/** Blue passes for the generation; red is on the move with ONE action behind it — its resumed menu offers «End Turn». */
function redOnTheMove(t: BotTable, name: string): void {
  const [blue, red] = t.humans;
  if (red === undefined) {
    throw new Error(`${name}: a two-seat table is needed`);
  }
  blue.clearWaitingFor();
  t.game.playerHasPassed(blue);
  t.game.playerIsFinishedTakingActions();
  if (t.game.activePlayer.id !== red.id || !(red.getWaitingFor() instanceof OrOptions)) {
    throw new Error(`${name}: expected red on the move with the action menu, got ${t.game.activePlayer.color} / ${red.getWaitingFor()?.constructor.name}`);
  }
  red.actionsTakenThisRound = 1;
}

/** The bot's deck: the scenario's own entry first, then two cheap project cards whose cost never lobbies (4 and 4). */
function botDeckOf(first: AutomaState['actionDeck'][number]): AutomaState['actionDeck'] {
  return [first, {kind: 'project', name: CardName.POWER_PLANT}, {kind: 'project', name: CardName.BUSINESS_NETWORK}];
}

// ── parliament-bot-vote: B21 Party Politics on top of the bot's deck — its next turn sends the free
//    delegate to a resolution (Aquifer Contest stands first: the star rule has a ★ card to prefer).
//    The table holds no delegates, so the bot's cube is the first on it. ──
{
  const name = 'parliament-bot-vote';
  const t = botTable(name, 2);
  seatResolution(t.parliament, 0, AQUIFER_CONTEST_ID);
  t.automa.actionDeck = botDeckOf({kind: 'bonus', id: BonusCardId.B21_PARTY_POLITICS});
  if (t.parliament.slots.some((slot) => slot.votes.length > 0) || !t.parliament.lobby.has(t.bot.id)) {
    throw new Error(`${name}: expected an empty table and the bot's free delegate in its lobby`);
  }
  redOnTheMove(t, name);
  runAllActions(t.game);
  write(name, t.game);
}

// ── parliament-bot-lobby: Fish (cost 9 — divisible by 3) on top of the bot's deck and the mandate ALL (D14): two cards
//    after Fish can carry four more, so its next turn LOBBIES with TWO delegates at once — the card's trigger and the
//    mandate's catch-up — the lobby's free one first, then one from the reserve (free too). ──
{
  const name = 'parliament-bot-lobby';
  const t = botTable(name, 2);
  seatResolution(t.parliament, 0, AQUIFER_CONTEST_ID);
  t.bot.megaCredits = 20;
  if (!lobbyingTrigger(new Fish().cost)) {
    throw new Error(`${name}: Fish (${new Fish().cost} M€) must trigger lobbying`);
  }
  t.automa.lobbyMandate = {generation: t.game.generation, card: 'all', sent: 0};
  t.automa.actionDeck = botDeckOf({kind: 'project', name: CardName.FISH});
  redOnTheMove(t, name);
  runAllActions(t.game);
  write(name, t.game);
}

// ── parliament-bot-chair: the chairman quest is «Play 2 building tags» (Architecture Award's) with the
//    bot at 1/2 and the office held by BLUE; Power Plant (a building tag) on top of the bot's deck —
//    its next turn completes the quest by its ordinary play: the chair takes its cube, the Agenda
//    marker moves, blue's delegate goes home (D5). ──
{
  const name = 'parliament-bot-chair';
  const t = botTable(name, 2);
  const [blue] = t.humans;
  seatResolution(t.parliament, 0, AQUIFER_CONTEST_ID);
  t.parliament.chairman = blue.id;
  t.parliament.quest = {
    definition: {goal: {kind: 'tag', tag: Tag.BUILDING}, count: 2},
    source: ARCHITECTURE_AWARD_ID, generation: 1, progress: new Map([[t.bot.id, 1]]),
  };
  if (!botQuestReachable(t.parliament.quest.definition.goal, botQuestTableOf(t.game))) {
    throw new Error(`${name}: a building-tag quest must be reachable for the bot`);
  }
  t.automa.actionDeck = botDeckOf({kind: 'project', name: CardName.POWER_PLANT});
  redOnTheMove(t, name);
  runAllActions(t.game);
  write(name, t.game);
}

// ── parliament-bot-win: a SOLO table (the human + the bot) ONE PASS AWAY from the sitting with the bot's free
//    delegate alone on Aquifer Contest — the bot is the WINNING PLAYER, its ★ is an ocean paid by
//    declaration (D4), and the human is a spectator of the whole sitting. The bot's deck is EMPTY,
//    so its one turn is a pass and the generation ends on the human's pass — the spec's own press. ──
{
  const name = 'parliament-bot-win';
  const t = botTable(name, 1);
  seatResolution(t.parliament, 0, AQUIFER_CONTEST_ID);
  t.parliament.placeVote(t.bot, t.parliament.slots[0], 'lobby');
  t.automa.actionDeck = [];
  expectOnePassAway(t.game, name);
  // The verdict, dry-run on a copy: the bot wins the vote.
  const copy = Game.deserialize(structuredClone(t.game.serialize()));
  passTheViewer(copy);
  if (copy.parliament?.lastPhase?.winner.player !== t.bot.id) {
    throw new Error(`${name}: the bot is not the winning player (${copy.parliament?.lastPhase?.winner.player})`);
  }
  write(name, t.game);
}

// ── RX38 · MARS FIRST BUDGET with MarsBot at the table (decision D11) — a SOLO table (blue + the bot under
//    `'politics'`), blue's free delegate alone on the budget (blue wins), blue FIRST in the order with building 2 +
//    Mars 1 (Martian Roads · Mine) and influence 1 after the Agenda step. The bot's site: three greeneries (nobody's)
//    around ONE quiet cell, so its pick («next to as much greenery as possible») is a fact the probe can read. The
//    bot's deck is EMPTY (its one turn is a pass). Two moments of ONE journey, for
//    console-parliament-marsfirst-budget.spec.ts:
//    · `-vote` — blue's action phase with 34 M€: the vote panel reads the net, the two-tag breakdown, the city row
//      with Mars First's answer, and the bot's chip with the tile alone;
//    · `-bot` — ONE PASS AWAY with 20 M€ at the sitting: −12 → 8, +4 → 12, then blue's city (asked), then the
//      bot's city by its own rule;
//    · `-botfirst` (PL-764) — the same table with the BOT first in the order: the bot's city is placed by the law in the
//      very response that asks blue for its own, so the sitting steps aside for it BEFORE blue's door. ──
function marsFirstBudgetBotTable(name: string, stopAt: 'vote' | 'pass' | 'pass-bot-first'): void {
  const t = botTable(name, 1);
  const [human] = t.humans;
  seatResolution(t.parliament, 0, MARS_FIRST_BUDGET_ID);
  t.parliament.placeVote(human, t.parliament.slots[0], 'lobby');
  t.parliament.agenda.set(human.id, 0);
  human.playedCards.push(new MartianRoads(), new Mine());
  // THE BOT'S SITE: a quiet cell (no bonus, no ocean cell beside it, not Noctis) with three free land neighbours.
  const board = t.game.board;
  const centre = board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 0 &&
    s.id !== board.noctisCitySpaceId && !board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN || a.tile !== undefined) &&
    board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.LAND && a.tile === undefined).length >= 4);
  if (centre === undefined) {
    throw new Error(`${name}: no quiet site for the bot's city`);
  }
  for (const grove of board.getAdjacentSpaces(centre).filter((a) => a.spaceType === SpaceType.LAND && a.tile === undefined).slice(0, 3)) {
    grove.tile = {tileType: TileType.GREENERY};
  }
  t.automa.actionDeck = [];
  if (resolutionCount(human, 'buildingMarsTags').count !== 3) {
    throw new Error(`${name}: expected building 2 + Mars 1`);
  }
  if (stopAt === 'vote') {
    // The vote's picture: 34 M€ — −12, then +(3 + influence 0 → 1 if blue wins) — the panel's net reads off it.
    human.megaCredits = 34;
    write(name, t.game);
    return;
  }
  expectOnePassAway(t.game, name);
  if (stopAt === 'pass-bot-first') {
    // THE BOT FIRST (PL-764): «clockwise from the First Player» — the law's seat loop walks the bot's grant before blue's.
    t.game.overrideFirstPlayer(t.bot);
  }
  const firstSeat = stopAt === 'pass-bot-first' ? t.bot.id : human.id;
  if (t.game.playersInGenerationOrder[0].id !== firstSeat) {
    throw new Error(`${name}: ${stopAt === 'pass-bot-first' ? 'the bot' : 'blue'} must place first (the order is ${t.game.playersInGenerationOrder.map((p) => p.color).join(' · ')})`);
  }
  // The money AT the sitting — the production phase pays its income on the pass: 20 M€ there — −12 → 8, then +4 → 12.
  human.megaCredits = 20 - productionIncomeOf(human);
  const copy = Game.deserialize(structuredClone(t.game.serialize()));
  passTheViewer(copy);
  if ((copy.parliament?.phase?.summary ?? copy.parliament?.lastPhase)?.winner.player !== human.id) {
    throw new Error(`${name}: blue is not the winning player (${(copy.parliament?.phase?.summary ?? copy.parliament?.lastPhase)?.winner.player})`);
  }
  write(name, t.game);
}
marsFirstBudgetBotTable('parliament-marsfirst-budget-vote', 'vote');
marsFirstBudgetBotTable('parliament-marsfirst-budget-bot', 'pass');
marsFirstBudgetBotTable('parliament-marsfirst-budget-botfirst', 'pass-bot-first');

// ── RX39 · REDS BUDGET with MarsBot at the table (decisions D3 + D11) — a SOLO table (blue + the bot under `'politics'`)
//    with a NEUTRAL winner (nobody takes the winner's step of the sitting, so each marker walks the LAW's step alone),
//    blue FIRST in the order with space 2 + Mars 1 (Mars Army Ships · Satellites) and an Asteroid face down (the count's
//    most common zero), Agenda 1 = influence 1: the law's step reaches 2, a TR step; the bot on Agenda 6: its step reaches
//    7, a CARD step — 1 M€ for the bot (the Automa FAQ). The bot's deck is EMPTY (its one turn is a pass). Two moments of
//    ONE journey, for console-parliament-reds-budget.spec.ts:
//    · `-vote` — blue's action phase with 15 M€: the vote panel reads the net (−10 + 4), the two-tag breakdown, the
//      Career row with blue's next node (② · +1 TR) and the win's two, and the bot's chip with the STEP alone;
//    · `-bot` — ONE PASS AWAY with 15 M€ at the sitting: −10 → 5, +4 → 9, then blue's step 1 → 2 (+1 TR), then the
//      bot's 6 → 7 (+1 M€) — every beat in turn. ──
function redsBudgetBotTable(name: string, stopAt: 'vote' | 'pass'): void {
  const t = botTable(name, 1);
  const [human] = t.humans;
  seatResolution(t.parliament, 0, REDS_BUDGET_ID);
  // A NEUTRAL winner: no seat's delegate on any card, ONE neutral vote on the budget.
  t.parliament.slots.forEach((slot) => (slot.votes = []));
  t.parliament.addNeutralVote(t.parliament.slots[0]);
  t.parliament.agenda.set(human.id, 1);
  t.parliament.agenda.set(t.bot.id, 6);
  human.playedCards.push(new MarsArmyShips(), new Satellites(), new Asteroid());
  t.automa.actionDeck = [];
  if (resolutionCount(human, 'spaceMarsTags').count !== 3) {
    throw new Error(`${name}: expected space 2 + Mars 1 (the asteroid face down)`);
  }
  if (stopAt === 'vote') {
    human.megaCredits = 15;
    write(name, t.game);
    return;
  }
  expectOnePassAway(t.game, name);
  {
    const copy = Game.deserialize(structuredClone(t.game.serialize()));
    passTheViewer(copy);
    const sitting = copy.parliament?.phase?.summary ?? copy.parliament?.lastPhase;
    if (sitting?.winner.player !== 'NEUTRAL' || copy.parliament?.resolutionOf(sitting.winner.instance).id !== REDS_BUDGET_ID) {
      throw new Error(`${name}: the budget must win with a neutral winner (${sitting?.winner.player})`);
    }
  }
  if (t.game.playersInGenerationOrder[0].id !== human.id) {
    throw new Error(`${name}: blue must walk first (the order is ${t.game.playersInGenerationOrder.map((p) => p.color).join(' · ')})`);
  }
  if (t.parliament.influence(human) !== 1 || t.parliament.agendaOf(t.bot) !== 6) {
    throw new Error(`${name}: expected blue at influence 1 and the bot on Agenda 6`);
  }
  // The money AT the sitting — the production phase pays its income on the pass: 15 M€ there — −10 → 5, then +4 → 9.
  human.megaCredits = 15 - productionIncomeOf(human);
  write(name, t.game);
}
redsBudgetBotTable('parliament-reds-budget-vote', 'vote');
redsBudgetBotTable('parliament-reds-budget-bot', 'pass');

// ── RX40 · SPONSORED PROJECTS (the Scientists — «draw cards equal to your Influence; add 1 resource to each of your cards
//    that already has a resource»): the first card payout that ASKS NOBODY, shown by the RECEIPT OF THE TABLE. Blue
//    (Arklight — 4 animals on the corporation) wins with its delegate: Agenda 2 → 3 = influence 2 → a take of 2 cards;
//    then one of its own kind onto Arklight 4, Fish 2, Dirigibles 1 and Supercomputer 3 — Birds, a holder at 0, receives
//    nothing. Red (Teractor) at Agenda 0 = influence 0: no cards (named), its Pets 1 → 2 by its own payout. Stops at the
//    ASSEMBLY gate for console-parliament-sponsored.spec.ts (the verdict → the take → the receipt → the results). ──
// The same table at the VOTE (`-vote`, blue's delegate still in the lobby): the panel reads both payouts before A.
function sponsoredProjectsTable(name: string, stopAt: 'vote' | 'pass'): void {
  parliamentFixture(name, {
    resolution: SPONSORED_PROJECTS_ID,
    votes: stopAt === 'vote' ? [] : [0],
    agenda: [2, 0],
    stopAt,
    options: {customCorporationsList: [CardName.ARKLIGHT, CardName.TERACTOR]},
    arrange: ({p1, p2}) => {
      const arklight = p1.playedCards.get(CardName.ARKLIGHT);
      if (arklight === undefined) {
        throw new Error(`${name}: blue is not Arklight`);
      }
      arklight.resourceCount = 4;
      p1.playedCards.push(Object.assign(new Fish(), {resourceCount: 2}), Object.assign(new Dirigibles(), {resourceCount: 1}),
        Object.assign(new Supercomputer(), {resourceCount: 3}), new Birds());
      p2.playedCards.push(Object.assign(new Pets(), {resourceCount: 1}));
      // A corporation's first action left pending would be answered by the board-home driver at load (PL-715).
      p1.pendingInitialActions = [];
      p2.pendingInitialActions = [];
    },
    expect: ({p1, p2, parliament}) => {
      const blue = resolutionCount(p1, 'cardsWithResources').cards;
      if (JSON.stringify(blue) !== JSON.stringify([CardName.ARKLIGHT, CardName.FISH, CardName.DIRIGIBLES, CardName.SUPERCOMPUTER])) {
        throw new Error(`${name}: blue's cards with a resource are ${blue.join(', ')}`);
      }
      if (resolutionCount(p2, 'cardsWithResources').count !== 1 || parliament.influence(p2) !== 0) {
        throw new Error(`${name}: red holds Pets 1 at influence 0`);
      }
    },
  });
}
sponsoredProjectsTable('parliament-sponsored-assembly', 'pass');
sponsoredProjectsTable('parliament-sponsored-vote', 'vote');
// …and the RECEIPT'S DENSITY: the same sitting with EIGHT receiving cards on blue's table (the corporation and seven
// holders of four kinds) — the row must read in ONE line, the faces smaller and closer, nothing scrolled or cut.
parliamentFixture('parliament-sponsored-eight', {
  resolution: SPONSORED_PROJECTS_ID,
  votes: [0],
  agenda: [2, 0],
  stopAt: 'pass',
  options: {customCorporationsList: [CardName.ARKLIGHT, CardName.TERACTOR]},
  arrange: ({p1, p2}) => {
    const arklight = p1.playedCards.get(CardName.ARKLIGHT);
    if (arklight === undefined) {
      throw new Error('parliament-sponsored-eight: blue is not Arklight');
    }
    arklight.resourceCount = 4;
    p1.playedCards.push(Object.assign(new Fish(), {resourceCount: 2}), Object.assign(new Pets(), {resourceCount: 1}),
      Object.assign(new Dirigibles(), {resourceCount: 1}), Object.assign(new AtmoCollectors(), {resourceCount: 2}),
      Object.assign(new Tardigrades(), {resourceCount: 3}), Object.assign(new GHGProducingBacteria(), {resourceCount: 1}),
      Object.assign(new Supercomputer(), {resourceCount: 2}));
    p1.pendingInitialActions = [];
    p2.pendingInitialActions = [];
  },
  expect: ({p1}) => {
    if (resolutionCount(p1, 'cardsWithResources').count !== 8) {
      throw new Error(`parliament-sponsored-eight: blue holds ${resolutionCount(p1, 'cardsWithResources').count} cards with a resource, not 8`);
    }
  },
});

// ── RX41 · TAX BREAKS (the Industrialists — «+1 M€ production for each different TYPE of card resource you have +
//    Influence, max 5»): the count BY KIND over the seat's cards with a resource. Blue at Agenda 5 = influence 3 holds
//    Fish 2 + Birds 1 (animals — ONE type), Dirigibles 1 (floaters), Supercomputer 3 (data) and Pets at 0 (no type
//    yet): 3 types + 3 = 6 → +5, MAX — M€ production 2 → 7. Red: at the VOTE (Agenda 1 = influence 1) Tardigrades 2 →
//    its own column reads 1 type + 1 = +2; at the ASSEMBLY (Agenda 0) Tardigrades at 0 → no type and no influence — the
//    long NAMED skip the results plate must print whole (PL-796). `-vote` stops at the vote (blue's delegate in the
//    lobby: the panel reads the kinds before A); `-assembly` at the ASSEMBLY gate with blue's delegate on the card (the
//    verdict → the production wave → the results) for console-parliament-tax-breaks.spec.ts. ──
function taxBreaksTable(name: string, stopAt: 'vote' | 'pass'): void {
  const vote = stopAt === 'vote';
  parliamentFixture(name, {
    resolution: TAX_BREAKS_ID,
    votes: vote ? [] : [0],
    agenda: [5, vote ? 1 : 0],
    stopAt,
    arrange: ({p1, p2}) => {
      p1.playedCards.push(Object.assign(new Fish(), {resourceCount: 2}), Object.assign(new Birds(), {resourceCount: 1}),
        Object.assign(new Dirigibles(), {resourceCount: 1}), Object.assign(new Supercomputer(), {resourceCount: 3}), new Pets());
      p2.playedCards.push(Object.assign(new Tardigrades(), {resourceCount: vote ? 2 : 0}));
      p1.production.override({megacredits: 2});
      p2.production.override({megacredits: 1});
      // A corporation's first action left pending would be answered by the board-home driver at load (PL-715).
      p1.pendingInitialActions = [];
      p2.pendingInitialActions = [];
    },
    expect: ({p1, p2, parliament}) => {
      const blue = resolutionCount(p1, 'cardResourceTypes');
      if (blue.count !== 3 || JSON.stringify(blue.cards) !== JSON.stringify([CardName.FISH, CardName.BIRDS, CardName.DIRIGIBLES, CardName.SUPERCOMPUTER])) {
        throw new Error(`${name}: blue must hold 3 types on 4 cards (Pets at 0 none), got ${JSON.stringify(blue)}`);
      }
      const redKinds = vote ? 1 : 0;
      if (parliament.influence(p1) !== 3 || resolutionCount(p2, 'cardResourceTypes').count !== redKinds || parliament.influence(p2) !== redKinds) {
        throw new Error(`${name}: expected blue at influence 3, red at ${redKinds} type(s) and influence ${redKinds}`);
      }
    },
  });
}
taxBreaksTable('parliament-tax-breaks-vote', 'vote');
taxBreaksTable('parliament-tax-breaks-assembly', 'pass');

// ── RX42 · UNMI VETO (the Reds — «draw cards = influence; while enacted, the player(s) with the highest terraform rating
//    ignore any rating they would gain»): the SECOND REPLACING passive, on the RATING alone. ENACTED: the sitting is
//    over, RED won it (the seat the loader opens in generation 2) and is FIRST BY RATING — 30 against blue's 27 — with
//    30 M€, 8 heat, the temperature at −10 °C and «Bribed Committee» (+2 TR, 7 M€) in hand: every surface that promises
//    a rating must STRIKE it (the rail's stamp, the hand's plate, the wheel's note, the heat confirm's chip, the Asteroid
//    row), and the heat conversion moves the scale while the rating stays 30 (the law's named skip in the journal). ──
parliamentFixture('parliament-unmi-veto-enacted', {
  resolution: UNMI_VETO_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  arrange: ({game, p2}) => {
    setTemperature(game, -10);
    p2.heat = 8;
    p2.cardsInHand.push(new BribedCommittee());
    // The spec spends red's actions (the heat conversion): a corporation's pending first action standing at boot would
    // be answered by the board-home driver and cost the first (PL-715).
    p2.pendingInitialActions = [];
  },
  after: ({p1, p2}) => {
    // The ratings AFTER the sitting (the enactment, the research, the income are all over): red first, blue three below.
    p1.setTerraformRating(27);
    p2.setTerraformRating(30);
    p2.megaCredits = 30;
  },
  expect: (table) => {
    const {game, p1, p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(UNMI_VETO_ID, 0)) {
      throw new Error(`the parliament-unmi-veto-enacted fixture expected UNMI Veto enacted, got ${parliament.enacted}`);
    }
    if (p2.pendingInitialActions.length > 0 || p2.actionsTakenThisRound !== 0) {
      throw new Error('the parliament-unmi-veto-enacted fixture expected red to open generation 2 with both actions and no pending first action');
    }
    if (p2.terraformRating !== 30 || p1.terraformRating !== 27) {
      throw new Error(`the parliament-unmi-veto-enacted fixture expected red first by rating 30 against 27, got ${p2.terraformRating} / ${p1.terraformRating}`);
    }
    if (p2.heat < 8 || p2.megaCredits !== 30) {
      throw new Error(`the parliament-unmi-veto-enacted fixture expected red with 8 heat and 30 M€, has ${p2.heat} / ${p2.megaCredits}`);
    }
    if (game.getTemperature() !== -10) {
      throw new Error(`the parliament-unmi-veto-enacted fixture expected −10 °C, got ${game.getTemperature()}`);
    }
    if (!p2.cardsInHand.some((c) => c.name === CardName.BRIBED_COMMITTEE)) {
      throw new Error('the parliament-unmi-veto-enacted fixture expected red to hold Bribed Committee');
    }
    expectViewerOpensGeneration(table, p2, 'parliament-unmi-veto-enacted');
  },
});
// …and the law AT THE VOTE (`-vote`): UNMI Veto in the first slot, nobody's delegate on it yet, BLUE the viewer and NOT
// first by rating (20 against red's 30) — the vote panel names who the veto would bind right now, with the number.
parliamentFixture('parliament-unmi-veto-vote', {
  resolution: UNMI_VETO_ID,
  votes: [],
  agenda: [1, 2],
  stopAt: 'vote',
  arrange: ({p1, p2}) => {
    p1.setTerraformRating(20);
    p2.setTerraformRating(30);
    p1.pendingInitialActions = [];
    p2.pendingInitialActions = [];
  },
  expect: ({p1, p2}) => {
    if (p1.terraformRating !== 20 || p2.terraformRating !== 30) {
      throw new Error(`the parliament-unmi-veto-vote fixture expected blue 20 / red 30, got ${p1.terraformRating} / ${p2.terraformRating}`);
    }
  },
});

// ── two-player-finale-trigger: the FINALE with a TRIGGERED HAND-OFF (PL-301 / PL-303 — the owner's field
//    report 2026-10-14). A 2p table at the final greenery: the first seat holds the plants and is asked;
//    the second seat is PHILARES with one greenery on a quiet cell, so a greenery landing next to it hands
//    a resource pick to the OTHER seat mid-finale — the first seat's context must stand through it, and
//    the prompt's return must reach it over the socket, never the 20 s fallback poll. ──
{
  const name = 'two-player-finale-trigger';
  const pinned = [CardName.CREDICOR, CardName.PHILARES];
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, promoCardsOption: true, startingCorporations: 1,
    customCorporationsList: [...pinned],
  });
  assignPinnedCorporations(name, [p1, p2], pinned);
  answerStartFlow(game, [p1, p2]);
  // Philares' seat gets one greenery on a QUIET cell (no printed bonus, no neighbour) — the builder places it with
  // the engine's own door (its first action is still pending on its first turn; the finale never takes it).
  const quiet = game.board.getAvailableSpacesForGreenery(p2)
    .find((s) => s.bonus.length === 0 && !game.board.getAdjacentSpaces(s).some((a) => a.tile !== undefined));
  if (quiet === undefined) {
    throw new Error(`${name}: no quiet cell for Philares' greenery`);
  }
  addGreenery(p2, quiet.id);
  runAllActions(game);
  if (!game.board.spaces.some((s) => s.tile?.tileType === TileType.GREENERY && s.player?.id === p2.id)) {
    throw new Error(`${name}: Philares' seat holds no greenery on the board`);
  }
  setTemperature(game, MAX_TEMPERATURE);
  maxOutOceans(p1);
  setOxygenLevel(game, MAX_OXYGEN_LEVEL);
  p1.plants = 16;
  p2.plants = 0;
  p1.clearWaitingFor();
  p2.clearWaitingFor();
  runAllActions(game);
  // The loader re-enters the finale loop on load (PRODUCTION + the game over): the first seat is asked there.
  game.phase = Phase.PRODUCTION;
  write(name, game);
}

// ── mu-research-colony: the FIELD LOCK of 2026-10-14 — «Научная колония» played with «Марсианский университет» on the
//    table. One press, three stages: the play draws 2, asks for its colony (a live step hosted INSIDE the hand), and
//    only then does the university's science tag ask its discard — left for after the draw (the play's own draw comes
//    before it; answerable now too since 2026-10-15), whose one answer is a card from the hand: the hand ALBUM. Blue (seat 0) holds
//    three animal holders, so Miranda's build bonus is a real target pick (asked on the colony stage, riding the
//    colony's own POST); Luna's pays M€ with no question. Two seats (no solo colony-removal pick), Miranda / Luna /
//    Europa / Callisto open, 100 M€, Research Colony + 12 cards in hand. ──
{
  const name = 'mu-research-colony';
  const [game, blue, red] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true,
    customCorporationsList: [CardName.CREDICOR, CardName.CREDICOR], startingCorporations: 1,
  });
  answerStartFlow(game, [blue, red]);
  const colonies = [new Miranda(), new Luna(), new Europa(), new Callisto()];
  for (const colony of colonies) {
    colony.isActive = true;
  }
  game.colonies = colonies;
  const pets = new Pets();
  pets.resourceCount = 3;
  const predators = new Predators();
  predators.resourceCount = 2;
  const birds = new Birds();
  birds.resourceCount = 1;
  blue.playedCards.push(new MarsUniversity(), pets, predators, birds);
  // The game keeps ONE instance of every card: the play's card is the deck's own copy, put on top and drawn.
  moveToDeckTop(game, CardName.RESEARCH_COLONY);
  blue.cardsInHand.length = 0;
  blue.cardsInHand.push(game.projectDeck.drawOrThrow(game));
  while (blue.cardsInHand.length < 13) {
    blue.cardsInHand.push(game.projectDeck.drawOrThrow(game));
  }
  blue.megaCredits = 100;
  red.megaCredits = 40;
  runAllActions(game);
  const card = blue.cardsInHand.find((c) => c.name === CardName.RESEARCH_COLONY);
  if (game.activePlayer.id !== blue.id || !(blue.getWaitingFor() instanceof OrOptions) ||
      card === undefined || !blue.canPlay(card)) {
    throw new Error(`${name}: expected blue on the move with Research Colony playable (active=${game.activePlayer.id})`);
  }
  write(name, game);
}

// ── mu-olympus: THE OWNER'S PHOTO of 2026-10-14 22:21 — «Марсианский университет» played under «Конференция на
//    Олимпе» holding a science. Two table questions in one play: Olympus asks first («remove a science to draw a
//    card, or add one»), the university after it («discard a card to draw one»). Since 2026-10-15 the university WAITS
//    for Olympus' answer in the composer, then — when that answer draws — may be answered now or LEFT FOR AFTER THE DRAW
//    (asked live with Olympus' card in the hand, «НОВАЯ КАРТА»). Two seats, 100 M€, Mars University + 10 cards in hand
//    (the photo's 11), Olympus on blue's table with 1 science (the deck's own copies — one instance of every card). ──
{
  const name = 'mu-olympus';
  const [game, blue, red] = testGame(2, {
    skipInitialCardSelection: false,
    customCorporationsList: [CardName.CREDICOR, CardName.CREDICOR], startingCorporations: 1,
  });
  answerStartFlow(game, [blue, red]);
  moveToDeckTop(game, CardName.OLYMPUS_CONFERENCE);
  const olympus = game.projectDeck.drawOrThrow(game);
  olympus.resourceCount = 1;
  blue.playedCards.push(olympus);
  moveToDeckTop(game, CardName.MARS_UNIVERSITY);
  blue.cardsInHand.length = 0;
  blue.cardsInHand.push(game.projectDeck.drawOrThrow(game));
  while (blue.cardsInHand.length < 11) {
    blue.cardsInHand.push(game.projectDeck.drawOrThrow(game));
  }
  blue.megaCredits = 100;
  red.megaCredits = 40;
  runAllActions(game);
  const card = blue.cardsInHand.find((c) => c.name === CardName.MARS_UNIVERSITY);
  if (game.activePlayer.id !== blue.id || !(blue.getWaitingFor() instanceof OrOptions) ||
      card === undefined || !blue.canPlay(card) || olympus.name !== CardName.OLYMPUS_CONFERENCE) {
    throw new Error(`${name}: expected blue on the move with Mars University playable under Olympus (active=${game.activePlayer.id})`);
  }
  write(name, game);
}

// ── TR53 · FRONTIER LABS — «pay 5 M€: +1 resource to a card that ALREADY has one; draw unless it is science» and the
//    iteration «ресурс на карту — один стандарт» (docs/claude/prompts/project-tr53-frontier-labs.md). Blue's action
//    phase, the Scientists RULING, the card IN THE TABLEAU (the action live) with 20 M€ and four holders of four kinds:
//    Tardigrades (1 microbe → «+1 microbe · +1 card»), Olympus Conference (1 science → «+1 science · no draw»), Martian
//    Census (1 data → a delegate within reach + a card), Pets (0 animals — a NEAR MISS: shown, disabled, «На карте ещё
//    нет ресурса»). Red sits at a pinned corporation with no first action (its wheel must open). The deck's own copies. ──
parliamentFixture('frontier-labs', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.SCIENTISTS));
    const take = (name: CardName, resources: number) => {
      moveToDeckTop(game, name);
      const card = game.projectDeck.drawOrThrow(game);
      card.resourceCount = resources;
      p1.playedCards.push(card);
      return card;
    };
    take(CardName.FRONTIER_LABS, 0);
    take(CardName.TARDIGRADES, 1);
    take(CardName.OLYMPUS_CONFERENCE, 1);
    take(CardName.MARTIAN_CENSUS, 1);
    take(CardName.PETS, 0);
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.playedCards.get(CardName.FRONTIER_LABS) as FrontierLabs | undefined;
    const candidates = card === undefined ? [] : card.target(p1).getCards().map((c) => c.name);
    if (card === undefined || !card.canAct(p1) || p1.megaCredits !== 20 || parliament.rulingParty() !== PartyName.SCIENTISTS ||
        candidates.length !== 3 || candidates.includes(CardName.PETS)) {
      throw new Error(`the frontier-labs fixture expected TR53 live on 20 M€, the Scientists ruling and three candidates (Pets a near miss) — got canAct=${card?.canAct(p1)} mc=${p1.megaCredits} ruling=${parliament.rulingParty()} candidates=${candidates.join(', ')}`);
    }
    parliament.assertLedger(game);
  },
});

// ── RECEIVE · THE FIELD — the live «on which card» pick the BOARD raises, and the silent arrival beside it (the TR53
//    iteration, cases 3 and 4). An Ares table (hazards off) in blue's action phase, 24 plants (three greeneries) and ONE
//    blue city C on Mars, so every greenery of the stand goes into C's ring; around C:
//      · X — a printed MICROBE bonus; blue holds TWO microbe holders (Tardigrades 1, Decomposers 0) → the live pick,
//            named by the CELL (`{kind: 'space'}` · `fromSpace` X);
//      · Y — a free cell beside red's Ecological Zone (Ares) whose ADJACENCY bonus is an animal; blue holds TWO animal
//            holders (Pets 1, Small Animals 0) → the live pick, named by the Ares card, its unit leaving that tile;
//      · Z — a printed DATA bonus; blue holds ONE data holder (Martian Census 1) → no question: the field pays and the
//            board's own scene plays (case 4).
//    The Ares tile T stands next to Y only (never next to X or Z — a second adjacency payout would muddy the stand).
//    A quiet government (the Industrialists by Central Power Grid). Red sits at a pinned corporation with no first
//    action. The cell ids are printed by the generator. ──
parliamentFixture('receive-board', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {aresExtension: true, customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, p2, parliament}) => {
    seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
    const board = game.board;
    // A cell the stand may DRESS: land, no tile, not a named/reserved cell (its printed bonus is set below where it matters).
    const free = (s: Space) => s.spaceType === SpaceType.LAND && s.tile === undefined && !s.bonus.includes(SpaceBonus.OCEAN);
    let chosen: {c: Space, x: Space, y: Space, z: Space, t: Space} | undefined;
    for (const c of board.spaces.filter((s) => free(s) && board.getAdjacentSpaces(s).every((a) => a.spaceType === SpaceType.LAND))) {
      const ring = board.getAdjacentSpaces(c).filter(free);
      if (ring.length < 6) {
        continue;
      }
      const [x, , y, , z] = ring;
      const t = board.getAdjacentSpaces(y).find((s) => free(s) && s.id !== c.id && !ring.includes(s) &&
        !board.getAdjacentSpaces(s).some((n) => n.id === x.id || n.id === z.id));
      if (t !== undefined) {
        chosen = {c, x, y, z, t};
        break;
      }
    }
    if (chosen === undefined) {
      throw new Error('receive-board: no cell with a free ring of six and a lone neighbour for the Ares tile');
    }
    const {c, x, y, z, t} = chosen;
    game.simpleAddTile(p1, c, {tileType: TileType.CITY});
    x.bonus = [SpaceBonus.MICROBE];
    y.bonus = [];
    z.bonus = [SpaceBonus.DATA];
    game.simpleAddTile(p2, t, {tileType: TileType.ECOLOGICAL_ZONE, card: CardName.ECOLOGICAL_ZONE_ARES});
    t.adjacency = {bonus: [SpaceBonus.ANIMAL]};
    const take = (name: CardName, resources: number) => {
      moveToDeckTop(game, name);
      const card = game.projectDeck.drawOrThrow(game);
      card.resourceCount = resources;
      p1.playedCards.push(card);
    };
    take(CardName.TARDIGRADES, 1);
    take(CardName.DECOMPOSERS, 0);
    take(CardName.PETS, 1);
    take(CardName.SMALL_ANIMALS, 0);
    take(CardName.MARTIAN_CENSUS, 1);
    p1.plants = 24;
    console.log(`receive-board cells: city ${c.id} · microbe X ${x.id} · ares Y ${y.id} (tile ${t.id}) · data Z ${z.id}`);
  },
  expect: ({game, p1, parliament}) => {
    const microbeX = game.board.spaces.find((s) => s.bonus.includes(SpaceBonus.MICROBE) && s.tile === undefined);
    const dataZ = game.board.spaces.find((s) => s.bonus.includes(SpaceBonus.DATA) && s.tile === undefined);
    const ares = game.board.spaces.find((s) => s.adjacency?.bonus.includes(SpaceBonus.ANIMAL));
    if (p1.plants !== 24 || microbeX === undefined || dataZ === undefined || ares?.tile?.tileType !== TileType.ECOLOGICAL_ZONE ||
        game.gameOptions.aresExtension !== true || parliament.rulingParty() !== PartyName.INDUSTRIALISTS) {
      throw new Error(`the receive-board fixture expected 24 plants, a microbe cell, a data cell and the Ares zone with its animal — got plants=${p1.plants} x=${microbeX?.id} z=${dataZ?.id} ares=${ares?.id}`);
    }
    parliament.assertLedger(game);
  },
});

// ── RECEIVE · THE COLONY — «somebody traded on my colony: which card takes the floater?» (the TR53 iteration, case 3,
//    decision 3). A Venus table: blue owns a cube on Titan and TWO floater holders (Dirigibles 1, Aerial Mappers 0);
//    RED IS ON THE MOVE with 3 energy and a free fleet — red's trade with Titan pays blue's owner bonus (one floater)
//    as a DETACHED live pick on blue's screen. Luna beside it. A quiet government. The Venus tables' pinned
//    corporations (red's first move is its own). ──
parliamentFixture('receive-colony', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {venusNextExtension: true, customCorporationsList: [...VENUS_TABLE_CORPORATIONS]},
  arrange: ({game, p1, p2, parliament}) => {
    seatEnacted(parliament, CENTRAL_POWER_GRID_ID);
    const luna = new Luna();
    const titan = new Titan();
    for (const colony of [luna, titan]) {
      colony.isActive = true;
    }
    game.colonies = [luna, titan];
    titan.colonies.push(p1.id);
    const take = (name: CardName, resources: number) => {
      moveToDeckTop(game, name);
      const card = game.projectDeck.drawOrThrow(game);
      card.resourceCount = resources;
      p1.playedCards.push(card);
    };
    take(CardName.DIRIGIBLES, 1);
    take(CardName.AERIAL_MAPPERS, 0);
    p2.energy = 3;
    p1.clearWaitingFor();
    game.playerIsFinishedTakingActions();
  },
  expect: ({game, p1, p2, parliament}) => {
    const titan = game.colonies.find((c) => c.name === ColonyName.TITAN);
    if (titan === undefined || !titan.colonies.includes(p1.id) || game.activePlayer.id !== p2.id || !(p2.getWaitingFor() instanceof OrOptions) ||
        p2.energy !== 3 || p1.playedCards.get(CardName.DIRIGIBLES)?.resourceCount !== 1 || parliament.rulingParty() !== PartyName.INDUSTRIALISTS) {
      throw new Error(`the receive-colony fixture expected blue's cube on Titan, red on the move with 3 energy and the action menu, Dirigibles ×1 — got active=${game.activePlayer.color} energy=${p2.energy}`);
    }
    parliament.assertLedger(game);
  },
});

// ── TR55 · NUCLEAR WARHEAD UTILIZATION («Утилизация ядерных боеголовок») and the iteration «ЯЧЕЙКА ПО — КАЖДОЕ ОЧКО ИЗ
//    СВОЕЙ ПРИЧИНЫ» (docs/claude/prompts/project-tr55-nuclear-warhead-utilization.md, docs/claude/console/score-cell.md).
//    Blue's action phase, the Industrialists RULING (Central Power Grid enacted), TR55 in hand with 20 M€: the play's
//    «+9 energy» lands on the rail, its printed «2 VP» flies from the landed card's badge into the score cell. Red sits
//    at a pinned corporation with no first action. ──
parliamentFixture('nuclear-warhead-utilization', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
    moveToDeckTop(game, CardName.NUCLEAR_WARHEAD_UTILIZATION);
    p1.cardsInHand.push(game.projectDeck.drawOrThrow(game));
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.NUCLEAR_WARHEAD_UTILIZATION);
    if (card === undefined || !p1.canPlay(card) || p1.megaCredits !== 20 || parliament.rulingParty() !== PartyName.INDUSTRIALISTS ||
        game.activePlayer.id !== p1.id) {
      throw new Error(`the nuclear-warhead-utilization fixture expected TR55 playable on 20 M€ with the Industrialists ruling and blue on the move — got card=${card !== undefined} canPlay=${card === undefined ? '-' : p1.canPlay(card)} mc=${p1.megaCredits} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});

// ── TR55 · the same hand with the Reds RULING and the Industrialists' resolution on the vote with no delegate of blue's:
//    the card stands «✕ Нельзя разыграть» and names the party and both roads (the TR15 class). ──
parliamentFixture('nuclear-warhead-locked', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.REDS));
    if (parliament.slotOf(PartyName.INDUSTRIALISTS) === undefined) {
      seatResolution(parliament, 0, quietResolutionOf(PartyName.INDUSTRIALISTS));
    }
    moveToDeckTop(game, CardName.NUCLEAR_WARHEAD_UTILIZATION);
    p1.cardsInHand.push(game.projectDeck.drawOrThrow(game));
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.NUCLEAR_WARHEAD_UTILIZATION);
    if (card === undefined || p1.canPlay(card) || parliament.rulingParty() !== PartyName.REDS || parliament.slotOf(PartyName.INDUSTRIALISTS) === undefined) {
      throw new Error(`the nuclear-warhead-locked fixture expected TR55 UNplayable under the Reds with the Industrialists' resolution on the vote — got card=${card !== undefined} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});

// ── TR54 · OVERCLOCKED EQUIPMENT («Разогнанное оборудование») and the iteration «ПАЛИТРА СТАНДАРТНОГО РЕСУРСА»
//    (docs/claude/prompts/project-tr54-overclocked-equipment.md, docs/TURMOIL_REDUX_OVERCLOCKED_EQUIPMENT.md). Blue's
//    action phase, the Industrialists RULING, TR54 in hand with 20 M€ and 5 energy, six different productions (M€ −1 —
//    a named zero, steel 2, titanium 0 — a zero, plants 3, energy 1, heat 4): the play's composer asks «which
//    resource» as ONE palette of six tiles, the «−3 [energy]» leaves the rail before the lift, the chosen resource is
//    born on the face's printed «?». ──
const OVERCLOCKED_PRODUCTION = {megacredits: -1, steel: 2, titanium: 0, plants: 3, energy: 1, heat: 4};
function overclockedHand(game: IGame, p1: IPlayer, energy: number): void {
  moveToDeckTop(game, CardName.OVERCLOCKED_EQUIPMENT);
  p1.cardsInHand.push(game.projectDeck.drawOrThrow(game));
  p1.energy = energy;
  p1.production.override(OVERCLOCKED_PRODUCTION);
}
parliamentFixture('overclocked-equipment', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
    overclockedHand(game, p1, 5);
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.OVERCLOCKED_EQUIPMENT);
    if (card === undefined || !p1.canPlay(card) || p1.megaCredits !== 20 || p1.energy !== 5 || p1.production.plants !== 3 ||
        parliament.rulingParty() !== PartyName.INDUSTRIALISTS || game.activePlayer.id !== p1.id) {
      throw new Error(`the overclocked-equipment fixture expected TR54 playable on 20 M€ / 5 energy with the Industrialists ruling and blue on the move — got card=${card !== undefined} canPlay=${card === undefined ? '-' : p1.canPlay(card)} mc=${p1.megaCredits} energy=${p1.energy} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});

// ── TR54 · the same hand with the Reds RULING and the Industrialists' resolution on the vote with no delegate of blue's:
//    «✕ Нельзя разыграть», the party and both roads (the TR15 class). ──
parliamentFixture('overclocked-equipment-locked', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.REDS));
    if (parliament.slotOf(PartyName.INDUSTRIALISTS) === undefined) {
      seatResolution(parliament, 0, quietResolutionOf(PartyName.INDUSTRIALISTS));
    }
    overclockedHand(game, p1, 5);
  },
  expect: ({p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.OVERCLOCKED_EQUIPMENT);
    if (card === undefined || p1.canPlay(card) || parliament.rulingParty() !== PartyName.REDS) {
      throw new Error(`the overclocked-equipment-locked fixture expected TR54 UNplayable under the Reds — got card=${card !== undefined} ruling=${parliament.rulingParty()}`);
    }
  },
});

// ── TR54 · the Industrialists RULING, 2 energy: the ONE blocker is the price — «✕ Недостаточно энергии». ──
parliamentFixture('overclocked-equipment-energy', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
    overclockedHand(game, p1, 2);
  },
  expect: ({p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.OVERCLOCKED_EQUIPMENT);
    if (card === undefined || p1.canPlay(card) || p1.energy !== 2 || parliament.rulingParty() !== PartyName.INDUSTRIALISTS) {
      throw new Error(`the overclocked-equipment-energy fixture expected TR54 UNplayable on 2 energy — got card=${card !== undefined} energy=${p1.energy}`);
    }
  },
});

// ── T04 · DIASPORA MOVEMENT — the first CLASSIC Turmoil card dealt to a Redux table (the hold-back list's first row
//    gone). Blue holds it on 20 M€ with a Jovian tag of its own on the table (Colonizer Training Camp) and red one
//    (Methane From Titan): the play counts 3 — its own tag included. Both cards are MOVED out of the dealt pool, never
//    copied (moveToDeckTop), so the deal stays the engine's.
//      · `diaspora-movement` — the Reds RULE (their quiet law enacted): playable, «+3 M€ · 3 Jovian tags»;
//      · `diaspora-movement-locked` — another party rules and the Reds' resolution stands on the vote with ONE
//        delegate of blue's: «✕» with both roads, «1 of 2». ──
function diasporaTable(game: IGame, p1: IPlayer, p2: IPlayer): void {
  for (const [name, owner] of [[CardName.COLONIZER_TRAINING_CAMP, p1], [CardName.METHANE_FROM_TITAN, p2]] as const) {
    moveToDeckTop(game, name);
    owner.playedCards.push(game.projectDeck.drawOrThrow(game));
  }
  moveToDeckTop(game, CardName.DIASPORA_MOVEMENT);
  p1.cardsInHand.push(game.projectDeck.drawOrThrow(game));
}
function jovianInPlay(game: IGame): number {
  return game.players.reduce((sum, player) => sum + player.tags.count(Tag.JOVIAN, 'raw'), 0);
}
parliamentFixture('diaspora-movement', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, p2, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.REDS));
    diasporaTable(game, p1, p2);
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.DIASPORA_MOVEMENT);
    if (card === undefined || !p1.canPlay(card) || jovianInPlay(game) !== 2 || parliament.rulingParty() !== PartyName.REDS || game.activePlayer.id !== p1.id) {
      throw new Error(`the diaspora-movement fixture expected T04 playable with the Reds ruling, 2 Jovian tags in play (+ its own = 3) and blue on the move — got card=${card !== undefined} canPlay=${card === undefined ? '-' : p1.canPlay(card)} jovian=${jovianInPlay(game)} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});
parliamentFixture('diaspora-movement-locked', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, p2, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
    const slot = parliament.slotOf(PartyName.REDS) === undefined ? 0 : parliament.slots.indexOf(parliament.slotOf(PartyName.REDS)!);
    if (parliament.slotOf(PartyName.REDS) === undefined) {
      seatResolution(parliament, slot, quietResolutionOf(PartyName.REDS));
    }
    parliament.placeVote(p1, parliament.slots[slot], 'lobby');
    diasporaTable(game, p1, p2);
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.DIASPORA_MOVEMENT);
    const reds = parliament.slotOf(PartyName.REDS);
    const delegates = reds === undefined ? -1 : parliament.votesOf(p1, reds);
    if (card === undefined || p1.canPlay(card) || delegates !== 1 || parliament.rulingParty() === PartyName.REDS) {
      throw new Error(`the diaspora-movement-locked fixture expected T04 UNplayable — the Reds not ruling, one delegate of blue's on their resolution — got card=${card !== undefined} delegates=${delegates} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});

// ── T12 · RED TOURISM WAVE — «+1 M€ for each EMPTY area adjacent to your tiles»: the first classic card whose result is
//    a SET OF CELLS (the counted play carries them; L3 «Показать на поле» lights them). The Reds RULE (their quiet law
//    enacted); T12 MOVED out of the dealt pool into blue's hand (never copied).
//      · `red-tourism` — blue's two greeneries on 50 · 51 and red's city on one of their land neighbours (an area
//        taken away, red's own areas never blue's); 20 M€;
//      · `red-tourism-zero` — blue has no tile at all (red's greenery stands): the honest zero, named. ──
function redTourismToHand(game: IGame, p1: IPlayer): void {
  moveToDeckTop(game, CardName.RED_TOURISM_WAVE);
  p1.cardsInHand.push(game.projectDeck.drawOrThrow(game));
}
function redTourismExpect(name: string, p1: IPlayer, parliament: Parliament, count: (n: number) => boolean): void {
  const card = p1.cardsInHand.find((c) => c.name === CardName.RED_TOURISM_WAVE);
  const n = RedTourismWave.getAdjacentEmptySpacesCount(p1);
  if (card === undefined || !p1.canPlay(card) || parliament.rulingParty() !== PartyName.REDS || !count(n) ||
    RedTourismWave.getAdjacentEmptySpaces(p1).length !== n) {
    throw new Error(`the ${name} fixture expected T12 playable with the Reds ruling — got card=${card !== undefined} canPlay=${card === undefined ? '-' : p1.canPlay(card)} ruling=${parliament.rulingParty()} areas=${n}`);
  }
}
parliamentFixture('red-tourism', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, p2, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.REDS));
    addGreenery(p1, '50' as SpaceId);
    addGreenery(p1, '51' as SpaceId);
    const neighbour = game.board.getAdjacentSpaces(game.board.getSpaceOrThrow('50' as SpaceId)).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined);
    if (neighbour === undefined) {
      throw new Error('red-tourism: no free land neighbour of 50 for the rival city');
    }
    addCity(p2, neighbour.id);
    redTourismToHand(game, p1);
  },
  expect: ({game, p1, parliament}) => {
    redTourismExpect('red-tourism', p1, parliament, (n) => n >= 5);
    if (game.activePlayer.id !== p1.id) {
      throw new Error('red-tourism: blue is not on the move');
    }
    parliament.assertLedger(game);
  },
});
parliamentFixture('red-tourism-zero', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, p2, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.REDS));
    addGreenery(p2, '50' as SpaceId);
    redTourismToHand(game, p1);
  },
  expect: ({game, p1, parliament}) => {
    redTourismExpect('red-tourism-zero', p1, parliament, (n) => n === 0);
    parliament.assertLedger(game);
  },
});

// ── T06 · GMO CONTRACT — the first classic Turmoil card with a live EFFECT on a Redux table: 2 M€ for each plant /
//    animal / microbe tag blue plays, its own microbe included. Every card is MOVED out of the dealt pool, never
//    copied (moveToDeckTop), so the deal stays the engine's.
//      · `gmo-contract` — the Greens RULE (their quiet law enacted), the contract already on blue's table; in hand
//        Lichen (a plant tag: +2 — the temperature at −24 °C), Ecology Research (plant + animal + microbe: +6) and Pets (an animal on itself and
//        an animal tag: +2 — the play's own gain beside the table's answer); 30 M€;
//      · `gmo-contract-hand` — the Greens rule, the contract in hand (its own microbe tag answers its own play: +2);
//      · `gmo-contract-locked` — another party rules and the Greens' resolution stands on the vote with ONE delegate
//        of blue's: «✕», «1 of 2». ──
function gmoToHand(game: IGame, p1: IPlayer, names: ReadonlyArray<CardName>): void {
  for (const name of names) {
    moveToDeckTop(game, name);
    p1.cardsInHand.push(game.projectDeck.drawOrThrow(game));
  }
}
function gmoExpectPlayable(name: string, p1: IPlayer, cards: ReadonlyArray<CardName>): void {
  for (const card of cards) {
    const inHand = p1.cardsInHand.find((c) => c.name === card);
    if (inHand === undefined || !p1.canPlay(inHand)) {
      throw new Error(`the ${name} fixture expected ${card} playable from blue's hand — got inHand=${inHand !== undefined}`);
    }
  }
}
parliamentFixture('gmo-contract', {
  stopAt: 'vote',
  megacredits: [30, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.GREENS));
    // Lichen asks −24 °C — the temperature stands there (three steps of nobody's, set before the play).
    setTemperature(game, -24);
    moveToDeckTop(game, CardName.GMO_CONTRACT);
    p1.playedCards.push(game.projectDeck.drawOrThrow(game));
    gmoToHand(game, p1, [CardName.LICHEN, CardName.ECOLOGY_RESEARCH, CardName.PETS]);
  },
  expect: ({game, p1, parliament}) => {
    if (!p1.tableau.has(CardName.GMO_CONTRACT) || parliament.rulingParty() !== PartyName.GREENS || game.activePlayer.id !== p1.id) {
      throw new Error(`the gmo-contract fixture expected GMO Contract on blue's table, the Greens ruling and blue on the move — got ruling=${parliament.rulingParty()}`);
    }
    gmoExpectPlayable('gmo-contract', p1, [CardName.LICHEN, CardName.ECOLOGY_RESEARCH, CardName.PETS]);
    parliament.assertLedger(game);
  },
});
parliamentFixture('gmo-contract-hand', {
  stopAt: 'vote',
  megacredits: [30, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.GREENS));
    gmoToHand(game, p1, [CardName.GMO_CONTRACT]);
  },
  expect: ({game, p1, parliament}) => {
    if (parliament.rulingParty() !== PartyName.GREENS || game.activePlayer.id !== p1.id) {
      throw new Error(`the gmo-contract-hand fixture expected the Greens ruling and blue on the move — got ruling=${parliament.rulingParty()}`);
    }
    gmoExpectPlayable('gmo-contract-hand', p1, [CardName.GMO_CONTRACT]);
    parliament.assertLedger(game);
  },
});
parliamentFixture('gmo-contract-locked', {
  stopAt: 'vote',
  megacredits: [30, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
    if (parliament.slotOf(PartyName.GREENS) === undefined) {
      seatResolution(parliament, 0, quietResolutionOf(PartyName.GREENS));
    }
    parliament.placeVote(p1, parliament.slotOf(PartyName.GREENS)!, 'lobby');
    gmoToHand(game, p1, [CardName.GMO_CONTRACT]);
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.GMO_CONTRACT);
    const greens = parliament.slotOf(PartyName.GREENS);
    const delegates = greens === undefined ? -1 : parliament.votesOf(p1, greens);
    if (card === undefined || p1.canPlay(card) || delegates !== 1 || parliament.rulingParty() === PartyName.GREENS) {
      throw new Error(`the gmo-contract-locked fixture expected T06 UNplayable — the Greens not ruling, one delegate of blue's on their resolution — got card=${card !== undefined} delegates=${delegates} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});

// ── T09 · PR OFFICE — the third classic Turmoil card on a Redux table: «+1 TR; +1 M€ for each Earth tag you have,
//    including this». Blue holds it on 20 M€ with two Earth tags of its own (Teractor's · Sponsors on the table) and
//    red one (Earth Office): the play counts 3 — its own tag included, red's never. Every card is MOVED out of the
//    dealt pool, never copied (moveToDeckTop).
//      · `pr-office` — Unity RULE (their quiet law enacted): playable, «+1 TR» · «+3 M€ · 3 Earth tags»; the bench of
//        the flights' second iteration plays it as its cell (з) — the PLAY's rail half (TR + M€) under a slow answer;
//      · `pr-office-locked` — another party rules and Unity's resolution stands on the vote with ONE delegate of
//        blue's: «✕» with both roads, «1 of 2». ──
function prOfficeTable(game: IGame, p1: IPlayer, p2: IPlayer): void {
  for (const [name, owner] of [[CardName.SPONSORS, p1], [CardName.EARTH_OFFICE, p2]] as const) {
    moveToDeckTop(game, name);
    owner.playedCards.push(game.projectDeck.drawOrThrow(game));
  }
  moveToDeckTop(game, CardName.PR_OFFICE);
  p1.cardsInHand.push(game.projectDeck.drawOrThrow(game));
}
parliamentFixture('pr-office', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, p2, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.UNITY));
    prOfficeTable(game, p1, p2);
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.PR_OFFICE);
    const earth = p1.tags.count(Tag.EARTH, 'raw');
    if (card === undefined || !p1.canPlay(card) || earth !== 2 || parliament.rulingParty() !== PartyName.UNITY || game.activePlayer.id !== p1.id) {
      throw new Error(`the pr-office fixture expected T09 playable with Unity ruling, 2 Earth tags of blue's (+ its own = 3) and blue on the move — got card=${card !== undefined} canPlay=${card === undefined ? '-' : p1.canPlay(card)} earth=${earth} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});
parliamentFixture('pr-office-locked', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, p2, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
    if (parliament.slotOf(PartyName.UNITY) === undefined) {
      seatResolution(parliament, 0, quietResolutionOf(PartyName.UNITY));
    }
    parliament.placeVote(p1, parliament.slotOf(PartyName.UNITY)!, 'lobby');
    prOfficeTable(game, p1, p2);
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.PR_OFFICE);
    const unity = parliament.slotOf(PartyName.UNITY);
    const delegates = unity === undefined ? -1 : parliament.votesOf(p1, unity);
    if (card === undefined || p1.canPlay(card) || delegates !== 1 || parliament.rulingParty() === PartyName.UNITY) {
      throw new Error(`the pr-office-locked fixture expected T09 UNplayable — Unity not ruling, one delegate of blue's on their resolution — got card=${card !== undefined} delegates=${delegates} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});

// ── THE SCORE CELL'S SOURCES, blue on the move (TR55): Terraformer claimable (TR 35, 30 M€ — the milestone's +5 flies
//    from its ceremony), Security Fleet on the table with no fighter and 2 titanium (the ACTION's fighter brings its
//    point on its touchdown — К-V2: the preview carries no `vpBox` for the card's own capsule). A quiet government. ──
parliamentFixture('vp-cell-sources', {
  stopAt: 'vote',
  megacredits: [30, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
    p1.setTerraformRating(35);
    moveToDeckTop(game, CardName.SECURITY_FLEET);
    p1.playedCards.push(game.projectDeck.drawOrThrow(game));
    p1.titanium = 2;
  },
  expect: ({game, p1, parliament}) => {
    const terraformer = game.milestones.find((m) => m.name.startsWith('Terraformer'));
    const fleetActs = p1.getPlayableActionCards().some((c) => c.name === CardName.SECURITY_FLEET);
    if (terraformer === undefined || !terraformer.canClaim(p1) || !fleetActs || p1.megaCredits !== 30 ||
        game.activePlayer.id !== p1.id) {
      throw new Error(`the vp-cell-sources fixture expected Terraformer claimable, Security Fleet able to act and blue on the move with 30 M€ — got milestones=${game.milestones.map((m) => m.name).join(',')} claim=${terraformer?.canClaim(p1)} act=${fleetActs} mc=${p1.megaCredits}`);
    }
    parliament.assertLedger(game);
  },
});

// ── THE SCORE CELL AND A FOREIGN TILE (TR55, the owner's decision 5): blue's city C stands alone on a clean cell; red is
//    on the move with 8 plants and a clean cell G beside C is legal for red's greenery — red's greenery raises BLUE's
//    score by the city's adjacency, and blue's cell waits for that tile to land on blue's screen. The cells are read off
//    the board by the spec (blue's only city; the clean free neighbour). ──
parliamentFixture('vp-cell-rival', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, p2, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
    const board = game.board;
    const clean = (s: Space) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 0;
    const city = board.spaces.find((s) => clean(s) && board.getAdjacentSpaces(s).filter(clean).length >= 4);
    if (city === undefined) {
      throw new Error('vp-cell-rival: no clean cell with four clean neighbours');
    }
    game.simpleAddTile(p1, city, {tileType: TileType.CITY});
    p2.plants = 8;
    p1.clearWaitingFor();
    game.playerIsFinishedTakingActions();
  },
  expect: ({game, p1, p2, parliament}) => {
    const city = game.board.spaces.find((s) => s.tile?.tileType === TileType.CITY && s.player?.id === p1.id);
    const greenery = city === undefined ? undefined :
      game.board.getAdjacentSpaces(city).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 0 &&
        game.board.getAvailableSpacesForGreenery(p2).some((g) => g.id === s.id));
    // THE DRY RUN — red's greenery beside C, for real, on a copy: blue's score moves by the city's adjacency.
    let delta: number | undefined;
    if (greenery !== undefined) {
      const copy = Game.deserialize(structuredClone(game.serialize()));
      const blue = copy.getPlayerById(p1.id);
      const before = blue.getVictoryPoints().total;
      copy.addGreenery(copy.getPlayerById(p2.id), copy.board.getSpaceOrThrow(greenery.id));
      runAllActions(copy);
      delta = blue.getVictoryPoints().total - before;
    }
    if (city === undefined || greenery === undefined || delta !== 1 || game.activePlayer.id !== p2.id || !(p2.getWaitingFor() instanceof OrOptions) || p2.plants !== 8) {
      throw new Error(`the vp-cell-rival fixture expected blue's lone city, a clean legal greenery cell beside it for red, red on the move with 8 plants, and red's greenery adding 1 to blue's score — got city=${city?.id} greenery=${greenery?.id} delta=${delta} active=${game.activePlayer.color}`);
    }
    console.log(`vp-cell-rival: blue's city ${city.id}, red's greenery cell ${greenery.id}`);
    parliament.assertLedger(game);
  },
});

// ── TR56 · ROBOTICS FACTORY («Фабрика роботов») and the iteration «КУДА ЛЯЖЕТ» (docs/claude/prompts/project-tr56-robotics-
//    factory.md, docs/TURMOIL_REDUX_ROBOTICS_FACTORY.md). Blue's action phase, the Industrialists RULING, TR56 in hand
//    with 20 M€; the holder sets the fixtures differ by:
//      · `robotics-factory`         — Construction Mechs (2 mechs — the Building tender), Security Fleet (1 fighter — VP),
//                                     Dirigibles + Aerial Mappers (floaters): three tiles, three address sets;
//      · `robotics-factory-one`     — Dirigibles only: the mech and fighter tiles greyed with their reason;
//      · `robotics-factory-none`    — no holder of any kind: the card STILL plays, the three skips named;
//      · `robotics-factory-mechpay` — Construction Mechs with 3 mechs and 2 M€: the mechs pay for the Building tag, the
//                                     factory puts 3 back (the price leaves the capsule before the gain lands);
//      · `robotics-factory-locked`  — the Reds ruling, the Industrialists' resolution on the vote with no delegate of blue's.
//    Red sits at a pinned corporation with no first action. ──
function roboticsFixture(name: string, spec: {
  holders: 'all' | 'floaters' | 'none' | 'mechpay',
  ruling?: PartyName.REDS | PartyName.INDUSTRIALISTS,
  megacredits?: number,
}): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [spec.megacredits ?? 20, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({p1, parliament}) => {
      const ruling = spec.ruling ?? PartyName.INDUSTRIALISTS;
      seatEnacted(parliament, quietResolutionOf(ruling));
      if (ruling !== PartyName.INDUSTRIALISTS && parliament.slotOf(PartyName.INDUSTRIALISTS) === undefined) {
        seatResolution(parliament, 0, quietResolutionOf(PartyName.INDUSTRIALISTS));
      }
      p1.megaCredits = spec.megacredits ?? 20;
      if (spec.holders === 'all' || spec.holders === 'mechpay') {
        const mechs = new ConstructionMechs();
        mechs.resourceCount = spec.holders === 'mechpay' ? 3 : 2;
        p1.playedCards.push(mechs);
      }
      if (spec.holders === 'all') {
        const fleet = new SecurityFleet();
        fleet.resourceCount = 1;
        p1.playedCards.push(fleet);
      }
      if (spec.holders === 'all' || spec.holders === 'floaters') {
        p1.playedCards.push(new Dirigibles());
      }
      if (spec.holders === 'all') {
        p1.playedCards.push(new AerialMappers());
      }
      p1.cardsInHand.push(new RoboticsFactory());
    },
    expect: ({game, p1, parliament}) => {
      const card = p1.cardsInHand.find((c) => c.name === CardName.ROBOTICS_FACTORY);
      const playable = card !== undefined && p1.canPlay(card);
      const wantPlayable = (spec.ruling ?? PartyName.INDUSTRIALISTS) === PartyName.INDUSTRIALISTS;
      if (card === undefined || playable !== wantPlayable || game.activePlayer.id !== p1.id) {
        throw new Error(`the ${name} fixture expected TR56 ${wantPlayable ? 'playable' : 'UNplayable'} with blue on the move — got card=${card !== undefined} playable=${playable} ruling=${parliament.rulingParty()} active=${game.activePlayer.color}`);
      }
      if (spec.holders === 'mechpay' && (p1.getSpendable('constructionMechs') !== 3 || p1.megaCredits !== 2)) {
        throw new Error(`the ${name} fixture expected 3 spendable mechs and 2 M€ — got mechs=${p1.getSpendable('constructionMechs')} mc=${p1.megaCredits}`);
      }
      parliament.assertLedger(game);
    },
  });
}
roboticsFixture('robotics-factory', {holders: 'all'});
roboticsFixture('robotics-factory-one', {holders: 'floaters'});
roboticsFixture('robotics-factory-none', {holders: 'none'});
roboticsFixture('robotics-factory-mechpay', {holders: 'mechpay', megacredits: 2});
roboticsFixture('robotics-factory-locked', {holders: 'all', ruling: PartyName.REDS});

// ── TR57 · MINING MECHS («Горные мехи») — docs/TURMOIL_REDUX_MINING_MECHS.md. Blue's action phase, the
//    Industrialists RULING (or the Reds, for the plate's refusal), 20 M€:
//      · `mining-mechs`        — TR57 in hand: the play and its «+4» into the card's capsule;
//      · `mining-mechs-action` — TR57 on the table with 3 mechs: the action's two tiles behind ONE price;
//      · `mining-mechs-short`  — on the table with 1 mech: the action refused «1 из 2 мехов на этой карте» (PL-197);
//      · `mining-mechs-locked` — the Reds ruling, TR57 in hand: the plate's two roads named;
//      · `mining-mechs-split`  — TR57 with 3 mechs BESIDE Forestry Mechs with 2: the satellite splits the mechs by role,
//                                TR57's lane wears its CHOICE of goods (PL-484 — one price, steel OR titanium production).
//    Red sits at a pinned corporation with no first action. ──
function miningMechsFixture(name: string, spec: {placed?: number, ruling?: PartyName.REDS | PartyName.INDUSTRIALISTS, forestry?: number}): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [20, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({p1, parliament}) => {
      const ruling = spec.ruling ?? PartyName.INDUSTRIALISTS;
      seatEnacted(parliament, quietResolutionOf(ruling));
      if (ruling !== PartyName.INDUSTRIALISTS && parliament.slotOf(PartyName.INDUSTRIALISTS) === undefined) {
        seatResolution(parliament, 0, quietResolutionOf(PartyName.INDUSTRIALISTS));
      }
      p1.megaCredits = 20;
      const card = new MiningMechs();
      if (spec.placed === undefined) {
        p1.cardsInHand.push(card);
      } else {
        card.resourceCount = spec.placed;
        p1.playedCards.push(card);
      }
      if (spec.forestry !== undefined) {
        const forestry = new ForestryMechs();
        forestry.resourceCount = spec.forestry;
        p1.playedCards.push(forestry);
      }
    },
    expect: ({game, p1, parliament}) => {
      if (game.activePlayer.id !== p1.id) {
        throw new Error(`the ${name} fixture expected blue on the move — got ${game.activePlayer.color}`);
      }
      if (spec.placed === undefined) {
        const card = p1.cardsInHand.find((c) => c.name === CardName.MINING_MECHS);
        const want = (spec.ruling ?? PartyName.INDUSTRIALISTS) === PartyName.INDUSTRIALISTS;
        if (card === undefined || p1.canPlay(card) !== want) {
          throw new Error(`the ${name} fixture expected TR57 ${want ? 'playable' : 'UNplayable'} in hand — got card=${card !== undefined} ruling=${parliament.rulingParty()}`);
        }
      } else {
        const card = p1.playedCards.get(CardName.MINING_MECHS) as MiningMechs | undefined;
        const want = spec.placed >= 2;
        if (card === undefined || card.resourceCount !== spec.placed || card.canAct(p1) !== want) {
          throw new Error(`the ${name} fixture expected TR57 on the table with ${spec.placed} mechs, canAct=${want} — got ${card?.resourceCount} / ${card?.canAct(p1)}`);
        }
      }
      parliament.assertLedger(game);
    },
  });
}
miningMechsFixture('mining-mechs', {});
miningMechsFixture('mining-mechs-action', {placed: 3});
miningMechsFixture('mining-mechs-short', {placed: 1});
miningMechsFixture('mining-mechs-locked', {ruling: PartyName.REDS});
miningMechsFixture('mining-mechs-split', {placed: 3, forestry: 2});

// ── TR58 · REPROCESSING PLANT («Перерабатывающий завод») — docs/TURMOIL_REDUX_REPROCESSING_PLANT.md. Blue's action
//    phase, the Industrialists RULING (or the Reds, for the plate's refusal), 20 M€:
//      · `reprocessing-plant`            — TR58 on the table, 4 plants / 6 heat, Dirigibles (1 floater) + Aerial
//                                          Mappers: the action's two PRICE tiles and ONE result, its addresses once;
//      · `reprocessing-plant-stormcraft` — blue IS Stormcraft (4 floaters) with 1 heat and 4 plants: the heat tile's
//                                          split («1 heat + 2 floaters») asked INSIDE the composer, before A — and
//                                          the floaters may come back to Stormcraft;
//      · `reprocessing-plant-none`       — TR58 on the table with plants and heat enough and NO floater holder: both
//                                          variants closed, «no holder» the reason first;
//      · `reprocessing-plant-locked`     — the Reds ruling, TR58 in hand.
//    Red sits at a pinned corporation with no first action. ──
function reprocessingPlantFixture(name: string, spec: {
  placed?: boolean,
  holders?: boolean,
  stormcraft?: boolean,
  ruling?: PartyName.REDS | PartyName.INDUSTRIALISTS,
}): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [20, 30],
    options: {customCorporationsList: [spec.stormcraft === true ? CardName.STORMCRAFT_INCORPORATED : CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({p1, parliament}) => {
      const ruling = spec.ruling ?? PartyName.INDUSTRIALISTS;
      seatEnacted(parliament, quietResolutionOf(ruling));
      if (ruling !== PartyName.INDUSTRIALISTS && parliament.slotOf(PartyName.INDUSTRIALISTS) === undefined) {
        seatResolution(parliament, 0, quietResolutionOf(PartyName.INDUSTRIALISTS));
      }
      p1.megaCredits = 20;
      const card = new ReprocessingPlant();
      if (spec.placed === true) {
        p1.playedCards.push(card);
      } else {
        p1.cardsInHand.push(card);
      }
      if (spec.stormcraft === true) {
        const corp = p1.playedCards.corporations().find((c) => c.name === CardName.STORMCRAFT_INCORPORATED);
        if (corp === undefined) {
          throw new Error(`${name}: blue was not seated at Stormcraft`);
        }
        corp.resourceCount = 4;
        p1.heat = 1;
        p1.plants = 4;
      } else {
        p1.plants = 4;
        p1.heat = 6;
      }
      if (spec.holders === true) {
        const dirigibles = new Dirigibles();
        dirigibles.resourceCount = 1;
        p1.playedCards.push(dirigibles);
        p1.playedCards.push(new AerialMappers());
      }
    },
    expect: ({game, p1, parliament}) => {
      if (game.activePlayer.id !== p1.id) {
        throw new Error(`the ${name} fixture expected blue on the move — got ${game.activePlayer.color}`);
      }
      if (spec.placed !== true) {
        const card = p1.cardsInHand.find((c) => c.name === CardName.REPROCESSING_PLANT);
        const want = (spec.ruling ?? PartyName.INDUSTRIALISTS) === PartyName.INDUSTRIALISTS;
        if (card === undefined || p1.canPlay(card) !== want) {
          throw new Error(`the ${name} fixture expected TR58 ${want ? 'playable' : 'UNplayable'} in hand — got card=${card !== undefined} ruling=${parliament.rulingParty()}`);
        }
      } else {
        const card = p1.playedCards.get(CardName.REPROCESSING_PLANT) as ReprocessingPlant | undefined;
        const want = spec.holders === true || spec.stormcraft === true;
        if (card === undefined || card.canAct(p1) !== want) {
          throw new Error(`the ${name} fixture expected TR58 on the table, canAct=${want} — got ${card !== undefined} / ${card?.canAct(p1)} plants=${p1.plants} heat=${p1.heat}`);
        }
        if (spec.stormcraft === true && (p1.availableHeat() !== 9 || p1.heat !== 1)) {
          throw new Error(`the ${name} fixture expected 1 heat + Stormcraft's 4 floaters (9 available) — got heat=${p1.heat} available=${p1.availableHeat()}`);
        }
      }
      parliament.assertLedger(game);
    },
  });
}
reprocessingPlantFixture('reprocessing-plant', {placed: true, holders: true});
reprocessingPlantFixture('reprocessing-plant-stormcraft', {placed: true, holders: true, stormcraft: true});
reprocessingPlantFixture('reprocessing-plant-none', {placed: true});
reprocessingPlantFixture('reprocessing-plant-locked', {ruling: PartyName.REDS});

// ── TR59 · THE SOURCE OF A PAYOUT ON THE VIEWER'S OWN TILE (`notification-source-*`, the spec
//    `console-notification-source.spec.ts`). Another seat places a tile NEXT TO the viewer's Ares tile and the viewer
//    is paid the tile owner's 1 M€ (`AresHandler` — the owner bonus): the notification's cause line must name the
//    viewer's OWN tile (the card that placed it), never the actor's card / standard project / bonus card. One board
//    for both tables — Tharsis, Ares on, hazards off:
//      · 47 — blue's Restricted Area tile placed BY «Restricted Area (Ares)» (the card in blue's tableau, `tile.card`
//             set), its adjacency bonus (1 card) written exactly as the card's own `PlaceTile` writes it;
//      · 48 — the free cell beside it (no printed bonus, no city around): the city cell of BOTH stands;
//      · 49 · 54 · 55 — blue's greeneries around 48 (placed quietly — no oxygen, no bonus): only 48 touches three, so
//             the bot's B05 «a city next to the most greenery / ocean» has exactly ONE answer (a tie would flip a card).
//    `-ares`     red (Thorgate) on the move with 40 M€ and Domed Crater in hand (a CARD that places a city — the variant):
//                the spec builds the City standard project on 48 over the API.
//    `-ares-bot` a solo table vs MarsBot (Credicor), blue on the move; the bot's deck is [B05 Expedited Construction]
//                alone — blue's pass hands the round over, the bot's city lands on 48 (proven below on a dry-run copy),
//                and with its deck empty its next turn is a pass. ──
const TR59_TILE = '47' as SpaceId;
const TR59_CITY = '48' as SpaceId;
const TR59_GROVES: ReadonlyArray<SpaceId> = ['49', '54', '55'] as Array<SpaceId>;

function seatViewerAresTile(game: IGame, owner: IPlayer, name: string): void {
  const board = game.board;
  const tile = board.getSpaceOrThrow(TR59_TILE);
  const city = board.getSpaceOrThrow(TR59_CITY);
  if (!board.getAdjacentSpaces(tile).includes(city) || tile.tile !== undefined || city.tile !== undefined || city.bonus.length !== 0) {
    throw new Error(`${name}: expected the free cells ${TR59_TILE} (the Ares tile) and ${TR59_CITY} (its bonus-less neighbour)`);
  }
  // The card's own road (`Executor` → `PlaceTile`): the tile carries its card, then the space takes the card's bonus.
  const card = new RestrictedAreaAres();
  game.addTile(owner, tile, {tileType: TileType.RESTRICTED_AREA, card: card.name});
  tile.adjacency = card.behavior?.tile?.adjacencyBonus;
  owner.playedCards.push(card);
  for (const id of TR59_GROVES) {
    game.simpleAddTile(owner, board.getSpaceOrThrow(id), {tileType: TileType.GREENERY});
  }
  // Re-read through the board (the guard above narrowed `tile.tile` to «absent» for the compiler).
  const placed = board.getSpaceOrThrow(TR59_TILE);
  if (placed.tile?.card !== CardName.RESTRICTED_AREA_ARES || placed.adjacency?.bonus.join(',') !== String(SpaceBonus.DRAW_CARD)) {
    throw new Error(`${name}: the Ares tile did not take its card / adjacency (card=${placed.tile?.card} adjacency=${JSON.stringify(placed.adjacency)})`);
  }
}

{
  const name = 'notification-source-ares';
  const pinned = [CardName.CREDICOR, CardName.THORGATE];
  const [game, blue, red] = testGame(2, {
    skipInitialCardSelection: false, aresExtension: true, aresHazards: false,
    startingCorporations: 1, customCorporationsList: [...pinned],
  });
  assignPinnedCorporations(name, [blue, red], pinned);
  answerStartFlow(game, [blue, red]);
  seatViewerAresTile(game, blue, name);
  red.megaCredits = 40;
  red.cardsInHand.push(new DomedCrater());
  // Blue's turn is handed over before blue acted (no pass): red is on the move with the action menu, and the viewer
  // holds no prompt while red builds (an out-of-band change reaches a promptless client).
  blue.clearWaitingFor();
  game.playerIsFinishedTakingActions();
  runAllActions(game);
  const domed = red.cardsInHand.find((c) => c.name === CardName.DOMED_CRATER);
  const cities = game.board.getAvailableSpacesForCity(red).map((s) => s.id);
  if (game.phase !== Phase.ACTION || game.activePlayer.id !== red.id || !(red.getWaitingFor() instanceof OrOptions) ||
      !cities.includes(TR59_CITY) || domed === undefined || !red.canPlay(domed) || blue.getWaitingFor() !== undefined) {
    throw new Error(`${name}: expected red on the move with the action menu, ${TR59_CITY} a legal city cell and Domed Crater playable — got phase=${game.phase} active=${game.activePlayer.color} wf=${red.getWaitingFor()?.constructor.name} city=${cities.includes(TR59_CITY)} domed=${domed !== undefined && red.canPlay(domed)} blueWf=${blue.getWaitingFor()?.constructor.name}`);
  }
  write(name, game);
}

{
  const name = 'notification-source-ares-bot';
  const pinned = [CardName.CREDICOR];
  const [game, human, bot] = testAutomaGame({
    aresExtension: true, aresHazards: false, startingCorporations: 1, keepInitialCardSelection: true,
    customCorporationsList: [...pinned],
  });
  assignPinnedCorporations(name, [human], pinned);
  if (!(human.getWaitingFor() instanceof SelectInitialCards)) {
    throw new Error(`${name}: expected SelectInitialCards, got ${human.getWaitingFor()?.constructor.name}`);
  }
  answerStartFlow(game, [human]);
  seatViewerAresTile(game, human, name);
  human.megaCredits = 40;
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error(`${name}: not an automa game`);
  }
  automa.actionDeck = [{kind: 'bonus', id: BonusCardId.B05_EXPEDITED_CONSTRUCTION}];
  runAllActions(game);
  // B05's own criterion (`tryCitySurroundedByTwo`): the legal city cells the bot may take, scored by adjacent greenery
  // + ocean — 48 must be the ONE maximum, or the bot flips a card and the stand is a coin toss.
  const surrounded = (id: SpaceId) => game.board.getAdjacentSpaces(game.board.getSpaceOrThrow(id))
    .filter((adj) => Board.isGreenerySpace(adj) || Board.isOceanSpace(adj)).length;
  const scored = game.board.getAvailableSpacesForCity(bot).map((s) => ({id: s.id, n: surrounded(s.id)})).filter((s) => s.n >= 2);
  const top = Math.max(...scored.map((s) => s.n));
  const winners = scored.filter((s) => s.n === top).map((s) => s.id);
  // THE DRY RUN — blue's pass on a copy: the bot's turn resolves inline (the scheduler is off outside the server).
  const copy = Game.deserialize(structuredClone(game.serialize()));
  const blue = copy.getPlayerById(human.id);
  const menu = blue.getWaitingFor();
  const titleOf = (o: {title: unknown}) => typeof o.title === 'string' ? o.title : (o.title as {message?: string} | undefined)?.message ?? '';
  const passIndex = menu instanceof OrOptions ? menu.options.findIndex((o) => titleOf(o) === 'Pass for this generation') : -1;
  if (passIndex < 0) {
    throw new Error(`${name}: blue holds no pass option (wf=${menu?.constructor.name})`);
  }
  blue.process({type: 'or', index: passIndex, response: {type: 'option'}});
  runAllActions(copy);
  const landed = copy.board.getSpaceOrThrow(TR59_CITY);
  const payout = copy.aresAdjacencyGrants.find((g) => g.spaceId === TR59_CITY)?.ownerPayouts
    .find((p) => p.sourceSpaceId === TR59_TILE && p.ownerColor === human.color);
  if (game.phase !== Phase.ACTION || game.activePlayer.id !== human.id || !(human.getWaitingFor() instanceof OrOptions) ||
      winners.join(',') !== TR59_CITY || landed.tile?.tileType !== TileType.CITY || landed.player?.id !== bot.id || payout?.megacredits !== 1) {
    throw new Error(`${name}: expected blue on the move, B05's one answer ${TR59_CITY}, and the dry run's bot city there paying blue 1 M€ — got phase=${game.phase} active=${game.activePlayer.color} wf=${human.getWaitingFor()?.constructor.name} winners=${winners.join(',')} (scored ${JSON.stringify(scored)}) landed=${landed.tile?.tileType}/${landed.player?.color} payout=${JSON.stringify(payout)}`);
  }
  write(name, game);
}

// ── tile-language: «ВИЗУАЛЬНЫЙ ЯЗЫК РАЗМЕЩЕНИЯ ТАЙЛОВ» (the tile-placement polish, 2026-10-20) — the one table every
//    landing of the language plays on: blue (CrediCor, the viewer) on the move with 150 M€, 16 plants and Domed Crater
//    in hand (a CARD that places a city — the staged door); red (Thorgate) with 100 M€ and 16 plants, driven over the API
//    once blue's turn is over (the REMOTE landing: a city, an ocean, a greenery). Base game, no Ares — the bare
//    language, no hazards in the frame. ──
{
  const name = 'tile-language';
  const pinned = [CardName.CREDICOR, CardName.THORGATE];
  const [game, blue, red] = testGame(2, {
    skipInitialCardSelection: false, startingCorporations: 1, customCorporationsList: [...pinned],
  });
  assignPinnedCorporations(name, [blue, red], pinned);
  answerStartFlow(game, [blue, red]);
  blue.megaCredits = 150;
  blue.plants = 16;
  blue.cardsInHand.push(new DomedCrater());
  blue.production.add(Resource.ENERGY, 1); // Domed Crater's own price: −1 energy production
  red.megaCredits = 100;
  red.plants = 16;
  runAllActions(game);
  if (game.phase !== Phase.ACTION || game.activePlayer.id !== blue.id || !(blue.getWaitingFor() instanceof OrOptions)) {
    throw new Error(`${name}: expected blue on the move with the action menu — got phase=${game.phase} active=${game.activePlayer.color} wf=${blue.getWaitingFor()?.constructor.name}`);
  }
  write(name, game);
}

// ── TR60 · «ИНФОРМАЦИЯ — ДОСЬЕ, А НЕ ТАБЛИЦА» (docs/TURMOIL_REDUX_CIVILIAN_SPACEFIGHTERS.md § ДОСЬЕ): a SATURATED table for
//    the Information workspace (Y), blue on the move in generation 5, the Industrialists ruling:
//      · `info-dossier` — blue (Teractor) with 19 cards on the table: EIGHT action cards in three states (TR60 · TR57 ·
//        Regolith Eaters · Search For Life live; Security Fleet · Ironworks used this generation; Development Center ·
//        Physics Complex refused for energy), effects of every family (Earth Office / Space Station discounts, Advanced
//        Alloys' payment value, Decomposers / Arctic Algae / Mars University triggers), three automated cards, two
//        events; a city and two greeneries, a claimed milestone and a funded award, two delegates on a resolution and
//        the Agenda at step 4. Red (ThorGate) holds four cards — one action (Restricted Area), a microbe holder — and
//        its score is HIDDEN from blue (`showOtherPlayersVP` off — the default).
//    Red sits at a pinned corporation with no first action. ──
function infoDossierFixture(name: string): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [24, 18],
    agenda: [4, 1],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, p2, parliament}) => {
      seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
      game.generation = 5;
      // Red's city first — before blue's table holds its tile triggers (a door with no live scope).
      addCity(p2);
      // The ACTION cards, in three states.
      const fighters = new CivilianSpacefighters();
      fighters.resourceCount = 2;
      const mining = new MiningMechs();
      mining.resourceCount = 3;
      const eaters = new RegolithEaters();
      eaters.resourceCount = 1;
      const fleet = new SecurityFleet();
      fleet.resourceCount = 2;
      const decomposers = new Decomposers();
      decomposers.resourceCount = 4;
      p1.playedCards.push(
        fighters, mining, eaters, new SearchForLife(), fleet, new Ironworks(), new DevelopmentCenter(), new PhysicsComplex(),
        new EarthOffice(), new SpaceStation(), new AdvancedAlloys(), decomposers, new ArcticAlgae(), new MarsUniversity(),
        new PowerPlant(), new Mine(), new SolarPower(), new Comet(), new BigAsteroid(),
      );
      p1.actionsThisGeneration.add(CardName.SECURITY_FLEET);
      p1.actionsThisGeneration.add(CardName.IRONWORKS);
      p1.megaCredits = 24;
      p1.steel = 3;
      p1.titanium = 1;
      p1.plants = 6;
      p1.energy = 0;
      p1.heat = 4;
      p1.production.add(Resource.MEGACREDITS, 5);
      p1.production.add(Resource.STEEL, 1);
      p1.production.add(Resource.ENERGY, 2);
      p1.setTerraformRating(28);
      addCity(p1);
      addGreenery(p1);
      addGreenery(p1);
      game.claimedMilestones.push({player: p1, milestone: game.milestones[0]});
      game.fundedAwards.push({player: p1, award: game.awards[0]});
      // Two of blue's delegates on a resolution of the table (the lobby's, then the reserve's).
      const slot = parliament.slots.find((s) => s.instance !== undefined) ?? parliament.slots[0];
      parliament.placeVote(p1, slot, 'lobby');
      parliament.placeVote(p1, slot, 'reserve');
      // Red: a smaller table, one action, a microbe holder.
      const tardigrades = new Tardigrades();
      tardigrades.resourceCount = 2;
      p2.playedCards.push(new PowerPlant(), new Mine(), tardigrades, new RestrictedArea());
      p2.setTerraformRating(24);
    },
    expect: ({game, p1, p2, parliament}) => {
      const actions = p1.playedCards.asArray().filter(isIActionCard);
      const live = p1.getPlayableActionCards().map((c) => c.name);
      const used = actions.filter((c) => p1.actionsThisGeneration.has(c.name)).length;
      const refused = actions.length - live.length - used;
      if (game.activePlayer.id !== p1.id || p1.playedCards.length < 19 || actions.length !== 8 || live.length < 4 || used !== 2 || refused < 2 ||
          game.claimedMilestones.length !== 1 || game.fundedAwards.length !== 1 || game.gameOptions.showOtherPlayersVP ||
          p2.playedCards.length !== 5) {
        throw new Error(`the ${name} fixture expected blue on the move with 19 cards (8 actions: ≥4 live, 2 used, ≥2 refused), a milestone, an award, red's score hidden — got active=${game.activePlayer.color} played=${p1.playedCards.length} actions=${actions.length} live=${live.join(',')} used=${used} ms=${game.claimedMilestones.length} aw=${game.fundedAwards.length} vp=${game.gameOptions.showOtherPlayersVP} red=${p2.playedCards.length}`);
      }
      parliament.assertLedger(game);
    },
  });
}
infoDossierFixture('info-dossier');

// ── «ИНФОРМАЦИЯ» POLISH (the owner's 4K report of 2026-10-19): the WORST honest case of every summary zone at once — a
//    late campaign-shaped table of two humans and MarsBot, the Hydronetwork in play (a ninth score category), card
//    PENALTIES (a negative card), generation 10. Blue (Teractor) holds 40 played cards over every zone — actives with
//    actions, automated cards, events, two preludes; red (Thorgate) a smaller table with its own penalty; the bot a
//    long played pile. Scores public (`showOtherPlayersVP`) so a rival's whole ledger is drawn, the bot's always is.
//    For console-info-polish.spec.ts. ──
{
  const name = 'info-dossier-rich';
  const pinned = BOT_TABLE_CORPORATIONS;
  const [game, seats, bot] = testAutomaMultiplayerGame(2, {
    startingCorporations: 1, keepInitialCardSelection: true, customCorporationsList: [...pinned],
    deltaProjectExpansion: true, showOtherPlayersVP: true,
  });
  assignPinnedCorporations(name, seats, pinned);
  answerStartFlow(game, seats);
  if (game.phase !== Phase.ACTION) {
    throw new Error(`${name}: expected the action phase, got ${game.phase}`);
  }
  game.generation = 10;
  const [blue, red] = seats;
  const cards = (names: ReadonlyArray<CardName>) => names.map((n) => {
    const card = newProjectCard(n) ?? newPrelude(n);
    if (card === undefined) {
      throw new Error(`${name}: no card ${n}`);
    }
    return card;
  });
  blue.playedCards.push(...cards([
    // actives (a dozen with actions, a few effects)
    CardName.SEARCH_FOR_LIFE, CardName.REGOLITH_EATERS, CardName.SECURITY_FLEET, CardName.IRONWORKS, CardName.DEVELOPMENT_CENTER,
    CardName.PHYSICS_COMPLEX, CardName.BIRDS, CardName.FISH, CardName.PETS, CardName.TARDIGRADES, CardName.DECOMPOSERS,
    CardName.ARCTIC_ALGAE, CardName.MARS_UNIVERSITY, CardName.EARTH_OFFICE, CardName.SPACE_STATION, CardName.ADVANCED_ALLOYS,
    CardName.OPTIMAL_AEROBRAKING, CardName.ROVER_CONSTRUCTION,
    // automated
    CardName.POWER_PLANT, CardName.MINE, CardName.SOLAR_POWER, CardName.TREES, CardName.HEATHER, CardName.GRASS,
    CardName.LICHEN, CardName.MOSS, CardName.BUILDING_INDUSTRIES, CardName.GEOTHERMAL_POWER, CardName.TECTONIC_STRESS_POWER,
    CardName.HACKERS,
    // events
    CardName.COMET, CardName.BIG_ASTEROID, CardName.ASTEROID, CardName.LAND_CLAIM, CardName.INVENTION_CONTEST,
    CardName.LAGRANGE_OBSERVATORY, CardName.SABOTAGE,
    // preludes
    CardName.BIOFUELS, CardName.DONATION,
  ]));
  red.playedCards.push(...cards([
    CardName.POWER_PLANT, CardName.MINE, CardName.RESTRICTED_AREA, CardName.ANTS, CardName.ROBOTIC_WORKFORCE,
    CardName.COMET, CardName.HACKERS, CardName.ACQUIRED_COMPANY,
  ]));
  for (const card of blue.playedCards.asArray()) {
    if (card.resourceType !== undefined) {
      card.resourceCount = 3;
    }
  }
  blue.actionsThisGeneration.add(CardName.SECURITY_FLEET);
  blue.actionsThisGeneration.add(CardName.IRONWORKS);
  const tiles: ReadonlyArray<[cities: number, greeneries: number]> = [[3, 4], [1, 2], [2, 2]];
  [blue, red, bot].forEach((p, i) => {
    for (let c = 0; c < tiles[i][0]; c++) {
      addCity(p);
    }
    for (let g = 0; g < tiles[i][1]; g++) {
      addGreenery(p);
    }
  });
  blue.deltaProjectData!.position = 6;
  red.deltaProjectData!.position = 3;
  game.claimedMilestones.push({player: blue, milestone: game.milestones[0]});
  game.claimedMilestones.push({player: red, milestone: game.milestones[1]});
  game.fundedAwards.push({player: blue, award: game.awards[0]});
  game.fundedAwards.push({player: red, award: game.awards[1]});
  blue.setTerraformRating(39);
  red.setTerraformRating(35);
  bot.setTerraformRating(37);
  blue.megaCredits = 54;
  red.megaCredits = 66;
  const automa = game.automa;
  if (automa !== undefined) {
    automa.playedPile.push(
      CardName.POWER_PLANT, CardName.MINE, CardName.SOLAR_POWER, CardName.TREES, CardName.HEATHER, CardName.COMET,
      CardName.BIG_ASTEROID, CardName.ASTEROID, CardName.GRASS, CardName.LICHEN, CardName.MOSS, CardName.SPACE_STATION,
      CardName.EARTH_OFFICE, CardName.BUILDING_INDUSTRIES, CardName.GEOTHERMAL_POWER, CardName.LAND_CLAIM,
    );
    // Its bonus piles hold cards too: two resolved bonus cards in the open discard, one destroyed — the deck they
    // left keeps the rest (the bonus route's three piles are all objects).
    const resolved = automa.bonusDeck.filter((c): c is {kind: 'bonus', id: BonusCardId} => c.kind === 'bonus').slice(0, 3);
    automa.bonusDeck = automa.bonusDeck.filter((c) => !resolved.includes(c as {kind: 'bonus', id: BonusCardId}));
    automa.bonusDiscard.push(...resolved.slice(0, 2).map((c) => c.id));
    automa.destroyedBonusCards.push(...resolved.slice(2).map((c) => c.id));
  }
  runAllActions(game);
  const breakdown = blue.getVictoryPoints();
  if (game.automa === undefined || game.generation !== 10 || blue.playedCards.length < 40 || breakdown.total <= 0 ||
      game.activePlayer.id !== blue.id) {
    throw new Error(`${name}: expected blue on the move at generation 10 with 40 cards — got gen=${game.generation} played=${blue.playedCards.length} active=${game.activePlayer.color}`);
  }
  write(name, game);
}

// ── TR65 · STRATEGIC SHIFT («Смена стратегии»): the card in blue's hand beside FOUR cards with a requirement (a
//    temperature, a parameter at 2 °C, an oxygen, a tag count — every kind reads alike) and THREE without — the multi
//    DISCARD of the play: only the requirement cards are candidates, the rest are refused by name, +1 M€ and +1 card
//    each on the play's ONE POST. `-none`: no candidate at all — the composer names the skip before the press and the
//    play asks nothing. `-one`: a single candidate — the album stays the multi album (A marks, RT with the count).
//    30 M€ on both seats; CALM corporations (Teractor / Thorgate — no trigger answers the play). ──
function strategicShiftFixture(name: string, hand: () => Array<IProjectCard>): void {
  const [game, p1, p2] = testGame(2, {skipInitialCardSelection: false, customCorporationsList: [CardName.TERACTOR, CardName.THORGATE], startingCorporations: 1});
  answerStartFlow(game, [p1, p2]);
  // The hand is DECLARED, never dealt: the start's bought cards leave (a dealt card with a requirement would be a
  // candidate the spec never named — `-none` would stop being none).
  p1.cardsInHand.splice(0, p1.cardsInHand.length, new StrategicShift(), ...hand());
  p1.megaCredits = 30;
  p2.megaCredits = 30;
  runAllActions(game);
  write(name, game);
}
strategicShiftFixture('strategic-shift', () => [new Lichen(), new Fish(), new Birds(), new FusionPower(), new Research(), new Tardigrades(), new AcquiredCompany()]);
strategicShiftFixture('strategic-shift-none', () => [new Research(), new Tardigrades(), new AcquiredCompany()]);
strategicShiftFixture('strategic-shift-one', () => [new Lichen(), new Research(), new Tardigrades()]);

// ── TR65 · «СТОЛ — ЭТО СТОЛ»: a FIFTY-card table for the shelf album's pages — blue's dossier table (the eight actions
//    in three states, the events) topped up from the BASE module alone (unique names; every blue card's `canAct` runs
//    on each /api/player, so no card may touch a missing expansion), red with five cards (the rival's table). ──
function playedTable50Fixture(name: string): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [24, 18],
    agenda: [4, 1],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, p2}) => {
      game.generation = 7;
      addCity(p2);
      const fighters = new CivilianSpacefighters();
      fighters.resourceCount = 2;
      const mining = new MiningMechs();
      mining.resourceCount = 3;
      const decomposers = new Decomposers();
      decomposers.resourceCount = 4;
      p1.playedCards.push(
        fighters, mining, new RegolithEaters(), new SearchForLife(), new SecurityFleet(), new Ironworks(), new DevelopmentCenter(),
        new PhysicsComplex(), new EarthOffice(), new SpaceStation(), new AdvancedAlloys(), decomposers, new ArcticAlgae(),
        new MarsUniversity(), new PowerPlant(), new Mine(), new SolarPower(), new Comet(), new BigAsteroid(),
      );
      const used = new Set<string>(p1.playedCards.asArray().map((c) => c.name));
      const base = ALL_MODULE_MANIFESTS.find((m) => m.module === 'base');
      for (const cardName of Object.keys(base?.projectCards ?? {}) as Array<CardName>) {
        if (p1.playedCards.length >= 50) {
          break;
        }
        const card = newProjectCard(cardName);
        if (card === undefined || card.type === CardType.PRELUDE || used.has(card.name)) {
          continue;
        }
        used.add(card.name);
        p1.playedCards.push(card);
      }
      p1.actionsThisGeneration.add(CardName.SECURITY_FLEET);
      p1.megaCredits = 24;
      p1.steel = 3;
      p1.titanium = 1;
      p1.plants = 6;
      p1.heat = 4;
      p1.production.add(Resource.MEGACREDITS, 5);
      p1.setTerraformRating(31);
      addCity(p1);
      addGreenery(p1);
      const tardigrades = new Tardigrades();
      tardigrades.resourceCount = 2;
      p2.playedCards.push(new PowerPlant(), new Mine(), tardigrades, new RestrictedArea(), new Comet());
      p2.setTerraformRating(24);
    },
    expect: ({game, p1, p2}) => {
      if (game.activePlayer.id !== p1.id || p1.playedCards.length !== 50 || p2.playedCards.length < 5) {
        throw new Error(`the ${name} fixture expected blue on the move with 50 cards and red with 5 — got active=${game.activePlayer.color} blue=${p1.playedCards.length} red=${p2.playedCards.length}`);
      }
    },
  });
}
playedTable50Fixture('played-table-50');

// ── TR61 · THE END OF A GENERATION (the iteration «СМЕНА ПОКОЛЕНИЯ — ОДНА СЦЕНА»): a table on the move whose pass
//    ends the generation — every kind of production (so every rail row flows), energy in stock (the conversion beat),
//    a rating above the start (its own M€ line). `generation-end-solo`: solo, NO draft — the buy of the next
//    generation is the whole research flow; `-no-energy`: nothing to convert, a two-beat scene; `generation-end-draft`:
//    two seats WITH the draft, blue already passed so red's pass is the last — the same purchase surface after the
//    picks (the parity probe). Stocks are plain numbers the probe reads back: the record must equal the diff. ──
function generationEndStocks(player: TestPlayer, energy: number): void {
  player.production.override({megacredits: 3, steel: 2, titanium: 1, plants: 2, energy: 2, heat: 1});
  player.megaCredits = 20;
  player.steel = 1;
  player.titanium = 0;
  player.plants = 3;
  player.energy = energy;
  player.heat = 2;
  player.setTerraformRating(22);
}
{
  const {game, player} = soloActionPhase();
  generationEndStocks(player, 4);
  runAllActions(game);
  if (game.gameOptions.draftVariant || game.activePlayer.id !== player.id || !(player.getWaitingFor() instanceof OrOptions)) {
    throw new Error(`generation-end-solo: expected a solo table without a draft on the move, got draft=${game.gameOptions.draftVariant} wf=${player.getWaitingFor()?.constructor.name}`);
  }
  write('generation-end-solo', game);
}
{
  const {game, player} = soloActionPhase();
  generationEndStocks(player, 0);
  runAllActions(game);
  write('generation-end-solo-no-energy', game);
}
{
  const [game, p1, p2] = testGame(2, {skipInitialCardSelection: false, draftVariant: true});
  answerStartFlow(game, [p1, p2]);
  generationEndStocks(p1, 4);
  p2.megaCredits = 20;
  // Blue has passed: red's pass is the generation's last — the production phase and the draft follow it at once.
  p2.pass();
  runAllActions(game);
  if (!game.gameOptions.draftVariant || game.activePlayer.id !== p1.id || !game.getPassedPlayers().includes(p2.color) || !(p1.getWaitingFor() instanceof OrOptions)) {
    throw new Error(`generation-end-draft: expected red on the move with blue passed on a drafting table, got active=${game.activePlayer.color} passed=${game.getPassedPlayers().join(',')} wf=${p1.getWaitingFor()?.constructor.name}`);
  }
  write('generation-end-draft', game);
}

// ── T10 · CE · THE PACKET SHOWCASE (the draft + research buy on the 4K TV): the workspace's stages stood up directly,
//    no generation scene in front of them. `draft-showcase-pick`: two seats WITH the draft, generation 2, both seats
//    holding their FIRST packet (4 cards) — red picks on the UI, blue never answers, so red's next stage is the WAIT (the stand walks the rest of the draft
//    with blue answering over the API); `draft-showcase-solo-buy`: solo, no draft — the buy of
//    the next generation is the whole flow (the `research-startups` road's twin through the generation's own end). ──
function draftShowcaseTable(): {game: IGame, p1: TestPlayer, p2: TestPlayer} {
  const [game, p1, p2] = testGame(2, {skipInitialCardSelection: false, draftVariant: true});
  answerStartFlow(game, [p1, p2]);
  p1.megaCredits = 40;
  p2.megaCredits = 40;
  p2.pass();
  runAllActions(game);
  // Red's pass is the generation's last: the production phase and the draft follow it at once.
  p1.popWaitingFor();
  game.playerHasPassed(p1);
  game.playerIsFinishedTakingActions();
  runAllActions(game);
  return {game, p1, p2};
}
{
  const {game, p1, p2} = draftShowcaseTable();
  const wf1 = p1.getWaitingFor();
  const wf2 = p2.getWaitingFor();
  if (game.phase !== Phase.DRAFTING || !(wf1 instanceof SelectCard) || wf1.cards.length !== 4 || !(wf2 instanceof SelectCard)) {
    throw new Error(`draft-showcase-pick: expected both seats on their first 4-card packet, got phase=${game.phase} wf1=${wf1?.constructor.name} cards=${wf1 instanceof SelectCard ? wf1.cards.length : -1}`);
  }
  write('draft-showcase-pick', game);
}
{
  const {game, player} = soloActionPhase();
  player.megaCredits = 40;
  player.popWaitingFor();
  game.playerHasPassed(player);
  game.playerIsFinishedTakingActions();
  runAllActions(game);
  const wf = player.getWaitingFor();
  if (game.phase !== Phase.RESEARCH || game.gameOptions.draftVariant || !(wf instanceof SelectCard) || wf.cards.length !== 4) {
    throw new Error(`draft-showcase-solo-buy: expected a solo research buy of 4 cards, got phase=${game.phase} draft=${game.gameOptions.draftVariant} wf=${wf?.constructor.name}`);
  }
  write('draft-showcase-solo-buy', game);
}

// ── TR61 · CARGO MECHS: the card on the table (its requirement is the play's — on the table it acts whoever rules),
//    Viron as the seat's corporation (the loop guard's own table — both copiers at once), Restricted Area USED this
//    generation and able to act again (10 M€ — B's one candidate), Forestry Mechs as a second mech holder (A's target
//    step asks «КУДА» over two cards), 1 energy for A. `cargo-mechs`: one mech here (both variants live);
//    `cargo-mechs-empty`: no mech here — B refused with «0 of 1 mech on this card», A the whole action. ──
function cargoMechsFixture(name: string, mechs: number): void {
  // The solo Redux opening leaves the colony trim and the corporation's play to the DRIVER (`waitForBoardHome` walks
  // them on the real UI — the venus-trade / vesta-trade convention); the table is arranged under it.
  const {game, p1} = reduxTable(name, {venusNextExtension: true, customCorporationsList: [CardName.VIRON]}, 1);
  const cargo = new CargoMechs();
  cargo.resourceCount = mechs;
  const area = new RestrictedArea();
  const forestry = new ForestryMechs();
  p1.playedCards.push(cargo, area, forestry);
  p1.actionsThisGeneration.add(area.name);
  p1.megaCredits = 10;
  p1.energy = 1;
  runAllActions(game);
  const dealt = p1.dealtCorporationCards.map(toName);
  if (!dealt.includes(CardName.VIRON) || !cargo.canAct(p1) || !area.canAct(p1) || !p1.actionsThisGeneration.has(area.name) ||
      cargo.resourceCount !== mechs || !(p1.getWaitingFor() instanceof SelectColony)) {
    throw new Error(`${name}: expected Viron dealt, Cargo Mechs (${mechs} mechs) able to act beside a USED Restricted Area, the opening's colony trim pending — got dealt=${dealt.join(',')} cargo=${cargo.canAct(p1)} area=${area.canAct(p1)} wf=${p1.getWaitingFor()?.constructor.name}`);
  }
  write(name, game);
}
cargoMechsFixture('cargo-mechs', 1);
cargoMechsFixture('cargo-mechs-empty', 0);

// ── TR69 · FLOATING BIODOMES: the card on blue's table (its Venus plate is the play's — on the table it acts at any
//    Venus), the Scientists ruling (a quiet government), Dirigibles beside it (a second Venus floater holder: A's
//    target step asks «КУДА» over two cards, this one included).
//      `floating-biodomes`       — 3 floaters here, 1 plant: both variants live (B — the greenery, staged);
//      `floating-biodomes-dead`  — 2 floaters, no plant: both refused, the plant first, «2 of 3 floaters» second;
//      `floating-biodomes-maxo2` — 3 floaters, no plant, the oxygen at its maximum: B alone — the tile still lands. ──
function floatingBiodomesFixture(name: string, at: 'live' | 'dead' | 'maxo2'): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [20, 30],
    options: {venusNextExtension: true, customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, parliament}) => {
      seatEnacted(parliament, quietResolutionOf(PartyName.SCIENTISTS));
      const card = new FloatingBiodomes();
      card.resourceCount = at === 'dead' ? 2 : 3;
      const dirigibles = new Dirigibles();
      dirigibles.resourceCount = 1;
      p1.playedCards.push(card, dirigibles);
      p1.plants = at === 'live' ? 1 : 0;
      if (at === 'maxo2') {
        setOxygenLevel(game, MAX_OXYGEN_LEVEL);
      }
    },
    expect: ({game, p1}) => {
      const card = p1.playedCards.get(CardName.FLOATING_BIODOMES);
      const live = card !== undefined && isIActionCard(card) && card.canAct(p1);
      if (game.activePlayer.id !== p1.id || live !== (at !== 'dead')) {
        throw new Error(`${name}: expected blue on the move with Floating Biodomes ${at === 'dead' ? 'refused' : 'live'} — got active=${game.activePlayer.color} live=${live}`);
      }
    },
  });
}
floatingBiodomesFixture('floating-biodomes', 'live');
floatingBiodomesFixture('floating-biodomes-dead', 'dead');
floatingBiodomesFixture('floating-biodomes-maxo2', 'maxo2');

// ── TR62 · THARSIS ALLIANCE — the law of access's FOURTH road (docs/TURMOIL_REDUX_THARSIS_ALLIANCE.md). The Greens rule
//    by the starting rule; the voting area is [Mars First · the Reds · the Scientists] (quiet cards); red keeps a cube on
//    the Scientists; the corporations pinned (Teractor / ThorGate — no first action on red's page, the TR24 trap).
//      `tharsis-alliance`         — blue's action phase, 24 M€, TR62 AND Reds News Outlet (the Reds' plate, no side effect)
//                                   in hand, TWO of blue's cubes on Mars First: the play opens the Reds by the alliance;
//      `tharsis-alliance-dormant` — TR62 on blue's table, no cube on either party: both badges dormant, the Outlet's reason
//                                   with the alliance's second road;
//      `tharsis-alliance-council` — TR62 AND Council Seat on blue's table, ONE cube on Mars First: Mars First's effect by the
//                                   lowered threshold, the Reds NOT (FAQ p.19) — the vote's 1 → 2 edge names the ally;
//      `tharsis-alliance-enact`   — TR62 on blue's table, the sitting at its first gate with Mars First winning (red's three
//                                   cubes): the enactment draws blue a card and opens the Reds by the alliance.
//    Every table is refused unless its DRY RUN (on a copy) reaches the state the name promises. ──
type TharsisAllianceTable = 'journey' | 'dormant' | 'council' | 'enact';
function tharsisAllianceFixture(name: string, at: TharsisAllianceTable): void {
  parliamentFixture(name, {
    stopAt: at === 'enact' ? 'pass' : 'vote',
    megacredits: [24, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, p2, parliament}) => {
      seatResolution(parliament, 0, quietResolutionOf(PartyName.MARS));
      seatResolution(parliament, 1, quietResolutionOf(PartyName.REDS));
      seatResolution(parliament, 2, quietResolutionOf(PartyName.SCIENTISTS));
      parliament.placeVote(p2, parliament.slots[2], 'reserve');
      if (at === 'journey') {
        parliament.placeVote(p1, parliament.slots[0], 'reserve');
        parliament.placeVote(p1, parliament.slots[0], 'reserve');
        moveToDeckTop(game, CardName.THARSIS_ALLIANCE);
        p1.cardsInHand.push(game.projectDeck.drawPile.pop() as IProjectCard);
      } else {
        moveToDeckTop(game, CardName.THARSIS_ALLIANCE);
        p1.playedCards.push(game.projectDeck.drawPile.pop() as IProjectCard);
      }
      if (at === 'council') {
        moveToDeckTop(game, CardName.COUNCIL_SEAT);
        p1.playedCards.push(game.projectDeck.drawPile.pop() as IProjectCard);
        parliament.placeVote(p1, parliament.slots[0], 'reserve');
      }
      if (at === 'enact') {
        // Mars First wins the vote: red's three cubes on its card (blue's lobby cube stays for the next generation).
        parliament.placeVote(p2, parliament.slots[0], 'reserve');
        parliament.placeVote(p2, parliament.slots[0], 'reserve');
        parliament.placeVote(p2, parliament.slots[0], 'reserve');
      } else {
        moveToDeckTop(game, CardName.REDS_NEWS_OUTLET);
        p1.cardsInHand.push(game.projectDeck.drawPile.pop() as IProjectCard);
      }
    },
    expect: ({game, parliament, p1}) => {
      const R = PartyName.REDS;
      const M = PartyName.MARS;
      const outlet = p1.cardsInHand.find((c) => c.name === CardName.REDS_NEWS_OUTLET);
      const facts: Record<string, unknown> = {
        ruling: parliament.rulingParty(),
        parties: parliament.slots.map((s) => parliament.resolutionOf(s.instance).party).join(','),
        blueOnMars: parliament.votesOf(p1, parliament.slots[0]),
        redsHeld: parliament.access(p1, R).hasEffect,
        redsRequirement: parliament.satisfiesPartyRequirement(p1, R),
        marsHeld: parliament.access(p1, M).hasEffect,
      };
      let ok = facts.ruling === PartyName.GREENS && facts.parties === [M, R, PartyName.SCIENTISTS].join(',');
      if (at === 'journey') {
        // THE DRY RUN — the play for real, on a copy: the Reds open by the alliance (effect, cards, action), the Outlet plays.
        const copy = Game.deserialize(structuredClone(game.serialize()));
        const blue = copy.getPlayerById(p1.id);
        blue.playCard(blue.cardsInHand.find((c) => c.name === CardName.THARSIS_ALLIANCE) as IProjectCard);
        runAllActions(copy);
        const cp = copy.parliament!;
        const outletCopy = blue.cardsInHand.find((c) => c.name === CardName.REDS_NEWS_OUTLET);
        facts.playable = p1.canPlay(p1.cardsInHand.find((c) => c.name === CardName.THARSIS_ALLIANCE) as IProjectCard);
        facts.outletBefore = outlet !== undefined && p1.canPlay(outlet);
        facts.after = cp.accessBasis(blue, R);
        facts.outletAfter = outletCopy !== undefined && blue.canPlay(outletCopy);
        facts.redsAction = ParliamentHandler.partyActionOptions(blue).some((o) => (o as {partyActionPrompt?: {party: PartyName}}).partyActionPrompt?.party === R);
        ok = ok && facts.blueOnMars === 2 && facts.playable === true && facts.outletBefore === false && facts.redsHeld === false &&
          facts.after === 'alliance' && facts.outletAfter === true && facts.redsAction === true;
      } else if (at === 'dormant') {
        facts.outlet = outlet !== undefined && p1.canPlay(outlet);
        facts.pair = parliament.access(p1, R).alliances.length;
        ok = ok && facts.blueOnMars === 0 && facts.redsHeld === false && facts.outlet === false && facts.pair === 1;
      } else if (at === 'council') {
        ok = ok && facts.blueOnMars === 1 && facts.marsHeld === true && facts.redsHeld === false && facts.redsRequirement === false;
      } else {
        // THE DRY RUN of the sitting: answer the gates — Mars First enacted, blue drew ONE card, the Reds are blue's.
        const copy = Game.deserialize(structuredClone(game.serialize()));
        const blue = copy.getPlayerById(p1.id);
        const hand = blue.cardsInHand.length;
        passTheViewer(copy);
        runAllActions(copy);
        facts.enacted = copy.parliament!.rulingParty();
        facts.drawn = blue.cardsInHand.length - hand;
        facts.after = copy.parliament!.accessBasis(blue, R);
        facts.step = copy.parliament!.phase?.step;
        ok = ok && facts.enacted === M && facts.drawn === 1 && facts.after === 'alliance';
      }
      if (!ok) {
        throw new Error(`${name}: the Tharsis Alliance table is not the one its name promises — got ${JSON.stringify(facts)}`);
      }
      parliament.assertLedger(game);
    },
  });
}
tharsisAllianceFixture('tharsis-alliance', 'journey');
tharsisAllianceFixture('tharsis-alliance-dormant', 'dormant');
tharsisAllianceFixture('tharsis-alliance-council', 'council');
tharsisAllianceFixture('tharsis-alliance-enact', 'enact');

// ── TR63 · EDEN ALLIANCE — the same road for Unity = the Greens, and a RATING answer to a change of power
//    (docs/TURMOIL_REDUX_EDEN_ALLIANCE.md). The Greens rule by the starting rule; the voting area is [Unity · the Reds ·
//    the Scientists] (quiet cards); red keeps a cube on the Scientists; the corporations pinned (Teractor / ThorGate).
//      `eden-alliance`       — blue's action phase, 24 M€, TR63 in hand: the play opens Unity by the alliance (the Greens
//                              rule);
//      `eden-alliance-enact` — TR63 on blue's table, the sitting at its first gate with Unity winning (red's three cubes):
//                              the enactment raises blue's rating by one, and the Greens (blue's by the alliance now)
//                              answer the rating with their M€.
//    Every table is refused unless its DRY RUN (on a copy) reaches the state the name promises. ──
function edenAllianceFixture(name: string, at: 'journey' | 'enact'): void {
  parliamentFixture(name, {
    stopAt: at === 'enact' ? 'pass' : 'vote',
    megacredits: [24, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, p2, parliament}) => {
      seatResolution(parliament, 0, quietResolutionOf(PartyName.UNITY));
      seatResolution(parliament, 1, quietResolutionOf(PartyName.REDS));
      seatResolution(parliament, 2, quietResolutionOf(PartyName.SCIENTISTS));
      parliament.placeVote(p2, parliament.slots[2], 'reserve');
      moveToDeckTop(game, CardName.EDEN_ALLIANCE);
      if (at === 'journey') {
        p1.cardsInHand.push(game.projectDeck.drawPile.pop() as IProjectCard);
      } else {
        p1.playedCards.push(game.projectDeck.drawPile.pop() as IProjectCard);
        // Unity wins the vote: red's three cubes on its card.
        parliament.placeVote(p2, parliament.slots[0], 'reserve');
        parliament.placeVote(p2, parliament.slots[0], 'reserve');
        parliament.placeVote(p2, parliament.slots[0], 'reserve');
      }
    },
    expect: ({game, parliament, p1}) => {
      const U = PartyName.UNITY;
      const G = PartyName.GREENS;
      const facts: Record<string, unknown> = {
        ruling: parliament.rulingParty(),
        parties: parliament.slots.map((s) => parliament.resolutionOf(s.instance).party).join(','),
        unityHeld: parliament.access(p1, U).hasEffect,
      };
      // In hand Unity is not blue's yet; on the table the card already opens it through the ruling Greens.
      let ok = facts.ruling === G && facts.parties === [U, PartyName.REDS, PartyName.SCIENTISTS].join(',') && facts.unityHeld === (at === 'enact');
      const copy = Game.deserialize(structuredClone(game.serialize()));
      const blue = copy.getPlayerById(p1.id);
      if (at === 'journey') {
        // THE DRY RUN — the play for real, on a copy: Unity opens by the alliance (the Greens rule).
        facts.playable = p1.canPlay(p1.cardsInHand.find((c) => c.name === CardName.EDEN_ALLIANCE) as IProjectCard);
        blue.playCard(blue.cardsInHand.find((c) => c.name === CardName.EDEN_ALLIANCE) as IProjectCard);
        runAllActions(copy);
        facts.after = copy.parliament!.accessBasis(blue, U);
        ok = ok && facts.playable === true && facts.after === 'alliance';
      } else {
        // THE DRY RUN of the sitting: answer the gates — Unity enacted, blue's rating +1, the Greens blue's by the alliance.
        const tr = blue.terraformRating;
        passTheViewer(copy);
        runAllActions(copy);
        facts.enacted = copy.parliament!.rulingParty();
        facts.tr = blue.terraformRating - tr;
        facts.after = copy.parliament!.accessBasis(blue, G);
        ok = ok && facts.enacted === U && facts.tr === 1 && facts.after === 'alliance';
      }
      if (!ok) {
        throw new Error(`${name}: the Eden Alliance table is not the one its name promises — got ${JSON.stringify(facts)}`);
      }
      parliament.assertLedger(game);
    },
  });
}
edenAllianceFixture('eden-alliance', 'journey');
edenAllianceFixture('eden-alliance-enact', 'enact');

// ── TR64 · PROMETHEAN ALLIANCE — the last pair, the Scientists = the Industrialists, and a PRODUCTION answer to a change
//    of power (docs/TURMOIL_REDUX_PROMETHEAN_ALLIANCE.md). The Greens rule by the starting rule; the voting area is
//    [the Scientists · the Reds · Unity] (quiet cards); red keeps a cube on Unity; the corporations pinned (Teractor /
//    ThorGate).
//      `promethean-alliance`       — blue's action phase, 24 M€, TR64 in hand, TWO of blue's cubes on the Scientists: the
//                                    play opens the Industrialists by the DELEGATES road;
//      `promethean-alliance-enact` — TR64 on blue's table, the sitting at its first gate with the Scientists winning
//                                    (red's three cubes): the enactment raises blue's M€ production by two.
//    Every table is refused unless its DRY RUN (on a copy) reaches the state the name promises. ──
function prometheanAllianceFixture(name: string, at: 'journey' | 'enact'): void {
  parliamentFixture(name, {
    stopAt: at === 'enact' ? 'pass' : 'vote',
    megacredits: [24, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: ({game, p1, p2, parliament}) => {
      seatResolution(parliament, 0, quietResolutionOf(PartyName.SCIENTISTS));
      seatResolution(parliament, 1, quietResolutionOf(PartyName.REDS));
      seatResolution(parliament, 2, quietResolutionOf(PartyName.UNITY));
      parliament.placeVote(p2, parliament.slots[2], 'reserve');
      moveToDeckTop(game, CardName.PROMETHEAN_ALLIANCE);
      if (at === 'journey') {
        p1.cardsInHand.push(game.projectDeck.drawPile.pop() as IProjectCard);
        // Two of blue's cubes on the Scientists — the printed «2 delegates» road the alliance reads.
        parliament.placeVote(p1, parliament.slots[0], 'reserve');
        parliament.placeVote(p1, parliament.slots[0], 'reserve');
      } else {
        p1.playedCards.push(game.projectDeck.drawPile.pop() as IProjectCard);
        // The Scientists win the vote: red's three cubes on their card.
        parliament.placeVote(p2, parliament.slots[0], 'reserve');
        parliament.placeVote(p2, parliament.slots[0], 'reserve');
        parliament.placeVote(p2, parliament.slots[0], 'reserve');
      }
    },
    expect: ({game, parliament, p1}) => {
      const S = PartyName.SCIENTISTS;
      const I = PartyName.INDUSTRIALISTS;
      const facts: Record<string, unknown> = {
        ruling: parliament.rulingParty(),
        parties: parliament.slots.map((s) => parliament.resolutionOf(s.instance).party).join(','),
        industrialistsHeld: parliament.access(p1, I).hasEffect,
      };
      let ok = facts.ruling === PartyName.GREENS && facts.parties === [S, PartyName.REDS, PartyName.UNITY].join(',') && facts.industrialistsHeld === false;
      const copy = Game.deserialize(structuredClone(game.serialize()));
      const blue = copy.getPlayerById(p1.id);
      if (at === 'journey') {
        // THE DRY RUN — the play for real, on a copy: the Industrialists open by the alliance (two cubes on the Scientists).
        facts.playable = p1.canPlay(p1.cardsInHand.find((c) => c.name === CardName.PROMETHEAN_ALLIANCE) as IProjectCard);
        blue.playCard(blue.cardsInHand.find((c) => c.name === CardName.PROMETHEAN_ALLIANCE) as IProjectCard);
        runAllActions(copy);
        facts.after = copy.parliament!.accessBasis(blue, I);
        ok = ok && facts.playable === true && facts.after === 'alliance';
      } else {
        // THE DRY RUN of the sitting: answer the gates — the Scientists enacted, blue's M€ production +2.
        const prod = blue.production.megacredits;
        passTheViewer(copy);
        runAllActions(copy);
        facts.enacted = copy.parliament!.rulingParty();
        facts.production = blue.production.megacredits - prod;
        facts.after = copy.parliament!.accessBasis(blue, I);
        ok = ok && facts.enacted === S && facts.production === 2 && facts.after === 'alliance';
      }
      if (!ok) {
        throw new Error(`${name}: the Promethean Alliance table is not the one its name promises — got ${JSON.stringify(facts)}`);
      }
      parliament.assertLedger(game);
    },
  });
}
prometheanAllianceFixture('promethean-alliance', 'journey');
prometheanAllianceFixture('promethean-alliance-enact', 'enact');

// ── T14 · SUPPORTED RESEARCH — «draw 2 cards», the Scientists ruling (their quiet law enacted), T14 MOVED out of the
//    dealt pool into blue's hand (never copied), 20 M€. The play asks NOTHING: its composer opens ready, so it is the
//    stand's «nothing to ask» cell of the pre-select iteration (ledger CC — the commit ARRIVES, the opening press is
//    absorbed as the arrival, the next one plays). ──
parliamentFixture('supported-research', {
  stopAt: 'vote',
  megacredits: [20, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1, parliament}) => {
    seatEnacted(parliament, quietResolutionOf(PartyName.SCIENTISTS));
    moveToDeckTop(game, CardName.SUPPORTED_RESEARCH);
    p1.cardsInHand.push(game.projectDeck.drawOrThrow(game));
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.SUPPORTED_RESEARCH);
    if (card === undefined || !p1.canPlay(card) || parliament.rulingParty() !== PartyName.SCIENTISTS || game.activePlayer.id !== p1.id) {
      throw new Error(`the supported-research fixture expected T14 playable with the Scientists ruling and blue on the move — got card=${card !== undefined} ruling=${parliament.rulingParty()}`);
    }
    parliament.assertLedger(game);
  },
});

// ── preselect-sole: THE PRE-SELECT STAND (T14 · ledger CC — «ОДИН КУРСОР ПОСЛЕ ОТВЕТА · ПРИБЫТИЕ НА КОММИТ ·
//    ЕДИНСТВЕННАЯ ЦЕЛЬ»). One base table, every cell of the matrix in blue's hand / tableau:
//      · Aerial Mappers (ONE floater) is the ONLY floater holder on the table — Floater Prototypes («2 floaters to ANY
//        card») has exactly one target (a), and the Mappers' own action «add 1 floater to ANY card» targets the hero
//        itself (d — the self-target);
//      · Tardigrades + Decomposers are TWO microbe holders — Imported Nutrients («4 microbes to ANY card») is a real
//        choice (b);
//      · Asteroid's «remove up to 3 plants from any player» — red holds 5 plants, blue none: one target beside the
//        DECLINE, an optional choice that is never seeded (c);
//      · Heat Trappers' «decrease ANY heat production 2 steps» — red produces 3 heat, blue none: ONE player target (f);
//      · Artificial Photosynthesis — «+1 plant production OR +2 energy production»: a variant with nothing after it (h);
//    60 M€, CALM corporations (Teractor · Thorgate). The cards are pushed into the tableau / hand, so no expansion gate
//    is exercised (the variant-tiles precedent). ──
{
  const [game, p1, p2] = testGame(2, {skipInitialCardSelection: false, customCorporationsList: [CardName.TERACTOR, CardName.THORGATE], startingCorporations: 1});
  answerStartFlow(game, [p1, p2]);
  const mappers = new AerialMappers();
  mappers.resourceCount = 1;
  p1.playedCards.push(mappers, new Tardigrades(), new Decomposers());
  const stand = [new FloaterPrototypes(), new ImportedNutrients(), new Asteroid(), new HeatTrappers(), new ArtificialPhotosynthesis()];
  p1.cardsInHand.push(...stand);
  p1.megaCredits = 60;
  p1.plants = 0;
  p1.heat = 0;
  p2.production.add(Resource.HEAT, 3);
  p2.plants = 5;
  p2.megaCredits = 30;
  runAllActions(game);
  const unplayable = stand.filter((c) => !p1.canPlay(c)).map((c) => c.name);
  if (unplayable.length > 0 || !mappers.canAct(p1) || game.activePlayer.id !== p1.id) {
    throw new Error(`the preselect-sole fixture expected the five stand cards playable and Aerial Mappers' action open on blue's turn — unplayable: ${unplayable.join(', ')}; mappers=${mappers.canAct(p1)}`);
  }
  write('preselect-sole', game);
}

// ── T15 · WILDLIFE DOME — THE STAGED BOARD'S STAND (ledger CD — «STAGED PLAY — РОЗЫГРЫШ, КОТОРЫЙ ЗАКАНЧИВАЕТСЯ НА
//    ПОЛЕ»). The Greens rule (their quiet law enacted); Wildlife Dome MOVED out of the dealt pool into blue's hand, 40 M€;
//    blue owns a city and a greenery on the board's first land cells (seated bare — `simpleAddTile`: no bonus, no
//    oxygen, so the scales stand at the start) and Herbivores on the table, so a greenery's cell names the table's answer
//    («Сработает»: +1 animal) beside what the cell gives, and the cursor's first cell is beside blue's own tiles (far
//    from the board's centre). Variants: the oxygen at its maximum (the tile's rating alone); no free cell beside blue's
//    tiles (the card is NOT playable, the hand names why); a city with Pets on the table (the standard project's dossier
//    names Pets' animal); Ice Asteroid with one ocean left (PL-595 — the second ocean is named, never dropped). ──
function wildlifeDomeTable(name: string, extra?: (table: ParliamentTable) => void, playable = true): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [40, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: (table) => {
      const {game, p1, parliament} = table;
      seatEnacted(parliament, quietResolutionOf(PartyName.GREENS));
      const city = game.board.getAvailableSpacesForCity(p1)[0];
      game.simpleAddTile(p1, city, {tileType: TileType.CITY});
      const green = game.board.getAvailableSpacesForGreenery(p1)[0];
      game.simpleAddTile(p1, green, {tileType: TileType.GREENERY});
      moveToDeckTop(game, CardName.HERBIVORES);
      p1.playedCards.push(game.projectDeck.drawOrThrow(game));
      gmoToHand(game, p1, [CardName.WILDLIFE_DOME]);
      extra?.(table);
    },
    expect: ({game, p1, parliament}) => {
      const card = p1.cardsInHand.find((c) => c.name === CardName.WILDLIFE_DOME);
      if (card === undefined || p1.canPlay(card) !== playable || parliament.rulingParty() !== PartyName.GREENS || game.activePlayer.id !== p1.id) {
        throw new Error(`the ${name} fixture expected T15 ${playable ? 'playable' : 'NOT playable'} with the Greens ruling and blue on the move — got card=${card !== undefined} canPlay=${card !== undefined && p1.canPlay(card)} ruling=${parliament.rulingParty()}`);
      }
      parliament.assertLedger(game);
    },
  });
}
wildlifeDomeTable('wildlife-dome');
wildlifeDomeTable('wildlife-dome-o2max', ({game}) => setOxygenLevel(game, 14));
wildlifeDomeTable('wildlife-dome-noroom', ({game, p1, p2}) => {
  // Every cell a greenery of blue's may take holds red's city (seated bare) — beside blue's tiles first, then the
  // «anywhere on land» fallback the greenery rule opens when those are gone: blue's greenery has nowhere to go.
  for (let round = 0; round < 3; round++) {
    for (const space of game.board.getAvailableSpacesForGreenery(p1)) {
      game.simpleAddTile(p2, space, {tileType: TileType.CITY});
    }
  }
}, false);
// ── T03 · CULTURAL METROPOLIS — the first classic card with a political EFFECT on the facade, and the first play with
//    TWO DOORS (ledger CF): the city's staged cell, THEN the live grant «2 delegates to one resolution» (the vote mode,
//    hosted in the hand's own zone). Cultural Metropolis MOVED out of the dealt pool into blue's hand, 40 M€, 1 energy
//    production (the card's −1 needs a step to take).
//      · `cultural-metropolis` — Unity RULES (its quiet law enacted): playable, «energy 1 → 0 · M€ +3», the reserve 2+;
//      · `cultural-metropolis-locked` — another party rules and Unity's resolution stands on the vote with ONE delegate of
//        blue's: «✕», «1 of 2»;
//      · `cultural-metropolis-reserve` — Unity rules, but blue's reserve holds ONE delegate (the rest on a resolution):
//        «✕», «Делегатов в резерве: 1 из 2». ──
function culturalMetropolisTable(game: IGame, p1: IPlayer): void {
  p1.production.add(Resource.ENERGY, 1);
  gmoToHand(game, p1, [CardName.CULTURAL_METROPOLIS]);
}
function culturalMetropolisFixture(name: string, arrange: (table: ParliamentTable) => void, playable: boolean, check: (table: ParliamentTable) => string | undefined): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [40, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: (table) => {
      arrange(table);
      culturalMetropolisTable(table.game, table.p1);
    },
    expect: (table) => {
      const {game, p1, parliament} = table;
      const card = p1.cardsInHand.find((c) => c.name === CardName.CULTURAL_METROPOLIS);
      const wrong = check(table);
      if (card === undefined || p1.canPlay(card) !== playable || game.activePlayer.id !== p1.id || wrong !== undefined) {
        throw new Error(`the ${name} fixture expected T03 ${playable ? 'playable' : 'NOT playable'} with blue on the move — got card=${card !== undefined} canPlay=${card !== undefined && p1.canPlay(card)} ruling=${parliament.rulingParty()} reserve=${parliament.reserve(p1)} ${wrong ?? ''}`);
      }
      parliament.assertLedger(game);
    },
  });
}
culturalMetropolisFixture('cultural-metropolis', ({parliament}) => {
  seatEnacted(parliament, quietResolutionOf(PartyName.UNITY));
}, true, ({p1, parliament}) =>
  parliament.rulingParty() !== PartyName.UNITY || parliament.reserve(p1) < 2 || parliament.partiesInVotingArea().length < 2 ? 'Unity ruling, 2+ in reserve, 2+ resolutions on the vote' : undefined);
culturalMetropolisFixture('cultural-metropolis-locked', ({parliament, p1}) => {
  seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
  if (parliament.slotOf(PartyName.UNITY) === undefined) {
    seatResolution(parliament, 0, quietResolutionOf(PartyName.UNITY));
  }
  parliament.placeVote(p1, parliament.slotOf(PartyName.UNITY)!, 'lobby');
}, false, ({p1, parliament}) => {
  const unity = parliament.slotOf(PartyName.UNITY);
  return unity === undefined || parliament.votesOf(p1, unity) !== 1 || parliament.rulingParty() === PartyName.UNITY ? 'one delegate of blue\'s on Unity\'s resolution, Unity not ruling' : undefined;
});
culturalMetropolisFixture('cultural-metropolis-reserve', ({parliament, p1}) => {
  seatEnacted(parliament, quietResolutionOf(PartyName.UNITY));
  const slot = parliament.slots[parliament.slots.length - 1];
  while (parliament.reserve(p1) > 1) {
    parliament.placeVote(p1, slot, 'reserve');
  }
}, false, ({p1, parliament}) =>
  parliament.rulingParty() !== PartyName.UNITY || parliament.reserve(p1) !== 1 ? 'Unity ruling and exactly 1 in blue\'s reserve' : undefined);
parliamentFixture('sp-city-pets', {
  stopAt: 'vote',
  megacredits: [40, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1}) => {
    moveToDeckTop(game, CardName.PETS);
    p1.playedCards.push(game.projectDeck.drawOrThrow(game));
  },
  expect: ({game, p1, parliament}) => {
    if (!p1.tableau.has(CardName.PETS) || game.activePlayer.id !== p1.id || p1.megaCredits < 25) {
      throw new Error('the sp-city-pets fixture expected Pets on blue\'s table, 25+ M€ and blue on the move');
    }
    parliament.assertLedger(game);
  },
});
parliamentFixture('oceans-one-left', {
  stopAt: 'vote',
  megacredits: [40, 30],
  options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
  arrange: ({game, p1}) => {
    maxOutOceans(p1, 8);
    gmoToHand(game, p1, [CardName.ICE_ASTEROID]);
  },
  expect: ({game, p1, parliament}) => {
    const card = p1.cardsInHand.find((c) => c.name === CardName.ICE_ASTEROID);
    if (card === undefined || !p1.canPlay(card) || game.board.getOceanSpaces().length !== 8 || game.activePlayer.id !== p1.id) {
      throw new Error(`the oceans-one-left fixture expected Ice Asteroid playable with 8 oceans and blue on the move — got oceans=${game.board.getOceanSpaces().length}`);
    }
    parliament.assertLedger(game);
  },
});
// ── T05 · EVENT ANALYSTS — «+1 influence», the first card of the premium scope that gives influence BEYOND the Career
//    (ledger CG — «ИТОГОВОЕ ВЛИЯНИЕ ВЕЗДЕ»). The Scientists RULE (their quiet law enacted), Biodome Contest («2 plants per
//    influence») stands on the vote — the forecast reads the final influence; blue's Career marker on step 3 (level 2),
//    20 M€ (Teractor · Thorgate — calm corporations):
//      · `event-analysts` — Event Analysts MOVED out of the dealt pool into blue's hand: playable, the composer's chip
//        «[влияние] 2 → 3»;
//      · `event-analysts-played` — the card PLAYED for real (the facade's journal line, the bonus with its source):
//        influence 3 = 2 + 1 everywhere; Political Recognition («advance your Career 3 steps») in hand with four other
//        cards with requirements on the table — its walk 3 → 6 lands on the level-3 step: «уровень 3 · влияние 4 +1»;
//      · `event-analysts-locked` — another party rules and the Scientists' resolution stands on the vote with ONE delegate
//        of blue's: «✕», «1 of 2». ──
function eventAnalystsFixture(name: string, arrange: (table: ParliamentTable) => void, check: (table: ParliamentTable) => string | undefined): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [20, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: (table) => {
      table.parliament.agenda.set(table.p1.id, 3);
      arrange(table);
    },
    expect: (table) => {
      const {game, p1, parliament} = table;
      const wrong = check(table);
      if (game.activePlayer.id !== p1.id || wrong !== undefined) {
        throw new Error(`the ${name} fixture: ${wrong ?? 'blue is not on the move'} (ruling=${parliament.rulingParty()} influence=${parliament.influence(p1)})`);
      }
      parliament.assertLedger(game);
    },
  });
}
function eventAnalystsTable({game, parliament}: ParliamentTable): void {
  seatEnacted(parliament, quietResolutionOf(PartyName.SCIENTISTS));
  seatResolution(parliament, 0, BIODOME_CONTEST_ID);
  if (game.parliament?.slotOf(PartyName.GREENS) === undefined) {
    throw new Error('event-analysts: Biodome Contest did not take the vote');
  }
}
eventAnalystsFixture('event-analysts', (table) => {
  eventAnalystsTable(table);
  gmoToHand(table.game, table.p1, [CardName.EVENT_ANALYSTS]);
}, ({p1, parliament}) => {
  const card = p1.cardsInHand.find((c) => c.name === CardName.EVENT_ANALYSTS);
  return card === undefined || !p1.canPlay(card) || parliament.influence(p1) !== 2 ? 'T05 playable, influence 2' : undefined;
});
eventAnalystsFixture('event-analysts-played', (table) => {
  eventAnalystsTable(table);
  const {game, p1} = table;
  gmoToHand(game, p1, [CardName.EVENT_ANALYSTS]);
  p1.playCard(p1.cardsInHand.find((c) => c.name === CardName.EVENT_ANALYSTS)!);
  runAllActions(game);
  for (const required of [CardName.LICHEN, CardName.ALGAE, CardName.KELP_FARMING, CardName.TUNDRA_FARMING]) {
    moveToDeckTop(game, required);
    p1.playedCards.push(game.projectDeck.drawOrThrow(game));
  }
  gmoToHand(game, p1, [CardName.POLITICAL_RECOGNITION]);
  p1.megaCredits = 20;
}, ({p1, parliament}) => {
  const walk = p1.cardsInHand.find((c) => c.name === CardName.POLITICAL_RECOGNITION);
  if (parliament.influence(p1) !== 3 || parliament.influenceBonusOf(p1) !== 1) {
    return `influence 3 with a bonus of 1 (got ${parliament.influence(p1)} / ${parliament.influenceBonusOf(p1)})`;
  }
  return walk === undefined || !p1.canPlay(walk) ? 'Political Recognition playable' : undefined;
});
eventAnalystsFixture('event-analysts-locked', ({game, p1, parliament}) => {
  seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
  if (parliament.slotOf(PartyName.SCIENTISTS) === undefined) {
    seatResolution(parliament, 0, quietResolutionOf(PartyName.SCIENTISTS));
  }
  parliament.placeVote(p1, parliament.slotOf(PartyName.SCIENTISTS)!, 'lobby');
  gmoToHand(game, p1, [CardName.EVENT_ANALYSTS]);
}, ({p1, parliament}) => {
  const card = p1.cardsInHand.find((c) => c.name === CardName.EVENT_ANALYSTS);
  const slot = parliament.slotOf(PartyName.SCIENTISTS);
  return card === undefined || p1.canPlay(card) || slot === undefined || parliament.votesOf(p1, slot) !== 1 ? 'T05 NOT playable, one delegate of blue\'s on the Scientists\' resolution' : undefined;
});

// ── T07 · MARTIAN MEDIA CENTER — «pay 3 M€ → add a delegate»: under Redux a vote from the RESERVE for 3 M€, an ACTION
//    of «Действия карт» that enters the Parliament as the STAGED door (TR15's fourth door — ledger CH). The voting area
//    is pinned as `martian-census`'s (Industrialists · Mars First · Greens — the Greens rule by the starting rule), blue
//    holds 20 M€, the free delegate in the lobby and a full reserve; the card is the game's own copy, taken out of
//    wherever the deal put it, on blue's table with its action unused (Teractor · Thorgate — calm corporations: no
//    Helion bill in front of the door):
//      · `martian-media-center` — the action live;
//      · `martian-media-center-poor` — 2 M€: «Need 1 more M€»;
//      · `martian-media-center-quiet` — no resolution up for a vote: «No resolution is up for a vote» (never «paid and
//        placed nothing»);
//      · `martian-media-center-reserve` — every delegate of blue's in play: «Delegates in your reserve: 0 of 1»;
//      · `martian-media-center-hand` — the card in HAND with ONE delegate of blue's on Mars First's resolution: the
//        requirement's chip «1 of 2». ──
function mediaCenterFixture(name: string, arrange: (table: ParliamentTable) => void, check: (table: ParliamentTable) => string | undefined): void {
  parliamentFixture(name, {
    stopAt: 'vote',
    megacredits: [20, 30],
    options: {customCorporationsList: [CardName.TERACTOR, CardName.THORGATE]},
    arrange: (table) => {
      const {game, parliament} = table;
      seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
      seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
      seatResolution(parliament, 2, AQUIFER_CONTEST_ID);
      moveToDeckTop(game, CardName.MARTIAN_MEDIA_CENTER);
      arrange(table);
    },
    expect: (table) => {
      const {game, p1, parliament} = table;
      const wrong = check(table);
      if (game.activePlayer.id !== p1.id || wrong !== undefined) {
        throw new Error(`the ${name} fixture: ${wrong ?? 'blue is not on the move'} (mc=${p1.megaCredits} reserve=${parliament.reserve(p1)} slots=${parliament.slots.length})`);
      }
      parliament.assertLedger(game);
    },
  });
}
/** The card off the deck's top onto blue's table, its action unused. */
function mediaCenterOnTable({game, p1}: ParliamentTable): MartianMediaCenter {
  const card = game.projectDeck.drawPile.pop() as MartianMediaCenter;
  p1.playedCards.push(card);
  return card;
}
mediaCenterFixture('martian-media-center', (table) => {
  mediaCenterOnTable(table);
}, ({p1, parliament}) => {
  const card = p1.tableau.get(CardName.MARTIAN_MEDIA_CENTER);
  const parties = parliament.slots.map((s) => parliament.resolutionOf(s.instance).party);
  if (card === undefined || !(card as MartianMediaCenter).canAct(p1) || p1.actionsThisGeneration.has(CardName.MARTIAN_MEDIA_CENTER)) {
    return 'the card on the table with its action live';
  }
  return p1.megaCredits !== 20 || !parliament.lobby.has(p1.id) || parliament.reserve(p1) < 2 ||
    parties.join(',') !== [PartyName.INDUSTRIALISTS, PartyName.MARS, PartyName.GREENS].join(',') ?
    `20 M€, the lobby cube, a reserve of 2+, slots [Industrialists, Mars First, Greens] (got ${parties.join(',')})` : undefined;
});
mediaCenterFixture('martian-media-center-poor', (table) => {
  mediaCenterOnTable(table);
  table.p1.megaCredits = 2;
}, ({p1}) => (p1.tableau.get(CardName.MARTIAN_MEDIA_CENTER) as MartianMediaCenter | undefined)?.canAct(p1) !== false ? 'the action refused for M€' : undefined);
mediaCenterFixture('martian-media-center-quiet', (table) => {
  mediaCenterOnTable(table);
  table.parliament.slots = [];
}, ({p1, parliament}) => parliament.slots.length !== 0 || (p1.tableau.get(CardName.MARTIAN_MEDIA_CENTER) as MartianMediaCenter | undefined)?.canAct(p1) !== false ?
  'an empty voting area, the action refused' : undefined);
mediaCenterFixture('martian-media-center-reserve', (table) => {
  mediaCenterOnTable(table);
  const {p1, parliament} = table;
  const slot = parliament.slots[2];
  while (parliament.reserve(p1) > 0) {
    parliament.placeVote(p1, slot, 'reserve');
  }
}, ({p1, parliament}) => parliament.reserve(p1) !== 0 || (p1.tableau.get(CardName.MARTIAN_MEDIA_CENTER) as MartianMediaCenter | undefined)?.canAct(p1) !== false ?
  'an empty reserve, the action refused' : undefined);
mediaCenterFixture('martian-media-center-hand', (table) => {
  const {game, p1, parliament} = table;
  p1.cardsInHand.push(game.projectDeck.drawPile.pop() as MartianMediaCenter);
  parliament.placeVote(p1, parliament.slotOf(PartyName.MARS)!, 'reserve');
}, ({p1, parliament}) => {
  const card = p1.cardsInHand.find((c) => c.name === CardName.MARTIAN_MEDIA_CENTER);
  return card === undefined || p1.canPlay(card) || parliament.votesOf(p1, parliament.slotOf(PartyName.MARS)!) !== 1 ?
    'the card in hand, NOT playable, one delegate of blue\'s on Mars First\'s resolution' : undefined;
});

// ── CH · «ЖУРНАЛ — ХРОНИКА, НЕ ЛОГ» — the journal's stand (the first e2e of the console journal). A two-seat base
//    table (Teractor · Thorgate) whose generation 1 was PLAYED through the real doors, so the log and the event stream
//    carry every kind of row the chronicle draws, and generation 2 is open with one more play:
//      · blue plays Imported Nitrogen through the menu — +1 TR, 4 plants, and its «3 microbes / 2 animals to ANOTHER
//        card» find no holder: two NAMED skips («ПРОПУЩЕНО»);
//      · blue takes Development Center's action (1 energy → a card) — a card ACTION;
//      · red plays Mine and Asteroid — another seat's turn; the asteroid's «remove up to 3 plants» takes blue's (an
//        arrow with a direction: from whom → to whom);
//      · blue's Acquired Space Agency reveals until two space cards — the SEARCH draw («revealed N · kept 2 · the rest
//        discarded»), the sheet of names the chronicle turns into a fan;
//      · both pass: the production phase (TR61 — each seat's income group), the research buy (nothing bought);
//      · generation 2: red draws with Lagrange Observatory and passes; blue plays its own (a draw of 1).
//    Blue is on the move in generation 2; the journal's pager has two generations. ──
{
  const name = 'journal-chronicle';
  const pinned = [CardName.TERACTOR, CardName.THORGATE];
  const [game, p1, p2] = testGame(2, {skipInitialCardSelection: false, startingCorporations: 1, customCorporationsList: [...pinned]});
  assignPinnedCorporations(name, [p1, p2], pinned);
  answerStartFlow(game, [p1, p2]);
  const fresh = (cardName: CardName) => {
    const card = newProjectCard(cardName);
    if (card === undefined) {
      throw new Error(`${name}: no card ${cardName}`);
    }
    return card;
  };
  const menu = (player: TestPlayer): OrOptions => {
    const wf = player.getWaitingFor();
    if (!(wf instanceof OrOptions)) {
      throw new Error(`${name}: ${player.color} is not at the action menu (${wf?.constructor.name})`);
    }
    return wf;
  };
  const option = (player: TestPlayer, title: string): number => {
    const index = menu(player).options.findIndex((o) => o.title === title);
    if (index < 0) {
      throw new Error(`${name}: ${player.color}'s menu has no «${title}» (${menu(player).options.map((o) => String(o.title)).join(' | ')})`);
    }
    return index;
  };
  /** Answer what a play asked with the plainest legal answer (the first of each). */
  const answerAsks = (player: TestPlayer) => {
    for (let round = 0; round < 8; round++) {
      const wf = player.getWaitingFor();
      if (wf === undefined || (wf instanceof OrOptions && wf.options.some((o) => o.title === 'Pass for this generation'))) {
        return;
      }
      if (wf instanceof SelectCard) {
        player.process({type: 'card', cards: wf.cards.slice(0, wf.config.min).map((c) => c.name)});
      } else if (wf instanceof OrOptions) {
        player.process({type: 'or', index: 0, response: {type: 'option'}});
      } else if (wf instanceof SelectSpace) {
        player.process({type: 'space', spaceId: quietCellOf(game, wf).id});
      } else if (wf.type === 'player') {
        player.process({type: 'player', player: p1.color});
      } else {
        throw new Error(`${name}: the builder cannot answer a «${wf.type}» prompt of ${player.color}`);
      }
      runAllActions(game);
    }
  };
  // Every card a seat plays is in its hand BEFORE its menu is built (the menu lists the hand as it stood).
  const play = (player: TestPlayer, cardName: CardName) => {
    const card = player.cardsInHand.find((c) => c.name === cardName);
    if (card === undefined) {
      throw new Error(`${name}: ${cardName} is not in ${player.color}'s hand`);
    }
    player.process({type: 'or', index: option(player, 'Play project card'), response: {
      type: 'projectCard', card: card.name, payment: Payment.of({megacredits: player.getCardCost(card)}),
    }});
    runAllActions(game);
    answerAsks(player);
  };
  p1.megaCredits = 80;
  p2.megaCredits = 80;
  p1.plants = 2;
  p1.energy = 3;
  p1.playedCards.push(fresh(CardName.DEVELOPMENT_CENTER));
  p1.cardsInHand.push(fresh(CardName.IMPORTED_NITROGEN), fresh(CardName.LAGRANGE_OBSERVATORY));
  p2.cardsInHand.push(fresh(CardName.MINE), fresh(CardName.ASTEROID), fresh(CardName.LAGRANGE_OBSERVATORY));
  if (game.activePlayer.id !== p1.id) {
    throw new Error(`${name}: expected blue to open the generation`);
  }
  // The menu standing was built before the hand grew: build it again.
  p1.popWaitingFor();
  p1.takeAction();
  play(p1, CardName.IMPORTED_NITROGEN);
  p1.process({type: 'or', index: option(p1, 'Perform an action from a played card'), response: {type: 'card', cards: [CardName.DEVELOPMENT_CENTER]}});
  runAllActions(game);
  answerAsks(p1);
  play(p2, CardName.MINE);
  play(p2, CardName.ASTEROID);
  // The SEARCH draw — the prelude's own play (a card-play scope of its own), while blue holds the menu.
  const agency = newPrelude(CardName.ACQUIRED_SPACE_AGENCY);
  if (agency === undefined) {
    throw new Error(`${name}: no Acquired Space Agency`);
  }
  p1.playCard(agency);
  runAllActions(game);
  answerAsks(p1);
  // Both pass: the production phase, then the research buy (nothing bought).
  p1.process({type: 'or', index: option(p1, 'Pass for this generation'), response: {type: 'option'}});
  runAllActions(game);
  p2.process({type: 'or', index: option(p2, 'Pass for this generation'), response: {type: 'option'}});
  runAllActions(game);
  for (const seat of [p1, p2]) {
    const wf = seat.getWaitingFor();
    if (wf instanceof SelectCard) {
      seat.process({type: 'card', cards: []});
      runAllActions(game);
    }
  }
  if (game.generation !== 2 || game.phase !== Phase.ACTION) {
    throw new Error(`${name}: expected generation 2's action phase, got gen=${game.generation} phase=${game.phase}`);
  }
  // Generation 2 opens with red (the first player rotates): red's draw, red's pass — then blue's own play, blue on the move.
  if (game.activePlayer.id === p2.id) {
    play(p2, CardName.LAGRANGE_OBSERVATORY);
    p2.process({type: 'or', index: option(p2, 'Pass for this generation'), response: {type: 'option'}});
    runAllActions(game);
  }
  play(p1, CardName.LAGRANGE_OBSERVATORY);
  if (game.activePlayer.id !== p1.id || !(p1.getWaitingFor() instanceof OrOptions)) {
    throw new Error(`${name}: expected blue on the move in generation 2`);
  }
  const skips = (game.serialize().gameEvents ?? []).filter((e) => e.type === 'effect-skipped').length;
  const search = game.gameLog.some((m) => m.message.includes('revealed'));
  if (skips < 1 || game.gameLog.length < 20) {
    throw new Error(`${name}: expected a rich generation — got skips=${skips} search=${search} log=${game.gameLog.length}`);
  }
  write(name, game);
}

// ── R38 · LAKEFRONT RESORTS — the first classic Turmoil CORPORATION adapted in place (ledger CI): a Redux table, blue
//    on Lakefront Resorts (its adjacency rate 3 — `oceanBonus`), red on ThorGate, 80 M€ each. Red's two oceans stand
//    on 06 and 07 (Tharsis' first row), so 12 — the land between them — has TWO oceans beside it: the cell dossier reads
//    «2 × 3 M€» for blue (and «2 × 2» for red). Blue is on the move:
//      · `lakefront-resorts` — the stand's one table: the corporation's face and its two rules, the Aquifer's forecast
//        «+1 M€ production · Lakefront Resorts», the dossier on 12, and red's own ocean answered on blue's production. ──
parliamentFixture('lakefront-resorts', {
  stopAt: 'vote',
  megacredits: [80, 80],
  options: {customCorporationsList: [CardName.LAKEFRONT_RESORTS, CardName.THORGATE]},
  arrange: ({game, p2}) => {
    for (const id of ['06', '07'] as const) {
      game.addOcean(p2, game.board.getSpaceOrThrow(id as SpaceId));
    }
  },
  expect: ({game, p1}) => {
    const between = game.board.getSpaceOrThrow('12' as SpaceId);
    const oceans = game.board.getAdjacentSpaces(between).filter((s) => Board.isOceanSpace(s)).map((s) => s.id);
    if (!p1.playedCards.has(CardName.LAKEFRONT_RESORTS) || p1.oceanBonus !== 3 || game.activePlayer.id !== p1.id ||
      between.spaceType !== SpaceType.LAND || between.tile !== undefined || oceans.join(',') !== '06,07') {
      throw new Error(`the lakefront-resorts fixture: blue on Lakefront (rate ${p1.oceanBonus}), on the move (${game.activePlayer.color}), 12 a free land cell beside exactly 06 and 07 (got ${between.spaceType} ${oceans.join(',')})`);
    }
  },
});

// ── R14 · TERRALABS RESEARCH — the second classic Turmoil CORPORATION adapted in place: its printed 1 M€ REPLACES the
//    buy-to-hand price, so the stand reads every purchase surface for «× 1» (never a «3»). Both tables are the TR61
//    generation end with blue on TerraLabs (`baseCardCost` 1, the TR one step below the table's) and 20 M€:
//      · `terralabs-research`       — solo, NO draft: the pass ends the generation and the research buy rises — the
//        wallet «N × 1 = −N · у вас 20 → …», its «× 1» naming TerraLabs in the hint;
//      · `terralabs-research-draft` — two seats WITH the draft, red already passed: blue's pass opens the draft and its
//        purchase — the same wallet after the picks. ──
function terralabsTable(name: string, player: TestPlayer, game: IGame): void {
  if (!player.playedCards.has(CardName.TERRALABS_RESEARCH) || player.cardCost !== 1 || player.megaCredits !== 20) {
    throw new Error(`${name}: expected blue on TerraLabs Research (price ${player.cardCost}) with 20 M€ (got ${player.megaCredits})`);
  }
  write(name, game);
}
{
  const {game, player} = soloActionPhase({customCorporationsList: [CardName.TERRALABS_RESEARCH], startingCorporations: 1});
  generationEndStocks(player, 4);
  player.setTerraformRating(13);
  runAllActions(game);
  if (game.gameOptions.draftVariant || game.activePlayer.id !== player.id || !(player.getWaitingFor() instanceof OrOptions)) {
    throw new Error(`terralabs-research: expected a solo table without a draft on the move, got wf=${player.getWaitingFor()?.constructor.name}`);
  }
  terralabsTable('terralabs-research', player, game);
}
{
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, draftVariant: true,
    customCorporationsList: [CardName.THORGATE, CardName.TERACTOR], startingCorporations: 1,
  });
  answerStartFlow(game, [p1, p2]);
  // The list goes on top of the DECK, not to a seat — blue's corporation is replaced through the real play (the
  // printed price written into `baseCardCost`), then the stocks below set the table.
  for (const corp of p1.playedCards.corporations()) {
    p1.playedCards.remove(corp);
  }
  p1.playCorporationCard(newCorporationCard(CardName.TERRALABS_RESEARCH)!);
  runAllActions(game);
  generationEndStocks(p1, 4);
  p1.setTerraformRating(19);
  p2.megaCredits = 20;
  p2.pass();
  runAllActions(game);
  if (!game.gameOptions.draftVariant || game.activePlayer.id !== p1.id || !game.getPassedPlayers().includes(p2.color) || !(p1.getWaitingFor() instanceof OrOptions)) {
    throw new Error(`terralabs-research-draft: expected blue on the move with red passed on a drafting table, got active=${game.activePlayer.color} wf=${p1.getWaitingFor()?.constructor.name}`);
  }
  terralabsTable('terralabs-research-draft', p1, game);
}

// ── R33 · UTOPIA INVEST — the third classic Turmoil CORPORATION adapted in place: its ACTION is six declarative
//    variants «lower a production 1 step → gain 4 of that resource», read by the action composer as ONE PALETTE (the
//    face prints one «[?-prod] → 4 [?]» row for all six) and committed with the production PRICE leaving the rail's
//    badge FIRST. A Redux two-seat table, blue on Utopia Invest (replaced through the real play), on the move:
//      · `utopia-invest`      — the opening's productions (M€ 0 · steel 1 · titanium 1 · the rest 0): three live
//        variants (M€ 0 → −1 allowed), three refused by name; stocks 20 M€ / 2 steel / 0 titanium / 5 heat;
//      · `utopia-invest-sole` — M€ production at its floor (−5), only steel 1: ONE live variant, seeded and marked;
//      · `utopia-invest-dead` — M€ −5 and every other production 0: the action itself is unavailable, one reason. ──
function utopiaTable(name: string, production: {megacredits: number, steel: number, titanium: number}, liveVariants: number): void {
  const [game, p1, p2] = testGame(2, {skipInitialCardSelection: false, turmoilReduxExpansion: true, coloniesExtension: true});
  answerStartFlow(game, [p1, p2]);
  for (const corp of p1.playedCards.corporations()) {
    p1.playedCards.remove(corp);
  }
  p1.playCorporationCard(newCorporationCard(CardName.UTOPIA_INVEST)!);
  runAllActions(game);
  p1.production.override({...production, plants: 0, energy: 0, heat: 0});
  p1.megaCredits = 20;
  p1.steel = 2;
  p1.titanium = 0;
  p1.plants = 1;
  p1.energy = 0;
  p1.heat = 5;
  p2.megaCredits = 30;
  runAllActions(game);
  const utopia = p1.playedCards.corporations().find((c) => c.name === CardName.UTOPIA_INVEST);
  const live = utopia === undefined ? -1 : actionPreview(p1, utopia as unknown as ICard & IActionCard).branches.filter((b) => b.available).length;
  if (game.activePlayer.id !== p1.id || !(p1.getWaitingFor() instanceof OrOptions) || live !== liveVariants) {
    throw new Error(`${name}: expected blue on Utopia Invest on the move with ${liveVariants} live variants, got active=${game.activePlayer.color} live=${live} wf=${p1.getWaitingFor()?.constructor.name}`);
  }
  write(name, game);
}
utopiaTable('utopia-invest', {megacredits: 0, steel: 1, titanium: 1}, 3);
utopiaTable('utopia-invest-sole', {megacredits: -5, steel: 1, titanium: 0}, 1);
utopiaTable('utopia-invest-dead', {megacredits: -5, steel: 0, titanium: 0}, 0);

// ── R07 · PRISTAR — the fourth and last classic Turmoil corporation adapted in place: the rating cell wears its STATE
//    (the preservation token «waiting» / «spent», `data-tr-pristar`) off the server's `ratingRaisedThisGeneration`,
//    and the production phase names its +6 M€ (`productionIncome.hooks`) so the generation scene flies it.
//      · `pristar`                   — two seats on Redux, generation 1's action phase, blue on Pristar (TR 18), red on
//                                      a calm corporation, 8 heat at −30 °C: the heat conversion raises the rating on the UI;
//      · `pristar-raised`            — the same table after a rise (the flag up — the token struck);
//      · `pristar-production`        — solo, NO draft, the TR61 generation end on Pristar with the flag down: the pass
//                                      plays the scene, the hook's token after the income;
//      · `pristar-production-raised` — the same with the flag up: no hook line, no token, no preservation;
//      · `pristar-veto`              — RX42 enacted, RED (the viewer, who opens generation 2) on Pristar and first by
//                                      rating 30 against blue's 27, the flag down: the two marks of one cell. ──
function pristarSolo(name: string): {game: IGame, player: TestPlayer} {
  const {game, player} = soloActionPhase({customCorporationsList: [CardName.PRISTAR], startingCorporations: 1});
  if (!player.playedCards.has(CardName.PRISTAR) || player.hasIncreasedTerraformRatingThisGeneration) {
    throw new Error(`${name}: expected blue on Pristar with the rating not raised this generation, got tr=${player.terraformRating}`);
  }
  return {game, player};
}
for (const raised of [false, true]) {
  const name = raised ? 'pristar-raised' : 'pristar';
  // Two seats (no solo colony trim in the start): blue on Pristar opens generation 1, red on a calm corporation is the
  // rival whose rail never wears the mark.
  const {game, p1} = reduxTable(name, {customCorporationsList: [CardName.PRISTAR, REDUX_TABLE_CORPORATIONS[0]]});
  p1.heat = 8;
  p1.megaCredits = 40;
  p1.pendingInitialActions = [];
  if (raised) {
    p1.increaseTerraformRating(1);
  }
  runAllActions(game);
  if (!p1.playedCards.has(CardName.PRISTAR) || p1.hasIncreasedTerraformRatingThisGeneration !== raised || game.generation !== 1 ||
      game.activePlayer.id !== p1.id || !(p1.getWaitingFor() instanceof OrOptions)) {
    throw new Error(`${name}: expected blue on Pristar on the move in generation 1 with the flag ${raised ? 'up' : 'down'}, got gen=${game.generation} wf=${p1.getWaitingFor()?.constructor.name}`);
  }
  if (p1.terraformRating !== 18 + (raised ? 1 : 0)) {
    throw new Error(`${name}: expected the start two steps down (18), got ${p1.terraformRating}`);
  }
  write(name, game);
}
for (const raised of [false, true]) {
  const name = raised ? 'pristar-production-raised' : 'pristar-production';
  const {game, player} = pristarSolo(name);
  generationEndStocks(player, 4);
  player.pendingInitialActions = [];
  player.hasIncreasedTerraformRatingThisGeneration = raised;
  runAllActions(game);
  if (game.gameOptions.draftVariant || game.activePlayer.id !== player.id || !(player.getWaitingFor() instanceof OrOptions)) {
    throw new Error(`${name}: expected a solo table without a draft on the move, got wf=${player.getWaitingFor()?.constructor.name}`);
  }
  write(name, game);
}
parliamentFixture('pristar-veto', {
  resolution: UNMI_VETO_ID,
  votes: [1],
  agenda: [1, 2],
  stopAt: 'done',
  options: {customCorporationsList: [REDUX_TABLE_CORPORATIONS[0], CardName.PRISTAR]},
  arrange: ({p2}) => {
    p2.pendingInitialActions = [];
  },
  after: ({p1, p2}) => {
    p1.setTerraformRating(27);
    p2.setTerraformRating(30);
    p2.megaCredits = 30;
    // The sitting's own steps (a Career bonus) may have raised the rating in generation 2 — the stand reads «waiting».
    p2.hasIncreasedTerraformRatingThisGeneration = false;
  },
  expect: (table) => {
    const {p1, p2, parliament} = table;
    if (parliament.enacted !== resolutionInstanceId(UNMI_VETO_ID, 0)) {
      throw new Error(`pristar-veto: expected UNMI Veto enacted, got ${parliament.enacted}`);
    }
    if (!p2.playedCards.has(CardName.PRISTAR) || p1.playedCards.has(CardName.PRISTAR)) {
      throw new Error('pristar-veto: expected red (and only red) on Pristar');
    }
    if (p2.terraformRating !== 30 || p1.terraformRating !== 27 || p2.hasIncreasedTerraformRatingThisGeneration) {
      throw new Error(`pristar-veto: expected red first by rating 30 / 27 with the flag down, got ${p2.terraformRating} / ${p1.terraformRating}`);
    }
    expectViewerOpensGeneration(table, p2, 'pristar-veto');
  },
});
