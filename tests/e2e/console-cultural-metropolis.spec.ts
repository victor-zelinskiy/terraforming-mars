/*
 * T03 · CF — CULTURAL METROPOLIS: TWO DOORS IN ONE PLAY (the stand of «ДВЕ ДВЕРИ ОДНОГО РОЗЫГРЫША»).
 *
 * Cultural Metropolis on a Redux table (Unity rules — fixture `cultural-metropolis`) is the first play with TWO doors:
 * the city's cell (the STAGED door — the play's one reversible step, committed on the board) and THEN «add 2 delegates
 * to one resolution» — a LIVE grant the commit's answer raises, hosted as a STEP of the same flow: the Parliament's vote
 * mode inside the hand's own zone, the crumb «КАРТЫ В РУКЕ › КУЛЬТУРНЫЙ МЕТРОПОЛИС › ГОЛОСОВАНИЕ». Scenes:
 *
 *   A · the composer reads the whole play before the press: the production plate «энергия 1 → 0 · M€ +3», the reserve
 *       chip, the door «Разыграть на поле» and the row «затем: 2 делегата на одну резолюцию — выбор в Парламенте».
 *   B · A → the staged board (the play plate names the card), the cell locked, A — ONE POST (the play + its cell).
 *   C · the city lands; the vote rises as the flow's NEXT step — inside the hand (one Parliament, never a second surface),
 *       its crumb names «ГОЛОСОВАНИЕ», the vote door is the CARD's; B «Свернуть» parks it and A brings the same step back.
 *   D · A on a resolution → both cubes leave the RESERVE (its count falls), the server agrees (2 votes, reserve −2, the
 *       tableau, the production, the city), and the flow ENDS on the board.
 *   E · `cultural-metropolis-locked`: «✕» with Unity's road «1/2»; `cultural-metropolis-reserve`: «✕» and the reserve
 *       counted «Делегатов в резерве: 1 из 2».
 *
 * ONE PROFILE (the owner's 2026-10-21 rule — a card spec runs on the TV). FUNCTIONAL class.
 * Frames: `screenshots/t03/<TM_E2E_SHOTS_TAG | after>/tv4k/card-*.png`.
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, focusedSpaceId, placementState, pressUntil, settle} from './consoleStart';

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const T03 = 'Cultural Metropolis';
const OUT = path.resolve('screenshots', 't03', process.env.TM_E2E_SHOTS_TAG ?? 'after');

type Space = {id: string, tileType?: number, color?: string};
type Wire = {
  game: {spaces: Array<Space>, parliament?: {players: Array<{color: string, reserve: number}>}},
  thisPlayer: {color: string, megacredits: number, energyProduction: number, megacreditProduction: number, tableau?: Array<{name: string}>},
  cardsInHand?: Array<{name: string, calculatedCost?: number}>,
};

async function model(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

/** The viewer's reserve as the server counts it. */
const reserveOf = (wire: Wire): number => wire.game.parliament?.players.find((p) => p.color === wire.thisPlayer.color)?.reserve ?? NaN;

async function shot(page: Page, profile: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, profile), {recursive: true});
  await page.screenshot({path: path.join(OUT, profile, `card-${name}.png`)});
}

const squash = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

/** RT wheel → the hand, the cursor on T03. */
async function focusInHand(page: Page): Promise<void> {
  await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900});
  await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, T03, Math.max(14, slots * 3)), 'the cursor stands on T03').toBe(true);
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
}

async function openComposer(page: Page): Promise<void> {
  await focusInHand(page);
  await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play').count() > 0, {settleMs: 1200});
  await settle(page, {timeoutMs: 20_000});
}

type Story = {
  samples: number;
  /** The hand head's stage words, deduped in order of first appearance. */
  steps: Array<string>;
  /** A `.con-parl` stood OUTSIDE the hand (a second surface) or as a band of its own. */
  parlOutsideHand: boolean;
  /** The vote door values seen. */
  doors: Array<string>;
  /** [ms, value]: the viewer's reserve as the Parliament draws it. */
  reserve: Array<[number, number]>;
  /** Moments (ms) the hand was ABSENT while a vote door stood — the step outside its flow. */
  handGoneUnderVote: number;
  wsMax: number;
  stranded: boolean;
};

