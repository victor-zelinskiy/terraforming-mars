import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, createGameWithCards, fetchPlayerModel, openActionFocus, openCardActions, openConsole, pickCards, playQueueCard, press,
  sendPlayerInput, settle, soloGameConfig, submitSummary, waitQueueIdle, walkFocusUntil, walkToSummary,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * TRP8 «AEROSPACE COMPANY» — the second PRELUDE of Turmoil Redux and the first one with an ACTION: no play effect,
 * Space + Building; «Action: add 1 mech or fighter resource to ANY card» — ONE pick over the union of the mech and
 * fighter holders, the kind of the unit the kind of the chosen card. Against a real server, on the TV:
 *
 *   (A) THE START (`aerospace-start`, the real UI start — TRP1's precedent): the Prelude in the queue wears no «СГОРИТ»
 *       and no warning; A → no question, the card lands on «РАЗЫГРАНО»; the server reads it in the tableau, unused.
 *   (B) THE ACTION (`aerospace`): «Действия карт» → the Prelude's tile → A → «КУДА» over FOUR candidates of two kinds,
 *       every one wearing its outcome tag; Mars Army Ships → A → ONE POST → a fighter on Mars Army Ships, the mechs
 *       untouched, the action used, every flight end visible.
 *   (C) NO HOLDER (`aerospace-none`): the tile STANDS, disabled with its reason — never hidden.
 *   (D) THE FAMILY (`aerospace-family`): «КУДА» over EIGHT — four mechs, four fighters — every candidate whole.
 *
 * The rules (the union, the title, the preview, the reason) are the unit spec's
 * (`tests/cards/turmoilRedux/AerospaceCompany.spec.ts`); this asserts the journey.
 */

const CARD = 'Aerospace Company';
const OUT = path.resolve('screenshots', 'aerospace', process.env.TM_E2E_SHOTS_TAG ?? '');
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type Wire = {
  thisPlayer: {
    actionsThisGeneration: Array<string>,
    tableau: Array<{name: string, resources?: number}>,
  },
  waitingFor?: {type?: string, coloniesModel?: Array<{name: string}>},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const countOn = (wire: Wire, card: string) => wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? -1;
const text = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

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

/** «Действия карт»: walk the grid until the focused tile is the Prelude's (one variant) — a snake over the rows. */
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

/** The composer's «КУДА» row → the embedded target step. */
async function openTargetStep(page: Page): Promise<void> {
  const row = () => text(page, `${ACTION_COMPOSER} .con-composer__row--focused`);
  for (const key of ['ArrowDown', 'ArrowUp']) {
    for (let i = 0; i < 6 && !/Куда/.test(await row()); i++) {
      await press(page, key, 220);
    }
  }
  expect(await row(), 'the cursor reached «КУДА»').toMatch(/Куда/);
  const step = page.locator('.con-ptsel');
  for (let i = 0; i < 3 && await step.count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(step, 'the target step opened').toBeVisible();
  await settle(page);
}

/** Every candidate's outcome tag, in cell order (`data-ptsel-tag` — the role's tone, never `none`). */
const candidateTags = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll('.con-ptsel__cell')).map((cell) => ({
  card: cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '',
  tag: cell.querySelector('[data-ptsel-tag]')?.getAttribute('data-ptsel-tag') ?? 'missing',
  text: (cell.querySelector('.con-ptsel__tag')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
})));

/** Every candidate stands whole inside every box that clips it (the Veynon D probe). */
const clippedCells = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll('.con-ptsel__cell')).flatMap((cell) => {
  const c = cell.getBoundingClientRect();
  const out: Array<string> = [];
  for (let el = cell.parentElement; el !== null && !el.classList.contains('con-ws'); el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const b = el.getBoundingClientRect();
      if (c.left < b.left - 1 || c.right > b.right + 1 || c.top < b.top - 1 || c.bottom > b.bottom + 1) {
        out.push(`${Math.round(c.left)}–${Math.round(c.right)} ⊄ ${el.className.toString().slice(0, 40)} ${Math.round(b.left)}–${Math.round(b.right)}`);
      }
    }
  }
  return out;
}));

