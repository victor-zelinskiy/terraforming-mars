import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, fetchPlayerModel, focusCard, openActionFocus, openCardActions, press, settle, waitForBoardHome, walkFocusUntil,
} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * TR50 «ЭКСПЕДИЦИОННЫЕ МЕХИ» — the set's SEVENTH mech holder: TR40 Forestry
 * Mechs with another B («1 mech off here → a card»), ONE declaration. Against a
 * real server, on two profiles, three fixtures (the Scientists ruling):
 *
 *   (A) THE PLAY (`expedition-mechs`, 2 M€ + 1 steel; TR17 with 1 mech and TR48
 *       with 1 data on the table): the panel of a Science + Building card for 5
 *       lists FOUR lanes — data first, steel, the Construction mech, M€ — and
 *       the opening mix is exact (data 1 + steel 1 + M€ 1, the 5-M€ mech left at
 *       0); ONE POST; the data's price token is born on its pay row (PL-163).
 *   (B) THE ACTION, variant B (`expedition-mechs-action`, 1 mech, 1 energy): the
 *       card's TWO tiles in «Действия карт»; B → the mech LEAVES the hero's
 *       capsule as a token (PL-201), the deck answers, ONE card into the hand;
 *       the server: mech 0, hand +1; a second visit finds the card used. The
 *       beat's dead time is measured from the press to the board (`deadGaps`).
 *   (A') variant A on the same fixture: the energy leaves the rail, the mech
 *       lands in the hero's capsule (PL-063).
 *   (C) THE FAMILY (`expedition-mechs-family`): the satellite's mech chips by
 *       ROLE (seven holders, six meanings), then TR29's «a mech on ANY card»
 *       over SEVEN candidates — every candidate's reading is read; TR50 picked →
 *       ONE POST → the mech lands on its miniature in the composer.
 *
 * Fixtures `expedition-mechs`, `-action`, `-family`. Heavy 4K: `--workers=1`
 * (or `TM_E2E_GPU=1`). Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Expedition Mechs';
const RECYCLING = 'Spaceship Recycling';
const OUT = path.resolve('screenshots', 'expedition-mechs', process.env.TM_E2E_SHOTS_TAG ?? '');
const PLAY_COMPOSER = '.con-composer--play';
const ACTION_COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';
const FAMILY = ['EVA Mechs', 'Construction Mechs', 'Mech Sports', 'Mars Army Mechs', 'Automated Convoys', 'Forestry Mechs', CARD];

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {megacredits: number, steel: number, energy: number, tableau: Array<{name: string, resources?: number}>},
  cardsInHand?: Array<{name: string}>,
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const resourcesOf = (wire: Wire, card: string) => wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;
const text = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

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

function watchPage(page: Page): {posts: Array<string>, errors: Array<string>, overflow: Array<string>} {
  const out = {posts: [] as Array<string>, errors: [] as Array<string>, overflow: [] as Array<string>};
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      out.posts.push(r.postData() ?? '');
    }
  });
  page.on('pageerror', (e) => out.errors.push(e.message));
  page.on('console', (m) => {
    if (m.text().includes('[console-overflow]')) {
      out.overflow.push(m.text().slice(0, 200));
    }
  });
  return out;
}

function writeTrail(preset: string, scene: string, trail: string): void {
  fs.mkdirSync('test-results', {recursive: true});
  fs.writeFileSync(`test-results/expedition-mechs-${scene}-${preset}.txt`, trail);
}

type Answer = {type: string, index?: number, cards?: Array<string>, for?: {role: string, source?: {card?: string}}};
const answersOf = (post: string): Array<Answer> => (JSON.parse(post) as {responses?: Array<Answer>}).responses ?? [];

/** Open the hand workspace and descend into `card`'s play composer. */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1400);
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `the hand focused «${card}»`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(PLAY_COMPOSER).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(PLAY_COMPOSER), 'the play composer stands').toHaveCount(1);
  await settle(page);
}

