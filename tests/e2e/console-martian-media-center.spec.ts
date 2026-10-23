import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, openActionFocus, openCardActions, press, pressUntil, settle, walkFocusUntil} from './consoleStart';

/**
 * T07 «МЕДИА-ЦЕНТР НА МАРСЕ» — «pay 3 M€ → add a delegate»: under Turmoil Redux a vote from the RESERVE for 3 M€,
 * taken as the ACTION of a blue card through the vote's FOURTH door (the staged action vote of TR15 —
 * docs/TURMOIL_REDUX_MARTIAN_CENSUS.md §5), now for a DECLARATIVE action whose price is on the RAIL. End to end
 * against a real server:
 *
 *   1. «Действия карт» → the card → the composer: the price «3 M€», the reserve chip, the next step «Резолюция — выбор
 *      в Парламенте», the CTA «Выбрать резолюцию»; its A sends NOTHING (no POST, the server's change counter stands,
 *      the M€ on the rail).
 *   2. ONE flow: the crumb keeps its root and the card's name; the tail reads НАСТРОЙКА → ГОЛОСОВАНИЕ; the Parliament is
 *      the ONE instance, INSIDE «Действия карт»; the column is never empty while the setup hands over.
 *   3. The mode: the locked receipt «Карта · 3 [M€]», the source «из резерва · по карте», no ordinary vote price anywhere
 *      (no «5»); B walks back to the composer, nothing sent; in again.
 *   4. A is EXACTLY ONE POST (`input-batch`), its tail ADDRESSED to the card.
 *   5. PL-104 → the cube: the «−3» M€ token is born on the rail's M€ row only after the commit's impulse landed (PL-103),
 *      leaves SIDEWAYS, is absorbed on the hero card; the row ticks 20 → 17 on its departure, never before; THEN the cube
 *      lifts off the reserve stack for the card's ribbon; the lobby's socket stands full throughout.
 *   6. The server: 17 M€, the viewer's vote on the slot, the action used, the reserve one short, the lobby intact.
 *   7. It ends on the board: no workspace, nothing stranded, no overflow, no page error, no flight confessed a missing rect.
 *   8. The refusals, SHOWN with ONE reason each: 2 M€ «Не хватает 1 M€» · an empty voting area «Нет резолюций на
 *      голосовании» · an empty reserve «Делегатов в резерве: 0 из 1».
 *   9. The play's requirement: Mars First does not rule and blue has ONE delegate on its resolution — «✕», «1/2».
 *
 * Fixtures `martian-media-center*` (tests/e2e/fixtures/generate.ts). TIMING class (PL-104 order): `--exclusive --workers=1`.
 */

const CARD = 'Martian Media Center';
const CARD_RU = 'Медиа-центр на Марсе';
const ROOT_RU = 'Действия карт';
const OUT = path.resolve('screenshots', 't07');

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

const MC_ROW = '.con-res__row--megacredits';
const MC_DIGITS = '.con-res__row--megacredits .con-res__digits';
const HERO = '.con-cardactions .con-composer__actcardwrap';

