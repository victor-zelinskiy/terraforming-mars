import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, pressUntil, settle} from './consoleStart';
import {focusParliamentZone, openParliament} from './parliamentDrive';

/**
 * TR73 «ПОЛИТИЧЕСКИЙ СОЮЗ» (Political Alliance:redux) — A NEW KIND OF REQUIREMENT ON A CARD: «the highest number of
 * delegates on 2 resolutions at once» (ties to the earlier first delegate, neutrals never lead) — and the Agenda walk
 * of TR04 as its reward (one step). The contract under test, against a real server, on the TV profile:
 *
 *   A. THE KIND IN THE HAND (`political-alliance-locked` — blue leads Central Power Grid; on Architecture Award red's
 *      delegate came first and blue's second, a tie blue loses; Colonization Funding holds neutrals only): the face's
 *      MIN plate prints TWO delegate figures (a tally, no number), the art is X09's; the blocker chip and the verdict
 *      bar read the two-figure badge and «1/2»; the fullscreen names WHERE — the resolution led, the lost tie
 *      («ничьей мало — первый делегат соперника раньше»), the neutrals-only one. The Parliament marks the slot blue
 *      leads (`--mine`). Blue's free vote on the tied resolution makes it two: the server lifts the refusal and the
 *      chip leaves the hand.
 *   B. THE PLAY (`political-alliance` — blue leads two, one of them against two neutral delegates): the composer
 *      reads the walk «1 → 2», its TR and the coming stage; A is ONE POST; the walk plays inside the hand and the flow
 *      ends on the board; the server agrees (2 M€ paid, the Greens' +2 M€ for the walked TR, the marker on 2, ONE
 *      record); the Parliament still marks both led slots.
 *   C. The same play under REDUCED MOTION — no walk scene is staged — ends on the board with the same server state.
 *
 * Fixtures: tests/e2e/fixtures/generate.ts § TR73. Screenshots under screenshots/political-alliance/.
 */

const CARD = 'Political Alliance:redux';
const PAIR = 'delegate-pair.svg';
const OUT = path.resolve('screenshots', 'political-alliance');
const composer = '.con-composer--play';

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Reason = {message: string, current?: number, leadership?: {leading: Array<{resolution: string}>, trailing: Array<{resolution: string, short: number, tie?: string, leader?: unknown}>}};
type Wire = {
  thisPlayer: {color: string, megacredits: number, terraformRating: number, tableau: Array<{name: string}>};
  cardsInHand?: Array<{name: string, unplayableReasons?: Array<Reason>}>;
  game: {
    parliament: {
      players: Array<{color: string, agenda: number, influence: number}>;
      lastAdvance?: {from: number, to: number, steps: Array<{to: number, bonus?: string}>, reason: string, card?: string};
    };
  };
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

const reasonsOf = (wire: Wire) => wire.cardsInHand?.find((c) => c.name === CARD)?.unplayableReasons ?? [];

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

/** The wheel → the hand (the album stands, nothing in transit). */
async function openHand(page: Page): Promise<void> {
  await press(page, 'Period', 600); // RT → the quick wheel
  await press(page, 'Enter', 1600); // centre slot → the hand
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
}

async function closeHand(page: Page): Promise<void> {
  expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-hand').count() === 0, {tries: 4, settleMs: 1200}), 'the hand closes').toBe(true);
  await settle(page, {timeoutMs: 20_000});
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

async function waitFlowLeft(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    hand: document.querySelectorAll('.con-hand').length,
    parl: document.querySelectorAll('.con-parl').length,
    ws: document.querySelectorAll('.con-ws').length,
  })), {timeout: 60_000, message: 'the finished flow leaves for the board'}).toEqual({hand: 0, parl: 0, ws: 0});
  await settle(page, {timeoutMs: 30_000});
}

