import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, crumbText, fetchPlayerModel, focusCard, openCardActions, press, pressUntil, settle, waitForBoardHome, walkFocusUntil,
} from './consoleStart';

/**
 * LIVE EXPERIMENTS (Turmoil Redux, RX36) — the ONE e2e of an action whose
 * result is a whole CARD PLAY: «pay 6 M€ to play a card ignoring all global
 * parameter requirements».
 *
 *   · ONE FLOW. «Действия карт» lists the law with its price; A opens the law's
 *     stage («ДЕЙСТВИЯ КАРТ › ЖИВЫЕ ЭКСПЕРИМЕНТЫ»), whose decision is a SLOT
 *     («КАРТА») under the law's price — empty, the commit dims.
 *   · A CARD FROM THE HAND IS CHOSEN IN THE HAND. A on the slot stands the hand
 *     ALBUM up as a step of the stage, in its PLAY mode over the law's PROMISE:
 *     the card the law opens (Grass at −30 °C) reads «благодаря …», the card
 *     with a PARTY requirement is refused with its reason (the law never
 *     waives a party).
 *   · THE CARD IS COMPOSED ONE LEVEL DEEPER. A on Grass opens the play
 *     composer: its requirement row reads «снято», its payment is the card's;
 *     A there SENDS NOTHING — the composed play lands back in the slot with its
 *     price and the TOTAL «6 + 11».
 *   · ONE COMMIT. A on the law's CTA posts one batch; the server pays 6 + 11
 *     (20 → 3), Grass stands on the table, the law's use is spent, the journal
 *     names the waiver («… thanks to …»), and the tile reads «Активирована».
 *
 * Fixture `parliament-live-enacted`. Screens under screenshots/parliament-live/.
 */
const OUT = path.resolve('screenshots', 'parliament-live');
const LAW = 'RDX_SCIENTISTS_LIVE_EXPERIMENTS';
const OPENED = 'Grass';
const ANYWAY = 'Adapted Lichen';
const PARTY = 'Martian Media Center';
const STAGE = '.con-pact--resolution';

const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {megacredits: number, tableau: ReadonlyArray<{name: string}>},
  cardsInHand?: ReadonlyArray<{name: string}>,
  game: {parliament?: {
    enacted?: {resolution: string},
    viewer?: {resolutionAction?: {resolution: string, usesLeft: number, available: boolean, play?: {reserve: number, billAsks: boolean}}},
  }},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
async function storyboard(page: Page, preset: string, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, preset, `story-${name}`);
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

/** Poll the SERVER until `ok` holds — never a fixed sleep. */
async function untilServer(request: APIRequestContext, playerId: string, ok: (m: Wire) => boolean, what: string): Promise<Wire> {
  let last: Wire | undefined;
  for (let i = 0; i < 160; i++) {
    last = await wireOf(request, playerId);
    if (ok(last)) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`the server never reached: ${what} (last: M€ ${last?.thisPlayer.megacredits}, uses ${last?.game.parliament?.viewer?.resolutionAction?.usesLeft})`);
}

/** In «ДЕЙСТВИЯ КАРТ»: steer the cursor onto the LAW's tile (geometry-steered, the focused tile as the witness). */
async function focusLawTile(page: Page): Promise<void> {
  const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-resolution') ?? '');
  await expect(page.locator(`.con-cardactions__tile[data-action-resolution="${LAW}"]`), 'the law\'s tile is in the menu').toHaveCount(1);
  for (let i = 0; i < 16 && await focused() !== LAW; i++) {
    const dir = await page.evaluate((target) => {
      const f = document.querySelector('.con-cardactions__tile--focused')?.getBoundingClientRect();
      const t = document.querySelector(`.con-cardactions__tile[data-action-resolution="${target}"]`)?.getBoundingClientRect();
      if (f === undefined || t === undefined) {
        return 'ArrowRight';
      }
      const dy = (t.top + t.height / 2) - (f.top + f.height / 2);
      const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
      if (Math.abs(dy) > f.height / 2) {
        return dy > 0 ? 'ArrowDown' : 'ArrowUp';
      }
      return dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    }, LAW);
    await press(page, dir, 260);
  }
  if (await focused() !== LAW) {
    await walkFocusUntil(page, async () => await focused() === LAW, focused, 30);
  }
  expect(await focused(), 'never focused the law\'s tile').toBe(LAW);
}

