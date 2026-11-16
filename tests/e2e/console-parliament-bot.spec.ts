import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, fetchPlayerModel, press, sendPlayerInput, settle} from './consoleStart';
import {
  armLeakWitness, closeSitting, enterSittingByPass, expectParliamentFits, hotVerb, openParliament, parliament, PARLIAMENT_PRESETS, sittingStage, strandedReports,
  waitSittingAtRest,
} from './parliamentDrive';
import {sequenceOf} from './observeCore';
import {armWitness, witnessOf} from './witness';

/**
 * MARSBOT AT THE TABLE (Turmoil Redux — docs/TURMOIL_REDUX_MARSBOT.md §8, D2–D5).
 *
 * The bot is a SEAT: it votes (B21 Party Politics, Lobbying), it can be the
 * winning player (its ★ paid by declaration) and it completes the chairman
 * quest by its ordinary play. Five things this probe holds, on three profiles:
 *
 *   (1) THE ARRIVAL OF ANOTHER SEAT'S CUBE — the overview is open, the bot
 *       votes on its turn: its cube LEAVES its lobby socket on the delegates
 *       zone and LANDS on the card's ribbon (a proxy flies, the ribbon cube is
 *       hidden under it until the touchdown, the arrival mark plays); the
 *       tally column, the leader badge and the «Принимается» badge read the
 *       bot; the turn card names the bonus card.
 *   (2) LOBBYING WITH TWO DELEGATES IN ONE TURN — the second cube leaves only
 *       once the first has landed (one after another, never two in the air);
 *       the human's source (D12): the first off the LOBBY socket, the second
 *       off the reserve stack once the lobby is spent — both free (D14; the
 *       fixture pins the generation's mandate to ALL).
 *   (3) THE TURN REVIEW — the lobbying chain names the rule and the delegates.
 *   (4) THE SITTING FOR THE SPECTATOR — the bot won the vote: the verdict
 *       names it as the winning player, the results carry its ocean as a row
 *       of its own, the human is never shown «Ваша награда», and the ocean
 *       lands on the board after the sitting leaves (the remote stage).
 *   (5) THE CHAIRMAN QUEST BY ITS PLAY — the bot's card completes «2 building
 *       tags»: the quest closes with the bot's name, the chair takes its cube,
 *       its Agenda marker moves, its reserve paid the delegate.
 *
 * THE ARRANGEMENT: fixtures (`parliament-bot-*`), the bot's deck forced by the
 * generator. The three multiplayer tables stand at RED's turn with blue passed —
 * the viewer holds no prompt, so an out-of-band change reaches its client — and
 * red's one API press («End Turn») hands the turn to the bot. Every wait is a
 * state wait; the probes are RECORDINGS (`armWitness`, settled — every state a
 * task leaves, the state a frame can paint), never a sampler of our own.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-bot');

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type SeatWire = {color: string, participates: boolean, enactment?: boolean, everyUnitLands?: boolean, lobby: boolean, reserve: number, agenda: number, chairman: boolean};
type BotWire = {
  waitingFor?: {type: string, promptId?: number, options?: Array<{title: string | {message: string}}>},
  thisPlayer: {color: string},
  game: {
    phase: string,
    parliament?: {
      chairman?: string,
      quest?: {completedBy?: string, progress: Record<string, number>},
      slots: Array<{instance: string, votes: Array<{owner: string, seq: number}>, leader?: string, isWinning: boolean}>,
      players: Array<SeatWire>,
      phase?: {step: string, summary?: {winner: {player?: string, instance?: string}}},
    },
  },
};

const wireOf = async (request: APIRequestContext, id: string): Promise<BotWire> => await fetchPlayerModel(request, id) as unknown as BotWire;

/** The bot's seat: it holds delegates and is paid like every seat (D16 — every unit lands). */
function botSeatOf(wire: BotWire): SeatWire {
  const seat = wire.game.parliament?.players.find((p) => p.participates && p.everyUnitLands === true);
  expect(seat, 'a MarsBot seat that holds delegates').toBeDefined();
  return seat!;
}

