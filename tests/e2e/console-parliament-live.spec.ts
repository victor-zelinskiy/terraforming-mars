import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, crumbText, fetchPlayerModel, focusCard, openCardActions, press, pressUntil, settle, waitForBoardHome, walkFocusUntil,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

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
 *   · TWO PRICES, IN TURN (PL-725). The law's 6 M€ leave the rail FIRST as a token
 *     into the law's printed cost (the row reads 14 before anything else moves);
 *     the card's 11 tick at its landing (14 → 3) — never one «−17».
 *   · THE CARD LANDS IN THE LAW'S STAGE (PL-726). The receiving stage rises inside
 *     the stage's decision column, «Действия карт» stands through the landing and
 *     leaves only after it; the standalone table never opens.
 *   · THE BILL THAT ASKS (PL-727). With Helion's heat the bill is a payment of its
 *     own: no slot (nothing pre-collectable), the bill INSIDE the stage, then the
 *     card asked live — the album hosted IN the same stage, never over the board.
 *
 * Fixtures `parliament-live-enacted`, `parliament-live-helion`. Screens under screenshots/parliament-live/.
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
  thisPlayer: {megacredits: number, heat: number, tableau: ReadonlyArray<{name: string}>},
  waitingFor?: {type: string, resolutionActionPrompt?: {resolution: string, stage: string}},
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

type LiveSample = {t: number, mc: string, chip: string, up: boolean, recv: boolean, ws: boolean, table: boolean, hand: boolean, setup: boolean, bill: string, host: string, phase: string};

/** ARM the commit probe (MutationObserver + setInterval — never rAF): what the rail, the stage and the scene show. */
async function armLiveProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    type Sample = {t: number, mc: string, chip: string, up: boolean, recv: boolean, ws: boolean, table: boolean, hand: boolean, setup: boolean, bill: string, host: string, phase: string};
    // Is an element PAINTED (any ancestor hidden or nearly transparent says no)?
    const painted = (el: Element | null): boolean => {
      if (el === null) {
        return false;
      }
      let op = 1;
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return false;
        }
        op *= Number(cs.opacity);
      }
      return op > 0.1;
    };
    type Ready = {playedHero?: {bill?: string, host?: string, phase?: string}};
    const w = window as unknown as {__liveProbe?: {samples: Array<Sample>, stop: () => void}, __conReady?: () => Ready};
    w.__liveProbe?.stop();
    const samples: Array<Sample> = [];
    const t0 = performance.now();
    const sample = () => {
      const ready = w.__conReady?.();
      // The digits span carries the row's number AND its delta chip («14−6»): the number leads, the chip follows.
      const digits = (document.querySelector('.con-res .con-res__row--megacredits .con-res__digits')?.textContent ?? '').replace(/\s+/g, '');
      const lead = /^\d+/.exec(digits)?.[0] ?? '';
      samples.push({
        t: Math.round(performance.now() - t0),
        mc: lead,
        chip: digits.slice(lead.length),
        up: document.querySelector('.con-pact [data-pact-landing].con-pact__playstage--up') !== null,
        recv: document.querySelector('.con-pact [data-pact-landing] .con-recv') !== null,
        ws: document.querySelector('.con-cardactions') !== null,
        table: document.querySelector('.con-played') !== null,
        hand: document.querySelector('.con-cardactions .con-hand') !== null,
        // The law's SETUP (its rule line) still painted in the stage — it must let go under the landing.
        setup: Array.from(document.querySelectorAll('.con-pact .con-pact__rule')).some((el) => painted(el)),
        bill: ready?.playedHero?.bill ?? '',
        host: ready?.playedHero?.host ?? '',
        phase: ready?.playedHero?.phase ?? '',
      });
    };
    const timer = window.setInterval(sample, 16);
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class']});
    w.__liveProbe = {samples, stop: () => {
      window.clearInterval(timer);
      mo.disconnect();
    }};
  });
}

async function readLiveProbe(page: Page): Promise<Array<LiveSample>> {
  return page.evaluate(() => {
    const w = window as unknown as {__liveProbe?: {samples: Array<LiveSample>, stop: () => void}};
    w.__liveProbe?.stop();
    return w.__liveProbe?.samples ?? [];
  });
}

