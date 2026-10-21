import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, cinematicBeat, fetchPlayerModel, focusCard, focusInfoZone, press, pressUntil, settle} from './consoleStart';
import {armLeakWitness, openParliament, strandedReports} from './parliamentDrive';

/**
 * UNMI VETO (Turmoil Redux, RX42) — the ONE e2e of the SECOND REPLACING passive, the one on the RATING: «the player(s)
 * with the highest terraform rating ignore any rating they would gain». The owner's requirement is the whole spec: a
 * seat under the veto sees «the rating will not be gained» BEFORE every press that promises one — no surface prints a
 * «+N РТ» without the strike. Two profiles (standard-1080 · tv4k):
 *
 *   PART 0 (`parliament-unmi-veto-enacted` — red first by rating, 30 against blue's 27; 8 heat, 30 M€, −10 °C,
 *   «Bribed Committee» in hand):
 *   ① the rail's rating cell wears the STAMP (`data-tr-vetoed="30"`), its hint names the law and the number;
 *   ② the Information effects list names the law FIRST and reads who the veto binds right now: «вы (30)»;
 *   ③ the hand album: the «+2 TR» card's plate carries the struck rating (`data-hand-veto="2"`);
 *   ④ the basic-actions wheel: the heat slot's note «РТ под вето»; the heat confirm's formula STRIKES the rating chip
 *      beside a temperature step that stays whole; A → the scale MOVES (−10 → −8 on the wire), the rating does NOT
 *      (30), the law's own card names the skipped rating with its reason, the stamp stands;
 *   ⑤ the Standard Projects: the Asteroid row is marked, its foot names the veto and strikes the rating chip.
 *   PART 1 (`parliament-unmi-veto-vote` — blue NOT first, 20 against red's 30): the vote panel names who the veto would
 *   bind if the law passed, with the number — «Сейчас наибольший РТ — … (30)» — and the viewer's own rating.
 *   PART 2: the «Полигон» stand — the law's three readings (you first · the other seat first · a tie at the top).
 *
 * `TM_E2E_STORYBOARD=1` writes every compositor frame of the heat beat (`screenshots/parliament-unmi-veto/<profile>/
 * story-*`). Screens under screenshots/parliament-unmi-veto/<profile>/ (the 4K frames are trusted on the GPU only —
 * `TM_E2E_GPU=1`).
 */
const OUT = path.resolve('screenshots', 'parliament-unmi-veto');
const LAW_ID = 'RDX_REDS_UNMI_VETO';
const LAW_INSTANCE = `${LAW_ID}#0`;
const PLUS_TR_CARD = 'Bribed Committee';
const CONFIRM = '.con-confirm';

const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {megacredits: number, heat: number, terraformRating: number},
  game: {temperature: number},
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

/** Poll the SERVER until `ok` holds (the press is answered) — never a fixed sleep. */
async function untilServer(request: APIRequestContext, playerId: string, ok: (m: Wire) => boolean, what: string): Promise<Wire> {
  let last: Wire | undefined;
  for (let i = 0; i < 160; i++) {
    last = await wireOf(request, playerId);
    if (ok(last)) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`the server never reached: ${what} (last: heat ${last?.thisPlayer.heat}, M€ ${last?.thisPlayer.megacredits}, TR ${last?.thisPlayer.terraformRating}, t ${last?.game.temperature})`);
}

const onBoard = (p: Page) => () => p.evaluate(() => {
  const board = document.querySelector<HTMLElement>('.con-board');
  return document.querySelector('.con-ws') === null && board !== null && board.offsetParent !== null;
});

/** The temperature READOUT as the player sees it. */
const temperatureText = (page: Page) => page.evaluate(() => {
  const host = Array.from(document.querySelectorAll('.con-status__param')).find((el) => el.querySelector('.wgt-icon--temperature') !== null);
  return (host?.querySelector('.con-status__value')?.textContent ?? '').trim();
});

