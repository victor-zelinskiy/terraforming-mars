import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, settle} from './consoleStart';

/**
 * TR74 «ВЕРБОВКА» (Recruitment:redux) — THE DELEGATE MODE AS AN EXCHANGE (`delegatePrompt.source: 'exchange'`,
 * docs/TURMOIL_REDUX_BANNED_DELEGATE.md §6): a NEUTRAL delegate on a resolution leaves for the common supply and one of
 * the player's own from the reserve takes its place — TR72's figure pick, no second mode, no second input.
 *
 *   а. The composer names the door («Выбрать делегата») and the next step («Делегат — выбор в Парламенте»); the door
 *      sends NOTHING.
 *   б. ONE flow: the crumb keeps its root and the card's name, the tail reads РОЗЫГРЫШ → РАЗЫГРАНО → ОБМЕН; ONE
 *      Parliament instance inside the hand, no head of its own.
 *   в. The cursor walks ONLY the neutral figures on the bills (a seat's cube, a support area — no stops), moves no bill
 *      and no plaque; the panel reads both halves — the neutral figure «→ В общий запас», MY figure «из резерва → на
 *      «R»» — and the server's forecast after BOTH moves («Ваши делегаты 1 → 2», the Greens' effect GAINED); B walks back.
 *   г. A is the play's ONE POST, its tail ADDRESSED: `{party: Greens, delegate: {resolution, neutral}, stagedFor}`.
 *   д. The flight — TWO moves, one phrase: the ribbon loses the neutral figure on its LIFT-OFF, the supply counts it on
 *      the TOUCHDOWN; THEN my reserve gives its figure up on ITS lift-off and the ribbon counts it on its touchdown
 *      (2 → 1 → 2 — never a swap in place, never a teleport).
 *   е. The server agrees: the Greens read blue, blue; blue's reserve −1, the supply +1, the card's 2 M€ only.
 *   ж. The flow ends on the board.
 *   з. `-locked` (no neutral cube on a bill) and `-no-reserve`: the card is refused, each blocker named.
 *   и. Reduced motion: the same answer, the table reads the server at once, nothing flies.
 *
 * Fixtures `recruitment`, `-locked`, `-no-reserve` (tests/e2e/fixtures/generate.ts).
 */

const CARD = 'Recruitment:redux';
const CARD_RU = 'Вербовка';
const ROOT_RU = 'Карты в руке';
const MARS = 'Mars First';
const GREENS = 'Greens';

// The card's table runs on the TV profile (the owner's decision 2026-10-21); the FHD row joins only for the acceptance
// storyboard (`TM_E2E_STORYBOARD=1` — the frames of screenshots/recruit/fhd), never as a second functional run.
const PRESETS: ReadonlyArray<{id: string, viewport: {width: number, height: number}, query: string}> = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  ...(process.env.TM_E2E_STORYBOARD === '1' ? [{id: 'fhd', viewport: {width: 1920, height: 1080}, query: ''}] : []),
];

/** The acceptance frames (screenshots/recruit/<profile>/NN-name.png) — pulled back by e2e:remote. */
const OUT = path.join('screenshots', 'recruit');
async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset === 'tv4k' ? 'tv' : preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Wire = {
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
  /** Task samples: the VISIBLE figures on the Greens' ribbon · blue's reserve · the neutral supply. */
  ribbon: Series;
  reserve: Series;
  pool: Series;
  flights: number;
};

