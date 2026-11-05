import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, createGameWithCards, fetchPlayerModel, focusCard, openConsole, pickCards, playCardFromHand, playQueueCard, press, pressUntil,
  reloadConsole, sendPlayerInputSynced, settle, soloGameConfig, submitSummary, syncClient, waitQueueIdle, walkToSummary, NO_PAYMENT,
} from './consoleStart';
import {readTransient, recordTransient} from './transientRecorder';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * PC04 ECOTEC — «ВОПРОС КАРТЫ ЗА КАЖДУЮ МЕТКУ — СЕРИЯ, А НЕ ПОВТОР» (docs/claude/prompts/prelude2-pc04-ecotec.md,
 * ledger GR · GS). The corporation asks ONE question per printed bio tag of a play — «1 plant, or 1 microbe on ANY
 * card» — so a three-tag card asks three times; the server names each one's place (`choiceContext.series {index, of}`)
 * and the console reads the series as a series:
 *
 *   A · the start on a table with MarsBot: «Сработает» before the press, +2 plants («including these 2»), the bot never C40.
 *   C · the COMPOSER (`ecotec-table`, Advanced Ecosystems): three rows as ONE group («Метка k / 3»), the commit names
 *       what is left, the answers differ (a plant · a microbe through the nested target step), the server gets exactly them.
 *   D · the played card holds microbes itself (`ecotec-self`, Tardigrades): the forecast ASKS (no promised plant).
 *   E · no holder (`ecotec-self`, Heather): «Сработает: +1 растение» exact, no question.
 *   F · the LIVE series (`ecotec-table`, played over the API with no batch): ONE visit — the host never unmounts between
 *       question k and k + 1, its head counts «Метка k / 3», every answer is the pad's.
 *   G · the class's control (`ecotec-viral`, Viral Enhancers on Ecological Zone): the same count.
 *   H · a reload in the middle of the live series: question k stands with its count.
 *   I · a card without a bio tag (Power Plant): no row, no token.
 *
 * Every report and frame: `screenshots/pc04/` (`TM_E2E_STORYBOARD=1` — the storyboards of C and F).
 */

/** The card's name as the server and the DOM carry it (`CardName.ECOTEC`). */
const CORP = 'EcoTec';
const OUT = path.resolve('screenshots', 'pc04');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const ROWS = `.con-composer--play .con-composer__row--reaction[data-reaction-card="${CORP}"]`;

type WireCard = {name: string, resources?: number};
type WirePrompt = {type: string, options?: Array<WirePrompt>, choiceContext?: {source?: {card?: string}, series?: {index: number, of: number}}, promptId?: number, spaces?: Array<string>};
type Wire = {
  waitingFor?: WirePrompt,
  thisPlayer: {plants: number, megacredits: number, tableau: Array<WireCard>},
  game: {gameAge: number, automa?: {corporation?: {id: string, original: string}}},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
function onCard(w: Wire, name: string): number {
  return w.thisPlayer.tableau.find((c) => c.name === name)?.resources ?? 0;
}

function writeText(name: string, text: string): void {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, name), text + '\n');
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

/**
 * WHAT THE PLAYER SEES OF A SERIES, off the product's own writes: the live hosts (each root's node identity — a new
 * number is a new mount), the head's series count, the composer's reactor rows (their labels, which is focused, which
 * still hold the commit), the commit plate's words; the crumb; the table's target step.
 */
