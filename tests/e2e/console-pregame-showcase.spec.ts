import {test, expect, Page, APIRequestContext} from './consoleTest';
import {press, soloGameConfig} from './consoleStart';
import {campaignBase, createCampaign, seedIdentity} from './campaignFixtures';

/**
 * TR68 «ПРЕДИГРОВОЕ — ЭТО ВИТРИНА» (docs/claude/console/pregame-showcase.md) — the pregame is a SHOWCASE, never a
 * dialog: «Мои партии» / «Мои кампании» are screens on the campaign map's grammar (head · stage · bar), a game is a
 * CARD with its board miniature, the creator's decks fill the opening, every pregame text obeys the TV floor, and the
 * Deck 1280×800 fit stays the base contract.
 *
 *   A  «Мои партии» with two games: a screen with no `.cm-overlay`, cards with their miniature, the stage ≥ 55 % of the
 *      viewport, nothing under the floor (TV), the names whole; A enters the game (fhd · tv4k · deck)
 *   B  the honest states on the stage: none (a fresh name) · failed (the listing answers 500) — never a line in a plate
 *   C  «Мои кампании»: the name whole, the route of four nodes, one current; A opens the map
 *   D  the phrase menu → screen → B: the column recedes, the plate unfolds out of the item, the cards come in a wave,
 *      nothing changes in one frame; back on the same item
 *   E  the creator: the mode tiles illustrated; the crew a ROW of seat cards; the rules two columns; the expansions
 *      read; the map cards of a mission card's size; nothing under the floor (TV)
 *   F  the overlays (the participant editor · the keyboard · the launch plate) on the floor
 *   G  the Deck: the lobby and every deck without a scroll
 *   H  reduced motion: the screen arrives without a camera
 */

const NAME = 'Alice';

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;
type Preset = typeof PRESETS[number];

async function createGames(request: APIRequestContext, name: string): Promise<void> {
  for (const players of [
    [{name, color: 'blue', beginner: false, handicap: 0, first: true}, {name: 'Bruno', color: 'red', beginner: false, handicap: 0, first: false}],
    [{name, color: 'blue', beginner: false, handicap: 0, first: true}],
  ]) {
    const res = await request.post(`${campaignBase()}/api/creategame`, {data: soloGameConfig({players, expansions: {venus: true, colonies: true, prelude: true}})});
    expect(res.ok(), 'the game was created').toBeTruthy();
  }
}

async function toMenu(page: Page, preset: Preset): Promise<void> {
  await page.goto(`${campaignBase()}/?x=1${preset.query}`);
  await page.waitForSelector('.cm-menu__items', {timeout: 60_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => undefined);
}

/** Open a menu item by its id with the pad (▲ ▼ to it, A). */
async function openItem(page: Page, id: string): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const at = await page.locator('.cm-item--cursor').getAttribute('data-menu-item');
    if (at === id) {
      break;
    }
    await press(page, 'ArrowDown', 120);
  }
  await expect(page.locator('.cm-item--cursor')).toHaveAttribute('data-menu-item', id);
  await press(page, 'Enter', 200);
}

/** THE FLOOR PROBE (TV): every own-text element under `root` against `--con-t-floor` × the rem — zoom-aware, SVG out. */
async function belowFloor(page: Page, root: string): Promise<{floorPx: number, below: Array<string>, texts: number}> {
  return await page.evaluate((sel) => {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const token = getComputedStyle(document.documentElement).getPropertyValue('--con-t-floor').trim();
    const floorPx = (token.endsWith('rem') ? parseFloat(token) : 0.8) * rem;
    const below: Array<string> = [];
    let texts = 0;
    for (const scope of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      for (const el of Array.from(scope.querySelectorAll<HTMLElement>('*'))) {
        const own = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
        if (!own || el.closest('svg') !== null) {
          continue;
        }
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0 || getComputedStyle(el).visibility === 'hidden') {
          continue;
        }
        texts++;
        const z = (el as unknown as {currentCSSZoom?: number}).currentCSSZoom ?? 1;
        const px = parseFloat(getComputedStyle(el).fontSize) * z;
        if (px + 0.5 < floorPx) {
          below.push(`${String(el.className).split(' ')[0] || el.tagName} «${(el.textContent ?? '').trim().slice(0, 24)}» ${px.toFixed(1)}px`);
        }
      }
    }
    return {floorPx, below, texts};
  }, root);
}