/** The bot's cubes on the table, in placement order. */
function botVotesOf(wire: BotWire, bot: string): Array<{instance: string, seq: number}> {
  return (wire.game.parliament?.slots ?? [])
    .flatMap((slot) => slot.votes.filter((v) => v.owner === bot).map((v) => ({instance: slot.instance, seq: v.seq})))
    .sort((a, b) => a.seq - b.seq);
}

/** END TURN for `seat` over the API — the action menu's own option (the menu is the one sanctioned title match). */
async function endTurnAs(request: APIRequestContext, seat: string): Promise<void> {
  const wire = await wireOf(request, seat);
  const wf = wire.waitingFor;
  expect(wf?.type, `${seat} holds the action menu`).toBe('or');
  const titleOf = (o: {title: string | {message: string}}) => typeof o.title === 'string' ? o.title : o.title.message;
  const index = (wf?.options ?? []).findIndex((o) => /^End Turn/i.test(titleOf(o).trim()));
  expect(index, `an End Turn option among ${(wf?.options ?? []).map(titleOf).join(' | ')}`).toBeGreaterThanOrEqual(0);
  await sendPlayerInput(request, seat, {type: 'or', index, response: {type: 'option'}, promptId: wf?.promptId} as never);
}

// ── THE CUBE PROBE: the ribbon's cubes (hidden / arrived), the painted flight proxies, every seat's lobby socket and reserve stack. ──
type CubeSample = {
  flights: number,
  /** The painted flights by id, body and opacity (the evidence when two stand at once). */
  flying: Array<string>,
  cubes: Array<{seq: number, owner: string, hidden: boolean, arrived: boolean}>,
  lobby: Record<string, boolean>, reserve: Record<string, number>, holds: Array<string>,
};
type CubeProbe = {samples: Array<CubeSample>};
const CUBE_WITNESS = 'bot-cubes';

/**
 * THE CUBE PROBE — RECORDED (FLAKE ZERO — `armWitness`, settled: «never two in the air», «hidden under its proxy», «never
 * shown before its touchdown» are claims about the states a frame can paint). A sample is ONE recorded state (in order);
 * no claim counts frames.
 */
async function armCubeProbe(page: Page): Promise<void> {
  await armWitness<CubeSample>(page, CUBE_WITNESS, () => {
    const w = window as unknown as {__conReady?: () => {holds: Array<string>}};
    const painted = (el: HTMLElement): boolean => {
      if (el.getBoundingClientRect().width < 1) {
        return false;
      }
      for (let a: Element | null = el; a !== null && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) {
          return false;
        }
      }
      return true;
    };
    const sample = (): CubeSample => {
      const cubes = Array.from(document.querySelectorAll<HTMLElement>('.con-parl__vote-cube[data-seq]')).map((el) => ({
        seq: Number(el.dataset.seq), owner: el.querySelector('[data-player-token]')?.getAttribute('data-player-token') ?? '',
        hidden: el.classList.contains('con-parl__vote-cube--hidden'), arrived: el.hasAttribute('data-arrived'),
      }));
      const lobby: Record<string, boolean> = {};
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-parl-seat-lobby]'))) {
        lobby[el.dataset.parlSeatLobby ?? ''] = !el.classList.contains('con-parl__socket--empty');
      }
      const reserve: Record<string, number> = {};
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-parl-seat-reserve]'))) {
        reserve[el.dataset.parlSeatReserve ?? ''] = Number(el.dataset.count ?? '0');
      }
      const paintedFlights = Array.from(document.querySelectorAll<HTMLElement>('.con-parl__flight')).filter(painted);
      // IN THE AIR: a proxy that has set its figure down and waits for its hand-off tick declares itself
      // (`data-parl-flight-landed`) — the next figure may lift in that tick, and the two are two frame callbacks of one
      // frame (a state the settled record can sample, no frame paints).
      const flights = paintedFlights.filter((el) => !el.hasAttribute('data-parl-flight-landed')).length;
      const flying = paintedFlights.map((el) => `${el.dataset.parlFlight ?? '?'}:${
        el.querySelector('[data-parl-flight-body]')?.getAttribute('data-parl-flight-body') ?? el.dataset.parlFlightBody ?? 'figure'
      }@${Number(getComputedStyle(el).opacity).toFixed(2)}${el.hasAttribute('data-parl-flight-landed') ? ':landed' : ''}`);
      return {
        flights, flying, cubes, lobby, reserve,
        holds: (w.__conReady?.().holds ?? []).filter((h) => h.startsWith('parliament')),
      };
    };
    return sample();
  }, {settled: true, max: 20_000});
}

