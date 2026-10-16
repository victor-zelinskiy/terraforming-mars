import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, crumbText, fetchPlayerModel, focusCard, press, pressUntil, settle, waitForBoardHome} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {storyboard} from './consoleEndgameHarness';

/**
 * TR56 «ФАБРИКА РОБОТОВ» and the iteration «КУДА ЛЯЖЕТ» (docs/TURMOIL_REDUX_ROBOTICS_FACTORY.md): «put N on ANY card» is
 * ONE question on two levels — WHAT and WHERE — and every level now names the payload and its addresses. Against a
 * real server, fhd and tv4k:
 *
 *   (A) `robotics-factory` — three tiles in ONE row, each with ITS holders' faces (the server's candidates of its own
 *       pick — CM · SF · Dirigibles + Aerial Mappers) and no sentence or «+N на карту» chip repeating the print; the
 *       floaters → the target row «КУДА: 6 [аэростат]» with the candidates' strip → the step: «КУДА: [печать]» in its
 *       contract, «› ЦЕЛЬ» in the crumb, the group centred, every tag led by the count; Dirigibles answered; the change
 *       to «мехи» lets the answer go by a phrase (the strip of the NEW kind, nothing of the old in the batch, the column
 *       top still); the mechs step: the lone candidate a protagonist; Construction Mechs → ONE addressed POST; the
 *       witness: the «+3» born on the landed card's PRINTED mech icon, every end visible; the server: CM 2 − paid + 3.
 *   (B) `robotics-factory-one` — the mech / fighter tiles greyed WITH their reason, the floaters tile chosen for the
 *       player and naming its one holder; the target still SHOWN; one POST with the bare target.
 *   (C) `robotics-factory-none` — three tiles greyed, three skips named; the card still plays.
 *   (D) `robotics-factory-mechpay` — the mechs pay for the Building tag: the price leaves the pay row BEFORE the «+3»
 *       is born; CM 3 − paid + 3.
 *   (E) `robotics-factory-locked` — the Reds rule: «✕», the Industrialists' count.
 *
 * Heavy 4K: `--workers=1`; timing claims on the GPU (`TM_E2E_GPU=1`); storyboard with `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Robotics Factory';
const CARD_RU = 'Фабрика роботов';
const CM = 'Construction Mechs';
const SF = 'Security Fleet';
const DIR = 'Dirigibles';
const MAP = 'Aerial Mappers';
const OUT = path.resolve('screenshots', 'tr56');
const PLAY = '.con-composer--play';

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {thisPlayer: {megaCredits: number, tableau: Array<{name: string, resources?: number}>}};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

const resourcesOf = (wire: Wire, card: string) => wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

function watchPage(page: Page): {posts: Array<string>, errors: Array<string>} {
  const out = {posts: [] as Array<string>, errors: [] as Array<string>};
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      out.posts.push(r.postData() ?? '');
    }
  });
  page.on('pageerror', (e) => out.errors.push(e.message));
  return out;
}

async function openPlay(page: Page): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 12_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, CARD, slots * 2 + 6), `never focused «${CARD}» in the hand`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(PLAY).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(PLAY), 'the play composer stands').toHaveCount(1);
  await settle(page);
}

type Tile = {focused: boolean, selected: boolean, off: boolean, top: number, title: string, chips: number, dest: Array<string>, destCount: string, label: string, reason: string};

async function tiles(page: Page): Promise<Array<Tile>> {
  return page.locator(`${PLAY} .con-composer__variants .con-vchoice__opt`).evaluateAll((els) => els.map((el) => ({
    focused: el.classList.contains('con-vchoice__opt--focused'),
    selected: el.classList.contains('con-vchoice__opt--selected'),
    off: el.classList.contains('con-vchoice__opt--off'),
    // The LAYOUT row (the cursor's lift is a transform — the grammar measures the axis off `offsetTop` too).
    top: (el as HTMLElement).offsetTop,
    title: (el.querySelector('.con-vchoice__title')?.textContent ?? '').trim(),
    chips: el.querySelectorAll('.action-effect-chip').length,
    dest: Array.from(el.querySelectorAll('[data-vchoice-dest-card]')).map((d) => d.getAttribute('data-vchoice-dest-card') ?? ''),
    destCount: el.querySelector('[data-vchoice-dest]')?.getAttribute('data-vchoice-dest-count') ?? '',
    label: (el.querySelector('[data-vchoice-dest-label]')?.textContent ?? '').trim(),
    reason: (el.querySelector('.con-vchoice__reason')?.textContent ?? '').trim(),
  })));
}

/** A on the tile at `index` — the cursor walks the row (←→) and the press SEALS it. */
async function chooseTile(page: Page, index: number): Promise<void> {
  for (let i = 0; i < 6 && (await tiles(page)).findIndex((t) => t.focused) < 0; i++) {
    await press(page, 'ArrowUp', 350);
  }
  for (let i = 0; i < 6; i++) {
    const at = (await tiles(page)).findIndex((t) => t.focused);
    if (at === index) {
      break;
    }
    await press(page, at < index ? 'ArrowRight' : 'ArrowLeft', 350);
  }
  await pressUntil(page, 'Enter', async () => (await tiles(page))[index]?.selected === true, {tries: 3, settleMs: 700});
  expect((await tiles(page))[index].selected, `tile ${index} chosen`).toBe(true);
}

