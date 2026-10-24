import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, settle} from './consoleStart';

/**
 * TR72 «ИЗГНАНИЕ ДЕЛЕГАТА» (Banned Delegate:redux) — THE DELEGATE MODE, the staged party pick of ONE FIGURE
 * (docs/TURMOIL_REDUX_BANNED_DELEGATE.md).
 *
 * The chairman takes ANY one delegate off the table — a resolution's or a Popular Support area's — by PLAYING the
 * card. The contract under test, end to end against a real server:
 *
 *   а. The composer names the door («Выбрать делегата») and the next step («Делегат — выбор в Парламенте»), the MIN
 *      plate prints the chair; the door sends NOTHING.
 *   б. ONE flow: the crumb keeps its root and the card's name, the tail reads РОЗЫГРЫШ → РАЗЫГРАНО → ИЗГНАНИЕ; ONE
 *      Parliament instance inside the hand, no head of its own.
 *   в. The cursor walks the FIGURES — the bills' ribbons (one stop per owner), then the plaques' areas — and moves
 *      NONE of the bills or the plaques; the figure under it stands «outgoing» (faded, dashed — by form); the panel
 *      prints the SERVER's forecast (the new leader for red's figure); B walks back to the composer.
 *   г. A is the play's ONE POST, its tail ADDRESSED: `{party: Mars First, delegate: {resolution, red}, stagedFor}`.
 *   д. The flight: the ribbon loses the figure on the LIFT-OFF, red's reserve counts it on the TOUCHDOWN — never the
 *      reserve first; a flight proxy was seen.
 *   е. The server agrees: Mars First blue, red (red's earliest stays), red's reserve +1, blue leads, the card played.
 *   ж. The flow ends on the board.
 *   з. `-locked` (red in the chair): the hand chip names the chairman; `-empty`: the card is refused, named.
 *
 * Fixtures `banned-delegate`, `-locked`, `-empty` (tests/e2e/fixtures/generate.ts).
 */

const CARD = 'Banned Delegate:redux';
const CARD_RU = 'Изгнание делегата';
const ROOT_RU = 'Карты в руке';
const MARS = 'Mars First';

// The card's table runs on the TV profile (the owner's decision 2026-10-21); the FHD row joins only for the acceptance
// storyboard (`TM_E2E_STORYBOARD=1` — the frames of screenshots/banned/fhd), never as a second functional run.
const PRESETS: ReadonlyArray<{id: string, viewport: {width: number, height: number}, query: string}> = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  ...(process.env.TM_E2E_STORYBOARD === '1' ? [{id: 'fhd', viewport: {width: 1920, height: 1080}, query: ''}] : []),
];

/** The acceptance frames (screenshots/banned/<profile>/NN-name.png) — pulled back by e2e:remote. */
const OUT = path.join('screenshots', 'banned');
async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset === 'tv4k' ? 'tv' : preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Wire = {
  cardsInHand?: Array<{name: string}>;
  players: Array<{color: string, name: string}>;
  thisPlayer: {color: string, megacredits: number, tableau: Array<{name: string}>};
  game: {
    gameAge: number;
    parliament: {
      slots: Array<{party: string, votes: Array<{owner: string, seq: number}>, leader?: string}>;
      players: Array<{color: string, reserve: number}>;
      neutralSupply: number;
      popularSupport: Record<string, number>;
    };
  };
};

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

type Series = Array<[number, number]>;
type Probe = {
  samples: number;
  ticks: number;
  steps: Array<string>;
  crumbMisses: Array<string>;
  parlOutsideHand: boolean;
  parlMax: number;
  ownHead: boolean;
  degraded: Array<string>;
  stranded: boolean;
  /** Task samples: the figures on Mars First's ribbon · red's reserve count on the bench. */
  ribbon: Series;
  reserve: Series;
  flights: number;
};