/** The hand → the card → its composer → A (one POST) → the walk inside the hand → the board. */
async function playThroughWalk(page: Page, posts: Array<string>, preset: string, shots: boolean, walks = true): Promise<void> {
  await openHand(page);
  expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
  await press(page, 'Enter', 1200);
  await page.locator(composer).waitFor({timeout: 15_000});
  await settle(page);
  await expect(page.locator(composer), 'the CTA is the play\'s own verb — the walk is an outcome').toContainText('Разыграть карту');
  const trackChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--agenda-step')});
  await expect(trackChip, 'the track chip wears the track\'s own unit').toHaveCount(1);
  await expect(trackChip, 'the walk «1 → 2»').toContainText('1');
  await expect(trackChip).toContainText('2');
  await expect(page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--rating')}), 'step ② pays a TR — its own chip').toHaveCount(1);
  await expect(page.locator(composer).getByText('Карьера — маркер пройдёт 1 шаг в Парламенте'), 'the coming stage is named once').toHaveCount(1);
  if (shots) {
    await shoot(page, preset, 'b-composer');
  }
  for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts.length, 'the play is ONE POST').toBe(1);
  expect(posts[0], 'the POST is the card\'s play').toContain(CARD);
  if (walks) {
    await page.locator('.con-hand .con-parl--embedded[data-walk-beat]').waitFor({timeout: 40_000});
  }
  if (shots) {
    await shoot(page, preset, 'b-walk');
  }
  await waitFlowLeft(page);
  expect(posts.length, 'nothing else was sent').toBe(1);
}

async function expectServerAfterPlay(request: APIRequestContext, playerId: string, before: Wire): Promise<Wire> {
  const viewer = before.thisPlayer.color;
  const me = (w: Wire) => w.game.parliament.players.find((p) => p.color === viewer)!;
  const after = await wireOf(request, playerId);
  expect(after.thisPlayer.tableau.map((c) => c.name), 'the event is on the table').toContain(CARD);
  expect(after.thisPlayer.megacredits, 'the card cost 2 M€; the ruling Greens paid 2 M€ for the walked TR').toBe(before.thisPlayer.megacredits - 2 + 2);
  expect(me(after).agenda, 'the marker walked one step').toBe(2);
  expect(after.thisPlayer.terraformRating, 'step ② paid its TR').toBe(before.thisPlayer.terraformRating + 1);
  expect(after.game.parliament.lastAdvance, 'ONE record, the card\'s, with its one step')
    .toMatchObject({from: 1, to: 2, reason: 'card', card: CARD, steps: [{to: 2, bonus: 'tr'}]});
  return after;
}

