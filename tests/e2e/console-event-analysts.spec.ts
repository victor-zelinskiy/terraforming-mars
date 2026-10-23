/*
 * T05 EVENT ANALYSTS («Анализ событий») — «+1 influence», the first card of the premium scope that gives influence
 * BEYOND the Career (ledger CG — «ИТОГОВОЕ ВЛИЯНИЕ ВЕЗДЕ»). The owner's word for the card: the player sees the FINAL
 * influence with its modifier in every place — the Career track included. One reading on the client
 * (`influenceReading.ts`), the number always the server's. FUNCTIONAL class, the TV profile (the card spec's one row):
 *
 *   A · `event-analysts` — the composer reads «[influence] 2 → 3» before the press; A is ONE POST; the server holds the
 *       bonus with its source; the journal names it («+1 влияния — Анализ событий»).
 *   B · `event-analysts-played` — influence 3 = 2 + 1 everywhere: the track's head («ВАШЕ ВЛИЯНИЕ 3 = [нашивка] 2 +1»),
 *       the viewer's span (the ring on level 2, the chip 3 +1), the band on the track (the own stop's LEVEL 2, «Влияние
 *       3 +1»), the Career dossier (blue «3 +1», red without a tab), Information › Парламент (2 + 1 = 3, the source by
 *       name, Biodome Contest's reading on the table: 2 × 3 = 6 plants) and its dossier plate.
 *   C · `event-analysts-played` — Political Recognition walks the Career 3 → 6: the band's step 5 reads «уровень 3 ·
 *       влияние 4 +1»; the server: influence 4.
 *   D · `event-analysts-locked` — the Scientists do not rule, one delegate on their resolution: «✕», «1/2».
 *
 * Frames: `screenshots/t05/card/tv4k/*.png`.
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, focusInfoZone, press, pressUntil, pressUntilVisible, settle} from './consoleStart';
import {focusParliamentZone, openParliament} from './parliamentDrive';

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const T05 = 'Event Analysts';
const WALK = 'Political Recognition';
const OUT = path.resolve('screenshots', 't05', 'card');
const composer = '.con-composer--play';

type Wire = {
  thisPlayer: {color: string, megacredits: number, tableau: Array<{name: string}>},
  game: {parliament: {players: Array<{color: string, agenda: number, influence: number, influenceSources?: Array<{amount: number, source?: string}>}>}},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

function seatOf(wire: Wire, color = wire.thisPlayer.color) {
  return wire.game.parliament.players.find((p) => p.color === color)!;
}

async function shot(page: Page, profile: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, profile), {recursive: true});
  await page.screenshot({path: path.join(OUT, profile, `${name}.png`)});
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

/** RT wheel → the hand, the cursor on `card`. */
async function focusInHand(page: Page, card: string): Promise<void> {
  await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900});
  await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, Math.max(14, slots * 3)), `the cursor stands on ${card}`).toBe(true);
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
}

/** The card's composer (A on the focused hand card). */
async function openComposer(page: Page, card: string): Promise<void> {
  await focusInHand(page, card);
  await pressUntil(page, 'Enter', async () => await page.locator(composer).count() > 0, {settleMs: 1200});
  await settle(page, {timeoutMs: 20_000});
}

/** A: the play's ONE POST (act → verify → retry — the arrival may absorb a press). */
async function pressPlay(page: Page, posts: Array<string>, card: string): Promise<void> {
  for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts.length, 'the play is ONE POST').toBe(1);
  expect(posts[0], 'the POST is the card\'s play').toContain(card);
}

async function waitFlowLeft(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    hand: document.querySelectorAll('.con-hand').length,
    composer: document.querySelectorAll('.con-composer--play').length,
    ws: document.querySelectorAll('.con-ws').length,
  })), {timeout: 60_000, message: 'the finished play leaves for the board'}).toEqual({hand: 0, composer: 0, ws: 0});
  await settle(page, {timeoutMs: 30_000});
}

const text = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

