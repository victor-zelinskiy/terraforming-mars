import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {MARS_BOT_CORP_IDS, MarsBotCorpId, marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {marsBotDividendInfo} from '../../src/common/automa/MarsBotDividendData';
import {DIVIDEND_GOAL_LINE, MarsBotDividendResult} from '../../src/common/automa/MarsBotDividend';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Space} from '../../src/server/boards/Space';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaScoring} from '../../src/server/automa/AutomaScoring';
import {AutomaState} from '../../src/server/automa/AutomaState';
import {failedAction} from '../../src/server/automa/AutomaFailedAction';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';
import {fakeCard} from '../TestingUtils';

/**
 * «ПОРТФЕЛЬ И ДИВИДЕНДЫ» — the framework and the 45 clauses
 * (docs/claude/prompts/marsbot-portfolio-dividends.md). The red lines it
 * guards: a dividend never changes state (П1/П2), a holding never runs a
 * printed box (П3), an ordinary game's breakdown keeps its exact shape, and
 * every corporation has its box and its clause (the worklist — invariant 11).
 */

/** A game past the generation-1 gate, so the primary and the holdings are seated. */
function seated(options: Parameters<typeof testAutomaGame>[0], suffix: string): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({venusNextExtension: true, coloniesExtension: true, ...options}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function landSpaces(game: IGame): Array<Space> {
  return game.board.spaces.filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined);
}

/** Lay a tile directly (no hooks — the dividend only COUNTS what stands on the board). */
function lay(space: Space, player: IPlayer | undefined, tileType: TileType): void {
  space.tile = {tileType};
  space.player = player;
}

/** A mid-to-late table: a played pile, advanced tracks, tiles of both seats, a Failed Action or two. */
function lateTable(game: IGame, human: IPlayer, bot: IPlayer): void {
  const automa = game.automa!;
  automa.playedPile.push(
    CardName.GENE_REPAIR, CardName.ASTEROID, CardName.IO_MINING_INDUSTRIES, CardName.SPACE_ELEVATOR,
    CardName.WATER_IMPORT_FROM_EUROPA, CardName.ARCTIC_ALGAE, CardName.MINE, CardName.SEARCH_FOR_LIFE,
    CardName.BIRDS, CardName.ANTS, CardName.EARTH_OFFICE, CardName.POWER_PLANT, CardName.RESEARCH);
  automa.board.tracks.forEach((t, i) => {
    t.position = Math.min(t.maxPosition, 3 + i * 2);
  });
  const land = landSpaces(game);
  lay(land[0], bot, TileType.CITY);
  lay(land[1], bot, TileType.GREENERY);
  lay(land[2], bot, TileType.GREENERY);
  lay(land[3], human, TileType.CITY);
  lay(land[4], human, TileType.GREENERY);
  bot.megaCredits = 23;
  automa.failedActions = 3;
}

function snapshot(game: IGame): string {
  return JSON.stringify({
    automa: game.automa!.serialize(),
    board: game.board.serialize(),
    players: game.players.map((p) => [p.megaCredits, p.terraformRating, p.plants, p.heat]),
    events: game.events.events.length,
    log: game.gameLog.length,
  });
}

function expectWellFormed(result: MarsBotDividendResult, label: string): void {
  expect(Number.isInteger(result.vp), `${label}: an integer`).is.true;
  expect(result.vp, `${label}: never negative`).gte(0);
  expect(result.terms.length, `${label}: the formula is shown`).gt(0);
  expect(result.terms.reduce((sum, t) => sum + t.vp, 0), `${label}: Σ terms === vp`).eq(result.vp);
  for (const term of result.terms) {
    expect(term.count, `${label}: «${term.label}» counts from zero`).gte(0);
  }
}

