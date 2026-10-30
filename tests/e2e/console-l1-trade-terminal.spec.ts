import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, fetchPlayerModel, focusCard, press, settle, waitForBoardHome} from './consoleStart';
import {openColoniesSection} from './cardTradeDoor';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P78 «ТОРГОВЫЙ ТЕРМИНАЛ L1» — the FIFTH Prelude 2 card: the first with a PASSIVE TRADE EFFECT and the first MULTI-PICK
 * of PLAYED cards (docs/claude/prompts/prelude2-p78-l1-trade-terminal.md §3). Upstream put the resources on ≤ 3
 * candidates SILENTLY; the fork always asks, and the composer SEEDS every candidate when there are no more of them than
 * seats and each is a gain (ledger CU — T14 widened): shown, marked «ВСЕ ЦЕЛИ», answered by the batch.
 *   (1) `l1-trade-terminal` — three holders (Ants · Birds · Dirigibles, one resource each): the row is SEEDED with all
 *       three, each read `1 → 2` with its own resource; A on the row opens the table's zone with the three ticked, B
 *       keeps the seed; A on the commit → ONE POST carrying the three; the server: +1 on each, the card on the table;
 *   (2) the same turn's second action — «Колонии»: the standing «+2» on the track before any press, X → ONE POST, the
 *       track advanced by two before the income;
 *   (3) `l1-trade-terminal-vermin` — four candidates (Vermin among them, a penalty face) for three seats: the row stays
 *       OPEN, nothing seeded.
 * Fixture: tests/e2e/fixtures/generate.ts § P78 (the dry run proves the play and Luna's reach). Storyboard:
 * `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'L1 Trade Terminal';
const HOLDERS = ['Ants', 'Birds', 'Dirigibles'] as const;
const OUT = path.resolve('screenshots', 'p78');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const PLAY = '.con-composer--play';
const ROW = `${PLAY} .con-composer__row[data-seeded="all"]`;
const ZONE = `${PLAY} .con-ptsel`;

type Wire = {
  cardsInHand?: Array<{name: string}>,
  thisPlayer: {megacredits: number, titanium: number, colonyTradeOffset?: number, tableau: Array<{name: string, resources?: number}>},
  game: {colonies: Array<{name: string, trackPosition: number}>},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const resourcesOf = (wire: Wire, card: string) => wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? -1;

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

type WaveProbe = {names: Array<string>, together: number};
/** THE WAVE (PL-1146): which cards emerged out of the stack, and the most standing out AT ONCE — sampled by a timer
 *  (never rAF: headless drives rAF off the compositor). */
async function armWaveProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const p: WaveProbe = {names: [], together: 0};
    (window as unknown as {__p78wave: WaveProbe}).__p78wave = p;
    window.setInterval(() => {
      const out = Array.from(document.querySelectorAll<HTMLElement>('.con-recv__emerge[data-emerge-name]'))
        .filter((el) => getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0.5);
      for (const el of out) {
        const name = el.getAttribute('data-emerge-name') ?? '';
        if (!p.names.includes(name)) {
          p.names.push(name);
        }
      }
      p.together = Math.max(p.together, out.length);
    }, 30);
  });
}
const readWaveProbe = (page: Page): Promise<WaveProbe> => page.evaluate(() => (window as unknown as {__p78wave: WaveProbe}).__p78wave);

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

/** Hand → A → the play composer standing. */
async function openComposer(page: Page): Promise<void> {
  await focusInHand(page);
  await expect(page.locator('.con-hand__verdictbar'), 'playable').toHaveClass(/con-hand__verdictbar--ok/, {timeout: 10_000});
  await press(page, 'Enter', 1200);
  await page.locator(PLAY).waitFor({timeout: 15_000});
  await settle(page);
}

test.describe(`P78 L1 Trade Terminal · all targets seeded, the standing +2 on the trade · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('(1) the play: the row SEEDED with all three, the zone shows them ticked, ONE POST · (2) the trade: «+2» before the press, ONE POST', async ({page, request}) => {
    test.setTimeout(480_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const id = await bootFixture(page, request, 'l1-trade-terminal', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    const before = await wireOf(request, id);
    expect(HOLDERS.map((h) => resourcesOf(before, h)), 'the fixture: one resource on each holder').toEqual([1, 1, 1]);

    // ── (1) THE PLAY ──
    await openComposer(page);
    const row = page.locator(ROW);
    await expect(row, 'the target row is SEEDED with all its candidates').toHaveCount(1);
    await expect(row.locator('[data-seeded-mark]'), 'and says so — quietly, in words').toHaveText(/все цели/i);
    const targets = row.locator('[data-gain-targets] [data-gain-target]');
    await expect(targets, 'every target named on the row').toHaveCount(3);
    for (const holder of HOLDERS) {
      await expect(row.locator(`[data-gain-target="${holder}"]`), `${holder}: 1 → 2`).toContainText(/1\s*→\s*2/);
    }
    await expect(page.locator(`${PLAY} .con-composer__cta--focused`), 'nothing left to ask: the cursor stands on the commit').toHaveCount(1, {timeout: 10_000});
    expect(posts.length, 'nothing sent before A').toBe(0);
    await shoot(page, 'a-composer-seeded');

    // A on the row opens the zone with the three ticked; B keeps the seed.
    for (let i = 0; i < 6 && await page.locator(`${ROW}.con-composer__row--focused`).count() === 0; i++) {
      await press(page, 'ArrowUp', 300);
    }
    await expect(page.locator(`${ROW}.con-composer__row--focused`), 'the cursor on the seeded row').toHaveCount(1);
    await press(page, 'Enter', 1200);
    await expect(page.locator(ZONE), 'the table zone opens').toHaveCount(1, {timeout: 10_000});
    await settle(page);
    await expect(page.locator(`${ZONE} .con-ptsel__slot--locked`), 'the three seeded cards stand ticked').toHaveCount(3);
    await expect(page.locator(`${ZONE} .con-ptsel__scope-picked`), '«3 of 3»').toContainText('3');
    await shoot(page, 'b-zone-ticked');
    await press(page, 'Escape', 1200);
    await expect(page.locator(ZONE), 'B closes the zone').toHaveCount(0, {timeout: 10_000});
    await expect(page.locator(ROW), 'B keeps the seed').toHaveCount(1);
    expect(posts.length, 'still nothing sent').toBe(0);

    for (let i = 0; i < 6 && await page.locator(`${PLAY} .con-composer__cta--focused`).count() === 0; i++) {
      await press(page, 'ArrowDown', 300);
    }
    await armTransferWitness(page);
    await armWaveProbe(page);
    const stopPlay = await storyboard(page, 'play');
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 300);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the play is ONE POST').toBe(1);
    test.info().annotations.push({type: 'play-post', description: posts[0].slice(0, 800)});
    const body = JSON.parse(posts[0]) as {responses?: Array<{type: string, cards?: Array<string>}>};
    const answer = (body.responses ?? []).find((r) => r.type === 'card' && (r.cards ?? []).length === 3);
    expect(answer?.cards?.slice().sort(), 'the batch carries the three seeded targets').toEqual([...HOLDERS].sort());
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === CARD), {timeout: 30_000, message: 'the card is on the table'}).toBe(true);
    await settle(page, {timeoutMs: 40_000});
    await stopPlay();
    await waitForBoardHome(page, 30);
    const afterPlay = await wireOf(request, id);
    expect(HOLDERS.map((h) => resourcesOf(afterPlay, h)), '+1 on each holder').toEqual([2, 2, 2]);
    expect(afterPlay.thisPlayer.colonyTradeOffset, 'the standing offset').toBe(2);
    const playWitness = await transferWitness(page);
    fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, PRESET.id, 'play-trail.txt'), transferTrail(playWitness) + '\n');
    console.log(`[p78] play trail\n${transferTrail(playWitness)}`);
    expect(endsOverGlass(playWitness), `no end over glass or nothing\n${transferTrail(playWitness)}`).toEqual([]);
    // PL-1146: EVERY fed card is SEEN receiving — the three rise together out of the stack and each takes its own token
    // (`recv:<card>` — the emerged face), one wave, never the stack's front alone.
    const fed = new Set(playWitness.landings.map((l) => l.under).filter((u) => u.startsWith('recv:') && u !== 'recv:front'));
    expect([...fed].sort(), `a token landed on each fed card\n${transferTrail(playWitness)}`).toEqual(HOLDERS.map((h) => `recv:${h}`).sort());
    // …and ONE wave: the three stood out of the stack AT ONCE (never one card after another).
    const wave = await readWaveProbe(page);
    test.info().annotations.push({type: 'wave', description: JSON.stringify(wave)});
    expect(wave.names.slice().sort(), 'every fed card emerged').toEqual([...HOLDERS].sort());
    expect(wave.together, 'the three stood out together — one wave').toBe(3);
    await shoot(page, 'c-played');

    // ── (2) THE TRADE — the same turn's second action ──
    const lunaBefore = afterPlay.game.colonies.find((c) => c.name === 'Luna')?.trackPosition;
    await openColoniesSection(page);
    await press(page, 'Enter', 2000);
    await expect(page.locator('.con-colfocus'), 'the colony focus stage opened').toHaveCount(1, {timeout: 15_000});
    await expect.poll(() => page.evaluate(() => (document.querySelector('[data-colony-track-offset]')?.textContent ?? '').replace(/\s+/g, ' ').trim()),
      {timeout: 10_000, message: 'the standing step is named before any press'}).toMatch(/\+\s*2/);
    expect(posts.length, 'nothing sent to read it').toBe(1);
    await shoot(page, 'd-colony-offset');
    const stopTrade = await storyboard(page, 'trade');
    for (let attempt = 0; attempt < 3 && posts.length === 1; attempt++) {
      await press(page, 'KeyX', 300);
      await expect.poll(() => posts.length, {timeout: 5_000}).toBeGreaterThan(1).catch(() => undefined);
    }
    expect(posts.length, 'the trade is ONE request').toBe(2);
    await expect.poll(() => page.locator('.con-ws').count(), {timeout: 60_000, message: 'the workspace left'}).toBe(0);
    await settle(page, {timeoutMs: 40_000});
    await stopTrade();
    await cinematicBeat(page, 600, 'the board settles for the frame');
    await shoot(page, 'e-traded');
    const afterTrade = await wireOf(request, id);
    test.info().annotations.push({type: 'trade', description: JSON.stringify({
      lunaBefore, colonies: afterTrade.game.colonies, mc: [afterPlay.thisPlayer.megacredits, afterTrade.thisPlayer.megacredits],
      titanium: [afterPlay.thisPlayer.titanium, afterTrade.thisPlayer.titanium],
    })});
    expect(pageErrors, 'no page errors').toEqual([]);
  });

  test('(3) four candidates for three seats (Vermin among them): the row stays OPEN — which ones is a decision', async ({page, request}) => {
    test.setTimeout(300_000);
    await bootFixture(page, request, 'l1-trade-terminal-vermin', {query: PRESET.query});
    await settle(page);
    const posts = watchPosts(page);
    await openComposer(page);
    await expect(page.locator(`${PLAY} [data-seeded]`), 'nothing seeded').toHaveCount(0);
    await expect(page.locator(`${PLAY} .con-composer__row--missing`), 'the target row is an open question').toHaveCount(1);
    await expect(page.locator(`${PLAY} .con-composer__cta--focused`), 'the open question holds the cursor').toHaveCount(0);
    await shoot(page, 'f-vermin-open');
    for (let i = 0; i < 3 && await page.locator(ZONE).count() === 0; i++) {
      await press(page, 'Enter', 1200);
    }
    await expect(page.locator(ZONE), 'A opens the table zone').toHaveCount(1, {timeout: 10_000});
    await settle(page);
    await expect(page.locator(`${ZONE} .con-ptsel__slot[data-zoom-slot]`), 'four candidates').toHaveCount(4);
    await expect(page.locator(`${ZONE} .con-ptsel__slot--locked`), 'none ticked').toHaveCount(0);
    await shoot(page, 'g-vermin-zone');
    expect(posts.length, 'nothing sent').toBe(0);
  });
});