async function armProbe(page: Page, victim: string): Promise<void> {
  await page.evaluate(({card, root, mars, victim}) => {
    const w = window as unknown as {__tr72: Probe};
    const p: Probe = {samples: 0, ticks: 0, steps: [], crumbMisses: [], parlOutsideHand: false, parlMax: 0, ownHead: false,
      degraded: [], stranded: false, ribbon: [], reserve: [], flights: 0};
    w.__tr72 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const note = (series: Series, value: number | undefined) => {
      if (value !== undefined && Number.isFinite(value) && series[series.length - 1]?.[1] !== value) {
        series.push([Date.now() - t0, value]);
      }
    };
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      const head = document.querySelector('.con-hand')?.querySelector('.con-wshead') ?? null;
      if (head !== null) {
        const rootText = text(head.querySelector('.con-wshead__root'));
        const subjects = Array.from(head.querySelectorAll('.con-wshead__subject')).map(text);
        if (rootText.toLowerCase() !== root.toLowerCase() || !subjects.some((s) => s.toLowerCase() === card.toLowerCase())) {
          if (p.crumbMisses.length < 8) {
            p.crumbMisses.push(`${Date.now() - t0}ms root=«${rootText}» subject=«${subjects.join('|')}»`);
          }
        }
        head.querySelectorAll('.con-wshead__step').forEach((el) => {
          const step = text(el);
          if (step !== '' && !p.steps.includes(step)) {
            p.steps.push(step);
          }
        });
      }
      const parls = document.querySelectorAll('.con-parl:not(.con-parl--warm)');
      p.parlMax = Math.max(p.parlMax, parls.length);
      parls.forEach((el) => {
        if (el.closest('.con-hand') === null || el.classList.contains('con-ws')) {
          p.parlOutsideHand = true;
        }
        if (el.querySelector('.con-wshead') !== null) {
          p.ownHead = true;
        }
        const degraded = el.getAttribute('data-parl-delegate-degraded');
        if (degraded !== null && !p.degraded.includes(degraded)) {
          p.degraded.push(degraded);
        }
      });
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
      if (!tick) {
        return;
      }
      const slot = document.querySelector(`.con-parl__slot[data-party="${mars}"]`);
      if (slot !== null) {
        note(p.ribbon, slot.querySelectorAll('.con-parl__ribbon .con-parl__vote-cube:not(.con-parl__vote-cube--place)').length);
      }
      const reserve = document.querySelector(`[data-parl-seat-reserve="${victim}"]`)?.getAttribute('data-count');
      note(p.reserve, reserve === null || reserve === undefined ? undefined : Number(reserve));
      document.querySelectorAll<HTMLElement>('.con-parl__flight:not(.con-parl__flight--agenda)').forEach((el) => {
        if (getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 2) {
          p.flights++;
        }
      });
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  }, {card: CARD_RU, root: ROOT_RU, mars: MARS, victim});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr72: Probe}).__tr72);

const composer = '.con-composer--play';
const delegateMode = '.con-hand .con-parl--embedded.con-parl--delegate:not(.con-parl--warm) [data-parl-delegate-mode]';

/** The figure the panel reads — `place:party:owner`, or undefined. */
const cursorFigure = (page: Page) => page.evaluate(() => {
  const el = document.querySelector('[data-parl-delegate-reading]');
  return el === null ? undefined : `${el.getAttribute('data-delegate-place')}:${el.getAttribute('data-delegate-party')}:${el.getAttribute('data-delegate-owner')}`;
});

/** Every bill's and plaque's box (rounded, settled) — nothing the cursor walks over may move. */
const tableBoxes = (page: Page) => page.evaluate(async () => {
  const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
  const read = () => Array.from(document.querySelectorAll<HTMLElement>('.con-parl__slot[data-instance], .con-parl__party[data-party]'))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return `${el.getAttribute('data-instance') ?? el.getAttribute('data-party')}:${[r.left, r.top, r.width, r.height].map(Math.round).join(',')}`;
    }).sort().join('|');
  let last = read();
  let equal = 0;
  for (let i = 0; i < 40 && equal < 2; i++) {
    await pause();
    const now = read();
    equal = now === last ? equal + 1 : 0;
    last = now;
  }
  return last;
});

/** Walk the cursor until the panel reads `figure` — one press at a time, each VERIFIED by the panel. */
async function moveCursorTo(page: Page, figure: string, dir: 'ArrowRight' | 'ArrowLeft' | 'ArrowUp' | 'ArrowDown'): Promise<void> {
  for (let step = 0; step < 10; step++) {
    const at = await cursorFigure(page);
    if (at === figure) {
      return;
    }
    await press(page, dir, 200);
    await expect.poll(() => cursorFigure(page), {timeout: 2_500}).not.toBe(at).catch(() => undefined);
  }
  expect(await cursorFigure(page), `the cursor reached «${figure}»`).toBe(figure);
}

/** «ВЫБРАТЬ ДЕЛЕГАТА» — one press, verified by the composer's OWN state. A second A in the mode is the COMMIT: never a blind retry. */
async function chooseDelegate(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) =>
    document.querySelector('.con-composer--submitting, .con-composer--landing') !== null || document.querySelector(sel) !== null, delegateMode);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 2_500}).toBe(true).catch(() => undefined);
  }
  await page.locator(delegateMode).waitFor({timeout: 30_000});
  await expect(page.locator(composer), 'the composer left with the landing scene').toHaveCount(0, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

/** Open the hand and focus the card (RT → the wheel's centre → the album). */
async function focusTheCard(page: Page): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
}

