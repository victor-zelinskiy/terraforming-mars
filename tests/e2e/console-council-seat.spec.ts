import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, closeZoomViewer, fetchPlayerModel, focusCard, openCardActions, openConsole, openZoomViewer, press, pressUntil, reloadConsole, settle,
  waitForBoardHome, walkFocusUntil,
} from './consoleStart';
import {armLeakWitness, focusParliamentZone, openParliament, parliament, strandedReports} from './parliamentDrive';

/**
 * TR36 «МЕСТО В СОВЕТЕ» — THE LAW OF ACCESS, lowered by a card
 * (docs/TURMOIL_REDUX_COUNCIL_SEAT.md).
 *
 * «You only need 1 delegate on a resolution to gain its party's effect.» The
 * first card of the set that changes not the table but the RULE the table is
 * read by: for the owner the party-effect threshold is 1, for every party at
 * once, live, never stored — and the card REQUIREMENT stays 2 everywhere
 * (FAQ p.19). The contract under test, against a real server, two profiles:
 *
 *   1. BEFORE the play the Parliament reads the printed law: the Scientists'
 *      slot «ВАШИ ▢▢ 1» with no held word, the plaque «1/2» on two live
 *      places, the Scientists' action absent from «Действия карт» (no access).
 *   2. The composer BEFORE the press names what opens NOW — ONE «Далее» row:
 *      the Scientists' effect by the delegate standing on their card — and no
 *      chip (the play moves nothing); nothing is sent.
 *   3. A → exactly ONE POST; the play is an ordinary landing (no hosted
 *      Parliament, never a second workspace); the flow leaves for the board.
 *   4. AFTER: the server reads threshold 1 for blue (the Scientists held, the
 *      requirement still unmet; the Reds held by two with the requirement
 *      met); the Parliament reads the lowered law on blue's rows — the
 *      Scientists' slot «▣▢ 1 · ЭФФЕКТ ВАШ» with the second place VOID and in
 *      the flow, the plaque «1/1» with the held word, the action badge lit —
 *      and the Scientists' action now in «Действия карт».
 *   5. The inspector (X on the plaque) quotes the card: the Scientists —
 *      «ваш делегат на её резолюции («Место в совете»: достаточно одного)»
 *      and the requirement's note; the Reds — the printed road («два ваших
 *      делегата»), no «не выполнено».
 *   6. The vote mode: Mars First's slot (no cube) projects the EDGE at one —
 *      the party-effect fact «0 из 1 → эффект ваш»; the Scientists' slot (one
 *      cube, held) projects no effect fact at all.
 *   7. RED, on its own console: every one of its rows reads the printed ▢▢
 *      (no void place), and blue's card stands in blue's tableau.
 *   8. A reload keeps it all: the lowered law is read off the tableau again.
 *
 * Fixture `council-seat` (tests/e2e/fixtures/generate.ts); the dry run there
 * plays the card on a copy and pins the server's reading.
 */

const CARD = 'Council Seat';
const REDS = 'Reds';
const SCIENTISTS = 'Scientists';
const MARS = 'Mars First';
const OUT = path.resolve('screenshots', 'council-seat');

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
] as const;

type Access = {party: string, delegates: number, effectDelegates?: number, effectDelegatesBy?: string, byDelegates: boolean, hasEffect: boolean, satisfiesRequirement: boolean};
type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, tableau: Array<{name: string}>};
  players: Array<{color: string, tableau: Array<{name: string}>}>;
  game: {
    parliament: {
      slots: Array<{instance: string, party: string, votes: Array<{owner: string}>, viewerVotes: number}>;
      players: Array<{color: string, access: Array<Access>}>;
    };
  };
};

/** The server's own view. One retry on a dropped socket: a loaded per-worker server resets a connection now and then. */
async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  try {
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  } catch (err) {
    if (!/ECONNRESET|socket hang up/.test(String(err))) {
      throw err;
    }
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  }
}

const accessOf = (wire: Wire, color: string, party: string): Access | undefined =>
  wire.game.parliament.players.find((p) => p.color === color)?.access.find((a) => a.party === party);

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, by CDP screencast, named by its time. */
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

const composer = '.con-composer--play';

/** The wheel → the hand → the card → its composer. */
async function openComposer(page: Page): Promise<void> {
  await press(page, 'Period', 600); // RT → the quick wheel
  await press(page, 'Enter', 1600); // centre slot → the hand
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await press(page, 'Enter', 1200);
  await page.locator(composer).waitFor({timeout: 15_000});
  await settle(page);
}