/** MutationObserver + setInterval (never rAF): the story of the screen from the cell's commit on. */
async function armStory(page: Page, viewer: string): Promise<void> {
  await page.evaluate((viewer) => {
    const w = window as unknown as {__t03: Story};
    const p: Story = {samples: 0, steps: [], parlOutsideHand: false, doors: [], reserve: [], handGoneUnderVote: 0, wsMax: 0, stranded: false};
    w.__t03 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const sample = () => {
      p.samples++;
      const hand = document.querySelector('.con-hand');
      hand?.querySelectorAll('.con-wshead__step').forEach((el) => {
        const step = text(el);
        if (step !== '' && !p.steps.includes(step)) {
          p.steps.push(step);
        }
      });
      document.querySelectorAll('.con-parl').forEach((el) => {
        if (el.closest('.con-hand') === null || el.classList.contains('con-ws')) {
          p.parlOutsideHand = true;
        }
      });
      const door = document.querySelector('[data-parl-vote-door]')?.getAttribute('data-parl-vote-door');
      if (door !== null && door !== undefined) {
        if (!p.doors.includes(door)) {
          p.doors.push(door);
        }
        if (hand === null) {
          p.handGoneUnderVote++;
        }
      }
      const raw = document.querySelector(`[data-parl-seat-reserve="${viewer}"]`)?.getAttribute('data-count');
      const value = raw === null || raw === undefined ? NaN : Number(raw);
      if (Number.isFinite(value) && p.reserve[p.reserve.length - 1]?.[1] !== value) {
        p.reserve.push([Date.now() - t0, value]);
      }
      p.wsMax = Math.max(p.wsMax, document.querySelectorAll('.con-ws').length);
      p.stranded = p.stranded || document.querySelector('.con-stranded') !== null;
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(sample, 30);
  }, viewer);
}

const readStory = (page: Page): Promise<Story> => page.evaluate(() => (window as unknown as {__t03: Story}).__t03);

for (const preset of PROFILES) {
  test.describe(`T03 Cultural Metropolis · two doors · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A–D · composer → staged cell → the vote inside the hand → the cubes from the reserve → the board (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'cultural-metropolis', {query: preset.query});
      const before = await model(request, playerId);
      const price = before.cardsInHand?.find((c) => c.name === T03)?.calculatedCost ?? 20;

      // ── A · the composer reads the whole play.
      await openComposer(page);
      const composer = page.locator('.con-composer--play');
      const next = squash(await composer.locator('.con-composer__next').allTextContents().then((t) => t.join(' | ')));
      expect(next, `the «next» row names the vote after the play — ${next}`).toMatch(/2 делегата на одну резолюцию после розыгрыша/i);
      await shot(page, preset.id, 'A-composer');

      // ── B · the staged board; the cell locked; ONE POST.
      await pressUntil(page, 'Enter', async () => await page.locator('[data-staged-plate]').count() > 0 ||
        await placementState(page) !== 'none', {tries: 4, settleMs: 1200});
      await expect.poll(() => placementState(page), {timeout: 30_000, message: 'the reticle never aimed'}).toBe('aiming');
      await expect(page.locator('[data-staged-plate]'), 'the play plate names the card').toContainText(/Культурный метрополис/i, {timeout: 15_000});
      await shot(page, preset.id, 'B-staged');
      const cell = await focusedSpaceId(page);
      await pressUntil(page, 'Enter', async () => await placementState(page) === 'locked', {tries: 3, settleMs: 700});
      const bar = squash(await page.locator('.con-cmdbar').first().textContent());
      expect(bar, bar).toMatch(new RegExp(`Разыграть · ${price}`));
      const posts: Array<string> = [];
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push(r.url());
        }
      });
      await armStory(page, before.thisPlayer.color);
      // The commit: a second, separately released press past the dwell — retried only while NOTHING was posted
      // (a retry after the POST would land in the vote that rises next).
      expect(await pressUntil(page, 'Enter', async () => posts.length > 0, {tries: 3, settleMs: 1500}), 'the commit posted').toBe(true);

      // ── C · the city lands; the vote rises as the flow's next step, inside the hand.
      await expect.poll(async () => (await model(request, playerId)).game.spaces.find((s) => s.id === cell)?.color,
        {timeout: 30_000, message: 'the city landed on the locked cell'}).toBe(before.thisPlayer.color);
      expect(posts, 'ONE POST for the play and its cell').toHaveLength(1);
      const vote = '.con-hand .con-parl--embedded [data-parl-vote-door="card"]';
      await page.locator(vote).waitFor({timeout: 45_000}).catch(() => undefined);
      await shot(page, preset.id, 'C-vote');
      const story = await readStory(page);
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/cultural-metropolis-${preset.id}.json`, JSON.stringify(story, null, 1));
      await expect(page.locator(vote), `the vote stands inside the hand — story ${JSON.stringify(story)}`).toHaveCount(1);
      expect(story.parlOutsideHand, 'one Parliament, inside the hand — never a second surface').toBe(false);
      expect(story.steps.map((s) => s.toUpperCase()), 'the crumb names the vote').toContain('ГОЛОСОВАНИЕ');
      // B past the commit is «Свернуть» — a ROUND TRIP: the vote is parked with its flow (never dropped), the board
      // home offers it back, and A restores the SAME step inside the same hand.
      await pressUntil(page, 'Escape', async () => await page.locator('.con-hand').count() === 0, {tries: 3, settleMs: 1200});
      await shot(page, preset.id, 'C-collapsed');
      expect(await pressUntil(page, 'Enter', async () => await page.locator(vote).count() === 1, {tries: 3, settleMs: 1500}),
        'A on the board home restores the vote inside the hand').toBe(true);

      // ── D · A on a resolution → two cubes from the reserve → the flow ends on the board.
      await settle(page, {timeoutMs: 20_000});
      await pressUntil(page, 'Enter', async () => {
        const wire = await model(request, playerId);
        return (wire.thisPlayer.tableau ?? []).some((c) => c.name === T03) && reserveOf(wire) === reserveOf(before) - 2;
      }, {tries: 3, settleMs: 2500});
      const after = await model(request, playerId);
      expect(after.thisPlayer.energyProduction).toBe(before.thisPlayer.energyProduction - 1);
      expect(after.thisPlayer.megacreditProduction).toBe(before.thisPlayer.megacreditProduction + 3);
      await settle(page, {timeoutMs: 30_000});
      const landed = await readStory(page);
      expect(landed.reserve.length, `the reserve count moved on screen — ${JSON.stringify(landed.reserve)}`).toBeGreaterThan(1);
      await expect(page.locator('.con-hand'), 'the flow ends on the board').toHaveCount(0, {timeout: 20_000});
      await expect(page.locator('.con-parl'), 'the Parliament left with the flow').toHaveCount(0, {timeout: 20_000});
      expect(landed.stranded, 'no stranded prompt').toBe(false);
      await shot(page, preset.id, 'D-board');
    });

    test(`E · locked «1/2» and the reserve «1 из 2» (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'cultural-metropolis-locked', {query: preset.query});
      await focusInHand(page);
      const verdict = page.locator('.con-hand__verdictbar');
      await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
      await expect(verdict, 'one of your delegates out of two').toContainText('1/2');
      await shot(page, preset.id, 'E-locked');

      await bootFixtureSeats(page, request, 'cultural-metropolis-reserve', {query: preset.query});
      await focusInHand(page);
      await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
      await expect(page.locator('.con-hand'), 'the reserve is COUNTED').toContainText(/Делегатов в резерве: 1 из 2/i, {timeout: 10_000});
      await shot(page, preset.id, 'E-reserve');
    });
  });
}
