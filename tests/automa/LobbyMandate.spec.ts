import {expect} from 'chai';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {AutomaActionCard} from '../../src/server/automa/AutomaState';
import {
  LOBBY_MANDATE_DECK, LobbyMandateCard, lobbyingThisTurn, lobbyingTrigger, MAX_BOT_DELEGATES_PER_TURN, mandateSize, turnCapacity,
} from '../../src/server/automa/LobbyMandate';
import {SeededRandom} from '../../src/common/utils/Random';
import {testAutomaGame} from './AutomaTestGame';

/**
 * THE LOBBYING MANDATE (docs/TURMOIL_REDUX_MARSBOT.md §3.2, D14) — the owner's
 * targets, pinned: ~30 % of the generations with no further delegate, ALL the
 * bot's delegates in ~3 % (never under 1 %), never more than two of the bot's
 * delegates a turn, and a mandate always lands before the generation ends.
 */
const PARTY_POLITICS: AutomaActionCard = {kind: 'bonus', id: BonusCardId.B21_PARTY_POLITICS};

describe('LobbyMandate — the bot\'s further delegates a generation', () => {
  it('the deck: 33 cards — none 30 %, ALL 3 %, nothing above 5 but ALL', () => {
    expect(LOBBY_MANDATE_DECK).has.length(33);
    const share = (card: LobbyMandateCard) => LOBBY_MANDATE_DECK.filter((c) => c === card).length / LOBBY_MANDATE_DECK.length;
    expect(share(0)).to.be.within(0.29, 0.31);
    expect(share('all')).to.be.within(0.01, 0.05);
    expect(share('all')).to.be.closeTo(0.03, 0.005);
    expect(LOBBY_MANDATE_DECK.every((c) => c === 'all' || (c >= 0 && c <= 5))).is.true;
    expect(mandateSize('all')).eq(6);
    expect(mandateSize(3)).eq(3);
  });

  it('the trigger is the official generator: a cost divisible by 3 (0 divides)', () => {
    expect([0, 3, 9, 12, 14, 18, 27, 31].map(lobbyingTrigger)).deep.eq([true, true, true, true, false, true, true, false]);
  });

  it('the capacity of the deck ahead: two a card, one beside Party Politics\' own', () => {
    expect(turnCapacity([])).eq(0);
    expect(turnCapacity([{kind: 'project', name: 'X' as never}, PARTY_POLITICS])).eq(3);
  });

  describe('the pace — how many this turn, and why', () => {
    it('nothing left → nothing, whatever the card', () => {
      expect(lobbyingThisTurn({left: 0, trigger: true, partyPolitics: false, ahead: 0})).deep.eq({count: 0, byTrigger: 0, byMandate: 0});
    });
    it('a trigger sends one while the deck ahead can carry the rest', () => {
      expect(lobbyingThisTurn({left: 2, trigger: true, partyPolitics: false, ahead: 4})).deep.eq({count: 1, byTrigger: 1, byMandate: 0});
    });
    it('no trigger and room ahead → the bot waits', () => {
      expect(lobbyingThisTurn({left: 2, trigger: false, partyPolitics: false, ahead: 4})).deep.eq({count: 0, byTrigger: 0, byMandate: 0});
    });
    it('what the deck ahead can no longer carry is sent now — the catch-up', () => {
      expect(lobbyingThisTurn({left: 3, trigger: false, partyPolitics: false, ahead: 2})).deep.eq({count: 1, byTrigger: 0, byMandate: 1});
      expect(lobbyingThisTurn({left: 6, trigger: true, partyPolitics: false, ahead: 4})).deep.eq({count: 2, byTrigger: 1, byMandate: 1});
    });
    it('never more than two a turn — and only one beside Party Politics\' own delegate', () => {
      expect(lobbyingThisTurn({left: 6, trigger: true, partyPolitics: false, ahead: 0}).count).eq(MAX_BOT_DELEGATES_PER_TURN);
      expect(lobbyingThisTurn({left: 6, trigger: false, partyPolitics: true, ahead: 0}).count).eq(1);
    });
  });

  describe('measured over the REAL project deck — the owner\'s distribution holds, two a turn, every mandate lands', () => {
    it('simulates 20 000 generations of the bot\'s real action decks', () => {
      const [game] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true, preludeExtension: true});
      const costs = game.projectDeck.drawPile.map((card) => card.cost);
      expect(costs.length, 'a real project deck').greaterThan(100);
      const rng = new SeededRandom(0.4242);
      const pick = <T>(list: ReadonlyArray<T>): T => list[rng.nextInt(list.length)];
      const totals = new Map<number, number>();
      const generations = 20_000;
      let maxTurn = 0;
      for (let g = 0; g < generations; g++) {
        // The smallest real deck (3 project cards + the top bonus card + Party Politics) up to the largest
        // usual one (4 project cards + the top bonus card + Party Politics + both Shipping Lines).
        const projects = 3 + rng.nextInt(2);
        const extraBonus = rng.nextInt(3);
        const deck: Array<{project?: number} | 'pp' | 'bonus'> = [
          ...Array.from({length: projects}, () => ({project: pick(costs)})),
          'bonus', 'pp', ...Array.from({length: extraBonus}, (): 'bonus' => 'bonus'),
        ];
        for (let i = deck.length - 1; i > 0; i--) {
          const j = rng.nextInt(i + 1);
          [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        const card = pick(LOBBY_MANDATE_DECK);
        let left = mandateSize(card);
        let sent = 1; // Party Politics' own delegate — every generation.
        deck.forEach((entry, i) => {
          const ahead = deck.slice(i + 1).reduce<number>((sum, e) => sum + (e === 'pp' ? 1 : 2), 0);
          const step = lobbyingThisTurn({
            left,
            trigger: typeof entry === 'object' && entry.project !== undefined && lobbyingTrigger(entry.project),
            partyPolitics: entry === 'pp',
            ahead,
          });
          maxTurn = Math.max(maxTurn, step.count + (entry === 'pp' ? 1 : 0));
          left -= step.count;
          sent += step.count;
        });
        expect(left, `mandate ${card} landed over a deck of ${deck.length}`).eq(0);
        totals.set(sent, (totals.get(sent) ?? 0) + 1);
      }
      const shareOf = (n: number) => (totals.get(n) ?? 0) / generations;
      const lines = Array.from({length: 7}, (_, i) => `${i + 1}: ${(100 * shareOf(i + 1)).toFixed(1)} %`);
      console.log(`      [mandate] delegates a generation (Party Politics included) — ${lines.join(' · ')}`);
      expect(maxTurn, 'never more than two of the bot\'s delegates a turn').to.be.at.most(MAX_BOT_DELEGATES_PER_TURN);
      expect(shareOf(1), 'Party Politics alone ~30 %').to.be.within(0.27, 0.34);
      expect(shareOf(7), 'all seven ~3 %, never under 1 %').to.be.within(0.02, 0.04);
    }).timeout(20_000); // ~1.4 s on a quiet machine — a loaded full suite must not time it out
  });
});
