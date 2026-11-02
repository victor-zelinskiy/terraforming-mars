import {test, expect, Page} from './consoleTest';
import {bootFixture, placeTile, playCardFromHand, settle} from './consoleStart';

/**
 * THE DECISION THAT BLINKED (the owner, 2026-11-01): «когда игрок получает модалку на поле — промт "Энергоконсультанты
 * Нептуна" после того, как он сам разместил океан — и в этот момент срабатывает эффект (партия Зелёных за РТ), на время
 * анимации срабатывания модалка исчезает и после анимации опять появляется: мигание, дешёвое впечатление».
 *
 * One response carries the ocean's landing, the rating it pays, the ruling Greens' answer to that rating (a card
 * reaction at the rail's edge) AND the optional decision Neptunian Power Consultants asks. The contract, from the
 * player's eye: the decision comes to the screen ONCE — after the table's answer has played (the attention is never
 * split between a question and a story still telling the cause) — and, once there, it is never taken away until it is
 * answered. The probe samples the prompt surface's paint every 50 ms from before the play, with the named holds
 * beside it, so a red says what took the surface down.
 */
const TV = {width: 3840, height: 2160};
const QUERY = '&consoleProfile=tv';
const GREENS = 'Greens';

type Sample = {t: number, surface: boolean, reaction: boolean, holds: Array<string>};

async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__blinkProbe?: Array<unknown>, __blinkTimer?: number,
      __conReady?: () => {holds?: Array<string>}};
    const painted = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].some((el) =>
      el.getClientRects().length > 0 && el.checkVisibility({opacityProperty: true, visibilityProperty: true}));
    const t0 = performance.now();
    w.__blinkProbe = [];
    w.__blinkTimer = window.setInterval(() => {
      w.__blinkProbe!.push({
        t: Math.round(performance.now() - t0),
        surface: painted('.con-decision, .con-task-host'),
        reaction: painted('.con-reaction__face'),
        holds: w.__conReady?.().holds ?? [],
      });
    }, 50);
  });
}

async function readProbe(page: Page): Promise<Array<Sample>> {
  return page.evaluate(() => {
    const w = window as unknown as {__blinkProbe?: Array<Sample>, __blinkTimer?: number};
    window.clearInterval(w.__blinkTimer);
    return w.__blinkProbe ?? [];
  });
}

/** The surface's appearances and disappearances, with what was held at each edge. */
function edges(samples: ReadonlyArray<Sample>): Array<{t: number, to: 'shown' | 'hidden', holds: Array<string>}> {
  const out: Array<{t: number, to: 'shown' | 'hidden', holds: Array<string>}> = [];
  let last = false;
  for (const s of samples) {
    if (s.surface !== last) {
      out.push({t: s.t, to: s.surface ? 'shown' : 'hidden', holds: s.holds});
      last = s.surface;
    }
  }
  return out;
}

test.use({viewport: TV});

test('a decision asked beside the table\'s answer comes ONCE, after the answer, and is never taken away', async ({page, request}) => {
  test.setTimeout(300_000);
  await bootFixture(page, request, 'npc-ocean-greens', {query: QUERY});
  await settle(page, {timeoutMs: 30_000});
  await armProbe(page);
  expect(await playCardFromHand(page, 'Subterranean Reservoir'), 'the reservoir was played').toBeTruthy();
  expect(await placeTile(page), 'the ocean was placed').toBeTruthy();

  // The Greens' charter rises (the table's answer), and the decision stands — read until it has stood 3 s in one piece.
  await page.locator(`.con-reaction__face[data-reaction-card="${GREENS}"]`).waitFor({state: 'visible', timeout: 60_000}).catch(() => undefined);
  await expect.poll(async () => {
    const samples = await page.evaluate(() => (window as unknown as {__blinkProbe?: Array<Sample>}).__blinkProbe ?? []);
    const tail = samples.slice(-60);
    return tail.length === 60 && tail.every((s) => s.surface && !s.reaction);
  }, {timeout: 60_000, message: 'the decision stands, the table\'s answer done'}).toBe(true);

  const samples = await readProbe(page);
  const timeline = edges(samples);
  const reactionAt = samples.filter((s) => s.reaction).map((s) => s.t);
  const firstShown = timeline.find((e) => e.to === 'shown')?.t ?? -1;
  const report = `edges ${JSON.stringify(timeline)} · Greens on stage ${reactionAt.length === 0 ? 'never' : `${reactionAt[0]}…${reactionAt[reactionAt.length - 1]} ms`}`;
  console.log(`[no-blink] ${report}`);
  expect(timeline.filter((e) => e.to === 'hidden'), `the decision never left once it came — ${report}`).toEqual([]);
  if (reactionAt.length > 0) {
    expect(firstShown, `the decision came after the table's answer had played — ${report}`)
      .toBeGreaterThanOrEqual(reactionAt[reactionAt.length - 1]);
  }
});
