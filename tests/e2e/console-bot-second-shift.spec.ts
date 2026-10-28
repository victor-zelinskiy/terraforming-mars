import {Page, expect, test} from './consoleTest';
import {bootSeededGame, openBotScreenHub, press, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * «ВТОРАЯ СМЕНА» is HIDDEN balance (the owner, 2026-10-28; docs/claude/marsbot-second-shift.md):
 * a game created with `automa.secondShift` shows NOTHING of the rule on the bot screen — the decks
 * plate keeps the rulebook's «passes until the next generation», no counter, no cap — because a
 * player who knew the moment and the cap could pass «at the right time» to deny the bot its extra
 * cards. The deck count itself stays the rulebook's (visible, honest). The engine is covered by
 * `tests/automa/SecondShift.spec.ts`; this stand guards that the screen stays quiet when the rule is ON.
 */

const ON = soloGameConfig({automa: {difficulty: 'hard', corporation: 'C01', secondShift: true}});

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

for (const profile of PROFILES) {
  test.describe(`console: «вторая смена» stays hidden on the bot screen (${profile.id})`, () => {
    test.use({viewport: profile.viewport});

    test('ON: the decks plate reads the rulebook\'s pass, names no rule and no count — the hub is the same screen as without it', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootBotHub(page, request, ON, profile.query);
      const decks = page.locator('.con-botscr__plate--decks');
      await expect(decks).toBeVisible();
      await expect(decks.locator('[data-bot-pile="action"]'), 'the deck count stays the rulebook\'s').toBeVisible();
      await expect(decks, 'the rulebook\'s pass, unchanged').toContainText('пасует до следующего');
      await expect(decks, 'the rule is never named here').not.toContainText('Вторая смена');
      const hubText = await page.locator('.con-botscr').innerText();
      expect(hubText, 'no «n/cap» count anywhere on the hub').not.toMatch(/\b\d\/[123]\b/);
    });
  });
}