type Pose = {
  decision: number, host: number, panel: number, series: string, ask: string,
  rows: string, focused: string, missing: number, cta: string, crumb: string, ptsel: string,
  /** The reaction layer's faces (a SECOND instance of a card on screen) and the faces lifted in their place. */
  faces: number, lifted: number, bar: string,
};
async function recordSeries(page: Page, key: string): Promise<void> {
  await recordTransient(page, key, (): Pose => {
    const w = window as unknown as {__ecoIds?: WeakMap<Element, number>, __ecoN?: number};
    w.__ecoIds ??= new WeakMap();
    const idOf = (el: Element | null): number => {
      if (el === null) {
        return 0;
      }
      let id = w.__ecoIds!.get(el);
      if (id === undefined) {
        w.__ecoN = (w.__ecoN ?? 0) + 1;
        id = w.__ecoN;
        w.__ecoIds!.set(el, id);
      }
      return id;
    };
    const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const rows = Array.from(document.querySelectorAll('.con-composer--play .con-composer__row--reaction'));
    return {
      decision: idOf(document.querySelector('.con-decision')),
      host: idOf(document.querySelector('.con-task-host')),
      panel: idOf(document.querySelector('.con-task, .con-decision__panel')),
      series: document.querySelector('[data-series-count]')?.getAttribute('data-series-count') ?? '',
      ask: text(document.querySelector('.con-prompt-head__title')).slice(0, 80),
      rows: rows.map((r) => `${r.getAttribute('data-series-index') ?? '-'}:${text(r.querySelector('.con-composer__row-label')).slice(0, 50)}`).join(' | '),
      focused: text(document.querySelector('.con-composer--play .con-composer__row--focused .con-composer__row-label, .con-composer--play .con-composer__cta--focused')).slice(0, 60),
      missing: document.querySelectorAll('.con-composer--play .con-composer__row--reaction.con-composer__row--missing').length,
      cta: text(document.querySelector('.con-composer--play .con-composer__cta-label')),
      crumb: text(document.querySelector('.con-wshead')).slice(0, 120),
      ptsel: text(document.querySelector('.con-ptsel')).slice(0, 120),
      faces: document.querySelectorAll('.con-reaction__face[data-reaction-card]').length,
      lifted: document.querySelectorAll('[data-reaction-lifted]').length,
      bar: text(document.querySelector('.con-cmdbar')).slice(0, 80),
    };
  });
}

function poseReport(label: string, poses: ReadonlyArray<{t: number, v: Pose}>, extra: Array<string> = []): string {
  const lines = [`# ${label}`];
  let last = '';
  for (const s of poses) {
    const line = JSON.stringify(s.v);
    if (line !== last) {
      lines.push(`${Math.round(s.t)} ${line}`);
      last = line;
    }
  }
  return [...lines, ...extra].join('\n');
}

/** Every distinct value a field took, in order (a node identity: 0 = absent). */
function sequence<K extends keyof Pose>(poses: ReadonlyArray<{v: Pose}>, field: K): Array<Pose[K]> {
  const out: Array<Pose[K]> = [];
  for (const s of poses) {
    if (out[out.length - 1] !== s.v[field]) {
      out.push(s.v[field]);
    }
  }
  return out;
}

/** Play `card` over the API through the action menu's project-card branch — NO batch: the table asks live. */
async function playLive(page: Page, request: APIRequestContext, id: string, card: string, cost: number): Promise<void> {
  const wf = (await wireOf(request, id)).waitingFor;
  const index = (wf?.options ?? []).findIndex((o) => o.type === 'projectCard');
  expect(index, `the action menu offers a project card (${JSON.stringify(wf?.options?.map((o) => o.type))})`).toBeGreaterThanOrEqual(0);
  await sendPlayerInputSynced(page, request, id, {type: 'or', index, response: {type: 'projectCard', card, payment: {...NO_PAYMENT, megacredits: cost}}});
}

/** The standing question of `giver`, by its marker. */
async function questionOf(request: APIRequestContext, id: string, giver = CORP): Promise<WirePrompt | undefined> {
  const wf = (await wireOf(request, id)).waitingFor;
  return wf?.type === 'or' && wf.choiceContext?.source?.card === giver ? wf : undefined;
}

/** Answer the standing live question with its SECOND action («Получить растение») — the pad, as the player does. */
async function answerPlantWithPad(page: Page, request: APIRequestContext, id: string, giver = CORP): Promise<void> {
  const before = (await questionOf(request, id, giver))?.promptId;
  expect(before, `${giver}'s question stands`).toBeDefined();
  await expect(page.locator('.con-task-host, .con-decision').first(), 'the question is on screen').toBeVisible({timeout: 30_000});
  await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
  await press(page, 'ArrowDown', 300);
  const moved = await pressUntil(page, 'Enter', async () => (await wireOf(request, id)).waitingFor?.promptId !== before, {tries: 3, settleMs: 1500});
  expect(moved, `the pad answered ${giver}'s question ${before}`).toBe(true);
}