type Wire = {
  thisPlayer: {color: string, megacredits: number, actionsThisGeneration: Array<string>, tableau: Array<{name: string}>};
  game: {
    gameAge: number;
    parliament: {
      slots: Array<{party: string, totalVotes: number, votes: Array<{owner: string}>}>;
      players: Array<{color: string, lobby: boolean, reserve: number}>;
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

async function shot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

type Rect = {l: number, t: number, r: number, b: number};
type Box = {x: number, y: number, w: number, h: number};
type Chip = {x: number, y: number, w: number, v: string};
type Flight = {first: Box, last: Box, n: number, firstAt: number, lastAt: number};
type Probe = {
  samples: number;
  ticks: number;
  steps: Array<string>;
  crumbMisses: Array<string>;
  parlOutside: boolean;
  parlMax: number;
  wsMax: number;
  ownHead: boolean;
  gaps: Array<string>;
  degraded: Array<string>;
  stranded: boolean;
  /** The Parliament's own flights (the cube). */
  flights: Record<string, Flight>;
  reserve: Array<[number, number]>;
  votes: Array<[number, number]>;
  lobbyEmptied: boolean;
  ringAt: number;
  /** The rail's transfer tokens, sample by sample (only samples that hold one). */
  chips: Array<{t: number, chips: Array<Chip>, beats: Array<{x: number, y: number}>, row?: Rect, hero?: Rect}>;
  /** The M€ digits as read, deduped. */
  mc: Array<[number, string]>;
};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page, viewer: string): Promise<void> {
  await page.evaluate(({viewer, card, root, mcRow, mcDigits, hero}) => {
    const w = window as unknown as {__t07: Probe};
    const p: Probe = {
      samples: 0, ticks: 0, steps: [], crumbMisses: [], parlOutside: false, parlMax: 0, wsMax: 0, ownHead: false,
      gaps: [], degraded: [], stranded: false, flights: {}, reserve: [], votes: [], lobbyEmptied: false, ringAt: -1, chips: [], mc: [],
    };
    w.__t07 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const note = (series: Array<[number, number]>, raw: string | null | undefined) => {
      if (raw === null || raw === undefined || raw === '') {
        return;
      }
      const value = Number(raw);
      if (Number.isFinite(value) && series[series.length - 1]?.[1] !== value) {
        series.push([Date.now() - t0, value]);
      }
    };
    const seenOpacity = (el: Element | null): number => {
      let opacity = 1;
      for (let n = el as HTMLElement | null; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return 0;
        }
        opacity *= Number(cs.opacity);
      }
      return el === null ? 0 : opacity;
    };
    const rect = (el: Element | null | undefined): Rect | undefined => {
      const r = el?.getBoundingClientRect();
      return r === undefined || r.width < 2 ? undefined : {l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom)};
    };
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      const t = Date.now() - t0;
      const ws = document.querySelector('.con-cardactions');
      const head = ws?.querySelector('.con-wshead') ?? null;
      if (head !== null) {
        const rootText = text(head.querySelector('.con-wshead__root'));
        const subjects = Array.from(head.querySelectorAll('.con-wshead__subject')).map(text);
        if (rootText.toLowerCase() !== root.toLowerCase() || !subjects.some((s) => s.toLowerCase() === card.toLowerCase())) {
          if (p.crumbMisses.length < 8) {
            p.crumbMisses.push(`${t}ms root=«${rootText}» subject=«${subjects.join('|')}»`);
          }
        }
        head.querySelectorAll('.con-wshead__step').forEach((el) => {
          const step = text(el);
          if (step !== '' && !p.steps.includes(step)) {
            p.steps.push(step);
          }
        });
      }
      const parls = document.querySelectorAll('.con-parl');
      p.parlMax = Math.max(p.parlMax, parls.length);
      parls.forEach((el) => {
        if (el.closest('.con-cardactions') === null || el.classList.contains('con-ws')) {
          p.parlOutside = true;
        }
        if (el.querySelector('.con-wshead') !== null) {
          p.ownHead = true;
        }
        const degraded = el.getAttribute('data-parl-grant-degraded') ?? el.getAttribute('data-renewal-degraded');
        if (degraded !== null && !p.degraded.includes(degraded)) {
          p.degraded.push(degraded);
        }
      });
      p.wsMax = Math.max(p.wsMax, document.querySelectorAll('.con-ws').length);
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
      if (tick && ws !== null && document.querySelector('.con-composer__parlzone--on') !== null) {
        const parlSeen = seenOpacity(document.querySelector('.con-composer__parlzone .con-parl'));
        const setupSeen = Math.max(0, ...Array.from(document.querySelectorAll('.con-composer__actright > :not(.con-composer__parlzone)'))
          .map((el) => seenOpacity(el)));
        if (seenOpacity(ws) > 0.9 && parlSeen < 0.05 && setupSeen < 0.05 && p.gaps.length < 8) {
          p.gaps.push(`${t}ms parl=${parlSeen.toFixed(2)} setup=${setupSeen.toFixed(2)}`);
        }
      }
      document.querySelectorAll<HTMLElement>('.con-parl__flight').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || getComputedStyle(el).visibility === 'hidden') {
          return;
        }
        const id = el.getAttribute('data-parl-flight') ?? '?';
        const now = {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height};
        const rec = p.flights[id] ?? (p.flights[id] = {first: now, last: now, n: 0, firstAt: t, lastAt: 0});
        rec.last = now;
        rec.lastAt = t;
        rec.n++;
      });
      note(p.reserve, document.querySelector(`[data-parl-seat-reserve="${viewer}"]`)?.getAttribute('data-count'));
      note(p.votes, document.querySelector('[data-parl-vote-ribbon]')?.getAttribute('data-votes'));
      if (p.ringAt < 0 && Array.from(document.querySelectorAll('.con-commit-ring')).some((el) => Number(getComputedStyle(el).opacity) > 0.05)) {
        p.ringAt = t;
      }
      const lobby = document.querySelector(`[data-parl-seat-lobby="${viewer}"]`);
      if (lobby !== null && lobby.classList.contains('con-parl__socket--empty')) {
        p.lobbyEmptied = true;
      }
      const mc = (text(document.querySelector(mcDigits)).match(/^-?\d+/) ?? [''])[0];
      if (mc !== '' && p.mc[p.mc.length - 1]?.[1] !== mc) {
        p.mc.push([t, mc]);
      }
      const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).filter((el) => seenOpacity(el) > 0.05).map((el) => {
        const r = el.getBoundingClientRect();
        const kind = el.classList.contains('con-transfer__chip--mc') ? 'mc' : (el.querySelector('.con-transfer__icon')?.className.match(/resource_icon--([a-z]+)/) ?? ['', '?'])[1];
        return {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width),
          v: `${kind}${(el.querySelector('.con-transfer__amt')?.textContent ?? '').replace(/\s+/g, '').replace('−', '-')}`};
      });
      if (chips.length > 0 && p.chips.length < 4000) {
        const beats = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__beat')).filter((el) => seenOpacity(el) > 0.05).map((el) => {
          const r = el.getBoundingClientRect();
          return {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2)};
        });
        p.chips.push({t, chips, beats, row: rect(document.querySelector(mcRow)), hero: rect(document.querySelector(hero))});
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(() => sample(true), 30);
  }, {viewer, card: CARD_RU, root: ROOT_RU, mcRow: MC_ROW, mcDigits: MC_DIGITS, hero: HERO});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__t07: Probe}).__t07);

