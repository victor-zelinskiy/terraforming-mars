import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, fetchPlayerModel, openMandatoryAnnounce, press, sendPlayerInput, settle} from './consoleStart';
import {
  armLeakWitness, expectParliamentFits, hotVerb, mandatoryPlate, openParliament, parliament, PARLIAMENT_PRESETS, sittingStage, strandedReports,
  waitSittingAtRest,
} from './parliamentDrive';

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
 *       once the first has landed (one after another, never two in the air),
 *       from the reserve stack once the lobby is spent; the bot paid 10 M€.
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
 * state wait; the probes are MutationObserver + setInterval (never rAF), and
 * every claim about a FRAME is made on the task-clock samples only.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-bot');

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type SeatWire = {color: string, participates: boolean, enactment?: boolean, lobby: boolean, reserve: number, agenda: number, chairman: boolean};
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

/** The bot's seat: it holds delegates and is never paid by an enactment (D3). */
function botSeatOf(wire: BotWire): SeatWire {
  const seat = wire.game.parliament?.players.find((p) => p.participates && p.enactment === false);
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
  t: number, clock: 'task' | 'mo', flights: number,
  cubes: Array<{seq: number, owner: string, hidden: boolean, arrived: boolean}>,
  lobby: Record<string, boolean>, reserve: Record<string, number>, holds: Array<string>,
};
type CubeProbe = {samples: Array<CubeSample>};

async function armCubeProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__botCubes: CubeProbe, __conReady?: () => {holds: Array<string>}};
    w.__botCubes = {samples: []};
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
    const sample = (clock: 'task' | 'mo') => {
      const cubes = Array.from(document.querySelectorAll<HTMLElement>('.con-parl__vote-cube[data-seq]')).map((el) => ({
        seq: Number(el.dataset.seq), owner: el.querySelector('.player-cube')?.getAttribute('aria-label') ?? '',
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
      const flights = Array.from(document.querySelectorAll<HTMLElement>('.con-parl__flight')).filter(painted).length;
      w.__botCubes.samples.push({
        t: performance.now(), clock, flights, cubes, lobby, reserve,
        holds: (w.__conReady?.().holds ?? []).filter((h) => h.startsWith('parliament')),
      });
      if (w.__botCubes.samples.length > 12000) {
        w.__botCubes.samples.splice(0, 2000);
      }
    };
    new MutationObserver(() => sample('mo')).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'data-arrived', 'data-count']});
    window.setInterval(() => sample('task'), 16);
  });
}

const readCubeProbe = (page: Page): Promise<CubeProbe> => page.evaluate(() => (window as unknown as {__botCubes: CubeProbe}).__botCubes);

/** The bot acted: its cubes are on the table (the server's own record). */
async function waitForBotVotes(request: APIRequestContext, viewer: string, bot: string, count: number): Promise<Array<{instance: string, seq: number}>> {
  await expect.poll(async () => botVotesOf(await wireOf(request, viewer), bot).length, {timeout: 60_000, message: `the bot placed ${count} delegate(s)`}).toBe(count);
  return botVotesOf(await wireOf(request, viewer), bot);
}

/** The ribbon cube of `vote`: arrived (its mark on), no longer hidden. */
const ribbonCube = (page: Page, vote: {instance: string, seq: number}) =>
  page.locator(`.con-parl__slot[data-instance="${vote.instance}"] .con-parl__vote-cube[data-seq="${vote.seq}"]`);

/**
 * ONE CUBE'S ARRIVAL, read off the task-clock samples: a proxy flew while the
 * ribbon cube stayed hidden, the mark came with the touchdown, at rest the
 * cube stands with its mark and nothing is in the air.
 */