/** Walk the cursor to the composer's commit row and press A until ONE request left. */
async function commit(page: Page, root: string, seen: {posts: Array<string>}): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${root} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  for (let attempt = 0; attempt < 4 && seen.posts.length === 0; attempt++) {
    await press(page, 'Enter', 400);
    await expect.poll(() => seen.posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(seen.posts.length, 'A sent exactly one request').toBe(1);
}

/** The focused «Действия карт» tile: its card and its printed variant («Вариант N», 0 when the card prints one). */
const focusedTile = (page: Page) => page.evaluate(() => {
  const tile = document.querySelector('.con-cardactions__tile--focused');
  const variant = (tile?.querySelector('.con-cardactions__tile-variant')?.textContent ?? '').replace(/\D+/g, '');
  return {card: tile?.getAttribute('data-action-card') ?? '', variant: variant === '' ? 0 : Number(variant)};
});

/** «Действия карт» → the card's tile of printed variant `variant` (1-based; 0 = the card's only tile) → its composer. */
async function openVariant(page: Page, card: string, variant: number): Promise<void> {
  await openCardActions(page);
  const at = async () => {
    const f = await focusedTile(page);
    return f.card === card && f.variant === variant;
  };
  // The grid is TWO-dimensional (a table of seven mech holders is three rows): a snake — sideways to the wall (the
  // shared primitive turns at it), one row down, and back up once the bottom is reached.
  let vertical: 'ArrowDown' | 'ArrowUp' = 'ArrowDown';
  for (let row = 0; row < 8 && !(await at()); row++) {
    if (await walkFocusUntil(page, at, async () => JSON.stringify(await focusedTile(page)), 8)) {
      break;
    }
    const was = JSON.stringify(await focusedTile(page));
    await press(page, vertical, 260);
    if (JSON.stringify(await focusedTile(page)) === was) {
      vertical = vertical === 'ArrowDown' ? 'ArrowUp' : 'ArrowDown';
      await press(page, vertical, 260);
    }
  }
  expect(await at(), `never focused «${card}» · variant ${variant} (at ${JSON.stringify(await focusedTile(page))})`).toBe(true);
  await openActionFocus(page);
  await settle(page);
  await expect(page.locator(ACTION_COMPOSER), 'the composer stands').toBeVisible();
}

const focusedRow = (page: Page) => text(page, `${ACTION_COMPOSER} .con-composer__row--focused`);

/**
 * Walk the composer's cursor until `ok` holds: ↑ / ↓ over the rows, and → inside a SIDE-BY-SIDE variant group
 * (`data-variant-axis="row"` — the tiles switch with ←→ there, the group moves the way it looks).
 */
async function walkComposer(page: Page, ok: () => Promise<boolean>, label: string): Promise<void> {
  const inRowGroup = () => page.evaluate(() => document.querySelector('.con-composer__branches[data-variant-axis="row"] .con-vchoice__opt--focused') !== null);
  for (const key of ['ArrowUp', 'ArrowDown']) {
    for (let i = 0; i < 8; i++) {
      if (await ok()) {
        return;
      }
      if (await inRowGroup()) {
        for (let j = 0; j < 4 && !(await ok()); j++) {
          await press(page, 'ArrowRight', 220);
        }
        if (await ok()) {
          return;
        }
      }
      await press(page, key, 220);
    }
  }
  expect(await ok(), `the composer's cursor never reached ${label} (at «${await focusedRow(page)}»)`).toBe(true);
}

/** The played-target step's focused candidate: 'self' for the «Эта карта» proxy, else the card's name. */
const focusedCandidate = (page: Page) => page.evaluate(() => {
  const cell = document.querySelector('.con-ptsel__cell[data-focused="1"]');
  if (cell === null) {
    return '';
  }
  return cell.querySelector('[data-ptsel-self]') !== null ? 'self' : (cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');
});

/** The rail's reading of the focused candidate, every outcome chip with its state (К-T1). */
async function railReading(page: Page): Promise<{text: string, outcomes: Array<string>}> {
  return page.evaluate(() => {
    const rail = document.querySelector('.con-ptsel__rail');
    // TR56 (П4): the digits the tag under the focused card prints (its count, its VP) are the TAG's — read with the rail.
    const tag = document.querySelector('.con-ptsel__cell[data-focused="1"] .con-ptsel__tag');
    return {
      text: `${rail?.textContent ?? ''} | ${tag?.textContent ?? ''}`.replace(/\s+/g, ' ').trim(),
      outcomes: Array.from(rail?.querySelectorAll('[data-impact-outcome]') ?? []).map((el) => el.getAttribute('data-impact-outcome') ?? ''),
    };
  });
}

/** Every candidate cell's own text — what the player reads WITHOUT moving the cursor (PL-219). */
async function cellTexts(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const cell of Array.from(document.querySelectorAll('.con-ptsel__cell'))) {
      const name = cell.querySelector('[data-ptsel-self]') !== null ? 'self' : (cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '?');
      out[name] = (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
    }
    return out;
  });
}