async function seen(page: Page, selector: string): Promise<(Box & {visible: boolean}) | undefined> {
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (el === null) {
      return undefined;
    }
    const r = el.getBoundingClientRect();
    let opacity = 1;
    let hidden = false;
    for (let n: HTMLElement | null = el; n !== null; n = n.parentElement) {
      const cs = getComputedStyle(n);
      opacity *= Number(cs.opacity);
      hidden = hidden || cs.visibility === 'hidden' || cs.display === 'none';
    }
    const inView = r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    return {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, visible: r.width > 1 && r.height > 1 && opacity > 0.6 && !hidden && inView};
  }, selector);
}

const dist = (a: {x: number, y: number}, b: {x: number, y: number}) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (p: {x: number, y: number}, r: Rect, slack: number) => p.x >= r.l - slack && p.x <= r.r + slack && p.y >= r.t - slack && p.y <= r.b + slack;

const voteMode = '.con-cardactions .con-parl--embedded [data-parl-vote-door="card"]';
const composer = '.con-cardactions .con-composer';

const focusedTile = (page: Page) => page.evaluate(() => {
  const tile = document.querySelector('.con-cardactions__tile--focused');
  return tile?.getAttribute('data-action-card') ?? '';
});

/** «ВЫБРАТЬ РЕЗОЛЮЦИЮ» — one press, verified by what it opens; a second A on the standing mode would be the COMMIT. */
async function chooseResolution(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) => document.querySelector(sel) !== null, voteMode);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 3_000}).toBe(true).catch(() => undefined);
  }
  await page.locator(voteMode).waitFor({timeout: 30_000});
  await expect(page.locator('.con-cardactions .con-composer--parlstep'), 'the setup parked under the step').toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

