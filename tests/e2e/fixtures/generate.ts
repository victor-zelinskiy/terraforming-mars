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
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {finishGeneration, maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../../TestingUtils';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {Trees} from '../../../src/server/cards/base/Trees';
import {Fish} from '../../../src/server/cards/base/Fish';
import {IGame} from '../../../src/server/IGame';
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
import {AQUIFER_CONTEST_ID} from '../../../src/server/parliament/resolutions/greens/AquiferContest';
import {ARCHITECTURE_AWARD_ID} from '../../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {CENTRAL_POWER_GRID_ID} from '../../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {resolutionCount} from '../../../src/server/parliament/resolutions/ResolutionCounts';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {CLIMATE_RESEARCH_ID} from '../../../src/server/parliament/resolutions/greens/ClimateResearch';
import {BIODOME_CONTEST_ID} from '../../../src/server/parliament/resolutions/greens/BiodomeContest';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {seatResolution} from '../../parliament/parliamentArrange';
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
{
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
  const wf = p1.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [p1, p2]);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error('the parliament fixture has no voting area');
  }
  // Slots 0 and 1 hold parties that do NOT rule (the Greens rule by the
  // starting rule), so the vote's «1 of 2» access and the effect held by
  // delegates both read a real threshold; the Greens card stands third.
  seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
  seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
  parliament.placeVote(p2, parliament.slots[0], 'lobby');
  parliament.placeVote(p1, parliament.slots[1], 'reserve');
  parliament.placeVote(p1, parliament.slots[1], 'reserve');
  p1.megaCredits = 40;
  p2.megaCredits = 30;
  p1.cardsInHand.push(new ArtificialPhotosynthesis());
  runAllActions(game);
  write('parliament', game);
}

// ── parliament-paid: the PAID vote with a real BILL. Blue's free delegate
//    already stands on the FIRST slot beside red's (one of the two the party
//    effect needs — the next delegate there unlocks it and takes the lead),
//    so blue's next vote comes from the RESERVE; blue can pay heat as M€
//    (the Helion rule), so the bill is a real payment PROMPT the vote step
//    hosts (a plain M€ bill auto-settles server-side). Blue also holds two
//    delegates on the second slot (an effect held by delegates), so both the
//    «1 of 2» and the «yours» plaque states are on screen. ──
{
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
  const wf = p1.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [p1, p2]);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error('the parliament-paid fixture has no voting area');
  }
  // Slots 0 and 1 hold parties that do NOT rule (the Greens rule by the
  // starting rule), so the vote's «1 of 2» access and the effect held by
  // delegates both read a real threshold; the Greens card stands third.
  seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
  seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
  parliament.placeVote(p2, parliament.slots[0], 'lobby');
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  parliament.placeVote(p1, parliament.slots[1], 'reserve');
  parliament.placeVote(p1, parliament.slots[1], 'reserve');
  p1.megaCredits = 40;
  p1.heat = 9;
  p1.canUseHeatAsMegaCredits = true;
  p2.megaCredits = 30;
  runAllActions(game);
  write('parliament-paid', game);
}

// ── parliament-actions: the four PARTY ACTIONS on one seat, each with a real
//    target — blue holds every action party's effect by CARD GRANT (the
//    workspace's action tiles are all live), an energy production to shift
//    (Industrialists), Tardigrades in the tableau to feed (Scientists), a
//    tagged hand to recycle (Reds) and a trade fleet for the Unity trade. ──
{
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
  const wf = p1.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [p1, p2]);
  const parliament = game.parliament;
  if (parliament === undefined) {
    throw new Error('the parliament-actions fixture has no parliament');
  }
  for (const party of [PartyName.UNITY, PartyName.SCIENTISTS, PartyName.INDUSTRIALISTS, PartyName.REDS] as const) {
    parliament.grantPartyEffect(p1, party, 'Fixture');
  }
  p1.production.add(Resource.ENERGY, 1);
  p1.playedCards.push(new Tardigrades());
  p1.cardsInHand.push(new Trees(), new Fish(), new AdaptedLichen());
  p1.megaCredits = 40;
  p2.megaCredits = 30;
  runAllActions(game);
  write('parliament-actions', game);
}

