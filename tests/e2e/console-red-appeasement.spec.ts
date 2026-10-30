import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, fetchPlayerModel, focusCard, press, settle} from './consoleStart';
import {passAs} from './parliamentDrive';

/**
 * P80 «УМИРОТВОРЕНИЕ КРАСНЫХ» — THE FIRST CARD WHOSE PLAY IS A PASS, and the witness of the class «a play that passes
 * carries the pass reading» (docs/claude/prompts/prelude2-p80-red-appeasement.md, ledger CT):
 *   · the hand names the bespoke half of the requirement — WHO has passed — never the generic «unmet conditions»;
 *   · the face prints the plate's footnote «*»; the verdict of a playable copy says the play counts as a pass;
 *   · the composer says the press gives the turn away: the «ЭТО ПАС» row with the pass confirm's own lines (what the
 *     player leaves unused), the verb «Разыграть и спасовать» on the commit;
 *   · ONE POST; the truth at once — the viewer's seat chip reads PASSED, the off-turn reason says «вы спасовали», never
 *     «не ваш ход»; the workspace leaves;
 *   · the other seat's pass ends the generation: the production paid includes the +2, and the rail's M€ production
 *     reads it BEFORE any screen-taking scene (the sitting / the draft) rises.
 *
 *   1 · `red-appeasement-locked` (red PASSED): the verdict refuses the play and names red; A sends nothing.
 *   2 · `red-appeasement` (the Reds rule, nobody passed; Restricted Area + 8 plants on blue's side): the path above.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § P80 (the dry run there proves the play passes and hands the turn on).
 * Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Red Appeasement';
const OUT = path.resolve('screenshots', 'p80');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-composer--play';
const MC_PROD = '.con-res .con-res__row--megacredits .con-res__prod';

type Wire = {
  generation?: number,
  game?: {generation: number, passedPlayers: Array<string>},
  players: Array<{color: string, name: string}>,
  thisPlayer: {color: string, name: string, megacredits: number, terraformRating: number},
  productionIncome?: {generation: number, income: {megacredits: number}, rating: number},
  cardsInHand?: Array<{name: string}>,
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
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

/** RT → the wheel's centre (the hand) → the card focused. */
async function focusInHand(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `never focused «${CARD}»`).toBe(true);
}

type HandoffProbe = {prodAt: number | undefined, sceneAt: number | undefined, t0: number};

