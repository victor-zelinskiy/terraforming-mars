import {Page, expect, test} from './consoleTest';
import {bootSeededGame, openBotScreenHub, press, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * «ВТОРАЯ СМЕНА» on the bot screen (docs/claude/marsbot-second-shift.md): a game created with
 * `automa.secondShift` tells the rule on the hub's DECKS plate — in the action deck's OWN paragraph
 * (the rulebook's «passes until the next generation» is replaced by the rule with the difficulty's
 * cap, never contradicted beside it) — and counts this generation's extra cards over the cap as a
 * token in the plate's objects row; every plate still holds its content on the TV. A game created
 * WITHOUT the option (every pre-rule config, every other e2e game) shows nothing of it: the engine
 * is off when the option is absent, and the screen never names a rule that cannot fire.
 */

const ON = soloGameConfig({automa: {difficulty: 'hard', corporation: 'C01', secondShift: true}});
const OFF = soloGameConfig({automa: {difficulty: 'hard', corporation: 'C01'}});

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

async function bootBotHub(page: Page, request: Parameters<typeof bootSeededGame>[1], config: unknown, query: string): Promise<void> {
  const created = await request.post('/api/creategame', {data: config});
  expect(created.ok(), 'the server accepted the config').toBeTruthy();
  const {players} = await created.json();
  await bootSeededGame(page, request, players[0].id, {query});
  // Information → the BOT seat (the bot door is the bot seat's own ring stop) → the hub.
  await press(page, 'KeyY', 1200);
  await expect(page.locator('.con-info'), `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
  const botLine = page.locator('.con-info__corp--bot');
  for (let i = 0; i < 4 && await botLine.count() === 0; i++) {
    await press(page, 'KeyE', 900);
  }
  await expect(botLine, 'the bot seat is on stage').toHaveCount(1);
  await openBotScreenHub(page);
}

/** The plates that overflow their own box, by class — the hub's fit walk must leave none. */
async function overflowingPlates(page: Page): Promise<{fit: string | null, overflow: Array<string>}> {
  return page.evaluate(() => ({
    fit: document.querySelector('.con-botscr')?.getAttribute('data-botscr-fit') ?? null,
    overflow: Array.from(document.querySelectorAll<HTMLElement>('.con-botscr__plate'))
      .filter((p) => p.scrollHeight > p.clientHeight + 1)
      .map((p) => `${p.className} (${p.scrollHeight} > ${p.clientHeight})`),
  }));
}

for (const profile of PROFILES) {
  test.describe(`console: «вторая смена» on the bot screen (${profile.id})`, () => {
    test.use({viewport: profile.viewport});

    test('ON: the deck\'s paragraph tells the rule with Hard\'s cap, the counter reads 0 of 2, every plate holds its content', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootBotHub(page, request, ON, profile.query);
      const decks = page.locator('.con-botscr__plate--decks');
      await expect(decks).toBeVisible();
      await expect(decks, 'the action deck\'s own paragraph names the rule').toContainText('вторая смена');
      await expect(decks, 'Hard: two extra cards').toContainText('до двух дополнительных');
      await expect(decks, 'the rulebook\'s pass is not stated beside the rule that replaces it').not.toContainText('пасует до следующего');
      const counter = decks.locator('[data-bot-second-shift]');
      await expect(counter, 'the live counter — none drawn yet, of the cap').toContainText('0/2');
      const {fit, overflow} = await overflowingPlates(page);
      expect(overflow, `every plate holds its content (fit level ${fit})`).toEqual([]);
    });

    test('OFF (the option absent): the rulebook\'s pass, no counter — the decks plate reads as before', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootBotHub(page, request, OFF, profile.query);
      const decks = page.locator('.con-botscr__plate--decks');
      await expect(decks).toBeVisible();
      await expect(decks.locator('[data-bot-pile="action"]')).toBeVisible();
      await expect(decks, 'the rulebook\'s pass').toContainText('пасует до следующего');
      await expect(decks).not.toContainText('вторая смена');
      await expect(decks.locator('[data-bot-second-shift]')).toHaveCount(0);
    });
  });
}