// ── parliament-aquifer-vote: AQUIFER CONTEST (RX01, the first real resolution)
//    stands in the FIRST voting slot with blue's free delegate already on it
//    (blue leads → blue would win: the «if you win» forecast has a real step
//    to name), blue at Agenda step 2 (influence 1; winning → step 3 = 2) and
//    holding Fish + Pets (two animal holders, so the payout has a real choice
//    and the VP readings differ per card), red at step 5 (influence 3) holding
//    Birds. The overview, the vote mode and the fullscreen inspector all read
//    the influence-scaled payout from this table. ──
{
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
  const wf = p1.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [p1, p2]);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error('the parliament-aquifer-vote fixture has no voting area');
  }
  seatResolution(parliament, 0, AQUIFER_CONTEST_ID);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  parliament.agenda.set(p1.id, 2);
  parliament.agenda.set(p2.id, 5);
  p1.playedCards.push(new Fish(), new Pets());
  p2.playedCards.push(new Birds());
  p1.megaCredits = 40;
  p2.megaCredits = 30;
  runAllActions(game);
  write('parliament-aquifer-vote', game);
}

// ── parliament-aquifer-enact: the political phase STOPPED INSIDE the payout —
//    Aquifer Contest won with blue's delegate, blue's Agenda advanced to step 3
//    (influence 2) and the phase asks BLUE where its 2 animals go (Fish or
//    Pets); the winner's ocean and red's payout (step 5 = 3 animals onto Birds)
//    follow. The Parliament's enactment stage, the shared picker with the
//    resolution source and the standard ocean placement all boot from here. ──
{
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
  const wf = p1.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [p1, p2]);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error('the parliament-aquifer-enact fixture has no voting area');
  }
  seatResolution(parliament, 0, AQUIFER_CONTEST_ID);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  parliament.agenda.set(p1.id, 2);
  parliament.agenda.set(p2.id, 5);
  p1.playedCards.push(new Fish(), new Pets());
  p2.playedCards.push(new Birds());
  p1.megaCredits = 40;
  p2.megaCredits = 30;
  runAllActions(game);
  // End the generation: production → the political phase → blue's pick stands.
  for (const player of [p1, p2]) {
    game.playerHasPassed(player);
    game.playerIsFinishedTakingActions();
  }
  const pick = p1.getWaitingFor();
  if (!(pick instanceof SelectCard) || pick.resourceGainPrompt?.amount !== 2) {
    throw new Error(`the parliament-aquifer-enact fixture expected blue's 2-animal pick, got ${pick?.constructor.name}`);
  }
  write('parliament-aquifer-enact', game);
}

// ── parliament-recap: generation 2 has just begun — the FIRST political phase
//    ran at the end of generation 1 (blue's two delegates carried the second
//    slot, the winner is enacted, blue stepped onto the Agenda, the losers'
//    parties gained popular support, the refresh dealt the fresh area) and the server's summary of it waits in `lastPhase` for the
//    workspace's results scene. Both seats answered the research phase. ──
{
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
  const wf = p1.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [p1, p2]);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error('the parliament-recap fixture has no voting area');
  }
  seatQuietResolution(parliament, 1);
  parliament.placeVote(p2, parliament.slots[0], 'lobby');
  parliament.placeVote(p1, parliament.slots[1], 'reserve');
  parliament.placeVote(p1, parliament.slots[1], 'reserve');
  p1.megaCredits = 40;
  p2.megaCredits = 30;
  runAllActions(game);
  finishGeneration(game);
  for (const player of [p1, p2]) {
    const research = player.getWaitingFor();
    if (research instanceof SelectCard) {
      player.process({type: 'card', cards: []});
    }
  }
  runAllActions(game);
  if (parliament.lastPhase === undefined || parliament.enacted === undefined) {
    throw new Error('the parliament-recap fixture has no completed political phase');
  }
  write('parliament-recap', game);
}

/**
 * A fixture that only needs the political phase to RUN (not a resolution's own
 * effect) seats a resolution that asks NOTHING at any table — Architecture
 * Award (M€ production by a count, never a choice) — where the winning
 * delegates go: a card that asks its winner something (a tile, a card, a
 * target) holds the phase, and the deal is a shuffle of a catalog that grows,
 * so «which card lands where» is not a fixture's to depend on.
 */