test.describe(`console · TRP8 Aerospace Company · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A — the start: no «СГОРИТ», no question, the Prelude lands on «РАЗЫГРАНО» unused', async ({page, request}) => {
    test.setTimeout(360_000);
    const corp = 'Teractor';
    const playerId = await createGameWithCards(request, [], {config: soloGameConfig({
      expansions: {colonies: true, turmoilRedux: true, prelude: true},
      startingCorporations: 1,
      customCorporationsList: [corp],
      customPreludes: [CARD, 'Mohole', 'Business Empire', 'Loan'],
    })});
    // THE REAL START (TRP1's precedent): seeded over the API the workspace leaves with the last prompt and hosts nothing.
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
    await shoot(page, 'a1-queue');

    expect(await playQueueCard(page, CARD), 'the Prelude was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau.some((c) => c.name === CARD),
      {timeout: 40_000, message: 'the Prelude is on the table'}).toBe(true);
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 30_000});
    const wire = await wireOf(request, playerId);
    expect(wire.thisPlayer.actionsThisGeneration, 'the play used no action').not.toContain(CARD);
    await expect(page.locator(`[data-played-key="${CARD}"]`).first(), 'the card stands on «РАЗЫГРАНО»').toBeAttached({timeout: 20_000});
    expect(await page.locator('.con-ptsel').count(), 'nothing was asked').toBe(0);
    await shoot(page, 'a2-played-shelf');
  });

  test('B — the action: «КУДА» over four holders of two kinds, a fighter onto Mars Army Ships, ONE POST', async ({page, request}) => {
    test.setTimeout(420_000);
    const posts = watchPosts(page);
    const {playerId} = await bootFixtureSeats(page, request, 'aerospace', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, playerId);
    expect(['EVA Mechs', 'Mars Army Ships', 'Forestry Mechs', 'Security Fleet'].map((c) => countOn(before, c)), 'the fixture').toEqual([2, 1, 1, 0]);

    await openCardActions(page);
    const tile = page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`);
    await expect(tile, 'the Prelude\'s action is a tile of «Действия карт»').toHaveCount(1);
    await focusPreludeTile(page);
    await shoot(page, 'b1-tile');
    await openActionFocus(page);
    await settle(page);
    await shoot(page, 'b2-focus');

    await openTargetStep(page);
    await expect(page.locator('.con-ptsel__cell'), 'FOUR candidates — the mech and fighter holders').toHaveCount(4);
    const tags = await candidateTags(page);
    expect(tags.map((t) => t.card).sort(), 'the union, each once').toEqual(['EVA Mechs', 'Forestry Mechs', 'Mars Army Ships', 'Security Fleet']);
    expect(tags.filter((t) => t.tag === 'missing' || t.tag === 'none'), `every candidate wears its outcome tag — ${JSON.stringify(tags)}`).toEqual([]);
    expect(await clippedCells(page), 'every candidate stands whole').toEqual([]);
    await shoot(page, 'b3-where-four');
    expect(posts, 'nothing sent before the commit').toEqual([]);

    const at = () => page.evaluate(() => document.querySelector('.con-ptsel__cell[data-focused="1"] [data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');
    for (let i = 0; i < 6 && await at() !== 'Mars Army Ships'; i++) {
      await press(page, 'ArrowRight', 350);
    }
    for (let i = 0; i < 6 && await at() !== 'Mars Army Ships'; i++) {
      await press(page, 'ArrowLeft', 350);
    }
    expect(await at(), 'the cursor reached Mars Army Ships').toBe('Mars Army Ships');
    const step = page.locator('.con-ptsel');
    for (let i = 0; i < 4 && await step.count() > 0; i++) {
      await press(page, 'Enter', 1200);
    }
    await expect(step, 'A on the candidate answers the target').toHaveCount(0, {timeout: 8000});
    await settle(page);
    expect(posts, 'the target is a pre-select — nothing sent').toEqual([]);
    await shoot(page, 'b4-answered');

    await armTransferWitness(page);
    for (let i = 0; i < 10 && await page.locator(`${ACTION_COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
      await press(page, 'ArrowDown', 250);
    }
    for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 400);
      await expect.poll(() => posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the action is ONE request').toBe(1);
    await expect.poll(async () => countOn(await wireOf(request, playerId), 'Mars Army Ships'), {timeout: 30_000, message: 'the fighter landed'}).toBe(2);
    await expect.poll(() => page.locator('.con-ws').count(), {timeout: 60_000, message: 'the workspace left'}).toBe(0);
    await settle(page, {timeoutMs: 40_000});
    const witness = await transferWitness(page);
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'b-trail.txt'), transferTrail(witness));
    await shoot(page, 'b5-board');
    const after = await wireOf(request, playerId);
    expect(['EVA Mechs', 'Mars Army Ships', 'Forestry Mechs', 'Security Fleet'].map((c) => countOn(after, c)), 'only Mars Army Ships moved').toEqual([2, 2, 1, 0]);
    expect(after.thisPlayer.actionsThisGeneration, 'the action is used').toContain(CARD);
    expect(posts.length, 'and only one').toBe(1);
    expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
  });

  test('C — no holder: the tile STANDS, disabled with its reason', async ({page, request}) => {
    test.setTimeout(300_000);
    await bootFixtureSeats(page, request, 'aerospace-none', {query: PRESET.query});
    await settle(page);
    await openCardActions(page);
    // The default filter shows the actions the player can still take — a blocked one is read in «all».
    const tile = page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`);
    for (let i = 0; i < 4 && await tile.count() === 0; i++) {
      await press(page, 'BracketLeft', 600);
    }
    await expect(tile, 'the Prelude\'s tile stands').toHaveCount(1);
    const verdict = await tile.getAttribute('data-action-verdict');
    expect(verdict, 'not available').not.toBe('available');
    await shoot(page, 'c-tile-disabled');
  });

  test('D — the family: «КУДА» over EIGHT — four mechs, four fighters — every candidate whole', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootFixtureSeats(page, request, 'aerospace-family', {query: PRESET.query});
    await settle(page);
    await openCardActions(page);
    await focusPreludeTile(page);
    await openActionFocus(page);
    await settle(page);
    await openTargetStep(page);
    await expect(page.locator('.con-ptsel__cell'), 'EIGHT candidates of two kinds').toHaveCount(8);
    await shoot(page, 'd-where-eight');
    expect(await clippedCells(page), 'every candidate stands whole inside the boxes that clip it').toEqual([]);
    const tags = await candidateTags(page);
    expect(tags.filter((t) => t.tag === 'missing'), `every candidate reserves its tag row — ${JSON.stringify(tags)}`).toEqual([]);
  });
});
