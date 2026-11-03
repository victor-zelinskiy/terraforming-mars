import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {NO_PAYMENT, bootFixtureSeats, cinematicBeat, fetchPlayerModel, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P46 «ТОРГОВЫЙ УЗЕЛ КОЛОНИЙ» — the TWENTY-NINTH Prelude 2 card: «when ANY colony is placed, gain 2 M€». The effect is
 * the CARD's hook (`onColonyAddedByAnyPlayer`) under its own `'colony-added'` scope, and the record names the colony
 * and its builder (`cause.colony`) — so the card-reaction framework plays it on EVERY seat's build (the owner,
 * 2026-11-03: «…и это показывалось даже на срабатывания от хода других игроков» — MarsBot included):
 *   (blue's OWN build is the transport's own-submit road — the colony scene, then the chain, no plate; its record and
 *    forecast are the unit suite's: `ColonyTradeHub.spec`, `effectForecastParity`, `reactionCausePlate.spec`.)
 *   B · RED builds (the rival's turn, over the API): blue's card rises WITH the cause plate — the colony and red's seat —
 *       and pays on blue's M€ row; the server holds ONE record naming red as the builder.
 *   C · MarsBot builds (its pinned B18 after blue's «End Turn»): the same, the plate naming the bot; ONE telling (the
 *       record told once, the M€ landing once).
 * Fixtures: tests/e2e/fixtures/generate.ts § P46 (each dry run proves the record). TIMING class (`timingSpecs.ts`): the
 * births and the plate are sampled motion. Storyboard: `TM_E2E_STORYBOARD=1` → `screenshots/p46/tv4k/story-*`.
 */

const CARD = 'Colony Trade Hub';
const OUT = path.resolve('screenshots', 'p46');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type WireOption = {title?: string | {message?: string}, cards?: Array<{name: string, calculatedCost?: number}>};
type Wire = {
  thisPlayer: {color: string, megacredits: number},
  waitingFor?: {type?: string, options?: Array<WireOption>, colonies?: Array<string>},
  game: {cardReactions?: Array<{card: string, channel: string, owner: string, seq: number, cause?: {colony?: {name: string, builder: string}}}>},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const hubRecords = (wire: Wire) => (wire.game.cardReactions ?? []).filter((r) => r.card === CARD && r.channel === 'colony-added');
const titleOf = (o: WireOption) => typeof o.title === 'string' ? o.title : o.title?.message;

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

/** The reaction scene, sampled on a task clock (never rAF): the faces that rose, and every cause plate painted under one. */
async function armReactionProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__p46: {risen: Array<string>, plates: Array<string>}};
    w.__p46 = {risen: [], plates: []};
    window.setInterval(() => {
      for (const face of Array.from(document.querySelectorAll('.con-reaction__face[data-reaction-card], .con-recv__emerge[data-played-key]'))) {
        const name = face.getAttribute('data-reaction-card') ?? face.getAttribute('data-played-key') ?? '';
        if (!w.__p46.risen.includes(name)) {
          w.__p46.risen.push(name);
        }
      }
      for (const plate of Array.from(document.querySelectorAll('.con-reaction__face[data-reaction-card] [data-reaction-cause]'))) {
        const key = `${plate.getAttribute('data-reaction-cause')}:${plate.getAttribute('data-cause-colony')}:${plate.getAttribute('data-cause-builder')}`;
        if (!w.__p46.plates.includes(key)) {
          w.__p46.plates.push(key);
        }
      }
    }, 16);
  });
}
async function probe(page: Page): Promise<{risen: Array<string>, plates: Array<string>}> {
  return page.evaluate(() => (window as unknown as {__p46?: {risen: Array<string>, plates: Array<string>}}).__p46 ?? {risen: [], plates: []});
}

/** A seat builds a colony through the standard project, over the API: the project (paid in M€), then the tile. */
async function buildColonyAs(request: APIRequestContext, seat: string, colonyName: string): Promise<void> {
  const menu = await wireOf(request, seat);
  const index = (menu.waitingFor?.options ?? []).findIndex((o) => titleOf(o) === 'Standard projects');
  expect(index, `the seat has the standard projects (menu: ${menu.waitingFor?.type} ${JSON.stringify((menu.waitingFor?.options ?? []).map(titleOf))})`).toBeGreaterThanOrEqual(0);
  const project = menu.waitingFor?.options?.[index].cards?.find((c) => c.name === 'Build Colony');
  expect(project, 'the colony project is offered').toBeDefined();
  const pay = await request.post(`/player/input?id=${seat}`, {data: {
    type: 'or', index, response: {type: 'projectCard', card: 'Build Colony', payment: {...NO_PAYMENT, megacredits: project?.calculatedCost ?? 17}},
  }});
  expect(pay.ok(), `the project was accepted (${pay.status()})`).toBeTruthy();
  const pick = await wireOf(request, seat);
  expect(pick.waitingFor?.type, 'the build asks which tile').toBe('colony');
  const build = await request.post(`/player/input?id=${seat}`, {data: {type: 'colony', colonyName}});
  expect(build.ok(), `the tile was accepted (${build.status()})`).toBeTruthy();
}

