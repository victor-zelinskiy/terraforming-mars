import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, FixtureName, fetchPlayerModel, openActionFocus, openCardActions, press, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * R33 · UTOPIA INVEST — the third classic Turmoil corporation adapted in place, its ACTIVATION the stand's subject:
 * «lower ANY production 1 step → gain 4 of that resource», six declarative variants the server previews and refuses
 * one by one (`tests/cards/turmoil/UtopiaInvest.spec.ts` pins the rules).
 *
 *  A · the composer (`utopia-invest`): the six variants are ONE PALETTE (the face prints a single «[?-prod] → 4 [?]» row
 *      — nothing to slice), in the printed order, each tile led by its resource and «+4», its reading BOTH axes with the
 *      server's numbers (the production `N → N−1`, the stock `S → S+4`); the three dead ones SHOWN with their
 *      reason; the group fits (no scroll, the commit row under it); ◄► walk a row, ▲▼ the rows of a folded grid;
 *  C · the ACTION COMMIT on steel: the production PRICE leaves first — its token born on the steel row's production
 *      badge, absorbed into the printed «?» production frame, the badge ticking 1 → 0 on the departure, never the stock
 *      before it — then the +4 is born on the printed «4 ?» and lands on the steel row, ticking 2 → 6 on the touchdown;
 *      no end over glass; the server: production −1, stock +4, the action used; «Действия карт» then reads «Активирована»;
 *  B · `utopia-invest-sole` — the one live variant (steel) opens SEEDED and marked «Единственный вариант», the cursor
 *      ARRIVES on the commit (an immediate A is the arrival, never the action);
 *  D · `utopia-invest-dead` — every production at its floor: the action tile is refused with its reason.
 *
 * TIMING class (the commit's order is a claim about time) — `--exclusive --workers=1` on the box. The TV profile; the
 * fit of A runs on fhd and the Deck too (the palette's fold and the column's room are per-profile numbers).
 */

const OUT = path.resolve('screenshots', 'utopia');
const PROFILES = [
  {id: 'tv', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: ''},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;
const TV = PROFILES[0];
const UTOPIA = 'Utopia Invest';
const COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';
const GROUP = `${COMPOSER} .con-composer__branches`;
const TILES = `${GROUP} .con-vchoice__opt`;
const ORDER = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

type Wire = {thisPlayer: Record<string, number> & {actionsThisGeneration?: Array<string>}};
async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

async function shoot(page: Page, profile: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, profile), {recursive: true});
  await page.screenshot({path: path.join(OUT, profile, `${name}.png`)});
}

async function openUtopia(page: Page): Promise<void> {
  await openCardActions(page);
  const onTile = () => page.evaluate((name) =>
    document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') === name, UTOPIA);
  const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 18 && !(await onTile()); i++) {
    await press(page, moves[i % moves.length], 260);
  }
  expect(await onTile(), `never focused «${UTOPIA}» in «Действия карт»`).toBe(true);
  await openActionFocus(page);
  await settle(page);
  await expect(page.locator(COMPOSER), 'the action composer stands').toBeVisible();
}

type Tile = {
  resource: string, off: boolean, focused: boolean, selected: boolean, top: number,
  hero: string, figure: string, reason: string, chips: Array<{tone: string, text: string}>, seeded: boolean, mark: string,
};

