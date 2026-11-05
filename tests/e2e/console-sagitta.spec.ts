import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, playQueueCard, press, pressUntil, reloadConsole, settle, waitQueueIdle} from './consoleStart';
import {readTransient, recordTransient} from './transientRecorder';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * PC03 SAGITTA FRONTIER SERVICES — «ВСКРЫТИЕ КОРПОРАЦИИ — ТРИ ИСТОРИИ ОДНОГО НАЖАТИЯ»
 * (docs/claude/prompts/prelude2-pc03-sagitta-frontier-services.md, ledgers GT · GU). One press on the corporation
 * carries the printed start (31 M€, energy and M€ production), the named search «без меток» and the corporation's own
 * answer to its own play (+4 M€) — each a story of its own, in turn:
 *
 *   A · the reveal (`sagitta-start`, the tape Mine ✗ · Indentured Workers ✗ · Quantum Research ✗ · Micro-Mills ✓):
 *       before the press the promise; after it the M€ row by samples (when it ticks, to what), every token's ends,
 *       the search's rule and discards with their reasons, the card into the hand; the server 35 M€ and Micro-Mills.
 *   B · a card with no tags from the hand (`sagitta-table`, Micro-Mills): «Сработает: +4 M€», one answer on the row.
 *   C · exactly one tag (Mine) and an event with no printed tag (Indentured Workers): «+1 M€».
 *   D · two tags (Development Center): silence — no row of the corporation, the row moves by the price alone.
 *   E · a lone wild tag (Quantum Research): +4 — the card the search threw away «for its wild tag» pays as no tags.
 *   H · a reload after B: the counts stand, nothing is told again.
 *
 * Every report and frame: `screenshots/pc03/` (`TM_E2E_STORYBOARD=1` — the storyboards of A and B).
 */

const CORP = 'Sagitta Frontier Services';
const OUT = path.resolve('screenshots', 'pc03');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type Wire = {
  waitingFor?: {type: string},
  cardsInHand?: Array<{name: string}>,
  thisPlayer: {megacredits: number, energyProduction: number, megaCreditProduction?: number, noTagsCount?: number, tableau: Array<{name: string}>},
  game: {gameAge: number, automa?: {corporation?: {id: string, original: string}}},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const handOf = (w: Wire) => (w.cardsInHand ?? []).map((c) => c.name);

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
 * WHAT THE PLAYER SEES OF THE REVEAL, off the product's own writes: the rail's M€ digits and the two production cells,
 * the dock's count, the search badge (the server's numbers + the rule's signature), a reveal standing (in the start or
 * outside it), the deck dealing, the reaction layer's faces, the start scene's serving answer, the queue card's reading.
 */