const readCubeProbe = async (page: Page): Promise<CubeProbe> => ({samples: await witnessOf<CubeSample>(page, CUBE_WITNESS).values()});

/** The bot acted: its cubes are on the table (the server's own record). */
async function waitForBotVotes(request: APIRequestContext, viewer: string, bot: string, count: number): Promise<Array<{instance: string, seq: number}>> {
  await expect.poll(async () => botVotesOf(await wireOf(request, viewer), bot).length, {timeout: 60_000, message: `the bot placed ${count} delegate(s)`}).toBe(count);
  return botVotesOf(await wireOf(request, viewer), bot);
}

/** The ribbon cube of `vote`: arrived (its mark on), no longer hidden. */
const ribbonCube = (page: Page, vote: {instance: string, seq: number}) =>
  page.locator(`.con-parl__slot[data-instance="${vote.instance}"] .con-parl__vote-cube[data-seq="${vote.seq}"]`);

/**
 * ONE CUBE'S ARRIVAL, read off the recorded states (indices are their order): a
 * proxy flew while the ribbon cube stayed hidden, the mark came with the
 * touchdown, at rest the cube stands with its mark and nothing is in the air.
 */
function expectFlewIn(samples: ReadonlyArray<CubeSample>, seq: number, label: string, from = 0): {firstFlying: number, arrivedAt: number} {
  const s = samples;
  const cube = (st: CubeSample) => st.cubes.find((c) => c.seq === seq);
  const arrivedAt = s.findIndex((st, i) => i >= from && cube(st)?.arrived === true);
  expect(arrivedAt, `${label}: the arrival mark played`).toBeGreaterThanOrEqual(0);
  // THIS cube's flight: the proxies painted between the window's start and its own touchdown (a proxy is not
  // attributable by DOM, so the window is the attribution — the caller hands over the previous cube's landing).
  const flyingIdx = s.map((st, i) => i >= from && i <= arrivedAt && st.flights > 0 ? i : -1).filter((i) => i >= 0);
  expect(flyingIdx.length, `${label}: a proxy flew before its touchdown (window ${from}–${arrivedAt} of ${s.length})`).toBeGreaterThan(0);
  const hiddenUnder = flyingIdx.filter((i) => cube(s[i])?.hidden === true);
  expect(hiddenUnder.length, `${label}: the ribbon cube stayed hidden under its proxy`).toBeGreaterThan(0);
  const shownEarly = s.slice(0, arrivedAt).filter((st) => cube(st) !== undefined && cube(st)?.hidden === false);
  expect(shownEarly.length, `${label}: the cube never showed on the ribbon before its touchdown`).toBe(0);
  const rest = s[s.length - 1];
  expect(rest.flights, `${label}: nothing in the air at rest`).toBe(0);
  expect(cube(rest), `${label}: the cube stands with its mark at rest`).toMatchObject({hidden: false, arrived: true});
  return {firstFlying: flyingIdx[0], arrivedAt};
}

