import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {PREMIUM_SCOPE_MODULES} from '../../src/common/cards/premiumScope';
import {AUTOPILOT_SCENARIOS, CARDS_SCENARIO_HANDS, CARDS_SCENARIOS, dealFor, LEDGER_CARDS, SCENARIO_TARGETS, scenarioFor} from '../testing/autopilotDeal';

/**
 * THE AUTOPILOT's SCENARIO TABLES ARE ONE LIST (stage 6 — `tests/testing/autopilotDeal.ts`): every scenario a pilot
 * may boot has its fixture (`tests/e2e/fixtures/<name>.json`, written by `generate.ts`), the cards axis' scenarios deal
 * exactly the hands their targets name (the two lists live apart — the generator may not import the deal's module, it
 * would move the order the decks are composed in), and the cadence of `auto` gives a CI pass of 48 every scenario.
 */
const FIXTURES_DIR = path.resolve(__dirname, '..', 'e2e', 'fixtures');

type SerializedSeat = {id: string, cardsInHand: Array<string>};
function viewerHand(name: string): Array<string> {
  const game = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, `${name}.json`), 'utf8')) as {activePlayer: string, players: Array<SerializedSeat>};
  return game.players.find((p) => p.id === game.activePlayer)?.cardsInHand ?? [];
}

describe('autopilot scenarios', () => {
  for (const name of AUTOPILOT_SCENARIOS) {
    it(`${name} has its fixture`, () => {
      expect(fs.existsSync(path.join(FIXTURES_DIR, `${name}.json`)), `tests/e2e/fixtures/${name}.json — FIXTURES=${name} npm run e2e:fixtures`).to.eq(true);
    });
  }

  for (const name of CARDS_SCENARIOS) {
    it(`${name} deals the hand its targets name`, () => {
      const hand = viewerHand(name);
      expect(SCENARIO_TARGETS[name]).to.deep.eq(CARDS_SCENARIO_HANDS[name]);
      expect(CARDS_SCENARIO_HANDS[name].filter((card) => !hand.includes(card)), `${name}: targets missing from the viewer's hand`).to.deep.eq([]);
    });
  }

  it('a CI pass of 48 consecutive games plays every scenario, never at a campaign game (n % 8 === 5)', () => {
    for (const from of [1, 537, 1001]) {
      const seen = new Set<string>();
      for (let n = from; n < from + 48; n++) {
        const scenario = scenarioFor(n, 'auto');
        if (scenario !== undefined) {
          expect(n % 8, `game ${n}`).to.not.eq(5);
          seen.add(scenario);
        }
      }
      expect([...AUTOPILOT_SCENARIOS].filter((s) => !seen.has(s)), `games ${from}–${from + 47}`).to.deep.eq([]);
    }
  });

  it('the ledger\'s cards are dealt to DEALT games of a CI pass — never only to the scenarios\' or the campaign\'s', () => {
    const on = new Set<string>(PREMIUM_SCOPE_MODULES);
    const dealtGames = Array.from({length: 48}, (_, i) => 537 + i).filter((n) => scenarioFor(n, 'auto') === undefined && n % 8 !== 5);
    for (const card of [...LEDGER_CARDS.corporations, ...LEDGER_CARDS.projects, ...LEDGER_CARDS.preludes]) {
      const games = dealtGames.filter((n) => {
        const deal = dealFor(n, on, true);
        return [...deal.corporations, ...deal.projects, ...deal.preludes].includes(card);
      });
      expect(games.length, `${card} in no dealt game of 537–584`).to.be.greaterThan(0);
    }
  });

  it('a scenario named as the mode is every game\'s', () => {
    expect(scenarioFor(2, 'scenario-politics')).to.eq('scenario-politics');
    expect(scenarioFor(2, 'off')).to.eq(undefined);
  });
});
