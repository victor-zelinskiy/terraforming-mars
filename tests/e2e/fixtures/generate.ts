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
import {maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../../TestingUtils';
import {IGame} from '../../../src/server/IGame';
import {SelectInitialCards} from '../../../src/server/inputs/SelectInitialCards';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../../src/common/constants';
import {toName} from '../../../src/common/utils/utils';
import {CardName} from '../../../src/common/cards/CardName';
import {AdaptedLichen} from '../../../src/server/cards/base/AdaptedLichen';
import {NuclearZone} from '../../../src/server/cards/base/NuclearZone';
import {RegolithEaters} from '../../../src/server/cards/base/RegolithEaters';
import {IoMiningIndustries} from '../../../src/server/cards/base/IoMiningIndustries';
import {Pets} from '../../../src/server/cards/base/Pets';
import {SolarPower} from '../../../src/server/cards/base/SolarPower';
import {DeltaSurge} from '../../../src/server/cards/delta/DeltaSurge';
import {MiningExpedition} from '../../../src/server/cards/base/MiningExpedition';

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
