import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {TestPlayer} from '../TestPlayer';
import {fakeCard, runAllActions} from '../TestingUtils';
import {AutomaDeltaProject, MAX_BOT_DELTA_ROWS} from '../../src/server/automa/AutomaDeltaProject';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {DeltaProjectExpansion} from '../../src/server/delta/DeltaProjectExpansion';
import {calculateVictoryPoints} from '../../src/server/game/calculateVictoryPoints';
import {Server} from '../../src/server/models/ServerModel';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {cast} from '../../src/common/utils/utils';
import {testAutomaGame} from './AutomaTestGame';

/**
 * Delta row → MarsBot track mapping (the SAME mapping the resolver uses for
 * revealed-card tags): row 1 Building→BUILDING, 2 Power→ENERGY, 3 Earth→EARTH,
 * 4 Space→SPACE, 5 Science→SCIENCE, 6 Plant / 7 Microbe / 9 Animal→BIO,
 * 8 Jovian→ENERGY. Rows 10/11 (2/5 VP) carry no tag.
 */
function progressAllTagTracks(game: IGame, position = 1) {
  const tracks = game.automa!.board.tracks;
  for (const index of [THARSIS_TRACK.BUILDING, THARSIS_TRACK.SPACE, THARSIS_TRACK.SCIENCE, THARSIS_TRACK.ENERGY, THARSIS_TRACK.EARTH, THARSIS_TRACK.BIO]) {
    tracks[index].position = Math.max(tracks[index].position, position);
  }
}

function setPower(game: IGame, position: number) {
  game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position = position;
}

function resolve(game: IGame) {
  AutomaDeltaProject.resolve(game);
}