function expectFlewIn(samples: ReadonlyArray<CubeSample>, seq: number, label: string, from = 0): {firstFlying: number, arrivedAt: number} {
  const s = samples.filter((st) => st.clock === 'task');
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
      // paint can fall inside ONE 16 ms sample on a slow profile — so the claim is CONTINUITY: before the
      // touchdown the delegate is always somewhere on screen, the socket or the proxy, one sample of slack for
      // the frame straddle), and the socket is empty at rest.
      const task = probe.samples.filter((st) => st.clock === 'task');
      expect(task[0].lobby[bot.color], 'the lobby socket painted before the flight').toBe(true);
      expect(task.slice(0, flight.firstFlying + 1).some((st) => st.lobby[bot.color]), 'the lobby socket painted up to the flight').toBe(true);
      const nowhere = task.slice(0, flight.arrivedAt).filter((st) => !st.lobby[bot.color] && st.flights === 0).length;
      expect(nowhere, 'the delegate never vanished between its socket and its proxy').toBeLessThanOrEqual(1);
      expect(task[task.length - 1].lobby[bot.color], 'the lobby socket empty at rest — the delegate went').toBe(false);
      expect(task[task.length - 1].reserve[bot.color], 'the reserve untouched by a free delegate').toBe(task[0].reserve[bot.color]);

      // ── THE TABLE READS THE BOT: the tally column, the leader badge, the «Принимается» badge.
      const slot = page.locator(`.con-parl__slot[data-instance="${vote.instance}"]`);
      await expect(slot.locator('[data-parl-tally] .con-parl__tally-total'), 'the tally counts one delegate').toContainText('1');
      await expect(slot.locator(`[data-parl-leader] .player-cube[aria-label="${bot.color}"]`), 'the leader badge carries the bot\'s cube').toHaveCount(1);
      await expect(slot.locator('.con-parl__slot-win'), 'the card reads «Принимается»').toHaveCount(1);
      const after = await wireOf(request, playerId);
      expect(after.game.parliament?.slots.find((s) => s.instance === vote.instance)?.leader, 'the server names the bot as the leader').toBe(bot.color);
      // ── THE BAND reads the bot as the winning player — by the localized name, never a raw «MarsBot».
      await expect(page.locator('.con-band'), 'the overview line names the winning player').toContainText(/Победитель голосования|Winning player/);
      await expect(page.locator(`.con-band [data-parl-band-chip="player"] .player-cube[aria-label="${bot.color}"]`)).toHaveCount(1);
      await expect(page.locator('.con-band [data-parl-band-chip="player"]'), 'the bot by its display name').toContainText(/Бот|MarsBot/);
      expect(await page.locator('.con-parl').evaluate((el) => (el.textContent ?? '').includes('MarsBot')), 'no raw «MarsBot» anywhere in the parliament (RU: «Бот»)').toBe(false);
      await expectParliamentFits(page, `${preset.id} overview after the vote`);
      await shoot(page, preset.id, '02-vote-after');
      expect(await strandedReports(page)).toEqual([]);
    });

    test(`(2)+(3) Lobbying with two delegates in one turn — one after another, both from the reserve; the turn review names the rule (${preset.id})`, async ({page, request}) => {
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
      const task = probe.samples.filter((st) => st.clock === 'task');
      // ONE AFTER ANOTHER: never two proxies in the air; the second lands after the first, and stays hidden on the
      // ribbon for the whole of the first's flight (its own proxy leaves only once the first has its mark).
      expect(task.filter((st) => st.flights > 1).length, 'never two cubes in the air').toBe(0);
      expect(second.arrivedAt, 'the second lands after the first').toBeGreaterThan(first.arrivedAt);
      const secondCube = (st: CubeSample) => st.cubes.find((c) => c.seq === votes[1].seq);
      expect(task.slice(0, first.arrivedAt).filter((st) => secondCube(st) !== undefined && secondCube(st)?.hidden === false).length,
        'the second cube never shows before the first has landed').toBe(0);
      // THE SOURCES: a PAID delegate is a reserve delegate (the lobby's is the free one, B21's) — both cubes leave
      // the reserve stack, which drops by two; the lobby socket stays filled.
      expect(task[0].reserve[bot.color], 'the reserve stack painted before the flight').toBe(reserveBefore);
      expect(task[task.length - 1].lobby[bot.color], 'the free delegate stays in the lobby').toBe(true);
      expect(task[task.length - 1].reserve[bot.color], 'the reserve paid both delegates').toBe(reserveBefore - 2);
      // THE PRICE: two paid delegates, 5 M€ each.
      const after = await wireOf(request, playerId);
      expect(botSeatOf(after).reserve).toBe(reserveBefore - 2);
      expect(botSeatOf(after).lobby).toBe(true);
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
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-bot-win', {query: preset.query, landing: 'prompt'});
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const bot = botSeatOf(before);
      expect(before.game.parliament?.phase?.step).toBe('assembly');
      expect(before.game.parliament?.phase?.summary?.winner.player, 'the bot won the vote').toBe(bot.color);
      const ocean = page.locator('.board-space [class*="board-space-tile--ocean"]');
      expect(await ocean.count(), 'no ocean on the board before the sitting').toBe(0);

      // A probe over the band and the panel: the words the spectator is shown, and the remote tile stage.
      await page.evaluate(() => {
        const w = window as unknown as {__botSit: {texts: Set<string>, remote: boolean}};
        w.__botSit = {texts: new Set(), remote: false};
        const sample = () => {
          for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-band, .con-sit__panel--on'))) {
            w.__botSit.texts.add((el.textContent ?? '').replace(/\s+/g, ' ').trim());
          }
          if (document.querySelector('.con-tileplace__tile--remote') !== null) {
            w.__botSit.remote = true;
          }
        };
        new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, characterData: true});
        window.setInterval(sample, 50);
      });
      const readSit = () => page.evaluate(() => {
        const w = window as unknown as {__botSit: {texts: Set<string>, remote: boolean}};
        return {texts: Array.from(w.__botSit.texts), remote: w.__botSit.remote};
      });

      await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
      expect(await openMandatoryAnnounce(page)).toBe(true);
      await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
      await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
      await waitSittingAtRest(page, 20_000);
      // ── THE VERDICT names the bot as the winning player.
      const band = page.locator('.con-band');
      await expect(band, 'the verdict line').toContainText(/Победитель голосования|Winning player/);
      await expect(band.locator(`[data-parl-band-chip="player"] .player-cube[aria-label="${bot.color}"]`), 'with the bot\'s cube').toHaveCount(1);
      await expectParliamentFits(page, `${preset.id} verdict`);
      await shoot(page, preset.id, '05-sitting-verdict');

      // ── A answers the one gate; the walk plays to the results (the bot never holds a gate).
      await press(page, 'Enter', 800);
      await expect.poll(() => sittingStage(page), {timeout: 90_000}).toBe('results');
      await waitSittingAtRest(page, 40_000);
      await expect(page.locator('[data-sit-results-hidden]')).toHaveCount(0);
      const botRow = page.locator(`[data-sit-payout][data-sit-payout-seat="${bot.color}"]`);
      await expect(botRow, 'the bot\'s reward is a row of its own').toHaveCount(1);
      await expect(botRow.locator('.con-sit__door-tile--ocean'), 'the ocean it placed').toHaveCount(1);
      await expect(botRow.locator('[data-sit-part-parameter][data-sit-part-param="oceans"]'), 'with the count it moved').toContainText(/0\s*→\s*1/);
      await expect(botRow.locator('[data-sit-part-amount]'), 'a tile has no amount — never a bare «0»').toHaveCount(0);
      await expect(botRow.locator('[data-sit-payout-none]'), 'never «no reward» for a seat that took its part').toHaveCount(0);
      const sit = await readSit();
      expect(sit.texts.filter((t) => /Ваша награда|Your reward/i.test(t)), 'the spectator is never shown «Ваша награда»').toEqual([]);
      expect(sit.texts.some((t) => /Награда победителю голосования|Reward for the winner of the vote/i.test(t)), `the reward line is the WINNER's: ${sit.texts.slice(-6).join(' || ')}`).toBe(true);
      expect(sit.texts.some((t) => t.includes('MarsBot')), 'no raw «MarsBot» on the band or the panel (RU: «Бот»)').toBe(false);
      expect(await hotVerb(page)).toMatch(/Закрыть заседание|Close the sitting/i);
      await expectParliamentFits(page, `${preset.id} results`);
      await shoot(page, preset.id, '06-sitting-results');

      // ── The sitting leaves with the phase; the bot's ocean lands on the board through the remote stage.
      await press(page, 'Enter', 1200);
      await expect.poll(async () => (await wireOf(request, playerId)).game.phase, {timeout: 60_000}).not.toBe('parliament');
      await expect(parliament(page), 'the sitting leaves with the phase').toHaveCount(0, {timeout: 30_000});
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
      const questRow = page.locator('[data-parl-quest-progress] .con-parl__quest-row').filter({has: page.locator(`.player-cube[aria-label="${bot.color}"]`)});
      await expect(questRow, 'the bot\'s row in the race').toHaveCount(1);
      await expect(questRow, 'reads 1/2 — a reachable quest, never «недостижимо»').toContainText('1/2');
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
      await expect(page.locator('[data-parl-quest] .con-parl__quest-state'), 'by its own word').toContainText(/Выполнено|Completed/);
      await expect(questRow, 'the bot\'s row reads 2/2').toContainText('2/2');
      await expect(page.locator('[data-parl-quest-reward]'), 'won by the bot').toContainText(/Выполнил|Won by/);
      await expect(page.locator('[data-parl-quest-reward]'), 'by its display name, never a raw «MarsBot»').toContainText(/Бот|MarsBot/);
      expect(await page.locator('.con-parl').evaluate((el) => (el.textContent ?? '').includes('MarsBot')), 'no raw «MarsBot» anywhere in the parliament (RU: «Бот»)').toBe(false);
      await expect(page.locator(`[data-parl-quest-reward] .player-cube[aria-label="${bot.color}"]`)).toHaveCount(1);
      await expect(page.locator(`[data-parl-chair] [data-parl-seat-chair="${bot.color}"]`), 'the chair carries the bot\'s cube').toHaveCount(1, {timeout: 30_000});
      await expect(page.locator(`[data-agenda-markers="${bot.agenda + 1}"] [data-agenda-cube="${bot.color}"]`), 'its marker stands on the next step').toHaveCount(1, {timeout: 30_000});
      await expect(page.locator(`[data-parl-seat-reserve="${bot.color}"]`), 'its reserve stack dropped by one').toHaveAttribute('data-count', String(bot.reserve - 1));
      await expectParliamentFits(page, `${preset.id} overview after the quest`);
      await shoot(page, preset.id, '09-chair-after');
      expect(await strandedReports(page)).toEqual([]);
    });
  });
}