for (const preset of PRESETS) {
  test.describe(`TR72 Banned Delegate:redux · the delegate mode · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`play → «Выбрать делегата» → the figures inside the hand → B → back → A on red's → the figure flies home → the board (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
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

      const playerId = await bootFixture(page, request, 'banned-delegate', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const victim = before.players.find((p) => p.color !== viewer)!.color;
      const marsOf = (wire: Wire) => wire.game.parliament.slots.find((s) => s.party === MARS)!;
      const reserveOf = (wire: Wire, color: string) => wire.game.parliament.players.find((p) => p.color === color)!.reserve;
      expect(marsOf(before).votes.map((v) => v.owner), 'the fixture: Mars First reads blue, red, red').toEqual([viewer, victim, victim]);

      // ── а. the composer: the door's verb, the step row, the chair ──
      await focusTheCard(page);
      await press(page, 'Enter', 1200);
      await page.locator(composer).waitFor({timeout: 15_000});
      await settle(page);
      expect(await page.locator(`${composer} .pcard__reqs .pcard-req__icon`).first().evaluate((el) => getComputedStyle(el).backgroundImage),
        'the hero\'s MIN plate prints the chair').toContain('chair.svg');
      await expect(page.locator(composer), 'the CTA is the door\'s navigation verb').toContainText('Выбрать делегата');
      await expect(page.locator(composer), 'the next step is named, not guessed').toContainText('Делегат — выбор в Парламенте');
      await shoot(page, preset.id, '01-composer-door');

      await armProbe(page, victim);

      // ── а. «Выбрать делегата»: nothing is sent ──
      await chooseDelegate(page);
      expect(posts, 'no POST before the commit').toEqual([]);
      expect((await wireOf(request, playerId)).game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);

      // ── в. the figures: the cursor starts on the table's first figure, the panel reads the server ──
      await expect.poll(() => cursorFigure(page), {timeout: 10_000, message: 'the cursor starts on the first figure — the viewer\'s own'})
        .toBe(`resolution:${MARS}:${viewer}`);
      const ring0 = await tableBoxes(page);
      await shoot(page, preset.id, '02-mode-own-figure');
      await moveCursorTo(page, `resolution:${MARS}:${victim}`, 'ArrowRight');
      await expect(page.locator('.con-parl__slot[data-party="Mars First"] [data-delegate-outgoing]'), 'red\'s latest figure stands outgoing').toHaveCount(1);
      await expect(page.locator('[data-parl-delegate-facts] [data-parl-fact="lead"]'), 'the server\'s forecast: the lead changes hands').toHaveCount(1);
      await expect(page.locator('[data-parl-delegate-facts] [data-parl-fact="votes"]'), '«ДЕЛЕГАТЫ 3 → 2»').toContainText('3');
      await shoot(page, preset.id, '03-mode-rival-figure');
      // ◀ past the table's first figure steps into the areas' column.
      await moveCursorTo(page, `resolution:${MARS}:${viewer}`, 'ArrowLeft');
      await press(page, 'ArrowLeft', 300);
      await expect.poll(() => cursorFigure(page), {timeout: 3_000}).toMatch(/^support:/);
      await expect(page.locator('[data-support-outgoing]'), 'the area\'s one outgoing place').toHaveCount(1);
      await shoot(page, preset.id, '04-mode-area-figure');
      await press(page, 'ArrowRight', 300);
      await expect.poll(() => cursorFigure(page), {timeout: 3_000}).toBe(`resolution:${MARS}:${viewer}`);
      expect(await tableBoxes(page), 'walking the figures moved no bill and no plaque').toBe(ring0);
      expect(posts, 'walking the figures sends nothing').toEqual([]);

      // ── в. B walks back to the composer — nothing sent ──
      const backTaken = () => page.evaluate((sel) =>
        document.querySelector(sel) !== null || document.querySelector('.con-parl:not(.con-parl--warm)') === null ||
        document.querySelector('.con-parl[data-parl-leaving]') !== null, composer);
      for (let attempt = 0; attempt < 3 && !await backTaken(); attempt++) {
        await press(page, 'Escape', 300);
        await expect.poll(backTaken, {timeout: 3_000}).toBe(true).catch(() => undefined);
      }
      await expect(page.locator(composer), 'B restores the composer').toHaveCount(1, {timeout: 15_000});
      await expect(page.locator('.con-parl:not(.con-parl--warm)'), 'the step left').toHaveCount(0, {timeout: 10_000});
      await settle(page);
      await shoot(page, preset.id, '05-back-composer');
      expect(posts).toEqual([]);

      // ── г. in again; A on red's figure is the play's ONE POST, addressed ──
      await chooseDelegate(page);
      await moveCursorTo(page, `resolution:${MARS}:${victim}`, 'ArrowRight');
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.map((p) => new URL(p.url).pathname), 'the play is ONE batch POST').toEqual(['/player/input-batch']);
      // The acceptance frame of the figure IN THE AIR (a state, never a duration) — absent if the flight already landed.
      await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-parl__flight:not(.con-parl__flight--agenda)'))
        .some((el) => getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 2)), {timeout: 8_000, intervals: [16]}).toBe(true).catch(() => undefined);
      await shoot(page, preset.id, '06-flight');
      const sent = JSON.parse(posts[0].body) as {responses?: Array<Record<string, unknown>>} | Array<Record<string, unknown>>;
      const responses = Array.isArray(sent) ? sent : sent.responses ?? [];
      expect(responses[responses.length - 1], 'the tail is the FIGURE, addressed to the card').toMatchObject(
        {type: 'party', partyName: MARS, delegate: {place: 'resolution', owner: victim}, stagedFor: CARD});

      // ── е. the server ──
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau.map((c) => c.name),
        {timeout: 30_000, message: 'the committed play reached the table'}).toContain(CARD);
      const after = await wireOf(request, playerId);
      expect(marsOf(after).votes.map((v) => v.owner), 'red\'s LATEST left — the earliest stays').toEqual([viewer, victim]);
      expect(marsOf(after).votes[1].seq, '…the earliest of red\'s two').toBe(marsOf(before).votes[1].seq);
      expect(reserveOf(after, victim), 'red\'s reserve +1').toBe(reserveOf(before, victim) + 1);
      expect(marsOf(after).leader, '1–1: blue\'s figure came first').toBe(viewer);
      expect(after.thisPlayer.megacredits, 'the card cost nothing').toBe(before.thisPlayer.megacredits);

      // ── ж. the flow ends on the board ──
      await expect.poll(() => page.evaluate(() => ({
        hand: document.querySelectorAll('.con-hand').length,
        parl: document.querySelectorAll('.con-parl').length,
        ws: document.querySelectorAll('.con-ws').length,
      })), {timeout: 40_000, message: 'the finished flow leaves for the board'}).toEqual({hand: 0, parl: 0, ws: 0});
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, preset.id, '07-board-after');
      expect(posts.length, 'and nothing else was sent').toBe(1);

      const probe = await readProbe(page);
      const dump = JSON.stringify({steps: probe.steps, ribbon: probe.ribbon, reserve: probe.reserve, flights: probe.flights});
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/banned-delegate-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(40);

      // ── б. one flow ──
      expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
      expect(probe.steps, `the tail only ever moved forward (${dump})`).toEqual(['Розыгрыш', 'Разыграно', 'Изгнание']);
      expect(probe.parlOutsideHand, 'the Parliament stood inside the hand').toBe(false);
      expect(probe.parlMax, 'ONE Parliament instance').toBe(1);
      expect(probe.ownHead, 'the embedded Parliament drew no head of its own').toBe(false);

      // ── д. the flight: the ribbon on the lift-off, the reserve on the touchdown ──
      const base = reserveOf(before, victim);
      const drop = probe.ribbon.find(([, v]) => v === 2)?.[0];
      const rise = probe.reserve.find(([, v]) => v === base + 1)?.[0];
      expect(probe.ribbon[0]?.[1], `the ribbon read three figures first (${dump})`).toBe(3);
      expect(drop, `the ribbon lost the figure (${dump})`).toBeDefined();
      expect(probe.reserve[0]?.[1], `red's reserve read its old count first (${dump})`).toBe(base);
      expect(rise, `red's reserve counted the figure (${dump})`).toBeDefined();
      expect(drop!, `the figure left its place before the reserve counted it (${dump})`).toBeLessThanOrEqual(rise!);
      expect(probe.flights, `the figure was seen in flight (${dump})`).toBeGreaterThan(0);

      expect(probe.degraded, 'no flight confessed a missing rect').toEqual([]);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page errors').toEqual([]);
    });

    test(`з. the card refuses itself, named: red in the chair · an empty table (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      const lockedId = await bootFixture(page, request, 'banned-delegate-locked', {query: preset.query});
      const locked = await wireOf(request, lockedId);
      const chairName = locked.players.find((p) => p.color !== locked.thisPlayer.color)!.name;
      await focusTheCard(page);
      await expect(page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).locator('xpath=ancestor-or-self::*[contains(@class,"con-hand__slot")][1]').locator('.con-hand__chip'),
        'the hand\'s chip names who holds the chair').toContainText(chairName);
      await shoot(page, preset.id, '08-locked-chair');

      await bootFixture(page, request, 'banned-delegate-empty', {query: preset.query});
      await focusTheCard(page);
      await expect(page.locator('.con-hand'), 'the empty table is the card\'s named refusal').toContainText('нет делегатов');
      await shoot(page, preset.id, '09-empty-table');
    });
  });
}
