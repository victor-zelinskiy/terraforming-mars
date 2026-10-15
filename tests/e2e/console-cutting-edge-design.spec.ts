/*
 * TR49 «НОВАТОРСКАЯ РАЗРАБОТКА» — THE ONE-PLAY CLASS (an effect armed by the card played last, spent by the next card
 * played this generation; `docs/TURMOIL_REDUX_CUTTING_EDGE_DESIGN.md`).
 *
 * The owner's accent: «the player must clearly understand which such effects are active when choosing a card to play,
 * see them in the effects list and inspect them in «Сработает»; a requirement under such an effect must say so EVERYWHERE
 * it is printed». The probe walks the class on every surface the player meets, with the server's numbers:
 *  (A) the journey (fhd + tv4k): TR49's composer names what it ARMS (the result's `armed` section — an event with no
 *      behavior once read «Метки события» alone); the press: the arm token is born on the face's PRINTED plate and lands
 *      on the dock's «⚡» chip (both ends painted — the witness samples the token, never rAF); the hand album's strip, the
 *      lifted requirement on Lake Marineris' cassette (`waived`) and its plate; Lake Marineris' composer: the requirement
 *      row («требование игнорируется»), the «Сработает» modifier chip and its R3 tile; the press: the spend token leaves
 *      the dock chip into the face's cassette, the chip is gone, the server spent it; the SECOND CLIENT reads the armed
 *      effect on the rival's Information zone while it stands;
 *  (B) Special Design armed (fhd): Grass met ONLY thanks to ±2 (`decisive`); Comet spends it FOR NOTHING — the info-tone
 *      consume note, the muted chip;
 *  (C) Indentured Workers armed (fhd): Comet 21 → 13 — the payment head names the one-play discount it spends;
 *  (D) SEVERAL modifiers at once (fhd + tv4k — Inventrix + Adaptation Technology + an armed Special Design, ±6): the
 *      cassette prints the FINAL bound with one coin per source and the total; the composer row names each share; a
 *      requirement met ANYWAY stays printed (quiet) — no seal, no plate, no row.
 * Storyboards of both presses: `TM_E2E_STORYBOARD=1` → `screenshots/cutting-edge-design/<profile>/story-{arm,spend}/`; the 4K
 * claim is taken on the GPU (`TM_E2E_GPU=1`), `--repeat-each=4`.
 */
import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, bootFixture, focusCard, openConsole, placeTile, press, pressUntil, settle, waitForBoardHome} from './consoleStart';

const OUT = path.resolve('screenshots', 'cutting-edge-design');
const CED = 'Cutting-Edge Design';
const LAKE = 'Lake Marineris';
const GRASS = 'Grass';
const COMET = 'Comet';
const ARCHAE = 'ArchaeBacteria';
const COMPOSER = '.con-hand__stage .con-composer--play';
const dockChip = (source: string) => `[data-armed-strip][data-armed-variant="chip"][data-armed-source="${source}"]`;
const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {color: string, armedPlayEffects?: Array<{source: string, effect: {kind: string}}>},
  players: Array<{color: string, armedPlayEffects?: Array<{source: string, effect: {kind: string}}>}>,
  cardsInHand?: Array<{name: string}>,
  waitingFor?: {type: string},
};

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await (await request.get(`/api/player?id=${id}`)).json() as Wire;
}

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

type Box = {x: number, y: number, w: number, h: number};
type TokenTrace = {dir: string, source: string, first?: Box, last?: Box, frames: number};

/**
 * THE TOKEN WITNESS — samples the class's flight layer on a MutationObserver (scoped to the layer) and a 16 ms
 * interval (never rAF: headless rAF stops when the screen goes quiet); a token counts from its first painted frame.
 */