/** The rail's rating cell: its stamp (the rating it binds) and its hint. */
const railStamp = (page: Page) => page.evaluate(() => {
  const cell = document.querySelector<HTMLElement>('.con-score__cell--tr');
  const stamp = cell?.querySelector<HTMLElement>('.con-score__veto');
  return {
    vetoed: cell?.getAttribute('data-tr-vetoed') ?? '',
    hint: cell?.getAttribute('data-hint') ?? '',
    value: cell?.querySelector('.con-score__value--tr')?.textContent?.trim() ?? '',
    stampVisible: stamp !== null && stamp !== undefined && stamp.getBoundingClientRect().width > 0 && getComputedStyle(stamp).opacity !== '0',
  };
});

/** RT → «КАРТЫ»: the hand album, settled (the TR49 door). */
async function openHand(page: Page, first: string): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${first}"]`).waitFor({timeout: 15_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
}

/** The standard-projects sheet's focused row name. */
const focusedRow = async (page: Page): Promise<string> =>
  (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';

async function focusRow(page: Page, re: RegExp): Promise<void> {
  const snake = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 6 && !re.test(await focusedRow(page)); i++) {
    await press(page, 'ArrowUp', 200);
  }
  if (!re.test(await focusedRow(page))) {
    await press(page, 'ArrowLeft', 200);
  }
  for (let i = 0; i < snake.length && !re.test(await focusedRow(page)); i++) {
    await press(page, snake[i], 240);
  }
  expect(re.test(await focusedRow(page)), `could not focus ${re} (at «${await focusedRow(page)}»)`).toBeTruthy();
}

