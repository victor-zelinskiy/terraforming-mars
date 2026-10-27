import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, bootWithCards, fetchPlayerModel, openActionFocus, openCardActions, press, settle, soloGameConfig, walkFocusUntil,
} from './consoleStart';
import {openColoniesSection} from './cardTradeDoor';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * TR85 «VEYNON DYNAMICS» — the eighth and last new corporation of Turmoil Redux: Trade Envoys' «raise the track
 * before trading» (`tradeOffset` — one server plan) and an action of two variants: «a mech to ANY card» or «1 mech from
 * here → a free trade» (the shared card door — `colonies/cardTradeDoor.ts`). Against a real server, on the TV:
 *
 *   (A) THE START (API boot, solo, Colonies + Redux): the server reads 1 titanium production, 1 mech here, the
 *       standing step `colonyTradeOffset` 1.
 *   (B) THE STANDING STEP (`veynon`): «Колонии» → a colony's focus stage names «+1» BEFORE any press.
 *   (C) THE DOOR (`veynon`): «Действия карт» → Veynon's trade tile → the CTA «Выбрать колонию» commits NOTHING (the
 *       mech stays, no POST), the colonies are a STEP of the card-actions frame (the crumb keeps the corporation),
 *       ONE pinned fee path, «+1» here too; X → ONE POST → mech 0, the fleet out, every flight end visible.
 *   (D) THE FAMILY OF EIGHT (`veynon-family`): variant A's «КУДА» over EIGHT mech holders, Veynon among them; every
 *       candidate stands whole.
 *
 * The rules of the card (the track question, the dock without a track, the fee picker) are the unit spec's
 * (`tests/cards/turmoilRedux/VeynonDynamics.spec.ts`); this asserts the journey.
 */

const VEYNON = 'Veynon Dynamics';
const OUT = path.resolve('screenshots', 'veynon', process.env.TM_E2E_SHOTS_TAG ?? '');
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type Wire = {
  thisPlayer: {
    titaniumProduction: number, colonyTradeOffset?: number, tradesThisGeneration?: number,
    tableau: Array<{name: string, resources?: number}>,
  },
  game: {gameAge: number},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const mechsOf = (wire: Wire, card: string = VEYNON) => wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? -1;
const text = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${PRESET.id}-${name}.png`)});
}

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

/** «Действия карт»: walk the grid until the focused tile is `card`'s printed variant `variant` (1-based) — a snake. */
async function focusTile(page: Page, card: string, variant: number): Promise<void> {
  const focused = () => page.evaluate(() => {
    const tile = document.querySelector('.con-cardactions__tile--focused');
    const v = (tile?.querySelector('.con-cardactions__tile-variant')?.textContent ?? '').replace(/\D+/g, '');
    return `${tile?.getAttribute('data-action-card') ?? ''}#${v}`;
  });
  const at = async () => (await focused()) === `${card}#${variant}`;
  let vertical: 'ArrowDown' | 'ArrowUp' = 'ArrowDown';
  for (let row = 0; row < 8 && !(await at()); row++) {
    if (await walkFocusUntil(page, at, focused, 8)) {
      break;
    }
    const was = await focused();
    await press(page, vertical, 260);
    if (await focused() === was) {
      vertical = vertical === 'ArrowDown' ? 'ArrowUp' : 'ArrowDown';
      await press(page, vertical, 260);
    }
  }
  expect(await at(), `never focused ${card} · variant ${variant} (at ${await focused()})`).toBe(true);
}

/**
 * Every flight end of the trade is painted — except the ONE named defect of the shared trade layer (PL-1104): the
 * colony's income token is born under its own surface's glass, from «Колонии» and from a card door alike (older than
 * TR85; no trade stand checked the income wave's ends before). The income still lands on the rail.
 */
function expectTradeEnds(witness: Awaited<ReturnType<typeof transferWitness>>): void {
  const known = (end: string) => /^birth .* under=glass:con-(colonies|cardactions)$/.test(end);
  const ends = endsOverGlass(witness);
  if (ends.some(known)) {
    test.info().annotations.push({type: 'gap', description: `PL-1104 — the trade income born under its surface: ${ends.filter(known).join(' | ')}`});
  }
  expect(ends.filter((end) => !known(end)), `every other flight end was visible\n${transferTrail(witness)}`).toEqual([]);
  expect(witness.landings.some((l) => l.under === 'rail:megacredits'), `the income landed on the M€ row\n${transferTrail(witness)}`).toBe(true);
}