async function armTokenWitness(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = {samples: 0, tokens: {} as Record<string, {dir: string, source: string, first?: object, last?: object, frames: number}>};
    (window as unknown as {__armfly: typeof w}).__armfly = w;
    const sample = () => {
      w.samples++;
      for (const el of document.querySelectorAll<HTMLElement>('.con-armfly__chip')) {
        if (Number(getComputedStyle(el).opacity) < 0.3 || getComputedStyle(el).visibility === 'hidden') {
          continue;
        }
        const r = el.getBoundingClientRect();
        const id = el.dataset.armflyId ?? '?';
        const rec = w.tokens[id] ??= {dir: el.dataset.armflyDirection ?? '', source: el.dataset.armflySource ?? '', frames: 0};
        const box = {x: r.x, y: r.y, w: r.width, h: r.height};
        rec.first ??= box;
        rec.last = box;
        rec.frames++;
      }
    };
    const layer = document.querySelector('[data-armed-flight]');
    if (layer !== null) {
      new MutationObserver(sample).observe(layer, {subtree: true, childList: true, attributes: true});
    }
    window.setInterval(sample, 16);
  });
}

async function tokens(page: Page): Promise<{samples: number, tokens: Array<TokenTrace>}> {
  return await page.evaluate(() => {
    const w = (window as unknown as {__armfly: {samples: number, tokens: Record<string, TokenTrace>}}).__armfly;
    return {samples: w.samples, tokens: Object.values(w.tokens)};
  });
}

async function boxOf(page: Page, selector: string): Promise<Box | undefined> {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el === null) {
      return undefined;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 ? {x: r.x, y: r.y, w: r.width, h: r.height} : undefined;
  }, selector);
}

function centreInside(token: Box, host: Box, slack: number): boolean {
  const cx = token.x + token.w / 2;
  const cy = token.y + token.h / 2;
  return cx >= host.x - slack && cx <= host.x + host.w + slack && cy >= host.y - slack && cy <= host.y + host.h + slack;
}

/** RT → «КАРТЫ»: the hand album, settled. */
async function openHand(page: Page, first: string): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${first}"]`).waitFor({timeout: 15_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
}

/** The hand album → `card` → A: its play composer, nothing sent. */
async function openComposer(page: Page, card: string): Promise<void> {
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `the cursor reached ${card} in the hand`).toBe(true);
  expect(await pressUntil(page, 'Enter', async () => await page.locator(COMPOSER).count() > 0, {tries: 3, settleMs: 900}),
    `A opens ${card}'s play composer`).toBe(true);
  await settle(page);
}

/** From the composer's open state to its commit rail, then A — the play's ONE POST. */
async function commit(page: Page): Promise<void> {
  for (let i = 0; i < 8 && await page.locator('.con-composer__cta--focused').count() === 0; i++) {
    await press(page, 'ArrowDown', 300);
  }
  await expect(page.locator('.con-composer__cta--focused'), 'the cursor stands on «Разыграть карту»').toHaveCount(1);
  await page.keyboard.press('Enter');
}

/** The second client: Information (Y), walked to the blue seat, reads the armed line of its «ЭФФЕКТЫ» zone. */
async function rivalSeesArmed(page: Page): Promise<boolean> {
  expect(await pressUntil(page, 'KeyY', async () => await page.locator('.con-info .con-info__layout').count() > 0, {tries: 4, settleMs: 900}),
    'the rival opens Information').toBe(true);
  await settle(page, {timeoutMs: 15_000});
  for (let i = 0; i < 4; i++) {
    if (await page.locator('[data-zone="effects"] [data-armed-zone]').count() > 0) {
      return true;
    }
    await press(page, 'KeyE', 700);
  }
  return false;
}

