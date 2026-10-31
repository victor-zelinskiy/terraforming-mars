import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, createGameWithCards, fetchPlayerModel, openActionFocus, openCardActions, openConsole, pickCards, playQueueCard, press,
  sendPlayerInput, settle, soloGameConfig, submitSummary, waitQueueIdle, walkFocusUntil, walkToSummary,
} from './consoleStart';

/**
 * TRP0 «CORRIDORS OF POWER» — the Turmoil Redux REPLACEMENT of the classic Prelude 2 P47: a Prelude with an ACTION,
 * Earth; the play +4 M€; «Action: draw 1 card for each RESOLUTION you have at least 2 delegates on» — the Parliament's
 * counted term. Against a real server, on the TV:
 *
 *   (A) THE START (the real UI start — TRP8's precedent): the Prelude in the queue wears no «СГОРИТ», its reading line
 *       says it can be played; A → no question, ONE POST, +4 M€, the card on «РАЗЫГРАНО».
 *   (B) THE ACTION (`corridors-action`: 2 · 2 · 1 of blue's delegates on the three resolutions): «ДЕЙСТВИЯ КАРТ» → the
 *       Prelude's tile → the composer's «РАСЧЁТ» names THREE resolutions (two counted «2/…», one «1/…» not counted);
 *       A → ONE POST → two cards in the hand.
 *   (C) THE EMPTY COUNT (`corridors-futile`): the tile carries the verdict «no effect» with its reason, the action stays
 *       available (A opens the composer).
 *   (D) THE FACE: X on the tile → the fullscreen face with the P47 art and the archive entry.
 *
 * The rules (the count, the basis, the verdict, the registry) are the unit specs' (`CorridorsOfPowerRedux.spec.ts`,
 * `countedPlay.spec.ts`); this asserts the journey.
 */