for (const preset of PRESETS) {
  test.describe(`UNMI Veto (RX42) · the law refuses the first seat's rating, and every surface says so first · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test('the rail\'s stamp; the effects list names you; the hand plate strikes +2; the heat confirm strikes the rating and the scale still moves; the Asteroid row', async ({page, request}) => {
      test.setTimeout(420_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-unmi-veto-enacted', {query: preset.query});
      await settle(page);
      const start = await wireOf(request, playerId);
      expect(start.thisPlayer.terraformRating, 'the fixture: first by rating at 30').toBe(30);
      expect(start.thisPlayer.heat, 'the fixture: 8 heat').toBe(8);
      expect(start.game.temperature, 'the fixture: −10 °C').toBe(-10);

      // ① THE RAIL — the rating cell wears the Reds' stamp; the hint names the law and the number; the cell's digits stand.
      await expect(page.locator('.con-score__cell--tr[data-tr-vetoed="30"]'), 'the stamp binds the viewer\'s own rating').toHaveCount(1, {timeout: 15_000});
      const stamp = await railStamp(page);
      expect(stamp.stampVisible, 'the stamp is PAINTED over the rating icon').toBe(true);
      expect(stamp.hint, `the hint names the law: ${stamp.hint}`).toMatch(/Вето UNMI/);
      expect(stamp.hint, `…and the number: ${stamp.hint}`).toContain('30');
      expect(stamp.value, 'the digits are the rating').toBe('30');
      await shoot(page, preset.id, '01-rail-stamp');

      // ② THE EFFECTS LIST — Information → the effects zone → the explorer's Parliament strip: the law first, and the
      //    seats it binds RIGHT NOW with their ratings («вы (30)»).
      const infoRoot = page.locator('.con-info');
      for (let i = 0; i < 8 && await infoRoot.count() === 0; i++) {
        if (i > 0) {
          await press(page, 'Enter', 700);
          await press(page, 'Escape', 500);
        }
        await press(page, 'KeyY', 1100);
      }
      await expect(infoRoot, 'the Information mode opens').toHaveCount(1);
      expect(await focusInfoZone(page, 'effects'), 'the effects zone takes the focus').toBe(true);
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-efx').count() > 0, {tries: 3, settleMs: 1100}), 'the effects explorer opens').toBe(true);
      const strip = page.locator('.con-pfx');
      await expect(strip, 'the Parliament strip stands in the explorer').toHaveCount(1, {timeout: 10_000});
      const law = strip.locator('.con-pfx__item').first();
      await expect(law, 'the LAW leads the strip').toHaveClass(/con-pfx__item--resolution/);
      await expect(law).toHaveAttribute('data-resolution', LAW_ID);
      await expect(law.locator('.con-pfx__title'), 'titled by the card').toHaveText(/Вето UNMI/i);
      // The law's row carries its access reason AND the veto's row — both in the `holds` tone; the veto's is the one that names the seats.
      const bound = law.locator('.con-pfx__reason--holds', {hasText: /Под вето сейчас/i});
      await expect(bound, 'the row names who is under the veto NOW').toHaveCount(1);
      await expect(bound, '…the viewer, with the rating').toContainText(/вы \(30\)/i);
      await settle(page, {timeoutMs: 15_000, notifications: false});
      await shoot(page, preset.id, '02-effects-strip');
      for (let i = 0; i < 6 && await page.locator('.con-info, .con-efx').count() > 0; i++) {
        await press(page, 'Escape', 700);
      }
      await expect(page.locator('.con-info, .con-efx')).toHaveCount(0, {timeout: 10_000});

      // ③ THE HAND — the «+2 TR» card's plate carries the struck rating BEFORE the composer opens.
      expect(await pressUntil(page, 'Escape', onBoard(page), {tries: 4, settleMs: 1200}), 'the viewer stands on the board').toBe(true);
      await openHand(page, PLUS_TR_CARD);
      const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
      expect(await focusCard(page, PLUS_TR_CARD, slots * 2 + 6), `the cursor reached ${PLUS_TR_CARD} in the hand`).toBe(true);
      const plate = page.locator(`.con-hand__slot[data-zoom-slot="${PLUS_TR_CARD}"] [data-hand-veto]`);
      await expect(plate, 'the tile\'s plate carries the veto').toHaveCount(1);
      await expect(plate).toHaveAttribute('data-hand-veto', '2');
      await expect(plate.locator('.con-hand__plate-item--struck'), 'the +2 TR item is STRUCK').toHaveCount(1);
      await shoot(page, preset.id, '03-hand-plate');
      expect(await pressUntil(page, 'Escape', onBoard(page), {tries: 6, settleMs: 1000}), 'back on the board').toBe(true);

      // ④ THE WHEEL → THE HEAT CONFIRM: the slot's note, the struck rating chip beside a whole temperature step; A → the
      //    scale moves, the rating does not, the law's card names the skip.
      const readoutBefore = await temperatureText(page);
      expect(await pressUntil(page, 'Comma', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900}), 'the basic-actions wheel opens').toBe(true);
      const note = page.locator('.con-quick [data-slot-veto]');
      await expect(note, 'the heat slot wears the veto note').toHaveCount(1);
      await expect(note).toContainText(/РТ под вето/i);
      await shoot(page, preset.id, '04-wheel-note');
      const confirm = page.locator(`${CONFIRM}[data-confirm-kind="convertHeat"]`);
      expect(await pressUntil(page, 'ArrowRight', async () => await confirm.count() > 0, {tries: 3, settleMs: 1200}), 'the heat confirm stands').toBe(true);
      await settle(page);
      const chips = page.locator(`${CONFIRM} [data-confirm-formula] .action-effect-chip`);
      await expect(chips, 'the price, the temperature step and the rating').toHaveCount(3);
      const struck = page.locator(`${CONFIRM} [data-confirm-formula] .action-effect-chip--vetoed`);
      await expect(struck, 'ONE chip is struck — the rating').toHaveCount(1);
      await expect(struck).toHaveAttribute('data-vetoed', '1');
      await expect(struck, 'the strike wears the family class').toHaveClass(/action-effect-chip--diverted/);
      expect(await struck.getAttribute('data-hint'), 'the chip\'s hint names the law').toMatch(/Вето UNMI/);
      await expect(page.locator(`${CONFIRM} [data-confirm-formula] .action-effect-chip:not(.action-effect-chip--vetoed)`), 'the price and the temperature step stay whole').toHaveCount(2);
      await expect(page.locator(`${CONFIRM} [data-chip-diverted]`), 'nothing stands in the rating\'s place — no tail').toHaveCount(0);
      // PL-814: the «Сработает» row prints the law's own fact STRUCK too — never a bare «+1 [TR]» beside a warning badge.
      const forecastRow = page.locator(`${CONFIRM} [data-forecast-row]`);
      await expect(forecastRow, 'the law answers — the «Сработает» row stands').toHaveCount(1);
      await expect(forecastRow.locator('.action-effect-chip--vetoed'), 'the law fact is struck in the row').toHaveCount(1);
      await expect(forecastRow.locator('.action-effect-chip:not(.action-effect-chip--vetoed)'), 'no unstruck rating in the row').toHaveCount(0);
      await shoot(page, preset.id, '05-heat-confirm');

      const stop = await storyboard(page, preset.id, 'heat-commit');
      await press(page, 'Enter', 900);
      const afterHeat = await untilServer(request, playerId, (m) => m.thisPlayer.heat === 0 && m.game.temperature === -8, '8 heat spent, the temperature −10 → −8');
      expect(afterHeat.thisPlayer.terraformRating, 'the rating NEVER moved — the law refused it').toBe(30);
      await expect(confirm, 'the plate leaves with the press').toHaveCount(0, {timeout: 20_000});
      await settle(page, {timeoutMs: 40_000, notifications: false});
      await stop();

      // THE LAW's CARD — the skipped rating named with its reason, the law as the source.
      const toast = page.locator('.con-notif[data-notif-id$=":law"]');
      await expect(toast, 'the law\'s card').toHaveCount(1, {timeout: 20_000});
      const skip = toast.locator('.con-notif__skip');
      await expect(skip, 'the skipped rating is a line of its own').toHaveCount(1);
      await expect(skip.locator('.con-notif__skip-label'), 'what was skipped').toContainText(/Рейтинг терраформирования|РТ/i);
      await expect(skip.locator('.con-notif__skip-reason'), 'why').toContainText(/наибольший РТ/i);
      await cinematicBeat(page, 300, 'the toast finishes its entrance before the frame is taken');
      await shoot(page, preset.id, '06-law-toast');
      expect(await temperatureText(page), 'the readout MOVED — the scale is the planet\'s, not the rating\'s').not.toBe(readoutBefore);
      const after = await railStamp(page);
      expect(after.vetoed, 'the stamp still binds 30').toBe('30');
      expect(after.value, 'the digits still read 30').toBe('30');
      await settle(page, {timeoutMs: 30_000, notifications: false});

      // ⑤ THE ASTEROID — LT → standard projects → «Астероид»: the row is marked, its foot names the veto and strikes the chip.
      expect(await pressUntil(page, 'Escape', onBoard(page), {tries: 4, settleMs: 1200}), 'back on the board').toBe(true);
      await press(page, 'Comma', 1100);
      await press(page, 'Enter', 1400);
      await page.waitForSelector('.con-stdp', {timeout: 15_000});
      await focusRow(page, /^Астероид/i);
      await settle(page, {timeoutMs: 15_000, notifications: false});
      await expect(page.locator('.con-stdp__card--focused[data-stdp-veto]'), 'the Asteroid row is marked').toHaveCount(1);
      const foot = page.locator('.con-stdp__foot');
      await expect(foot.locator('[data-stdp-context-veto]'), 'the foot names the veto').toContainText(/РТ под вето/i);
      await expect(foot.locator('.action-effect-chip--vetoed'), 'the row\'s rating chip is struck').toHaveCount(1);
      await shoot(page, preset.id, '07-asteroid-row');
      for (let i = 0; i < 4 && await page.locator('.con-stdp').count() > 0; i++) {
        await press(page, 'Escape', 800);
      }
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
    });

    test('the vote: the panel names who the veto would bind now, with the number, and the viewer\'s own rating', async ({page, request}) => {
      test.setTimeout(240_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-unmi-veto-vote', {query: preset.query});
      const me = await wireOf(request, playerId);
      expect(me.thisPlayer.terraformRating, 'the fixture: blue at 20, not first').toBe(20);
      await armLeakWitness(page);
      await openParliament(page);
      const face = page.locator(`.con-parl__slot[data-instance="${LAW_INSTANCE}"] .pcard`);
      await expect(face, 'UNMI Veto stands in the voting area').toHaveCount(1);
      expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX42');
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      const veto = page.locator('[data-parl-vote-veto]');
      await expect(veto, 'the veto reading stands in the panel').toHaveCount(1);
      await expect(veto).toHaveAttribute('data-parl-vote-veto-kind', 'others');
      await expect(veto, 'who it would bind now, with the rating').toContainText(/Сейчас наибольший РТ — .+ \(30\)/);
      await expect(veto, 'the viewer\'s own rating beside it').toContainText(/Вы — 20/);
      await expect(veto, 'never the word «лидер»').not.toContainText(/лидер/i);
      await shoot(page, preset.id, '08-vote-panel');
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
    });

    test(`the stand: the law's three readings — you first, the other seat first, a tie at the top (${preset.id})`, async ({page}) => {
      test.setTimeout(180_000);
      await page.goto(`/?resolutionsPlayground${preset.query}`);
      await expect(page.locator('[data-resolutions-playground]')).toHaveCount(1, {timeout: 30_000});
      const onRx42 = await pressUntil(page, 'ArrowRight',
        async () => await page.locator('[data-rxpg-catalog] .con-rxpg__slot--cursor[data-rxpg-code="RX42"]').count() > 0,
        {tries: 60, settleMs: 300});
      expect(onRx42, 'the catalog cursor reaches RX42').toBe(true);
      // PL-813: the face prints «[TR >] : [TR struck]» — the «>» INSIDE the first rating square, the second struck.
      const face = page.locator('.pcard.pcard--rdx-reds-unmi-veto').first();
      await expect(face.locator('.pcard-mi__inside--rating'), 'the «>» inside the rating square').toHaveText('>');
      await expect(face.locator('.pcard-mi--cancelled'), 'the second rating square is struck').toHaveCount(1);
      await pressUntil(page, 'BracketRight', async () => await page.locator('[data-rxpg-scenario="veto-you-first"]').count() > 0, {tries: 3, settleMs: 700});
      const scenario = async (key: string, kind: string, text: RegExp, frame: string) => {
        await page.locator(`[data-rxpg-scenario="${key}"]`).click();
        await expect(page.locator(`[data-rxpg-scenario="${key}"]`)).toHaveClass(/con-rxpg__scenario--active/);
        await settle(page, {timeoutMs: 10_000});
        const reading = page.locator('[data-rxpg-veto]');
        await expect(reading, `${key}: the veto reading stands`).toHaveCount(1);
        await expect(reading).toHaveAttribute('data-rxpg-veto-kind', kind);
        await expect(reading).toContainText(text);
        await shoot(page, preset.id, frame);
      };
      await scenario('veto-you-first', 'you', /Вы — первый по РТ \(32\)/, '09-stand-you-first');
      await scenario('veto-other-first', 'others', /Сейчас наибольший РТ — .+ \(32\)/, '10-stand-other-first');
      await scenario('veto-tie', 'tie', /наибольший РТ у вас всех/, '11-stand-tie');
    });
  });
}