/**
 * Answer the standing live question with its FIRST action — «Выберите карту — Бактерия: +1» — through the host's own
 * target step: A on the option opens the step, A takes the focused candidate (a second A confirms when the step asks).
 * Returns what the host showed in the step (its text) for the report.
 */
async function answerMicrobeWithPad(page: Page, request: APIRequestContext, id: string): Promise<string> {
  const before = (await questionOf(request, id))?.promptId;
  expect(before, 'Ecotec’s question stands').toBeDefined();
  await expect(page.locator('.con-task-host').first(), 'the question is on screen').toBeVisible({timeout: 30_000});
  await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
  const step = page.locator('.con-task-host .con-ptsel, .con-task-host .con-cards__slot');
  const opened = await pressUntil(page, 'Enter', async () => await step.count() > 0, {tries: 3, settleMs: 1500});
  expect(opened, 'A on «Бактерия» opens the host’s target step').toBe(true);
  await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
  const seen = (await page.locator('.con-task-host').first().textContent() ?? '').replace(/\s+/g, ' ').slice(0, 300);
  const moved = await pressUntil(page, 'Enter', async () => (await wireOf(request, id)).waitingFor?.promptId !== before, {tries: 4, settleMs: 1500});
  expect(moved, `the target step answered Ecotec's question ${before} (${seen})`).toBe(true);
  return seen;
}

/**
 * OPEN the play composer of `card` and STOP there — the hand through the quick wheel, the card focused by the shared
 * walk, ONE A (the composer); nothing else is pressed (`playCardFromHand` presses on into the rows to commit).
 */
async function openComposer(page: Page, card: string): Promise<void> {
  const composer = page.locator('.con-composer--play');
  for (let attempt = 0; attempt < 3 && await composer.count() === 0; attempt++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
    await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 12_000}).catch(() => undefined);
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    if (!await focusCard(page, card, Math.max(slots, 1) * 3 + 4)) {
      await press(page, 'Escape', 700);
      continue;
    }
    await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
    await pressUntil(page, 'Enter', async () => await composer.count() > 0, {tries: 3, settleMs: 1500});
  }
  await expect(composer, `the play composer of «${card}» stands`).toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
}