async function tiles(page: Page): Promise<Array<Tile>> {
  return await page.evaluate((sel) => Array.from(document.querySelectorAll<HTMLElement>(sel)).map((t) => ({
    resource: t.getAttribute('data-palette-resource') ?? '',
    off: t.classList.contains('con-vchoice__opt--off'),
    focused: t.classList.contains('con-vchoice__opt--focused'),
    selected: t.classList.contains('con-vchoice__opt--selected'),
    top: t.offsetTop,
    hero: t.querySelector('[data-vchoice-hero]')?.getAttribute('data-vchoice-hero-icon') ?? '',
    figure: (t.querySelector('[data-vchoice-figure]')?.textContent ?? '').trim(),
    reason: (t.querySelector('.con-vchoice__reason')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    chips: Array.from(t.querySelectorAll('.action-effect-chip')).map((c) => ({
      tone: c.classList.contains('action-effect-chip--cost') ? 'cost' : 'gain',
      text: (c.querySelector('.action-effect-chip__value')?.textContent ?? '').replace(/\s+/g, '').replace(/−/g, '-'),
    })),
    seeded: t.getAttribute('data-seeded') === 'sole',
    mark: (t.querySelector('[data-seeded-mark]')?.textContent ?? '').trim(),
  })), TILES);
}

async function fit(page: Page) {
  return await page.evaluate(([group, composer]) => {
    const g = document.querySelector<HTMLElement>(group);
    const scroll = document.querySelector<HTMLElement>(`${composer} .con-composer__scroll`);
    const cta = document.querySelector<HTMLElement>(`${composer} .con-composer__cta`);
    const r = (el: HTMLElement | null) => el === null ? null : {top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom)};
    return {
      layout: g?.classList.contains('con-vchoice--palette') === true ? 'palette' : 'other',
      axis: g?.getAttribute('data-variant-axis') ?? null,
      kicker: (g?.querySelector('[data-vchoice-kicker]')?.textContent ?? '').trim(),
      group: r(g),
      overflow: scroll === null ? null : scroll.scrollHeight - scroll.clientHeight,
      cta: r(cta),
      ctaFocused: document.querySelector(`${composer} .con-composer__cta--focused`) !== null,
      bar: (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    };
  }, [GROUP, COMPOSER] as const);
}

const focusedResource = async (page: Page) => (await tiles(page)).find((t) => t.focused)?.resource ?? '';

/** The steel row's two numbers as painted: the production badge and the stock digits. */
async function armSteelSampler(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen: Array<string> = [];
    const read = () => {
      const row = document.querySelector('.con-res__row--steel');
      const prod = (row?.querySelector('.con-res__prod')?.textContent ?? '').replace(/[^\d−-]/g, '').replace('−', '-');
      const stock = (row?.querySelector('.con-res__digits')?.textContent ?? '').trim().match(/^-?\d+/)?.[0] ?? '';
      const now = `pr${prod}|st${stock}`;
      if (seen[seen.length - 1] !== now) {
        seen.push(now);
      }
    };
    read();
    const timer = window.setInterval(read, 16);
    const mo = new MutationObserver(read);
    mo.observe(document.body, {childList: true, subtree: true, characterData: true});
    (window as unknown as {__utopiaSteel: unknown}).__utopiaSteel = {seen, stop: () => {
      window.clearInterval(timer);
      mo.disconnect();
    }};
  });
}
async function steelSamples(page: Page): Promise<Array<string>> {
  return await page.evaluate(() => {
    const s = (window as unknown as {__utopiaSteel: {seen: Array<string>, stop: () => void}}).__utopiaSteel;
    s.stop();
    return s.seen;
  });
}

async function boot(page: Page, request: APIRequestContext, fixture: FixtureName, profile: typeof PROFILES[number]): Promise<string> {
  const {playerId} = await bootFixtureSeats(page, request, fixture, {query: profile.query});
  await settle(page);
  return playerId;
}