const CARD = 'Corridors of Power:redux';
const OUT = path.resolve('screenshots', 'p47', process.env.TM_E2E_SHOTS_TAG ?? '');
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type Wire = {
  thisPlayer: {
    megacredits: number,
    cardsInHandNbr: number,
    actionsThisGeneration: Array<string>,
    tableau: Array<{name: string}>,
  },
  waitingFor?: {type?: string, coloniesModel?: Array<{name: string}>},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

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

/** «Действия карт»: walk the grid until the focused tile is the Prelude's — a snake over the rows. */
async function focusPreludeTile(page: Page): Promise<void> {
  const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
  const at = async () => (await focused()) === CARD;
  let vertical: 'ArrowDown' | 'ArrowUp' = 'ArrowDown';
  for (let row = 0; row < 8 && !(await at()); row++) {
    if (await walkFocusUntil(page, at, focused, 8)) {
      break;
    }
    const was = await focused();
    await press(page, vertical, 260);
    if (await focused() === was) {
      vertical = vertical === 'ArrowDown' ? 'ArrowUp' : 'ArrowDown';
      await press(page, vertical, 260);
    }
  }
  expect(await at(), `never focused ${CARD} (at ${await focused()})`).toBe(true);
}

/** The «РАСЧЁТ» strip's resolutions as the composer draws them. */
const countedResolutions = (page: Page) => page.evaluate((sel) => Array.from(document.querySelectorAll(`${sel} [data-count-resolution]`)).map((el) => ({
  party: el.getAttribute('data-count-resolution') ?? '',
  own: Number(el.getAttribute('data-count-resolution-own')),
  counted: el.getAttribute('data-count-resolution-counted'),
})), ACTION_COMPOSER);

test.describe(`console · TRP0 Corridors of Power · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A — the start: no «СГОРИТ», a reading line, no question, +4 M€ and the Prelude on «РАЗЫГРАНО»', async ({page, request}) => {
    test.setTimeout(360_000);
    const posts = watchPosts(page);
    const corp = 'Teractor';
    const playerId = await createGameWithCards(request, [], {config: soloGameConfig({
      expansions: {colonies: true, turmoilRedux: true, prelude: true},
      startingCorporations: 1,
      customCorporationsList: [corp],
      customPreludes: [CARD, 'Mohole', 'Business Empire', 'Loan'],
    })});
    await openConsole(page, playerId, PRESET.query);
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          expect(await pickCards(p, [corp]), 'the corporation was offered and picked').toContain(corp);
        } else if (kind === 'prelude') {
          expect(await pickCards(p, [CARD, 'Mohole']), 'both Preludes were picked').toEqual(expect.arrayContaining([CARD, 'Mohole']));
        }
      },
    });
    await submitSummary(page);
    await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
    await settle(page, {timeoutMs: 30_000});

    expect(await playQueueCard(page, corp), 'the corporation was played from the queue').toBe(true);
    for (let i = 0; i < 20; i++) {
      const wire = await wireOf(request, playerId);
      if (wire.waitingFor?.type === 'colony') {
        await sendPlayerInput(request, playerId, {type: 'colony', colonyName: (wire.waitingFor.coloniesModel ?? [])[0]?.name ?? ''});
        break;
      }
      if (wire.thisPlayer.tableau.some((c) => c.name === corp)) {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 30_000});
    const badges = await page.evaluate(() => Array.from(document.querySelectorAll('.con-cards__pickband')).map((b) => (b.textContent ?? '').trim()));
    expect(badges.filter((b) => /СГОР|НЕ СРАБОТАЕТ|НЕТ ДОСТУПНОЙ ЦЕЛИ/i.test(b)), 'no Prelude of the queue is read as burning').toEqual([]);
    const reading = page.locator(`[data-queue-slot="${CARD}"] [data-qcard-reading]`);
    await expect(reading, 'the Prelude wears its reading line').toHaveCount(1);
    await expect(reading, '…and it says the card can be played').toHaveAttribute('data-qcard-verdict', 'playable');
    await shoot(page, 'a1-queue');

    const mc = (await wireOf(request, playerId)).thisPlayer.megacredits;
    const before = posts.length;
    expect(await playQueueCard(page, CARD), 'the Prelude was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau.some((c) => c.name === CARD),
      {timeout: 40_000, message: 'the Prelude is on the table'}).toBe(true);
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 30_000});
    const wire = await wireOf(request, playerId);
    expect(wire.thisPlayer.megacredits, '+4 M€').toBe(mc + 4);
    expect(posts.length - before, 'the play is ONE request').toBe(1);
    expect(wire.thisPlayer.actionsThisGeneration, 'the play used no action').not.toContain(CARD);
    await expect(page.locator(`[data-played-key="${CARD}"]`).first(), 'the card stands on «РАЗЫГРАНО»').toBeAttached({timeout: 20_000});
    expect(await page.locator('.con-ptsel').count(), 'nothing was asked').toBe(0);
    await shoot(page, 'a2-played-shelf');
  });

  test('B — the action: «РАСЧЁТ» names three resolutions, two counted; ONE POST draws two cards', async ({page, request}) => {
    test.setTimeout(420_000);
    const posts = watchPosts(page);
    const {playerId} = await bootFixtureSeats(page, request, 'corridors-action', {query: PRESET.query});
    await settle(page);
    const hand = (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr;

    await openCardActions(page);
    await expect(page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`), 'the Prelude\'s action is a tile').toHaveCount(1);
    await focusPreludeTile(page);
    await openActionFocus(page);
    await settle(page);
    const rows = await countedResolutions(page);
    expect(rows.map((r) => [r.own, r.counted]), `the three resolutions in the voting area's order — ${JSON.stringify(rows)}`)
      .toEqual([[2, 'yes'], [2, 'yes'], [1, 'no']]);
    await shoot(page, 'b1-composer-count');
    expect(posts, 'nothing sent before the commit').toEqual([]);

    for (let i = 0; i < 10 && await page.locator(`${ACTION_COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
      await press(page, 'ArrowDown', 250);
    }
    for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 400);
      await expect.poll(() => posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the action is ONE request').toBe(1);
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr, {timeout: 30_000, message: 'two cards drawn'}).toBe(hand + 2);
    await shoot(page, 'b2-draw');
    await settle(page, {timeoutMs: 60_000});
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.actionsThisGeneration, 'the action is used').toContain(CARD);
    expect(posts.length, 'and only one').toBe(1);
  });

  test('C — the empty count: the tile says «no effect» with its reason, the action stays available', async ({page, request}) => {
    test.setTimeout(300_000);
    await bootFixtureSeats(page, request, 'corridors-futile', {query: PRESET.query});
    await settle(page);
    await openCardActions(page);
    const tile = page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`);
    await expect(tile, 'the Prelude\'s tile stands').toHaveCount(1);
    await expect(tile, 'the verdict of the empty count').toHaveAttribute('data-action-futile', 'zero-yield');
    await expect(tile.locator('[data-tile-futile]'), '…in words').toContainText('Нет резолюции с 2 вашими делегатами');
    await shoot(page, 'c1-futile-tile');
    await focusPreludeTile(page);
    await openActionFocus(page);
    await settle(page);
    await expect(page.locator(ACTION_COMPOSER), 'the action is available — its composer opens').toHaveCount(1);
    const rows = await countedResolutions(page);
    expect(rows.every((r) => r.counted === 'no'), `no resolution counted — ${JSON.stringify(rows)}`).toBe(true);
    await expect(page.locator(`${ACTION_COMPOSER} [data-count-zero]`), 'the zero in words').toHaveCount(1);
    await shoot(page, 'c2-futile-composer');
  });

  test('D — the face: the P47 art and the archive entry', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'corridors-action', {query: PRESET.query});
    await settle(page);
    await openCardActions(page);
    await focusPreludeTile(page);
    const lore = page.locator('.con-zoom .card-zoom-lore');
    for (let i = 0; i < 5 && await lore.count() === 0; i++) {
      await press(page, 'KeyX', 1500);
    }
    await expect(lore, 'the viewer shows the archive entry').toHaveCount(1, {timeout: 10_000});
    await expect(page.locator('.card-zoom-lore__text')).toContainText('Контроль над потоками информации и денег');
    expect(await page.evaluate(() => document.querySelector('.con-zoom')?.innerHTML.includes('P47') ?? false), 'the P47 art').toBe(true);
    await shoot(page, 'd-face');
  });
});