function seatQuietResolution(parliament: Parliament, index: number): void {
  seatResolution(parliament, index, ARCHITECTURE_AWARD_ID);
}

// ── parliament-architecture-vote: ARCHITECTURE AWARD (RX02 — a counted term +
//    influence, max 5) stands in the FIRST voting slot with blue's free
//    delegate on it. Blue: Agenda step 2 (influence 1; winning → step 3 = 2),
//    M€ production 3, and a tableau that makes the filter READ — Artificial
//    Lake counts (building + a positive VP icon), Physics Complex counts too
//    (a variable icon at 0 VP right now), Mine does not (a building card with
//    NO VP icon), Biomass Combustors does not (a negative icon): B = 2 →
//    «2 + 2 → +4» now and «2 + 3 → +5 · max» if blue wins (the forecast
//    reaches the cap). Red: Agenda step 5 (influence 3), four counted cards
//    (B 4 + I 3 = 7 → +5 max). ──
{
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
  const wf = p1.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [p1, p2]);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error('the parliament-architecture-vote fixture has no voting area');
  }
  seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  parliament.agenda.set(p1.id, 4);
  parliament.agenda.set(p2.id, 5);
  p1.playedCards.push(new ArtificialLake(), new Mine(), new BiomassCombustors(), new PhysicsComplex());
  p2.playedCards.push(new SpaceElevator(), new SoilFactory(), new TropicalResort(), new NoctisFarming(), new DomedCrater());
  p1.production.override({megacredits: 3});
  p2.production.override({megacredits: 1});
  p1.megaCredits = 40;
  p2.megaCredits = 30;
  runAllActions(game);
  write('parliament-architecture-vote', game);
}

// ── parliament-architecture-recap: generation 2 has just begun — the political
//    phase at the end of generation 1 ENACTED Architecture Award (red's
//    delegate won it: Agenda 4 → 5 = influence 3) and paid every seat by its
//    own tableau and influence: red B 3 + I 3 = 6 → +5 M€ production, capped
//    (production 3 → 8); blue B 1 + I 0 → +1 (1 → 2). Red is the VIEWER (the
//    first seat in generation 2's order — the dev loader opens that seat). The
//    results scene moves the card from its voting slot into the government and
//    flies red's production gain from the card to the rail. Both seats answered
//    research. ──
{
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
  const wf = p1.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [p1, p2]);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error('the parliament-architecture-recap fixture has no voting area');
  }
  // The card stands in the MIDDLE slot, so its move to the government is a real journey.
  const award = seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
  parliament.placeVote(p2, parliament.slots[1], 'lobby');
  parliament.agenda.set(p2.id, 4);
  p2.playedCards.push(new ArtificialLake(), new DomedCrater(), new SpaceElevator(), new Mine());
  p1.playedCards.push(new SoilFactory(), new BiomassCombustors());
  p2.production.override({megacredits: 3});
  p1.production.override({megacredits: 1});
  p1.megaCredits = 40;
  p2.megaCredits = 30;
  runAllActions(game);
  finishGeneration(game);
  for (const player of [p1, p2]) {
    const research = player.getWaitingFor();
    if (research instanceof SelectCard) {
      player.process({type: 'card', cards: []});
    }
  }
  runAllActions(game);
  const outcomes = parliament.lastPhase?.outcomes ?? [];
  const red = outcomes.find((o) => o.player === p2.id);
  if (parliament.enacted !== award || red?.kind !== 'production' || red.amount !== 5 || red.uncapped !== 6) {
    throw new Error(`the parliament-architecture-recap fixture expected red's capped +5, got ${JSON.stringify(outcomes)}`);
  }
  if (game.playersInGenerationOrder[0].id !== p2.id) {
    throw new Error('the parliament-architecture-recap fixture expected red to open generation 2 (the viewer seat)');
  }
  write('parliament-architecture-recap', game);
}