/** When the rail's M€ production first reads `expected`, and when a screen-taking scene first stands (the sitting / the draft). */
async function armHandoffProbe(page: Page, expected: string): Promise<void> {
  await page.evaluate(({sel, want}) => {
    const p: HandoffProbe = {prodAt: undefined, sceneAt: undefined, t0: Date.now()};
    (window as unknown as {__p80: HandoffProbe}).__p80 = p;
    const sample = () => {
      const prod = (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, '');
      if (p.prodAt === undefined && prod.includes(want)) {
        p.prodAt = Date.now() - p.t0;
      }
      if (p.sceneAt === undefined && document.querySelector('.con-parl, .con-draftws') !== null) {
        p.sceneAt = Date.now() - p.t0;
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(sample, 30);
  }, {sel: MC_PROD, want: expected});
}

test.describe(`P80 Red Appeasement · a play that IS a pass · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('1 · another seat has passed: the verdict refuses the play and NAMES that seat; A sends nothing', async ({page, request}) => {
    test.setTimeout(240_000);
    const {playerId} = await bootFixtureSeats(page, request, 'red-appeasement-locked', {query: PRESET.query});
    await settle(page);
    const wire = await wireOf(request, playerId);
    const red = wire.players.find((p) => p.color !== wire.thisPlayer.color);
    expect(red, 'the other seat').toBeDefined();
    const posts = watchPosts(page);
    await focusInHand(page);
    const verdict = page.locator('.con-hand__verdictbar');
    await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
    await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
    await expect(verdict, 'the bespoke half named: who passed').toContainText('Уже спасовали в этом поколении');
    await expect(verdict, 'the seat by its name').toContainText(red!.name);
    await expect(verdict, 'never the generic line').not.toContainText('невыполненных условий');
    test.info().annotations.push({type: 'verdict', description: (await verdict.innerText()).replace(/\s+/g, ' ')});
    await shoot(page, 'a-locked');
    await press(page, 'Enter', 900);
    await cinematicBeat(page, 900, 'a refused A would have posted by now');
    expect(posts, 'a locked card sends nothing').toEqual([]);
  });

  test('2 · the play passes: the composer says so, ONE POST, the truth at once, the generation ends with the +2 paid', async ({page, request}) => {
    test.setTimeout(480_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const {playerId, seats} = await bootFixtureSeats(page, request, 'red-appeasement', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, playerId);
    const prodBefore = Number((await page.locator(MC_PROD).innerText()).replace(/[^\d-]+/g, ''));

    // ── the hand: playable, the verdict says the play passes; the face prints the plate's footnote ──
    await focusInHand(page);
    const verdict = page.locator('.con-hand__verdictbar');
    await expect(verdict, 'the Reds rule, nobody passed: playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});
    await expect(verdict.locator('[data-hand-passes]'), 'the verdict: the play counts as a pass').toContainText('Розыгрыш считается пасом');
    await expect(page.locator(`.con-hand__slot[data-zoom-slot="${CARD}"] [data-req-footnote]`), 'the plate\'s footnote «*»').toHaveCount(1);
    await shoot(page, 'a-open');

    // ── the composer: the production chip, «ЭТО ПАС» with what the pass leaves, the verb ──
    await press(page, 'Enter', 1200);
    await page.locator(COMPOSER).waitFor({timeout: 15_000});
    await settle(page);
    const pass = page.locator(`${COMPOSER} [data-rescat="pass"]`);
    await expect(pass, 'the «this play passes» row').toHaveCount(1);
    await expect(pass, 'its words').toContainText('Этот розыгрыш — пас');
    const lines = pass.locator('[data-pass-line]');
    expect(await lines.count(), 'what the pass leaves: the card action and the plants').toBeGreaterThanOrEqual(2);
    await expect(pass, 'the plants line — the pass confirm\'s own').toContainText(/растени/i);
    const cta = page.locator(`${COMPOSER} .con-composer__cta`);
    await expect(cta, 'the verb names the pass').toContainText('Разыграть и спасовать');
    expect(posts.length, 'nothing sent before A').toBe(0);
    test.info().annotations.push({type: 'pass-row', description: (await pass.innerText()).replace(/\s+/g, ' ')});
    // THE PLATE'S FOOTNOTE on the hero: docked to the party's emblem — beside it, never across the plate.
    const footnote = await page.evaluate((root) => {
      const spark = document.querySelector(`${root} [data-req-footnote]`)?.getBoundingClientRect();
      const socket = document.querySelector(`${root} .pcard-req__socket`)?.getBoundingClientRect();
      return spark === undefined || socket === undefined ? undefined :
        {gap: Math.round(spark.left - socket.right), w: Math.round(spark.width), top: Math.round(spark.top - socket.top)};
    }, COMPOSER);
    test.info().annotations.push({type: 'footnote', description: JSON.stringify(footnote)});
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    await page.locator(`${COMPOSER} .pcard__reqs`).first().screenshot({path: path.join(OUT, PRESET.id, 'b-plate.png')});
    expect(footnote, 'the hero prints the plate\'s footnote').toBeDefined();
    expect(footnote!.w, 'a visible spark').toBeGreaterThan(4);
    expect(Math.abs(footnote!.gap), 'docked to the emblem (px at 4K)').toBeLessThanOrEqual(12);
    await shoot(page, 'b-composer');

    // ── A: ONE POST, the truth at once ──
    const stopStory = await storyboard(page, 'play');
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 300);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the play is ONE POST').toBe(1);
    expect(posts[0], 'the POST is the card\'s play').toContain(CARD);
    await expect(page.locator('.con-status__player--me.con-status__player--passed'), 'the viewer\'s seat chip reads PASSED').toHaveCount(1, {timeout: 15_000});
    await expect(page.locator(MC_PROD), 'the M€ production +2 on the rail').toContainText(String(prodBefore + 2), {timeout: 20_000});
    await expect(page.locator('.con-ws'), 'the workspace leaves').toHaveCount(0, {timeout: 30_000});
    await settle(page, {timeoutMs: 30_000});
    await stopStory();
    await shoot(page, 'c-after-play');
    const afterPlay = await wireOf(request, playerId);
    expect(afterPlay.game?.passedPlayers ?? [], 'the server: the viewer passed').toContain(before.thisPlayer.color);

    // ── the off-turn reason: «you have passed», never «not your turn» ──
    // LT — the BASIC actions wheel: every slot a seat that passed cannot take names why.
    for (let i = 0; i < 4 && await page.locator('.con-quick').count() === 0; i++) {
      await press(page, 'Comma', 700);
    }
    await expect(page.locator('.con-quick'), 'the LT wheel opened').toHaveCount(1, {timeout: 10_000});
    const reasons = page.locator('.con-quick__slot-reason');
    await expect(reasons.filter({hasText: 'Вы спасовали в этом поколении'}).first(), 'the wheel says the viewer passed').toBeVisible({timeout: 10_000});
    expect(await reasons.filter({hasText: 'Сейчас не ваш ход'}).count(), 'never «not your turn» for a seat that passed').toBe(0);
    await shoot(page, 'd-offturn');
    await press(page, 'Escape', 700);
    await settle(page);

    // ── the other seat passes: the generation ends, the +2 is paid, the rail read it before any scene rose ──
    const after = await wireOf(request, playerId);
    const mcBefore = after.thisPlayer.megacredits;
    const expectedProd = String(prodBefore + 2);
    await armHandoffProbe(page, expectedProd);
    const stopEnd = await storyboard(page, 'generation-end');
    await passAs(request, seats[1]);
    await expect.poll(async () => (await wireOf(request, playerId)).productionIncome?.income.megacredits, {timeout: 60_000}).toBeDefined();
    const paid = await wireOf(request, playerId);
    await cinematicBeat(page, 4000, 'the production scene and whatever takes the screen next');
    await stopEnd();
    await shoot(page, 'e-generation-end');
    const probe = await page.evaluate(() => (window as unknown as {__p80: HandoffProbe}).__p80);
    test.info().annotations.push({type: 'handoff', description: JSON.stringify({probe, mc: [mcBefore, paid.thisPlayer.megacredits], income: paid.productionIncome})});
    expect(paid.productionIncome?.income.megacredits, 'the server\'s production record: the M€ production paid, the +2 included').toBe(prodBefore + 2);
    if (probe.sceneAt !== undefined) {
      expect(probe.prodAt, 'the rail read the +2 before a scene took the screen').toBeDefined();
      expect(probe.prodAt!, 'the rail read the +2 before a scene took the screen').toBeLessThanOrEqual(probe.sceneAt);
    }
    expect(pageErrors, 'no page errors').toEqual([]);
  });
});
