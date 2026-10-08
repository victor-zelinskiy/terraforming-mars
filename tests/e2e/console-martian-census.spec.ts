import * as fs from 'fs';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, openActionFocus, openCardActions, press, settle, walkFocusUntil} from './consoleStart';

/**
 * TR15 «МАРСИАНСКАЯ ПЕРЕПИСЬ» — THE STAGED ACTION VOTE, the vote's FOURTH door
 * (docs/TURMOIL_REDUX_MARTIAN_CENSUS.md).
 *
 * A blue card's ACTION places the delegate: «spend 3 data from here to add a
 * delegate to a resolution». The staged resolution door TR03 opened for a play,
 * opened from «Действия карт». The contract under test, end to end against a
 * real server, on two profiles:
 *
 *   1. «Действия карт» → the card → the composer: the card offers TWO variants;
 *      branch B's CTA is «Выбрать резолюцию»; its A sends NOTHING (no POST, the
 *      server's change counter stands).
 *   2. It is ONE flow: on every sample the crumb keeps its root and the card's
 *      name; the tail reads НАСТРОЙКА → ГОЛОСОВАНИЕ; the Parliament is the ONE
 *      instance, teleported INTO «Действия карт» — never a second band — and
 *      the column is never empty while the setup hands over to it (nor does
 *      the setup surface again under it).
 *   3. The mode: the locked receipt «Карта · 3 [data]», the source «из
 *      резерва · по карте», A «Подтвердить»; B walks back to the composer on
 *      branch B; in again.
 *   4. A is EXACTLY ONE POST (`input-batch`), its tail ADDRESSED to the card.
 *   5. PL-100: a «−3 data» PRICE token leaves the hero's capsule for the
 *      reserve stack first (the capsule reads 3 until the token departs, then
 *      0 — never anything between; the stack answers), THEN the cube leaves
 *      the RESERVE stack for the card's ribbon; the lobby's socket stands full
 *      before and after.
 *   6. The server: 0 data on the card, the viewer's vote on the slot, the
 *      action used this generation, the reserve one short, the lobby intact.
 *   7. It ends on the board: no workspace, nothing stranded, no overflow, no
 *      page error, no flight confessed a missing rect — and the vote panel is
 *      not clipped in its narrow host (beside the hero column).
 *
 * Fixture `martian-census` (tests/e2e/fixtures/generate.ts).
 */

const CARD = 'Martian Census';
const CARD_RU = 'Марсианская перепись';
const ROOT_RU = 'Действия карт';

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {color: string, actionsThisGeneration: Array<string>, tableau: Array<{name: string, resources?: number}>};
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