// ── parliament-powergrid-vote: CENTRAL POWER GRID (RX04 — a TAG count +
//    influence, max 5) stands in the FIRST voting slot with blue's free
//    delegate on it. Blue: Agenda step 4 (influence 2; winning → step 5 = 3),
//    M€ production 3, and a tableau that makes the TAG rule read — HE3 Fusion
//    Plant prints TWO power tags, Biomass Combustors counts too (a power tag
//    with a −1 VP icon: the icon plays no part), Artificial Photosynthesis
//    does not (it raises energy PRODUCTION and prints no power tag): P = 3 →
//    «3 + 1 → +4» now and «3 + 2 → +5 · max» if blue wins (the forecast
//    reaches the cap). Red: Agenda step 5 (influence 3), two power tags. ──
{
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
  const wf = p1.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [p1, p2]);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error('the parliament-powergrid-vote fixture has no voting area');
  }
  seatResolution(parliament, 0, CENTRAL_POWER_GRID_ID);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  parliament.agenda.set(p1.id, 2);
  parliament.agenda.set(p2.id, 5);
  p1.playedCards.push(new HE3FusionPlant(), new BiomassCombustors(), new ArtificialPhotosynthesis());
  p2.playedCards.push(new PowerPlant(), new FusionPower(), new Mine());
  p1.production.override({megacredits: 3});
  p2.production.override({megacredits: 1});
  p1.megaCredits = 40;
  p2.megaCredits = 30;
  runAllActions(game);
  const count = resolutionCount(p1, 'powerTags');
  if (count.count !== 3 || count.cards.length !== 2) {
    throw new Error(`the parliament-powergrid-vote fixture expected P=3 from 2 cards, got ${JSON.stringify(count)}`);
  }
  write('parliament-powergrid-vote', game);
}

// ── parliament-powergrid-recap: generation 2 has just begun — the political
//    phase at the end of generation 1 ENACTED Central Power Grid (red's
//    delegate won it: Agenda 4 → 5 = influence 3) and paid every seat by its
//    own power tags and influence: red P 4 (one card worth two) + I 3 = 7 →
//    +5 M€ production, capped (production 3 → 8); blue P 1 + I 0 → +1 (1 → 2).
//    Red is the VIEWER (the first seat in generation 2's order). ──
{
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
  const wf = p1.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [p1, p2]);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error('the parliament-powergrid-recap fixture has no voting area');
  }
  // The card stands in the MIDDLE slot, so its move to the government is a real journey.
  const grid = seatResolution(parliament, 1, CENTRAL_POWER_GRID_ID);
  parliament.placeVote(p2, parliament.slots[1], 'lobby');
  parliament.agenda.set(p2.id, 4);
  p2.playedCards.push(new HE3FusionPlant(), new PowerPlant(), new GeothermalPower(), new Mine());
  p1.playedCards.push(new FusionPower(), new ArtificialPhotosynthesis());
  p2.production.override({megacredits: 3});
  p1.production.override({megacredits: 1});
  p1.megaCredits = 40;
  p2.megaCredits = 30;
  runAllActions(game);
  finishGeneration(game);
  for (const player of [p1, p2]) {
    const research = player.getWaitingFor();
    if (research instanceof SelectCard) {
      player.process({type: 'card', cards: []});
    }
  }
  runAllActions(game);
  const outcomes = parliament.lastPhase?.outcomes ?? [];
  const red = outcomes.find((o) => o.player === p2.id);
  if (parliament.enacted !== grid || red?.kind !== 'production' || red.amount !== 5 || red.uncapped !== 7 || red.count !== 4) {
    throw new Error(`the parliament-powergrid-recap fixture expected red's capped +5 from P=4, got ${JSON.stringify(outcomes)}`);
  }
  if (JSON.stringify(red.countedUnits) !== JSON.stringify([2, 1, 1])) {
    throw new Error(`the parliament-powergrid-recap fixture expected the per-card contributions 2+1+1, got ${JSON.stringify(red.countedUnits)}`);
  }
  if (game.playersInGenerationOrder[0].id !== p2.id) {
    throw new Error('the parliament-powergrid-recap fixture expected red to open generation 2 (the viewer seat)');
  }
  write('parliament-powergrid-recap', game);
}