/** The probe as one line per CHANGE — for a red's message. */
function probeTrail(samples: ReadonlyArray<LiveSample>): string {
  const key = (x: LiveSample) => JSON.stringify({...x, t: 0});
  return samples.filter((x, i) => i === 0 || key(x) !== key(samples[i - 1]))
    .map((x) => `t=${x.t} mc=${x.mc} chip=${x.chip} up=${x.up} recv=${x.recv} ws=${x.ws} table=${x.table} hand=${x.hand} setup=${x.setup} bill=${x.bill} host=${x.host} phase=${x.phase}`)
    .join('\n');
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
      //    The probe is armed BEFORE the press (MutationObserver + setInterval — never rAF): the rail's M€ digits,
      //    the landing layer inside the stage, the workspace, the standalone table, the scene's bill and host.
      await armTransferWitness(page);
      await armLiveProbe(page);
      const stopStory = await storyboard(page, preset.id, 'commit');
      expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, playerId)).game.parliament?.viewer?.resolutionAction?.usesLeft === 0,
        {tries: 3, settleMs: 2500}), 'A on the law\'s CTA commits').toBeTruthy();
      const after = await untilServer(request, playerId, (m) => m.thisPlayer.tableau.some((c) => c.name === OPENED), 'Grass on the table');
      expect(after.thisPlayer.megacredits, '20 − 6 − 11').toBe(3);
      expect((after.cardsInHand ?? []).some((c) => c.name === OPENED), 'Grass left the hand').toBe(false);
      await expect(page.locator('.con-cardactions'), 'the workspace leaves once the landing has told its story').toHaveCount(0, {timeout: 30_000});
      await settle(page, {timeoutMs: 30_000});
      await stopStory();
      await shoot(page, preset.id, '06-after-commit');
      const samples = await readLiveProbe(page);
      const trail = probeTrail(samples);
      expect(samples.length, 'the probe was alive').toBeGreaterThan(20);
      // PL-725 — two prices in turn: the rail reads 14 (the law's 6 gone) before it ever reads 3 (the card's 11).
      const first14 = samples.findIndex((x) => x.mc === '14');
      const first3 = samples.findIndex((x) => x.mc === '3');
      expect(first14, `the law's 6 left the rail on their own — the row read 14\n${trail}`).toBeGreaterThanOrEqual(0);
      expect(first3, `…and only then the card's 11 — the row read 3\n${trail}`).toBeGreaterThan(first14);
      expect(samples[first14].chip, `the law's departure reads its own chip\n${trail}`).toMatch(/6$/);
      expect(samples.slice(first3).some((x) => /11$/.test(x.chip)), `the card's price is a FRESH «−11» chip\n${trail}`).toBe(true);
      expect(samples.some((x) => /17$/.test(x.chip)), `never one «−17»\n${trail}`).toBe(false);
      expect(samples.some((x) => x.bill === 'flown'), `the bill's token flew and was absorbed\n${trail}`).toBe(true);
      const witness = await transferWitness(page);
      const wtrail = transferTrail(witness);
      expect(witness.births.some((e) => e.under === 'rail:megacredits'), `the law's token is born on the rail's M€ row\n${wtrail}`).toBe(true);
      expect(witness.landings.some((e) => e.under === 'law-face'), `…and lands on the law's face\n${wtrail}`).toBe(true);
      expect(endsOverGlass(witness), `no end over glass\n${wtrail}`).toEqual([]);
      // PL-726 — the card lands IN the law's stage: the receiving stage up inside it, the workspace standing, the
      // standalone table never opened.
      expect(samples.some((x) => x.up && x.recv && x.ws), `the receiving stage stood inside the law's stage\n${trail}`).toBe(true);
      expect(samples.some((x) => x.host === 'workspace'), `the scene's host is the workspace\n${trail}`).toBe(true);
      expect(samples.some((x) => x.table), `the standalone table never opened\n${trail}`).toBe(false);
      // …and the setup let go under it: once the stage has risen and the scene is past its lift, no rule line is painted.
      const settled = samples.filter((x) => x.up && ['flying', 'landing', 'committing', 'showing-result', 'closing'].includes(x.phase));
      expect(settled.length, `the scene was sampled past its lift\n${trail}`).toBeGreaterThan(0);
      expect(settled.filter((x) => x.setup).length, `the law's setup never shows through the landing\n${trail}`).toBe(0);
      const lastUp = samples.map((x) => x.up).lastIndexOf(true);
      expect(samples.slice(0, lastUp + 1).every((x) => x.ws), `the workspace stood for as long as the landing did\n${trail}`).toBe(true);

      // ── ⑥ THE TILE reads «Активирована»: a spent action leaves the default view; RT shows it, spent.
      expect(after.game.parliament?.viewer?.resolutionAction).toMatchObject({usesLeft: 0, available: false});
      await openCardActions(page);
      await expect(page.locator(`.con-cardactions__tile[data-action-resolution="${LAW}"]`), 'a spent action leaves the default view').toHaveCount(0);
      expect(await pressUntil(page, 'Period', async () => await page.locator(`.con-cardactions__tile--activated[data-action-resolution="${LAW}"]`).count() > 0,
        {tries: 3, settleMs: 700}), 'RT shows the activated actions: the law\'s tile is there, spent').toBeTruthy();
      await settle(page, {timeoutMs: 10_000});
      await shoot(page, preset.id, '07-tile-activated');
    });

    test('the bill that ASKS (Helion\'s heat): no slot, the bill INSIDE the stage, the card asked live — the album hosted IN the same stage', async ({page, request}) => {
      test.setTimeout(420_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-live-helion', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect(before.game.parliament?.viewer?.resolutionAction, 'a bill that asks promises nothing pre-collectable')
        .toMatchObject({resolution: LAW, usesLeft: 1, available: true, play: {billAsks: true}});

      // ── ① THE LAW'S STAGE: the price and the confirm — no slot (the card is asked after the bill).
      await waitForBoardHome(page, 40);
      await settle(page, {timeoutMs: 20_000});
      await openCardActions(page);
      await focusLawTile(page);
      expect(await pressUntil(page, 'Enter', async () => await page.locator(STAGE).count() > 0, {tries: 3, settleMs: 1100}),
        'A opens the law\'s stage').toBeTruthy();
      await expect(page.locator(`${STAGE} [data-pact-price]`), 'the price reads').toBeVisible({timeout: 20_000});
      await expect(page.locator(`${STAGE} [data-pact-play-slot]`), 'no slot: nothing to pre-collect').toHaveCount(0);
      await expect(page.locator('[data-pact-cta][data-pact-ready]'), 'a confirm is complete by standing').toHaveCount(1);
      await settle(page, {timeoutMs: 15_000});
      await shoot(page, preset.id, 'h1-stage-confirm');

      // ── ② A: the BILL stands INSIDE the stage (the payment host in its zone), nothing granted yet.
      expect(await pressUntil(page, 'Enter', async () => await page.locator(`${STAGE} [data-pact-bill]`).count() > 0, {tries: 3, settleMs: 1200}),
        'the confirm raises the bill in the stage').toBeTruthy();
      await expect(page.locator(`${STAGE} [data-embed-slot="action-bill"] .con-task-host`), 'the payment host stands INSIDE the stage').toHaveCount(1, {timeout: 20_000});
      await expect(page.locator('.con-task-host:not(.con-task-host--embedded)'), 'never a standalone payment band').toHaveCount(0);
      const mid = await wireOf(request, playerId);
      expect(mid.waitingFor?.resolutionActionPrompt, 'the server waits on the bill').toMatchObject({resolution: LAW, stage: 'pay'});
      await settle(page, {timeoutMs: 15_000});
      await shoot(page, preset.id, 'h2-bill');

      // ── ③ A SETTLES THE BILL → the card is asked LIVE: the album stands IN the law's stage, never over the board.
      await press(page, 'Enter', 300);
      await untilServer(request, playerId, (m) => m.waitingFor?.type === 'projectCard' && m.waitingFor.resolutionActionPrompt?.stage === 'play',
        'the law\'s live card pick');
      await expect(page.locator('.con-cardactions .con-hand'), 'the album stands inside «Действия карт»').toHaveCount(1, {timeout: 30_000});
      await expect(page.locator('.con-hand'), 'one album — the hosted one').toHaveCount(1);
      await settle(page, {timeoutMs: 20_000});
      const liveCrumb = (await crumbText(page)).toUpperCase();
      expect(liveCrumb, `the crumb keeps the law (${liveCrumb})`).toContain('ЖИВЫЕ ЭКСПЕРИМЕНТЫ');
      await expect(page.locator(`.con-hand__slot--playable[data-zoom-slot="${OPENED}"]`), 'the law opens Grass in the live album').toHaveCount(1);
      await expect(page.locator(`.con-hand__slot--unplayable[data-zoom-slot="${PARTY}"]`), 'a PARTY requirement stays refused').toHaveCount(1);
      expect(await focusCard(page, OPENED), 'the cursor reaches the card the law opens').toBe(true);
      await shoot(page, preset.id, 'h3-album-live');

      // ── ④ A ON GRASS: the play composer one level deeper; A plays it LIVE, and it lands inside the stage.
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play').count() > 0, {tries: 3, settleMs: 1200}),
        'A opens the play composer').toBeTruthy();
      await settle(page, {timeoutMs: 20_000});
      const composerCrumb = (await crumbText(page)).toUpperCase();
      expect(composerCrumb, `the crumb names the card under the law (${composerCrumb})`).toMatch(/ЖИВЫЕ ЭКСПЕРИМЕНТЫ.*(ТРАВА|GRASS)/);
      await shoot(page, preset.id, 'h4-composer-live');
      await armLiveProbe(page);
      expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, playerId)).thisPlayer.tableau.some((c) => c.name === OPENED),
        {tries: 3, settleMs: 2500}), 'A plays the card').toBeTruthy();
      await expect(page.locator('.con-cardactions'), 'the workspace leaves once the card has landed').toHaveCount(0, {timeout: 30_000});
      await settle(page, {timeoutMs: 30_000});
      await shoot(page, preset.id, 'h5-after');
      const samples = await readLiveProbe(page);
      const trail = probeTrail(samples);
      expect(samples.some((x) => x.ws && x.hand), `the play was made inside «Действия карт»\n${trail}`).toBe(true);
      expect(samples.some((x) => x.table), `the standalone table never opened\n${trail}`).toBe(false);
      const after = await wireOf(request, playerId);
      expect(after.game.parliament?.viewer?.resolutionAction, 'the use is spent').toMatchObject({usesLeft: 0});
      expect(before.thisPlayer.megacredits + before.thisPlayer.heat - after.thisPlayer.megacredits - after.thisPlayer.heat,
        'the law\'s 6 and the card\'s 11, paid in M€ and heat').toBe(17);
    });
  });
}