for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`MarsBot at the table · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(1) the bot's free delegate arrives on the open overview — from its lobby socket onto the ribbon; tally, leader, badge, turn card (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-bot-vote', {query: preset.query});
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const bot = botSeatOf(before);
      expect(bot.lobby, 'the bot holds its free delegate').toBe(true);
      expect(botVotesOf(before, bot.color), 'no cube of the bot on the table yet').toEqual([]);
      const red = seats[1];

      await openParliament(page);
      await expect(page.locator(`[data-parl-seat="${bot.color}"]`), 'the bot has a row in the delegates zone').toHaveCount(1);
      await expect(page.locator(`[data-parl-seat-lobby="${bot.color}"]`), 'its lobby socket is filled').not.toHaveClass(/con-parl__socket--empty/);
      await expectParliamentFits(page, `${preset.id} overview before the vote`);
      await shoot(page, preset.id, '01-vote-before');
      await armCubeProbe(page);

      // ── RED hands the turn to the bot; B21 sends the free delegate.
      await endTurnAs(request, red);
      const [vote] = await waitForBotVotes(request, playerId, bot.color, 1);
      await expect(ribbonCube(page, vote), 'the bot\'s cube stands on the ribbon with its arrival mark').toHaveAttribute('data-arrived', '', {timeout: 30_000});
      // ── THE TURN CARD names the bonus card (the journal's own headline) — delivered after the beat, alive for its own TTL, so it is read FIRST.
      const turnCard = page.locator('.con-notif[data-notif-id^="bot:"]');
      await expect(turnCard, 'the bot\'s turn card arrives after the beat').toHaveCount(1, {timeout: 20_000});
      await expect(turnCard, 'and names Party Politics').toContainText(/Партийная политика|Party Politics/);
      await settle(page, {timeoutMs: 20_000});

      const probe = await readCubeProbe(page);
      const flight = expectFlewIn(probe.samples, vote.seq, 'the free delegate');
      // THE SOURCE: the lobby socket was painted until the proxy stood over it (the lift and the proxy's first
      // paint can fall into one frame straddle — so the claim is CONTINUITY: before the touchdown the delegate is
      // always somewhere on screen, the socket or the proxy, with at most ONE straddle moment between the two:
      // «neither» may stand as one contiguous moment of the socket/proxy sequence, never come back), and the socket
      // is empty at rest.
      const task = probe.samples;
      expect(task[0].lobby[bot.color], 'the lobby socket painted before the flight').toBe(true);
      expect(task.slice(0, flight.firstFlying + 1).some((st) => st.lobby[bot.color]), 'the lobby socket painted up to the flight').toBe(true);
      const where = sequenceOf(task.slice(0, flight.arrivedAt), (st) => `${st.lobby[bot.color] ? 'L' : '-'}${st.flights > 0 ? 'F' : '-'}`);
      const nowhere = where.filter((k) => k === '--').length;
      expect(nowhere, `the delegate never vanished between its socket and its proxy (${where.join(' ')})`).toBeLessThanOrEqual(1);
      // …and that one moment is the STRADDLE itself — the socket just emptied, the proxy not yet painted: right after
      // the socket and right before the proxy, never a vanish mid-flight or out of a proxy (a frame-free reading of
      // «one straddle frame»: a 300 ms software frame makes the straddle as long as the frame, so no duration bounds it).
      const gap = where.indexOf('--');
      if (gap >= 0) {
        expect(where[gap - 1]?.startsWith('L'), `the moment «nowhere» follows the socket (${where.join(' ')})`).toBe(true);
        expect(where[gap + 1]?.endsWith('F'), `…and the proxy follows it (${where.join(' ')})`).toBe(true);
      }
      expect(task[task.length - 1].lobby[bot.color], 'the lobby socket empty at rest — the delegate went').toBe(false);
      expect(task[task.length - 1].reserve[bot.color], 'the reserve untouched by a free delegate').toBe(task[0].reserve[bot.color]);

      // ── THE TABLE READS THE BOT: the tally column, the leader badge, the «Принимается» badge.
      const slot = page.locator(`.con-parl__slot[data-instance="${vote.instance}"]`);
      await expect(slot.locator('[data-parl-tally] .con-parl__tally-total'), 'the tally counts one delegate').toContainText('1');
      await expect(slot.locator(`[data-parl-leader] [data-player-token="${bot.color}"]`), 'the leader badge carries the bot\'s delegate').toHaveCount(1);
      await expect(slot.locator('.con-parl__slot-win'), 'the card reads «Принимается»').toHaveCount(1);
      const after = await wireOf(request, playerId);
      expect(after.game.parliament?.slots.find((s) => s.instance === vote.instance)?.leader, 'the server names the bot as the leader').toBe(bot.color);
      // Парламент v8: the overview has no reading line — the table READS the winner on its objects (the leader's cube
      // under the crown, the tab above the bill, both asserted above); the name stays localized everywhere.
      expect(await page.locator('.con-parl').evaluate((el) => (el.textContent ?? '').includes('MarsBot')), 'no raw «MarsBot» anywhere in the parliament (RU: «Бот»)').toBe(false);
      await expectParliamentFits(page, `${preset.id} overview after the vote`);
      await shoot(page, preset.id, '02-vote-after');
      expect(await strandedReports(page)).toEqual([]);
    });

    test(`(2)+(3) Lobbying with two delegates in one turn — one after another, the lobby's free one first, then the reserve; the turn review names the rule (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      // `botTheater=1`: the turn card auto-expands into the review the moment it is DELIVERED — after the arrival beat, since delivery waits for holds.
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-bot-lobby', {query: `${preset.query}&botTheater=1`});
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const bot = botSeatOf(before);
      expect(bot.lobby).toBe(true);
      const reserveBefore = bot.reserve;
      const red = seats[1];

      await openParliament(page);
      await armCubeProbe(page);
      await endTurnAs(request, red);
      const votes = await waitForBotVotes(request, playerId, bot.color, 2);
      expect(votes[0].seq, 'two placements, in order').toBeLessThan(votes[1].seq);
      for (const vote of votes) {
        await expect(ribbonCube(page, vote)).toHaveAttribute('data-arrived', '', {timeout: 40_000});
      }
      await settle(page, {timeoutMs: 20_000});

      const probe = await readCubeProbe(page);
      const first = expectFlewIn(probe.samples, votes[0].seq, 'the first delegate');
      const second = expectFlewIn(probe.samples, votes[1].seq, 'the second delegate', first.arrivedAt);
      const task = probe.samples;
      // ONE AFTER ANOTHER: never two proxies in the air; the second lands after the first, and stays hidden on the
      // ribbon for the whole of the first's flight (its own proxy leaves only once the first has its mark).
      // (The message names WHEN two stood and for how long — page clock, ms from the record's start, to the next state.)
      const timed = await witnessOf<CubeSample>(page, CUBE_WITNESS).samples();
      const twice = timed.flatMap((s, i) => s.v.flights > 1 ? [
        `${s.t - timed[0].t}ms for ${(timed[i + 1]?.t ?? s.t) - s.t}ms [${s.v.flying.join(', ')}] after [${timed[i - 1]?.v.flying.join(', ') ?? ''}]` +
          ` then [${timed[i + 1]?.v.flying.join(', ') ?? ''}]`,
      ] : []);
      expect(task.filter((st) => st.flights > 1).length, `never two cubes in the air (${twice.join('; ')})`).toBe(0);
      expect(second.arrivedAt, 'the second lands after the first').toBeGreaterThan(first.arrivedAt);
      const secondCube = (st: CubeSample) => st.cubes.find((c) => c.seq === votes[1].seq);
      expect(task.slice(0, first.arrivedAt).filter((st) => secondCube(st) !== undefined && secondCube(st)?.hidden === false).length,
        'the second cube never shows before the first has landed').toBe(0);
      // THE SOURCES — the human's rule of the vote (D12): the FIRST cube is the lobby's free one, the SECOND leaves
      // the reserve stack once the lobby is spent. The lobby socket was painted until the first proxy stood over it
      // (as in (1)) and is empty at rest; the reserve drops by one.
      expect(task[0].lobby[bot.color], 'the lobby socket painted before the flight').toBe(true);
      expect(task.slice(0, first.firstFlying + 1).some((st) => st.lobby[bot.color]), 'the lobby socket painted up to the first flight').toBe(true);
      expect(task[0].reserve[bot.color], 'the reserve stack painted before the flight').toBe(reserveBefore);
      expect(task.slice(0, first.arrivedAt + 1).every((st) => st.reserve[bot.color] === reserveBefore),
        'the reserve stack untouched by the first (free) delegate').toBe(true);
      expect(task[task.length - 1].lobby[bot.color], 'the lobby socket empty at rest — the free delegate went first').toBe(false);
      expect(task[task.length - 1].reserve[bot.color], 'the reserve gave the second delegate only').toBe(reserveBefore - 1);
      // Both delegates are free for the bot (D14 — the unit spec pins the M€); only the source differs.
      const after = await wireOf(request, playerId);
      expect(botSeatOf(after).reserve).toBe(reserveBefore - 1);
      expect(botSeatOf(after).lobby).toBe(false);
      await expectParliamentFits(page, `${preset.id} overview after the lobbying`);
      await shoot(page, preset.id, '03-lobby-after');

      // ── (3) THE TURN REVIEW (auto-expanded): the Lobbying chain with its rule, the resolution's name in it.
      const review = page.locator('.con-bot-review');
      await expect(review, 'the review of the bot\'s turn opens').toHaveCount(1, {timeout: 30_000});
      await settle(page, {timeoutMs: 15_000});
      const lobbying = review.locator('.mbr__chain--lobbying');
      await expect(lobbying, 'the LOBBYING chain').toHaveCount(1);
      await expect(lobbying.locator('.mbr__chain-kicker'), 'named by its kicker').toContainText(/Лоббирование|Lobbying/);
      const lines = await lobbying.locator('.mbr__line').evaluateAll((els) => els.map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()));
      expect(lines.length, `the chain carries the rule and the delegates: ${lines.join(' | ')}`).toBeGreaterThan(0);
      expect(lines.join(' '), 'the price of the card is the rule\'s own number').toMatch(/9/);
      await shoot(page, preset.id, '04-turn-review');
      await press(page, 'Escape', 900);
      await expect(review, 'B closes the review').toHaveCount(0, {timeout: 10_000});
      expect(await strandedReports(page)).toEqual([]);
    });

    test(`(4) the sitting for the spectator — the bot is the winning player, its ocean is a row of the results, never «Ваша награда», the tile lands after the sitting (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      // The table stands ONE PASS before its sitting (the soft gates): the bot's delegates lead the vote.
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-bot-win', {query: preset.query});
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const bot = botSeatOf(before);
      expect(before.game.phase, 'one pass before the sitting').toBe('action');
      const ocean = page.locator('.board-space [class*="board-space-tile--ocean"]');
      await expect.poll(() => ocean.count(), {message: 'no ocean on the board before the sitting'}).toBe(0);

      // A probe over the band and the panel: the words the spectator is shown, and the remote tile stage.
      // …and the VERDICT page's own reading (the walk turns it by itself — the soft gates — so it is RECORDED from
      // before the pass, never read late: `armWitness`, settled — «never shown» is a claim about painted states).
      const sitWitness = await armWitness(page, 'bot-sitting', (botColor: string) => ({
        texts: Array.from(document.querySelectorAll<HTMLElement>('.con-band, .con-sit__panel--on')).map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()),
        remote: document.querySelector('.con-tileplace__tile--remote') !== null,
        verdictBot: document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') === 'verdict' &&
          document.querySelector(`.con-band [data-parl-band-chip="player"] [data-player-token="${botColor}"]`) !== null,
      }), {args: bot.color, settled: true, max: 20_000});
      // The recording folded: every text ever shown, whether the remote stage / the bot's verdict ever stood.
      const readSit = async () => {
        const seen = await sitWitness.values();
        return {
          texts: [...new Set(seen.flatMap((s) => s.texts))],
          remote: seen.some((s) => s.remote),
          verdictBot: seen.some((s) => s.verdictBot),
        };
      };

      // ── ONE PASS: the whole sitting rides it; the walk plays to the results by itself (the bot never holds a confirmation).
      await enterSittingByPass(page, request, playerId);
      expect((await wireOf(request, playerId)).game.parliament?.phase?.summary?.winner.player, 'the bot won the vote').toBe(bot.color);
      await shoot(page, preset.id, '05-sitting-up');
      await expect.poll(() => sittingStage(page), {timeout: 90_000}).toBe('results');
      // ── THE VERDICT named the bot as the winning player, with its token.
      const verdictRead = await readSit();
      expect(verdictRead.texts.some((t) => /Победитель голосования|Winning player/.test(t)), 'the verdict line').toBe(true);
      expect(verdictRead.verdictBot, 'with the bot\'s token on the verdict page').toBe(true);
      await waitSittingAtRest(page, 40_000);
      await expect(page.locator('[data-sit-results-hidden]')).toHaveCount(0);
      const botRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${bot.color}"]`);
      await expect(botRow, 'the bot\'s reward is a row of its own').toHaveCount(1);
      await expect(botRow.locator('.con-sit__door-tile--ocean'), 'the ocean it placed').toHaveCount(1);
      await expect(botRow.locator('[data-sit-part-parameter][data-sit-part-param="oceans"]'), 'with the count it moved').toContainText(/0\s*→\s*1/);
      // The TILE part has no amount — never a bare «0» (its payout parts beside it carry theirs, D16).
      await expect(botRow.locator('[data-sit-part]:has(.con-sit__door-tile--ocean) [data-sit-part-amount]'), 'a tile has no amount — never a bare «0»').toHaveCount(0);
      await expect(botRow.locator('[data-sit-payout-none]'), 'never «no reward» for a seat that took its part').toHaveCount(0);
      const sit = await readSit();
      expect(sit.texts.filter((t) => /Ваша награда|Your reward/i.test(t)), 'the spectator is never shown «Ваша награда»').toEqual([]);
      expect(sit.texts.some((t) => /Награда победителю голосования|Reward for the winner of the vote/i.test(t)), `the reward line is the WINNER's: ${sit.texts.slice(-6).join(' || ')}`).toBe(true);
      expect(sit.texts.some((t) => t.includes('MarsBot')), 'no raw «MarsBot» on the band or the panel (RU: «Бот»)').toBe(false);
      // The close names where it leads when the next workspace is known (the owner, 2026-10-30).
      await expect.poll(() => hotVerb(page), {timeout: 10_000}).toMatch(/Закрыть заседание|Close the sitting|К исследованию|To the research|К драфту|To the draft/i);
      await expectParliamentFits(page, `${preset.id} results`);
      await shoot(page, preset.id, '06-sitting-results');

      // ── «Закрыть заседание»: the sitting leaves; the bot's ocean lands on the board through the remote stage.
      await closeSitting(page, request, playerId);
      await expect(parliament(page), 'the sitting leaves with its close').toHaveCount(0, {timeout: 30_000});
      await expect(ocean, 'the bot\'s ocean stands on the board').toHaveCount(1, {timeout: 40_000});
      await settle(page, {timeoutMs: 20_000});
      expect((await readSit()).remote, 'the tile came through the remote stage').toBe(true);
      await shoot(page, preset.id, '07-ocean-landed');
      expect(await strandedReports(page)).toEqual([]);
    });

    test(`(5) the chairman quest by the bot's play — the quest closes with its name, the chair takes its cube, the marker moves (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-bot-chair', {query: preset.query});
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const bot = botSeatOf(before);
      expect(before.game.parliament?.quest?.progress[bot.color], 'the bot stands at 1/2').toBe(1);
      expect(before.game.parliament?.chairman, 'the office is the viewer\'s').toBe(before.thisPlayer.color);
      const red = seats[1];

      await openParliament(page);
      const questRow = page.locator(`[data-parl-quest-progress] [data-parl-quest-row="${bot.color}"]`);
      await expect(questRow, 'the bot\'s row in the race').toHaveCount(1);
      // P70 · K4: the race is ONE encoding — the pips (no «1/2» beside them); the row states its count as data.
      await expect(questRow, 'reads 1 of 2 — a reachable quest, never «недостижимо»').toHaveAttribute('data-parl-quest-value', '1');
      await expect(questRow.locator('.con-parl__engine-pip--on'), 'one pip taken').toHaveCount(1);
      await expect(questRow.locator('.con-parl__quest-unreachable')).toHaveCount(0);
      await expect(page.locator(`[data-parl-seat-chair="${before.thisPlayer.color}"]`), 'the chair carries the viewer\'s cube').toHaveCount(1);
      await expectParliamentFits(page, `${preset.id} overview before the quest`);
      await shoot(page, preset.id, '08-chair-before');

      // ── RED hands the turn to the bot; its building card completes the quest.
      await endTurnAs(request, red);
      await expect.poll(async () => (await wireOf(request, playerId)).game.parliament?.quest?.completedBy, {timeout: 60_000, message: 'the bot completed the quest'}).toBe(bot.color);
      const after = await wireOf(request, playerId);
      expect(after.game.parliament?.chairman, 'the office is the bot\'s').toBe(bot.color);
      const botAfter = botSeatOf(after);
      expect(botAfter.agenda, 'its Agenda marker moved one step').toBe(bot.agenda + 1);
      expect(botAfter.reserve, 'its reserve paid the chairman\'s delegate').toBe(bot.reserve - 1);
      await settle(page, {timeoutMs: 30_000});

      await expect(page.locator('[data-parl-quest].con-parl__quest--done'), 'the quest reads completed').toHaveCount(1, {timeout: 30_000});
      await expect(questRow, 'the bot\'s row reads 2 of 2').toHaveAttribute('data-parl-quest-value', '2');
      await expect(questRow.locator('.con-parl__engine-pip--on'), 'both pips taken').toHaveCount(2);
      // «Зал» v7 / Парламент v8: the quest plate states no winner in WORDS — the winner TAKES THE CHAIR (its cube in the
      // seat, the chair's won ring); the name stays localized everywhere.
      expect(await page.locator('.con-parl').evaluate((el) => (el.textContent ?? '').includes('MarsBot')), 'no raw «MarsBot» anywhere in the parliament (RU: «Бот»)').toBe(false);
      await expect(page.locator('[data-parl-chair].con-parl__chair--won'), 'the chair reads the quest won by its holder').toHaveCount(1, {timeout: 30_000});
      await expect(page.locator(`[data-parl-chair] [data-parl-seat-chair="${bot.color}"]`), 'the chair carries the bot\'s cube').toHaveCount(1, {timeout: 30_000});
      await expect(page.locator(`[data-agenda-markers="${bot.agenda + 1}"] [data-agenda-cube="${bot.color}"]`), 'its marker stands on the next step').toHaveCount(1, {timeout: 30_000});
      await expect(page.locator(`[data-parl-seat-reserve="${bot.color}"]`), 'its reserve stack dropped by one').toHaveAttribute('data-count', String(bot.reserve - 1));
      await expectParliamentFits(page, `${preset.id} overview after the quest`);
      await shoot(page, preset.id, '09-chair-after');
      expect(await strandedReports(page)).toEqual([]);
    });
  });
}
