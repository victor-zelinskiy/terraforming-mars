import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, createGameWithCards, crumbText, fetchPlayerModel, focusCard, openActionFocus, openCardActions, openConsole, pickCards,
  playQueueCard, press, settle, soloGameConfig, submitSummary, waitQueueIdle, walkFocusUntil, walkToSummary,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P50 «ТОЧНАЯ ОРГАНИЗАЦИЯ» — the first prelude whose PLAY asks the «?» and whose action carries THREE decisions before
 * the press (docs/claude/prompts/prelude2-p50-focused-organization.md, ledger FC):
 *
 *   A (the real start) — A on P50 opens the «РЕСУРС» pre-step beside the card (crumb «… › РЕСУРС»): six lanes, «+1»
 *     each, the card shared; A on steel plays the prelude in ONE POST carrying the addressed `resource` answer — the
 *     live palette never stands; the server: steel +1, one card drawn.
 *   B (`focused-organization-stocked`) — «ДЕЙСТВИЯ КАРТ › ТОЧНАЯ ОРГАНИЗАЦИЯ»: three rows in the executed order —
 *     «ПОТРАТИТЬ ?» (the shared wild step in SPEND mode: plants offered, the five empty lanes SHOWN refused with their
 *     reasons), «СБРОСИТЬ» (the hand album in the discard skin, its filter row standing), «ПОЛУЧИТЬ ?»; A on heat →
 *     ONE POST of three addressed answers (spend · discard · resource) → plants 2 → 1, heat 0 → 1, the hand stays 3,
 *     the discarded card on the pile.
 *   C (`focused-organization-empty-hand`) — the action SHOWN refused «Нет карт на руке».
 *   D (`focused-organization-empty-stock`) — the action SHOWN refused «Нет стандартных ресурсов, чтобы потратить».
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P50. Storyboard: `TM_E2E_STORYBOARD=1` (frames in screenshots/p50/).
 */

const CARD = 'Focused Organization';
const CARD_RU = 'ТОЧНАЯ ОРГАНИЗАЦИЯ';
const OUT = path.resolve('screenshots', 'p50');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const STAGE = '.con-cardactions__stagewrap .con-composer--stage';
const INNER = `${STAGE} [data-wild-inner]`;
const ALBUM = '.con-hand.con-hand--discard';
const THROWN = 'Space Elevator';

type Wire = {
  thisPlayer: {plants: number, heat: number, steel: number, cardsInHandNbr: number, tableau: Array<{name: string}>},
  cardsInHand?: Array<{name: string}>,
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `p50-${name}.png`)});
}

async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, PRESET.id, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
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

/** Walk the composer's cursor onto the row matching `selector` (↓ then ↑ — the list does not wrap). */
async function toRow(page: Page, selector: string): Promise<void> {
  for (let i = 0; i < 12 && await page.locator(`${selector}.con-composer__row--focused`).count() === 0; i++) {
    await press(page, i < 6 ? 'ArrowDown' : 'ArrowUp', 250);
  }
  await expect(page.locator(`${selector}.con-composer__row--focused`), `the cursor stands on ${selector}`).toHaveCount(1);
}

