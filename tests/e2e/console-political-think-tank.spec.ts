import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, fetchPlayerModel, openActionFocus, openCardActions, press, settle, waitForBoardHome, walkFocusUntil,
} from './consoleStart';

/**
 * TR13 — POLITICAL THINK TANK («Политический аналитический центр»): the third
 * deck check and the FIRST whose verdict hands the revealed card over — into
 * the hand dock with +5 M€ on the rail (a match), or onto the discard pile (a
 * miss). ONE spec for the one new mechanic: «вердикт отдаёт карту».
 *
 * STATE IS DECLARED: `political-think-tank` (blue: the card in the tableau, its
 * action unused, 12 M€; the deck's top pinned after the deal to Wildlife Dome —
 * a party requirement — ⚠️ SYNTHETIC: no Redux card carries one yet) and
 * `political-think-tank-miss` (the dealt top card, no party requirement).
 *
 * The claims are about ORDER, read by ONE probe (`MutationObserver` +
 * `setInterval` — never rAF: headless drives it off the compositor and it goes
 * quiet exactly during the beats under test), armed BEFORE the first press:
 *  1. the composer states the check by its glyph, the two gain chips and the
 *     composition (with the amber warning at zero); A sends exactly ONE POST;
 *  2. the card leaves `.con-deckstack__pile` face down and is turned over in
 *     the slot; the verdict names the party and the reward; the rail still
 *     reads the OLD M€ and the dock does not show the new card;
 *  3. «OK» → the workspace is gone BEFORE the card lands in the dock; the dock
 *     card and the M€ (+5) appear only after their own touchdowns (a delivery
 *     proxy and a transfer chip were seen in the air first); the server agrees;
 *  4. a miss: «не выполнено», «не получена», the card flies to the discard;
 *     the hand and the M€ are untouched;
 *  5. the board at the end: no workspace, no strand, no `[console-overflow]`, no
 *     page error, no `data-reveal-handoff-degraded`.
 */

const OUT = path.resolve('screenshots', 'political-think-tank');
const CARD = 'Political Think Tank';
const KEPT = 'Wildlife Dome';

type Wire = Record<string, any>;

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: '&consoleProfile=auto'},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** SERVER truth for the viewer. */
async function tankState(request: APIRequestContext, playerId: string): Promise<{
  megaCredits: number, hand: Array<string>, used: boolean, deck: number, discard: number,
}> {
  const model = await fetchPlayerModel(request, playerId) as Wire;
  const me = (model.thisPlayer ?? {}) as Wire;
  const tableau = (me.tableau ?? []) as Array<Wire>;
  return {
    megaCredits: Number(me.megacredits ?? -1),
    hand: ((model.cardsInHand ?? []) as Array<Wire>).map((c) => String(c.name)),
    used: ((me.actionsThisGeneration ?? []) as Array<string>).includes(CARD) && tableau.some((c) => c.name === CARD),
    deck: Number((model.game as Wire)?.deckSize ?? -1),
    discard: Number((model.game as Wire)?.discardPileSize ?? -1),
  };
}

type Sample = {
  t: number,
  /** The deck-check proxy (the face-down card in transit): its centre, or null. */
  proxy: {x: number, y: number} | null,
  verdict: string,
  mc: string,
  /** The kept card is a VISIBLE body in the dock (present and not held). */
  dockCard: boolean,
  delivery: number,
  discardProxy: number,
  transfer: number,
  ws: number,
  degraded: string,
};

/** Arm the order probe — before the first press. */
async function armProbe(page: Page, kept: string): Promise<void> {
  await page.evaluate((keptName) => {
    const t0 = performance.now();
    const samples: Array<unknown> = [];
    // A PAINTED proxy only: the chassis mounts at its natural box in the corner and is posed
    // (and faded in) by the director a frame later — that unposed frame is invisible.
    const centre = (el: Element | null) => {
      if (el === null) {
        return null;
      }
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 ? {x: +(r.left + r.width / 2).toFixed(1), y: +(r.top + r.height / 2).toFixed(1)} : null;
    };
    const scan = () => {
      if (samples.length > 6000) {
        return;
      }
      const body = document.querySelector(`.con-handbody[data-hand-dock-card="${keptName}"]`);
      const verdict = document.querySelector('.con-verdict');
      samples.push({
        t: +(performance.now() - t0).toFixed(1),
        proxy: centre(document.querySelector('.con-composer__revealfly .con-deal-proxy')),
        verdict: verdict === null ? '' : (verdict.classList.contains('con-verdict--met') ? 'met' : 'miss'),
        mc: (document.querySelector('.con-res__row--megacredits .con-res__value')?.textContent ?? '').trim(),
        dockCard: body !== null && !body.classList.contains('con-handbody--held'),
        delivery: document.querySelectorAll(`[data-delivery-card="${keptName}"]`).length,
        discardProxy: document.querySelectorAll('.con-discard-proxy').length,
        transfer: document.querySelectorAll('.con-transfer [data-transfer-id]').length,
        ws: document.querySelectorAll('.con-ws').length,
        degraded: document.documentElement.getAttribute('data-reveal-handoff-degraded') ?? '',
      });
    };
    const timer = window.setInterval(scan, 16);
    const mo = new MutationObserver(scan);
    mo.observe(document.body, {childList: true, subtree: true, attributes: true, characterData: true});
    (window as unknown as {__tank: unknown}).__tank = {samples, stop: () => {
      window.clearInterval(timer);
      mo.disconnect();
    }};
  }, kept);
}