async function armProbe(page: Page, viewer: string): Promise<void> {
  await page.evaluate(({card, root, greens, viewer}) => {
    const w = window as unknown as {__tr74: Probe};
    const p: Probe = {samples: 0, ticks: 0, steps: [], crumbMisses: [], parlOutsideHand: false, parlMax: 0, ownHead: false,
      degraded: [], stranded: false, ribbon: [], reserve: [], pool: [], flights: 0};
    w.__tr74 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const note = (series: Series, value: number | undefined) => {
      if (value !== undefined && Number.isFinite(value) && series[series.length - 1]?.[1] !== value) {
        series.push([Date.now() - t0, value]);
      }
    };
    const count = (sel: string) => {
      const raw = document.querySelector(sel)?.getAttribute('data-count');
      return raw === null || raw === undefined ? undefined : Number(raw);
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
      const slot = document.querySelector(`.con-parl__slot[data-party="${greens}"]`);
      if (slot !== null) {
        note(p.ribbon, slot.querySelectorAll('.con-parl__ribbon .con-parl__vote-cube:not(.con-parl__vote-cube--place):not(.con-parl__vote-cube--hidden)').length);
      }
      note(p.reserve, count(`[data-parl-seat-reserve="${viewer}"]`));
      note(p.pool, count('[data-parl-neutral-cube]'));
      document.querySelectorAll<HTMLElement>('.con-parl__flight:not(.con-parl__flight--agenda)').forEach((el) => {
        if (getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 2) {
          p.flights++;
        }
      });
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  }, {card: CARD_RU, root: ROOT_RU, greens: GREENS, viewer});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr74: Probe}).__tr74);

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
async function moveCursorTo(page: Page, figure: string, dir: 'ArrowRight' | 'ArrowLeft'): Promise<void> {
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

/** A on the figure under the cursor — the play's ONE POST; retried only while nothing was sent. */
async function commitPick(page: Page, posts: Array<{url: string, body: string}>): Promise<void> {
  for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
  }
}

const greensOf = (wire: Wire) => wire.game.parliament.slots.find((s) => s.party === GREENS)!;
const marsOf = (wire: Wire) => wire.game.parliament.slots.find((s) => s.party === MARS)!;
const reserveOf = (wire: Wire, color: string) => wire.game.parliament.players.find((p) => p.color === color)!.reserve;