/** Walk the composer's cursor to the `index`-th row of the series. */
async function focusSeriesRow(page: Page, index: number): Promise<void> {
  const onRow = () => page.locator(`${ROWS}.con-composer__row--focused[data-series-index="${index}"]`).count();
  for (let i = 0; i < 8 && await onRow() === 0; i++) {
    await press(page, 'ArrowUp', 250);
  }
  for (let i = 0; i < 12 && await onRow() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  expect(await onRow(), `the cursor reached the row «Метка ${index}»`).toBe(1);
}

test.describe(`PC04 Ecotec · a question per tag is a SERIES · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A · the start with MarsBot: «Сработает» before the press, +2 plants (including these 2), the bot never C40', async ({page, request}) => {
    test.setTimeout(420_000);
    const playerId = await createGameWithCards(request, [], {config: soloGameConfig({
      automa: {difficulty: 'normal'}, testMode: false,
      customCorporationsList: [CORP], startingCorporations: 1,
    })});
    await openConsole(page, playerId, PRESET.query);
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          expect(await pickCards(p, [CORP]), 'Ecotec was offered and picked').toContain(CORP);
        }
      },
    });
    await submitSummary(page);
    await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
    await settle(page, {timeoutMs: 30_000});
    expect(await focusCard(page, CORP), `never focused «${CORP}»`).toBe(true);
    const row = page.locator('[data-start-prelude-forecast] [data-forecast-row]');
    await expect(row, '«Сработает» stands on the corporation\'s status rail').toHaveCount(1, {timeout: 20_000});
    await expect(row, '…naming its +2 plants').toContainText('2');
    await shoot(page, 'a-01-forecast');
    await armTransferWitness(page);
    expect(await playQueueCard(page, CORP), 'the corporation was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.plants, {timeout: 40_000, message: 'the server: +2 plants'}).toBe(2);
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    const witness = await transferWitness(page);
    writeText('a-start.txt', transferTrail(witness));
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    const wire = await wireOf(request, playerId);
    expect(wire.game.automa?.corporation?.original, 'the bot is never Ecotec\'s twin C40').not.toBe(CORP);
    await shoot(page, 'a-02-after');
  });

  test('C · the composer: three rows as ONE group, the commit names what is left, different answers, played once', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'ecotec-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    await recordSeries(page, 'pc04-c');
    const stop = await storyboard(page, 'c-composer');
    await openComposer(page, 'Advanced Ecosystems');
    const rows = page.locator(ROWS);
    await expect(rows, 'three rows of the corporation').toHaveCount(3, {timeout: 30_000});
    await expect.poll(() => page.locator('.con-composer--play .con-composer__cta-label').textContent(), {message: 'the commit names the three owed'})
      .toMatch(/Осталось ответов: 3/);
    await expect.poll(() => rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-series-index'))), {message: 'the rows carry their places'})
      .toEqual(['1', '2', '3']);
    const labels = await rows.locator('.con-composer__row-label').allTextContents();
    writeText('c-rows.txt', labels.join('\n'));
    expect(labels[0], 'the first row names the asker and its count').toMatch(/EcoTec.*Метка 1 \/ 3/);
    expect(labels[1], 'every next row only its count').toMatch(/^\s*Метка 2 \/ 3\s*$/);
    expect(labels[2]).toMatch(/^\s*Метка 3 \/ 3\s*$/);
    await shoot(page, 'c-01-group');
    // ① a plant on row 1 — its list, the second option.
    await focusSeriesRow(page, 1);
    await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play .con-composer__sublist .con-vchoice__opt').count() > 0, {tries: 3, settleMs: 900});
    await press(page, 'ArrowDown', 300);
    await press(page, 'Enter', 900);
    await expect.poll(() => page.locator('.con-composer--play .con-composer__cta-label').textContent(), {message: 'the commit names the two left'})
      .toMatch(/Осталось ответов: 2/);
    // ② a microbe on row 2 — the first option opens the table's target step; A takes the focused candidate.
    await focusSeriesRow(page, 2);
    await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play .con-composer__sublist .con-vchoice__opt').count() > 0, {tries: 3, settleMs: 900});
    await pressUntil(page, 'Enter', async () => await page.locator('.con-ptsel').isVisible(), {tries: 3, settleMs: 900});
    await shoot(page, 'c-02-target-step');
    const candidates = await page.locator('.con-ptsel').textContent() ?? '';
    writeText('c-target-step.txt', candidates);
    await pressUntil(page, 'Enter', async () => await page.locator('.con-ptsel').count() === 0, {tries: 3, settleMs: 1200});
    // ③ a plant on row 3.
    await focusSeriesRow(page, 3);
    await pressUntil(page, 'Enter', async () => await page.locator('.con-composer--play .con-composer__sublist .con-vchoice__opt').count() > 0, {tries: 3, settleMs: 900});
    await press(page, 'ArrowDown', 300);
    await press(page, 'Enter', 900);
    await expect(page.locator(`${ROWS}.con-composer__row--missing`), 'every row answered').toHaveCount(0);
    await shoot(page, 'c-03-answered');
    // Play.
    const cta = page.locator('.con-composer--play .con-composer__cta');
    for (let i = 0; i < 10 && !(await cta.getAttribute('class') ?? '').includes('--focused'); i++) {
      await press(page, 'ArrowDown', 250);
    }
    await pressUntil(page, 'Enter', async () => (await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === 'Advanced Ecosystems'), {tries: 3, settleMs: 2000});
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    const after = await wireOf(request, id);
    const poses = await readTransient<Pose>(page, 'pc04-c');
    writeText('c-series.txt', poseReport('C · the composer series', poses));
    const holders = ['Tardigrades', 'Ants', 'GHG Producing Bacteria'];
    const landed = holders.reduce((n, h) => n + onCard(after, h) - onCard(before, h), 0);
    expect(after.thisPlayer.plants - before.thisPlayer.plants, 'the server: two plants').toBe(2);
    expect(landed, 'the server: one microbe on a holder').toBe(1);
    expect(after.waitingFor?.choiceContext?.source?.card, 'no question asked again after the press').not.toBe(CORP);
  });

  test('D · the played card holds microbes itself: the forecast ASKS, never a promised plant', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'ecotec-self', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    await openComposer(page, 'Tardigrades');
    const rows = page.locator(ROWS);
    await expect(rows, 'ONE question of the corporation — Tardigrades is its own candidate').toHaveCount(1, {timeout: 30_000});
    await expect(rows, 'a lone question carries no count').not.toHaveAttribute('data-series-index', /\d/);
    await shoot(page, 'd-01-asks');
    void id;
  });

  test('E · no holder: «Сработает: +1 растение» exactly, no question, the plant lands', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'ecotec-self', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    await armTransferWitness(page);
    expect(await playCardFromHand(page, 'Heather'), 'Heather played').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.plants, {timeout: 40_000, message: 'Heather\'s own plant + the answer'})
      .toBe(before.thisPlayer.plants + 2);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    const witness = await transferWitness(page);
    writeText('e-plant.txt', transferTrail(witness));
    expect(endsOverGlass(witness), 'no end over glass').toEqual([]);
    expect((await wireOf(request, id)).waitingFor?.choiceContext?.source?.card, 'no question').not.toBe(CORP);
  });

  test('F · the LIVE series: ONE visit, the head counts «Метка k / 3», every answer the pad\'s', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'ecotec-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    await recordSeries(page, 'pc04-f');
    const stop = await storyboard(page, 'f-live');
    await playLive(page, request, id, 'Advanced Ecosystems', 11);
    const ids: Array<number | undefined> = [];
    for (let k = 1; k <= 3; k++) {
      await expect.poll(async () => (await questionOf(request, id))?.choiceContext?.series?.index, {timeout: 30_000, message: `question ${k}`}).toBe(k);
      ids.push((await questionOf(request, id))?.promptId);
      await expect(page.locator('[data-series-count]'), `the head counts question ${k}`).toHaveAttribute('data-series-count', `${k} / 3`, {timeout: 30_000});
      await shoot(page, `f-0${k}-question`);
      await answerPlantWithPad(page, request, id);
    }
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    const after = await wireOf(request, id);
    const poses = await readTransient<Pose>(page, 'pc04-f');
    const hosts = sequence(poses, 'host');
    writeText('f-series.txt', poseReport('F · the live series', poses, [
      `promptIds: ${ids.join(' → ')}`, `host mounts: ${hosts.join(' → ')}`, `series: ${sequence(poses, 'series').join(' → ')}`,
    ]));
    // ONE visit: from the first question to the last answer the host's root is ONE node (absent before and after).
    const live = hosts.filter((h) => h !== 0);
    expect(live, `the host never left between two questions of the series (${hosts.join(' → ')})`).toHaveLength(1);
    expect(sequence(poses, 'series').filter((s) => s !== ''), 'the count only moves forward').toEqual(['1 / 3', '2 / 3', '3 / 3']);
    // One object per card: while the host stands, the corporation's answer lifts the face in its dock — never a second
    // instance risen at the reaction layer over the plate.
    expect(poses.filter((p) => p.v.host !== 0 && p.v.faces > 0).map((p) => Math.round(p.t)), 'no second face over the standing host').toEqual([]);
    expect(after.thisPlayer.plants - before.thisPlayer.plants, 'the server: three plants').toBe(3);
  });

  test('F2 · the LIVE series answered with MICROBES through the host\'s target step: ONE visit over the nested pick', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'ecotec-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    await recordSeries(page, 'pc04-f2');
    const stop = await storyboard(page, 'f2-live-microbes');
    await playLive(page, request, id, 'Advanced Ecosystems', 11);
    const steps: Array<string> = [];
    for (let k = 1; k <= 3; k++) {
      await expect.poll(async () => (await questionOf(request, id))?.choiceContext?.series?.index, {timeout: 30_000, message: `question ${k}`}).toBe(k);
      await expect(page.locator('[data-series-count]'), `the head counts question ${k}`).toHaveAttribute('data-series-count', `${k} / 3`, {timeout: 30_000});
      if (k === 2) {
        await answerPlantWithPad(page, request, id);
      } else {
        steps.push(await answerMicrobeWithPad(page, request, id));
        await shoot(page, `f2-0${k}-after-microbe`);
      }
    }
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    const after = await wireOf(request, id);
    const poses = await readTransient<Pose>(page, 'pc04-f2');
    const hosts = sequence(poses, 'host');
    const holders = ['Tardigrades', 'Ants', 'GHG Producing Bacteria'];
    const landed = holders.map((h) => `${h} +${onCard(after, h) - onCard(before, h)}`);
    writeText('f2-series.txt', poseReport('F2 · the live series, microbes', poses, [
      `host mounts: ${hosts.join(' → ')}`, `series: ${sequence(poses, 'series').join(' → ')}`, `landed: ${landed.join(' · ')}`,
      ...steps.map((t, i) => `step ${i + 1}: ${t}`),
    ]));
    expect(after.thisPlayer.plants - before.thisPlayer.plants, 'the server: one plant (answer 2)').toBe(1);
    expect(holders.reduce((n, h) => n + onCard(after, h) - onCard(before, h), 0), `the server: two microbes on holders (${landed.join(' · ')})`).toBe(2);
    expect(hosts.filter((h) => h !== 0), `the host never left between two questions (${hosts.join(' → ')})`).toHaveLength(1);
    expect(sequence(poses, 'series').filter((v) => v !== ''), 'the count only moves forward').toEqual(['1 / 3', '2 / 3', '3 / 3']);
    expect(poses.filter((p) => p.v.host !== 0 && p.v.faces > 0).map((p) => Math.round(p.t)), 'no second face over the standing host').toEqual([]);
    expect(after.waitingFor?.choiceContext?.source?.card, 'no question asked again').not.toBe(CORP);
  });

  test('G · the class\'s control: Viral Enhancers on Ecological Zone counts the same series', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'ecotec-viral', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    await recordSeries(page, 'pc04-g');
    await playLive(page, request, id, 'Ecological Zone', 12);
    await expect.poll(async () => (await wireOf(request, id)).waitingFor?.type, {timeout: 30_000}).toBe('space');
    const space = (await wireOf(request, id)).waitingFor;
    await sendPlayerInputSynced(page, request, id, {type: 'space', spaceId: (space?.spaces ?? [])[0]});
    for (let k = 1; k <= 2; k++) {
      await expect.poll(async () => (await questionOf(request, id, 'Viral Enhancers'))?.choiceContext?.series?.index, {timeout: 30_000}).toBe(k);
      await expect(page.locator('[data-series-count]'), `Viral's head counts question ${k}`).toHaveAttribute('data-series-count', `${k} / 2`, {timeout: 30_000});
      await shoot(page, `g-0${k}-question`);
      await answerPlantWithPad(page, request, id, 'Viral Enhancers');
    }
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    const poses = await readTransient<Pose>(page, 'pc04-g');
    writeText('g-series.txt', poseReport('G · the viral series', poses, [`decision mounts: ${sequence(poses, 'decision').join(' → ')}`]));
    expect(sequence(poses, 'decision').filter((d) => d !== 0), 'one visit').toHaveLength(1);
  });

  test('H · a reload in the middle of the live series: question 2 stands with its count', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'ecotec-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    await playLive(page, request, id, 'Advanced Ecosystems', 11);
    await expect.poll(async () => (await questionOf(request, id))?.choiceContext?.series?.index, {timeout: 30_000}).toBe(1);
    await answerPlantWithPad(page, request, id);
    await expect.poll(async () => (await questionOf(request, id))?.choiceContext?.series?.index, {timeout: 30_000}).toBe(2);
    await reloadConsole(page);
    await syncClient(page, request, id);
    await expect(page.locator('[data-series-count]'), 'question 2 stands with its count after the reload').toHaveAttribute('data-series-count', '2 / 3', {timeout: 60_000});
    await shoot(page, 'h-01-reload');
  });

  test('I · a card without a bio tag: no row, no token', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'ecotec-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    expect(await playCardFromHand(page, 'Power Plant'), 'Power Plant played').toBe(true);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    const after = await wireOf(request, id);
    expect(after.thisPlayer.plants, 'no plant').toBe(before.thisPlayer.plants);
    expect(after.waitingFor?.choiceContext?.source?.card, 'no question').not.toBe(CORP);
  });
});