type Pose = {
  mc: string, energyProd: string, mcProd: string, dock: string,
  badge: string, rule: string, reveal: string, deal: number,
  faces: number, lifted: number, serves: string, reading: string, forecast: string, bar: string,
};
async function recordReveal(page: Page, key: string): Promise<void> {
  await recordTransient(page, key, (): Pose => {
    const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const digits = (row: string) => {
      const el = document.querySelector(`.con-res__row--${row} .con-res__digits`);
      return el?.firstChild?.nodeValue?.trim() ?? text(el);
    };
    const badge = document.querySelector('[data-reveal-search]');
    const reveals = Array.from(document.querySelectorAll('.con-reveal'));
    return {
      mc: digits('megacredits'),
      energyProd: text(document.querySelector('.con-res__row--energy .con-res__prod')),
      mcProd: text(document.querySelector('.con-res__row--megacredits .con-res__prod')),
      dock: document.querySelector('[data-hand-total]')?.getAttribute('data-hand-total') ?? '',
      badge: badge === null ? '' : ['revealed', 'taken', 'discarded', 'exhausted'].map((k) => badge.getAttribute(`data-search-${k}`) ?? '-').join('/'),
      rule: document.querySelector('[data-reveal-search] [data-draw-search]')?.getAttribute('data-draw-search') ?? '',
      reveal: reveals.map((r) => (r.closest('.con-start') !== null ? 'start' : r.closest('.con-hand') !== null ? 'hand' : 'band')).join(','),
      deal: document.querySelectorAll('.con-deckdraw').length,
      faces: document.querySelectorAll('.con-reaction__face[data-reaction-card]').length,
      lifted: document.querySelectorAll('[data-reaction-lifted]').length,
      serves: document.querySelector('[data-start-serves]')?.getAttribute('data-start-serves') ?? '',
      reading: text(document.querySelector('[data-qcard-reading]')).slice(0, 60),
      forecast: text(document.querySelector('[data-start-prelude-forecast] [data-forecast-row]')).slice(0, 80),
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

/** Every distinct value a field took, in order. */
function sequence<K extends keyof Pose>(poses: ReadonlyArray<{v: Pose}>, field: K): Array<Pose[K]> {
  const out: Array<Pose[K]> = [];
  for (const s of poses) {
    if (out[out.length - 1] !== s.v[field]) {
      out.push(s.v[field]);
    }
  }
  return out;
}

/** Console lines the start / screen / transfer sentinels write — collected for the report. */
function watchConsole(page: Page): Array<string> {
  const lines: Array<string> = [];
  page.on('console', (msg) => {
    const t = msg.text();
    if (/told twice|end not painted|surface folded|start-stranded|start-shadow|screen-shadow|\[liveness\]|\[transfer\]/.test(t)) {
      lines.push(t.slice(0, 400));
    }
  });
  return lines;
}

/** Take the drawn batch (A) until the server's hand holds `names` and no reveal stands. */
async function take(page: Page, request: APIRequestContext, id: string, names: ReadonlyArray<string>): Promise<Wire> {
  for (let i = 0; i < 12; i++) {
    const wire = await wireOf(request, id);
    if (names.every((n) => handOf(wire).includes(n)) && await page.locator('.con-reveal').count() === 0) {
      return wire;
    }
    if (await page.locator('.con-reveal').count() > 0) {
      await press(page, 'Enter', 900);
    } else {
      await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    }
  }
  return wireOf(request, id);
}

/** The play composer's «⚡ Сработает» line — an EXACT answer of the table reads there (a question would be a reactor row). */
const ROWS = '.con-composer--play [data-forecast-row]';

/**
 * OPEN the play composer of `card` and STOP there — the hand through the quick wheel, the card focused by the shared
 * walk, ONE A (the composer).
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

/** Walk to the composer's commit and press it until the server holds the card on the table. */
async function commitComposer(page: Page, request: APIRequestContext, id: string, card: string): Promise<void> {
  const cta = page.locator('.con-composer--play .con-composer__cta');
  for (let i = 0; i < 10 && !(await cta.getAttribute('class') ?? '').includes('--focused'); i++) {
    await press(page, 'ArrowDown', 250);
  }
  const played = await pressUntil(page, 'Enter', async () => (await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === card), {tries: 3, settleMs: 2000});
  expect(played, `«${card}» was played`).toBe(true);
}

/** The pad's readiness, off the product's own aggregate (`__conReady`). */
type Ready = {pad: boolean, quiet: boolean, age: number, why: string};
async function recordReady(page: Page, key: string): Promise<void> {
  await recordTransient(page, key, (): Ready => {
    type Snap = {
      absorbers?: Array<string>, holds?: Array<string>, wsDepth?: number,
      transport?: {gameAge: number, waitingForType?: string, requestInProgress: boolean, holding: boolean},
      reaction?: {phase: string},
    };
    const r = (window as unknown as {__conReady?: () => Snap}).__conReady?.();
    const t = r?.transport;
    const pad = t !== undefined && t.waitingForType === 'or' && !t.requestInProgress && !t.holding &&
      (r?.absorbers ?? []).length === 0 && !(r?.holds ?? []).some((h) => h.endsWith('[blocking]')) && (r?.wsDepth ?? 0) === 0;
    const why = pad ? '' : [
      t === undefined ? 'no-transport' : '',
      t !== undefined && t.waitingForType !== 'or' ? `wf:${t.waitingForType}` : '',
      t?.requestInProgress === true ? 'request' : '',
      t?.holding === true ? 'transport-holding' : '',
      ...(r?.absorbers ?? []).map((a) => `absorb:${a}`),
      ...(r?.holds ?? []).filter((h) => h.endsWith('[blocking]')),
      (r?.wsDepth ?? 0) !== 0 ? `ws:${r?.wsDepth}` : '',
    ].filter((x) => x !== '').join(' ');
    return {pad, quiet: (r?.holds ?? []).length === 0 && r?.reaction?.phase === 'idle', age: t?.gameAge ?? 0, why};
  });
}

test.describe(`PC03 Sagitta Frontier Services · the reveal's three stories · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A · the reveal: the promise before the press, the printed start, the search «без меток», its own +4 — in turn', async ({page, request}) => {
    test.setTimeout(420_000);
    const sentinels = watchConsole(page);
    const id = await bootFixture(page, request, 'sagitta-start', {query: PRESET.query, landing: 'prompt'});
    await settle(page, {timeoutMs: 30_000});
    await expect(page.locator(`.con-start [data-queue-slot="${CORP}"]`), 'the corporation stands in the deployment queue').toHaveCount(1, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    expect(await focusCard(page, CORP), `focused «${CORP}»`).toBe(true);
    await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    const before = await wireOf(request, id);
    await shoot(page, 'a-01-queue');
    const promise = {
      reading: (await page.locator('[data-qcard-reading]').first().textContent().catch(() => '') ?? '').replace(/\s+/g, ' ').trim(),
      forecast: (await page.locator('[data-start-prelude-forecast] [data-forecast-row]').allTextContents().catch(() => [])).map((t) => t.replace(/\s+/g, ' ').trim()),
      search: await page.locator('.con-start [data-draw-search]').evaluateAll((els) => els.map((e) => e.getAttribute('data-draw-search'))).catch(() => []),
    };

    await armTransferWitness(page);
    await recordReveal(page, 'a');
    const stop = await storyboard(page, 'a-reveal');
    expect(await playQueueCard(page, CORP), 'the corporation was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000, message: 'the server: 35 M€'}).toBe(35);
    await page.locator('[data-reveal-search]').first().waitFor({timeout: 60_000}).catch(() => undefined);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await shoot(page, 'a-02-search');
    const after = await take(page, request, id, ['Micro-Mills']);
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'a-03-after');

    const poses = await readTransient<Pose>(page, 'a');
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    writeText('a-reveal.txt', poseReport('A · the reveal', poses, [
      `promise ${JSON.stringify(promise)}`,
      `mc ${JSON.stringify(sequence(poses, 'mc'))}`,
      `energyProd ${JSON.stringify(sequence(poses, 'energyProd'))} mcProd ${JSON.stringify(sequence(poses, 'mcProd'))}`,
      `badge ${JSON.stringify(sequence(poses, 'badge'))} rule ${JSON.stringify(sequence(poses, 'rule'))} reveal ${JSON.stringify(sequence(poses, 'reveal'))}`,
      `serves ${JSON.stringify(sequence(poses, 'serves'))}`,
      `sentinels ${JSON.stringify(sentinels)}`,
      '# transfer trail', trail,
    ]));

    // The server: the printed start + its own +4, the productions, the card the search kept, the bot off its twin.
    expect(after.thisPlayer.megacredits - before.thisPlayer.megacredits, '31 printed + 4 for its own play').toBe(35);
    expect(after.thisPlayer.energyProduction, 'energy production +1').toBe(1);
    expect(handOf(after), 'Micro-Mills — the first card with no tag — in the hand').toContain('Micro-Mills');
    expect(after.thisPlayer.noTagsCount, 'the rail\'s «no tags» count: Sagitta itself').toBe(1);
    expect(after.game.automa?.corporation?.original, 'the bot is never Sagitta\'s twin C44').not.toBe(CORP);
    // The search named its rule; every end of every token visible.
    expect(sequence(poses, 'rule'), 'the reveal named its rule «без меток»').toContain('noTags');
    expect(endsOverGlass(witness), `every end visible\n${trail}`).toEqual([]);
    // THREE STORIES, IN TURN (the «ДО» verdict of decision 8 — what the stand pins): the row reads 31 from the printed
    // start before anything else, reaches 35 by touchdowns only (one token per M€ off the effect row's printed «4»),
    // and the search's rule stands only after the last of them.
    const mc = sequence(poses, 'mc');
    expect(mc.slice(0, 2), 'the printed start first: 0 → 31 on the touchdown').toEqual(['0', '31']);
    expect(mc[mc.length - 1], 'its own +4 on top: 35').toBe('35');
    expect(mc.every((v) => ['0', '31', '32', '33', '34', '35'].includes(v)), `never a count past the touchdowns (${mc.join(' → ')})`).toBe(true);
    const births = witness.births.filter((b) => b.under.startsWith(`reactor:${CORP}:megacredit`));
    expect(births.map((b) => b.value), `the printed 31, then four units off the effect row (trail:\n${trail})`).toEqual(['+31', '+1', '+1', '+1', '+1']);
    const lastAnswer = poses.findIndex((p) => p.v.mc === '35');
    const firstRule = poses.findIndex((p) => p.v.rule === 'noTags');
    expect(lastAnswer >= 0 && firstRule > lastAnswer, 'the search reveals after the row has told both M€ stories').toBe(true);
    expect(sequence(poses, 'reveal').filter((r) => r !== '')[0], 'the search stands INSIDE the start\'s body').toBe('start');
    expect(promise.forecast.join(' '), '«Сработает: +4» before the press').toMatch(/\+4/);
    expect(sentinels.filter((l) => /told twice|end not painted|surface folded|start-stranded/.test(l)), 'no sentinel').toEqual([]);
  });

  test('B · a card with no tags from the hand: «Сработает: +4 M€», ONE answer on the M€ row, the count +1; H · a reload after it', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'sagitta-table', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    await openComposer(page, 'Micro-Mills');
    await expect(page.locator(ROWS), '«Сработает» stands').toHaveCount(1, {timeout: 30_000});
    await expect(page.locator(ROWS), '…with its +4').toContainText('4');
    await shoot(page, 'b-01-composer');
    await armTransferWitness(page);
    const stop = await storyboard(page, 'b-play');
    await commitComposer(page, request, id, 'Micro-Mills');
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000, message: 'the server: −3 price, +4 answer'})
      .toBe(before.thisPlayer.megacredits - 3 + 4);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'b-02-after');
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    writeText('b-play.txt', trail);
    const answer = witness.births.filter((b) => b.under.includes(CORP));
    expect(answer.length, `the answer is born on the corporation (trail:\n${trail})`).toBeGreaterThan(0);
    expect(answer.every((b) => witness.landings.find((l) => l.id === b.id)?.under === 'rail:megacredits'), `…and lands on the M€ row (trail:\n${trail})`).toBe(true);
    expect(endsOverGlass(witness), 'no end over glass').toEqual([]);
    const after = await wireOf(request, id);
    expect(after.thisPlayer.noTagsCount, 'the rail\'s «no tags» count: Sagitta + Micro-Mills').toBe((before.thisPlayer.noTagsCount ?? 0) + 1);

    // H · a reload after the answer: the counts stand, nothing is told again.
    await reloadConsole(page);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    const again = await wireOf(request, id);
    expect(again.thisPlayer.megacredits, 'the M€ unchanged by the reload').toBe(after.thisPlayer.megacredits);
    await expect.poll(async () => (await page.locator('.con-res__row--megacredits .con-res__digits').first().textContent() ?? '').trim(),
      {timeout: 20_000, message: 'the row reads the server\'s number'}).toContain(String(after.thisPlayer.megacredits));
  });

  for (const run of [
    {key: 'C1', card: 'Mine', cost: 4, gain: 1, what: 'exactly one tag: «+1»'},
    {key: 'C2', card: 'Indentured Workers', cost: 0, gain: 1, what: 'an event with no printed tag: «+1» (the event tag is a tag)'},
    {key: 'D', card: 'Development Center', cost: 11, gain: 0, what: 'two tags: silence'},
    {key: 'E', card: 'Quantum Research', cost: 9, gain: 4, what: 'a lone wild tag: «+4» (the effect ignores it; the search threw it away)'},
  ] as const) {
    test(`${run.key} · ${run.what}`, async ({page, request}) => {
      test.setTimeout(420_000);
      const id = await bootFixture(page, request, 'sagitta-table', {query: PRESET.query});
      await settle(page, {timeoutMs: 30_000});
      const before = await wireOf(request, id);
      await openComposer(page, run.card);
      if (run.gain > 0) {
        await expect(page.locator(ROWS), `«Сработает» stands on ${run.card}`).toHaveCount(1, {timeout: 30_000});
        await expect(page.locator(ROWS), `…with its +${run.gain}`).toContainText(String(run.gain));
      } else {
        await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
        await expect(page.locator(ROWS), 'no «Сработает» line — not «almost», not «will not trigger»').toHaveCount(0);
      }
      await shoot(page, `${run.key.toLowerCase()}-01-composer`);
      await armTransferWitness(page);
      await commitComposer(page, request, id, run.card);
      await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000, message: `the server: −${run.cost} +${run.gain}`})
        .toBe(before.thisPlayer.megacredits - run.cost + run.gain);
      await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
      const witness = await transferWitness(page);
      writeText(`${run.key.toLowerCase()}-play.txt`, transferTrail(witness));
      expect(endsOverGlass(witness), 'no end over glass').toEqual([]);
      if (run.gain === 0) {
        expect(witness.births.filter((b) => b.under.includes(CORP)), 'no token of the corporation').toEqual([]);
      }
    });
  }

  /**
   * T · THE FREQUENT ANSWER COSTS NO TIME (decision 11): one play of Mine (one tag) on the table WITH Sagitta and on its
   * twin WITHOUT it, eight times each, interleaved — from the play's POST to the pad accepting the next action (the
   * action menu stands, no request in flight, no transport hold, no BLOCKING hold, no input absorber, the board home) and
   * to the scene's end (no hold at all, the reaction idle). The answer «+1 M€» plays BESIDE the pad.
   */
  test('T · the «+1» answer beside the pad: the time to the pad with Sagitta vs its twin', async ({page, request}) => {
    test.setTimeout(1_800_000);
    const runs: Array<{table: string, pad: number, end: number}> = [];
    for (let i = 0; i < 16; i++) {
      const table = i % 2 === 0 ? 'sagitta-table' : 'sagitta-twin';
      const id = await bootFixture(page, request, table, {query: PRESET.query});
      await settle(page, {timeoutMs: 30_000});
      const before = await wireOf(request, id);
      await openComposer(page, 'Mine');
      let posted = 0;
      const onRequest = (r: {method: () => string, url: () => string}) => {
        if (posted === 0 && r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posted = Date.now();
        }
      };
      page.on('request', onRequest);
      await recordReady(page, `t${i}`);
      await commitComposer(page, request, id, 'Mine');
      await expect.poll(async () => (await wireOf(request, id)).thisPlayer.megacredits, {timeout: 40_000})
        .toBe(before.thisPlayer.megacredits - 4 + (table === 'sagitta-table' ? 1 : 0));
      await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
      page.off('request', onRequest);
      const samples = await readTransient<Ready>(page, `t${i}`);
      const after = samples.filter((s) => s.t >= posted);
      const pad = after.find((s) => s.v.pad && s.v.age > before.game.gameAge);
      const end = after.find((s) => s.v.pad && s.v.quiet && s.v.age > before.game.gameAge);
      runs.push({table, pad: pad === undefined ? -1 : Math.round(pad.t - posted), end: end === undefined ? -1 : Math.round(end.t - posted)});
      if (i < 2) {
        writeText(`t-why-${table}.txt`, after.map((x) => `${Math.round(x.t - posted)} ${JSON.stringify(x.v)}`).join('\n'));
      }
    }
    const stats = (table: string, field: 'pad' | 'end') => {
      const v = runs.filter((r) => r.table === table).map((r) => r[field]).sort((a, b) => a - b);
      return {median: v[Math.floor(v.length / 2)], min: v[0], max: v[v.length - 1], all: v};
    };
    const report = {
      sagitta: {pad: stats('sagitta-table', 'pad'), end: stats('sagitta-table', 'end')},
      twin: {pad: stats('sagitta-twin', 'pad'), end: stats('sagitta-twin', 'end')},
    };
    writeText('t-timing.txt', JSON.stringify(report, null, 1) + '\n' + JSON.stringify(runs));
    test.info().annotations.push({type: 'pc03-timing', description: JSON.stringify(report)});
    expect(runs.every((r) => r.pad > 0), `every run reached the pad (${JSON.stringify(runs)})`).toBe(true);
  });
});
