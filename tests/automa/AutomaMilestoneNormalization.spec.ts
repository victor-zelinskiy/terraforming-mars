import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {CardName} from '../../src/common/cards/CardName';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {IMilestone, milestoneThreshold} from '../../src/server/milestones/IMilestone';
import {Hoverlord} from '../../src/server/milestones/Hoverlord';
import {AutomaMAEvaluation} from '../../src/server/automa/AutomaMAEvaluation';
import {AwardScorer} from '../../src/server/awards/AwardScorer';
import {Server} from '../../src/server/models/ServerModel';
import {Excentric} from '../../src/server/awards/Excentric';
import {marsBotOf} from '../../src/server/automa/AutomaUtil';
import {testAutomaGame} from './AutomaTestGame';

/**
 * THE MILESTONE NORMALIZATION CONTRACT — the guard behind
 * `AutomaMAEvaluation.botMilestoneScore`.
 *
 * At the table MarsBot is just another player: the milestone list must let a
 * human read «how close is the bot» in the SAME units as every other row. The
 * bot's internal units (M€ for Tactician, a track space for Rim Settler) are
 * an implementation detail of its reference card and must never reach the UI —
 * so the server re-expresses them on the player's own scale before the model
 * leaves it, and the client stays bot-agnostic.
 *
 * ⚠️ WORKLIST. `scopeGuard` below fails with the EXACT list of milestone names
 * that reached an automa game without a decision recorded here. When a new map
 * / expansion enters `AUTOMA_SUPPORTED_BOARDS`, that list is the work: for each
 * name either add its rule to `AutomaMAEvaluation.botMilestoneProgress` (value
 * + target — the normalization is then automatic) or add it to
 * `PLAYER_METRIC` because the bot is judged by the player's own metric.
 *
 * And the two lists are not just labels: `familyGuard` PROVES each membership
 * against the real evaluator, so a milestone cannot be filed as "unchanged"
 * while quietly carrying its own criterion (or the other way round).
 */

/** Milestones whose bot criterion is its own — the ones that get rescaled. */
const BOT_METRIC: ReadonlyArray<string> = [
  'Builder', // Building track 8 ↔ 8 building tags
  'Planner', // every track 4 ↔ 16 cards in hand
  'Diversifier', // every track 3 ↔ 8 different tags
  'Tactician', // 35 M€ ↔ 5 cards with requirements
  'Energizer', // Power track 6 ↔ 6 energy production
  'Rim Settler', // Science track 6 ↔ 3 Jovian tags
  'Generalist', // every MARTIAN track 2 ↔ 6 raised productions (Venus excluded outright)
  'Specialist', // any track 10 ↔ 10 in one production (the Venus track counts)
  'Ecologist', // Bio track 4 ↔ 4 bio tags
  // Tycoon and Legend are worded «Unchanged» and DO use the player's metric —
  // but the bot keeps its cards in `automa.playedPile`, not a tableau, so the
  // player evaluator would read a permanent 0. They are here for that
  // container difference alone; their target is the milestone's own printed
  // threshold, which makes the rescale the identity.
  'Tycoon', // covers the fork's Tycoon10 (10 green/blue in the played pile)
  'Legend', // covers the modular Legend4
  'Hoverlord', // 7 floaters ↔ 7 floaters
];

/** Milestones the bot meets with the PLAYER's own metric — nothing to rescale. */
const PLAYER_METRIC: ReadonlyArray<string> = [
  'Terraformer', // real TR
  'Mayor', // real city tiles
  'Gardener', // real greenery tiles
  'Polar Explorer', // real tiles in the polar rows
  'Networker', // Ares: the bot is tallied in aresData like any player
  'Purifier', // Ares: honestly 0 — the bot never covers a hazard
];

const SCOPE: ReadonlyArray<string> = [...BOT_METRIC, ...PLAYER_METRIC];

/** The fork ships threshold variants under suffixed names (Terraformer29, Tycoon10). */
function baseName(name: string): string {
  return name.replace(/[0-9]+$/, '');
}