/** The standing step's caption on the colony focus stage («Ваша торговля сначала продвинет трек +1»). */
const offsetCaption = (page: Page) => text(page, '[data-colony-track-offset]');

test.describe(`console · TR85 Veynon Dynamics · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A — the start: 1 titanium production, 1 mech here, the standing track step', async ({page, request}) => {
    test.setTimeout(360_000);
    const playerId = await bootWithCards(page, request, {
      config: soloGameConfig({expansions: {colonies: true, turmoilRedux: true}, customCorporationsList: [VEYNON]}),
      cards: [],
      corporation: VEYNON,
      query: PRESET.query,
    });
    await settle(page, {timeoutMs: 30_000});
    const wire = await wireOf(request, playerId);
    expect(wire.thisPlayer.titaniumProduction, 'the printed titanium production').toBe(1);
    expect(mechsOf(wire), 'the printed mech on the corporation').toBe(1);
    expect(wire.thisPlayer.colonyTradeOffset, 'the standing step of the effect').toBe(1);
    await shoot(page, 'a-board');
  });

  test('B — «Колонии»: the colony\'s stage names the standing «+1» before any press', async ({page, request}) => {
    test.setTimeout(300_000);
    const posts = watchPosts(page);
    await bootFixtureSeats(page, request, 'veynon', {query: PRESET.query});
    await settle(page);
    await openColoniesSection(page);
    await press(page, 'Enter', 2000);
    await expect(page.locator('.con-colfocus'), 'the colony focus stage opened').toHaveCount(1, {timeout: 15_000});
    await expect.poll(() => offsetCaption(page), {timeout: 10_000, message: 'the standing step is named'}).toMatch(/\+\s*1/);
    expect(posts, 'nothing was sent to read it').toEqual([]);
    await shoot(page, 'b-colony-offset');
    // The CONTROL for C: the same trade entered through «Колонии» (a fee path of the menu) — its flights' ends.
    await armTransferWitness(page);
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'KeyX', 300);
      await expect.poll(() => posts.length, {timeout: 5_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the trade is ONE request').toBe(1);
    await expect.poll(() => page.locator('.con-ws').count(), {timeout: 60_000, message: 'the workspace left'}).toBe(0);
    await settle(page, {timeoutMs: 40_000});
    const witness = await transferWitness(page);
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'b-trail.txt'), transferTrail(witness));
    expectTradeEnds(witness);
  });

  for (const door of [
    {id: 'c', card: VEYNON, fixture: 'veynon', subject: 'VEYNON'},
    // The same door through TR66 (the shared module): what this run finds about the trade's flights is the CLASS's.
    {id: 'c-tr66', card: 'Automated Convoys', fixture: 'veynon-family', subject: 'КОНВО'},
  ] as const) {
    test(`C — ${door.card}: the trade door sends nothing until the trade, the fee pinned, «+1» there too, ONE POST`, async ({page, request}) => {
      test.setTimeout(420_000);
      const posts = watchPosts(page);
      const {playerId} = await bootFixtureSeats(page, request, door.fixture, {query: PRESET.query});
      await settle(page);
      expect(mechsOf(await wireOf(request, playerId), door.card), `the fixture: 1 mech on ${door.card}`).toBe(1);

      await openCardActions(page);
      await expect(page.locator(`.con-cardactions__tile[data-action-card="${door.card}"]`), 'the card\'s two variant tiles').toHaveCount(2);
      await shoot(page, `${door.id}-01-two-tiles`);
      await focusTile(page, door.card, 2);
      await openActionFocus(page);
      const cta = await text(page, '.con-composer__cta-label');
      expect(cta.toLowerCase(), 'the CTA names where it goes').toContain('колони');

      await press(page, 'Enter', 2000);
      await expect(page.locator('.con-colonies__grid'), 'the colony selection stands').toHaveCount(1, {timeout: 10_000});
      expect((await text(page, '.con-cardactions__head .con-wshead__subject')).toUpperCase(), 'the card is the crumb subject')
        .toContain(door.subject);
      expect(posts, 'the door sent nothing').toEqual([]);
      expect(mechsOf(await wireOf(request, playerId), door.card), 'the mech is still on the card').toBe(1);
      await shoot(page, `${door.id}-02-colony-step`);

      await press(page, 'Enter', 2600);
      await expect(page.locator('.con-colfocus'), 'the focus stage opened').toHaveCount(1, {timeout: 15_000});
      const rows = page.locator('.con-colfocus__payrow');
      await expect(rows, 'ONE payment path — the card\'s own').toHaveCount(1);
      await expect(rows.first(), 'pinned').toHaveClass(/con-colfocus__payrow--locked/);
      await expect.poll(() => offsetCaption(page), {timeout: 10_000, message: 'the standing step reads inside the door too'}).toMatch(/\+\s*1/);
      expect(posts, 'still nothing sent').toEqual([]);
      await shoot(page, `${door.id}-03-focus-offset`);

      await armTransferWitness(page);
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'KeyX', 300);
        await expect.poll(() => posts.length, {timeout: 5_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.length, 'the trade is ONE request').toBe(1);
      await expect.poll(async () => mechsOf(await wireOf(request, playerId), door.card), {timeout: 30_000, message: 'the mech paid the trade'}).toBe(0);
      await expect.poll(() => page.locator('.con-ws').count(), {timeout: 60_000, message: 'the workspace left'}).toBe(0);
      await settle(page, {timeoutMs: 40_000});
      const witness = await transferWitness(page);
      fs.mkdirSync(OUT, {recursive: true});
      fs.writeFileSync(path.join(OUT, `${door.id}-trail.txt`), transferTrail(witness));
      await shoot(page, `${door.id}-04-board`);
      expect(posts.length, 'and only one').toBe(1);
      expectTradeEnds(witness);
    });
  }

  test('D — the family of eight: variant A\'s «КУДА» over EIGHT mech holders, every candidate whole', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootFixtureSeats(page, request, 'veynon-family', {query: PRESET.query});
    await settle(page);
    await openCardActions(page);
    await focusTile(page, VEYNON, 1);
    await openActionFocus(page);
    await settle(page);
    const row = () => text(page, `${ACTION_COMPOSER} .con-composer__row--focused`);
    for (const key of ['ArrowDown', 'ArrowUp']) {
      for (let i = 0; i < 6 && !/Куда/.test(await row()); i++) {
        await press(page, key, 220);
      }
    }
    expect(await row(), 'the cursor reached «КУДА»').toMatch(/Куда/);
    await press(page, 'Enter', 700);
    await expect(page.locator('.con-ptsel'), 'the target step opened').toBeVisible();
    await expect(page.locator('.con-ptsel__cell'), 'EIGHT mech holders — Veynon among them').toHaveCount(8);
    const clipped = await page.evaluate(() => Array.from(document.querySelectorAll('.con-ptsel__cell')).flatMap((cell) => {
      const c = cell.getBoundingClientRect();
      const out: Array<string> = [];
      for (let el = cell.parentElement; el !== null && !el.classList.contains('con-ws'); el = el.parentElement) {
        const cs = getComputedStyle(el);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
          const b = el.getBoundingClientRect();
          if (c.left < b.left - 1 || c.right > b.right + 1 || c.top < b.top - 1 || c.bottom > b.bottom + 1) {
            out.push(`${Math.round(c.left)}–${Math.round(c.right)} ⊄ ${el.className.toString().slice(0, 40)} ${Math.round(b.left)}–${Math.round(b.right)}`);
          }
        }
      }
      return out;
    }));
    await shoot(page, 'd-target-eight');
    expect(clipped, 'every candidate stands whole inside the boxes that clip it').toEqual([]);
    const tags = await page.evaluate(() => Array.from(document.querySelectorAll('.con-ptsel__cell [data-ptsel-tag]'))
      .map((t) => t.getAttribute('data-ptsel-tag') ?? 'missing'));
    expect(tags.filter((t) => t === 'missing' || t === 'none'), 'every candidate wears its outcome tag').toEqual([]);
  });
});
