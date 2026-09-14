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

function write(name: string, game: IGame): void {
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
//      · three dummy resolutions of distinct parties in the voting area, the
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
  parliament.placeVote(p2, parliament.slots[0], 'lobby');
  parliament.placeVote(p1, parliament.slots[1], 'reserve');
  parliament.placeVote(p1, parliament.slots[1], 'reserve');
  p1.megaCredits = 40;
  p2.megaCredits = 30;
  p1.cardsInHand.push(new ArtificialPhotosynthesis());
  runAllActions(game);
  write('parliament', game);
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

// ── parliament-recap: generation 2 has just begun — the FIRST political phase
//    ran at the end of generation 1 (blue's two delegates carried the second
//    slot, the winner is enacted, blue stepped onto the Agenda, the losers'
//    parties gained popular support, three fresh resolutions stand in the
//    area) and the server's summary of it waits in `lastPhase` for the
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
  parliament.placeVote(seats[1], parliament.slots[1], 'lobby');
  runAllActions(game);
  finishGeneration(game);
  for (const player of seats) {
    if (player.getWaitingFor() instanceof SelectCard) {
      player.process({type: 'card', cards: []});
    }
  }
  runAllActions(game);
  if (parliament.enacted === undefined || parliament.slots.length !== 3) {
    throw new Error('parliament-dense: the first political phase did not enact a resolution');
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
  // V3: a clear leader.
  parliament.placeVote(far, v3, 'lobby');
  for (let i = 0; i < 3; i++) {
    parliament.placeVote(far, v3, 'reserve');
  }
  parliament.placeVote(minor, v3, 'reserve');
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