/** The «ВАШИ ▢▢ n» row of a slot as the viewer reads it. */
type MineRow = {threshold: string | null, places: number, on: number, voids: number, count: string, held: boolean};
async function mineRowOf(page: Page, party: string): Promise<MineRow> {
  return page.evaluate((p) => {
    const slot = document.querySelector(`.con-parl__slot[data-party="${p}"]`);
    const row = slot?.querySelector('[data-parl-mine]');
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return {
      threshold: row?.getAttribute('data-parl-mine-threshold') ?? null,
      places: row?.querySelectorAll('.con-parl__place').length ?? -1,
      on: row?.querySelectorAll('.con-parl__place--on').length ?? -1,
      voids: row?.querySelectorAll('[data-parl-place-void]').length ?? -1,
      count: text(row?.querySelector('b') ?? null),
      held: row?.querySelector('[data-parl-held]') !== null && row?.querySelector('[data-parl-held]') !== undefined,
    };
  }, party);
}

/** The party plaque's foot as the viewer reads it. */
type Plaque = {live: string | null, count: string, on: number, voids: number, word: string, action: string | null, kind: string | null};
async function plaqueOf(page: Page, party: string): Promise<Plaque> {
  return page.evaluate((p) => {
    const plaque = document.querySelector(`.con-parl__party[data-party="${p}"] .con-pseal`);
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const places = plaque?.querySelector('.con-pseal__places') ?? null;
    return {
      live: places?.getAttribute('data-pseal-places') ?? null,
      count: text(plaque?.querySelector('.con-pseal__places-count') ?? null),
      on: places?.querySelectorAll('.con-pseal__place--on').length ?? -1,
      voids: places?.querySelectorAll('[data-pseal-place-void]').length ?? -1,
      word: text(plaque?.querySelector('.con-pseal__state-text') ?? null),
      action: plaque?.querySelector('.con-pseal__action')?.getAttribute('data-action-state') ?? null,
      kind: plaque?.querySelector('.con-pseal__state')?.getAttribute('data-state-kind') ?? null,
    };
  }, party);
}

/** Down to the parties row, then along it to `party`. */
async function focusParty(page: Page, party: string): Promise<void> {
  const partyFocused = () => page.evaluate(() => document.querySelector('.con-parl__party--focus')?.getAttribute('data-party') ?? '');
  if (await parliament(page).getAttribute('data-zone') !== 'parties') {
    await press(page, 'ArrowDown', 400);
  }
  expect(await walkFocusUntil(page, async () => await partyFocused() === party, partyFocused, 14), `never focused the «${party}» plaque`).toBeTruthy();
}

/** The fullscreen inspector's rules text (every group), opened with X over the focused object. */
async function inspectText(page: Page, preset: string, name: string): Promise<string> {
  await openZoomViewer(page);
  await expect(page.locator('.con-zoom-rules').first()).toBeVisible({timeout: 10_000});
  await settle(page, {timeoutMs: 8_000});
  await shoot(page, preset, name);
  const text = await page.evaluate(() => Array.from(document.querySelectorAll('dialog.con-zoom[open] .con-zoom-rules'))
    .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | '));
  await closeZoomViewer(page);
  return text;
}

const voteStep = (page: Page) => page.locator('.con-parl__vote.con-parl__vote--up');
const selectedParty = (page: Page) => page.locator('.con-parl__slot--selected').first().getAttribute('data-party');

/** Inside the vote mode, ◀ ▶ until `party`'s card is the selected one. */
async function selectVoteSlot(page: Page, party: string): Promise<void> {
  for (let i = 0; i < 6 && await selectedParty(page) !== party; i++) {
    await press(page, i < 3 ? 'ArrowRight' : 'ArrowLeft', 500);
  }
  expect(await selectedParty(page), `the vote mode selected «${party}»`).toBe(party);
  await settle(page, {timeoutMs: 8_000});
}

type Probe = {samples: number, ticks: number, steps: Array<string>, parlMax: number, wsMax: number, stranded: boolean, handGone: number};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__tr36: Probe};
    const p: Probe = {samples: 0, ticks: 0, steps: [], parlMax: 0, wsMax: 0, stranded: false, handGone: -1};
    w.__tr36 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      document.querySelectorAll('.con-hand .con-wshead__step').forEach((el) => {
        const step = text(el);
        if (step !== '' && !p.steps.includes(step)) {
          p.steps.push(step);
        }
      });
      p.parlMax = Math.max(p.parlMax, document.querySelectorAll('.con-parl').length);
      p.wsMax = Math.max(p.wsMax, document.querySelectorAll('.con-ws').length);
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
      if (p.handGone < 0 && document.querySelector('.con-hand') === null) {
        p.handGone = Date.now() - t0;
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  });
}
const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr36: Probe}).__tr36);