describe('AutomaDeltaProject — Solo Delta Project reference card', () => {
  let game: IGame;
  let human: TestPlayer;
  let bot: IPlayer;

  beforeEach(() => {
    [game, human, bot] = testAutomaGame({deltaProjectExpansion: true});
  });

  it('an automa game with the Delta Project seats the bot on the track', () => {
    expect(bot.deltaProjectData).is.not.undefined;
    expect(bot.deltaProjectData!.position).eq(0);
    expect(game.automa!.deltaPowerConsumed).eq(0);
  });

  // 1. Initial step requires Power + Associated-Tag progress.
  describe('initial step (Power ≥1 AND the associated tag track ≥1)', () => {
    it('no progress anywhere → no advance', () => {
      resolve(game);
      expect(bot.deltaProjectData!.position).eq(0);
      expect(game.automa!.deltaPowerConsumed).eq(0);
    });

    it('tag progress without Power → no advance', () => {
      game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position = 1;
      // The ENERGY track (the Power Track) stays at 0.
      resolve(game);
      expect(bot.deltaProjectData!.position).eq(0);
    });

    it('Power without the row-1 tag progress → no advance', () => {
      setPower(game, 1);
      // BUILDING (row 1's associated tag track) stays at 0.
      resolve(game);
      expect(bot.deltaProjectData!.position).eq(0);
    });

    it('both progressed ≥1 → advances', () => {
      game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position = 1;
      setPower(game, 1);
      resolve(game);
      expect(bot.deltaProjectData!.position).eq(1);
      expect(game.automa!.deltaPowerConsumed).eq(1);
    });
  });

  // 2. Cannot advance a row whose associated tag track has not progressed.
  it('stops before a row whose associated tag track is at 0', () => {
    game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position = 1;
    setPower(game, 5); // Power for 4+ rows; also covers rows 2/8 (Power/Jovian tags).
    // EARTH (row 3's tag track) stays at 0 → rows 1..2 only.
    resolve(game);
    expect(bot.deltaProjectData!.position).eq(2);
    expect(game.automa!.deltaPowerConsumed).eq(2);
  });

  // 3. Cannot advance more rows than available Power increments.
  it('is limited by the available Power increments', () => {
    progressAllTagTracks(game);
    setPower(game, 2);
    resolve(game);
    expect(bot.deltaProjectData!.position).eq(2);
    expect(game.automa!.deltaPowerConsumed).eq(2);
  });

  // 4. Hard cap: never more than 4 rows per resolution.
  it('never advances more than 4 rows per resolution', () => {
    progressAllTagTracks(game);
    setPower(game, 10);
    resolve(game);
    expect(bot.deltaProjectData!.position).eq(MAX_BOT_DELTA_ROWS);
    expect(game.automa!.deltaPowerConsumed).eq(MAX_BOT_DELTA_ROWS);
  });

  // 5. Power increments are consumed — they do not renew by themselves.
  it('consumes Power increments cumulatively across generations', () => {
    progressAllTagTracks(game);
    setPower(game, 3);
    resolve(game);
    expect(bot.deltaProjectData!.position).eq(3);
    expect(AutomaDeltaProject.availablePower(game)).eq(0);

    // Next generation: everything consumed → no advance.
    game.generation = 2;
    resolve(game);
    expect(bot.deltaProjectData!.position).eq(3);

    // The Energy track advances one more step → exactly one more row.
    game.generation = 3;
    setPower(game, 4);
    resolve(game);
    expect(bot.deltaProjectData!.position).eq(4);
    expect(game.automa!.deltaPowerConsumed).eq(4);
  });

  it('a human attack that regresses the Energy track shrinks the available Power', () => {
    progressAllTagTracks(game);
    setPower(game, 3);
    resolve(game); // consumed 3, position 3.
    game.generation = 2;
    setPower(game, 5); // 2 fresh increments…
    game.automa!.board.tracks[THARSIS_TRACK.ENERGY].regress(); // …one regressed by the human.
    expect(AutomaDeltaProject.availablePower(game)).eq(1);
    resolve(game);
    expect(bot.deltaProjectData!.position).eq(4);
  });

  // 6. Normal Delta Project rewards are skipped for MarsBot.
  describe('rewards are skipped', () => {
    it('landing on a choice row defers no reward prompt and records no stop', () => {
      game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position = 1;
      setPower(game, 1);
      const deferredBefore = game.deferredActions.length;
      resolve(game);
      expect(bot.deltaProjectData!.position).eq(1); // Row 1 = "2 steel or 2 plants" for a human.
      expect(game.deferredActions.length).eq(deferredBefore);
      expect(bot.deltaProjectData!.stops).is.empty;
      expect(bot.steel).eq(0);
      expect(bot.plants).eq(0);
      // The "no reward" line is a guide-only implementation detail (marsBotGuide) —
      // it must NOT leak into the journal; the reward is proven skipped by the
      // empty stops + zero resources above.
      expect(game.gameLog.some((m) => m.message.includes('does not receive the Delta Project reward'))).is.false;
    });

    it('traversed and landed production rows grant nothing', () => {
      progressAllTagTracks(game);
      setPower(game, 4);
      resolve(game); // Lands on row 4 (Space: +1 titanium production for a human), through row 3 (Earth: +2 M€ production).
      expect(bot.deltaProjectData!.position).eq(4);
      expect(bot.production.titanium).eq(0);
      expect(bot.production.megacredits).eq(0);
    });

    it('the Jovian row grants no Jovian tag', () => {
      progressAllTagTracks(game);
      bot.deltaProjectData!.position = 7;
      setPower(game, 1);
      resolve(game);
      expect(bot.deltaProjectData!.position).eq(8);
      expect(bot.deltaProjectData!.jovianBonus).is.false;
      expect(bot.tags.extraJovianTags).eq(0);
    });
  });

  // 7. Final 2 VP.
  it('scores 2 VP from the 2 VP position', () => {
    progressAllTagTracks(game);
    bot.deltaProjectData!.position = 9;
    setPower(game, 1);
    resolve(game);
    expect(bot.deltaProjectData!.position).eq(10);
    expect(calculateVictoryPoints(bot).deltaProject).eq(2);
  });

  // 8. Final 5 VP.
  it('scores 5 VP from the 5 VP position', () => {
    progressAllTagTracks(game);
    bot.deltaProjectData!.position = 9;
    setPower(game, 2);
    resolve(game);
    expect(bot.deltaProjectData!.position).eq(11);
    expect(calculateVictoryPoints(bot).deltaProject).eq(5);
  });

  // 9. Deterministic row selection: always the MAXIMUM legal step count;
  //    VP-slot occupancy mirrors the human rules.
  describe('deterministic selection', () => {
    it('always advances the maximum legal number of rows', () => {
      progressAllTagTracks(game);
      setPower(game, 4);
      expect(AutomaDeltaProject.getValidAdvanceSteps(game)).deep.eq([1, 2, 3, 4]);
      resolve(game);
      expect(bot.deltaProjectData!.position).eq(4);
      // Same generation → the once-per-generation guard makes a re-resolve a no-op.
      setPower(game, 10);
      resolve(game);
      expect(bot.deltaProjectData!.position).eq(4);
    });

    it('cannot land on an occupied 2 VP slot but leaps over it onto a free 5 VP slot', () => {
      progressAllTagTracks(game);
      bot.deltaProjectData!.position = 8;
      human.deltaProjectData!.position = 10;
      setPower(game, 4);
      expect(AutomaDeltaProject.getValidAdvanceSteps(game)).deep.eq([1, 3]);
      resolve(game);
      expect(bot.deltaProjectData!.position).eq(11);
      expect(game.gameLog.some((m) => m.message === '${0} leapt past the occupied 2 VP position to reach ${1} on the Delta Project (5 VP at game end)')).is.true;
    });

    it('an occupied 2 VP slot leaves only the jump onto the free 5 VP slot from position 9', () => {
      progressAllTagTracks(game);
      bot.deltaProjectData!.position = 9;
      human.deltaProjectData!.position = 10;
      setPower(game, 4);
      // Step 1 (occupied 10) is illegal; step 2 (free 11) is legal — the bot takes it.
      expect(AutomaDeltaProject.getValidAdvanceSteps(game)).deep.eq([2]);
      resolve(game);
      expect(bot.deltaProjectData!.position).eq(11);
    });

    it('an occupied 5 VP slot leaves only the 2 VP landing from position 9', () => {
      progressAllTagTracks(game);
      bot.deltaProjectData!.position = 9;
      human.deltaProjectData!.position = 11;
      setPower(game, 4);
      expect(AutomaDeltaProject.getValidAdvanceSteps(game)).deep.eq([1]);
      resolve(game);
      expect(bot.deltaProjectData!.position).eq(10);
    });

    it('the bot occupying a VP slot blocks the human from landing on it', () => {
      progressAllTagTracks(game);
      bot.deltaProjectData!.position = 10;
      human.playedCards.push(fakeCard({tags: [Tag.BUILDING, Tag.POWER, Tag.EARTH, Tag.SPACE, Tag.SCIENCE, Tag.PLANT, Tag.MICROBE, Tag.JOVIAN, Tag.ANIMAL]}));
      human.energy = 5;
      human.deltaProjectData!.position = 9;
      // The human cannot land on 10 (bot there) but can leap to 11.
      expect(DeltaProjectExpansion.getValidAdvanceSteps(human)).deep.eq([2]);
    });
  });

  // 10. Final scoring includes the bot's Delta Project VP.
  it('final scoring includes the bot Delta Project VP in the total', () => {
    progressAllTagTracks(game);
    bot.deltaProjectData!.position = 9;
    setPower(game, 1);
    resolve(game);
    const breakdown = calculateVictoryPoints(bot);
    expect(breakdown.deltaProject).eq(2);
    const withoutDelta = breakdown.total - breakdown.deltaProject;
    expect(breakdown.total).eq(withoutDelta + 2);
  });

  // 11. Human Delta Project behavior is unchanged in an automa game.
  it('the human advance still spends energy and defers the reward choice', () => {
    human.energy = 1;
    human.playedCards.push(fakeCard({tags: [Tag.BUILDING]}));
    DeltaProjectExpansion.advance(human, 1);
    expect(human.deltaProjectData!.position).eq(1);
    expect(human.energy).eq(0);
    runAllActions(game);
    const reward = cast(human.popWaitingFor(), OrOptions);
    reward.options[0].cb();
    expect(human.steel).eq(2);
    expect(human.deltaProjectData!.stops).has.length(1);
    // The human's advance never touches the bot's Power budget.
    expect(game.automa!.deltaPowerConsumed).eq(0);
  });

  // 12. Save/load preserves the whole MarsBot Delta Project state.
  it('round-trips position, consumed Power and the generation guard through save/load', () => {
    progressAllTagTracks(game);
    setPower(game, 3);
    resolve(game);
    expect(bot.deltaProjectData!.position).eq(3);

    const restored = Game.deserialize(structuredClone(game.serialize()));
    const restoredBot = restored.players.find((p) => p.isMarsBot)!;
    expect(restoredBot.deltaProjectData!.position).eq(3);
    expect(restored.automa!.deltaPowerConsumed).eq(3);
    expect(restored.automa!.deltaResolvedGeneration).eq(1);
    // A re-resolve in the restored game (same generation) stays a no-op.
    AutomaDeltaProject.resolve(restored);
    expect(restoredBot.deltaProjectData!.position).eq(3);
  });

  it('old saves without the delta fields deserialize to zeroes', () => {
    const serialized = structuredClone(game.serialize());
    delete serialized.automa!.deltaPowerConsumed;
    delete serialized.automa!.deltaResolvedGeneration;
    const restored = Game.deserialize(serialized);
    expect(restored.automa!.deltaPowerConsumed).eq(0);
    expect(restored.automa!.deltaResolvedGeneration).eq(0);
  });

  // Journal + model surfaces.
  it('roots one delta-project journal group with the consume + advance lines', () => {
    progressAllTagTracks(game);
    setPower(game, 2);
    resolve(game);
    const root = game.gameLog.find((m) => m.category === 'delta-project');
    expect(root, 'delta-project root log').is.not.undefined;
    expect(root!.correlationId).is.a('number');
    const grouped = game.gameLog.filter((m) => m.correlationId === root!.correlationId).map((m) => m.message);
    expect(grouped).contains('${0} consumed ${1} Power increment(s) for the Delta Project');
    expect(grouped).contains('${0} advanced ${1} row(s) on the Delta Project, reaching ${2}');
    // The guide-only "no reward" implementation detail is NOT journaled.
    expect(grouped).not.contains('${0} does not receive the Delta Project reward (MarsBot gains only the final VP)');
    const ev = game.events.events.find((e) =>
      e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.DELTA_PROJECT && e.player === bot.color);
    expect(ev, 'delta-project action event').is.not.undefined;
    expect(ev!.category).eq('delta-project');
  });

  it('exposes the Power budget on the public MarsBot model', () => {
    progressAllTagTracks(game);
    setPower(game, 3);
    resolve(game);
    setPower(game, 5);
    const model = Server.getPlayerModel(human);
    expect(model.game.automa!.deltaPower).deep.eq({available: 2, consumed: 3});
  });

  // Integration: the resolution rides the bot's regular turn, once per generation.
  it('resolves once at the start of the bot turn — even a passing (empty-deck) one', () => {
    game.playerIsFinishedWithResearchPhase(human);
    game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position = 1;
    setPower(game, 1);
    game.automa!.actionDeck = []; // The bot will pass — the Delta resolution must still run.
    human.popWaitingFor();
    game.playerHasPassed(human);
    game.playerIsFinishedTakingActions();
    expect(bot.deltaProjectData!.position).eq(1);
    expect(game.automa!.deltaPowerConsumed).eq(1);
  });

  it('does not resolve twice within one generation across bot turns', () => {
    game.playerIsFinishedWithResearchPhase(human);
    game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position = 1;
    setPower(game, 5);
    game.automa!.actionDeck = [
      {kind: 'project', name: CardName.GENE_REPAIR},
      {kind: 'project', name: CardName.GENE_REPAIR},
    ];
    // Turn 1 (not passing): the human yields, the bot flips one card. The
    // Power Track at 5 also covers row 2's Power tag; row 3 (Earth) is at 0 —
    // so the single resolution advances exactly 2 rows.
    human.popWaitingFor();
    game.playerIsFinishedTakingActions();
    expect(bot.deltaProjectData!.position).eq(2);
    expect(game.automa!.deltaPowerConsumed).eq(2);
    // Turn 2, same generation: no second Delta advance despite 3 unspent increments.
    human.popWaitingFor();
    game.playerIsFinishedTakingActions();
    expect(bot.deltaProjectData!.position).eq(2);
    expect(game.automa!.deltaPowerConsumed).eq(2);
  });

  it('a non-delta automa game is untouched', () => {
    const [game2, human2, bot2] = testAutomaGame({}, '-nodelta');
    expect(bot2.deltaProjectData).is.undefined;
    game2.playerIsFinishedWithResearchPhase(human2);
    game2.automa!.actionDeck = [];
    human2.popWaitingFor();
    game2.playerHasPassed(human2);
    game2.playerIsFinishedTakingActions();
    expect(game2.automa!.deltaPowerConsumed).eq(0);
    expect(Server.getPlayerModel(human2).game.automa!.deltaPower).is.undefined;
  });
});