/** Every board × expansion combination MarsBot is allowed to play. */
function supportedGames(): Array<[string, IGame, IPlayer]> {
  const combos: Array<[string, object]> = [
    ['Tharsis', {boardName: BoardName.THARSIS}],
    ['Hellas', {boardName: BoardName.HELLAS}],
    ['Elysium', {boardName: BoardName.ELYSIUM}],
    ['Tharsis+Venus+Ares', {boardName: BoardName.THARSIS, venusNextExtension: true, aresExtension: true}],
    ['Hellas+Venus+Ares', {boardName: BoardName.HELLAS, venusNextExtension: true, aresExtension: true}],
    ['Elysium+Venus+Ares', {boardName: BoardName.ELYSIUM, venusNextExtension: true, aresExtension: true}],
  ];
  return combos.map(([label, options], i) => {
    const [game, /* human */, bot] = testAutomaGame(options, `-norm-${i}`);
    return [label, game, bot] as [string, IGame, IPlayer];
  });
}

/**
 * Moves EVERY quantity a bot criterion can read at once, so one sweep crosses
 * every threshold in the set: tracks, M€ (crosses Tactician's 35 at k=9),
 * floaters, TR — and the PLAYED PILE, which is where the Tycoon/Legend family
 * lives (the bot has no tableau).
 */
function sweepBotState(game: IGame, bot: IPlayer, k: number): void {
  for (const track of game.automa!.board.tracks) {
    track.position = k;
  }
  bot.megaCredits = k * 4;
  game.automa!.floaters = k;
  bot.setTerraformRating(20 + k);
  game.automa!.playedPile = [
    ...new Array<CardName>(k).fill(CardName.ALGAE), // green
    ...new Array<CardName>(k).fill(CardName.BIG_ASTEROID), // red
  ];
}

function milestonesUnderTest(game: IGame): Array<IMilestone> {
  const all = [...game.milestones];
  // Hoverlord has a bot criterion but only reaches the board through the
  // random/Venus MA sets — evaluate it directly so the rule stays covered.
  if (!all.some((m) => m.name === 'Hoverlord')) {
    all.push(new Hoverlord());
  }
  return all;
}