for (const preset of PRESETS) {
  test.describe(`TR73 Political Alliance:redux · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A — the leadership kind in the hand: two figures on the plate, «[two figures] 1/2», WHERE in the fullscreen; one vote unlocks it (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const pageErrors: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      const playerId = await bootFixture(page, request, 'political-alliance-locked', {query: preset.query});
      const before = await wireOf(request, playerId);
      const [reason] = reasonsOf(before);
      expect(reason, 'the server refuses the play with the NAMED leadership reason').toMatchObject({message: 'Requires leading ${0} resolution(s) at once', current: 1});
      expect(reason.leadership?.leading, 'one resolution led').toHaveLength(1);
      expect(reason.leadership?.trailing.map((r) => [r.short, r.tie ?? '', r.leader === 'neutral' ? 'neutral' : 'seat']).sort(), 'the lost tie and the neutrals-only resolution')
        .toEqual([[1, '', 'neutral'], [1, 'theirs', 'seat']]);

      // ── the face and the chip ──
      await openHand(page);
      const slot = page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).first();
      await expect(slot.locator('[data-req-tally]'), 'the MIN plate prints TWO delegate figures — a tally, no number').toHaveCount(2);
      await expect(slot.locator('.pcard-req--tally .pcard-req__value'), 'no number beside the figures').toHaveCount(0);
      await expect(slot.locator('img[src*="X09"]').first(), 'the classic X09 art').toBeAttached();
      const chip = slot.locator('.con-hand__chip--emblem');
      await expect(chip.locator(`.con-hand__chip-emblem[src*="${PAIR}"]`), 'the chip reads the two-figure badge').toHaveCount(1);
      await expect(chip, 'and the counter').toContainText('1/2');
      expect(await focusCard(page, CARD, 24)).toBeTruthy();
      const bar = page.locator('.con-hand__reason--bar').filter({has: page.locator(`[data-reason-emblem][src*="${PAIR}"]`)});
      await expect(bar, 'the verdict bar speaks the same reading').toContainText('1/2');
      await shoot(page, preset.id, 'a-hand-locked');

      // ── the fullscreen names WHERE ──
      const zoom = page.locator('dialog.con-zoom[open]');
      expect(await pressUntil(page, 'KeyX', async () => await zoom.count() > 0, {tries: 6, settleMs: 1200}), 'the fullscreen viewer opens').toBe(true);
      await settle(page);
      const line = page.locator('.con-zoom-sidecol .con-cardavail--panel .con-cardavail__reason .con-cardavail__text').first();
      await expect(line, 'the rule in its Redux words').toContainText('Требуется лидировать сразу на 2');
      await expect(line, 'the resolution led, by name').toContainText('вы лидируете: «');
      await expect(line, 'the lost tie, read honestly').toContainText('ничьей мало — первый делегат соперника раньше');
      await expect(line, 'how far to lead it (the plural group renders «1 делегата»)').toContainText(/не хватает 1 делегата/);
      await expect(line, 'the neutrals-only resolution').toContainText('только нейтральные делегаты');
      await shoot(page, preset.id, 'a-fullscreen');
      expect(await pressUntil(page, 'Escape', async () => await zoom.count() === 0, {tries: 6, settleMs: 1100}), 'the fullscreen closes').toBe(true);
      await closeHand(page);

      // ── the Parliament marks the slot blue leads; blue's free vote on the tied one ──
      await openParliament(page);
      await expect(page.locator('.con-parl__slot--mine'), 'one slot is blue\'s lead').toHaveCount(1);
      await expect(page.locator('.con-parl__slot--mine[data-party="Industrialists"]')).toHaveCount(1);
      await shoot(page, preset.id, 'a-parliament-one');
      await focusParliamentZone(page, 'voting');
      const onTie = page.locator('.con-parl__slot--focus[data-party="Mars First"]');
      for (let i = 0; i < 6 && await onTie.count() === 0; i++) {
        const dir = await page.evaluate(() => {
          const slots = Array.from(document.querySelectorAll('.con-parl__slot[data-instance]'));
          const at = slots.findIndex((el) => el.classList.contains('con-parl__slot--focus'));
          const to = slots.findIndex((el) => el.getAttribute('data-party') === 'Mars First');
          return to === -1 ? 'none' : (to > at ? 'ArrowRight' : 'ArrowLeft');
        });
        expect(dir, 'Architecture Award stands on the table').not.toBe('none');
        await press(page, dir, 400);
      }
      await expect(onTie, 'the cursor stands on the tied resolution').toHaveCount(1);
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 20_000});
      await press(page, 'Enter', 300);
      await expect(page.locator('.con-parl'), 'the vote\'s flow left').toHaveCount(0, {timeout: 40_000});
      await settle(page, {timeoutMs: 30_000});

      const after = await wireOf(request, playerId);
      expect(reasonsOf(after), 'two led — the server lifts the refusal').toEqual([]);
      await openHand(page);
      await expect(page.locator(`.con-hand [data-zoom-slot="${CARD}"] .con-hand__chip`), 'the chip left the hand').toHaveCount(0);
      await shoot(page, preset.id, 'a-hand-unlocked');
      await closeHand(page);
      await openParliament(page);
      await expect(page.locator('.con-parl__slot--mine'), 'now two slots are blue\'s lead').toHaveCount(2);
      await shoot(page, preset.id, 'a-parliament-two');
      expect(pageErrors, 'no page error').toEqual([]);
    });

    test(`B — the play: the walk «1 → 2» read before the press, one POST, the walk inside the hand, the server agrees (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const posts = watchPosts(page);
      const pageErrors: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      const playerId = await bootFixture(page, request, 'political-alliance', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect(reasonsOf(before), 'the fixture: blue leads two — the card plays').toEqual([]);
      await playThroughWalk(page, posts, preset.id, true);
      await shoot(page, preset.id, 'b-after');
      await expectServerAfterPlay(request, playerId, before);
      await openParliament(page);
      await expect(page.locator('.con-parl__slot--mine'), 'both led slots — one of them against neutral delegates').toHaveCount(2);
      await shoot(page, preset.id, 'b-parliament');
      expect(pageErrors, 'no page error').toEqual([]);
    });

    test(`C — reduced motion: the same play ends on the board with the same server state (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      await page.emulateMedia({reducedMotion: 'reduce'});
      const posts = watchPosts(page);
      const playerId = await bootFixture(page, request, 'political-alliance', {query: preset.query});
      const before = await wireOf(request, playerId);
      // Reduced motion stages no walk (`agendaWalk.seedAgendaWalk` holds nothing): the server walks, the flow ends on the board.
      await playThroughWalk(page, posts, preset.id, false, false);
      await expectServerAfterPlay(request, playerId, before);
    });
  });
}