for (const preset of PROFILES) {
  test.describe(`T05 Event Analysts · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A · the composer reads «influence 2 → 3», ONE POST, the journal names the bonus (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const posts = watchPosts(page);
      const {playerId} = await bootFixtureSeats(page, request, 'event-analysts', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect(seatOf(before).influence, 'the fixture: influence 2 on the track alone').toBe(2);
      await focusInHand(page, T05);
      const slot = page.locator(`.con-hand__slot[data-zoom-slot="${T05}"]`);
      expect(await slot.locator('img').evaluateAll((imgs) => imgs.some((i) => (i as HTMLImageElement).src.includes('T05'))), 'the face wears the T05 art').toBe(true);
      await shot(page, preset.id, 'A-hand');
      await pressUntil(page, 'Enter', async () => await page.locator(composer).count() > 0, {settleMs: 1200});
      await settle(page, {timeoutMs: 20_000});
      const chip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--influence')}).first();
      await expect(chip, 'the composer carries the influence chip').toBeVisible({timeout: 10_000});
      expect(text(await chip.textContent()), 'the chip reads the seat\'s final influence 2 → 3').toMatch(/2\D+3/);
      await shot(page, preset.id, 'A-composer');

      await pressPlay(page, posts, T05);
      await waitFlowLeft(page);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'T05 is on the table').toContain(T05);
      expect(seatOf(after).influence, 'the server: influence 3').toBe(3);
      expect(seatOf(after).influenceSources, 'the bonus keeps its giver').toEqual([{amount: 1, source: T05}]);
      expect(posts.length, 'nothing else was sent').toBe(1);
      await shot(page, preset.id, 'A-played');

      // (б) the journal names the bonus — the giver and the whole influence before → after.
      await pressUntilVisible(page, 'KeyR', '.con-journal', {settleMs: 1200});
      await settle(page, {timeoutMs: 15_000});
      await expect(page.locator('.con-journal'), 'the journal line «+1 влияния — Анализ событий»').toContainText(/\+1 влияния/, {timeout: 10_000});
      await expect(page.locator('.con-journal')).toContainText('Анализ событий');
      await shot(page, preset.id, 'A-journal');
    });

    test(`B · influence 3 = 2 + 1 on the track, the band, the dossier and Information (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'event-analysts-played', {query: preset.query});
      const wire = await wireOf(request, playerId);
      const me = seatOf(wire);
      const rival = wire.game.parliament.players.find((p) => p.color !== me.color && p.influence !== undefined)!;
      expect([me.agenda, me.influence], 'the fixture: step 3, influence 3').toEqual([3, 3]);

      await openParliament(page);
      // The track's head: «ВАШЕ ВЛИЯНИЕ [inf] 3 = [insignia] 2 +1».
      const head = page.locator('[data-parl-influence-head]');
      await expect(head.locator('[data-parl-influence]')).toHaveText('3');
      await expect(head.locator('[data-parl-influence-track]')).toHaveText('2');
      await expect(head.locator('[data-parl-influence-sum] [data-inf-mod]')).toHaveText('+1');
      await expect(head.locator('[data-inf-mod]').first(), 'the tab names its giver').toHaveAttribute('data-hint', /Анализ событий/);
      await expect(head, 'the head says what the number is').toContainText(/Ваше влияние/i);
      // The viewer's span: the ring on LEVEL 2, the chip prints 3 with the tab; the other spans their levels.
      const mine = page.locator('.con-parl__inf-band--mine');
      await expect(mine).toHaveAttribute('data-parl-inf-band', '2');
      await expect(mine.locator('[data-parl-inf-band-value]')).toHaveText('3');
      await expect(mine.locator('[data-inf-mod]')).toHaveText('+1');
      const otherSpans = await page.locator('.con-parl__inf-band:not(.con-parl__inf-band--mine)').evaluateAll((els) =>
        els.map((el) => [el.getAttribute('data-parl-inf-band'), el.querySelector('[data-parl-inf-band-value]')?.textContent?.trim(), el.querySelector('[data-inf-mod]') !== null]));
      for (const [level, value, mod] of otherSpans) {
        expect([value, mod], `a span of another level names its level (${level})`).toEqual([level, false]);
      }
      await shot(page, preset.id, 'B-track');

      // The band on the track: the own stop's LEVEL 2, the count «Влияние 3 +1».
      await focusParliamentZone(page, 'agenda');
      await settle(page, {timeoutMs: 10_000});
      const band = page.locator('.con-parl .con-band').first();
      await expect(band.locator('[data-parl-band-chip="agenda"][data-parl-band-step="3"]'), 'the own stop names its level').toHaveAttribute('data-parl-band-level', '2');
      const count = band.locator('[data-parl-band-chip="count"]').filter({hasText: /Влияние/});
      await expect(count).toContainText('3');
      await expect(count.locator('[data-inf-mod]')).toHaveText('+1');
      await shot(page, preset.id, 'B-band');

      // The Career dossier: blue «3 +1», the rival its number alone.
      expect(await pressUntil(page, 'KeyX', async () => await page.locator('[data-parl-career-dossier]').count() === 1, {tries: 3, settleMs: 700}), 'X opens the career dossier').toBe(true);
      const blue = page.locator(`[data-parl-cd-seat="${me.color}"]`);
      await expect(blue.locator('[data-parl-cd-influence]')).toHaveText('3');
      await expect(blue.locator('[data-inf-mod]')).toHaveText('+1');
      const red = page.locator(`[data-parl-cd-seat="${rival.color}"]`);
      await expect(red.locator('[data-parl-cd-influence]')).toHaveText(String(rival.influence));
      await expect(red.locator('[data-inf-mod]'), 'a seat with no bonus wears no tab').toHaveCount(0);
      await shot(page, preset.id, 'B-dossier');
      expect(await pressUntil(page, 'Escape', async () => await page.locator('[data-parl-career-dossier]').count() === 0, {tries: 3, settleMs: 700}), 'B closes the dossier').toBe(true);
      for (let i = 0; i < 4 && await page.locator('.con-parl').count() > 0; i++) {
        await press(page, 'Escape', 900);
      }
      await settle(page, {timeoutMs: 20_000});

      // Information › Парламент: the zone's plate and the detail — «Карьера 2 + Бонусы 1 = 3», the source, the table.
      expect(await pressUntil(page, 'KeyY', async () => await page.locator('.con-info .con-info__layout').count() > 0, {tries: 4, settleMs: 900}), 'Y opens Information').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      const zone = page.locator('[data-zone="parliament"]');
      await expect(zone.locator('[data-parl-zone-influence]')).toHaveText('3');
      await expect(zone.locator('[data-inf-mod]')).toHaveText('+1');
      expect(await focusInfoZone(page, 'parliament'), 'the ring reaches the parliament zone').toBe(true);
      expect(await pressUntil(page, 'Enter', async () => await page.locator('[data-info-parliament]').count() > 0, {tries: 3, settleMs: 900}), 'A opens the standing').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      const info = page.locator('[data-info-parliament]');
      await expect(info.locator('[data-parl-info-total]')).toHaveText('3');
      await expect(info.locator('[data-parl-info-total] + [data-inf-mod]')).toHaveText('+1');
      const sum = text(await info.locator('[data-parl-info-influence]').textContent());
      expect(sum.match(/\d+/g), `the sum reads 2 + 1 = 3: «${sum}»`).toEqual(['2', '1', '3']);
      await expect(info.locator('[data-parl-info-sources]')).toContainText(/Анализ событий\s*\+1/);
      // (е) the table's reading of a resolution scaled by influence: Biodome Contest, 2 plants × the FINAL 3 = 6.
      const biodome = info.locator('[data-parl-info-row^="RDX_GREENS_BIODOME_CONTEST"] [data-parl-info-reading]');
      await expect(biodome, 'Biodome Contest\'s reading of this seat').toHaveCount(1);
      await expect(biodome, 'the payout reads the final influence: 2 × 3 = 6').toContainText('6');
      await shot(page, preset.id, 'B-info');
    });

    test(`C · a walk 3 → 6 announces «уровень 3 · влияние 4 +1» on step 5 (${preset.id})`, async ({page, request}) => {
      test.setTimeout(360_000);
      const posts = watchPosts(page);
      const {playerId} = await bootFixtureSeats(page, request, 'event-analysts-played', {query: preset.query});
      await openComposer(page, WALK);
      await shot(page, preset.id, 'C-composer');
      await pressPlay(page, posts, WALK);
      // The walk's band grows one chip per landed step; step 5 (an influence step) carries the seat's final influence.
      const step5 = page.locator('.con-hand .con-parl--embedded [data-parl-band-chip="agenda"][data-parl-band-step="5"]');
      await step5.waitFor({timeout: 60_000});
      await expect(step5).toHaveAttribute('data-parl-band-level', '3');
      await expect(step5.locator('[data-parl-band-influence]')).toHaveAttribute('data-parl-band-influence-total', '4');
      await expect(step5.locator('[data-inf-mod]')).toHaveText('+1');
      await shot(page, preset.id, 'C-walk');
      for (let i = 0; i < 6 && await page.locator('.con-reveal').count() > 0; i++) {
        await press(page, 'Enter', 1200);
      }
      await waitFlowLeft(page);
      const after = await wireOf(request, playerId);
      expect([seatOf(after).agenda, seatOf(after).influence], 'the server: step 6, influence 3 + 1 = 4').toEqual([6, 4]);
    });

    test(`D · the Scientists do not rule: «✕» and «1/2» (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'event-analysts-locked', {query: preset.query});
      await focusInHand(page, T05);
      const verdict = page.locator('.con-hand__verdictbar');
      await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
      await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
      await expect(verdict, 'one of your delegates out of two').toContainText('1/2');
      await shot(page, preset.id, 'D-locked');
    });
  });
}