/**
 * THE BEAT PROBE — a task clock (never rAF): what moves on screen, as a signature of every flight body's box, the
 * workspace's presence and the dock's count. A run of equal signatures is a stretch where NOTHING moved (`deadGaps`).
 */
async function armBeatProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    type S = {t: number, sig: string, ws: number, carried: number, reveal: number, deal: number, cap: string, hand: string};
    const samples: Array<S> = [];
    (window as unknown as {__beat: Array<S>}).__beat = samples;
    const t0 = performance.now();
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      const o = getComputedStyle(el).opacity;
      return `${Math.round(r.left / 4)},${Math.round(r.top / 4)},${Math.round(r.width / 4)},${o.slice(0, 4)}`;
    };
    const FLIGHT = '.con-transfer > *, .con-handdelivery-layer > *, .con-deal-proxy, .con-card3d-outer, .con-deckdraw *, .con-ws, .con-reveal, .con-recv';
    window.setInterval(() => {
      const flying = Array.from(document.querySelectorAll(FLIGHT)).slice(0, 60).map(box).join('|');
      samples.push({
        t: Math.round(performance.now() - t0),
        sig: flying,
        ws: document.querySelectorAll('.con-ws').length,
        carried: document.querySelectorAll('.con-handdelivery-layer > *').length,
        reveal: document.querySelectorAll('.con-reveal').length,
        deal: document.querySelectorAll('.con-deal-proxy, .con-deckdraw').length,
        cap: (document.querySelector(`${'.con-cardactions__stagewrap .con-composer--stage'} .pcard__res-count`)?.textContent ?? '').trim(),
        hand: document.querySelector('[data-hand-total]')?.getAttribute('data-hand-total') ?? '',
      });
    }, 25);
  });
}
type Beat = {t: number, sig: string, ws: number, carried: number, reveal: number, deal: number, cap: string, hand: string};
const readBeat = (page: Page) => page.evaluate(() => (window as unknown as {__beat?: Array<Beat>}).__beat ?? []);

/** The stretches (≥ `min` ms) where no flight body moved, the workspace stood and nothing changed — the dead time. */
function deadGaps(samples: ReadonlyArray<Beat>, min: number): Array<{from: number, to: number, ms: number}> {
  const out: Array<{from: number, to: number, ms: number}> = [];
  let start = 0;
  for (let i = 1; i <= samples.length; i++) {
    if (i === samples.length || samples[i].sig !== samples[start].sig) {
      const ms = samples[i - 1].t - samples[start].t;
      if (ms >= min && samples[start].ws > 0) {
        out.push({from: samples[start].t, to: samples[i - 1].t, ms});
      }
      start = i;
    }
  }
  return out;
}