/** The target row — its state, payload and strip / answer. */
async function targetRow(page: Page): Promise<{state: string, payload: string, strip: Array<string>, answered: Array<string>, top: number, height: number}> {
  return page.locator(`${PLAY} [data-composer-target-row]`).evaluate((row) => ({
    state: row.getAttribute('data-tgtrow-state') ?? '',
    payload: row.querySelector('[data-tgtrow-payload]')?.getAttribute('data-tgtrow-payload-icon') ?? '',
    strip: Array.from(row.querySelectorAll('[data-tgtrow-strip] [data-tgtrow-card]')).map((c) => c.getAttribute('data-tgtrow-card') ?? ''),
    answered: Array.from(row.querySelectorAll('[data-composer-card]')).map((c) => c.getAttribute('data-composer-card') ?? ''),
    top: Math.round(row.getBoundingClientRect().top),
    height: Math.round(row.getBoundingClientRect().height),
  }));
}

async function openStep(page: Page): Promise<void> {
  const step = page.locator('.con-ptsel');
  for (let i = 0; i < 5 && await step.count() === 0; i++) {
    if (await page.locator(`${PLAY} .con-composer__cta--focused`).count() > 0) {
      await press(page, 'ArrowUp', 700);
    }
    if (await page.locator(`${PLAY} .con-vchoice__opt--focused`).count() > 0) {
      await press(page, 'ArrowDown', 700);
    }
    await press(page, 'Enter', 1300);
  }
  await expect(step, 'the embedded played-target step opens').toHaveCount(1, {timeout: 10_000});
  await settle(page);
}

/** The step's composition: the payload in its contract, the cards' row against its zone, the tags. */
async function stepGeometry(page: Page): Promise<{payload: string, offset: number, zoneW: number, cardH: number, bandH: number, cards: Array<string>, tags: Array<{lead: boolean, text: string}>}> {
  return page.evaluate(() => {
    const zone = document.querySelector('.con-ptsel__zone')!.getBoundingClientRect();
    const slots = Array.from(document.querySelectorAll('.con-ptsel__slot'));
    const rects = slots.map((s) => s.getBoundingClientRect());
    const band = document.querySelector('.con-composer__playmain')!.getBoundingClientRect();
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    return {
      payload: document.querySelector('.con-ptsel [data-ptsel-payload]')?.getAttribute('data-ptsel-payload-icon') ?? '',
      offset: Math.round((left + right) / 2 - (zone.left + zone.width / 2)),
      zoneW: Math.round(zone.width),
      cardH: Math.round(rects[0]?.height ?? 0),
      bandH: Math.round(band.height),
      cards: slots.map((s) => s.getAttribute('data-zoom-slot') ?? ''),
      tags: Array.from(document.querySelectorAll('.con-ptsel__tag')).map((t) => ({
        lead: t.querySelector('[data-ptsel-tag-lead]') !== null,
        text: (t.textContent ?? '').replace(/\s+/g, ' ').trim(),
      })),
    };
  });
}