for (const preset of PRESETS) {
  test.describe(`TR74 Recruitment:redux · the delegate mode as an exchange · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`play → «Выбрать делегата» → the neutral figures → B → back → A on the Greens' → neutral out, mine in → the board (${preset.id})`, async ({page, request}) => {
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

      const playerId = await bootFixture(page, request, 'recruitment', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      expect(greensOf(before).votes.map((v) => v.owner), 'the fixture: the Greens read neutral, blue').toEqual(['neutral', viewer]);
      expect(marsOf(before).votes.map((v) => v.owner), 'the fixture: Mars First reads neutral, neutral').toEqual(['neutral', 'neutral']);

      // ── а. the composer: the door's verb and the step row ──
      await focusTheCard(page);
      await press(page, 'Enter', 1200);
      await page.locator(composer).waitFor({timeout: 15_000});
      await settle(page);
      await expect(page.locator(composer), 'the CTA is the door\'s navigation verb').toContainText('Выбрать делегата');
      await expect(page.locator(composer), 'the next step is named, not guessed').toContainText('Делегат — выбор в Парламенте');
      await shoot(page, preset.id, '01-composer-door');

      await armProbe(page, viewer);

      // ── а. «Выбрать делегата»: nothing is sent ──
      await chooseDelegate(page);
      expect(posts, 'no POST before the commit').toEqual([]);
      expect((await wireOf(request, playerId)).game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);
      await expect(page.locator('[data-parl-delegate-mode]'), 'the mode reads the exchange marker').toHaveAttribute('data-delegate-source', 'exchange');

      // ── в. ONLY the neutral figures on the bills: Mars First's, then the Greens' — a wall on both sides ──
      await expect.poll(() => cursorFigure(page), {timeout: 10_000, message: 'the cursor starts on the table\'s first neutral figure'})
        .toBe(`resolution:${MARS}:neutral`);
      const ring0 = await tableBoxes(page);
      await shoot(page, preset.id, '02-mode-mars-neutral');
      const seen = new Set<string>();
      for (const dir of ['ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft'] as const) {
        await press(page, dir, 250);
        seen.add(String(await cursorFigure(page)));
      }
      expect([...seen].sort(), 'the stops are the two neutral figures — no seat\'s cube, no support area').toEqual(
        [`resolution:${GREENS}:neutral`, `resolution:${MARS}:neutral`].sort());
      await moveCursorTo(page, `resolution:${GREENS}:neutral`, 'ArrowRight');
      await expect(page.locator(`.con-parl__slot[data-party="${GREENS}"] [data-delegate-outgoing]`), 'the Greens\' neutral figure stands outgoing').toHaveCount(1);
      await expect(page.locator('[data-parl-delegate-dest]'), 'the neutral figure goes to the common supply').toContainText('В общий запас');
      await expect(page.locator('[data-parl-delegate-arrives]'), 'MY figure is the second half').toHaveAttribute('data-delegate-arrives', viewer);
      await expect(page.locator('[data-parl-delegate-arrives]')).toContainText('Ваш делегат из резерва');
      await expect(page.locator('[data-parl-delegate-facts] [data-parl-fact="own"]'), '«Ваши делегаты 1 → 2»').toContainText('2');
      await expect(page.locator('[data-parl-delegate-facts] [data-parl-fact="gained"]'), 'the Greens\' effect is GAINED').toHaveCount(1);
      await expect(page.locator('[data-parl-delegate-facts] [data-parl-fact="votes"]'), 'never «votes 2 → 2»').toHaveCount(0);
      await expect(page.locator('[data-parl-delegate-reading][data-delegate-sole]'), 'two offers — no «единственная цель»').toHaveCount(0);
      await shoot(page, preset.id, '03-mode-greens-neutral');
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
      expect(posts).toEqual([]);

      // ── г. in again; A on the Greens' neutral figure is the play's ONE POST, addressed ──
      await chooseDelegate(page);
      await moveCursorTo(page, `resolution:${GREENS}:neutral`, 'ArrowRight');
      await commitPick(page, posts);
      expect(posts.map((p) => new URL(p.url).pathname), 'the play is ONE batch POST').toEqual(['/player/input-batch']);
      await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-parl__flight:not(.con-parl__flight--agenda)'))
        .some((el) => getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 2)), {timeout: 8_000, intervals: [16]}).toBe(true).catch(() => undefined);
      await shoot(page, preset.id, '04-flight');
      await expect(page.locator('[data-parl-delegate-reading][data-delegate-sole]'),
        'past the press the reading is the CHOSEN figure — no cursor mark, even though the answer left a ring of one').toHaveCount(0);
      const sent = JSON.parse(posts[0].body) as {responses?: Array<Record<string, unknown>>} | Array<Record<string, unknown>>;
      const responses = Array.isArray(sent) ? sent : sent.responses ?? [];
      expect(responses[responses.length - 1], 'the tail is the FIGURE, addressed to the card').toMatchObject(
        {type: 'party', partyName: GREENS, delegate: {place: 'resolution', owner: 'neutral'}, stagedFor: CARD});

      // ── е. the server ──
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau.map((c) => c.name),
        {timeout: 30_000, message: 'the committed play reached the table'}).toContain(CARD);
      const after = await wireOf(request, playerId);
      expect(greensOf(after).votes.map((v) => v.owner), 'the neutral cube left, mine stands LAST').toEqual([viewer, viewer]);
      expect(greensOf(after).leader, 'blue leads the Greens').toBe(viewer);
      expect(marsOf(after).votes.map((v) => v.owner), 'Mars First untouched').toEqual(['neutral', 'neutral']);
      expect(reserveOf(after, viewer), 'blue\'s reserve −1').toBe(reserveOf(before, viewer) - 1);
      expect(after.game.parliament.neutralSupply, 'the supply +1').toBe(before.game.parliament.neutralSupply + 1);
      expect(after.game.parliament.popularSupport.Scientists, 'the support area untouched').toBe(before.game.parliament.popularSupport.Scientists);
      expect(after.thisPlayer.megacredits, 'the card\'s 2 M€ only — the delegate is free').toBe(before.thisPlayer.megacredits - 2);

      // ── ж. the flow ends on the board ──
      await expect.poll(() => page.evaluate(() => ({
        hand: document.querySelectorAll('.con-hand').length,
        parl: document.querySelectorAll('.con-parl').length,
        ws: document.querySelectorAll('.con-ws').length,
      })), {timeout: 40_000, message: 'the finished flow leaves for the board'}).toEqual({hand: 0, parl: 0, ws: 0});
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, preset.id, '05-board-after');
      expect(posts.length, 'and nothing else was sent').toBe(1);

      const probe = await readProbe(page);
      const dump = JSON.stringify({steps: probe.steps, ribbon: probe.ribbon, reserve: probe.reserve, pool: probe.pool, flights: probe.flights});
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/recruitment-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(40);

      // ── б. one flow ──
      expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
      expect(probe.steps, `the tail only ever moved forward (${dump})`).toEqual(['Розыгрыш', 'Разыграно', 'Обмен']);
      expect(probe.parlOutsideHand, 'the Parliament stood inside the hand').toBe(false);
      expect(probe.parlMax, 'ONE Parliament instance').toBe(1);
      expect(probe.ownHead, 'the embedded Parliament drew no head of its own').toBe(false);

      // ── д. two moves, one phrase: 2 → 1 (neutral lifts) → supply +1 (it lands) → reserve −1 (mine lifts) → 2 (mine lands) ──
      const at = (series: Series, value: number, from = 0) => series.find(([t, v]) => v === value && t >= from)?.[0];
      const reserve0 = reserveOf(before, viewer);
      const pool0 = before.game.parliament.neutralSupply;
      expect(probe.ribbon[0]?.[1], `the ribbon read two figures first (${dump})`).toBe(2);
      expect(probe.reserve[0]?.[1], `blue's reserve read its old count first (${dump})`).toBe(reserve0);
      expect(probe.pool[0]?.[1], `the supply read its old count first (${dump})`).toBe(pool0);
      const neutralLift = at(probe.ribbon, 1);
      const neutralLand = at(probe.pool, pool0 + 1);
      const mineLift = at(probe.reserve, reserve0 - 1);
      expect(neutralLift, `the ribbon lost the neutral figure (${dump})`).toBeDefined();
      expect(neutralLand, `the supply counted it (${dump})`).toBeDefined();
      expect(mineLift, `my reserve gave its figure up (${dump})`).toBeDefined();
      const mineLand = at(probe.ribbon, 2, neutralLift!);
      expect(mineLand, `the ribbon counted my figure (${dump})`).toBeDefined();
      expect(neutralLift!, `the neutral figure left before the supply counted it (${dump})`).toBeLessThanOrEqual(neutralLand!);
      expect(neutralLand!, `mine was taken only after the neutral one had landed — one phrase, in turn (${dump})`).toBeLessThanOrEqual(mineLift!);
      expect(mineLift!, `mine left the reserve before the ribbon counted it (${dump})`).toBeLessThanOrEqual(mineLand!);
      expect(probe.flights, `the figures were seen in flight (${dump})`).toBeGreaterThan(0);

      expect(probe.degraded, 'no flight confessed a missing rect').toEqual([]);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page errors').toEqual([]);
    });

    test(`з. the card refuses itself, each blocker named: no neutral cube on a bill · an empty reserve (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixture(page, request, 'recruitment-locked', {query: preset.query});
      await focusTheCard(page);
      await expect(page.locator('.con-hand'), 'no neutral cube on a bill — the table\'s reason').toContainText('На резолюциях нет нейтральных делегатов');
      await shoot(page, preset.id, '06-locked-no-neutral');

      await bootFixture(page, request, 'recruitment-no-reserve', {query: preset.query});
      await focusTheCard(page);
      await expect(page.locator('.con-hand'), 'an empty reserve — TR03\'s reason').toContainText('В резерве нет делегатов');
      await shoot(page, preset.id, '07-locked-no-reserve');
    });

    test(`и. reduced motion: the same exchange, the table reads the server at once, nothing flies (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await page.emulateMedia({reducedMotion: 'reduce'});
      const posts: Array<{url: string, body: string}> = [];
      const pageErrors: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push({url: r.url(), body: r.postData() ?? ''});
        }
      });
      const playerId = await bootFixture(page, request, 'recruitment', {query: preset.query});
      const viewer = (await wireOf(request, playerId)).thisPlayer.color;
      await focusTheCard(page);
      await press(page, 'Enter', 1200);
      await page.locator(composer).waitFor({timeout: 15_000});
      await settle(page);
      await armProbe(page, viewer);
      await chooseDelegate(page);
      await moveCursorTo(page, `resolution:${GREENS}:neutral`, 'ArrowRight');
      await commitPick(page, posts);
      expect(posts.length, 'one POST').toBe(1);
      await expect.poll(async () => greensOf(await wireOf(request, playerId)).votes.map((v) => v.owner), {timeout: 30_000}).toEqual([viewer, viewer]);
      await expect.poll(() => page.evaluate(() => document.querySelectorAll('.con-hand, .con-parl, .con-ws').length),
        {timeout: 40_000, message: 'the flow leaves for the board'}).toBe(0);
      const probe = await readProbe(page);
      expect(probe.flights, 'reduced motion: nothing flies').toBe(0);
      expect(probe.degraded, 'nothing confessed').toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });
}