/** The phrase is over: no finite animation still running anywhere on the page (an ambient loop is not a phrase). */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity), undefined, {timeout: 15_000});
}

function overflowWarnings(page: Page): Array<string> {
  const warnings: Array<string> = [];
  page.on('console', (m) => {
    if (m.text().includes('[console-overflow]')) {
      warnings.push(m.text().slice(0, 200));
    }
  });
  return warnings;
}

for (const preset of PRESETS) {
  test.describe(`TR68 the pregame showcase · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A — «Мои партии» is a SCREEN of game cards (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const overflow = overflowWarnings(page);
      await createGames(request, NAME);
      await seedIdentity(page, NAME);
      await toMenu(page, preset);
      await openItem(page, 'games');
      const screen = page.locator('[data-lobby-screen="games"]');
      await expect(screen).toBeVisible();
      await expect(page.locator('.cm-lcard[data-lobby-card="game"]').first()).toBeVisible({timeout: 60_000});
      await expect.poll(() => page.locator('.cm-lcard[data-lobby-card="game"]').count(), {timeout: 30_000}).toBeGreaterThanOrEqual(2);
      expect(await page.locator('.cm-overlay').count(), 'never a dialog').toBe(0);
      await settled(page);
      const facts = await page.evaluate(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scr = document.querySelector('.cm-screen')!.getBoundingClientRect();
        const cards = Array.from(document.querySelectorAll<HTMLElement>('.cm-lcard[data-lobby-card="game"]'));
        return {
          share: (scr.width * scr.height) / (vw * vh),
          miniatures: cards.filter((c) => c.querySelector('.cm-lcard__map .map-fp') !== null).length,
          cards: cards.length,
          cutNames: cards.map((c) => c.querySelector<HTMLElement>('.cm-lcard__name')!)
            .filter((n) => n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1).map((n) => n.textContent),
          cardBox: cards[0].getBoundingClientRect().toJSON(),
          docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(facts.share, `the screen fills the opening (${JSON.stringify(facts)})`).toBeGreaterThan(0.55);
      expect(facts.miniatures, 'every game card draws its board').toBe(facts.cards);
      expect(facts.cutNames, 'no name is cut while its card has room').toEqual([]);
      expect(facts.docOverflowX).toBeLessThanOrEqual(1);
      if (preset.id === 'tv4k') {
        const floor = await belowFloor(page, '.cm-screen');
        expect(floor.below, `nothing under the couch floor (${floor.floorPx}px, ${floor.texts} texts)`).toEqual([]);
        expect(facts.cardBox.width, 'a card of the showcase, not a row').toBeGreaterThan(900);
      }
      await page.screenshot({path: `screenshots/tr68/${preset.id}/after-a-games.png`});
      expect(overflow, 'no console overflow').toEqual([]);
      // A enters the card under the cursor (the curtain → the game).
      await Promise.all([
        page.waitForURL(/player\?id=/, {timeout: 60_000}),
        press(page, 'Enter', 300),
      ]);
    });

    test(`B — the honest states stand on the stage (${preset.id})`, async ({page}) => {
      test.setTimeout(180_000);
      await seedIdentity(page, `Nobody-${Date.now()}`);
      await toMenu(page, preset);
      await openItem(page, 'games');
      await expect(page.locator('[data-lobby-state="empty"]'), 'a fresh name: «no games yet», on the stage').toBeVisible({timeout: 60_000});
      await settled(page);
      expect(await page.locator('.cm-overlay').count()).toBe(0);
      await page.screenshot({path: `screenshots/tr68/${preset.id}/after-b-empty.png`});
      // The listing fails: «could not load», never «no games».
      await page.route('**/api/games/joinable**', (route) => route.fulfill({status: 500, body: 'down'}));
      await press(page, 'Escape', 600);
      await toMenu(page, preset);
      await openItem(page, 'games');
      await expect(page.locator('[data-lobby-state="error"]'), 'a failed listing names itself').toBeVisible({timeout: 60_000});
      await settled(page);
      await page.screenshot({path: `screenshots/tr68/${preset.id}/after-b-error.png`});
      if (preset.id === 'tv4k') {
        expect((await belowFloor(page, '.cm-screen')).below).toEqual([]);
      }
    });

    test(`C — «Мои кампании»: the campaign card, its name whole, its route; A opens the map (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      const {name} = await createCampaign(request);
      await seedIdentity(page, NAME);
      await toMenu(page, preset);
      await openItem(page, 'campaigns');
      const card = page.locator('.cm-lcard.cm-camp', {hasText: name});
      await expect(card).toHaveCount(1, {timeout: 60_000});
      expect(await page.locator('.cm-overlay').count()).toBe(0);
      await settled(page);
      const cut = await card.locator('.cm-lcard__name').evaluate((n) => n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1);
      expect(cut, 'the campaign\'s name is never cut while the card has room').toBe(false);
      await expect(card.locator('.cm-lcard__node'), 'the route: one node per mission').toHaveCount(4);
      await expect(card.locator('.cm-lcard__node--current')).toHaveCount(1);
      await expect(card.locator('.cm-lcard__map .map-fp')).toHaveCount(1);
      if (preset.id === 'tv4k') {
        expect((await belowFloor(page, '.cm-screen')).below).toEqual([]);
      }
      await page.screenshot({path: `screenshots/tr68/${preset.id}/after-c-campaigns.png`});
      await card.hover();
      await press(page, 'Enter', 300);
      await page.waitForSelector('.cmap', {timeout: 60_000});
    });

    test(`D — the phrase: the column recedes, the plate unfolds out of the item, the cards wave in; B plays it back (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await createGames(request, NAME);
      await seedIdentity(page, NAME);
      await toMenu(page, preset);
      // Cards on screen once (the list cached), so the phrase plays over real cards.
      await openItem(page, 'games');
      await expect(page.locator('.cm-lcard[data-lobby-card="game"]').first()).toBeVisible({timeout: 60_000});
      await press(page, 'Escape', 200);
      await expect(page.locator('.cm-screen')).toHaveCount(0, {timeout: 10_000});
      await expect(page.locator('.cm-item--cursor')).toHaveAttribute('data-menu-item', 'games');
      // THE SAMPLER — MutationObserver + setInterval, never rAF.
      await page.evaluate(() => {
        // A MutationObserver sample is a MICROTASK (it can see a state the browser never paints) — the claims below
        // about FRAMES read the interval's samples only (`tick`).
        type S = {t: number, tick: boolean, items: number, plate: string | undefined, plateOp: number | undefined, cards: Array<number>};
        const w = window as unknown as {__lobbyPhrase: Array<S>};
        w.__lobbyPhrase = [];
        const t0 = performance.now();
        const sample = (tick: boolean) => {
          const items = document.querySelector('.cm-menu__items');
          const plate = document.querySelector('.cm-screen__plate');
          w.__lobbyPhrase.push({
            t: Math.round(performance.now() - t0),
            tick,
            items: items === null ? -1 : parseFloat(getComputedStyle(items).opacity),
            plate: plate === null ? undefined : getComputedStyle(plate).transform,
            plateOp: plate === null ? undefined : parseFloat(getComputedStyle(plate).opacity),
            cards: Array.from(document.querySelectorAll('.cm-lcard')).map((c) => parseFloat(getComputedStyle(c).opacity)),
          });
        };
        new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
        window.setInterval(() => sample(true), 30);
      });
      await press(page, 'Enter', 200);
      await expect(page.locator('.cm-lcard[data-lobby-card="game"]').first()).toBeVisible({timeout: 30_000});
      await expect.poll(async () => await page.evaluate(() => {
        const s = (window as unknown as {__lobbyPhrase: Array<{cards: Array<number>}>}).__lobbyPhrase;
        const last = s[s.length - 1];
        return last !== undefined && last.cards.length > 0 && last.cards.every((o) => o > 0.99);
      }), {timeout: 10_000}).toBe(true);
      const phrase = (await page.evaluate(() => (window as unknown as {__lobbyPhrase: Array<{t: number, tick: boolean, items: number, plate?: string, plateOp?: number, cards: Array<number>}>}).__lobbyPhrase))
        .filter((s) => s.tick);
      const dump = JSON.stringify(phrase.filter((_, i) => i % 3 === 0).slice(0, 60));
      // The column RECEDES through intermediate values (never a cut).
      expect(phrase.some((s) => s.items > 0.08 && s.items < 0.92), `the column recedes progressively (${dump})`).toBe(true);
      // The plate UNFOLDS: its first painted sample is a transform out of the item, its last the identity.
      const plates = phrase.filter((s) => s.plate !== undefined);
      expect(plates.length, 'the plate was sampled').toBeGreaterThan(2);
      expect(plates.some((s) => s.plate !== 'none' && /matrix/.test(s.plate!)), `the plate unfolds out of the item (${dump})`).toBe(true);
      expect(plates[plates.length - 1].plate === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(plates[plates.length - 1].plate!), 'the plate lands at rest').toBe(true);
      // The cards come in a WAVE: each surfaces after the plate opened, and not all in one sample.
      const surfacedAt = (k: number) => phrase.find((s) => (s.cards[k] ?? 0) > 0.5)?.t;
      const first = surfacedAt(0);
      const last = surfacedAt(phrase[phrase.length - 1].cards.length - 1);
      expect(first, `the first card surfaced (${dump})`).toBeDefined();
      expect(last!, `the cards surface in turn, never in one frame (${dump})`).toBeGreaterThan(first!);
      // B — the same phrase back, the cursor on the same item.
      await press(page, 'Escape', 200);
      await expect(page.locator('.cm-screen')).toHaveCount(0, {timeout: 10_000});
      await expect(page.locator('.cm-item--cursor')).toHaveAttribute('data-menu-item', 'games');
      await expect.poll(() => page.locator('.cm-menu__items').evaluate((el) => parseFloat(getComputedStyle(el).opacity)), {timeout: 5_000}).toBeGreaterThan(0.99);
    });

    test(`E — the creator: illustrated modes, the crew a row, the decks fill the opening (${preset.id})`, async ({page}) => {
      test.setTimeout(240_000);
      const overflow = overflowWarnings(page);
      await seedIdentity(page, NAME);
      await toMenu(page, preset);
      await openItem(page, 'create');
      await page.waitForSelector('.cm-mode__tile', {timeout: 30_000});
      await settled(page);
      await expect(page.locator('.cm-mode__tile[data-mode="single"] .cm-mode__art .map-fp')).toHaveCount(1);
      await expect(page.locator('.cm-mode__tile[data-mode="campaign"] .cm-mode__stop .map-fp')).toHaveCount(4);
      await page.screenshot({path: `screenshots/tr68/${preset.id}/after-e-mode.png`});
      if (preset.id === 'tv4k') {
        expect((await belowFloor(page, '.cm-create')).below, 'the mode tiles on the floor').toEqual([]);
      }
      await press(page, 'Enter', 600); // «Отдельная партия»
      await page.waitForSelector('.cm-crew', {timeout: 30_000});
      await settled(page);
      const crew = await page.evaluate(() => {
        const deck = document.querySelector('.cm-create__deck')!.getBoundingClientRect();
        const rows = Array.from(document.querySelectorAll('.cm-crew .cm-row')).map((r) => r.getBoundingClientRect());
        return {deckH: deck.height, tops: rows.map((r) => Math.round(r.top)), heights: rows.map((r) => r.height)};
      });
      if (preset.id !== 'deck') {
        expect(new Set(crew.tops).size, `the crew stands in a ROW (${JSON.stringify(crew)})`).toBe(1);
        expect(Math.min(...crew.heights) / crew.deckH, 'a seat card is a card, not a strip').toBeGreaterThan(0.4);
      }
      await page.screenshot({path: `screenshots/tr68/${preset.id}/after-e-crew.png`});
      const decks: Array<string> = ['crew'];
      for (const deck of ['rules', 'expansions', 'map']) {
        await press(page, 'KeyE', 500); // RB
        decks.push(deck);
        await settled(page);
        await page.screenshot({path: `screenshots/tr68/${preset.id}/after-e-${deck}.png`});
        if (preset.id === 'tv4k') {
          expect((await belowFloor(page, '.cm-create')).below, `the ${deck} deck on the floor`).toEqual([]);
        }
        if (deck === 'rules' && preset.id !== 'deck') {
          const lefts = await page.evaluate(() => new Set(Array.from(document.querySelectorAll('.cm-rules .cm-row')).map((r) => Math.round(r.getBoundingClientRect().left))).size);
          expect(lefts, 'the rules stand in two columns').toBe(2);
        }
        if (deck === 'expansions' && preset.id !== 'deck') {
          await expect(page.locator('.cm-exp__desc').first(), 'an expansion says what it adds').toBeVisible();
        }
        if (deck === 'map' && preset.id === 'tv4k') {
          const w = await page.locator('.cm-map').first().evaluate((el) => el.getBoundingClientRect().width);
          expect(w, 'a board card of a mission card\'s size').toBeGreaterThan(600);
        }
      }
      expect(overflow, `no console overflow on ${decks.join(' / ')}`).toEqual([]);
    });

    test(`F — the overlays stand on the floor: the participant editor, the keyboard, the launch plate (${preset.id})`, async ({page}) => {
      test.setTimeout(240_000);
      await seedIdentity(page, NAME);
      await toMenu(page, preset);
      await openItem(page, 'create');
      await page.waitForSelector('.cm-mode__tile', {timeout: 30_000});
      await press(page, 'Enter', 600);
      await page.waitForSelector('.cm-crew', {timeout: 30_000});
      // The second seat (unnamed) → the editor.
      await press(page, preset.id === 'deck' ? 'ArrowDown' : 'ArrowRight', 300);
      await press(page, 'Enter', 600);
      await page.waitForSelector('.cm-overlay .cm-fields', {timeout: 15_000});
      await page.screenshot({path: `screenshots/tr68/${preset.id}/after-f-editor.png`});
      if (preset.id === 'tv4k') {
        expect((await belowFloor(page, '.cm-overlay')).below, 'the editor on the floor').toEqual([]);
      }
      await press(page, 'Enter', 600); // the name → the keyboard
      await page.waitForSelector('.cm-vk-panel', {timeout: 15_000});
      await page.screenshot({path: `screenshots/tr68/${preset.id}/after-f-keyboard.png`});
      if (preset.id === 'tv4k') {
        expect((await belowFloor(page, '.cm-vk-panel')).below, 'the keyboard\'s lines on the floor').toEqual([]);
      }
      for (const key of ['KeyB', 'KeyO', 'KeyB']) {
        await page.keyboard.type(key.slice(3).toLowerCase());
      }
      await page.locator('.cm-vk__key--done').click();
      await expect(page.locator('.cm-vk-panel')).toHaveCount(0, {timeout: 10_000});
      await press(page, 'Escape', 500); // close the editor
      await press(page, 'KeyX', 800); // X — the launch
      const plate = page.locator('.cm-overlay--launch');
      await expect(plate, 'the launch plate (names filled)').toBeVisible({timeout: 15_000});
      await expect(plate.locator('.cm-launchc__board .map-fp'), 'the board is the plate\'s hero').toHaveCount(1);
      await page.screenshot({path: `screenshots/tr68/${preset.id}/after-f-launch.png`});
      if (preset.id === 'tv4k') {
        expect((await belowFloor(page, '.cm-overlay--launch')).below, 'the launch plate on the floor').toEqual([]);
      }
      await press(page, 'Escape', 400);
    });
  });
}

test.describe('TR68 the pregame showcase · reduced motion', () => {
  test.use({viewport: {width: 1920, height: 1080}});
  test('H — the screen arrives in place, no camera on the plate', async ({page, request}) => {
    test.setTimeout(120_000);
    await page.emulateMedia({reducedMotion: 'reduce'});
    await createGames(request, NAME);
    await seedIdentity(page, NAME);
    await toMenu(page, PRESETS[0]);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await page.evaluate(() => {
      const w = window as unknown as {__plates: Array<string>};
      w.__plates = [];
      const sample = () => {
        const plate = document.querySelector('.cm-screen__plate');
        if (plate !== null) {
          w.__plates.push(getComputedStyle(plate).transform);
        }
      };
      new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
      window.setInterval(sample, 25);
    });
    await openItem(page, 'games');
    await expect(page.locator('[data-lobby-screen="games"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as {__plates: Array<string>}).__plates.length), {timeout: 5_000}).toBeGreaterThan(2);
    const plates = await page.evaluate(() => (window as unknown as {__plates: Array<string>}).__plates);
    expect(plates.filter((t) => t !== 'none' && !/matrix\(1, 0, 0, 1, 0, 0\)/.test(t)), 'no scale of the plate under reduced motion').toEqual([]);
  });
});