async function focusStepCard(page: Page, card: string): Promise<void> {
  const at = () => page.evaluate(() => document.querySelector('.con-ptsel__cell[data-focused="1"] [data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');
  for (let i = 0; i < 6 && await at() !== card; i++) {
    await press(page, 'ArrowRight', 350);
  }
  expect(await at(), `the cursor reached ${card}`).toBe(card);
}

async function confirmTarget(page: Page): Promise<void> {
  const step = page.locator('.con-ptsel');
  for (let i = 0; i < 4 && await step.count() > 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await expect(step, 'A on the candidate answers the target').toHaveCount(0, {timeout: 8000});
  await settle(page);
}

async function commit(page: Page, posts: Array<string>): Promise<void> {
  for (let i = 0; i < 10 && await page.locator(`${PLAY} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 250);
  }
  for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 400);
    await expect.poll(() => posts.length, {timeout: 5000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts.length, 'A sent exactly one request').toBe(1);
}

type Answer = {type: string, index?: number, cards?: Array<string>, response?: {payment?: Record<string, number>}, for?: {role: string, source?: {card?: string}}};
const batchOf = (post: string) => (JSON.parse(post) as {responses?: Array<Answer>}).responses ?? [];
/** The mechs the play's payment spent (the head of the batch: the menu's «Play project card»). */
const mechsPaid = (batch: ReadonlyArray<Answer>) => batch[0]?.response?.payment?.constructionMechs ?? 0;

for (const preset of PRESETS) {
  test.describe(`TR56 Robotics Factory · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(A) three tiles with their ADDRESSES; the floaters' row and step; a change of variant; Construction Mechs — ONE POST, the «+3» born on the printed mech (${preset.id})`, async ({page, request}) => {
      test.setTimeout(400_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'robotics-factory', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect([resourcesOf(before, CM), resourcesOf(before, SF), resourcesOf(before, DIR)], 'the fixture: CM 2 mechs, SF 1 fighter, Dirigibles 0').toEqual([2, 1, 0]);

      // ── П1: three tiles in ONE row, each naming ITS holders — no sentence, no «+N на карту» chip repeating the print.
      await openPlay(page);
      const opened = await tiles(page);
      expect(opened.length, 'three variants').toBe(3);
      expect(new Set(opened.map((t) => t.top)).size, `ONE row: ${JSON.stringify(opened.map((t) => t.top))}`).toBe(1);
      expect(opened.map((t) => t.dest), 'each tile\'s addresses are the server\'s holders of ITS kind').toEqual([[CM], [SF], [DIR, MAP]]);
      expect(opened.map((t) => t.destCount)).toEqual(['1', '1', '2']);
      expect(opened[0].label, 'one holder names itself').toMatch(/Строительные мехи/i);
      expect(opened[2].label, 'several are a count').toMatch(/2/);
      expect(opened.every((t) => t.title === ''), 'the print speaks — no sentence under it').toBe(true);
      expect(opened.every((t) => t.chips === 0), 'no «+N на карту» chip repeating the print').toBe(true);
      await expect(page.locator(`${PLAY} .con-composer__variants`)).toHaveAttribute('data-variant-axis', 'row');
      await shoot(page, preset.id, 'a-01-composer');

      // ── П2: the floaters → the target row asks WHERE with the payload's own print, the candidates as a strip.
      await chooseTile(page, 2);
      await settle(page);
      const open = await targetRow(page);
      expect(open, 'the unanswered row: «КУДА: 6 [аэростат]» and the two holders\' faces').toMatchObject({state: 'open', payload: 'floater', strip: [DIR, MAP]});
      await expect(page.locator(`${PLAY} [data-composer-target-row]`), 'never «эту карту», never a second «выберите»').not.toContainText(/эту карту|Выберите карту-получатель/i);
      await expect(page.locator(`${PLAY} .con-composer__cta`), 'the ask stands in ONE place — the commit rail').toContainText('Выберите карту-получатель');
      await shoot(page, preset.id, 'a-02-floaters-row');

      // ── П3 / П4: the step names its payload, the crumb its stage; the group centred; the count leads every tag.
      await openStep(page);
      expect((await crumbText(page)).toLowerCase(), 'the crumb: the card, then «ЦЕЛЬ»').toMatch(new RegExp(`${CARD_RU.toLowerCase()}.*цель`));
      const floaters = await stepGeometry(page);
      expect(floaters.payload, '«КУДА: 6 [аэростат]» in the contract').toBe('floater');
      expect(floaters.cards.sort()).toEqual([DIR, MAP].sort());
      expect(Math.abs(floaters.offset), `the group stands in the middle of its zone ${JSON.stringify(floaters)}`).toBeLessThan(floaters.zoneW * 0.03);
      expect(floaters.tags.every((t) => t.lead && /0\s*→\s*6/.test(t.text)), `every tag leads with the count ${JSON.stringify(floaters.tags)}`).toBe(true);
      await expect(page.locator('.con-ptsel__contract-title'), 'the step never says «разыгранную»').not.toContainText(/разыгранн/i);
      await shoot(page, preset.id, 'a-03-step-floaters');
      await focusStepCard(page, DIR);
      await confirmTarget(page);
      const answered = await targetRow(page);
      expect(answered, 'answered: Dirigibles in the row, the question unchanged').toMatchObject({state: 'answered', payload: 'floater', answered: [DIR]});
      await expect(page.locator(`${PLAY} [data-composer-target-row] [data-ptsel-tag-lead]`), 'the step\'s tag read again beside the answer').toHaveCount(1);
      await shoot(page, preset.id, 'a-04-floaters-answered');

      // ── П5: the change of variant lets the answer go — the strip of the NEW kind, the column still.
      const colTop = async () => page.evaluate((sel) => Math.round(document.querySelector(sel)?.getBoundingClientRect().top ?? -1), `${PLAY} .con-composer__resulthero`);
      const top0 = await colTop();
      await chooseTile(page, 0);
      await settle(page);
      const reset = await targetRow(page);
      expect(reset, 'the row lets the old answer go and asks for a MECH holder').toMatchObject({state: 'open', payload: 'mech', strip: [CM], answered: []});
      expect(reset.height, 'the two states are one height').toBe(answered.height);
      expect(Math.abs((await colTop()) - top0), 'the column does not jump').toBeLessThanOrEqual(2);
      await shoot(page, preset.id, 'a-05-variant-changed');

      // ── the mechs: ONE candidate, the protagonist.
      await openStep(page);
      const mechs = await stepGeometry(page);
      expect(mechs.payload).toBe('mech');
      expect(mechs.cards).toEqual([CM]);
      expect(mechs.cardH / mechs.bandH, `the lone candidate stands a third of the zone or more ${JSON.stringify(mechs)}`).toBeGreaterThan(1 / 3);
      expect(Math.abs(mechs.offset)).toBeLessThan(mechs.zoneW * 0.03);
      await shoot(page, preset.id, 'a-06-step-mechs');
      await confirmTarget(page);
      expect(seen.posts, 'nothing sent before the play\'s own A').toEqual([]);

      // ── П6: ONE addressed POST; the «+3» born on the PRINTED mech of the landed card, landing on CM; ends visible.
      await armTransferWitness(page);
      const stop = await storyboard(page, path.join(OUT, preset.id), 'a-landing');
      await commit(page, seen.posts);
      const batch = batchOf(seen.posts[0]);
      const pick = batch.find((r) => r.type === 'or' && r.for !== undefined);
      const target = batch.find((r) => r.type === 'card');
      expect(pick, 'the mech branch is the answer, ADDRESSED to the card\'s choice').toMatchObject({index: 0, for: {role: 'or', source: {card: CARD}}});
      expect(target, 'the target is Construction Mechs, ADDRESSED — and nothing of the floaters').toMatchObject({cards: [CM], for: {role: 'card', source: {card: CARD}}});
      expect(batch.filter((r) => r.type === 'card'), 'ONE target answer').toHaveLength(1);
      const paid = mechsPaid(batch);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), CM), {timeout: 30_000, message: 'CM: 2 − paid + 3'}).toBe(2 - paid + 3);
      const after = await wireOf(request, playerId);
      expect([resourcesOf(after, DIR), resourcesOf(after, SF)], 'the other holders untouched').toEqual([0, 1]);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      await stop();
      const witness = await transferWitness(page);
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/robotics-factory-a-${preset.id}.txt`, transferTrail(witness));
      const gain = witness.births.find((b) => b.value === '+3');
      expect(gain?.under, `the «+3» is born on the printed mech of the landed card\n${transferTrail(witness)}`).toMatch(/^printed:mech/);
      expect(witness.landings.some((l) => l.value === '+3' && /Construction Mechs/.test(l.under)), `…and lands on Construction Mechs\n${transferTrail(witness)}`).toBe(true);
      if (paid > 0) {
        const price = witness.births.find((b) => b.under.startsWith('payrow:'));
        expect(price, `the mechs paid leave their pay row\n${transferTrail(witness)}`).toBeDefined();
        expect(price!.t, 'the price leaves BEFORE the gain is born').toBeLessThan(gain!.t);
      }
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
      await shoot(page, preset.id, 'a-07-board');
    });

    test(`(B) one kind: the mech and fighter tiles greyed WITH their reason, the floaters tile naming its holder — the target still SHOWN (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'robotics-factory-one', {query: preset.query});
      await settle(page);
      await openPlay(page);
      const opened = await tiles(page);
      expect(opened.map((t) => t.off), 'every variant stands — the unavailable ones shown, never hidden').toEqual([true, true, false]);
      expect(opened.slice(0, 2).every((t) => t.reason !== '' && t.dest.length === 0), 'a refused tile says why and has no address').toBe(true);
      expect(opened[2], 'the lone open tile: chosen for the player, its one holder named').toMatchObject({selected: true, dest: [DIR], destCount: '1'});
      await shoot(page, preset.id, 'b-01-composer');
      expect(await targetRow(page)).toMatchObject({state: 'open', payload: 'floater', strip: [DIR]});
      await openStep(page);
      expect((await stepGeometry(page)).cards, 'the lone holder is SHOWN — never applied silently').toEqual([DIR]);
      await confirmTarget(page);
      await commit(page, seen.posts);
      const batch = batchOf(seen.posts[0]);
      expect(batch.some((r) => r.type === 'or' && r.for !== undefined), 'no branch pick — the lone branch collapses').toBe(false);
      expect(batch.find((r) => r.type === 'card')).toMatchObject({cards: [DIR], for: {role: 'card', source: {card: CARD}}});
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), DIR), {timeout: 30_000}).toBe(6);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
    });

    test(`(C) no holder: three tiles greyed, three skips named — the card still plays (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'robotics-factory-none', {query: preset.query});
      await settle(page);
      await openPlay(page);
      expect((await tiles(page)).map((t) => t.off), 'three tiles greyed').toEqual([true, true, true]);
      await expect(page.locator(`${PLAY} .con-composer__warn`), 'the three skips are NAMED').toHaveCount(3);
      await expect(page.locator(`${PLAY} [data-composer-target-row]`), 'no target row').toHaveCount(0);
      await shoot(page, preset.id, 'c-01-composer');
      await commit(page, seen.posts);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau.some((c) => c.name === CARD),
        {timeout: 30_000, message: 'the card stands on the table'}).toBe(true);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      expect(await strandedReports(page), 'nothing stranded').toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
    });

    test(`(D) the mechs pay for the Building tag: the price leaves the pay row before the «+3» is born (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const seen = watchPage(page);
      const {playerId} = await bootFixtureSeats(page, request, 'robotics-factory-mechpay', {query: preset.query});
      await settle(page);
      await openPlay(page);
      await expect(page.locator(`${PLAY} .con-payrow[data-pay-unit="constructionMechs"]`), 'the mech lane names its card').toContainText(/Строительные мехи/);
      await shoot(page, preset.id, 'd-01-composer');
      await openStep(page);
      await confirmTarget(page);
      await armTransferWitness(page);
      const stop = await storyboard(page, path.join(OUT, preset.id), 'd-mechpay');
      await commit(page, seen.posts);
      const batch = batchOf(seen.posts[0]);
      const paid = mechsPaid(batch);
      expect(paid, 'with 2 M€ the mechs pay').toBeGreaterThan(0);
      await expect.poll(async () => resourcesOf(await wireOf(request, playerId), CM), {timeout: 30_000}).toBe(3 - paid + 3);
      await settle(page, {timeoutMs: 40_000});
      await waitForBoardHome(page, 30);
      await stop();
      const witness = await transferWitness(page);
      fs.writeFileSync(`test-results/robotics-factory-d-${preset.id}.txt`, transferTrail(witness));
      const price = witness.births.find((b) => b.under === 'payrow:constructionMechs');
      const gain = witness.births.find((b) => b.value === '+3');
      expect(price, `the price is born on its pay row\n${transferTrail(witness)}`).toBeDefined();
      expect(gain, `the gain is born\n${transferTrail(witness)}`).toBeDefined();
      expect(price!.t, 'the causes in their order: the price leaves first').toBeLessThan(gain!.t);
      expect(endsOverGlass(witness), `every flight's ends were visible\n${transferTrail(witness)}`).toEqual([]);
      expect(seen.errors, 'no page errors').toEqual([]);
    });

    test(`(E) the Reds rule: «✕ Нельзя разыграть» with the Industrialists' count (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'robotics-factory-locked', {query: preset.query});
      await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 900});
      await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1600});
      expect(await focusCard(page, CARD, 12), 'TR56 focused in the hand').toBe(true);
      const verdict = page.locator('.con-hand__verdictbar');
      await expect(verdict).toHaveClass(/con-hand__verdictbar--blocked/, {timeout: 10_000});
      await expect(verdict, 'the verdict refuses the play').toContainText(/Нельзя разыграть/);
      await expect(verdict, 'the count of your delegates on the party').toContainText('0/2');
      await shoot(page, preset.id, 'e-01-locked');
    });
  });
}
