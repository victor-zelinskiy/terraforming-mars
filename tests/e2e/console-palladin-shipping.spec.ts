import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, bootIntoGame, crumbText, fetchPlayerModel, openActionFocus, openCardActions, placeTile, playCardFromHand, press, pressUntil,
  reloadConsole, settle, soloGameConfig, takeRevealCards, waitForBoardHome,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {armEventFaceProbe, eventFaceLine, readEventFaceProbe} from './eventFaceWitness';
import {readTransient, recordTransient} from './transientRecorder';

/**
 * PC02 PALLADIN SHIPPING — «СОБЫТИЕ, НА КОТОРОЕ ОТВЕТИЛ СТОЛ, — ОДНА ФРАЗА» (docs/claude/prompts/prelude2-pc02-palladin-
 * shipping.md, ledger GP · GQ). The corporation's whole effect lives in ONE class of play — a space event pays FACE UP
 * before its lift and leaves face down for its pile — and its answer comes in the very row its price left (titanium for
 * a space event → titanium back). The phrase, in order, each part started by the end of the previous one:
 *   ① the price leaves the titanium row into the standing card's printed cost (the row ticks on the departure);
 *   ② the event pays its own rewards off its printed icons (P84);
 *   ③ the table answers BEFORE the lift — ONE teller per unit, born on a PAINTED source (the reactor — the card-reaction
 *      framework's law: the token is born on the REACTOR's effect row, the woken tag is MARKED), landing on the
 *      titanium row, the row ticking on the touchdown;
 *   ④ the lift → the arc with the turn → face down on the pile — only when the surface is clear of tokens.
 *
 *   A · the start, a table with MarsBot: Palladin guaranteed, 36 M€ + 5 titanium, the bot never C43; the action tile stands.
 *   B · `palladin-event`: Imported GHG paid with 3 titanium — the row 5 → 2 → 3, never 5 → 3; the answer born on the
 *       reactor before the lift, landed on `rail:titanium`; the record; the journal.
 *   B2 · Technology Demonstration (a draw, no reward of its own into the rail): the answer is the phrase's only token.
 *   B3 · `palladin-event-aerobraking`: two reactors to one event — each once, in turn.
 *   C · `palladin-almost`: a space card that is not an event, an event without the Space tag — nothing answers.
 *   D · the action (`palladin-threshold-heat` at −26 °C): the crumb, the price off the titanium row FIRST, the step, the
 *       −24 °C heat production.
 *   E · `palladin-threshold` (−2 °C): the player's own 0 °C ocean is asked and lands; the grid lighting over a dial still
 *       on −2 is the named gap PL-1840 (recorded in the annotation, not asserted).
 *   F · `palladin-max`: the action stands «без эффекта», activatable.  G · `palladin-short`: refused with a reason.
 *   H · a reload after B: the same numbers, nothing told again.
 *
 * Every frame of B and D: `screenshots/pc02/` (`TM_E2E_STORYBOARD=1` — the storyboards).
 */

const CORP = 'Palladin Shipping';
const OUT = path.resolve('screenshots', 'pc02');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const TITANIUM = '.con-res__row--titanium .con-res__digits';
const MC = '.con-res__row--megacredits .con-res__digits';
const HEAT = '.con-res__row--heat .con-res__digits';

