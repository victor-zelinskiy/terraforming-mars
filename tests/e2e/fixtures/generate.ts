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
import {addCity, addOcean, maxOutOceans, runAllActions, setOxygenLevel, setTemperature, setVenusScaleLevel} from '../../TestingUtils';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
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
import {SpaceMirrors} from '../../../src/server/cards/base/SpaceMirrors';
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
import {HabitatScience} from '../../../src/server/cards/turmoilRedux/HabitatScience';
import {JovianLanterns} from '../../../src/server/cards/colonies/JovianLanterns';
import {AtmoCollectors} from '../../../src/server/cards/colonies/AtmoCollectors';
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
import {Mine} from '../../../src/server/cards/base/Mine';
import {BiomassCombustors} from '../../../src/server/cards/base/BiomassCombustors';
import {PowerPlant} from '../../../src/server/cards/base/PowerPlant';
import {FusionPower} from '../../../src/server/cards/base/FusionPower';
import {GeothermalPower} from '../../../src/server/cards/base/GeothermalPower';
import {HE3FusionPlant} from '../../../src/server/cards/moon/HE3FusionPlant';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {PoliticalScience} from '../../../src/server/cards/turmoilRedux/PoliticalScience';
import {PoliticalDonation} from '../../../src/server/cards/turmoilRedux/PoliticalDonation';
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
import {hasPartyRequirement} from '../../../src/server/cards/requirements/partyRequirementCards';
import {TransNeptuneProbe} from '../../../src/server/cards/base/TransNeptuneProbe';
import {testAutomaGame, testAutomaMultiplayerGame} from '../../automa/AutomaTestGame';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {Phase} from '../../../src/common/Phase';
import {IPlayer} from '../../../src/server/IPlayer';
import {AutomaState} from '../../../src/server/automa/AutomaState';
import {lobbyingDelegates} from '../../../src/server/automa/AutomaLobbying';
import {botQuestReachable} from '../../../src/common/parliament/botQuestPath';
import {botQuestTableOf} from '../../../src/server/automa/BotQuestEvents';

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