describe('AutomaMAEvaluation — milestone normalization (the bot reads as a player)', () => {
  it('scopeGuard: every milestone reaching an automa game has a recorded decision', () => {
    const unrecorded = new Set<string>();
    for (const [, game] of supportedGames()) {
      for (const milestone of game.milestones) {
        if (!SCOPE.includes(baseName(milestone.name))) {
          unrecorded.add(milestone.name);
        }
      }
    }
    const names = [...unrecorded].sort();
    expect(names,
      'milestones with no normalization decision — for each, either add its rule to ' +
      'AutomaMAEvaluation.botMilestoneProgress (value + target) or list it in PLAYER_METRIC: ' +
      names.join(', ')).is.empty;
  });

  it('familyGuard: the declared family is the family the evaluator actually uses', () => {
    // The `undefined` branch is DEFINED as «read the player's own metric», so a
    // PLAYER_METRIC milestone must agree with `getScore`/`canClaim` in every
    // swept state — and a BOT_METRIC one must visibly disagree somewhere, or it
    // is not carrying a criterion of its own at all.
    const wrongUnchanged: Array<string> = [];
    const neverDiverged = new Set<string>();
    for (const [label, game, bot] of supportedGames()) {
      const diverged = new Set<string>();
      for (let k = 0; k <= 12; k++) {
        sweepBotState(game, bot, k);
        for (const milestone of milestonesUnderTest(game)) {
          const name = baseName(milestone.name);
          const player = marsBotOf(game);
          const sameScore = AutomaMAEvaluation.botMilestoneScore(milestone, game) === milestone.getScore(player);
          const sameMet = AutomaMAEvaluation.botMilestoneMet(milestone, game) === milestone.canClaim(player);
          if (PLAYER_METRIC.includes(name) && !(sameScore && sameMet)) {
            wrongUnchanged.push(`${label}/${milestone.name} @k=${k}`);
          }
          if (BOT_METRIC.includes(name) && !(sameScore && sameMet)) {
            diverged.add(name);
          }
        }
      }
      for (const milestone of milestonesUnderTest(game)) {
        const name = baseName(milestone.name);
        if (BOT_METRIC.includes(name) && !diverged.has(name)) {
          neverDiverged.add(`${label}/${milestone.name}`);
        }
      }
    }
    expect(wrongUnchanged,
      'listed in PLAYER_METRIC but the evaluator does NOT use the player metric: ' +
      wrongUnchanged.join(' · ')).is.empty;
    expect([...neverDiverged],
      'listed in BOT_METRIC but never differs from the player metric — either it has no ' +
      'branch in botMilestoneProgress, or the sweep does not move what it reads: ' +
      [...neverDiverged].join(' · ')).is.empty;
  });

  it('the displayed score crosses the printed threshold on the SAME step the bot may claim', () => {
    // The whole reason the normalization floors instead of rounding: a client
    // that compares score >= threshold (every MA surface does) can then never
    // paint «can claim» early nor hide it late, with no bot-specific code.
    const mismatches: Array<string> = [];
    for (const [label, game, bot] of supportedGames()) {
      for (let k = 0; k <= 12; k++) {
        sweepBotState(game, bot, k);
        for (const milestone of milestonesUnderTest(game)) {
          const threshold = milestoneThreshold(milestone, game);
          expect(threshold, `${milestone.name} has no numeric threshold`).is.not.undefined;
          const score = AutomaMAEvaluation.botMilestoneScore(milestone, game);
          const met = AutomaMAEvaluation.botMilestoneMet(milestone, game);
          if ((score >= threshold!) !== met) {
            mismatches.push(`${label}/${milestone.name} @k=${k}: shown ${score}/${threshold}, met=${met}`);
          }
        }
      }
    }
    expect(mismatches, mismatches.join(' · ')).is.empty;
  });

  it('Tactician: 35 M€ read on the player\'s 5-card scale', () => {
    const [game, /* human */, bot] = testAutomaGame({boardName: BoardName.HELLAS});
    const tactician = game.milestones.find((m) => m.name === 'Tactician')!;
    const shown = (mc: number) => {
      bot.megaCredits = mc;
      return AutomaMAEvaluation.botMilestoneScore(tactician, game);
    };
    expect(shown(0)).eq(0);
    expect(shown(7)).eq(1);
    expect(shown(34), 'one step short of the claim reads one step short').eq(4);
    expect(shown(35), 'exactly the bot threshold reads exactly the printed one').eq(5);
    expect(shown(40), 'a little past it still reads 5 — the player scale is coarser').eq(5);
    expect(shown(50), 'well past it visibly outgrows the threshold').eq(7);
  });

  it('the other rescaled criteria land on their printed thresholds', () => {
    const [hellas] = testAutomaGame({boardName: BoardName.HELLAS}, '-rescale-h');
    const [tharsis] = testAutomaGame({boardName: BoardName.THARSIS}, '-rescale-t');
    const shown = (game: IGame, name: string) =>
      AutomaMAEvaluation.botMilestoneScore(game.milestones.find((m) => m.name === name)!, game);
    const setAll = (game: IGame, value: number) => {
      for (const track of game.automa!.board.tracks) {
        track.position = value;
      }
    };

    // Rim Settler: Science track 6 ↔ 3 Jovian tags — half the track shows.
    setAll(hellas, 5);
    expect(shown(hellas, 'Rim Settler'), '5 of 6 → 2 of 3').eq(2);
    setAll(hellas, 6);
    expect(shown(hellas, 'Rim Settler')).eq(3);
    // Diversifier: every track 3 ↔ 8 different tags.
    setAll(hellas, 2);
    expect(shown(hellas, 'Diversifier'), '2 of 3 → 5 of 8').eq(5);
    setAll(hellas, 3);
    expect(shown(hellas, 'Diversifier')).eq(8);
    // Planner: every track 4 ↔ 16 cards in hand.
    setAll(tharsis, 3);
    expect(shown(tharsis, 'Planner'), '3 of 4 → 12 of 16').eq(12);
    setAll(tharsis, 4);
    expect(shown(tharsis, 'Planner')).eq(16);
    // Builder: the scales already agree (track 8 ↔ 8 tags) — no rescale.
    setAll(tharsis, 6);
    expect(shown(tharsis, 'Builder')).eq(6);
  });

  it('the ELYSIUM criteria land on their printed thresholds', () => {
    const [game, /* human */, bot] = testAutomaGame({boardName: BoardName.ELYSIUM}, '-rescale-e');
    const shown = (name: string) =>
      AutomaMAEvaluation.botMilestoneScore(game.milestones.find((m) => m.name === name)!, game);
    const setAll = (value: number) => {
      for (const track of game.automa!.board.tracks) {
        track.position = value;
      }
    };

    // Generalist: every track 2 ↔ 6 raised productions.
    setAll(1);
    expect(shown('Generalist'), '1 of 2 → 3 of 6 — half way, on the player scale').eq(3);
    setAll(2);
    expect(shown('Generalist')).eq(6);
    // Specialist: track 10 ↔ 10 in one production — the scales already agree.
    setAll(5);
    expect(shown('Specialist'), 'track 5 of 10 → 5 of 10').eq(5);
    setAll(10);
    expect(shown('Specialist')).eq(10);
    // Ecologist: Bio track 4 ↔ 4 bio tags.
    setAll(0);
    game.automa!.board.getTrackOfRole('bio')!.position = 2;
    expect(shown('Ecologist'), 'Bio 2 of 4 → 2 of 4 = 50%').eq(2);
    game.automa!.board.getTrackOfRole('bio')!.position = 4;
    expect(shown('Ecologist')).eq(4);
    // The played-pile pair reads as the plain count on the player's own scale.
    game.automa!.playedPile = [CardName.ALGAE, CardName.ALGAE, CardName.BIG_ASTEROID];
    expect(shown('Tycoon10'), '2 green/blue cards read as 2').eq(2);
    expect(shown('Legend'), '1 event reads as 1').eq(1);
    expect(bot.playedCards.length, 'and none of it came from a tableau').eq(0);
  });

  it('the MODEL the client receives carries the normalized number, not the M€', () => {
    // The end of the pipe: whatever reaches ClaimedMilestoneModel is what the
    // console prints in the «Соперники» strip and ranks the race by.
    const [game, human, bot] = testAutomaGame({boardName: BoardName.HELLAS}, '-model');
    bot.megaCredits = 34;
    const model = Server.getMilestones(game).find((m) => m.name === 'Tactician')!;
    const botScore = model.scores.find((s) => s.color === bot.color)!;
    expect(botScore.score, 'the bot\'s row is on the human row\'s scale').eq(4);
    expect(botScore.claimable).is.false;
    expect(model.threshold, 'one printed threshold, true for every row').eq(5);
    expect(model.scores.find((s) => s.color === human.color)!.score).eq(0);
  });

  it('the ELYSIUM model reaches the client the same way', () => {
    const [game, human, bot] = testAutomaGame({boardName: BoardName.ELYSIUM}, '-model-e');
    for (const track of game.automa!.board.tracks) {
      track.position = 1;
    }
    const model = Server.getMilestones(game).find((m) => m.name === 'Generalist')!;
    expect(model.threshold).eq(6);
    const botScore = model.scores.find((s) => s.color === bot.color)!;
    expect(botScore.score, 'track 1 of 2 → 3 of 6 productions').eq(3);
    expect(botScore.claimable).is.false;
    expect(model.scores.find((s) => s.color === human.color)!.score).eq(0);
  });

  it('AWARDS are deliberately NOT normalized — their number is the shared currency', () => {
    // An award score is compared DIRECTLY against the human scores to hand out
    // the 5/2 VP (AwardScorer → giveAwards), so it already speaks the rules'
    // own units. Rescaling it would make the displayed race contradict the
    // endgame result — hence this pin: Excentric stays floor(M€ / 5).
    const [game, /* human */, bot] = testAutomaGame({boardName: BoardName.HELLAS}, '-awards');
    bot.megaCredits = 40;
    const excentric = game.awards.find((a) => a.name === 'Excentric') ?? new Excentric();
    expect(AutomaMAEvaluation.botAwardScore(excentric, game)).eq(8);
    expect(new AwardScorer(game, excentric).get(bot), 'the endgame scorer reads the same number').eq(8);
  });
});