for (const preset of PRESETS) {
  test.describe(`TR36 Council Seat · the law of access, lowered · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the Parliament reads the printed law → the play → the lowered law on every surface; red keeps the printed one (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(480_000);
      const pageErrors: Array<string> = [];
      const overflow: Array<string> = [];
      const posts: Array<{url: string, body: string}> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => {
        if (m.text().includes('[console-overflow]')) {
          overflow.push(m.text().slice(0, 200));
        }
      });
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push({url: r.url(), body: r.postData() ?? ''});
        }
      });

      const {playerId, seats} = await bootFixtureSeats(page, request, 'council-seat', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const blue = before.thisPlayer.color;
      expect(before.cardsInHand?.map((c) => c.name), 'the fixture: the card in hand').toContain(CARD);
      expect(before.game.parliament.slots.map((s) => s.party), 'the fixture: [Reds · Scientists · Mars First]').toEqual([REDS, SCIENTISTS, MARS]);
      expect(before.game.parliament.slots.map((s) => s.viewerVotes), 'the fixture: blue 2 / 1 / 0').toEqual([2, 1, 0]);
      expect(accessOf(before, blue, SCIENTISTS), 'before: the printed law — one cube is not enough').toMatchObject({delegates: 1, effectDelegates: 2, byDelegates: false, hasEffect: false});
      expect(accessOf(before, blue, SCIENTISTS)?.effectDelegatesBy, 'before: no card names the law').toBeUndefined();

      // ── 1. BEFORE: the printed law on the Parliament; the Scientists' action absent from the action centre ──
      await openParliament(page);
      const sciBefore = await mineRowOf(page, SCIENTISTS);
      expect(sciBefore, 'the Scientists\' slot: two live places, one lit, no held word').toMatchObject({threshold: '2', places: 2, on: 1, voids: 0, count: '1', held: false});
      await focusParty(page, SCIENTISTS);
      const plaqueBefore = await plaqueOf(page, SCIENTISTS);
      expect(plaqueBefore, 'the plaque: «1/2» on two live places, no word').toMatchObject({live: '2', count: '1/2', on: 1, voids: 0, word: '', kind: 'progress'});
      expect(plaqueBefore.action, 'the action badge: no access').not.toBe('available');
      await shoot(page, preset.id, '01-parliament-before');
      for (let i = 0; i < 4 && await parliament(page).count() > 0; i++) {
        await press(page, 'Escape', 900);
      }
      await waitForBoardHome(page);
      await openCardActions(page);
      await expect(page.locator(`.con-cardactions__tile[data-action-party="${SCIENTISTS}"]`), 'no access — no Scientists\' tile in «Действия карт»').toHaveCount(0);
      for (let i = 0; i < 4 && await page.locator('.con-cardactions').count() > 0; i++) {
        await press(page, 'Escape', 900);
      }
      await waitForBoardHome(page);

      // ── 2. the composer: what opens NOW, in words, and no chip ──
      await openComposer(page);
      await expect(page.locator(composer), 'the CTA is the play\'s own verb').toContainText('Разыграть карту');
      const next = page.locator(`${composer} .con-composer__next`);
      await expect(next, 'ONE «Далее» row — the one party the play opens').toHaveCount(1);
      await expect(next.first(), 'the Scientists open by the cube standing on their card').toContainText(/Откроет эффект партии «Учёные» сейчас: ваш делегат на «/);
      await expect(page.locator(`${composer} .action-effect-chip`), 'no chip — the play moves nothing on the table').toHaveCount(0);
      expect(posts.length, 'nothing sent before A').toBe(0);
      await shoot(page, preset.id, '02-composer');

      await armProbe(page);
      const stopStory = await storyboard(page, preset.id, 'play');

      // ── 3. A: ONE POST; an ordinary landing; the flow leaves for the board ──
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.length, 'the play is ONE POST').toBe(1);
      expect(posts[0].body, 'the POST is the card\'s play').toContain(CARD);
      await expect.poll(() => page.evaluate(() => ({hand: document.querySelectorAll('.con-hand').length, ws: document.querySelectorAll('.con-ws').length})),
        {timeout: 60_000, message: 'the finished flow leaves for the board'}).toEqual({hand: 0, ws: 0});
      await waitForBoardHome(page);
      await settle(page, {timeoutMs: 30_000});
      await stopStory();
      expect(posts.length, 'and nothing else was sent').toBe(1);
      const probe = await readProbe(page);
      expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(20);
      expect(probe.parlMax, 'no Parliament rose during the play — the law changes, the table does not').toBe(0);
      expect(probe.wsMax, 'never a second workspace band').toBeLessThanOrEqual(1);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(probe.steps.filter((s) => s !== 'Розыгрыш' && s !== 'Разыграно'), `no stage but the play's own (${JSON.stringify(probe.steps)})`).toEqual([]);

      // ── 4. AFTER: the server's law, then the Parliament's reading of it ──
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      expect(after.thisPlayer.megacredits, 'the price and nothing else').toBe(before.thisPlayer.megacredits - 6);
      expect(after.game.parliament.slots.map((s) => s.viewerVotes), 'no cube moved').toEqual([2, 1, 0]);
      expect(accessOf(after, blue, SCIENTISTS), 'the Scientists: held by ONE cube, the requirement still unmet').toMatchObject({delegates: 1, effectDelegates: 1, effectDelegatesBy: CARD, byDelegates: true, hasEffect: true, satisfiesRequirement: false});
      expect(accessOf(after, blue, REDS), 'the Reds: held by two, the requirement met').toMatchObject({delegates: 2, effectDelegates: 1, byDelegates: true, hasEffect: true, satisfiesRequirement: true});
      expect(accessOf(after, blue, MARS), 'Mars First: no cube — nothing yet, at threshold 1').toMatchObject({delegates: 0, effectDelegates: 1, hasEffect: false});
      const red = after.game.parliament.players.find((p) => p.color !== blue)!;
      expect(red.access.map((a) => a.effectDelegates ?? 2), 'red keeps the printed two on every party').toEqual(red.access.map(() => 2));

      await openParliament(page);
      await expect.poll(() => mineRowOf(page, SCIENTISTS), {timeout: 15_000, message: 'the Scientists\' slot reads the lowered law'})
        .toMatchObject({threshold: '1', places: 2, on: 1, voids: 1, count: '1', held: true});
      expect(await mineRowOf(page, MARS), 'Mars First\'s slot: «▢ 0», the second place void').toMatchObject({threshold: '1', places: 2, on: 0, voids: 1, count: '0', held: false});
      expect(await mineRowOf(page, REDS), 'the Reds\' slot: held, the count still the two cubes').toMatchObject({threshold: '1', on: 1, voids: 1, count: '2', held: true});
      await focusParty(page, SCIENTISTS);
      const plaqueAfter = await plaqueOf(page, SCIENTISTS);
      expect(plaqueAfter, 'the plaque: «1/1», one lit, one void, the held word, the badge lit').toMatchObject({live: '1', count: '1/1', on: 1, voids: 1, word: 'Эффект ваш', action: 'available', kind: 'delegates'});
      const marsPlaque = await plaqueOf(page, MARS);
      expect(marsPlaque, 'Mars First\'s plaque: «0/1»').toMatchObject({live: '1', count: '0/1', on: 0, voids: 1, kind: 'in-area'});
      await shoot(page, preset.id, '03-parliament-after');

      // ── 5. the inspector quotes the card ──
      const sciText = await inspectText(page, preset.id, '04-inspect-scientists');
      expect(sciText, 'the Scientists: held by the one cube, the card named').toMatch(/Доступен · ваш делегат на её резолюции \(«Место в совете»: достаточно одного\)/);
      expect(sciText, '…and the requirement\'s note in the threshold\'s own words').toMatch(/один делегат открывает эффект, требованию по-прежнему нужны два/);
      expect(sciText, 'the reference block speaks the viewer\'s own law (PL-113)').toMatch(/Партия, на резолюции которой один ваш делегат, даёт свой эффект и вам \(«Место в совете»\)/);
      expect(sciText, '…never the printed two over a lowered table').not.toMatch(/два ваших делегата, даёт/);
      await focusParty(page, REDS);
      const redsText = await inspectText(page, preset.id, '04b-inspect-reds');
      expect(redsText, 'the Reds: the printed road — two cubes').toMatch(/Доступен · два ваших делегата на её резолюции/);
      expect(redsText, 'the Reds\' requirement is met — no «не выполнено»').not.toMatch(/не выполнено/);
      expect(redsText, 'the card is not what holds the Reds — only the reference names it').not.toMatch(/Доступен · ваш делегат/);

      // ── 6. the vote mode: the edge at ONE on an empty card, no effect fact on a held one ──
      await focusParliamentZone(page, 'voting');
      await press(page, 'Enter', 1200);
      await expect(voteStep(page), 'the vote mode opens').toHaveCount(1);
      await selectVoteSlot(page, MARS);
      await expect(page.locator('[data-parl-fact="access"]'), 'Mars First: the party effect is a fact — the edge').toHaveCount(1);
      await expect(page.locator('[data-parl-fact="access"]')).toHaveAttribute('data-parl-fact-tone', 'gain');
      await expect(page.locator('[data-parl-fact="access"]'), '«0 из 1 → эффект ваш»').toContainText(/0 из 1.*эффект ваш/i);
      await shoot(page, preset.id, '05-vote-mars');
      await openZoomViewer(page);
      await expect(page.locator('dialog.con-zoom[open] .con-rstatus'), 'the footer: progress at threshold 1, this vote unlocks').toHaveAttribute('data-access', 'progress');
      await expect(page.locator('dialog.con-zoom[open] .con-rstatus__count').first()).toHaveText('0/1');
      await expect(page.locator('dialog.con-zoom[open] [data-zoom-vote-access]'), 'the footer projects «→ эффект ваш»').toHaveCount(1);
      await closeZoomViewer(page);
      await selectVoteSlot(page, SCIENTISTS);
      await expect(page.locator('[data-parl-fact="access"]'), 'the Scientists: held already — no effect fact for the second cube').toHaveCount(0);
      await shoot(page, preset.id, '06-vote-scientists');
      expect(await pressUntil(page, 'Escape', async () => await voteStep(page).count() === 0, {tries: 3, settleMs: 900}), 'B folds the mode').toBeTruthy();
      await settle(page, {timeoutMs: 8_000});
      for (let i = 0; i < 4 && await parliament(page).count() > 0; i++) {
        await press(page, 'Escape', 900);
      }
      await waitForBoardHome(page);
      await openCardActions(page);
      const tile = page.locator(`.con-cardactions__tile[data-action-party="${SCIENTISTS}"]`);
      await expect(tile, 'the Scientists\' action is in «Действия карт» now').toHaveCount(1);
      await expect(tile, '…available').toHaveClass(/con-cardactions__tile--available/);
      await shoot(page, preset.id, '07-actions-after');
      for (let i = 0; i < 4 && await page.locator('.con-cardactions').count() > 0; i++) {
        await press(page, 'Escape', 900);
      }
      await waitForBoardHome(page);
      expect(await strandedReports(page), 'the leak witness saw nothing').toEqual([]);
      expect(overflow, 'no overflow').toEqual([]);
      expect(pageErrors, 'no page error').toEqual([]);

      // ── 7. RED: the printed law on its own rows; blue's card in blue's tableau ──
      const redPage = await context.newPage();
      const redErrors: Array<string> = [];
      redPage.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(redPage, seats[1], preset.query);
      await settle(redPage, {timeoutMs: 30_000});
      const redWire = await wireOf(request, seats[1]);
      expect(redWire.players.find((p) => p.color === blue)?.tableau.map((c) => c.name), 'red sees the card in blue\'s tableau').toContain(CARD);
      await openParliament(redPage);
      const redRows = await redPage.evaluate(() => Array.from(document.querySelectorAll('[data-parl-mine]')).map((row) => ({
        threshold: row.getAttribute('data-parl-mine-threshold'), voids: row.querySelectorAll('[data-parl-place-void]').length,
      })));
      expect(redRows.length, 'red\'s three rows').toBe(3);
      expect(redRows.every((r) => r.threshold === '2' && r.voids === 0), `red keeps the printed ▢▢ on every card (${JSON.stringify(redRows)})`).toBe(true);
      await shoot(redPage, preset.id, '08-red-parliament');
      expect(redErrors, 'no page error on red\'s page').toEqual([]);
      await redPage.close();

      // ── 8. a reload: the law is read off the tableau again ──
      await reloadConsole(page);
      await settle(page, {timeoutMs: 30_000});
      await openParliament(page);
      await expect.poll(() => mineRowOf(page, SCIENTISTS), {timeout: 15_000, message: 'after a reload the Scientists\' slot still reads the lowered law'})
        .toMatchObject({threshold: '1', on: 1, voids: 1, held: true});
      await focusParty(page, SCIENTISTS);
      expect(await plaqueOf(page, SCIENTISTS)).toMatchObject({live: '1', count: '1/1', word: 'Эффект ваш'});
      await shoot(page, preset.id, '09-after-reload');
    });
  });
}