/** The chain played and let go: the reaction layer is idle and nothing is in the air. */
async function chainOver(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.querySelector('.con-reaction[data-reaction-phase]')?.getAttribute('data-reaction-phase') ?? 'idle'),
    {timeout: 60_000, message: 'the reaction chain ends'}).toBe('idle');
  await settle(page, {timeoutMs: 40_000});
}

function writeTrail(name: string, trail: string): void {
  fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
  fs.writeFileSync(path.join(OUT, PRESET.id, `${name}-trail.txt`), trail + '\n');
  console.log(`[p46 ${name}] trail\n${trail}`);
}

/** The card's tokens: born on ITS printed effect, landed on the viewer's M€ row — every end visible. */
function expectHubPaid(name: string, witness: Awaited<ReturnType<typeof transferWitness>>): void {
  writeTrail(name, transferTrail(witness));
  expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
  const births = witness.births.filter((b) => b.under.startsWith(`reactor:${CARD}:`));
  expect(births.length, `the 2 M€ were born on the card's printed effect\n${transferTrail(witness)}`).toBeGreaterThan(0);
  const landings = witness.landings.filter((l) => births.some((b) => b.id === l.id));
  expect(landings.length > 0 && landings.every((l) => l.under === 'rail:megacredits'), `…and landed on the M€ row\n${transferTrail(witness)}`).toBe(true);
}

test.describe(`console · P46 Colony Trade Hub · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('B · a RIVAL builds: blue\'s card rises with the cause plate (the colony · red) and pays on blue\'s M€ row, once', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const {playerId, seats} = await bootFixtureSeats(page, request, 'colony-trade-hub-rival', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    const red = await wireOf(request, seats[1]);
    await armTransferWitness(page);
    await armReactionProbe(page);
    const stop = await storyboard(page, 'rival');
    await buildColonyAs(request, seats[1], 'Luna');
    await expect.poll(async () => hubRecords(await wireOf(request, playerId)).length, {timeout: 20_000}).toBe(hubRecords(before).length + 1);
    await expect.poll(async () => (await probe(page)).plates, {timeout: 60_000, message: 'the plate names the cause'})
      .toContain(`colony:Luna:${red.thisPlayer.color}`);
    await shoot(page, 'b-rival-plate');
    await chainOver(page);
    await stop();
    expect((await probe(page)).risen, 'the card rose').toContain(CARD);
    expectHubPaid('b', await transferWitness(page));
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.megacredits - before.thisPlayer.megacredits, 'blue gained the hub\'s 2 M€ — once').toBe(2);
    expect(hubRecords(after).at(-1)?.cause?.colony, 'the record names Luna and red').toEqual({name: 'Luna', builder: red.thisPlayer.color});
    await cinematicBeat(page, 400, 'the rail settles for the frame');
    await shoot(page, 'b-rival-after');
    expect(errors, 'no page errors').toEqual([]);
  });

  test('C · MarsBot builds (B18): blue\'s card rises with the plate naming the bot, told ONCE', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const {playerId} = await bootFixtureSeats(page, request, 'colony-trade-hub-bot', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    await armTransferWitness(page);
    await armReactionProbe(page);
    const stop = await storyboard(page, 'bot');
    const index = (before.waitingFor?.options ?? []).findIndex((o) => titleOf(o) === 'End Turn');
    expect(index, 'blue can end the turn').toBeGreaterThanOrEqual(0);
    const end = await request.post(`/player/input?id=${playerId}`, {data: {type: 'or', index, response: {type: 'option'}}});
    expect(end.ok(), `the turn ended (${end.status()})`).toBeTruthy();
    await expect.poll(async () => hubRecords(await wireOf(request, playerId)).length, {timeout: 30_000}).toBe(hubRecords(before).length + 1);
    const record = hubRecords(await wireOf(request, playerId)).at(-1);
    const botColor = record?.cause?.colony?.builder ?? '';
    expect(botColor, 'the record names the bot as the builder').not.toBe(before.thisPlayer.color);
    await expect.poll(async () => (await probe(page)).plates.some((p) => p.endsWith(`:${botColor}`)), {timeout: 90_000, message: 'the plate names the bot'}).toBe(true);
    await shoot(page, 'c-bot-plate');
    await chainOver(page);
    await stop();
    expectHubPaid('c', await transferWitness(page));
    // ONE TELLING: the card rose once (the run's full commit found the turn's record already claimed).
    expect((await probe(page)).risen.filter((n) => n === CARD).length, 'one face of the card').toBe(1);
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.megacredits - before.thisPlayer.megacredits, 'blue gained the hub\'s 2 M€ — once').toBe(2);
    expect(errors, 'no page errors').toEqual([]);
  });
});
