import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, cinematicBeat, fetchPlayerModel, focusCard, openCardActions, playCardFromHand, playQueueCard, press, pressUntil, reloadConsole, settle, walkFocusUntil,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P57 PRESERVATION PROGRAM — the thirty-ninth Prelude 2 card (ledgers FQ / FR): «Raise your TR 5 steps. EFFECT: skip
 * the first TR you gain in each generation's action phase.» The owner's requirement is the whole stand: the player
 * UNDERSTANDS WHEN the effect acts and SEES THE MARK that the rating will not rise — the grammar of RX42 UNMI Veto with
 * a CARD as the source (`data-veto-source="card"`), the rail's rating cell wearing the card's own mark (upper-left,
 * `data-tr-skip="armed|spent"`), and no rating token ever flying for a step the card ate (invariant 16).
 *
 * Fixtures `preservation-program*` (tests/e2e/fixtures/generate.ts § P57):
 *   (A) the start: A on the prelude in the queue → +5 off the played face into the rating cell (witnessed `rail:tr`),
 *       then the mark ARMED, its hint naming the ACTION phase (the prelude phase gained the rating whole);
 *   (B) the action phase, the skip armed: the wheel's heat slot reads «Первый РТ пропускается», the confirm strikes the
 *       rating chip under the CARD (the temperature whole); A → the scale moves, the rating does not, NO token on
 *       `rail:tr`, the rail half never waits as OWED, the cell is named as the cause, the card's feed card names the
 *       skipped step, the mark → `spent`; the Asteroid row is then whole; (D) the pass → a new generation: the mark
 *       `armed` again by ONE crossfade — no @keyframes on it; (G) a reload keeps the mark and its hint;
 *   (C) «Bribed Committee» (+2 TR) from the hand: the plate strikes 1, the play lands ONE rating token;
 *   (E) mid-game: WG Project deals P57 — +4 (upstream's intent, told), the mark `spent` at once;
 *   (F) UNMI: its «3 M€ → +1 TR» is NO EFFECT while the skip is armed — named by the card.
 * The rules are pinned by `tests/cards/prelude2/PreservationProgram.spec.ts` + `PreservationProgramSweep.spec`, the
 * readings by `PreservationProgramReadings.spec`; this is the JOURNEY. Storyboard: `TM_E2E_STORYBOARD=1` →
 * screenshots/p57/tv4k/story-*.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p57', PRESET.id);
const CARD = 'Preservation Program';
const PLUS_TR_CARD = 'Bribed Committee';
const CELL = '.con-res .con-score__cell--tr';
const CONFIRM = '.con-confirm';

type Wire = {
  cardsInHand?: Array<{name: string}>,
  thisPlayer: {terraformRating: number, heat: number, megacredits: number, ratingSkip?: string, tableau: Array<{name: string}>},
  game: {temperature: number, generation: number, phase: string},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, `story-${name}`);
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
async function untilServer(request: APIRequestContext, id: string, ok: (m: Wire) => boolean, what: string): Promise<Wire> {
  let last: Wire | undefined;
  for (let i = 0; i < 200; i++) {
    last = await wireOf(request, id);
    if (ok(last)) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`the server never reached: ${what} (last: TR ${last?.thisPlayer.terraformRating}, heat ${last?.thisPlayer.heat}, t ${last?.game.temperature}, gen ${last?.game.generation}, phase ${last?.game.phase}, mark ${last?.thisPlayer.ratingSkip})`);
}

/** The rail's rating cell as painted: the card's mark (state + visibility), the hint, the digits. */
const cellRead = (page: Page) => page.evaluate((sel) => {
  const cell = document.querySelector<HTMLElement>(sel);
  const mark = cell?.querySelector<HTMLElement>('.con-score__skip');
  const r = mark?.getBoundingClientRect();
  const iconR = cell?.querySelector<HTMLElement>('.con-score__icon')?.getBoundingClientRect();
  return {
    state: cell?.getAttribute('data-tr-skip') ?? '',
    hint: cell?.getAttribute('data-hint') ?? '',
    value: cell?.querySelector('.con-score__value--tr')?.textContent?.trim() ?? '',
    painted: mark !== null && mark !== undefined && (r?.width ?? 0) > 0 && getComputedStyle(mark).visibility !== 'hidden',
    // The mark stands in the icon's UPPER-LEFT corner — never over the digits.
    upperLeft: r !== undefined && iconR !== undefined && r.left <= iconR.left + iconR.width / 2 && r.top <= iconR.top + iconR.height / 2,
  };
}, CELL);

type Probe = {states: Array<string>, keyframes: Array<string>, causeOnCell: boolean, owedHold: boolean, holds: Array<string>};
/** From the press on: the mark's states, any @keyframes on the mark, the cause mark on the cell, the OWED hold. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate((sel) => {
    const p: Probe = {states: [], keyframes: [], causeOnCell: false, owedHold: false, holds: []};
    (window as unknown as {__p57: Probe}).__p57 = p;
    const read = () => {
      const cell = document.querySelector<HTMLElement>(sel);
      const state = cell?.getAttribute('data-tr-skip') ?? '';
      if (p.states[p.states.length - 1] !== state) {
        p.states.push(state);
      }
      p.causeOnCell = p.causeOnCell || cell?.hasAttribute('data-reaction-cause') === true;
      const mark = cell?.querySelector<HTMLElement>('.con-score__skip');
      for (const a of (mark?.getAnimations?.({subtree: true}) ?? [])) {
        if (a instanceof CSSAnimation && !p.keyframes.includes(a.animationName)) {
          p.keyframes.push(a.animationName);
        }
      }
      const holds = (window as unknown as {__conReady?: () => {holds: Array<string>}}).__conReady?.().holds ?? [];
      for (const h of holds) {
        if (!p.holds.includes(h)) {
          p.holds.push(h);
        }
      }
      p.owedHold = p.owedHold || holds.some((h) => h.includes('action-commit-rail-owed'));
    };
    read();
    new MutationObserver(read).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(read, 40);
  }, CELL);
}
const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__p57: Probe}).__p57);

const onBoard = (p: Page) => () => p.evaluate(() => {
  const board = document.querySelector<HTMLElement>('.con-board');
  return document.querySelector('.con-ws') === null && board !== null && board.offsetParent !== null;
});

/** Hold LT → the basic wheel → a slot by its direction, released — the plate asks (the Pristar pass's own road). */
async function wheelSlot(page: Page, key: 'ArrowRight' | 'ArrowDown'): Promise<void> {
  await page.keyboard.down('Comma');
  await cinematicBeat(page, 550, 'the held LT opens the basic wheel (its own entrance)');
  await page.keyboard.press(key);
  await cinematicBeat(page, 450, 'the slot step reads before the release');
  await page.keyboard.up('Comma');
}

test.describe(`P57 Preservation Program · the first TR of the action phase, skipped and SAID · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('(A) the start: +5 off the card into the rating cell, then the mark ARMED — its hint names the action phase', async ({page, request}) => {
    test.setTimeout(360_000);
    const warns: Array<string> = [];
    page.on('console', (m) => {
      if (m.type() === 'warning' || m.type() === 'error' || /\[(transfer|rail|card-reaction|reaction)/.test(m.text())) {
        warns.push(m.text().slice(0, 400));
      }
    });
    const id = await bootFixture(page, request, 'preservation-program-start', {query: PRESET.query, landing: 'prompt'});
    await settle(page, {timeoutMs: 30_000});
    await expect(page.locator(`.con-start [data-queue-slot="${CARD}"]`), 'the prelude stands in the deployment queue').toHaveCount(1, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    expect(before.thisPlayer.ratingSkip, 'no mark before the card is played').toBeUndefined();
    await shoot(page, 'A-01-queue');

    await armTransferWitness(page);
    await armProbe(page);
    const stop = await storyboard(page, 'start');
    expect(await playQueueCard(page, CARD), 'the prelude was played from the queue').toBe(true);
    const after = await untilServer(request, id, (m) => m.thisPlayer.tableau.some((c) => c.name === CARD), 'the prelude on the table');
    expect(after.thisPlayer.terraformRating - before.thisPlayer.terraformRating, '+5 whole — the prelude phase is not the action phase').toBe(5);
    expect(after.thisPlayer.ratingSkip, 'the server: the skip armed').toBe('armed');
    await expect(page.locator(`${CELL}[data-tr-skip="armed"]`), 'the cell wears the mark «armed»').toHaveCount(1, {timeout: 30_000});
    // The ceremony's beat arms after the view (the mark is an instrument — at once); wait for the +5's own landing.
    const landed = await expect.poll(async () => (await transferWitness(page)).landings.filter((l) => l.under === 'rail:tr').length,
      {message: 'the +5 lands on the rating cell', timeout: 60_000}).toBeGreaterThan(0).then(() => true, () => false);
    if (!landed) {
      const diag = await page.evaluate(() => JSON.stringify((window as unknown as {__conReady?: () => {transfer?: unknown}}).__conReady?.()?.transfer ?? null));
      fs.mkdirSync(OUT, {recursive: true});
      fs.writeFileSync(path.join(OUT, 'A-diag.txt'), `transfer: ${diag}\n\nconsole:\n${warns.join('\n')}\n`);
    }
    expect(landed, `the +5 lands on the rating cell — see A-diag.txt`).toBe(true);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'A-02-armed');

    const cell = await cellRead(page);
    expect(cell.painted, 'the mark is PAINTED').toBe(true);
    expect(cell.upperLeft, 'in the icon\'s upper-left corner').toBe(true);
    expect(cell.hint, `the hint names the card and the ACTION PHASE: ${cell.hint}`).toMatch(/Программа сохранения.*фазе действий/);
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'A-trail.txt'), `${trail}\n`);
    const trLandings = witness.landings.filter((l) => l.under === 'rail:tr');
    expect(trLandings.length, `the +5 landed on the rating cell (trail:\n${trail})`).toBeGreaterThan(0);
    for (const landing of trLandings) {
      const birth = witness.births.find((b) => b.id === landing.id);
      expect(birth?.under ?? '', `a TR token born on the card, never on the rail (trail:\n${trail})`).not.toMatch(/^rail:/);
    }
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    const probe = await readProbe(page);
    test.info().annotations.push({type: 'p57-probe-A', description: JSON.stringify(probe)});
    expect(probe.states.indexOf('armed'), 'the mark armed only AFTER the +5 (it was absent first)').toBeGreaterThan(0);
  });

  test('(B · D · G) the heat conversion\'s rating is skipped and SAID; the Asteroid then whole; the pass re-arms the mark by a crossfade; a reload keeps it', async ({page, request}) => {
    test.setTimeout(600_000);
    const id = await bootFixture(page, request, 'preservation-program', {query: PRESET.query});
    await settle(page);
    const start = await wireOf(request, id);
    expect(start.thisPlayer.ratingSkip, 'the fixture: the skip armed').toBe('armed');
    expect(start.thisPlayer.heat, 'the fixture: 8 heat').toBe(8);
    await expect(page.locator(`${CELL}[data-tr-skip="armed"]`), 'the mark stands «armed»').toHaveCount(1, {timeout: 15_000});
    await shoot(page, 'B-01-armed');
    // FR — THE RAIL BY EYE: the rating digits beside the mark carry ink, never light (every painted text-shadow layer
    // dark — the gold halo is gone).
    const lights = await page.evaluate((sel) => {
      const value = document.querySelector<HTMLElement>(`${sel} .con-score__value--tr`);
      const shadow = value === null ? '' : getComputedStyle(value).textShadow;
      return [...shadow.matchAll(/rgba?\(([^)]*)\)/g)].map((m) => m[1].split(',').map((x) => Number.parseFloat(x)))
        .filter(([r, g, b]) => r + g + b >= 120).length;
    }, CELL);
    expect(lights, 'no light layer in the rating digits\' text-shadow').toBe(0);

    // THE WHEEL → THE HEAT CONFIRM: the slot names the card's skip; the formula strikes the rating under the CARD.
    expect(await pressUntil(page, 'Comma', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900}), 'the basic-actions wheel opens').toBe(true);
    const note = page.locator('.con-quick [data-slot-veto]');
    await expect(note, 'the heat slot wears the note').toHaveCount(1);
    await expect(note).toContainText(/Первый РТ пропускается/i);
    await shoot(page, 'B-02-wheel-note');
    const confirm = page.locator(`${CONFIRM}[data-confirm-kind="convertHeat"]`);
    expect(await pressUntil(page, 'ArrowRight', async () => await confirm.count() > 0, {tries: 3, settleMs: 1200}), 'the heat confirm stands').toBe(true);
    await settle(page);
    const struck = page.locator(`${CONFIRM} [data-confirm-formula] .action-effect-chip--vetoed`);
    await expect(struck, 'ONE chip is struck — the rating').toHaveCount(1);
    await expect(struck).toHaveAttribute('data-veto-source', 'card');
    await expect(struck).toHaveAttribute('data-vetoed', '1');
    expect(await struck.getAttribute('data-hint'), 'the chip\'s hint names the CARD, never a law').toMatch(/Программа сохранения/);
    await expect(page.locator(`${CONFIRM} [data-confirm-formula] .action-effect-chip:not(.action-effect-chip--vetoed)`), 'the price and the temperature stay whole').toHaveCount(2);
    await shoot(page, 'B-03-heat-confirm');

    await armTransferWitness(page);
    await armProbe(page);
    const stop = await storyboard(page, 'heat-skip');
    await press(page, 'Enter', 900);
    const afterHeat = await untilServer(request, id, (m) => m.thisPlayer.heat === 0 && m.game.temperature === start.game.temperature + 2, '8 heat spent, the temperature +2');
    expect(afterHeat.thisPlayer.terraformRating, 'the rating NEVER moved — the card ate the step').toBe(start.thisPlayer.terraformRating);
    expect(afterHeat.thisPlayer.ratingSkip, 'the server: the skip spent').toBe('spent');
    await expect(confirm, 'the plate leaves with the press').toHaveCount(0, {timeout: 20_000});
    await expect(page.locator(`${CELL}[data-tr-skip="spent"]`), 'the mark → «spent»').toHaveCount(1, {timeout: 20_000});
    const toast = page.locator('.con-notif[data-notif-id$=":card-skip"]');
    await expect(toast, 'the card\'s feed card').toHaveCount(1, {timeout: 20_000});
    await expect(toast.locator('.con-notif__skip'), 'the skipped rating is its own line').toHaveCount(1);
    await expect(toast.locator('.con-notif__skip-reason'), 'why — the card').toContainText(/Программа сохранения/i);
    await cinematicBeat(page, 300, 'the toast finishes its entrance before the frame is taken');
    await shoot(page, 'B-04-skip-toast');
    await settle(page, {timeoutMs: 40_000, notifications: false});
    await stop();
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'B-trail.txt'), `${trail}\n`);
    expect(witness.landings.filter((l) => l.under === 'rail:tr'), `NO rating token — the step was never gained (trail:\n${trail})`).toEqual([]);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    const probe = await readProbe(page);
    test.info().annotations.push({type: 'p57-probe-B', description: JSON.stringify(probe)});
    expect(probe.owedHold, `the rail half never waited as OWED (holds: ${probe.holds.join(', ')})`).toBe(false);
    expect(probe.causeOnCell, 'the rating cell was named as the cause').toBe(true);
    expect((await cellRead(page)).value, 'the digits did not move').toBe(String(start.thisPlayer.terraformRating));

    // THE ASTEROID after the skip: the row is whole — no mark, no struck chip.
    expect(await pressUntil(page, 'Escape', onBoard(page), {tries: 4, settleMs: 1200}), 'back on the board').toBe(true);
    await press(page, 'Comma', 1100);
    await press(page, 'Enter', 1400);
    await page.waitForSelector('.con-stdp', {timeout: 15_000});
    // The UNMI stand's snake over the 2-column grid (a one-way walk parks against a wall).
    const focused = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
    const snake = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown'];
    for (let i = 0; i < 6 && !/^Астероид/i.test(await focused()); i++) {
      await press(page, 'ArrowUp', 200);
    }
    for (let i = 0; i < snake.length && !/^Астероид/i.test(await focused()); i++) {
      await press(page, snake[i], 240);
    }
    expect(await focused(), 'the Asteroid row focused').toMatch(/^Астероид/i);
    await settle(page, {timeoutMs: 15_000, notifications: false});
    await expect(page.locator('.con-stdp__card--focused[data-stdp-veto]'), 'the Asteroid row is whole').toHaveCount(0);
    await expect(page.locator('.con-stdp__foot .action-effect-chip--vetoed'), 'no struck chip').toHaveCount(0);
    await shoot(page, 'B-05-asteroid-whole');
    for (let i = 0; i < 4 && await page.locator('.con-stdp').count() > 0; i++) {
      await press(page, 'Escape', 800);
    }

    // (G) A RELOAD — the mark and its hint stand (the server's field).
    await reloadConsole(page);
    await settle(page, {timeoutMs: 30_000});
    await expect(page.locator(`${CELL}[data-tr-skip="spent"]`), 'after a reload the mark reads «spent»').toHaveCount(1, {timeout: 20_000});
    expect((await cellRead(page)).hint, 'the hint says it was already skipped').toMatch(/уже пропущено/);

    // (D) THE PASS → a new generation: the mark «armed» again by ONE crossfade — no @keyframes on it.
    expect(await pressUntil(page, 'Escape', onBoard(page), {tries: 4, settleMs: 1200}), 'back on the board').toBe(true);
    await armProbe(page);
    await wheelSlot(page, 'ArrowDown');
    await expect(page.locator(CONFIRM), 'the pass asks on its plate').toBeVisible({timeout: 10_000});
    await press(page, 'Enter', 300);
    const next = await untilServer(request, id, (m) => m.game.generation === start.game.generation + 1, 'the next generation');
    expect(next.thisPlayer.ratingSkip, 'the server: re-armed at the generation start').toBe('armed');
    await expect(page.locator(`${CELL}[data-tr-skip="armed"]`), 'the mark «armed» again').toHaveCount(1, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000}).catch(() => undefined);
    await shoot(page, 'D-01-rearmed');
    const rearm = await readProbe(page);
    test.info().annotations.push({type: 'p57-probe-D', description: JSON.stringify(rearm)});
    expect(rearm.states.filter((s) => s !== ''), 'spent → armed, one change').toEqual(['spent', 'armed']);
    expect(rearm.keyframes, 'no pulse on the re-arm — a crossfade only').toEqual([]);
    expect((await cellRead(page)).hint, 'the hint names the action phase again').toMatch(/фазе действий/);
  });

  test('(C) «Bribed Committee» (+2 TR): the plate strikes 1; the play lands ONE rating token — the other step was eaten', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'preservation-program', {query: PRESET.query});
    await settle(page);
    const start = await wireOf(request, id);
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
    await page.locator(`.con-hand [data-zoom-slot="${PLUS_TR_CARD}"]`).waitFor({timeout: 15_000});
    await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
    await settle(page);
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    expect(await focusCard(page, PLUS_TR_CARD, slots * 2 + 6), `the cursor reached ${PLUS_TR_CARD}`).toBe(true);
    const plate = page.locator(`.con-hand__slot[data-zoom-slot="${PLUS_TR_CARD}"] [data-hand-veto]`);
    await expect(plate, 'the plate carries the skipped step').toHaveAttribute('data-hand-veto', '1');
    await expect(plate.locator('.con-hand__plate-item--struck'), 'one struck item').toHaveCount(1);
    await shoot(page, 'C-01-hand-plate');
    expect(await pressUntil(page, 'Escape', onBoard(page), {tries: 6, settleMs: 1000}), 'back on the board').toBe(true);

    await armTransferWitness(page);
    await armProbe(page);
    const stop = await storyboard(page, 'bribed');
    expect(await playCardFromHand(page, PLUS_TR_CARD), 'Bribed Committee was played').toBeTruthy();
    const after = await untilServer(request, id, (m) => m.thisPlayer.ratingSkip === 'spent' && !(m.cardsInHand ?? []).some((c) => c.name === PLUS_TR_CARD), 'the card played, the skip spent');
    expect(after.thisPlayer.terraformRating - start.thisPlayer.terraformRating, '+1 — one step of two eaten').toBe(1);
    await settle(page, {timeoutMs: 40_000, notifications: false}).catch(() => undefined);
    await stop();
    await shoot(page, 'C-02-after');
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    fs.writeFileSync(path.join(OUT, 'C-trail.txt'), `${trail}\n`);
    expect(witness.landings.filter((l) => l.under === 'rail:tr').length, `exactly ONE rating token (trail:\n${trail})`).toBe(1);
    expect(endsOverGlass(witness), 'no end over glass or nothing').toEqual([]);
    const probe = await readProbe(page);
    expect(probe.owedHold, `the rail half never waited as OWED (holds: ${probe.holds.join(', ')})`).toBe(false);
  });

  test('(E) mid-game: WG Project deals Preservation Program — +4 told, the mark «spent» at once', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'preservation-program-wg', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, id);
    expect(await playCardFromHand(page, 'WG Project'), 'WG Project was played').toBeTruthy();
    const pick = '.con-hand__outcome .con-deckpick--play';
    await expect(page.locator(`${pick}[data-flow="choosing"]`), 'the prelude pick stands in the hand').toHaveCount(1, {timeout: 40_000});
    const focused = () => page.evaluate(() => document.querySelector('.con-deckpick .con-cards__slot--focused')?.getAttribute('data-deckpick-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === CARD, focused, 12), `focused ${CARD}`).toBeTruthy();
    await shoot(page, 'E-01-pick');
    await press(page, 'Enter', 400);
    await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    await shoot(page, 'E-02-preview');
    for (let i = 0; i < 3 && !(await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === CARD); i++) {
      await press(page, 'Period', 1500);
    }
    const after = await untilServer(request, id, (m) => m.thisPlayer.tableau.some((c) => c.name === CARD), 'P57 on the table');
    expect(after.thisPlayer.terraformRating - before.thisPlayer.terraformRating, '+4 — its own flag ate one (upstream\'s intent)').toBe(4);
    expect(after.thisPlayer.ratingSkip, 'the server: spent at once').toBe('spent');
    await expect(page.locator(`${CELL}[data-tr-skip="spent"]`), 'the mark «spent»').toHaveCount(1, {timeout: 30_000});
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await shoot(page, 'E-03-spent');
  });

  test('(F) UNMI: its +1 TR action is NO EFFECT while the skip is armed — named by the card', async ({page, request}) => {
    test.setTimeout(300_000);
    await bootFixture(page, request, 'preservation-program-unmi', {query: PRESET.query});
    await settle(page);
    await openCardActions(page);
    const tile = page.locator('[data-action-futile="rating-skipped"]');
    await expect(tile, 'the UNMI action reads «no effect» by the card\'s skip').toHaveCount(1, {timeout: 20_000});
    await expect(page.locator('[data-tile-futile]').first(), 'the reason names the card').toContainText(/Программа сохранения/i);
    await shoot(page, 'F-01-unmi-futile');
  });
});
