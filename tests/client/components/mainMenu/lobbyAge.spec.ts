import {expect} from 'chai';
import {lobbyAge, lobbyAgeLabel, lobbyAgeTickMs} from '../../../../src/client/components/mainMenu/lobbyAge';

/**
 * «Мои партии» sorts strictly by creation time, newest first — and says so on
 * every row. These are the rules that label follows.
 */
describe('client/mainMenu/lobbyAge', () => {
  const now = 1_700_000_000_000;
  const at = (msAgo: number) => lobbyAge(now - msAgo, now);

  describe('the unit ladder', () => {
    it('counts SECONDS under a minute', () => {
      expect(at(12_000)).to.deep.eq({unit: 'sec', amount: 12});
      expect(at(59_999)).to.deep.eq({unit: 'sec', amount: 59});
    });

    it('says «just now» for the first few seconds, not a jittery «0 s»', () => {
      expect(at(0).unit).to.eq('now');
      expect(at(4_999).unit).to.eq('now');
      expect(at(5_000).unit).to.eq('sec');
    });

    it('counts MINUTES for the whole hour — the reading the couch cares about', () => {
      expect(at(60_000)).to.deep.eq({unit: 'min', amount: 1});
      expect(at(7 * 60_000)).to.deep.eq({unit: 'min', amount: 7});
      expect(at(59 * 60_000 + 59_000)).to.deep.eq({unit: 'min', amount: 59});
    });

    it('switches to hours and days rather than printing 4320 minutes', () => {
      expect(at(60 * 60_000)).to.deep.eq({unit: 'hour', amount: 1});
      expect(at(23 * 3_600_000)).to.deep.eq({unit: 'hour', amount: 23});
      expect(at(3 * 86_400_000)).to.deep.eq({unit: 'day', amount: 3});
    });

    it('truncates rather than rounds — a row never claims to be older than it is', () => {
      expect(at(119_000)).to.deep.eq({unit: 'min', amount: 1});
    });
  });

  /**
   * ⚠️ A LAN row's `createdTimeMs` is the HOST's clock. Two machines on one
   * couch are routinely seconds — sometimes minutes — apart, so a future
   * timestamp is ordinary input, not a bug to ignore.
   */
  describe('a clock that disagrees', () => {
    it('clamps a future creation time to «just now», never «-3 min ago»', () => {
      expect(lobbyAge(now + 90_000, now)).to.deep.eq({unit: 'now', amount: 0});
    });

    it('survives a missing / broken timestamp', () => {
      expect(lobbyAge(Number.NaN, now).unit).to.eq('now');
    });
  });

  describe('the tick cadence', () => {
    it('ticks every second while it counts seconds', () => {
      expect(lobbyAgeTickMs(at(2_000))).to.eq(1_000);
      expect(lobbyAgeTickMs(at(30_000))).to.eq(1_000);
    });

    it('slows down once the label stops moving every second', () => {
      expect(lobbyAgeTickMs(at(5 * 60_000))).to.eq(15_000);
      expect(lobbyAgeTickMs(at(5 * 3_600_000))).to.eq(60_000);
    });
  });

  describe('the label', () => {
    it('renders the amount it was given', () => {
      // The translation is a fork-owned RU string; what matters here is that
      // the number reaches it and the unit is not dropped.
      expect(lobbyAgeLabel({unit: 'sec', amount: 12})).to.contain('12');
      expect(lobbyAgeLabel({unit: 'min', amount: 7})).to.contain('7');
      expect(lobbyAgeLabel({unit: 'hour', amount: 3})).to.contain('3');
      expect(lobbyAgeLabel({unit: 'day', amount: 2})).to.contain('2');
    });

    it('gives «just now» a word, not a number', () => {
      expect(lobbyAgeLabel({unit: 'now', amount: 0})).to.not.match(/\d/);
    });

    it('tells the units apart', () => {
      const labels = new Set([
        lobbyAgeLabel({unit: 'sec', amount: 5}),
        lobbyAgeLabel({unit: 'min', amount: 5}),
        lobbyAgeLabel({unit: 'hour', amount: 5}),
        lobbyAgeLabel({unit: 'day', amount: 5}),
      ]);
      expect(labels.size).to.eq(4);
    });
  });
});
