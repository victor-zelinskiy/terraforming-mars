import {expect} from 'chai';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {AutomaActionCard} from '../../src/server/automa/AutomaState';
import {
  drawLobbyMandate, gameTempo, LOBBY_MANDATE_CARDS, LOBBY_MANDATE_EARLY, LOBBY_MANDATE_LATE, lobbyingThisTurn, lobbyingTrigger,
  MAX_BOT_DELEGATES_PER_TURN, mandateSize, mandateWeights, pickMandate, turnCapacity,
} from '../../src/server/automa/LobbyMandate';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../src/common/constants';
import {SeededRandom} from '../../src/common/utils/Random';
import {setOxygenLevel, setTemperature} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

/**
 * THE LOBBYING MANDATE (docs/TURMOIL_REDUX_MARSBOT.md §3.2, D14 + D15) — the owner's
 * targets, pinned: ALL the bot's delegates never under 1 % and never over 5 %;
 * early in the game one or two delegates a generation are the rule, late six and
 * seven grow to 5 % each; halfway the D14 deck; never more than two of the bot's
 * delegates a turn, and a mandate always lands before the generation ends.
 */
const PARTY_POLITICS: AutomaActionCard = {kind: 'bonus', id: BonusCardId.B21_PARTY_POLITICS};

describe('LobbyMandate — the bot\'s further delegates a generation', () => {
  it('the anchors: each a whole 100 %, one weight per card; early 1–2 delegates 72 %, late 6 · 7 at 5 % each', () => {
    expect(LOBBY_MANDATE_CARDS).deep.eq([0, 1, 2, 3, 4, 5, 'all']);
    for (const table of [LOBBY_MANDATE_EARLY, LOBBY_MANDATE_LATE]) {
      expect(table).has.length(LOBBY_MANDATE_CARDS.length);
      expect(table.reduce((a, b) => a + b, 0)).eq(100);
    }
    expect(LOBBY_MANDATE_EARLY[0] + LOBBY_MANDATE_EARLY[1], 'one or two delegates early').eq(72);
    expect(LOBBY_MANDATE_LATE[5], 'six delegates late').eq(5);
    expect(LOBBY_MANDATE_LATE[6], 'all seven late').eq(5);
    expect(mandateSize('all')).eq(6);
    expect(mandateSize(3)).eq(3);
  });

  it('the blend: every tempo keeps ALL within [1 %, 5 %] and six at most 5 %; halfway it is the D14 deck', () => {
    for (let step = 0; step <= 20; step++) {
      const t = step / 20;
      const w = mandateWeights(t);
      expect(w.reduce((a, b) => a + b, 0)).to.be.closeTo(100, 1e-9);
      expect(w[6], `ALL at tempo ${t}`).to.be.within(1, 5);
      expect(w[5], `six at tempo ${t}`).to.be.at.most(5);
    }
    // The D14 deck (33 cards): 30.3 · 24.2 · 18.2 · 12.1 · 9.1 · 3.0 · 3.0 % — the middle of the game reads the same.
    const mid = mandateWeights(0.5);
    [30.3, 24.2, 18.2, 12.1, 9.1, 3.0, 3.0].forEach((d14, i) => expect(mid[i], `card ${LOBBY_MANDATE_CARDS[i]}`).to.be.closeTo(d14, 1.5));
    // An out-of-range tempo clamps.
    expect(mandateWeights(-1)).deep.eq(mandateWeights(0));
    expect(mandateWeights(2)).deep.eq(mandateWeights(1));
  });

  it('the pick walks the weights: the first card for u = 0, ALL at the top end', () => {
    const w = mandateWeights(0);
    expect(pickMandate(w, 0)).eq(0);
    expect(pickMandate(w, 0.4199)).eq(0);
    expect(pickMandate(w, 0.42)).eq(1);
    expect(pickMandate(w, 0.9999)).eq('all');
  });

  it('the tempo is the HUD\'s terraforming progress (temperature, oxygen, oceans); the draw records it and never moves the shared RNG', () => {
    const [game] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
    expect(gameTempo(game)).to.be.closeTo(0, 0.05);
    setTemperature(game, MAX_TEMPERATURE);
    setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    expect(gameTempo(game)).to.be.closeTo(2 / 3, 0.05);
    const before = game.rng.current;
    const drawn = drawLobbyMandate(game);
    expect(drawn.tempo).to.be.closeTo(gameTempo(game), 1e-9);
    expect(game.rng.current).eq(before);
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

  describe('measured over the REAL project deck — the owner\'s distribution at every tempo, two a turn, every mandate lands', () => {
    /** `generations` generations of the bot's real action decks at `tempo`; the share of 1…7 delegates (Party Politics included). */
    function simulate(costs: ReadonlyArray<number>, tempo: number, generations: number, seed: number) {
      const rng = new SeededRandom(seed);
      const pick = <T>(list: ReadonlyArray<T>): T => list[rng.nextInt(list.length)];
      const weights = mandateWeights(tempo);
      const totals = new Map<number, number>();
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
        const card = pickMandate(weights, rng.next());
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
      const share = Array.from({length: 7}, (_, i) => (totals.get(i + 1) ?? 0) / generations);
      console.log(`      [mandate] tempo ${tempo.toFixed(2)} — delegates a generation: ${share.map((s, i) => `${i + 1}: ${(100 * s).toFixed(1)} %`).join(' · ')}`);
      return {share, maxTurn};
    }

    it('simulates 20 000 generations at the start, halfway and at the end of the game', () => {
      const [game] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true, preludeExtension: true});
      const costs = game.projectDeck.drawPile.map((card) => card.cost);
      expect(costs.length, 'a real project deck').greaterThan(100);

      const early = simulate(costs, 0, 20_000, 0.4242);
      expect(early.maxTurn, 'never more than two of the bot\'s delegates a turn').to.be.at.most(MAX_BOT_DELEGATES_PER_TURN);
      expect(early.share[0] + early.share[1], 'early: one or two delegates ~72 %').to.be.within(0.69, 0.75);
      expect(early.share[6], 'early: all seven ~1 %, never under').to.be.within(0.005, 0.016);

      const mid = simulate(costs, 0.5, 20_000, 0.5151);
      expect(mid.maxTurn).to.be.at.most(MAX_BOT_DELEGATES_PER_TURN);
      expect(mid.share[0], 'halfway: Party Politics alone ~30 % (the D14 deck)').to.be.within(0.27, 0.34);

      const late = simulate(costs, 1, 20_000, 0.6161);
      expect(late.maxTurn).to.be.at.most(MAX_BOT_DELEGATES_PER_TURN);
      expect(late.share[5], 'late: six ~5 %, never more').to.be.within(0.04, 0.06);
      expect(late.share[6], 'late: all seven ~5 %, never more').to.be.within(0.04, 0.06);
      expect(late.share[0] + late.share[1], 'late: fewer quiet generations than early').lessThan(early.share[0] + early.share[1]);
    }).timeout(30_000); // ~4 s on a quiet machine — a loaded full suite must not time it out
  });
});