for (const profile of PROFILES) {
  test.describe(`Utopia Invest · the six-variant palette · ${profile.id}`, () => {
    test.use({viewport: profile.viewport});

    test(`A · six variants are ONE palette: both axes on every tile, three refused with their reason, the grid walks (${profile.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const overflow: Array<string> = [];
      page.on('console', (m) => {
        if (m.text().includes('[console-overflow]')) {
          overflow.push(m.text().slice(0, 200));
        }
      });
      const playerId = await boot(page, request, 'utopia-invest', profile);
      const before = (await wireOf(request, playerId)).thisPlayer;
      await openUtopia(page);
      await shoot(page, profile.id, 'A-01-palette');

      const ts = await tiles(page);
      const f = await fit(page);
      expect(f.layout, 'the variants are a PALETTE').toBe('palette');
      expect(f.kicker, 'the kicker carries the exclusion').toMatch(/Один из 6/);
      expect(ts.map((t) => t.resource), 'the printed order').toEqual(ORDER);
      expect(ts.map((t) => t.hero), 'each tile led by its own resource').toEqual(ORDER);
      expect(ts.map((t) => t.figure), 'the hero\'s number — the server\'s +4').toEqual(ORDER.map(() => '+4'));
      expect(ts.map((t) => t.off), 'M€ · steel · titanium live; plants · energy · heat refused').toEqual([false, false, false, true, true, true]);
      for (const t of ts.filter((x) => x.off)) {
        expect(t.reason, `${t.resource}: the refusal is stated on the tile`).toMatch(/Невозможно уменьшить производство/);
      }
      // BOTH AXES with the server's numbers: the production chip (cost) and the stock chip (gain).
      const prodKey: Record<string, string> = {
        megacredits: 'megacreditProduction', steel: 'steelProduction', titanium: 'titaniumProduction',
        plants: 'plantProduction', energy: 'energyProduction', heat: 'heatProduction',
      };
      const stockKey: Record<string, string> = {megacredits: 'megacredits', steel: 'steel', titanium: 'titanium', plants: 'plants', energy: 'energy', heat: 'heat'};
      for (const t of ts.filter((x) => !x.off)) {
        const prod = before[prodKey[t.resource]];
        const stock = before[stockKey[t.resource]];
        expect(t.chips, `${t.resource}: two chips — the price and the gain`).toHaveLength(2);
        expect(t.chips[0], `${t.resource}: production ${prod} → ${prod - 1}`).toEqual({tone: 'cost', text: `${prod}→${prod - 1}`});
        expect(t.chips[1], `${t.resource}: stock ${stock} → ${stock + 4}`).toEqual({tone: 'gain', text: `${stock}→${stock + 4}`});
      }

      // THE FIT — no scroll, the commit row under the group.
      expect(f.overflow, 'the decision column does not scroll').toBe(0);
      expect(f.cta!.top, 'the commit row stands under the group').toBeGreaterThanOrEqual(f.group!.bottom);
      expect(['row', 'grid'], `the palette walks as a row or a folded grid (got ${f.axis})`).toContain(f.axis);
      const rows = [...new Set(ts.map((t) => t.top))];
      expect([1, 2], `one row or a 3 + 3 fold — never 5 + 1 (tops ${rows.join(',')})`).toContain(rows.length);
      if (rows.length === 2) {
        expect(ts.filter((t) => t.top === rows[0]).length, 'the fold is 3 + 3').toBe(3);
      }

      // THE GRAMMAR — the cursor opens on the first live tile; ◄► walk a row; the bar names it; ▼ in a grid walks rows.
      expect(await focusedResource(page), 'the cursor opens on the first live variant').toBe('megacredits');
      expect(f.bar, 'the bar names the switch').toMatch(/Вариант/);
      await press(page, 'ArrowRight', 300);
      expect(await focusedResource(page)).toBe('steel');
      if (f.axis === 'grid') {
        await press(page, 'ArrowDown', 300);
        expect(await focusedResource(page), '▼ walks to the row below (the same column)').toBe('energy');
        await shoot(page, profile.id, 'A-02-cursor-dead');
        await press(page, 'ArrowUp', 300);
        expect(await focusedResource(page), '▲ back up').toBe('steel');
      }
      expect((await tiles(page)).filter((t) => t.selected), 'moving the cursor selects nothing').toHaveLength(0);
      await press(page, 'Enter', 500);
      const after = await tiles(page);
      expect(after.filter((t) => t.selected).map((t) => t.resource), 'ONE seal, on steel').toEqual(['steel']);
      expect((await fit(page)).ctaFocused, 'A on a tile lands the cursor on the commit').toBe(true);
      await shoot(page, profile.id, 'A-03-chosen-steel');
      expect(overflow, 'no [console-overflow]').toEqual([]);
    });
  });
}

test.describe('Utopia Invest · the activation · tv', () => {
  test.use({viewport: TV.viewport});

  test('C · the production price leaves the badge FIRST, the +4 is born on the printed «4 ?» after; the server and «Активирована»', async ({page, request}) => {
    test.setTimeout(300_000);
    const playerId = await boot(page, request, 'utopia-invest', TV);
    const before = (await wireOf(request, playerId)).thisPlayer;
    expect([before.steelProduction, before.steel], 'the fixture').toEqual([1, 2]);
    await openUtopia(page);
    await press(page, 'ArrowRight', 300);
    await press(page, 'Enter', 500);
    expect((await tiles(page)).filter((t) => t.selected).map((t) => t.resource)).toEqual(['steel']);
    await expect(page.locator(`${COMPOSER} .con-composer__cta--focused`)).toHaveCount(1);

    await armTransferWitness(page);
    await armSteelSampler(page);
    await press(page, 'Enter', 400);
    await expect.poll(async () => {
      const p = (await wireOf(request, playerId)).thisPlayer;
      return [p.steelProduction, p.steel];
    }, {timeout: 20_000, message: 'the server: production 1 → 0, stock 2 → 6'}).toEqual([0, 6]);
    await expect(page.locator('.con-cardactions'), 'the workspace folds once its tokens are clear').toHaveCount(0, {timeout: 30_000});
    await settle(page, {timeoutMs: 30_000});
    const seen = await steelSamples(page);
    const w = await transferWitness(page);
    await shoot(page, TV.id, 'C-01-after');
    const trail = transferTrail(w);
    fs.mkdirSync(path.join(OUT, TV.id), {recursive: true});
    fs.writeFileSync(path.join(OUT, TV.id, 'C-witness.json'), JSON.stringify({seen, witness: w}, null, 1));

    // THE ORDER on the rail: the badge ticks 1 → 0 on the price's departure, the stock 2 → 6 only after.
    const firstProd0 = seen.findIndex((s) => s.startsWith('pr0|'));
    const firstStock6 = seen.findIndex((s) => s.endsWith('|st6'));
    expect(firstProd0, `the badge ticked (samples ${seen.join(' ')})`).toBeGreaterThanOrEqual(0);
    expect(firstStock6, `the stock ticked (samples ${seen.join(' ')})`).toBeGreaterThanOrEqual(0);
    expect(firstProd0, `the price before the result (samples ${seen.join(' ')})`).toBeLessThan(firstStock6);
    expect(seen.some((s) => s === 'pr1|st6'), `never the result before its cause (samples ${seen.join(' ')})`).toBe(false);

    // THE ENDS: the «−1» born on the steel row (its badge), drawn into the printed «?»; the «+4» born on the printed «?»,
    // landing on the steel row. Nothing over glass.
    const price = w.births.find((b) => /[−-]\s*1/.test(b.value));
    const result = w.births.find((b) => /\+\s*4/.test(b.value));
    expect(price?.under, `the price is born on the steel row — ${trail}`).toBe('rail:steel');
    expect(w.landings.find((l) => l.id === price?.id)?.under, `the price lands in the printed «?» — ${trail}`).toMatch(/^wild$|^hero$/);
    expect(result?.under, `the +4 is born on the printed «4 ?» — ${trail}`).toBe('wild');
    expect(w.landings.find((l) => l.id === result?.id)?.under, `the +4 lands on the steel row — ${trail}`).toBe('rail:steel');
    expect(price!.t, 'the price is born before the result').toBeLessThan(result!.t);
    expect(endsOverGlass(w), 'no end over glass').toEqual([]);

    // The server: the action is used this generation; «Действия карт» says so.
    const after = (await wireOf(request, playerId)).thisPlayer;
    expect([after.megacreditProduction, after.titaniumProduction], 'the other productions never moved').toEqual([before.megacreditProduction, before.titaniumProduction]);
    expect(after.actionsThisGeneration ?? [], 'the server marks the action used').toContain(UTOPIA);
    // «Действия карт» opens on the actions still to take; the used one is counted under «Активированы».
    await openCardActions(page);
    await expect(page.locator('.con-cardactions'), 'the used action is counted «Активированы 1»').toContainText(/Активированы\s*1/);
    await shoot(page, TV.id, 'C-02-activated');
  });

  test('B · a SOLE live variant opens seeded and marked, the cursor arrives on the commit', async ({page, request}) => {
    test.setTimeout(240_000);
    const playerId = await boot(page, request, 'utopia-invest-sole', TV);
    await openUtopia(page);
    await shoot(page, TV.id, 'B-01-sole');
    const ts = await tiles(page);
    expect(ts.map((t) => t.off), 'only steel is live').toEqual([true, false, true, true, true, true]);
    expect(ts[0].reason, 'M€ at its floor is refused with its reason').toMatch(/Невозможно уменьшить производство/);
    const steel = ts[1];
    expect([steel.selected, steel.seeded, steel.mark], 'seeded, shown, marked').toEqual([true, true, 'Единственный вариант']);
    expect((await fit(page)).ctaFocused, 'nothing left to ask: the cursor stands on the commit').toBe(true);
    // The commit ARRIVED (the T14 arrival — `__conCommitArrival` is its probe; the absorption window itself is
    // `console-composer-preselect`'s subject). A deliberate A past it runs the seeded variant: steel, nothing else.
    expect(await page.evaluate(() => typeof (window as unknown as {__conCommitArrival?: unknown}).__conCommitArrival), 'the arrival probe stands').toBe('function');
    await cinematicBeat(page, 1200, 'past the commit arrival\'s absorb window');
    await press(page, 'Enter', 400);
    await expect.poll(async () => {
      const p = (await wireOf(request, playerId)).thisPlayer;
      return [p.steelProduction, p.steel, p.megacreditProduction];
    }, {timeout: 20_000, message: 'the seeded steel variant ran: production 1 → 0, stock 2 → 6, M€ production untouched'}).toEqual([0, 6, -5]);
  });

  test('D · every production at its floor: the action is refused on its tile with its reason', async ({page, request}) => {
    test.setTimeout(180_000);
    await boot(page, request, 'utopia-invest-dead', TV);
    await openCardActions(page);
    const tile = page.locator(`[data-action-card="${UTOPIA}"]`).first();
    await expect(tile, 'the action is refused by the rules').toHaveAttribute('data-action-verdict', 'rules');
    await expect(tile.locator('.con-cardactions__tile-reason'), 'the tile states the reason').toContainText(/Невозможно уменьшить производство/);
    await shoot(page, TV.id, 'D-01-refused');
  });
});