function soloActionPhase(): {game: IGame, player: TestPlayer} {
  const [game, player] = testGame(1, {skipInitialCardSelection: false});
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

// ═══════════════════════ THE MARS PARLIAMENT (Turmoil Redux) ═══════════════════════
//
// ONE BUILDER for every parliament fixture (the sitting rework, Э1): a 2-seat
// Redux table through the real start flow, the resolution SEATED (never
// assumed from the deal — `parliamentArrange`), the votes, the Agenda and the
// rest of the table arranged by the spec, then DRIVEN to the requested stop:
//   vote      — the action phase, the vote up (the browse layer, the vote mode);
//   assembly  — every seat passed: the VERDICT is known and NOTHING ELSE has
//               changed yet («Заседание v2»: the gate stands before the
//               Agenda step, the support, the enactment and the rewards — the
//               winner is still in its slot with its delegates, the government
//               is the previous one), and the ASSEMBLY gate stands for both
//               seats (nobody answered — «the viewer answered, the other did
//               not» is one API press away);
//   effects   — the assembly gate answered by both: the enacted resolution's
//               FIRST ask stands (or the phase went on, for a card that asks nothing);
//   adjourn   — the effects answered with the plainest legal answers (a pick:
//               every card of a take / the first candidate; a placement: a
//               quiet cell; a choice: the first branch), the area refreshed,
//               the lobby refilled, and the ADJOURN gate stands for both seats;
//   done      — the adjourn gate answered, research answered with empty picks:
//               generation 2's action phase, the sitting in `lastPhase` and
//               in the history.
// The dev loader opens the FIRST seat of the generation order: blue (p1) in
// generation 1, the seat that opened generation 2 in a `done` fixture.

/** `seats` is EVERY seat in generation order; `p1` / `p2` are its first two, named for the two-seat tables most fixtures are. */
type ParliamentTable = {game: IGame; p1: TestPlayer; p2: TestPlayer; seats: ReadonlyArray<TestPlayer>; parliament: Parliament};

type ParliamentStop = 'vote' | 'assembly' | 'effects' | 'adjourn' | 'done';

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
  if (spec.stopAt !== 'vote') {
    passToParliament(game);
    if (parliament.phase?.step !== 'assembly') {
      throw new Error(`${name}: expected the assembly gate, got ${parliament.phase?.step ?? 'no phase'}`);
    }
  }
  if (spec.stopAt === 'effects' || spec.stopAt === 'adjourn' || spec.stopAt === 'done') {
    answerStandingGates(game, 'assembly');
  }
  if (spec.stopAt === 'adjourn' || spec.stopAt === 'done') {
    answerEffects(game, name);
    if (parliament.phase?.step !== 'adjourn') {
      throw new Error(`${name}: expected the adjourn gate, got ${parliament.phase?.step ?? 'no phase'}`);
    }
  }
  if (spec.stopAt === 'done') {
    answerStandingGates(game, 'adjourn');
    if (parliament.phase !== undefined) {
      throw new Error(`${name}: the sitting did not close (step ${parliament.phase.step})`);
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
    p1.playedCards.push(new Tardigrades());
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
parliamentFixture('parliament-aquifer-assembly', aquiferTable('assembly'));
// …the SAME gate with SIX animal holders in blue's tableau: the recipient picker stands on six candidates —
// the Deck's «picker on 6» composition (docs/TURMOIL_REDUX_PARLIAMENT_FINISH.md § Э8).
parliamentFixture('parliament-aquifer-assembly-six', {
  ...aquiferTable('assembly'),
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
parliamentFixture('parliament-aquifer-adjourn', aquiferTable('adjourn', ({parliament, p1}) => {
  const outcomes = parliament.phase?.summary?.outcomes ?? [];
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
parliamentFixture('parliament-architecture-assembly', architectureTable('assembly'));
parliamentFixture('parliament-architecture-adjourn', architectureTable('adjourn'));
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
  const base = architectureTable('assembly');
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
  ...architectureTable('assembly'),
  arrange: (table) => {
    architectureTable('assembly').arrange?.(table);
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
  ...architectureTable('assembly'),
  arrange: (table) => {
    architectureTable('assembly').arrange?.(table);
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
parliamentFixture('parliament-powergrid-assembly', powerGridTable('assembly'));
parliamentFixture('parliament-powergrid-adjourn', powerGridTable('adjourn'));
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
    const unityRules = stopAt === 'effects' || stopAt === 'adjourn' || stopAt === 'done';
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
parliamentFixture('parliament-cloud-assembly', cloudTable('assembly'));
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
parliamentFixture('parliament-colonial-assembly', colonialTable('assembly'));

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
parliamentFixture('parliament-colony-assembly', colonyContestTable('assembly'));

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
parliamentFixture('parliament-gas-assembly', gasExportTable('assembly'));

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
    const expected = [`${ColonyName.LUNA}:2`, `${ColonyName.CALLISTO}:4`, `${ColonyName.CERES}:5`, `${ColonyName.IO}:6`];
    if (JSON.stringify(positions) !== JSON.stringify(expected)) {
      throw new Error(`the parliament-unity fixture (${stopAt}) expected the table at ${expected.join(', ')} after the generation's own step, got ${positions.join(', ')}`);
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
parliamentFixture('parliament-unity-assembly', unityBudgetTable('assembly'));

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
parliamentFixture('parliament-greens-assembly', greensBudgetTable('assembly'));

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
  stopAt: 'assembly',
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
  stopAt: 'assembly',
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
  stopAt: 'assembly',
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
function budgetTable(stopAt: 'vote' | 'assembly'): ParliamentFixtureSpec {
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
parliamentFixture('parliament-budget-assembly', budgetTable('assembly'));
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
function scientistsBudgetTable(stopAt: 'vote' | 'assembly'): ParliamentFixtureSpec {
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
parliamentFixture('parliament-scibudget-assembly', scientistsBudgetTable('assembly'));

// ── RX17 · JOVIAN TAX RIGHTS (Unity — «titanium = influence; +1 M€ production per colony, max 5»): the SIXTH count —
//    the seat's CUBES on the colony tiles, the engine's own list. Blue: Agenda 5 (influence 3 — a win takes the marker
//    to step 6, still influence 3, so the panel prints no win suffix), Luna ×2 + Titan + Miranda = 4 cubes; red: Luna
//    alone, Agenda 1 (influence 1). Two moments:
//    · the VOTE — the panel reads TWO lines: «[influence] 3 → +3 titanium» and «[colony] 4 → +4 M€ production · max 5»
//      with its HORIZON («pays from the next generation») and NO influence input on the production line — influence is
//      not a term of it; the fullscreen names the tiles («Луна ×2 · Титан · Миранда»);
//    · the ASSEMBLY — RED's delegate wins (blue keeps influence 3, so the sitting pays blue exactly the vote's numbers:
//      +3 titanium into the supply, then +4 M€ production), every seat passed, the assembly gate standing for both.
function jovianTable(stopAt: 'vote' | 'assembly'): ParliamentFixtureSpec {
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
parliamentFixture('parliament-jovian-assembly', jovianTable('assembly'));

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
  stopAt: 'assembly',
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
function researchTable(stopAt: 'vote' | 'assembly' | 'effects', blueHand = 5): ParliamentFixtureSpec {
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
parliamentFixture('parliament-research-assembly', researchTable('assembly'));
parliamentFixture('parliament-research-enact', researchTable('effects'));
// …and the VIEWER at its target: blue with NINE cards at target 8 — the sitting's reward beat reads the calm
// zero («up to 8 · 9 in hand → no draw needed») on the band, and nothing flies.
parliamentFixture('parliament-research-full', researchTable('assembly', 9));

// ── RX25 · PLANT BAN — the LEVEL pointed DOWN: every seat is cut to 2 + influence
//    plants. Blue at Agenda 3 (influence 2 → limit 4) with SEVEN plants (−3 — the
//    panel has to say so BEFORE the vote, which is the only defence against this
//    law); red at Agenda 1 (influence 1 → limit 3) with TWO — already under its
//    limit, so its zero names itself. The vote: blue's delegate leads it. The
//    sitting: RED's delegate wins it, so blue keeps influence 2 and is cut by
//    exactly the number the vote panel promised. ──
function banTable(stopAt: 'vote' | 'assembly'): ParliamentFixtureSpec {
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
      // The ASSEMBLY gate stands BEFORE the effects, so the plants are still untouched — the
      // client's own walk is what plays the cut, and that walk is the spec's subject.
      if (parliament.phase?.step !== 'assembly') {
        throw new Error(`the parliament-ban-assembly fixture expected the assembly gate, got ${parliament.phase?.step}`);
      }
      if (p1.plants !== 7) {
        throw new Error(`the parliament-ban-assembly fixture expected blue to still hold 7 plants at the gate, got ${p1.plants}`);
      }
    },
  };
}
parliamentFixture('parliament-ban-vote', banTable('vote'));
parliamentFixture('parliament-ban-assembly', banTable('assembly'));

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
parliamentFixture('parliament-biodome-assembly', biodomeTable(7, -2, 'assembly'));
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
parliamentFixture('parliament-biodome-adjourn', biodomeTable(7, -2, 'adjourn', {
  expect: ({parliament, p1}) => {
    const outcomes = parliament.phase?.summary?.outcomes ?? [];
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
parliamentFixture('parliament-biodome-nocell-assembly', biodomeTable(5, -14, 'assembly', {
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
parliamentFixture('parliament-climate-assembly', climateTable(4, 2, 'assembly'));
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
parliamentFixture('parliament-climate-adjourn', climateTable(4, 2, 'adjourn', {
  expect: ({parliament, p1, p2}) => {
    const outcomes = parliament.phase?.summary?.outcomes ?? [];
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
  const players = testGame(5, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
  const game = players[0];
  const seats = players.slice(1) as Array<TestPlayer>;
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
  parliament.grantPartyEffect(viewer, PartyName.REDS, 'Council Seat');
  parliament.grantPartyEffect(viewer, PartyName.SCIENTISTS, 'Council Seat');
  parliament.grantPartyEffect(viewer, PartyName.INDUSTRIALISTS, 'Council Seat');
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
  expect: ({parliament}) => {
    // At the vote the card stands in the first slot; at the assembly gate (v2: before anything changes) it is
    // the summary's WINNER and still stands in that very slot — the government has not changed yet.
    const seated = parliament.slots[0]?.instance;
    const won = stopAt === 'vote' || parliament.phase?.summary?.winner.instance === seated;
    if (seated !== resolutionInstanceId(resolution, 0) || !won) {
      throw new Error(`the family fixture expected ${resolution} ${stopAt === 'vote' ? 'in the first slot' : 'winning from the first slot'}, got ${seated}`);
    }
  },
});
parliamentFixture('parliament-devpassive-vote', familyTable(DEV_PASSIVE_RESOLUTION_ID, 'vote'));
parliamentFixture('parliament-devpassive-assembly', familyTable(DEV_PASSIVE_RESOLUTION_ID, 'assembly'));
parliamentFixture('parliament-devaction-vote', familyTable(DEV_ACTION_RESOLUTION_ID, 'vote'));
parliamentFixture('parliament-devaction-assembly', familyTable(DEV_ACTION_RESOLUTION_ID, 'assembly'));

// ── parliament-seat: the viewer COMPLETED the chairman quest while every one
//    of their seven delegates stands on a resolution — the seat must be taken
//    from one of them (the mandatory `chairman-seat` pick). The quest reads as
//    finished, with its winner, while the pick stands. ──
{
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
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
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
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
  return {game, humans: seats, bot, parliament, automa};
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

// ── parliament-bot-lobby: Fish (cost 9 — divisible by 9) on top of the bot's deck, the bot with
//    20 M€: its next turn plays the card and LOBBIES with TWO paid delegates in one turn (D6). ──
{
  const name = 'parliament-bot-lobby';
  const t = botTable(name, 2);
  seatResolution(t.parliament, 0, AQUIFER_CONTEST_ID);
  t.bot.megaCredits = 20;
  if (lobbyingDelegates(new Fish().cost) !== 2) {
    throw new Error(`${name}: Fish (${new Fish().cost} M€) must lobby with two delegates`);
  }
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

// ── parliament-bot-win: a SOLO table (the human + the bot) at the assembly gate with the bot's free
//    delegate alone on Aquifer Contest — the bot is the WINNING PLAYER, its ★ is an ocean paid by
//    declaration (D4), and the human is a spectator of the whole sitting. The bot's deck is EMPTY,
//    so its one turn is a pass and the generation ends on the human's pass. ──
{
  const name = 'parliament-bot-win';
  const t = botTable(name, 1);
  const [human] = t.humans;
  seatResolution(t.parliament, 0, AQUIFER_CONTEST_ID);
  t.parliament.placeVote(t.bot, t.parliament.slots[0], 'lobby');
  t.automa.actionDeck = [];
  human.clearWaitingFor();
  t.game.playerHasPassed(human);
  t.game.playerIsFinishedTakingActions();
  if (t.game.phase !== Phase.PARLIAMENT || t.parliament.phase?.step !== 'assembly') {
    throw new Error(`${name}: expected the assembly gate, got ${t.game.phase} / ${t.parliament.phase?.step ?? 'no phase'}`);
  }
  if (t.parliament.phase.summary?.winner.player !== t.bot.id) {
    throw new Error(`${name}: the bot is not the winning player (${t.parliament.phase.summary?.winner.player})`);
  }
  write(name, t.game);
}