/** «Действия карт» with the cursor on the card's tile. */
async function focusMediaCenter(page: Page): Promise<void> {
  await openCardActions(page);
  await expect(page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`), 'the card offers its one action').toHaveCount(1);
  expect(await walkFocusUntil(page, async () => await focusedTile(page) === CARD, () => focusedTile(page), 16),
    `never focused the card's tile (at «${await focusedTile(page)}»)`).toBe(true);
}

for (const preset of PRESETS) {
  test.describe(`T07 Martian Media Center · the staged action vote for 3 M€ · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`«Действия карт» → «Выбрать резолюцию» → the vote inside the workspace → B → back → A → −3 M€ → the cube → the board (${preset.id})`, async ({page, request}) => {
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

      const playerId = await bootFixture(page, request, 'martian-media-center', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === viewer)!;
      const party0 = before.game.parliament.slots[0].party;
      expect(before.thisPlayer.megacredits, 'the fixture: 20 M€').toBe(20);
      expect(me(before).lobby, 'the fixture: the free delegate stands in the lobby').toBe(true);

      // ── 1. the composer: the price, the reserve, the door ──
      await focusMediaCenter(page);
      await openActionFocus(page);
      await settle(page);
      await expect(page.locator(`${composer} .con-composer__cta`), 'the CTA is the door\'s navigation verb').toContainText('Выбрать резолюцию');
      await expect(page.locator(composer), 'the next step is named, not guessed').toContainText('Резолюция — выбор в Парламенте');
      await expect(page.locator(composer), 'the delegate leaves the reserve').toContainText('из резерва');
      await shot(page, preset.id, 'a1-composer');

      await armProbe(page, viewer);

      await chooseResolution(page);
      expect(posts, 'no POST before the commit').toEqual([]);
      const still = await wireOf(request, playerId);
      expect(still.game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);
      expect(still.thisPlayer.megacredits, 'the M€ are still on the rail').toBe(20);

      // ── 3. the mode: the receipt in M€, the card's source, no ordinary vote price ──
      const receipt = page.locator('[data-parl-vote-receipt]');
      await expect(receipt, 'the locked receipt is the card\'s own price').toHaveAttribute('data-receipt-cost', '3');
      await expect(receipt, '…in M€').toHaveAttribute('data-receipt-icon', 'megacredits');
      await expect(receipt).toContainText('Карта');
      await expect(page.locator('[data-parl-vote-source]'), 'the delegate is the card\'s').toContainText('из резерва · по карте');
      await expect(page.locator('[data-parl-vote-source] .con-parl__info-src-num'), 'no ordinary reserve price in the source line').toHaveCount(0);
      expect(await page.locator('[data-parl-cta-cost]').evaluateAll((els) => els.map((e) => e.getAttribute('data-cost-amount'))),
        'the confirm carries no vote price (the grant is the card\'s)').not.toContain('5');
      await expect(page.locator('.con-footer'), 'A is the action\'s commit verb').toContainText('Подтвердить');
      await expect(page.locator('.con-footer'), 'B is reversible').toContainText('Назад');
      await shot(page, preset.id, 'a2-vote-mode');

      // B walks back to the composer — nothing sent.
      const backTaken = () => page.evaluate(() => document.querySelector('.con-cardactions .con-parl') === null);
      for (let attempt = 0; attempt < 3 && !await backTaken(); attempt++) {
        await press(page, 'Escape', 300);
        await expect.poll(backTaken, {timeout: 3_000}).toBe(true).catch(() => undefined);
      }
      await expect(page.locator('.con-cardactions .con-composer--parlstep'), 'the setup un-parked').toHaveCount(0, {timeout: 10_000});
      await settle(page);
      await expect(page.locator(`${composer} .con-composer__cta`), 'back on the door').toContainText('Выбрать резолюцию');
      await shot(page, preset.id, 'a3-back');
      expect(posts).toEqual([]);
      expect((await wireOf(request, playerId)).thisPlayer.megacredits, 'the round trip left the M€ on the rail').toBe(20);

      // ── 4. in again; A is ONE POST, addressed to the card ──
      await chooseResolution(page);
      const reserveBox = await seen(page, `[data-parl-seat-reserve="${viewer}"]`);
      const ribbonBox = await seen(page, '[data-parl-vote-ribbon]');
      expect(reserveBox?.visible, 'the reserve stack is on screen').toBe(true);
      expect(ribbonBox?.visible, 'the card\'s ribbon is on screen').toBe(true);
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.map((p) => new URL(p.url).pathname), 'the action is ONE batch POST').toEqual(['/player/input-batch']);
      const sent = JSON.parse(posts[0].body) as {responses?: Array<Record<string, unknown>>} | Array<Record<string, unknown>>;
      const responses = Array.isArray(sent) ? sent : sent.responses ?? [];
      expect(responses[responses.length - 1], 'the tail is the resolution, ADDRESSED to the card').toMatchObject({type: 'party', partyName: party0, stagedFor: CARD});

      // ── 6. the server ──
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.actionsThisGeneration,
        {timeout: 30_000, message: 'the action is recorded as used'}).toContain(CARD);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.megacredits, 'the card\'s 3 M€ — never the ordinary vote\'s price').toBe(17);
      expect(after.game.parliament.slots[0].votes.map((v) => v.owner), 'the viewer\'s delegate stands on the chosen card').toEqual([viewer]);
      expect(after.game.parliament.slots.slice(1).map((s) => s.totalVotes), 'and on no other').toEqual([0, 0]);
      expect(me(after).reserve, 'the delegate left the RESERVE').toBe(me(before).reserve - 1);
      expect(me(after).lobby, 'the lobby\'s cube never moved').toBe(true);

      // ── 7. the flow ends on the board ──
      await expect.poll(() => page.evaluate(() => ({
        cardActions: document.querySelectorAll('.con-cardactions').length,
        parl: document.querySelectorAll('.con-parl').length,
        ws: document.querySelectorAll('.con-ws').length,
      })), {timeout: 40_000, message: 'the finished action leaves for the board'}).toEqual({cardActions: 0, parl: 0, ws: 0});
      await settle(page, {timeoutMs: 20_000});
      await shot(page, preset.id, 'a4-board');
      expect(posts.length, 'and nothing else was sent').toBe(1);

      const probe = await readProbe(page);
      const trail = probe.chips.slice(0, 120).map((s) => `${s.t}: ${s.chips.map((c) => `${c.v}@${c.x},${c.y}`).join(' ')}${s.beats.length > 0 ? ' beat' : ''}`).join('\n');
      const dump = JSON.stringify({steps: probe.steps, reserve: probe.reserve, votes: probe.votes, mc: probe.mc, ringAt: probe.ringAt,
        flights: Object.values(probe.flights).map((f) => [Math.round(f.first.x), Math.round(f.first.y), Math.round(f.last.x), Math.round(f.last.y), f.n, f.firstAt, f.lastAt])});
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/martian-media-center-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(40);

      // ── 2. one flow ──
      expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
      expect(probe.steps, `the tail only ever moved forward (${dump})`).toEqual(['Настройка', 'Голосование']);
      expect(probe.parlOutside, 'the Parliament stood inside «Действия карт»').toBe(false);
      expect(probe.parlMax, 'ONE Parliament instance').toBe(1);
      expect(probe.wsMax, 'never a second workspace band').toBeLessThanOrEqual(1);
      expect(probe.ownHead, 'the embedded Parliament drew no head of its own').toBe(false);
      expect(probe.gaps, 'the column was never empty while the setup handed over').toEqual([]);

      // ── 5. PL-104 → the cube ──
      const priceBirth = probe.chips.find((s) => s.chips.some((c) => /^mc-3$/.test(c.v)));
      expect(priceBirth, `a «−3» M€ token was born (${dump})\n${trail}`).toBeDefined();
      const priceChip = priceBirth!.chips.find((c) => /^mc-3$/.test(c.v))!;
      expect(priceBirth!.row, 'the rail\'s M€ row was measurable at the birth').toBeDefined();
      expect(inside(priceChip, priceBirth!.row!, priceChip.w), `the price is BORN on the rail's M€ row — ${priceChip.x},${priceChip.y} vs ${JSON.stringify(priceBirth!.row)}`).toBe(true);
      const priceSeen = probe.chips.filter((s) => s.chips.some((c) => c.v === priceChip.v));
      const priceLast = priceSeen[priceSeen.length - 1];
      const lastChip = priceLast.chips.find((c) => c.v === priceChip.v)!;
      expect(priceLast.hero, 'the hero card was measurable at the absorb').toBeDefined();
      expect(inside(lastChip, priceLast.hero!, lastChip.w), `the price is absorbed ON the hero card (its printed cost) — ${lastChip.x},${lastChip.y} vs ${JSON.stringify(priceLast.hero)}`).toBe(true);
      const rowTop = priceBirth!.row!.t;
      const climbed = priceSeen.flatMap((s) => s.chips.filter((c) => c.v === priceChip.v))
        .filter((c) => c.y < rowTop - priceChip.w && Math.abs(c.x - priceChip.x) < priceChip.w);
      expect(climbed, `the price leaves SIDEWAYS, never straight up over the rows above — ${JSON.stringify(climbed.slice(0, 3))}`).toEqual([]);
      const tick17 = probe.mc.find(([, v]) => v === '17');
      expect(tick17, `the M€ row ticked to 17 (${dump})`).toBeDefined();
      expect(tick17![0], `the row ticked no earlier than the price's birth (${priceBirth!.t})`).toBeGreaterThanOrEqual(priceBirth!.t - 60);
      expect(tick17![0], `…and no later than its absorb (${priceLast.t})`).toBeLessThanOrEqual(priceLast.t + 60);
      expect(probe.mc.filter(([t, v]) => t < priceBirth!.t - 60 && v !== '20'), 'the M€ row read 20 until the price left').toEqual([]);
      expect(probe.ringAt, `the commit's ring lit (${dump})`).toBeGreaterThanOrEqual(0);
      expect(priceBirth!.t, `the price token was born AFTER the impulse landed (PL-103 — ring at ${probe.ringAt} ms)`).toBeGreaterThanOrEqual(probe.ringAt - 60);
      const slack = preset.viewport.width / 24;
      const near = (a: {x: number, y: number}, b: Box | undefined) => b !== undefined && dist(a, b) <= Math.max(b.w, b.h) + slack;
      const cube = Object.values(probe.flights).filter((f) => f.n >= 2 && dist(f.first, f.last) > 24 && near(f.first, reserveBox));
      expect(cube.length, `the viewer's cube left the RESERVE stack (${dump})`).toBe(1);
      expect(near(cube[0].last, ribbonBox), `…and landed on the card's ribbon (${dump})`).toBe(true);
      expect(cube[0].firstAt, `the cube lifted only after the price was absorbed (${priceLast.t} ms; ${dump})`).toBeGreaterThanOrEqual(priceLast.t - 60);
      expect(probe.reserve.map(([, v]) => v), 'the reserve stack gave exactly one cube').toEqual([me(before).reserve, me(before).reserve - 1]);
      expect(probe.votes[probe.votes.length - 1]?.[1], 'the card\'s count ticked to 1').toBe(1);
      expect(probe.lobbyEmptied, 'the lobby\'s socket was never empty').toBe(false);

      expect(probe.degraded, 'no flight confessed a missing rect').toEqual([]);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page errors').toEqual([]);
    });

    // ── 8. the refusals: SHOWN, one reason each ──
    for (const [fixture, reason, label] of [
      ['martian-media-center-poor', /Не хватает 1 M€/, 'b-poor'],
      ['martian-media-center-quiet', /Нет резолюций на голосовании/, 'b-quiet'],
      ['martian-media-center-reserve', /Делегатов в резерве: 0 из 1/, 'b-reserve'],
    ] as const) {
      test(`${fixture}: the action SHOWN disabled with ONE reason (${preset.id})`, async ({page, request}) => {
        test.setTimeout(180_000);
        await bootFixture(page, request, fixture, {query: preset.query});
        await focusMediaCenter(page);
        const tile = page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`);
        await expect(tile.locator('.con-cardactions__tile-reason'), 'the reason is named').toContainText(reason);
        expect(await tile.locator('.con-cardactions__tile-reason').count(), 'ONE reason').toBe(1);
        await shot(page, preset.id, label);
      });
    }

    // ── 9. the play's requirement: «1/2» ──
    test(`martian-media-center-hand: Mars First does not rule, one delegate of yours — «✕», «1/2» (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixture(page, request, 'martian-media-center-hand', {query: preset.query});
      await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900});
      await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600});
      const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
      expect(await focusCard(page, CARD, Math.max(14, slots * 3)), 'the cursor stands on the card').toBe(true);
      const verdict = page.locator('.con-hand__verdictbar');
      await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
      await expect(verdict, 'one of your delegates out of two').toContainText('1/2');
      await shot(page, preset.id, 'c-hand-locked');
    });
  });
}