for (const preset of PRESETS) {
  test.describe(`Live Experiments (RX36) · the law plays a card · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test('the slot → the album over the law\'s promise → the composer → the slot filled with the TOTAL → ONE commit → the card on the table', async ({page, request}) => {
      test.setTimeout(420_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-live-enacted', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect(before.game.parliament?.enacted?.resolution, 'the law stands enacted').toBe(LAW);
      expect(before.game.parliament?.viewer?.resolutionAction, 'the server offers the action and PROMISES the pick')
        .toMatchObject({resolution: LAW, usesLeft: 1, available: true, play: {reserve: 6, billAsks: false}});
      expect(before.thisPlayer.megacredits).toBe(20);

      // ── ① «ДЕЙСТВИЯ КАРТ» — the law's tile with its price.
      await waitForBoardHome(page, 40);
      await settle(page, {timeoutMs: 20_000});
      await openCardActions(page);
      await focusLawTile(page);
      await settle(page, {timeoutMs: 10_000});
      await shoot(page, preset.id, '01-card-actions-law-tile');

      // ── ② THE LAW'S STAGE: the price, the SLOT empty, the commit dim.
      expect(await pressUntil(page, 'Enter', async () => await page.locator(STAGE).count() > 0, {tries: 3, settleMs: 1100}),
        'A opens the law\'s stage').toBeTruthy();
      const slot = page.locator(`${STAGE} [data-pact-play-slot]`);
      await expect(slot, 'the decision is a SLOT').toHaveCount(1, {timeout: 20_000});
      await expect(page.locator(`${STAGE} [data-pact-price]`), 'the law\'s price reads always').toBeVisible();
      await expect(page.locator(`${STAGE} .con-pact__repeatslot-empty`), 'empty, it invites').toBeVisible();
      await settle(page, {timeoutMs: 15_000});
      const crumb = (await crumbText(page)).toUpperCase();
      expect(crumb, `one crumb: the menu, the law (${crumb})`).toContain('ДЕЙСТВИЯ КАРТ');
      expect(crumb).toContain('ЖИВЫЕ ЭКСПЕРИМЕНТЫ');
      expect(await page.locator('[data-pact-cta][data-pact-ready]').count(), 'an empty slot arms nothing').toBe(0);
      await shoot(page, preset.id, '02-law-stage-empty-slot');

      // ── ③ A ON THE SLOT: the ALBUM stands up as a step of the stage, over the law's PROMISE.
      expect(await pressUntil(page, 'Enter', async () => await page.locator(`${STAGE} .con-hand`).count() > 0, {tries: 4, settleMs: 1200}),
        'A on the slot stands the album up inside the stage').toBeTruthy();
      await settle(page, {timeoutMs: 20_000});
      await expect(page.locator(`.con-hand__slot--playable[data-zoom-slot="${OPENED}"]`), 'the card the law opens is PLAYABLE in the album').toHaveCount(1);
      await expect(page.locator(`.con-hand__slot--playable[data-zoom-slot="${ANYWAY}"]`), 'the card playable anyway too').toHaveCount(1);
      await expect(page.locator(`.con-hand__slot--unplayable[data-zoom-slot="${PARTY}"]`), 'a PARTY requirement is refused').toHaveCount(1);
      await expect(page.locator(`[data-zoom-slot="${OPENED}"] [data-hand-ease]`), 'the opened card wears the class\'s plate').toHaveCount(1);
      expect(await focusCard(page, OPENED), 'the cursor reaches the card the law opens').toBe(true);
      await expect(page.locator('[data-hand-eased]'), 'the verdict names the law').toContainText(/Живые эксперименты/i);
      const albumCrumb = (await crumbText(page)).toUpperCase();
      expect(albumCrumb, `the crumb only GAINS a tail (${albumCrumb})`).toContain('ЖИВЫЕ ЭКСПЕРИМЕНТЫ');
      await shoot(page, preset.id, '03-album-law-promise');

      // ── ④ A ON THE CARD: the play composer one level deeper — the requirement SNYATO; A there sends nothing.
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play').count() > 0, {tries: 3, settleMs: 1200}),
        'A opens the play composer').toBeTruthy();
      await settle(page, {timeoutMs: 20_000});
      await expect(page.locator('.con-composer--play [data-composer-req][data-req-state="waived"]'), 'the requirement row reads «снято»').toHaveCount(1);
      // …and names the LAW whole (PL-717): a long source wraps onto its own line, never an ellipsis in the row's clip.
      const reqRow = await page.locator('.con-composer--play [data-composer-req]').evaluate((el) => {
        const src = el.querySelector<HTMLElement>('.con-composer__reqrow-src');
        return {row: el.scrollWidth <= el.clientWidth + 1, src: src === null || src.scrollWidth <= src.clientWidth + 1, text: (el.textContent ?? '').trim()};
      });
      expect(reqRow.row && reqRow.src, `the requirement row stands whole (${JSON.stringify(reqRow)})`).toBe(true);
      expect(reqRow.text, 'it names the law').toMatch(/Живые эксперименты/i);
      await shoot(page, preset.id, '04-composer-requirement-waived');
      const sentBefore = (await wireOf(request, playerId)).thisPlayer.megacredits;
      expect(await pressUntil(page, 'Enter', async () => await page.locator('[data-pact-play-name]').count() > 0, {tries: 5, settleMs: 1200}),
        'the composer\'s confirm lands the play back in the slot').toBeTruthy();
      expect((await wireOf(request, playerId)).thisPlayer.megacredits, 'and nothing was sent').toBe(sentBefore);
      await settle(page, {timeoutMs: 20_000});
      await expect(page.locator('[data-pact-play-name]'), 'the slot names the card').toHaveText(/Трава|Grass/i);
      await expect(page.locator('[data-pact-play-eased]'), '«✓ благодаря закону»').toContainText(/Живые эксперименты/i);
      await expect(page.locator('[data-pact-play-total]'), 'the TOTAL: the law\'s 6 and the card\'s 11').toContainText(/6 M€.*11 M€.*17 M€/);
      await expect(page.locator('[data-pact-cta][data-pact-ready]'), 'only now is the commit ready').toHaveCount(1);
      await expect(page.locator('.con-composer--play'), 'the composer has left').toHaveCount(0);
      await shoot(page, preset.id, '05-slot-filled-total');

      // ── ⑤ ONE COMMIT: 20 → 3, Grass on the table, the use spent, the journal names the waiver.
      const stopStory = await storyboard(page, preset.id, 'commit');
      expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, playerId)).game.parliament?.viewer?.resolutionAction?.usesLeft === 0,
        {tries: 3, settleMs: 2500}), 'A on the law\'s CTA commits').toBeTruthy();
      const after = await untilServer(request, playerId, (m) => m.thisPlayer.tableau.some((c) => c.name === OPENED), 'Grass on the table');
      expect(after.thisPlayer.megacredits, '20 − 6 − 11').toBe(3);
      expect((after.cardsInHand ?? []).some((c) => c.name === OPENED), 'Grass left the hand').toBe(false);
      await settle(page, {timeoutMs: 30_000});
      await stopStory();
      await shoot(page, preset.id, '06-after-commit');

      // ── ⑥ THE TILE reads «Активирована»: a spent action leaves the default view; RT shows it, spent.
      expect(after.game.parliament?.viewer?.resolutionAction).toMatchObject({usesLeft: 0, available: false});
      await openCardActions(page);
      await expect(page.locator(`.con-cardactions__tile[data-action-resolution="${LAW}"]`), 'a spent action leaves the default view').toHaveCount(0);
      expect(await pressUntil(page, 'Period', async () => await page.locator(`.con-cardactions__tile--activated[data-action-resolution="${LAW}"]`).count() > 0,
        {tries: 3, settleMs: 700}), 'RT shows the activated actions: the law\'s tile is there, spent').toBeTruthy();
      await settle(page, {timeoutMs: 10_000});
      await shoot(page, preset.id, '07-tile-activated');
    });
  });
}