type Box = {x: number, y: number, w: number, h: number};
type Flight = {first: Box, last: Box, n: number, firstAt: number, lastAt: number};
type Probe = {
  samples: number;
  /** Interval (task) samples only — the probe's own liveness floor. */
  ticks: number;
  /** The crumb's stage words, deduped in order of first appearance. */
  steps: Array<string>;
  crumbMisses: Array<string>;
  /** A `.con-parl` stood OUTSIDE «Действия карт», or as a band of its own. */
  parlOutside: boolean;
  parlMax: number;
  wsMax: number;
  ownHead: boolean;
  /** Task samples where the step's zone was live and NEITHER the setup NOR the Parliament could be seen. */
  gaps: Array<string>;
  /** Task samples where the Parliament stood whole and a layer of the setup could be seen under it. */
  ghosts: Array<string>;
  degraded: Array<string>;
  stranded: boolean;
  flights: Record<string, Flight>;
  reserve: Array<[number, number]>;
  votes: Array<[number, number]>;
  capsule: Array<[number, number]>;
  lobbyEmptied: boolean;
};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page, viewer: string): Promise<void> {
  await page.evaluate(({viewer, card, root}) => {
    const w = window as unknown as {__tr15: Probe};
    const p: Probe = {
      samples: 0, ticks: 0, steps: [], crumbMisses: [], parlOutside: false, parlMax: 0, wsMax: 0, ownHead: false,
      gaps: [], ghosts: [], degraded: [], stranded: false, flights: {}, reserve: [], votes: [], capsule: [], lobbyEmptied: false,
    };
    w.__tr15 = p;
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
    /** What the player can SEE of an element: its own opacity times every ancestor's, 0 when hidden. */
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
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      const ws = document.querySelector('.con-cardactions');
      const head = ws?.querySelector('.con-wshead') ?? null;
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
      // THE HANDOVER, judged on task samples only (a microtask sample can see a state the browser never paints):
      // while the step's zone is live, the column always shows the setup or the Parliament — and once the
      // Parliament stands whole, nothing of the setup shows under it.
      if (tick && ws !== null && document.querySelector('.con-composer__parlzone--on') !== null) {
        const parl = document.querySelector('.con-composer__parlzone .con-parl');
        const parlSeen = seenOpacity(parl);
        const setupSeen = Math.max(0, ...Array.from(document.querySelectorAll('.con-composer__actright > :not(.con-composer__parlzone)'))
          .map((el) => seenOpacity(el)));
        const wsSeen = seenOpacity(ws);
        if (wsSeen > 0.9 && parlSeen < 0.05 && setupSeen < 0.05 && p.gaps.length < 8) {
          p.gaps.push(`${Date.now() - t0}ms parl=${parlSeen.toFixed(2)} setup=${setupSeen.toFixed(2)}`);
        }
        if (parl !== null && Number(getComputedStyle(parl).opacity) > 0.99 && setupSeen > 0.05 && p.ghosts.length < 8) {
          p.ghosts.push(`${Date.now() - t0}ms setup=${setupSeen.toFixed(2)}`);
        }
      }
      document.querySelectorAll<HTMLElement>('.con-parl__flight').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || getComputedStyle(el).visibility === 'hidden') {
          return;
        }
        const id = el.getAttribute('data-parl-flight') ?? '?';
        const now = {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height};
        const rec = p.flights[id] ?? (p.flights[id] = {first: now, last: now, n: 0, firstAt: Date.now() - t0, lastAt: 0});
        rec.last = now;
        rec.lastAt = Date.now() - t0;
        rec.n++;
      });
      note(p.reserve, document.querySelector(`[data-parl-seat-reserve="${viewer}"]`)?.getAttribute('data-count'));
      note(p.votes, document.querySelector('[data-parl-vote-ribbon]')?.getAttribute('data-votes'));
      note(p.capsule, text(document.querySelector('.con-cardactions .con-composer__actcard .pcard__res-count')));
      const lobby = document.querySelector(`[data-parl-seat-lobby="${viewer}"]`);
      if (lobby !== null && lobby.classList.contains('con-parl__socket--empty')) {
        p.lobbyEmptied = true;
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  }, {viewer, card: CARD_RU, root: ROOT_RU});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr15: Probe}).__tr15);

/** An element's centre box and whether the player can actually SEE it (a rect, an effective opacity, not hidden, in view). */
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

const voteMode = '.con-cardactions .con-parl--embedded [data-parl-vote-door="card"]';
const composer = '.con-cardactions .con-composer';

/** The focused action tile, as «card|variant» — the walk's position. */
const focusedTile = (page: Page) => page.evaluate(() => {
  const tile = document.querySelector('.con-cardactions__tile--focused');
  return tile === null ? '' :
    `${tile.getAttribute('data-action-card') ?? ''}|${(tile.querySelector('.con-cardactions__tile-variant')?.textContent ?? '').replace(/\s+/g, ' ').trim()}`;
});

/**
 * THE CLIP PROBE OF THE HOSTED PANEL. `console-parliament-vote-fit`'s probe skips everything inside an embed slot —
 * for a Parliament hosted by a workspace that is ALL of it — so this one skips only the slots INSIDE the vote layer
 * (and the card faces, which clip their own art by design).
 */
const clipProblems = (page: Page) => page.evaluate(() => {
  const root = document.querySelector<HTMLElement>('.con-cardactions .con-parl__vote');
  if (root === null) {
    return ['no vote layer'];
  }
  const out: Array<string> = [];
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    const slot = el.closest('[data-embed-slot]');
    if (el.closest('.pcard') !== null || (slot !== null && root.contains(slot))) {
      continue;
    }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width <= 1 || r.height <= 1 || cs.visibility === 'hidden' || cs.display === 'none') {
      continue;
    }
    const name = `${el.className.toString().split(' ').filter((c) => c !== '')[0] ?? el.tagName.toLowerCase()} «${(el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)}»`;
    if (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) {
      out.push(`clipped-x ${name}: ${el.scrollWidth} > ${el.clientWidth}`);
    }
    if (cs.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1) {
      out.push(`clipped-y ${name}: ${el.scrollHeight} > ${el.clientHeight}`);
    }
  }
  return out;
});