/** Every seat passes and the engine runs production → the parliament; the harness's stale action menus are cleared. */
function passToParliament(game: IGame, players: ReadonlyArray<TestPlayer>): void {
  for (const player of players) {
    game.playerHasPassed(player);
    game.playerIsFinishedTakingActions();
  }
  for (const player of players) {
    if (player.getWaitingFor() instanceof OrOptions) {
      player.popWaitingFor();
    }
  }
}

/**
 * A 2-seat Turmoil Redux table with BIODOME CONTEST (RX03) alone in the first
 * voting slot and blue's free delegate on it: blue at Agenda step 2 (influence
 * 1 — winning → step 3 = influence 2 → 4 plants), red at step 5 (influence 3
 * → 6 plants), a few plants on both, the oxygen and temperature the scenario
 * asks for.
 */
function biodomeTable(oxygen: number, temperature: number): {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament} {
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
  const wf = p1.getWaitingFor();
  if (!(wf instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${wf?.constructor.name}`);
  }
  answerStartFlow(game, [p1, p2]);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error('the Biodome Contest fixture has no voting area');
  }
  seatResolution(parliament, 0, BIODOME_CONTEST_ID);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  parliament.agenda.set(p1.id, 2);
  parliament.agenda.set(p2.id, 5);
  setOxygenLevel(game, oxygen);
  setTemperature(game, temperature);
  p1.plants = 3;
  p2.plants = 1;
  p1.megaCredits = 40;
  p2.megaCredits = 30;
  runAllActions(game);
  return {game, p1, p2, parliament};
}

// ── parliament-biodome-vote: BIODOME CONTEST (RX03 — plants for everyone by
//    influence + the winner's greenery) up for the vote: blue leads it, oxygen
//    5 % (winning would place a greenery → 6 %, +2 TR), the plants read
//    «+2 now, +4 if you win» for blue and «+6» for red. ──
{
  const {game} = biodomeTable(5, -14);
  write('parliament-biodome-vote', game);
}

// ── parliament-biodome-enact: the political phase STOPPED INSIDE blue's
//    greenery placement. Biodome Contest won with blue's delegate (Agenda 2 → 3
//    = influence 2): blue's 4 plants already landed (3 → 7) and the winner's
//    greenery is asked — oxygen 7 % → 8 % raises the temperature −2 → 0 °C,
//    which grants a FREE OCEAN (a follow-up placement of its own). Red's 6
//    plants come after blue's placements. ──
{
  const {game, p1, p2, parliament} = biodomeTable(7, -2);
  passToParliament(game, [p1, p2]);
  const ask = p1.getWaitingFor();
  if (!(ask instanceof SelectSpace) || ask.placementContext?.source?.resolution !== BIODOME_CONTEST_ID || p1.plants !== 7) {
    throw new Error(`the parliament-biodome-enact fixture expected blue's greenery placement, got ${ask?.constructor.name} (plants ${p1.plants})`);
  }
  if (parliament.phase?.step !== 'effects') {
    throw new Error('the parliament-biodome-enact fixture expected the effects step');
  }
  write('parliament-biodome-enact', game);
}

// ── parliament-biodome-maxed: the same stop with OXYGEN AT ITS MAXIMUM — the
//    greenery still lands and pays its own TR, oxygen does not move. ──
{
  const {game, p1, p2} = biodomeTable(MAX_OXYGEN_LEVEL, -10);
  passToParliament(game, [p1, p2]);
  if (!(p1.getWaitingFor() instanceof SelectSpace)) {
    throw new Error('the parliament-biodome-maxed fixture expected the greenery placement of blue');
  }
  write('parliament-biodome-maxed', game);
}

// ── parliament-biodome-recap: generation 2 has just begun — the political
//    phase ENACTED Biodome Contest won by RED (Agenda 4 → 5 = influence 3 →
//    +6 plants, 1 → 7), red placed the winner's greenery (oxygen 5 → 6 %),
//    blue got +2 plants (influence 1). Red opens generation 2 (the viewer
//    seat): the results scene moves the card into the government, flies red's
//    plants from the card to the rail and names the greenery with its oxygen
//    step. Both seats answered research. ──
{
  const {game, p1, p2, parliament} = biodomeTable(5, -14);
  // RED wins it this time: blue's delegate goes back to the lobby, red's takes its place.
  parliament.slots[0].votes = [];
  parliament.lobby.add(p1.id);
  parliament.placeVote(p2, parliament.slots[0], 'lobby');
  parliament.agenda.set(p1.id, 1);
  parliament.agenda.set(p2.id, 4);
  passToParliament(game, [p1, p2]);
  const ask = p2.getWaitingFor();
  if (!(ask instanceof SelectSpace)) {
    throw new Error(`the parliament-biodome-recap fixture expected the greenery placement of red, got ${ask?.constructor.name}`);
  }
  const space = ask.spaces.find((s) => s.bonus.length === 0 && !game.board.getAdjacentSpaces(s).some((a) => a.tile !== undefined)) ?? ask.spaces[0];
  p2.process({type: 'space', spaceId: space.id});
  runAllActions(game);
  for (const player of [p1, p2]) {
    if (player.getWaitingFor() instanceof SelectCard) {
      player.process({type: 'card', cards: []});
    }
  }
  runAllActions(game);
  const outcomes = parliament.lastPhase?.outcomes ?? [];
  const redPlants = outcomes.find((o) => o.player === p2.id && o.step === 'plants');
  const greenery = outcomes.find((o) => o.player === p2.id && o.step === 'greenery');
  if (redPlants?.kind !== 'stock' || redPlants.amount !== 6 || greenery?.kind !== 'greenery') {
    throw new Error(`the parliament-biodome-recap fixture expected the +6 plants and the greenery of red, got ${JSON.stringify(outcomes)}`);
  }
  if (game.playersInGenerationOrder[0].id !== p2.id) {
    throw new Error('the parliament-biodome-recap fixture expected red to open generation 2 (the viewer seat)');
  }
  write('parliament-biodome-recap', game);
}

// ── parliament-biodome-nocell: ONE PASS from the political phase, with NO
//    LEGAL CELL for the winner's greenery — every land cell of Mars already
//    holds red's tile. Red has passed; blue (who leads Biodome Contest) passes
//    to end the generation: the plants reach everyone, the greenery is NAMED
//    and skipped, and generation 2's results scene says so. ──
{
  const {game, p1, p2} = biodomeTable(5, -14);
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
  runAllActions(game);
  write('parliament-biodome-nocell', game);
}

// ── parliament-biodome-neutral: ONE PASS from the political phase with
//    Biodome Contest carried by NEUTRAL delegates only — nobody places the
//    greenery, the plants still reach everyone. Red has passed; blue passes. ──
{
  const {game, p1, p2, parliament} = biodomeTable(5, -14);
  parliament.slots[0].votes = [];
  parliament.lobby.add(p1.id);
  parliament.addNeutralVote(parliament.slots[0]);
  parliament.addNeutralVote(parliament.slots[0]);
  game.playerHasPassed(p2);
  runAllActions(game);
  write('parliament-biodome-neutral', game);
}

/**
 * A 2-seat Turmoil Redux table with CLIMATE RESEARCH (RX05) alone in the first
 * voting slot and blue's free delegate on it: blue at Agenda step 3 (influence
 * 2 — winning → step 4 keeps influence 2), red at step 1 (influence 1). Heat
 * PRODUCTION is what the card reads, so it is what the fixture arranges.
 */
function climateTable(blueHeat: number, redHeat: number): {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament} {
  const [game, p1, p2] = testGame(2, {
    skipInitialCardSelection: false, coloniesExtension: true, turmoilReduxExpansion: true,
    startingCorporations: 1,
  });
  if (!(p1.getWaitingFor() instanceof SelectInitialCards)) {
    throw new Error(`expected SelectInitialCards, got ${p1.getWaitingFor()?.constructor.name}`);
  }
  answerStartFlow(game, [p1, p2]);
  const parliament = game.parliament;
  if (parliament === undefined || parliament.slots.length !== 3) {
    throw new Error('the Climate Research fixture has no voting area');
  }
  seatResolution(parliament, 0, CLIMATE_RESEARCH_ID);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  parliament.agenda.set(p1.id, 3);
  parliament.agenda.set(p2.id, 1);
  p1.production.override({heat: blueHeat});
  p2.production.override({heat: redHeat});
  p1.megaCredits = 40;
  p2.megaCredits = 30;
  runAllActions(game);
  return {game, p1, p2, parliament};
}

// ── parliament-climate-vote: CLIMATE RESEARCH (RX05 — +1 heat production per
//    influence, THEN 1 card per full 3 steps of the heat production it leaves
//    behind) up for the vote: blue leads it with heat production 4 (influence
//    2 → 4 → 6 → 2 cards, and the ruling Greens would answer with +2 M€
//    production), red sits at 1. ──
{
  const {game} = climateTable(4, 1);
  write('parliament-climate-vote', game);
}

// ── parliament-climate-enact: the political phase STOPPED INSIDE blue's
//    mandatory TAKE of the cards Climate Research drew. Blue's heat production
//    was raised 4 → 6 (influence 2), the ruling Greens answered with +2 M€
//    production, and two project cards are owed — withheld from the hand until
//    the take. Red's own half comes after blue's. ──
{
  const {game, p1, p2, parliament} = climateTable(4, 2);
  passToParliament(game, [p1, p2]);
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
  write('parliament-climate-enact', game);
}

// ── parliament-climate-big: the same stop with a BIG draw — heat production
//    17 + influence 2 = 19 → SIX cards owed at once. The take must show all six
//    at a readable size inside the enactment stage; nothing is trimmed to fit. ──
{
  const {game, p1, p2} = climateTable(17, 0);
  passToParliament(game, [p1, p2]);
  const ask = p1.getWaitingFor();
  if (!(ask instanceof SelectCard) || ask.externalDrawPrompt?.remaining !== 6) {
    throw new Error(`the parliament-climate-big fixture expected six owed cards, got ${ask?.constructor.name}`);
  }
  write('parliament-climate-big', game);
}

// ── parliament-climate-recap: generation 2 has just begun — the political
//    phase ENACTED Climate Research won by RED, both seats were raised and
//    both took their cards. Red opens generation 2 (the seat the dev loader
//    opens): the results scene moves the card into the government and names
//    BOTH halves of every seat's result. ──
{
  const {game, p1, p2, parliament} = climateTable(4, 2);
  // RED wins it: blue's delegate goes back to the lobby, red's takes its place.
  parliament.slots[0].votes = [];
  parliament.lobby.add(p1.id);
  parliament.placeVote(p2, parliament.slots[0], 'lobby');
  passToParliament(game, [p1, p2]);
  for (const player of [p1, p2]) {
    const ask = player.getWaitingFor();
    if (ask instanceof SelectCard && ask.externalDrawPrompt !== undefined) {
      player.process({type: 'card', cards: ask.cards.map((c) => c.name)});
    }
    runAllActions(game);
  }
  for (const player of [p1, p2]) {
    if (player.getWaitingFor() instanceof SelectCard) {
      player.process({type: 'card', cards: []});
    }
  }
  runAllActions(game);
  const outcomes = parliament.lastPhase?.outcomes ?? [];
  const raise = outcomes.find((o) => o.player === p1.id && o.step === 'heat-production');
  const draw = outcomes.find((o) => o.player === p1.id && o.step === 'draw');
  if (raise?.kind !== 'production' || raise.amount !== 2 || draw?.kind !== 'cards' || draw.amount !== 2) {
    throw new Error(`the parliament-climate-recap fixture expected blue's +2 heat production and 2 cards, got ${JSON.stringify(outcomes)}`);
  }
  if (outcomes.find((o) => o.player === p2.id && o.step === 'draw')?.kind !== 'cards') {
    throw new Error(`the parliament-climate-recap fixture expected red's own draw, got ${JSON.stringify(outcomes)}`);
  }
  if (game.playersInGenerationOrder[0].id !== p2.id) {
    throw new Error('the parliament-climate-recap fixture expected red to open generation 2 (the seat the loader opens)');
  }
  write('parliament-climate-recap', game);
}

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
  seatQuietResolution(parliament, 1);
  parliament.placeVote(seats[1], parliament.slots[1], 'lobby');
  runAllActions(game);
  finishGeneration(game);
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
  if (!parliament.pendingActions.some((action) => action.kind === 'chairman-seat')) {
    throw new Error('parliament-seat: no pending chairman seat');
  }
  write('parliament-seat', game);
}