test.describe('TR49 — the one-play class', () => {
  test.setTimeout(300_000);

  for (const preset of PRESETS) {
    test(`(A) the journey: arm → the hand reads it everywhere → spend · ${preset.id}`, async ({page, request, browser}) => {
      await page.setViewportSize(preset.viewport);
      const {playerId: id, seats} = await bootFixtureSeats(page, request, 'cutting-edge-design', {query: preset.query});
      await expect(page.locator('[data-armed-strip]'), 'nothing armed — no strip, no chip').toHaveCount(0);

      // ── TR49's composer names what it ARMS.
      await openHand(page, CED);
      await expect(page.locator(`.con-hand__slot[data-zoom-slot="${LAKE}"] [data-req-state="printed"]`), 'nothing bends Lake Marineris yet — its cassette is printed').toHaveCount(1);
      await openComposer(page, CED);
      const arms = page.locator(`${COMPOSER} [data-composer-arms]`);
      await expect(arms, 'the result names what the play arms').toHaveCount(1);
      await expect(arms).toContainText('Требования глобальных параметров игнорируются');
      await expect(arms.locator('[data-armed-kind="requirementWaiver"]')).toHaveCount(1);
      await shoot(page, preset.id, '01-tr49-composer-arms');

      // ── The press: the arm token leaves the face's printed plate and lands on the dock's chip.
      const card = await boxOf(page, `${COMPOSER} .con-composer__playcard`);
      expect(card, 'the played card stands in its composer').toBeDefined();
      await armTokenWitness(page);
      const stopArm = await storyboard(page, preset.id, 'arm');
      await commit(page);
      await expect(page.locator(`${dockChip(CED)}:not(.con-armed--arriving)`), 'the dock wears «⚡ ТРЕБ.»').toHaveCount(1, {timeout: 30_000});
      await stopArm();
      await waitForBoardHome(page, 25);
      const armTrace = await tokens(page);
      expect(armTrace.samples, 'the witness sampled').toBeGreaterThan(20);
      const trail = await page.locator('[data-armed-flight]').getAttribute('data-armed-flight-trail') ?? '';
      expect(trail, 'the arm token landed (the trail names any degradation)').toContain('arm:landed');
      const arm = armTrace.tokens.find((t) => t.dir === 'arm');
      expect(arm, `an arm token was painted (${JSON.stringify(armTrace.tokens)})`).toBeDefined();
      expect(centreInside(arm!.first!, card!, 8), `born ON the standing card (${JSON.stringify(arm!.first)} in ${JSON.stringify(card)})`).toBe(true);
      const chipBox = await boxOf(page, dockChip(CED));
      expect(chipBox, 'the dock chip is on screen').toBeDefined();
      expect(centreInside(arm!.last!, chipBox!, 24), `landed ON the dock chip (${JSON.stringify(arm!.last)} on ${JSON.stringify(chipBox)})`).toBe(true);
      const armed = await wireOf(request, id);
      expect(armed.thisPlayer.armedPlayEffects?.map((e) => `${e.source}:${e.effect.kind}`), 'the server armed the waiver').toEqual([`${CED}:requirementWaiver`]);
      await shoot(page, preset.id, '02-dock-armed');

      // ── The SECOND CLIENT: the armed effect is public — the rival reads it on blue's «ЭФФЕКТЫ» zone.
      const rival = await browser.newContext({viewport: preset.viewport});
      try {
        const page2 = await rival.newPage();
        await openConsole(page2, seats[1], preset.query);
        await waitForBoardHome(page2, 25);
        const theirs = (await wireOf(request, seats[1])).players.find((p) => p.color === armed.thisPlayer.color);
        expect(theirs?.armedPlayEffects?.map((e) => e.source), 'the rival\'s model carries blue\'s armed effect').toEqual([CED]);
        expect(await rivalSeesArmed(page2), 'the rival reads «Взведено на следующую карту» on blue\'s effects zone').toBe(true);
        await shoot(page2, preset.id, '03-rival-info-armed');
      } finally {
        await rival.close();
      }

      // ── The hand reads it everywhere: the strip, Lake Marineris' lifted cassette and its plate.
      await openHand(page, LAKE);
      await expect(page.locator('.con-hand__armed[data-armed-strip][data-armed-variant="strip"]'), 'the album head carries the strip').toHaveCount(1);
      await expect(page.locator(`.con-hand__slot[data-zoom-slot="${LAKE}"] [data-req-state="waived"]`).first(), 'the cassette is lifted').toBeVisible();
      await expect(page.locator(`.con-hand__slot[data-zoom-slot="${LAKE}"] [data-hand-ease]`), 'the tile\'s plate names the modifier').toHaveCount(1);
      await shoot(page, preset.id, '04-hand-lifted');

      // ── Lake Marineris' composer: the requirement row, the «Сработает» chip, its R3 tile.
      await openComposer(page, LAKE);
      const req = page.locator(`${COMPOSER} [data-composer-req]`);
      await expect(req).toHaveAttribute('data-req-state', 'waived');
      await expect(req).toContainText('требование игнорируется');
      await expect(req).toContainText('Новаторская разработка');
      await expect(page.locator(`${COMPOSER} [data-forecast-chip="modifier"]`), 'the «Сработает» row leads with the modifier').toHaveCount(1);
      await shoot(page, preset.id, '05-lake-composer');
      expect(await pressUntil(page, 'KeyV', async () => await page.locator('[data-forecast-modifier="used"]').count() > 0, {tries: 3, settleMs: 900}),
        'R3 opens the layer — the modifier\'s tile: spent by this play').toBe(true);
      await shoot(page, preset.id, '06-lake-r3-modifier');
      expect(await pressUntil(page, 'Escape', async () => await page.locator('[data-forecast-modifier]').count() === 0, {tries: 3, settleMs: 900}),
        'B gives the composer back').toBe(true);
      await settle(page);

      // ── The press — a STAGED play (Lake Marineris places its oceans before the one POST): the landing ritual draws the
      //    armed effect out of the dock into the card's cassette (the server's forecast — the answer is not known yet),
      //    the chip stays gone on the board, and the POST after the second ocean spends it on the server.
      const lakeCard = await boxOf(page, `${COMPOSER} .con-composer__playcard`);
      const dockBefore = await boxOf(page, dockChip(CED));
      await armTokenWitness(page);
      const stopSpend = await storyboard(page, preset.id, 'spend');
      await commit(page);
      await expect.poll(async () => await page.locator('[data-armed-flight]').getAttribute('data-armed-flight-trail') ?? '', {timeout: 30_000})
        .toContain('spend:landed');
      await page.locator('.con-context__task-kicker').waitFor({timeout: 30_000});
      await stopSpend();
      await expect(page.locator(dockChip(CED)), 'the chip is gone from the ritual on').toHaveCount(0, {timeout: 30_000});
      const spendTrace = await tokens(page);
      const spend = spendTrace.tokens.find((t) => t.dir === 'spend');
      expect((await wireOf(request, id)).thisPlayer.armedPlayEffects?.length, 'nothing posted yet — the board decides first').toBe(1);
      await shoot(page, preset.id, '07-board-chip-gone');
      await page.locator('.con-context__task-kicker').waitFor({timeout: 30_000});
      expect(await placeTile(page), 'the first ocean').toBe(true);
      await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
      await page.locator('.con-context__task-kicker').waitFor({timeout: 30_000});
      expect(await placeTile(page), 'the second ocean — the play\'s one POST').toBe(true);
      await expect.poll(async () => (await wireOf(request, id)).thisPlayer.armedPlayEffects?.length ?? 0, {timeout: 30_000}).toBe(0);
      await waitForBoardHome(page, 25);
      await expect(page.locator(dockChip(CED)), 'the chip stays gone — the view now says it').toHaveCount(0);
      expect(spend, `a spend token was painted (${JSON.stringify(spendTrace.tokens)})`).toBeDefined();
      if (dockBefore !== undefined) {
        expect(centreInside(spend!.first!, dockBefore, 24), `born ON the dock chip (${JSON.stringify(spend!.first)} on ${JSON.stringify(dockBefore)})`).toBe(true);
      }
      expect(centreInside(spend!.last!, lakeCard!, 8), `absorbed INTO the played card (${JSON.stringify(spend!.last)} in ${JSON.stringify(lakeCard)})`).toBe(true);
      await shoot(page, preset.id, '08-after-spend');
    });
  }

  test('(B) Special Design armed: Grass met only thanks to ±2; Comet spends it for nothing', async ({page, request}) => {
    await page.setViewportSize(PRESETS[0].viewport);
    await bootFixture(page, request, 'special-design-armed', {query: PRESETS[0].query});
    await expect(page.locator(dockChip('Special Design')), 'the dock wears «⚡ ±2»').toHaveCount(1);
    await openHand(page, GRASS);
    await expect(page.locator(`.con-hand__slot[data-zoom-slot="${GRASS}"] [data-req-decisive]`).first(), 'Grass\'s cassette: met THANKS TO the modifier').toBeVisible();
    await openComposer(page, GRASS);
    await expect(page.locator(`${COMPOSER} [data-composer-req]`)).toHaveAttribute('data-req-state', 'decisive');
    await expect(page.locator(`${COMPOSER} [data-composer-req]`)).toContainText('Особая разработка');
    await expect(page.locator(`${COMPOSER} [data-composer-consume]`), 'a USED effect needs no consume note').toHaveCount(0);
    await shoot(page, 'fhd', 'B1-grass-decisive');
    await press(page, 'Escape', 900);
    await settle(page);
    await openComposer(page, COMET);
    const consume = page.locator(`${COMPOSER} [data-composer-consume]`);
    await expect(consume, 'Comet spends the ±2 for nothing — said, in the info tone').toHaveCount(1);
    await expect(consume).toContainText('впустую');
    await expect(consume).toHaveClass(/con-composer__warn--info/);
    await expect(page.locator(`${COMPOSER} .con-forecast__chip--modifier.con-forecast__chip--unused`), 'the muted chip').toHaveCount(1);
    await shoot(page, 'fhd', 'B2-comet-wasted');
  });

  test('(C) Indentured Workers armed: the payment head names the one-play discount', async ({page, request}) => {
    await page.setViewportSize(PRESETS[0].viewport);
    await bootFixture(page, request, 'indentured-workers-armed', {query: PRESETS[0].query});
    await openHand(page, COMET);
    await openComposer(page, COMET);
    await expect(page.locator(`${COMPOSER} [data-pay-saved]`)).toHaveText('−8');
    await expect(page.locator(`${COMPOSER} [data-pay-armed]`), 'the head names whose discount the play spends').toContainText('Законтрактованные рабочие');
    await shoot(page, 'fhd', 'C1-comet-discount');
  });

  for (const preset of PRESETS) {
    test(`(D) several modifiers at once: the FINAL bound, one coin per source, met-anyway stays quiet · ${preset.id}`, async ({page, request}) => {
      await page.setViewportSize(preset.viewport);
      await bootFixture(page, request, 'standing-modifiers', {query: preset.query});
      await openHand(page, GRASS);
      const slot = (name: string) => `.con-hand__slot[data-zoom-slot="${name}"]`;

      // ── Grass (≥ −16 at −20 °C): met ONLY thanks to Inventrix + Adaptation Technology + the armed Special Design. The
      //    cassette prints the FINAL bound, the seal three coins (the armed one wears the ⚡ pip) and the TOTAL ±6.
      const grassMod = page.locator(`${slot(GRASS)} [data-req-state="eased"] [data-req-mod]`).first();
      await expect(grassMod, 'Grass\'s cassette carries the modifier seal').toBeVisible();
      await expect(grassMod).toHaveAttribute('data-req-mod-steps', '6');
      await expect(grassMod.locator('[data-req-coins="3"]'), 'one coin per source').toHaveCount(1);
      await expect(grassMod.locator('.pcard-mod--once'), 'the armed source wears the one-play pip').toHaveCount(1);
      await expect(page.locator(`${slot(GRASS)} [data-req-decisive]`).first(), 'met THANKS TO the modifiers').toBeVisible();
      const seal = await page.evaluate((sel) => {
        const mods = document.querySelector(sel);
        const face = mods?.closest('.pcard');
        if (mods === null || mods === undefined || face === null || face === undefined) {
          return undefined;
        }
        const coins = [...mods.querySelectorAll<HTMLElement>('[data-req-coin]')];
        const r = mods.getBoundingClientRect();
        const f = face.getBoundingClientRect();
        return {
          art: coins.filter((c) => getComputedStyle(c).backgroundImage.includes('card-images')).length,
          inside: r.left >= f.left - 1 && r.right <= f.right + 1 && r.top >= f.top - 1 && r.bottom <= f.bottom + 1,
        };
      }, `${slot(GRASS)} [data-req-state="eased"] [data-req-coins]`);
      expect(seal?.art, 'every coin is the source card\'s own art').toBe(3);
      expect(seal?.inside, 'the seal stays inside the card face').toBe(true);
      await expect(page.locator(`${slot(GRASS)} [data-hand-ease] [data-req-coins="3"]`), 'the tile\'s plate names the three sources').toHaveCount(1);

      // ── Lake Marineris (≥ 0 → ≥ −12): bent but still short — eased, never decisive.
      await expect(page.locator(`${slot(LAKE)} [data-req-state="eased"]`).first()).toBeVisible();
      await expect(page.locator(`${slot(LAKE)} [data-req-decisive]`)).toHaveCount(0);
      // ── Archaebacteria (≤ −18 at −20 °C): met ANYWAY — its cassette is printed-quiet, no seal, no plate.
      await expect(page.locator(`${slot(ARCHAE)} [data-req-state="quiet"]`).first(), 'met anyway reads as printed').toBeVisible();
      await expect(page.locator(`${slot(ARCHAE)} [data-req-coins]`), 'no seal on a requirement the modifiers do not decide').toHaveCount(0);
      await expect(page.locator(`${slot(ARCHAE)} [data-hand-ease]`), 'no plate either').toHaveCount(0);
      await shoot(page, preset.id, 'D1-hand-several');

      // ── Grass's composer: the row reads the FINAL bound, then each source with its own coin and share.
      await openComposer(page, GRASS);
      const req = page.locator(`${COMPOSER} [data-composer-req]`);
      await expect(req).toHaveAttribute('data-req-state', 'decisive');
      await expect(req.locator('[data-composer-req-share]'), 'one share per source').toHaveCount(3);
      await expect(req.locator('[data-req-coin]'), 'each share leads with its coin').toHaveCount(3);
      await expect(req).toContainText('Inventrix');
      await expect(req.locator('[data-composer-req-total]'), 'the composition ends on the sum').toHaveText('= ±6');
      const clipped = await req.evaluate((row) => {
        const box = row.getBoundingClientRect();
        return [...row.querySelectorAll('[data-composer-req-share], [data-composer-req-total]')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width === 0 || r.right > box.right + 1 || r.bottom > box.bottom + 1;
          }).map((el) => el.textContent?.trim());
      });
      expect(clipped, 'every share stands whole inside the row — nothing cut').toEqual([]);
      await expect(page.locator(`${COMPOSER} [data-forecast-chip="modifier"] [data-req-coin]`), 'every «Сработает» modifier chip names its source by coin').toHaveCount(3);
      await shoot(page, preset.id, 'D2-grass-composer');
      await press(page, 'Escape', 900);
      await settle(page);

      // ── Archaebacteria's composer: no requirement row and no standing chips (nothing decided) — only the armed effect
      //    it would spend FOR NOTHING says so (decision 7).
      await openComposer(page, ARCHAE);
      await expect(page.locator(`${COMPOSER} [data-composer-req]`), 'a met-anyway requirement has no row').toHaveCount(0);
      await expect(page.locator(`${COMPOSER} [data-forecast-chip="modifier"]`), 'only the armed effect it spends').toHaveCount(1);
      await expect(page.locator(`${COMPOSER} [data-composer-consume]`)).toContainText('впустую');
      await shoot(page, preset.id, 'D3-archae-composer');
    });
  }
});