/** The satellite's mech chips, read off their own DOM: the key, the count, the coin or the role badge and its context. */
async function mechChips(page: Page): Promise<Array<{key: string, value: string, coin: string, role: string, ctx: string, aria: string}>> {
  return page.evaluate(() => Array.from(document.querySelectorAll('[data-aux-resource^="mech"]')).map((el) => ({
    key: el.getAttribute('data-aux-resource') ?? '',
    value: (el.querySelector('.con-res-aux__value')?.textContent ?? '').trim(),
    coin: (el.querySelector('[data-mc-badge]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    role: el.querySelector('[data-role-badge]')?.getAttribute('data-role-badge') ?? '',
    ctx: el.querySelector('[data-context-tag]')?.getAttribute('data-context-tag') ?? '',
    aria: el.querySelector('[data-mc-badge], [data-role-badge]')?.getAttribute('aria-label') ?? '',
  })));
}

for (const preset of PRESETS) {
  test.describe(`TR50 Expedition Mechs · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(A) the play: four lanes on one panel — data, steel, the Construction mech, M€ — an exact mix, ONE POST, the data's token off its pay row (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'expedition-mechs', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect([before.thisPlayer.megacredits, before.thisPlayer.steel, resourcesOf(before, 'Construction Mechs'), resourcesOf(before, 'Supercomputer')],
        'the fixture: 2 M€ · 1 steel · TR17 1 mech · TR48 1 data').toEqual([2, 1, 1, 1]);
      await openPlayComposer(page, CARD);
      const units = await page.evaluate((root) => Array.from(document.querySelectorAll(`${root} .con-payrow[data-pay-unit]`))
        .map((el) => el.getAttribute('data-pay-unit') ?? ''), PLAY_COMPOSER);
      expect(units.filter((u) => u !== 'megacredits'), 'the panel lists the data first, steel, the Construction mech (the owner\'s order)').toEqual(['supercomputerData', 'steel', 'constructionMechs']);
      expect(units, 'the M€ lane stands').toContain('megacredits');
      const used = async (unit: string) => (await text(page, `${PLAY_COMPOSER} .con-payrow[data-pay-unit="${unit}"] .con-payrow__used`)).trim();
      expect([await used('supercomputerData'), await used('steel'), await used('constructionMechs'), await used('megacredits')],
        'the opening mix: data 1 + steel 1 + M€ 1 — the 5-M€ mech stays home (no overpay)').toEqual(['1', '1', '0', '1']);
      await expect(page.locator(`${PLAY_COMPOSER} .con-paystatus`), 'exact').toHaveClass(/con-paystatus--exact/);
      const labels = await page.evaluate((root) => Array.from(document.querySelectorAll(`${root} .con-payrow[data-pay-unit] .con-payrow__name`))
        .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()), PLAY_COMPOSER);
      console.log(`[${preset.id} a lanes] ${JSON.stringify(units)} ${JSON.stringify(labels)}`);
      // К-P1 (the owner's decision 2026-10-12): a card-bound lane names the card its units leave; the steel lane does not.
      const sources = await page.evaluate((root) => Array.from(document.querySelectorAll(`${root} .con-payrow[data-pay-unit]`))
        .map((el) => [el.getAttribute('data-pay-unit') ?? '', (el.querySelector('[data-pay-source]')?.textContent ?? '').replace(/s+/g, ' ').trim()]), PLAY_COMPOSER);
      expect(sources, 'whose units each lane spends').toEqual([
        ['supercomputerData', '· Суперкомпьютер'], ['steel', ''], ['constructionMechs', '· Строительные мехи'], ['megacredits', ''],
      ]);
      await shoot(page, preset.id, 'a-01-payment');
      await armTransferWitness(page);
      const stop = await storyboard(page, preset.id, 'play');
      await commit(page, PLAY_COMPOSER, seen);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), CARD), {timeout: 30_000, message: 'TR50 on the table with its mech'}).toBe(1);
      const after = await wireOf(request, playerId);
      expect([after.thisPlayer.megacredits, after.thisPlayer.steel, resourcesOf(after, 'Supercomputer'), resourcesOf(after, 'Construction Mechs')],
        'the server paid data 1 + steel 1 + M€ 1, the mech untouched').toEqual([1, 0, 0, 1]);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      await stop();
      const witness = await transferWitness(page);
      writeTrail(preset.id, 'a', transferTrail(witness));
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      const minus = witness.births.filter((e) => e.under === 'payrow:supercomputerData');
      expect(minus.length, `the data price token was born on its pay row (PL-163)\n${transferTrail(witness)}`).toBeGreaterThan(0);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      expect(seen.overflow, `no [console-overflow] — ${seen.overflow.join(' | ')}`).toEqual([]);
      await shoot(page, preset.id, 'a-02-board');
    });

    test(`(B) the action, B: two tiles of one card; the mech leaves the hero's capsule, a card comes off the deck into the hand; used for the generation (${preset.id})`, async ({page, request}) => {
      test.setTimeout(360_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'expedition-mechs-action', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect([resourcesOf(before, CARD), before.thisPlayer.energy], 'the fixture: 1 mech · 1 energy').toEqual([1, 1]);
      const handBefore = before.cardsInHand?.length ?? 0;

      await openCardActions(page);
      await expect(page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`), 'TWO tiles of one card — one per printed variant').toHaveCount(2);
      await expect(page.locator(`.con-cardactions__tile[data-action-card="${CARD}"].con-cardactions__tile--available`), 'both live').toHaveCount(2);
      await shoot(page, preset.id, 'b-01-tiles');
      await press(page, 'Escape', 700);
      await openVariant(page, CARD, 2);
      const cost = page.locator(`${ACTION_COMPOSER} .action-effect-chip--cost`);
      await expect(cost.first(), 'the mech leaves THIS card: 1 → 0').toContainText(/1\s*→\s*0/);
      await expect(page.locator(`${ACTION_COMPOSER} .action-effect-chip--gain`).first(), 'one card').toContainText(/1/);
      await shoot(page, preset.id, 'b-02-composer');
      await armTransferWitness(page);
      await armBeatProbe(page);
      const stop = await storyboard(page, preset.id, 'b');
      await commit(page, ACTION_COMPOSER, seen);
      const pressedAt = (await readBeat(page)).slice(-1)[0]?.t ?? 0;
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), CARD), {timeout: 30_000, message: 'the mech left'}).toBe(0);
      // The server keeps the card at once (a plain draw); the workspace shows it on its stage — «Получена карта» — and A
      // takes it into the dock.
      await expect.poll(async () => (await wireOf(request, playerId)).cardsInHand?.length ?? 0, {timeout: 30_000, message: 'one card into the hand'}).toBe(handBefore + 1);
      await expect(page.locator('.con-reveal'), 'the drawn card stands on the workspace\'s stage').toHaveCount(1, {timeout: 20_000});
      const stageHead = await text(page, '.con-reveal');
      console.log(`[${preset.id} b stage] ${stageHead.slice(0, 160)}`);
      await shoot(page, preset.id, 'b-03-drawn');
      const takenAt = (await readBeat(page)).slice(-1)[0]?.t ?? 0;
      for (let i = 0; i < 4 && await page.locator('.con-reveal').count() > 0; i++) {
        await press(page, 'Enter', 700);
      }
      await expect(page.locator('.con-ws'), 'the workspace left').toHaveCount(0, {timeout: 40_000});
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      await stop();
      const beat = await readBeat(page);
      const post = beat.filter((s) => s.t >= pressedAt);
      // The stage at REST before the take is the player's own read («Получена карта», A waits) — not dead time:
      // a stretch that runs into the take press is dropped.
      const gaps = deadGaps(post.filter((s) => s.t < takenAt), 300).filter((g) => g.to < takenAt - 150);
      const afterTake = deadGaps(beat.filter((s) => s.t >= takenAt), 300);
      writeTrail(preset.id, 'b-beat', beat.map((s) => `${s.t} ws=${s.ws} carried=${s.carried} reveal=${s.reveal} deal=${s.deal} cap=${s.cap} hand=${s.hand}`).join('\n'));
      console.log(`[${preset.id} b] dead gaps ≥ 300 ms — press → stage: ${JSON.stringify(gaps)} · take → board: ${JSON.stringify(afterTake)}`);
      expect(beat.length, 'the beat probe sampled').toBeGreaterThan(10);
      // «Nothing on screen moves» for 0.3 s while the workspace stands = a hole in the phrase. A TIMING claim, so it is
      // taken on the GPU (PL-211, both profiles); a SwiftShader run under parallel load starves its own compositor (fhd
      // measured one 315 ms stretch in 4 under two workers) and is only logged.
      if (process.env.TM_E2E_GPU === '1') {
        expect([...gaps, ...afterTake], 'no dead pause ≥ 0.3 s from the press to the board').toEqual([]);
      }
      const witness = await transferWitness(page);
      writeTrail(preset.id, 'b', transferTrail(witness));
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      // PL-201: the mech LEAVES the hero's capsule as a token — never a bare 1 → 0 tick.
      expect(witness.births.some((b) => b.under === 'hero'), `the mech's token was born on the hero\n${transferTrail(witness)}`).toBe(true);
      expect(answersOf(seen.posts[0]).slice(1).map((r) => r.type === 'or' ? `or:${r.index}` : r.type), 'the activation, then variant B').toEqual(['or:1']);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      expect(seen.overflow, `no [console-overflow] — ${seen.overflow.join(' | ')}`).toEqual([]);
      await shoot(page, preset.id, 'b-05-board');

      // Once per generation: the grid opens on «Не активированы» and the card's two tiles are counted under «Активированы».
      await openCardActions(page);
      await expect(page.locator(`.con-cardactions__tile[data-action-card="${CARD}"]`), 'the used card left the default view').toHaveCount(0);
      await expect(page.locator('.con-cardactions').getByText(/Активированы\s*2/), 'its two tiles are counted as activated').toHaveCount(1);
      await shoot(page, preset.id, 'b-06-used');
    });

    test(`(A') the action, A: the energy leaves the rail, the mech lands in the hero's capsule (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'expedition-mechs-action', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      await openVariant(page, CARD, 1);
      await armTransferWitness(page);
      const stop = await storyboard(page, preset.id, 'a-variant');
      await commit(page, ACTION_COMPOSER, seen);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), CARD), {timeout: 30_000, message: 'the mech arrived'}).toBe(2);
      expect((await wireOf(request, playerId)).thisPlayer.energy, 'the energy was spent').toBe(0);
      await expect(page.locator('.con-ws'), 'the workspace left').toHaveCount(0, {timeout: 40_000});
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      await stop();
      const witness = await transferWitness(page);
      writeTrail(preset.id, 'a-variant', transferTrail(witness));
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      expect(witness.landings.some((l) => l.under === 'hero'), `the mech landed in the hero's capsule (PL-063)\n${transferTrail(witness)}`).toBe(true);
      expect(answersOf(seen.posts[0]).slice(1).map((r) => r.type === 'or' ? `or:${r.index}` : r.type), 'the activation, then variant A').toEqual(['or:0']);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
    });

    test(`(C) the family: the satellite's mech chips by role; TR29's «a mech on ANY card» over seven candidates; TR50 picked → ONE POST, the mech on its miniature (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'expedition-mechs-family', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect(FAMILY.map((c) => resourcesOf(before, c)), 'the fixture: EVA 2 · TR17 1 · Sports 3 · Army 1 · Convoys 1 · Forestry 2 · TR50 1').toEqual([2, 1, 3, 1, 1, 2, 1]);

      // ── The satellite: the mech chips, read off their own DOM. ──
      const chips = await mechChips(page);
      console.log(`[${preset.id} c satellite] ${JSON.stringify(chips, null, 1)}`);
      expect(chips.reduce((sum, c) => sum + Number(c.value), 0), 'every mech on the table is on the satellite').toBe(11);
      expect(chips.filter((c) => c.coin !== '').length, 'two tender pools — EVA\'s Space, TR17\'s Building').toBe(2);
      expect(chips.some((c) => c.role === 'vp'), 'Mech Sports\' VP').toBe(true);
      expect(chips.some((c) => c.role === 'delegate'), 'TR34\'s delegate').toBe(true);
      expect(chips.some((c) => c.role === 'trade'), 'TR66\'s trade').toBe(true);
      // PL-223: two action GOODS are two chips — Forestry's plant production never speaks for TR50's card.
      expect(chips.filter((c) => c.role === 'action').map((c) => [c.key, c.value]), 'the action chips, one per good')
        .toEqual([['mech:action:production-plants', '2'], ['mech:action:cards', '1']]);
      await shoot(page, preset.id, 'c-01-satellite');

      // ── TR29: the fighter from itself, variant B, the target step over seven holders. ──
      await openVariant(page, RECYCLING, 0);
      await walkComposer(page, async () => /Выберите карту-источник/.test(await focusedRow(page)), 'the source row');
      await press(page, 'Enter', 500);
      await expect(page.locator('.con-ptsel'), 'the source step').toBeVisible();
      await press(page, 'Enter', 500);
      await expect(page.locator('.con-ptsel'), 'the source answered').toHaveCount(0);
      const branchAt = () => page.evaluate(() => Number(document.querySelector('.con-composer__branches .con-vchoice__opt--focused')?.getAttribute('data-branch-pos') ?? -1));
      await walkComposer(page, async () => (await branchAt()) === 1, 'variant B');
      await press(page, 'Enter', 400);
      await walkComposer(page, async () => /Куда/.test(await focusedRow(page)), 'the target row');
      await press(page, 'Enter', 600);
      await expect(page.locator('.con-ptsel'), 'the target step opened').toBeVisible();
      await expect(page.locator('.con-ptsel__cell'), 'seven mech holders').toHaveCount(7);
      // PL-224: every candidate stands WHOLE inside every box that clips it (4K solved seven cards into one row 39 px
      // wider than the room and the composer's scroller cut the seventh — TR50 itself — with its focus ring).
      const clipped = await page.evaluate(() => Array.from(document.querySelectorAll('.con-ptsel__cell')).flatMap((cell) => {
        const c = cell.getBoundingClientRect();
        const out: Array<string> = [];
        // Up to the workspace's own root — above it the shell's containers hold the band as fixed, not as flow.
        for (let el = cell.parentElement; el !== null && !el.classList.contains('con-ws'); el = el.parentElement) {
          const cs = getComputedStyle(el);
          if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
            const b = el.getBoundingClientRect();
            if (c.left < b.left - 1 || c.right > b.right + 1 || c.top < b.top - 1 || c.bottom > b.bottom + 1) {
              out.push(`${cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? 'self'} [${Math.round(c.left)}–${Math.round(c.right)}] ⊄ ${el.className.toString().slice(0, 40)} [${Math.round(b.left)}–${Math.round(b.right)}]`);
            }
          }
        }
        return out;
      }));
      expect(clipped, 'every candidate stands whole inside the boxes that clip it').toEqual([]);
      // PL-219: EVERY candidate wears its outcome tag — read without moving the cursor.
      const tags = await page.evaluate(() => Array.from(document.querySelectorAll('.con-ptsel__cell')).map((cell) => {
        const name = cell.querySelector('[data-ptsel-self]') !== null ? 'self' : (cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '?');
        const tag = cell.querySelector('[data-ptsel-tag]');
        return [name, tag?.getAttribute('data-ptsel-tag') ?? 'missing', (tag?.textContent ?? '').replace(/s+/g, ' ').trim()];
      }));
      console.log(`[${preset.id} c tags] ${JSON.stringify(tags)}`);
      expect(tags.filter((t) => t[1] === 'missing' || t[1] === 'none'), 'every candidate wears a tag').toEqual([]);
      const tagText = (card: string) => tags.find((t) => t[0] === card)?.[2] ?? '';
      // TR56 (П4): every tag LEADS with the count the mech makes, its consequence after it (under it, in the step — a
      // tag that says two things stacks on two lines, `data-tag-lines="2"`).
      expect([tagText('EVA Mechs'), tagText('Construction Mechs')].every((t) => /→.*\+5$/.test(t)), 'tender: the count, then +5 each').toBe(true);
      await expect(page.locator('.con-ptsel'), 'the step reserves two tag lines').toHaveAttribute('data-tag-lines', '2');
      // Nothing of any tag is cut: its line fits the cell it stands under (seven at 4K cut «2 → 3 · [M€] +5» to «+:»).
      const cut = await page.evaluate(() => Array.from(document.querySelectorAll('.con-ptsel__cell .con-ptsel__tag')).flatMap((tag) => {
        const box = tag.getBoundingClientRect();
        const line = tag.querySelector('.con-ptsel__tag-line');
        if (line === null) {
          return [];
        }
        const r = line.getBoundingClientRect();
        return r.left < box.left - 1 || r.right > box.right + 1 || r.bottom > box.bottom + 1 || (tag as HTMLElement).scrollWidth > (tag as HTMLElement).clientWidth + 1 ?
          [`${(tag.textContent ?? '').replace(/\s+/g, ' ').trim()} [${Math.round(r.width)}×${Math.round(r.height)} in ${Math.round(box.width)}×${Math.round(box.height)}]`] : [];
      }));
      expect(cut, 'every tag stands whole inside its row').toEqual([]);
      expect(tagText('Mech Sports'), 'Mech Sports: its VP').toMatch(/ПО\s*3\s*→\s*4/);
      expect(tags.filter((t) => t[1] === 'already').map((t) => t[0]).sort(), 'already within reach: a quiet ✓')
        .toEqual(['Automated Convoys', 'Expedition Mechs', 'Forestry Mechs', 'Mars Army Mechs'].sort());
      const resting = await cellTexts(page);
      console.log(`[${preset.id} c cells at rest] ${JSON.stringify(resting, null, 1)}`);
      await shoot(page, preset.id, 'c-02-target');
      const readings: Record<string, {text: string, outcomes: Array<string>}> = {};
      // The candidates stand in a grid (4 + 3 at fhd): a snake — across, down, back, up — reads every cell.
      const snake = ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft',
        'ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowRight'];
      for (const key of ['', ...snake]) {
        if (key !== '') {
          await press(page, key, 220);
        }
        const name = await focusedCandidate(page);
        if (name !== '' && readings[name] === undefined) {
          readings[name] = await railReading(page);
        }
      }
      console.log(`[${preset.id} c readings] ${JSON.stringify(readings, null, 1)}`);
      expect(Object.keys(readings).sort(), 'every candidate was read').toEqual([...FAMILY].sort());
      expect(Object.values(readings).every((r) => !/\$\{/.test(r.text)), 'no raw template on the rail').toBe(true);
      for (const key of ['ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft']) {
        if (await focusedCandidate(page) === CARD) {
          break;
        }
        await press(page, key, 220);
      }
      expect(await focusedCandidate(page)).toBe(CARD);
      await shoot(page, preset.id, 'c-03-target-tr50');
      await press(page, 'Enter', 500);
      await expect(page.locator('.con-ptsel'), 'the step answered and closed').toHaveCount(0);

      await armTransferWitness(page);
      const stop = await storyboard(page, preset.id, 'family');
      await commit(page, ACTION_COMPOSER, seen);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), CARD), {timeout: 30_000, message: 'TR50 2 mechs'}).toBe(2);
      const after = await wireOf(request, playerId);
      expect(resourcesOf(after, RECYCLING), 'the fighter left TR29').toBe(0);
      await expect(page.locator('.con-ws'), 'the workspace left').toHaveCount(0, {timeout: 40_000});
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      await stop();
      const batch = answersOf(seen.posts[0]).slice(1);
      expect(batch.map((r) => r.cards?.[0] ?? `or:${r.index}`), 'source TR29, variant B, target TR50').toEqual([RECYCLING, 'or:1', CARD]);
      const witness = await transferWitness(page);
      writeTrail(preset.id, 'c', transferTrail(witness));
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      expect(witness.landings.some((l) => l.under === `composer-card:${CARD}`), `the mech landed on TR50's miniature in the composer\n${transferTrail(witness)}`).toBe(true);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      expect(seen.overflow, `no [console-overflow] — ${seen.overflow.join(' | ')}`).toEqual([]);
      await shoot(page, preset.id, 'c-04-board');
    });
  });
}