async function readProbe(page: Page): Promise<Array<Sample>> {
  return await page.evaluate(() => {
    const p = (window as unknown as {__tank: {samples: Array<unknown>, stop: () => void}}).__tank;
    p.stop();
    return p.samples;
  }) as Array<Sample>;
}

/** ДЕЙСТВИЯ КАРТ → the TR13 row → the setup stage, with the preview landed. */
async function openThinkTank(page: Page): Promise<void> {
  await openCardActions(page);
  const focusedAction = () => page.evaluate(() =>
    document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
  expect(await walkFocusUntil(page, async () => await focusedAction() === CARD, focusedAction, 30),
    `never focused the «${CARD}» action`).toBeTruthy();
  await openActionFocus(page);
  await expect(page.locator('.con-composer__cta--ready'), 'the preview landed and the CTA is armed').toBeVisible({timeout: 20_000});
  await settle(page);
}

/** The deck pile's rect — the physical source of the flight. */
async function deckRect(page: Page): Promise<{l: number, t: number, r: number, b: number} | null> {
  return await page.evaluate(() => {
    const el = document.querySelector('.con-deckstack__pile');
    if (el === null) {
      return null;
    }
    const r = el.getBoundingClientRect();
    return {l: r.left, t: r.top, r: r.right, b: r.bottom};
  });
}

for (const profile of PROFILES) {
  test.describe(`Political Think Tank (TR13) · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('a MATCH: the verdict hands the card to the dock and the 5 M€ to the rail', async ({page, request}) => {
      test.setTimeout(420_000);
      const pageErrors: Array<string> = [];
      const overflow: Array<string> = [];
      const posts: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(String(e)));
      page.on('console', (m) => {
        if (m.text().includes('[console-overflow]')) {
          overflow.push(m.text());
        }
      });
      page.on('request', (r) => {
        if (r.method() === 'POST' && r.url().includes('/player/input')) {
          posts.push(r.url());
        }
      });

      const playerId = await bootFixture(page, request, 'political-think-tank', {query: profile.query});
      const atBoot = await tankState(request, playerId);
      expect(atBoot, 'the fixture arrangement').toMatchObject({megaCredits: 12, used: false});
      expect(atBoot.hand).not.toContain(KEPT);

      // ── 1. THE «ДО»: the check by its glyph, the two gain chips, the composition. ──
      await openThinkTank(page);
      const stage = page.locator('.con-cardactions__stagewrap .con-composer--stage');
      const check = stage.locator('[data-reveal-check]');
      await expect(check, 'the check row').toHaveCount(1);
      await expect(check.locator('.pprq'), 'drawn with the card face\'s own any-party plate').toHaveCount(1);
      await expect(check).toContainText('Требование партии');
      const gains = stage.locator('.con-composer__hero .action-effect-chip--gain');
      await expect(gains, 'two gain chips: the card «в руку» and the M€').toHaveCount(2);
      await expect(gains.nth(0).locator('.action-effect-chip__icon')).toHaveClass(/resource_icon--cards/);
      await expect(gains.nth(0).locator('.action-effect-chip__note')).toContainText('в руку');
      await expect(gains.nth(1).locator('.action-effect-chip__cur')).toHaveText('12');
      await expect(gains.nth(1).locator('.action-effect-chip__res')).toHaveText('17');
      const pool = stage.locator('[data-reveal-pool]');
      await expect(pool).toHaveAttribute('data-reveal-pool', '1');
      await expect(pool).toContainText('В этой партии карт с требованием партии: 1');
      await expect(stage.locator('.con-composer__warn'), 'no «unwinnable» warning while such a card exists').toHaveCount(0);
      await shoot(page, `${profile.tag}-01-setup`);

      const deck = await deckRect(page);
      expect(deck, 'the HUD deck pile stands').not.toBeNull();
      await armProbe(page, KEPT);
      const postsBefore = posts.length;

      // ── 2. A → the deck pull, the flip, the verdict. ──
      await press(page, 'Enter', 800);
      const verdict = page.locator('.con-composer--stage .con-verdict');
      await expect(verdict, 'the verdict stands').toHaveClass(/con-verdict--met/, {timeout: 20_000});
      await settle(page, {timeoutMs: 30_000});
      expect(posts.length - postsBefore, 'A sends exactly ONE POST').toBe(1);
      await expect(verdict).toContainText('Условие выполнено');
      await expect(verdict.locator('[data-verdict-row="check"] .pprq')).toHaveCount(1);
      await expect(verdict.locator('.con-verdict__found--yes'), 'the verdict NAMES the party it found').toContainText('Зелёные');
      await expect(verdict.locator('[data-verdict-row="reward"] .action-effect-chip'), 'card + M€').toHaveCount(2);
      await expect(verdict.locator('[data-reveal-reward-stock="megacredits"]')).toHaveCount(1);
      await expect(verdict.locator('.con-verdict__fate--hand')).toContainText('в руку');
      // The server already holds the card and the M€; the SCREEN does not show them yet.
      const atVerdict = await tankState(request, playerId);
      expect(atVerdict.hand, 'the server put the card in the hand').toContain(KEPT);
      expect(atVerdict.megaCredits).toBe(17);
      await expect(page.locator('.con-res__row--megacredits .con-res__value'), 'the rail still reads the OLD M€').toHaveText('12');
      await expect(page.locator(`.con-handbody[data-hand-dock-card="${KEPT}"]:not(.con-handbody--held)`),
        'the dock does not show the kept card before it lands').toHaveCount(0);
      await shoot(page, `${profile.tag}-02-verdict`);

      // ── 3. «OK» → the outcome detaches; the workspace leaves; card + chip land. ──
      const okAt = await page.evaluate(() => {
        const p = (window as unknown as {__tank: {samples: Array<{t: number}>}}).__tank;
        return p.samples[p.samples.length - 1]?.t ?? 0;
      });
      await press(page, 'Enter', 400);
      await expect(page.locator(`.con-handbody[data-hand-dock-card="${KEPT}"]:not(.con-handbody--held)`),
        'the card landed in the dock').toHaveCount(1, {timeout: 20_000});
      await expect(page.locator('.con-res__row--megacredits .con-res__value'), 'the M€ ticked on the touchdown').toHaveText('17', {timeout: 20_000});
      await settle(page, {timeoutMs: 30_000});
      await waitForBoardHome(page, 30);
      const samples = await readProbe(page);

      expect(samples.length, 'the probe lived').toBeGreaterThan(100);
      // The deck pull: the FIRST proxy sample stands over the HUD pile (face down, leaving it).
      const firstProxy = samples.find((s) => s.proxy !== null);
      expect(firstProxy, 'the reveal flight was seen').toBeTruthy();
      if (deck !== null && firstProxy?.proxy) {
        const pad = 48 * (profile.tag === 'tv4k' ? 2 : 1);
        expect(firstProxy.proxy.x, 'the card leaves the deck pile (x)').toBeGreaterThan(deck.l - pad);
        expect(firstProxy.proxy.x).toBeLessThan(deck.r + pad);
        expect(firstProxy.proxy.y, 'the card leaves the deck pile (y)').toBeLessThan(deck.b + pad);
      }
      const before = samples.filter((s) => s.t <= okAt);
      const after = samples.filter((s) => s.t > okAt);
      expect(before.every((s) => s.mc === '12'), 'the rail kept the old M€ until «OK»').toBe(true);
      expect(before.some((s) => s.dockCard), 'the dock never showed the card before «OK»').toBe(false);
      expect(before.some((s) => s.delivery > 0 || s.transfer > 0), 'nothing flew before «OK»').toBe(false);
      const wsGone = after.find((s) => s.ws === 0);
      const landed = after.find((s) => s.dockCard);
      const ticked = after.find((s) => s.mc === '17');
      const flying = after.find((s) => s.delivery > 0);
      const chip = after.find((s) => s.transfer > 0);
      expect(wsGone, 'the workspace left').toBeTruthy();
      expect(landed, 'the card landed').toBeTruthy();
      expect(flying, 'a delivery proxy carried the card').toBeTruthy();
      expect(chip, 'a transfer chip carried the M€').toBeTruthy();
      expect(ticked, 'the counter ticked').toBeTruthy();
      expect(wsGone!.t, `the workspace left (${wsGone!.t}) BEFORE the card landed (${landed!.t})`).toBeLessThan(landed!.t);
      expect(flying!.t, 'the card was in the air before it landed').toBeLessThan(landed!.t);
      expect(chip!.t, 'the chip was in the air before the counter ticked').toBeLessThan(ticked!.t);
      expect(samples.every((s) => s.degraded === ''), 'no degraded handoff').toBe(true);

      // ── 5. The board, the server, the hygiene. ──
      const atEnd = await tankState(request, playerId);
      expect(atEnd.hand).toContain(KEPT);
      expect(atEnd.megaCredits).toBe(17);
      expect(atEnd.used, 'the action was spent').toBe(true);
      expect(await page.locator('.con-ws').count(), 'no workspace on the board').toBe(0);
      expect(await page.locator('.con-stranded').count(), 'nothing stranded').toBe(0);
      expect(await page.evaluate(() => document.documentElement.getAttribute('data-reveal-handoff-degraded'))).toBeNull();
      await shoot(page, `${profile.tag}-03-board`);
      expect(overflow, `no [console-overflow]: ${overflow.join(' | ')}`).toEqual([]);
      expect(pageErrors, `no page errors: ${pageErrors.join(' | ')}`).toEqual([]);
    });

    test('a MISS: «не получена», the card flies to the discard pile, hand and M€ untouched', async ({page, request}) => {
      test.setTimeout(420_000);
      const pageErrors: Array<string> = [];
      const overflow: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(String(e)));
      page.on('console', (m) => {
        if (m.text().includes('[console-overflow]')) {
          overflow.push(m.text());
        }
      });

      const playerId = await bootFixture(page, request, 'political-think-tank-miss', {query: profile.query});
      const atBoot = await tankState(request, playerId);
      expect(atBoot).toMatchObject({megaCredits: 12, used: false});

      await openThinkTank(page);
      const stage = page.locator('.con-cardactions__stagewrap .con-composer--stage');
      // No card of the kind in this game: the composition says 0 and the warning says why — the action stays armed.
      await expect(stage.locator('[data-reveal-pool]')).toHaveAttribute('data-reveal-pool', '0');
      await expect(stage.locator('[data-reveal-pool]')).toHaveClass(/con-composer__next--pool-empty/);
      await expect(stage.locator('.con-composer__warn')).toContainText('Сейчас условие невыполнимо');
      await expect(page.locator('.con-composer__cta--ready'), 'revealing and discarding is a legal move').toBeVisible();
      await shoot(page, `${profile.tag}-04-setup-zero`);

      await armProbe(page, '__none__');
      await press(page, 'Enter', 800);
      const verdict = page.locator('.con-composer--stage .con-verdict');
      await expect(verdict).toHaveClass(/con-verdict--miss/, {timeout: 20_000});
      await settle(page, {timeoutMs: 30_000});
      await expect(verdict).toContainText('Условие не выполнено');
      await expect(verdict.locator('.con-verdict__found--no')).toHaveCount(1);
      await expect(verdict).toContainText('не получена');
      await expect(verdict.locator('.con-verdict__fate--discard')).toContainText('в сброс');
      const verdictBox = await verdict.boundingBox();
      await shoot(page, `${profile.tag}-05-verdict-miss`);
      const atVerdict = await tankState(request, playerId);

      const okAt = await page.evaluate(() => {
        const p = (window as unknown as {__tank: {samples: Array<{t: number}>}}).__tank;
        return p.samples[p.samples.length - 1]?.t ?? 0;
      });
      await press(page, 'Enter', 400);
      await expect(page.locator('.con-cardactions'), 'the finished flow leaves').toHaveCount(0, {timeout: 20_000});
      await settle(page, {timeoutMs: 30_000});
      await waitForBoardHome(page, 30);
      const samples = await readProbe(page);
      expect(samples.length, 'the probe lived').toBeGreaterThan(50);
      const after = samples.filter((s) => s.t > okAt);
      expect(after.some((s) => s.discardProxy > 0), 'the card flew to the discard pile').toBe(true);
      expect(samples.every((s) => s.mc === '12'), 'the M€ never moved').toBe(true);
      expect(samples.every((s) => s.degraded === ''), 'no degraded handoff').toBe(true);

      const atEnd = await tankState(request, playerId);
      expect(atEnd.hand, 'the hand is untouched').toEqual(atBoot.hand);
      expect(atEnd.megaCredits).toBe(12);
      expect(atVerdict.discard, 'the revealed card is in the discard pile').toBe(atBoot.discard + 1);
      expect(atEnd.used).toBe(true);
      expect(verdictBox, 'the miss verdict stood').not.toBeNull();
      expect(await page.locator('.con-ws').count()).toBe(0);
      expect(await page.locator('.con-stranded').count()).toBe(0);
      expect(overflow, `no [console-overflow]: ${overflow.join(' | ')}`).toEqual([]);
      expect(pageErrors, `no page errors: ${pageErrors.join(' | ')}`).toEqual([]);
    });
  });
}