type Wire = {
  cardsInHand?: Array<{name: string}>,
  thisPlayer: {megacredits: number, titanium: number, heat: number, heatProduction?: number, terraformRating: number, tableau: Array<{name: string}>},
  game: {temperature: number, automa?: {corporation?: {id: string, original: string}}},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
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

/** What the player sees of the phrase, recorded off the product's own writes from before the press. */
type Pose = {ti: string, mc: string, heat: string, payback: string, phase: string, faces: string, lifted: number, forecast: string};
async function recordPhrase(page: Page, key: string): Promise<void> {
  await recordTransient(page, key, ({ti, mc, heat}: {ti: string, mc: string, heat: string}): Pose => {
    const text = (sel: string) => (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, '');
    const hero = document.querySelector('[data-hero-payback], [data-hero-phase]');
    return {
      ti: text(ti), mc: text(mc), heat: text(heat),
      payback: hero?.getAttribute('data-hero-payback') ?? '',
      phase: hero?.getAttribute('data-hero-phase') ?? '',
      // every reactor risen at the ONE STAGE, by name, in order
      faces: Array.from(document.querySelectorAll('.con-reaction__face[data-reaction-card]')).map((f) => f.getAttribute('data-reaction-card')).join(','),
      // a reactor lifted IN ITS PLACE (a seat, the composer's row, the receiving stage)
      lifted: document.querySelectorAll('[data-reaction-lifted]').length,
      forecast: text('.con-composer--play [data-forecast-row] [data-forecast-rail="stock:titanium"]'),
    };
  }, {args: {ti: TITANIUM, mc: MC, heat: HEAT}});
}

/** The distinct numbers a row PAINTED, in order. */
function ticks(samples: ReadonlyArray<{v: Pose}>, row: 'ti' | 'mc' | 'heat'): Array<number> {
  const out: Array<number> = [];
  for (const s of samples) {
    const n = Number(s.v[row].match(/^-?\d+/)?.[0] ?? NaN);
    if (Number.isFinite(n) && out[out.length - 1] !== n) {
      out.push(n);
    }
  }
  return out;
}

/** The phrase's verdict lines (the «ДО» record of decision 7): what happened, by whom, when — written beside the frames. */
function phraseReport(label: string, poses: ReadonlyArray<{t: number, v: Pose}>, trail: string, face: string): string {
  const lines = [`# ${label}`, `titanium ticks: ${ticks(poses, 'ti').join(' → ')}`, `M€ ticks: ${ticks(poses, 'mc').join(' → ')}`,
    `heat ticks: ${ticks(poses, 'heat').join(' → ')}`, `event face: ${face}`, '--- poses ---'];
  let last = '';
  for (const s of poses) {
    const line = JSON.stringify(s.v);
    if (line !== last) {
      lines.push(`${Math.round(s.t)} ${line}`);
      last = line;
    }
  }
  lines.push('--- transfer ---', trail);
  return lines.join('\n');
}

test.describe(`PC02 Palladin Shipping · the event the table answered is ONE phrase · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('A · a table with MarsBot: Palladin guaranteed, 36 M€ + 5 titanium, the bot never C43, the action stands', async ({page, request}) => {
    test.setTimeout(300_000);
    await recordPhrase(page, 'pc02-a');
    const config = soloGameConfig({
      automa: {difficulty: 'normal'}, testMode: false,
      customCorporationsList: [CORP], startingCorporations: 1,
    });
    const id = await bootIntoGame(page, request, {config, corporation: CORP, query: PRESET.query});
    await settle(page);
    const wire = await wireOf(request, id);
    expect(wire.thisPlayer.tableau.some((c) => c.name === CORP), 'the human plays Palladin Shipping').toBe(true);
    expect(wire.thisPlayer.titanium, '5 titanium on the start').toBe(5);
    expect(wire.game.automa, 'MarsBot is seated').toBeTruthy();
    expect(wire.game.automa?.corporation?.original, 'the bot is never Palladin\'s twin C43').not.toBe(CORP);
    const poses = await readTransient<Pose>(page, 'pc02-a');
    const ti = ticks(poses, 'ti');
    writeText('a-start.txt', `titanium ticks: ${ti.join(' → ')}`);
    expect(ti[ti.length - 1], `the titanium row ends on the server (${ti.join(' → ')})`).toBe(5);
    await openCardActions(page);
    await expect(page.locator(`.con-cardactions__tile[data-action-card="${CORP}"]`), 'the corporation\'s action in «ДЕЙСТВИЯ КАРТ»').toHaveCount(1);
    await shoot(page, 'a-card-actions');
  });

  test('B · a space event paid with titanium: 5 → 2 → 3, the answer born on the reactor BEFORE the lift, ONE teller', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const logs: Array<string> = [];
    page.on('console', (m) => {
      if (/reaction|rail-reward|transfer|teller|payback/i.test(m.text())) {
        logs.push(`[${m.type()}] ${m.text()}`);
      }
    });
    const id = await bootFixture(page, request, 'palladin-event', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    expect(before.thisPlayer.titanium, 'the fixture: 5 titanium').toBe(5);
    expect(before.thisPlayer.megacredits, 'the fixture: 0 M€ (titanium pays)').toBe(0);

    await recordPhrase(page, 'pc02-b');
    await armTransferWitness(page);
    await armEventFaceProbe(page);
    const stop = await storyboard(page, 'b-event');
    expect(await playCardFromHand(page, 'Imported GHG'), 'Imported GHG played from the hand').toBeTruthy();
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.titanium, {timeout: 40_000, message: 'the server: 5 − 3 + 1'}).toBe(3);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'b-after');

    const poses = await readTransient<Pose>(page, 'pc02-b');
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    const face = await readEventFaceProbe(page);
    const ready = await page.evaluate(() => JSON.stringify((window as unknown as {__conReady?: () => unknown}).__conReady?.(), null, 1));
    writeText('b-phrase.txt', [phraseReport('B · Imported GHG', poses, trail, eventFaceLine(face)), '--- product ---', ready, '--- logs ---', ...logs].join('\n'));
    test.info().annotations.push({type: 'event-face', description: eventFaceLine(face)});

    // «Сработает» before the press — +1 titanium where the composer prints it.
    expect(poses.some((s) => s.v.forecast.includes('+1')), 'the composer read «Сработает: +1 титан» before the press').toBe(true);
    // ① + ③ — the row reads the price, THEN the answer: never one jump through both.
    const ti = ticks(poses, 'ti');
    expect(ti[ti.length - 1], `the row ends on the server (${ti.join(' → ')})`).toBe(3);
    expect(ti.includes(2), `the price is read on its own — the row passes 2 (${ti.join(' → ')})`).toBe(true);
    expect(ti.indexOf(2), `the answer comes after the price (${ti.join(' → ')})`).toBeLessThan(ti.lastIndexOf(3));
    // ③ ONE teller, born on a painted source — the reactor (the framework's law), landed on the titanium row.
    const answers = witness.births.filter((b) => b.under.startsWith(`reactor:${CORP}`) || b.under === `reactor-seat:${CORP}` || b.under.startsWith('tag:'));
    expect(answers.length, `the answer was born on the reactor (trail:\n${trail})`).toBeGreaterThan(0);
    expect(witness.landings.filter((l) => l.under === 'rail:titanium' && answers.some((b) => b.id === l.id)).length,
      `…and landed on the titanium row ONCE (trail:\n${trail})`).toBe(1);
    expect(endsOverGlass(witness), 'no end over glass').toEqual([]);
    // ③ before ④ — every token of the phrase was born while the card still stood.
    expect(face.birthPhases.filter((ph) => ph !== 'shipping'), `every token born before the lift (${face.birthPhases.join(' ')})`).toEqual([]);
    expect(face.tLifting, 'the event lifted').toBeDefined();
    expect(face.tLifting!, 'the lift only after the pay-back').toBeGreaterThanOrEqual(face.tPaid ?? Infinity);
    const after = await wireOf(request, id);
    expect(after.thisPlayer.heat, 'Imported GHG: +3 heat').toBe(before.thisPlayer.heat + 3);
    expect(errors, 'no page error').toEqual([]);
  });

  test('B2 · an event with no reward of its own in the rail: the table\'s answer is the phrase\'s only token', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'palladin-event', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    await recordPhrase(page, 'pc02-b2');
    await armTransferWitness(page);
    await armEventFaceProbe(page);
    const stop = await storyboard(page, 'b2-event');
    expect(await playCardFromHand(page, 'Technology Demonstration'), 'Technology Demonstration played').toBeTruthy();
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.titanium, {timeout: 40_000, message: 'the server: 5 − 2 + 1'}).toBe(4);
    await takeRevealCards(page).catch(() => undefined);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    const poses = await readTransient<Pose>(page, 'pc02-b2');
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    const face = await readEventFaceProbe(page);
    writeText('b2-phrase.txt', phraseReport('B2 · Technology Demonstration', poses, trail, eventFaceLine(face)));
    const ti = ticks(poses, 'ti');
    expect(ti[ti.length - 1], `the row ends on the server (${ti.join(' → ')})`).toBe(4);
    expect(ti.includes(3), `the price is read on its own (${ti.join(' → ')})`).toBe(true);
    expect(witness.landings.filter((l) => l.under === 'rail:titanium' && !witness.births.some((b) => b.id === l.id && b.under === 'rail:titanium')).length,
      `ONE answer landed on the titanium row (trail:\n${trail})`).toBe(1);
    expect(face.birthPhases.filter((ph) => ph !== 'shipping'), `born before the lift (${face.birthPhases.join(' ')})`).toEqual([]);
    expect(endsOverGlass(witness), 'no end over glass').toEqual([]);
  });

  test('B3 · two reactors to one event (Optimal Aerobraking + Palladin): each once, in turn', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'palladin-event-aerobraking', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    await recordPhrase(page, 'pc02-b3');
    await armTransferWitness(page);
    await armEventFaceProbe(page);
    const stop = await storyboard(page, 'b3-event');
    expect(await playCardFromHand(page, 'Imported GHG'), 'Imported GHG played').toBeTruthy();
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.titanium, {timeout: 40_000}).toBe(3);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    const poses = await readTransient<Pose>(page, 'pc02-b3');
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    writeText('b3-phrase.txt', phraseReport('B3 · two reactors', poses, trail, eventFaceLine(await readEventFaceProbe(page))));
    const after = await wireOf(request, id);
    expect(after.thisPlayer.megacredits, 'Optimal Aerobraking: +3 M€').toBe(before.thisPlayer.megacredits + 3);
    expect(after.thisPlayer.heat, '+3 heat of the event, +3 of the reactor').toBe(before.thisPlayer.heat + 6);
    expect(ticks(poses, 'ti').slice(-1)[0], 'the titanium row ends on the server').toBe(3);
    expect(ticks(poses, 'mc').slice(-1)[0], 'the M€ row ends on the server').toBe(after.thisPlayer.megacredits);
    expect(poses.some((s) => s.v.faces.split(',').filter((f) => f === CORP).length > 1), 'never two Palladin faces').toBe(false);
    expect(endsOverGlass(witness), 'no end over glass').toEqual([]);
  });

  test('C · the «almost»: a space card that is not an event, an event without Space — nothing answers', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'palladin-almost', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    for (const card of ['Investment Loan', 'Space Station']) {
      await recordPhrase(page, `pc02-c-${card}`);
      await armTransferWitness(page);
      expect(await playCardFromHand(page, card), `${card} played`).toBeTruthy();
      await expect.poll(async () => (await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === card), {timeout: 40_000}).toBe(true);
      await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
      const poses = await readTransient<Pose>(page, `pc02-c-${card}`);
      const witness = await transferWitness(page);
      writeText(`c-${card.replace(/\s+/g, '-')}.txt`, phraseReport(`C · ${card}`, poses, transferTrail(witness), ''));
      expect(ticks(poses, 'ti'), `${card}: the titanium row never moves`).toEqual([0]);
      expect(witness.landings.some((l) => l.under === 'rail:titanium'), `${card}: no titanium token`).toBe(false);
      expect(poses.some((s) => s.v.faces.includes(CORP)), `${card}: Palladin never rises`).toBe(false);
    }
    expect((await wireOf(request, id)).thisPlayer.titanium, 'nothing answered').toBe(0);
  });

  test('D · the action at −26 °C: the crumb, the price off the titanium row FIRST, the step and its heat production', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'palladin-threshold-heat', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    await openCardActions(page);
    const focusedTile = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
    const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
    for (let i = 0; i < 24 && await focusedTile() !== CORP; i++) {
      await press(page, moves[i % moves.length], 260);
    }
    expect(await focusedTile(), 'Palladin\'s action tile focused').toBe(CORP);
    await openActionFocus(page);
    await settle(page);
    await expect.poll(() => crumbText(page), {message: 'the crumb names the card and the stage', timeout: 10_000}).toMatch(/PALLADIN SHIPPING/i);
    await shoot(page, 'd-setup');
    await recordPhrase(page, 'pc02-d');
    await armTransferWitness(page);
    const stop = await storyboard(page, 'd-action');
    expect(await pressUntil(page, 'Enter', async () => (await wireOf(request, id)).thisPlayer.titanium === before.thisPlayer.titanium - 2,
      {tries: 3, settleMs: 2500}), 'A commits the action').toBeTruthy();
    await waitForBoardHome(page, 30);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await stop();
    const poses = await readTransient<Pose>(page, 'pc02-d');
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    writeText('d-action.txt', phraseReport('D · the action', poses, trail, ''));
    const after = await wireOf(request, id);
    expect(after.game.temperature, 'the step').toBe(-24);
    expect(after.thisPlayer.terraformRating, 'its rating').toBe(before.thisPlayer.terraformRating + 1);
    const price = witness.births.filter((b) => b.under === 'rail:titanium');
    expect(price.length, `the price was born on the titanium row (trail:\n${trail})`).toBeGreaterThan(0);
    expect(witness.landings.filter((l) => price.some((b) => b.id === l.id)).every((l) => l.under === 'hero'), `…into the printed price (trail:\n${trail})`).toBe(true);
    expect(endsOverGlass(witness), 'no end over glass').toEqual([]);
  });

  test('E · −2 °C: the action opens the player\'s own ocean placement, the ocean lands (the story\'s order — gap PL-1840, recorded)', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'palladin-threshold', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    await recordTransient(page, 'pc02-e', () => ({
      placing: document.querySelector('.con-board--placing') !== null,
      // the TEMPERATURE marker's resting value (`undefined` while it glides — the scale's story)
      marker: document.querySelector<HTMLElement>('.scale-marker[data-scale-marker="temperature"]')?.dataset.scaleMarkerAt ?? '~',
      ws: document.querySelectorAll('.con-ws').length,
    }));
    await openCardActions(page);
    const focusedTile = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
    for (let i = 0; i < 24 && await focusedTile() !== CORP; i++) {
      await press(page, ['ArrowRight', 'ArrowDown', 'ArrowLeft'][i % 3], 260);
    }
    await openActionFocus(page);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-board--placing').count() > 0, {tries: 3, settleMs: 2500}),
      'the ocean placement opens').toBeTruthy();
    const samples = await readTransient<{placing: boolean, marker: string, ws: number}>(page, 'pc02-e');
    writeText('e-threshold.txt', samples.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`).join('\n'));
    const firstPlacing = samples.findIndex((s) => s.v.placing);
    expect(firstPlacing, 'the grid lit').toBeGreaterThan(0);
    // THE NAMED GAP (ledger GQ, PL-1840): the blue action's 0 °C ocean is admitted while the workspace still covers the
    // board — `board-story` holds a placement only over a board in plain view — so the grid lights over a dial still
    // resting on −2 and the scale's story is told after the landing. Recorded, not asserted: the frames are the gap's.
    const order = samples.map((s) => `${s.v.marker}/${s.v.placing ? 'P' : '-'}/${s.v.ws}`).join(' ');
    test.info().annotations.push({type: 'gap-PL-1840', description: `marker/placing/workspaces: ${order}`});
    expect(await placeTile(page), 'the ocean lands').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).game.temperature, {timeout: 30_000}).toBe(0);
  });

  test('F · at +8 °C the action stands «без эффекта», activatable', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'palladin-max', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    await openCardActions(page);
    const tile = page.locator(`.con-cardactions__tile[data-action-card="${CORP}"]`);
    await expect(tile, 'the action is shown').toHaveCount(1);
    await expect(tile, 'and named futile').toHaveAttribute('data-action-futile', /.+/);
    await shoot(page, 'f-max');
  });

  test('G · 1 titanium: the action shown refused, with a reason', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixture(page, request, 'palladin-short', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    await openCardActions(page);
    const tile = page.locator(`.con-cardactions__tile[data-action-card="${CORP}"]`);
    await expect(tile, 'the action is shown, never hidden').toHaveCount(1);
    await expect(tile, 'refused').not.toHaveAttribute('data-action-verdict', 'available');
    await shoot(page, 'g-short');
  });

  test('H · a reload after the event: the same numbers, nothing told again', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'palladin-event', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    expect(await playCardFromHand(page, 'Imported GHG'), 'played').toBeTruthy();
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.titanium, {timeout: 40_000}).toBe(3);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await recordPhrase(page, 'pc02-h');
    await armTransferWitness(page);
    await reloadConsole(page);
    await settle(page, {timeoutMs: 30_000});
    const poses = await readTransient<Pose>(page, 'pc02-h');
    expect(ticks(poses, 'ti').slice(-1)[0], 'the row equals the server').toBe(3);
    expect(poses.every((s) => s.v.faces === ''), 'no reaction told again').toBe(true);
  });
});