/**
 * «ВЫБРАТЬ РЕЗОЛЮЦИЮ» — one press, verified by what it opens. Never a blind retry: a second A landing after the
 * vote mode is up is the COMMIT.
 */
async function chooseResolution(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) => document.querySelector(sel) !== null, voteMode);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 3_000}).toBe(true).catch(() => undefined);
  }
  await page.locator(voteMode).waitFor({timeout: 30_000});
  // The handover is over when the composer's setup is PARKED under the step.
  await expect(page.locator('.con-cardactions .con-composer--parlstep'), 'the setup parked under the step').toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

for (const preset of PRESETS) {
  test.describe(`TR15 Martian Census · the staged action vote · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`«Действия карт» → B → «Выбрать резолюцию» → the vote inside the workspace → B → back → A → the cube lands → the board (${preset.id})`, async ({page, request}) => {
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

      const playerId = await bootFixture(page, request, 'martian-census', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === viewer)!;
      const census = (wire: Wire) => wire.thisPlayer.tableau.find((c) => c.name === CARD);
      const party0 = before.game.parliament.slots[0].party;
      expect(census(before)?.resources, 'the fixture: 3 data on the card').toBe(3);
      expect(me(before).lobby, 'the fixture: the free delegate stands in the lobby').toBe(true);

      // ── 1. «Действия карт» → the card: two variants; B's door ──
      await openCardActions(page);
      await expect(page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`), 'the card offers its two variants').toHaveCount(2);
      expect(await walkFocusUntil(page, async () => /^Martian Census\|.*2$/.test(await focusedTile(page)), () => focusedTile(page), 16),
        `never focused the census's second variant (at «${await focusedTile(page)}»)`).toBe(true);
      await openActionFocus(page);
      await settle(page);
      await expect(page.locator(`${composer} .con-composer__cta`), 'the CTA is the door\'s navigation verb').toContainText('Выбрать резолюцию');
      await expect(page.locator(composer), 'the next step is named, not guessed').toContainText('Резолюция — выбор в Парламенте');
      await expect(page.locator(composer), 'the delegate leaves the reserve').toContainText('из резерва');

      await armProbe(page, viewer);

      await chooseResolution(page);
      expect(posts, 'no POST before the commit').toEqual([]);
      expect((await wireOf(request, playerId)).game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);

      // ── 3. the mode: the receipt in data, the card's source, the action's own verb; the narrow host fits ──
      const receipt = page.locator('[data-parl-vote-receipt]');
      await expect(receipt, 'the locked receipt is the card\'s own price').toHaveAttribute('data-receipt-cost', '3');
      await expect(receipt, '…in data, never M€ and never the cube').toHaveAttribute('data-receipt-icon', 'data');
      await expect(receipt).toContainText('Карта');
      await expect(page.locator('[data-parl-vote-source]'), 'the delegate is the card\'s').toContainText('из резерва · по карте');
      await expect(page.locator('.con-footer'), 'A is the action\'s commit verb').toContainText('Подтвердить');
      await expect(page.locator('.con-footer'), 'L3 lifts the source').toContainText('Источник');
      await expect(page.locator('.con-footer'), 'B is reversible').toContainText('Назад');
      await expect.poll(() => clipProblems(page), {timeout: 8_000, message: `nothing under the hosted vote layer is clipped (${preset.id})`}).toEqual([]);

      // B walks back to the composer — branch B, nothing sent. The press took when the step is gone and the setup
      // is back; never «press until the composer shows»: a second B on the restored composer leaves the workspace.
      const backTaken = () => page.evaluate(() => document.querySelector('.con-cardactions .con-parl') === null);
      for (let attempt = 0; attempt < 3 && !await backTaken(); attempt++) {
        await press(page, 'Escape', 300);
        await expect.poll(backTaken, {timeout: 3_000}).toBe(true).catch(() => undefined);
      }
      await expect(page.locator('.con-cardactions .con-composer--parlstep'), 'the setup un-parked').toHaveCount(0, {timeout: 10_000});
      await settle(page);
      await expect(page.locator(`${composer} .con-composer__cta`), 'back on branch B').toContainText('Выбрать резолюцию');
      expect(posts).toEqual([]);
      expect((await wireOf(request, playerId)).game.gameAge, 'the round trip left no trace').toBe(before.game.gameAge);

      // ── 4. in again; A is ONE POST, addressed to the card ──
      await chooseResolution(page);
      const sources = {reserve: await seen(page, `[data-parl-seat-reserve="${viewer}"]`), capsule: await seen(page, `${composer} .con-composer__actcardwrap .pcard__res`)};
      const targets = {ribbon: await seen(page, '[data-parl-vote-ribbon]')};
      expect(sources.reserve?.visible, 'the reserve stack is on screen').toBe(true);
      expect(targets.ribbon?.visible, 'the card\'s ribbon is on screen').toBe(true);

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
      expect(census(after)?.resources, 'the three data left the card').toBe(0);
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
      expect(posts.length, 'and nothing else was sent').toBe(1);

      const probe = await readProbe(page);
      const dump = JSON.stringify({steps: probe.steps, reserve: probe.reserve, votes: probe.votes, capsule: probe.capsule,
        flights: Object.values(probe.flights).map((f) => [Math.round(f.first.x), Math.round(f.first.y), Math.round(f.last.x), Math.round(f.last.y), f.n, f.firstAt, f.lastAt])});
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/martian-census-${preset.id}.json`, JSON.stringify(probe, null, 1));
      expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(40);

      // ── 2. one flow ──
      expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
      expect(probe.steps, `the tail only ever moved forward (${dump})`).toEqual(['Настройка', 'Голосование']);
      expect(probe.parlOutside, 'the Parliament stood inside «Действия карт», never as a band of its own').toBe(false);
      expect(probe.parlMax, 'ONE Parliament instance').toBe(1);
      expect(probe.wsMax, 'never a second workspace band').toBeLessThanOrEqual(1);
      expect(probe.ownHead, 'the embedded Parliament drew no head of its own').toBe(false);
      expect(probe.gaps, 'the column was never empty while the setup handed over to the Parliament').toEqual([]);
      expect(probe.ghosts, 'the setup never showed under a standing Parliament').toEqual([]);

      // ── 5. the landing: the reserve → the ribbon; the capsule 3 → 0 on the lift; the lobby full ──
      const slack = preset.viewport.width / 24;
      const near = (a: {x: number, y: number}, b: Box | undefined) => b !== undefined && dist(a, b) <= Math.max(b.w, b.h) + slack;
      const own = Object.values(probe.flights).filter((f) => f.n >= 2 && dist(f.first, f.last) > 24 && near(f.first, sources.reserve));
      expect(own.length, `the viewer's cube left the RESERVE stack (${dump})`).toBe(1);
      expect(near(own[0].last, targets.ribbon), `…and landed on the card's ribbon (${dump})`).toBe(true);
      expect(probe.reserve.map(([, v]) => v), 'the reserve stack gave exactly one cube').toEqual([me(before).reserve, me(before).reserve - 1]);
      expect(probe.votes[probe.votes.length - 1]?.[1], 'the card\'s count ticked to 1').toBe(1);
      expect(probe.capsule.map(([, v]) => v), `the capsule read 3 until the lift, then 0 — never a value between (${dump})`).toEqual([3, 0]);
      // ── PL-100: THE PRICE LEAVES FIRST — a «−3 data» token leaves the hero's capsule for the reserve stack, the
      //    capsule drops as it departs, the stack answers, and only then does the cube lift off that stack. ──
      expect(sources.capsule?.visible, 'the capsule of the hero is on screen').toBe(true);
      const price = Object.entries(probe.flights).filter(([id, f]) => id.startsWith('price') && f.n >= 2).map(([, f]) => f);
      expect(price.length, `ONE price token flew (${dump})`).toBe(1);
      expect(near(price[0].first, sources.capsule), `…born on the hero's capsule (${dump})`).toBe(true);
      expect(near(price[0].last, sources.reserve), `…and absorbed by the reserve stack (${dump})`).toBe(true);
      expect(own[0].firstAt, `the cube lifted only after the price token had landed (${dump})`).toBeGreaterThanOrEqual(price[0].lastAt - 60);
      expect(probe.capsule[1][0], `the data left the card as the token departed — after its birth (${dump})`).toBeGreaterThanOrEqual(price[0].firstAt - 60);
      expect(probe.capsule[1][0], `…and before the cube lifted (${dump})`).toBeLessThanOrEqual(own[0].firstAt + 60);
      expect(probe.lobbyEmptied, 'the lobby\'s socket was never empty').toBe(false);

      expect(probe.degraded, 'no flight confessed a missing rect').toEqual([]);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page errors').toEqual([]);
    });
  });
}
