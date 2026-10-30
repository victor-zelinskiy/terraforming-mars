import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, settle} from './consoleStart';

/**
 * VIRUS AS ONE ZONE (the owner, 2026-10-30: «в едином премиум-языке»; the bot is one more player at the table). Virus
 * («remove up to 2 animals from ANY card OR up to 5 plants from ANY player») used to answer from a flat list of names.
 * Its target row now opens the SAME embedded zone Ants / Predators open — the animal cards in their owners' groups,
 * every PLAYER target a stand-in tile reading the unit attacked: the bot's ANIMALS (how its engine pays — Miranda, its
 * M€ standing in — is never on the tile), every player's plants. Against a real server, on the TV
 * (`table-target-virus-bot`: blue holds Virus with 3 plants, red Birds 2 + 6 plants, the bot 2 animals on Miranda):
 *
 *   (a) A on the target row opens the ZONE (two groups side by side: red, the bot; the line asks for a TARGET); the bot's tile reads ANIMALS; the d-pad walks
 *       to it; A answers it → the row is answered, the play is ONE POST; red's Birds and plants untouched.
 *
 * The zone's keys and responses are the unit specs' (`tabbedTargetZone.spec.ts`); this asserts the journey.
 */

const VIRUS = 'Virus';
const OUT = path.resolve('screenshots', 'virus-table-zone', process.env.TM_E2E_SHOTS_TAG ?? '');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const PLAY_COMPOSER = '.con-composer--play';
const STEP = `${PLAY_COMPOSER} .con-ptsel`;

type Wire = {
  players: Array<{color: string, isMarsBot?: boolean, plants?: number, tableau: Array<{name: string, resources?: number}>}>,
  cardsInHand?: Array<{name: string}>,
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const resourcesOn = (wire: Wire, card: string) => wire.players.flatMap((p) => p.tableau).find((c) => c.name === card)?.resources ?? -1;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${PRESET.id}-${name}.png`)});
}

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

/** The hand → Virus → its play composer. */
async function openPlayComposer(page: Page): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${VIRUS}"]`).waitFor({timeout: 12_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, VIRUS, slots * 2 + 6), `never focused «${VIRUS}» in the hand`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(PLAY_COMPOSER).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(PLAY_COMPOSER), 'the play composer stands').toHaveCount(1);
  await settle(page);
}

/** A on the target row (the CTA check inside the loop — A on the CTA would PLAY). */
async function openZone(page: Page): Promise<void> {
  const step = page.locator(STEP);
  for (let i = 0; i < 5 && await step.count() === 0; i++) {
    if (await page.locator(`${PLAY_COMPOSER} .con-composer__cta--focused`).count() > 0) {
      await press(page, 'ArrowUp', 700);
    }
    await press(page, 'Enter', 1300);
  }
  await expect(step, 'A on the target row opens the ONE zone — never the list of names').toHaveCount(1, {timeout: 10_000});
  await settle(page);
}

const focusedCell = (page: Page) => page.evaluate((sel) => {
  const cell = document.querySelector(`${sel} .con-ptsel__cell[data-focused="1"]`);
  return {owner: cell?.getAttribute('data-owner') ?? '', stand: cell?.querySelector('[data-ptsel-stand]')?.getAttribute('data-ptsel-stand') ?? ''};
}, STEP);

