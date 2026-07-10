import {expect} from 'chai';
import {
  OVERFLOW_TOLERANCE_PX,
  classifyRootOverflow,
  rankOverflowOffenders,
} from '@/client/console/composables/consoleOverflowGuard';

/**
 * Foundation layer (CONSOLE_FOUNDATION.md §3.4): the PURE measurement model
 * behind the dev-only "no page scrollbars in console-native" diagnostics.
 */
describe('consoleOverflowGuard (foundation, pure model)', () => {
  describe('classifyRootOverflow', () => {
    it('a fitting page reports nothing', () => {
      expect(classifyRootOverflow({scrollW: 1280, clientW: 1280, scrollH: 800, clientH: 800})).to.eq(undefined);
    });

    it('sub-pixel excess is noise, not a bug', () => {
      expect(classifyRootOverflow({scrollW: 1281, clientW: 1280, scrollH: 800, clientH: 800})).to.eq(undefined);
      expect(OVERFLOW_TOLERANCE_PX).to.eq(1);
    });

    it('horizontal overflow is reported per-axis', () => {
      const report = classifyRootOverflow({scrollW: 1315, clientW: 1280, scrollH: 800, clientH: 800});
      expect(report).to.deep.eq({horizontal: 35, vertical: 0});
    });

    it('vertical overflow is reported per-axis', () => {
      const report = classifyRootOverflow({scrollW: 1280, clientW: 1280, scrollH: 1000, clientH: 800});
      expect(report).to.deep.eq({horizontal: 0, vertical: 200});
    });

    it('both axes at once', () => {
      const report = classifyRootOverflow({scrollW: 1300, clientW: 1280, scrollH: 900, clientH: 800});
      expect(report).to.deep.eq({horizontal: 20, vertical: 100});
    });
  });

  describe('rankOverflowOffenders', () => {
    const vw = 1280;
    const vh = 800;

    it('elements poking past the right edge rank by overshoot', () => {
      const offenders = rankOverflowOffenders([
        {label: 'div.small', left: 0, right: 1290, top: 0, bottom: 100},
        {label: 'div.big', left: 0, right: 1400, top: 0, bottom: 100},
        {label: 'div.fits', left: 0, right: 1280, top: 0, bottom: 100},
      ], vw, vh, false);
      expect(offenders.map((o) => o.label)).to.deep.eq(['div.big', 'div.small']);
      expect(offenders[0].overshoot).to.eq(120);
    });

    it('elements starting LEFT of the viewport are offenders too', () => {
      const offenders = rankOverflowOffenders([
        {label: 'div.offleft', left: -40, right: 600, top: 0, bottom: 100},
      ], vw, vh, false);
      expect(offenders).to.have.length(1);
      expect(offenders[0].overshoot).to.eq(40);
    });

    it('vertical overshoot only counts when the root reported vertical overflow', () => {
      const tall = [{label: 'div.tall', left: 0, right: 100, top: 0, bottom: 1200}];
      // A fixed backdrop taller than the viewport is normal — not an offender.
      expect(rankOverflowOffenders(tall, vw, vh, false)).to.have.length(0);
      // But WITH root vertical overflow it names the source.
      const offenders = rankOverflowOffenders(tall, vw, vh, true);
      expect(offenders).to.have.length(1);
      expect(offenders[0].overshoot).to.eq(400);
    });

    it('caps the list at the limit', () => {
      const candidates = Array.from({length: 10}, (_, i) => ({
        label: `div.o${i}`, left: 0, right: 1290 + i, top: 0, bottom: 10,
      }));
      expect(rankOverflowOffenders(candidates, vw, vh, false)).to.have.length(5);
      expect(rankOverflowOffenders(candidates, vw, vh, false, 3)).to.have.length(3);
    });

    it('sub-pixel overshoot is ignored', () => {
      expect(rankOverflowOffenders([
        {label: 'div.hairline', left: 0, right: 1280.9, top: 0, bottom: 10},
      ], vw, vh, false)).to.have.length(0);
    });
  });
});
