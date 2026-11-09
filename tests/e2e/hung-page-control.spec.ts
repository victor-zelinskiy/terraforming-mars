import {test, expect} from './consoleTest';

/**
 * POSITIVE CONTROL of the harness's `hungPageWatch` (`hungPageWatch.ts`): a page whose main thread spins in a named
 * function for longer than the watch's threshold must be PAUSED from outside and its stack filed as a `hung-page`
 * annotation naming that function — the diagnosis CI's 300 s `console-parliament-climate` timeout never had. A watch
 * that silently stopped working would leave the next hang as opaque as that one.
 */
test('a hung main thread is paused from outside and its stack is filed', async ({page}, testInfo) => {
  test.setTimeout(60_000);
  await page.setContent('<html><body>control</body></html>');
  await page.evaluate(() => {
    const w = window as unknown as {hungPageControlSpin: (until: number) => number};
    w.hungPageControlSpin = function hungPageControlSpin(until: number): number {
      let turns = 0;
      while (Date.now() < until) {
        turns++; // the hang under test
      }
      return turns;
    };
    window.setTimeout(() => w.hungPageControlSpin(Date.now() + 16_000), 50);
  });
  await expect.poll(() => testInfo.annotations.filter((a) => a.type === 'hung-page').length,
    {timeout: 40_000, intervals: [500], message: 'the watch filed the hung page'}).toBeGreaterThan(0);
  const filed = testInfo.annotations.find((a) => a.type === 'hung-page')?.description ?? '';
  expect(filed, `the filed stack names the spinning function:\n${filed}`).toMatch(/hungPageControlSpin/);
  // the thread comes back: the page answers again once the spin is over
  await expect.poll(() => page.evaluate(() => 1), {timeout: 30_000}).toBe(1);
});