test.describe(`console · Virus's targets are ONE zone · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('(a) the cards by owner, the players as stand-ins — the bot loses ANIMALS; A on its tile → one POST', async ({page, request}) => {
    test.setTimeout(300_000);
    const playerId = await bootFixture(page, request, 'table-target-virus-bot', {query: PRESET.query});
    const before = await wireOf(request, playerId);
    const bot = before.players.find((p) => p.isMarsBot === true);
    expect(bot, 'the bot sits at the table').toBeDefined();
    await openPlayComposer(page);
    await openZone(page);

    expect(await page.locator(`${PLAY_COMPOSER} .con-composer__sublist`).count(), 'no list of names').toBe(0);
    // Two groups side by side (`split` — the planner's two-group case), every group on screen either way.
    expect(['split', 'board'], 'every group on screen').toContain(await page.locator(STEP).getAttribute('data-mode'));
    await expect(page.locator(`${STEP} .con-ptsel__contract-title`), 'a TARGET, never «a card» — players are targets too')
      .toHaveText('Выберите цель за столом', {ignoreCase: true});
    expect(await page.locator(`${STEP} .con-ptsel__owner`).count(), 'red and the bot — Virus takes from the OTHER players').toBe(2);
    await expect(page.locator(`${STEP} .con-ptsel__slot[data-zoom-slot="Birds"]`), 'red\'s Birds is a card in red\'s group').toHaveCount(1);
    const botAnimals = page.locator(`${STEP} [data-ptsel-stand="animal"]`);
    await expect(botAnimals, 'the bot\'s animals — ONE stand-in tile').toHaveCount(1);
    await expect(botAnimals.locator('[data-ptsel-bot-icon]'), 'the unit attacked, never M€').toHaveAttribute('data-ptsel-bot-icon', 'animal');
    const delta = ((await botAnimals.locator('[data-ptsel-bot-delta]').textContent()) ?? '').match(/(\d+)\s*→\s*(\d+)/);
    expect(delta, 'the tile reads «from → to»').not.toBeNull();
    expect(Number(delta![1]) - Number(delta![2]), 'up to two animals').toBe(2);
    expect(await page.locator(`${STEP} [data-ptsel-stand="plants"]`).count(), 'red\'s plants and the bot\'s stand as tiles').toBe(2);
    await shoot(page, 'a1-one-zone');

    // Group to group, until the cursor stands on the bot's animals: side by side (`split`) the d-pad crosses spatially —
    // the bumpers would only duplicate it there; as bands (`board`) RB jumps band to band.
    const split = await page.locator(STEP).getAttribute('data-mode') === 'split';
    const seen: Array<string> = [];
    for (let i = 0; i < 8 && (await focusedCell(page)).stand !== 'animal'; i++) {
      const at = await focusedCell(page);
      seen.push(`${at.owner}:${at.stand || 'card'}`);
      await press(page, at.owner === bot!.color ? 'ArrowLeft' : (split ? 'ArrowRight' : 'KeyE'), 400);
    }
    expect((await focusedCell(page)).stand, `the cursor reached the bot's animals (walked ${seen.join(' → ')})`).toBe('animal');
    expect((await focusedCell(page)).owner).toBe(bot!.color);
    await shoot(page, 'a2-cursor-on-bot');

    const posts = watchPosts(page);
    for (let i = 0; i < 3 && await page.locator(STEP).count() > 0; i++) {
      await press(page, 'Enter', 1000);
    }
    await expect(page.locator(STEP), 'A on the tile answers the row').toHaveCount(0, {timeout: 8000});
    expect(posts, 'choosing the target sends nothing').toEqual([]);
    await settle(page);
    for (let i = 0; i < 8 && await page.locator(`${PLAY_COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
      await press(page, 'ArrowDown', 250);
    }
    for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 400);
      await expect.poll(() => posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts, 'the play is ONE POST').toHaveLength(1);
    await expect.poll(async () => (await wireOf(request, playerId)).cardsInHand?.some((c) => c.name === VIRUS) ?? true,
      {timeout: 30_000, message: 'Virus was played'}).toBe(false);
    const after = await wireOf(request, playerId);
    expect(resourcesOn(after, 'Birds'), 'red\'s Birds untouched').toBe(2);
    expect(after.players.find((p) => p.color !== bot!.color && p.tableau.some((c) => c.name === 'Birds'))?.plants, 'red\'s plants untouched').toBe(6);
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, 'a3-done');
  });
});