const tileOf = (page: Page) => page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`);

test.describe(`P50 Focused Organization · three decisions, one POST · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('B · spend ? → discard → gain ? — three rows, the spend lanes refused by name, ONE POST of three addressed answers', async ({page, request}) => {
    test.setTimeout(360_000);
    const id = await bootFixture(page, request, 'focused-organization-stocked', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    await openCardActions(page);
    const focusedAction = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
    expect(await walkFocusUntil(page, async () => await focusedAction() === CARD, focusedAction, 30), `never focused «${CARD}»`).toBeTruthy();
    await openActionFocus(page);
    await settle(page);
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {message: 'ДЕЙСТВИЯ КАРТ › ТОЧНАЯ ОРГАНИЗАЦИЯ › …'}).toContain(CARD_RU);
    // Three rows in the executed order: the spend «?», the discard, the gain «?».
    const spendRow = `${STAGE} [data-wild-row][data-wild-row-mode="spend"]`;
    const gainRow = `${STAGE} [data-wild-row][data-wild-row-mode="gain"]`;
    await expect(page.locator(spendRow), 'the spend row').toHaveCount(1);
    await expect(page.locator(gainRow), 'the gain row').toHaveCount(1);
    await shoot(page, 'b-setup');

    // ① ПОТРАТИТЬ — the shared step in SPEND mode.
    await toRow(page, spendRow);
    await press(page, 'Enter', 500);
    await expect(page.locator(INNER), 'the inner step opened').toHaveCount(1);
    await expect(page.locator(`${INNER} [data-lane-mode="spend"]`), 'six spend lanes').toHaveCount(6);
    await expect(page.locator(`${INNER} [data-lane-off]`), 'the five empty lanes SHOWN refused').toHaveCount(5);
    await expect(page.locator(`${INNER} [data-lane-resource="heat"] [data-lane-reason]`), 'a refusal names itself').toHaveText(/тепла/i);
    await expect(page.locator(INNER), 'the cursor opens on plants — the one lane the supply can pay').toHaveAttribute('data-wild-focus-index', '3');
    await press(page, 'ArrowRight', 250);
    await expect(page.locator(INNER), 'the cursor steps OVER a refused lane').toHaveAttribute('data-wild-focus-index', '3');
    await shoot(page, 'b-spend');
    await press(page, 'Enter', 500);
    await expect(page.locator(INNER), 'A chose and left').toHaveCount(0);
    await expect(page.locator(`${spendRow} [data-wild-row-answer="standard"]`), 'the row reads «−1»').toContainText('−1');

    // ② СБРОСИТЬ — the hand album in the discard skin, its filter row standing.
    const discardRow = `${STAGE} .con-composer__row:not([data-wild-row])`;
    await toRow(page, discardRow);
    for (let i = 0; i < 3 && await page.locator(ALBUM).count() === 0; i++) {
      await press(page, 'Enter', 1200);
    }
    await expect(page.locator(ALBUM), 'the album opens in the discard skin').toBeVisible({timeout: 15_000});
    await settle(page);
    await expect(page.locator(`${ALBUM} [data-hand-filters]`), 'the filter row stands in the discard (FD)').toHaveCount(1);
    await shoot(page, 'b-album');
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    expect(await focusCard(page, THROWN, slots * 2 + 6), `focused «${THROWN}»`).toBe(true);
    await press(page, 'Enter', 900);
    await expect(page.locator(`${STAGE}:visible`), 'the composer returns with the answer').toHaveCount(1, {timeout: 15_000});
    await settle(page);

    // ③ ПОЛУЧИТЬ — the gain lanes.
    await toRow(page, gainRow);
    await press(page, 'Enter', 500);
    await expect(page.locator(INNER)).toHaveCount(1);
    await expect(page.locator(`${INNER} [data-lane-off]`), 'every lane may be gained').toHaveCount(0);
    for (let i = 0; i < 4 && (await page.locator(INNER).getAttribute('data-wild-focus-index')) !== '5'; i++) {
      await press(page, i === 0 ? 'ArrowDown' : 'ArrowRight', 250);
    }
    await expect(page.locator(INNER), 'heat').toHaveAttribute('data-wild-focus-index', '5');
    await press(page, 'Enter', 500);
    await expect(page.locator(`${gainRow} [data-wild-row-answer="standard"]`), 'the row reads «+1»').toContainText('+1');
    expect(posts.length, 'nothing sent before the commit').toBe(0);
    await shoot(page, 'b-answered');

    for (let i = 0; i < 8 && await page.locator(`${STAGE} .con-composer__cta--focused`).count() === 0; i++) {
      await press(page, 'ArrowDown', 250);
    }
    await armTransferWitness(page);
    const stop = await storyboard(page, 'action');
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 300);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'ONE POST').toBe(1);
    const body = JSON.parse(posts[0]) as {responses?: Array<{type: string, resource?: string, cards?: Array<string>, for?: {role: string}}>};
    test.info().annotations.push({type: 'action-post', description: posts[0].slice(0, 800)});
    const roles = (body.responses ?? []).map((r) => r.for?.role ?? '').filter((r) => r !== '');
    expect(roles, 'three addressed answers in the executed order').toEqual(expect.arrayContaining(['spend', 'discard', 'resource']));
    expect((body.responses ?? []).find((r) => r.for?.role === 'spend')?.resource, 'the spend answer').toBe('plants');
    expect((body.responses ?? []).find((r) => r.for?.role === 'resource')?.resource, 'the gain answer').toBe('heat');
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.heat, {timeout: 30_000, message: 'the server: heat 0 → 1'}).toBe(1);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    const after = await wireOf(request, id);
    expect(after.thisPlayer.plants, 'plants 2 → 1').toBe(before.thisPlayer.plants - 1);
    expect(after.thisPlayer.cardsInHandNbr, 'discard 1, draw 1').toBe(before.thisPlayer.cardsInHandNbr);
    expect(after.cardsInHand?.some((c) => c.name === THROWN), 'the thrown card left the hand').toBe(false);
    const witness = await transferWitness(page);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, PRESET.id, 'action-trail.txt'), transferTrail(witness) + '\n');
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    expect(posts.length, 'still ONE POST').toBe(1);
    await shoot(page, 'b-after');
  });

  for (const [fixture, reason] of [['focused-organization-empty-hand', /нет карт/i], ['focused-organization-empty-stock', /нет стандартных ресурсов/i]] as const) {
    test(`${fixture === 'focused-organization-empty-hand' ? 'C' : 'D'} · the action SHOWN refused with its reason (${fixture})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixture(page, request, fixture, {query: PRESET.query});
      await settle(page);
      await openCardActions(page);
      await expect(tileOf(page), 'the tile stands').toHaveCount(1);
      await expect(page.locator('.con-cardactions'), 'the reason is said').toContainText(reason);
      await shoot(page, fixture);
    });
  }

  test('A · the start queue: the «РЕСУРС» pre-step beside the card, steel in ONE POST — no live palette ever', async ({page, request}) => {
    test.setTimeout(420_000);
    const corp = 'Teractor';
    const preludes = [CARD, 'Donation'];
    const id = await createGameWithCards(request, [], {config: soloGameConfig({
      expansions: {prelude: true, prelude2: true, promo: true},
      startingCorporations: 1,
      customCorporationsList: [corp],
      customPreludes: [CARD, 'Donation', 'Supplier', 'Loan'],
    })});
    await openConsole(page, id, PRESET.query);
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          await pickCards(p, [corp]);
        } else if (kind === 'prelude') {
          expect(await pickCards(p, preludes), 'both preludes picked').toEqual(expect.arrayContaining(preludes));
        }
      },
    });
    await submitSummary(page);
    await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 30_000});
    expect(await playQueueCard(page, corp), 'the corporation played').toBe(true);
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    const focused = () => page.evaluate(() => document.querySelector('.con-start__qcard--focused')?.getAttribute('data-queue-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === CARD, focused, 12), 'P50 focused').toBeTruthy();
    const posts = watchPosts(page);
    await page.evaluate(() => {
      const w = window as unknown as {__p50Palette: number};
      w.__p50Palette = 0;
      new MutationObserver(() => {
        if (document.querySelector('.con-task__palette') !== null) {
          w.__p50Palette++;
        }
      }).observe(document.body, {subtree: true, childList: true});
    });
    await press(page, 'Enter', 500);
    await expect(page.locator('[data-start-variant] [data-prelude-variant-row]'), 'six resource rows').toHaveCount(6, {timeout: 10_000});
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {message: 'the crumb: … › the card › РЕСУРС'})
      .toMatch(new RegExp(`${CARD_RU}.*РЕСУРС`));
    await shoot(page, 'a-step');
    // B — back to the queue, nothing sent.
    await press(page, 'Escape', 400);
    await expect(page.locator('[data-start-variant]')).toHaveCount(0, {timeout: 5_000});
    expect(posts.length, 'B sent nothing').toBe(0);
    const stop = await storyboard(page, 'start');
    await press(page, 'Enter', 500);
    await expect(page.locator('[data-start-variant]')).toHaveCount(1, {timeout: 10_000});
    await press(page, 'ArrowDown', 250); // M€ → steel
    await expect(page.locator('[data-start-variant] .con-vchoice__opt--focused')).toHaveAttribute('data-prelude-variant-row', '1');
    await press(page, 'Enter', 400);
    await expect.poll(() => posts.length, {timeout: 15_000}).toBeGreaterThan(0);
    expect(posts.length, 'ONE POST').toBe(1);
    expect(posts[0], 'the batch carries the addressed resource').toMatch(/"type":"resource","resource":"steel"/);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.steel, {timeout: 30_000, message: 'the server: steel +1'}).toBe(before.thisPlayer.steel + 1);
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    await shoot(page, 'a-after');
    const palette = await page.evaluate(() => (window as unknown as {__p50Palette: number}).__p50Palette);
    expect(palette, 'the live palette never stood').toBe(0);
    expect((await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === CARD), 'P50 on the table').toBe(true);
  });
});