describe('MarsBot dividends (the campaign portfolio)', () => {
  describe('every corporation has its box and its clause — the worklist', () => {
    it('a printed box with a name, lines and the numbers it prints', () => {
      const missing: Array<string> = [];
      for (const id of MARS_BOT_CORP_IDS) {
        const box = marsBotDividendInfo(id);
        if (box === undefined || box.name === '' || box.lines.length === 0) {
          missing.push(id);
          continue;
        }
        // Every printed number IS one of the box's rates — the clause reads the same value.
        const rates = new Set(Object.values(box.rates).map(String));
        for (const line of box.lines) {
          for (const param of line.params ?? []) {
            if (!rates.has(param)) {
              missing.push(`${id}: printed «${param}» is not a rate`);
            }
          }
        }
      }
      expect(missing).deep.eq([]);
    });

    it('every box has its two GOALS on an operand its own formula measures, printed once under that line', () => {
      const [game] = seated({}, '-goals');
      const wrong: Array<string> = [];
      for (const id of MARS_BOT_CORP_IDS) {
        const {goal, lines} = marsBotDividendInfo(id);
        if (!(goal.at > 0 && goal.at2 > goal.at && goal.vp > 0 && goal.vp2 > 0)) {
          wrong.push(`${id}: goals ${goal.at}/${goal.at2} +${goal.vp}/+${goal.vp2}`);
        }
        // The measured operand exists in the clause's OWN formula (the server's terms, never a guess).
        const own = AutomaCorporations.corpFor(id).dividend(game);
        if (own.terms.length <= goal.term) {
          wrong.push(`${id}: the goal measures term ${goal.term}, the formula has ${own.terms.length}`);
        }
        if (lines.filter((l) => l.text === DIVIDEND_GOAL_LINE).length !== 1) {
          wrong.push(`${id}: the goal line is not printed exactly once`);
        }
      }
      expect(wrong).deep.eq([]);
    });

    it('a clause in the corporation file for every id', () => {
      for (const id of MARS_BOT_CORP_IDS) {
        expect(typeof AutomaCorporations.corpFor(id).dividend, id).eq('function');
      }
    });
  });

  describe('П1 · П2 — a clause is a pure read', () => {
    it('on the opening table and on a late table, every clause is well formed and changes nothing', () => {
      const [game, human, bot] = seated({}, '-pure');
      for (const phase of ['opening', 'late'] as const) {
        if (phase === 'late') {
          lateTable(game, human, bot);
        }
        for (const id of MARS_BOT_CORP_IDS) {
          const before = snapshot(game);
          const result = AutomaCorporations.dividendOf(game, id);
          expectWellFormed(result, `${id} (${phase})`);
          expect(snapshot(game), `${id} (${phase}) wrote state`).eq(before);
        }
      }
    });

    it('the late table pays more than the opening one (П8 — the dividend grows with the game)', () => {
      const [game, human, bot] = seated({}, '-grow');
      const opening = MARS_BOT_CORP_IDS.reduce((sum, id) => sum + AutomaCorporations.dividendOf(game, id).vp, 0);
      lateTable(game, human, bot);
      const late = MARS_BOT_CORP_IDS.reduce((sum, id) => sum + AutomaCorporations.dividendOf(game, id).vp, 0);
      expect(late).gt(opening);
    });
  });

  describe('the portfolio is seated at the generation-1 gate', () => {
    it('holdings beside the primary, in order; the primary stays the only active corporation', () => {
      const [game] = seated({corporation: MarsBotCorpId.C01_CREDICOR, portfolio: [MarsBotCorpId.C10_THARSIS_REPUBLIC, MarsBotCorpId.C02_ECOLINE]}, '-seat');
      expect(game.automa!.corporation).eq(MarsBotCorpId.C01_CREDICOR);
      expect(game.automa!.holdings).deep.eq([MarsBotCorpId.C10_THARSIS_REPUBLIC, MarsBotCorpId.C02_ECOLINE]);
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C01_CREDICOR);
    });

    it('П3 — a holding runs no printed box: Ecoline\'s Rapid Sprouting never joins the decks', () => {
      const [game] = seated({corporation: MarsBotCorpId.C01_CREDICOR, portfolio: [MarsBotCorpId.C02_ECOLINE]}, '-noop');
      const automa = game.automa!;
      const everywhere = JSON.stringify([automa.actionDeck, automa.bonusDeck, automa.recurringBonusCards]);
      expect(everywhere).not.contains('B23');
      expect(automa.corpResources, 'no plant on a holding\'s card').eq(0);
      // …while the same corporation as the PRIMARY does add it.
      const [primary] = seated({corporation: MarsBotCorpId.C02_ECOLINE}, '-primary');
      const decks = JSON.stringify([primary.automa!.actionDeck, primary.automa!.bonusDeck, primary.automa!.recurringBonusCards]);
      expect(decks).contains('B23');
    });

    it('the journal names each holding once, at the setup', () => {
      const [game] = seated({corporation: MarsBotCorpId.C01_CREDICOR, portfolio: [MarsBotCorpId.C10_THARSIS_REPUBLIC]}, '-log');
      const lines = game.gameLog.filter((m) => m.message.startsWith('${0} holds the corporation'));
      expect(lines).has.length(1);
    });

    it('the primary, a duplicate and an ineligible corporation are dropped from the portfolio', () => {
      const [game] = testAutomaGame({corporation: MarsBotCorpId.C01_CREDICOR,
        portfolio: [MarsBotCorpId.C01_CREDICOR, MarsBotCorpId.C10_THARSIS_REPUBLIC, MarsBotCorpId.C10_THARSIS_REPUBLIC, MarsBotCorpId.C25_VIRON]}, '-drop');
      game.playerIsFinishedWithResearchPhase(game.players.find((p) => !p.isMarsBot)!);
      // Viron needs Venus Next or Colonies — this game has neither.
      expect(game.automa!.holdings).deep.eq([MarsBotCorpId.C10_THARSIS_REPUBLIC]);
    });

    it('the random primary is never drawn from the portfolio', () => {
      for (let i = 0; i < 12; i++) {
        const portfolio = [MarsBotCorpId.C02_ECOLINE, MarsBotCorpId.C10_THARSIS_REPUBLIC];
        const [game] = seated({corporation: 'random', portfolio, seed: (i + 1) / 13}, `-rnd${i}`);
        expect(portfolio, `seed ${i}`).not.contains(game.automa!.corporation);
        expect(game.automa!.holdings).deep.eq(portfolio);
      }
    });
  });

  describe('the VP pipeline', () => {
    it('an ordinary game (no holdings) keeps the exact breakdown — no dividend key at all', () => {
      const [game] = seated({}, '-plain');
      const parts = AutomaScoring.automaVictoryPoints(game);
      expect(Object.keys(parts)).deep.eq(['mcToVp', 'mcPerVp', 'neuralInstance', 'cardVp', 'corpVp']);
    });

    it('with holdings: dividendVp is the sum of the holdings, detailed per holding, and feeds the total', () => {
      const [game, human, bot] = seated({corporation: MarsBotCorpId.C01_CREDICOR, portfolio: [MarsBotCorpId.C02_ECOLINE, MarsBotCorpId.C10_THARSIS_REPUBLIC]}, '-vp');
      lateTable(game, human, bot);
      const parts = AutomaScoring.automaVictoryPoints(game);
      // Ecoline: 2 per greenery (2 greeneries, under the threshold of 6) · Tharsis: 3 per city (1).
      expect(parts.detailsDividends!.map((d) => [d.corporation, d.vp])).deep.eq([
        [MarsBotCorpId.C02_ECOLINE, 4],
        [MarsBotCorpId.C10_THARSIS_REPUBLIC, 3],
      ]);
      expect(parts.dividendVp).eq(7);
      const withDividend = bot.getVictoryPoints();
      expect(withDividend.automa!.dividendVp).eq(7);
      game.automa!.holdings = [];
      const without = bot.getVictoryPoints();
      expect(withDividend.total - without.total, 'the total carries the dividend').eq(7);
    });

    it('the PRIMARY never pays a dividend — only a holding does', () => {
      const [game, human, bot] = seated({corporation: MarsBotCorpId.C02_ECOLINE, portfolio: [MarsBotCorpId.C10_THARSIS_REPUBLIC]}, '-noprim');
      lateTable(game, human, bot);
      const parts = AutomaScoring.automaVictoryPoints(game);
      expect(parts.detailsDividends!.map((d) => d.corporation)).deep.eq([MarsBotCorpId.C10_THARSIS_REPUBLIC]);
    });
  });

  describe('serialization', () => {
    it('holdings and the Failed Action count survive a round trip', () => {
      const [game] = seated({corporation: MarsBotCorpId.C01_CREDICOR, portfolio: [MarsBotCorpId.C36_PRISTAR]}, '-ser');
      failedAction(game, 'no-tags');
      failedAction(game, 'track-maxed');
      const restored = AutomaState.deserialize(game.automa!.serialize(), game.gameOptions);
      expect(restored.holdings).deep.eq([MarsBotCorpId.C36_PRISTAR]);
      expect(restored.failedActions).eq(2);
    });

    it('an older save without either field reads no holdings and no Failed Actions', () => {
      const [game] = seated({}, '-old');
      const serialized = game.automa!.serialize();
      delete serialized.holdings;
      delete serialized.failedActions;
      const restored = AutomaState.deserialize(serialized, game.gameOptions);
      expect(restored.holdings).deep.eq([]);
      expect(restored.failedActions).eq(0);
    });

    it('an ordinary game writes no holdings key', () => {
      const [game] = seated({}, '-nokey');
      expect(Object.keys(game.automa!.serialize())).not.contains('holdings');
    });
  });

  describe('the clauses read their own corporation\'s identity (spot checks across the families)', () => {
    it('the played pile — Credicor counts printed cost, Valley Trust science cards and its threshold', () => {
      const [game] = seated({}, '-pile');
      const automa = game.automa!;
      const r = marsBotDividendInfo(MarsBotCorpId.C01_CREDICOR).rates;
      automa.playedPile.push(CardName.SPACE_ELEVATOR, CardName.IO_MINING_INDUSTRIES); // 27 + 41
      expect(AutomaCorporations.dividendOf(game, MarsBotCorpId.C01_CREDICOR).vp).eq(Math.floor(68 * r.each / r.per));
      automa.playedPile.push(CardName.RESEARCH, CardName.SEARCH_FOR_LIFE, CardName.GENE_REPAIR, CardName.PHYSICS_COMPLEX);
      const valley = marsBotDividendInfo(MarsBotCorpId.C16_VALLEY_TRUST).rates;
      expect(AutomaCorporations.dividendOf(game, MarsBotCorpId.C16_VALLEY_TRUST).vp).eq(4 * valley.each + valley.bonus);
    });

    it('the tracks — Point Luna pays the least advanced track, the Venus track excluded', () => {
      const [game] = seated({}, '-tracks');
      const automa = game.automa!;
      automa.board.tracks.forEach((t) => {
        t.position = t.definition.role === 'venus' ? 0 : 5;
      });
      const r = marsBotDividendInfo(MarsBotCorpId.C14_POINT_LUNA).rates;
      expect(AutomaCorporations.dividendOf(game, MarsBotCorpId.C14_POINT_LUNA).vp).eq(5 * r.each);
    });

    it('two-sided — Saturn Systems counts the bot\'s Jovian tags AND the humans\' Jovian cards', () => {
      const [game, human] = seated({}, '-saturn');
      game.automa!.playedPile.push(CardName.IO_MINING_INDUSTRIES); // one Jovian tag
      human.playedCards.push(fakeCard({tags: [Tag.JOVIAN]}));
      const r = marsBotDividendInfo(MarsBotCorpId.C08_SATURN_SYSTEMS).rates;
      expect(AutomaCorporations.dividendOf(game, MarsBotCorpId.C08_SATURN_SYSTEMS).vp).eq(r.own + r.theirs);
    });

    it('Failed Actions — Pristar pays per failure and stops at its printed ceiling', () => {
      const [game] = seated({}, '-pristar');
      const r = marsBotDividendInfo(MarsBotCorpId.C36_PRISTAR).rates;
      failedAction(game, 'no-tags');
      expect(AutomaCorporations.dividendOf(game, MarsBotCorpId.C36_PRISTAR).vp).eq(r.each);
      game.automa!.failedActions = 100;
      const capped = AutomaCorporations.dividendOf(game, MarsBotCorpId.C36_PRISTAR);
      // The cap ends the formula; the two goals stand beside it (both reached at 100).
      expect(capped.vp).eq(r.cap + r.goalVp + r.goalVp2);
      expect(capped.terms[0].cap).eq(r.cap);
    });

    it('the GOALS — +vp at the first threshold of the measured operand, +vp2 more at the second, nothing below', () => {
      const [game] = seated({}, '-goalpay');
      const r = marsBotDividendInfo(MarsBotCorpId.C36_PRISTAR).rates;
      const pay = (failures: number) => {
        game.automa!.failedActions = failures;
        return AutomaCorporations.dividendOf(game, MarsBotCorpId.C36_PRISTAR);
      };
      const base = (failures: number) => Math.min(r.cap, failures * r.each);
      expect(pay(r.goalAt - 1).vp, 'one short of the first goal').eq(base(r.goalAt - 1));
      expect(pay(r.goalAt).vp, 'the first goal').eq(base(r.goalAt) + r.goalVp);
      expect(pay(r.goalAt2 - 1).vp, 'one short of the second').eq(base(r.goalAt2 - 1) + r.goalVp);
      const both = pay(r.goalAt2);
      expect(both.vp, 'both goals').eq(base(r.goalAt2) + r.goalVp + r.goalVp2);
      expect(both.terms.slice(-2).map((t) => [t.label, t.threshold, t.vp])).deep.eq([
        ['Goal', r.goalAt, r.goalVp],
        ['Second goal', r.goalAt2, r.goalVp2],
      ]);
      expectWellFormed(both, 'Pristar with both goals');
    });

    it('the board — Philares counts borders between the bot\'s tiles and another player\'s', () => {
      const [game, human, bot] = seated({}, '-philares');
      const a = landSpaces(game)[0];
      const b = game.board.getAdjacentSpaces(a).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
      lay(a, bot, TileType.CITY);
      lay(b, human, TileType.GREENERY);
      const r = marsBotDividendInfo(MarsBotCorpId.C22_PHILARES).rates;
      expect(AutomaCorporations.dividendOf(game, MarsBotCorpId.C22_PHILARES).vp).eq(r.each);
    });

    it('every corporation\'s original is a known card (the box names a real corporation)', () => {
      for (const id of MARS_BOT_CORP_IDS) {
        expect(marsBotCorpInfo(id).original, id).is.a('string');
      }
    });
  });
});
