import {expect} from 'chai';
import {
  READING_SCALE_CHOICES, applyConsoleReadingScale, readingScaleState, setConsoleReadingScale,
} from '@/client/console/consoleReadingScale';

/**
 * The reading-text scale bridge (couch-typography iteration): a personal
 * magnifier for LONG-FORM text only, published as `--con-read-scale` on
 * `<html>`. The reading surfaces multiply their font-size tokens by it;
 * chrome never consumes it.
 */
describe('consoleReadingScale', () => {
  // Module state is bundle-shared across specs — restore the default.
  afterEach(() => {
    setConsoleReadingScale(100);
  });

  it('offers exactly the 100/115/130 ring, defaulting to 100', () => {
    expect([...READING_SCALE_CHOICES]).to.deep.eq([100, 115, 130]);
    expect(readingScaleState.scale).to.eq(100);
  });

  it('publishes the scale as a unit factor on <html>', () => {
    setConsoleReadingScale(130);
    expect(document.documentElement.style.getPropertyValue('--con-read-scale')).to.eq('1.3');
    setConsoleReadingScale(115);
    expect(document.documentElement.style.getPropertyValue('--con-read-scale')).to.eq('1.15');
    setConsoleReadingScale(100);
    expect(document.documentElement.style.getPropertyValue('--con-read-scale')).to.eq('1');
  });

  it('re-applying without a change is idempotent', () => {
    setConsoleReadingScale(115);
    applyConsoleReadingScale();
    expect(document.documentElement.style.getPropertyValue('--con-read-scale')).to.eq('1.15');
    expect(readingScaleState.scale).to.eq(115);
  });
});
